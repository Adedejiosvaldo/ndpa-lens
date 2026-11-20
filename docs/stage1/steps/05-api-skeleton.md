# Step 05 — `apps/api` NestJS skeleton

**Phase:** Phase 1 — Foundations
**PRD refs:** §8 conventions, §11
**Depends on:** 03, 04
**Branch:** `stage1/05-api-skeleton`

## Goal
An API base with the cross-cutting pieces every later endpoint relies on.

## Scope
**In**
- NestJS app on Fastify or Express; typed config validated with Zod
- `GET /v1/health` (DB and Redis)
- Global RFC 9457 problem+json filter using the codes from `packages/schema`
- OpenAPI 3.1 at `/v1/docs`
- Pino JSON logs with request ID
- Drizzle and pg pool; a `withOrg(orgId)` helper that opens a transaction and runs `set_config('app.org_id', …, true)`
- Cursor pagination helper; idempotency-key interceptor stub
- Vitest + Testcontainers setup
- Dockerfile

**Out**
- Auth (Step 07)
- Business tables (Step 06)

## Files / packages touched
- apps/api/**

## Reuse from current code
- `packages/schema`

## Acceptance
- [ ] Health returns 200 with deps up and 503 with Postgres down
- [ ] An unknown route returns problem+json
- [ ] `withOrg` sets the setting, proven by a test
- [ ] OpenAPI JSON is served

## Verification
- `pnpm --filter api test`
- `curl localhost:4000/v1/health`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
