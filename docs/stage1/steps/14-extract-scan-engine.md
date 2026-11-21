# Step 14 — Extract `packages/scan-engine`

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5
**Depends on:** 02
**Branch:** `stage1/14-extract-scan-engine`

## Goal
Move the existing scanner logic into a package that the new workers and the legacy app share.

## Scope
**In**
- Move net-guard, trackers, page-inspect, policy-analyzer, browser-capture, url-check and site-icon into `packages/scan-engine`
- `apps/legacy-scanner` imports from the package; behaviour unchanged
- Vitest unit tests for net-guard (private ranges), page-inspect regexes and `pickSubpages`, the tracker detection and the policy rules

**Out**
- New capture behaviour (Steps 15–17)

## Files / packages touched
- packages/scan-engine/**, apps/legacy-scanner imports

## Reuse from current code
- All of the listed `src/lib` modules

## Acceptance
- [x] The legacy app builds and a real scan of example.com gives the same result as before
- [x] Unit tests pass

## Verification
- `pnpm turbo build test`
- Scan of example.com before and after, results compared

## Notes
Done 2026-11-21.
- **`packages/scan-engine` (`@ndpa/scan-engine`):** `git mv` of net-guard, trackers, page-inspect, policy-analyzer, browser-capture, url-check and site-icon, plus the legacy `types/audit.ts` (now `types.ts`). History is kept; `@/` imports became relative. Built with tsup to ESM and CJS with Playwright external.
- **Subpath exports:**
  - `.` is the Node engine (DNS, Playwright).
  - `./url-check` and `./types` are browser-safe, so the legacy landing page doesn't pull Node code into the client bundle.
- **Legacy app:** imports from the package. `scanner.ts` (the legacy orchestrator) stays in the app.
- **Bug found and fixed:**
  - Next.js treats a symlinked workspace package as app code and **bundled the engine and Playwright into the server build**, so `chromium` failed with `Cannot find module …/.next/server/package.json` and the scanner silently fell back to the static engine (score 38 F instead of 46 D).
  - Fix in `apps/legacy-scanner/next.config.ts`: a server-side webpack external `{"@ndpa/scan-engine": "commonjs @ndpa/scan-engine"}`, plus `serverExternalPackages: ["playwright","playwright-core"]`.
  - The later apps (worker-scan) run the engine in plain Node, where the problem doesn't occur.
- **Proof:**
  - The legacy app was built from `main` (in a git worktree) and from this branch, and `POST /api/scan {"url":"https://example.com"}` was run against both. Result: **score 46, grade D, engine browser in both**. After dropping volatile fields, the only difference is the live response headers (`date`, `age`, `cf-ray`).
  - `pnpm --filter @ndpa/scan-engine test`: 11 passed, plus 2 expected failures. The tests cover:
    - net-guard private, loopback, link-local and metadata addresses;
    - target normalisation;
    - url-check messages;
    - tracker detection (Meta, Google, Hotjar);
    - root domain (including .com.ng), CMP detection and cookie classes;
    - reject and accept wording;
    - bot-wall detection;
    - `pickSubpages` ordering, same-site only, no PDFs;
    - DOM inspection of forms and the privacy link;
    - policy rules, unavailable versus found.
- **Gaps found** (pinned as `it.fails`, tracker **14a**): `ftp://` isn't refused up front, and OneTrust's `otSDKStub.js` loader isn't recognised from page source. Behaviour was deliberately left unchanged in this step.
- **Note for later:** `pkill -f "next start"` does not stop the `next-server` child. Free ports by PID (`lsof -t -iTCP:<port>`).
