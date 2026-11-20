# Step 14 — Extract `packages/scan-engine`

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5
**Depends on:** 02
**Branch:** `stage1/14-extract-scan-engine`

## Goal
Move the existing scanner logic into a package that the new workers and the legacy app share.

## Scope
**In**
- Move net-guard, trackers, page-inspect, policy-analyzer, browser-capture, url-check and site-icon into `packages/scan-engine`
- `apps/legacy-scanner` imports from the package; behaviour unchanged
- Vitest unit tests for net-guard (private ranges), page-inspect regexes and `pickSubpages`, the tracker detection and the policy rules

**Out**
- New capture behaviour (Steps 15–17)

## Files / packages touched
- packages/scan-engine/**, apps/legacy-scanner imports

## Reuse from current code
- All of the listed `src/lib` modules

## Acceptance
- [ ] The legacy app builds and a real scan of example.com gives the same result as before
- [ ] Unit tests pass

## Verification
- `pnpm turbo build test`
- Scan of example.com before and after, results compared

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
