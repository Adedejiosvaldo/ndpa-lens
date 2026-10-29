import * as cheerio from "cheerio";
import type { FormFinding, PageKind } from "@/types/audit";
import { getRootDomain } from "@/lib/trackers";

/** Words on a button that mean "say no" to non-essential cookies. */
export const REJECT_RE =
  /\b(reject|decline|refuse|deny|disagree)\b|\b(necessary|essential|required)\s+(cookies\s+)?only\b|\bonly\s+(necessary|essential|required)\b|continue\s+without\s+(accepting|agreeing)/i;
/** Words on a button that mean "yes" to cookies. */
export const ACCEPT_RE = /\b(accept|allow|agree)\b|^\s*(ok|okay|got it|i understand)\s*[.!]?\s*$/i;
/** Buttons that open settings rather than make a choice. */
export const SETTINGS_RE = /settings|preferences|manage|customi[sz]e|options|more info|learn more/i;

export interface DomInspection {
  pageTitle: string;
  forms: FormFinding[];
  bannerDetected: boolean;
  bannerHasReject: boolean;
  policyLink?: string;
  resourceUrls: string[];
  mixedContentCount: number;
  links: Array<{ href: string; text: string }>;
}

/** Reads a page's HTML. Used for every page in a browser scan and on its own in a static scan. */
export function inspectDomContent(html: string, baseUrl: string, pageUrl?: string): DomInspection {
  const $ = cheerio.load(html);
  const pageTitle =
    $("title").first().text().trim() || $("h1").first().text().trim() || new URL(baseUrl).hostname;

  const isHttpsPage = baseUrl.startsWith("https://");
  const resourceUrls: string[] = [];
  let mixedContentCount = 0;

  $("script[src], iframe[src], img[src], link[href]").each((_, el) => {
    const rawAttr = $(el).attr("src") || $(el).attr("href");
    if (!rawAttr) return;
    try {
      const resolved = new URL(rawAttr, baseUrl).toString();
      resourceUrls.push(resolved);
      if (isHttpsPage && resolved.startsWith("http://")) mixedContentCount += 1;
    } catch {
      // ignore malformed URLs
    }
  });

  // Links, and the most likely privacy policy among them
  const links: Array<{ href: string; text: string }> = [];
  const policyCandidates: { url: string; weight: number }[] = [];

  $("a[href]").each((_, el) => {
    const href = ($(el).attr("href") || "").trim();
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (!href || href.startsWith("#") || /^(javascript|mailto|tel):/i.test(href)) return;

    let resolved: string;
    try {
      resolved = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    links.push({ href: resolved, text });

    // Vendor policies (Cloudflare, Google, consent tools) are not the site's own.
    if (/(^|\.)(cloudflare\.com|google\.com|onetrust\.com|cookielaw\.org|cookiebot\.com|policies\.google\.com|hcaptcha\.com|recaptcha\.net)$/i.test(new URL(resolved).hostname)) {
      return;
    }

    const lowerText = text.toLowerCase();
    const hrefLower = resolved.toLowerCase();
    if (
      lowerText.includes("privacy policy") ||
      lowerText.includes("privacy notice") ||
      lowerText.includes("privacy statement") ||
      lowerText.includes("data protection policy") ||
      lowerText === "privacy"
    ) {
      policyCandidates.push({ url: resolved, weight: 10 });
    } else if (
      hrefLower.includes("privacy-policy") ||
      hrefLower.includes("privacypolicy") ||
      hrefLower.includes("/privacy") ||
      hrefLower.includes("data-protection")
    ) {
      policyCandidates.push({ url: resolved, weight: 6 });
    }
  });
  policyCandidates.sort((a, b) => b.weight - a.weight);
  const policyLink = policyCandidates[0]?.url;

  // Cookie banner in the HTML. Only used when no real browser is available;
  // a browser scan checks what is actually visible on screen instead.
  let bannerDetected = false;
  let bannerHasReject = false;
  $(
    "[id*='cookie' i], [class*='cookie' i], [id*='consent' i], [class*='consent' i], [aria-label*='cookie' i], [aria-label*='consent' i]"
  ).each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    if (text.length > 25 && text.length < 4000 && /(cookie|consent|tracking)/i.test(text)) {
      bannerDetected = true;
      if (REJECT_RE.test(text)) bannerHasReject = true;
    }
  });

  // Forms
  const forms: FormFinding[] = [];
  const sensitiveFieldRegex =
    /(email|phone|tel|mobile|name|fullname|first_name|last_name|bvn|nin|passport|address|dob|birth|card|cvv|account|password|ssn|national_id)/i;

  $("form").each((idx, formEl) => {
    const $form = $(formEl);
    const fields: string[] = [];
    let hasSensitiveFields = false;
    let hasConsentControl = false;
    let hasPreCheckedConsent = false;

    $form.find("input, select, textarea").each((_, inputEl) => {
      const $input = $(inputEl);
      const type = ($input.attr("type") || "text").toLowerCase();
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) return;

      const name =
        $input.attr("name") ||
        $input.attr("id") ||
        $input.attr("placeholder") ||
        $input.attr("aria-label") ||
        type;
      const cleanName = name.trim().slice(0, 40);

      if (type === "checkbox" || type === "radio") {
        const labelText = (
          $input.closest("label").text() ||
          $form.find(`label[for="${$input.attr("id") || ""}"]`).text() ||
          $input.parent().text() ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim();

        if (/(agree|consent|privacy|terms|policy|marketing|newsletter|opt|data)/i.test(`${cleanName} ${labelText}`)) {
          hasConsentControl = true;
          if ($input.attr("checked") !== undefined) hasPreCheckedConsent = true;
        }
      } else {
        fields.push(cleanName);
        if (sensitiveFieldRegex.test(cleanName) || ["email", "tel", "password"].includes(type)) {
          hasSensitiveFields = true;
        }
      }
    });

    if (fields.length === 0) return;

    const formText = $form.text().toLowerCase();
    const hasPrivacyLink =
      $form
        .find("a[href]")
        .toArray()
        .some((a) => {
          const href = ($(a).attr("href") || "").toLowerCase();
          const txt = $(a).text().toLowerCase();
          return href.includes("privacy") || txt.includes("privacy") || txt.includes("data protection");
        }) || /(privacy policy|privacy notice|data protection)/i.test(formText);

    forms.push({
      pageUrl,
      action: $form.attr("action") || `Form #${idx + 1} (inline)`,
      fields: Array.from(new Set(fields)).slice(0, 10),
      hasSensitiveFields,
      hasConsentControl,
      hasPreCheckedConsent,
      hasPrivacyLink,
    });
  });

  return {
    pageTitle,
    forms,
    bannerDetected,
    bannerHasReject,
    policyLink,
    resourceUrls,
    mixedContentCount,
    links,
  };
}

/** Readable text length, ignoring scripts and styles. */
export function visibleTextLength(html: string): number {
  const $ = cheerio.load(html);
  $("script, style, noscript").remove();
  return $("body").text().replace(/\s+/g, " ").trim().length;
}

/**
 * True when the server sent a bot-protection wall or an error page instead of
 * the real site. Scoring that page would be meaningless.
 */
export function looksBlocked(title: string, html: string, status?: number): boolean {
  const t = title.toLowerCase();
  if (
    /just a moment|attention required|access denied|checking your browser|ddos protection|are you a robot|are you human|security check|request blocked|pardon our interruption|verify you are human|bot verification/.test(
      t
    )
  ) {
    return true;
  }
  const textLen = visibleTextLength(html);
  const challengeMarkup =
    // A captcha on a login form is normal; these markers only appear on full-page bot walls.
    /challenge-form|challenge-running|_cf_chl_opt|cf-browser-verification|captcha-delivery|px-captcha|incapsula incident|sucuri website firewall/i.test(
      html
    );
  if (challengeMarkup && textLen < 1500) return true;
  if (status !== undefined && [401, 403, 429, 503].includes(status) && textLen < 1500) return true;
  return false;
}

const KIND_PATTERNS: Array<{ kind: PageKind; re: RegExp }> = [
  { kind: "signup", re: /sign[\s_-]?up|register|create[\s_-]?(an[\s_-]?)?account|open[\s_-]?(an[\s_-]?)?account|get[\s_-]?started|join[\s_-]?now|apply/i },
  { kind: "login", re: /log[\s_-]?in|sign[\s_-]?in/i },
  { kind: "checkout", re: /checkout|cart|basket|pricing|plans|subscribe|buy|shop|store/i },
  { kind: "contact", re: /contact|support|help[\s_-]?cent|enquir|get[\s_-]?in[\s_-]?touch/i },
];

const SKIP_RE = /\.(pdf|jpe?g|png|gif|svg|webp|zip|docx?|xlsx?|mp4|mp3)(\?|$)|logout|log-out|signout|sign-out|\/cdn-cgi\//i;

/**
 * Picks the pages where personal data is most likely collected:
 * sign-up, login, checkout and contact, then fills with other site links.
 */
export function pickSubpages(
  links: Array<{ href: string; text: string }>,
  homeUrl: string,
  policyUrl: string | undefined,
  max = 4
): Array<{ url: string; kind: PageKind }> {
  const home = new URL(homeUrl);
  const root = getRootDomain(home.hostname);
  const seen = new Set<string>([home.origin + home.pathname.replace(/\/$/, "")]);
  if (policyUrl) {
    const p = new URL(policyUrl);
    seen.add(p.origin + p.pathname.replace(/\/$/, ""));
  }

  const candidates: Array<{ url: string; kind: PageKind; text: string }> = [];
  for (const link of links) {
    let u: URL;
    try {
      u = new URL(link.href);
    } catch {
      continue;
    }
    if (!["http:", "https:"].includes(u.protocol)) continue;
    if (getRootDomain(u.hostname) !== root) continue;
    if (SKIP_RE.test(u.pathname)) continue;
    const key = u.origin + u.pathname.replace(/\/$/, "");
    if (seen.has(key)) continue;
    seen.add(key);
    const hay = `${u.pathname} ${link.text}`;
    const kind = KIND_PATTERNS.find((k) => k.re.test(hay))?.kind ?? "other";
    u.hash = "";
    candidates.push({ url: u.toString(), kind, text: link.text });
  }

  const picked: Array<{ url: string; kind: PageKind }> = [];
  for (const { kind } of KIND_PATTERNS) {
    const c = candidates.find((x) => x.kind === kind);
    if (c && picked.length < max) picked.push({ url: c.url, kind });
  }
  for (const c of candidates) {
    if (picked.length >= max) break;
    if (c.kind === "other" && !picked.some((p) => p.url === c.url)) picked.push({ url: c.url, kind: "other" });
  }
  return picked;
}
