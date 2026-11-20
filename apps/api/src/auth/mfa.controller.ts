import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { ProblemException } from "../common/problem.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { fromAuthError } from "./auth-errors.js";
import { type Auth, BETTER_AUTH } from "./auth.factory.js";
import { authHeaders, clientIp, forwardCookies } from "./http.js";
import { AllowWithoutMfa, type AuthContext, CurrentAuth, SessionGuard } from "./session.guard.js";

const PasswordBody = z.object({ password: z.string().min(1).max(128) });
const CodeBody = z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") });
const VerifyBody = z.union([
  z.object({ code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code") }),
  z.object({ recoveryCode: z.string().trim().min(6).max(64) }),
]);

/** AUTH-05: TOTP enrolment, sign-in second step, recovery codes. */
@ApiTags("auth")
@Controller("auth/mfa")
export class MfaController {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    private readonly audit: AuditService,
    private readonly sessions: SessionGuard,
  ) {}

  /** Start enrolment: returns the otpauth URI (for the QR code), the manual key and 10 recovery codes. */
  @Post("enrol")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @AllowWithoutMfa()
  async enrol(@Body(new ZodPipe(PasswordBody)) body: z.infer<typeof PasswordBody>, @Req() req: Request) {
    try {
      const r = await this.auth.api.enableTwoFactor({ body: { password: body.password }, headers: authHeaders(req) });
      if (r.method !== "totp") throw new Error(`Unexpected second factor: ${r.method}`);
      const secret = new URL(r.totpURI).searchParams.get("secret");
      return { otpauthUri: r.totpURI, manualKey: secret, recoveryCodes: r.backupCodes };
    } catch (err) {
      fromAuthError(err);
    }
  }

  /** Finish enrolment with a code from the authenticator app. */
  @Post("confirm")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @AllowWithoutMfa()
  async confirm(
    @Body(new ZodPipe(CodeBody)) body: z.infer<typeof CodeBody>,
    @CurrentAuth() a: AuthContext,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const { headers } = await this.auth.api.verifyTOTP({ body: { code: body.code }, headers: authHeaders(req), returnHeaders: true });
      forwardCookies(headers, res);
    } catch (err) {
      fromAuthError(err);
    }
    await this.audit.record({ action: "mfa.enrolled", actorUserId: a.user.id, ip: clientIp(req) });
    return { twoFactorEnabled: true };
  }

  /** Sign-in step two: a TOTP code or one recovery code. Creates the session. */
  @Post("verify")
  @HttpCode(200)
  async verify(
    @Body(new ZodPipe(VerifyBody)) body: z.infer<typeof VerifyBody>,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const headers = authHeaders(req);
    try {
      const out =
        "code" in body
          ? await this.auth.api.verifyTOTP({ body: { code: body.code, trustDevice: false }, headers, returnHeaders: true })
          : await this.auth.api.verifyBackupCode({ body: { code: body.recoveryCode, trustDevice: false }, headers, returnHeaders: true });
      forwardCookies(out.headers, res);
      const user = (out.response as { user: { id: string; name: string; email: string; emailVerified: boolean } }).user;
      const ip = clientIp(req);
      if ("recoveryCode" in body) await this.audit.record({ action: "mfa.recovery_code_used", actorUserId: user.id, ip });
      await this.audit.record({ action: "auth.login", actorUserId: user.id, ip, metadata: { mfa: "code" in body ? "totp" : "recovery_code" } });
      return { user: { id: user.id, name: user.name, email: user.email, emailVerified: user.emailVerified } };
    } catch (err) {
      fromAuthError(err);
    }
  }

  /** Turn MFA off. Refused for Owners and Platform Admins, for whom it is mandatory. */
  @Post("disable")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async disable(@Body(new ZodPipe(PasswordBody)) body: z.infer<typeof PasswordBody>, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    if (await this.sessions.mfaRequired(a.user)) {
      throw new ProblemException(403, "forbidden", "Two-factor authentication is required for your role", "Owners and platform admins can't turn it off.");
    }
    try {
      await this.auth.api.disableTwoFactor({ body: { password: body.password }, headers: authHeaders(req) });
    } catch (err) {
      fromAuthError(err);
    }
    await this.audit.record({ action: "mfa.disabled", actorUserId: a.user.id, ip: clientIp(req) });
    return { twoFactorEnabled: false };
  }

  /** Replace all recovery codes (the old ones stop working). */
  @Post("recovery-codes")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  async regenerate(@Body(new ZodPipe(PasswordBody)) body: z.infer<typeof PasswordBody>, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    try {
      const r = await this.auth.api.generateBackupCodes({ body: { password: body.password }, headers: authHeaders(req) });
      await this.audit.record({ action: "mfa.recovery_codes_regenerated", actorUserId: a.user.id, ip: clientIp(req) });
      return { recoveryCodes: r.backupCodes };
    } catch (err) {
      fromAuthError(err);
    }
  }
}
