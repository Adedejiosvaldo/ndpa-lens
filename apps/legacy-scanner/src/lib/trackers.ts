import type { DetectedTracker } from "@/types/audit";

interface TrackerSignature {
  name: string;
  category: string;
  patterns: RegExp[];
  defaultDomain: string;
}

export const TRACKER_SIGNATURES: TrackerSignature[] = [
  {
    name: "Google Analytics (GA4 / UA)",
    category: "Analytics",
    patterns: [/google-analytics\.com/i, /googletagmanager\.com\/gtag/i],
    defaultDomain: "google-analytics.com",
  },
  {
    name: "Google Tag Manager",
    category: "Tag Manager",
    patterns: [/googletagmanager\.com\/gtm\.js/i],
    defaultDomain: "googletagmanager.com",
  },
  {
    name: "Meta Pixel (Facebook)",
    category: "Advertising",
    patterns: [/connect\.facebook\.net/i, /facebook\.com\/tr/i],
    defaultDomain: "connect.facebook.net",
  },
  {
    name: "Google Ads / DoubleClick",
    category: "Advertising",
    patterns: [/doubleclick\.net/i, /googleadservices\.com/i, /googlesyndication\.com/i],
    defaultDomain: "doubleclick.net",
  },
  {
    name: "Hotjar Session Recording",
    category: "Behavioral Heatmap",
    patterns: [/static\.hotjar\.com/i, /script\.hotjar\.com/i],
    defaultDomain: "hotjar.com",
  },
  {
    name: "Microsoft Clarity",
    category: "Behavioral Heatmap",
    patterns: [/clarity\.ms/i],
    defaultDomain: "clarity.ms",
  },
  {
    name: "Mixpanel",
    category: "Product Analytics",
    patterns: [/cdn\.mxpnl\.com/i, /api\.mixpanel\.com/i],
    defaultDomain: "mixpanel.com",
  },
  {
    name: "Segment Analytics",
    category: "Customer Data Platform",
    patterns: [/cdn\.segment\.com/i, /api\.segment\.io/i],
    defaultDomain: "segment.com",
  },
  {
    name: "PostHog",
    category: "Product Analytics",
    patterns: [/posthog\.com/i],
    defaultDomain: "posthog.com",
  },
  {
    name: "TikTok Pixel",
    category: "Advertising",
    patterns: [/analytics\.tiktok\.com/i],
    defaultDomain: "analytics.tiktok.com",
  },
  {
    name: "LinkedIn Insight Tag",
    category: "Advertising",
    patterns: [/snap\.licdn\.com/i, /px\.ads\.linkedin\.com/i],
    defaultDomain: "snap.licdn.com",
  },
  {
    name: "X (Twitter) Pixel",
    category: "Advertising",
    patterns: [/static\.ads-twitter\.com/i, /analytics\.twitter\.com/i],
    defaultDomain: "ads-twitter.com",
  },
  {
    name: "Intercom Messenger",
    category: "Customer Messaging",
    patterns: [/widget\.intercom\.io/i, /js\.intercomcdn\.com/i],
    defaultDomain: "intercom.io",
  },
  {
    name: "Crisp Chat",
    category: "Customer Messaging",
    patterns: [/client\.crisp\.chat/i],
    defaultDomain: "crisp.chat",
  },
  {
    name: "HubSpot Tracking",
    category: "Marketing Automation",
    patterns: [/js\.hs-scripts\.com/i, /js\.hs-analytics\.net/i],
    defaultDomain: "hs-scripts.com",
  },
  {
    name: "YouTube embed (Google tracking)",
    category: "Advertising",
    patterns: [/youtube\.com\/(embed|iframe_api|s\/player)/i, /youtube\.com\/youtubei\//i, /ytimg\.com\/.*\/www-embed-player/i],
    defaultDomain: "youtube.com",
  },
  {
    name: "Sentry Telemetry",
    category: "Error & Diagnostics",
    patterns: [/browser\.sentry-cdn\.com/i, /ingest\.sentry\.io/i],
    defaultDomain: "sentry.io",
  },
];

const ESSENTIAL_COOKIE_PATTERNS = [
  /^(__Host-|__Secure-)?(csrf|xsrf|session|sess|sid|auth|next-auth|phpsessid|jsessionid|cf_bm|__cf|awsalb)/i,
  // Session and anti-forgery cookies, wherever the keyword sits in the name
  /(csrf|xsrf|sessid|session_?id|_session$|^asp\.net_sessionid$)/i,
  // Bot protection and load balancing (Cloudflare, Imperva, Akamai, AWS, F5)
  /^(cf_clearance|__cfruid|_cfuvid|visid_incap_|incap_ses_|nlbi_|ak_bmsc|bm_sz|bm_sv|_abck|awsalbcors|ts01)/i,
  // Stores the visitor's consent choice, or a login hand-off in progress
  /consent|^_interaction|^redirect_uri$|\.sig$/i,
  // Remembered language or currency
  /^(user_?language|lang|language|locale|currency)$/i,
  // Cookies that store the visitor's consent choice itself.
  /^(cookie[-_]?consent|cc_cookie|CookieConsent|OptanonConsent|OptanonAlertBoxClosed|euconsent|cookieyes|_iub_cs|didomi_token|uc_|usercentrics|cmplz_|borlabs|CookieScriptConsent|cookiehub|klaro|__cmpcc)/i,
];

/** Consent-management tools we recognise in page source. */
export const CMP_SIGNATURES: Array<{ name: string; pattern: RegExp }> = [
  { name: "OneTrust", pattern: /onetrust|optanon/i },
  { name: "Cookiebot", pattern: /cookiebot/i },
  { name: "CookieYes", pattern: /cookieyes|cookie-law-info/i },
  { name: "Osano", pattern: /osano\.com/i },
  { name: "Termly", pattern: /termly\.io/i },
  { name: "iubenda", pattern: /iubenda/i },
  { name: "Usercentrics", pattern: /usercentrics/i },
  { name: "Didomi", pattern: /didomi/i },
  { name: "Complianz", pattern: /complianz|cmplz/i },
  { name: "CookieHub", pattern: /cookiehub/i },
  { name: "Klaro", pattern: /klaro/i },
  { name: "Quantcast Choice", pattern: /quantcast\.mgr|quantcast-choice/i },
];

export function detectCmp(html: string): string | undefined {
  return CMP_SIGNATURES.find((c) => c.pattern.test(html))?.name;
}

/**
 * Google Consent Mode sends cookieless pings even after Reject, marked
 * gcs=G100 (ads and analytics denied). Reported separately, not as tracking.
 */
export function isConsentModeDeniedPing(url: string): boolean {
  // gcs=G1<ads><analytics>; G100 means both ad and analytics storage were denied.
  return (
    /(google-analytics\.com|googletagmanager\.com|doubleclick\.net|google\.com\/(ccm|pagead))/i.test(url) &&
    /[?&]gcs=G100(&|$)/.test(url)
  );
}

export function isNonEssentialCookie(name: string): boolean {
  return !ESSENTIAL_COOKIE_PATTERNS.some((re) => re.test(name));
}

export function getRootDomain(hostname: string): string {
  const parts = hostname.toLowerCase().replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const secondLevelTlds = new Set(["com", "org", "gov", "edu", "net", "co"]);
  if (
    parts.length >= 3 &&
    parts[parts.length - 1].length === 2 &&
    secondLevelTlds.has(parts[parts.length - 2])
  ) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

export function detectTrackersFromUrls(urls: string[]): DetectedTracker[] {
  const found = new Map<string, DetectedTracker>();

  for (const raw of urls) {
    for (const sig of TRACKER_SIGNATURES) {
      if (sig.patterns.some((pattern) => pattern.test(raw))) {
        let domain = sig.defaultDomain;
        try {
          domain = new URL(raw).hostname.replace(/^www\./, "");
        } catch {
          // keep default domain
        }
        if (!found.has(sig.name)) {
          found.set(sig.name, {
            name: sig.name,
            category: sig.category,
            domain,
          });
        }
      }
    }
  }

  return Array.from(found.values());
}

