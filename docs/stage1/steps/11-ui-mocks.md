# Step 11 — HTML mocks of the key screens

**Phase:** Phase 1 — Foundations
**PRD refs:** §3.1
**Depends on:** 10
**Branch:** `stage1/11-ui-mocks`

## Goal
Test the layouts with real DPCOs before building the components.

## Scope
**In**
- Static HTML mocks of the onboarding checklist, findings review (filters, cards, evidence drawer, summary bar) and pack preview, using sample data
- Published as a private artifact link for sharing
- 👤 Owner shows them to 2 DPCOs; feedback recorded in Notes

**Out**
- Real components

## Files / packages touched
- docs/stage1/mocks/**

## Reuse from current code
- Data from `sample-audit.ts`

## Acceptance
- [ ] Mocks published; DPCO feedback recorded, with layout changes noted for Steps 23, 26 and 32

## Verification
- Open the artifact link

## Notes
Mocks published 2026-11-21: https://claude.ai/artifact/Y9NmB4JESs2MQEwjpm2dBv (a private design canvas; **the owner must share it from the Share menu** before DPCOs can open it). Sources are copied to `docs/stage1/mocks/`.
- **1. Findings review** (`Main.dc.html`):
  - Summary bar: 3 Critical, 5 High, 9 Medium across 12 pages, plus Generate pack.
  - Left: filters for severity, NDPA area, page and status, with a note on the J/K/E keyboard shortcuts.
  - Centre: finding cards with a plain-language title, severity label, area and pages, a one-line "why it matters", and three actions (view evidence, mark false positive, add note for client).
  - Right: evidence drawer with a screenshot placeholder, the request, page, consent state, timestamp (WAT), destination, legal reference (marked draft), file hash, and "what to tell the client".
- **2. Onboarding checklist** (`Onboarding.dc.html`): four steps (licence, brand, first client, first scan) with a progress bar; the active step offers "Add client" or "Try the demo client first"; skippable. Side panel: days to the CAR deadline (emerald-black) and free credits left.
- **3. Pack preview** (`Pack.dc.html`):
  - The white-label cover in the DPCO's colour, with licence number, scan date, NDPA 2023 and GAID 2025, the severity summary and the liability line.
  - A version selector; downloads for PDF, JSON and the evidence ZIP; a share link; and an integrity panel (signature valid, manifest hash).
- Same tokens as `apps/web` (white, emerald #047857, Geist). The sample data is fictional (Adeyemi & Co, Harbour Assurance Plc).
- **👤 Owner to do:** share the link, show it to 2 DPCOs, and record their answers to the questions on the canvas sticky note. Steps 23, 26 and 32 wait on that feedback.
