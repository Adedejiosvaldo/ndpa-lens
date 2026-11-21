# Step 16 — Page discovery up to 25 pages

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** SCAN-02, §5.1 step 2
**Depends on:** 15
**Branch:** `stage1/16-discovery`

## Goal
Choose the pages that matter for evidence on each domain.

## Scope
**In**
- Same-site link collection, ranked by the §5.1 keywords; user-named URLs always included; cap of 25; page_type assigned

**Out**
- Capture

## Files / packages touched
- packages/scan-engine/src/discover/**

## Reuse from current code
- `pickSubpages` in `page-inspect.ts`

## Acceptance
- [x] Unit tests on fixture HTML: ranking, dedupe, cap, off-site links dropped

## Verification
- `pnpm --filter @ndpa/scan-engine test -- discover`

## Notes
Done 2026-11-21.
- `packages/scan-engine/src/discover.ts`: `discoverPages(homeHtml, homeUrl, namedUrls, max = 25)` is pure and deterministic (§5.4).
  - Order: the homepage, then the user's named pages (CLI-02, same root domain), then discovered links. **One of each valuable type first** (policy 100, cookie 95, sign-up 90, checkout 85, login 80, account 75, contact 70, careers 60), then by score. PRD keywords (quote, claim…) lift "other" pages to 40.
  - The sort is stable on ties, so document order decides.
  - Drops off-site links, files (pdf, images, office, media, assets), logout, mailto/tel/javascript and `/cdn-cgi/`. Removes duplicates by canonical URL (case, trailing slash, fragment). Keeps subdomains of the same root.
  - Reuses `inspectDomContent` for link extraction and `getRootDomain`.
- `classify(url, text)` returns the `PageType` from `@ndpa/schema`.
- Proof: 5 tests (home and named first; type ranking and keyword lift; off-site, files, logout and duplicates removed while a subdomain is kept; the 25 cap with identical output on a rerun; classification). Engine total: 29 passed and 1 expected failure.
