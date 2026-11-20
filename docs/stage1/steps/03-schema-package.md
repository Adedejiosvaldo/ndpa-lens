# Step 03 — `packages/schema` shared Zod types

**Phase:** Phase 1 — Foundations
**PRD refs:** §5.4, §7, §8
**Depends on:** 02
**Branch:** `stage1/03-schema-package`

## Goal
One shared source of types for jobs, findings, packs and errors, used by the API, web and workers.

## Scope
**In**
- Zod schemas: scan job contract and progress event (§8), finding (FIND-01), consent state, severity, `ndpa-lens/pack@1` skeleton, problem+json error and stable error codes
- Inferred TS types exported
- Vitest unit tests for parse and reject cases

**Out**
- DB schema (Step 06)
- Full pack content (Step 24 fills it in)

## Files / packages touched
- packages/schema/**

## Reuse from current code
- Types in `src/types/audit.ts` where they still fit (Severity, PageKind)

## Acceptance
- [x] Package builds, tests pass
- [x] The legacy app is untouched

## Verification
- `pnpm --filter @ndpa/schema test build`

## Notes
Done 2026-11-20.
- `packages/schema` (`@ndpa/schema`): zod 4, built with tsup to ESM and CJS with type declarations, so it works from both the NestJS API and the ESM apps.
  - `common.ts`: uuid v7 `Id`, `Timestamp`, `Sha256`, `Kobo`, `Role`, `ConsentState`, `Severity` with plain labels, `PageType`, `NdpcTier`, `Hostname`, `HttpUrl`.
  - `errors.ts`: the stable `ErrorCode` enum (21 codes) and the RFC 9457 `Problem` with `code`, `errors[]` and `requestId`.
  - `scan.ts`: `ScanStatus`, `ScanTrigger`, `ScanPhase`, the `ScanJob` contract (defaults: three states, max 25 pages), `ScanProgressEvent`, and `ScanFailureReason` with plain-English messages (SCAN-05).
  - `finding.ts`: `CheckId`, `FindingStatus`, `AnalystStatus`, `NdpaArea`, `EvidenceRef` (content-addressed), `Provenance` (§5.4, including the optional `assisted` LLM block), `Finding` (FIND-01), and `AnalystReview`, where a false positive needs a note (FIND-02).
  - `pack.ts`: a `PackV1` skeleton (`ndpa-lens/pack@1`), `DataFlow` (FLOW-01), `DiffResult`, `PackManifest`.
- Root: `allowBuilds: esbuild: true` in `pnpm-workspace.yaml` (needed by tsup and vitest), and `dist/` in `.gitignore`.
- WORKFLOW updated: merge on green CI and continue without asking (owner decision).
- Proof: `pnpm typecheck`, `pnpm test` (10 passed) and `pnpm build` all pass through turbo. `require('./dist/index.cjs')` and an ESM `import` both load.
- Open: `PackV1` is a skeleton; Step 24 completes it.
