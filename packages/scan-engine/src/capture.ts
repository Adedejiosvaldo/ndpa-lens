import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ConsentState, PageType } from "@ndpa/schema";
import type { Browser, BrowserContext, Frame, Page, Request, Response } from "playwright";
import type { EvidenceFile, EvidenceWriter } from "./evidence.js";
import { ScanAbort } from "./net-guard.js";
import { DESKTOP_UA, type NetPolicy, SCANNER_HEADER, scannerHeaders, vetHost } from "./net-policy.js";
import { ACCEPT_RE, REJECT_RE, SETTINGS_RE } from "./page-inspect.js";
import { detectCmp, getRootDomain } from "./trackers.js";

/**
 * PRD §5.1 steps 3–7 / SCAN-03: record one page in one consent state.
 *
 *   none    fresh context, load, record (no interaction)
 *   reject  fresh context, load, click "reject all", reload, record
 *   accept  fresh context, load, click "accept all", reload, record
 *
 * Every request carries a phase ("initial" before any click, "after-choice"
 * after the click and reload), so checks compare like with like. Evidence is
 * written first; checks run later over the stored files only (§5.4).
 * Forms are inspected and never submitted.
 */

export const DESKTOP_VIEWPORT = { width: 1366, height: 768 };
export const PAGE_TIMEOUT_MS = 45_000;

export type Phase = "initial" | "after-choice";

export interface CapturedRequest {
  url: string;
  host: string;
  method: string;
  resourceType: string;
  phase: Phase;
  thirdParty: boolean;
  /** First 4 KB of the request body (form posts, analytics beacons) for PII checks (C-11). */
  postData: string | null;
  status: number | null;
  blocked: string | null;
}

export interface CapturedCookie {
  name: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string;
  /** Present before the visitor made any choice. */
  setBeforeChoice: boolean;
  thirdParty: boolean;
}

export interface BannerButton {
  role: "reject" | "accept" | "settings";
  label: string;
  visible: boolean;
  inViewport: boolean;
  /** Bounding-box area in CSS px², for "equal prominence" (C-04). */
  area: number;
  fontSize: number;
  background: string;
  color: string;
}

export interface BannerInfo {
  found: boolean;
  cmp: string | null;
  /** Any part of the banner inside the first viewport (C-05). */
  aboveFold: boolean;
  /** Covers the middle of the screen or is a tall side panel (GAID cookie provisions). */
  prominent: boolean;
  text: string | null;
  buttons: BannerButton[];
}

export interface FormField {
  tag: string;
  type: string;
  name: string;
  autocomplete: string;
  label: string;
  required: boolean;
  /** Collects personal data: email, phone, name, address, ID numbers, dates of birth… */
  personal: boolean;
}

export interface FormCheckbox {
  label: string;
  checked: boolean;
  /** Looks like consent or marketing opt-in (C-13). */
  consentLike: boolean;
}

export interface CapturedForm {
  action: string;
  method: string;
  /** "http" when the form would submit over plain HTTP (C-14). */
  actionScheme: "https" | "http" | "same-page" | "other";
  fields: FormField[];
  checkboxes: FormCheckbox[];
  /** A privacy-notice link inside or right next to the form (C-12). */
  privacyLinkNearSubmit: boolean;
  submitLabel: string;
}

export interface PageCapture {
  pageId: string;
  url: string;
  finalUrl: string;
  pageType: PageType;
  consentState: ConsentState;
  device: "desktop" | "mobile";
  status: number | null;
  title: string;
  /** What happened with the consent choice (null for state "none"). */
  choice: { attempted: ConsentState; clicked: boolean; label: string | null } | null;
  banner: BannerInfo;
  requests: CapturedRequest[];
  cookies: CapturedCookie[];
  localStorage: Record<string, string>;
  console: Array<{ type: string; text: string }>;
  forms: CapturedForm[];
  mixedContent: string[];
  /** Hashed evidence files for this page and state. */
  evidence: EvidenceFile[];
  capturedAt: string;
  durationMs: number;
}

export interface CaptureOptions {
  url: string;
  pageId: string;
  pageType: PageType;
  state: ConsentState;
  policy: NetPolicy;
  writer: EvidenceWriter;
  device?: "desktop" | "mobile";
  timeoutMs?: number;
}

const PERSONAL = /e-?mail|phone|mobile|tel|name|surname|address|street|city|post(al)?[\s_-]?code|zip|dob|birth|bvn|nin|passport|national[\s_-]?id|account[\s_-]?number|card/i;
const CONSENT_LIKE = /consent|agree|accept|newsletter|marketing|offers?|promotion|updates|subscribe|terms|privacy|third[\s_-]?part/i;
const PRIVACY_LINK = /privacy|data[\s_-]?protection|cookie[\s_-]?policy/i;

/** Pixel 7, for the homepage mobile pass (PRD §5.1 "Tech"). */
const PIXEL_7 = {
  viewport: { width: 412, height: 915 },
  deviceScaleFactor: 2.625,
  isMobile: true,
  hasTouch: true,
  userAgent:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36",
};

async function newContext(browser: Browser, opts: CaptureOptions, harPath: string): Promise<BrowserContext> {
  const headers = scannerHeaders(opts.policy);
  const base = opts.device === "mobile" ? PIXEL_7 : { viewport: DESKTOP_VIEWPORT, userAgent: DESKTOP_UA };
  const ctx = await browser.newContext({
    ...base,
    locale: "en-GB",
    timezoneId: "Africa/Lagos",
    acceptDownloads: false,
    ignoreHTTPSErrors: false,
    serviceWorkers: "block",
    extraHTTPHeaders: { [SCANNER_HEADER]: headers[SCANNER_HEADER]! },
    recordHar: { path: harPath, content: "omit", mode: "full" },
  });
  // Every request the page makes is vetted against the network policy, so a
  // page can't use the browser to reach internal addresses (PRD §9).
  const vetted = new Map<string, Promise<string | null>>();
  await ctx.route("**/*", async (route) => {
    const u = new URL(route.request().url());
    if (u.protocol === "data:" || u.protocol === "blob:") return route.continue();
    if (!/^https?:$/.test(u.protocol)) return route.abort("blockedbyclient");
    let verdict = vetted.get(u.hostname);
    if (!verdict) {
      verdict = vetHost(u.hostname, opts.policy).then(
        () => null,
        (e: Error) => e.message,
      );
      vetted.set(u.hostname, verdict);
    }
    const blocked = await verdict;
    if (blocked) return route.abort("blockedbyclient");
    return route.continue();
  });
  return ctx;
}

async function settle(page: Page, ms = 2_500) {
  await page.waitForLoadState("networkidle", { timeout: ms }).catch(() => {});
}

/** Banner detection: known CMP signatures in the DOM, then a fixed/sticky heuristic. */
async function inspectBanner(page: Page): Promise<BannerInfo> {
  const html = await page.content().catch(() => "");
  const scripts = await page.evaluate(() => Array.from(document.scripts).map((s) => s.src).join(" ")).catch(() => "");
  const cmp = detectCmp(`${html} ${scripts}`) ?? null;
  const dom = await page
    .evaluate(
      ({ rejectSrc, acceptSrc, settingsSrc }) => {
        const REJECT = new RegExp(rejectSrc, "i");
        const ACCEPT = new RegExp(acceptSrc, "i");
        const SETTINGS = new RegExp(settingsSrc, "i");
        const KEY = /cookie|consent|gdpr|cmp|onetrust|optanon|cookiebot|cybot|cky-|cookieyes|termly|osano|cookiehub|ch2|didomi|usercentrics|qc-cmp|izini/i;
        const TEXT = /cookie|consent|tracking technolog|personal data|privacy/i;
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        let best: { el: Element; score: number } | null = null;
        const visible = (el: Element) => {
          const r = el.getBoundingClientRect();
          const s = getComputedStyle(el);
          return r.width > 40 && r.height > 20 && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) > 0.05;
        };
        const walk = (root: Document | ShadowRoot) => {
          root.querySelectorAll("*").forEach((el) => {
            if (el.tagName === "HTML" || el.tagName === "BODY") return;
            const cls = typeof (el as HTMLElement).className === "string" ? (el as HTMLElement).className : "";
            const sig = `${el.id} ${cls} ${el.getAttribute("aria-label") ?? ""}`;
            const role = el.getAttribute("role");
            const pos = getComputedStyle(el).position;
            const fixed = pos === "fixed" || pos === "sticky";
            const text = ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
            if (visible(el) && text.length >= 20 && text.length <= 5000 && TEXT.test(text)) {
              let score = 0;
              if (KEY.test(sig)) score += 3;
              if (role === "dialog" || role === "alertdialog" || role === "region") score += 1;
              if (fixed) score += 2;
              if (el.querySelector("button, [role=button], a")) score += 1;
              if (score >= 3 && (!best || score > best.score || (score === best.score && best.el.contains(el)))) best = { el, score };
            }
            if (el.shadowRoot) walk(el.shadowRoot);
          });
        };
        walk(document);
        if (!best) return null;
        const root = (best as { el: Element }).el;
        const r = root.getBoundingClientRect();
        const buttons: Array<{ role: string; label: string; visible: boolean; inViewport: boolean; area: number; fontSize: number; background: string; color: string }> = [];
        root.querySelectorAll("button, [role=button], a, input[type=button], input[type=submit]").forEach((b) => {
          const label = ((b as HTMLElement).innerText || (b as HTMLInputElement).value || b.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
          if (!label || label.length > 60) return;
          const role = REJECT.test(label) ? "reject" : ACCEPT.test(label) ? "accept" : SETTINGS.test(label) ? "settings" : null;
          if (!role) return;
          const br = b.getBoundingClientRect();
          const s = getComputedStyle(b);
          buttons.push({
            role,
            label,
            visible: visible(b),
            inViewport: br.top < vh && br.bottom > 0 && br.left < vw && br.right > 0,
            area: Math.round(br.width * br.height),
            fontSize: parseFloat(s.fontSize) || 0,
            background: s.backgroundColor,
            color: s.color,
          });
        });
        return {
          aboveFold: r.top < vh && r.bottom > 0,
          prominent: (r.top < vh / 2 && r.bottom > vh / 2) || r.height >= vh * 0.4,
          text: ((root as HTMLElement).innerText || "").replace(/\s+/g, " ").trim().slice(0, 1500),
          buttons,
        };
      },
      { rejectSrc: REJECT_RE.source, acceptSrc: ACCEPT_RE.source, settingsSrc: SETTINGS_RE.source },
    )
    .catch(() => null);
  if (!dom) return { found: false, cmp, aboveFold: false, prominent: false, text: null, buttons: [] };
  return { found: true, cmp, ...dom, buttons: dom.buttons as BannerButton[] };
}

/** Click the reject or accept control, searching every frame (CMPs often use iframes). */
async function clickChoice(page: Page, state: "reject" | "accept"): Promise<{ clicked: boolean; label: string | null }> {
  const match = state === "reject" ? REJECT_RE : ACCEPT_RE;
  const exclude = state === "accept" ? REJECT_RE : undefined;
  const frames: Frame[] = page.frames();
  for (const frame of frames) {
    for (const role of ["button", "link"] as const) {
      const loc = frame.getByRole(role, { name: match });
      const n = Math.min(await loc.count().catch(() => 0), 8);
      for (let i = 0; i < n; i++) {
        const el = loc.nth(i);
        if (!(await el.isVisible().catch(() => false))) continue;
        const label = ((await el.innerText({ timeout: 1000 }).catch(() => "")) || (await el.getAttribute("aria-label").catch(() => "")) || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!label || label.length > 60 || (exclude && exclude.test(label))) continue;
        try {
          await el.click({ timeout: 3_000 });
          return { clicked: true, label };
        } catch {
          /* try the next candidate */
        }
      }
    }
  }
  return { clicked: false, label: null };
}

/** Form inspection (PRD §5.1 step 7). Reads properties, not attributes, so JS-ticked boxes count. Never submits. */
async function inspectForms(page: Page): Promise<CapturedForm[]> {
  const raw = await page
    .evaluate(({ personalSrc, consentSrc, privacySrc }) => {
      const PERSONAL = new RegExp(personalSrc, "i");
      const CONSENT = new RegExp(consentSrc, "i");
      const PRIVACY = new RegExp(privacySrc, "i");
      const labelFor = (el: Element) => {
        const id = el.getAttribute("id");
        const lab = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest("label");
        return ((lab as HTMLElement | null)?.innerText || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 200);
      };
      return Array.from(document.forms).map((form) => {
        const fields = Array.from(form.querySelectorAll("input, select, textarea"))
          .filter((el) => !["hidden", "submit", "button", "checkbox", "radio", "image", "reset"].includes((el as HTMLInputElement).type))
          .map((el) => {
            const i = el as HTMLInputElement;
            const label = labelFor(el);
            const hay = `${i.type} ${i.name} ${i.id} ${i.autocomplete} ${label}`;
            return { tag: el.tagName.toLowerCase(), type: i.type || el.tagName.toLowerCase(), name: i.name, autocomplete: i.autocomplete, label, required: i.required, personal: ["email", "tel"].includes(i.type) || PERSONAL.test(hay) };
          });
        const checkboxes = Array.from(form.querySelectorAll("input[type=checkbox]")).map((el) => {
          const label = labelFor(el);
          return { label, checked: (el as HTMLInputElement).checked, consentLike: CONSENT.test(`${label} ${(el as HTMLInputElement).name}`) };
        });
        const submit = form.querySelector("button[type=submit], input[type=submit], button:not([type])") as HTMLElement | null;
        const near = [form, form.parentElement, form.nextElementSibling].filter(Boolean) as Element[];
        const privacyLinkNearSubmit = near.some((n) => Array.from(n.querySelectorAll("a")).some((a) => PRIVACY.test(`${(a as HTMLElement).innerText} ${a.getAttribute("href") ?? ""}`)));
        return {
          action: form.getAttribute("action") ? form.action : "",
          method: (form.getAttribute("method") || "get").toLowerCase(),
          fields,
          checkboxes,
          privacyLinkNearSubmit,
          submitLabel: (submit?.innerText || (submit as HTMLInputElement | null)?.value || "").trim().slice(0, 80),
        };
      });
    }, { personalSrc: PERSONAL.source, consentSrc: CONSENT_LIKE.source, privacySrc: PRIVACY_LINK.source })
    .catch(() => []);
  return raw.map((f) => {
    const scheme = !f.action ? "same-page" : f.action.startsWith("https:") ? "https" : f.action.startsWith("http:") ? "http" : "other";
    return { ...f, actionScheme: scheme as CapturedForm["actionScheme"] };
  });
}

/** Record one page in one consent state and store its evidence. */
export async function capturePage(browser: Browser, opts: CaptureOptions): Promise<PageCapture> {
  const started = Date.now();
  const device = opts.device ?? "desktop";
  const timeout = opts.timeoutMs ?? PAGE_TIMEOUT_MS;
  const harDir = await mkdtemp(join(tmpdir(), "ndpa-har-"));
  const harPath = join(harDir, "page.har");
  const ctx = await newContext(browser, { ...opts, device }, harPath);
  const siteRoot = getRootDomain(new URL(opts.url).hostname);
  const requests: CapturedRequest[] = [];
  const byRequest = new Map<Request, CapturedRequest>();
  const consoleMsgs: PageCapture["console"] = [];
  let phase: Phase = "initial";
  let cookiesBeforeChoice = new Set<string>();

  try {
    const page = await ctx.newPage();
    page.setDefaultTimeout(timeout);
    page.on("request", (r) => {
      const u = new URL(r.url());
      if (!/^https?:$/.test(u.protocol)) return;
      const entry: CapturedRequest = {
        url: r.url(),
        host: u.hostname,
        method: r.method(),
        resourceType: r.resourceType(),
        phase,
        thirdParty: getRootDomain(u.hostname) !== siteRoot,
        postData: r.postData()?.slice(0, 4096) ?? null,
        status: null,
        blocked: null,
      };
      byRequest.set(r, entry);
      requests.push(entry);
    });
    page.on("requestfinished", async (r) => {
      const e = byRequest.get(r);
      if (e) e.status = (await r.response().catch(() => null))?.status() ?? null;
    });
    page.on("requestfailed", (r) => {
      const e = byRequest.get(r);
      if (e) e.blocked = r.failure()?.errorText ?? "failed";
    });
    page.on("console", (m) => consoleMsgs.length < 200 && consoleMsgs.push({ type: m.type(), text: m.text().slice(0, 500) }));

    let response: Response | null;
    try {
      response = await page.goto(opts.url, { waitUntil: "domcontentloaded", timeout });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/ERR_BLOCKED_BY_CLIENT/i.test(msg)) throw new ScanAbort("That address points to a private or internal network, which can't be scanned.", 422);
      if (/ERR_NAME_NOT_RESOLVED/i.test(msg)) throw new ScanAbort("We couldn't find that website. Check the address and try again.", 422);
      if (/ERR_CERT|SSL/i.test(msg)) throw new ScanAbort("This site's HTTPS certificate isn't valid, so browsers show visitors a security warning.", 422);
      if (/timeout/i.test(msg)) throw new ScanAbort("The website took too long to load, so the scan stopped.", 422);
      throw err;
    }
    await settle(page);

    let banner = await inspectBanner(page);
    cookiesBeforeChoice = new Set((await ctx.cookies()).map((c) => `${c.domain}|${c.name}`));
    let choice: PageCapture["choice"] = null;
    if (opts.state !== "none") {
      const r = await clickChoice(page, opts.state);
      choice = { attempted: opts.state, ...r };
      // Record what the site does after the choice, on a fresh load (PRD §5.1 steps 5–6).
      phase = "after-choice";
      if (r.clicked) await page.waitForTimeout(500);
      response = (await page.reload({ waitUntil: "domcontentloaded", timeout }).catch(() => null)) ?? response;
      await settle(page);
      banner = { ...(await inspectBanner(page)), cmp: banner.cmp };
    }

    const status = response?.status() ?? null;
    const title = await page.title().catch(() => "");
    const cookies: CapturedCookie[] = (await ctx.cookies()).map((c) => ({
      name: c.name,
      domain: c.domain,
      path: c.path,
      expires: c.expires,
      httpOnly: c.httpOnly,
      secure: c.secure,
      sameSite: c.sameSite,
      setBeforeChoice: cookiesBeforeChoice.has(`${c.domain}|${c.name}`),
      thirdParty: getRootDomain(c.domain.replace(/^\./, "")) !== siteRoot,
    }));
    const local = (await page.evaluate(() => Object.fromEntries(Object.entries(window.localStorage))).catch(() => ({}))) as Record<string, string>;
    const forms = await inspectForms(page);
    const isHttps = new URL(page.url()).protocol === "https:";
    const mixedContent = isHttps ? [...new Set(requests.filter((r) => r.url.startsWith("http:")).map((r) => r.url))].slice(0, 50) : [];
    const dom = await page.content().catch(() => "");
    const fold = await page.screenshot({ type: "png" }).catch(() => null);
    const full = await page.screenshot({ type: "png", fullPage: true, timeout: 15_000 }).catch(() => null);
    const finalUrl = page.url();
    await page.close();
    await ctx.close(); // flushes the HAR file

    const at = { pageId: opts.pageId, consentState: opts.state };
    const w = opts.writer;
    const evidence: EvidenceFile[] = [];
    evidence.push(await w.put("dom", dom, { ...at, contentType: "text/html" }));
    if (fold) evidence.push(await w.put("screenshot_fold", new Uint8Array(fold), { ...at, contentType: "image/png" }));
    if (full) evidence.push(await w.put("screenshot", new Uint8Array(full), { ...at, contentType: "image/png" }));
    const har = await readFile(harPath).catch(() => null);
    if (har) evidence.push(await w.put("har", new Uint8Array(har), { ...at, contentType: "application/json" }));
    evidence.push(await w.put("cookies", { cookies, localStorage: local }, at));
    evidence.push(await w.put("forms", { forms, banner, choice, requests, mixedContent, console: consoleMsgs, device, status, title, finalUrl }, at));

    return {
      pageId: opts.pageId,
      url: opts.url,
      finalUrl,
      pageType: opts.pageType,
      consentState: opts.state,
      device,
      status,
      title,
      choice,
      banner,
      requests,
      cookies,
      localStorage: local,
      console: consoleMsgs,
      forms,
      mixedContent,
      evidence,
      capturedAt: new Date(started).toISOString(),
      durationMs: Date.now() - started,
    };
  } finally {
    await ctx.close().catch(() => {});
    await rm(harDir, { recursive: true, force: true });
  }
}
