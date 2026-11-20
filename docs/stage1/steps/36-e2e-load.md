# Step 36 — End-to-end journey and load test

**Phase:** Phase 6 — Production and launch
**PRD refs:** §12, §11
**Depends on:** 35
**Branch:** `stage1/36-e2e-load`

## Goal
Prove the whole journey and the capacity targets.

## Scope
**In**
- Playwright: sign up → verify → MFA → client → attest → scan → pack download → rescan diff → purchase in Paystack test mode
- k6: 20 concurrent scans plus 100 web users on staging

**Out**
- —

## Files / packages touched
- tests/e2e/**, tests/load/**

## Reuse from current code
- —

## Acceptance
- [ ] E2E green in CI; k6 meets the §11 targets or the gaps are recorded

## Verification
- `pnpm test:e2e`, `k6 run tests/load/*.js`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
