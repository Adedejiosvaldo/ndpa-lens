# Step 01 — Merge `feat/reports-ci-ux` into `main`

**Phase:** Phase 0 — Setup
**PRD refs:** —
**Depends on:** 00
**Branch:** `stage1/01-merge-reports-branch`

## Goal
Land the shareable reports, live progress and CI/CD work, so Stage 1 starts from a clean `main` and the public scanner stays live.

## Scope
**In**
- Push the branch and open a PR to `main`
- CI `check` job (typecheck and build) must pass
- Confirm the `deploy` job is skipped while `VPS_HOST` is unset, or that the owner has set the repo vars and secrets
- Merge once the owner approves

**Out**
- Any new feature work
- Caddy change in azaman-engine (owner task)

## Files / packages touched
- .github/workflows/ci-cd.yml (only if CI fails)

## Reuse from current code
- Existing branch as is

## Acceptance
- [ ] PR merged, `main` CI green
- [ ] Nothing deployed unless the owner chose to

## Verification
- `gh pr checks <n>`
- `gh run list --branch main`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
