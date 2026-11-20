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
- [ ] Tests for every row of the permission matrix that exists so far
- [ ] The harness covers every org route
- [ ] Can't remove the last Owner

## Verification
- `pnpm --filter api test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
