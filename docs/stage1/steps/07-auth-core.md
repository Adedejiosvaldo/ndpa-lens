# Step 07 — Auth core: sign-up, verify, login, reset, sessions

**Phase:** Phase 1 — Foundations
**PRD refs:** AUTH-01..04, AUTH-06
**Depends on:** 06
**Branch:** `stage1/07-auth-core`

## Goal
Secure email and password accounts using Better Auth rather than hand-rolled auth.

## Scope
**In**
- Better Auth mounted in NestJS under `/v1/auth/*`, argon2id hashing
- Minimum 12 characters plus HIBP k-anonymity check
- Email verification (Resend in prod, Mailpit in dev); scans blocked until verified (guard ready for later)
- Login rate limit: 5 failures per 15 minutes per account and per IP, plus a lockout email
- Single-use reset token valid 30 minutes
- Cookie: httpOnly, Secure, SameSite=Lax; 12 h idle, 7 d absolute
- CSRF (`X-CSRF-Token`)
- `GET/DELETE /v1/me/sessions`, `GET /v1/me`
- Audit log entries for login, logout and reset

**Out**
- MFA (Step 08)
- Orgs (Step 09)
- Google OAuth and magic link (P1)

## Files / packages touched
- apps/api/src/auth/**, email templates

## Reuse from current code
- Better Auth

## Acceptance
- [ ] Integration tests cover every AUTH-01..04 and AUTH-06 rule, including the breached-password rejection (HIBP mocked) and the 6th failed login blocked
- [ ] The session cookie carries all its flags

## Verification
- `pnpm --filter api test -- auth`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
