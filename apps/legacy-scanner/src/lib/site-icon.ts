import * as cheerio from "cheerio";
import type { BrowserContext } from "playwright";
import { assertPublicUrl, safeFetch } from "@/lib/net-guard";

const MAX_BYTES = 64 * 1024;
const TIMEOUT_MS = 5000;
const IMAGE_TYPES = /^image\/(png|x-icon|vnd\.microsoft\.icon|svg\+xml|jpeg|webp|gif)$/i;

/**
 * Picks the site's icon from its homepage HTML and returns it as a data URI,
 * so the report can show it without the visitor's browser contacting the
 * scanned site. Returns undefined if there is no usable icon.
 */
export async function fetchSiteIcon(html: string, pageUrl: string): Promise<string | undefined> {
  for (const url of iconCandidates(html, pageUrl)) {
    const icon = await download(url).catch(() => undefined);
    if (icon) return icon;
  }
  return undefined;
}

export function iconCandidates(html: string, pageUrl: string): string[] {
  const $ = cheerio.load(html);
  const found: Array<{ url: string; rank: number }> = [];
  $("link[rel][href]").each((_, el) => {
    const rel = ($(el).attr("rel") || "").toLowerCase();
    if (!/\bicon\b|apple-touch-icon/.test(rel)) return;
    const href = $(el).attr("href") || "";
    if (!href || href.startsWith("data:")) return;
    let url: string;
    try {
      url = new URL(href, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/.test(url)) return;
    const size = parseInt(($(el).attr("sizes") || "").split("x")[0], 10) || 0;
    // Prefer a crisp, small square: apple-touch-icon or an icon around 32-192px.
    let rank = rel.includes("apple-touch-icon") ? 3 : 2;
    if (size >= 32 && size <= 192) rank += 1;
    if (/\.svg(\?|$)/i.test(url)) rank += 1;
    found.push({ url, rank });
  });
  const ordered = found.sort((a, b) => b.rank - a.rank).map((f) => f.url);
  ordered.push(new URL("/favicon.ico", pageUrl).toString());
  return [...new Set(ordered)].slice(0, 4);
}

async function download(url: string): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await safeFetch(url, {
      signal: controller.signal,
      headers: { Accept: "image/*" },
    });
    if (!res.ok) return undefined;
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > MAX_BYTES) return undefined;
    return toDataUri(res.headers.get("content-type"), Buffer.from(await res.arrayBuffer()));
  } finally {
    clearTimeout(timer);
  }
}

function toDataUri(contentType: string | null | undefined, buf: Buffer): string | undefined {
  const type = (contentType || "").split(";")[0].trim();
  if (!IMAGE_TYPES.test(type)) return undefined;
  if (buf.length === 0 || buf.length > MAX_BYTES) return undefined;
  // SVGs can carry scripts; they are only ever shown through <img>, where scripts don't run.
  return `data:${type};base64,${buf.toString("base64")}`;
}

/**
 * Same as fetchSiteIcon, but uses the scan's browser session. Sites behind
 * bot protection (Cloudflare and similar) refuse plain server requests, so if
 * a direct request fails we open the icon URL as a real page visit, which they
 * accept. The context's network guard still blocks private addresses, and we
 * check each URL first too.
 */
export async function fetchSiteIconInBrowser(
  ctx: BrowserContext,
  html: string,
  pageUrl: string
): Promise<string | undefined> {
  const candidates = iconCandidates(html, pageUrl);

  // 1. Quick direct requests.
  for (const url of candidates) {
    try {
      await assertPublicUrl(url);
      const res = await ctx.request.get(url, { timeout: TIMEOUT_MS, failOnStatusCode: false, maxRedirects: 3 });
      if (res.ok()) {
        const icon = toDataUri(res.headers()["content-type"], await res.body());
        if (icon) return icon;
      }
    } catch {
      // Try the next one.
    }
  }

  // 2. Real page visits, for sites that block direct requests.
  const page = await ctx.newPage().catch(() => null);
  if (!page) return undefined;
  try {
    for (const url of candidates.slice(0, 2)) {
      try {
        await assertPublicUrl(url);
        const res = await page.goto(url, { timeout: TIMEOUT_MS + 3000, waitUntil: "load" });
        if (res?.ok()) {
          const icon = toDataUri(res.headers()["content-type"], await res.body());
          if (icon) return icon;
        }
      } catch {
        // Try the next one.
      }
    }
    return undefined;
  } finally {
    await page.close().catch(() => {});
  }
}
