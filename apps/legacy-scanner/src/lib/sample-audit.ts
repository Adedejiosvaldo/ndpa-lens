import type { ScanResult } from "@/types/audit";

export const SAMPLE_AUDITS: Record<string, ScanResult> = {
  fintechDemo: {
    id: "ndpa_demo_fintech_ng",
    requestedUrl: "https://checkout.sample-fintech.example",
    finalUrl: "https://checkout.sample-fintech.example/",
    scannedAt: new Date().toISOString(),
    score: 60,
    grade: "C",
    riskLevel: "Moderate",
    pillars: [
      {
        id: "transparency",
        label: "Transparency & Notice",
        description:
          "Clarity of privacy notices, DPO contact disclosure, lawful basis mapping, and third-party sharing transparency.",
        score: 19,
        maxScore: 25,
        percentage: 76,
        citation: "NDPA 2023 ss. 24, 25, 27, 32",
      },
      {
        id: "rights",
        label: "Data Subject Rights",
        description:
          "Coverage of access, correction, erasure, portability, NDPC complaint rights, cross-border safeguards, and retention.",
        score: 16,
        maxScore: 25,
        percentage: 64,
        citation: "NDPA 2023 ss. 34–38, 41–43, 46",
      },
      {
        id: "consent",
        label: "Consent & Trackers",
        description:
          "Affirmative opt-in for cookies and trackers, reject parity, and unbundled form consent controls.",
        score: 6,
        maxScore: 25,
        percentage: 24,
        citation: "NDPA 2023 ss. 25(1)(a), 26",
      },
      {
        id: "security",
        label: "Technical Security",
        description:
          "HTTPS transport security, anti-exfiltration HTTP headers, cookie security flags, and third-party exposure.",
        score: 19,
        maxScore: 25,
        percentage: 76,
        citation: "NDPA 2023 ss. 24(1)(f), 29, 39",
      },
    ],
    checks: [
      {
        id: "privacy-notice-availability",
        pillar: "transparency",
        title: "Accessible Privacy Policy / Data Protection Notice",
        status: "pass",
        score: 8,
        maxScore: 8,
        summary: "Privacy notice discovered (6,420 characters analyzed).",
        evidence: [
          "Policy URL: https://checkout.sample-fintech.example/privacy-policy",
          "Document title: Privacy & Data Protection Policy | Sample Fintech",
          "Analyzed text length: 6,420 chars",
          "Last updated (as stated in the policy): 14 February 2024",
        ],
        recommendation:
          "Publish a clear, conspicuously linked Privacy Notice in the site footer and at every data collection point as mandated by NDPA Section 27.",
        legalReference: "NDPA 2023 ss. 24(1)(a), 27(1)",
      },
      {
        id: "dpo-controller-disclosure",
        pillar: "transparency",
        title: "Data Controller Identity & DPO Contact Details",
        status: "warning",
        score: 3,
        maxScore: 6,
        summary:
          "General contact email found, but explicit Data Protection Officer (DPO) designation is missing.",
        evidence: [
          "...for any questions regarding this Privacy Notice, please contact our support team at legal@sample-fintech.example...",
        ],
        recommendation:
          "Designate a Data Protection Officer (DPO) and publish their direct contact email (e.g., dpo@yourdomain.ng) in your Privacy Policy.",
        legalReference: "NDPA 2023 ss. 27(1)(a), 32",
      },
      {
        id: "processing-purpose-lawful-basis",
        pillar: "transparency",
        title: "Categories of Data, Purpose & Lawful Basis Disclosure",
        status: "warning",
        score: 6,
        maxScore: 7,
        summary:
          "Policy describes general data usage but lacks explicit mapping to NDPA Section 25 lawful bases.",
        evidence: [
          "Data categories clause: found",
          "Purpose & lawful basis clause: partial",
          "Third-party recipients clause: found",
        ],
        recommendation:
          "Explicitly state each category of personal data collected, the specific purpose, and which of the 6 NDPA Section 25 lawful bases applies.",
        legalReference: "NDPA 2023 ss. 25(1), 27(1)(b)–(c); GAID 2025 Art. 27(3)",
      },
      {
        id: "nigeria-specific-policy",
        pillar: "transparency",
        title: "Policy Written for Nigerian Law (NDPA), Not Only GDPR",
        status: "warning",
        score: 2,
        maxScore: 4,
        summary:
          "The policy mentions Nigeria but not the Nigeria Data Protection Act. It may be a copied GDPR or foreign template.",
        evidence: [
          "...Sample Fintech Ltd is a company registered in Nigeria and complies with the General Data Protection Regulation (GDPR)...",
        ],
        recommendation:
          "State that you process personal data under the Nigeria Data Protection Act 2023 and the GAID 2025, and describe Nigerian rights and the NDPC complaint route.",
        legalReference: "NDPA 2023 s. 27; GAID 2025",
      },
      {
        id: "data-subject-rights-notice",
        pillar: "rights",
        title: "Data Subject Rights (Access, Rectification, Erasure, Portability)",
        status: "pass",
        score: 10,
        maxScore: 10,
        summary:
          "Data subject rights under Part VI of the NDPA are clearly enumerated.",
        evidence: [
          "...you have the right to request access to, rectification of, or erasure of your personal data, as well as the right to object to processing and withdraw consent...",
        ],
        recommendation:
          "List the data subject's rights to access, rectification, erasure, restriction, portability, objection, and withdrawal of consent, along with response timelines.",
        legalReference: "NDPA 2023 Part VI (ss. 34–38)",
      },
      {
        id: "ndpc-redress-notice",
        pillar: "rights",
        title: "Right to Lodge a Complaint with the NDPC",
        status: "fail",
        score: 0,
        maxScore: 5,
        summary:
          "Does not inform users of their statutory right to lodge a complaint with the NDPC.",
        evidence: [
          "No reference to 'NDPC' or 'Nigeria Data Protection Commission' found.",
        ],
        recommendation:
          "Include a dedicated clause informing Nigerian data subjects of their right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) at info@ndpc.gov.ng.",
        legalReference: "NDPA 2023 ss. 27(1)(f), 46",
      },
      {
        id: "cross-border-transfer-disclosure",
        pillar: "rights",
        title: "Cross-Border Data Transfers Outside Nigeria",
        status: "warning",
        score: 3,
        maxScore: 5,
        summary:
          "Mentions international servers/processing without specifying NDPA Part VIII adequacy or safeguards.",
        evidence: [
          "...your information may be processed on cloud servers located outside your country of residence...",
        ],
        recommendation:
          "Disclose any cross-border transfer of personal data outside Nigeria and state the legal transfer basis under NDPA Sections 41–43.",
        legalReference: "NDPA 2023 Part VIII (ss. 41–43)",
      },
      {
        id: "data-retention-schedule",
        pillar: "rights",
        title: "Data Retention Period & Storage Limitation",
        status: "warning",
        score: 3,
        maxScore: 5,
        summary:
          "Uses vague storage language without clear retention criteria.",
        evidence: [
          "...we keep your information for as long as necessary to provide our services...",
        ],
        recommendation:
          "Specify concrete retention periods for each category of personal data or the criteria used to determine when data is deleted or anonymized.",
        legalReference: "NDPA 2023 ss. 24(1)(d), 27(1)(e)",
      },
      {
        id: "cookie-consent-banner",
        pillar: "consent",
        title: "Cookie Banner With Accept and Reject",
        status: "warning",
        score: 3,
        maxScore: 7,
        summary:
          "A cookie banner appears, but it has no Reject button on the first screen. GAID 2025 requires both Accept and Reject.",
        evidence: [
          "Banner visible on first visit: Yes",
          "Visible without scrolling: Yes",
          "Reject button: Not found",
          'Accept button: Yes ("Accept all")',
          "Consent tool in page source: None recognised",
        ],
        recommendation:
          "Show a banner on first visit, visible without scrolling, with equally prominent Accept and Reject buttons. Load nothing non-essential until the visitor chooses.",
        legalReference: "NDPA 2023 ss. 25(1)(a), 26; GAID 2025 Art. 19",
      },
      {
        id: "pre-consent-tracking",
        pillar: "consent",
        title: "No Tracking Before the Visitor Chooses",
        status: "fail",
        score: 1,
        maxScore: 7,
        summary:
          "3 tracker(s) and 3 non-essential cookie(s) loaded before the visitor made any choice (across 4 pages).",
        evidence: [
          "Trackers before any choice: Google Analytics (GA4 / UA), Meta Pixel (Facebook), Hotjar Session Recording",
          "Non-essential cookies before any choice: 3 (total cookies: 4)",
          "Checked after waiting for the page to settle and scrolling to the bottom.",
        ],
        recommendation:
          "Hold back analytics, advertising and session-recording scripts until the visitor clicks Accept. Silence or a pre-ticked box is not consent.",
        legalReference: "NDPA 2023 s. 26(1)–(3); GAID 2025 Art. 19",
      },
      {
        id: "reject-respected",
        pillar: "consent",
        title: "Reject Actually Stops Tracking",
        status: "fail",
        score: 0,
        maxScore: 6,
        summary: "Visitors have no way to refuse tracking: we found no Reject button.",
        evidence: [
          "Reject button: not found",
          "Trackers seen: Google Analytics (GA4 / UA), Meta Pixel (Facebook), Hotjar Session Recording",
        ],
        recommendation:
          "Add a Reject button and make sure clicking it blocks every non-essential script and cookie.",
        legalReference: "NDPA 2023 s. 26; GAID 2025 Art. 19",
      },
      {
        id: "form-consent-controls",
        pillar: "consent",
        title: "Form Data Collection Consent & Unchecked Opt-In",
        status: "warning",
        score: 2,
        maxScore: 5,
        summary:
          "1 of 2 personal data form(s) collect user data without an explicit consent checkbox or adjacent privacy notice link.",
        evidence: [
          "Form #1 on https://checkout.sample-fintech.example/signup (full_name, work_email, phone_number, bvn_last4): Consent=Yes, Pre-checked=No, Notice=Yes",
          "Form #2 on https://checkout.sample-fintech.example/ (newsletter_email): Consent=No, Pre-checked=No, Notice=No",
        ],
        recommendation:
          "Add an unchecked opt-in consent checkbox and a direct link to your Privacy Notice beneath every form collecting personal data.",
        legalReference: "NDPA 2023 ss. 26(1)–(3), 27(1)",
      },
      {
        id: "transport-encryption-https",
        pillar: "security",
        title: "HTTPS Transport Encryption & Mixed Content Integrity",
        status: "pass",
        score: 8,
        maxScore: 8,
        summary:
          "Site enforces HTTPS encryption with zero mixed-content HTTP subresources.",
        evidence: [
          "Final URL protocol: HTTPS",
          "Mixed content insecure resources: 0",
        ],
        recommendation:
          "Enforce TLS/HTTPS across all pages and upgrade all subresources (scripts, images, iframes) to HTTPS.",
        legalReference: "NDPA 2023 s. 39(1)",
      },
      {
        id: "http-security-headers",
        pillar: "security",
        title: "HTTP Security & Anti-Exfiltration Headers",
        status: "warning",
        score: 5,
        maxScore: 8,
        summary:
          "5/8 security header points achieved across HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.",
        evidence: [
          "Present: Strict-Transport-Security (HSTS) (max-age=31536000; includeSubDomains)",
          "Missing: Content-Security-Policy (CSP)",
          "Present: X-Content-Type-Options (nosniff)",
          "Present: X-Frame-Options (SAMEORIGIN)",
          "Present: Referrer-Policy (strict-origin-when-cross-origin)",
          "Missing: Permissions-Policy",
        ],
        recommendation:
          "Configure HSTS, a strict Content-Security-Policy, Referrer-Policy (strict-origin-when-cross-origin), and X-Content-Type-Options (nosniff) to protect data integrity.",
        legalReference: "NDPA 2023 ss. 24(1)(f), 39(1)–(2)",
      },
      {
        id: "cookie-security-flags",
        pillar: "security",
        title: "Cookie Hardening (Secure & SameSite Attributes)",
        status: "warning",
        score: 4,
        maxScore: 5,
        summary:
          "1 of 4 cookies (_fbp) is missing the Secure flag.",
        evidence: [
          "__Host-np_sess (checkout.sample-fintech.example): Secure=true, HttpOnly=true, SameSite=Strict",
          "_ga (sample-fintech.example): Secure=true, HttpOnly=false, SameSite=Lax",
          "_fbp (sample-fintech.example): Secure=false, HttpOnly=false, SameSite=Lax",
          "_hjSessionUser (sample-fintech.example): Secure=true, HttpOnly=false, SameSite=Lax",
        ],
        recommendation:
          "Mark all session and tracking cookies with the `Secure` attribute, `HttpOnly` (where JS access isn't needed), and explicit `SameSite=Lax` or `Strict`.",
        legalReference: "NDPA 2023 s. 39(1)",
      },
      {
        id: "third-party-surface-exposure",
        pillar: "security",
        title: "Third-Party Script & Data Processor Attack Surface",
        status: "warning",
        score: 2,
        maxScore: 4,
        summary:
          "Page initiated 11 third-party network request(s) and loaded 3 known tracker(s).",
        evidence: [
          "Third-party network requests: 11",
          "External tracker vendors: google-analytics.com, connect.facebook.net, hotjar.com",
        ],
        recommendation:
          "Minimize external third-party scripts, apply Subresource Integrity (SRI), and execute Data Processing Agreements (DPAs) with all external vendors under NDPA Section 29.",
        legalReference: "NDPA 2023 ss. 29, 39",
      },
    ],
    policy: {
      found: true,
      url: "https://checkout.sample-fintech.example/privacy-policy",
      title: "Privacy & Data Protection Policy | Sample Fintech",
      contentLength: 6420,
      lastUpdated: "14 February 2024",
      source: "rules",
      clauses: [
        {
          id: "controller-dpo",
          title: "Data Controller Identity & DPO Contact",
          status: "partial",
          description:
            "Discloses the identity of the data controller and contact details for the Data Protection Officer (DPO) or privacy inquiries.",
          legalReference: "NDPA 2023 ss. 27(1)(a), 32",
          evidence:
            "...for any questions regarding this Privacy Notice, please contact our support team at legal@sample-fintech.example...",
        },
        {
          id: "data-categories",
          title: "Categories of Personal Data Collected",
          status: "found",
          description:
            "Specifies the types of personal data collected directly, automatically, or from third parties.",
          legalReference: "GAID 2025 Art. 27(3)(c)",
          evidence:
            "...Categories of Personal Data We Collect: full name, email address, phone number, BVN verification token, and device telemetry...",
        },
        {
          id: "purpose-lawful-basis",
          title: "Purpose & Lawful Basis for Processing",
          status: "partial",
          description:
            "Explains specific purposes for processing and maps them to lawful bases under NDPA (consent, contract, legal obligation, legitimate interest, vital interest, or public interest).",
          legalReference: "NDPA 2023 ss. 25(1), 27(1)(b)",
          evidence:
            "...How we use your personal information: to process merchant settlements, verify identity, and improve our checkout experience...",
        },
        {
          id: "data-subject-rights",
          title: "Data Subject Rights (Access, Correction, Erasure, Objection)",
          status: "found",
          description:
            "Informs Nigerian data subjects of their rights to access, rectify, erase, restrict processing, data portability, and withdraw consent.",
          legalReference: "NDPA 2023 Part VI (ss. 34–38)",
          evidence:
            "...Your Data Protection Rights: you have the right to request access, rectification, erasure, or portability of your personal data and to withdraw consent at any time...",
        },
        {
          id: "third-party-sharing",
          title: "Recipients & Third-Party Disclosures",
          status: "found",
          description:
            "Identifies third parties, processors, service providers, or categories of recipients with whom personal data is shared.",
          legalReference: "NDPA 2023 s. 27(1)(c)",
          evidence:
            "...We share personal data only with licensed payment switches, identity verification partners, and cloud infrastructure processors...",
        },
        {
          id: "cross-border-transfer",
          title: "Cross-Border Data Transfers & Safeguards",
          status: "partial",
          description:
            "Addresses transfers of personal data outside Nigeria and the adequacy or appropriate safeguard mechanisms used.",
          legalReference: "NDPA 2023 Part VIII (ss. 41–43)",
          evidence:
            "...your information may be processed on cloud servers located outside your country of residence...",
        },
        {
          id: "retention-period",
          title: "Data Retention Period or Criteria",
          status: "partial",
          description:
            "States how long personal data will be stored or the criteria used to determine retention periods.",
          legalReference: "NDPA 2023 ss. 24(1)(d), 27(1)(e)",
          evidence:
            "...how long we keep your data: we keep your information for as long as necessary to provide our services...",
        },
        {
          id: "ndpc-complaint-right",
          title: "Right to Lodge a Complaint with the NDPC",
          status: "missing",
          description:
            "Explicitly informs data subjects of their right to complain to the Nigeria Data Protection Commission (NDPC) or supervisory authority.",
          legalReference: "NDPA 2023 ss. 27(1)(f), 46",
        },
        {
          id: "nigeria-law-reference",
          title: "Written for Nigerian Law (NDPA)",
          status: "partial",
          description:
            "Refers to the Nigeria Data Protection Act 2023 rather than only GDPR or another country's law.",
          legalReference: "NDPA 2023 s. 27; GAID 2025",
          evidence:
            "...Sample Fintech Ltd is a company registered in Nigeria and complies with the General Data Protection Regulation (GDPR)...",
        },
        {
          id: "automated-decision-making",
          title: "Automated Decision-Making & Profiling Disclosure",
          status: "missing",
          description:
            "Discloses the existence of automated decision-making or profiling and the right to human intervention.",
          legalReference: "NDPA 2023 ss. 27(1)(g), 37",
        },
      ],
    },
    trackers: [
      {
        name: "Google Analytics (GA4 / UA)",
        category: "Analytics",
        domain: "google-analytics.com",
      },
      {
        name: "Meta Pixel (Facebook)",
        category: "Advertising",
        domain: "connect.facebook.net",
      },
      {
        name: "Hotjar Session Recording",
        category: "Behavioral Heatmap",
        domain: "hotjar.com",
      },
    ],
    cookies: [
      {
        name: "__Host-np_sess",
        domain: "checkout.sample-fintech.example",
        secure: true,
        httpOnly: true,
        sameSite: "Strict",
        session: true,
      },
      {
        name: "_ga",
        domain: "sample-fintech.example",
        secure: true,
        httpOnly: false,
        sameSite: "Lax",
        session: false,
      },
      {
        name: "_fbp",
        domain: "sample-fintech.example",
        secure: false,
        httpOnly: false,
        sameSite: "Lax",
        session: false,
      },
      {
        name: "_hjSessionUser",
        domain: "sample-fintech.example",
        secure: true,
        httpOnly: false,
        sameSite: "Lax",
        session: false,
      },
    ],
    forms: [
      {
        pageUrl: "https://checkout.sample-fintech.example/signup",
        action: "/api/v1/merchant-onboarding",
        fields: ["full_name", "work_email", "phone_number", "bvn_last4"],
        hasSensitiveFields: true,
        hasConsentControl: true,
        hasPreCheckedConsent: false,
        hasPrivacyLink: true,
      },
      {
        pageUrl: "https://checkout.sample-fintech.example/",
        action: "/api/v1/newsletter-subscribe",
        fields: ["newsletter_email"],
        hasSensitiveFields: true,
        hasConsentControl: false,
        hasPreCheckedConsent: false,
        hasPrivacyLink: false,
      },
    ],
    technical: {
      https: true,
      finalUrl: "https://checkout.sample-fintech.example/",
      headers: {
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "x-content-type-options": "nosniff",
        "x-frame-options": "SAMEORIGIN",
        "referrer-policy": "strict-origin-when-cross-origin",
        "content-type": "text/html; charset=utf-8",
        server: "cloudflare",
      },
      mixedContentCount: 0,
      preConsentCookieCount: 3,
      insecureCookieCount: 1,
      thirdPartyRequestCount: 11,
      bannerDetected: true,
      bannerHasReject: false,
      consentTest: {
        tested: true,
        bannerVisible: true,
        bannerAboveFold: true,
        rejectFound: false,
        acceptFound: true,
        acceptLabel: "Accept all",
        rejectClicked: false,
        acceptClicked: true,
        trackersBeforeConsent: [
          "Google Analytics (GA4 / UA)",
          "Meta Pixel (Facebook)",
          "Hotjar Session Recording",
        ],
        trackersAfterReject: [],
        cookiesAfterReject: [],
        trackersAfterAccept: [
          "Google Analytics (GA4 / UA)",
          "Meta Pixel (Facebook)",
          "Hotjar Session Recording",
        ],
        notes: [],
      },
    },
    pages: [
      {
        url: "https://checkout.sample-fintech.example/",
        kind: "home",
        title: "Sample Fintech Checkout — Instant Business Settlements",
        status: 200,
        bannerVisible: true,
        policyLinked: true,
        formCount: 1,
        trackers: ["Google Analytics (GA4 / UA)", "Meta Pixel (Facebook)", "Hotjar Session Recording"],
      },
      {
        url: "https://checkout.sample-fintech.example/privacy-policy",
        kind: "policy",
        title: "Privacy & Data Protection Policy | Sample Fintech",
        status: 200,
        bannerVisible: true,
        policyLinked: true,
        formCount: 0,
        trackers: ["Google Analytics (GA4 / UA)"],
      },
      {
        url: "https://checkout.sample-fintech.example/signup",
        kind: "signup",
        title: "Open a business account | Sample Fintech",
        status: 200,
        bannerVisible: true,
        policyLinked: true,
        formCount: 1,
        trackers: ["Google Analytics (GA4 / UA)", "Meta Pixel (Facebook)"],
      },
      {
        url: "https://checkout.sample-fintech.example/pricing",
        kind: "checkout",
        title: "Pricing | Sample Fintech",
        status: 200,
        bannerVisible: true,
        policyLinked: false,
        formCount: 0,
        trackers: ["Google Analytics (GA4 / UA)"],
      },
    ],
    evidence: {
      screenshots: [],
      networkLog: [],
    },
    metadata: {
      pageTitle: "Sample Fintech Checkout — Instant Business Settlements",
      engine: "browser",
      browserChannel: "chrome",
      durationMs: 31840,
      limitations: [
        "We visited from outside Nigeria. Some sites show a different cookie banner depending on the visitor's country.",
        "Pages behind a login, and internal records (data inventory, contracts, risk assessments, breach logs), can't be seen from outside. The organisation questions cover those.",
      ],
    },
  },
};
