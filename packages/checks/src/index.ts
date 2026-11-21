import type { EvidenceBundle } from "@ndpa/scan-engine";
import type { PolicyAssist } from "./assist.js";
import { CHECKS_01_10 } from "./checks/c01-c10.js";
import { CHECKS_11_20 } from "./checks/c11-c20.js";
import { type CheckDef, type CheckFinding, provenance } from "./core.js";

export * from "./assist.js";
export * from "./core.js";
export { redact } from "./checks/c11-c20.js";
export { CHECKS_01_10, CHECKS_11_20 };

export const ALL_CHECKS: CheckDef[] = [...CHECKS_01_10, ...CHECKS_11_20];

/**
 * Run checks over a stored evidence bundle and, if there was one, the stored
 * LLM reading of the policy. Pure: no network, no clock, so the same inputs
 * always give the same findings in the same order (§5.4). A check that throws
 * yields a needs-review finding instead of sinking the scan.
 */
export function runChecks(bundle: EvidenceBundle, opts: { checks?: CheckDef[]; assist?: PolicyAssist | null } = {}): CheckFinding[] {
  const ctx = { assist: opts.assist ?? null };
  const out: CheckFinding[] = [];
  for (const def of opts.checks ?? ALL_CHECKS) {
    let results: ReturnType<CheckDef["run"]>;
    try {
      results = def.run(bundle, ctx);
    } catch (e) {
      results = [
        {
          status: "needs_review",
          title: "This check couldn't run automatically",
          whyItMatters: "An analyst needs to assess it by hand.",
          explanation: `The check stopped with an internal error (${e instanceof Error ? e.message : String(e)}).`,
          remediation: "Review this area manually.",
          pageKeys: [],
          evidence: [],
        },
      ];
    }
    for (const r of results) {
      out.push({
        checkId: def.id,
        area: def.area,
        legalRef: def.legalRef,
        provenance: provenance(def, bundle),
        ...r,
        severity: r.severity ?? def.severity,
      });
    }
  }
  return out;
}
