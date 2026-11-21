# Step 15 — Evidence store, preflight and SSRF hardening

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5.1 step 1, §9 worker isolation, SCAN-06
**Depends on:** 14, 12
**Branch:** `stage1/15-evidence-preflight`

## Goal
Every scan artefact stored by content hash, and the target checked safely before any browsing.

## Scope
**In**
- Evidence writer: uploads to S3 under the §7 key layout and records SHA-256 for each file
- Preflight: DNS, robots, reachability, TLS certificate and version, response headers, egress IP and country
- SSRF: DNS rechecked at connect time (to stop rebinding), at most 5 redirects, caps on page and total bytes
- Scanner identification header with a contact URL

**Out**
- Browser capture states (Step 17)

## Files / packages touched
- packages/scan-engine/src/{evidence,preflight}/**

## Reuse from current code
- `net-guard.ts` `checkHost` and `safeFetch`

## Acceptance
- [x] Tests: a rebinding host is refused, private IPs are refused, a redirect loop stops at 5, hashes match the stored bytes

## Verification
- `pnpm --filter @ndpa/scan-engine test`

## Notes
Done 2026-11-21.
- **`net-policy.ts`:**
  - An undici `Agent` whose `connect.lookup` runs `vetHost` on **every connection**, refusing private, loopback, link-local, metadata and CGNAT addresses (the existing `isPrivateAddress`).
  - `guardedGet` vets every hop's host too. **Bug found by the tests and fixed:** undici skips `lookup` for IP literals, so a redirect to `http://169.254.169.254/` reached `connect` unchecked.
  - Redirects capped at 5, with only http(s) hops allowed. 10 MB per response (truncated and flagged). A per-scan `ByteBudget` defaults to 400 MB.
  - A realistic desktop UA plus `x-ndpa-lens-scanner: NDPA Lens evidence scanner (+<contact URL>)` (PRD §9 identification).
  - `allowPrivate` (true, or a predicate) exists for test fixtures only.
- **`preflight.ts`:**
  - Resolves and vets the host, then fetches the target, recording status, redirect chain and headers.
  - Checks whether `http://` redirects to `https://` (C-15) and inspects TLS with a direct handshake: protocol, authorised or not with the error, subject, issuer, validity, days to expiry, SANs (C-19).
  - Fetches `robots.txt`, recording it and `disallowsAll`. It is **recorded, not obeyed**, since the client has authorised the scan (CLI-03).
  - Optional egress IP via an echo URL (SCAN-06; the country comes with GeoIP in Step 18).
  - Production targets are limited to ports 80 and 443.
- **`evidence.ts`:** `EvidenceWriter` uploads under `orgs/{org}/scans/{scan}/{page}/{state}/{kind}.{ext}` (PRD §7) and keeps a manifest of `{key, kind, pageId, consentState, contentType, sha256, bytes}`. `verify()` re-hashes the stored bytes.
- **Tracker 14a, part 1 fixed:** `normalizeTargetUrl` refuses non-http schemes up front.
- **Proof:** `pnpm --filter @ndpa/scan-engine test` gives 24 passed and 1 expected failure (the OneTrust loader, Step 17).
  - Private, loopback, metadata and ::1 addresses refused.
  - **DNS rebinding:** public on the first lookup, 127.0.0.1 at connect, refused.
  - Redirect to metadata refused by policy (not by timeout); redirect to `file:` refused; redirect loop stops at 5.
  - Truncation at 100 KB; the scan budget trips.
  - UA and identification header received by the server.
  - Schemes refused.
  - Preflight records status, headers, robots `Disallow: /`, and no TLS on http.
  - A private target is refused by preflight.
  - TLS inspection of a self-signed TLS 1.2+ certificate reports the subject, `authorized: false` and expiry.
  - Evidence stored with the right key and hash, and `verify()` detects tampering (SeaweedFS Testcontainer).
  - The legacy app typechecks and builds.
- **Not yet covered:** the Playwright browser makes its own DNS lookups, so the browser path can't use this dispatcher. Step 17 adds request interception for page loads, and the network-level DOCKER-USER egress rules (Step 33) remain the second layer.
