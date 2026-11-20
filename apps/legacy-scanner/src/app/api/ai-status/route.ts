import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tells the page whether free AI reviews (our OpenRouter key) are available. */
export function GET() {
  const free = Boolean(process.env.OPENROUTER_API_KEY?.trim());
  return NextResponse.json({ free });
}
