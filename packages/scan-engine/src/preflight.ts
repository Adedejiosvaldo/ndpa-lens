import tls from "node:tls";
import { normalizeTargetUrl } from "./net-guard.js";
import { type ByteBudget, createDispatcher, guardedGet, type Hop, type NetPolicy, vetHost } from "./net-policy.js";

export interface TlsInfo {
  /** e.g. "TLSv1.3"; null when the site has no HTTPS. */
  protocol: string | null;
  authorized: boolean;
  authorizationError: string | null;
  subject: string | null;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysToExpiry: number | null;
  altNames: string[];
}

export interface Preflight {
  requestedUrl: string;
  finalUrl: string;
  hostname: string;
  addresses: string[];
  reachable: boolean;
  status: number | null;
  redirects: Hop[];
  /** The main request only worked with certificate checks off (see tls for why). */
  certificateBypassed: boolean;
  /** Did http:// redirect to https:// (C-15)? null if not tested. */
  httpRedirectsToHttps: boolean | null;
  headers: Record<string, string>;
  tls: TlsInfo;
  robots: { status: number | null; body: string | null; disallowsAll: boolean };
  egress: { ip: string | null; source: string };
  checkedAt: string;
}

const first = (v: string | string[] | undefined): string | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Read the certificate and negotiated protocol (C-19) with a direct TLS handshake. */
export function inspectTls(hostname: string, address: string, port = 443, timeoutMs = 10_000, ca?: string): Promise<TlsInfo> {
  return new Promise((resolve) => {
    const empty: TlsInfo = { protocol: null, authorized: false, authorizationError: null, subject: null, issuer: null, validFrom: null, validTo: null, daysToExpiry: null, altNames: [] };
    const socket = tls.connect({ host: address, port, servername: hostname, rejectUnauthorized: false, timeout: timeoutMs, ...(ca ? { ca } : {}) }, () => {
      const cert = socket.getPeerCertificate();
      const validTo = cert?.valid_to ? new Date(cert.valid_to) : null;
      resolve({
        protocol: socket.getProtocol(),
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
        subject: first(cert?.subject?.CN),
        issuer: first(cert?.issuer?.O ?? cert?.issuer?.CN),
        validFrom: cert?.valid_from ? new Date(cert.valid_from).toISOString() : null,
        validTo: validTo ? validTo.toISOString() : null,
        daysToExpiry: validTo ? Math.floor((validTo.getTime() - Date.now()) / 864e5) : null,
        altNames: (cert?.subjectaltname ?? "").split(",").map((s) => s.trim().replace(/^DNS:/, "")).filter(Boolean),
      });
      socket.end();
    });
    socket.on("error", (e) => resolve({ ...empty, authorizationError: e.message }));
    socket.on("timeout", () => (socket.destroy(), resolve({ ...empty, authorizationError: "timeout" })));
  });
}

/** Robots.txt is recorded as evidence; Stage 1 scans are authorised by the client, so it is not obeyed. */
function disallowsAll(robots: string): boolean {
  let applies = false;
  for (const raw of robots.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const [k, ...rest] = line.split(":");
    const v = rest.join(":").trim();
    if (/^user-agent$/i.test(k ?? "")) applies = v === "*";
    else if (applies && /^disallow$/i.test(k ?? "") && v === "/") return true;
  }
  return false;
}

const CERT_ERROR = /CERT|certificate|SELF_SIGNED|ALTNAME|UNABLE_TO_(GET|VERIFY)/i;
function isCertificateError(e: unknown): boolean {
  for (let x: unknown = e, i = 0; x && i < 4; x = (x as { cause?: unknown }).cause, i++) {
    const { code, message } = x as { code?: string; message?: string };
    if (CERT_ERROR.test(`${code ?? ""} ${message ?? ""}`)) return true;
  }
  return false;
}

/**
 * PRD §5.1 step 1: resolve, reach, record TLS, headers, robots and the scan's
 * egress IP. Fails with ScanAbort for private or unresolvable targets.
 */
export async function preflight(
  rawUrl: string,
  opts: { policy: NetPolicy; budget?: ByteBudget; egressEchoUrl?: string; tlsPort?: number; /** Tests only: extra trusted CA (fixture site). */ tlsCa?: string },
): Promise<Preflight> {
  // Tests run fixture servers on high ports; production targets are limited to 80 and 443.
  const requestedUrl = opts.policy.allowPrivate ? new URL(rawUrl).toString() : normalizeTargetUrl(rawUrl);
  const url = new URL(requestedUrl);
  let dispatcher = createDispatcher(opts.policy, { ca: opts.tlsCa });
  const opened = [dispatcher];
  try {
    const addresses = await vetHost(url.hostname, opts.policy);
    let main: Awaited<ReturnType<typeof guardedGet>> | null = null;
    let certificateBypassed = false;
    try {
      main = await guardedGet(requestedUrl, { policy: opts.policy, dispatcher, budget: opts.budget });
    } catch (e) {
      if ((e as Error).name === "ScanAbort") throw e;
      if (isCertificateError(e)) {
        // Record headers anyway; the certificate problem is reported by C-19.
        dispatcher = createDispatcher(opts.policy, { ca: opts.tlsCa, insecure: true });
        opened.push(dispatcher);
        try {
          main = await guardedGet(requestedUrl, { policy: opts.policy, dispatcher, budget: opts.budget });
          certificateBypassed = true;
        } catch (e2) {
          if ((e2 as Error).name === "ScanAbort") throw e2;
        }
      }
    }
    const finalUrl = main?.url ?? requestedUrl;
    const httpsTarget = new URL(finalUrl).protocol === "https:";

    let httpRedirectsToHttps: boolean | null = null;
    if (url.protocol === "https:") {
      try {
        const plain = await guardedGet(`http://${url.host}/`, { policy: opts.policy, dispatcher, budget: opts.budget, maxBytes: 64 * 1024 });
        httpRedirectsToHttps = plain.chain.length > 1 && new URL(plain.url).protocol === "https:";
      } catch {
        httpRedirectsToHttps = null;
      }
    }

    const tlsInfo: TlsInfo = httpsTarget
      ? await inspectTls(new URL(finalUrl).hostname, (await vetHost(new URL(finalUrl).hostname, opts.policy))[0]!, opts.tlsPort ?? (Number(new URL(finalUrl).port) || 443), 10_000, opts.tlsCa)
      : { protocol: null, authorized: false, authorizationError: "no https", subject: null, issuer: null, validFrom: null, validTo: null, daysToExpiry: null, altNames: [] };

    let robots: Preflight["robots"] = { status: null, body: null, disallowsAll: false };
    try {
      const r = await guardedGet(new URL("/robots.txt", finalUrl).toString(), { policy: opts.policy, dispatcher, budget: opts.budget, maxBytes: 256 * 1024 });
      const body = r.status === 200 ? r.body.toString("utf8") : null;
      robots = { status: r.status, body, disallowsAll: body ? disallowsAll(body) : false };
    } catch {
      /* robots is evidence, not a gate */
    }

    let egress: Preflight["egress"] = { ip: null, source: opts.egressEchoUrl ?? "none" };
    if (opts.egressEchoUrl) {
      try {
        const r = await fetch(opts.egressEchoUrl, { signal: AbortSignal.timeout(5_000) });
        const text = (await r.text()).trim();
        const ip = text.startsWith("{") ? (JSON.parse(text).ip as string) : text;
        egress = { ip: ip || null, source: opts.egressEchoUrl };
      } catch {
        /* recorded as unknown */
      }
    }

    return {
      requestedUrl,
      finalUrl,
      hostname: url.hostname,
      addresses,
      reachable: !!main && main.status < 500,
      status: main?.status ?? null,
      redirects: main?.chain ?? [],
      certificateBypassed,
      httpRedirectsToHttps,
      headers: main?.headers ?? {},
      tls: tlsInfo,
      robots,
      egress,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await Promise.all(opened.map((d) => d.close()));
  }
}
