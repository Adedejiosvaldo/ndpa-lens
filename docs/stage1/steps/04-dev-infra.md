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
- [ ] `pnpm dev:infra` starts all four healthy
- [ ] Can connect with psql, redis-cli, `mc ls` and the Mailpit UI

## Verification
- `docker compose -f infra/dev/docker-compose.yml up -d && docker compose ps`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
