# Step 27 — Rescan and diff

**Phase:** Phase 4 — Evidence pack
**PRD refs:** DIFF-01..03
**Depends on:** 26
**Branch:** `stage1/27-rescan-diff`

## Goal
Before and after evidence for the client.

## Scope
**In**
- Rescan with a chosen baseline; table finding_diffs; fixed, still open, new or regressed
- `GET /diff`; diff view UI
- Diff section in the next pack version

**Out**
- —

## Files / packages touched
- apps/api/src/scans/diff/**, apps/web diff view, packages/pdf

## Reuse from current code
- Comparison logic idea from the legacy `ScanComparison`

## Acceptance
- [ ] A fixtures pass↔fail switch gives the expected diff classes

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
