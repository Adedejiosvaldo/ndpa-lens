# Step 22 — Scan worker, scans API and SSE

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** SCAN-01, SCAN-04..07, §8
**Depends on:** 13, 21
**Branch:** `stage1/22-worker-scan`

## Goal
Run real scans from a queue and report progress live.

## Scope
**In**
- Tables scans, scan_pages, requests (partitioned by month), cookies, findings with RLS
- `apps/worker-scan`: BullMQ consumer running preflight → discover → capture → checks; scoped service token; progress events
- API: start (validates attestation, email verified, archived), get, cancel, findings list with filters, SSE `/events` with a polling fallback
- Limit of 2 running scans per org plus a global queue; plain-English failure reasons
- Egress IP and country recorded

**Out**
- Credits (Step 28)
- Network isolation in prod (Step 33)

## Files / packages touched
- apps/worker-scan/**, apps/api/src/scans/**

## Reuse from current code
- `packages/scan-engine`, `packages/checks`, `packages/vendors`

## Acceptance
- [ ] End to end on the fixtures site: start → SSE events → succeeded with expected findings
- [ ] A third concurrent scan for an org waits in the queue
- [ ] A DNS failure gives a readable reason
- [ ] Tenant harness extended

## Verification
- `pnpm turbo test`; manual scan via the API against fixtures

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
