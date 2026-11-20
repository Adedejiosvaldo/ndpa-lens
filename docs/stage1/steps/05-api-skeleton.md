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
- [x] Health returns 200 with deps up and 503 with Postgres down
- [x] An unknown route returns problem+json
- [x] `withOrg` sets the setting, proven by a test
- [x] OpenAPI JSON is served

## Verification
- `pnpm --filter api test`
- `curl localhost:4000/v1/health`

## Notes
Done 2026-11-20.
- `apps/api` is NestJS **12**, which ships as native ESM, so the package is `"type": "module"` with NodeNext resolution and `.js` import suffixes. Express platform. Built by the Nest CLI with SWC (`.swcrc` keeps decorator metadata). Vitest uses `unplugin-swc` for the same reason.
- `src/config/config.ts`: Zod-validated env (NODE_ENV, PORT=4000, LOG_LEVEL, DATABASE_URL, REDIS_URL, WEB_URL) that names every bad variable. Scripts load `../../.env` with `--env-file-if-exists`.
- `src/db/db.service.ts`: pg Pool plus Drizzle. `withOrg(orgId, fn)` opens a transaction and runs `set_config('app.org_id', orgId, true)`. Because the setting is transaction-local, it can't leak to the next user of a pooled connection. `ping()` for health.
- `src/redis/redis.service.ts`: ioredis 6, lazy connect, fail-fast (no offline queue).
- `GET /v1/health`: `{status, checks: {database, redis}}`, 200 or 503, `Cache-Control: no-store`, 3 s timeout per check.
- `ProblemFilter` (global): every error becomes `application/problem+json` with `code`, `instance` and `requestId`. `ZodError` → `validation_failed` with field `errors[]`. `ProblemException(status, code, title, detail)` is for the codes in `@ndpa/schema`.
- `ZodPipe`, cursor pagination (`PageQuery` max 100, base64url cursor, `toPage` from limit+1 rows), and `@RequiresIdempotencyKey()` with a global interceptor. For now it only enforces the header; storing and replaying responses comes in Step 28.
- nestjs-pino: JSON logs with a request ID (a safe incoming `X-Request-Id` is kept, otherwise a UUID; echoed back in the response). Cookie, authorization and CSRF headers redacted. Health checks not logged. Pretty output in dev. `x-powered-by` off.
- OpenAPI **3.1.0** at `/v1/docs` (UI) and `/v1/docs/openapi.json`.
- `pnpm-workspace.yaml` `allowBuilds`: `@swc/core` true; `cpu-features`, `ssh2` and `protobufjs` false (optional add-ons pulled in by testcontainers).
- **Bug found and fixed while testing:** with Postgres stopped, the pg Pool's idle-client `error` event crashed the API (unhandled 'error'). It now logs a warning, and health reports 503 then recovers.
- Proof:
  - `pnpm test` (api): 14 passed. Testcontainers Postgres 16 and Redis 7 cover health 200 and 503, problem+json 404 with request ID echo and replacement, no x-powered-by, OpenAPI 3.1, `withOrg` being transaction-local across 10 pooled connections, rollback on error, Zod → validation_failed, the Idempotency-Key requirement, the page limit and bad cursors, and config defaults and errors.
  - Manual run against `pnpm dev:infra`: Postgres down → 503 → back up → 200; same for Redis. The API kept running throughout.
- **Deferred:** the API Dockerfile is left for Step 33, since the owner deferred VPS work.
- Open: CSRF, auth guards and rate limits come in Steps 07–09.
