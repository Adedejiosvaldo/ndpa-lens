import http from "node:http";
import type { AddressInfo } from "node:net";
import { type ObjectStore, sha256Hex } from "@ndpa/storage";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { capturePage, EvidenceWriter, type NetPolicy } from "../src/index.js";

/** In-memory object store with the ObjectStore surface the writer uses. */
function memoryStore() {
  const objects = new Map<string, Uint8Array>();
  return {
    objects,
    store: {
      put: async (key: string, bytes: Uint8Array) => (objects.set(key, bytes), { key, sha256: sha256Hex(bytes), bytes: bytes.byteLength }),
      get: async (key: string) => objects.get(key)!,
    } as unknown as ObjectStore,
  };
}

const banner = `
<div id="cookie-banner" role="dialog" style="position:fixed;bottom:0;left:0;right:0;padding:20px;background:#fff;border-top:1px solid #ccc">
  We use cookies and similar tracking technologies to measure visits and show you relevant adverts.
  <button id="acc" style="padding:10px 20px">Accept all</button>
  <button id="rej" style="padding:10px 20px">Reject all</button>
</div>`;

const consentJs = (trackBeforeConsent: boolean, honourReject: boolean) => `
<script>
  const c = (document.cookie.match(/consent=(\\w+)/) || [])[1];
  if (c) document.getElementById('cookie-banner').style.display = 'none';
  const load = () => { const s = document.createElement('script'); s.src = 'http://tracker.test:' + location.port + '/pixel.js?uid=1'; document.head.appendChild(s); };
  if (${trackBeforeConsent} || c === 'accept' || (c === 'reject' && ${!honourReject})) load();
  document.getElementById('acc').onclick = () => { document.cookie = 'consent=accept; path=/'; };
  document.getElementById('rej').onclick = () => { document.cookie = 'consent=reject; path=/'; };
</script>`;

const PAGES: Record<string, string> = {
  "/good": `<html><head><title>Good Co</title></head><body><h1>Good Co</h1>
    <form action="https://site.test/subscribe" method="post"><label>Email <input type="email" name="email"></label>
      <label><input type="checkbox" name="marketing"> Send me offers</label>
      <a href="/privacy">Privacy notice</a><button type="submit">Subscribe</button></form>
    ${banner}${consentJs(false, true)}</body></html>`,
  "/bad": `<html><head><title>Bad Co</title></head><body><h1>Bad Co</h1>
    <form action="http://site.test/join" method="post"><label>Full name <input name="fullname"></label><label>Phone <input type="tel" name="phone"></label>
      <label><input type="checkbox" name="offers" checked> I agree to marketing offers</label><button>Join</button></form>
    <img src="http://metadata.test/latest/meta-data/">
    ${banner}${consentJs(true, false)}</body></html>`,
};

let server: http.Server;
let port: number;
let browser: Browser;
let policy: NetPolicy;
const hits: string[] = [];

beforeAll(async () => {
  server = http.createServer((req, res) => {
    hits.push(`${req.headers.host}${req.url}`);
    const path = new URL(req.url!, "http://x").pathname;
    if (path === "/pixel.js") return res.writeHead(200, { "content-type": "text/javascript" }).end("document.cookie = '_fbp=fb.1.123; path=/';");
    const body = PAGES[path];
    if (!body) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": "text/html" }).end(body);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  port = (server.address() as AddressInfo).port;
  policy = {
    contactUrl: "https://ndpalens.test/scanner",
    // site.test and tracker.test are the local fixture; metadata.test must be refused.
    resolve: async (h) => (h === "metadata.test" ? ["169.254.169.254"] : ["127.0.0.1"]),
    allowPrivate: (ip) => ip === "127.0.0.1",
  };
  browser = await chromium.launch({ args: ["--host-resolver-rules=MAP *.test 127.0.0.1"] });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  server?.close();
});

const run = (path: string, state: "none" | "reject" | "accept", device: "desktop" | "mobile" = "desktop") => {
  const mem = memoryStore();
  const writer = new EvidenceWriter(mem.store, "org-1", "scan-1");
  return capturePage(browser, { url: `http://site.test:${port}${path}`, pageId: `p${path.replace("/", "-")}`, pageType: "home", state, policy, writer, device }).then((c) => ({ c, writer, mem }));
};
const trackerHits = (c: Awaited<ReturnType<typeof run>>["c"], phase?: string) =>
  c.requests.filter((r) => r.host === "tracker.test" && (!phase || r.phase === phase));

describe("SCAN-03 three consent states on a compliant site", () => {
  it("no interaction: banner shown above the fold with equal reject and accept, no tracking", async () => {
    const { c } = await run("/good", "none");
    expect(c.banner).toMatchObject({ found: true, aboveFold: true });
    const roles = c.banner.buttons.map((b) => b.role).sort();
    expect(roles).toEqual(["accept", "reject"]);
    const [a, r] = [c.banner.buttons.find((b) => b.role === "accept")!, c.banner.buttons.find((b) => b.role === "reject")!];
    expect(Math.abs(a.area - r.area) / a.area).toBeLessThan(0.25);
    expect(trackerHits(c)).toHaveLength(0);
    expect(c.choice).toBeNull();
  });

  it("reject all: the click lands and nothing tracks after the reload", async () => {
    const { c } = await run("/good", "reject");
    expect(c.choice).toMatchObject({ attempted: "reject", clicked: true, label: "Reject all" });
    expect(trackerHits(c, "after-choice")).toHaveLength(0);
    expect(c.cookies.find((k) => k.name === "consent")?.setBeforeChoice).toBe(false);
  });

  it("accept all: the tracker loads after the choice and is marked third-party", async () => {
    const { c } = await run("/good", "accept");
    const after = trackerHits(c, "after-choice");
    expect(after.length).toBeGreaterThan(0);
    expect(after[0]).toMatchObject({ thirdParty: true, resourceType: "script" });
  });
});

describe("a non-compliant site", () => {
  it("tracks before consent, keeps tracking after reject, and its form breaks the rules", async () => {
    const none = (await run("/bad", "none")).c;
    expect(trackerHits(none, "initial").length).toBeGreaterThan(0);
    expect(none.cookies.find((k) => k.name === "_fbp")).toMatchObject({ setBeforeChoice: true });
    const form = none.forms[0]!;
    expect(form.actionScheme).toBe("http");
    expect(form.privacyLinkNearSubmit).toBe(false);
    expect(form.checkboxes[0]).toMatchObject({ checked: true, consentLike: true });
    expect(form.fields.filter((f) => f.personal).map((f) => f.name).sort()).toEqual(["fullname", "phone"]);

    const rejected = (await run("/bad", "reject")).c;
    expect(rejected.choice?.clicked).toBe(true);
    expect(trackerHits(rejected, "after-choice").length).toBeGreaterThan(0);
  });

  it("never lets the page reach a private address through the browser (PRD §9)", async () => {
    const { c } = await run("/bad", "none");
    const meta = c.requests.find((r) => r.host === "metadata.test");
    expect(meta?.blocked).toMatch(/BLOCKED_BY_CLIENT/i);
    expect(hits.some((h) => h.startsWith("metadata.test"))).toBe(false);
  });

  it("never submits forms", async () => {
    await run("/bad", "accept");
    expect(hits.some((h) => h.includes("/join") || h.includes("/subscribe"))).toBe(false);
  });
});

describe("evidence (PRD §5.1 step 3, PACK-03)", () => {
  it("stores DOM, screenshots, HAR, cookies and page data, each hashed and verifiable", async () => {
    const { c, writer, mem } = await run("/good", "accept");
    expect(c.evidence.map((e) => e.kind).sort()).toEqual(["cookies", "dom", "forms", "har", "screenshot", "screenshot_fold"]);
    for (const f of c.evidence) {
      expect(f.key).toMatch(/^orgs\/org-1\/scans\/scan-1\/p-good\/accept\//);
      expect(await writer.verify(f)).toBe(true);
    }
    const har = JSON.parse(new TextDecoder().decode(mem.objects.get(c.evidence.find((e) => e.kind === "har")!.key)));
    expect(har.log.entries.length).toBeGreaterThan(0);
  });

  it("runs the homepage mobile pass on a Pixel 7 profile", async () => {
    const { c, mem } = await run("/good", "none", "mobile");
    expect(c.device).toBe("mobile");
    const fold = mem.objects.get(c.evidence.find((e) => e.kind === "screenshot_fold")!.key)!;
    // PNG width is bytes 16-19: 412 CSS px at DPR 2.625.
    expect(new DataView(fold.buffer, fold.byteOffset).getUint32(16)).toBe(Math.floor(412 * 2.625));
  });
});
