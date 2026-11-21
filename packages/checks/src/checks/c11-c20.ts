import { classifyHost } from "@ndpa/vendors";
import { assistedFields, type CheckDef, decidePolicyItem, desktop, evidenceFor, inState, list, uniq } from "../core.js";
import { pass, policyEvidence } from "./c01-c10.js";

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;
const NG_PHONE = /(?:\+?234|\b0)[789][01]\d{8}\b/;
/** Hashed identifiers in the parameters advertising pixels use (Meta em/ph/fn/ln, Google user data…). */
const HASH_PARAM = /(?:^|[?&;])(?:ud\[)?(em|ph|fn|ln|email|phone|e_mail|user_email|sha256_email_address|sha256_phone_number)\]?=([a-f0-9]{64}|[a-f0-9]{32})\b/i;

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " "));
  } catch {
    return s;
  }
}

/** Redact personal data before a request URL is copied into a finding (it goes into packs). */
export function redact(s: string) {
  return safeDecode(s)
    .replace(new RegExp(EMAIL.source, "g"), "[email]")
    .replace(new RegExp(NG_PHONE.source, "g"), "[phone]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[hash]")
    .slice(0, 300);
}

export const C11: CheckDef = {
  id: "C-11",
  version: "1",
  area: "security",
  severity: "critical",
  legalRef: "NDPA 2023 s.24, s.39. Draft, pending legal review.",
  run(b) {
    const hits: Array<{ page: (typeof b.pages)[number]; url: string; host: string; kinds: string[] }> = [];
    for (const p of desktop(b)) {
      for (const r of p.requests) {
        if (!r.thirdParty) continue;
        const text = `${safeDecode(r.url)} ${r.postData ? safeDecode(r.postData) : ""}`;
        const kinds = [EMAIL.test(text) && "email address", NG_PHONE.test(text) && "phone number", HASH_PARAM.test(r.url) || (r.postData && HASH_PARAM.test(r.postData)) ? "hashed identifier" : false].filter(Boolean) as string[];
        if (kinds.length) hits.push({ page: p, url: r.url, host: r.host, kinds });
      }
    }
    if (!hits.length) return [pass("No personal data found in third-party requests", "No email addresses, phone numbers or hashed identifiers were seen in requests to other companies.", desktop(b).map((p) => p.pageId))];
    const vendors = uniq(hits.map((h) => classifyHost(h.host).vendor?.name ?? h.host));
    return [
      {
        status: "fail",
        title: `Personal data is sent to ${list(vendors, 2)} in request URLs`,
        whyItMatters: "Identifiers in tracking requests let third parties tie browsing to a named person.",
        explanation: `Requests to ${list(vendors)} carried a visitor's ${list(uniq(hits.flatMap((h) => h.kinds)))}. Values are redacted here.`,
        remediation: "Remove personal data from pixel and analytics calls. If matching is truly needed, get consent and send it through the vendor's server-side API, not page URLs.",
        pageKeys: uniq(hits.map((h) => h.page.pageId)),
        evidence: hits.slice(0, 10).flatMap((h) => evidenceFor(b, h.page, ["har"], redact(h.url))),
      },
    ];
  },
};

/** Forms that collect personal data, from the first desktop visit to each page. */
function personalForms(b: Parameters<CheckDef["run"]>[0]) {
  const out: Array<{ page: (typeof b.pages)[number]; form: (typeof b.pages)[number]["forms"][number] }> = [];
  for (const p of inState(b, "none")) {
    for (const form of p.forms) {
      const personal = form.fields.filter((f) => f.personal);
      // Sign-in forms re-use data already held; the notice belongs where it was collected.
      const signIn = form.fields.some((f) => f.type === "password") && form.fields.length <= 3;
      if (personal.length && !signIn) out.push({ page: p, form });
    }
  }
  return out;
}

export const C12: CheckDef = {
  id: "C-12",
  version: "1",
  area: "transparency",
  severity: "medium",
  legalRef: "NDPA 2023 s.27. Draft, pending legal review.",
  run(b) {
    const forms = personalForms(b);
    const bad = forms.filter((x) => !x.form.privacyLinkNearSubmit);
    if (!bad.length) return [pass(forms.length ? "Forms link to the privacy notice" : "No forms collect personal data", forms.length ? "Every form that collects personal data has a privacy notice link next to it." : "No forms collecting personal data were found on the tested pages.", uniq(forms.map((x) => x.page.pageId)))];
    return [
      {
        status: "fail",
        title: `${bad.length} form${bad.length > 1 ? "s" : ""} collect personal data with no privacy notice`,
        whyItMatters: "People must be told how their data will be used at the point they hand it over.",
        explanation: `Forms on ${list(uniq(bad.map((x) => new URL(x.page.finalUrl).pathname)))} ask for ${list(uniq(bad.flatMap((x) => x.form.fields.filter((f) => f.personal).map((f) => f.label || f.name))))} but have no privacy notice link near the submit button.`,
        remediation: "Add a short line by the submit button, such as “See our privacy notice for how we use your data”, linking to the policy.",
        pageKeys: uniq(bad.map((x) => x.page.pageId)),
        evidence: bad.flatMap((x) => evidenceFor(b, x.page, ["dom", "screenshot"], x.form.submitLabel)),
      },
    ];
  },
};

export const C13: CheckDef = {
  id: "C-13",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.26 (consent by clear affirmative action). Draft, pending legal review.",
  run(b) {
    const bad = inState(b, "none").flatMap((p) => p.forms.flatMap((f) => f.checkboxes.filter((c) => c.consentLike && c.checked).map((c) => ({ page: p, label: c.label }))));
    if (!bad.length) return [pass("No pre-ticked consent boxes", "Consent and marketing checkboxes start unticked.", [])];
    return [
      {
        status: "fail",
        title: "Consent or marketing boxes are ticked in advance",
        whyItMatters: "A pre-ticked box isn't consent: the person has to choose it themselves.",
        explanation: `These boxes start ticked: ${list(uniq(bad.map((x) => `“${x.label}”`)))}.`,
        remediation: "Leave every consent and marketing checkbox unticked by default.",
        pageKeys: uniq(bad.map((x) => x.page.pageId)),
        evidence: bad.flatMap((x) => evidenceFor(b, x.page, ["dom", "screenshot"], x.label)),
      },
    ];
  },
};

export const C14: CheckDef = {
  id: "C-14",
  version: "1",
  area: "security",
  severity: "critical",
  legalRef: "NDPA 2023 s.39 (security of processing). Draft, pending legal review.",
  run(b) {
    const forms = personalForms(b);
    const httpForms = forms.filter((x) => x.form.actionScheme === "http");
    const mixed = uniq(forms.map((x) => x.page)).filter((p) => p.mixedContent.length > 0);
    if (!httpForms.length && !mixed.length) return [pass("Forms submit securely", "Forms collecting personal data post over HTTPS, with no insecure content on their pages.", uniq(forms.map((x) => x.page.pageId)))];
    const problems = [
      ...httpForms.map((x) => `the form on ${new URL(x.page.finalUrl).pathname} posts to an unencrypted http:// address`),
      ...mixed.map((p) => `${new URL(p.finalUrl).pathname} loads ${p.mixedContent.length} insecure (http://) resource${p.mixedContent.length > 1 ? "s" : ""}`),
    ];
    return [
      {
        status: "fail",
        title: "Personal data can be sent unencrypted",
        whyItMatters: "Data sent over plain HTTP can be read or changed by anyone on the network.",
        explanation: `${problems.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
        remediation: "Make every form post to an https:// address and serve all page resources over HTTPS.",
        pageKeys: uniq([...httpForms.map((x) => x.page.pageId), ...mixed.map((p) => p.pageId)]),
        evidence: [...httpForms.flatMap((x) => evidenceFor(b, x.page, ["dom"], x.form.action)), ...mixed.flatMap((p) => evidenceFor(b, p, ["har"], p.mixedContent[0]))],
      },
    ];
  },
};

const headerEvidence = (b: Parameters<CheckDef["run"]>[0], pointer?: string) =>
  b.evidence.filter((e) => e.kind === "preflight").map((e) => ({ kind: "headers" as const, sha256: e.sha256, ...(pointer ? { pointer } : {}) }));

export const C15: CheckDef = {
  id: "C-15",
  version: "1",
  area: "security",
  severity: "medium",
  legalRef: "NDPA 2023 s.39. Draft, pending legal review.",
  run(b) {
    const pf = b.preflight;
    const https = new URL(pf.finalUrl).protocol === "https:";
    const hsts = pf.headers["strict-transport-security"];
    const maxAge = Number(/max-age=(\d+)/i.exec(hsts ?? "")?.[1] ?? 0);
    const problems: string[] = [];
    if (!https) problems.push("the site is served over plain HTTP");
    if (pf.httpRedirectsToHttps === false) problems.push("http:// addresses don't redirect to https://");
    if (https && !hsts) problems.push("there's no Strict-Transport-Security header");
    else if (https && maxAge < 15_552_000) problems.push(`the Strict-Transport-Security max-age is short (${maxAge} seconds; 180 days or more is usual)`);
    if (!problems.length) return [pass("HTTPS is enforced", "The site uses HTTPS and tells browsers to keep using it (HSTS).", [])];
    return [
      {
        status: "fail",
        title: https ? "Browsers aren't told to always use HTTPS" : "The site doesn't use HTTPS",
        whyItMatters: "Without enforced HTTPS, visitors can be silently moved to an unencrypted connection.",
        explanation: `${problems.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
        remediation: "Redirect all http:// traffic to https:// and send “Strict-Transport-Security: max-age=31536000; includeSubDomains”.",
        pageKeys: [],
        evidence: headerEvidence(b, "strict-transport-security"),
      },
    ];
  },
};

const HEADERS: Array<{ subId: string; name: string; present: (h: Record<string, string>) => boolean; fix: string; why: string }> = [
  { subId: "csp", name: "Content-Security-Policy", present: (h) => !!h["content-security-policy"], fix: "Add a Content-Security-Policy that limits where scripts can load from.", why: "It limits the damage of injected scripts that could read form data." },
  {
    subId: "frame",
    name: "X-Frame-Options or CSP frame-ancestors",
    present: (h) => !!h["x-frame-options"] || /frame-ancestors/i.test(h["content-security-policy"] ?? ""),
    fix: "Send “X-Frame-Options: DENY” or a CSP “frame-ancestors 'none'” directive.",
    why: "It stops other sites framing yours to trick visitors into clicks (clickjacking).",
  },
  { subId: "nosniff", name: "X-Content-Type-Options", present: (h) => /nosniff/i.test(h["x-content-type-options"] ?? ""), fix: "Send “X-Content-Type-Options: nosniff”.", why: "It stops browsers treating uploaded files as runnable code." },
  { subId: "referrer", name: "Referrer-Policy", present: (h) => !!h["referrer-policy"], fix: "Send “Referrer-Policy: strict-origin-when-cross-origin”.", why: "It stops full page addresses, which can contain personal data, leaking to other sites." },
];

export const C16: CheckDef = {
  id: "C-16",
  version: "1",
  area: "security",
  severity: "low",
  legalRef: "NDPA 2023 s.39. Draft, pending legal review.",
  run(b) {
    if (!b.preflight.reachable) {
      return [{ status: "needs_review", title: "Security headers couldn't be read", whyItMatters: "They protect visitors' data in the browser.", explanation: "The first request to the site didn't return a response we could read.", remediation: "Rescan, or check the headers by hand.", pageKeys: [], evidence: headerEvidence(b) }];
    }
    return HEADERS.map((h) =>
      h.present(b.preflight.headers)
        ? { ...pass(`${h.name} is set`, `The homepage sends ${h.name}.`, []), subId: h.subId }
        : {
            subId: h.subId,
            status: "fail" as const,
            title: `${h.name} is missing`,
            whyItMatters: h.why,
            explanation: `The homepage response has no ${h.name} header.`,
            remediation: h.fix,
            pageKeys: [],
            evidence: headerEvidence(b, h.subId),
          },
    );
  },
};

export const C17: CheckDef = {
  id: "C-17",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.26. Draft, pending legal review.",
  run(b) {
    const hits: Array<{ page: (typeof b.pages)[number]; url: string; vendor: string; when: string }> = [];
    for (const p of desktop(b)) {
      if (p.consentState === "accept") continue;
      for (const r of p.requests) {
        if (p.consentState === "reject" && r.phase !== "after-choice") continue;
        const c = classifyHost(r.host);
        if (c.vendor?.category === "session_replay") hits.push({ page: p, url: r.url, vendor: c.vendor.name, when: p.consentState === "none" ? "before any choice" : "after “reject”" });
      }
    }
    if (!hits.length) return [pass("No session recording without consent", "No session-replay or heatmap tool ran before consent or after rejection.", [])];
    const vendors = uniq(hits.map((h) => h.vendor));
    return [
      {
        status: "fail",
        title: `${list(vendors, 2)} records visitor sessions without consent`,
        whyItMatters: "Session recording captures what people type and click, so it needs their agreement first.",
        explanation: `${list(vendors)} ran ${list(uniq(hits.map((h) => h.when)), 2)}.`,
        remediation: "Load session-recording and heatmap tools only after the visitor accepts them, and stop them on rejection.",
        pageKeys: uniq(hits.map((h) => h.page.pageId)),
        evidence: hits.slice(0, 10).flatMap((h) => evidenceFor(b, h.page, ["har"], h.url)),
      },
    ];
  },
};

const RIGHTS_RE = /\b(your\s+rights|data\s+subject|right\s+to\s+(access|request|erasure|rectif|object|port)|rights\s+request|exercise\s+(any\s+of\s+)?(these|your)\s+rights)/gi;
const CHANNEL_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+|\b(request|rights?|contact|enquiry)\s+(form|portal|page)\b|\bwrite\s+to\s+us\b|\+?234[\s\d-]{7,}/i;
const RIGHTS_LINK = /rights|data[\s_-]?(subject[\s_-]?)?request|\bdsar\b|subject[\s_-]?access/i;

export const C18: CheckDef = {
  id: "C-18",
  version: "1",
  area: "rights",
  severity: "medium",
  legalRef: "NDPA 2023 s.34–38 (data subject rights). Draft, pending legal review.",
  run(b, ctx) {
    const text = b.policy.text;
    // A channel stated in the rights section itself, or a dedicated rights page.
    let found = b.homeLinks.some((l) => RIGHTS_LINK.test(`${l.text} ${l.href}`) && !/copyright|all rights reserved/i.test(l.text));
    for (const m of text.matchAll(RIGHTS_RE)) {
      if (found) break;
      if (CHANNEL_RE.test(text.slice(m.index, m.index + 400))) found = true;
    }
    const anyRights = RIGHTS_RE.test(text);
    RIGHTS_RE.lastIndex = 0;
    const { status, item } = b.policy.found ? decidePolicyItem(found ? "found" : anyRights ? "partial" : "missing", ctx, "rights-channel") : { status: found ? ("pass" as const) : ("fail" as const), item: null };
    const a = assistedFields(ctx, item);
    const base = { pageKeys: [] as string[], ...(a.assisted ? { assisted: a.assisted } : {}) };
    if (status === "pass") return [{ ...pass("A rights request channel is published", item?.quote ? `The policy says: “${item.quote.slice(0, 200)}”.` : "The policy tells people where to send a rights request.", []), ...base, evidence: [...policyEvidence(b), ...a.evidence] }];
    return [
      {
        ...base,
        status,
        title: status === "fail" ? "People aren't told how to make a rights request" : "Check how people make a rights request",
        whyItMatters: "Rights to access, correct or delete data only work if people know where to ask.",
        explanation:
          status === "fail"
            ? b.policy.found
              ? "The privacy policy lists rights (or none) but gives no email, form or address for requests."
              : "No privacy policy was found, and no rights request page is linked from the homepage."
            : "The policy mentions rights, but we couldn't confirm where to send a request.",
        remediation: "Say in the policy exactly how to make a request, for example “email privacy@yourdomain.ng” or a link to a request form, and how quickly you'll respond.",
        evidence: [...policyEvidence(b, "rights-channel"), ...a.evidence],
      },
    ];
  },
};

export const C19: CheckDef = {
  id: "C-19",
  version: "1",
  area: "security",
  severity: "high",
  legalRef: "NDPA 2023 s.39. Draft, pending legal review.",
  run(b) {
    const { tls, finalUrl } = b.preflight;
    if (new URL(finalUrl).protocol !== "https:") return [pass("Not applicable: no HTTPS", "The site doesn't use HTTPS; see the HTTPS finding.", [])];
    const problems: string[] = [];
    if (tls.daysToExpiry !== null && tls.daysToExpiry < 0) problems.push(`the certificate expired ${-tls.daysToExpiry} day${tls.daysToExpiry === -1 ? "" : "s"} ago`);
    else if (!tls.authorized && tls.authorizationError) problems.push(`browsers don't trust the certificate (${tls.authorizationError})`);
    if (tls.protocol && /^(SSLv|TLSv1(\.[01])?$)/.test(tls.protocol)) problems.push(`the connection uses ${tls.protocol}, below TLS 1.2`);
    if (!problems.length) return [pass("TLS is valid and current", `${tls.protocol ?? "TLS"} with a trusted certificate valid for ${tls.daysToExpiry} more days.`, [])];
    return [
      {
        status: "fail",
        title: tls.daysToExpiry !== null && tls.daysToExpiry < 0 ? "The HTTPS certificate has expired" : "The HTTPS connection is weak or untrusted",
        whyItMatters: "Visitors get security warnings, and their data may not be properly protected in transit.",
        explanation: `${problems.join("; ")}.`.replace(/^./, (c) => c.toUpperCase()),
        remediation: "Renew the certificate (automatic renewal, such as Let's Encrypt, avoids repeats) and disable TLS 1.0 and 1.1.",
        pageKeys: [],
        evidence: b.evidence.filter((e) => e.kind === "preflight").map((e) => ({ kind: "headers" as const, sha256: e.sha256, pointer: "tls" })),
      },
    ];
  },
};

const SENSITIVE = new Set(["login", "account", "checkout"]);

export const C20: CheckDef = {
  id: "C-20",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.24–26. Draft, pending legal review.",
  run(b) {
    const pages = desktop(b).filter((p) => SENSITIVE.has(p.pageType));
    const hits: Array<{ page: (typeof pages)[number]; url: string; vendor: string }> = [];
    for (const p of pages) {
      for (const r of p.requests) {
        const c = classifyHost(r.host);
        if (c.vendor && (c.vendor.category === "advertising" || c.vendor.category === "social")) hits.push({ page: p, url: r.url, vendor: c.vendor.name });
      }
    }
    if (!pages.length) return [pass("No login, account or checkout pages were tested", "None of the tested pages were login, account or checkout pages.", [])];
    if (!hits.length) return [pass("No ad pixels on sensitive pages", "Login, account and checkout pages load no advertising or social pixels.", uniq(pages.map((p) => p.pageId)))];
    const where = uniq(hits.map((h) => new URL(h.page.finalUrl).pathname));
    return [
      {
        status: "fail",
        title: `Advertising pixels run on ${list(where, 2)}`,
        whyItMatters: "On login and payment pages, pixels can pass account and purchase details to ad networks.",
        explanation: `${list(uniq(hits.map((h) => h.vendor)))} loaded on ${list(where)}${hits.every((h) => h.page.consentState === "accept") ? " after the visitor accepted cookies; consent to marketing cookies doesn't cover account or payment pages" : ""}.`,
        remediation: "Remove advertising and social pixels from login, account and checkout pages. Measure conversions server-side with consent instead.",
        pageKeys: uniq(hits.map((h) => h.page.pageId)),
        evidence: hits.slice(0, 10).flatMap((h) => evidenceFor(b, h.page, ["har"], h.url)),
      },
    ];
  },
};

export const CHECKS_11_20 = [C11, C12, C13, C14, C15, C16, C17, C18, C19, C20];
