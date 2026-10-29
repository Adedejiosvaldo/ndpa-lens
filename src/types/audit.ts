export type PillarId = "transparency" | "rights" | "consent" | "security";
export type CheckStatus = "pass" | "warning" | "fail" | "info";
export type ClauseStatus = "found" | "partial" | "missing" | "unavailable";
export type ScanEngine = "browser" | "static";
export type AIProvider = "openai" | "gemini" | "anthropic";

export interface PillarResult {
  id: PillarId;
  label: string;
  description: string;
  score: number;
  maxScore: number;
  percentage: number;
  citation: string;
}

export interface AuditCheck {
  id: string;
  pillar: PillarId;
  title: string;
  status: CheckStatus;
  score: number;
  maxScore: number;
  summary: string;
  evidence: string[];
  recommendation: string;
  legalReference: string;
}

export interface PolicyClause {
  id: string;
  title: string;
  status: ClauseStatus;
  description: string;
  legalReference: string;
  evidence?: string;
  aiNote?: string;
}

export interface PolicyAnalysis {
  found: boolean;
  url?: string;
  title?: string;
  contentLength: number;
  /** A policy link exists but bot protection or an error stopped us reading it. */
  blocked?: boolean;
  /** "Last updated" date as written in the policy, if we could find one. */
  lastUpdated?: string;
  clauses: PolicyClause[];
  source: "rules" | "rules+ai";
  aiSummary?: string;
  aiError?: string;
}

export interface DetectedTracker {
  name: string;
  category: string;
  domain: string;
}

export interface CookieFinding {
  name: string;
  domain: string;
  secure: boolean;
  httpOnly: boolean;
  sameSite: string;
  session: boolean;
}

export interface FormFinding {
  /** Page the form was found on. */
  pageUrl?: string;
  action: string;
  fields: string[];
  hasSensitiveFields: boolean;
  hasConsentControl: boolean;
  hasPreCheckedConsent: boolean;
  hasPrivacyLink: boolean;
}

export interface TechnicalEvidence {
  https: boolean;
  finalUrl: string;
  headers: Record<string, string>;
  mixedContentCount: number;
  preConsentCookieCount: number;
  insecureCookieCount: number;
  thirdPartyRequestCount: number;
  bannerDetected: boolean;
  bannerHasReject: boolean;
  /** Behavioural cookie test. Only present when a real browser ran. */
  consentTest?: ConsentTest;
}

/**
 * What happened when we actually used the cookie banner: before choosing,
 * after clicking Reject (and reloading), and after clicking Accept.
 */
export interface ConsentTest {
  tested: boolean;
  bannerVisible: boolean;
  /** Banner is on screen without scrolling (GAID 2025 Art. 19). */
  bannerAboveFold: boolean;
  rejectFound: boolean;
  /** The Reject test itself couldn't run (slow page, crash). */
  rejectTestFailed?: boolean;
  acceptFound: boolean;
  rejectLabel?: string;
  acceptLabel?: string;
  rejectClicked: boolean;
  acceptClicked: boolean;
  trackersBeforeConsent: string[];
  trackersAfterReject: string[];
  cookiesAfterReject: string[];
  trackersAfterAccept: string[];
  /** Consent tool script seen in the page source, if any. */
  cmpDetected?: string;
  notes: string[];
}

export type PageKind =
  | "home"
  | "signup"
  | "login"
  | "checkout"
  | "contact"
  | "policy"
  | "other";

export interface PageScan {
  url: string;
  kind: PageKind;
  title: string;
  status?: number;
  /** Bot protection or an error page was served instead of the real page. */
  blocked?: boolean;
  bannerVisible: boolean;
  policyLinked: boolean;
  formCount: number;
  trackers: string[];
}

export interface EvidenceScreenshot {
  label: string;
  url: string;
  capturedAt: string;
  /** JPEG data URL. */
  dataUrl: string;
}

export interface NetworkLogEntry {
  /** before-consent | after-reject | after-accept */
  phase: string;
  pageUrl: string;
  url: string;
  type: string;
  at: string;
}

export interface ScanEvidence {
  screenshots: EvidenceScreenshot[];
  networkLog: NetworkLogEntry[];
  networkLogTruncated?: boolean;
}

export interface ScanMetadata {
  pageTitle: string;
  engine: ScanEngine;
  browserChannel?: string;
  fallbackReason?: string;
  durationMs: number;
  /** Plain-language list of what this scan could not check. */
  limitations?: string[];
}

export interface ScanResult {
  id: string;
  requestedUrl: string;
  finalUrl: string;
  scannedAt: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  riskLevel: "Low" | "Moderate" | "High" | "Critical";
  pillars: PillarResult[];
  checks: AuditCheck[];
  policy: PolicyAnalysis;
  trackers: DetectedTracker[];
  cookies: CookieFinding[];
  forms: FormFinding[];
  technical: TechnicalEvidence;
  metadata: ScanMetadata;
  /** Every page visited, homepage first. */
  pages?: PageScan[];
  evidence?: ScanEvidence;
}

export interface AISettings {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
}

export interface ScanRequest {
  url: string;
  ai?: AISettings;
}

export interface RemediationProfile {
  organisation: string;
  email: string;
  country: string;
  retention: string;
}
