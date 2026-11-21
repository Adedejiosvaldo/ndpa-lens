# Step 10a — UI polish pass and marketing landing page

**Phase:** Phase 1 — Foundations (added 2026-11-21 at the owner's request)
**PRD refs:** §3.1 (UI notes, design system), §11 (performance, accessibility)
**Depends on:** 10
**Branch:** `stage1/10a-ui-polish-landing`

## Goal
Bring the Step 10 screens up to a premium standard, and add the public marketing landing page for DPCOs. Use the installed design skills: `redesign-existing-projects` audits the app screens, `build-awwwards-quality-sites` sets the bar for the landing page, and `design:ux-copy` covers the copy.

## Art direction
> **Superseded on 21 Nov 2026 by the owner:** "we are a tech startup… like Vanta". The direction is now **evidence-grade compliance tech**: white with cool neutrals, emerald accent (#047857 for text and buttons, #10b981 for highlights), Geist for display and body (no serif), Geist Mono for evidence, dark ink bands used once. The original paper-and-serif direction is kept below for the record.

- **Visual thesis: "Evidence, not opinion."** The look of a sealed legal exhibit: paper surfaces, ink-dark type, a single deep green accent, hairline rules, exhibit labels, and SHA-256 hashes as texture. It should feel calm and credible to a lawyer, never "AI SaaS".
- **Type:** Newsreader (serif) for display and page titles, Geist for UI and body, Geist Mono for hashes, IDs and numbers (tabular). This replaces PRD §3.1's "Inter (or system font)" at the owner's request: Inter is the generic default the skills flag.
- **Colour:** keep the single accent (#0f5f56, a desaturated deep green) and the AA severity scale. Neutrals use one warm grey family on a paper tone (#faf9f6), not pure white or black, with tinted shadows and a faint grain on large surfaces.
- **Hero focal asset:** an authored "evidence pack" composition built in real HTML: a branded cover, a finding card with a severity label and evidence line, and a data-flow strip with a manifest hash. A GSAP intro files the pages into a stack, then pointer parallax tilts it a little. It is complete as a static first frame.
- **Sections:** hero → why hand-gathered evidence gets disputed → how a scan works (pinned scrub through the three consent states) → what's in the pack → built for DPCO teams (white-label, roles, MFA, audit log) → CAR deadline countdown → how we handle your clients' data → final CTA → footer.
- **Motion:** GSAP with ScrollTrigger. Headings reveal word by word; the how-it-works timeline is scrubbed. **Lenis** is the only smooth-scroll engine; Locomotive was rejected as heavier and redundant. Under `prefers-reduced-motion`, smooth scroll and scrubbing are off and final states render immediately.
- **Three.js: no.** PRD §11 targets slow Nigerian connections (initial JS under 250 KB). The data-flow map is a data graphic, not a shader.
- **Assets:** no photos of people, no logos, no testimonials. There's no honest customer proof yet, so none is shown. Icons are Solar via Iconify, rendered at build time as inline SVG. Every visual is authored UI or a data graphic.
- **Claims:** no prices (₦100k is unvalidated, PRD §14), no "trusted by", no award language. The CTA is the real sign-up.

## Scope
**In**
- App screens: font system, hover, active and focus states, skeleton loaders, empty states, skip link, branded 404, split-screen auth layout, tabular numbers, balanced headings, and a copy pass on every string.
- Landing page at `/` (server-rendered; signed-in visitors get "Open your workspace").
- E2E and axe checks for the landing page, the reduced-motion path and keyboard use. The bundle budget still applies.

**Out**
- The free public scanner flow (Step 31). Legal pages (Step 37): the footer says plainly that they're published before launch.

## Acceptance
- [x] Production build passes, every route stays under the 250 KB budget, and the existing e2e journey still passes
- [x] Landing: no serious axe issues; keyboard reaches the CTA via the skip link; content complete with reduced motion; one smooth-scroll engine
- [x] Screenshots reviewed at 1280 px and 390 px
- [x] No placeholder copy, AI clichés, fake proof or unsupported claims

## Verification
- `pnpm --filter web build && pnpm --filter web check:bundle && pnpm test:e2e`

## Notes
Done 2026-11-21.
- **Direction:** changed mid-step at the owner's request to the tech look (see the note at the top). Tokens are in `apps/web/src/app/globals.css`; fonts are Geist and Geist Mono via `next/font`.
- **Skills:** `redesign-existing-projects`, `build-awwwards-quality-sites`, `design:ux-copy`, plus five installed for the critique: `frontend-design` (Anthropic), `vercel-react-best-practices` (Vercel), `shadcn`, `copywriting` (Corey Haines), alongside the already-installed `design-taste-frontend` and `emil-design-eng`. `page-cro` failed to install (its installer asks an interactive question). The full critique with before/after tables is in `docs/stage1/reviews/2026-11-21-design-critique.md`; every item marked fixed there is in this branch.
- **Landing page (`/`):**
  - Server-rendered with client islands: the hero tilt, the session-aware nav and the CAR countdown, plus `LandingMotion`.
  - The hero intro is **CSS keyframes**, so it plays at first paint. GSAP with ScrollTrigger and **Lenis** (the only smooth-scroll engine) load after hydration, only for the how-it-works scrub. With reduced motion, none of them load.
  - Sections: hero (product-UI pack sample, labelled illustrative), the problem, how it works (pinned scrub), the pack contents, for DPCO teams, a CAR countdown band, security statements, final CTA, footer.
  - No logos, testimonials or prices.
- **App polish:**
  - Split-screen auth layout with an ink brand panel; branded 404; skip link with a focusable main.
  - Skeleton loaders and empty states; sections divided by headings and hairlines instead of stacked cards; pending invitations shown as a table.
  - Readable devices ("Chrome on Windows") and compact IPs.
  - Button and field states: exact transition properties at 150 ms, press scale 0.98, focus ring.
- **Icons:** Solar via Iconify, generated at build time (`pnpm --filter web icons` → `icons.generated.ts`, 33 icons). `lucide-react` removed.
- **Performance:** landing first-load JS down from 171 KB to **121 KB** by deferring GSAP and Lenis. The QR library loads only when MFA enrolment starts. Largest route: the security page at 127.8 KB gzipped (limit 250).
- **Bug found:** a running `pnpm dev` wrote into the same `.next` folder as the production builds, which caused the earlier missing-chunk 500s and `main-app.js` 404s. `next.config.ts` now reads `distDir` from `NEXT_DIST_DIR`; the dev script uses `.next-dev`. **The owner should restart `pnpm dev` to pick this up.**
- **Accessibility fixes found by the new tests:** dimmed scrub states failed contrast (they now use an accent border and tint); the brand link's accessible name didn't match its visible text; the skip link was swallowed by the anchor handler.
- **E2E:** new `landing.spec.ts` covers axe, one smooth-scroll engine, the CTA leading to sign-up, the skip link and the reduced-motion path. The journey spec can save screenshots with `E2E_SHOTS=<dir>`, and the API port can be changed with `E2E_API_URL`.
- **Proof:** a build into `.next-e2e` passes; the bundle check passes; `pnpm test:e2e` has **5/5 passing**; screenshots were reviewed at 1280 px and 390 px.
- **[NEED]:**
  - A real rendered pack page or findings screenshot for the hero (Steps 23 and 25).
  - DPCO quotes after outreach.
  - Validated pricing.
  - Legal pages (Step 37).
