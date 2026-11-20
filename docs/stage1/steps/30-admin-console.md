# Step 30 — Platform admin console

**Phase:** Phase 5 — Commerce, admin, public
**PRD refs:** ADM-01, ADM-03, ADM-04, BILL-05
**Depends on:** 29
**Branch:** `stage1/30-admin-console`

## Goal
Internal tools to verify licences, grant credits and look after the scan queue.

## Scope
**In**
- Platform-admin-only `/v1/admin/*` and UI: org list, licence queue with approve or reject and a note (approval grants 3 credits), credit grants and refunds with a reason, scan queue health and failed scan retry, lead overview

**Out**
- Impersonation and catalogue editing (P1)

## Files / packages touched
- apps/api/src/admin/**, apps/web/admin/**

## Reuse from current code
- —

## Acceptance
- [ ] Non-admins get 404; every admin action is in the audit log

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
