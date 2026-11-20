import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Request, Response } from "express";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { ProblemException } from "../common/problem.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { users } from "../db/schema.js";
import { Mailer } from "../mail/mail.service.js";
import * as T from "../mail/templates.js";
import { AUTH_DB } from "./auth-db.js";
import { EmailBody, LoginBody, ResetBody, SignUpBody, TokenBody } from "./auth.dto.js";
import { fromAuthError } from "./auth-errors.js";
import { type Auth, BETTER_AUTH } from "./auth.factory.js";
import { CSRF_COOKIE, newCsrfToken } from "./csrf.js";
import { authHeaders, clientIp, forwardCookies } from "./http.js";
import { LOGIN_MAX_FAILURES, LoginLimiter } from "./login-limiter.js";
import { PwnedPasswords } from "./pwned.js";
import { AllowWithoutMfa, type AuthContext, CurrentAuth, SessionGuard } from "./session.guard.js";

const ACCEPTED = { status: "accepted" } as const;

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    @Inject(AUTH_DB) private readonly db: NodePgDatabase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly limiter: LoginLimiter,
    private readonly pwned: PwnedPasswords,
    private readonly mailer: Mailer,
    private readonly audit: AuditService,
  ) {}

  /** Issue a CSRF token: HttpOnly cookie + the same value in the body for the X-CSRF-Token header. */
  @Get("csrf")
  csrf(@Res({ passthrough: true }) res: Response) {
    const token = newCsrfToken();
    res.cookie(CSRF_COOKIE, token, { httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    res.setHeader("Cache-Control", "no-store");
    return { csrfToken: token };
  }

  /**
   * AUTH-01. Same 202 whether or not the email is new (no account enumeration):
   * new addresses get a verification link, existing ones a "you already have an
   * account" note.
   */
  @Post("signup")
  @HttpCode(202)
  async signup(@Body(new ZodPipe(SignUpBody)) body: z.infer<typeof SignUpBody>, @Req() req: Request) {
    await this.rejectBreached(body.password, "password");
    try {
      await this.auth.api.signUpEmail({ body, headers: authHeaders(req) });
    } catch (err) {
      fromAuthError(err);
    }
    return ACCEPTED;
  }

  /** AUTH-02. Confirms the email and signs the user in. */
  @Post("verify-email")
  @HttpCode(200)
  async verifyEmail(
    @Body(new ZodPipe(TokenBody)) body: z.infer<typeof TokenBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { headers } = await this.auth.api.verifyEmail({ query: { token: body.token }, headers: authHeaders(req), returnHeaders: true });
      forwardCookies(headers, res);
    } catch (err) {
      fromAuthError(err);
    }
    const session = await this.auth.api.getSession({ headers: new Headers({ cookie: setCookieAsCookie(res) }) });
    if (session) {
      await this.audit.record({ action: "auth.email_verified", actorUserId: session.user.id, ip: clientIp(req) });
    }
    return { status: "verified" };
  }

  @Post("verify-email/resend")
  @HttpCode(202)
  async resendVerification(@Body(new ZodPipe(EmailBody)) body: z.infer<typeof EmailBody>, @Req() req: Request) {
    if (await this.limiter.allow("verify-resend", body.email, 3, 3600)) {
      await this.auth.api.sendVerificationEmail({ body: { email: body.email }, headers: authHeaders(req) }).catch(() => undefined);
    }
    return ACCEPTED;
  }

  /** AUTH-03: 5 failures per 15 min per account and per IP, then 429 and a notice email. */
  @Post("login")
  @HttpCode(200)
  async login(
    @Body(new ZodPipe(LoginBody)) body: z.infer<typeof LoginBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = clientIp(req);
    const wait = await this.limiter.blockedFor(body.email, ip);
    if (wait > 0) {
      res.setHeader("Retry-After", String(wait));
      throw new ProblemException(429, "rate_limited", "Too many failed sign-in attempts", `Try again in ${Math.ceil(wait / 60)} minutes.`);
    }
    try {
      const { headers, response } = await this.auth.api.signInEmail({
        body: { email: body.email, password: body.password },
        headers: authHeaders(req),
        returnHeaders: true,
      });
      await this.limiter.reset(body.email);
      forwardCookies(headers, res);
      // AUTH-05: password was right but a second factor is due. No session yet;
      // a short-lived two-factor cookie carries the pending sign-in.
      if ("twoFactorRedirect" in response && response.twoFactorRedirect) return { mfaRequired: true };
      const u = (response as { user: { id: string; name: string; email: string; emailVerified: boolean } }).user;
      await this.audit.record({ action: "auth.login", actorUserId: u.id, ip });
      return { mfaRequired: false, user: { id: u.id, name: u.name, email: u.email, emailVerified: u.emailVerified } };
    } catch (err) {
      const failures = await this.limiter.fail(body.email, ip);
      const [user] = await this.db.select({ id: users.id, name: users.name }).from(users).where(eq(users.email, body.email));
      await this.audit.record({ action: "auth.login_failed", actorUserId: user?.id ?? null, ip, metadata: { failures } });
      if (user && failures === LOGIN_MAX_FAILURES) {
        await this.mailer.send({ to: body.email, ...T.accountLocked(user.name, `${this.config.WEB_URL}/forgot-password`) });
        await this.audit.record({ action: "auth.login_locked", actorUserId: user.id, ip });
      }
      fromAuthError(err);
    }
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(SessionGuard)
  @AllowWithoutMfa()
  async logout(@CurrentAuth() a: AuthContext, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { headers } = await this.auth.api.signOut({ headers: authHeaders(req), returnHeaders: true });
    forwardCookies(headers, res);
    await this.audit.record({ action: "auth.logout", actorUserId: a.user.id, ip: clientIp(req) });
  }

  /** AUTH-04. Always 202; only existing accounts get an email. */
  @Post("password/forgot")
  @HttpCode(202)
  async forgot(@Body(new ZodPipe(EmailBody)) body: z.infer<typeof EmailBody>, @Req() req: Request) {
    if (await this.limiter.allow("reset", body.email, 3, 3600)) {
      await this.auth.api.requestPasswordReset({ body: { email: body.email }, headers: authHeaders(req) }).catch(() => undefined);
    }
    return ACCEPTED;
  }

  /** AUTH-04. Single-use, 30-minute token; signs the user out everywhere. */
  @Post("password/reset")
  @HttpCode(200)
  async reset(@Body(new ZodPipe(ResetBody)) body: z.infer<typeof ResetBody>, @Req() req: Request) {
    await this.rejectBreached(body.newPassword, "newPassword");
    try {
      await this.auth.api.resetPassword({ body: { token: body.token, newPassword: body.newPassword }, headers: authHeaders(req) });
    } catch (err) {
      fromAuthError(err);
    }
    return { status: "reset" };
  }

  private async rejectBreached(password: string, path: string): Promise<void> {
    if (await this.pwned.isBreached(password)) {
      throw new ProblemException(400, "validation_failed", "Choose a different password", undefined, [
        { path, message: "This password has appeared in a data breach. Choose one you haven't used elsewhere." },
      ]);
    }
  }
}

/** Turn the Set-Cookie headers we just added into a Cookie header (name=value pairs). */
function setCookieAsCookie(res: Response): string {
  const set = res.getHeader("Set-Cookie");
  const list = Array.isArray(set) ? set : set ? [String(set)] : [];
  return list.map((c) => c.split(";")[0]).join("; ");
}
