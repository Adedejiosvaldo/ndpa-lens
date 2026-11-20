# Step 06 — DB schema v1 and row-level security

**Phase:** Phase 1 — Foundations
**PRD refs:** §7, §9
**Depends on:** 05
**Branch:** `stage1/06-db-schema-rls`

## Goal
Identity and tenancy tables, with RLS enforced by Postgres and not only by the code.

## Scope
**In**
- Drizzle schema and migrations: users, sessions, recovery_codes, organisations, memberships, invitations, audit_log (uuid v7, citext, timestamptz)
- Better Auth's required tables mapped onto these, with adapter fields reconciled
- `app_user` role without BYPASSRLS; RLS policies on tenant tables keyed on `current_setting('app.org_id')`
- audit_log: INSERT and SELECT only
- Seed script for a Platform Admin

**Out**
- Clients and scans tables (later steps)

## Files / packages touched
- apps/api/src/db/**, migrations

## Reuse from current code
- `withOrg` from Step 05

## Acceptance
- [ ] Migration up and down works on a fresh DB
- [ ] A test proves org B can't see org A's rows with the app role, even with a hand-written query
- [ ] UPDATE and DELETE on audit_log are refused

## Verification
- `pnpm --filter api db:migrate && pnpm --filter api test -- rls`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
