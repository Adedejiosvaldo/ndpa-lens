# Step 21 — Checks C-11 to C-20 and the LLM policy classifier

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5.2, §5.4, §5.1 step 8
**Depends on:** 20
**Branch:** `stage1/21-checks-11-20-llm`

## Goal
Complete the catalogue, with the assisted policy classification reproducible and labelled.

## Scope
**In**
- C-11..C-20
- LLM classifier for policy disclosures: stores model, prompt version and raw output; low confidence becomes needs-review; marked 'assisted'
- Golden tests extended

**Out**
- —

## Files / packages touched
- packages/checks/**

## Reuse from current code
- `analyzePrivacyPolicy` and the AI quota approach in `policy-analyzer.ts`

## Acceptance
- [ ] All fixture variants match
- [ ] LLM output is replayed from the stored raw output in golden tests (no network)

## Verification
- `pnpm --filter @ndpa/checks test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
