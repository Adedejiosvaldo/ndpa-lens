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
- [ ] Package builds, tests pass
- [ ] The legacy app is untouched

## Verification
- `pnpm --filter @ndpa/schema test build`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
