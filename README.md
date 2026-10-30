# NDPA Lens

NDPA Lens checks how ready a website is for Nigeria's data protection rules: the **Nigeria Data Protection Act 2023 (NDPA)** and the **NDPC's General Application and Implementation Directive 2025 (GAID)**.

Enter a website address. NDPA Lens opens the site in a real browser, the same way a first-time visitor would. It records what the site does with that visitor's data and explains each gap in plain language, with the legal reference and a suggested fix.

It is built for Nigerian businesses, the Data Protection Officers (DPOs) who look after compliance, and the licensed auditors (DPCOs) who prepare yearly audits. A non-lawyer should be able to read a report and know what to fix first.

> **Important:** NDPA Lens is a readiness check, not a compliance audit or legal advice. It only sees what a public website shows. Organisations of Ultra-High and Extra-High Level must file their yearly Compliance Audit Return (CAR) through an NDPC-licensed Data Protection Compliance Organisation (DPCO).

## What it checks

**On the website (automatically)**

- **Cookie banner behaviour.** It checks that a banner appears on first visit and is visible without scrolling. It checks for both Accept and Reject buttons. Then it clicks **Reject**, reloads the page, and confirms that trackers actually stop.
- **Tracking before consent.** It lists the analytics, advertising and session-recording tools, and the non-essential cookies, that load before the visitor makes any choice.
- **More than the homepage.** It also visits sign-up, login, checkout, contact and privacy-policy pages, where personal data is usually collected.
- **The privacy policy.** It checks for the disclosures NDPA s. 27 requires: who the controller is, the DPO contact, purposes and lawful basis, recipients, retention, rights, transfers abroad, and the right to complain to the NDPC. It also flags policies that are copied GDPR templates with no reference to Nigerian law.
- **Forms.** It flags forms that collect personal data without a consent checkbox or a privacy notice link, and consent boxes that come pre-ticked.
- **Security basics.** HTTPS, mixed content, security headers and cookie flags.

**About the organisation (answered by the user)**

- **NDPC tier.** It estimates whether the organisation is Ultra-High, Extra-High or Ordinary-High Level, from its size and sector. It then shows the registration fee, whether a yearly audit is required, and the next deadline.
- **Internal controls checklist.** This plain-language checklist covers consent records, data subject requests, risk assessments (DPIA), breach response, transfers abroad and the record of processing. Items are only ticked automatically when the scan proved them.

**Outputs**

- A website readiness score with pass, warning and fail checks, each with evidence and a fix.
- Evidence for the record: screenshots before and after clicking Reject, and a timed network log.
- Draft documents: a readiness report, a privacy policy, cookie banner code, a consent checkbox, and security header settings.

## Quick start

Requires **Node.js 20+** and **pnpm**. The scanner drives Chrome or Edge if one is installed, otherwise Playwright's bundled Chromium.

```bash
pnpm install
pnpm exec playwright install chromium   # only needed if Chrome/Edge isn't installed
pnpm dev
```

Open http://localhost:3000, enter a website, and click **Run audit**.

For a production build:

```bash
pnpm build
pnpm start
```

## Deploy with Docker

The deploy setup lives in `deploy/` and follows the same layout as azaman-engine. On the VPS, azaman-engine's Caddy (`deploy-caddy-1`) owns ports 80/443 and serves both sites. This app has no Caddy of its own and publishes no host port. It joins Caddy's Docker network (`deploy_default`), and Caddy forwards `lens.taxcafe.pro` to `ndpa-lens:3000`.

On the VPS, from the repo root:

```bash
cp deploy/.env.example deploy/.env   # then set OPENROUTER_API_KEY
docker compose -f deploy/docker-compose.yml up -d --build
```

The `lens.taxcafe.pro` site block lives in azaman-engine's `deploy/Caddyfile`. After changing it, recreate that Caddy (`docker compose -f deploy/docker-compose.yml up -d --force-recreate caddy` in the azaman-engine folder).

- Start azaman-engine first: its network must exist before this app can join it.
- The compose file sets `name: ndpa-lens`. Without it, Docker would name the project after the `deploy` folder and mix it up with azaman-engine's containers.
- Keep the `PLAYWRIGHT_VERSION` build argument in the `Dockerfile` equal to the `playwright` version in `pnpm-lock.yaml`.

## Configuration

Copy `.env.example` to `.env.local`. Every setting is optional.

| Variable | Purpose |
|---|---|
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | Our key for the AI privacy-policy review (one free per person per day). Default model `anthropic/claude-haiku-5.5` (about $0.002 per review). |
| `AI_FREE_PER_PERSON_PER_DAY` | Free AI reviews per person per rolling 24 hours (default `1`). A person is recognised by a cookie and by a hash of IP, browser and language. |
| `AI_FREE_PER_IP_PER_DAY` | Free reviews per IP address (default `20`; mobile networks share IPs). |
| `AI_FREE_TOTAL_PER_DAY` | Free reviews across everyone per day (default `300`, about $0.60/day). This is the hard cap on spend. |
| `PLAYWRIGHT_CHANNEL` | Browser to use (`chrome`, `msedge`). If not set, the scanner tries Chrome, then Edge, then bundled Chromium. |
| `SCAN_RATE_LIMIT` | Scans allowed per visitor every 10 minutes (default `8`). |
| `SCAN_MAX_CONCURRENT` | Scans that can run at the same time (default `2`). |

## Good to know

- **Scans take about 40–90 seconds.** Several pages are visited and the banner is tested twice. Hosts that cut requests off at 60 seconds (for example, Vercel's free plan) may stop long scans. Self-hosting avoids this.
- **Some sites block automated browsers.** If a site shows a bot-protection page, NDPA Lens says so and gives no score, rather than guessing.
- **Location matters.** Scans run from wherever the app is hosted. Some sites show a different cookie banner depending on the visitor's country.
- **What it can't see:** pages behind a login, and internal records such as contracts, risk assessments or breach logs. The organisation questions cover those.
- **Safe to expose:** the scanner refuses private and internal network addresses, including on redirects. It also limits how many scans each visitor can run.

## Project structure

```
src/
  app/                  Next.js app (page, layout) and the /api/scan route
  components/           Landing page, report steps, shared UI
  lib/
    scanner.ts          Runs a scan and scores the checks
    browser-capture.ts  Multi-page crawl, Reject/Accept test, screenshots, network log
    policy-analyzer.ts  Privacy policy clause checks (rules, optional AI)
    gaid-assessment.ts  NDPC tiers, deadlines and the internal checklist
    remediation.ts      Generated documents and the readiness report
    net-guard.ts        Blocks private/internal addresses
    url-check.ts        Validates what the user types in the search bar
    trackers.ts         Tracker, cookie and consent-tool signatures
```

Built with Next.js 15, React 19, TypeScript, Tailwind CSS and Playwright.

## Sources

Legal references were checked against the official texts published by the NDPC (checked 30 October 2026):

- [Nigeria Data Protection Act, 2023](https://ndpc.gov.ng/wp-content/uploads/2024/03/Nigeria_Data_Protection_Act_2023.pdf) (Gazette No. 119, Vol. 110)
- [GAID 2025](https://ndpc.gov.ng/wp-content/uploads/2025/07/NDP-ACT-GAID-2025-MARCH-20TH.pdf) (NDPC/NDP ACT-GAID/01/2025, issued 20 March 2025), including Schedule 7 on tiers and registration fees
- [Guidance Notice on Registration, February 2024](https://ndpc.gov.ng/wp-content/uploads/2024/03/registration.pdf) (replaced by GAID Schedule 7)

The NDPC sometimes moves deadlines (for example, the 2025 returns were extended to 30 May 2026). Always confirm current requirements on [ndpc.gov.ng](https://ndpc.gov.ng) or with a licensed DPCO.
