import { z } from "zod";

/**
 * Stable machine-readable error codes (PRD §8). Clients branch on `code`, never
 * on `title` or `detail`. Add codes; never rename or reuse one.
 */
export const ErrorCode = z.enum([
  "validation_failed",
  "unauthenticated",
  "mfa_required",
  "mfa_enrolment_required",
  "email_unverified",
  "csrf_invalid",
  "not_found",
  "forbidden",
  "conflict",
  "rate_limited",
  "idempotency_key_required",
  "idempotency_conflict",
  "insufficient_credits",
  "licence_unverified",
  "attestation_required",
  "client_archived",
  "scan_concurrency_limit",
  "last_owner",
  "invitation_expired",
  "payment_failed",
  "internal_error",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** RFC 9457 problem+json body with the stable `code` extension. */
export const Problem = z.object({
  type: z.string().default("about:blank"),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  code: ErrorCode,
  /** Field-level messages for validation_failed. */
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
  requestId: z.string().optional(),
});
export type Problem = z.infer<typeof Problem>;

export const PROBLEM_CONTENT_TYPE = "application/problem+json";
