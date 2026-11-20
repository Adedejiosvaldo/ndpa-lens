# Step 02 — Monorepo skeleton (pnpm + Turborepo)

**Phase:** Phase 1 — Foundations
**PRD refs:** §6
**Depends on:** 01
**Branch:** `stage1/02-monorepo-skeleton`

## Goal
Turn the repo into a pnpm workspace with Turborepo, without changing what the live app does.

## Scope
**In**
- `pnpm-workspace.yaml`, `turbo.json`, root `package.json` scripts (build, typecheck, test, lint)
- Move the current app unchanged to `apps/legacy-scanner` with `git mv`
- Shared `tsconfig.base.json`
- Update the Dockerfile, `deploy/docker-compose.yml`, `deploy/deploy.sh` and CI paths so the legacy app still builds, ships and deploys
- Empty `packages/` and `infra/` folders with READMEs

**Out**
- New apps or packages (later steps)
- Changing scanner behaviour

## Files / packages touched
- package.json, pnpm-workspace.yaml, turbo.json, Dockerfile, deploy/*, .github/workflows/ci-cd.yml, apps/legacy-scanner/**

## Reuse from current code
- Whole current app, moved not rewritten

## Acceptance
- [ ] `pnpm turbo build typecheck` passes
- [ ] `docker build` of legacy-scanner succeeds and the container serves `/`
- [ ] Git history kept (`git log --follow` works on a moved file)

## Verification
- `pnpm install && pnpm turbo typecheck build`
- `docker build -f apps/legacy-scanner/Dockerfile .` (or the root Dockerfile), run it, `curl localhost:3000`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
