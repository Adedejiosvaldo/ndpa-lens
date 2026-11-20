import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Keeps the scanner pointed at the public internet. Without this, anyone
 * could ask the server to load internal addresses (cloud metadata, admin
 * panels, localhost services) and read what comes back.
 */

export class ScanAbort extends Error {
  /** HTTP status the API should answer with. */
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ScanAbort";
    this.status = status;
  }
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const BLOCKED_V4: Array<[string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. cloud metadata 169.254.169.254
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

export function isPrivateAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    const n = ipv4ToInt(ip);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (n & mask) === (ipv4ToInt(base) & mask);
    });
  }
  if (version === 6) {
    const v6 = ip.toLowerCase();
    if (v6 === "::" || v6 === "::1") return true;
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return (
      /^f[cd]/.test(v6) || // unique local fc00::/7
      /^fe[89ab]/.test(v6) || // link-local fe80::/10
      /^ff/.test(v6) || // multicast
      v6.startsWith("64:ff9b:") ||
      v6.startsWith("2001:db8:")
    );
  }
  return true; // not an IP at all: refuse
}

export type HostCheck = "public" | "private" | "unresolved";

const hostCache = new Map<string, { result: HostCheck; at: number }>();
const HOST_CACHE_MS = 60_000;

async function resolveAll(host: string): Promise<string[] | null> {
  // DNS can fail briefly under load, so try a few times before giving up.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const addresses = await lookup(host, { all: true, verbatim: true });
      if (addresses.length > 0) return addresses.map((a) => a.address);
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === "ENOTFOUND" && attempt >= 1) return null;
    }
    await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
  }
  return null;
}

/** Checks where a hostname really points. Only successful answers are cached. */
export async function checkHost(hostname: string): Promise<HostCheck> {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return "private";
  }
  if (isIP(host)) return isPrivateAddress(host) ? "private" : "public";

  const cached = hostCache.get(host);
  if (cached && Date.now() - cached.at < HOST_CACHE_MS) return cached.result;

  const addresses = await resolveAll(host);
  if (!addresses) return "unresolved";
  const result: HostCheck = addresses.every((a) => !isPrivateAddress(a)) ? "public" : "private";
  hostCache.set(host, { result, at: Date.now() });
  return result;
}

/** True when every address the hostname resolves to is public. */
export async function isPublicHost(hostname: string): Promise<boolean> {
  return (await checkHost(hostname)) === "public";
}

/** Parses and checks the address typed in by the user. */
export function normalizeTargetUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new ScanAbort("Please enter a valid website URL to audit.");
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    throw new ScanAbort("Invalid URL format. Example: https://nitda.gov.ng");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ScanAbort("Only HTTP and HTTPS URLs are supported.");
  }
  if (parsed.username || parsed.password) {
    throw new ScanAbort("Remove the username and password from the address.");
  }
  if (parsed.port && !["80", "443"].includes(parsed.port)) {
    throw new ScanAbort("Only standard web ports (80 and 443) can be scanned.");
  }
  return parsed.toString();
}

export async function assertPublicUrl(url: string): Promise<void> {
  const { hostname } = new URL(url);
  const result = await checkHost(hostname);
  if (result === "unresolved") {
    throw new ScanAbort("We couldn't find that website. Check the address and try again.");
  }
  if (result === "private") {
    throw new ScanAbort(
      "That address points to a private or internal network, which can't be scanned."
    );
  }
}

/**
 * fetch() that re-checks the destination on every redirect hop, so a public
 * page can't bounce the scanner to an internal address.
 */
export async function safeFetch(
  url: string,
  init: RequestInit = {},
  maxRedirects = 5
): Promise<Response> {
  let current = url;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    await assertPublicUrl(current);
    const res = await fetch(current, { ...init, redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return res;
      const next = new URL(location, current);
      if (!["http:", "https:"].includes(next.protocol)) {
        throw new ScanAbort("The site redirected to an unsupported address.");
      }
      current = next.toString();
      continue;
    }
    // Response.url is empty for manual fetches; carry the real one along.
    Object.defineProperty(res, "url", { value: current });
    return res;
  }
  throw new ScanAbort("The site redirected too many times.");
}
