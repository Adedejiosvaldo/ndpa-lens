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
- [x] Tests: enrol, verify, a wrong code fails, a recovery code works once, an Owner without MFA is blocked

## Verification
- `pnpm --filter api test -- mfa`

## Notes
Done 2026-11-20.
- Better Auth's `twoFactor` plugin (`auth.factory.ts`):
  - Issuer "NDPA Lens"; model mapped to `two_factors`.
  - 10 recovery codes of 10 characters, stored **encrypted**.
  - Lockout: 5 wrong codes, then 15 minutes (matches AUTH-03).
  - The pending sign-in cookie lasts 10 minutes. "Trust this device" is never offered.
- Routes (`mfa.controller.ts`):
  - `POST /v1/auth/mfa/enrol` {password} returns `otpauthUri`, `manualKey` and `recoveryCodes`.
  - `/confirm` {code} turns MFA on.
  - `/verify` {code} or {recoveryCode} completes sign-in and creates the session.
  - `/disable` {password}.
  - `/recovery-codes` {password} regenerates the codes.
- Login now returns `{ mfaRequired: true }` with no session when a second factor is due. Otherwise it returns `{ mfaRequired: false, user }`.
- **Mandatory MFA:** `SessionGuard` returns 403 `mfa_enrolment_required` for Platform Admins and anyone with an `owner` membership who hasn't enrolled. Exempt routes (`@AllowWithoutMfa()`): enrol, confirm, `/v1/me*` and logout. Owners and admins can't disable MFA (403).
- Errors mapped: INVALID_CODE and INVALID_BACKUP_CODE → 401; ACCOUNT_TEMPORARILY_LOCKED → 429; INVALID_TWO_FACTOR_COOKIE → 401; INVALID_PASSWORD → 401; TOTP_ALREADY_ENABLED → 409.
- Audit: mfa.enrolled, mfa.disabled, mfa.recovery_code_used, mfa.recovery_codes_regenerated, and auth.login with `metadata.mfa` (totp or recovery_code).
- `AppModule` now re-exports `AuthModule`, so any module can use `SessionGuard`.
- Proof: `pnpm test` (api) 60 passed, 9 of them new MFA tests with RFC 6238 codes computed in `test/totp.ts`.
  - Enrol: a wrong password is refused; QR URI, manual key and 10 codes are returned; MFA stays off until confirmed; a wrong confirm code is refused; the secret and codes are not stored in plain text.
  - Sign-in: mfaRequired comes back with no session; a wrong code is refused; the right code works; verifying without the pending cookie gives 401.
  - A recovery code works once; the 6th attempt after 5 wrong codes gets 429 even with the right code.
  - An Owner is blocked except on exempt routes, can enrol, and then can't disable. A Platform Admin is blocked until enrolled. Other users can skip or disable MFA. Regenerating recovery codes invalidates the old ones.
- **Deviations:**
  - TOTP secrets and recovery codes are encrypted by Better Auth's symmetric encryption, keyed by `BETTER_AUTH_SECRET`. PRD §9 asks for AES-256-GCM with a key held in the SOPS env; it is still encrypted at the app layer, but rotating `BETTER_AUTH_SECRET` would invalidate enrolled authenticators.
  - Recovery codes are stored encrypted rather than hashed (see Step 06).
- P1 left: AUTH-09 (an org setting to require MFA for all members).
