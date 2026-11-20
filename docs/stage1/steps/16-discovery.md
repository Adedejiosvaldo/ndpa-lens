# Step 16 — Page discovery up to 25 pages

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** SCAN-02, §5.1 step 2
**Depends on:** 15
**Branch:** `stage1/16-discovery`

## Goal
Choose the pages that matter for evidence on each domain.

## Scope
**In**
- Same-site link collection, ranked by the §5.1 keywords; user-named URLs always included; cap of 25; page_type assigned

**Out**
- Capture

## Files / packages touched
- packages/scan-engine/src/discover/**

## Reuse from current code
- `pickSubpages` in `page-inspect.ts`

## Acceptance
- [ ] Unit tests on fixture HTML: ranking, dedupe, cap, off-site links dropped

## Verification
- `pnpm --filter @ndpa/scan-engine test -- discover`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
