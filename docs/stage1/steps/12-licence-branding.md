# Step 12 — Licence submission and white-label branding

**Phase:** Phase 2 — Clients
**PRD refs:** ORG-02, BRAND-01
**Depends on:** 09, 10, 04
**Branch:** `stage1/12-licence-branding`

## Goal
A DPCO can submit their licence and set up the branding their packs will carry.

## Scope
**In**
- `POST /v1/orgs/{orgId}/licence` (Owner) sets status to pending
- `PUT /branding`: logo PNG or SVG up to 1 MB (SVG sanitised), firm name, primary colour, contact block, licence number
- S3 client in a shared package (MinIO in dev); pre-signed 5-minute URLs
- Settings UI with a live pack-cover preview
- Audit log entries

**Out**
- Admin approval (Step 30)
- Pack rendering (Step 25)

## Files / packages touched
- apps/api/src/orgs/branding/**, packages/storage, apps/web settings

## Reuse from current code
- —

## Acceptance
- [ ] An oversized or malicious SVG is rejected or sanitised
- [ ] Only Owners can submit a licence; Owners and Admins can edit branding
- [ ] Tenant harness extended

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
