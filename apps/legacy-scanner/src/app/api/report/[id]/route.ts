import { NextResponse } from "next/server";
import { loadReport } from "@/lib/report-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns a saved report by its share ID. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await loadReport(id);
  if (!report) {
    return NextResponse.json(
      { error: "This report has expired or the link is wrong. Run a new scan." },
      { status: 404 }
    );
  }
  return NextResponse.json(report, {
    headers: { "Cache-Control": "private, max-age=300", "X-Robots-Tag": "noindex" },
  });
}
