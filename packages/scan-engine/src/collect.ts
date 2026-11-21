import type { ConsentState } from "@ndpa/schema";
import type { Browser } from "playwright";
import { capturePage, type PageCapture } from "./capture.js";
import { discoverFromLinks, type DiscoveredPage } from "./discover.js";
import type { EvidenceFile, EvidenceWriter } from "./evidence.js";
import { type NetPolicy, vetHost } from "./net-policy.js";
import { extractReadablePolicyText } from "./policy-analyzer.js";
import { type Preflight, preflight } from "./preflight.js";
import { getRootDomain } from "./trackers.js";

/** Bump when capture or collection behaviour changes; findings record it (§5.4). */
export const ENGINE_VERSION = "1.0.0";
export const BUNDLE_SCHEMA = "ndpa-lens/bundle@1" as const;
export const STATES: ConsentState[] = ["none", "reject", "accept"];

export interface Flow {
  host: string;
  ip: string | null;
  country: string | null;
  asn: number | null;
  asOrg: string | null;
  /** Earliest consent state and phase in which the host was contacted (FLOW-01). */
  firstSeen: { state: ConsentState; phase: "initial" | "after-choice" };
  requestCount: number;
}

/** Everything the checks read. Plain JSON; checks never touch the network (§5.4). */
export interface EvidenceBundle {
  schema: typeof BUNDLE_SCHEMA;
  engineVersion: string;
  target: { url: string; hostname: string };
  preflight: Preflight;
  discovered: DiscoveredPage[];
  pages: Array<Omit<PageCapture, "html">>;
  homeLinks: Array<{ href: string; text: string }>;
  policy: { url: string | null; title: string | null; text: string; found: boolean };
  flows: Flow[];
  evidence: EvidenceFile[];
}

export interface GeoLike {
  lookup(ip: string): { country: string | null; asn: number | null; asOrg: string | null };
}

export interface CollectOptions {
  url: string;
  namedUrls?: string[];
  maxPages?: number;
  states?: ConsentState[];
  policy: NetPolicy;
  writer: EvidenceWriter;
  browser: Browser;
  geo?: GeoLike | null;
  /** Pages captured in parallel (PRD §10: 2 on the Stage 1 VPS). */
  concurrency?: number;
  egressEchoUrl?: string;
  tlsCa?: string;
  onProgress?: (e: { phase: "preflight" | "discovering" | "capturing" | "checking"; pageDone: number; pageTotal: number; detail?: string }) => void;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<void>) {
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(n, items.length)) }, async () => {
      while (i < items.length) await fn(items[i++]!);
    }),
  );
}

/**
 * PRD §5.1 steps 1–8: preflight, discover, capture each page in every
 * consent state (plus a Pixel 7 homepage pass), fetch the policy text and map
 * third-party data flows. Returns the evidence bundle the checks run over.
 */
export async function collectEvidence(opts: CollectOptions): Promise<EvidenceBundle> {
  const states = opts.states ?? STATES;
  const progress = opts.onProgress ?? (() => {});
  progress({ phase: "preflight", pageDone: 0, pageTotal: 0 });
  const pre = await preflight(opts.url, { policy: opts.policy, egressEchoUrl: opts.egressEchoUrl, tlsCa: opts.tlsCa });
  await opts.writer.put("preflight", pre);

  const home = pre.finalUrl;
  const common = { policy: opts.policy, writer: opts.writer, ignoreTlsErrors: true } as const;

  // Discover from the homepage as first seen (no interaction).
  progress({ phase: "discovering", pageDone: 0, pageTotal: 0, detail: home });
  const homeNone = await capturePage(opts.browser, { ...common, url: home, pageId: "p00", pageType: "home", state: "none" });
  const discovered = discoverFromLinks(homeNone.links, home, opts.namedUrls ?? [], opts.maxPages);

  const jobs: Array<{ page: DiscoveredPage; pageId: string; state: ConsentState; device: "desktop" | "mobile" }> = [];
  discovered.forEach((page, i) => {
    const pageId = `p${String(i).padStart(2, "0")}`;
    for (const state of states) if (!(i === 0 && state === "none")) jobs.push({ page, pageId, state, device: "desktop" });
  });
  jobs.push({ page: discovered[0]!, pageId: "p00m", state: "none", device: "mobile" });

  const captures: PageCapture[] = [homeNone];
  let done = 1;
  const total = jobs.length + 1;
  await pool(jobs, opts.concurrency ?? 2, async (j) => {
    progress({ phase: "capturing", pageDone: done, pageTotal: total, detail: `${new URL(j.page.url).pathname} (${j.state}${j.device === "mobile" ? ", mobile" : ""})` });
    try {
      captures.push(await capturePage(opts.browser, { ...common, url: j.page.url, pageId: j.pageId, pageType: j.page.pageType, state: j.state, device: j.device }));
    } catch (e) {
      // One page failing (timeout, 404 page) doesn't sink the scan; the homepage must work.
      if (j.pageId === "p00") throw e;
    }
    done++;
  });
  // Stable order regardless of completion order (§5.4).
  const order = (c: PageCapture) => `${c.pageId}|${STATES.indexOf(c.consentState)}|${c.device}`;
  captures.sort((a, b) => order(a).localeCompare(order(b)));

  // Policy text (§5.1 step 8): the discovered policy page, else the homepage's policy link.
  const policyPage = captures.find((c) => c.pageType === "policy" && c.consentState === "none" && c.device === "desktop");
  let policy: EvidenceBundle["policy"] = { url: homeNone.policyLink, title: null, text: "", found: false };
  if (policyPage?.html) {
    const { title, text } = extractReadablePolicyText(policyPage.html);
    policy = { url: policyPage.finalUrl, title, text, found: text.length > 200 };
  }
  if (policy.found) await opts.writer.put("policy_text", policy.text, { contentType: "text/plain" });

  // Third-party flows (FLOW-01): every external host, resolved and geolocated.
  const root = getRootDomain(new URL(home).hostname);
  const byHost = new Map<string, Flow>();
  for (const c of captures) {
    for (const r of c.requests) {
      if (getRootDomain(r.host) === root) continue;
      const f = byHost.get(r.host);
      const rank = STATES.indexOf(c.consentState) * 2 + (r.phase === "after-choice" ? 1 : 0);
      if (!f) byHost.set(r.host, { host: r.host, ip: null, country: null, asn: null, asOrg: null, firstSeen: { state: c.consentState, phase: r.phase }, requestCount: 1 });
      else {
        f.requestCount++;
        if (rank < STATES.indexOf(f.firstSeen.state) * 2 + (f.firstSeen.phase === "after-choice" ? 1 : 0)) f.firstSeen = { state: c.consentState, phase: r.phase };
      }
    }
  }
  for (const f of byHost.values()) {
    try {
      f.ip = (await vetHost(f.host, opts.policy))[0] ?? null;
      const g = f.ip && opts.geo ? opts.geo.lookup(f.ip) : null;
      if (g) Object.assign(f, { country: g.country, asn: g.asn, asOrg: g.asOrg });
    } catch {
      /* unresolvable or private: recorded without an address */
    }
  }
  const flows = [...byHost.values()].sort((a, b) => a.host.localeCompare(b.host));
  progress({ phase: "checking", pageDone: total, pageTotal: total });

  return {
    schema: BUNDLE_SCHEMA,
    engineVersion: ENGINE_VERSION,
    target: { url: opts.url, hostname: new URL(home).hostname },
    preflight: pre,
    discovered,
    pages: captures.map(({ html: _html, ...rest }) => rest),
    homeLinks: homeNone.links,
    policy,
    flows,
    evidence: opts.writer.files,
  };
}
