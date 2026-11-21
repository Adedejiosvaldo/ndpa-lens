# Design critique: landing page and app screens (21 Nov 2026)

Requested by the owner at Step 10a. The direction under review is "evidence-grade compliance tech", which the owner picked over "paper and serif": white with cool neutrals, an emerald accent, Geist with Geist Mono, and product-UI-led, in the Vanta category without copying Vanta.

**Skills applied:** `frontend-design` (Anthropic), `design-taste-frontend` (Taste), `emil-design-eng`, `vercel-react-best-practices`, `copywriting` (Corey Haines). `build-awwwards-quality-sites` and `redesign-existing-projects` had already been applied.

**Evidence:** screenshots at 1280 px and 390 px of the landing, sign-up, login and 404 pages, plus Security (enrolment), Members, Overview, Audit log and Organisation captured from inside the e2e journey. axe runs on every page.

**Design read (Taste §0.B):** a B2B SaaS landing page for licensed DPCOs (lawyers and advisors), in confident compliance-tech language, built on Tailwind v4, Geist and restrained motion. Dials: variance 6, motion 4, density 4.

## External: landing page

| # | Before | After | Why (skill) |
|---|---|---|---|
| 1 | A mono, uppercase eyebrow over every section (7 of them) | One eyebrow, in the hero only | The most common template tell; at most 1 per 3 sections (Taste §4.7, Frontend Design "template chrome") |
| 2 | "**Prove**" coloured as the one accent word in the H1 | The whole headline in one colour | Accenting a single word is a generated-page tell (Frontend Design) |
| 3 | 21 em dashes across the copy | None. Sentences use commas, colons or full stops | Hard ban (Taste §9.G); no em dashes in short copy (Copywriting) |
| 4 | Hero subtext 45 words, plus a tagline under the CTAs (5 text elements) | Subtext of about 25 words; the "three free packs" line moves to the final CTA | Hero stack is 4 elements at most, subtext about 20 words (Taste §4.7) |
| 5 | 01, 02, 03 markers on the problem list | No numbers; how-it-works keeps 01 to 04 because it really is a sequence | Number only real sequences (Frontend Design) |
| 6 | "What you hand your client" puts the headline left and a paragraph right | Stacked: headline, then body | Split-header ban (Taste §4.7) |
| 7 | Every block fades and rises, and every heading reveals word by word | One orchestrated moment (the hero intro) plus the purposeful how-it-works scrub; the rest is still | Scattered entrances read as AI-generated; motion must be motivated (Frontend Design, Taste §5, Emil "should this animate at all?") |
| 8 | "For DPCO teams" and "Security" both use a 2×2 icon grid | Security becomes a two-column list of statements with no icons | No layout family twice on a page (Taste §4.7) |
| 9 | Four labels for one intent: "Create workspace", "Create your DPCO workspace" ×2, "Start with your next client" | One label everywhere: "Create your workspace" | No duplicate CTA intent (Taste §4.5) |
| 10 | "→" icon appended to CTAs | Label only | Appended arrows are template chrome (Frontend Design) |
| 11 | Hero pack pages overlap and clip text ("NG · necessary" cut off) | Cards re-spaced so nothing is clipped | Static first frame must be complete (Awwwards skill) |
| 12 | Hero pack is a hand-built mock of the product | Kept for now, built from the real design tokens and labelled "Illustrative sample". **[NEED: a real rendered pack page once Step 25 exists]** | Div-built product previews are a tell (Taste §4.8); there's no image tool and no real pack yet, so this is the honest option until then |
| 13 | Many middle-dot strings ("B-01 · CONSENT", "IE · before consent") | Kept only inside the evidence mock (that's data); removed from marketing copy | Middle dots rationed (Taste §9.F) |
| 14 | Inactive consent states dimmed with opacity (2.7:1 and 1.9:1) | **Fixed during review:** inactive items keep full contrast; active gets an accent border and tint | WCAG AA (axe) |
| 15 | Brand link's accessible name didn't match its visible text | **Fixed:** visible "NDPA Lens" is the name | WCAG 2.5.3 (axe) |

**Copy (Copywriting skill):** this is situation B, a real voice with rough execution, so the argument and vocabulary stay and the edits are cuts.
- The headline passes the three-question gate: you can picture it, it's falsifiable, and a generic scanner couldn't claim it.
- "Twenty checks mapped to the NDPA and GAID" is a supportable claim.
- No testimonials, logos or prices are shown. **[NEED: DPCO quotes after soft outreach (Step 11); validated ₦ pricing (PRD §14)]**

## Internal: app screens

| # | Before | After | Why (skill) |
|---|---|---|---|
| 16 | Every section boxed in identical rounded, shadowed cards (Members has three stacked) | Sections divided by headings and hairline rules on the page surface; a card only where it groups an action (the invite form) | The SaaS card kit is a top tell; cards only when elevation means hierarchy (Frontend Design #4, Taste §4.4, Redesign) |
| 17 | "WORKSPACE" mono eyebrow on Overview | Removed | Template chrome (Frontend Design) |
| 18 | Pending invitations joined with " · " in one line | Columns: email, role, expires, action | Structure should carry the information (Frontend Design) |
| 19 | Sessions show a raw user-agent string and a full IPv6 loopback "0000:…:0000" | "Chrome on Windows", plus a compressed IP ("::1") | People manage devices, not UA strings (Frontend Design writing) |
| 20 | `qrcode` (≈14 KB) ships on every visit to Security | Imported only when enrolment starts | `bundle-conditional` (Vercel) |
| 21 | GSAP and Lenis (≈45 KB gzipped) load with the landing page's first JS | Dynamically imported inside the motion effect, after hydration; skipped entirely under reduced motion | `bundle-dynamic-imports`, `bundle-defer-third-party` (Vercel) |
| 22 | `lucide-react` is still a dependency after switching to Solar | Removed | One icon family; no dead dependencies (Taste §3.C) |
| 23 | Button transitions list exact properties at 150 ms ease-out, with `active:scale-[0.98]` | Unchanged | Already matches Emil (exact properties, under 200 ms, press feedback) |
| 24 | Hover styles | Unchanged | Tailwind v4 `hover:` already sits behind `(hover: hover)`, as Emil wants |

**Kept on purpose:** skeleton loaders; error, empty and confirm states naming the item; the visible focus ring; the skip link; and the dark ink panel on auth pages, the one deliberate colour block, allowed once (Taste §4.11).

## Open items for the owner
- The real hero visual should be a rendered pack page (Step 25) or a findings-screen screenshot (Step 23).
- Social proof and pricing stay off the page until there's real evidence.
