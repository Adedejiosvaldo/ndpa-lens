"use client";

import React from "react";
import { checkWebsiteInput } from "@/lib/url-check";
import type { ScanResult, ScanStage } from "@/types/audit";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  Circle,
  Cookie,
  FileText,
  Loader2,
  Lock,
  Scale,
  Search,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { topFixes } from "./ReportTabs";
import { Badge, Button, cx, hostOf, scoreTone, toneText } from "./ui";

const PILLARS = [
  {
    icon: FileText,
    title: "Transparency",
    body: "Privacy notice, controller identity, DPO contact and lawful basis disclosures.",
    cite: "ss. 24, 27, 32",
  },
  {
    icon: UserCheck,
    title: "Data subject rights",
    body: "Access, erasure, portability, NDPC complaint route and retention periods.",
    cite: "ss. 34–38",
  },
  {
    icon: Cookie,
    title: "Consent & trackers",
    body: "Cookies set before consent, reject parity and pre-ticked form boxes.",
    cite: "ss. 25–26",
  },
  {
    icon: Lock,
    title: "Technical security",
    body: "HTTPS, security headers, cookie flags and third-party exposure.",
    cite: "s. 39",
  },
];

/** The stages the server reports while a scan runs, in order. */
export const SCAN_STEPS: Array<{ id: ScanStage; label: string }> = [
  { id: "open", label: "Opening your site in a real browser" },
  { id: "banner", label: "Testing the cookie banner: Reject, then Accept" },
  { id: "pages", label: "Visiting the privacy policy, sign-up and login pages" },
  { id: "consent", label: "Checking what still loads after Reject" },
  { id: "policy", label: "Reading the privacy policy against NDPA s. 27" },
  { id: "score", label: "Scoring and preparing your fixes" },
];

export function Landing({
  onSample,
  sample,
  urlInput,
  setUrlInput,
  onScan,
  isScanning,
  scanStage,
  scanDetail,
  scanStartedAt,
  scanError,
}: {
  onSample: () => void;
  sample: ScanResult;
  urlInput: string;
  setUrlInput: (v: string) => void;
  onScan: (url?: string) => void;
  isScanning: boolean;
  scanStage: number;
  scanDetail: string | null;
  scanStartedAt: number;
  scanError: string | null;
}) {
  // Whether this server offers a free AI review (one per person per day).
  const [freeAi, setFreeAi] = React.useState(false);
  React.useEffect(() => {
    fetch("/api/ai-status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setFreeAi(Boolean(d?.free)))
      .catch(() => {});
  }, []);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputError, setInputError] = React.useState<string | null>(null);
  const clearInput = () => {
    setUrlInput("");
    setInputError(null);
    inputRef.current?.focus();
  };
  const submit = () => {
    const check = checkWebsiteInput(urlInput);
    if (!check.ok) {
      setInputError(check.message);
      inputRef.current?.focus();
      return;
    }
    setInputError(null);
    onScan();
  };

  return (
    <div>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pb-24">
          <div>
            <Badge tone="brand" className="px-2.5 py-0.5 text-xs">
              NDPA 2023 · GAID 2025
            </Badge>
            <h1 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-[-0.035em] text-fg sm:text-[52px]">
              Does your website obey Nigeria&apos;s data protection law?
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
              We open your site in a real browser, click <span className="font-medium text-fg">Reject</span> on
              your cookie banner, and check what still tracks visitors. You get evidence, the section of the Act,
              and the documents to fix it.
            </p>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
              className="mt-8 max-w-xl"
            >
              <div
                className={cx(
                  "flex items-center gap-2 rounded-xl border bg-surface p-1.5 shadow-hero focus-within:ring-4",
                  inputError
                    ? "border-bad/70 focus-within:border-bad/70 focus-within:ring-bad/[0.08]"
                    : "border-line-strong focus-within:border-info focus-within:ring-info/10"
                )}
              >
                <Search className="ml-2 h-4 w-4 shrink-0 text-fg-subtle" />
                <input
                  ref={inputRef}
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Website URL"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    if (inputError) setInputError(null);
                  }}
                  aria-invalid={inputError ? true : undefined}
                  aria-describedby={inputError ? "url-error" : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && urlInput) {
                      e.preventDefault();
                      clearInput();
                    }
                  }}
                  placeholder="yourcompany.com"
                  autoFocus
                  disabled={isScanning}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-[15px] text-fg outline-none placeholder:text-fg-subtle"
                />
                {urlInput && !isScanning && (
                  <button
                    type="button"
                    onClick={clearInput}
                    aria-label="Clear website address"
                    title="Clear (Esc)"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-subtle transition hover:bg-subtle hover:text-fg"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={isScanning || !urlInput.trim()}
                  className="h-9"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Scanning
                    </>
                  ) : (
                    <>
                      Run audit
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
              {inputError && (
                <p
                  id="url-error"
                  role="alert"
                  className="mt-2.5 flex items-start gap-2 px-3 text-left text-[13px] leading-5 text-bad"
                >
                  <AlertCircle className="mt-[3px] h-3.5 w-3.5 shrink-0" />
                  <span>{inputError}</span>
                </p>
              )}
            </form>

            {!isScanning && (
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fg-muted">
                <span>Free · about a minute · nothing to install</span>
                {freeAi && (
                  <span className="inline-flex items-center gap-1.5">
                    <Bot className="h-3.5 w-3.5" />
                    Includes 1 free AI policy review a day
                  </span>
                )}
              </div>
            )}

            {isScanning && (
              <ScanProgress stage={scanStage} detail={scanDetail} startedAt={scanStartedAt} />
            )}

            {scanError && (
              <div
                role="alert"
                className="mt-6 flex max-w-xl items-start gap-2.5 rounded-lg border border-bad-line bg-bad-subtle px-3.5 py-3 text-left text-[13px] text-bad"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{scanError}</span>
              </div>
            )}
          </div>

          <ReportPreview sample={sample} onOpen={onSample} />
        </div>
      </section>

      {/* what we check */}
      <section className="bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="max-w-xl">
            <div className="text-[13px] font-medium text-brand-fg">What gets checked</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-fg">
              Four areas, each tied to the Act.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
              Every finding names the section of the NDPA it comes from and shows what the scanner saw.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="bg-surface p-6">
                <p.icon className="h-5 w-5 text-fg" strokeWidth={1.75} />
                <div className="mt-4 text-sm font-semibold text-fg">{p.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{p.body}</p>
                <div className="mt-4 font-mono text-2xs text-fg-subtle">NDPA {p.cite}</div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scan",
                b: "A real browser loads your site, records cookies before consent, clicks Reject, and follows the privacy policy link.",
              },
              {
                n: "02",
                t: "Classify",
                b: "Answer a few questions about your organisation to get your GAID 2025 tier, fees and audit deadlines.",
              },
              {
                n: "03",
                t: "Fix",
                b: "Download a privacy policy (Word), cookie banner, consent checkbox, security settings and a readiness report.",
              },
            ].map((s) => (
              <div key={s.n}>
                <div className="font-mono text-xs text-fg-subtle">{s.n}</div>
                <div className="mt-2 text-sm font-semibold text-fg">{s.t}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">{s.b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-fg-muted sm:px-6">
          <div className="flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Automated review only. Not legal advice.
          </div>
          <div>Nigeria Data Protection Act 2023 · NDPC GAID 2025</div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ScanProgress({
  stage,
  detail,
  startedAt,
}: {
  stage: number;
  detail: string | null;
  startedAt: number;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.floor((now - startedAt) / 1000));
  const elapsed = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    <div className="box mt-6 max-w-xl animate-fade-in p-4 text-left" role="status" aria-live="polite">
      <div className="mb-3 flex items-center justify-between text-xs text-fg-muted">
        <span>Usually takes 40–90 seconds</span>
        <span className="font-mono tabular-nums">{elapsed}</span>
      </div>
      <ol className="space-y-2.5">
        {SCAN_STEPS.map((step, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li key={step.id} className="flex items-start gap-3 text-[13px]">
              <span
                className={cx(
                  "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  done && "border-ok bg-ok text-white",
                  active && "border-info text-info",
                  !done && !active && "border-line-strong text-fg-subtle"
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : active ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <span className="min-w-0">
                <span className={cx(done || active ? "text-fg" : "text-fg-subtle")}>{step.label}</span>
                {active && detail && (
                  <span className="mt-0.5 block truncate text-xs text-fg-muted">{detail}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A real (sample) report, so visitors see what they get before they scan. */
function ReportPreview({ sample, onOpen }: { sample: ScanResult; onOpen: () => void }) {
  const c = sample.technical.consentTest;
  const fixes = topFixes(sample.checks, 3);
  const host = hostOf(sample.finalUrl);
  const steps = c
    ? [
        {
          ok: c.trackersBeforeConsent.length === 0,
          label: "First visit, before choosing",
          detail: c.trackersBeforeConsent.length
            ? `Already tracking: ${c.trackersBeforeConsent.join(", ")}`
            : "Nothing tracking yet",
        },
        {
          ok: c.rejectClicked && c.trackersAfterReject.length === 0,
          label: "Clicked Reject",
          detail: !c.rejectFound
            ? "There is no Reject button"
            : c.trackersAfterReject.length
            ? `Still tracking: ${c.trackersAfterReject.join(", ")}`
            : "Tracking stopped",
        },
      ]
    : [];

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open the sample report"
      className="group block w-full text-left"
    >
      <div className="box overflow-hidden shadow-hero transition group-hover:border-line-strong">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-surface text-xs font-semibold uppercase text-fg-muted">
              {host.charAt(0)}
            </span>
            <span className="truncate text-[13px] font-semibold text-fg">{host}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={cx("text-xl font-semibold tabular-nums", toneText[scoreTone(sample.score)])}>
              {sample.score}
            </span>
            <span className="text-xs text-fg-muted">Grade {sample.grade}</span>
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          <div className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">Cookie banner test</div>
          {steps.map((s) => (
            <div key={s.label} className="flex items-start gap-2.5 rounded-lg border border-line bg-surface px-3 py-2">
              {s.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
              )}
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-fg">{s.label}</div>
                <div className="text-xs text-fg-muted">{s.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-line px-4 py-4">
          <div className="text-2xs font-semibold uppercase tracking-wider text-fg-muted">Fix these first</div>
          <ol className="mt-2 space-y-2">
            {fixes.map((f, i) => (
              <li key={f.id} className="flex items-center gap-2.5 text-[13px]">
                <Circle className="h-1.5 w-1.5 shrink-0 fill-fg-subtle text-fg-subtle" />
                <span className="min-w-0 flex-1 truncate text-fg">
                  {i + 1}. {f.title}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-ok">+{f.maxScore - f.score}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-xs">
          <span className="text-fg-muted">Sample report · fictional company</span>
          <span className="inline-flex items-center gap-1 font-medium text-brand-fg group-hover:underline">
            Open the full sample
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
