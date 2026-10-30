import { NextResponse } from "next/server";
import type { ScanRequest } from "@/types/audit";
import { runWebsiteAudit } from "@/lib/scanner";
import { ScanAbort } from "@/lib/net-guard";

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

function clientKey(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || request.headers.get("x-real-ip") || "local").trim();
}

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

  const retryAfter = rateLimited(clientKey(request));
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

  running += 1;
  try {
    const result = await runWebsiteAudit(body.url, body.ai);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ScanAbort) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[scan] failed:", error);
    return NextResponse.json(
      { error: "The scan couldn't finish. The site may be slow or unreachable. Try again." },
      { status: 500 }
    );
  } finally {
    running -= 1;
  }
}
