"use client";

import React from "react";
import type { CheckStatus, ScanResult } from "@ndpa/scan-engine/types";
import type { DcpmiTierResult } from "@/lib/gaid-assessment";
import { Comparison, ConsentTestPanel, PagesPanel, PolicyTab, TelemetryTab } from "./ReportTabs";
import { Logo, checkLabel, cx, hostOf, scoreTone, toneText } from "./ui";

/*
 * The whole report on one long page, shown only when printing (or saving as
 * PDF). The screen view splits it into steps and collapsed sections, which
 * print badly, so this lays everything out in order with nothing hidden.
 */

const RANK: Record<CheckStatus, number> = { fail: 0, warning: 1, info: 2, pass: 3 };

export function PrintReport({
  result,
  tier,
  tierAnswered,
}: {
  result: ScanResult;
  tier: DcpmiTierResult;
  tierAnswered: boolean;
}) {
  const host = hostOf(result.finalUrl);
  const open = result.checks
    .filter((c) => c.status === "fail" || c.status === "warning")
    .sort((a, b) => RANK[a.status] - RANK[b.status] || b.maxScore - b.score - (a.maxScore - a.score));
  const passed = result.checks.filter((c) => c.status === "pass");
  const shots = result.evidence?.screenshots ?? [];

  return (
    <div className="print-only space-y-8 text-[12px] text-fg">
      <header className="flex items-start justify-between gap-6 border-b border-line pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-fg-muted">
            <Logo className="h-4 w-4" />
            NDPA Lens · Website readiness report
          </div>
          <h1 className="mt-2 text-2xl font-semibold">{host}</h1>
          <div className="mt-1 text-xs text-fg-muted">
            {result.finalUrl} · Scanned {new Date(result.scannedAt).toLocaleString()}
          </div>
        </div>
        <div className="text-right">
          <div className={cx("text-4xl font-semibold tabular-nums", toneText[scoreTone(result.score)])}>
            {result.score}
            <span className="text-base text-fg-subtle">/100</span>
          </div>
          <div className="text-xs text-fg-muted">
            Grade {result.grade} · {result.riskLevel} risk
          </div>
        </div>
      </header>

      {result.previous && <Comparison result={result} />}

      {result.policy.aiSummary && (
        <Section title="Summary of the privacy policy (AI)">
          <p>{result.policy.aiSummary}</p>
        </Section>
      )}

      <Section title={`Issues to fix (${open.length})`}>
        {open.length === 0 ? (
          <p className="text-fg-muted">No open issues.</p>
        ) : (
          <ol className="space-y-3">
            {open.map((c, i) => (
              <li key={c.id} className="avoid-break rounded-lg border border-line p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="font-semibold">
                    {i + 1}. {c.title}
                  </div>
                  <div className={cx("shrink-0 text-xs font-medium", c.status === "fail" ? "text-bad" : "text-warn")}>
                    {checkLabel(c.status)} · {c.score}/{c.maxScore}
                  </div>
                </div>
                <p className="mt-1 text-fg-muted">{c.summary}</p>
                <p className="mt-2">
                  <span className="font-semibold">How to fix: </span>
                  {c.recommendation}
                </p>
                {c.evidence.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-[10px] text-fg-muted">
                    {c.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 font-mono text-[10px] text-fg-subtle">{c.legalReference}</div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      {passed.length > 0 && (
        <Section title={`Passed (${passed.length})`}>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1">
            {passed.map((c) => (
              <li key={c.id} className="text-fg-muted">
                <span className="text-ok">✓</span> {c.title}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tierAnswered && (
        <Section title="Your organisation (GAID 2025)">
          <p className="font-semibold">
            {tier.label} <span className="font-normal text-fg-muted">· {tier.subtitle}</span>
          </p>
          {tier.registrationFee && <p className="mt-1">Registration fee: {tier.registrationFee}</p>}
          {tier.nextCarDeadline && <p>Next Compliance Audit Return due: {tier.nextCarDeadline}</p>}
          {tier.obligations.length > 0 && (
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {tier.obligations.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Section title="Cookie banner test">
        <ConsentTestPanel result={result} />
      </Section>

      <Section title="Pages checked">
        <PagesPanel result={result} linkable={false} />
      </Section>

      <Section title="Privacy policy clauses">
        <PolicyTab result={result} linkable={false} embedded />
      </Section>

      <Section title="Cookies, trackers and headers">
        <TelemetryTab result={result} />
      </Section>

      {shots.length > 0 && (
        <Section title="Screenshots">
          <div className="grid grid-cols-2 gap-3">
            {shots.map((s) => (
              <figure key={s.label} className="avoid-break overflow-hidden rounded border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.dataUrl} alt={s.label} className="w-full" />
                <figcaption className="px-2 py-1 text-[10px] text-fg-muted">
                  {s.label} · {new Date(s.capturedAt).toLocaleString()}
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>
      )}

      {(result.metadata.limitations ?? []).length > 0 && (
        <Section title="What this scan can't see">
          <ul className="list-disc space-y-0.5 pl-5 text-fg-muted">
            {result.metadata.limitations!.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>
      )}

      <footer className="border-t border-line pt-3 text-[10px] text-fg-muted">
        Automated readiness check based only on what the public website shows. Not a compliance audit or legal
        advice. Organisations of Ultra-High and Extra-High Level file their yearly Compliance Audit Return through an
        NDPC-licensed DPCO.
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="avoid-break-after mb-3 border-b border-line pb-1 text-base font-semibold">{title}</h2>
      {children}
    </section>
  );
}
