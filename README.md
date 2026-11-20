# NDPA Lens

NDPA Lens is being rebuilt as a multi-tenant SaaS for licensed DPCOs. It produces white-labelled NDPA evidence packs for their clients' websites. The plan, the tracker and one file per step are in [`docs/stage1/`](docs/stage1/tracker.md).

## Layout

```
apps/
  legacy-scanner/   the current public scanner (Next.js), unchanged; see its README
packages/           shared libraries, added step by step
infra/              local dev and production infrastructure
docs/stage1/        PRD, workflow, tracker, step files
```

## Commands

Requires Node.js 22+ and pnpm 11.

```bash
pnpm install
pnpm dev          # all apps (turbo)
pnpm typecheck
pnpm build
pnpm --filter legacy-scanner dev   # one app
```

CI (`.github/workflows/ci-cd.yml`) runs typecheck and build on every push and PR. Image build and VPS deploy are on hold until Step 33.
