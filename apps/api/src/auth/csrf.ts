import { randomBytes, timingSafeEqual } from "node:crypto";
import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { ProblemException } from "../common/problem.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

export const CSRF_COOKIE = "__Secure-ndpa.csrf";
export const CSRF_HEADER = "x-csrf-token";
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const EXEMPT_PREFIXES = ["/v1/webhooks/"]; // server-to-server, authenticated by signature

export function newCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * CSRF for cookie-authenticated browser calls (PRD §8): double-submit token
 * (HttpOnly cookie + X-CSRF-Token header) and an Origin allow-list. Applies to
 * every unsafe method, signed in or not, so login/sign-up are covered too.
 */
@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly allowedOrigins: Set<string>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.allowedOrigins = new Set([new URL(config.WEB_URL).origin, new URL(config.API_URL).origin]);
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE.has(req.method) || EXEMPT_PREFIXES.some((p) => req.originalUrl.startsWith(p))) return next();
    const origin = req.header("origin");
    if (origin && !this.allowedOrigins.has(origin)) throw csrfError("Cross-site requests are not allowed");
    const cookie = (req.cookies as Record<string, string> | undefined)?.[CSRF_COOKIE];
    const header = req.header(CSRF_HEADER);
    if (!cookie || !header || !equal(cookie, header)) throw csrfError("Missing or invalid CSRF token");
    next();
  }
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function csrfError(title: string): ProblemException {
  return new ProblemException(403, "csrf_invalid", title, "Fetch a token from GET /v1/auth/csrf and send it in X-CSRF-Token.");
}
