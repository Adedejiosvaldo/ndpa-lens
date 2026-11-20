import { describe, expect, it } from "vitest";
import {
  AnalystReview,
  CheckId,
  Finding,
  Hostname,
  Id,
  PackManifest,
  Problem,
  ScanJob,
  ScanProgressEvent,
} from "../src/index.js";

const v7 = "01936f6e-8c2a-7b3e-9a1f-2c3d4e5f6a7b";
const v4 = "9b2f1c3e-4d5a-4b6c-8d7e-1f2a3b4c5d6e";
const sha = "a".repeat(64);

describe("Id", () => {
  it("accepts uuid v7 and rejects v4", () => {
    expect(Id.safeParse(v7).success).toBe(true);
    expect(Id.safeParse(v4).success).toBe(false);
  });
});

describe("Hostname", () => {
  it("normalises case and rejects schemes, ports and bare words", () => {
    expect(Hostname.parse("Example.COM.ng")).toBe("example.com.ng");
    for (const bad of ["https://example.com", "example.com:443", "localhost", "exa mple.com"]) {
      expect(Hostname.safeParse(bad).success).toBe(false);
    }
  });
});

describe("ScanJob", () => {
  const job = {
    scanId: v7,
    orgId: v7,
    targets: [{ domainId: v7, urls: ["https://example.com/"] }],
    engineVersion: "1.0.0",
    checksVersion: "1.0.0",
  };
  it("fills the three consent states and the 25-page cap by default", () => {
    const parsed = ScanJob.parse(job);
    expect(parsed.states).toEqual(["none", "reject", "accept"]);
    expect(parsed.maxPages).toBe(25);
  });
  it("rejects more than 25 pages, no targets and non-http URLs", () => {
    expect(ScanJob.safeParse({ ...job, maxPages: 26 }).success).toBe(false);
    expect(ScanJob.safeParse({ ...job, targets: [] }).success).toBe(false);
    expect(ScanJob.safeParse({ ...job, targets: [{ domainId: v7, urls: ["file:///etc/passwd"] }] }).success).toBe(false);
  });
});

describe("ScanProgressEvent", () => {
  it("rejects pageDone above pageTotal", () => {
    const e = { scanId: v7, phase: "capturing", pageDone: 3, pageTotal: 10, at: "2026-11-20T10:00:00+01:00" };
    expect(ScanProgressEvent.safeParse(e).success).toBe(true);
    expect(ScanProgressEvent.safeParse({ ...e, pageDone: 11 }).success).toBe(false);
  });
});

describe("Finding (FIND-01)", () => {
  const finding = {
    checkId: "C-01",
    area: "consent",
    severity: "critical",
    status: "fail",
    title: "Meta Pixel loads before the visitor consents",
    whyItMatters: "Tracking without consent has no lawful basis.",
    explanation: "facebook.net was requested before any banner interaction.",
    legalRef: "NDPA s.25–26",
    remediation: "Load the pixel only after the visitor accepts.",
    pageIds: [v7],
    evidence: [{ kind: "har", sha256: sha, pageId: v7, consentState: "none", pointer: "https://connect.facebook.net/" }],
    provenance: { checkVersion: "1", engineVersion: "1", vendorListVersion: "2026-11-20" },
  };
  it("accepts a complete finding", () => {
    expect(Finding.safeParse(finding).success).toBe(true);
  });
  it("rejects malformed check IDs and hashes", () => {
    expect(CheckId.safeParse("C1").success).toBe(false);
    expect(Finding.safeParse({ ...finding, evidence: [{ kind: "har", sha256: "xyz" }] }).success).toBe(false);
  });
});

describe("AnalystReview (FIND-02)", () => {
  it("requires a note for false positives", () => {
    expect(AnalystReview.safeParse({ analystStatus: "false_positive" }).success).toBe(false);
    expect(AnalystReview.safeParse({ analystStatus: "false_positive", note: "Banner is server-side" }).success).toBe(true);
    expect(AnalystReview.safeParse({ analystStatus: "accepted" }).success).toBe(true);
  });
});

describe("Problem (RFC 9457)", () => {
  it("only allows stable codes", () => {
    expect(Problem.safeParse({ title: "No credits", status: 402, code: "insufficient_credits" }).success).toBe(true);
    expect(Problem.safeParse({ title: "x", status: 400, code: "made_up" }).success).toBe(false);
  });
});

describe("PackManifest", () => {
  it("requires at least one hashed file", () => {
    const m = { schema: "ndpa-lens/manifest@1", packId: v7, version: 1, files: [{ path: "a.har", sha256: sha, bytes: 10 }] };
    expect(PackManifest.safeParse(m).success).toBe(true);
    expect(PackManifest.safeParse({ ...m, files: [] }).success).toBe(false);
  });
});
