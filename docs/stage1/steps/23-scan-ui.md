# Step 23 — Scan progress and findings review UI

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** FIND-01..03, §3.1
**Depends on:** 22, 11
**Branch:** `stage1/23-scan-ui`

## Goal
The screen DPCOs spend most of their time in.

## Scope
**In**
- Client detail: scan timeline and a Run scan button
- Live progress screen (safe to leave; shows steps and pages found)
- Findings review: filters, finding cards with plain-language titles, evidence drawer (screenshot thumbnail, request or cookie, URL, consent state, time), summary bar, Generate pack button disabled until the scan is done
- Mark false positive (note required) and add a client note; originals kept; audit log
- J/K/E shortcuts

**Out**
- Pack (Steps 24–26)

## Files / packages touched
- apps/web/(app)/clients/**, scans/**; apps/api findings PATCH

## Reuse from current code
- Layout from the Step 11 mocks and their feedback

## Acceptance
- [ ] Playwright: run a scan on fixtures, review, mark a false positive, the note shows in the audit log
- [ ] axe has no serious violations

## Verification
- `pnpm --filter web test:e2e`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
