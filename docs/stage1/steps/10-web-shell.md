# Step 10 — `apps/web` shell and auth UI

**Phase:** Phase 1 — Foundations
**PRD refs:** §3.1, §11
**Depends on:** 09
**Branch:** `stage1/10-web-shell`

## Goal
The Next.js app with the design system, plus every screen for auth and org settings.

## Scope
**In**
- Next.js App Router, Tailwind, shadcn/ui; tokens with one accent, neutral greys, severity colours that pass AA in light and dark
- Inter at 14px; en-GB, ₦ and WAT formatting helpers
- Typed API client that handles CSRF
- Screens: sign up (with a strength meter), verify email, log in, MFA (QR, recovery code download), sessions, org profile, members and invites, audit log
- Initial JS under 250 KB gzipped

**Out**
- Mocks (Step 11)
- Client and scan screens

## Files / packages touched
- apps/web/**

## Reuse from current code
- Theme and anti-flash script approach from `apps/legacy-scanner/src/app/layout.tsx`

## Acceptance
- [x] Playwright: sign up → verify (Mailpit) → enrol MFA → invite a member → accept
- [x] axe check has no serious violations
- [x] Bundle size checked

## Verification
- `pnpm --filter web build && pnpm --filter web test:e2e`

## Notes
Done 2026-11-21.
- **`apps/web`:** Next.js 15 (App Router), React 19, Tailwind 4, shadcn-style primitives written in the repo (Button, Field/SelectField, Card/Alert, SeverityBadge, Confirm dialog on Radix), lucide icons, Inter via `next/font`.
- **Design tokens** (`globals.css`): one accent, neutral greys, and severity colours (critical, high, medium, low, info), each with a background. All are chosen for AA contrast in light and dark (`prefers-color-scheme`). Severity is always colour plus a text label. Base font size is 14px.
- **Formatters** (`lib/format.ts`): `formatDate` → "20 Nov 2026", `formatDateTime` → "20 Nov 2026, 14:05 WAT" (Africa/Lagos), `formatNaira(kobo)` → "₦100,000".
- **API client** (`lib/api.ts`):
  - Fetches with credentials and sends the CSRF token, refreshing it once if it's stale.
  - problem+json becomes an `ApiError` with field errors.
  - `NEXT_PUBLIC_API_URL` is baked in at build time (default http://localhost:4000).
- **Session** (`lib/session.tsx`): `useRequireAuth` sends signed-out users to /login?next=, and Owners or Platform Admins without MFA to /settings/security?setup=1. `landingFor()` picks where to go after sign-in. Where to go after verification is kept in localStorage, so an invitee who signs up is taken back to the invitation.
- **Screens:**
  - Auth: sign-up (with strength meter; organisation fields shown only to founders, not invitees), check email, verify, sign-in, MFA step (code or recovery code), forgot and reset password, accept invitation.
  - App shell with org name, nav and sign-out.
  - Security: MFA enrolment with QR (the `qrcode` library), manual key, 10 recovery codes with .txt download; sessions with sign-out.
  - Organisation profile (read-only below Admin), licence status, Members (invite, change role, remove, make Owner, pending invitations, cancel; every destructive action uses a confirm dialog naming the item), and the audit log (paged, plain-English actions).
  - Org overview placeholder (Step 32).
- **E2E** (`apps/web/e2e`):
  - Global setup starts Postgres, Redis and Mailpit with Testcontainers, runs `db:setup`, then starts the **built** API on :4000 and `next start` on :3100. If setup fails, it shuts them down.
  - Spec 1: founder sign-up → Mailpit verification link → forced MFA enrolment (TOTP computed in the test) → invite an analyst → the colleague signs up without an org in a second browser, verifies, accepts → founder sees them in Members and "Invitation accepted" in the audit log.
  - Spec 2: a wrong password shows a clear error.
  - axe (WCAG 2.0/2.1 A and AA) on sign-up, security (during enrolment), members and login: no serious or critical issues.
- **Bundle budget:** `pnpm --filter web check:bundle` gzips each route's JS from `app-build-manifest.json`. Largest route: security page, 135.4 KB (limit 250 KB).
- **CI:** after typecheck, build and test, CI now runs the bundle check, installs Playwright Chromium and runs the e2e tests. On failure it uploads the Playwright report.
- **Proof:** locally, `pnpm typecheck`, `build` and `test` (88 tests) pass, `pnpm test:e2e` has 2 passing, and the bundle check passes. Ports are freed after the run.
- **Open:**
  - e2e uses fixed ports 3100 and 4000, so stop a local dev API before running it.
  - The web build bakes in the API URL; deploys set `NEXT_PUBLIC_API_URL` (Step 33).
  - Mobile and tablet layouts haven't been tuned yet (desktop-first, as PRD §3.1 says).
