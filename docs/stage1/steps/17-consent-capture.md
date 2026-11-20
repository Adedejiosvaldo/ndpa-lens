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
- [ ] Run against fixtures from Step 19 or local HTML: all three states produce distinct, hashed artefacts; no form submissions in the HAR

## Verification
- `pnpm --filter @ndpa/scan-engine test -- capture`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
