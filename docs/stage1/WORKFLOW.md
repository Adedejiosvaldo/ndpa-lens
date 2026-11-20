# Stage 1 working rules

The Stage 1 build (see `PRD.md`) is split into numbered steps in `steps/`. Progress lives in `tracker.md`. **One step at a time.**

## Starting a step
1. Read `tracker.md` and take the **first unticked step** whose dependencies are ticked. Skip 👤 owner steps; they are not coded.
2. Read that step's file in `steps/` and the PRD sections it cites.
3. Create branch `stage1/NN-slug` from `main`. Step 00 and Step 01 are the exceptions; their files say where they run.
4. In `tracker.md`, set the step's status to `in progress` with the branch name.

## While working
- Stay inside the step's **Scope**. If something out of scope turns up, add it to `tracker.md` under **Added steps** with a short reason. Don't build it.
- Reuse the code the step file points to before writing new code.
- If a decision needs the owner (money, legal, security, anything hard to reverse), stop and ask.

## Finishing a step
1. Run every command under **Verification** and confirm every **Acceptance** item.
2. Fill the step file's **Notes**: what changed, the proof (commands and results), what wasn't verified, open risks.
3. Tick the step in `tracker.md` with the date and a one-line result.
4. Commit on the step branch, open a PR, and merge it once CI is green.
5. Go straight on to the next step. The owner decided on 20 Nov 2026 not to be asked "go" between steps. Stop only for owner decisions (money, legal, security trade-offs, missing credentials, anything hard to undo) or 👤 steps. VPS, image and deploy work waits until Step 33.

## Conventions
- Decisions already made: pnpm + Turborepo monorepo in this repo; NestJS API; Drizzle ORM (RLS via `set_config('app.org_id')` per request transaction); Better Auth with organisation and two-factor plugins; Zod in `packages/schema`; BullMQ; Playwright; R2 in production and MinIO in dev.
- Requirement IDs (AUTH-01, C-07…) go in commit messages and test names so they can be traced back to the PRD.
- Copy is British English. Show money in ₦ (stored in kobo), dates like 20 Nov 2026, and times in WAT (Africa/Lagos).
