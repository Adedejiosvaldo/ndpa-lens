import { z } from "zod";
import { ConsentState, Id, Severity, Sha256 } from "./common.js";

/** Check IDs from the catalogue (PRD §5.2): C-01 … C-99. */
export const CheckId = z.string().regex(/^C-\d{2}$/, "Expected a check ID such as C-07");
export type CheckId = z.infer<typeof CheckId>;

export const FindingStatus = z.enum(["fail", "pass", "needs_review"]);
export type FindingStatus = z.infer<typeof FindingStatus>;

export const AnalystStatus = z.enum(["none", "false_positive", "accepted"]);
export type AnalystStatus = z.infer<typeof AnalystStatus>;

/** NDPA areas used to group findings in the UI and the pack. */
export const NdpaArea = z.enum(["consent", "transparency", "rights", "security", "transfers"]);
export type NdpaArea = z.infer<typeof NdpaArea>;

/** Pointer to one stored evidence file (content-addressed, PRD §7). */
export const EvidenceRef = z.object({
  kind: z.enum(["screenshot", "screenshot_fold", "har", "dom", "cookies", "policy_text", "headers", "llm_output"]),
  sha256: Sha256,
  pageId: Id.optional(),
  consentState: ConsentState.optional(),
  /** Narrows the evidence: a request URL, cookie name, selector or quote. */
  pointer: z.string().max(2000).optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRef>;

/** Provenance needed to re-derive a finding from its bundle (PRD §5.4). */
export const Provenance = z.object({
  checkVersion: z.string().min(1),
  engineVersion: z.string().min(1),
  vendorListVersion: z.string().min(1),
  /** Set when an LLM contributed; such findings are labelled "assisted". */
  assisted: z
    .object({
      model: z.string().min(1),
      promptVersion: z.string().min(1),
      rawOutputSha256: Sha256,
      confidence: z.number().min(0).max(1),
    })
    .optional(),
});
export type Provenance = z.infer<typeof Provenance>;

/** A check result as produced by packages/checks (FIND-01). */
export const Finding = z.object({
  checkId: CheckId,
  /** Optional sub-item, e.g. "dpo_contact" for C-08. */
  subId: z.string().max(64).optional(),
  area: NdpaArea,
  severity: Severity,
  status: FindingStatus,
  /** Plain-language audit-style title, never the check ID. */
  title: z.string().min(1).max(200),
  whyItMatters: z.string().min(1).max(500),
  explanation: z.string().min(1),
  legalRef: z.string().min(1),
  remediation: z.string().min(1),
  pageIds: z.array(Id),
  evidence: z.array(EvidenceRef),
  provenance: Provenance,
});
export type Finding = z.infer<typeof Finding>;

/** The analyst's overlay; the original finding is never changed (FIND-02). */
export const AnalystReview = z
  .object({
    analystStatus: AnalystStatus,
    note: z.string().max(4000).optional(),
  })
  .refine((r) => r.analystStatus !== "false_positive" || (r.note?.trim().length ?? 0) > 0, {
    message: "A note is required when marking a false positive",
    path: ["note"],
  });
export type AnalystReview = z.infer<typeof AnalystReview>;
