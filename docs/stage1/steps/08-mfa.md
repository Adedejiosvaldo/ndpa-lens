# Step 08 — TOTP MFA and recovery codes

**Phase:** Phase 1 — Foundations
**PRD refs:** AUTH-05
**Depends on:** 07
**Branch:** `stage1/08-mfa`

## Goal
Second factor, mandatory for Owners and Platform Admins.

## Scope
**In**
- Enrol (QR plus manual code), confirm, disable; secrets encrypted with AES-256-GCM
- 10 hashed, single-use recovery codes
- Login returns `mfa_required` and is finished by `/v1/auth/mfa/verify`
- A guard blocks Owners and Platform Admins without MFA from anything but enrolling
- Audit log entries

**Out**
- Org-wide MFA enforcement (AUTH-09, P1)

## Files / packages touched
- apps/api/src/auth/mfa/**

## Reuse from current code
- Better Auth two-factor plugin

## Acceptance
- [ ] Tests: enrol, verify, a wrong code fails, a recovery code works once, an Owner without MFA is blocked

## Verification
- `pnpm --filter api test -- mfa`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
