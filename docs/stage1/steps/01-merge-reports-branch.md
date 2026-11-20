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
- [x] PR merged, `main` CI green
- [x] Nothing deployed unless the owner chose to

## Verification
- `gh pr checks <n>`
- `gh run list --branch main`

## Notes
Done 2026-11-20.
- Opened PR #1 (https://github.com/Adedejiosvaldo/ndpa-lens/pull/1) and merged it into `main` as a merge commit, so the branch history is kept.
- Proof: the first run of the workflow on GitHub (run 44788160005) passed **Typecheck and build** in 1m10s. **Build and push image** and **Deploy to VPS** were skipped, as expected on a PR.
- The repo has no Actions variables or secrets (`gh variable list` and `gh secret list` are empty). Pushes to `main` will build and push the GHCR image, but deploy stays skipped until `VPS_HOST` is set.
- Not verified: the deploy job and live progress through Caddy (both owner tasks on the tracker).
