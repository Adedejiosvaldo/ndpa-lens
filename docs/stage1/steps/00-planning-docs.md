# Step 00 — Write the Stage 1 planning docs

**Phase:** Phase 0 — Setup
**PRD refs:** All
**Depends on:** —
**Branch:** `stage1/00-planning-docs`

## Goal
Save the PRD, the working rules, the tracker and one file per step, so the build can go one step at a time.

## Scope
**In**
- `docs/stage1/PRD.md` (verbatim PRD)
- `WORKFLOW.md`, `tracker.md`, `steps/00..38`
- Commit on `feat/reports-ci-ux` (it is merged in Step 01)

**Out**
- Any code change

## Files / packages touched
- `docs/stage1/**`

## Reuse from current code
- —

## Acceptance
- [x] Every step file follows the template
- [x] `tracker.md` lists 00–38 with 00 ticked

## Verification
- `ls docs/stage1/steps | wc -l` → 39

## Notes
Done 2026-11-20.
- Added `docs/stage1/PRD.md` (the PRD saved verbatim, with its tables restored as Markdown), `WORKFLOW.md`, `tracker.md` and 39 step files (00–38) generated from a single template.
- Proof: `ls docs/stage1/steps | wc -l` → 39; tracker has 00 ticked and 01–38 marked todo.
- Decisions recorded: merge `feat/reports-ci-ux` first; restructure this repo into a monorepo; NestJS API; Drizzle ORM; Better Auth.
- Open: Step 11 needs the owner to show the mocks to 2 DPCOs. Step 37 is owner-only.
