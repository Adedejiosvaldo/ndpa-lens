# Step 19 — Labelled fixtures site

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §12
**Depends on:** 02
**Branch:** `stage1/19-fixtures-site`

## Goal
A site where the correct answer for every check is known, so accuracy can be tested.

## Scope
**In**
- `apps/fixtures`: a static site with a pass and a fail variant for each C-01..C-20 (pre-consent pixel, broken reject, pre-ticked box, HTTP form, missing policy sections, PII in the query string, session replay…)
- One `expected-findings.json` per variant
- Served locally and in CI

**Out**
- Checks code

## Files / packages touched
- apps/fixtures/**

## Reuse from current code
- —

## Acceptance
- [x] Every check has at least one pass and one fail variant with expected output

## Verification
- `pnpm --filter fixtures dev` and browse each variant

## Notes
Done 2026-11-21.
- **`apps/fixtures`** (plain Node ESM, no build step):
  - `startFixtures()` serves every variant at `https://<variant>.fixtures.test:<port>`, with a per-run CA and a leaf certificate covering `*.fixtures.test` plus the tracker hosts. **SNI hands `c19-fail` an expired certificate.**
  - Plain HTTP redirects to HTTPS. Form POSTs get 405 (nothing is ever accepted).
  - Real vendor hostnames (`connect.facebook.net`, `www.facebook.com`, `www.googletagmanager.com`, `www.google-analytics.com`, `static.hotjar.com`) are served by the same server. `hostResolverRules` gives the Chromium flag that maps them, so vendor classification runs on real names.
  - The CA certificate is returned so preflight can trust it.
- **`variants.mjs`:**
  - The **baseline is fully compliant**: equal reject and accept buttons, trackers only after accept, a complete NDPA policy (controller, DPO, purposes and lawful basis, recipients, retention, transfers, rights with a request channel, NDPC complaint), safe forms, HSTS and all four security headers, valid TLS, no pixel on checkout.
  - **20 fail variants each change one behaviour**, labelled with the check they must fail (`expect`). The pages are home, policy, sign-up, login, checkout and contact.
  - `pnpm --filter fixtures dev` prints every variant URL and the Chromium flags for browsing.
- **Proof:** `pnpm --filter fixtures test` (node:test), 3 passed.
  - Every one of C-01..C-20 has a pass and a fail variant, and the ids are unique.
  - The variants differ exactly as labelled: policy link, pre-ticked box, http form action, HSTS, X-Frame-Options, DPO, transfer clause, rights channel, and the expired certificate rejected.
  - POST is refused.
- **For Step 20:** browser capture of the fixtures must accept the test CA (Chromium can't easily trust a custom CA, so test launches use `--ignore-certificate-errors`, while C-19 is judged from preflight TLS). Capture should also not abort on certificate errors when preflight has already recorded them: an expired certificate is a finding (C-19), not a reason to stop.
