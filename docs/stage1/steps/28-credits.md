# Step 28 — Credit ledger and scan charging

**Phase:** Phase 5 — Commerce, admin, public
**PRD refs:** BILL-01, ORG-03, SCAN-01, SCAN-05
**Depends on:** 27
**Branch:** `stage1/28-credits`

## Goal
Scans spend credits correctly and can never be charged twice.

## Scope
**In**
- Append-only credit_ledger; balance = SUM(delta)
- 3 free credits on verification; unverified orgs are limited to 3 packs
- 1 credit per client per audit cycle, rescans free, failed scans refunded
- Idempotency-Key required on spending POSTs
- `GET /credits` (Owner)

**Out**
- Payments (Step 29)

## Files / packages touched
- apps/api/src/billing/credits/**

## Reuse from current code
- Idempotency interceptor from Step 05

## Acceptance
- [ ] Tests: double submit charges once, a failed scan is refunded, a rescan in the same cycle is free, insufficient credits gives `insufficient_credits`

## Verification
- `pnpm --filter api test -- credits`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
