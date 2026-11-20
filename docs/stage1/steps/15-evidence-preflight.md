# Step 15 — Evidence store, preflight and SSRF hardening

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5.1 step 1, §9 worker isolation, SCAN-06
**Depends on:** 14, 12
**Branch:** `stage1/15-evidence-preflight`

## Goal
Every scan artefact stored by content hash, and the target checked safely before any browsing.

## Scope
**In**
- Evidence writer: uploads to S3 under the §7 key layout and records SHA-256 for each file
- Preflight: DNS, robots, reachability, TLS certificate and version, response headers, egress IP and country
- SSRF: DNS rechecked at connect time (to stop rebinding), at most 5 redirects, caps on page and total bytes
- Scanner identification header with a contact URL

**Out**
- Browser capture states (Step 17)

## Files / packages touched
- packages/scan-engine/src/{evidence,preflight}/**

## Reuse from current code
- `net-guard.ts` `checkHost` and `safeFetch`

## Acceptance
- [ ] Tests: a rebinding host is refused, private IPs are refused, a redirect loop stops at 5, hashes match the stored bytes

## Verification
- `pnpm --filter @ndpa/scan-engine test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
