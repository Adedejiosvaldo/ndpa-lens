import { APIError } from "better-auth/api";
import { ProblemException } from "../common/problem.js";

/** Translate a Better Auth APIError into our problem+json vocabulary; rethrow anything else. */
export function fromAuthError(err: unknown): never {
  if (err instanceof APIError) {
    const code = (err.body as { code?: string } | undefined)?.code ?? "";
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
