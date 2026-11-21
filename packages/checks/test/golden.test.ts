import { readFileSync } from "node:fs";
import { ENGINE_VERSION, type EvidenceBundle } from "@ndpa/scan-engine";
import { VARIANTS } from "fixtures";
import { describe, expect, it } from "vitest";
import { ALL_CHECKS, type CheckDef, runChecks } from "../src/index.js";

const load = (id: string): EvidenceBundle => JSON.parse(readFileSync(new URL(`../golden/${id}.json`, import.meta.url), "utf8"));
const implemented = new Set(ALL_CHECKS.map((c) => c.id));

/** A check "passes" when all its findings pass, and "fails" when any fails. */
function outcome(findings: ReturnType<typeof runChecks>, checkId: string) {
  const fs = findings.filter((f) => f.checkId === checkId);
  if (fs.some((f) => f.status === "fail")) return "fail";
  if (fs.every((f) => f.status === "pass")) return "pass";
  return "needs_review";
}

describe("golden fixtures (labelled expectations, PRD §12)", () => {
  for (const v of VARIANTS) {
    it(`${v.id}: ${v.note}`, () => {
      const b = load(v.id);
      expect(b.engineVersion, "golden is stale: run golden:capture").toBe(ENGINE_VERSION);
      const findings = runChecks(b);
      for (const [checkId, want] of Object.entries(v.expect)) {
        if (!implemented.has(checkId)) continue;
        expect(outcome(findings, checkId), `${v.id} ${checkId}`).toBe(want);
      }
    });
  }

  it("fail variants for later checks cause no false failures in C-01..C-10 beyond their own consequences", () => {
    // Variants that only change forms, headers, TLS, PII or checkout must leave C-01..C-10 untouched.
    for (const id of ["c11-fail", "c12-fail", "c13-fail", "c14-fail", "c15-fail", "c16-fail", "c18-fail", "c19-fail", "c20-fail"]) {
      const failing = runChecks(load(id)).filter((f) => f.status !== "pass").map((f) => f.checkId);
      expect(failing, id).toEqual(id === "c18-fail" ? failing.filter((c) => c === "C-08") : []);
    }
  });
});

describe("runner", () => {
  it("is deterministic and stamps provenance", () => {
    const b = load("c01-fail");
    const a = runChecks(b);
    expect(runChecks(structuredClone(b))).toEqual(a);
    const f = a.find((x) => x.checkId === "C-01")!;
    expect(f.provenance).toMatchObject({ checkVersion: "1", engineVersion: ENGINE_VERSION });
    expect(f.provenance.vendorListVersion).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(f.evidence.length).toBeGreaterThan(0);
    expect(f.evidence.every((e) => /^[0-9a-f]{64}$/.test(e.sha256) && e.pageKey)).toBe(true);
    expect(f.legalRef).toMatch(/pending legal review/);
  });

  it("turns a crashing check into needs-review instead of failing the scan", () => {
    const boom: CheckDef = { id: "C-99", version: "1", area: "security", severity: "low", legalRef: "x", run: () => { throw new Error("bad input"); } };
    const [f] = runChecks(load("baseline"), [boom]);
    expect(f).toMatchObject({ checkId: "C-99", status: "needs_review" });
    expect(f!.explanation).toContain("bad input");
  });
});
