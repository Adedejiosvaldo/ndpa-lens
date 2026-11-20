import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ProblemException } from "../common/problem.js";
import { type Auth, BETTER_AUTH, SESSION_ABSOLUTE_SECONDS } from "./auth.factory.js";
import { authHeaders, forwardCookies } from "./http.js";

export interface AuthContext {
  user: { id: string; name: string; email: string; emailVerified: boolean; isPlatformAdmin?: boolean | null };
  session: { id: string; token: string; createdAt: Date; expiresAt: Date };
}

export type AuthedRequest = Request & { auth: AuthContext };

/** Requires a valid session; enforces the 7-day absolute lifetime (AUTH-06). */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(BETTER_AUTH) private readonly auth: Auth) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const headers = authHeaders(req);
    const { headers: out, response } = await this.auth.api.getSession({ headers, returnHeaders: true });
    if (!response) throw new ProblemException(401, "unauthenticated", "You need to sign in");

    const ageSeconds = (Date.now() - new Date(response.session.createdAt).getTime()) / 1000;
    if (ageSeconds > SESSION_ABSOLUTE_SECONDS) {
      await this.auth.api.revokeSession({ headers, body: { token: response.session.token } }).catch(() => undefined);
      throw new ProblemException(401, "unauthenticated", "Your session has ended", "Sessions last at most 7 days. Sign in again.");
    }
    forwardCookies(out, res); // sliding-expiry refresh, if Better Auth issued one
    req.auth = response as unknown as AuthContext;
    return true;
  }
}

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().auth;
});
