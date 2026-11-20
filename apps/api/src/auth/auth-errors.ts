import { APIError } from "better-auth/api";
import { ProblemException } from "../common/problem.js";

/** Translate a Better Auth APIError into our problem+json vocabulary; rethrow anything else. */
export function fromAuthError(err: unknown): never {
  if (err instanceof APIError) {
    const code = (err.body as { code?: string } | undefined)?.code ?? "";
    if (code === "INVALID_PASSWORD") throw new ProblemException(401, "unauthenticated", "Your password is not correct");
    // Second factor (AUTH-05)
    if (code === "INVALID_CODE" || code === "INVALID_BACKUP_CODE")
      throw new ProblemException(401, "unauthenticated", "That code is not correct", "Check your authenticator app, or use a recovery code.");
    if (code === "ACCOUNT_TEMPORARILY_LOCKED")
      throw new ProblemException(429, "rate_limited", "Too many wrong codes", "Second-factor sign-in is paused for 15 minutes.");
    if (code === "INVALID_TWO_FACTOR_COOKIE")
      throw new ProblemException(401, "unauthenticated", "Your sign-in has expired", "Enter your email and password again.");
    if (code === "TOTP_ALREADY_ENABLED")
      throw new ProblemException(409, "conflict", "Two-factor authentication is already on");
    if (code === "TWO_FACTOR_NOT_ENABLED" || code === "TOTP_NOT_ENABLED")
      throw new ProblemException(409, "conflict", "Two-factor authentication is not set up");
    if (code === "INVALID_EMAIL_OR_PASSWORD")
      throw new ProblemException(401, "unauthenticated", "Email or password is incorrect");
    if (/TOKEN|EXPIRED/.test(code) || code === "INVALID_TOKEN")
      throw new ProblemException(400, "validation_failed", "This link is invalid or has expired", "Request a new link and try again.");
    if (code.startsWith("PASSWORD_TOO"))
      throw new ProblemException(400, "validation_failed", "The password is not valid", undefined, [
        { path: "password", message: err.message },
      ]);
    if (err.statusCode === 401) throw new ProblemException(401, "unauthenticated", "You need to sign in");
    if (err.statusCode === 404) throw new ProblemException(404, "not_found", "Not found");
  }
  throw err;
}
