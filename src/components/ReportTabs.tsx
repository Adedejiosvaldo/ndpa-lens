"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  Inbox,
  Info,
  Lock,
  Radar,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type {
  CheckStatus,
  PillarId,
  RemediationProfile,
  ScanResult,
} from "@/types/audit";
import type { RemediationArtifact } from "@/lib/remediation";
import {
  Badge,
  Box,
  BoxHeader,
  Button,
  Counter,
  Disclosure,
  EmptyState,
  ProgressBar,
  SectionHeading,
  SegmentedControl,
  Stat,
  checkLabel,
  checkTone,
  clauseLabel,
  clauseTone,
  cx,
  downloadBlob,
  hostOf,
  scoreTone,
  toneText,
  type Tone,
} from "./ui";

const STATUS_ICON: Record<CheckStatus, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  fail: XCircle,
  info: Circle,
};

const RISK_TONE: Record<ScanResult["riskLevel"], Tone> = {
  Low: "ok",
  Moderate: "warn",
  High: "bad",
  Critical: "bad",
};

/* ================================================================== */
/* Step 1: Results                                                     */
/* ================================================================== */

type IssueFilter = "open" | "pass" | "all";

const STATUS_RANK: Record<CheckStatus, number> = { fail: 0, warning: 1, info: 2, pass: 3 };

export function ResultsTab({
  result,
  linkable,
}: {
  result: ScanResult;
  linkable: boolean;
}) {
  const [filter, setFilter] = useState<IssueFilter>("open");
  const [pillar, setPillar] = useState<PillarId | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const pass = result.checks.filter((c) => c.status === "pass").length;
  const warn = result.checks.filter((c) => c.status === "warning").length;
  const fail = result.checks.filter((c) => c.status === "fail").length;
  const total = Math.max(1, pass + warn + fail);

  const isOpenIssue = (s: CheckStatus) => s === "fail" || s === "warning";
  const inPillar = result.checks.filter((c) => !pillar || c.pillar === pillar);
  const openCount = inPillar.filter((c) => isOpenIssue(c.status)).length;
  const passCount = inPillar.filter((c) => c.status === "pass").length;
  const shown = inPillar
    .filter((c) =>
      filter === "all" ? true : filter === "pass" ? c.status === "pass" : isOpenIssue(c.status)
    )
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        b.maxScore - b.score - (a.maxScore - a.score)
    );
  const pillarLabel = result.pillars.find((p) => p.id === pillar)?.label;
  const clausesFound = result.policy.clauses.filter((c) => c.status === "found").length;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        <ScanLimits result={result} />

        {/* score */}
        <Box>
          <div className="grid gap-6 p-5 sm:grid-cols-[auto_1fr] sm:items-center">
            <div>
            <div className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">Website readiness</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span
                className={cx(
                  "text-6xl font-semibold tabular-nums tracking-[-0.04em]",
                  toneText[scoreTone(result.score)]
                )}
              >
                {result.score}
              </span>
              <span className="text-lg text-fg-subtle">/100</span>
            </div>
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-fg">Readiness grade {result.grade}</span>
                <Badge tone={RISK_TONE[result.riskLevel]}>{result.riskLevel} risk</Badge>
              </div>
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-track">
                <div className="bg-ok" style={{ width: `${(pass / total) * 100}%` }} />
                <div className="bg-bar-warn" style={{ width: `${(warn / total) * 100}%` }} />
                <div className="bg-bad" style={{ width: `${(fail / total) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
                <Legend color="bg-ok" label={`${pass} passed`} />
                <Legend color="bg-bar-warn" label={`${warn} warnings`} />
                <Legend color="bg-bad" label={`${fail} failed`} />
              </div>
            </div>
          </div>
          <p className="border-t border-line px-5 py-3 text-2xs leading-relaxed text-fg-muted">
            Based only on what your public website shows. This is not a compliance audit or legal advice.
            Organisations that must file a yearly audit (Compliance Audit Return) file it through an NDPC-licensed
            DPCO.
          </p>
        </Box>

        {/* issues */}
        <Box>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-fg">Issues</h3>
              {pillar && (
                <button
                  type="button"
                  onClick={() => setPillar(null)}
                  aria-label={`Clear ${pillarLabel} filter`}
                  className="inline-flex items-center gap-1 rounded-full border border-line-strong bg-subtle px-2 py-px text-2xs font-medium text-fg hover:bg-line"
                >
                  {pillarLabel}
                  <XCircle className="h-3 w-3 text-fg-subtle" />
                </button>
              )}
            </div>
            <SegmentedControl
              ariaLabel="Filter issues"
              value={filter}
              onChange={setFilter}
              options={[
                { id: "open", label: "To fix", count: openCount },
                { id: "pass", label: "Passed", count: passCount },
                { id: "all", label: "All", count: inPillar.length },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <EmptyState
              icon={filter === "open" ? ShieldCheck : Inbox}
              title={filter === "open" ? "Nothing to fix here" : "No checks here"}
            />
          ) : (
            <ul className="divide-y divide-line">
              {shown.map((c) => {
                const Icon = STATUS_ICON[c.status];
                const isOpen = !!open[c.id];
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}
                      className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-subtle"
                    >
                      <Icon className={cx("mt-0.5 h-4 w-4 shrink-0", toneText[checkTone(c.status)])} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-semibold text-fg">{c.title}</div>
                        <p className="mt-0.5 text-xs text-fg-muted">{c.summary}</p>
                      </div>
                      <ChevronRight
                        className={cx(
                          "mt-0.5 h-4 w-4 shrink-0 text-fg-subtle transition-transform",
                          isOpen && "rotate-90"
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="animate-fade-in space-y-4 border-t border-line bg-subtle/60 px-4 py-4 pl-11">
                        <div>
                          <div className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                            How to fix
                          </div>
                          <p className="mt-1.5 text-[13px] leading-relaxed text-fg">{c.recommendation}</p>
                        </div>
                        <div>
                          <div className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">
                            What we saw
                          </div>
                          <ul className="mt-1.5 space-y-1">
                            {c.evidence.map((e, i) => (
                              <li
                                key={i}
                                className="break-words rounded-md border border-line bg-surface px-2.5 py-1.5 font-mono text-2xs text-fg"
                              >
                                {e}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="flex flex-wrap gap-x-4 text-2xs text-fg-subtle">
                          <span className="font-mono">{c.legalReference}</span>
                          <span className="tabular-nums">
                            {c.score}/{c.maxScore} points
                          </span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Box>

        {/* raw evidence, collapsed by default */}
        <div className="space-y-3">
          <div className="text-xs font-medium text-fg-muted">Details</div>
          <Disclosure
            title="Cookie banner test"
            description="What happened when we clicked Reject and Accept."
            meta={consentMeta(result)}
          >
            <ConsentTestPanel result={result} />
          </Disclosure>
          <Disclosure
            title="Pages we checked"
            description="Where personal data is usually collected: sign-up, login, checkout."
            meta={`${(result.pages ?? []).filter((p) => !p.blocked).length || 1} page(s)`}
          >
            <PagesPanel result={result} linkable={linkable} />
          </Disclosure>
          <Disclosure
            title="Privacy policy"
            description="Which required clauses the policy contains."
            meta={`${clausesFound} of ${result.policy.clauses.length} present`}
          >
            <PolicyTab result={result} linkable={linkable} embedded />
          </Disclosure>
          <Disclosure
            title="Cookies, trackers & headers"
            description="What the page loaded before anyone consented."
            meta={`${result.cookies.length} cookies · ${result.trackers.length} trackers`}
          >
            <TelemetryTab result={result} />
          </Disclosure>
          <Disclosure
            title="Evidence"
            description="Screenshots and a timed network log, for your records or your auditor."
            meta={`${result.evidence?.screenshots.length ?? 0} screenshots · ${result.evidence?.networkLog.length ?? 0} requests`}
          >
            <EvidencePanel result={result} />
          </Disclosure>
        </div>
      </div>

      {/* sidebar */}
      <aside className="space-y-6">
        <Box>
          <BoxHeader title="By area" description="Select one to filter the issues." />
          <ul className="divide-y divide-line">
            {result.pillars.map((p) => {
              const active = pillar === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setPillar(active ? null : p.id)}
                    aria-pressed={active}
                    className={cx(
                      "relative w-full px-4 py-3 text-left hover:bg-subtle",
                      active && "bg-subtle"
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg" />}
                    <div className="flex items-center justify-between text-[13px]">
                      <span className="font-medium text-fg">{p.label}</span>
                      <span className="tabular-nums text-fg-muted">
                        {p.score}/{p.maxScore}
                      </span>
                    </div>
                    <ProgressBar value={p.percentage} tone={scoreTone(p.percentage)} className="mt-2" />
                  </button>
                </li>
              );
            })}
          </ul>
        </Box>

        <Box>
          <BoxHeader title="At a glance" />
          <dl className="divide-y divide-line text-[13px]">
            <Signal label="HTTPS" ok={result.technical.https} />
            <Signal label="Consent banner" ok={result.technical.bannerDetected} />
            <Signal label="Reject option" ok={result.technical.bannerHasReject} />
            {result.technical.consentTest?.rejectClicked && (
              <Signal
                label="Reject stops tracking"
                ok={
                  result.technical.consentTest.trackersAfterReject.length +
                    result.technical.consentTest.cookiesAfterReject.length ===
                  0
                }
              />
            )}
            <Signal label="Privacy policy" ok={result.policy.found} />
            <Row
              label="Cookies before any choice"
              value={result.technical.preConsentCookieCount}
              bad={result.technical.preConsentCookieCount > 0}
            />
            <Row label="Third-party trackers" value={result.trackers.length} bad={result.trackers.length > 0} />
          </dl>
        </Box>
      </aside>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx("h-2 w-2 rounded-full", color)} />
      {label}
    </span>
  );
}

function Signal({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cx("inline-flex items-center gap-1 font-medium", ok ? "text-ok" : "text-bad")}>
        {ok ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {ok ? "Yes" : "No"}
      </dd>
    </div>
  );
}

function Row({ label, value, bad }: { label: string; value: number; bad: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-fg-muted">{label}</dt>
      <dd className={cx("font-medium tabular-nums", bad ? "text-warn" : "text-fg")}>{value}</dd>
    </div>
  );
}

/* ================================================================== */
/* Scan limits, cookie banner test, pages checked, evidence            */
/* ================================================================== */

function ScanLimits({ result }: { result: ScanResult }) {
  const limits = result.metadata.limitations ?? [];
  if (limits.length === 0) return null;
  const limited = result.metadata.engine !== "browser";
  return (
    <div
      className={cx(
        "rounded-lg border px-4 py-3 text-[13px]",
        limited ? "border-warn-line bg-warn-subtle" : "border-line bg-surface"
      )}
    >
      <div className={cx("flex items-center gap-2 font-semibold", limited ? "text-warn" : "text-fg")}>
        {limited ? <AlertTriangle className="h-4 w-4" /> : <Info className="h-4 w-4 text-fg-subtle" />}
        {limited ? "Limited scan" : "What this scan can't see"}
      </div>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-xs text-fg-muted">
        {limits.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </div>
  );
}

function consentMeta(result: ScanResult): string {
  const c = result.technical.consentTest;
  if (!c?.tested) return "Not tested";
  if (!c.bannerVisible) return "No banner";
  if (!c.rejectFound) return "No Reject button";
  if (!c.rejectClicked) return "Couldn't click Reject";
  return c.trackersAfterReject.length + c.cookiesAfterReject.length === 0 ? "Reject works" : "Reject ignored";
}

function ConsentTestPanel({ result }: { result: ScanResult }) {
  const c = result.technical.consentTest;
  if (!c?.tested) {
    return (
      <p className="text-[13px] text-fg-muted">
        Not tested. Clicking the banner&apos;s buttons needs a real browser, which wasn&apos;t available for this scan.
      </p>
    );
  }
  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "None");
  const steps: Array<{ label: string; detail: string; ok: boolean | null }> = [
    {
      label: "1. First visit, before choosing",
      detail: c.bannerVisible
        ? `Banner shown${c.bannerAboveFold ? "" : ", but only after scrolling"}. Trackers already loading: ${list(c.trackersBeforeConsent)}.`
        : `No banner shown. Trackers loading: ${list(c.trackersBeforeConsent)}.`,
      ok: c.trackersBeforeConsent.length === 0,
    },
    {
      label: "2. Clicked Reject, then reloaded",
      detail: !c.rejectFound
        ? "There was no Reject button to click."
        : !c.rejectClicked
        ? `Found "${c.rejectLabel}" but couldn't click it.`
        : `Clicked "${c.rejectLabel}". Trackers still loading: ${list(c.trackersAfterReject)}. New cookies: ${list(c.cookiesAfterReject)}.`,
      ok: c.rejectClicked ? c.trackersAfterReject.length + c.cookiesAfterReject.length === 0 : c.rejectFound ? null : false,
    },
    {
      label: "3. Clicked Accept, then reloaded (for comparison)",
      detail: !c.acceptFound
        ? "There was no Accept button to click."
        : !c.acceptClicked
        ? `Found "${c.acceptLabel}" but couldn't click it.`
        : `Clicked "${c.acceptLabel}". Trackers loading: ${list(c.trackersAfterAccept)}.`,
      ok: null,
    },
  ];
  return (
    <div className="space-y-3">
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.label} className="rounded-lg border border-line bg-surface px-3 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
              {s.ok === true && <CheckCircle2 className="h-4 w-4 text-ok" />}
              {s.ok === false && <XCircle className="h-4 w-4 text-bad" />}
              {s.ok === null && <Circle className="h-4 w-4 text-fg-subtle" />}
              {s.label}
            </div>
            <p className="mt-1 pl-6 text-xs text-fg-muted">{s.detail}</p>
          </li>
        ))}
      </ol>
      {c.cmpDetected && <p className="text-xs text-fg-muted">Consent tool found in the page: {c.cmpDetected}.</p>}
      {c.notes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-5 text-xs text-fg-subtle">
          {c.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

const PAGE_KIND_LABEL: Record<string, string> = {
  home: "Homepage",
  signup: "Sign-up",
  login: "Login",
  checkout: "Checkout / pricing",
  contact: "Contact",
  policy: "Privacy policy",
  other: "Other page",
};

function PagesPanel({ result, linkable }: { result: ScanResult; linkable: boolean }) {
  const pages = result.pages ?? [];
  if (pages.length === 0) {
    return <p className="text-[13px] text-fg-muted">Only the homepage was downloaded. No other pages were visited.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[560px] text-left text-xs">
        <thead className="bg-subtle text-fg-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Page</th>
            <th className="px-3 py-2 font-medium">Banner</th>
            <th className="px-3 py-2 font-medium">Policy link</th>
            <th className="px-3 py-2 font-medium">Forms</th>
            <th className="px-3 py-2 font-medium">Trackers before choice</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {pages.map((p) => (
            <tr key={p.url}>
              <td className="max-w-[220px] px-3 py-2">
                <div className="font-medium text-fg">{PAGE_KIND_LABEL[p.kind] ?? p.kind}</div>
                {linkable ? (
                  <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate text-fg-subtle hover:text-info">
                    {p.url.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  <span className="block truncate text-fg-subtle">{p.url.replace(/^https?:\/\//, "")}</span>
                )}
              </td>
              {p.blocked ? (
                <td colSpan={4} className="px-3 py-2 text-fg-subtle">
                  Couldn&apos;t open this page{p.status ? ` (HTTP ${p.status})` : ""}. Not checked.
                </td>
              ) : (
                <>
                  <td className="px-3 py-2">{p.kind === "policy" ? "–" : <YesNo ok={p.bannerVisible} />}</td>
                  <td className="px-3 py-2">{p.kind === "policy" ? "–" : <YesNo ok={p.policyLinked} />}</td>
                  <td className="px-3 py-2 tabular-nums text-fg">{p.formCount}</td>
                  <td className="px-3 py-2 text-fg">{p.trackers.length ? p.trackers.join(", ") : "None"}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function YesNo({ ok }: { ok: boolean }) {
  return <span className={cx("font-medium", ok ? "text-ok" : "text-bad")}>{ok ? "Yes" : "No"}</span>;
}

function EvidencePanel({ result }: { result: ScanResult }) {
  const ev = result.evidence;
  if (!ev || (ev.screenshots.length === 0 && ev.networkLog.length === 0)) {
    return (
      <p className="text-[13px] text-fg-muted">
        {result.id.startsWith("ndpa_demo")
          ? "The sample report has no screenshots or network log. A real scan captures both."
          : "No screenshots or network log for this scan. They are only captured when a real browser runs."}
      </p>
    );
  }
  const host = hostOf(result.finalUrl);
  return (
    <div className="space-y-4">
      {ev.screenshots.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {ev.screenshots.map((s) => (
            <figure key={s.label} className="overflow-hidden rounded-lg border border-line bg-surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.dataUrl} alt={s.label} className="aspect-[1366/820] w-full object-cover object-top" />
              <figcaption className="border-t border-line px-3 py-2 text-2xs text-fg-muted">
                <div className="font-medium text-fg">{s.label}</div>
                {new Date(s.capturedAt).toLocaleString()}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
        <div className="text-xs text-fg-muted">
          <span className="font-medium text-fg">Network log</span>: {ev.networkLog.length} requests, each with the time
          and whether it happened before or after a choice.
          {ev.networkLogTruncated && " Cut off after the first 600."}
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={Download}
          onClick={() =>
            downloadBlob(
              JSON.stringify(
                { site: result.finalUrl, scannedAt: result.scannedAt, requests: ev.networkLog },
                null,
                2
              ),
              `network-log-${host}.json`,
              "application/json"
            )
          }
        >
          Download
        </Button>
      </div>
    </div>
  );
}

/* ================================================================== */
/* Privacy policy                                                      */
/* ================================================================== */

export function PolicyTab({
  result,
  linkable = true,
  embedded = false,
}: {
  result: ScanResult;
  linkable?: boolean;
  embedded?: boolean;
}) {
  const { policy } = result;
  const found = policy.clauses.filter((c) => c.status === "found").length;

  return (
    <div className="space-y-6">
      {embedded ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
          <span className="truncate font-mono">
            {policy.url ?? "No privacy policy link found on the page."}
          </span>
          <span>{policy.source === "rules+ai" ? "Rules + AI" : "Rules engine"}</span>
        </div>
      ) : (
      <SectionHeading
        title={policy.found ? policy.title || "Privacy policy" : "No privacy policy found"}
        description={
          policy.url && !linkable ? (
            <span className="font-mono text-xs">{policy.url}</span>
          ) : policy.url ? (
            <a
              href={policy.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-info hover:underline"
            >
              {policy.url}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            "The scanner could not find a linked privacy notice on this page."
          )
        }
        actions={
          <div className="flex gap-4 text-xs text-fg-muted">
            <span>
              <span className="font-semibold tabular-nums text-fg">{found}</span>/
              {policy.clauses.length} clauses present
            </span>
            <span>
              {policy.source === "rules+ai" ? "Rules + AI" : "Rules engine"}
            </span>
            <span className="tabular-nums">
              {policy.contentLength.toLocaleString()} chars
            </span>
          </div>
        }
      />
      )}

      {policy.aiSummary && (
        <div className="flex gap-3 rounded-xl border border-info-line bg-info-subtle p-4">
          <Bot className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          <div>
            <div className="text-[13px] font-semibold text-fg">AI summary</div>
            <p className="mt-1 text-[13px] leading-relaxed text-fg">{policy.aiSummary}</p>
          </div>
        </div>
      )}
      {policy.aiError && (
        <div className="rounded-lg border border-warn-line bg-warn-subtle px-3.5 py-2.5 text-xs text-warn">
          AI review unavailable, rules engine used instead: {policy.aiError}
        </div>
      )}
      {policy.aiNotice && (
        <div className="flex gap-2 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-xs text-fg-muted">
          <Bot className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{policy.aiNotice}</span>
        </div>
      )}

      <Box>
        <ul className="divide-y divide-line">
          {policy.clauses.map((c) => (
            <li key={c.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_1.2fr]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-semibold text-fg">{c.title}</span>
                  <Badge tone={clauseTone(c.status)}>{clauseLabel(c.status)}</Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-fg-muted">{c.description}</p>
                <div className="mt-1.5 font-mono text-2xs text-fg-subtle">{c.legalReference}</div>
              </div>
              <div className="space-y-2">
                {c.evidence ? (
                  <blockquote className="border-l-2 border-line-strong pl-3 text-xs italic leading-relaxed text-fg-muted">
                    “{c.evidence}”
                  </blockquote>
                ) : (
                  <div className="text-xs text-fg-subtle">No matching text found.</div>
                )}
                {c.aiNote && (
                  <div className="text-xs text-info">
                    <span className="font-semibold">AI note:</span> {c.aiNote}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Box>
    </div>
  );
}

/* ================================================================== */
/* Cookies, trackers, forms, headers                                  */
/* ================================================================== */

export function TelemetryTab({ result }: { result: ScanResult }) {
  const t = result.technical;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Cookies before consent"
          value={t.preConsentCookieCount}
          hint={`${result.cookies.length} total`}
          tone={t.preConsentCookieCount > 0 ? "warn" : undefined}
        />
        <Stat
          label="Third-party trackers"
          value={result.trackers.length}
          hint={`${t.thirdPartyRequestCount} external requests`}
          tone={result.trackers.length > 0 ? "warn" : undefined}
        />
        <Stat
          label="Consent banner"
          value={t.bannerDetected ? "Found" : "None"}
          hint={t.bannerHasReject ? "Has reject option" : "No reject option"}
          tone={t.bannerDetected ? "ok" : "bad"}
        />
        <Stat
          label="Transport"
          value={t.https ? "HTTPS" : "HTTP"}
          hint={`${t.mixedContentCount} mixed-content requests`}
          tone={t.https ? "ok" : "bad"}
        />
      </div>

      <Box>
        <BoxHeader
          title={
            <span className="inline-flex items-center gap-2">
              <Radar className="h-4 w-4 text-fg-muted" />
              Trackers <Counter>{result.trackers.length}</Counter>
            </span>
          }
          description="Non-essential trackers need opt-in consent and must be named as recipients (NDPA ss. 26, 27(1)(c))."
        />
        {result.trackers.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No known trackers on first load" />
        ) : (
          <Table
            head={["Name", "Category", "Domain"]}
            rows={result.trackers.map((tr) => [
              <span key="n" className="font-medium text-fg">{tr.name}</span>,
              <Badge key="c" tone="warn">{tr.category}</Badge>,
              <span key="d" className="font-mono text-2xs text-fg-muted">{tr.domain}</span>,
            ])}
          />
        )}
      </Box>

      <Box>
        <BoxHeader
          title={
            <span className="inline-flex items-center gap-2">
              Cookies <Counter>{result.cookies.length}</Counter>
            </span>
          }
          description="Set before any user interaction. Flags checked for NDPA s. 39 security."
        />
        {result.cookies.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No cookies set on first load" />
        ) : (
          <Table
            head={["Name", "Domain", "Secure", "HttpOnly", "SameSite", "Lifetime"]}
            rows={result.cookies.map((c) => [
              <span key="n" className="font-mono text-2xs font-medium text-fg">{c.name}</span>,
              <span key="d" className="font-mono text-2xs text-fg-muted">{c.domain}</span>,
              <Flag key="s" ok={c.secure} />,
              <Flag key="h" ok={c.httpOnly} neutral />,
              <span key="ss" className="font-mono text-2xs">{c.sameSite}</span>,
              <span key="l" className="text-xs text-fg-muted">{c.session ? "Session" : "Persistent"}</span>,
            ])}
          />
        )}
      </Box>

      <div className="grid gap-6 lg:grid-cols-2">
        <Box>
          <BoxHeader
            title={
              <span className="inline-flex items-center gap-2">
                Forms <Counter>{result.forms.length}</Counter>
              </span>
            }
            description="Personal-data inputs, consent controls and nearby notice links."
          />
          {result.forms.length === 0 ? (
            <EmptyState icon={FileText} title="No forms on this page" />
          ) : (
            <ul className="divide-y divide-line">
              {result.forms.map((f, i) => (
                <li key={i} className="space-y-2 px-4 py-3.5">
                  <div className="truncate font-mono text-2xs text-fg">{f.action}</div>
                  <div className="text-xs text-fg-muted">{f.fields.join(", ")}</div>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone={f.hasConsentControl ? "ok" : "warn"}>
                      Consent box {f.hasConsentControl ? "present" : "missing"}
                    </Badge>
                    <Badge tone={f.hasPreCheckedConsent ? "bad" : "ok"}>
                      {f.hasPreCheckedConsent ? "Pre-ticked" : "Not pre-ticked"}
                    </Badge>
                    <Badge tone={f.hasPrivacyLink ? "ok" : "warn"}>
                      Notice link {f.hasPrivacyLink ? "present" : "missing"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Box>

        <Box>
          <BoxHeader
            title={
              <span className="inline-flex items-center gap-2">
                <Lock className="h-4 w-4 text-fg-muted" />
                Response headers
              </span>
            }
            description="Assessed under NDPA s. 39."
          />
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-left">
              <tbody className="divide-y divide-line">
                {Object.entries(t.headers).map(([k, v]) => (
                  <tr key={k} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-2xs font-medium text-fg">
                      {k}
                    </td>
                    <td className="break-all px-4 py-2 font-mono text-2xs text-fg-muted">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Box>
      </div>
    </div>
  );
}

function Flag({ ok, neutral }: { ok: boolean; neutral?: boolean }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-xs",
        ok ? "text-ok" : neutral ? "text-fg-muted" : "text-bad"
      )}
    >
      {ok ? <Check className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
      {ok ? "Yes" : "No"}
    </span>
  );
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-line">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-fg-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => (
            <tr key={i} className="hover:bg-subtle">
              {r.map((cell, j) => (
                <td key={j} className="whitespace-nowrap px-4 py-2.5">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================== */
/* Remediation                                                         */
/* ================================================================== */

const DOC_COPY: Record<
  RemediationArtifact["id"],
  { title: string; about: string; how: string; dev?: boolean }
> = {
  "internal-audit": {
    title: "Readiness report",
    about: "Full write-up to share with management",
    how: "A complete report of this review. Share it with management, or give it to your licensed auditor (DPCO) as a starting point. It is not the official yearly audit.",
  },
  policy: {
    title: "Privacy policy",
    about: "Ready to publish on your website",
    how: "Review it, then publish it on your website and link it from every page.",
  },
  banner: {
    title: "Cookie banner",
    about: "Asks visitors before tracking them",
    how: "Give this to whoever manages your website. It adds a banner with equal Accept and Reject buttons.",
    dev: true,
  },
  form: {
    title: "Sign-up form checkbox",
    about: "Permission checkbox for your forms",
    how: "Give this to whoever manages your website. It adds an unticked permission box under your forms.",
    dev: true,
  },
  headers: {
    title: "Security settings",
    about: "Server settings that protect data",
    how: "Give this to whoever manages your website or hosting.",
    dev: true,
  },
};

export function RemediationTab({
  artifacts,
  profile,
  setProfile,
}: {
  artifacts: RemediationArtifact[];
  profile: RemediationProfile;
  setProfile: React.Dispatch<React.SetStateAction<RemediationProfile>>;
}) {
  const [activeId, setActiveId] = useState<RemediationArtifact["id"]>(
    artifacts[0]?.id ?? "internal-audit"
  );
  const [copied, setCopied] = useState(false);
  const active = useMemo(
    () => artifacts.find((a) => a.id === activeId) ?? artifacts[0],
    [artifacts, activeId]
  );
  const lineCount = active?.content.split("\n").length ?? 0;
  const profileIncomplete = !profile.organisation.trim() || !profile.email.trim();
  const [showMore, setShowMore] = useState(false);

  const copy = async () => {
    if (!active) return;
    try {
      await navigator.clipboard.writeText(active.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };

  const set = (k: keyof RemediationProfile) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setProfile((p) => ({ ...p, [k]: e.target.value }));

  if (!active) return null;

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <div className="space-y-6">
        <Box>
          <BoxHeader
            title="About your business"
            description="We put this into your documents. Nothing is saved."
          />
          <div className="space-y-4 p-4">
            <div>
              <label className="label" htmlFor="org">Business name</label>
              <input id="org" className="field" value={profile.organisation} onChange={set("organisation")} placeholder="e.g. Acme Nigeria Ltd" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email for privacy questions</label>
              <input id="email" type="email" className="field" value={profile.email} onChange={set("email")} placeholder="e.g. privacy@acme.ng" />
              <p className="hint">Shown in your privacy policy so people can reach you.</p>
            </div>

            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted hover:text-fg"
            >
              <ChevronRight className={cx("h-3.5 w-3.5 transition-transform", showMore && "rotate-90")} />
              More options
            </button>
            {showMore && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <label className="label" htmlFor="retention">How long do you keep customer data?</label>
                  <input id="retention" className="field" value={profile.retention} onChange={set("retention")} placeholder="e.g. 2 years after they close their account" />
                </div>
                <div>
                  <label className="label" htmlFor="country">Country</label>
                  <input id="country" className="field" value={profile.country} onChange={set("country")} placeholder="Nigeria" />
                </div>
              </div>
            )}
          </div>
        </Box>

        <Box>
          <BoxHeader title="Your documents" />
          <ul className="p-1.5">
            {artifacts.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(a.id)}
                  className={cx(
                    "relative flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition",
                    a.id === active.id ? "bg-subtle" : "hover:bg-subtle"
                  )}
                >
                  {a.id === active.id && (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-fg" />
                  )}
                  <FileCode2 className="mt-0.5 h-4 w-4 shrink-0 text-fg-muted" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-fg">
                      {DOC_COPY[a.id]?.title ?? a.title}
                    </div>
                    <div className="truncate text-2xs text-fg-muted">
                      {DOC_COPY[a.id]?.about ?? a.legalBasis}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Box>
      </div>

      <div className="min-w-0 space-y-3">
        {profileIncomplete && (
          <div className="flex items-start gap-2 rounded-lg border border-warn-line bg-warn-subtle px-3.5 py-2.5 text-xs text-warn">
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
            Add your business name and email on the left so your documents show
            your details.
          </div>
        )}
        <Box>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2 text-xs">
              <span className="truncate font-mono font-medium text-fg">{active.filename}</span>
              <span className="text-fg-subtle">·</span>
              <span className="text-fg-muted tabular-nums">{lineCount} lines</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" icon={copied ? Check : Copy} onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={Download}
                onClick={() =>
                  downloadBlob(active.content, active.filename, "text/plain;charset=utf-8")
                }
              >
                Download
              </Button>
            </div>
          </div>
          <div className="border-b border-line px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-fg">
                {DOC_COPY[active.id]?.title ?? active.title}
              </span>
              {DOC_COPY[active.id]?.dev && <Badge tone="neutral">For your web developer</Badge>}
            </div>
            <div className="mt-0.5 text-xs text-fg-muted">
              {DOC_COPY[active.id]?.how ?? active.subtitle}
            </div>
          </div>
          <pre className="max-h-[640px] overflow-auto whitespace-pre-wrap break-words bg-[#0d1117] p-4 font-mono text-xs leading-relaxed text-[#e6edf3]">
            <code>{active.content}</code>
          </pre>
        </Box>
      </div>
    </div>
  );
}
