import { NextResponse } from "next/server";
import type { AISettings, ScanComparison, ScanProgress, ScanRequest, ScanResult } from "@/types/audit";
import { runWebsiteAudit } from "@/lib/scanner";
import { ScanAbort } from "@/lib/net-guard";
import { isReportId, loadReport, saveReport } from "@/lib/report-store";
import { clientIp, identify, quotaCookie, reserve, type QuotaIdentity } from "@/lib/ai-quota";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A full scan visits several pages and tests the cookie banner twice.
// Hosts that cap functions at 60s will cut long scans short.
export const maxDuration = 120;

/* Each scan starts a real browser, so keep the endpoint from being flooded. */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = Number(process.env.SCAN_RATE_LIMIT ?? 8);
const MAX_CONCURRENT = Number(process.env.SCAN_MAX_CONCURRENT ?? 2);

const recent = new Map<string, number[]>();
let running = 0;

function rateLimited(key: string): number | null {
  const now = Date.now();
  const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(key, hits);
    return Math.ceil((WINDOW_MS - (now - hits[0])) / 1000);
  }
  hits.push(now);
  recent.set(key, hits);
  if (recent.size > 5000) {
    for (const [k, v] of recent) if (v.every((t) => now - t >= WINDOW_MS)) recent.delete(k);
  }
  return null;
}

/*
 * Other websites may call this API only if their origin is listed in
 * ALLOWED_ORIGINS (comma-separated, e.g. "https://example.com,https://app.example.com").
 * Leave it empty to allow only this app's own pages (same origin, no CORS needed).
 */
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  if (!origin) return {};
  const allowed = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin);
  if (!allowed) return {};
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes("*") ? "*" : origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/*
 * Our OpenRouter key, used for one free AI review per person per day
 * (see lib/ai-quota.ts). Without it, scans run on the rules engine only.
 */
const SERVER_AI: AISettings | null = process.env.OPENROUTER_API_KEY?.trim()
  ? {
      apiKey: process.env.OPENROUTER_API_KEY.trim(),
      model: process.env.OPENROUTER_MODEL?.trim() || undefined,
    }
  : null;

function isHttps(request: Request): boolean {
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return proto ? proto === "https" : new URL(request.url).protocol === "https:";
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  const response = await handleScan(request);
  for (const [k, v] of Object.entries(corsHeaders(request))) response.headers.set(k, v);
  return response;
}

async function handleScan(request: Request): Promise<Response> {
  let body: Partial<ScanRequest>;
  try {
    body = (await request.json()) as Partial<ScanRequest>;
  } catch {
    return NextResponse.json({ error: "Please provide a valid website URL to scan." }, { status: 400 });
  }
  if (!body?.url || typeof body.url !== "string" || body.url.length > 2048) {
    return NextResponse.json({ error: "Please provide a valid website URL to scan." }, { status: 400 });
  }

  const retryAfter = rateLimited(clientIp(request));
  if (retryAfter !== null) {
    return NextResponse.json(
      { error: `You've run a lot of scans. Try again in about ${Math.ceil(retryAfter / 60)} minute(s).` },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }
  if (running >= MAX_CONCURRENT) {
    return NextResponse.json(
      { error: "The scanner is busy with other scans. Try again in a minute." },
      { status: 503, headers: { "Retry-After": "30" } }
    );
  }

  // One AI review per person per day on our key.
  let ai: AISettings | undefined;
  let identity: QuotaIdentity | null = null;
  let release: (() => void) | null = null;
  let aiNotice: string | undefined;
  if (SERVER_AI) {
    identity = identify(request);
    const claim = reserve(identity);
    if (claim.ok) {
      ai = SERVER_AI;
      release = claim.release;
    } else {
      aiNotice = claim.message;
    }
  }

  const url = body.url;
  const previousId = typeof body.previous === "string" && isReportId(body.previous) ? body.previous : null;

  const audit = async (onProgress?: ScanProgress): Promise<ScanResult> => {
    try {
      const result = await runWebsiteAudit(url, ai, onProgress);
      // Only count it if the AI actually reviewed something (no policy = no review).
      if (release && result.policy.source !== "rules+ai") release();
      if (aiNotice && result.policy.found) result.policy.aiNotice = aiNotice;
      if (previousId) {
        const prev = await loadReport(previousId);
        if (prev && sameSite(prev.finalUrl, result.finalUrl)) result.previous = summarise(prev, previousId);
      }
      const shareId = await saveReport(result);
      if (shareId) result.shareId = shareId;
      return result;
    } catch (error) {
      release?.();
      throw error;
    }
  };

  const cookie = identity?.newCookie ? quotaCookie(identity, isHttps(request)) : null;
  running += 1;

  if (body.stream) {
    // Server-sent events: one "progress" per stage, then "result" or "error".
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            /* client went away */
          }
        };
        try {
          const result = await audit((stage, detail) => send("progress", { stage, detail }));
          send("result", result);
        } catch (error) {
          const { message, status } = errorBody(error);
          send("error", { error: message, status });
        } finally {
          running -= 1;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        }
      },
    });
    const headers: Record<string, string> = {
      "Content-Type": "text/event-stream; charset=utf-8",
      // no-transform keeps proxies (Caddy's encode) from buffering the events.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    };
    if (cookie) headers["Set-Cookie"] = cookie;
    return new Response(stream, { headers });
  }

  try {
    const response = NextResponse.json(await audit());
    if (cookie) response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    const { message, status } = errorBody(error);
    return NextResponse.json({ error: message }, { status });
  } finally {
    running -= 1;
  }
}

function errorBody(error: unknown): { message: string; status: number } {
  if (error instanceof ScanAbort) return { message: error.message, status: error.status };
  console.error("[scan] failed:", error);
  return { message: "The scan couldn't finish. The site may be slow or unreachable. Try again.", status: 500 };
}

function sameSite(a: string, b: string): boolean {
  try {
    const host = (u: string) => new URL(u).hostname.replace(/^www\./, "");
    return host(a) === host(b);
  } catch {
    return false;
  }
}

function summarise(prev: ScanResult, shareId: string): ScanComparison {
  return {
    shareId,
    scannedAt: prev.scannedAt,
    score: prev.score,
    grade: prev.grade,
    checks: prev.checks.map((c) => ({ id: c.id, title: c.title, status: c.status })),
  };
}
