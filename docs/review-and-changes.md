---
title: NDPA Lens — UI/function review and changes
date: 2026-11-20
repo: https://github.com/Adedejiosvaldo/ndpa-lens
branch: feat/reports-ci-ux
base: main @ 2621af9
commits:
  - 4c23e59 Add CI/CD: build image to GHCR and deploy to the VPS
  - 3dd621e Save shareable reports and rework the report experience
status: pushed to branch, not merged; main is unchanged and nothing was deployed
author: Claude Code (Opus 5.5), working with the repo owner
---

# NDPA Lens — review findings and changes

This file records a design and function review of NDPA Lens, what was changed in response, how each change was checked, and what is still open. It is written to be read by people or by another system/agent picking up the work.

## 1. Review findings

Ranked by impact at the time of the review (before the changes). `Status` is the state on branch `feat/reports-ci-ux`.

| # | Finding | Evidence (pre-change) | Status |
|---|---|---|---|
| F1 | The sample report couldn't be reached. `SAMPLE` was imported and the sample banner existed, but nothing on the landing page opened it. | `src/app/page.tsx:45` | Fixed |
| F2 | Reports were lost on refresh and couldn't be shared. Nothing was stored, and an older history key was deleted on load. Organisation answers were also lost on refresh. | `src/app/page.tsx:83` | Fixed |
| F3 | Print only printed the current step, with sections collapsed. An auditor got about a third of the report. | `src/app/page.tsx:281` | Fixed |
| F4 | Scan progress was fake: a 1.8 s `setInterval` moved the step, so it sat on the last step for 40 s or more. | `src/app/page.tsx:141` | Fixed |
| F5 | The landing hero looked like a generic SaaS template (grid backdrop, green glow, centred heading) and showed nothing of the product. | `src/components/Landing.tsx:100-120` | Fixed |
| F6 | The results page was in the wrong order. The score showed twice, the disclaimer repeated 3–4 times, issues had no severity, effort or link to their fix, and there was no "what to fix first". | `src/components/ReportTabs.tsx` ResultsTab | Fixed |
| F7 | The fix step showed raw markdown in a dark code viewer to non-technical users. Download gave a `.md` file most people can't open. | `src/components/ReportTabs.tsx` RemediationTab | Fixed |
| F8 | The suggested-site buttons (paystack.com and others) each started a real 60 s browser scan of a third-party company's site. | `src/components/Landing.tsx:21` | Fixed (removed) |
| F9 | Two sticky bars (header and step nav) took about 110 px of a phone screen. | `src/app/page.tsx` StepNav | Fixed |
| F10 | Possible dark-theme flash on load. | — | **Retracted.** `src/app/layout.tsx` already runs a theme script before paint. |
| F11 | No CI/CD. Deploys were manual, and the image was built on the VPS. | `deploy/deploy.sh` | Added |
| F12 | No rescan or compare, and no scheduled monitoring. These are the recurring-value features. | — | Rescan and compare fixed. **Monitoring is not built** (see section 5). |

## 2. Changes made

### Saved, shareable reports (F1, F2)
- **Storage:** `src/lib/report-store.ts` saves one JSON file per scan in `data/reports/<id>.json`.
  - IDs are random, 16 characters, base64url, and only the pattern `^[A-Za-z0-9_-]{16}$` is accepted.
  - Writes are atomic: the file is written as `.tmp`, then renamed.
  - Old reports are pruned at most once an hour, by TTL (`REPORT_TTL_DAYS`, default 30) and a count cap (`REPORT_MAX_COUNT`, default 5000).
- **Endpoint:** `GET /api/report/[id]` (`src/app/api/report/[id]/route.ts`). It returns 404 with a plain message when the report is missing or expired, and sends `X-Robots-Tag: noindex`.
- **Report URL and history:** the report URL is `/?report=<id>`, and `/?report=sample` opens the sample. Browser Back works. If the report was opened directly from a link, Back goes to the search page instead of leaving the site.
- **Copy link** button in the report header.
- **Autosave on the visitor's device:** organisation answers are kept per report under the `ndpa_lens_answers_v1:<key>` localStorage key. The business profile is kept across reports under `ndpa_lens_profile_v1`. Neither is sent to the server.
- **Sample entry points:** the landing page has a sample link, and the hero preview card is clickable.

### Real scan progress (F4)
- `runWebsiteAudit(url, ai, onProgress)` and `captureWithBrowser(url, onProgress)` now report these stages in order: `open`, `banner`, `pages` (with which page is being visited), `consent`, `policy`, `score`.
- `POST /api/scan` with `{"stream": true}` replies with `text/event-stream`:
  - one `event: progress` with `data: {"stage","detail"}` per stage;
  - then `event: result` with the `ScanResult`, or `event: error` with `{"error","status"}`.
  - Headers sent: `Cache-Control: no-cache, no-transform` and `X-Accel-Buffering: no`.
  - Rate-limit and validation errors still come back as plain JSON. Requests without `stream` behave as before.
- The UI shows the live stage, its detail line, and an elapsed timer with "Usually takes 40–90 seconds".

### Rescan and compare (F12, partial)
- `POST /api/scan` with `{"previous": "<shareId>"}` attaches `result.previous` (type `ScanComparison`: score, grade, date and check statuses), but only when the earlier report is for the same host.
- A **Rescan** button in the report header. A comparison card shows old → new score, Fixed, New problems, and a link to the earlier report.

### Results redesign (F6)
- **"Fix these first":** the top 3 open issues, ranked by `(fail ? 2 : 1) × points lost ÷ effort`.
- **Each issue shows:** Must fix / Should fix, an effort label (Quick / Medium / Bigger), "+N pts if fixed", and a **Get the &lt;document&gt;** button that opens the matching fix document. The mapping is `FIX_GUIDE` in `src/components/ReportTabs.tsx`.
- The duplicate score pill is hidden on the Results step, and the long disclaimer is now one line.
- "What this scan can't see" moved into the Details section. The warning still shows at the top when the scan was limited (no browser available).

### Print / PDF (F3)
- `src/components/PrintReport.tsx` is a print-only layout with everything expanded, in this order: open issues with fix, evidence and legal reference; passed checks; organisation tier (if answered); banner test; pages; policy clauses; cookies, trackers and headers; screenshots; limits; disclaimer.
- `globals.css` print rules: light colours whatever the screen theme, `.screen-only` hidden, `.print-only` shown, no clipped scroll boxes, and page-break hints.
- The PDF file name is taken from the page title, `NDPA readiness - <host> - <date>`.

### Documents (F7)
- **Preview:** markdown documents (readiness report, privacy policy) show as formatted pages, with a toggle back to the raw Markdown.
- **Sanitising:** the documents include text scraped from the scanned site, so the preview shows raw HTML as plain text, keeps only `http(s)` and `mailto` links, and turns images into their alt text. This is `safeMarked` in `src/components/ReportTabs.tsx`.
- **Word export:** `src/lib/markdown-docx.ts` converts markdown to .docx (headings, paragraphs, bold/italic/code, links, lists, tables, quotes, rules). It is loaded only when someone clicks the Word button.
- **Downloads:** Word (.docx) is the main one, with .md as a secondary option.

### Landing (F5, F8)
- The hero is now two columns: the headline and form on one side, and a live preview built from the sample report data on the other (banner test plus top fixes).
- The grid and glow backdrop and the third-party "Try" buttons are removed.

### Mobile (F9)
- The step nav is sticky only from the `sm` breakpoint up. The fix buttons wrap below the text on phones.

### CI/CD (F11)
`.github/workflows/ci-cd.yml` has three jobs:
1. `check`: `pnpm typecheck` and `pnpm build`, on every push and PR.
2. `image`: on `main` only. Builds the image and pushes it to `ghcr.io/<owner>/ndpa-lens` tagged `:<sha>` and `:latest`, with a GitHub Actions build cache.
3. `deploy`: runs only when the repo variable `VPS_HOST` is set. Over SSH (`appleboy/ssh-action@v1.2.0`) it fast-forwards the VPS checkout to the commit, logs in to GHCR with that run's short-lived token, then runs `NDPA_IMAGE=<image:sha> bash deploy/deploy.sh`.

Supporting changes:
- `deploy/docker-compose.yml`: `image: ${NDPA_IMAGE:-ndpa-lens:local}` alongside `build: ..`.
- `deploy/deploy.sh`:
  - pulls the image instead of building when `NDPA_IMAGE` is set;
  - asks for the OpenRouter key only when a terminal is attached;
  - fails the deploy if the new container isn't healthy;
  - adds `flush_interval -1` to its Caddy template.
- `package.json`: `"packageManager": "pnpm@11.5.2"`.

Rollback: on the VPS, run `NDPA_IMAGE=ghcr.io/<owner>/ndpa-lens:<older-sha> bash deploy/deploy.sh`.

## 3. Verification performed

All checks were run locally on Windows against a production build (`pnpm build` and `pnpm start`). Browser checks used Chrome and Playwright.

| Check | Result |
|---|---|
| `pnpm typecheck` | Pass |
| `pnpm build` | Pass |
| `GET /api/report/nope` | 404 with the expected message |
| Real scan of example.com, then reload by share ID | 200, same score, report about 63 KB |
| Streamed scan with `previous` | 8 progress events then the result, in stage order; `previous` attached correctly |
| Sample link and preview card | Open `?report=sample` |
| Browser Back from a report opened by link | Returns to the landing page on the same site |
| Business name after a full page reload | Kept |
| Clicking "Get the privacy policy" | Opens the Fix step with the policy selected and previewed |
| Script tags in the rendered preview | 0 |
| Markdown → .docx (Node, sample markdown with a table, list and quote) | Valid zip/docx, 8 KB |
| Print-media render in dark theme | Light colours, all sections expanded, nav hidden |
| Comparison card on a rescanned report | Renders correctly |
| 390 px wide viewport | No horizontal overflow |

**Not verified:**
- The workflow YAML wasn't linted, because downloading a linter was blocked. Its first real run on GitHub is the test.
- The deploy job was never run against the VPS.
- The .docx wasn't opened in Microsoft Word.
- SSE streaming through Caddy in production wasn't tested.

## 4. API / configuration reference

| Item | Type | Notes |
|---|---|---|
| `POST /api/scan` `{url, stream?, previous?}` | changed | `stream: true` gives SSE (`progress`, `result`, `error` events); `previous` is a share ID, used only for the same host |
| `GET /api/report/:id` | new | Returns the saved `ScanResult`, or 404 |
| `ScanResult.shareId`, `ScanResult.previous` | new fields | `src/types/audit.ts` |
| `ScanStage`, `ScanProgress`, `ScanComparison` | new types | `src/types/audit.ts` |
| `REPORT_DIR` | env | Default `./data/reports` (on the `ndpa_data` volume in Docker) |
| `REPORT_TTL_DAYS` | env | Default 30 |
| `REPORT_MAX_COUNT` | env | Default 5000 |
| `NDPA_IMAGE` | env (deploy) | When set, `deploy.sh` pulls this image instead of building |
| `marked@15.0.12`, `docx@9.5.1` | new dependencies | Exact versions pinned |

GitHub repo settings needed before deploys run:

| Kind | Name | Notes |
|---|---|---|
| Variable | `VPS_HOST` | Deploy job is skipped while unset |
| Variable | `VPS_USER` | |
| Variable | `VPS_APP_DIR` | Default `~/ndpa-lens` |
| Secret | `VPS_SSH_KEY` | |
| Secret | `VPS_SSH_PORT` | Optional |

## 5. Open items / next steps

1. **Merge** `feat/reports-ci-ux` into `main`. Once the GitHub repo settings in section 4 are set, merging triggers build and deploy.
2. **Caddy:** add `flush_interval -1` to the `reverse_proxy ndpa-lens:3000` block in azaman-engine's `deploy/Caddyfile`. That block lives there, not in `deploy.sh`'s template. Without it the progress list may only update at the end; scans still work.
3. Run `bash deploy/deploy.sh` by hand once on the VPS so `deploy/.env` holds the OpenRouter key. CI never prompts for it.
4. **Scheduled monitoring with email alerts is not built.** It needs three decisions:
   - an email provider (Resend, Postmark or SMTP) and its credentials;
   - consent, unsubscribe and privacy-policy wording for storing visitors' email addresses;
   - a cap on sites per user and scan frequency (each scan starts a full browser).
5. Optional follow-ups:
   - deep-link to a single issue;
   - remember which issues are expanded when the filter changes;
   - SSE heartbeats if a proxy times out idle connections during long scans.

## 6. Skills and tools used

- **Skills (the Skill tool):** none were invoked in this session. The only one active was the caveman reply-style mode turned on by the session-start hook. It changed reply style only, not the code or docs.
- **Subagents:** none.
- **Tools:**
  - `Read`, `Edit`, `Write`, `Grep`/`Glob` for code;
  - `Bash` and `PowerShell` for pnpm, git, curl, node and process cleanup;
  - Claude in Chrome (`navigate`, `computer`, `find`, `javascript_tool`, `tabs_*`) for UI checks;
  - Playwright scripts (from the project's dependency) for the print, mobile and comparison renders;
  - `ToolSearch`, `TaskStop`.
- **External services contacted:**
  - npm registry, for `pnpm add`;
  - GitHub, for `git push` of the branch;
  - example.com, the scan target in tests.
