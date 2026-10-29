"use client";

import React from "react";
import { checkWebsiteInput } from "@/lib/url-check";
import {
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  Cookie,
  FileText,
  Loader2,
  Lock,
  Scale,
  Search,
  UserCheck,
  X,
} from "lucide-react";
import type { AIProvider } from "@/types/audit";
import { Badge, Button, cx } from "./ui";

const SUGGESTED = ["paystack.com", "flutterwave.com", "nitda.gov.ng", "moniepoint.com"];

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

export const SCAN_STEPS = [
  "Loading page in a headless browser",
  "Capturing cookies, trackers and security headers",
  "Reading the privacy policy against NDPA clauses",
  "Scoring and building remediation documents",
];

export interface AiSettingsState {
  provider: AIProvider;
  apiKey: string;
  model: string;
}

export function Landing({
  urlInput,
  setUrlInput,
  onScan,
  onLoadSample,
  isScanning,
  scanStage,
  scanError,
  ai,
  setAi,
}: {
  urlInput: string;
  setUrlInput: (v: string) => void;
  onScan: (url?: string) => void;
  onLoadSample: () => void;
  isScanning: boolean;
  scanStage: number;
  scanError: string | null;
  ai: AiSettingsState;
  setAi: React.Dispatch<React.SetStateAction<AiSettingsState>>;
}) {
  const [showAi, setShowAi] = React.useState(false);
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
    <div className="relative">
      {/* soft backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(0,135,81,0.08),transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[linear-gradient(to_right,rgb(var(--grid))_1px,transparent_1px),linear-gradient(to_bottom,rgb(var(--grid))_1px,transparent_1px)] bg-[size:48px_48px] opacity-40 [mask-image:radial-gradient(50%_60%_at_50%_0%,#000,transparent)]"
      />

      <section className="relative mx-auto max-w-3xl px-4 pb-16 pt-20 text-center sm:pt-28">
        <Badge tone="brand" className="mx-auto px-2.5 py-0.5 text-xs">
          NDPA 2023 · GAID 2025
        </Badge>
        <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-fg sm:text-[56px]">
          Know where your website stands on Nigerian data protection.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-fg-muted sm:text-lg">
          Scan any public site for consent, privacy-notice and security gaps.
          Get evidence, citations and ready-to-ship fixes in under a minute.
        </p>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mx-auto mt-9 max-w-xl"
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
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-2 text-[13px] text-fg-muted">
            <span className="mr-1">Try</span>
            {SUGGESTED.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onScan(`https://${s}`)}
                className="rounded-md px-1.5 py-0.5 font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
              >
                {s}
              </button>
            ))}
            <span className="mx-2 text-line-strong">|</span>
            <button
              type="button"
              onClick={onLoadSample}
              className="inline-flex items-center gap-1 font-medium text-info hover:underline"
            >
              View a sample report
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* scanning progress */}
        {isScanning && (
          <div className="box mx-auto mt-6 max-w-xl animate-fade-in p-4 text-left">
            <ol className="space-y-2.5">
              {SCAN_STEPS.map((step, i) => {
                const done = i < scanStage;
                const active = i === scanStage;
                return (
                  <li key={step} className="flex items-center gap-3 text-[13px]">
                    <span
                      className={cx(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
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
                    <span className={cx(done || active ? "text-fg" : "text-fg-subtle")}>
                      {step}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {scanError && (
          <div
            role="alert"
            className="mx-auto mt-6 flex max-w-xl items-start gap-2.5 rounded-lg border border-bad-line bg-bad-subtle px-3.5 py-3 text-left text-[13px] text-bad"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{scanError}</span>
          </div>
        )}

        {/* AI options */}
        {!isScanning && (
          <div className="mx-auto mt-6 max-w-xl text-left">
            <button
              type="button"
              onClick={() => setShowAi((s) => !s)}
              aria-expanded={showAi}
              className="mx-auto flex items-center gap-1.5 text-xs font-medium text-fg-muted hover:text-fg"
            >
              <Bot className="h-3.5 w-3.5" />
              AI policy review (optional)
              <ChevronDown
                className={cx("h-3.5 w-3.5 transition-transform", showAi && "rotate-180")}
              />
            </button>
            {showAi && (
              <div className="box mt-3 animate-fade-in p-4">
                <p className="text-xs text-fg-muted">
                  The rules engine runs without a key. Add one to get a
                  plain-language summary and semantic clause checks. Keys stay
                  in this browser tab and are sent only with the scan request.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="label" htmlFor="ai-provider">
                      Provider
                    </label>
                    <select
                      id="ai-provider"
                      className="field"
                      value={ai.provider}
                      onChange={(e) =>
                        setAi((p) => ({ ...p, provider: e.target.value as AIProvider }))
                      }
                    >
                      <option value="openai">OpenAI</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="anthropic">Anthropic</option>
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="ai-key">
                      API key
                    </label>
                    <input
                      id="ai-key"
                      type="password"
                      className="field"
                      value={ai.apiKey}
                      onChange={(e) => setAi((p) => ({ ...p, apiKey: e.target.value }))}
                      placeholder="Paste key"
                    />
                  </div>
                  <div>
                    <label className="label" htmlFor="ai-model">
                      Model
                    </label>
                    <input
                      id="ai-model"
                      className="field"
                      value={ai.model}
                      onChange={(e) => setAi((p) => ({ ...p, model: e.target.value }))}
                      placeholder="Default"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* what we check */}
      <section className="relative border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <div className="max-w-xl">
            <div className="text-[13px] font-medium text-brand-fg">What gets checked</div>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-fg">
              Four pillars, mapped to the Act.
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-fg-muted">
              Every finding links back to the section of the NDPA it comes
              from, with the evidence the scanner saw.
            </p>
          </div>
          <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p) => (
              <div key={p.title} className="bg-surface p-6">
                <p.icon className="h-5 w-5 text-fg" strokeWidth={1.75} />
                <div className="mt-4 text-sm font-semibold text-fg">{p.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-fg-muted">
                  {p.body}
                </p>
                <div className="mt-4 font-mono text-2xs text-fg-subtle">NDPA {p.cite}</div>
              </div>
            ))}
          </div>

          <div className="mt-16 grid gap-10 sm:grid-cols-3">
            {[
              {
                n: "01",
                t: "Scan",
                b: "A real browser loads the page, records cookies before consent, and follows the privacy policy link.",
              },
              {
                n: "02",
                t: "Classify",
                b: "Enter your data-subject volume to get your GAID 2025 DCPMI tier and audit filing dates.",
              },
              {
                n: "03",
                t: "Fix",
                b: "Download a policy draft, consent banner, form markup, security headers and an internal audit report.",
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
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-xs text-fg-muted">
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
