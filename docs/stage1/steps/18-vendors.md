# Step 18 — `packages/vendors` and GeoIP

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** FLOW-01, FLOW-02, §5.3
**Depends on:** 03
**Branch:** `stage1/18-vendors`

## Goal
Classify third-party hosts and locate them for the data-flow map.

## Scope
**In**
- Versioned vendor list (name, hostnames, category, HQ country), seeded from DuckDuckGo Tracker Radar or Disconnect plus Nigerian vendors (Paystack, Flutterwave, Termii…)
- Unknown hosts flagged for review
- DB-IP Lite country and ASN lookup (owner decision 2026-11-21: no key; CC-BY attribution in packs)
- Script to rebuild the list

**Out**
- Admin editing (P1)

## Files / packages touched
- packages/vendors/**

## Reuse from current code
- `TRACKER_SIGNATURES` in `trackers.ts`

## Acceptance
- [ ] Tests: known hosts map correctly, unknown hosts are flagged, the version string is stable

## Verification
- `pnpm --filter @ndpa/vendors test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
