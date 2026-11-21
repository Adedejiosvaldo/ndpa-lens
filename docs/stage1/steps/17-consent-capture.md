# Step 17 — Capture in three consent states, plus form inspection

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** SCAN-03, §5.1 steps 3–7
**Depends on:** 16
**Branch:** `stage1/17-consent-capture`

## Goal
Record each page with no interaction, after reject-all and after accept-all, as evidence.

## Scope
**In**
- A fresh context per page per state; 1366×768 desktop plus a Pixel 7 pass on the homepage only; 45 s timeout
- HAR, cookies, localStorage, console, DOM, full-page and above-the-fold screenshots → evidence store
- CMP selectors (OneTrust, Cookiebot, CookieYes, Termly, Osano, Izini, CookieHub) plus a heuristic
- Form inspection: fields, pre-ticked boxes, notice link near submit, action scheme; never submits

**Out**
- Checks (Steps 20–21)
- Worker queue (Step 22)

## Files / packages touched
- packages/scan-engine/src/capture/**

## Reuse from current code
- `browser-capture.ts` consent clicking, `REJECT_RE`/`ACCEPT_RE`, `CMP_SIGNATURES`

## Acceptance
- [x] Run against fixtures from Step 19 or local HTML: all three states produce distinct, hashed artefacts; no form submissions in the HAR

## Verification
- `pnpm --filter @ndpa/scan-engine test -- capture`

## Notes
Done 2026-11-21.
- **`packages/scan-engine/src/capture.ts` → `capturePage(browser, {url, pageId, pageType, state, policy, writer, device})`:**
  - **A fresh browser context per page and state.** Desktop is 1366×768 with a realistic UA. Mobile is a Pixel 7 profile, for the homepage pass. Locale en-GB, timezone Africa/Lagos, service workers blocked, no downloads, the scanner identification header sent, and a HAR recorded (headers only).
  - **States:** `none` loads and records. `reject` and `accept` load, click the choice (searching every frame, so iframe CMPs work), reload, then record. Each request carries `phase: "initial" | "after-choice"`, so the checks compare like with like. Each request also records host, method, resource type, third-party (by root domain), the first 4 KB of `postData` (for C-11), status and any block reason.
  - **Banner (§5.1 step 4):**
    - CMP detection from page HTML and script sources: OneTrust (now including `cookielaw.org`/`otSDKStub`, which closes tracker 14a), Cookiebot, CookieYes, Termly, Osano, CookieHub and others.
    - A DOM heuristic scores elements on CMP-like ids or classes, dialog roles, fixed or sticky position, cookie or consent wording and the presence of buttons, including inside shadow DOM.
    - Records `aboveFold` (C-05), `prominent` (GAID middle or side placement), the text, and the **reject, accept and settings buttons with their area, font size and colours**, for equal-prominence checks (C-04).
  - **Cookies:** `setBeforeChoice` (C-06) and `thirdParty`. Also records localStorage and console messages (up to 200).
  - **Forms (§5.1 step 7), read from DOM properties so JS-ticked boxes count, never submitted:** fields, flagging personal-data ones (email, phone, name, address, BVN or NIN, card…); checkboxes with checked and consent-like flags (C-13); a privacy link next to the form (C-12); the action scheme http, https or same-page (C-14). Mixed-content requests are listed.
  - **Browser SSRF guard:** a context-wide `route('**/*')` vets every request host with `vetHost` (cached per host) and aborts non-http(s) or private targets with `blockedbyclient`. Navigation errors become plain ScanAbort messages (private, DNS, certificate, timeout).
  - **Evidence**, through `EvidenceWriter`, each with a SHA-256: `dom.html`, `screenshot_fold.png`, `screenshot.png` (full page), `har.json`, `cookies.json` (with localStorage), `forms.json` (banner, choice, requests, forms, mixed content, console, status, title, final URL).
- **CI:** Playwright Chromium is installed before `pnpm test`, because the engine tests drive a real browser.
- **Proof:** `pnpm --filter @ndpa/scan-engine test` gives **38 passed** (9 capture tests, on a local fixture site mapped through `--host-resolver-rules`).
  - Compliant site, none: banner found above the fold, reject and accept within 25% of each other in area, no tracker.
  - Compliant site, reject: clicked "Reject all", nothing tracks after the reload, consent cookie not set before the choice.
  - Compliant site, accept: the tracker loads after the choice and is marked third-party.
  - Non-compliant site:
    - the tracker loads before consent;
    - the `_fbp` cookie is set before the choice;
    - the form posts over http, has no privacy link, has a pre-ticked consent-like box and collects the fullname and phone fields;
    - tracking continues after reject.
  - An `<img>` to `metadata.test` (resolves to 169.254.169.254) is blocked and never reaches the server. Forms are never submitted.
  - All six evidence kinds are stored under the PRD key layout and pass `verify()`; the HAR parses with entries.
  - Mobile pass: fold screenshot width 1081 px (412 × 2.625).
- **Not covered yet:** Chromium resolves DNS itself, so the route check is before-connect, not at connect. A rebinding in that window is still possible inside the browser, and DOCKER-USER egress rules (Step 33) close it. The full 10-page timing target (§11) is measured in Step 22 with the worker.
