# Step 33 — Production infrastructure

**Phase:** Phase 6 — Production and launch
**PRD refs:** §10, §9
**Depends on:** 32
**Branch:** `stage1/33-prod-infra`

## Goal
Run the whole system safely on the VPS, with evidence and backups off the box.

## Scope
**In**
- Prod compose: web, api, worker-scan, worker-pack, postgres, redis and caddy, with memory and CPU limits from §10
- Scan worker on its own network: non-root, read-only root filesystem, tmpfs; DOCKER-USER egress rules
- R2 bucket; WAL-G PITR plus nightly pg_dump to R2
- SOPS + age secrets
- Terraform for Cloudflare (DNS, R2, WAF); bootstrap script
- CI: build all images to GHCR; deploy with health check and automatic rollback

**Out**
- —

## Files / packages touched
- infra/**, deploy/**, .github/workflows/**

## Reuse from current code
- Current `deploy/deploy.sh` and `ci-cd.yml`

## Acceptance
- [ ] Staging deploy works; a rollback drill passes; a restore drill from R2 passes; the worker can't reach Postgres, Redis or 169.254.169.254

## Verification
- Documented drills in Notes

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
