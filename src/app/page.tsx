"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FlaskConical,
  Printer,
  Scale,
  Search,
} from "lucide-react";
import type { RemediationProfile, ScanResult } from "@/types/audit";
import { checkWebsiteInput } from "@/lib/url-check";
import { SAMPLE_AUDITS } from "@/lib/sample-audit";
import { buildRemediationPack, type InternalComplianceAnswer } from "@/lib/remediation";
import {
  type DcpmiAssessmentInput,
  deriveAutoChecklistState,
  evaluateDcpmiTierAndDeadlines,
} from "@/lib/gaid-assessment";
import { GaidAssessmentTab, InternalAuditWorksheetTab } from "@/components/GaidAndAuditTabs";
import { Landing, SCAN_STEPS } from "@/components/Landing";
import { RemediationTab, ResultsTab } from "@/components/ReportTabs";
import {
  Badge,
  Button,
  Counter,
  Disclosure,
  Logo,
  SectionHeading,
  ThemeToggle,
  cx,
  downloadBlob,
  hostOf,
  scoreTone,
  toneText,
} from "@/components/ui";

type Step = "results" | "organisation" | "fix";

const REPORT_HASH = "#report";
const LEGACY_HISTORY_KEY = "ndpa_lens_scan_history_v1";
const SAMPLE = SAMPLE_AUDITS.fintechDemo;

const EMPTY_PROFILE: RemediationProfile = {
  organisation: "",
  email: "",
  country: "",
  retention: "",
};

function emptyGaid(checkedItems: Record<string, boolean> = {}): DcpmiAssessmentInput {
  return {
    dataSubjectsCount: "",
    sector: "",
    commencementDate: "",
    dsrResponseDays: "",
    policyLastUpdated: "",
    ropaLastReviewed: "",
    checkedItems,
  };
}

export default function Page() {
  const [view, setView] = useState<"landing" | "report">("landing");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);

  const [step, setStep] = useState<Step>("results");

  const [profile, setProfile] = useState<RemediationProfile>(EMPTY_PROFILE);
  const [overrides, setOverrides] = useState<Record<string, InternalComplianceAnswer>>({});
  const [gaidInput, setGaidInput] = useState<DcpmiAssessmentInput>(() => emptyGaid());

  useEffect(() => {
    // Scans are no longer kept between visits; clear anything an older version stored.
    try {
      localStorage.removeItem(LEGACY_HISTORY_KEY);
    } catch {
      /* storage blocked */
    }
    // A stale #report on first load has no report behind it.
    if (window.location.hash === REPORT_HASH) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    // Browser back/forward moves between the search page and the report.
    const onPop = () => {
      setView(window.location.hash === REPORT_HASH ? "report" : "landing");
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const openReport = (r: ScanResult) => {
    setResult(r);
    setUrlInput(r.id === SAMPLE.id ? "" : r.requestedUrl);
    setGaidInput((prev) => ({ ...prev, checkedItems: deriveAutoChecklistState(r) }));
    setOverrides({});
    setStep("results");
    setScanError(null);
    setView("report");
    if (window.location.hash !== REPORT_HASH) {
      history.pushState(null, "", REPORT_HASH);
    }
    window.scrollTo({ top: 0 });
  };

  const goToSearch = () => {
    setScanError(null);
    if (window.location.hash === REPORT_HASH) {
      history.back(); // popstate switches the view
    } else {
      setView("landing");
      window.scrollTo({ top: 0 });
    }
  };

  const runScan = async (target?: string) => {
    const check = checkWebsiteInput(target ?? urlInput);
    if (!check.ok) {
      setScanError(check.message);
      return;
    }
    const url = check.url;
    if (target) setUrlInput(target);
    if (window.location.hash === REPORT_HASH) {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setView("landing");
    setScanError(null);
    setIsScanning(true);
    setScanStage(0);
    window.scrollTo({ top: 0 });

    const timer = setInterval(
      () => setScanStage((s) => Math.min(s + 1, SCAN_STEPS.length - 1)),
      1800
    );

    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Scan failed.");
      openReport(data as ScanResult);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Could not scan that address.");
    } finally {
      clearInterval(timer);
      setIsScanning(false);
    }
  };

  const goToStep = (next: Step) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };

  const isSample = result?.id === SAMPLE.id;

  const artifacts = useMemo(
    () => (result ? buildRemediationPack(result, profile, overrides) : []),
    [result, profile, overrides]
  );
  const tier = useMemo(() => evaluateDcpmiTierAndDeadlines(gaidInput), [gaidInput]);

  const exportJson = () => {
    if (!result) return;
    downloadBlob(
      JSON.stringify(
        {
          auditResult: result,
          gaid2025Assessment: { ...gaidInput, classifiedTier: tier },
          internalAuditOverrides: overrides,
          exportedAt: new Date().toISOString(),
        },
        null,
        2
      ),
      `ndpa-lens-${hostOf(result.finalUrl)}.json`,
      "application/json"
    );
  };

  const showReport = view === "report" && !!result && !isScanning;

  return (
    <div className="min-h-screen">
      <TopNav inReport={showReport} onHome={goToSearch} />

      {!showReport && (
        <Landing
          urlInput={urlInput}
          setUrlInput={setUrlInput}
          onScan={runScan}
          isScanning={isScanning}
          scanStage={scanStage}
          scanError={scanError}
        />
      )}

      {showReport && result && (
        <>
          {isSample && (
            <div className="no-print border-b border-info-line bg-info-subtle">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-[13px] text-fg sm:px-6">
                <span className="inline-flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 shrink-0 text-info" />
                  <span>
                    <span className="font-semibold">Sample report.</span>{" "}
                    <span className="text-fg-muted">
                      A fictional company with made-up findings, so you can see what a
                      report looks like. Nothing was scanned.
                    </span>
                  </span>
                </span>
                <button
                  type="button"
                  onClick={goToSearch}
                  className="font-medium text-info hover:underline"
                >
                  Scan your own site →
                </button>
              </div>
            </div>
          )}

          <ReportHeader result={result} isSample={isSample} onBack={goToSearch} />

          <StepNav
            step={step}
            setStep={goToStep}
            openIssues={
              result.checks.filter((c) => c.status === "fail" || c.status === "warning").length
            }
          />

          <main className="mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6">
            <div key={step} className="animate-fade-in space-y-10">
              {step === "results" && <ResultsTab result={result} linkable={!isSample} />}

              {step === "organisation" && (
                <>
                  <GaidAssessmentTab
                    result={result}
                    gaidInput={gaidInput}
                    setGaidInput={setGaidInput}
                  />
                  <Disclosure
                    title="Detailed audit worksheet"
                    description="Optional. For your Data Protection Officer or auditor to review item by item."
                  >
                    <InternalAuditWorksheetTab
                      result={result}
                      profile={profile}
                      overrides={overrides}
                      setOverrides={setOverrides}
                    />
                  </Disclosure>
                </>
              )}

              {step === "fix" && (
                <>
                  <SectionHeading
                    title="Fix & export"
                    description="Add your business name, then download what you need."
                    actions={
                      <>
                        <Button size="sm" icon={Printer} onClick={() => window.print()}>
                          Print report
                        </Button>
                        <Button size="sm" icon={Download} onClick={exportJson}>
                          Download data
                        </Button>
                      </>
                    }
                  />
                  <RemediationTab artifacts={artifacts} profile={profile} setProfile={setProfile} />
                </>
              )}

              <NextStep step={step} onGo={goToStep} onNewScan={goToSearch} />
            </div>
          </main>

          <footer className="border-t border-line">
            <div className="mx-auto flex max-w-6xl items-center gap-1.5 px-4 py-6 text-xs text-fg-muted sm:px-6">
              <Scale className="h-3.5 w-3.5" />
              Automated review only. Not legal advice.
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

/* ================================================================== */

function TopNav({ inReport, onHome }: { inReport: boolean; onHome: () => void }) {
  return (
    <header className="no-print sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          onClick={onHome}
          className="flex items-center gap-2.5"
          aria-label="NDPA Lens home"
        >
          <Logo className="h-6 w-6" />
          <span className="text-[15px] font-semibold tracking-tight text-fg">NDPA Lens</span>
        </button>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          {inReport && (
            <Button variant="primary" icon={Search} onClick={onHome}>
              New scan
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function ReportHeader({
  result,
  isSample,
  onBack,
}: {
  result: ScanResult;
  isSample: boolean;
  onBack: () => void;
}) {
  const host = hostOf(result.finalUrl);
  return (
    <div className="bg-surface">
      <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          className="no-print -ml-1.5 mb-3 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[13px] font-medium text-fg-muted hover:bg-subtle hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-subtle text-sm font-semibold uppercase text-fg-muted">
              {host.charAt(0)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-semibold text-fg">{host}</h1>
                {isSample && <Badge tone="info">Sample</Badge>}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
                {isSample ? (
                  <span>Example data for illustration</span>
                ) : (
                  <>
                    <a
                      href={result.finalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-info"
                    >
                      {displayUrl(result.finalUrl)}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <span
                      title={`${new Date(result.scannedAt).toLocaleString()} · ${
                        result.metadata.engine === "browser" ? "Browser" : "Static fetch"
                      } · ${(result.metadata.durationMs / 1000).toFixed(1)}s`}
                    >
                      Scanned {timeAgo(result.scannedAt)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-line px-3 py-1.5">
            <span className={cx("text-lg font-semibold tabular-nums", toneText[scoreTone(result.score)])}>
              {result.score}
            </span>
            <span className="h-4 w-px bg-line" />
            <span className="text-xs text-fg-muted" title="Website readiness, based only on what the public site shows">
              Readiness · Grade {result.grade}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS: Array<{ id: Step; label: string; hint: string }> = [
  { id: "results", label: "Results", hint: "What we found on your website" },
  { id: "organisation", label: "Your organisation", hint: "What the law expects from you" },
  { id: "fix", label: "Fix & export", hint: "Documents to fix the issues" },
];

function StepNav({
  step,
  setStep,
  openIssues,
}: {
  step: Step;
  setStep: (s: Step) => void;
  openIssues: number;
}) {
  return (
    <nav aria-label="Report steps" className="no-print sticky top-14 z-30 border-b border-line bg-surface/90 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <ol className="-mb-px flex gap-4 overflow-x-auto sm:gap-6 [scrollbar-width:none]">
          {STEPS.map((s, i) => {
            const active = s.id === step;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  aria-current={active ? "step" : undefined}
                  className="group relative flex items-center gap-2.5 whitespace-nowrap py-3 text-left"
                >
                  <span
                    className={cx(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                      active ? "bg-fg text-canvas" : "bg-track text-fg-muted group-hover:text-fg"
                    )}
                  >
                    {i + 1}
                  </span>
                  <span>
                    <span
                      className={cx(
                        "flex items-center gap-1.5 text-[13px]",
                        active ? "font-semibold text-fg" : "text-fg-muted group-hover:text-fg"
                      )}
                    >
                      {s.label}
                      {s.id === "results" && openIssues > 0 && <Counter>{openIssues}</Counter>}
                    </span>
                    <span className="hidden text-2xs text-fg-subtle md:block">{s.hint}</span>
                  </span>
                  {active && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand" />}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

function NextStep({
  step,
  onGo,
  onNewScan,
}: {
  step: Step;
  onGo: (s: Step) => void;
  onNewScan: () => void;
}) {
  const idx = STEPS.findIndex((s) => s.id === step);
  const next = STEPS[idx + 1];
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-dashed border-line-strong px-5 py-4">
      {next ? (
        <>
          <div>
            <div className="text-xs text-fg-muted">Next step</div>
            <div className="mt-0.5 text-sm font-semibold text-fg">
              {idx + 2}. {next.label}
              <span className="ml-2 font-normal text-fg-muted">{next.hint}</span>
            </div>
          </div>
          <Button variant="primary" onClick={() => onGo(next.id)}>
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <>
          <div>
            <div className="text-xs text-fg-muted">All done</div>
            <div className="mt-0.5 text-sm font-semibold text-fg">Want to check another website?</div>
          </div>
          <Button variant="primary" icon={Search} onClick={onNewScan}>
            New scan
          </Button>
        </>
      )}
    </div>
  );
}

function displayUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    return u.hostname.replace(/^www\./, "") + path;
  } catch {
    return url;
  }
}

function timeAgo(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return new Date(iso).toLocaleDateString();
}
