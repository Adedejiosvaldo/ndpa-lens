"use client";

import React from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Download,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { RemediationProfile, ScanResult } from "@/types/audit";
import {
  type DcpmiAssessmentInput,
  type DcpmiSector,
  deriveAutoChecklistState,
  deriveScanHints,
  evaluateDcpmiTierAndDeadlines,
  GAID_CHECKLIST_GROUPS,
} from "@/lib/gaid-assessment";
import {
  buildInternalAuditSections,
  generateInternalAuditMarkdown,
  type InternalComplianceAnswer,
} from "@/lib/remediation";
import {
  Badge,
  Box,
  BoxHeader,
  Button,
  ProgressBar,
  SectionHeading,
  Stat,
  cx,
  downloadBlob,
  scoreTone,
  type Tone,
} from "./ui";


function olderThan12Months(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  return Date.now() - d.getTime() > 365 * 24 * 60 * 60 * 1000;
}

/* ================================================================== */
/* Plain-language copy. Legal wording stays in lib for the exports.    */
/* ================================================================== */

const GROUP_COPY: Record<string, { title: string; about: string }> = {
  consent: { title: "Asking permission", about: "Getting people's OK before you use their data." },
  dsr: { title: "Handling people's requests", about: "When someone asks to see, correct or delete their data." },
  dpia: { title: "Risk checks for new projects", about: "Thinking through privacy risks before launching something new." },
  breach: { title: "If data leaks", about: "What you do when personal data is lost or stolen." },
  privacy_policy: { title: "Your privacy policy", about: "The page that explains what you do with people's data." },
  lawful_basis: { title: "Reasons for using data", about: "Being able to say why you're allowed to use each piece of data." },
  cross_border: { title: "Data stored outside Nigeria", about: "Using cloud services or partners in other countries." },
  ropa: { title: "Keeping a record", about: "A simple list of what data you hold and where it goes." },
};

const ITEM_COPY: Record<string, string> = {
  consent_banner_every_page: "Our website shows a cookie / permission banner",
  consent_named_purpose: "We tell people exactly what each permission is for",
  consent_easy_withdrawal: "People can say no, or change their mind, as easily as saying yes",
  consent_parental_minors: "We get a parent's permission for children (if we have child users)",
  consent_age_verification: "We check age and the parent's permission, for example with a government ID (if we have child users)",
  consent_audit_log: "We keep a record of who agreed to what, and when",
  dsr_published_channel: "People know how to contact us about their data (form or email)",
  dsr_access: "We can send someone a copy of their data",
  dsr_rectification: "We can correct someone's data if it's wrong",
  dsr_erasure: "We can delete someone's data when asked",
  dsr_portability: "We can give someone their data in a file they can take elsewhere",
  dsr_objection: "We stop using someone's data if they object",
  dpia_before_high_risk: "We check privacy risks before starting anything risky with data",
  dpia_documents_risks: "We write those risks down",
  dpia_mitigation_measures: "We write down how we'll reduce those risks",
  breach_documented_process: "We have a written plan for data leaks",
  breach_notify_ndpc_72h: "We can tell the NDPC within 3 days of finding a leak",
  breach_risk_assessment: "We assess how serious each leak is",
  breach_register: "We keep a log of every leak and what we did",
  policy_published: "We have a privacy policy",
  policy_reachable_every_page: "It's linked from every page (usually the footer)",
  policy_covers_s27_disclosures:
    "It explains why we use data, how long we keep it, people's rights, and how to complain",
  lawful_basis_documented: "We've written down why we're allowed to use each type of data",
  lawful_basis_lia: "Where we rely on our own business interest, we've written down why that's fair",
  xborder_mechanism: "We have agreements in place with partners abroad",
  xborder_adequacy_assessed: "We've checked those countries protect data well enough",
  xborder_ndpc_approval: "We have NDPC approval where it's needed",
  ropa_maintained: "We keep a list of the personal data we hold",
  ropa_covers_all: "The list covers every team and system",
};

const META_COPY: Record<string, string> = {
  dsrResponseDays: "How many days do you usually take to answer a request?",
  policyLastUpdated: "When did you last update your privacy policy?",
  ropaLastReviewed: "When did you last review your data list?",
};

const SIZE_OPTIONS = [
  { label: "Fewer than 200", value: "150", max: 200 },
  { label: "200 – 1,000", value: "600", max: 1000 },
  { label: "1,000 – 5,000", value: "3000", max: 5000 },
  { label: "More than 5,000", value: "6000", max: Infinity },
];

function sizeIndex(raw: string): number {
  const n = parseInt(raw.replace(/,/g, ""), 10);
  if (Number.isNaN(n)) return -1;
  return SIZE_OPTIONS.findIndex((o) => n <= o.max);
}

const TIER_COPY: Record<string, { headline: string; body: string; tone: Tone }> = {
  STANDARD: {
    headline: "No registration needed",
    body: "You're a small data handler. You still need a clear privacy policy, must answer people's requests about their data, and must report serious data leaks.",
    tone: "ok",
  },
  OHL: {
    headline: "Register with the NDPC and renew every year",
    body: "Register as a data controller, appoint a Data Protection Officer, and renew your registration each year. You don't file a yearly audit.",
    tone: "info",
  },
  EHL: {
    headline: "Register, and file a yearly audit",
    body: "Register with the NDPC, appoint a Data Protection Officer, and file a yearly audit (Compliance Audit Return) through a licensed auditor (DPCO).",
    tone: "warn",
  },
  UHL: {
    headline: "Register, and file a yearly audit",
    body: "You're in the highest tier. Register with the NDPC, appoint a Data Protection Officer, and file a yearly audit (Compliance Audit Return) through a licensed auditor (DPCO).",
    tone: "bad",
  },
};

const SECTOR_OPTIONS: Array<{ value: DcpmiSector; label: string; hint: string }> = [
  { value: "uhl", label: "Bank, telecom, insurer, fintech or payment company", hint: "Also oil & gas, power distribution, multinationals, public social media or email apps, device makers" },
  { value: "ehl", label: "Government body, university or hospital", hint: "Also microfinance and mortgage banks. Hospitals: secondary or tertiary care" },
  { value: "ohl", label: "School, training provider, clinic or lab", hint: "Also primary health centres, hotels and guest houses under 50 suites, processors handling sensitive data of 200+ people commercially" },
  { value: "other", label: "None of these", hint: "" },
];

function niceDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

interface GaidTabProps {
  result: ScanResult;
  gaidInput: DcpmiAssessmentInput;
  setGaidInput: React.Dispatch<React.SetStateAction<DcpmiAssessmentInput>>;
}

export function GaidAssessmentTab({ result, gaidInput, setGaidInput }: GaidTabProps) {
  const tier = evaluateDcpmiTierAndDeadlines(gaidInput);
  const size = sizeIndex(gaidInput.dataSubjectsCount);
  const copy = TIER_COPY[tier.tier];
  const fromScan = deriveAutoChecklistState(result);
  const hints = deriveScanHints(result);
  const answered = size >= 0 && Boolean(gaidInput.sector);

  const items = GAID_CHECKLIST_GROUPS.flatMap((g) => g.items);
  const done = items.filter((i) => gaidInput.checkedItems[i.id]).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  const [openGroup, setOpenGroup] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setGaidInput((p) => ({
      ...p,
      checkedItems: { ...p.checkedItems, [id]: !p.checkedItems[id] },
    }));

  const dsrDays = parseInt(gaidInput.dsrResponseDays, 10);
  const dsrTooSlow = !Number.isNaN(dsrDays) && dsrDays > 30;
  const startMonth = gaidInput.commencementDate ? gaidInput.commencementDate.slice(0, 7) : "";

  return (
    <div className="space-y-10">
      {/* Part 1: two questions */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">What does the law expect from you?</h2>
          <p className="mt-0.5 text-[13px] text-fg-muted">
            Answer three quick questions. It depends on how many people&apos;s data you handle and what you do.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Box>
            <div className="space-y-6 p-5">
              <fieldset>
                <legend className="text-sm font-medium text-fg">
                  1. About how many people&apos;s data do you handle in 6 months?
                </legend>
                <p className="mt-1 text-xs text-fg-muted">
                  Customers, users, staff: anyone whose name, email, phone number or similar you store.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {SIZE_OPTIONS.map((o, i) => {
                    const active = size === i;
                    return (
                      <button
                        key={o.label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setGaidInput((p) => ({ ...p, dataSubjectsCount: o.value }))}
                        className={cx(
                          "rounded-lg border px-3 py-2.5 text-left text-[13px] font-medium transition",
                          active
                            ? "border-fg bg-subtle text-fg ring-1 ring-fg"
                            : "border-line-strong text-fg hover:bg-subtle"
                        )}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-fg">2. What kind of organisation are you?</legend>
                <p className="mt-1 text-xs text-fg-muted">
                  Some sectors are placed in a higher tier whatever their size.
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {SECTOR_OPTIONS.map((o) => {
                    const active = gaidInput.sector === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setGaidInput((p) => ({ ...p, sector: o.value }))}
                        className={cx(
                          "rounded-lg border px-3 py-2.5 text-left transition",
                          active
                            ? "border-fg bg-subtle ring-1 ring-fg"
                            : "border-line-strong hover:bg-subtle"
                        )}
                      >
                        <span className="block text-[13px] font-medium text-fg">{o.label}</span>
                        {o.hint && <span className="mt-0.5 block text-2xs text-fg-muted">{o.hint}</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-fg">
                  3. When did your organisation start collecting this data?
                </legend>
                <p className="mt-1 text-xs text-fg-muted">
                  Roughly is fine. Used to work out your first deadline. Skip if unsure.
                </p>
                <input
                  type="month"
                  aria-label="Month you started collecting data"
                  className="field mt-3 sm:w-56"
                  value={startMonth}
                  onChange={(e) =>
                    setGaidInput((p) => ({
                      ...p,
                      commencementDate: e.target.value ? `${e.target.value}-01` : "",
                    }))
                  }
                />
              </fieldset>
            </div>
          </Box>

          <Box className={cx(!answered && "border-dashed shadow-none")}>
            {!answered ? (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
                <div className="text-sm font-semibold text-fg">Your answer appears here</div>
                <p className="mt-1 max-w-xs text-[13px] text-fg-muted">
                  Answer the first two questions to see what you need to do.
                </p>
              </div>
            ) : (
              <div className="space-y-5 p-5">
                <div>
                  <Badge tone={copy.tone}>{SIZE_OPTIONS[size].label} people</Badge>
                  <div className="mt-3 text-base font-semibold text-fg">{copy.headline}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-fg-muted">{copy.body}</p>
                  {tier.raisedBySector && (
                    <p className="mt-2 text-xs text-fg-muted">
                      Your sector puts you in this tier, not your size.
                    </p>
                  )}
                </div>
                <dl className="space-y-3 border-t border-line pt-4 text-[13px]">
                  {tier.registrationFee && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-fg-muted">Registration fee</dt>
                      <dd className="text-right font-medium text-fg">{tier.registrationFee}</dd>
                    </div>
                  )}
                  {tier.nextCarDeadline && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-fg-muted">Next yearly audit due</dt>
                      <dd className="text-right">
                        <div className="font-medium text-fg">{niceDate(tier.nextCarDeadline)}</div>
                        <div className="text-2xs text-fg-subtle">Late filing adds 50% to the fee</div>
                      </dd>
                    </div>
                  )}
                  {tier.initialAuditDeadline && (
                    <div className="flex items-start justify-between gap-4">
                      <dt className="text-fg-muted">First audit due</dt>
                      <dd className="text-right">
                        <div className="font-medium text-fg">{niceDate(tier.initialAuditDeadline)}</div>
                        {tier.initialAuditOverdue && (
                          <div className="text-xs text-bad">This date has passed. File as soon as you can.</div>
                        )}
                      </dd>
                    </div>
                  )}
                </dl>
                <p className="text-2xs leading-relaxed text-fg-subtle">
                  Official term: {tier.label}. The NDPC also applies factor tests and sometimes moves deadlines,
                  so confirm both on ndpc.gov.ng or with a licensed DPCO.
                </p>
              </div>
            )}
          </Box>
        </div>
      </section>

      {/* Part 2: what's already in place */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">What do you already have in place?</h2>
            <p className="mt-0.5 text-[13px] text-fg-muted">
              Tick what&apos;s true today. We&apos;ve only ticked what we could prove from your website.
            </p>
          </div>
          <div className="w-full sm:w-56">
            <div className="flex justify-between text-xs">
              <span className="text-fg-muted">{done} of {items.length} in place</span>
              <span className="font-medium tabular-nums text-fg">{pct}%</span>
            </div>
            <ProgressBar value={pct} tone={scoreTone(pct)} className="mt-2" />
          </div>
        </div>

        <Box>
          <ul className="divide-y divide-line">
            {GAID_CHECKLIST_GROUPS.map((g) => {
              const gc = GROUP_COPY[g.id] ?? { title: g.title, about: g.description };
              const gDone = g.items.filter((i) => gaidInput.checkedItems[i.id]).length;
              const isOpen = openGroup === g.id;
              const complete = gDone === g.items.length;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenGroup(isOpen ? null : g.id)}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-subtle"
                  >
                    <span
                      className={cx(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                        complete ? "border-ok bg-ok text-white" : "border-line-strong text-transparent"
                      )}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-fg">{gc.title}</span>
                      <span className="block text-xs text-fg-muted">{gc.about}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-fg-muted">
                      {gDone}/{g.items.length}
                    </span>
                    <ChevronRight
                      className={cx("h-4 w-4 shrink-0 text-fg-subtle transition-transform", isOpen && "rotate-90")}
                    />
                  </button>

                  {isOpen && (
                    <div className="animate-fade-in border-t border-line bg-canvas px-4 py-2">
                      <ul>
                        {g.items.map((item) => {
                          const checked = !!gaidInput.checkedItems[item.id];
                          const seen = fromScan[item.id] === true;
                          const hint = hints[item.id];
                          return (
                            <li key={item.id}>
                              <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2.5 hover:bg-subtle">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggle(item.id)}
                                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-fg"
                                />
                                <span className="min-w-0 flex-1 text-[13px] text-fg" title={item.citation}>
                                  {ITEM_COPY[item.id] ?? item.label}
                                  {seen && (
                                    <span className="ml-2 inline-flex items-center gap-1 align-middle text-2xs text-info">
                                      <Sparkles className="h-3 w-3" />
                                      Seen on your website
                                    </span>
                                  )}
                                  {!seen && hint && (
                                    <span className="mt-0.5 block text-2xs text-fg-muted">{hint}</span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>

                      {g.metaField && (
                        <div className="mt-1 border-t border-line px-2 py-3">
                          <label className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-[13px] text-fg-muted">
                              {META_COPY[g.metaField.key]}{" "}
                              <span className="text-fg-subtle">(optional)</span>
                            </span>
                            <input
                              type={g.metaField.type}
                              className="field sm:w-44"
                              placeholder={g.metaField.type === "number" ? "e.g. 14" : undefined}
                              value={gaidInput[g.metaField.key]}
                              onChange={(e) =>
                                setGaidInput((p) => ({ ...p, [g.metaField!.key]: e.target.value }))
                              }
                            />
                          </label>
                          {g.metaField.key === "dsrResponseDays" && dsrTooSlow && (
                            <Warn>The Act requires answers without unreasonable delay (s. 34(1)). Most organisations aim for 30 days or less.</Warn>
                          )}
                          {g.metaField.key === "policyLastUpdated" &&
                            olderThan12Months(gaidInput.policyLastUpdated) && (
                              <Warn>That&apos;s over a year ago. Review it at least once a year.</Warn>
                            )}
                          {g.metaField.key === "ropaLastReviewed" &&
                            olderThan12Months(gaidInput.ropaLastReviewed) && (
                              <Warn>That&apos;s over a year ago. Review it at least once a year.</Warn>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Box>
      </section>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-warn">
      <AlertTriangle className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

/* ================================================================== */
/* Internal audit worksheet                                            */
/* ================================================================== */

interface InternalAuditWorksheetTabProps {
  result: ScanResult;
  profile: RemediationProfile;
  overrides: Record<string, InternalComplianceAnswer>;
  setOverrides: React.Dispatch<
    React.SetStateAction<Record<string, InternalComplianceAnswer>>
  >;
}

const ANSWER_STYLE: Record<InternalComplianceAnswer, string> = {
  Yes: "border-ok-line bg-ok-subtle text-ok",
  Partial: "border-warn-line bg-warn-subtle text-warn",
  No: "border-bad-line bg-bad-subtle text-bad",
  Verify: "border-line-strong bg-surface text-fg-muted",
};

export function InternalAuditWorksheetTab({
  result,
  profile,
  overrides,
  setOverrides,
}: InternalAuditWorksheetTabProps) {
  const sections = buildInternalAuditSections(result, overrides);
  const all = sections.flatMap((s) => s.items);
  const count = (a: InternalComplianceAnswer) => all.filter((i) => i.compliant === a).length;

  return (
    <div className="space-y-6">
      <SectionHeading
        title="Internal audit"
        description="Sections 3.1–3.9. Scan findings are pre-filled; set each item's status as your DPO verifies internal records, then export."
        actions={
          <>
            {Object.keys(overrides).length > 0 && (
              <Button size="sm" icon={RotateCcw} onClick={() => setOverrides({})}>
                Reset
              </Button>
            )}
            <Button
              size="sm"
              variant="primary"
              icon={Download}
              onClick={() =>
                downloadBlob(
                  generateInternalAuditMarkdown(result, profile, overrides),
                  "ndpa-internal-audit-report.md",
                  "text/markdown;charset=utf-8"
                )
              }
            >
              Export report
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Compliant" value={count("Yes")} tone="ok" />
        <Stat label="Partial" value={count("Partial")} tone="warn" />
        <Stat label="Gaps" value={count("No")} tone="bad" />
        <Stat label="To verify" value={count("Verify")} />
      </div>

      <div className="space-y-4">
        {sections.map((s) => {
          const gaps = s.items.filter((i) => i.compliant !== "Yes").length;
          return (
            <Box key={s.id}>
              <BoxHeader
                title={
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-fg-muted">{s.code}</span>
                    {s.title}
                  </span>
                }
                description={s.legalReference}
                actions={
                  gaps === 0 ? (
                    <Badge tone="ok">Complete</Badge>
                  ) : (
                    <Badge tone="warn">{gaps} open</Badge>
                  )
                }
              />
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-line">
                      {["Question", "Finding", "Status", "Gap / action"].map((h) => (
                        <th
                          key={h}
                          className="px-4 py-2 text-2xs font-semibold uppercase tracking-wider text-fg-muted"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.items.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="w-[26%] px-4 py-3">
                          <div className="text-[13px] font-medium text-fg">{item.question}</div>
                          <div className="mt-1 text-2xs text-fg-subtle">
                            {item.source === "automated" ? "From scan" : "Manual check"}
                          </div>
                        </td>
                        <td className="w-[32%] px-4 py-3 text-xs leading-relaxed text-fg-muted">
                          {item.finding}
                        </td>
                        <td className="w-36 px-4 py-3">
                          <select
                            aria-label={item.question}
                            value={item.compliant}
                            onChange={(e) =>
                              setOverrides((p) => ({
                                ...p,
                                [item.id]: e.target.value as InternalComplianceAnswer,
                              }))
                            }
                            className={cx(
                              "h-7 w-full rounded-md border px-2 text-xs font-medium outline-none",
                              ANSWER_STYLE[item.compliant]
                            )}
                          >
                            <option value="Yes">Compliant</option>
                            <option value="Partial">Partial</option>
                            <option value="No">Gap</option>
                            <option value="Verify">To verify</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 text-xs leading-relaxed text-fg-muted">
                          {item.compliant === "Yes" ? (
                            <span className="text-fg-subtle">—</span>
                          ) : (
                            item.gapIdentified
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Box>
          );
        })}
      </div>
    </div>
  );
}
