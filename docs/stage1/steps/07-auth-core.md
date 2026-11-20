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
- [x] Integration tests cover every AUTH-01..04 and AUTH-06 rule, including the breached-password rejection (HIBP mocked) and the 6th failed login blocked
- [x] The session cookie carries all its flags

## Verification
- `pnpm --filter api test -- auth`

## Notes
Done 2026-11-20.
- **Design:** Better Auth 1.7.26 runs **server-side only**. Our controllers call `auth.api.*`; its HTTP handler is never mounted. So the routes follow the PRD paths and every error is problem+json. Better Auth uses the `ndpa_auth` pool (`AUTH_DATABASE_URL`).
- **Routes** (`apps/api/src/auth/`):
  - `GET /v1/auth/csrf`
  - `POST /v1/auth/signup | verify-email | verify-email/resend | login | logout | password/forgot | password/reset`
  - `GET /v1/me`, `GET /v1/me/sessions`, `DELETE /v1/me/sessions/:id`
- **AUTH-01:**
  - Zod enforces 12–128 characters, and Better Auth applies the same limits.
  - HIBP k-anonymity check (`pwned.ts`) on sign-up and reset. Only the SHA-1 prefix is sent, with `Add-Padding`. **It fails open** if HIBP is down, and logs a warning.
  - Passwords hashed with argon2id (m=19456, t=2, p=1) via `@node-rs/argon2`.
  - Sign-up always returns 202 and never sets a cookie. Existing emails get a "you already have an account" email instead, using Better Auth's enumeration protection (`autoSignIn: false` + `onExistingUserSignUp`).
- **AUTH-02:**
  - The verification link goes to `WEB_URL/verify-email?token=` and is valid for 24 h. Verifying signs the user in.
  - Sign-in is allowed before verification; scans will require it (guard in Step 22).
- **AUTH-03:**
  - `LoginLimiter` in Redis, with hashed keys: 5 failures per 15 minutes, per account and per IP. Then 429 `rate_limited` with `Retry-After`.
  - On the 5th account failure, the account owner gets one lockout email; unknown emails get none.
  - Sign-up, resend and forgot are limited to 3 an hour per email.
- **AUTH-04:**
  - The reset link is single-use, valid 30 minutes, and its identifier is stored hashed (`verification.storeIdentifier: "hashed"`).
  - A reset revokes every session.
  - Forgot always returns 202.
- **AUTH-06:**
  - Cookie `__Secure-ndpa.session_token` is HttpOnly, Secure and SameSite=Lax.
  - Sliding 12 h expiry (`expiresIn` 12 h, `updateAge` 15 min), and cookie cache off so revocation takes effect immediately.
  - `SessionGuard` enforces the **7-day absolute** lifetime and revokes the session when it's exceeded.
  - The sessions list never returns tokens. You can only revoke your own sessions.
- **CSRF:** double-submit, with an HttpOnly cookie `__Secure-ndpa.csrf` and the `X-CSRF-Token` header. Also checks Origin against WEB_URL and API_URL. Applies to every unsafe method; `/v1/webhooks/*` is exempt.
- **Other changes:**
  - CORS for WEB_URL with credentials.
  - `TRUST_PROXY` config. The client IP that Express resolves is passed to Better Auth in our own header, and a client-supplied value is dropped.
- **Audit** (`AuditService`, insert-only via `ndpa_auth`): auth.signup, auth.email_verified, auth.login, auth.login_failed (with failure count), auth.login_locked, auth.logout, auth.password_reset, auth.session_revoked, admin.seeded, admin.promoted.
- **Email:** `Mailer` interface with an SMTP implementation (nodemailer + SMTP_URL; Mailpit in dev, Resend SMTP in prod) and plain-text British English templates. Mail failures are logged and never change an auth response.
- **Platform Admin seed** (moved from Step 06): `PLATFORM_ADMIN_PASSWORD=… pnpm --filter api seed:admin -- <email> "<name>"`. Idempotent: a second run promotes an existing user instead. MFA enrolment comes in Step 08.
- **Test harness:** `test/harness.ts` adds `createTestApp`, which overrides the Mailer (in-memory outbox) and the breached-password check. A `Client` keeps Secure cookies, which supertest's jar drops over HTTP, sends CSRF and fakes client IPs. Convention recorded in `zod.pipe.ts`: type parameters as `z.infer<typeof X>`, otherwise Swagger crashes.
- **Proof:**
  - `pnpm test` (api): 51 passed (24 new auth tests).
    - CSRF: missing, wrong and foreign-Origin requests are refused; the cookie has the right flags.
    - Sign-up: under 12 characters and breached passwords rejected; same response for new and existing emails; argon2id hash format.
    - Verification sets a secure cookie; a bad token gives 400.
    - Login works; the account lockout (5 attempts from 5 IPs, then 429 with Retry-After over 800 s) sends exactly one email; the IP lockout is separate per IP; unknown accounts get no email.
    - Reset: unknown email sends nothing; the token TTL is 1795–1800 s and stored hashed; breached passwords rejected; the token is single-use; old sessions are revoked; the new password works.
    - Sessions: list without tokens, revoke another, can't revoke someone else's, 12 h idle, 7 d absolute, 12 h sliding expiry, logout.
    - Seed script, and the HIBP client with `fetch` stubbed (prefix only, count-0 padding ignored, fails open).
  - Manual run on `pnpm dev:infra`: the curl sign-up with CSRF returned 202, and the "Confirm your email" message arrived in Mailpit.
- **Open:**
  - The global limit of 300 requests a minute per session isn't built yet (added as **07a**).
  - Session tokens are still unhashed (see Step 06). Owner decision pending.
  - HIBP fails open.
