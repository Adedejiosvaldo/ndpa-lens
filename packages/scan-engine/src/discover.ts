import type { PageType } from "@ndpa/schema";
import { MAX_PAGES_PER_DOMAIN } from "@ndpa/schema";
import { inspectDomContent } from "./page-inspect.js";
import { getRootDomain } from "./trackers.js";

/**
 * PRD §5.1 step 2 / SCAN-02: choose up to 25 pages per domain where personal
 * data is most likely collected or disclosed. Order: homepage, the user's
 * named pages, then discovered links ranked by page type, then by keyword
 * score. Pure and deterministic, so the same homepage always gives the same
 * page list (§5.4).
 */
export interface DiscoveredPage {
  url: string;
  pageType: PageType;
  /** Why it was chosen: home, named by the user, or a link's keyword score. */
  source: "home" | "named" | "link";
  score: number;
}

/** Ranked by how much evidence a page type usually carries. */
const TYPE_RULES: Array<{ type: PageType; weight: number; re: RegExp }> = [
  { type: "policy", weight: 100, re: /privacy|data[\s_-]?protection|ndpa|gdpr/i },
  { type: "cookie", weight: 95, re: /cookie/i },
  { type: "signup", weight: 90, re: /sign[\s_-]?up|register|create[\s_-]?(an[\s_-]?)?account|open[\s_-]?(an[\s_-]?)?account|get[\s_-]?started|join[\s_-]?now|onboard/i },
  { type: "checkout", weight: 85, re: /checkout|cart|basket|payment|pay[\s_-]?now|buy|subscribe/i },
  { type: "login", weight: 80, re: /log[\s_-]?in|sign[\s_-]?in|my[\s_-]?account/i },
  { type: "account", weight: 75, re: /account|profile|dashboard|portal/i },
  { type: "contact", weight: 70, re: /contact|support|help|enquir|get[\s_-]?in[\s_-]?touch|feedback/i },
  { type: "careers", weight: 60, re: /career|jobs?\b|vacanc|recruit|apply/i },
];

/** PRD §5.1 extra keywords that raise "other" pages. */
const EXTRA_KEYWORDS = /quote|claim|insurance|loan|transfer|book|appointment|enrol|newsletter/i;

const SKIP = /\.(pdf|jpe?g|png|gif|svg|webp|ico|zip|rar|docx?|xlsx?|pptx?|mp4|mp3|wav|avi|mov|css|js|xml|json|rss)(\?|$)|\/(logout|log-out|signout|sign-out)\b|\/cdn-cgi\/|^mailto:|^tel:|^javascript:/i;

export function classify(url: string, text = ""): { type: PageType; score: number } {
  const u = new URL(url);
  const hay = `${decodeURIComponent(u.pathname)} ${text}`;
  for (const r of TYPE_RULES) if (r.re.test(hay)) return { type: r.type, score: r.weight };
  return { type: "other", score: EXTRA_KEYWORDS.test(hay) ? 40 : 10 };
}

const canonical = (u: URL) => `${u.protocol}//${u.host.toLowerCase()}${u.pathname.replace(/\/+$/, "") || "/"}${u.search}`;

export function discoverPages(homeHtml: string, homeUrl: string, namedUrls: string[] = [], max = MAX_PAGES_PER_DOMAIN): DiscoveredPage[] {
  return discoverFromLinks(inspectDomContent(homeHtml, homeUrl, homeUrl).links, homeUrl, namedUrls, max);
}

/** Same ranking from links already extracted (e.g. by capturePage). */
export function discoverFromLinks(links: Array<{ href: string; text: string }>, homeUrl: string, namedUrls: string[] = [], max = MAX_PAGES_PER_DOMAIN): DiscoveredPage[] {
  const home = new URL(homeUrl);
  const root = getRootDomain(home.hostname);
  const seen = new Set<string>();
  const out: DiscoveredPage[] = [];
  const add = (p: DiscoveredPage) => {
    const u = new URL(p.url);
    u.hash = "";
    const key = canonical(u);
    if (seen.has(key) || out.length >= max) return;
    seen.add(key);
    out.push({ ...p, url: u.toString() });
  };

  add({ url: home.toString(), pageType: "home", source: "home", score: 1000 });
  for (const n of namedUrls) {
    try {
      const u = new URL(n, home);
      if (getRootDomain(u.hostname) !== root || !/^https?:$/.test(u.protocol)) continue;
      add({ url: u.toString(), pageType: classify(u.toString()).type, source: "named", score: 500 });
    } catch {
      /* the API validated these; skip anything malformed */
    }
  }

  const candidates: DiscoveredPage[] = [];
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l.href, home);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol) || SKIP.test(u.toString()) || getRootDomain(u.hostname) !== root) continue;
    const c = classify(u.toString(), l.text);
    candidates.push({ url: u.toString(), pageType: c.type, source: "link", score: c.score });
  }
  // Best first; ties keep document order (stable sort) so results are deterministic.
  candidates.sort((a, b) => b.score - a.score);
  // One of each valuable type first, then the rest.
  const firstOfType = new Set<PageType>();
  for (const c of candidates) if (c.pageType !== "other" && !firstOfType.has(c.pageType)) (firstOfType.add(c.pageType), add(c));
  for (const c of candidates) add(c);
  return out;
}
