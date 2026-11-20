# infra

- `dev/`: local Postgres, Redis, SeaweedFS (S3 / R2 stand-in) and Mailpit (Step 04), started with `pnpm dev:infra`
- Production compose, Terraform for Cloudflare and VPS bootstrap (Step 33, deferred)

The current VPS deploy for the legacy scanner is in `apps/legacy-scanner/deploy/`. It's on hold until Step 33 (see step 01a in the tracker).
