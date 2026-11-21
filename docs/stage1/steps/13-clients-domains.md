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
- [x] Viewers can't create; Analysts can
- [x] A scan precondition helper refuses domains without an attestation (unit test)
- [x] Tenant harness extended

## Verification
- `pnpm turbo test`

## Notes
Done 2026-11-21.
- **Schema** (migrations 0005 and 0006):
  - `clients`: name, rc_number, sector, `ndpc_tier` enum, contact jsonb, created_by, archived_at.
  - `domains`: hostname, `extra_urls text[]`, unique per (org_id, hostname).
  - `authorisations`: domain, user, statement_version, the **full statement text**, ip, created_at.
  - All three are under FORCE RLS for `ndpa_api`. **authorisations is append-only** (SELECT and INSERT grants only).
  - A trigger refuses a domain whose client belongs to another org.
- **API** (`src/clients/`):
  - `GET/POST /clients` (list: search over name, RC number or domain with `%`/`_` escaped; sector and tier filters; archived toggle; cursor pages).
  - `GET/PATCH/DELETE /clients/{id}`; DELETE archives.
  - `POST /clients/{id}/domains`, `PATCH/DELETE /domains/{id}`.
  - `GET/POST /domains/{id}/authorisation`.
  - Roles: Viewers read; Analysts and above create, edit, archive and attest.
- **Validation:**
  - `normaliseHostname` reduces any pasted URL to its hostname and refuses IPs, single labels, ports and internal TLDs (.local, .test, .internal…).
  - Named pages must be http(s) on the same site, are de-duplicated, at most 25.
  - RC numbers follow CAC format; sector and tier are enums.
- **CLI-03:** the statement names the firm, client and domain and is versioned (`ATTESTATION_VERSION`). Changing the wording requires attesting again. A tick and the current version are both required, and the user, time and IP are stored. Audit: `domain.authorised`.
- **CLI-04:** archiving keeps history and blocks edits, new domains and scans (`client_archived`). Audit: client.created, client.updated, client.archived, domain.added, domain.updated, domain.removed.
- **`ClientsService.assertScannable(tx, clientId, domainIds)`** is ready for Step 22. It requires an active client, at least one domain, and a current attestation on every domain (`attestation_required`).
- **Web:**
  - "Clients" in the nav, and a clients list with debounced search, sector and tier filters, archived toggle, empty states, and "Not scanned yet".
  - Add-client form.
  - Client detail: websites with engagement status, a "Confirm engagement" dialog showing the exact statement plus a tick box, named-pages editor, remove with confirm, contact, archive with a confirm naming the client.
  - "Run scan" is shown but disabled until Step 22.
  - The overview empty state now offers "Add client".
- **Proof:**
  - API: 101 tests (16 new). Hostname and named-page validation; Analyst versus Viewer rights; sector, tier and RC validation; duplicate domains within the org (same or other client); internal hosts and off-site pages refused; named-page edit and domain removal; the statement text; attestation needs a tick and the current version; user, IP (`203.0.113.10`) and statement are stored; the API role can't update attestations; the precondition gives validation_failed, then attestation_required, then passes, then client_archived; the archived list and edits refused; search by domain, name and RC, filters, `%_` escaped; cursor pages; the tenant harness over every new route; the cross-org domain trigger.
  - E2E: the founder journey adds a client, adds a website from a pasted URL, confirms engagement in the dialog (button disabled until ticked), and finds the client by domain search, with axe on the client page. 5/5 passing.
  - Largest route 131.7 KB.
- **Later:** `lastScanAt` and open-finding counts are null until Step 22. Removing a domain that has scans will need a guard then. CSV import is CLI-06 (P1).
