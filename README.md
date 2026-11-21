# NDPA Lens

NDPA Lens is being rebuilt as a multi-tenant SaaS for licensed DPCOs. It produces white-labelled NDPA evidence packs for their clients' websites. The plan, the tracker and one file per step are in [`docs/stage1/`](docs/stage1/tracker.md).

## Layout

```
apps/
  api/              NestJS API (auth, organisations); `pnpm --filter api dev`
  web/              Next.js app for DPCOs; `pnpm --filter web dev`
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
pnpm test          # unit + integration (Docker needed for API tests)
pnpm test:e2e      # browser journey; needs Docker and a prior `pnpm build`
pnpm --filter legacy-scanner dev   # one app
```

## Local services

Docker is required. `pnpm dev:infra` starts Postgres 16, Redis 7, an S3-compatible store (SeaweedFS, which stands in for Cloudflare R2) and Mailpit, all bound to localhost. Copy `.env.example` to `.env` to use them. `pnpm dev:infra:down` stops them, and `pnpm dev:infra:reset` also wipes their data. Ports and credentials are listed in `infra/dev/docker-compose.yml`.

CI (`.github/workflows/ci-cd.yml`) runs typecheck and build on every push and PR. Image build and VPS deploy are on hold until Step 33.
