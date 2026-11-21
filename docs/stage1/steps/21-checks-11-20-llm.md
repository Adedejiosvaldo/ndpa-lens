# Step 21 — Checks C-11 to C-20 and the LLM policy classifier

**Phase:** Phase 3 — Scan engine and checks
**PRD refs:** §5.2, §5.4, §5.1 step 8
**Depends on:** 20
**Branch:** `stage1/21-checks-11-20-llm`

## Goal
Complete the catalogue, with the assisted policy classification reproducible and labelled.

## Scope
**In**
- C-11..C-20
- LLM classifier for policy disclosures: stores model, prompt version and raw output; low confidence becomes needs-review; marked 'assisted'
- Golden tests extended

**Out**
- —

## Files / packages touched
- packages/checks/**

## Reuse from current code
- `analyzePrivacyPolicy` and the AI quota approach in `policy-analyzer.ts`

## Acceptance
- [x] All fixture variants match
- [x] LLM output is replayed from the stored raw output in golden tests (no network)

## Verification
- `pnpm --filter @ndpa/checks test`

## Notes
Done 2026-11-21.
- **C-11..C-20** (`src/checks/c11-c20.ts`), pure and versioned like C-01..C-10:
  - C-11: emails, Nigerian phone numbers and hashed identifiers (Meta `em/ph/fn/ln`, Google sha256 fields) in third-party URLs and bodies. **URLs are redacted before they go into a finding**, since findings end up in packs.
  - C-12: personal-data forms with no notice near submit. Sign-in forms are excluded.
  - C-13: pre-ticked consent or marketing boxes.
  - C-14: http form actions, or mixed content on form pages.
  - C-15: HTTP not redirected, HSTS missing, or max-age under 180 days.
  - C-16: one sub-finding (low severity) for each of CSP, frame protection, nosniff and Referrer-Policy.
  - C-17: session-replay vendors before choice or after reject.
  - C-18: rights channel. An email, form or portal in the rights section, or a rights page linked from the homepage.
  - C-19: expired or untrusted certificate, or below TLS 1.2.
  - C-20: advertising or social pixels on login, account or checkout pages, even after consent.
- **LLM assist (`src/assist.ts`):**
  - Prompt `policy-disclosures@1` asks 8 yes/no questions: the 6 C-08 items, a DPO contact and a rights channel. Each answer carries a confidence and a supporting quote.
  - `openRouterClient` sends a strict JSON schema at temperature 0. `assistPolicy` makes one call per scan and returns null on failure, leaving rules only.
  - `parseAssist` is pure. It checks that the quote really appears in the policy (ignoring case and spacing).
  - An answer is usable only at confidence ≥ 0.7, and a "yes" also needs a verified quote.
  - **How a policy item is decided** (`decidePolicyItem`):
    - Rules finding the clause wins, unlabelled.
    - Otherwise a usable LLM answer decides, labelled `assisted` with model and prompt version, plus `llm_output` evidence (sha256 of the raw reply).
    - A doubtful LLM answer gives needs-review.
    - With no LLM reading, the rules verdict stands.
  - Used by C-08, C-09, C-10 and C-18.
  - `runChecks(bundle, { assist })` replays the stored reading. The worker (Step 22) stores the raw reply as `llm_output` evidence.
- **Engine fixes found while building these:**
  1. **The SSRF-guarded dispatcher broke every HTTPS connection.** Node asks the lookup for all addresses on TLS, and we answered in the single-address form. Real-site preflight would have reported "unreachable". Fixed, with an HTTPS test that also confirms metadata addresses are still refused at connect time.
  2. Preflight now retries once without certificate validation when the certificate is bad. This records the headers anyway and sets `certificateBypassed`; the certificate is judged by C-19.
  3. Preflight trusts a test CA.
  - `ENGINE_VERSION` is now 1.1.0 and the goldens were recaptured.
- **Fixture fix:** the baseline no longer loads pixels on the login page (C-20 treats login as sensitive).
- **Proof:**
  - `@ndpa/checks`: 33 tests.
    - Every labelled variant meets its expectation for all 20 checks.
    - **Each single-behaviour variant (C-11..C-16, C-18..C-20) fails only its own check.**
    - The baseline passes all 20, with and without the LLM reading.
    - Assist: confident answers decide and are labelled; low confidence gives needs-review; invented quotes can't pass; rules outrank the model; malformed replies are ignored; one call per scan, null on failure; request shape is strict JSON at temperature 0; errors are handled.
    - Redaction is tested.
  - Engine: 41 tests. Affected-package typecheck, build and test all green.
- **Not verified / risks:**
  - **The stored LLM replies in `golden/assist/` are hand-written to the schema**, because there's no API key yet. Real model behaviour is untested. Once the key exists, record real ones with `OPENROUTER_API_KEY=… pnpm --filter @ndpa/checks golden:capture --assist` (after `pnpm build`).
  - The C-11 phone pattern covers Nigerian mobile formats only.
  - C-12's sign-in exclusion (password field and ≤3 fields) is a heuristic.
  - Thresholds (HSTS 180 days, assist confidence 0.7) need the legal reviewer's sign-off along with the draft legal references.
