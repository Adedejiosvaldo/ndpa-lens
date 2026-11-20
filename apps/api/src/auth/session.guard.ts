import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Inject,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Request, Response } from "express";
import { ProblemException } from "../common/problem.js";
import { memberships } from "../db/schema.js";
import { AUTH_DB } from "./auth-db.js";
import { type Auth, BETTER_AUTH, SESSION_ABSOLUTE_SECONDS } from "./auth.factory.js";
import { authHeaders, forwardCookies } from "./http.js";

export interface AuthContext {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    isPlatformAdmin?: boolean | null;
    twoFactorEnabled?: boolean | null;
  };
  session: { id: string; token: string; createdAt: Date; expiresAt: Date };
}

export type AuthedRequest = Request & { auth: AuthContext };

const ALLOW_WITHOUT_MFA = "ndpa:allow-without-mfa";

/**
 * Routes a user who must have MFA (Owner, Platform Admin) can still reach
 * before enrolling: enrolment itself, profile, sessions and sign-out.
 */
export const AllowWithoutMfa = () => SetMetadata(ALLOW_WITHOUT_MFA, true);

/**
 * Requires a valid session. Enforces the 7-day absolute lifetime (AUTH-06) and
 * mandatory MFA for Owners and Platform Admins (AUTH-05).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    @Inject(AUTH_DB) private readonly db: NodePgDatabase,
    private readonly reflector: Reflector,
  ) {}

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

    const exempt = this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_MFA, [ctx.getHandler(), ctx.getClass()]);
    if (!exempt && !req.auth.user.twoFactorEnabled && (await this.mfaRequired(req.auth.user))) {
      throw new ProblemException(
        403,
        "mfa_enrolment_required",
        "Set up two-factor authentication to continue",
        "Owners and platform admins must use an authenticator app. Enrol at POST /v1/auth/mfa/enrol.",
      );
    }
    return true;
  }

  /** AUTH-05: mandatory for Platform Admins and anyone who owns an organisation. */
  async mfaRequired(user: AuthContext["user"]): Promise<boolean> {
    if (user.isPlatformAdmin) return true;
    const owner = await this.db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.role, "owner")))
      .limit(1);
    return owner.length > 0;
  }
}

export const CurrentAuth = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthContext => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().auth;
});
