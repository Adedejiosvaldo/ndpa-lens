import type { Metadata } from "next";
import type * as React from "react";
import Link from "next/link";
import { Brand } from "@/components/brand";
import { DaysToCar } from "@/components/landing/countdown";
import { HeroPack } from "@/components/landing/hero-pack";
import { LandingMotion } from "@/components/landing/landing-motion";
import { NavAuth } from "@/components/landing/nav-auth";
import { RevealHeading } from "@/components/landing/reveal-heading";
import { Button } from "@/components/ui/button";
import { daysToCar } from "@/lib/car";

export const metadata: Metadata = {
  title: { absolute: "NDPA Lens: website evidence packs for DPCOs" },
};

const PROBLEMS: { title: string; body: string }[] = [
  {
    title: "A screenshot shows a banner. It doesn't show what loaded first.",
    body: "Most consent failures happen in the first second: a pixel or analytics script fires before anyone has clicked anything. You can't see that by looking at the page.",
  },
  {
    title: "If a developer can't reproduce it, the finding loses.",
    body: "Clients push back. A finding needs the exact request, cookie, page and moment it came from, and a way for someone else to check it.",
  },
  {
    title: "Three consent states, every key page, every client.",
    body: "Clicking through home, policy, sign-up and checkout pages in all three consent states doesn't scale to a full client list in CAR season.",
  },
];

const COVERAGE: { area: string; count: number; examples: string }[] = [
  { area: "Consent", count: 8, examples: "Trackers before consent or after “reject all”, missing or lopsided banners, pre-ticked boxes, session replay." },
  { area: "Transparency", count: 3, examples: "Privacy policy linked from the homepage, required disclosures present, notice at the point of collection." },
  { area: "Data subject rights", count: 2, examples: "A published DPO contact and a channel for rights requests." },
  { area: "Security", count: 4, examples: "HTTPS and HSTS, TLS version, security headers, forms posting over HTTP." },
  { area: "Transfers and sharing", count: 3, examples: "Data sent abroad without a stated basis, personal data in third-party requests, pixels on checkout and login." },
];

const STEPS: { n: string; title: string; body: string }[] = [
  { n: "01", title: "Add the client, confirm you're engaged", body: "Name the domains and any pages that matter. Your attestation is recorded with who, when and from where." },
  { n: "02", title: "We find the pages that collect data", body: "Up to 25 pages per domain: the homepage, privacy policy, sign-up, login, checkout, contact and careers, plus any URL you name." },
  { n: "03", title: "Each page is recorded three times", body: "No interaction, after “reject all”, after “accept all”. Every request, cookie, screenshot and page snapshot goes into the evidence bundle." },
  { n: "04", title: "Checks run over the recording", body: "Twenty checks mapped to the NDPA and GAID. They read the stored evidence only, so the same bundle always gives the same findings." },
];

const PACK: { code: string; title: string; body: string }[] = [
  { code: "A", title: "Executive summary", body: "What's wrong and how serious it is, in language a board can read." },
  { code: "B", title: "Findings by NDPA area", body: "Severity, pages affected, legal reference and the fix, each linked to its evidence." },
  { code: "C", title: "Cross-border data-flow map", body: "Every third party the site contacts, the country it's in, and whether it loaded before consent." },
  { code: "D", title: "Evidence appendix", body: "Screenshots with the problem highlighted, network recordings and page snapshots for every consent state." },
  { code: "E", title: "Integrity statement", body: "A SHA-256 manifest of every file, signed by NDPA Lens. Anyone can check a pack hasn't been altered." },
];

const TEAM: { title: string; body: string }[] = [
  { title: "Your brand, not ours", body: "Your logo, colour, address and licence number on the cover. NDPA Lens appears as one small line." },
  { title: "Roles that match a firm", body: "Owners handle billing, Admins run the team, Analysts prepare audits, Viewers review packs." },
  { title: "Analyst judgement, on the record", body: "Mark a finding as a false positive with a note. The original result is kept and both appear in the audit trail." },
  { title: "Before and after, free", body: "Re-scan after the client's fixes in the same audit cycle at no cost, and show what's fixed, still open or new." },
];

const SECURITY: { title: string; body: string }[] = [
  { title: "Each firm walled off in the database", body: "Every query is limited to your organisation by the database itself, not only by our code." },
  { title: "Two-factor sign-in", body: "Required for Owners, available to everyone, with single-use recovery codes." },
  { title: "An audit log you can't edit", body: "Sign-ins, role changes, scans and downloads are recorded append-only. Not even we can rewrite them." },
  { title: "A scanner that behaves", body: "It never submits a form, identifies itself to the sites it visits, and honours opt-out requests." },
];

export default function Landing() {
  const days = daysToCar(Date.now());
  return (
    <>
      <LandingMotion />
      <header className="sticky top-0 z-30 border-b border-transparent bg-bg/80 backdrop-blur supports-[backdrop-filter]:bg-bg/70">
        <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1240px] items-center gap-8 px-5 sm:px-8">
          <Brand />
          <ul className="hidden items-center gap-6 text-sm text-muted md:flex">
            <li><a href="#how" className="transition-colors hover:text-text">How it works</a></li>
            <li><a href="#pack" className="transition-colors hover:text-text">The pack</a></li>
            <li><a href="#teams" className="transition-colors hover:text-text">For DPCO teams</a></li>
            <li><a href="#security" className="transition-colors hover:text-text">Security</a></li>
          </ul>
          <div className="ml-auto">
            <NavAuth />
          </div>
        </nav>
      </header>

      <main id="main" tabIndex={-1}>
        {/* Hero */}
        <section data-hero className="overflow-hidden">
          <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20 lg:pb-28">
            <div>
              <RevealHeading as="h1" text="Prove what a client's website does with personal data." className="text-[2.5rem] leading-[1.02] sm:text-6xl lg:text-[4.25rem]" />
              <p data-hero-fade style={{ "--i": 0 } as React.CSSProperties} className="mt-6 max-w-[36rem] text-lg leading-relaxed text-muted">
                For NDPC-licensed DPCOs. We record the site before consent, after “reject all” and after “accept all”, and you hand over a signed evidence pack in your firm's name, mapped to NDPA&nbsp;2023 and GAID&nbsp;2025.
              </p>
              <div data-hero-fade style={{ "--i": 1 } as React.CSSProperties} className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Button asChild size="lg">
                  <Link href="/signup">Create your workspace</Link>
                </Button>
                <a href="#how" className="text-sm font-medium underline decoration-border decoration-1 underline-offset-4 transition-colors hover:decoration-text">
                  See how a scan works
                </a>
              </div>
            </div>
            <HeroPack />
          </div>
        </section>

        {/* Coverage */}
        <section aria-labelledby="coverage-h" className="border-t border-border">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
            <div className="max-w-3xl">
              <h2 id="coverage-h" className="font-display text-3xl leading-[1.1] sm:text-4xl">
                Twenty checks across the parts of NDPA&nbsp;2023 and GAID&nbsp;2025 a website can break.
              </h2>
              <p className="mt-4 max-w-[62ch] leading-relaxed text-muted">
                Compliance workspaces help a company run its programme. NDPA Lens does one job for the auditor: it proves what the website actually does, in a pack anyone can verify.
              </p>
            </div>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-5">
              {COVERAGE.map((c) => (
                <li key={c.area} className="bg-bg p-6">
                  <p className="font-display text-4xl text-accent tabular">{c.count}</p>
                  <p className="mt-1 font-medium tracking-tight">{c.area}</p>
                  <p className="mt-3 text-sm leading-relaxed text-muted">{c.examples}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-muted">Check catalogue v1. Legal references are reviewed by a data protection lawyer before launch.</p>
          </div>
        </section>

        {/* Problem */}
        <section aria-labelledby="problem-h" className="border-t border-border">
          <div className="mx-auto grid max-w-[1240px] gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[0.9fr_1.1fr] lg:py-32">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 id="problem-h" className="font-display mt-4 text-4xl leading-[1.08] sm:text-5xl">Hand-gathered evidence is easy to dispute.</h2>
            </div>
            <ul className="space-y-12">
              {PROBLEMS.map((p) => (
                <li key={p.title} className="border-t border-border pt-6">
                  <div>
                    <h3 className="text-xl font-medium tracking-tight">{p.title}</h3>
                    <p className="mt-2 max-w-[60ch] leading-relaxed text-muted">{p.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section id="how" tabIndex={-1} aria-labelledby="how-h" data-how className="scroll-mt-20 bg-surface outline-none">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
            <h2 id="how-h" className="font-display mt-4 max-w-3xl text-4xl leading-[1.08] sm:text-5xl">One scan. Three states of consent. Every page that matters.</h2>
            <div className="mt-16 grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div data-how-rail className="space-y-3 self-start">
                <div className="relative overflow-hidden rounded-xl border border-border bg-bg p-6 shadow-[var(--shadow-paper)]">
                  <p className="font-mono text-[11px] text-muted">harbourassurance.ng/checkout</p>
                  <ul className="mt-4 space-y-2">
                    {[
                      ["No interaction", "14 requests · 6 third parties"],
                      ["After “reject all”", "11 requests · 4 third parties"],
                      ["After “accept all”", "23 requests · 9 third parties"],
                    ].map(([state, detail]) => (
                      <li key={state} data-state className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
                        <span className="text-sm font-medium">{state}</span>
                        <span className="font-mono text-[11px] text-muted">{detail}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="absolute top-6 bottom-6 left-0 w-0.5 bg-border" aria-hidden>
                    <div data-how-progress className="h-full w-full origin-top scale-y-0 bg-accent" />
                  </div>
                </div>
                <p className="text-xs text-muted">Illustrative figures from a sample scan.</p>
              </div>
              <ol className="space-y-6">
                {STEPS.map((s) => (
                  <li key={s.n} data-step className="rounded-xl border border-border bg-bg p-6 lg:p-8">
                    <p className="font-mono text-xs text-accent">{s.n}</p>
                    <h3 className="mt-2 text-xl font-medium tracking-tight">{s.title}</h3>
                    <p className="mt-2 max-w-[56ch] leading-relaxed text-muted">{s.body}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* The pack */}
        <section id="pack" tabIndex={-1} aria-labelledby="pack-h" className="scroll-mt-20 outline-none">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
            <div className="max-w-3xl">
              <div>
                <h2 id="pack-h" className="font-display mt-4 text-4xl leading-[1.08] sm:text-5xl">What you hand your client.</h2>
              </div>
              <p className="mt-5 max-w-[60ch] leading-relaxed text-muted">
                A branded PDF for people, a JSON file in the <span className="font-mono text-[0.9em]">ndpa-lens/pack@1</span> format for your own tools, and a ZIP of the raw evidence. Packs never change once generated. An analyst's note creates a new version.
              </p>
            </div>
            <dl className="mt-14 divide-y divide-border border-y border-border">
              {PACK.map((p) => (
                <div key={p.code} className="grid gap-2 py-6 sm:grid-cols-[4rem_16rem_1fr] sm:items-baseline sm:gap-6">
                  <dt className="contents">
                    <span className="font-mono text-2xl text-accent" aria-hidden>
                      {p.code}
                    </span>
                    <span className="text-lg font-medium tracking-tight">{p.title}</span>
                  </dt>
                  <dd className="max-w-[60ch] leading-relaxed text-muted">{p.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* For DPCO teams */}
        <section id="teams" tabIndex={-1} aria-labelledby="teams-h" className="scroll-mt-20 bg-surface outline-none">
          <div className="mx-auto grid max-w-[1240px] gap-14 px-5 py-24 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:py-32">
            <div>
              <h2 id="teams-h" className="font-display mt-4 text-4xl leading-[1.08] sm:text-5xl">Your brand on every page. Your team on every client.</h2>
            </div>
            <div>
              <div className="grid items-center gap-8 sm:grid-cols-[1fr_auto]">
                <div>
                  <h3 className="text-xl font-medium tracking-tight">{TEAM[0]!.title}</h3>
                  <p className="mt-2 max-w-[48ch] leading-relaxed text-muted">{TEAM[0]!.body}</p>
                </div>
                <div aria-hidden className="w-56 rounded-lg bg-bg p-4 shadow-[var(--shadow-lift)]">
                  <div className="flex items-center gap-2">
                    <span className="size-4 rounded" style={{ background: "#7a2e1d" }} />
                    <span className="text-xs font-semibold" style={{ color: "#7a2e1d" }}>
                      Adeyemi &amp; Co
                    </span>
                  </div>
                  <p className="mt-4 text-[10px] text-muted">NDPA technical evidence pack</p>
                  <p className="text-sm font-semibold">Harbour Assurance Plc</p>
                  <p className="mt-5 text-[9px] text-muted">Technical evidence generated by NDPA Lens</p>
                </div>
              </div>
              <ul className="mt-10 divide-y divide-border border-t border-border">
                {TEAM.slice(1).map((t) => (
                  <li key={t.title} className="grid gap-1 py-5 sm:grid-cols-[14rem_1fr] sm:gap-6">
                    <h3 className="font-medium tracking-tight">{t.title}</h3>
                    <p className="leading-relaxed text-muted">{t.body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Deadline */}
        <section aria-label="CAR filing deadline" className="bg-ink text-white">
          <div className="mx-auto flex max-w-[1240px] flex-col gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="font-display text-5xl leading-none tracking-tight sm:text-7xl">
                <DaysToCar initial={days} /> <span className="text-ink-muted italic">days</span>
              </p>
              <p className="mt-4 max-w-[48ch] text-[#d1d5db]">until Compliance Audit Returns are due from UHL and EHL organisations, on 31 March 2027. A client scanned this month leaves time to re-scan after their fixes.</p>
            </div>
            <Button asChild size="lg" className="bg-white text-ink hover:bg-[#e7f6f0]">
              <Link href="/signup">Create your workspace</Link>
            </Button>
          </div>
        </section>

        {/* Security */}
        <section id="security" tabIndex={-1} aria-labelledby="security-h" className="scroll-mt-20 outline-none">
          <div className="mx-auto max-w-[1240px] px-5 py-24 sm:px-8 lg:py-32">
            <h2 id="security-h" className="font-display mt-4 max-w-4xl text-4xl leading-[1.08] sm:text-5xl">We hold ourselves to the standard we test your clients against.</h2>
            <dl className="mt-14 grid gap-x-16 gap-y-10 sm:grid-cols-2">
              {SECURITY.map((s) => (
                <div key={s.title}>
                  <dt className="text-lg font-medium tracking-tight">{s.title}</dt>
                  <dd className="mt-1.5 max-w-[52ch] leading-relaxed text-muted">{s.body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-h" className="border-t border-border">
          <div className="mx-auto max-w-[1240px] px-5 py-24 text-center sm:px-8 lg:py-32">
            <h2 id="cta-h" className="font-display mx-auto text-5xl leading-[1.04] sm:text-6xl">Start with your next client.</h2>
            <p className="mx-auto mt-5 max-w-[46ch] text-lg text-muted">
              Set up takes a few minutes. Your first three packs are free while we verify your DPCO licence.
            </p>
            <div className="mt-8">
              <Button asChild size="lg">
                <Link href="/signup">Create your workspace</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-6 px-5 py-10 text-sm text-muted sm:px-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Brand />
            <p className="max-w-[52ch] text-xs leading-relaxed">
              NDPA Lens produces technical evidence of how a website behaved at a point in time. It is not legal advice; the DPCO remains responsible for the audit conclusion.
            </p>
          </div>
          <div className="space-y-2 text-xs md:text-right">
            <p>Our privacy notice and terms are published before launch.</p>
            <p>Icons: Solar by 480 Design (CC BY 4.0).</p>
            <p>© 2026 NDPA Lens</p>
          </div>
        </div>
      </footer>
    </>
  );
}
