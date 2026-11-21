/**
 * NDPA Lens vendor list (PRD §5.3, FLOW-02). Curated in-house from public
 * facts (which company serves which hostname, what the service does, where
 * the company is headquartered). Not derived from DuckDuckGo Tracker Radar
 * (CC BY-NC-SA, no commercial use) or Disconnect (GPL-3.0).
 *
 * Bump VENDOR_LIST_VERSION whenever an entry changes: findings record the
 * version they were produced with (§5.4).
 */
export const VENDOR_LIST_VERSION = "2026-11-21.1";

export type VendorCategory =
  | "strictly_necessary"
  | "functional"
  | "consent_management"
  | "analytics"
  | "advertising"
  | "session_replay"
  | "social"
  | "cdn"
  | "payments"
  | "support";

export interface Vendor {
  id: string;
  name: string;
  /** Registrable domains or exact hosts; a request host matches itself or any subdomain. */
  hostnames: string[];
  category: VendorCategory;
  /** ISO 3166-1 alpha-2 country of the company's headquarters. */
  hqCountry: string;
}

export const VENDORS: Vendor[] = [
  // Analytics
  { id: "google-analytics", name: "Google Analytics", hostnames: ["google-analytics.com", "analytics.google.com", "region1.google-analytics.com"], category: "analytics", hqCountry: "US" },
  { id: "google-tag-manager", name: "Google Tag Manager", hostnames: ["googletagmanager.com"], category: "analytics", hqCountry: "US" },
  { id: "adobe-analytics", name: "Adobe Analytics", hostnames: ["omtrdc.net", "2o7.net", "demdex.net", "adobedtm.com"], category: "analytics", hqCountry: "US" },
  { id: "mixpanel", name: "Mixpanel", hostnames: ["mixpanel.com", "mxpnl.com"], category: "analytics", hqCountry: "US" },
  { id: "amplitude", name: "Amplitude", hostnames: ["amplitude.com"], category: "analytics", hqCountry: "US" },
  { id: "segment", name: "Segment", hostnames: ["segment.com", "segment.io"], category: "analytics", hqCountry: "US" },
  { id: "heap", name: "Heap", hostnames: ["heapanalytics.com", "heap-api.com"], category: "analytics", hqCountry: "US" },
  { id: "matomo-cloud", name: "Matomo Cloud", hostnames: ["matomo.cloud"], category: "analytics", hqCountry: "NZ" },
  { id: "plausible", name: "Plausible Analytics", hostnames: ["plausible.io"], category: "analytics", hqCountry: "EE" },
  { id: "yandex-metrica", name: "Yandex Metrica", hostnames: ["mc.yandex.ru", "mc.yandex.com"], category: "analytics", hqCountry: "RU" },
  { id: "new-relic", name: "New Relic Browser", hostnames: ["nr-data.net", "newrelic.com"], category: "analytics", hqCountry: "US" },
  { id: "firebase", name: "Firebase (Google)", hostnames: ["firebaseinstallations.googleapis.com", "firebaselogging-pa.googleapis.com", "app-measurement.com"], category: "analytics", hqCountry: "US" },

  // Session replay and heatmaps (C-17)
  { id: "hotjar", name: "Hotjar", hostnames: ["hotjar.com", "hotjar.io"], category: "session_replay", hqCountry: "MT" },
  { id: "microsoft-clarity", name: "Microsoft Clarity", hostnames: ["clarity.ms"], category: "session_replay", hqCountry: "US" },
  { id: "fullstory", name: "FullStory", hostnames: ["fullstory.com"], category: "session_replay", hqCountry: "US" },
  { id: "logrocket", name: "LogRocket", hostnames: ["logrocket.io", "lr-ingest.io", "lr-in.com"], category: "session_replay", hqCountry: "US" },
  { id: "mouseflow", name: "Mouseflow", hostnames: ["mouseflow.com"], category: "session_replay", hqCountry: "DK" },
  { id: "smartlook", name: "Smartlook", hostnames: ["smartlook.com", "smartlook.cloud"], category: "session_replay", hqCountry: "CZ" },
  { id: "crazy-egg", name: "Crazy Egg", hostnames: ["crazyegg.com"], category: "session_replay", hqCountry: "US" },
  { id: "inspectlet", name: "Inspectlet", hostnames: ["inspectlet.com"], category: "session_replay", hqCountry: "US" },
  { id: "posthog", name: "PostHog", hostnames: ["posthog.com", "i.posthog.com"], category: "session_replay", hqCountry: "US" },

  // Advertising and pixels (C-01, C-20)
  { id: "meta-pixel", name: "Meta Pixel", hostnames: ["connect.facebook.net", "facebook.com", "facebook.net"], category: "advertising", hqCountry: "US" },
  { id: "google-ads", name: "Google Ads and DoubleClick", hostnames: ["doubleclick.net", "googleadservices.com", "googlesyndication.com", "adservice.google.com"], category: "advertising", hqCountry: "US" },
  { id: "tiktok-pixel", name: "TikTok Pixel", hostnames: ["analytics.tiktok.com", "tiktok.com", "tiktokw.us"], category: "advertising", hqCountry: "SG" },
  { id: "snap-pixel", name: "Snap Pixel", hostnames: ["sc-static.net", "tr.snapchat.com"], category: "advertising", hqCountry: "US" },
  { id: "x-ads", name: "X (Twitter) Ads", hostnames: ["static.ads-twitter.com", "ads-twitter.com", "analytics.twitter.com", "t.co"], category: "advertising", hqCountry: "US" },
  { id: "linkedin-insight", name: "LinkedIn Insight Tag", hostnames: ["snap.licdn.com", "px.ads.linkedin.com"], category: "advertising", hqCountry: "US" },
  { id: "pinterest-tag", name: "Pinterest Tag", hostnames: ["ct.pinterest.com", "s.pinimg.com"], category: "advertising", hqCountry: "US" },
  { id: "microsoft-ads", name: "Microsoft Advertising (UET)", hostnames: ["bat.bing.com"], category: "advertising", hqCountry: "US" },
  { id: "criteo", name: "Criteo", hostnames: ["criteo.com", "criteo.net"], category: "advertising", hqCountry: "FR" },
  { id: "taboola", name: "Taboola", hostnames: ["taboola.com"], category: "advertising", hqCountry: "US" },
  { id: "outbrain", name: "Outbrain", hostnames: ["outbrain.com"], category: "advertising", hqCountry: "US" },
  { id: "hubspot", name: "HubSpot tracking", hostnames: ["hs-scripts.com", "hs-analytics.net", "hubspot.com", "hsforms.com", "hscollectedforms.net"], category: "advertising", hqCountry: "US" },
  { id: "quantcast", name: "Quantcast", hostnames: ["quantserve.com", "quantcount.com"], category: "advertising", hqCountry: "US" },
  { id: "adroll", name: "AdRoll", hostnames: ["adroll.com"], category: "advertising", hqCountry: "US" },

  // Social widgets and embeds
  { id: "youtube", name: "YouTube embeds", hostnames: ["youtube.com", "youtube-nocookie.com", "ytimg.com"], category: "social", hqCountry: "US" },
  { id: "instagram", name: "Instagram embeds", hostnames: ["instagram.com", "cdninstagram.com"], category: "social", hqCountry: "US" },
  { id: "x-widgets", name: "X (Twitter) widgets", hostnames: ["platform.twitter.com", "syndication.twitter.com"], category: "social", hqCountry: "US" },
  { id: "addthis", name: "AddThis", hostnames: ["addthis.com"], category: "social", hqCountry: "US" },
  { id: "sharethis", name: "ShareThis", hostnames: ["sharethis.com"], category: "social", hqCountry: "US" },

  // Consent management
  { id: "onetrust", name: "OneTrust", hostnames: ["cookielaw.org", "onetrust.com"], category: "consent_management", hqCountry: "US" },
  { id: "cookiebot", name: "Cookiebot", hostnames: ["cookiebot.com"], category: "consent_management", hqCountry: "DE" },
  { id: "cookieyes", name: "CookieYes", hostnames: ["cookieyes.com"], category: "consent_management", hqCountry: "GB" },
  { id: "termly", name: "Termly", hostnames: ["termly.io"], category: "consent_management", hqCountry: "US" },
  { id: "osano", name: "Osano", hostnames: ["osano.com"], category: "consent_management", hqCountry: "US" },
  { id: "cookiehub", name: "CookieHub", hostnames: ["cookiehub.net", "cookiehub.eu"], category: "consent_management", hqCountry: "IS" },
  { id: "usercentrics", name: "Usercentrics", hostnames: ["usercentrics.eu"], category: "consent_management", hqCountry: "DE" },

  // Support and chat
  { id: "intercom", name: "Intercom", hostnames: ["intercom.io", "intercomcdn.com"], category: "support", hqCountry: "US" },
  { id: "zendesk", name: "Zendesk", hostnames: ["zendesk.com", "zdassets.com"], category: "support", hqCountry: "US" },
  { id: "tawk", name: "tawk.to", hostnames: ["tawk.to"], category: "support", hqCountry: "GB" },
  { id: "freshchat", name: "Freshworks", hostnames: ["freshchat.com", "freshworks.com", "freshdesk.com"], category: "support", hqCountry: "US" },
  { id: "whatsapp", name: "WhatsApp click-to-chat", hostnames: ["wa.me", "whatsapp.com"], category: "support", hqCountry: "US" },
  { id: "crisp", name: "Crisp", hostnames: ["crisp.chat"], category: "support", hqCountry: "FR" },

  // Payments (Nigerian vendors curated by hand, PRD §5.3)
  { id: "paystack", name: "Paystack", hostnames: ["paystack.co", "paystack.com"], category: "payments", hqCountry: "NG" },
  { id: "flutterwave", name: "Flutterwave", hostnames: ["flutterwave.com", "ravepay.co"], category: "payments", hqCountry: "US" },
  { id: "interswitch", name: "Interswitch", hostnames: ["interswitchng.com", "interswitchgroup.com"], category: "payments", hqCountry: "NG" },
  { id: "remita", name: "Remita (SystemSpecs)", hostnames: ["remita.net"], category: "payments", hqCountry: "NG" },
  { id: "monnify", name: "Monnify (Moniepoint)", hostnames: ["monnify.com"], category: "payments", hqCountry: "NG" },
  { id: "opay", name: "OPay", hostnames: ["opayweb.com", "opaycheckout.com"], category: "payments", hqCountry: "NG" },
  { id: "stripe", name: "Stripe", hostnames: ["stripe.com", "stripe.network", "js.stripe.com"], category: "payments", hqCountry: "US" },
  { id: "paypal", name: "PayPal", hostnames: ["paypal.com", "paypalobjects.com"], category: "payments", hqCountry: "US" },

  // Nigerian infrastructure and messaging
  { id: "termii", name: "Termii", hostnames: ["termii.com"], category: "functional", hqCountry: "NG" },
  { id: "smile-id", name: "Smile ID", hostnames: ["smileidentity.com", "usesmileid.com"], category: "functional", hqCountry: "US" },
  { id: "mono", name: "Mono", hostnames: ["withmono.com"], category: "functional", hqCountry: "NG" },
  { id: "okra", name: "Okra", hostnames: ["okra.ng"], category: "functional", hqCountry: "NG" },

  // CDN, fonts, security
  { id: "cloudflare", name: "Cloudflare", hostnames: ["cloudflare.com", "cdnjs.cloudflare.com", "cloudflareinsights.com", "challenges.cloudflare.com"], category: "cdn", hqCountry: "US" },
  { id: "jsdelivr", name: "jsDelivr", hostnames: ["jsdelivr.net"], category: "cdn", hqCountry: "PL" },
  { id: "unpkg", name: "unpkg", hostnames: ["unpkg.com"], category: "cdn", hqCountry: "US" },
  { id: "google-fonts", name: "Google Fonts", hostnames: ["fonts.googleapis.com", "fonts.gstatic.com"], category: "cdn", hqCountry: "US" },
  { id: "google-apis", name: "Google APIs and static content", hostnames: ["ajax.googleapis.com", "gstatic.com", "googleapis.com"], category: "cdn", hqCountry: "US" },
  { id: "fontawesome", name: "Font Awesome", hostnames: ["fontawesome.com", "use.fontawesome.com"], category: "cdn", hqCountry: "US" },
  { id: "akamai", name: "Akamai", hostnames: ["akamaihd.net", "akamaized.net", "akamai.net"], category: "cdn", hqCountry: "US" },
  { id: "cloudfront", name: "Amazon CloudFront", hostnames: ["cloudfront.net"], category: "cdn", hqCountry: "US" },
  { id: "fastly", name: "Fastly", hostnames: ["fastly.net"], category: "cdn", hqCountry: "US" },
  { id: "recaptcha", name: "Google reCAPTCHA", hostnames: ["recaptcha.net"], category: "strictly_necessary", hqCountry: "US" },
  { id: "hcaptcha", name: "hCaptcha", hostnames: ["hcaptcha.com"], category: "strictly_necessary", hqCountry: "US" },
];

/** Categories that need consent before loading (PRD §5.2 C-01, C-06, C-17, C-20). */
export const NON_ESSENTIAL: ReadonlySet<VendorCategory> = new Set(["analytics", "advertising", "session_replay", "social"]);
