# Step 35 — Security gate

**Phase:** Phase 6 — Production and launch
**PRD refs:** §9, §12
**Depends on:** 34
**Branch:** `stage1/35-security-gate`

## Goal
Launch only once security checks pass.

## Scope
**In**
- OWASP ZAP baseline in CI against staging
- Trivy image scan, dependency audit, secret scanning
- Tenant harness covers every endpoint
- SSRF and IDOR manual checklist (ASVS L2), STRIDE notes
- Our own site scanned: no critical or high findings
- CSP, HSTS preload, no inline scripts

**Out**
- External pentest (later)

## Files / packages touched
- .github/workflows/**, docs/security/**

## Reuse from current code
- —

## Acceptance
- [ ] Every gate item green, with evidence linked in Notes

## Verification
- CI run links

## Notes
_Fill in when done: what changed, proof (commands and results), what wasn't verified, open risks._
