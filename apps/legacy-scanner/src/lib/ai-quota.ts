import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/*
 * Limits how often the server's own AI key is used, so one person can't run
 * up the bill.
 *
 * A person is recognised three ways, and any one of them hitting the limit
 * counts as "already used today":
 *   - a random ID in a cookie (set by us, only used for this limit)
 *   - a hash of IP + browser user agent + language (no client-side script)
 *   - the IP alone, with a looser cap, since mobile networks share IPs
 * There is also a total cap per day across everyone, which is what really
 * protects the key.
 *
 * Only salted hashes are stored, never raw IPs or user agents, and entries
 * older than 24 hours are dropped.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const PER_PERSON = positive(process.env.AI_FREE_PER_PERSON_PER_DAY, 1);
const PER_IP = positive(process.env.AI_FREE_PER_IP_PER_DAY, 20);
const TOTAL = positive(process.env.AI_FREE_TOTAL_PER_DAY, 300);
const QUOTA_FILE = process.env.AI_QUOTA_FILE || path.join(process.cwd(), "data", "ai-quota.json");

export const QUOTA_COOKIE = "ndpa_aid";

interface QuotaState {
  salt: string;
  /** hashed identity -> timestamps of AI reviews in the last 24h */
  uses: Record<string, number[]>;
  total: number[];
}

let state: QuotaState | null = null;

function positive(raw: string | undefined, fallback: number): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function load(): QuotaState {
  if (state) return state;
  try {
    const parsed = JSON.parse(fs.readFileSync(QUOTA_FILE, "utf8")) as QuotaState;
    if (parsed?.salt && parsed.uses && Array.isArray(parsed.total)) state = parsed;
  } catch {
    // No file yet, or unreadable: start fresh.
  }
  state ??= { salt: randomBytes(16).toString("hex"), uses: {}, total: [] };
  return state;
}

function save() {
  if (!state) return;
  try {
    fs.mkdirSync(path.dirname(QUOTA_FILE), { recursive: true });
    const tmp = `${QUOTA_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, QUOTA_FILE);
  } catch (err) {
    // Limits still work in memory; they just won't survive a restart.
    console.error("[ai-quota] could not save:", err instanceof Error ? err.message : err);
  }
}

function prune(now: number) {
  const s = load();
  const fresh = (list: number[]) => list.filter((t) => now - t < DAY_MS);
  for (const [k, v] of Object.entries(s.uses)) {
    const kept = fresh(v);
    if (kept.length) s.uses[k] = kept;
    else delete s.uses[k];
  }
  s.total = fresh(s.total);
}

function hash(kind: string, value: string): string {
  return createHash("sha256").update(`${load().salt}|${kind}|${value}`).digest("hex").slice(0, 32);
}

export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] || request.headers.get("x-real-ip") || "local").trim();
}

function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export interface QuotaIdentity {
  cookieId: string;
  /** True when we need to set the cookie on the response. */
  newCookie: boolean;
  keys: { person: string; device: string; ip: string };
}

export function identify(request: Request): QuotaIdentity {
  const existing = readCookie(request, QUOTA_COOKIE);
  const valid = existing && /^[0-9a-f-]{36}$/i.test(existing);
  const cookieId = valid ? existing : randomUUID();
  const ip = clientIp(request);
  const device = [
    ip,
    request.headers.get("user-agent") || "",
    request.headers.get("accept-language") || "",
  ].join("|");
  return {
    cookieId,
    newCookie: !valid,
    keys: {
      person: hash("cookie", cookieId),
      device: hash("device", device),
      ip: hash("ip", ip),
    },
  };
}

export function quotaCookie(id: QuotaIdentity, secure: boolean): string {
  return [
    `${QUOTA_COOKIE}=${id.cookieId}`,
    "Path=/api",
    `Max-Age=${60 * 60 * 24 * 30}`,
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function hoursUntilFree(list: number[], limit: number, now: number): number {
  const sorted = [...list].sort((a, b) => a - b);
  const oldestBlocking = sorted[sorted.length - limit] ?? now;
  return Math.max(1, Math.ceil((oldestBlocking + DAY_MS - now) / 3_600_000));
}

export type Reservation =
  | { ok: true; release: () => void }
  | { ok: false; message: string };

/**
 * Claims one free AI review for this person, or explains why not.
 * Call release() if the AI review didn't actually run, so it isn't counted.
 */
export function reserve(id: QuotaIdentity, now = Date.now()): Reservation {
  prune(now);
  const s = load();
  const { person, device, ip } = id.keys;
  const used = (k: string) => s.uses[k] ?? [];

  const personLimited = [person, device].find((k) => used(k).length >= PER_PERSON);
  if (personLimited) {
    const h = hoursUntilFree(used(personLimited), PER_PERSON, now);
    return {
      ok: false,
      message: `You've used today's free AI review. It resets in about ${h} hour${h === 1 ? "" : "s"}.`,
    };
  }
  if (used(ip).length >= PER_IP) {
    return {
      ok: false,
      message: "Today's free AI reviews for your network are used up. Try again tomorrow.",
    };
  }
  if (s.total.length >= TOTAL) {
    return {
      ok: false,
      message: "Today's free AI reviews are used up. Try again tomorrow.",
    };
  }

  for (const k of [person, device, ip]) s.uses[k] = [...used(k), now];
  s.total.push(now);
  save();

  let released = false;
  return {
    ok: true,
    release: () => {
      if (released) return;
      released = true;
      for (const k of [person, device, ip]) {
        const list = s.uses[k];
        if (!list) continue;
        const i = list.lastIndexOf(now);
        if (i >= 0) list.splice(i, 1);
        if (!list.length) delete s.uses[k];
      }
      const t = s.total.lastIndexOf(now);
      if (t >= 0) s.total.splice(t, 1);
      save();
    },
  };
}
