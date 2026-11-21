import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { ScanResult } from "@ndpa/scan-engine/types";

/*
 * Saves finished scans so a report survives a refresh and can be shared by link.
 *
 * One JSON file per report in data/reports/. The file name is a random,
 * unguessable ID: anyone with the link can open the report, nobody can list
 * them. Reports only hold what the public website showed.
 *
 * Old reports are deleted after REPORT_TTL_DAYS (default 30), and the folder
 * is capped at REPORT_MAX_COUNT files (default 5000, oldest go first).
 */

const DIR = process.env.REPORT_DIR || path.join(process.cwd(), "data", "reports");
const TTL_MS = positive(process.env.REPORT_TTL_DAYS, 30) * 24 * 60 * 60 * 1000;
const MAX_COUNT = positive(process.env.REPORT_MAX_COUNT, 5000);
const PRUNE_EVERY_MS = 60 * 60 * 1000;

const ID_RE = /^[A-Za-z0-9_-]{16}$/;
let lastPrune = 0;

function positive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function isReportId(id: string): boolean {
  return ID_RE.test(id);
}

/** Saves the report and returns its share ID, or null if the disk write failed. */
export async function saveReport(result: ScanResult): Promise<string | null> {
  const id = randomBytes(12).toString("base64url"); // 16 chars
  try {
    await fs.mkdir(DIR, { recursive: true });
    const file = path.join(DIR, `${id}.json`);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify({ ...result, shareId: id }));
    await fs.rename(tmp, file);
  } catch (err) {
    console.error("[report-store] could not save:", err instanceof Error ? err.message : err);
    return null;
  }
  void maybePrune();
  return id;
}

export async function loadReport(id: string): Promise<ScanResult | null> {
  if (!isReportId(id)) return null;
  const file = path.join(DIR, `${id}.json`);
  try {
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > TTL_MS) return null;
    return JSON.parse(await fs.readFile(file, "utf8")) as ScanResult;
  } catch {
    return null;
  }
}

async function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < PRUNE_EVERY_MS) return;
  lastPrune = now;
  try {
    const names = (await fs.readdir(DIR)).filter((n) => n.endsWith(".json"));
    const files = await Promise.all(
      names.map(async (n) => {
        const p = path.join(DIR, n);
        try {
          return { p, t: (await fs.stat(p)).mtimeMs };
        } catch {
          return null;
        }
      })
    );
    const live = files.filter((f): f is { p: string; t: number } => !!f).sort((a, b) => b.t - a.t);
    const doomed = live.filter((f, i) => now - f.t > TTL_MS || i >= MAX_COUNT);
    await Promise.all(doomed.map((f) => fs.unlink(f.p).catch(() => {})));
  } catch {
    // Folder missing or unreadable; try again next hour.
  }
}
