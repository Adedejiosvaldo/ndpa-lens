# Stage 1 tracker

One step at a time; see `WORKFLOW.md`. Tick a step only when its acceptance checks pass. 👤 = owner task, not coded.

Status values: `todo` · `in progress (branch)` · `done YYYY-MM-DD — one-line result`.


## Phase 0 — Setup

- [x] **00** [Write the Stage 1 planning docs](steps/00-planning-docs.md) — done 2026-11-20 — planning docs written
- [x] **01** [Merge `feat/reports-ci-ux` into `main`](steps/01-merge-reports-branch.md) — done 2026-11-20 — PR #1 merged; typecheck/build green, image build on `main` fails (see Added steps); nothing deployed

## Phase 1 — Foundations

- [x] **02** [Monorepo skeleton (pnpm + Turborepo)](steps/02-monorepo-skeleton.md) — done 2026-11-20 — workspace + turbo, app moved to `apps/legacy-scanner`, CI reduced to typecheck/build
- [ ] **03** [`packages/schema` shared Zod types](steps/03-schema-package.md) — done 2026-11-20 — `@ndpa/schema` (zod 4, ESM+CJS), 10 tests
- [ ] **04** [Local dev infrastructure](steps/04-dev-infra.md) — done 2026-11-20 — `pnpm dev:infra`: Postgres 16, Redis 7 AOF, SeaweedFS S3 (MinIO images gone), Mailpit
- [ ] **05** [`apps/api` NestJS skeleton](steps/05-api-skeleton.md) — todo
- [ ] **06** [DB schema v1 and row-level security](steps/06-db-schema-rls.md) — todo
- [ ] **07** [Auth core: sign-up, verify, login, reset, sessions](steps/07-auth-core.md) — todo
- [ ] **08** [TOTP MFA and recovery codes](steps/08-mfa.md) — todo
- [ ] **09** [Organisations, members, roles and tenant harness](steps/09-orgs-roles.md) — todo
- [ ] **10** [`apps/web` shell and auth UI](steps/10-web-shell.md) — todo
- [ ] **11** [HTML mocks of the key screens](steps/11-ui-mocks.md) — todo

## Phase 2 — Clients

- [ ] **12** [Licence submission and white-label branding](steps/12-licence-branding.md) — todo
- [ ] **13** [Clients, domains and authorisation attestation](steps/13-clients-domains.md) — todo

## Phase 3 — Scan engine and checks

- [ ] **14** [Extract `packages/scan-engine`](steps/14-extract-scan-engine.md) — todo
- [ ] **15** [Evidence store, preflight and SSRF hardening](steps/15-evidence-preflight.md) — todo
- [ ] **16** [Page discovery up to 25 pages](steps/16-discovery.md) — todo
- [ ] **17** [Capture in three consent states, plus form inspection](steps/17-consent-capture.md) — todo
- [ ] **18** [`packages/vendors` and GeoIP](steps/18-vendors.md) — todo
- [ ] **19** [Labelled fixtures site](steps/19-fixtures-site.md) — todo
- [ ] **20** [Checks C-01 to C-10 with golden tests](steps/20-checks-01-10.md) — todo
- [ ] **21** [Checks C-11 to C-20 and the LLM policy classifier](steps/21-checks-11-20-llm.md) — todo
- [ ] **22** [Scan worker, scans API and SSE](steps/22-worker-scan.md) — todo
- [ ] **23** [Scan progress and findings review UI](steps/23-scan-ui.md) — todo

## Phase 4 — Evidence pack

- [ ] **24** [Pack worker: JSON, bundle, manifest and signature](steps/24-worker-pack.md) — todo
- [ ] **25** [Branded PDF pack and data-flow map](steps/25-pdf-dataflow.md) — todo
- [ ] **26** [Pack preview, download and public verify page](steps/26-pack-ui-verify.md) — todo
- [ ] **27** [Rescan and diff](steps/27-rescan-diff.md) — todo

## Phase 5 — Commerce, admin, public

- [ ] **28** [Credit ledger and scan charging](steps/28-credits.md) — todo
- [ ] **29** [Paystack checkout, webhook and invoices](steps/29-paystack-invoices.md) — todo
- [ ] **30** [Platform admin console](steps/30-admin-console.md) — todo
- [ ] **31** [Public scanner on the new engine](steps/31-public-scanner.md) — todo
- [ ] **32** [Onboarding checklist, dashboard and empty states](steps/32-onboarding-dashboard.md) — todo

## Phase 6 — Production and launch

- [ ] **33** [Production infrastructure](steps/33-prod-infra.md) — todo
- [ ] **34** [Observability and alerts](steps/34-observability.md) — todo
- [ ] **35** [Security gate](steps/35-security-gate.md) — todo
- [ ] **36** [End-to-end journey and load test](steps/36-e2e-load.md) — todo
- [ ] **37** [Legal documents and scanner identification](steps/37-legal-docs.md) 👤 — todo
- [ ] **38** [Production launch](steps/38-launch.md) — todo

## Owner tracks 👤 (not coded)

- [ ] PRD §14 open questions: legal reviewer, hosting country and R2 location, NDPC register access, ₦100k pricing check, GAID CAR template, company entity and Paystack business account
- [ ] Caddy `flush_interval -1` in azaman-engine's Caddyfile (from `docs/review-and-changes.md`)
- [ ] 300-site sweep and labelling of 50 sites (after Step 22)
- [ ] DPCO outreach: 40 contacted, 15 demos, 5 deposits by 31 Jan 2027

## P1 backlog (after launch)

- [ ] AUTH-07 Google OAuth · AUTH-08 magic link · AUTH-09 org-enforced MFA
- [ ] ORG-06 org switcher · BRAND-03 custom footer · CLI-06 CSV import
- [ ] PACK-06 share links · PACK-07 remediation report variant
- [ ] ADM-02 read-only impersonation · ADM-05 catalogue/vendor editing without deploy

## Added steps

_Out-of-scope work found during a step goes here, with a reason._

- [ ] **01a** Fix the Docker image build — found in Step 01. On `main`, the **Build and push image** job fails at `RUN corepack enable` (exit 127): the `mcr.microsoft.com/playwright:v1.64.1-noble` base image has no corepack. The likely fix is to install pnpm directly (`npm i -g pnpm@11.5.2`, matching `packageManager`). The same Dockerfile is used by `deploy/deploy.sh`, so manual VPS builds are probably broken too. Deferred by the owner on 2026-11-20 together with all VPS, image and deploy work. **Do it in Step 33.**
