# NDPA Lens — Stage 1 Technical PRD

Nov 20, 2026 · @Joseph

> Source of truth for the Stage 1 build. Saved verbatim from the owner's document; tables were flattened in transit and have been restored as Markdown tables. Do not edit requirements here without the owner's agreement — record changes in `tracker.md`.

## 1. Overview

Stage 1 ships a production, multi-tenant SaaS that lets licensed DPCOs generate white-labelled, GAID-mapped NDPA technical evidence packs for their clients' websites, in time for the 31 March 2027 CAR deadline. The current NDPA Lens is a single-page public scanner; Stage 1 rebuilds it as a standard application with auth, tenancy, billing, audit logs and a reproducible evidence pipeline.

**Problem.** DPCOs (mostly law and advisory firms, 5–10 staff) must file Compliance Audit Returns for UHL/EHL clients. Technical evidence about how a client's website collects and shares personal data is gathered by hand, if at all, and is easy to dispute.

**Stage 1 objective.** 5 paying DPCOs and 50 paid evidence packs by 31 March 2027.

**In scope**
- Accounts, auth, MFA, DPCO organisations, team members and roles
- DPCO licence verification and white-label branding
- Client and domain management with authorisation attestation
- Multi-page, consent-aware website scan engine
- Evidence pack: PDF + JSON + evidence bundle (screenshots, HAR, hashes)
- Cross-border data-flow map
- Re-scan and remediation diff
- Credits and billing via Paystack
- Public free scanner (lead magnet) with DPCO referral
- Internal admin console

**Out of scope (Stage 2+)**
- Authenticated scans behind client logins
- Scheduled monitoring and drift alerts
- Mobile app and API scanning
- RoPA, DPIA, DSR workspaces; consent banner
- GDPR, Kenya DPA and other frameworks
- Third-party integrations (cloud, Google Workspace, GitHub)

**Success metrics**

| Metric | Target by 31 Mar 2027 |
|---|---|
| Paying DPCOs | 5 |
| Paid evidence packs | 50 |
| Sign-up to first pack | under 10 minutes |
| Pack generation time (p95, 10 pages) | under 5 minutes |
| Findings disputed as wrong by a DPCO or lawyer | under 2% |
| Free scans run | 1,000 |

## 2. Users, roles and permissions

Stage 1 has one paying tenant type (DPCO organisation) with three roles, plus anonymous public users and internal staff. Every request is scoped to one organisation; a user can belong to several.

| Actor | Who | How they arrive |
|---|---|---|
| Public visitor | Anyone running the free scan | lens landing page |
| DPCO Owner | Partner or principal at a licensed DPCO | Sign-up, licence verification |
| DPCO Analyst | Associate preparing audits | Invited by Owner/Admin |
| DPCO Viewer | Partner reviewing packs, read-only | Invited |
| Platform Admin | Joseph / internal staff | Seeded, MFA mandatory |

Permission matrix (O = Owner, A = Admin, N = Analyst, V = Viewer)

| Action | O | A | N | V |
|---|---|---|---|---|
| Edit org profile, branding | yes | yes | no | no |
| Manage members and roles | yes | yes | no | no |
| Billing, buy credits, invoices | yes | no | no | no |
| Create / edit / archive clients | yes | yes | yes | no |
| Add domains, sign authorisation attestation | yes | yes | yes | no |
| Run scans (spends credits) | yes | yes | yes | no |
| View scans, findings, packs | yes | yes | yes | yes |
| Mark finding as false positive / add analyst note | yes | yes | yes | no |
| Download / share packs | yes | yes | yes | yes |
| View org audit log | yes | yes | no | no |
| Delete organisation | yes | no | no | no |

Admin is an org-level role distinct from Platform Admin. An org must always have at least one Owner; ownership transfer requires the new Owner to accept.

## 3. User journeys

The core journey takes a new DPCO from sign-up to a downloadable, white-labelled pack in nine steps and under 10 minutes; the public scanner feeds new clients into that journey instead of selling audits directly.

Re-scans within the same audit cycle cost nothing, so the DPCO can show a client "before and after" without a second purchase. Paid packs need a verified licence; the first three do not.

### 3.1 UI notes

The UI is built for a lawyer, not an engineer: every screen answers "what is wrong, how bad, what proves it, what do I tell the client" in plain English, with the technical detail one click away.

**Design principles**
- **Plain language first.** Finding titles read like audit findings ("Meta Pixel loads before the visitor consents"), never like check IDs. Technical terms (HAR, CSP) appear only in the evidence drawer.
- **Evidence beside every claim.** Each finding opens a drawer with the screenshot (the problem area highlighted), the exact request or cookie, the page URL, the consent state and the timestamp.
- **One primary action per screen.** Clients list: Add client. Client page: Run scan. Scan results: Generate pack.
- **Their brand, not ours.** Pack preview shows the DPCO's logo and colour; NDPA Lens branding stays small in the app chrome.
- **Calm, not alarming.** Severity uses colour plus a text label (Critical, High, Medium, Low), never colour alone; no red banners for things the DPCO cannot act on.
- **Fast on weak connections.** Skeleton loaders, no heavy charts on first load, screenshots lazy-loaded as thumbnails.

**Screen inventory**

| Screen | Purpose | Key elements |
|---|---|---|
| Sign up / log in / MFA | Get in securely | Email, password strength meter, TOTP QR with manual code, recovery codes download |
| Onboarding checklist | First pack in under 10 minutes | 4 steps: licence number, branding, first client, first scan; progress shown; skippable |
| Dashboard | Season overview | Credits left, clients scanned vs not, packs this season, days to CAR deadline, recent scans |
| Clients list | Find a client fast | Search, sector and tier filters, last scan date, open critical/high counts, status pill |
| Client detail | Everything about one client | Domains, attestation status, scan history timeline, latest findings summary, Run scan button |
| Scan progress | Reassure while waiting | Live steps (crawling, testing consent, building pack), pages found, estimated time; safe to leave the page, email on completion |
| Findings review | The working screen | Grouped by NDPA area, severity filter, finding cards, evidence drawer, mark false positive, analyst note |
| Data-flow map | Show where data goes | Map of Nigeria to destination countries, vendor table with country and consent state |
| Diff view | Before and after | Fixed / still open / new / regressed columns; links to both scans |
| Pack preview and download | Hand off | In-browser PDF preview with branding, version selector, download PDF / JSON / evidence ZIP, share link |
| Settings | Org admin | Profile, branding with live pack-cover preview, members and roles, security (sessions, MFA), audit log |
| Billing | Credits and invoices | Balance, bundle cards with naira prices, Paystack checkout, invoice list |
| Public scanner | Lead magnet | Single URL field, Turnstile, score dial, top 5 issues, email gate, Find a DPCO CTA |
| Verify page | Trust | Upload a pack or manifest, shows signature valid / invalid and scan date |

**Findings review screen (most important)**
- Left: filters (severity, NDPA area, page, status). Centre: finding cards with title, severity label, pages affected and a one-line "why it matters". Right: evidence drawer.
- Each card has three actions: View evidence, Mark false positive (requires a note), Add note for client.
- A summary bar at the top: "7 critical, 4 high, 9 medium across 12 pages" plus a Generate pack button that stays disabled until the scan completes.
- Keyboard shortcuts for power users: J/K to move between findings, E to open evidence.

**Empty, loading and error states**
- Empty clients list shows a sample client the DPCO can scan in one click (a demo site we control), so they see a real pack before entering client data.
- Failed scans explain the cause in plain words ("The site blocked automated browsers") with what to do next, and confirm no credit was spent.
- Every destructive action (remove member, archive client) uses a confirm dialog naming the item.

**Design system**
- shadcn/ui on Tailwind with a small token set: one accent colour, neutral greys, severity colours that pass WCAG AA contrast in light and dark modes.
- Inter (or system font) at 14px base for the app; pack PDFs use the DPCO's colour on a fixed, print-tested template.
- Desktop-first at 1280px; tablet usable; mobile read-only for reviewing findings and downloading packs.
- Copy in British English with Nigerian conventions: naira (₦) amounts, 20 Nov 2026 dates, WAT times.

Before building: sketch the onboarding checklist, findings review and pack preview in Figma (or a quick HTML mock) and show them to two DPCOs during soft outreach; change the layout before writing the components.

## 4. Functional requirements

Twelve modules; each requirement has an ID so tickets and tests can reference it. P0 = must ship before outreach, P1 = before 31 Jan 2027.

### 4.1 Auth and identity (AUTH)

| ID | Requirement | Pri |
|---|---|---|
| AUTH-01 | Email + password sign-up; password min 12 chars, checked against breached-password list (k-anonymity HIBP) | P0 |
| AUTH-02 | Email verification required before any scan | P0 |
| AUTH-03 | Login with rate limiting (5 fails / 15 min per account + per IP) and lockout notice email | P0 |
| AUTH-04 | Password reset via single-use, 30-min token | P0 |
| AUTH-05 | TOTP MFA; mandatory for Owners and Platform Admins, optional for others; 10 recovery codes | P0 |
| AUTH-06 | Sessions in httpOnly, Secure, SameSite=Lax cookies; 12h idle, 7d absolute; list and revoke sessions | P0 |
| AUTH-07 | Google OAuth sign-in | P1 |
| AUTH-08 | Magic-link login | P1 |
| AUTH-09 | Org-level setting to enforce MFA for all members | P1 |

### 4.2 Organisations and members (ORG)

| ID | Requirement | Pri |
|---|---|---|
| ORG-01 | Create organisation on sign-up: legal name, trading name, address, phone | P0 |
| ORG-02 | NDPC DPCO licence number captured; status pending until verified against the NDPC register (manual admin check in Stage 1) | P0 |
| ORG-03 | Unverified orgs can use 3 free packs; paid packs require verified licence | P0 |
| ORG-04 | Invite members by email with role; invites expire in 7 days | P0 |
| ORG-05 | Change role, remove member, transfer ownership | P0 |
| ORG-06 | Org switcher for users in several orgs | P1 |

### 4.3 White-label branding (BRAND)

| ID | Requirement | Pri |
|---|---|---|
| BRAND-01 | Upload logo (PNG/SVG, max 1 MB), firm name, primary colour, address/contact block, licence number for pack cover | P0 |
| BRAND-02 | Packs render with DPCO branding only; NDPA Lens appears only as a small "technical evidence generated by" line that Owners can hide on paid plans | P0 |
| BRAND-03 | Custom pack footer / disclaimer text | P1 |

### 4.4 Clients and domains (CLI)

| ID | Requirement | Pri |
|---|---|---|
| CLI-01 | Create client: name, RC number (optional), sector, NDPC tier (UHL / EHL / OHL / unknown), contact person | P0 |
| CLI-02 | Add 1–N domains per client; additional named page URLs per domain (sign-up, checkout, contact, careers) | P0 |
| CLI-03 | Authorisation attestation before first scan of a domain: user confirms the DPCO is engaged by the client; stored with user, timestamp, IP | P0 |
| CLI-04 | Archive client (keeps history, blocks new scans) | P0 |
| CLI-05 | Client list with search, sector filter, last scan date, open-findings count | P0 |
| CLI-06 | CSV import of clients and domains | P1 |

### 4.5 Scans (SCAN)

| ID | Requirement | Pri |
|---|---|---|
| SCAN-01 | Start a scan for a client (all domains) or a single domain; costs 1 credit per client per audit cycle, re-scans in the same cycle free | P0 |
| SCAN-02 | Crawl up to 25 pages per domain: homepage, discovered links to policy/sign-up/login/checkout/contact/careers, plus user-named URLs | P0 |
| SCAN-03 | Run each page in three consent states: no interaction, reject all, accept all (see Section 5) | P0 |
| SCAN-04 | Live progress (queued, crawling, testing, building pack) via SSE | P0 |
| SCAN-05 | Scan fails gracefully on bot-blocking, timeouts or DNS errors with a clear reason; failed scans do not consume credits | P0 |
| SCAN-06 | Scan region selectable later; Stage 1 egress from one fixed location, recorded in evidence | P0 |
| SCAN-07 | Concurrency limit per org (2 running scans) and global queue | P0 |

### 4.6 Findings (FIND)

| ID | Requirement | Pri |
|---|---|---|
| FIND-01 | Each finding: check ID, severity (critical/high/medium/low/info), status (fail/pass/needs-review), legal reference, plain-English explanation, evidence references, remediation guidance | P0 |
| FIND-02 | Analyst can mark a finding as false positive or add a note; original result is preserved and both appear in the audit trail | P0 |
| FIND-03 | Findings filterable by severity, page, check | P0 |

### 4.7 Evidence pack (PACK)

| ID | Requirement | Pri |
|---|---|---|
| PACK-01 | PDF pack: branded cover, executive summary, scope and method, findings by NDPA area, data-flow map, evidence appendix, integrity statement | P0 |
| PACK-02 | Machine-readable JSON of the same content, versioned schema ndpa-lens/pack@1 | P0 |
| PACK-03 | Evidence bundle (ZIP): screenshots, HAR per page per consent state, DOM snapshots, manifest with SHA-256 of every file | P0 |
| PACK-04 | Pack manifest hash signed with a platform Ed25519 key; public verify page where anyone can upload a pack to check integrity | P0 |
| PACK-05 | Packs immutable once generated; analyst notes produce a new pack version | P0 |
| PACK-06 | Shareable link with expiry (default 14 days) and optional passcode | P1 |
| PACK-07 | Client-facing "remediation report" variant without legal framing, for developers | P1 |

### 4.8 Data-flow map (FLOW)

| ID | Requirement | Pri |
|---|---|---|
| FLOW-01 | List every third-party host contacted, with resolved IP, country (GeoIP), organisation (ASN), first-seen consent state, and whether personal data was observed in the request | P0 |
| FLOW-02 | Classify known vendors (Meta, Google, TikTok, Hotjar, Clarity, etc.) from a maintained vendor list | P0 |
| FLOW-03 | Visual map in pack: Nigeria to destination countries, with counts | P0 |

### 4.9 Re-scan and diff (DIFF)

| ID | Requirement | Pri |
|---|---|---|
| DIFF-01 | Re-scan a client and compare to a chosen baseline scan | P0 |
| DIFF-02 | Each finding marked fixed / still open / new / regressed | P0 |
| DIFF-03 | Diff section appended to new pack version | P0 |

### 4.10 Billing (BILL)

| ID | Requirement | Pri |
|---|---|---|
| BILL-01 | Credit ledger per org; 3 free credits on verification | P0 |
| BILL-02 | Buy credit bundles via Paystack (card, transfer); webhook-confirmed, idempotent | P0 |
| BILL-03 | Price tiers: 1 credit (₦100k), 10 (₦750k), 25 (₦1.5m) — placeholders pending validation | P0 |
| BILL-04 | VAT-inclusive invoices (7.5%) as PDF, numbered sequentially | P0 |
| BILL-05 | Manual credit grants by Platform Admin with reason (for concierge deals) | P0 |

### 4.11 Public scanner (PUB)

| ID | Requirement | Pri |
|---|---|---|
| PUB-01 | Anonymous scan of homepage + 2 pages, captcha-protected (Cloudflare Turnstile), 3 scans per IP per day | P0 |
| PUB-02 | Results page shows score and top 5 issues; full detail behind email capture | P0 |
| PUB-03 | CTA "Get an audit-ready pack through a licensed DPCO": lead form routed to partner DPCOs in rotation | P0 |
| PUB-04 | Never show public results for a domain other users scanned; results are private to the requester | P0 |

### 4.12 Platform admin (ADM)

| ID | Requirement | Pri |
|---|---|---|
| ADM-01 | Org list, licence verification queue, approve/reject with note | P0 |
| ADM-02 | Impersonate org (read-only) with audit log entry and banner | P1 |
| ADM-03 | Scan queue health, failed scans, retry | P0 |
| ADM-04 | Credit grants, refunds, lead routing overview | P0 |
| ADM-05 | Check catalogue and vendor list editable without deploy (versioned) | P1 |

## 5. Scan engine and check catalogue

The engine drives a real Chromium browser through each page in three consent states and records everything as evidence first, then runs checks over the recorded evidence. Checks never touch the network themselves, so any finding can be re-derived from the bundle.

### 5.1 Pipeline per scan

1. **Preflight.** Resolve DNS, check robots and reachability, record TLS certificate, server headers and egress IP/location.
2. **Discover.** Load homepage, collect same-site links; rank by keywords (privacy, policy, cookie, sign up, register, login, checkout, cart, contact, careers, apply, quote, claim); add user-named URLs; cap at 25 pages.
3. **Capture state A — no interaction.** Fresh browser context per page; record HAR, cookies, localStorage, requests, console, full-page screenshot and above-the-fold screenshot, DOM snapshot.
4. **Detect consent UI.** Locate banner via known CMP selectors (OneTrust, Cookiebot, CookieYes, Termly, Osano, Izini, CookieHub) plus a heuristic (fixed-position element with cookie/consent/privacy words and buttons).
5. **Capture state B — reject all.** Click reject (or "necessary only"), reload, record again.
6. **Capture state C — accept all.** Fresh context, click accept, reload, record again.
7. **Form inspection.** For forms on sign-up/contact/checkout pages: fields collected, consent checkboxes (pre-ticked or not), privacy-notice link near submit, HTTP vs HTTPS action URL. Never submit forms.
8. **Policy fetch and parse.** Download privacy policy page(s); extract text; run disclosure checks (rules + an LLM classifier whose output is stored with prompt version and marked needs-review when confidence is low).
9. **Run checks.** Deterministic checks over stored evidence produce findings.
10. **Build artefacts.** Data-flow map, JSON, PDF, ZIP bundle, manifest, signature.

**Tech.** Playwright (Chromium) in isolated containers; one browser context per page per state; 45s page timeout; realistic desktop UA and viewport 1366×768 plus a mobile pass (Pixel 7 profile) for the homepage only; residential-style egress not used in Stage 1.

### 5.2 Check catalogue v1

Legal references are a first draft and must be confirmed by the legal reviewer before launch (see Section 14).

| ID | Check | Evidence used | Draft legal ref | Severity if fail |
|---|---|---|---|---|
| C-01 | Non-essential trackers fire before any consent | State A HAR, cookies | NDPA s.25–26 (lawful basis, consent) | Critical |
| C-02 | Trackers still fire after "reject all" | State B HAR | NDPA s.26 | Critical |
| C-03 | No consent banner shown where non-essential trackers exist | State A screenshot, DOM | NDPA s.26; GAID cookie provisions | High |
| C-04 | Banner has no reject option of equal prominence to accept | Screenshot, DOM | NDPA s.26 (freely given) | High |
| C-05 | Banner not visible above the fold | Above-fold screenshot | GAID cookie provisions | Medium |
| C-06 | Non-essential cookies set before consent | State A cookie jar | NDPA s.26 | High |
| C-07 | Privacy policy not linked from homepage | DOM | NDPA s.27 (information to data subjects) | High |
| C-08 | Privacy policy missing required disclosures (controller identity, purposes, lawful basis, retention, rights, DPO contact, transfers, complaint to NDPC) — one sub-finding each | Policy text | NDPA s.27 | Medium per item |
| C-09 | No DPO contact published | Policy text, DOM | NDPA s.32 | Medium |
| C-10 | Personal data sent to third parties outside Nigeria without disclosed transfer basis | HAR + GeoIP + policy text | NDPA s.41–43 | High |
| C-11 | Personal data visible in third-party request URLs or payloads (email, phone, name hashes) | HAR | NDPA s.24, s.39 | Critical |
| C-12 | Forms collect personal data without notice link at point of collection | Form inspection | NDPA s.27 | Medium |
| C-13 | Pre-ticked consent or marketing checkboxes | Form inspection | NDPA s.26 | High |
| C-14 | Form submits over HTTP or mixed content on data pages | Form inspection, HAR | NDPA s.39 (security) | Critical |
| C-15 | HTTPS not enforced / no HSTS | Preflight headers | NDPA s.39 | Medium |
| C-16 | Missing security headers (CSP, X-Frame-Options/frame-ancestors, X-Content-Type-Options, Referrer-Policy) | Headers | NDPA s.39 | Low each |
| C-17 | Session replay / heatmap tools (Hotjar, Clarity, FullStory) active without consent | HAR | NDPA s.26 | High |
| C-18 | Data-subject rights request channel not published | Policy text, DOM | NDPA s.34–38 | Medium |
| C-19 | Expired or weak TLS (below TLS 1.2) | Preflight | NDPA s.39 | High |
| C-20 | Ad/social pixels on login, account or checkout pages | HAR per page type | NDPA s.24–26 | High |

### 5.3 Tracker and vendor classification

A versioned vendor list maps hostnames to vendor, category (strictly necessary, analytics, advertising, session replay, social, CDN, payments) and HQ country. Seed from open lists (e.g. DuckDuckGo Tracker Radar, Disconnect), then curate Nigerian vendors manually (Paystack, Flutterwave, Termii, etc.). Unknown hosts are uncategorised and flagged for review, never silently treated as necessary.

### 5.4 Determinism and reproducibility

- Every finding stores: check ID, check version, engine version, vendor-list version, evidence file IDs.
- Re-running checks over the same bundle must produce identical findings (golden tests).
- LLM-based policy findings store model, prompt version and raw output; they are always labelled "assisted" in the pack.

## 6. System architecture

A TypeScript monorepo with four deployables: web app, API, scan workers and pack builder. They share Postgres, a Redis job queue and Cloudflare R2 object storage, all on one VPS for Stage 1. Scan workers are the only component that loads untrusted websites, so they run in their own subnet with no route to internal services beyond a narrow write path.

**Monorepo layout:** `apps/web` (Next.js), `apps/api` (NestJS), `apps/worker-scan`, `apps/worker-pack`, `packages/checks` (pure functions over evidence, versioned), `packages/vendors` (tracker list), `packages/schema` (Zod types for job, findings, pack JSON), `packages/pdf` (pack templates), `infra/` (Terraform).

**Why split scan and pack workers:** scans are slow and network-bound; packs are CPU-bound and must be reproducible from stored evidence alone. Splitting them lets packs be rebuilt (new branding, analyst notes) without re-scanning.

## 7. Data model

PostgreSQL is the system of record; every tenant-owned table carries org_id and is protected by row-level security keyed on a per-request `app.org_id` setting. Large evidence lives in object storage, referenced by content hash.

| Table | Key columns | Notes |
|---|---|---|
| users | id (uuid v7), email (citext, unique), password_hash (argon2id), email_verified_at, mfa_secret_enc, created_at | Global, not tenant-scoped |
| sessions | id, user_id, active_org_id, ip, user_agent, created_at, last_seen_at, expires_at, revoked_at | Token stored hashed |
| recovery_codes | user_id, code_hash, used_at | |
| organisations | id, legal_name, trading_name, dpco_licence_no, licence_status (pending/verified/rejected), verified_by, verified_at, branding (jsonb), created_at, deleted_at | |
| memberships | org_id, user_id, role (owner/admin/analyst/viewer), invited_by, created_at | PK (org_id, user_id) |
| invitations | id, org_id, email, role, token_hash, expires_at, accepted_at | |
| clients | id, org_id, name, rc_number, sector, ndpc_tier, contact (jsonb), archived_at | |
| domains | id, org_id, client_id, hostname, extra_urls (text[]), created_at | Unique (org_id, hostname) |
| authorisations | id, org_id, domain_id, user_id, statement_version, ip, created_at | Attestation record (CLI-03) |
| scans | id, org_id, client_id, status (queued/running/succeeded/failed/cancelled), trigger (manual/rescan/public), baseline_scan_id, engine_version, checks_version, vendor_list_version, egress_ip, egress_country, started_at, finished_at, failure_reason, credit_txn_id | |
| scan_pages | id, scan_id, domain_id, url, page_type, http_status, consent_state (none/reject/accept), screenshot_key, har_key, dom_key, sha256s (jsonb) | One row per page per state |
| requests | id, scan_page_id, url_host, url_path_hash, method, resource_type, third_party (bool), vendor_id, ip, country, asn, pii_detected (jsonb) | Partitioned by month |
| cookies | id, scan_page_id, name, domain, expires, vendor_id, category, set_before_consent (bool) | |
| findings | id, org_id, scan_id, check_id, check_version, severity, status (fail/pass/needs_review), page_ids (uuid[]), evidence (jsonb), legal_ref, analyst_status (none/false_positive/accepted), analyst_note, analyst_user_id | |
| finding_diffs | scan_id, baseline_scan_id, check_id, page_key, result (fixed/open/new/regressed) | |
| packs | id, org_id, scan_id, version, pdf_key, json_key, bundle_key, manifest_sha256, signature, created_by, created_at | Immutable |
| share_links | id, pack_id, token_hash, passcode_hash, expires_at, revoked_at, view_count | P1 |
| vendors | id, name, hostnames (text[]), category, hq_country, list_version | |
| credit_ledger | id, org_id, delta, reason (grant/purchase/scan/refund), ref_id, created_by, created_at | Balance = SUM(delta); never updated in place |
| payments | id, org_id, paystack_reference (unique), amount_kobo, vat_kobo, status, raw_webhook (jsonb), created_at | |
| invoices | id, org_id, number (sequence), payment_id, pdf_key, issued_at | |
| public_scans | id, hostname, email, ip_hash, result (jsonb), lead_status, routed_org_id, created_at | Retention 180 days |
| audit_log | id, org_id, actor_user_id, actor_type, action, target_type, target_id, ip, metadata (jsonb), created_at | Append-only; no UPDATE/DELETE grant |

Object storage layout: `orgs/{org_id}/scans/{scan_id}/{page_id}/{state}/{screenshot|har|dom}.{ext}` and `orgs/{org_id}/packs/{pack_id}/v{n}/`. Keys are content-addressed in the manifest; buckets private, access only via 5-minute pre-signed URLs.

IDs: uuid v7 everywhere (sortable). Money: integers in kobo. Time: timestamptz, displayed in Africa/Lagos.

## 8. API specification

REST over HTTPS, JSON, versioned under /v1, documented with OpenAPI 3.1 generated from the NestJS controllers. The web app is the only Stage 1 client; a public API with org API keys comes in Stage 2, so design it public-ready now.

**Conventions**
- Auth: session cookie + CSRF token header (X-CSRF-Token) for browser calls.
- Tenant: `/v1/orgs/{orgId}/...`; server checks membership and role on every call, then sets RLS context.
- Errors: RFC 9457 problem+json with stable code (e.g. insufficient_credits, licence_unverified).
- Pagination: cursor-based (`?cursor=&limit=`, max 100).
- Idempotency: Idempotency-Key header required on POSTs that spend credits or money.
- Rate limits: 300 req/min per session; scans limited separately (SCAN-07).

| Method | Path | Purpose | Min role |
|---|---|---|---|
| POST | /v1/auth/signup | Create user + org | public |
| POST | /v1/auth/verify-email | Confirm email token | public |
| POST | /v1/auth/login | Password login (returns mfa_required if enabled) | public |
| POST | /v1/auth/mfa/verify | Complete MFA step | public (pending session) |
| POST | /v1/auth/mfa/enrol, /confirm, /disable | Manage TOTP | self |
| POST | /v1/auth/password/forgot, /reset | Reset flow | public |
| POST | /v1/auth/logout | End session | self |
| GET / DELETE | /v1/me/sessions[/{id}] | List / revoke sessions | self |
| GET | /v1/me | Profile + memberships | self |
| GET / PATCH | /v1/orgs/{orgId} | Org profile | viewer / admin |
| PUT | /v1/orgs/{orgId}/branding | Logo, colours, cover text | admin |
| POST | /v1/orgs/{orgId}/licence | Submit licence number for verification | owner |
| GET / POST | /v1/orgs/{orgId}/members, /invitations | Members and invites | admin |
| PATCH / DELETE | /v1/orgs/{orgId}/members/{userId} | Change role / remove | admin |
| POST | /v1/invitations/{token}/accept | Accept invite | invitee |
| GET / POST | /v1/orgs/{orgId}/clients | List / create clients | viewer / analyst |
| GET / PATCH / DELETE | /v1/orgs/{orgId}/clients/{clientId} | Read / edit / archive | viewer / analyst |
| POST | /v1/orgs/{orgId}/clients/{clientId}/domains | Add domain | analyst |
| POST | /v1/orgs/{orgId}/domains/{domainId}/authorisation | Sign attestation | analyst |
| POST | /v1/orgs/{orgId}/scans | Start scan {clientId, domainIds?, baselineScanId?} | analyst |
| GET | /v1/orgs/{orgId}/scans/{scanId} | Status + summary | viewer |
| GET | /v1/orgs/{orgId}/scans/{scanId}/events | SSE progress stream | viewer |
| POST | /v1/orgs/{orgId}/scans/{scanId}/cancel | Cancel queued/running | analyst |
| GET | /v1/orgs/{orgId}/scans/{scanId}/findings | Findings, filterable | viewer |
| PATCH | /v1/orgs/{orgId}/findings/{findingId} | Analyst status / note | analyst |
| GET | /v1/orgs/{orgId}/scans/{scanId}/flows | Data-flow map data | viewer |
| GET | /v1/orgs/{orgId}/scans/{scanId}/diff | Diff vs baseline | viewer |
| POST | /v1/orgs/{orgId}/scans/{scanId}/packs | Build new pack version | analyst |
| GET | /v1/orgs/{orgId}/packs/{packId}/download?part=pdf\|json\|bundle | Pre-signed URL | viewer |
| POST | /v1/orgs/{orgId}/packs/{packId}/share-links | Create share link (P1) | analyst |
| GET | /v1/orgs/{orgId}/credits | Balance + ledger | owner |
| POST | /v1/orgs/{orgId}/checkout | Start Paystack payment for a bundle | owner |
| POST | /v1/webhooks/paystack | Payment webhook (HMAC-SHA512 verified) | Paystack |
| GET | /v1/orgs/{orgId}/invoices | Invoices | owner |
| GET | /v1/orgs/{orgId}/audit-log | Org audit log | admin |
| POST | /v1/public/scans | Free scan (Turnstile token required) | public |
| GET | /v1/public/scans/{id} | Free scan result (requester token) | public |
| POST | /v1/public/scans/{id}/lead | Request DPCO referral | public |
| POST | /v1/verify | Upload manifest/pack to verify signature | public |
| * | /v1/admin/... | Licence queue, orgs, credits, scan queue | platform admin |

**Scan job contract (API → queue):** `{scanId, orgId, targets:[{domainId, urls[]}], states:["none","reject","accept"], maxPages:25, engineVersion, checksVersion}`. Workers report progress events `{scanId, phase, pageDone, pageTotal}` and write results directly to Postgres/S3 with a scoped service role.

## 9. Security, privacy and our own NDPA compliance

A compliance tool that leaks is finished, so security is a launch gate, not a backlog item. We are a data controller for user accounts and a processor for DPCOs' client data, and we must pass our own scanner with zero critical or high findings.

**Application security**
- OWASP ASVS Level 2 as the checklist; threat model (STRIDE) for auth, tenancy, scan workers and payments before build.
- Tenancy enforced twice: service-layer membership check plus Postgres RLS. Automated cross-tenant tests on every endpoint (Section 12).
- Argon2id password hashing; TOTP secrets and Paystack keys encrypted at the application layer (AES-256-GCM, key held in the SOPS-encrypted environment).
- CSRF tokens, strict CSP, HSTS preload, no inline scripts; secure cookie flags (AUTH-06).
- All file downloads via short-lived pre-signed URLs; buckets block public access.
- Dependency scanning (Dependabot/Renovate + npm audit), container image scanning (Trivy), secret scanning in CI.
- Audit log for every security-relevant action: login, MFA change, role change, scan, pack download, finding override, admin impersonation.

**Scan worker isolation (highest-risk component — it loads arbitrary websites)**
- Workers run in separate containers/nodes with no access to the main database except a narrow write API; no cloud metadata endpoint access (block 169.254.169.254 and IMDS); egress allowed to the internet but denied to private ranges (SSRF guard: reject targets resolving to RFC1918, loopback, link-local, cloud metadata).
- Re-check DNS at connect time to stop DNS rebinding; cap redirects at 5; cap page size and total bytes per scan.
- Browser runs unprivileged with seccomp default profile; containers recycled after every scan; no downloads saved; forms never submitted.
- Respect a published opt-out: sites can request exclusion via a contact address; scans identify themselves in a From-style header with a contact URL.

**Personal data we handle**

| Data | Role | Lawful basis | Retention |
|---|---|---|---|
| DPCO user accounts (name, email, IP) | Controller | Contract | Life of account + 2 years |
| Client contact details entered by DPCOs | Processor for DPCO | DPCO's instruction (DPA) | Until DPCO deletes or contract ends + 30 days |
| Evidence bundles (may contain personal data in captured pages/requests) | Processor for DPCO | DPCO's instruction | 3 years default (audit cycle), configurable |
| Public scan emails and IP hashes | Controller | Consent (lead form) / legitimate interest (abuse prevention) | 180 days |
| Payment records | Controller | Legal obligation (tax) | 6 years |

Documents to publish before launch: privacy notice, cookie notice (we use only strictly necessary cookies plus self-hosted, cookieless analytics such as Plausible), terms of service, data processing agreement for DPCOs, acceptable use policy (scan only clients you are engaged by), responsible disclosure policy.

Our own NDPA obligations: register with the NDPC if we meet the major-importance threshold; appoint a DPO (can be outsourced); keep RoPA for our own processing; breach response runbook with 72-hour NDPC notification path; record the cross-border transfer basis for any non-Nigerian hosting (see Section 14).

Liability language: every pack states it is technical evidence of observed behaviour at a point in time, not a legal opinion; the DPCO remains responsible for the audit conclusion.

## 10. Infrastructure, DevOps and observability

Stage 1 runs on the existing Hostinger KVM 2 VPS (2 vCPU, 8 GB RAM, 100 GB disk, 8 TB bandwidth, paid to Sep 2027) with Docker Compose. Evidence files go to Cloudflare R2, not the VPS disk, so a dead server never loses an audit. Move scan workers to a second VPS once DPCOs are paying.

| Concern | Stage 1 choice | Why |
|---|---|---|
| Compute | Hostinger KVM 2 VPS, Ubuntu 24.04 LTS, Docker Compose | Already paid for; one box is enough for the first season |
| Edge | Cloudflare (DNS, proxy, WAF, Turnstile); origin firewall allows 80/443 from Cloudflare IPs only | Hides the VPS IP, free DDoS protection |
| Reverse proxy / TLS | Caddy (automatic certificates) | Least config |
| Containers | web, api, worker-scan, worker-pack, postgres, redis, caddy | Same images later move to a second box or Kubernetes unchanged |
| Database | PostgreSQL 16 in Docker on a named volume; nightly pg_dump plus WAL archiving with WAL-G to R2 | Point-in-time recovery off-box |
| Queue | Redis 7 (BullMQ), AOF persistence | Simple |
| Object storage | Cloudflare R2 via the S3 API (AWS SDK v3, endpoint swapped); private bucket, pre-signed URLs | S3-compatible, no egress fees, survives VPS loss |
| Email | Resend with React Email templates; SPF, DKIM and DMARC on the sending domain | Fits the Next.js stack; free tier covers Stage 1 volume |
| Secrets | .env files encrypted in the repo with SOPS + age, decrypted only on the VPS at deploy | No plaintext secrets in Git |
| Deploy | GitHub Actions builds images to GHCR, then SSH deploy (docker compose pull && up -d) with a health check and automatic rollback; Kamal or Coolify are later options | Repeatable deploys |
| IaC | Terraform for Cloudflare (DNS, R2, WAF rules); VPS bootstrap with an Ansible playbook or cloud-init script | Rebuildable box |

**Fitting it on 2 vCPU / 8 GB**
- Memory budget: Postgres 1.5 GB, Redis 256 MB, API + web 1 GB, pack worker 512 MB, scan worker capped at 3.5 GB, the rest for the OS.
- Scan worker runs 2 browser pages at a time. A 10-page domain is about 30 page loads (3 consent states), roughly 4–5 minutes, so about 24 scans an hour, far above the 50 packs needed this season.
- CPU limits in Compose so a heavy page cannot starve Postgres or the API.
- Disk: a scan writes 50–150 MB of screenshots and HAR files. Workers upload to R2 and delete local copies straight away; local disk keeps only the database and logs. Alert at 70% disk.

**Isolating the scan worker on a shared box**
- Own Docker network; no access to the Postgres or Redis ports. It reads jobs and writes results through a small internal API with a scoped token.
- Egress rules in the DOCKER-USER iptables chain block private ranges (10/8, 172.16/12, 192.168/16, 127/8, 169.254/16) and the host IP, as a second layer behind the app-level SSRF guard.
- Runs as a non-root user, read-only root filesystem, temp directory on tmpfs, browser restarted after every scan.

**Observability**
- Sentry (free tier) for frontend and backend errors.
- Uptime Kuma or Better Stack for uptime and alerts to email and WhatsApp/Telegram.
- Structured JSON logs with request, org and scan IDs; Grafana Cloud free tier (Loki + Prometheus via Alloy) when log volume needs search.
- Alerts: scan success under 90% over an hour, queue wait p95 over 10 minutes, API 5xx over 1%, disk over 70%, backup job failed.

**Backups and recovery:** database PITR to R2 (RPO about 5 minutes); evidence already lives in R2; restore drill into a local Docker environment monthly; full rebuild of the VPS from the bootstrap script and backups in under 4 hours.

**When to move off one VPS:** queue wait p95 over 10 minutes, more than 20 scans a day sustained, disk or CPU over 70% for a week, or a client asking for a stronger hosting answer. First step is a second VPS just for scan workers.

**Monthly running cost (estimate):** VPS already paid; R2 a few dollars at Stage 1 volumes; Resend and Sentry free tiers; LLM classifier usage roughly $5–20 depending on volume.

## 11. Non-functional requirements

Targets are sized for about 50 DPCOs and 2,000 scans per CAR season, with headroom to 10×.

| Area | Requirement |
|---|---|
| Availability | 99.5% monthly for app and API (Jan–May); scans may queue during incidents but never lose state |
| API latency | p95 < 300 ms for reads, < 800 ms for writes (excluding scan execution) |
| Scan time | p95 < 5 min for a 10-page domain, < 12 min for 25 pages |
| Throughput | 20 concurrent scans at peak; queue drains 200 scans in < 2 h |
| Pack generation | PDF < 60 s after checks finish; PDF < 15 MB, bundle < 250 MB |
| Reproducibility | Same evidence bundle → identical findings (100% in golden tests) |
| Accuracy | False-positive rate < 2% on the labelled test set; every critical check has a manual verification procedure |
| Accessibility | WCAG 2.1 AA for the web app; PDFs tagged with headings and alt text |
| Browser support | Last 2 versions of Chrome, Edge, Safari, Firefox; usable on 1280px laptops; read-only usable on mobile |
| Connectivity | Usable on slow Nigerian connections: initial JS < 250 KB gzipped, uploads resumable, SSE falls back to polling |
| Localisation | English; Naira currency; Africa/Lagos timezone; dates as 20 Nov 2026 |
| Data portability | Org Owner can export all clients, findings and packs as a ZIP at any time |

**Recommended app stack (fits your skills):** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui for the web; NestJS + Prisma (or Drizzle) for the API; Better Auth (or equivalent maintained library) with its organisation and two-factor plugins rather than hand-rolled auth; BullMQ workers in Node with Playwright; React-PDF or Playwright print-to-PDF from an HTML template for packs; Zod schemas shared between web, API and workers in a pnpm/Turborepo monorepo.

## 12. Testing and QA

Accuracy is the product, so the test suite centres on a labelled fixtures site where the right answer for every check is known in advance.

- **Fixtures site.** A small site deployed in staging with deliberate pass/fail variants per check: pre-consent Meta Pixel, broken reject button, pre-ticked box, HTTP form, missing policy sections, PII in query strings, session replay script. Each variant has an expected-findings file.
- **Golden tests.** Stored evidence bundles re-run through checks on every PR; any change in findings fails CI unless the check version is bumped.
- **Real-world validation set.** 300 public Nigerian websites (insurance, banking, betting, fintech) scanned; a sample of 50 hand-labelled; target false-positive rate < 2% before outreach.
- **Legal review.** One DPO or data-protection lawyer reviews the check catalogue, legal references and 20 sample findings; sign-off is a launch gate.
- **Unit and integration.** Jest/Vitest for services; Testcontainers for Postgres/Redis; contract tests for the scan job and webhook payloads.
- **Tenant isolation tests.** For every endpoint, a test user from org B attempts org A's resources and must get 404.
- **End-to-end.** Playwright tests for sign-up → verify → MFA → create client → attest → scan → pack download → re-scan diff → purchase credits (Paystack test mode).
- **Security testing.** OWASP ZAP baseline in CI against staging; manual pentest checklist for auth, IDOR, SSRF in workers before launch; external pentest when revenue allows.
- **Load test.** k6: 20 concurrent scans + 100 concurrent web users on staging before January.
- **Pack review.** Every PDF template change reviewed visually against three reference packs (clean site, average site, terrible site).

## 13. Milestones and delivery plan

P0 ships by 11 January 2027, leaving about 11 weeks of selling before the 31 March CAR deadline. Soft outreach starts mid-December with a hand-reviewed sample pack, so sales do not wait for the full build.

**Exit criteria per milestone**

| Milestone | Done when |
|---|---|
| Foundations | Monorepo, Terraform for staging, sign-up / verify / MFA / orgs / roles working end to end, RLS tenant tests green |
| Scan engine + checks | Three consent states captured on the fixtures site; C-01 to C-20 pass golden tests |
| Sample pack + legal review | One polished pack on a public insurance website; reviewer signs off catalogue and 20 findings |
| Evidence pack + data flows | PDF, JSON, ZIP bundle, signed manifest and verify page work; data-flow map rendered |
| 300-site sweep | Insurance sector report published; false-positive rate under 2% on 50 labelled sites |
| Billing, admin, free scanner | Paystack test and live payments, credit ledger, invoices, licence queue, public scan with Turnstile |
| Security gate + launch | ZAP baseline clean, SSRF and IDOR checks passed, privacy notice / terms / DPA published, prod deployed |
| DPCO outreach | 40 DPCOs contacted, at least 15 demos, at least 5 deposits by 31 January |
| CAR season | 5 paying DPCOs and 50 paid packs by 31 March |

Capacity assumption: about 20 build hours a week alongside ZGIC and other roles, with the Christmas break used as the main build window. If a milestone slips by more than a week, cut P1 items and run packs in concierge mode rather than moving the launch date.

## 14. Risks and open questions

The biggest technical risk is accuracy (one wrong finding in front of a lawyer loses the DPCO); the biggest business risk is building all of this before anyone pays.

| Risk | Impact | Mitigation |
|---|---|---|
| Scope too big for one engineer before CAR season | Miss the January sales window | Concierge mode: run first 10 DPCOs' packs through admin tools while self-serve UI is finished; P1 items slip, P0 do not |
| False positives in front of lawyers | Lost trust, churn | Fixtures + golden tests, legal sign-off gate, "needs-review" status, analyst override |
| Sites block headless browsers (Cloudflare, bot walls) | Failed scans | Clear failure reason, no credit spent, client-provided allow-list instructions; stealth evasion is out of scope |
| Banner detection misses custom CMPs | Wrong consent-state results | Heuristic + manual "point at the reject button" fallback in Stage 1.1 |
| Security breach of evidence or accounts | Company-ending | Section 9 controls; launch gate on tenant tests and SSRF guard |
| Asiri or others add scanning | Price pressure | Integrate (export into their workspaces), compete on depth and per-pack pricing |
| NDPC changes CAR rules or deadlines | Demand shifts | Monitoring and remediation reports keep value outside the deadline |
| Time conflict with ZGIC and other roles | Slips | Fixed weekly build hours; cut P1 aggressively |

**Open questions**
- [ ] Legal reviewer: who signs off the check catalogue and legal references, and by when?
- [ ] Hosting: which country is the Hostinger VPS in, and where is the R2 bucket? Record the NDPA cross-border transfer basis for both in our privacy notice and DPA.
- [ ] Does NDPC publish the DPCO register in a form we can check licence numbers against, or is verification manual by phone/email?
- [ ] Pricing: confirm ₦100k per pack in DPCO conversations before building bundle tiers.
- [ ] Should packs also map findings to the GAID CAR template field by field? Need a copy of the current template.
- [ ] Company entity: register before taking payments (CAC business name vs Ltd) and open a Paystack business account.
- [ ] Scanner identification: publish a /scanner page and opt-out address before the 300-site sweep.
