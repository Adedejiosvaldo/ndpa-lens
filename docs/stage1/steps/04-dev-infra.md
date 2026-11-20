# Step 04 — Local dev infrastructure

**Phase:** Phase 1 — Foundations
**PRD refs:** §10
**Depends on:** 02
**Branch:** `stage1/04-dev-infra`

## Goal
A single command that brings up everything the new apps need locally.

## Scope
**In**
- `infra/dev/docker-compose.yml`: Postgres 16, Redis 7 (AOF), MinIO with a private bucket created on start, Mailpit
- Root `.env.example` covering all new services
- `pnpm dev:infra` script
- README section

**Out**
- Production infra (Step 33)
- Terraform

## Files / packages touched
- infra/dev/**, .env.example, package.json

## Reuse from current code
- —

## Acceptance
- [x] `pnpm dev:infra` starts all four healthy
- [x] Can connect with psql, redis-cli, `aws s3 ls` (instead of `mc`) and the Mailpit UI

## Verification
- `docker compose -f infra/dev/docker-compose.yml up -d && docker compose ps`

## Notes
Done 2026-11-20.
- `infra/dev/docker-compose.yml` (project `ndpa-dev`), with every port bound to 127.0.0.1:
  - `postgres:16-alpine`
  - `redis:7-alpine` with `--appendonly yes`
  - `chrislusf/seaweedfs:4.54` running its S3 gateway on :8333, with credentials from `infra/dev/s3.json`
  - `amazon/aws-cli:2.27.0` as a one-shot `s3-init` (profile `setup`) that creates the private `ndpa-evidence` bucket
  - `axllent/mailpit:v1.27`
- **Change from the plan:** MinIO's images (Docker Hub and quay.io) can no longer be pulled, so SeaweedFS stands in for R2. The code will only use the S3 API, so nothing changes for production. WORKFLOW and later steps updated.
- `infra/dev/up.sh`, run by `pnpm dev:infra`: `up --wait` for the four services, then the bucket setup, because `--wait` counts an exited one-shot container as a failure. Also added `dev:infra:down` and `dev:infra:reset` (which wipes volumes).
- Root `.env.example` with DATABASE_URL, REDIS_URL, S3_*, SMTP_URL, EMAIL_FROM, WEB_URL and API_URL. README section added.
- Proof:
  - Started from a wiped state: all four services healthy and the script exits 0.
  - Running it a second time is safe.
  - `psql select version()` → PostgreSQL 16.16; `redis-cli ping` → PONG with appendonly yes.
  - `aws s3 ls` lists `ndpa-evidence`; an anonymous GET on the bucket gets 403.
  - An SMTP test message showed up in the Mailpit API.
- Not in CI: these are dev services only. CI integration tests will use Testcontainers (Step 05 onwards).
