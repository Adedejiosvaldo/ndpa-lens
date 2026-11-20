# Step 13 — Clients, domains and authorisation attestation

**Phase:** Phase 2 — Clients
**PRD refs:** CLI-01..05
**Depends on:** 12
**Branch:** `stage1/13-clients-domains`

## Goal
DPCOs manage their clients and domains, and record that they are authorised to scan.

## Scope
**In**
- Tables clients, domains, authorisations with RLS
- Client CRUD and archive (archived clients block scans)
- Domains (unique per org) with extra named URLs
- Attestation (user, timestamp, IP, statement version)
- Clients list (search, sector and tier filters, last scan placeholder) and client detail UI
- Confirm dialogs that name the item

**Out**
- Scanning
- CSV import (P1)

## Files / packages touched
- apps/api/src/clients/**, apps/web/(app)/clients/**

## Reuse from current code
- Hostname normalising from `url-check.ts` / `net-guard.ts`

## Acceptance
- [ ] Viewers can't create; Analysts can
- [ ] A scan precondition helper refuses domains without an attestation (unit test)
- [ ] Tenant harness extended

## Verification
- `pnpm turbo test`

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
