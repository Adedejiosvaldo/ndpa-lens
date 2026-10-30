import type { ClauseStatus, RemediationProfile, ScanResult } from "@/types/audit";

export type InternalComplianceAnswer = "Yes" | "Partial" | "No" | "Verify";

export interface InternalAuditItem {
  id: string;
  sectionId: string;
  question: string;
  finding: string;
  compliant: InternalComplianceAnswer;
  gapIdentified: string;
  source: "automated" | "manual";
}

export interface InternalAuditSection {
  id: string;
  code: string;
  title: string;
  legalReference: string;
  items: InternalAuditItem[];
}

export interface RemediationArtifact {
  id: "internal-audit" | "policy" | "banner" | "form" | "headers";
  title: string;
  subtitle: string;
  legalBasis: string;
  language: "markdown" | "html" | "typescript";
  filename: string;
  content: string;
}

function clauseToCompliance(status?: ClauseStatus): InternalComplianceAnswer {
  if (status === "found") return "Yes";
  if (status === "partial") return "Partial";
  return "No";
}

export function buildInternalAuditSections(
  result: ScanResult,
  overrides: Record<string, InternalComplianceAnswer> = {}
): InternalAuditSection[] {
  const getClause = (id: string) =>
    result.policy.clauses.find((c) => c.id === id);

  const purposeClause = getClause("purpose-lawful-basis");
  const categoriesClause = getClause("data-categories");
  const sharingClause = getClause("third-party-sharing");
  const retentionClause = getClause("retention-period");
  const rightsClause = getClause("data-subject-rights");
  const dpoClause = getClause("controller-dpo");
  const transferClause = getClause("cross-border-transfer");

  const hasPreConsentTracking =
    result.technical.preConsentCookieCount > 0 ||
    (result.trackers.length > 0 && !result.technical.bannerDetected);
  const preCheckedForms = result.forms.filter((f) => f.hasPreCheckedConsent);

  const rawSections: InternalAuditSection[] = [
    {
      id: "lawful-basis-consent",
      code: "3.1",
      title: "Lawful Basis and Consent",
      legalReference: "NDPA 2023 ss. 25–26",
      items: [
        {
          id: "q_3_1_1",
          sectionId: "lawful-basis-consent",
          question:
            "Is there a documented lawful basis for all processing activities?",
          finding:
            purposeClause?.status === "found"
              ? "Privacy notice explicitly maps processing activities to NDPA Section 25 lawful bases."
              : purposeClause?.status === "partial"
              ? "General purposes are stated in the policy, but explicit NDPA s. 25 lawful bases are incomplete."
              : "No documented lawful basis mapping was found in the public privacy notice.",
          compliant: clauseToCompliance(purposeClause?.status),
          gapIdentified:
            purposeClause?.status === "found"
              ? "None — lawful bases documented."
              : "Map each processing purpose to one of the 6 lawful bases under NDPA s. 25(1).",
          source: "automated",
        },
        {
          id: "q_3_1_2",
          sectionId: "lawful-basis-consent",
          question: "Is consent obtained before collecting personal data?",
          finding:
            !hasPreConsentTracking && preCheckedForms.length === 0
              ? "No pre-consent trackers or pre-checked form boxes were detected on initial page load."
              : `${result.technical.preConsentCookieCount} non-essential cookie(s) and ${result.trackers.length} tracker(s) fired on load; ${preCheckedForms.length} form(s) used pre-checked boxes.`,
          compliant:
            !hasPreConsentTracking && preCheckedForms.length === 0
              ? "Yes"
              : result.technical.bannerDetected && preCheckedForms.length === 0
              ? "Partial"
              : "No",
          gapIdentified:
            !hasPreConsentTracking && preCheckedForms.length === 0
              ? "None"
              : "Block non-essential cookies/trackers prior to opt-in and ensure all form consent checkboxes are unchecked by default.",
          source: "automated",
        },
        {
          id: "q_3_1_3",
          sectionId: "lawful-basis-consent",
          question: "Are consent records maintained?",
          finding:
            "Requires internal verification of timestamped consent logs in backend database or CMP.",
          compliant: "Verify",
          gapIdentified:
            "Maintain auditable timestamp, policy version, and opt-in state records (NDPA s. 26(1): the controller must prove consent).",
          source: "manual",
        },
        {
          id: "q_3_1_4",
          sectionId: "lawful-basis-consent",
          question: "Can users withdraw consent easily?",
          finding:
            result.technical.bannerDetected && result.technical.bannerHasReject
              ? "Consent banner provides a direct Reject / Decline control alongside policy withdrawal instructions."
              : rightsClause?.status === "found"
              ? "Withdrawal of consent is mentioned in the policy, but cookie banner lacks a 1-click Reject control."
              : "No accessible 1-click consent withdrawal or Reject Non-Essential mechanism was detected.",
          compliant:
            result.technical.bannerDetected && result.technical.bannerHasReject
              ? "Yes"
              : rightsClause?.status === "found"
              ? "Partial"
              : "No",
          gapIdentified:
            result.technical.bannerDetected && result.technical.bannerHasReject
              ? "None"
              : "Add an equal-prominence 'Reject Non-Essential' button and persistent privacy settings trigger (NDPA s. 35(2); GAID 2025 Art. 19(6)).",
          source: "automated",
        },
        {
          id: "q_3_1_5",
          sectionId: "lawful-basis-consent",
          question:
            "Is processing without consent legally justified and documented?",
          finding:
            purposeClause?.status === "found"
              ? "Non-consent bases (contract, legal obligation, legitimate interest) are documented in the notice."
              : "Requires internal Record of Processing Activities (RoPA) and Legitimate Interest Assessment (LIA).",
          compliant:
            purposeClause?.status === "found" ? "Yes" : "Verify",
          gapIdentified:
            purposeClause?.status === "found"
              ? "None"
              : "Document Legitimate Interest Assessments (LIAs) and contractual necessity in internal RoPA.",
          source: "manual",
        },
      ],
    },
    {
      id: "privacy-policy",
      code: "3.2",
      title: "Privacy Policy",
      legalReference: "NDPA 2023 ss. 24(1)(a), 27",
      items: [
        {
          id: "q_3_2_1",
          sectionId: "privacy-policy",
          question: "Is a privacy policy published and accessible?",
          finding: result.policy.found
            ? `Published at ${result.policy.url || result.finalUrl} (${result.policy.contentLength.toLocaleString()} chars).`
            : "No accessible Privacy Policy link or standard policy page was discovered.",
          compliant: result.policy.found ? "Yes" : "No",
          gapIdentified: result.policy.found
            ? "None"
            : "Publish a conspicuous Privacy Notice linked in the global footer and all data collection forms.",
          source: "automated",
        },
        {
          id: "q_3_2_2",
          sectionId: "privacy-policy",
          question: "Does the policy state what data is collected?",
          finding:
            categoriesClause?.evidence ||
            `Clause evaluation status: ${categoriesClause?.status || "unavailable"}.`,
          compliant: clauseToCompliance(categoriesClause?.status),
          gapIdentified:
            categoriesClause?.status === "found"
              ? "None"
              : "Enumerate all personal data categories collected directly and automatically (GAID 2025 Art. 27(3)(c)).",
          source: "automated",
        },
        {
          id: "q_3_2_3",
          sectionId: "privacy-policy",
          question: "Does the policy state why data is collected?",
          finding:
            purposeClause?.evidence ||
            `Clause evaluation status: ${purposeClause?.status || "unavailable"}.`,
          compliant: clauseToCompliance(purposeClause?.status),
          gapIdentified:
            purposeClause?.status === "found"
              ? "None"
              : "Clearly state specific processing purposes and corresponding lawful bases (NDPA s. 27(1)(b)).",
          source: "automated",
        },
        {
          id: "q_3_2_4",
          sectionId: "privacy-policy",
          question: "Does the policy state who data is shared with?",
          finding:
            sharingClause?.evidence ||
            `Clause evaluation status: ${sharingClause?.status || "unavailable"}.`,
          compliant: clauseToCompliance(sharingClause?.status),
          gapIdentified:
            sharingClause?.status === "found"
              ? "None"
              : "Disclose categories of third-party recipients and data processors (NDPA s. 27(1)(c)).",
          source: "automated",
        },
        {
          id: "q_3_2_5",
          sectionId: "privacy-policy",
          question: "Does the policy include data retention periods?",
          finding:
            retentionClause?.evidence ||
            `Clause evaluation status: ${retentionClause?.status || "unavailable"}.`,
          compliant: clauseToCompliance(retentionClause?.status),
          gapIdentified:
            retentionClause?.status === "found"
              ? "None"
              : "Specify concrete retention timelines or disposal criteria (NDPA ss. 24(1)(d), 27(1)(e)).",
          source: "automated",
        },
        {
          id: "q_3_2_6",
          sectionId: "privacy-policy",
          question: "Does the policy explain data subject rights?",
          finding:
            rightsClause?.evidence ||
            `Clause evaluation status: ${rightsClause?.status || "unavailable"}.`,
          compliant: clauseToCompliance(rightsClause?.status),
          gapIdentified:
            rightsClause?.status === "found"
              ? "None"
              : "List NDPA Part VI rights (access, rectification, erasure, portability, objection) and NDPC complaint right.",
          source: "automated",
        },
        {
          id: "q_3_2_7",
          sectionId: "privacy-policy",
          question: "Was the policy reviewed in the last 12 months?",
          finding:
            "Requires verification of the policy's 'Last Updated' effective date and annual governance review log.",
          compliant: result.policy.found ? "Verify" : "No",
          gapIdentified:
            "Ensure the Privacy Policy displays a current effective date and undergoes annual review.",
          source: "manual",
        },
      ],
    },
    {
      id: "data-subject-rights",
      code: "3.3",
      title: "Data Subject Rights",
      legalReference: "NDPA 2023 Part VI (ss. 34–38)",
      items: [
        {
          id: "q_3_3_1",
          sectionId: "data-subject-rights",
          question:
            "Is there a documented process for handling access requests?",
          finding:
            rightsClause?.status === "found"
              ? "Public policy informs users how to submit Data Subject Access Requests (DSARs)."
              : "Public notice lacks clear DSAR submission instructions; internal SOP verification needed.",
          compliant: clauseToCompliance(rightsClause?.status),
          gapIdentified:
            rightsClause?.status === "found"
              ? "None"
              : "Publish DSAR submission channel and maintain an internal DSAR handling SOP.",
          source: "automated",
        },
        {
          id: "q_3_3_2",
          sectionId: "data-subject-rights",
          question:
            "Is there a documented process for handling deletion requests?",
          finding:
            rightsClause?.status === "found"
              ? "Right to erasure/deletion is disclosed in the privacy notice."
              : "Right to erasure process is missing or incomplete in public notice.",
          compliant: clauseToCompliance(rightsClause?.status),
          gapIdentified:
            rightsClause?.status === "found"
              ? "None"
              : "Document right-to-erasure workflow across primary databases and backups (NDPA s. 34(1)(d)).",
          source: "automated",
        },
        {
          id: "q_3_3_3",
          sectionId: "data-subject-rights",
          question: "Are requests responded to within 30 days?",
          finding:
            "Requires operational verification of DSAR SLA tracking and response logs.",
          compliant: "Verify",
          gapIdentified:
            "Set and track a response target (30 days is common practice) so requests are answered without unreasonable delay (NDPA s. 34(1)).",
          source: "manual",
        },
        {
          id: "q_3_3_4",
          sectionId: "data-subject-rights",
          question: "Is a request register maintained?",
          finding:
            "Requires internal inspection of the DPO's Data Subject Request Register.",
          compliant: "Verify",
          gapIdentified:
            "Maintain a central DSAR register logging request date, identity verification, action taken, and closure date.",
          source: "manual",
        },
        {
          id: "q_3_3_5",
          sectionId: "data-subject-rights",
          question:
            "Are staff aware of how to handle data subject requests?",
          finding:
            "Requires confirmation that customer-facing and support staff escalate DSARs to the DPO.",
          compliant: "Verify",
          gapIdentified:
            "Train support and operations teams to recognize and escalate DSARs immediately.",
          source: "manual",
        },
      ],
    },
    {
      id: "dpo",
      code: "3.4",
      title: "Data Protection Officer",
      legalReference: "NDPA 2023 s. 32",
      items: [
        {
          id: "q_3_4_1",
          sectionId: "dpo",
          question: "Has a DPO been appointed where required?",
          finding:
            dpoClause?.status === "found"
              ? "DPO role is referenced in the published privacy notice."
              : "No explicit DPO appointment reference detected on the website.",
          compliant:
            dpoClause?.status === "found" ? "Yes" : "Verify",
          gapIdentified:
            dpoClause?.status === "found"
              ? "None"
              : "Formally appoint a qualified Data Protection Officer (mandatory for Data Controllers of Major Importance under NDPA s. 32).",
          source: "automated",
        },
        {
          id: "q_3_4_2",
          sectionId: "dpo",
          question: "Are DPO contact details published?",
          finding:
            dpoClause?.evidence ||
            "No dedicated DPO email/contact channel was matched in the privacy notice.",
          compliant: clauseToCompliance(dpoClause?.status),
          gapIdentified:
            dpoClause?.status === "found"
              ? "None"
              : "Publish the DPO's contact email and address in the Privacy Policy (NDPA s. 27(1)(a)).",
          source: "automated",
        },
        {
          id: "q_3_4_3",
          sectionId: "dpo",
          question:
            "Does the DPO have appropriate knowledge and training?",
          finding:
            "Requires verification of DPO certifications and NDPC-accredited continuous professional development.",
          compliant: "Verify",
          gapIdentified:
            "Ensure the DPO holds demonstrably verifiable expertise in Nigerian data protection law and practices (NDPA s. 32(1)).",
          source: "manual",
        },
        {
          id: "q_3_4_4",
          sectionId: "dpo",
          question: "Does the DPO report to senior management?",
          finding:
            "Requires organisational chart / governance charter verification.",
          compliant: "Verify",
          gapIdentified:
            "Ensure the DPO has direct reporting access to executive management without conflict of interest.",
          source: "manual",
        },
      ],
    },
    {
      id: "data-security",
      code: "3.5",
      title: "Data Security",
      legalReference: "NDPA 2023 s. 39",
      items: [
        {
          id: "q_3_5_1",
          sectionId: "data-security",
          question: "Is personal data encrypted at rest?",
          finding:
            "Requires verification of database, object storage, and backup encryption (e.g., AES-256 / KMS).",
          compliant: "Verify",
          gapIdentified:
            "Enforce encryption at rest across all production databases, backups, and file stores (NDPA s. 39(2)(b)).",
          source: "manual",
        },
        {
          id: "q_3_5_2",
          sectionId: "data-security",
          question: "Is personal data encrypted in transit?",
          finding: result.technical.https
            ? result.technical.mixedContentCount === 0
              ? `HTTPS enforced on ${result.finalUrl} with 0 mixed-content resources; HSTS=${
                  result.technical.headers["strict-transport-security"]
                    ? "Present"
                    : "Missing"
                }.`
              : `HTTPS enabled, but ${result.technical.mixedContentCount} insecure HTTP subresource(s) detected.`
            : "Website is served over unencrypted HTTP.",
          compliant: result.technical.https
            ? result.technical.mixedContentCount === 0
              ? "Yes"
              : "Partial"
            : "No",
          gapIdentified:
            result.technical.https && result.technical.mixedContentCount === 0
              ? "None"
              : "Enforce TLS 1.2+/HTTPS everywhere, eliminate mixed content, and enable Strict-Transport-Security (HSTS).",
          source: "automated",
        },
        {
          id: "q_3_5_3",
          sectionId: "data-security",
          question:
            "Is access to personal data restricted to authorised staff?",
          finding:
            "Requires internal verification of Role-Based Access Control (RBAC), MFA, and least-privilege policies.",
          compliant: "Verify",
          gapIdentified:
            "Enforce RBAC, multi-factor authentication (MFA), and periodic access reviews for systems storing personal data.",
          source: "manual",
        },
        {
          id: "q_3_5_4",
          sectionId: "data-security",
          question: "Are security measures reviewed annually?",
          finding: `Automated web header posture: ${
            Object.keys(result.technical.headers).filter((k) =>
              [
                "strict-transport-security",
                "content-security-policy",
                "x-frame-options",
                "x-content-type-options",
                "referrer-policy",
                "permissions-policy",
              ].includes(k)
            ).length
          }/6 core HTTP security headers present; ${
            result.technical.insecureCookieCount
          } insecure cookie(s).`,
          compliant:
            result.technical.insecureCookieCount === 0 &&
            Boolean(result.technical.headers["strict-transport-security"]) &&
            Boolean(result.technical.headers["content-security-policy"])
              ? "Yes"
              : "Partial",
          gapIdentified:
            "Deploy missing HTTP security headers (CSP, HSTS, Permissions-Policy), harden cookie flags, and conduct annual security reviews.",
          source: "automated",
        },
        {
          id: "q_3_5_5",
          sectionId: "data-security",
          question: "Is a vulnerability assessment conducted annually?",
          finding:
            "Requires verification of annual VAPT (Vulnerability Assessment and Penetration Testing) reports.",
          compliant: "Verify",
          gapIdentified:
            "Schedule and document regular vulnerability assessments and penetration testing (NDPA s. 39(2)(e)–(f)).",
          source: "manual",
        },
      ],
    },
    {
      id: "breach-management",
      code: "3.6",
      title: "Data Breach Management",
      legalReference: "NDPA 2023 s. 40",
      items: [
        {
          id: "q_3_6_1",
          sectionId: "breach-management",
          question: "Is a data breach response procedure documented?",
          finding:
            "Requires verification of internal Incident Response & Personal Data Breach Playbook.",
          compliant: "Verify",
          gapIdentified:
            "Establish a written Data Breach Response Plan defining containment, assessment, and notification workflows.",
          source: "manual",
        },
        {
          id: "q_3_6_2",
          sectionId: "breach-management",
          question:
            "Is there a process to notify NDPC within 72 hours?",
          finding:
            "Requires verification of 72-hour regulatory notification workflow under NDPA Section 40(2).",
          compliant: "Verify",
          gapIdentified:
            "Document a 72-hour NDPC breach notification procedure and direct communication template for affected data subjects (NDPA s. 40).",
          source: "manual",
        },
        {
          id: "q_3_6_3",
          sectionId: "breach-management",
          question: "Is a breach register maintained?",
          finding:
            "Requires inspection of internal Data Breach & Security Incident Register.",
          compliant: "Verify",
          gapIdentified:
            "Maintain an internal register of all personal data breaches, root causes, and remedial actions taken.",
          source: "manual",
        },
        {
          id: "q_3_6_4",
          sectionId: "breach-management",
          question: "Have staff been trained on breach reporting?",
          finding:
            "Requires verification of staff incident reporting drills and awareness records.",
          compliant: "Verify",
          gapIdentified:
            "Train all employees on how to identify a suspected personal data breach and report it immediately to the DPO/Security team.",
          source: "manual",
        },
      ],
    },
    {
      id: "third-party-processors",
      code: "3.7",
      title: "Third Party Processors",
      legalReference: "NDPA 2023 ss. 29, 41–43",
      items: [
        {
          id: "q_3_7_1",
          sectionId: "third-party-processors",
          question: "Are all third party processors identified?",
          finding:
            result.trackers.length > 0
              ? `Automated scan detected ${result.trackers.length} third-party tracker(s): ${result.trackers
                  .map((t) => t.name)
                  .join(", ")} (${result.technical.thirdPartyRequestCount} external network requests).`
              : `0 known client-side trackers detected (${result.technical.thirdPartyRequestCount} external network requests).`,
          compliant:
            sharingClause?.status === "found"
              ? "Yes"
              : result.trackers.length === 0
              ? "Yes"
              : "Partial",
          gapIdentified:
            sharingClause?.status === "found"
              ? "None"
              : "Maintain a complete inventory of client-side and backend data processors and disclose them in your Privacy Notice.",
          source: "automated",
        },
        {
          id: "q_3_7_2",
          sectionId: "third-party-processors",
          question:
            "Are data processing agreements in place with all processors?",
          finding:
            "Requires legal verification of signed Data Processing Agreements (DPAs) with all vendors.",
          compliant: "Verify",
          gapIdentified:
            "Execute written Data Processing Agreements (DPAs) with every third-party processor as required by NDPA Section 29(2) and GAID 2025 Art. 34.",
          source: "manual",
        },
        {
          id: "q_3_7_3",
          sectionId: "third-party-processors",
          question: "Is processor compliance reviewed annually?",
          finding:
            "Requires verification of annual vendor security and privacy due-diligence assessments.",
          compliant: "Verify",
          gapIdentified:
            "Conduct annual third-party risk and NDPA compliance reviews for all active data processors.",
          source: "manual",
        },
        {
          id: "q_3_7_4",
          sectionId: "third-party-processors",
          question:
            "Are cross border transfers documented and justified?",
          finding:
            transferClause?.status === "found"
              ? "Cross-border transfer mechanisms and safeguards are documented in the Privacy Policy."
              : transferClause?.status === "partial"
              ? "International processing is mentioned, but NDPA Part VIII safeguard mechanisms are not specified."
              : "No cross-border transfer disclosure found in the Privacy Policy.",
          compliant: clauseToCompliance(transferClause?.status),
          gapIdentified:
            transferClause?.status === "found"
              ? "None"
              : "Document cross-border transfer bases and safeguards under NDPA Part VIII (ss. 41–43).",
          source: "automated",
        },
      ],
    },
    {
      id: "staff-training",
      code: "3.8",
      title: "Staff Training",
      legalReference: "NDPA 2023 ss. 24(3), 32(3)",
      items: [
        {
          id: "q_3_8_1",
          sectionId: "staff-training",
          question: "Have all staff received NDPA awareness training?",
          finding:
            "Requires HR / DPO verification of organisation-wide NDPA 2023 training completion.",
          compliant: "Verify",
          gapIdentified:
            "Deliver mandatory NDPA 2023 data protection awareness training to all personnel handling personal data.",
          source: "manual",
        },
        {
          id: "q_3_8_2",
          sectionId: "staff-training",
          question: "Is training conducted at least annually?",
          finding:
            "Requires verification of the annual privacy training calendar.",
          compliant: "Verify",
          gapIdentified:
            "Schedule recurring annual refresher training on NDPA obligations, phishing, and DSAR/breach handling.",
          source: "manual",
        },
        {
          id: "q_3_8_3",
          sectionId: "staff-training",
          question: "Are training records maintained?",
          finding:
            "Requires inspection of attendance logs and assessment completion certificates.",
          compliant: "Verify",
          gapIdentified:
            "Maintain attendance logs, training materials, and completion records for NDPC audit readiness.",
          source: "manual",
        },
        {
          id: "q_3_8_4",
          sectionId: "staff-training",
          question:
            "Do new starters receive training before accessing personal data?",
          finding:
            "Requires verification of employee onboarding checklist.",
          compliant: "Verify",
          gapIdentified:
            "Embed mandatory data protection induction into employee onboarding prior to granting production data access.",
          source: "manual",
        },
      ],
    },
    {
      id: "ndpc-registration",
      code: "3.9",
      title: "NDPC Registration and Reporting",
      legalReference: "NDPA 2023 ss. 44, 47 & GAID",
      items: [
        {
          id: "q_3_9_1",
          sectionId: "ndpc-registration",
          question:
            "Is the organisation registered with NDPC where required?",
          finding:
            "Requires verification of registration as a Data Controller/Processor of Major Importance (DCMI/DPMI) with the NDPC.",
          compliant: "Verify",
          gapIdentified:
            "Assess DCMI/DPMI thresholds and complete statutory registration with the Nigeria Data Protection Commission (NDPA s. 44).",
          source: "manual",
        },
        {
          id: "q_3_9_2",
          sectionId: "ndpc-registration",
          question: "Has the annual data protection audit been filed?",
          finding:
            "Requires verification of annual NDPC Compliance Audit Returns (CAR) filing receipt.",
          compliant: "Verify",
          gapIdentified:
            "File annual Compliance Audit Returns (CAR) with the NDPC within statutory deadlines.",
          source: "manual",
        },
        {
          id: "q_3_9_3",
          sectionId: "ndpc-registration",
          question:
            "Has a licensed DPCO been engaged where required?",
          finding:
            "Requires verification of engagement letter with an NDPC-licensed Data Protection Compliance Organisation (DPCO).",
          compliant: "Verify",
          gapIdentified:
            "Engage an NDPC-licensed DPCO to verify and submit statutory compliance audit filings where required (NDPA s. 33).",
          source: "manual",
        },
      ],
    },
  ];

  return rawSections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      compliant: overrides[item.id] ?? item.compliant,
    })),
  }));
}

export function generateInternalAuditMarkdown(
  result: ScanResult,
  profile: RemediationProfile,
  overrides: Record<string, InternalComplianceAnswer> = {}
): string {
  const org = profile.organisation.trim() || "Your Organisation Ltd";
  const email = profile.email.trim() || "dpo@organisation.ng";
  const auditDate = new Date(result.scannedAt).toISOString().split("T")[0];
  const nextAuditDate = new Date(
    new Date(result.scannedAt).getTime() + 365 * 24 * 60 * 60 * 1000
  )
    .toISOString()
    .split("T")[0];

  const sections = buildInternalAuditSections(result, overrides);

  const findingsMarkdown = sections
    .map((sec) => {
      const rows = sec.items
        .map(
          (item) =>
            `| ${item.question} | ${item.finding.replace(/\|/g, "/")} | **${
              item.compliant
            }** | ${
              item.compliant === "Yes"
                ? "None"
                : item.gapIdentified.replace(/\|/g, "/")
            } |`
        )
        .join("\n");

      return `### ${sec.code} ${sec.title} (${sec.legalReference})\n\n| Audit Question | Finding | Compliant | Gap Identified |\n|---|---|---|---|\n${rows}`;
    })
    .join("\n\n---\n\n");

  const summaryRows = sections
    .map((sec) => {
      const gaps = sec.items.filter((i) => i.compliant !== "Yes").length;
      const yesCount = sec.items.filter((i) => i.compliant === "Yes").length;
      const status =
        gaps === 0
          ? "Compliant"
          : yesCount > 0
          ? "Partially Compliant"
          : "Action / Verification Required";
      return `| ${sec.title} | ${status} | ${gaps} |`;
    })
    .join("\n");

  const actionableChecks = result.checks.filter((c) => c.status !== "pass");
  const remediationRows =
    actionableChecks.length > 0
      ? actionableChecks
          .map((check, idx) => {
            const id = String(idx + 1).padStart(3, "0");
            const risk =
              check.status === "fail"
                ? "High"
                : check.status === "warning"
                ? "Medium"
                : "Low";
            const owner =
              check.pillar === "security"
                ? "Engineering / InfoSec"
                : check.pillar === "consent"
                ? "Frontend / Product"
                : `DPO (${email})`;
            return `| ${id} | ${check.title}: ${check.summary.replace(
              /\|/g,
              "/"
            )} | ${risk} | ${check.recommendation.replace(
              /\|/g,
              "/"
            )} | ${owner} | 30 Days | Open |`;
          })
          .join("\n")
      : `| 001 | Maintain continuous NDPA 2023 monitoring and annual CAR filing | Low | Conduct periodic reviews | DPO (${email}) | ${nextAuditDate} | Ongoing |`;

  const isCompliant = result.score >= 85;
  const isMinorGaps = result.score >= 70 && result.score < 85;
  const isSignificantGaps = result.score >= 45 && result.score < 70;
  const isNonCompliant = result.score < 45;

  return `# NDPA 2023 Internal Readiness Report

**Version:** 1.0  
**Last Updated:** ${auditDate}  
**Organisation:** ${org}  
**Target Property:** ${result.finalUrl}  
**Audit Date:** ${auditDate}  
**Prepared by:** NDPA Lens automated website scan + internal DPO review (${email})  
**Classification:** Confidential  

---

## 1. Purpose

This report records an internal readiness review of **${org}** against the Nigeria Data Protection Act (NDPA) 2023, covering \`${result.finalUrl}\`. It combines an automated website scan (website readiness: **${result.score}/100**, grade **${result.grade}**) with internal governance answers given by the organisation.

> **Important:** This is not a Compliance Audit Return (CAR). Organisations of Ultra-High and Extra-High Level must file their CAR through an NDPC-licensed Data Protection Compliance Organisation (DPCO), using the template in Schedule 2 of the GAID 2025. Internal answers in this report are self-declared and have not been independently verified.

**What the automated scan could not check:**

${(result.metadata.limitations ?? ["Internal records, contracts and pages behind a login."]).map((l) => `- ${l}`).join("\n")}

---

## 2. Audit Scope

| Area | In Scope | Notes |
|---|---|---|
| Data collection practices | Yes | Evaluated ${result.forms.length} web form(s), ${result.cookies.length} cookie(s), and consent controls on \`${result.finalUrl}\` |
| Privacy policy | Yes | ${result.policy.found ? `Analyzed policy at ${result.policy.url} (${result.policy.contentLength.toLocaleString()} chars)` : "No published privacy policy detected during scan"} |
| Data subject rights | Yes | Audited NDPA Part VI (ss. 34–38) disclosures and DSAR operational workflows |
| Data security | Yes | Inspected HTTPS/TLS transport, 6 HTTP security headers, cookie flags, and at-rest controls |
| Third party processors | Yes | Detected ${result.trackers.length} third-party tracker(s) and ${result.technical.thirdPartyRequestCount} external network requests |
| Data breach management | Yes | Internal NDPA s. 40 (72-hour NDPC breach notification) governance verification |
| Staff training | Yes | Internal NDPA s. 24(3) & s. 32(3) staff awareness verification |
| NDPC registration | Yes | NDPC DCMI/DPMI registration, DPCO engagement, and annual CAR filing status |

---

## 3. Audit Findings

${findingsMarkdown}

---

## 4. Audit Summary

| Area | Compliance Status | Number of Gaps / Verifications |
|---|---|---|
${summaryRows}

---

## 5. Remediation Plan

| ID | Gap Identified | Risk Level | Recommended Action | Owner | Due Date | Status |
|---|---|---|---|---|---|---|
${remediationRows}

---

## 6. Website Readiness Rating (automated scan only)

- [${isCompliant ? "x" : " "}] Ready — no significant website gaps found
- [${isMinorGaps ? "x" : " "}] Partially Compliant — Minor gaps identified
- [${isSignificantGaps ? "x" : " "}] Partially Compliant — Significant gaps identified
- [${isNonCompliant ? "x" : " "}] Non Compliant — Immediate action required

**Auditor Notes:** Automated scan completed via **${result.metadata.engine.toUpperCase()}** engine in ${result.metadata.durationMs}ms. Website readiness: **${result.score}/100 (Grade ${result.grade})**. This rating reflects the public website only, not overall NDPA compliance. Items marked **Verify** in Section 3 require internal documentary sign-off by the Data Protection Officer.

**Next Audit Date:** ${nextAuditDate}

---

## 7. Sign Off

| Role | Name | Signature | Date |
|---|---|---|---|
| Auditor | NDPA Lens / Internal Auditor | | ${auditDate} |
| Data Protection Officer | ${email} | | |
| CEO or Director | ${org} Executive Management | | |
`;
}

export function buildRemediationPack(
  result: ScanResult,
  profile: RemediationProfile,
  overrides: Record<string, InternalComplianceAnswer> = {}
): RemediationArtifact[] {
  const org = profile.organisation.trim() || "Your Organisation Ltd";
  const email = profile.email.trim() || "dpo@organisation.ng";
  const country = profile.country.trim() || "Nigeria";
  const retention =
    profile.retention.trim() ||
    "24 months after account closure or last active interaction, unless a longer statutory retention period applies under Nigerian law";

  const hostname = (() => {
    try {
      return new URL(result.finalUrl).hostname;
    } catch {
      return result.finalUrl;
    }
  })();

  const internalAuditContent = generateInternalAuditMarkdown(
    result,
    profile,
    overrides
  );

  const missingOrPartialClauses = result.policy.clauses
    .filter((c) => c.status !== "found")
    .map(
      (c) =>
        `- **${c.title}** (${c.legalReference}) — *Status: ${c.status.toUpperCase()}*`
    )
    .join("\n");

  const trackerDisclosureList =
    result.trackers.length > 0
      ? result.trackers
          .map(
            (t) => `- **${t.name}** (*${t.category}* — Domain: \`${t.domain}\`)`
          )
          .join("\n")
      : "- Strictly necessary first-party application logs and security telemetry.";

  const detectedFormFields = Array.from(
    new Set(result.forms.flatMap((f) => f.fields))
  );
  const formFieldsLine =
    detectedFormFields.length > 0
      ? detectedFormFields.join(", ")
      : "Full Name, Email Address, Telephone Number, and Account Identifiers";

  const policyContent = `# Privacy & Data Protection Notice (${org})
**Effective Date:** ${new Date().toISOString().split("T")[0]}  
**Domain:** ${hostname}  
**Governing Framework:** Nigeria Data Protection Act (NDPA) 2023

${
  missingOrPartialClauses
    ? `> **Audit Remediation Summary:** This notice specifically remediates the following gaps identified during the NDPA Lens audit:\n${missingOrPartialClauses}\n`
    : ""
}
## 1. Identity of the Data Controller & Data Protection Officer (NDPA ss. 27(1)(a), 32)
**${org}** (operating in **${country}**) is the Data Controller responsible for the processing of your personal data on \`${hostname}\`.
For any questions, requests to exercise your statutory rights, or data protection inquiries, please contact our designated **Data Protection Officer (DPO)**:
- **Email:** ${email}
- **Jurisdiction:** Federal Republic of Nigeria (${country})

## 2. Categories of Personal Data We Collect (GAID 2025 Art. 27(3)(c))
We collect and process only personal data that is adequate, relevant, and limited to what is necessary:
- **Information You Provide Directly:** ${formFieldsLine}.
- **Technical & Device Data:** IP address, browser type, operating system, referring URLs, and security session identifiers.
- **Cookies & Telemetry (Subject to Prior Consent):** Analytics and performance identifiers only when you provide affirmative opt-in consent.

## 3. Purposes & Lawful Bases for Processing (NDPA ss. 25(1), 27(1)(b))
Under Section 25 of the NDPA 2023, we process your personal data under the following lawful bases:
1. **Consent (s. 25(1)(a)):** For non-essential cookies, marketing communications, and optional analytics. You may withdraw consent at any time.
2. **Performance of a Contract (s. 25(1)(b)(i)):** To deliver products, services, or account functionality you request.
3. **Legal Obligation (s. 25(1)(b)(ii)):** To comply with Nigerian statutory, tax, regulatory, or AML/CFT obligations.
4. **Legitimate Interests (s. 25(1)(b)(v)):** For platform security, fraud prevention, and service reliability, provided such interests do not override your fundamental rights.

## 4. Third-Party Recipients & Processors (NDPA ss. 27(1)(c), 29)
We engage vetted Data Processors bound by written Data Processing Agreements (DPAs) under NDPA Section 29. Based on our current technical stack, third-party integrations include:
${trackerDisclosureList}

We never sell your personal data to third-party data brokers.

## 5. Cross-Border Transfers of Personal Data (NDPA Part VIII, ss. 41–43)
Where personal data is transferred outside **${country}** (for example, to cloud infrastructure or analytics processors), **${org}** ensures that the recipient jurisdiction provides an adequate level of protection as determined by the Nigeria Data Protection Commission (NDPC), or that appropriate safeguards (such as Standard Data Protection Clauses or binding corporate agreements under Section 41) are in place.

## 6. Data Retention Period (NDPA ss. 24(1)(d), 27(1)(e))
We retain personal data for **${retention}**. Once the purpose of processing has been fulfilled and statutory obligations expire, personal data is securely deleted or irreversibly anonymized.

## 7. Your Rights as a Data Subject (NDPA Part VI, ss. 34–38)
Under the Nigeria Data Protection Act 2023, you have the right to:
- **Access & Information (s. 34):** Request confirmation of processing and obtain a copy of your personal data.
- **Rectification (s. 34(1)(c)):** Request correction of inaccurate, incomplete, or out-of-date personal data.
- **Erasure (s. 34(1)(d)):** Request deletion of personal data where processing is no longer necessary or consent is withdrawn.
- **Restriction & Objection (ss. 34, 36):** Object to processing (including direct marketing) or request restriction of processing.
- **Data Portability (s. 38):** Receive your personal data in a structured, commonly used, machine-readable format.
- **Automated Decision-Making (s. 37):** Not be subject to a decision based solely on automated processing or profiling that produces legal or similarly significant effects without human intervention.
- **Withdrawal of Consent (ss. 26(4), 35):** Withdraw your consent at any time without affecting the lawfulness of prior processing.

To exercise any of these rights, email **${email}**. We respond to verified requests within 30 days.

## 8. Right to Lodge a Complaint with the NDPC (NDPA ss. 27(1)(f), 46)
If you believe that our processing of your personal data infringes the Nigeria Data Protection Act 2023, you have the statutory right to lodge a complaint with the supervisory authority:
- **Regulator:** Nigeria Data Protection Commission (NDPC)
- **Website:** https://ndpc.gov.ng
- **Email:** info@ndpc.gov.ng
`;

  const bannerContent = `<!-- NDPA 2023 Affirmative Cookie Consent Banner (Section 26 Compliant) -->
<!-- Equal prominence for "Reject Non-Essential" and "Accept All"; blocks trackers until opt-in -->
<!-- Shown in the middle of the screen: GAID 2025 Art. 7(l) treats a bottom-of-page notice as not transparent -->
<!-- Add a footer link that calls window.ndpaOpenSettings() so visitors can change their choice (GAID Art. 19(7)(e)) -->
<div
  id="ndpa-consent-banner"
  role="dialog"
  aria-live="polite"
  aria-label="Cookie and Data Privacy Consent"
  style="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:calc(100% - 2.5rem);max-width:36rem;max-height:calc(100vh - 2.5rem);overflow:auto;background:#14231c;color:#f7f8f4;padding:1.25rem 1.5rem;border-radius:1rem;box-shadow:0 20px 50px rgba(0,0,0,0.3);z-index:9999;font-family:system-ui,-apple-system,sans-serif;display:none;border:1px solid rgba(255,255,255,0.14);"
>
  <div style="display:flex;flex-direction:column;gap:0.875rem;">
    <div>
      <strong style="font-size:1rem;display:block;margin-bottom:0.25rem;">
        Your Privacy Choices (NDPA 2023)
      </strong>
      <p style="margin:0;font-size:0.875rem;line-height:1.5;color:#d5f0e1;">
        ${org} uses strictly necessary cookies to keep this site secure and reliable. With your affirmative consent, we also use analytics cookies to improve our services. You can change your choice at any time using the "Cookie settings" link at the bottom of every page. Read our
        <a href="/privacy-policy" style="color:#6ee7b7;text-decoration:underline;">Privacy Notice</a>.
      </p>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:0.625rem;justify-content:flex-end;">
      <button
        type="button"
        id="ndpa-btn-reject"
        style="padding:0.55rem 1rem;border-radius:0.5rem;border:1px solid #6ee7b7;background:transparent;color:#f7f8f4;font-weight:600;font-size:0.85rem;cursor:pointer;"
      >
        Reject Non-Essential
      </button>
      <button
        type="button"
        id="ndpa-btn-accept"
        style="padding:0.55rem 1rem;border-radius:0.5rem;border:1px solid #138a5b;background:#138a5b;color:#ffffff;font-weight:600;font-size:0.85rem;cursor:pointer;"
      >
        Accept All Cookies
      </button>
    </div>
  </div>
</div>

<script>
(function () {
  var STORAGE_KEY = "ndpa_cookie_consent_v1";
  var banner = document.getElementById("ndpa-consent-banner");
  var btnAccept = document.getElementById("ndpa-btn-accept");
  var btnReject = document.getElementById("ndpa-btn-reject");

  function getConsent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function saveConsent(analyticsAllowed) {
    var payload = {
      necessary: true,
      analytics: Boolean(analyticsAllowed),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    if (banner) banner.style.display = "none";
    if (analyticsAllowed) {
      activateDeferredScripts();
    }
  }

  // Activate <script type="text/plain" data-ndpa-consent="analytics" data-src="...">
  function activateDeferredScripts() {
    var scripts = document.querySelectorAll('script[type="text/plain"][data-ndpa-consent="analytics"]');
    scripts.forEach(function (oldScript) {
      var newScript = document.createElement("script");
      if (oldScript.dataset.src) {
        newScript.src = oldScript.dataset.src;
        newScript.async = true;
      } else {
        newScript.textContent = oldScript.textContent;
      }
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  window.ndpaHasConsent = function (category) {
    var state = getConsent();
    return Boolean(state && state[category]);
  };

  var existing = getConsent();
  if (!existing) {
    if (banner) banner.style.display = "block";
  } else if (existing.analytics) {
    activateDeferredScripts();
  }

  // Lets visitors withdraw or change consent later, e.g. from a footer "Cookie settings" link.
  window.ndpaOpenSettings = function () {
    if (banner) banner.style.display = "block";
  };

  if (btnAccept) btnAccept.addEventListener("click", function () { saveConsent(true); });
  if (btnReject) btnReject.addEventListener("click", function () { saveConsent(false); });
})();
</script>`;

  const formContent = `<!-- NDPA 2023 Form Consent & Point-of-Collection Notice (Sections 26 & 27) -->
<!-- Never pre-check consent checkboxes (NDPA s. 26(7)(a)) -->
<div class="ndpa-form-consent" style="margin-top:1rem;padding:0.875rem 1rem;border:1px solid #d5f0e1;background:#f7f8f4;border-radius:0.625rem;font-size:0.875rem;color:#14231c;">
  <label style="display:flex;align-items:flex-start;gap:0.625rem;cursor:pointer;line-height:1.45;">
    <input
      type="checkbox"
      name="ndpa_privacy_consent"
      value="accepted"
      required
      style="margin-top:0.2rem;width:1rem;height:1rem;accent-color:#138a5b;"
    />
    <span>
      I consent to <strong>${org}</strong> processing my personal data for the purpose of handling this request in accordance with the
      <a href="/privacy-policy" target="_blank" rel="noopener noreferrer" style="color:#0d704b;text-decoration:underline;font-weight:600;">
        Privacy &amp; Data Protection Notice
      </a>.
      I understand I may withdraw my consent at any time by contacting
      <a href="mailto:${email}" style="color:#0d704b;text-decoration:underline;">${email}</a>.
    </span>
  </label>
</div>`;

  const headersContent = `// Next.js (next.config.ts) Security Headers for NDPA 2023 Section 39 Compliance
import type { NextConfig } from "next";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "connect-src 'self' https:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;`;

  return [
    {
      id: "internal-audit",
      title: "NDPA 2023 Internal Readiness Report (Sections 1–7)",
      subtitle:
        "Complete 9-area NDPA 2023 internal audit worksheet pre-populated with live scan evidence, remediation table, and executive sign-off.",
      legalBasis: "NDPA 2023 Parts V–IX (ss. 24–47)",
      language: "markdown",
      filename: "ndpa-2023-readiness-report.md",
      content: internalAuditContent,
    },
    {
      id: "policy",
      title: "NDPA 2023 Privacy Policy & Clause Addendum",
      subtitle:
        "Complete statutory privacy notice tailored to your organisation, detected trackers, and missing NDPA clauses.",
      legalBasis: "NDPA 2023 ss. 24, 25, 27, 32, 34–38, 41–43, 46",
      language: "markdown",
      filename: "ndpa-privacy-policy.md",
      content: policyContent,
    },
    {
      id: "banner",
      title: "Affirmative Cookie Consent Banner & Script Gate",
      subtitle:
        "Zero-dependency consent banner with Reject/Accept parity and deferred script execution.",
      legalBasis: "NDPA 2023 s. 26(1)–(4)",
      language: "html",
      filename: "ndpa-cookie-banner.html",
      content: bannerContent,
    },
    {
      id: "form",
      title: "Unchecked Form Consent & Section 27 Notice",
      subtitle:
        "Drop-in HTML snippet for sign-up, checkout, and contact forms collecting personal data.",
      legalBasis: "NDPA 2023 ss. 26(3), 27(1)",
      language: "html",
      filename: "ndpa-form-consent.html",
      content: formContent,
    },
    {
      id: "headers",
      title: "HTTP Security & Data Integrity Headers",
      subtitle:
        "Production security headers hardening transport encryption, framing, and subresource policies.",
      legalBasis: "NDPA 2023 ss. 24(1)(f), 39",
      language: "typescript",
      filename: "next.config.security.ts",
      content: headersContent,
    },
  ];
}
