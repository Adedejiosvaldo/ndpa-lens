import type { ScanResult } from "@/types/audit";

export type DcpmiTierCode = "STANDARD" | "OHL" | "EHL" | "UHL";

/** Sector lists from the NDPC registration guidance. "" = not answered. */
export type DcpmiSector = "" | "uhl" | "ehl" | "ohl" | "other";

export interface DcpmiAssessmentInput {
  dataSubjectsCount: string;
  sector?: DcpmiSector;
  commencementDate: string;
  dsrResponseDays: string;
  policyLastUpdated: string;
  ropaLastReviewed: string;
  checkedItems: Record<string, boolean>;
}

export interface DcpmiTierResult {
  tier: DcpmiTierCode;
  label: string;
  subtitle: string;
  registrationRequired: boolean;
  registrationFee: string | null;
  /** Only UHL and EHL file a yearly Compliance Audit Return. */
  filesAuditReturn: boolean;
  dpcoRequired: boolean;
  mandatoryDpo: boolean;
  /** True when the sector, not the headcount, decided the tier. */
  raisedBySector: boolean;
  initialAuditDeadline: string | null;
  initialAuditOverdue: boolean;
  nextCarDeadline: string | null;
  obligations: string[];
}

export interface GaidChecklistItem {
  id: string;
  label: string;
  citation: string;
  autoDetected?: boolean;
  autoReason?: string;
}

export interface GaidChecklistGroup {
  id: string;
  title: string;
  citation: string;
  description: string;
  items: GaidChecklistItem[];
  metaField?: {
    key: "dsrResponseDays" | "policyLastUpdated" | "ropaLastReviewed";
    label: string;
    type: "number" | "date";
    guidance: string;
  };
}

export const GAID_CHECKLIST_GROUPS: GaidChecklistGroup[] = [
  {
    id: "consent",
    title: "Consent",
    citation: "NDPA Sections 25–26",
    description:
      "Affirmative opt-in consent, purpose specificity, withdrawal parity, minor protection, and consent audit logs.",
    items: [
      {
        id: "consent_banner_every_page",
        label: "We have a cookie / consent banner on every public-facing page.",
        citation: "NDPA s. 26(1)",
        autoDetected: true,
      },
      {
        id: "consent_named_purpose",
        label: "Each consent option lists a specific, named purpose.",
        citation: "NDPA ss. 25(1)(a), 27(1)(c)",
      },
      {
        id: "consent_easy_withdrawal",
        label:
          "Users can withdraw consent as easily as they gave it (Section 26).",
        citation: "NDPA s. 26(4)",
      },
      {
        id: "consent_parental_minors",
        label:
          "Where applicable, we collect parental consent for minors (Section 31).",
        citation: "NDPA s. 31",
      },
      {
        id: "consent_audit_log",
        label:
          "We keep an audit log of every consent decision (who, when, what, version).",
        citation: "NDPA s. 26(2)",
      },
    ],
  },
  {
    id: "dsr",
    title: "Data Subject Rights",
    citation: "NDPA Part VI (Sections 34–38)",
    description:
      "Published DSR intake channels, statutory rights fulfilment capabilities, and 30-day response SLA.",
    metaField: {
      key: "dsrResponseDays",
      label: "Typical DSR response time (days)",
      type: "number",
      guidance: "Statutory guidance: ≤ 30 days",
    },
    items: [
      {
        id: "dsr_published_channel",
        label: "We have a published DSR submission channel (form or email).",
        citation: "NDPA s. 27(1)(a)",
        autoDetected: true,
      },
      {
        id: "dsr_access",
        label: "We can fulfil access requests (Section 34(1)(a)).",
        citation: "NDPA s. 34(1)(a)",
      },
      {
        id: "dsr_rectification",
        label: "We can fulfil rectification requests (Section 34(1)(c)).",
        citation: "NDPA s. 34(1)(c)",
      },
      {
        id: "dsr_erasure",
        label: "We can fulfil erasure requests (Section 34(1)(d)).",
        citation: "NDPA s. 34(1)(d)",
      },
      {
        id: "dsr_portability",
        label: "We can fulfil portability requests (Section 38).",
        citation: "NDPA s. 38",
      },
      {
        id: "dsr_objection",
        label: "We can fulfil objection requests (Section 36).",
        citation: "NDPA s. 36",
      },
    ],
  },
  {
    id: "dpia",
    title: "Data Protection Impact Assessment (DPIA)",
    citation: "NDPA Section 28",
    description:
      "Pre-processing impact assessments for high-risk processing, profiling, or sensitive personal data.",
    items: [
      {
        id: "dpia_before_high_risk",
        label:
          "We complete a DPIA before any high-risk processing (Section 28(1)).",
        citation: "NDPA s. 28(1)",
      },
      {
        id: "dpia_documents_risks",
        label: "Each DPIA documents identified risks to data subjects.",
        citation: "NDPA s. 28(4)(b)",
      },
      {
        id: "dpia_mitigation_measures",
        label:
          "Each DPIA includes mitigation measures and residual-risk acceptance.",
        citation: "NDPA s. 28(4)(c)",
      },
    ],
  },
  {
    id: "breach",
    title: "Breach Notification",
    citation: "NDPA Section 40",
    description:
      "72-hour NDPC regulatory notification workflow, incident risk assessment, and breach register.",
    items: [
      {
        id: "breach_documented_process",
        label: "We have a documented breach-notification process.",
        citation: "NDPA s. 40(1)",
      },
      {
        id: "breach_notify_ndpc_72h",
        label:
          "Our process can notify NDPC within 72 hours of discovery (Section 40(2)).",
        citation: "NDPA s. 40(2)",
      },
      {
        id: "breach_risk_assessment",
        label:
          "Every breach triggers a risk assessment to determine notification need.",
        citation: "NDPA s. 40(2)–(3)",
      },
      {
        id: "breach_register",
        label: "We maintain a breach register with all incidents and actions.",
        citation: "NDPA s. 40(5)",
      },
    ],
  },
  {
    id: "privacy_policy",
    title: "Privacy Policy",
    citation: "NDPA Section 27",
    description:
      "Public availability, global footer reachability, complete Section 27(1) disclosures, and annual review.",
    metaField: {
      key: "policyLastUpdated",
      label: "Privacy policy last updated",
      type: "date",
      guidance: "Should be reviewed within the last 12 months",
    },
    items: [
      {
        id: "policy_published",
        label: "We publish a privacy policy.",
        citation: "NDPA s. 27(1)",
        autoDetected: true,
      },
      {
        id: "policy_reachable_every_page",
        label:
          "The privacy policy is reachable from every page (usually footer).",
        citation: "NDPA s. 27(2)",
        autoDetected: true,
      },
      {
        id: "policy_covers_s27_disclosures",
        label:
          "The policy covers every Section 27(1) disclosure (lawful basis, retention, rights, NDPC complaint route).",
        citation: "NDPA s. 27(1)(a)–(h)",
        autoDetected: true,
      },
    ],
  },
  {
    id: "lawful_basis",
    title: "Lawful Basis",
    citation: "NDPA Section 25",
    description:
      "Lawful basis mapping across all processing activities and written Legitimate Interest Assessments (LIAs).",
    items: [
      {
        id: "lawful_basis_documented",
        label:
          "We have documented a lawful basis for every processing activity.",
        citation: "NDPA s. 25(1)",
      },
      {
        id: "lawful_basis_lia",
        label:
          "Where we rely on legitimate interest, we have a written LIA.",
        citation: "NDPA s. 25(1)(b)(v)",
      },
    ],
  },
  {
    id: "cross_border",
    title: "Cross-Border Transfer",
    citation: "NDPA Sections 41–43",
    description:
      "International transfer instruments, destination country adequacy assessments, and NDPC approvals.",
    items: [
      {
        id: "xborder_mechanism",
        label:
          "We have an appropriate transfer mechanism for every cross-border data flow.",
        citation: "NDPA s. 41(1)",
      },
      {
        id: "xborder_adequacy_assessed",
        label:
          "We have assessed the adequacy of each destination country (Section 42).",
        citation: "NDPA s. 42",
      },
      {
        id: "xborder_ndpc_approval",
        label:
          "Where required, we have obtained NDPC approval (BCRs, codes of conduct, certifications).",
        citation: "NDPA s. 41(2)",
      },
    ],
  },
  {
    id: "ropa",
    title: "Record of Processing Activities (RoPA)",
    citation: "NDPA Section 24(3)",
    description:
      "Comprehensive inventory of processing operations, data categories, recipients, and retention schedules.",
    metaField: {
      key: "ropaLastReviewed",
      label: "RoPA last reviewed",
      type: "date",
      guidance: "Update continuously and review at least annually",
    },
    items: [
      {
        id: "ropa_maintained",
        label: "We maintain a Record of Processing Activities (RoPA).",
        citation: "NDPA s. 24(3)",
      },
      {
        id: "ropa_covers_all",
        label:
          "The RoPA covers every processing activity across the organisation.",
        citation: "NDPA s. 24(3)",
      },
    ],
  },
];

/**
 * Ticks only what the scan itself proved. Things a privacy policy merely
 * *mentions* (e.g. "you can ask us to delete your data") are not proof that
 * the organisation can actually do them, so those become hints instead.
 */
export function deriveAutoChecklistState(
  result: ScanResult
): Record<string, boolean> {
  const getClause = (id: string) =>
    result.policy.clauses.find((c) => c.id === id);
  const found = (id: string) => getClause(id)?.status === "found";

  const pages = (result.pages ?? []).filter((p) => p.kind !== "policy" && !p.blocked);
  const consent = result.technical.consentTest;

  return {
    // Seen on every page we visited, and the visitor could refuse.
    consent_banner_every_page: Boolean(
      consent?.tested &&
        consent.bannerVisible &&
        consent.rejectFound &&
        pages.length > 0 &&
        pages.every((p) => p.bannerVisible)
    ),
    dsr_published_channel: found("controller-dpo"),
    policy_published: result.policy.found,
    policy_reachable_every_page:
      result.policy.found && pages.length > 1 && pages.every((p) => p.policyLinked),
    policy_covers_s27_disclosures:
      found("purpose-lawful-basis") &&
      found("retention-period") &&
      found("data-subject-rights") &&
      found("ndpc-complaint-right"),
  };
}

/**
 * Short notes shown next to checklist items the scan can say something about
 * but cannot prove. The person still has to tick these themselves.
 */
export function deriveScanHints(result: ScanResult): Record<string, string> {
  const hints: Record<string, string> = {};
  const status = (id: string) =>
    result.policy.clauses.find((c) => c.id === id)?.status;
  const mentions = (id: string) => {
    const s = status(id);
    return s === "found" || s === "partial";
  };
  const consent = result.technical.consentTest;

  if (mentions("data-subject-rights")) {
    for (const id of [
      "dsr_access",
      "dsr_rectification",
      "dsr_erasure",
      "dsr_portability",
      "dsr_objection",
    ]) {
      hints[id] = "Your policy mentions this. Tick only if you can actually do it.";
    }
  }
  if (mentions("purpose-lawful-basis")) {
    hints.lawful_basis_documented =
      "Your policy mentions reasons for using data. Tick if you have them written down internally.";
  }
  if (mentions("cross-border-transfer")) {
    hints.xborder_mechanism =
      "Your policy mentions transfers abroad. Tick only if signed agreements are in place.";
  }
  if (consent?.tested && consent.rejectFound) {
    hints.consent_easy_withdrawal =
      "Your banner has a refuse option. Tick if people can also change their mind later.";
  }
  if (consent?.tested && consent.bannerVisible && !consent.rejectFound) {
    hints.consent_banner_every_page =
      "We saw a banner, but no clear way to refuse. Add a Reject button.";
  }
  return hints;
}

/* ------------------------------------------------------------------ */
/* Tier classification and deadlines                                   */
/* ------------------------------------------------------------------ */

/**
 * Yearly Compliance Audit Return due dates. The default is 31 March, but the
 * NDPC has extended it before, so known extensions are listed here by year.
 */
const CAR_DEFAULT_MONTH_DAY = "03-31";
export const CAR_DEADLINE_OVERRIDES: Record<number, string> = {
  2026: "2026-05-30", // 2025 returns, extended by NDPC notice
};

/** Registration fees from the NDPC Guidance Notice on registration (2024). */
export const REGISTRATION_FEES: Record<Exclude<DcpmiTierCode, "STANDARD">, string> = {
  UHL: "₦250,000",
  EHL: "₦100,000",
  OHL: "₦10,000",
};

/** The 15-month first-audit rule applies to organisations set up after this date. */
const FIRST_AUDIT_RULE_START = "2023-06-12";

const TIER_RANK: Record<DcpmiTierCode, number> = { STANDARD: 0, OHL: 1, EHL: 2, UHL: 3 };

function tierFromCount(count: number): DcpmiTierCode {
  if (count > 5000) return "UHL";
  if (count > 1000) return "EHL";
  if (count > 200) return "OHL";
  return "STANDARD";
}

function tierFromSector(sector: DcpmiSector): DcpmiTierCode {
  if (sector === "uhl") return "UHL";
  if (sector === "ehl") return "EHL";
  if (sector === "ohl") return "OHL";
  return "STANDARD";
}

function carDeadlineFor(year: number): string {
  return CAR_DEADLINE_OVERRIDES[year] ?? `${year}-${CAR_DEFAULT_MONTH_DAY}`;
}

export function evaluateDcpmiTierAndDeadlines(
  input: DcpmiAssessmentInput,
  now: Date = new Date()
): DcpmiTierResult {
  const count = parseInt(input.dataSubjectsCount.replace(/,/g, ""), 10);
  const validCount = !Number.isNaN(count) && count >= 0 ? count : 0;
  const sector = input.sector ?? "";

  const byCount = tierFromCount(validCount);
  const bySector = tierFromSector(sector);
  const raisedBySector = TIER_RANK[bySector] > TIER_RANK[byCount];
  const tier = raisedBySector ? bySector : byCount;

  const files = tier === "UHL" || tier === "EHL";
  const majorImportance = tier !== "STANDARD";

  const labels: Record<DcpmiTierCode, string> = {
    STANDARD: "Not a Data Controller/Processor of Major Importance",
    OHL: "DCPMI — Ordinary High Level (OHL)",
    EHL: "DCPMI — Extra High Level (EHL)",
    UHL: "DCPMI — Ultra High Level (UHL)",
  };

  const subtitles: Record<DcpmiTierCode, string> = {
    STANDARD:
      "Processes personal data of 200 or fewer people in 6 months and is not in a listed sector.",
    OHL: "More than 200 people in 6 months, or a listed OHL sector (e.g. schools, SMEs, vendors to larger firms).",
    EHL: "More than 1,000 people in 6 months, or a listed EHL sector (e.g. government bodies, microfinance, universities, hospitals).",
    UHL: "More than 5,000 people in 6 months, or a listed UHL sector (e.g. banks, telecoms, insurers, payment companies).",
  };

  const obligations: string[] = [];
  if (!majorImportance) {
    obligations.push(
      "Comply with NDPA 2023 principles, publish a privacy notice (s. 27) and honour data subject rights (ss. 34–38).",
      "Report personal data breaches likely to cause risk to the NDPC within 72 hours (s. 40)."
    );
  } else {
    obligations.push(
      `Register with the NDPC as a Data Controller/Processor of Major Importance (${tier} fee: ${
        REGISTRATION_FEES[tier as Exclude<DcpmiTierCode, "STANDARD">]
      }).`,
      "Designate a Data Protection Officer and notify the NDPC of their contact details (NDPA s. 32; GAID 2025 Art. 11).",
      "Notify the NDPC of significant changes to your registration details within 60 days (GAID 2025 Art. 9(4))."
    );
    if (files) {
      obligations.push(
        "File a Compliance Audit Return every year through an NDPC-licensed Data Protection Compliance Organisation (GAID 2025 Art. 10).",
        "Late filing attracts a penalty of 50% of the filing fee."
      );
    } else {
      obligations.push(
        "Renew your registration every year. OHL organisations do not file a separate Compliance Audit Return."
      );
    }
  }
  if (raisedBySector) {
    obligations.push(
      "Your sector places you in this tier. The final classification also depends on the NDPC's factor tests, so confirm it with a licensed DPCO."
    );
  }

  let initialAuditDeadline: string | null = null;
  let initialAuditOverdue = false;
  if (files && input.commencementDate) {
    const start = new Date(input.commencementDate);
    if (
      !Number.isNaN(start.getTime()) &&
      start.getTime() > new Date(FIRST_AUDIT_RULE_START).getTime()
    ) {
      const plus15Months = new Date(start);
      plus15Months.setMonth(plus15Months.getMonth() + 15);
      initialAuditDeadline = plus15Months.toISOString().split("T")[0];
      initialAuditOverdue = plus15Months.getTime() < now.getTime();
    }
  }

  let nextCarDeadline: string | null = null;
  if (files) {
    const year = now.getFullYear();
    const thisYear = carDeadlineFor(year);
    const endOfThisYearsDeadline = new Date(`${thisYear}T23:59:59`);
    nextCarDeadline =
      now.getTime() > endOfThisYearsDeadline.getTime() ? carDeadlineFor(year + 1) : thisYear;
  }

  return {
    tier,
    label: labels[tier],
    subtitle: subtitles[tier],
    registrationRequired: majorImportance,
    registrationFee: majorImportance
      ? REGISTRATION_FEES[tier as Exclude<DcpmiTierCode, "STANDARD">]
      : null,
    filesAuditReturn: files,
    dpcoRequired: files,
    mandatoryDpo: majorImportance,
    raisedBySector,
    initialAuditDeadline,
    initialAuditOverdue,
    nextCarDeadline,
    obligations,
  };
}
