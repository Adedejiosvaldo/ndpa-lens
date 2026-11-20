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
- [ ] Playwright: sign up → verify (Mailpit) → enrol MFA → invite a member → accept
- [ ] axe check has no serious violations
- [ ] Bundle size checked

## Verification
- `pnpm --filter web build && pnpm --filter web test:e2e`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
