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
- CI reduced to turbo typecheck and build (owner decision 2026-11-20: VPS, image and deploy work deferred to Step 33)
- Empty `packages/` and `infra/` folders with READMEs

**Out**
- Dockerfile, deploy scripts and CI image/deploy jobs (moved to Step 33)
- New apps or packages (later steps)
- Changing scanner behaviour

## Files / packages touched
- package.json, pnpm-workspace.yaml, turbo.json, Dockerfile, deploy/*, .github/workflows/ci-cd.yml, apps/legacy-scanner/**

## Reuse from current code
- Whole current app, moved not rewritten

## Acceptance
- [x] `pnpm typecheck` and `pnpm build` (turbo) pass
- [x] ~~`docker build`~~ deferred to Step 33; instead, `next start` on the built legacy app serves `/`
- [x] Git history kept (`git log --follow` works on a moved file)

## Verification
- `pnpm install && pnpm turbo typecheck build`
- `docker build -f apps/legacy-scanner/Dockerfile .` (or the root Dockerfile), run it, `curl localhost:3000`

## Notes
Done 2026-11-20.
- Root: `package.json` (with `packageManager` pnpm@11.5.2 and turbo scripts), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `turbo.json` (build, typecheck, test, dev), `tsconfig.base.json` for new packages, and `.turbo/` added to `.gitignore`.
- Moved the whole app with `git mv` to `apps/legacy-scanner`, including its `Dockerfile`, `.dockerignore`, `deploy/`, `.env.example` and README. The only change is the package name, now `legacy-scanner`.
- New short root README. Placeholder READMEs in `packages/` and `infra/`.
- CI: the workflow keeps just the typecheck and build job (now run through turbo); the image and deploy jobs are removed and recorded for Step 33.
- Proof: `pnpm install` OK. `pnpm typecheck` and `pnpm build` pass, and `pnpm build --force` shows no warnings. `next start` gave `/` → 200 and `/api/report/nope` → 404 with the expected message. `git log --follow` traces moved files back through their history.
- Not verified / known broken: the Dockerfile, `deploy/` and the `next.config.ts` `outputFileTracingRoot` still assume the app sits at the repo root, so the image build and VPS deploy won't work as they are. Tracked as 01a and Step 33.
- Runtime data (`data/`) is still read from the app's working directory, so `pnpm --filter legacy-scanner start` uses `apps/legacy-scanner/data/`.
