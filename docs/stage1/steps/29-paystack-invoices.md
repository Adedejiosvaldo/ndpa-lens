# Step 29 — Paystack checkout, webhook and invoices

**Phase:** Phase 5 — Commerce, admin, public
**PRD refs:** BILL-02..04
**Depends on:** 28
**Branch:** `stage1/29-paystack-invoices`

## Goal
DPCOs can buy credit bundles and get proper invoices.

## Scope
**In**
- `POST /checkout` (Owner) → Paystack initialise; bundles from config (placeholder prices from §4.10)
- Webhook verified with HMAC-SHA512, idempotent on reference; tables payments and invoices
- Invoice PDF including 7.5% VAT, sequential numbers
- Billing UI with bundle cards and invoice list

**Out**
- Live keys (👤 owner, after company registration)

## Files / packages touched
- apps/api/src/billing/**, apps/web billing

## Reuse from current code
- `packages/pdf`

## Acceptance
- [ ] Paystack test mode end to end; replaying the webhook adds no credits a second time; a bad signature gives 401

## Verification
- `pnpm turbo test`; Paystack test checkout

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
