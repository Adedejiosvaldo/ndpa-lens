# Step 34 — Observability and alerts

**Phase:** Phase 6 — Production and launch
**PRD refs:** §10
**Depends on:** 33
**Branch:** `stage1/34-observability`

## Goal
Know when something breaks before a DPCO notices.

## Scope
**In**
- Sentry for web and API
- Uptime monitoring
- JSON logs with request, org and scan IDs
- Alerts: scan success under 90% per hour, queue p95 over 10 minutes, 5xx over 1%, disk over 70%, backup failed

**Out**
- —

## Files / packages touched
- apps/*, infra/**

## Reuse from current code
- —

## Acceptance
- [ ] A test alert reaches the owner; a deliberate error shows up in Sentry

## Verification
- Manual trigger, results recorded in Notes

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
