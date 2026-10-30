import type { Browser, BrowserContext, Locator, Page } from "playwright";
import type {
  ConsentTest,
  CookieFinding,
  EvidenceScreenshot,
  FormFinding,
  NetworkLogEntry,
  PageKind,
  PageScan,
} from "@/types/audit";
import { checkHost, ScanAbort } from "@/lib/net-guard";
import { extractReadablePolicyText } from "@/lib/policy-analyzer";
import {
  ACCEPT_RE,
  inspectDomContent,
  looksBlocked,
  pickSubpages,
  REJECT_RE,
  SETTINGS_RE,
} from "@/lib/page-inspect";
import {
  detectCmp,
  detectTrackersFromUrls,
  getRootDomain,
  isConsentModeDeniedPing,
  isNonEssentialCookie,
} from "@/lib/trackers";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 NDPALensAudit/1.0";
const VIEWPORT = { width: 1366, height: 820 };
const NAV_TIMEOUT = 35_000;
const SUBPAGE_TIMEOUT = 20_000;
/** Time allowed for visiting extra pages after the homepage. */
const CRAWL_BUDGET_MS = 40_000;
/** No new page visits after this long into the scan. */
const CRAWL_HARD_STOP_MS = 75_000;
/** Skip the Accept comparison if the scan has already run this long. */
const ACCEPT_TEST_CUTOFF_MS = 60_000;
const MAX_SUBPAGES = 4;
const LOG_CAP = 600;

export interface BrowserCapture {
  engine: "browser";
  browserChannel: string;
  finalUrl: string;
  status?: number;
  html: string;
  headers: Record<string, string>;
  /** Cookies present before the visitor made any choice, across all pages. */
  cookies: CookieFinding[];
  /** Every request made before the visitor made any choice. */
  preConsentUrls: string[];
  pages: PageScan[];
  forms: FormFinding[];
  consent: ConsentTest;
  policy?: { url: string; html: string; text: string };
  /** The policy page exists but bot protection or an error stopped us reading it. */
  policyBlocked: boolean;
  screenshots: EvidenceScreenshot[];
  networkLog: NetworkLogEntry[];
  networkLogTruncated: boolean;
}

/* ------------------------------------------------------------------ */
/* Browser and context setup                                           */
/* ------------------------------------------------------------------ */

async function launchBrowser(): Promise<{ browser: Browser; channel: string }> {
  const { chromium } = await import("playwright");
  const configured = process.env.PLAYWRIGHT_CHANNEL?.trim();
  const candidates: Array<string | undefined> = [];
  if (configured) candidates.push(configured);
  for (const ch of ["chrome", "msedge", undefined]) {
    if (!candidates.includes(ch)) candidates.push(ch);
  }

  let lastError = "";
  for (const channel of candidates) {
    try {
      const browser = await chromium.launch({
        headless: true,
        ...(channel ? { channel } : {}),
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      return { browser, channel: channel || "chromium" };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(`Playwright launch unavailable (${lastError})`);
}

/** A fresh visitor: no cookies, Nigerian locale, and no access to private networks. */
/** Video, audio, fonts and the site's own images can't track anyone but slow scans down. */
function isHeavyAsset(type: string, url: URL, siteRoot: string): boolean {
  if (type === "media" || type === "font") return true;
  return type === "image" && getRootDomain(url.hostname) === siteRoot;
}

async function newVisitor(browser: Browser, siteUrl: string): Promise<BrowserContext> {
  const siteRoot = getRootDomain(new URL(siteUrl).hostname);
  const ctx = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: VIEWPORT,
    locale: "en-NG",
    timezoneId: "Africa/Lagos",
  });
  await ctx.route("**/*", async (route) => {
    try {
      const u = new URL(route.request().url());
      if (!["http:", "https:"].includes(u.protocol)) return await route.continue();
      if (isHeavyAsset(route.request().resourceType(), u, siteRoot)) return await route.abort("blockedbyclient");
      const host = await checkHost(u.hostname);
      if (host === "public") return await route.continue();
      return await route.abort(host === "unresolved" ? "namenotresolved" : "blockedbyclient");
    } catch {
      // page closed while the request was in flight
    }
  });
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Network recording                                                   */
/* ------------------------------------------------------------------ */

class NetworkRecorder {
  entries: NetworkLogEntry[] = [];
  truncated = false;

  attach(page: Page, phase: string) {
    let pageUrl = "";
    let recording = false;
    let pending: string[] = [];
    let pendingTypes: string[] = [];
    page.on("request", (req) => {
      if (!recording) return;
      const url = req.url();
      if (!/^https?:/i.test(url)) return;
      pending.push(url);
      pendingTypes.push(req.resourceType());
      if (this.entries.length < LOG_CAP) {
        this.entries.push({
          phase,
          pageUrl,
          url: url.length > 300 ? `${url.slice(0, 300)}…` : url,
          type: req.resourceType(),
          at: new Date().toISOString(),
        });
      } else {
        this.truncated = true;
      }
    });
    return {
      start: () => {
        recording = true;
      },
      setPage: (url: string) => {
        pageUrl = url;
      },
      /** URLs requested since the last call. */
      /** Requests since the last take() that carried data out (not script or style downloads). */
      takeBeacons: () => {
        const out = pending.filter((_, i) => !["script", "stylesheet", "document"].includes(pendingTypes[i]));
        pending = [];
        pendingTypes = [];
        return out;
      },
      take: () => {
        const out = pending;
        pending = [];
        pendingTypes = [];
        return out;
      },
    };
  }
}

/* ------------------------------------------------------------------ */
/* Page helpers                                                        */
/* ------------------------------------------------------------------ */

async function settle(page: Page, ms: number) {
  await page.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
  await page.waitForTimeout(600);
}

/** Scrolls to the bottom and back, so scroll-triggered scripts load too. */
async function scrollThrough(page: Page) {
  for (let i = 1; i <= 3; i++) {
    await page
      .evaluate((step) => window.scrollTo(0, (document.body.scrollHeight * step) / 3), i)
      .catch(() => {});
    await page.waitForTimeout(400);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
}

async function screenshot(page: Page, label: string): Promise<EvidenceScreenshot | null> {
  try {
    const buf = await page.screenshot({ type: "jpeg", quality: 50, timeout: 6000 });
    return {
      label,
      url: page.url(),
      capturedAt: new Date().toISOString(),
      dataUrl: `data:image/jpeg;base64,${buf.toString("base64")}`,
    };
  } catch {
    return null;
  }
}

/**
 * Looks for a cookie banner that is actually on screen, including ones
 * inside shadow DOM or a consent iframe.
 */
async function inspectBanner(
  page: Page
): Promise<{ visible: boolean; aboveFold: boolean; bottomOnly: boolean }> {
  return page
    .evaluate(() => {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const KEY = /cookie|consent|gdpr|cmp|onetrust|cookiebot|didomi|usercentrics|cky-|qc-cmp/i;
      const TEXT = /cookie|consent|tracking technolog/i;
      const out = { visible: false, aboveFold: false, bottomOnly: false };
      // GAID 2025 Art. 7(l): the notice should cover the middle, left or right of the
      // page. Track whether any banner element reaches the middle or is a tall side panel.
      let prominent = false;

      const consider = (el: Element, needText: boolean) => {
        const r = el.getBoundingClientRect();
        if (r.width < 40 || r.height < 20) return;
        const s = window.getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) < 0.05) return;
        if (needText) {
          const t = ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
          if (t.length < 20 || t.length > 5000 || !TEXT.test(t)) return;
        }
        out.visible = true;
        if (r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0) out.aboveFold = true;
        if ((r.top < vh / 2 && r.bottom > vh / 2) || r.height >= vh * 0.4) prominent = true;
      };

      const walk = (root: Document | ShadowRoot) => {
        root.querySelectorAll("*").forEach((el) => {
          const tag = el.tagName;
          if (tag === "HTML" || tag === "BODY") return;
          if (tag === "IFRAME") {
            const sig = `${el.getAttribute("src") || ""} ${el.id} ${el.getAttribute("title") || ""}`;
            if (KEY.test(sig) || /sp_message/i.test(sig)) consider(el, false);
          } else {
            const cls = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "";
            const sig = `${el.id} ${cls} ${el.getAttribute("aria-label") || ""} ${tag}`;
            const role = el.getAttribute("role");
            if (KEY.test(sig) || role === "dialog" || role === "alertdialog") consider(el, true);
          }
          if (el.shadowRoot) walk(el.shadowRoot);
        });
      };
      walk(document);
      out.bottomOnly = out.aboveFold && !prominent;
      return out;
    })
    .catch(() => ({ visible: false, aboveFold: false, bottomOnly: false }));
}

/** Finds a visible button or link whose name matches, in any frame (shadow DOM included). */
async function findChoiceButton(
  page: Page,
  match: RegExp,
  exclude?: RegExp
): Promise<{ locator: Locator; label: string; inView: boolean } | null> {
  for (const frame of page.frames()) {
    for (const role of ["button", "link"] as const) {
      const loc = frame.getByRole(role, { name: match });
      const n = Math.min(await loc.count().catch(() => 0), 8);
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const label = (
          (await el.innerText({ timeout: 1000 }).catch(() => "")) ||
          (await el.getAttribute("aria-label").catch(() => "")) ||
          ""
        )
          .replace(/\s+/g, " ")
          .trim();
        if (!label || label.length > 40) continue;
        if (exclude && exclude.test(label)) continue;
        const box = await el.boundingBox().catch(() => null);
        const inView = Boolean(box && box.y < VIEWPORT.height && box.y + box.height > 0);
        return { locator: el, label, inView };
      }
    }
  }
  return null;
}

/**
 * Navigates, but keeps going if a slow page timed out after it had already
 * rendered something. Returns null when the page never really arrived.
 */
async function gotoTolerant(page: Page, url: string, timeout: number) {
  try {
    return { response: await page.goto(url, { waitUntil: "domcontentloaded", timeout }), partial: false };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!/timeout/i.test(msg)) throw err;
    const html = await page.content().catch(() => "");
    if (page.url() !== "about:blank" && html.length > 2000) return { response: null, partial: true };
    throw err;
  }
}

function navErrorToAbort(err: unknown): never {
  const msg = err instanceof Error ? err.message : String(err);
  if (/ERR_CERT|SSL|certificate/i.test(msg)) {
    throw new ScanAbort(
      "This site's HTTPS certificate isn't valid, so browsers show visitors a security warning. Fix the certificate, then scan again."
    );
  }
  if (/ERR_BLOCKED_BY_CLIENT/i.test(msg)) {
    throw new ScanAbort("That address points to a private or internal network, which can't be scanned.");
  }
  if (/ERR_NAME_NOT_RESOLVED/i.test(msg)) {
    throw new ScanAbort("We couldn't find that website. Check the address and try again.");
  }
  throw err instanceof Error ? err : new Error(msg);
}

/* ------------------------------------------------------------------ */
/* Choice test: click Reject (or Accept), reload, see what still loads */
/* ------------------------------------------------------------------ */

interface ChoiceResult {
  /** Set when the test itself couldn't run (page too slow, crashed). */
  error?: string;
  found: boolean;
  label?: string;
  inView: boolean;
  clicked: boolean;
  trackers: string[];
  /** Google Consent Mode pings sent with consent denied (no cookies). */
  consentModePings?: number;
  newCookies: string[];
  screenshot?: EvidenceScreenshot | null;
}

async function runChoiceTest(
  browser: Browser,
  homeUrl: string,
  choice: "reject" | "accept",
  recorder: NetworkRecorder
): Promise<ChoiceResult> {
  const ctx = await newVisitor(browser, homeUrl);
  const empty: ChoiceResult = { found: false, inView: false, clicked: false, trackers: [], newCookies: [] };
  try {
    const page = await ctx.newPage();
    const net = recorder.attach(page, choice === "reject" ? "after-reject" : "after-accept");
    net.setPage(homeUrl);
    await gotoTolerant(page, homeUrl, NAV_TIMEOUT);
    await settle(page, 4000);

    const button =
      choice === "reject"
        ? await findChoiceButton(page, REJECT_RE)
        : await findChoiceButton(page, ACCEPT_RE, new RegExp(`${REJECT_RE.source}|${SETTINGS_RE.source}`, "i"));
    if (!button) return empty;

    const before = new Set((await ctx.cookies()).map((c) => c.name));
    net.start(); // everything from the click onwards counts
    const clicked = await button.locator
      .click({ timeout: 4000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) return { ...empty, found: true, label: button.label, inView: button.inView };

    await page.waitForTimeout(1500);
    await gotoTolerant(page, homeUrl, NAV_TIMEOUT).catch(() => {});
    await settle(page, 4000);
    await scrollThrough(page);
    await page.waitForTimeout(800);

    // Only count requests that send data; downloading a script alone sends nothing.
    const afterUrls = net.takeBeacons();
    const deniedPings = afterUrls.filter(isConsentModeDeniedPing);
    const trackers = detectTrackersFromUrls(afterUrls.filter((u) => !isConsentModeDeniedPing(u))).map((t) => t.name);
    const newCookies = (await ctx.cookies())
      .filter((c) => !before.has(c.name) && isNonEssentialCookie(c.name))
      .map((c) => c.name);
    const shot =
      choice === "reject" ? await screenshot(page, "Homepage after clicking Reject and reloading") : null;

    return {
      found: true,
      label: button.label,
      inView: button.inView,
      clicked: true,
      trackers,
      newCookies,
      consentModePings: deniedPings.length,
      screenshot: shot,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message.split("\n")[0] : String(err);
    return { ...empty, error: msg };
  } finally {
    await ctx.close().catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* Main capture                                                        */
/* ------------------------------------------------------------------ */

const POLICY_PATHS = ["/privacy-policy", "/privacy", "/legal/privacy-policy", "/legal/privacy"];

/** Rendered page text that reads like a privacy policy, not a shell or a block page. */
function looksLikePolicy(text: string): boolean {
  return (
    text.length > 1500 &&
    /(personal (data|information)|information we collect|data protection)/i.test(text) &&
    /privacy/i.test(text)
  );
}

export async function captureWithBrowser(targetUrl: string): Promise<BrowserCapture> {
  const startedAt = Date.now();
  const { browser, channel } = await launchBrowser();
  const recorder = new NetworkRecorder();
  const screenshots: EvidenceScreenshot[] = [];
  const notes: string[] = [];

  try {
    const ctx = await newVisitor(browser, targetUrl);
    try {
      const page = await ctx.newPage();
      const net = recorder.attach(page, "before-consent");
      net.start();
      net.setPage(targetUrl);

      /* 1. Homepage, as a first-time visitor who hasn't chosen anything */
      const nav = await gotoTolerant(page, targetUrl, NAV_TIMEOUT).catch(navErrorToAbort);
      const response = nav.response;
      if (nav.partial) notes.push("The homepage loaded slowly; we checked it once it had rendered.");
      await settle(page, 4000);

      const finalUrl = page.url() || targetUrl;
      const status = response?.status();
      const firstHtml = await page.content();
      const title = await page.title().catch(() => "");
      if (looksBlocked(title, firstHtml, status)) {
        throw new ScanAbort(
          "This website showed our scanner a bot-protection or error page instead of the real site, so we can't see what visitors see. No score was given. Try again later, or ask the site owner to allow the scanner.",
          422
        );
      }

      const banner = await inspectBanner(page);
      const homeShot = await screenshot(page, "Homepage on first visit, before any choice");
      if (homeShot) screenshots.push(homeShot);

      // Reject test (then Accept, for comparison) in a fresh browser while we keep crawling.
      const choiceTests = (async () => {
        const reject = await runChoiceTest(browser, finalUrl, "reject", recorder);
        const accept =
          Date.now() - startedAt < ACCEPT_TEST_CUTOFF_MS
            ? await runChoiceTest(browser, finalUrl, "accept", recorder)
            : { found: false, inView: false, clicked: false, trackers: [], newCookies: [], error: "skipped (time limit)" };
        return [reject, accept] as const;
      })();

      await scrollThrough(page);
      await settle(page, 2500);
      const html = await page.content();
      const homeUrls = net.take();
      const home = inspectDomContent(html, finalUrl, finalUrl);

      const headers: Record<string, string> = {};
      for (const [k, v] of Object.entries(response?.headers() ?? {})) headers[k.toLowerCase()] = v;

      const pages: PageScan[] = [
        {
          url: finalUrl,
          kind: "home",
          title: home.pageTitle,
          status,
          bannerVisible: banner.visible,
          policyLinked: Boolean(home.policyLink),
          formCount: home.forms.length,
          trackers: detectTrackersFromUrls([...homeUrls, ...home.resourceUrls]).map((t) => t.name),
        },
      ];
      const forms: FormFinding[] = [...home.forms];
      const preConsentUrls = [...homeUrls, ...home.resourceUrls];

      /* 2. Pages where data is usually collected, still without choosing */
      const deadline = Math.min(Date.now() + CRAWL_BUDGET_MS, startedAt + CRAWL_HARD_STOP_MS);
      const visit = async (url: string, kind: PageKind): Promise<{ html: string; text: string; scan: PageScan } | null> => {
        if (Date.now() > deadline) {
          notes.push(`Skipped ${url} (time limit).`);
          return null;
        }
        net.setPage(url);
        net.take();
        try {
          const r = (await gotoTolerant(page, url, SUBPAGE_TIMEOUT)).response;
          await settle(page, 3000);
          const pageHtml = await page.content();
          let pageText = await page
            .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim())
            .catch(() => "");
          // Some sites load the policy text inside an embedded frame from their own domain.
          if (kind === "policy") {
            const siteRoot = getRootDomain(new URL(page.url()).hostname);
            for (const frame of page.frames()) {
              if (frame === page.mainFrame()) continue;
              let frameHost = "";
              try {
                frameHost = new URL(frame.url()).hostname;
              } catch {
                continue;
              }
              if (getRootDomain(frameHost) !== siteRoot) continue;
              const ft = await frame
                .evaluate(() => (document.body?.innerText || "").replace(/\s+/g, " ").trim())
                .catch(() => "");
              if (ft.length > 200) pageText += ` ${ft}`;
            }
          }
          const pageTitle = await page.title().catch(() => "");
          const pageStatus = r?.status();
          const blocked = looksBlocked(pageTitle, pageHtml, pageStatus) || (pageStatus ?? 200) >= 400;
          const b = blocked ? { visible: false } : await inspectBanner(page);
          const dom = inspectDomContent(pageHtml, page.url(), page.url());
          const urls = net.take();
          if (!blocked) {
            forms.push(...dom.forms);
            preConsentUrls.push(...urls, ...dom.resourceUrls);
          }
          return {
            html: pageHtml,
            text: pageText,
            scan: {
              url: page.url(),
              kind,
              title: dom.pageTitle,
              status: pageStatus,
              blocked,
              bannerVisible: b.visible,
              policyLinked: kind === "policy" || Boolean(dom.policyLink),
              formCount: dom.forms.length,
              trackers: blocked ? [] : detectTrackersFromUrls([...urls, ...dom.resourceUrls]).map((t) => t.name),
            },
          };
        } catch {
          return {
            html: "",
            text: "",
            scan: { url, kind, title: "", blocked: true, bannerVisible: false, policyLinked: false, formCount: 0, trackers: [] },
          };
        }
      };

      // Privacy policy, rendered like a visitor sees it
      let policy: { url: string; html: string; text: string } | undefined;
      let policyBlocked = false;
      const origin = new URL(finalUrl).origin;
      const policyCandidates = Array.from(
        new Set([home.policyLink, ...POLICY_PATHS.map((p) => origin + p)].filter(Boolean) as string[])
      ).slice(0, home.policyLink ? 2 : 3);
      for (const candidate of policyCandidates) {
        const v = await visit(candidate, "policy");
        if (!v) break;
        const sourceText = extractReadablePolicyText(v.html).text;
        const bestText = sourceText.length > v.text.length ? sourceText : v.text;
        if (!v.scan.blocked && looksLikePolicy(bestText)) {
          policy = { url: v.scan.url, html: v.html, text: v.text };
          pages.push(v.scan);
          break;
        }
        // The linked policy exists but we couldn't read it: say so instead of "missing".
        if (candidate === home.policyLink) {
          policyBlocked = true;
          pages.push(v.scan);
        }
      }
      if (policy) policyBlocked = false;

      for (const sub of pickSubpages(home.links, finalUrl, policy?.url ?? home.policyLink, MAX_SUBPAGES)) {
        const v = await visit(sub.url, sub.kind);
        if (v) pages.push(v.scan);
      }

      const rawCookies = await ctx.cookies();
      const cookies: CookieFinding[] = rawCookies.map((c) => ({
        name: c.name,
        domain: c.domain.replace(/^\./, ""),
        secure: c.secure,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite || "Lax",
        session: c.expires === -1 || c.expires === 0,
      }));

      /* 3. Results of the Reject / Accept tests */
      const [reject, accept] = await choiceTests;
      if (reject.screenshot) screenshots.push(reject.screenshot);

      const bannerVisible = banner.visible || reject.found || accept.found;
      const bannerAboveFold = banner.aboveFold || reject.inView || accept.inView;
      if (reject.consentModePings) {
        notes.push(
          `After Reject, Google still received ${reject.consentModePings} cookieless "consent denied" ping(s) (Google Consent Mode). These don't set cookies, but they do reach Google. We didn't count them as tracking.`
        );
      }
      if (reject.error) notes.push(`The Reject test couldn't finish: ${reject.error}`);
      if (accept.error) notes.push(`The Accept test couldn't finish: ${accept.error}`);
      if (reject.found && !reject.clicked) notes.push(`Found a "${reject.label}" button but couldn't click it.`);
      if (accept.found && !accept.clicked) notes.push(`Found a "${accept.label}" button but couldn't click it.`);

      const consent: ConsentTest = {
        tested: true,
        bannerVisible,
        bannerAboveFold,
        bannerBottomOnly: banner.bottomOnly,
        rejectFound: reject.found,
        rejectTestFailed: Boolean(reject.error),
        acceptFound: accept.found,
        rejectLabel: reject.label,
        acceptLabel: accept.label,
        rejectClicked: reject.clicked,
        acceptClicked: accept.clicked,
        trackersBeforeConsent: detectTrackersFromUrls(preConsentUrls).map((t) => t.name),
        trackersAfterReject: reject.trackers,
        cookiesAfterReject: reject.newCookies,
        trackersAfterAccept: accept.trackers,
        cmpDetected: detectCmp(html),
        notes,
      };

      return {
        engine: "browser",
        browserChannel: channel,
        finalUrl,
        status,
        html,
        headers,
        cookies,
        preConsentUrls,
        pages,
        forms,
        consent,
        policy,
        policyBlocked,
        screenshots,
        networkLog: recorder.entries,
        networkLogTruncated: recorder.truncated,
      };
    } finally {
      await ctx.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}
