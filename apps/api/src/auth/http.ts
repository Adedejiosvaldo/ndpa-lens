import type { Request, Response } from "express";
import { CLIENT_IP_HEADER } from "./auth.factory.js";

/** Client IP as resolved by Express "trust proxy" (never a raw client header). */
export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

/**
 * Headers for an `auth.api.*` call: the incoming request's headers, with our
 * trusted client-IP header replacing anything the client sent.
 */
export function authHeaders(req: Request): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined || k.toLowerCase() === CLIENT_IP_HEADER) continue;
    h.set(k, Array.isArray(v) ? v.join(", ") : v);
  }
  h.set(CLIENT_IP_HEADER, clientIp(req));
  return h;
}

/** Copy Set-Cookie headers from a Better Auth response onto ours. */
export function forwardCookies(from: Headers | undefined | null, res: Response): void {
  if (!from) return;
  const cookies = from.getSetCookie();
  if (cookies.length) res.append("Set-Cookie", cookies);
}
