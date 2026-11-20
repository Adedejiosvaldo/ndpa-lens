# Step 09 — Organisations, members, roles and tenant harness

**Phase:** Phase 1 — Foundations
**PRD refs:** ORG-01, ORG-04, ORG-05, §2, §12
**Depends on:** 08
**Branch:** `stage1/09-orgs-roles`

## Goal
Multi-tenant org model with the permission matrix enforced, and a reusable cross-tenant test.

## Scope
**In**
- Org created at sign-up (legal name, trading name, address, phone)
- Invites by email with a role, valid 7 days; accept endpoint
- Change role, remove a member, ownership transfer that the new Owner must accept, at least one Owner at all times
- `@Roles()` guard implementing the §2 matrix; returns 404 for non-members
- `GET/PATCH /v1/orgs/{orgId}`, members and invitations endpoints, audit-log endpoint
- **Cross-tenant harness**: a helper that runs org B's user against every org A route and expects 404

**Out**
- Org switcher UI (P1)
- Licence and branding (Step 12)

## Files / packages touched
- apps/api/src/orgs/**, test/tenant-harness.ts

## Reuse from current code
- RLS from Step 06

## Acceptance
- [x] Tests for every row of the permission matrix that exists so far
- [x] The harness covers every org route
- [x] Can't remove the last Owner

## Verification
- `pnpm --filter api test`

## Notes
Done 2026-11-20.
- **Approach:** orgs are our own code, not Better Auth's organisation plugin. Every query runs as `ndpa_api` inside `withOrg()`, so tenancy is enforced twice, as PRD §9 asks: `OrgGuard` (membership and role) and Postgres RLS.
- **ORG-01:**
  - `POST /v1/auth/signup` takes an optional `organisation` {legalName, tradingName, address, phone}. A DPCO founder sends it and becomes Owner. An invited colleague signs up without one and joins by invitation; otherwise every user would be an Owner, with MFA mandatory for all.
  - The org is created only for a genuinely new account. `SignupContext` uses AsyncLocalStorage, and Better Auth's user-create hook marks the user as new, so the 202 response stays identical (no enumeration).
  - The org id is a uuid v7 generated in the app (`common/ids.ts`), so `app.org_id` can be set before the RLS-checked insert. Audit: `org.created`.
- **OrgGuard** (`orgs/org.guard.ts`): `@OrgRole(min)` follows the §2 matrix (viewer < analyst < admin < owner). A non-member or malformed id gets **404**; a member without the role gets **403** with the needed role.
- **Routes:**
  - `GET/PATCH /v1/orgs/{orgId}`
  - `GET /members`, `PATCH/DELETE /members/{userId}`
  - `GET/POST /invitations`, `DELETE /invitations/{id}`
  - `GET/POST/DELETE /ownership-transfer`, `POST /ownership-transfer/accept`
  - `GET /audit-log` (cursor pages)
  - `POST /v1/invitations/{token}/accept`
- **ORG-04:**
  - The token is `<orgId>.<secret>`; only the SHA-256 of the secret is stored (`invitations.token_hash`, migration 0003).
  - Invitations expire in 7 days, accept only the invited email, and work once.
  - A new invitation to the same email cancels the earlier one. Inviting an existing member gives 409, and Owner can't be invited.
  - Errors: expired → 410 `invitation_expired`; wrong email → 403.
- **ORG-05:**
  - Admins change roles and remove members, but only Owners touch Owners. Anyone may leave.
  - "At least one Owner" is enforced with `SELECT … FOR UPDATE` on the owner rows, giving 409 `last_owner`.
  - Owner can only be granted by transfer: a new `ownership_transfers` table (RLS, migration 0004) allows one pending transfer per org, expiring after 7 days, which the named member must accept. They become Owner and the previous Owner becomes Admin. The new Owner then must enrol MFA.
- **Audit:** org-scoped events are written with `AuditService.recordInOrg(tx, …)` in the same transaction: org.created, org.updated, member.role_changed, member.removed, member.left, invitation.created, invitation.cancelled, invitation.accepted, ownership.transfer_requested, ownership.transfer_accepted, ownership.transfer_cancelled.
- **Tenant harness** (`test/tenant-harness.ts`): reads **every `/v1/orgs/{orgId}` operation from the live OpenAPI document** and asserts that another org's Owner gets 404 `not_found` on each one. New endpoints are covered automatically, and the test fails if fewer than 13 routes are found.
- **Proof:** `pnpm test` (api) 78 passed, 18 of them new org tests.
  - Org created at sign-up with the founder as Owner; an Owner without MFA is blocked.
  - Matrix: all four roles can view; analyst and viewer get 403 on PATCH, members, invitations and audit log, while admin and owner get 200.
  - Invitations: expire in 7 days, stored hashed, wrong email 403, single use, expired 410, a re-invite replaces the old one, cancel works, members and Owner invites refused.
  - Roles: Admins can't touch Owners; demoting or removing the last Owner is refused; leaving works; non-admins can't remove others.
  - Transfer: request, a duplicate is refused, only the target can accept, roles swap, the new Owner must do MFA; cancel works.
  - Audit log pages with a cursor and contains the expected events; another org's log contains nothing from org A.
  - Tenant harness: 404 on every org route; malformed and unknown ids give 404.
  - Sign-up for an existing email creates no second org.
- **Not built:** `POST /v1/orgs` to create extra organisations (one org per founder sign-up; ORG-06 is P1). If org creation fails after the user is created, it's logged but there is no retry. Low risk, noted.
