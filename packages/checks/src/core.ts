import type { NdpaArea, Severity } from "@ndpa/schema";
import type { EvidenceBundle, PageCapture } from "@ndpa/scan-engine";
import { classifyHost, VENDOR_LIST_VERSION } from "@ndpa/vendors";

/**
 * A finding as the checks produce it. Pages are referred to by their bundle
 * key (p00, p01…); the scan worker maps them to database ids (Step 22).
 */
export type CheckStatus = "fail" | "pass" | "needs_review";
export type EvidenceKind = "screenshot" | "screenshot_fold" | "har" | "dom" | "cookies" | "policy_text" | "headers" | "llm_output";

export interface CheckEvidence {
  kind: EvidenceKind;
  sha256: string;
  pageKey?: string;
  consentState?: string;
  /** Narrows the evidence: a request URL, cookie name, button label or quote. */
  pointer?: string;
}

export interface CheckFinding {
  checkId: string;
  subId?: string;
  area: NdpaArea;
  severity: Severity;
  status: CheckStatus;
  title: string;
  whyItMatters: string;
  explanation: string;
  legalRef: string;
  remediation: string;
  pageKeys: string[];
  evidence: CheckEvidence[];
  provenance: { checkVersion: string; engineVersion: string; vendorListVersion: string };
}

export interface CheckDef {
  id: string;
  version: string;
  area: NdpaArea;
  severity: Severity;
  /** Draft legal reference (PRD §5.2: confirmed by the legal reviewer before launch). */
  legalRef: string;
  run(b: EvidenceBundle): Array<Omit<CheckFinding, "checkId" | "area" | "legalRef" | "provenance" | "severity"> & { severity?: Severity }>;
}

type Page = Omit<PageCapture, "html">;

export const desktop = (b: EvidenceBundle) => b.pages.filter((p) => p.device === "desktop");
export const inState = (b: EvidenceBundle, state: string) => desktop(b).filter((p) => p.consentState === state);
export const home = (b: EvidenceBundle, state = "none") => b.pages.find((p) => p.pageId === "p00" && p.consentState === state && p.device === "desktop");

/** Third-party requests to vendors that need consent (§5.3). Unknown hosts are returned separately. */
export function nonEssentialRequests(pages: Page[], phase?: "initial" | "after-choice") {
  const hits: Array<{ page: Page; url: string; host: string; vendor: string; category: string }> = [];
  const unknown: Array<{ page: Page; url: string; host: string }> = [];
  for (const p of pages) {
    for (const r of p.requests) {
      if (!r.thirdParty || (phase && r.phase !== phase)) continue;
      const c = classifyHost(r.host);
      if (c.nonEssential) hits.push({ page: p, url: r.url, host: r.host, vendor: c.vendor!.name, category: c.vendor!.category });
      else if (c.needsReview && r.resourceType === "script") unknown.push({ page: p, url: r.url, host: r.host });
    }
  }
  return { hits, unknown };
}

/** Evidence pointers for a page and state. */
export function evidenceFor(b: EvidenceBundle, page: Page, kinds: EvidenceKind[], pointer?: string): CheckEvidence[] {
  return b.evidence
    .filter((e) => e.pageId === page.pageId && e.consentState === page.consentState && (kinds as string[]).includes(e.kind))
    .map((e) => ({ kind: e.kind as EvidenceKind, sha256: e.sha256, pageKey: page.pageId, consentState: page.consentState, ...(pointer ? { pointer } : {}) }));
}

export const uniq = <T>(xs: T[]) => [...new Set(xs)];
export const list = (xs: string[], max = 4) => (xs.length <= max ? xs.join(", ") : `${xs.slice(0, max).join(", ")} and ${xs.length - max} more`);

export function provenance(def: CheckDef, b: EvidenceBundle): CheckFinding["provenance"] {
  return { checkVersion: def.version, engineVersion: b.engineVersion, vendorListVersion: VENDOR_LIST_VERSION };
}
