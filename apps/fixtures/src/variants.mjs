/**
 * Labelled fixture sites (PRD §12). `baseline` is fully compliant; each other
 * variant changes exactly one behaviour so that one check fails. `expect`
 * lists the results the check engine must produce for that variant.
 *
 * Hosts: <id>.fixtures.test. Tracker hosts use real vendor hostnames, mapped
 * to the fixture server by the test browser, so vendor classification is real.
 */

/** @typedef {{
 *   trackerBeforeConsent?: boolean, ignoreReject?: boolean, noBanner?: boolean, rejectHidden?: boolean,
 *   bannerBelowFold?: boolean, cookieBeforeConsent?: boolean, noPolicyLink?: boolean, policyMissing?: boolean,
 *   noDpo?: boolean, noTransferBasis?: boolean, piiInRequest?: boolean, formNoNotice?: boolean, preticked?: boolean,
 *   httpForm?: boolean, noHsts?: boolean, noSecurityHeaders?: boolean, replayBeforeConsent?: boolean,
 *   noRightsChannel?: boolean, expiredTls?: boolean, pixelOnCheckout?: boolean,
 * }} Flags */

/** @type {Array<{ id: string, flags: Flags, expect: Record<string, "pass"|"fail"|"needs_review">, note: string }>} */
export const VARIANTS = [
  {
    id: "baseline",
    flags: {},
    note: "Compliant site: equal banner, trackers only after accept, complete policy, safe forms, strong TLS and headers.",
    expect: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`C-${String(i + 1).padStart(2, "0")}`, "pass"])),
  },
  { id: "c01-fail", flags: { trackerBeforeConsent: true }, note: "Meta Pixel and Google Analytics load before any choice.", expect: { "C-01": "fail" } },
  { id: "c02-fail", flags: { ignoreReject: true }, note: "Trackers still load after “reject all”.", expect: { "C-02": "fail" } },
  { id: "c03-fail", flags: { noBanner: true, trackerBeforeConsent: true }, note: "Trackers run and there is no consent banner.", expect: { "C-03": "fail" } },
  { id: "c04-fail", flags: { rejectHidden: true }, note: "Big “Accept all” button; reject is a tiny text link.", expect: { "C-04": "fail" } },
  { id: "c05-fail", flags: { bannerBelowFold: true }, note: "The banner sits at the end of a long page, below the fold.", expect: { "C-05": "fail" } },
  { id: "c06-fail", flags: { cookieBeforeConsent: true }, note: "A Google Analytics _ga cookie is set before any choice.", expect: { "C-06": "fail" } },
  { id: "c07-fail", flags: { noPolicyLink: true }, note: "No privacy policy link on the homepage.", expect: { "C-07": "fail" } },
  { id: "c08-fail", flags: { policyMissing: true }, note: "The privacy policy is a one-paragraph stub.", expect: { "C-08": "fail" } },
  { id: "c09-fail", flags: { noDpo: true }, note: "The policy names no Data Protection Officer contact.", expect: { "C-09": "fail" } },
  { id: "c10-fail", flags: { noTransferBasis: true }, note: "Data goes to US and Irish vendors; the policy says nothing about transfers abroad.", expect: { "C-10": "fail" } },
  { id: "c11-fail", flags: { piiInRequest: true }, note: "The Meta Pixel request carries the visitor's email in its URL.", expect: { "C-11": "fail" } },
  { id: "c12-fail", flags: { formNoNotice: true }, note: "The sign-up form has no privacy notice link.", expect: { "C-12": "fail" } },
  { id: "c13-fail", flags: { preticked: true }, note: "The marketing box is ticked by default.", expect: { "C-13": "fail" } },
  { id: "c14-fail", flags: { httpForm: true }, note: "The sign-up form posts to an http:// address.", expect: { "C-14": "fail" } },
  { id: "c15-fail", flags: { noHsts: true }, note: "No Strict-Transport-Security header.", expect: { "C-15": "fail" } },
  { id: "c16-fail", flags: { noSecurityHeaders: true }, note: "No CSP, X-Frame-Options, X-Content-Type-Options or Referrer-Policy.", expect: { "C-16": "fail" } },
  { id: "c17-fail", flags: { replayBeforeConsent: true }, note: "Hotjar session recording starts before any choice.", expect: { "C-17": "fail" } },
  { id: "c18-fail", flags: { noRightsChannel: true }, note: "The policy gives no way to make a rights request.", expect: { "C-18": "fail" } },
  { id: "c19-fail", flags: { expiredTls: true }, note: "The HTTPS certificate expired.", expect: { "C-19": "fail" } },
  { id: "c20-fail", flags: { pixelOnCheckout: true }, note: "The Meta Pixel runs on the checkout page.", expect: { "C-20": "fail" } },
];

export const TRACKER_HOSTS = ["www.googletagmanager.com", "www.google-analytics.com", "connect.facebook.net", "www.facebook.com", "static.hotjar.com"];

const COMPLETE_POLICY = (f) => `
<h1>Privacy notice</h1>
<p>Harbour Fixtures Ltd (RC 123456), 12 Marina, Lagos, is the data controller for personal data collected on this website.</p>
${f.noDpo ? "" : `<p>Our Data Protection Officer is Ngozi Eze. Contact the DPO at <a href="mailto:dpo@fixtures.test">dpo@fixtures.test</a>.</p>`}
<h2>Why we use your data and our lawful basis</h2>
<p>We process personal data to provide insurance quotes and manage policies, on the lawful basis of contract, legal obligation and, for marketing, your consent, under the Nigeria Data Protection Act 2023.</p>
<h2>Who we share it with</h2><p>We share data with our reinsurers, payment providers and analytics providers acting as processors.</p>
<h2>How long we keep it</h2><p>We retain policy records for six years after the policy ends, then delete them.</p>
${f.noTransferBasis ? "" : `<h2>Transfers outside Nigeria</h2><p>Some providers are in the United States and Ireland. We transfer personal data outside Nigeria only with adequate safeguards, such as standard contractual clauses, as the NDPA requires.</p>`}
<h2>Your rights</h2><p>You have the right to access, rectify, erase and port your data, to object, and to withdraw consent at any time.${f.noRightsChannel ? "" : ` To make a request, email <a href="mailto:privacy@fixtures.test">privacy@fixtures.test</a> or use our <a href="/rights-request">rights request form</a>.`}</p>
<h2>Complaints</h2><p>You may lodge a complaint with the Nigeria Data Protection Commission (NDPC).</p>`;

const STUB_POLICY = `<h1>Privacy</h1><p>We respect your privacy and keep your information safe.</p>`;

const banner = (f) =>
  f.noBanner
    ? ""
    : `<div id="cookie-banner" role="dialog" aria-label="Cookie consent" style="${
        f.bannerBelowFold ? "position:static;margin-top:20px" : "position:fixed;left:0;right:0;bottom:0"
      };padding:20px;background:#fff;border-top:1px solid #ccc;font:16px sans-serif">
  We use cookies and similar tracking technologies to measure visits and show relevant adverts. You can accept or reject non-essential cookies.
  <button id="acc" style="padding:12px 24px;font-size:16px;background:#0a5;color:#fff;border:0">Accept all</button>
  ${f.rejectHidden ? `<a id="rej" href="#" style="font-size:10px;color:#999">reject</a>` : `<button id="rej" style="padding:12px 24px;font-size:16px;background:#0a5;color:#fff;border:0">Reject all</button>`}
</div>`;

/** Consent logic: load trackers only when allowed by the variant. */
const consentScript = (f, page) => `
<script>
  const c = (document.cookie.match(/(?:^|; )consent=(\\w+)/) || [])[1];
  const b = document.getElementById('cookie-banner');
  if (c && b) b.style.display = 'none';
  const add = (src) => { const s = document.createElement('script'); s.src = src; document.head.appendChild(s); };
  const ads = () => {
    add('https://connect.facebook.net/en_US/fbevents.js');
    const em = ${f.piiInRequest ? "'&em=' + encodeURIComponent('ada.obi@example.com')" : "''"};
    new Image().src = 'https://www.facebook.com/tr?id=1234567890&ev=PageView' + em;
  };
  const analytics = () => add('https://www.googletagmanager.com/gtag/js?id=G-FIXTURE');
  const allowed = c === 'accept' || (c === 'reject' && ${!!f.ignoreReject}) || ${!!f.trackerBeforeConsent};
  if (allowed && ${!["checkout", "login"].includes(page) || (page === "checkout" && !!f.pixelOnCheckout)}) { analytics(); ads(); }
  if (${!!f.replayBeforeConsent} || c === 'accept') add('https://static.hotjar.com/c/hotjar-1234.js');
  ${f.cookieBeforeConsent ? "document.cookie = '_ga=GA1.1.123.456; path=/; max-age=63072000';" : ""}
  const set = (v) => (e) => { e && e.preventDefault && e.preventDefault(); document.cookie = 'consent=' + v + '; path=/; max-age=31536000'; if (b) b.style.display = 'none'; };
  const acc = document.getElementById('acc'); if (acc) acc.onclick = set('accept');
  const rej = document.getElementById('rej'); if (rej) rej.onclick = set('reject');
</script>`;

const signupForm = (f) => `
<form action="${f.httpForm ? "http" : "https"}://${"${HOST}"}/signup" method="post">
  <label>Full name <input name="fullname" autocomplete="name"></label>
  <label>Email <input type="email" name="email" autocomplete="email"></label>
  <label>Phone <input type="tel" name="phone" autocomplete="tel"></label>
  <label><input type="checkbox" name="marketing"${f.preticked ? " checked" : ""}> Send me offers and marketing updates</label>
  ${f.formNoNotice ? "" : `<p>See our <a href="/privacy">privacy notice</a> for how we use your data.</p>`}
  <button type="submit">Create account</button>
</form>`;

const layout = (f, page, title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font:16px sans-serif;margin:0;padding:24px">
<nav><a href="/">Home</a> <a href="/signup">Sign up</a> <a href="/login">Log in</a> <a href="/checkout">Checkout</a> <a href="/contact">Contact</a>${
  f.noPolicyLink ? "" : ` <a href="/privacy">Privacy policy</a>`
}</nav>
<main>${body}</main>
${f.bannerBelowFold ? `<div style="height:2400px"></div>` : ""}
${banner(f)}
${consentScript(f, page)}
</body></html>`;

/** Render a page for a variant. Returns null for unknown paths. */
export function render(variantId, path, host) {
  const v = VARIANTS.find((x) => x.id === variantId);
  if (!v) return null;
  const f = v.flags;
  const fill = (html) => html.replaceAll("${HOST}", host);
  switch (path) {
    case "/":
      return fill(layout(f, "home", "Harbour Fixtures", `<h1>Harbour Fixtures</h1><p>Motor and home insurance for Lagos.</p>`));
    case "/privacy":
      return fill(layout(f, "policy", "Privacy notice", f.policyMissing ? STUB_POLICY : COMPLETE_POLICY(f)));
    case "/signup":
      return fill(layout(f, "signup", "Create an account", `<h1>Create an account</h1>${signupForm(f)}`));
    case "/login":
      return fill(layout(f, "login", "Log in", `<h1>Log in</h1><form action="https://${host}/login" method="post"><label>Email <input type="email" name="email"></label><label>Password <input type="password" name="password"></label><button>Log in</button></form>`));
    case "/checkout":
      return fill(layout(f, "checkout", "Checkout", `<h1>Checkout</h1><p>Motor cover, ₦45,000 a year.</p>`));
    case "/contact":
      return fill(layout(f, "contact", "Contact us", `<h1>Contact us</h1><p>Email hello@fixtures.test or call +234 801 234 5678.</p>`));
    default:
      return null;
  }
}

/** Response headers for a variant's pages (C-15, C-16). */
export function headersFor(variantId) {
  const f = VARIANTS.find((x) => x.id === variantId)?.flags ?? {};
  const h = { "content-type": "text/html; charset=utf-8" };
  if (!f.noHsts) h["strict-transport-security"] = "max-age=31536000; includeSubDomains";
  if (!f.noSecurityHeaders) {
    h["content-security-policy"] = "default-src 'self' https: 'unsafe-inline'; frame-ancestors 'none'";
    h["x-frame-options"] = "DENY";
    h["x-content-type-options"] = "nosniff";
    h["referrer-policy"] = "strict-origin-when-cross-origin";
  }
  return h;
}
