# Step 24 — Pack worker: JSON, bundle, manifest and signature

**Phase:** Phase 4 — Evidence pack
**PRD refs:** PACK-02..05
**Depends on:** 22
**Branch:** `stage1/24-worker-pack`

## Goal
Reproducible, signed evidence packs built from stored evidence alone.

## Scope
**In**
- Table packs (immutable, versioned)
- `apps/worker-pack`: `ndpa-lens/pack@1` JSON, ZIP of screenshots, HARs and DOMs, a manifest with SHA-256 of every file, the manifest hash signed with Ed25519 (key from env)
- `POST /scans/{id}/packs`; a new version on each analyst change

**Out**
- PDF (Step 25)

## Files / packages touched
- apps/worker-pack/**, apps/api/src/packs/**

## Reuse from current code
- `packages/schema` pack@1

## Acceptance
- [ ] Rebuilding from the same evidence gives an identical JSON hash
- [ ] Tampering with any file fails verification (test)

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
