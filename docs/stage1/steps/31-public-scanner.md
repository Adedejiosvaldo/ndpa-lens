# Step 31 — Public scanner on the new engine

**Phase:** Phase 5 — Commerce, admin, public
**PRD refs:** PUB-01..04
**Depends on:** 22, 30
**Branch:** `stage1/31-public-scanner`

## Goal
The free lead magnet, rebuilt on the real engine, which replaces the legacy app.

## Scope
**In**
- `POST /v1/public/scans` with Turnstile; 3 per IP per day; homepage plus 2 pages
- Results by requester token only; score and top 5 issues; full detail behind an email; table public_scans with 180-day retention
- Lead form routed to DPCOs in rotation
- Public landing in `apps/web`; retire `apps/legacy-scanner` (keep the `?report=` links redirecting or showing a clear expiry message)

**Out**
- —

## Files / packages touched
- apps/api/src/public/**, apps/web public pages; remove apps/legacy-scanner

## Reuse from current code
- Landing design and sample from the legacy app

## Acceptance
- [ ] The 4th scan from one IP in a day is refused; another requester can't read the result; the lead is routed
- [ ] Old report links handled

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
