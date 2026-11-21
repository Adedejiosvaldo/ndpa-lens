# Step 18 — `packages/vendors` and GeoIP

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** FLOW-01, FLOW-02, §5.3
**Depends on:** 03
**Branch:** `stage1/18-vendors`

## Goal
Classify third-party hosts and locate them for the data-flow map.

## Scope
**In**
- Versioned vendor list (name, hostnames, category, HQ country), seeded from DuckDuckGo Tracker Radar or Disconnect plus Nigerian vendors (Paystack, Flutterwave, Termii…)
- Unknown hosts flagged for review
- DB-IP Lite country and ASN lookup (owner decision 2026-11-21: no key; CC-BY attribution in packs)
- Script to rebuild the list

**Out**
- Admin editing (P1)

## Files / packages touched
- packages/vendors/**

## Reuse from current code
- `TRACKER_SIGNATURES` in `trackers.ts`

## Acceptance
- [x] Tests: known hosts map correctly, unknown hosts are flagged, the version string is stable

## Verification
- `pnpm --filter @ndpa/vendors test`

## Notes
Done 2026-11-21.
- **`packages/vendors` (`@ndpa/vendors`), list version `2026-11-21.1`:** 77 vendors across analytics, session replay, advertising, social, consent management, support, payments, functional, CDN and strictly necessary. Each has its hostnames and HQ country.
  - Includes the PRD's named vendors (Meta, Google, TikTok, Hotjar, Clarity…) and hand-curated Nigerian ones: Paystack, Interswitch, Remita, Monnify, OPay, Termii, Mono, Okra, plus Flutterwave and Smile ID (US HQ).
  - **Licensing decision:** curated in-house rather than seeded from Tracker Radar (CC BY-NC-SA, no commercial use) or Disconnect (GPL-3.0). Recorded in the tracker's owner decisions.
- **`classifyHost(host)`:** longest-suffix match over registrable hostnames, so lookalikes don't match. Returns `{vendor, needsReview, nonEssential}`. **Unknown hosts get `needsReview: true` and `nonEssential: null`**, never assumed necessary (§5.3). `NON_ESSENTIAL` covers analytics, advertising, session replay and social.
- **GeoIP:** `openGeo(countryPath, asnPath)` reads DB-IP Lite mmdb files with `maxmind` (MIT). `geoFromReaders` returns `{ip, country, asn, asOrg}`. `DBIP_ATTRIBUTION` is printed in packs (CC BY 4.0).
- `scripts/download-dbip.mjs` (`pnpm --filter @ndpa/vendors geoip:download`) fetches this month's files into the git-ignored `data/` folder. It's run at image build (Step 33), not committed.
- **Proof:** 5 tests passed and 1 skipped.
  - List well formed: unique ids and hostnames, bare hosts, ISO country codes, version format.
  - PRD and Nigerian vendors covered.
  - Subdomains and case handled; consent classes correct.
  - Unknown and lookalike hosts flagged.
  - Geo wrapper mapping and nulls.
  - **The real DB-IP file test is skipped**: the download was not run here, because it's a third-party download left for the image build.
