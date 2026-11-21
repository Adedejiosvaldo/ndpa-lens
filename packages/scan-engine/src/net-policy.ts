import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP } from "node:net";
import { Agent, request } from "undici";
import { isPrivateAddress, ScanAbort } from "./net-guard.js";

/**
 * Network policy for the evidence pipeline (PRD §9, "scan worker isolation"):
 * every TCP connection re-resolves DNS and refuses private, loopback,
 * link-local and metadata addresses AT CONNECT TIME, so a hostname can't pass
 * a check and then rebind to 169.254.169.254. Redirects are capped and bytes
 * are budgeted per response and per scan. The DOCKER-USER egress rules
 * (Step 33) are the second layer underneath this one.
 */
export interface NetPolicy {
  /**
   * Tests only: allow private targets (local fixture servers). `true` allows
   * all; a function allows just the addresses it accepts.
   */
  allowPrivate?: boolean | ((ip: string) => boolean);
  /** Injectable resolver (tests simulate rebinding with it). */
  resolve?: (hostname: string) => Promise<string[]>;
  /** Scanner identification, sent with every request (PRD §9). */
  contactUrl: string;
  userAgent?: string;
}

/** Realistic desktop UA (PRD §5.1); identification travels in its own header. */
export const DESKTOP_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
export const SCANNER_HEADER = "x-ndpa-lens-scanner";

export const LIMITS = {
  maxRedirects: 5,
  maxResponseBytes: 10 * 1024 * 1024,
  maxScanBytes: 400 * 1024 * 1024,
  timeoutMs: 45_000,
};

export function scannerHeaders(policy: NetPolicy): Record<string, string> {
  return { "user-agent": policy.userAgent ?? DESKTOP_UA, [SCANNER_HEADER]: `NDPA Lens evidence scanner (+${policy.contactUrl})` };
}

const systemResolve = (hostname: string) =>
  new Promise<string[]>((resolve, reject) =>
    dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) => (err ? reject(err) : resolve((addrs as LookupAddress[]).map((a) => a.address)))),
  );

/** Resolve and vet a host. Throws ScanAbort for private or unresolvable targets. */
export async function vetHost(hostname: string, policy: NetPolicy): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  let addrs: string[];
  if (isIP(host)) addrs = [host];
  else {
    try {
      addrs = await (policy.resolve ?? systemResolve)(host);
    } catch {
      throw new ScanAbort("We couldn't find that website. Check the address and try again.", 422);
    }
  }
  if (addrs.length === 0) throw new ScanAbort("We couldn't find that website. Check the address and try again.", 422);
  const allowed = (ip: string) => policy.allowPrivate === true || (typeof policy.allowPrivate === "function" && policy.allowPrivate(ip));
  if (addrs.some((a) => isPrivateAddress(a) && !allowed(a))) {
    throw new ScanAbort("That address points to a private or internal network, which can't be scanned.", 422);
  }
  return addrs;
}

/** undici dispatcher whose every connection goes through vetHost. */
export function createDispatcher(policy: NetPolicy): Agent {
  return new Agent({
    connect: {
      timeout: 10_000,
      lookup: (hostname, _opts, cb) => {
        vetHost(hostname, policy).then(
          (addrs) => {
            const address = addrs[0]!;
            cb(null, address, isIP(address) === 6 ? 6 : 4);
          },
          (err) => cb(err as NodeJS.ErrnoException, "", 4),
        );
      },
    },
    headersTimeout: LIMITS.timeoutMs,
    bodyTimeout: LIMITS.timeoutMs,
  });
}

/** Tracks bytes downloaded across a whole scan (PRD §9: cap total bytes per scan). */
export class ByteBudget {
  used = 0;
  constructor(readonly limit = LIMITS.maxScanBytes) {}
  take(n: number) {
    this.used += n;
    if (this.used > this.limit) throw new ScanAbort("This site is larger than a scan can download, so the scan stopped.", 422);
  }
}

export interface Hop {
  url: string;
  status: number;
}

export interface GuardedResponse {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  /** True when the body hit maxResponseBytes and was cut. */
  truncated: boolean;
  chain: Hop[];
}

/**
 * GET with the scanner's identity, connect-time address vetting, a redirect
 * cap and byte limits. Only http(s) targets; every hop is vetted.
 */
export async function guardedGet(
  url: string,
  ctx: { policy: NetPolicy; dispatcher: Agent; budget?: ByteBudget; maxBytes?: number; maxRedirects?: number; headers?: Record<string, string> },
): Promise<GuardedResponse> {
  const maxRedirects = ctx.maxRedirects ?? LIMITS.maxRedirects;
  const maxBytes = ctx.maxBytes ?? LIMITS.maxResponseBytes;
  const chain: Hop[] = [];
  let current = new URL(url);
  for (let hop = 0; ; hop++) {
    if (!/^https?:$/.test(current.protocol)) throw new ScanAbort("The site redirected to an unsupported address.", 422);
    // undici skips the connect-time lookup for IP literals, so vet every hop
    // here as well; named hosts are vetted again at connect (rebinding).
    await vetHost(current.hostname, ctx.policy);
    const res = await request(current, {
      method: "GET",
      dispatcher: ctx.dispatcher,
      headers: { ...scannerHeaders(ctx.policy), accept: "text/html,application/xhtml+xml,*/*;q=0.8", ...ctx.headers },
    });
    const headers = Object.fromEntries(Object.entries(res.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : String(v ?? "")]));
    chain.push({ url: current.toString(), status: res.statusCode });
    if (res.statusCode >= 300 && res.statusCode < 400 && headers.location) {
      await res.body.dump();
      if (hop >= maxRedirects) throw new ScanAbort("The site redirected too many times.", 422);
      current = new URL(headers.location, current);
      continue;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let truncated = false;
    for await (const chunk of res.body) {
      const b = chunk as Buffer;
      if (size + b.length > maxBytes) {
        chunks.push(b.subarray(0, maxBytes - size));
        ctx.budget?.take(maxBytes - size);
        size = maxBytes;
        truncated = true;
        res.body.destroy();
        break;
      }
      chunks.push(b);
      size += b.length;
      ctx.budget?.take(b.length);
    }
    return { url: current.toString(), status: res.statusCode, headers, body: Buffer.concat(chunks), truncated, chain };
  }
}
