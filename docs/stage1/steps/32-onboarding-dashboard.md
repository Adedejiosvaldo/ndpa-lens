# Step 32 — Onboarding checklist, dashboard and empty states

**Phase:** Phase 5 — Commerce, admin, public
**PRD refs:** §3, §3.1
**Depends on:** 31
**Branch:** `stage1/32-onboarding-dashboard`

## Goal
From sign-up to first pack in under 10 minutes.

## Scope
**In**
- 4-step onboarding checklist (licence, branding, first client, first scan), which can be skipped
- Dashboard: credits, clients scanned vs not, packs this season, days to the CAR deadline, recent scans
- Sample demo client that scans in one click (a fixtures or demo site we control)
- Plain-English failed-scan states with 'no credit spent'

**Out**
- —

## Files / packages touched
- apps/web/(app)/**

## Reuse from current code
- `gaid-assessment.ts` deadline logic

## Acceptance
- [ ] Timed walkthrough from a new sign-up to a downloaded pack in under 10 minutes

## Verification
- `pnpm --filter web test:e2e -- onboarding`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
