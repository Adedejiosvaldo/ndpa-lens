import * as cheerio from "cheerio";
import type {
  AISettings,
  AuditCheck,
  CookieFinding,
  DetectedTracker,
  FormFinding,
  PageScan,
  PillarId,
  PillarResult,
  PolicyAnalysis,
  ScanResult,
  TechnicalEvidence,
} from "@/types/audit";
import { analyzePrivacyPolicy } from "@/lib/policy-analyzer";
import { fetchSiteIcon } from "@/lib/site-icon";
import { captureWithBrowser, type BrowserCapture } from "@/lib/browser-capture";
import { assertPublicUrl, normalizeTargetUrl, safeFetch, ScanAbort } from "@/lib/net-guard";
import { inspectDomContent, looksBlocked } from "@/lib/page-inspect";
import { detectTrackersFromUrls, getRootDomain, isNonEssentialCookie } from "@/lib/trackers";

function parseSetCookieHeaders(
  setCookieHeaders: string[],
  defaultDomain: string
): CookieFinding[] {
  return setCookieHeaders
    .map((raw) => {
      const parts = raw.split(";").map((p) => p.trim());
      const [nameVal, ...attrs] = parts;
      if (!nameVal || !nameVal.includes("=")) return null;
      const name = nameVal.split("=")[0].trim();
      if (!name) return null;

      let domain = defaultDomain;
      let secure = false;
      let httpOnly = false;
      let sameSite = "None (unspecified)";
      let session = true;

      for (const attr of attrs) {
        const lower = attr.toLowerCase();
        if (lower === "secure") secure = true;
        else if (lower === "httponly") httpOnly = true;
        else if (lower.startsWith("domain=")) {
          domain = attr.slice(7).trim().replace(/^\./, "") || defaultDomain;
        } else if (lower.startsWith("samesite=")) {
          sameSite = attr.slice(9).trim();
        } else if (lower.startsWith("expires=") || lower.startsWith("max-age=")) {
          session = false;
        }
      }

      return {
        name,
        domain,
        secure,
        httpOnly,
        sameSite,
        session,
      };
    })
    .filter((c): c is CookieFinding => c !== null);
}

interface StaticCapture {
  engine: "static";
  fallbackReason?: string;
  finalUrl: string;
  status: number;
  html: string;
  headers: Record<string, string>;
  cookies: CookieFinding[];
}

const STATIC_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NDPALensAudit/1.0";

/** Plain page download, used only when no browser can be started. */
async function captureWithStaticFetch(targetUrl: string, fallbackReason?: string): Promise<StaticCapture> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16000);

  try {
    const response = await safeFetch(targetUrl, {
      headers: {
        "User-Agent": STATIC_UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-NG,en;q=0.9",
      },
      signal: controller.signal,
    });

    const finalUrl = response.url || targetUrl;
    const html = await response.text();
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const setCookieHeaders =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie") as string]
        : [];

    const hostname = new URL(finalUrl).hostname;
    const cookies = parseSetCookieHeaders(setCookieHeaders, hostname);

    return { engine: "static", fallbackReason, finalUrl, status: response.status, html, headers, cookies };
  } catch (err) {
    if (err instanceof ScanAbort) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    if (/certificate|CERT_|SSL/i.test(msg)) {
      throw new ScanAbort(
        "This site's HTTPS certificate isn't valid, so browsers show visitors a security warning. Fix the certificate, then scan again."
      );
    }
    if (/ENOTFOUND|EAI_AGAIN/i.test(msg)) {
      throw new ScanAbort("We couldn't find that website. Check the address and try again.");
    }
    throw new Error(`Couldn't load the website (${msg}).`);
  } finally {
    clearTimeout(timeout);
  }
}

/** Static fallback for finding the privacy policy. A browser scan renders it instead. */
async function fetchPrivacyPolicyPage(
  finalUrl: string,
  discoveredLink?: string
): Promise<{ found: boolean; url?: string; html?: string }> {
  const origin = new URL(finalUrl).origin;
  const candidateUrls: string[] = [];
  if (discoveredLink) candidateUrls.push(discoveredLink);
  for (const path of ["/privacy-policy", "/privacy", "/legal/privacy-policy", "/legal/privacy", "/data-protection-policy"]) {
    const url = `${origin}${path}`;
    if (!candidateUrls.includes(url)) candidateUrls.push(url);
  }

  for (const candidateUrl of candidateUrls.slice(0, 4)) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await safeFetch(candidateUrl, {
        headers: { "User-Agent": STATIC_UA, Accept: "text/html,application/xhtml+xml" },
        signal: controller.signal,
      });
      if (!res.ok) continue;
      const html = await res.text();
      const $ = cheerio.load(html);
      $("script, style, noscript, nav, footer").remove();
      const bodyText = $("body").text().replace(/\s+/g, " ").trim();
      if (bodyText.length > 250 && /(privacy|personal data|information we collect|data protection|cookies)/i.test(bodyText)) {
        return { found: true, url: res.url || candidateUrl, html };
      }
    } catch {
      // try next candidate
    } finally {
      clearTimeout(timeout);
    }
  }
  return { found: false, url: discoveredLink };
}

function buildChecksAndPillars(params: {
  technical: TechnicalEvidence;
  policy: PolicyAnalysis;
  trackers: DetectedTracker[];
  cookies: CookieFinding[];
  forms: FormFinding[];
  pages?: PageScan[];
}): { checks: AuditCheck[]; pillars: PillarResult[]; overallScore: number } {
  const { technical, policy, trackers, cookies, forms, pages } = params;
  const checks: AuditCheck[] = [];

  const getClause = (id: string) => policy.clauses.find((c) => c.id === id);

  // =========================================================================
  // PILLAR 1: TRANSPARENCY (Notice & Governance — Max 25 pts)
  // =========================================================================
  const policyFoundScore = policy.found ? (policy.contentLength >= 800 ? 8 : 5) : 0;
  checks.push({
    id: "privacy-notice-availability",
    pillar: "transparency",
    title: "Accessible Privacy Policy / Data Protection Notice",
    status: policyFoundScore === 8 ? "pass" : policyFoundScore > 0 ? "warning" : "fail",
    score: policyFoundScore,
    maxScore: 8,
    summary: policy.found
      ? `Privacy notice discovered (${policy.contentLength.toLocaleString()} characters analyzed).`
      : "No accessible Privacy Policy or Data Protection Notice link was detected on the page.",
    evidence: policy.found
      ? [
          `Policy URL: ${policy.url || "Resolved on domain"}`,
          `Document title: ${policy.title || "Privacy Policy"}`,
          `Analyzed text length: ${policy.contentLength.toLocaleString()} chars`,
          `Last updated (as stated in the policy): ${policy.lastUpdated || "not stated"}`,
        ]
      : [
          "Homepage links and standard paths (/privacy-policy, /privacy) returned no valid policy document.",
        ],
    recommendation:
      "Publish a clear, conspicuously linked Privacy Notice in the site footer and at every data collection point as mandated by NDPA Section 27.",
    legalReference: "NDPA 2023 ss. 24(1)(a), 27(1)",
  });

  const dpoClause = getClause("controller-dpo");
  const dpoScore = dpoClause?.status === "found" ? 6 : dpoClause?.status === "partial" ? 3 : 0;
  checks.push({
    id: "dpo-controller-disclosure",
    pillar: "transparency",
    title: "Data Controller Identity & DPO Contact Details",
    status: dpoScore === 6 ? "pass" : dpoScore > 0 ? "warning" : "fail",
    score: dpoScore,
    maxScore: 6,
    summary:
      dpoClause?.status === "found"
        ? "Data Controller identity and DPO/privacy contact details are disclosed."
        : dpoClause?.status === "partial"
        ? "General contact email found, but explicit Data Protection Officer (DPO) designation is missing."
        : "No DPO or dedicated data protection contact channel was identified in the policy.",
    evidence: dpoClause?.evidence
      ? [dpoClause.evidence]
      : ["No explicit 'Data Protection Officer' or privacy contact clause matched."],
    recommendation:
      "Designate a Data Protection Officer (DPO) and publish their direct contact email (e.g., dpo@yourdomain.ng) in your Privacy Policy.",
    legalReference: "NDPA 2023 ss. 27(1)(a), 32",
  });

  const categoriesClause = getClause("data-categories");
  const purposeClause = getClause("purpose-lawful-basis");
  const sharingClause = getClause("third-party-sharing");
  const transparencyClausePoints = [categoriesClause, purposeClause, sharingClause].reduce((acc, c) => {
    if (c?.status === "found") return acc + 1;
    if (c?.status === "partial") return acc + 0.5;
    return acc;
  }, 0);
  const coreDisclosureScore = Math.round((transparencyClausePoints / 3) * 7);

  checks.push({
    id: "processing-purpose-lawful-basis",
    pillar: "transparency",
    title: "Categories of Data, Purpose & Lawful Basis Disclosure",
    status: coreDisclosureScore >= 7 ? "pass" : coreDisclosureScore >= 3 ? "warning" : "fail",
    score: coreDisclosureScore,
    maxScore: 7,
    summary:
      coreDisclosureScore >= 7
        ? "Policy specifies personal data categories, processing purposes, lawful bases, and third-party recipients."
        : coreDisclosureScore >= 3
        ? "Policy describes general data usage but lacks explicit mapping to NDPA Section 25 lawful bases."
        : "Core disclosures on data categories, lawful bases, and third-party sharing are missing or unavailable.",
    evidence: [
      `Data categories clause: ${categoriesClause?.status || "unavailable"}`,
      `Purpose & lawful basis clause: ${purposeClause?.status || "unavailable"}`,
      `Third-party recipients clause: ${sharingClause?.status || "unavailable"}`,
    ],
    recommendation:
      "Explicitly state each category of personal data collected, the specific purpose, and which of the 6 NDPA Section 25 lawful bases applies.",
    legalReference: "NDPA 2023 ss. 25(1), 27(1)(b)–(c); GAID 2025 Art. 27(3)",
  });

  const nigeriaClause = getClause("nigeria-law-reference");
  // Naming the NDPC as the regulator is as Nigeria-specific as naming the Act.
  const namesNdpc = getClause("ndpc-complaint-right")?.status === "found";
  const nigeriaFound = nigeriaClause?.status === "found" || namesNdpc;
  const nigeriaScore = nigeriaFound ? 4 : nigeriaClause?.status === "partial" ? 2 : 0;
  checks.push({
    id: "nigeria-specific-policy",
    pillar: "transparency",
    title: "Policy Written for Nigerian Law (NDPA), Not Only GDPR",
    status: nigeriaScore === 4 ? "pass" : nigeriaScore > 0 ? "warning" : "fail",
    score: nigeriaScore,
    maxScore: 4,
    summary:
      nigeriaClause?.status === "found"
        ? "The policy refers to the Nigeria Data Protection Act."
        : namesNdpc
        ? "The policy names the Nigeria Data Protection Commission (NDPC). Naming the NDPA 2023 as well would make it clearer."
        : nigeriaClause?.status === "partial"
        ? "The policy mentions Nigeria but not the Nigeria Data Protection Act. It may be a copied GDPR or foreign template."
        : policy.found
        ? "The policy never mentions Nigerian data protection law. It is likely a foreign template."
        : "No privacy policy to check.",
    evidence: nigeriaClause?.evidence ? [nigeriaClause.evidence] : ["No reference to the NDPA or Nigerian data protection law found."],
    recommendation:
      "State that you process personal data under the Nigeria Data Protection Act 2023 and the GAID 2025, and describe Nigerian rights and the NDPC complaint route.",
    legalReference: "NDPA 2023 s. 27; GAID 2025",
  });

  // =========================================================================
  // PILLAR 2: DATA SUBJECT RIGHTS & REDRESS (Max 25 pts)
  // =========================================================================
  const rightsClause = getClause("data-subject-rights");
  const rightsScore =
    rightsClause?.status === "found"
      ? 10
      : rightsClause?.status === "partial"
      ? 5
      : 0;
  checks.push({
    id: "data-subject-rights-notice",
    pillar: "rights",
    title: "Data Subject Rights (Access, Rectification, Erasure, Portability)",
    status: rightsScore === 10 ? "pass" : rightsScore > 0 ? "warning" : "fail",
    score: rightsScore,
    maxScore: 10,
    summary:
      rightsClause?.status === "found"
        ? "Data subject rights under Part VI of the NDPA are clearly enumerated."
        : rightsClause?.status === "partial"
        ? "Some opt-out or access rights are mentioned, but full NDPA Part VI rights are incomplete."
        : "No clear explanation of Nigerian data subject rights (access, deletion, objection, portability) was found.",
    evidence: rightsClause?.evidence
      ? [rightsClause.evidence]
      : ["Missing comprehensive enumeration of NDPA Part VI rights."],
    recommendation:
      "List the data subject's rights to access, rectification, erasure, restriction, portability, objection, and withdrawal of consent, along with response timelines.",
    legalReference: "NDPA 2023 Part VI (ss. 34–38)",
  });

  const ndpcClause = getClause("ndpc-complaint-right");
  const ndpcScore =
    ndpcClause?.status === "found"
      ? 5
      : ndpcClause?.status === "partial"
      ? 3
      : 0;
  checks.push({
    id: "ndpc-redress-notice",
    pillar: "rights",
    title: "Right to Lodge a Complaint with the NDPC",
    status: ndpcScore === 5 ? "pass" : ndpcScore > 0 ? "warning" : "fail",
    score: ndpcScore,
    maxScore: 5,
    summary:
      ndpcClause?.status === "found"
        ? "Explicitly references the Nigeria Data Protection Commission (NDPC) or Nigerian regulatory redress."
        : ndpcClause?.status === "partial"
        ? "Mentions a generic supervisory authority without naming the Nigeria Data Protection Commission (NDPC)."
        : "Does not inform users of their statutory right to lodge a complaint with the NDPC.",
    evidence: ndpcClause?.evidence
      ? [ndpcClause.evidence]
      : ["No reference to 'NDPC' or 'Nigeria Data Protection Commission' found."],
    recommendation:
      "Include a dedicated clause informing Nigerian data subjects of their right to lodge a complaint with the Nigeria Data Protection Commission (NDPC) at info@ndpc.gov.ng.",
    legalReference: "NDPA 2023 ss. 27(1)(f), 46",
  });

  const transferClause = getClause("cross-border-transfer");
  const transferScore =
    transferClause?.status === "found"
      ? 5
      : transferClause?.status === "partial"
      ? 3
      : trackers.length === 0 && technical.thirdPartyRequestCount === 0
      ? 4
      : 0;
  checks.push({
    id: "cross-border-transfer-disclosure",
    pillar: "rights",
    title: "Cross-Border Data Transfers Outside Nigeria",
    status:
      transferScore >= 4 ? "pass" : transferScore > 0 ? "warning" : "fail",
    score: transferScore,
    maxScore: 5,
    summary:
      transferClause?.status === "found"
        ? "Cross-border transfer mechanisms and safeguards are documented."
        : transferClause?.status === "partial"
        ? "Mentions international servers/processing without specifying NDPA Part VIII adequacy or safeguards."
        : `No cross-border transfer clause found despite ${trackers.length} third-party tracker(s) and ${technical.thirdPartyRequestCount} external request(s).`,
    evidence: transferClause?.evidence
      ? [transferClause.evidence]
      : [
          `External third-party requests observed: ${technical.thirdPartyRequestCount}`,
          `Detected foreign-hosted trackers: ${
            trackers.map((t) => t.name).join(", ") || "None"
          }`,
        ],
    recommendation:
      "Disclose any cross-border transfer of personal data outside Nigeria and state the legal transfer basis under NDPA Sections 41–43.",
    legalReference: "NDPA 2023 Part VIII (ss. 41–43)",
  });

  const retentionClause = getClause("retention-period");
  const retentionScore =
    retentionClause?.status === "found"
      ? 5
      : retentionClause?.status === "partial"
      ? 3
      : 0;
  checks.push({
    id: "data-retention-schedule",
    pillar: "rights",
    title: "Data Retention Period & Storage Limitation",
    status:
      retentionScore === 5 ? "pass" : retentionScore > 0 ? "warning" : "fail",
    score: retentionScore,
    maxScore: 5,
    summary:
      retentionClause?.status === "found"
        ? "Policy defines data retention timelines or retention criteria."
        : retentionClause?.status === "partial"
        ? "Uses vague storage language without clear retention criteria."
        : "No data retention clause found in the privacy notice.",
    evidence: retentionClause?.evidence
      ? [retentionClause.evidence]
      : ["No retention period or deletion schedule found."],
    recommendation:
      "Specify concrete retention periods for each category of personal data or the criteria used to determine when data is deleted or anonymized.",
    legalReference: "NDPA 2023 ss. 24(1)(d), 27(1)(e)",
  });

  // =========================================================================
  // PILLAR 3: CONSENT, COOKIES & FORMS (Max 25 pts)
  // A real browser clicks the banner's buttons. Without one these checks are
  // marked "not tested" and leave the score instead of guessing.
  // =========================================================================
  const consent = technical.consentTest;
  const tested = Boolean(consent?.tested);
  const notTested = (id: string, title: string, legalReference: string): AuditCheck => ({
    id,
    pillar: "consent",
    title,
    status: "info",
    score: 0,
    maxScore: 0,
    summary: "Not tested. This needs a real browser, which wasn't available for this scan.",
    evidence: ["Scan engine: static page download (no browser)."],
    recommendation: "Run the scan where a browser is available (for example, locally with `pnpm dev`).",
    legalReference,
  });

  const trackersBefore = consent?.trackersBeforeConsent ?? trackers.map((t) => t.name);
  const needsBanner =
    trackersBefore.length > 0 ||
    technical.preConsentCookieCount > 0 ||
    (consent?.trackersAfterAccept.length ?? 0) > 0;

  // 3a. Is there a banner, on screen, with both choices?
  if (!tested || !consent) {
    checks.push(notTested("cookie-consent-banner", "Cookie Banner With Accept and Reject", "NDPA 2023 ss. 25(1)(a), 26; GAID 2025 Art. 19"));
  } else {
    let score = 7;
    let status: AuditCheck["status"] = "pass";
    let summary = "Cookie banner is visible on first load with both Accept and Reject options.";
    if (!consent.bannerVisible && consent.rejectTestFailed) {
      score = 0;
      status = "info";
      summary = consent.cmpDetected
        ? `A consent tool (${consent.cmpDetected}) is installed, but the site was too slow for us to see its banner. Try scanning again.`
        : "The site was too slow for us to check its cookie banner. Try scanning again.";
    } else if (!consent.bannerVisible) {
      if (!needsBanner) {
        summary = "No trackers or non-essential cookies found, so no cookie banner is needed.";
      } else if (consent.cmpDetected) {
        score = 1;
        status = "fail";
        summary = `A consent tool (${consent.cmpDetected}) is installed, but no banner appeared for a first-time visitor.`;
      } else {
        score = 0;
        status = "fail";
        summary = `No cookie banner appeared, yet ${trackersBefore.length} tracker(s) and ${technical.preConsentCookieCount} non-essential cookie(s) were found.`;
      }
    } else if (!consent.rejectFound && consent.rejectTestFailed) {
      score = 0;
      status = "info";
      summary = "A cookie banner appears, but the page was too slow for us to finish testing its buttons.";
    } else if (!consent.rejectFound) {
      score = 3;
      status = "warning";
      summary = "A cookie banner appears, but it has no Reject button on the first screen. GAID 2025 requires both Accept and Reject.";
    } else if (!consent.bannerAboveFold) {
      score = 5;
      status = "warning";
      summary = "The banner has a Reject option, but visitors have to scroll to see it. GAID 2025 requires it to be visible without scrolling.";
    } else if (consent.bannerBottomOnly) {
      score = 6;
      status = "warning";
      summary =
        "The banner has Accept and Reject, but it sits in a strip at the bottom of the screen. GAID 2025 Art. 7(l) says a bottom notice can be missed and expects it over the middle or side of the page.";
    }
    checks.push({
      id: "cookie-consent-banner",
      pillar: "consent",
      title: "Cookie Banner With Accept and Reject",
      status,
      score,
      maxScore: status === "info" ? 0 : 7,
      summary,
      evidence: [
        `Banner visible on first visit: ${consent.bannerVisible ? "Yes" : "No"}`,
        `Visible without scrolling: ${consent.bannerAboveFold ? "Yes" : "No"}`,
        `Placement: ${
          !consent.bannerAboveFold
            ? "Not on the first screen"
            : consent.bannerBottomOnly
            ? "Bottom strip only"
            : "Covers the middle or side of the screen"
        }`,
        `Reject button: ${consent.rejectFound ? `Yes ("${consent.rejectLabel}")` : "Not found"}`,
        `Accept button: ${consent.acceptFound ? `Yes ("${consent.acceptLabel}")` : "Not found"}`,
        `Consent tool in page source: ${consent.cmpDetected || "None recognised"}`,
      ],
      recommendation:
        "Show a banner on first visit, over the middle or side of the screen (not a bottom strip), with equally prominent Accept and Reject buttons. Load nothing non-essential until the visitor chooses.",
      legalReference: "NDPA 2023 ss. 25(1)(a), 26; GAID 2025 Arts. 7(l), 19",
    });
  }

  // 3b. Does anything track the visitor before they choose?
  {
    const cookieCount = technical.preConsentCookieCount;
    let score = 7;
    if (trackersBefore.length > 0 || cookieCount > 0) {
      if (!technical.bannerDetected) score = 0;
      else if (cookieCount > 2 || trackersBefore.length > 2) score = 1;
      else score = 3;
    }
    checks.push({
      id: "pre-consent-tracking",
      pillar: "consent",
      title: "No Tracking Before the Visitor Chooses",
      status: score === 7 ? "pass" : score >= 3 ? "warning" : "fail",
      score,
      maxScore: 7,
      summary:
        score === 7
          ? "No non-essential cookies or third-party trackers loaded before the visitor made a choice."
          : `${trackersBefore.length} tracker(s) and ${cookieCount} non-essential cookie(s) loaded before the visitor made any choice${
              pages && pages.length > 1 ? ` (across ${pages.length} pages)` : ""
            }.`,
      evidence: [
        `Trackers before any choice: ${trackersBefore.join(", ") || "None"}`,
        `Non-essential cookies before any choice: ${cookieCount} (total cookies: ${cookies.length})`,
        tested ? "Checked after waiting for the page to settle and scrolling to the bottom." : "Based on the page source only (no browser).",
      ],
      recommendation:
        "Hold back analytics, advertising and session-recording scripts until the visitor clicks Accept. Silence or a pre-ticked box is not consent.",
      legalReference: "NDPA 2023 s. 26(1)–(3); GAID 2025 Art. 19",
    });
  }

  // 3c. Does clicking Reject actually stop tracking?
  if (!tested || !consent) {
    checks.push(notTested("reject-respected", "Reject Actually Stops Tracking", "NDPA 2023 s. 26; GAID 2025 Art. 19"));
  } else if (!consent.rejectFound && consent.rejectTestFailed) {
    checks.push({
      ...notTested("reject-respected", "Reject Actually Stops Tracking", "NDPA 2023 s. 26; GAID 2025 Art. 19"),
      summary: "Not tested. The page was too slow for us to finish clicking the banner's buttons. Try scanning again.",
      evidence: consent.notes.length ? consent.notes : ["Button test did not finish."],
    });
  } else if (!consent.rejectFound) {
    checks.push({
      id: "reject-respected",
      pillar: "consent",
      title: "Reject Actually Stops Tracking",
      status: needsBanner ? "fail" : "pass",
      score: needsBanner ? 0 : 6,
      maxScore: 6,
      summary: needsBanner
        ? "Visitors have no way to refuse tracking: we found no Reject button."
        : "Nothing to refuse: no trackers or non-essential cookies were found.",
      evidence: [`Reject button: not found`, `Trackers seen: ${trackersBefore.join(", ") || "None"}`],
      recommendation: "Add a Reject button and make sure clicking it blocks every non-essential script and cookie.",
      legalReference: "NDPA 2023 s. 26; GAID 2025 Art. 19",
    });
  } else if (!consent.rejectClicked) {
    checks.push({
      ...notTested("reject-respected", "Reject Actually Stops Tracking", "NDPA 2023 s. 26; GAID 2025 Art. 19"),
      summary: `We found a "${consent.rejectLabel}" button but couldn't click it, so this wasn't tested.`,
      evidence: consent.notes.length ? consent.notes : ["Click failed."],
    });
  } else {
    const leaks = consent.trackersAfterReject.length + consent.cookiesAfterReject.length;
    checks.push({
      id: "reject-respected",
      pillar: "consent",
      title: "Reject Actually Stops Tracking",
      status: leaks === 0 ? "pass" : "fail",
      score: leaks === 0 ? 6 : 0,
      maxScore: 6,
      summary:
        leaks === 0
          ? `After clicking "${consent.rejectLabel}" and reloading, no trackers loaded and no new non-essential cookies were set.`
          : `After clicking "${consent.rejectLabel}", ${consent.trackersAfterReject.length} tracker(s) still loaded and ${consent.cookiesAfterReject.length} new non-essential cookie(s) were set. The Reject button doesn't work.`,
      evidence: [
        `Trackers after Reject: ${consent.trackersAfterReject.join(", ") || "None"}`,
        `New cookies after Reject: ${consent.cookiesAfterReject.join(", ") || "None"}`,
        `Trackers after Accept (for comparison): ${consent.trackersAfterAccept.join(", ") || "None"}`,
      ],
      recommendation:
        "Connect your consent tool to your tag manager so analytics and ad tags only fire after Accept. Test by clicking Reject and checking the browser's Network tab.",
      legalReference: "NDPA 2023 s. 26; GAID 2025 Art. 19",
    });
  }

  // 3d. Forms on every page we visited
  const sensitiveForms = forms.filter((f) => f.hasSensitiveFields);
  const preCheckedForms = forms.filter((f) => f.hasPreCheckedConsent);
  const unconsentedSensitiveForms = sensitiveForms.filter((f) => !f.hasConsentControl && !f.hasPrivacyLink);

  let formScore = 5;
  let formStatus: AuditCheck["status"] = "pass";
  let formSummary =
    sensitiveForms.length === 0
      ? "No unguarded personal data collection forms detected on the pages we visited."
      : `All ${sensitiveForms.length} personal data form(s) include consent controls or privacy disclosures.`;

  if (preCheckedForms.length > 0) {
    formScore = 0;
    formStatus = "fail";
    formSummary = `${preCheckedForms.length} form(s) contain pre-checked consent checkboxes, violating NDPA Section 26(7)(a).`;
  } else if (unconsentedSensitiveForms.length > 0) {
    formScore = 2;
    formStatus = "warning";
    formSummary = `${unconsentedSensitiveForms.length} of ${sensitiveForms.length} personal data form(s) collect user data without an explicit consent checkbox or adjacent privacy notice link.`;
  }

  checks.push({
    id: "form-consent-controls",
    pillar: "consent",
    title: "Form Data Collection Consent & Unchecked Opt-In",
    status: formStatus,
    score: formScore,
    maxScore: 5,
    summary: formSummary,
    evidence:
      forms.length > 0
        ? forms.map(
            (f, i) =>
              `Form #${i + 1}${f.pageUrl ? ` on ${f.pageUrl}` : ""} (${f.fields.slice(0, 4).join(", ")}): Consent=${
                f.hasConsentControl ? "Yes" : "No"
              }, Pre-checked=${f.hasPreCheckedConsent ? "Yes" : "No"}, Notice=${f.hasPrivacyLink ? "Yes" : "No"}`
          )
        : ["No HTML <form> elements with user input fields detected on the pages we visited."],
    recommendation:
      "Add an unchecked opt-in consent checkbox and a direct link to your Privacy Notice beneath every form collecting personal data.",
    legalReference: "NDPA 2023 ss. 26(1)–(3), 27(1)",
  });

  // =========================================================================
  // PILLAR 4: TECHNICAL & ORGANISATIONAL SECURITY (Max 25 pts)
  // =========================================================================
  const httpsScore = technical.https
    ? technical.mixedContentCount === 0
      ? 8
      : 4
    : 0;
  checks.push({
    id: "transport-encryption-https",
    pillar: "security",
    title: "HTTPS Transport Encryption & Mixed Content Integrity",
    status: httpsScore === 8 ? "pass" : httpsScore > 0 ? "warning" : "fail",
    score: httpsScore,
    maxScore: 8,
    summary:
      httpsScore === 8
        ? "Site enforces HTTPS encryption with zero mixed-content HTTP subresources."
        : technical.https
        ? `Site uses HTTPS but loads ${technical.mixedContentCount} insecure HTTP subresource(s).`
        : "Site is served over unencrypted HTTP, exposing personal data in transit.",
    evidence: [
      `Final URL protocol: ${technical.https ? "HTTPS" : "HTTP"}`,
      `Mixed content insecure resources: ${technical.mixedContentCount}`,
    ],
    recommendation:
      "Enforce TLS/HTTPS across all pages and upgrade all subresources (scripts, images, iframes) to HTTPS.",
    legalReference: "NDPA 2023 s. 39(1)",
  });

  const requiredHeaders = [
    { key: "strict-transport-security", label: "Strict-Transport-Security (HSTS)", points: 2 },
    { key: "content-security-policy", label: "Content-Security-Policy (CSP)", points: 2 },
    { key: "x-content-type-options", label: "X-Content-Type-Options", points: 1 },
    { key: "x-frame-options", label: "X-Frame-Options", points: 1 },
    { key: "referrer-policy", label: "Referrer-Policy", points: 1 },
    { key: "permissions-policy", label: "Permissions-Policy", points: 1 },
  ];

  let headerScore = 0;
  const headerEvidence: string[] = [];
  for (const h of requiredHeaders) {
    const val = technical.headers[h.key];
    if (val) {
      headerScore += h.points;
      headerEvidence.push(`Present: ${h.label} (${val.slice(0, 60)})`);
    } else {
      headerEvidence.push(`Missing: ${h.label}`);
    }
  }

  checks.push({
    id: "http-security-headers",
    pillar: "security",
    title: "HTTP Security & Anti-Exfiltration Headers",
    status:
      headerScore >= 6 ? "pass" : headerScore >= 3 ? "warning" : "fail",
    score: headerScore,
    maxScore: 8,
    summary: `${headerScore}/8 security header points achieved across HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy.`,
    evidence: headerEvidence,
    recommendation:
      "Configure HSTS, a strict Content-Security-Policy, Referrer-Policy (strict-origin-when-cross-origin), and X-Content-Type-Options (nosniff) to protect data integrity.",
    legalReference: "NDPA 2023 ss. 24(1)(f), 39(1)–(2)",
  });

  let cookieSecScore = 5;
  if (cookies.length > 0) {
    if (technical.insecureCookieCount === 0) {
      cookieSecScore = 5;
    } else if (technical.insecureCookieCount <= Math.ceil(cookies.length / 2)) {
      cookieSecScore = 2;
    } else {
      cookieSecScore = 0;
    }
  }

  checks.push({
    id: "cookie-security-flags",
    pillar: "security",
    title: "Cookie Hardening (Secure & SameSite Attributes)",
    status:
      cookieSecScore === 5 ? "pass" : cookieSecScore > 0 ? "warning" : "fail",
    score: cookieSecScore,
    maxScore: 5,
    summary:
      cookies.length === 0
        ? "No cookies set on initial load; zero insecure cookies exposed."
        : technical.insecureCookieCount === 0
        ? `All ${cookies.length} cookie(s) enforce the Secure flag.`
        : `${technical.insecureCookieCount} of ${cookies.length} cookie(s) lack the Secure flag or use unguarded SameSite=None.`,
    evidence:
      cookies.length > 0
        ? cookies
            .slice(0, 6)
            .map(
              (c) =>
                `${c.name} (${c.domain}): Secure=${c.secure}, HttpOnly=${c.httpOnly}, SameSite=${c.sameSite}`
            )
        : ["0 cookies set during scan."],
    recommendation:
      "Mark all session and tracking cookies with the `Secure` attribute, `HttpOnly` (where JS access isn't needed), and explicit `SameSite=Lax` or `Strict`.",
    legalReference: "NDPA 2023 s. 39(1)",
  });

  const thirdPartyScore =
    technical.thirdPartyRequestCount <= 5
      ? 4
      : technical.thirdPartyRequestCount <= 18
      ? 2
      : 0;
  checks.push({
    id: "third-party-surface-exposure",
    pillar: "security",
    title: "Third-Party Script & Data Processor Attack Surface",
    status:
      thirdPartyScore === 4 ? "pass" : thirdPartyScore > 0 ? "warning" : "fail",
    score: thirdPartyScore,
    maxScore: 4,
    summary: `Page initiated ${technical.thirdPartyRequestCount} third-party network request(s) and loaded ${trackers.length} known tracker(s).`,
    evidence: [
      `Third-party network requests: ${technical.thirdPartyRequestCount}`,
      `External tracker vendors: ${
        trackers.map((t) => t.domain).join(", ") || "None"
      }`,
    ],
    recommendation:
      "Minimize external third-party scripts, apply Subresource Integrity (SRI), and execute Data Processing Agreements (DPAs) with all external vendors under NDPA Section 29.",
    legalReference: "NDPA 2023 ss. 29, 39",
  });

  // If the policy page turned us away, the policy checks weren't really run.
  if (policy.blocked) {
    const policyChecks = new Set([
      "privacy-notice-availability",
      "dpo-controller-disclosure",
      "processing-purpose-lawful-basis",
      "nigeria-specific-policy",
      "data-subject-rights-notice",
      "ndpc-redress-notice",
      "cross-border-transfer-disclosure",
      "data-retention-schedule",
    ]);
    for (const c of checks) {
      if (!policyChecks.has(c.id)) continue;
      c.status = "info";
      c.score = 0;
      c.maxScore = 0;
      c.summary = `Not tested. Your privacy policy is linked (${policy.url}), but we couldn't read it. The page blocked our scanner, showed an error, or didn't load its text in time.`;
      c.evidence = [`Policy link: ${policy.url}`, "No readable policy text was found on that page."];
    }
  }

  const pillarDefinitions: Array<{
    id: PillarId;
    label: string;
    description: string;
    citation: string;
  }> = [
    {
      id: "transparency",
      label: "Transparency & Notice",
      description:
        "Clarity of privacy notices, DPO contact disclosure, lawful basis mapping, and third-party sharing transparency.",
      citation: "NDPA 2023 ss. 24, 25, 27, 32",
    },
    {
      id: "rights",
      label: "Data Subject Rights",
      description:
        "Coverage of access, correction, erasure, portability, NDPC complaint rights, cross-border safeguards, and retention.",
      citation: "NDPA 2023 ss. 34–38, 41–43, 46",
    },
    {
      id: "consent",
      label: "Consent & Trackers",
      description:
        "Affirmative opt-in for cookies and trackers, reject parity, and unbundled form consent controls.",
      citation: "NDPA 2023 ss. 25(1)(a), 26",
    },
    {
      id: "security",
      label: "Technical Security",
      description:
        "HTTPS transport security, anti-exfiltration HTTP headers, cookie security flags, and third-party exposure.",
      citation: "NDPA 2023 ss. 24(1)(f), 29, 39",
    },
  ];

  const pillars: PillarResult[] = pillarDefinitions.map((def) => {
    const pillarChecks = checks.filter((c) => c.pillar === def.id);
    const score = pillarChecks.reduce((sum, c) => sum + c.score, 0);
    const maxScore = pillarChecks.reduce((sum, c) => sum + c.maxScore, 0);
    const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      score,
      maxScore,
      percentage,
      citation: def.citation,
    };
  });

  const totalScore = pillars.reduce((sum, p) => sum + p.score, 0);
  const totalMax = pillars.reduce((sum, p) => sum + p.maxScore, 0);
  const overallScore =
    totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

  return { checks, pillars, overallScore };
}

function computeGradeAndRisk(score: number): {
  grade: ScanResult["grade"];
  riskLevel: ScanResult["riskLevel"];
} {
  if (score >= 85) return { grade: "A", riskLevel: "Low" };
  if (score >= 70) return { grade: "B", riskLevel: "Moderate" };
  if (score >= 55) return { grade: "C", riskLevel: "Moderate" };
  if (score >= 40) return { grade: "D", riskLevel: "High" };
  return { grade: "F", riskLevel: "Critical" };
}

export async function runWebsiteAudit(rawUrl: string, ai?: AISettings): Promise<ScanResult> {
  const startTime = Date.now();
  const requestedUrl = normalizeTargetUrl(rawUrl);
  await assertPublicUrl(requestedUrl);

  let browserCapture: BrowserCapture | null = null;
  let staticCapture: StaticCapture | null = null;
  try {
    browserCapture = await captureWithBrowser(requestedUrl);
  } catch (browserError) {
    // A blocked site, bad certificate or private address won't get better
    // with a plain download, so those stop the scan with a clear message.
    if (browserError instanceof ScanAbort) throw browserError;
    const reason = browserError instanceof Error ? browserError.message : "Headless browser unavailable.";
    staticCapture = await captureWithStaticFetch(requestedUrl, reason);
  }

  const finalUrl = browserCapture?.finalUrl ?? staticCapture!.finalUrl;
  const html = browserCapture?.html ?? staticCapture!.html;
  const headers = browserCapture?.headers ?? staticCapture!.headers;
  const cookies = browserCapture?.cookies ?? staticCapture!.cookies;
  const home = inspectDomContent(html, finalUrl, finalUrl);

  if (staticCapture && looksBlocked(home.pageTitle, html, staticCapture.status)) {
    throw new ScanAbort(
      "This website showed our scanner a bot-protection or error page instead of the real site, so we can't see what visitors see. No score was given. Try again later, or ask the site owner to allow the scanner.",
      422
    );
  }

  const allCandidateUrls = Array.from(
    new Set(browserCapture ? browserCapture.preConsentUrls : home.resourceUrls)
  );

  const siteRootDomain = getRootDomain(new URL(finalUrl).hostname);
  let thirdPartyRequestCount = 0;
  const isHttpsFinal = finalUrl.startsWith("https://");
  let mixedContentCount = home.mixedContentCount;
  const thirdPartyHosts = new Set<string>();

  for (const u of allCandidateUrls) {
    try {
      const parsed = new URL(u);
      if (!["http:", "https:"].includes(parsed.protocol)) continue;
      if (getRootDomain(parsed.hostname) !== siteRootDomain) {
        thirdPartyRequestCount += 1;
        thirdPartyHosts.add(parsed.hostname);
      }
      if (isHttpsFinal && parsed.protocol === "http:") mixedContentCount += 1;
    } catch {
      // ignore invalid URLs
    }
  }

  const trackers = detectTrackersFromUrls(allCandidateUrls);
  const preConsentCookieCount = cookies.filter((c) => isNonEssentialCookie(c.name)).length;
  const insecureCookieCount = cookies.filter(
    (c) => !c.secure || (c.sameSite.toLowerCase() === "none" && !c.secure)
  ).length;

  const consentTest = browserCapture?.consent;
  const technical: TechnicalEvidence = {
    https: isHttpsFinal,
    finalUrl,
    headers,
    mixedContentCount,
    preConsentCookieCount,
    insecureCookieCount,
    thirdPartyRequestCount,
    bannerDetected: consentTest ? consentTest.bannerVisible : home.bannerDetected,
    bannerHasReject: consentTest ? consentTest.rejectFound : home.bannerHasReject,
    consentTest,
  };

  // Privacy policy: rendered by the browser when we have one
  const policyPage = browserCapture
    ? browserCapture.policy
      ? {
          found: true,
          url: browserCapture.policy.url,
          html: browserCapture.policy.html,
          text: browserCapture.policy.text,
        }
      : { found: false, url: home.policyLink }
    : await fetchPrivacyPolicyPage(finalUrl, home.policyLink);

  // Runs alongside the policy review; a missing icon never fails the scan.
  const iconPromise = browserCapture?.siteIcon
    ? Promise.resolve(browserCapture.siteIcon)
    : fetchSiteIcon(html, finalUrl).catch(() => undefined);

  const policy = await analyzePrivacyPolicy({
    found: policyPage.found,
    url: policyPage.url,
    html: policyPage.html,
    text: "text" in policyPage ? policyPage.text : undefined,
    ai,
  });
  if (!policy.found && browserCapture?.policyBlocked) policy.blocked = true;

  const forms = browserCapture ? browserCapture.forms : home.forms;
  const pages = browserCapture?.pages;

  const { checks, pillars, overallScore } = buildChecksAndPillars({
    technical,
    policy,
    trackers,
    cookies,
    forms,
    pages,
  });

  const { grade, riskLevel } = computeGradeAndRisk(overallScore);
  const siteIcon = await iconPromise;

  // Plain-language list of what this scan could not see
  const limitations: string[] = [];
  if (!browserCapture) {
    limitations.push(
      "Limited scan: no browser was available, so we only downloaded the page. Trackers added by JavaScript are invisible this way, and the cookie banner's buttons weren't tested. The real picture is probably worse than this score."
    );
  }
  const visitedPages = (pages ?? []).filter((p) => !p.blocked);
  if (browserCapture && visitedPages.length <= 1) {
    limitations.push("Only the homepage could be checked. Sign-up, login and checkout pages weren't found or couldn't be opened.");
  }
  if (policy.blocked) {
    limitations.push("We couldn't read your privacy policy page, so the policy checks were skipped. Open it in a browser to confirm it works.");
  }
  const blockedPages = (pages ?? []).filter((p) => p.blocked);
  if (blockedPages.length > 0) {
    limitations.push(`${blockedPages.length} page(s) couldn't be opened or showed an error, so they weren't checked.`);
  }
  limitations.push(
    "We visited from outside Nigeria. Some sites show a different cookie banner depending on the visitor's country.",
    "Pages behind a login, and internal records (data inventory, contracts, risk assessments, breach logs), can't be seen from outside. The organisation questions cover those."
  );

  return {
    id: `ndpa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    requestedUrl,
    finalUrl,
    siteIcon,
    scannedAt: new Date().toISOString(),
    score: overallScore,
    grade,
    riskLevel,
    pillars,
    checks,
    policy,
    trackers,
    cookies,
    forms,
    technical,
    pages,
    evidence: browserCapture
      ? {
          screenshots: browserCapture.screenshots,
          networkLog: browserCapture.networkLog,
          networkLogTruncated: browserCapture.networkLogTruncated,
        }
      : undefined,
    metadata: {
      pageTitle: home.pageTitle,
      engine: browserCapture ? "browser" : "static",
      browserChannel: browserCapture?.browserChannel,
      fallbackReason: staticCapture?.fallbackReason,
      durationMs: Date.now() - startTime,
      limitations,
    },
  };
}
