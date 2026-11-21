import http from "node:http";
import https from "node:https";
import type { AddressInfo } from "node:net";
import selfsigned from "selfsigned";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ByteBudget, createDispatcher, guardedGet, inspectTls, type NetPolicy, normalizeTargetUrl, preflight, SCANNER_HEADER, ScanAbort, vetHost } from "../src/index.js";

const local: NetPolicy = { allowPrivate: true, contactUrl: "https://ndpalens.test/scanner" };
const strict: NetPolicy = { contactUrl: "https://ndpalens.test/scanner" };

let server: http.Server;
let base: string;
let seenHeaders: http.IncomingHttpHeaders = {};
let tlsServer: https.Server;
let tlsPort: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    seenHeaders = req.headers;
    const u = new URL(req.url!, "http://x");
    if (u.pathname.startsWith("/loop")) return res.writeHead(302, { location: `/loop${Number(u.searchParams.get("n") ?? 0) + 1}?n=${Number(u.searchParams.get("n") ?? 0) + 1}` }).end();
    if (u.pathname === "/to-metadata") return res.writeHead(302, { location: "http://169.254.169.254/latest/meta-data/" }).end();
    if (u.pathname === "/to-file") return res.writeHead(302, { location: "file:///etc/passwd" }).end();
    if (u.pathname === "/big") return res.writeHead(200, { "content-type": "text/plain" }).end(Buffer.alloc(300_000, 97));
    if (u.pathname === "/robots.txt") return res.writeHead(200).end("User-agent: *\nDisallow: /\n");
    res.writeHead(200, { "content-type": "text/html", "x-frame-options": "DENY" }).end("<html><title>Harbour</title></html>");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const pems = await selfsigned.generate([{ name: "commonName", value: "harbour.test" }], { notAfterDate: new Date(Date.now() + 30 * 864e5), keySize: 2048 });
  tlsServer = https.createServer({ key: pems.private, cert: pems.cert, minVersion: "TLSv1.2" }, (_q, r) => r.end("ok"));
  await new Promise<void>((r) => tlsServer.listen(0, "127.0.0.1", r));
  tlsPort = (tlsServer.address() as AddressInfo).port;
});

afterAll(async () => {
  server?.close();
  tlsServer?.close();
});

describe("connect-time address vetting (PRD §9)", () => {
  it("refuses private, loopback and metadata addresses", async () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "::1"]) {
      await expect(vetHost(ip, strict), ip).rejects.toBeInstanceOf(ScanAbort);
    }
    await expect(vetHost("harbour.ng", { ...strict, resolve: async () => ["102.89.4.10"] })).resolves.toEqual(["102.89.4.10"]);
  });

  it("stops DNS rebinding: a host that passed the check is refused when it rebinds at connect", async () => {
    let calls = 0;
    const rebinding: NetPolicy = { ...strict, resolve: async () => (++calls === 1 ? ["102.89.4.10"] : ["127.0.0.1"]) };
    await expect(vetHost("evil-rebind.ng", rebinding)).resolves.toEqual(["102.89.4.10"]);
    const port = new URL(base).port;
    const dispatcher = createDispatcher(rebinding);
    await expect(guardedGet(`http://evil-rebind.ng:${port}/`, { policy: rebinding, dispatcher })).rejects.toThrow(/private or internal network/);
    await dispatcher.close();
  });

  it("vets every redirect hop: a public page can't bounce the scanner to metadata or file:", async () => {
    const onlyFixture: NetPolicy = { ...strict, allowPrivate: (ip) => ip === "127.0.0.1" };
    const dispatcher = createDispatcher(onlyFixture);
    await expect(guardedGet(`${base}/`, { policy: onlyFixture, dispatcher })).resolves.toMatchObject({ status: 200 });
    await expect(guardedGet(`${base}/to-metadata`, { policy: onlyFixture, dispatcher })).rejects.toThrow(/private or internal network/);
    await expect(guardedGet(`${base}/to-file`, { policy: onlyFixture, dispatcher })).rejects.toThrow(/unsupported address/);
    await dispatcher.close();
  });
});

describe("guardedGet limits", () => {
  it("stops a redirect loop after 5 hops", async () => {
    const dispatcher = createDispatcher(local);
    await expect(guardedGet(`${base}/loop`, { policy: local, dispatcher })).rejects.toThrow(/too many times/);
    await dispatcher.close();
  });

  it("truncates oversized responses and enforces the per-scan budget", async () => {
    const dispatcher = createDispatcher(local);
    const r = await guardedGet(`${base}/big`, { policy: local, dispatcher, maxBytes: 100_000 });
    expect(r.body.length).toBe(100_000);
    expect(r.truncated).toBe(true);
    const budget = new ByteBudget(150_000);
    await guardedGet(`${base}/big`, { policy: local, dispatcher, budget, maxBytes: 100_000 });
    await expect(guardedGet(`${base}/big`, { policy: local, dispatcher, budget, maxBytes: 100_000 })).rejects.toThrow(/larger than a scan/);
    await dispatcher.close();
  });

  it("identifies itself with a realistic UA plus the scanner header", async () => {
    const dispatcher = createDispatcher(local);
    await guardedGet(`${base}/`, { policy: local, dispatcher });
    expect(seenHeaders["user-agent"]).toMatch(/Chrome\/\d+/);
    expect(seenHeaders[SCANNER_HEADER]).toBe("NDPA Lens evidence scanner (+https://ndpalens.test/scanner)");
    await dispatcher.close();
  });
});

describe("normalizeTargetUrl (tracker 14a)", () => {
  it("refuses non-http schemes up front", () => {
    expect(() => normalizeTargetUrl("ftp://harbour.ng")).toThrow(/Only HTTP and HTTPS/);
    expect(() => normalizeTargetUrl("file:///etc/passwd")).toThrow(ScanAbort);
  });
});

describe("preflight (PRD §5.1 step 1)", () => {
  it("records reachability, headers, redirects and robots.txt", async () => {
    const p = await preflight(`${base}/`, { policy: local });
    expect(p).toMatchObject({ reachable: true, status: 200, hostname: "127.0.0.1", addresses: ["127.0.0.1"] });
    expect(p.headers["x-frame-options"]).toBe("DENY");
    expect(p.robots).toMatchObject({ status: 200, disallowsAll: true });
    expect(p.tls.protocol).toBeNull();
  });

  it("refuses a private target outright", async () => {
    const loopbackName: NetPolicy = { ...strict, resolve: async () => ["127.0.0.1"] };
    await expect(preflight("http://internal-looking.ng/", { policy: loopbackName })).rejects.toThrow(/private or internal/);
  });

  it("reads the TLS protocol and certificate, and flags an untrusted one", async () => {
    const t = await inspectTls("harbour.test", "127.0.0.1", tlsPort);
    expect(t.protocol).toMatch(/^TLSv1\.[23]$/);
    expect(t.subject).toBe("harbour.test");
    expect(t.authorized).toBe(false);
    expect(t.daysToExpiry).toBeGreaterThanOrEqual(28);
  });
});
