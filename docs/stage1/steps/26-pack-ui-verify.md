# Step 26 — Pack preview, download and public verify page

**Phase:** Phase 4 — Evidence pack
**PRD refs:** PACK-01..04, §3.1
**Depends on:** 25
**Branch:** `stage1/26-pack-ui-verify`

## Goal
Hand-off UI and a public way to check that a pack is genuine.

## Scope
**In**
- Pack preview in the browser with a version selector; download PDF, JSON or ZIP via pre-signed URLs; audit log on download
- `POST /v1/verify` and a public verify page (upload a manifest or pack → signature valid or invalid, and the scan date)

**Out**
- Share links (P1)

## Files / packages touched
- apps/web pack pages and verify page, apps/api verify

## Reuse from current code
- —

## Acceptance
- [ ] Playwright: generate → download → verify valid; a tampered file shows invalid

## Verification
- `pnpm --filter web test:e2e`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
