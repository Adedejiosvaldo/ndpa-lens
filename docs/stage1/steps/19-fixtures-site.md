# Step 19 — Labelled fixtures site

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §12
**Depends on:** 02
**Branch:** `stage1/19-fixtures-site`

## Goal
A site where the correct answer for every check is known, so accuracy can be tested.

## Scope
**In**
- `apps/fixtures`: a static site with a pass and a fail variant for each C-01..C-20 (pre-consent pixel, broken reject, pre-ticked box, HTTP form, missing policy sections, PII in the query string, session replay…)
- One `expected-findings.json` per variant
- Served locally and in CI

**Out**
- Checks code

## Files / packages touched
- apps/fixtures/**

## Reuse from current code
- —

## Acceptance
- [ ] Every check has at least one pass and one fail variant with expected output

## Verification
- `pnpm --filter fixtures dev` and browse each variant

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
