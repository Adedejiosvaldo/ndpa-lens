import { describe, expect, it } from "vitest";
import {
  ACCEPT_RE,
  checkWebsiteInput,
  detectCmp,
  detectTrackersFromUrls,
  evaluatePolicyClausesByRules,
  getRootDomain,
  inspectDomContent,
  isNonEssentialCookie,
  isPrivateAddress,
  looksBlocked,
  NDPA_CLAUSE_RULES,
  normalizeTargetUrl,
  pickSubpages,
  REJECT_RE,
  ScanAbort,
} from "../src/index.js";

describe("net-guard", () => {
  it("treats private, loopback, link-local and metadata addresses as private", () => {
    for (const ip of ["10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "127.0.0.1", "169.254.169.254", "0.0.0.0", "::1", "fc00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ["8.8.8.8", "102.89.4.10", "172.32.0.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it("normalises targets and refuses credentials, odd ports and other schemes", () => {
    expect(normalizeTargetUrl("harbour.ng")).toBe("https://harbour.ng/");
    expect(() => normalizeTargetUrl("https://u:p@harbour.ng")).toThrow(ScanAbort);
    expect(() => normalizeTargetUrl("https://harbour.ng:8080")).toThrow(/standard web ports/);
    expect(() => normalizeTargetUrl("")).toThrow(ScanAbort);
  });

  it("refuses non-http schemes up front (tracker 14a, fixed in Step 15)", () => {
    expect(() => normalizeTargetUrl("ftp://harbour.ng")).toThrow(ScanAbort);
  });
});

describe("url-check (browser-safe)", () => {
  it("explains common typing mistakes", () => {
    expect(checkWebsiteInput("harbour.ng")).toEqual({ ok: true, url: expect.stringContaining("harbour.ng") });
    expect(checkWebsiteInput("")).toMatchObject({ ok: false });
    expect(checkWebsiteInput("info@harbour.ng")).toMatchObject({ ok: false, message: expect.stringMatching(/email/) });
    expect(checkWebsiteInput("https//harbour.ng")).toMatchObject({ ok: false });
    expect(checkWebsiteInput("harbour .ng")).toMatchObject({ ok: false, message: expect.stringMatching(/spaces/) });
  });
});

describe("trackers", () => {
  it("detects known trackers from request URLs", () => {
    const names = detectTrackersFromUrls([
      "https://connect.facebook.net/en_US/fbevents.js",
      "https://www.google-analytics.com/g/collect?v=2",
      "https://static.hotjar.com/c/hotjar-123.js",
      "https://harbour.ng/app.js",
    ]).map((t) => t.name);
    expect(names.length).toBeGreaterThanOrEqual(3);
    expect(names.join(" ")).toMatch(/Meta|Facebook/);
    expect(names.join(" ")).toMatch(/Google/);
    expect(names.join(" ")).toMatch(/Hotjar/);
  });

  it("knows root domains, CMPs and non-essential cookies", () => {
    expect(getRootDomain("www.shop.harbour.ng")).toBe("harbour.ng");
    expect(getRootDomain("app.harbour.com.ng")).toBe("harbour.com.ng");
    expect(detectCmp('<div id="onetrust-banner-sdk"></div>')).toBe("OneTrust");
    expect(detectCmp('<script src="https://consent.cookiebot.com/uc.js"></script>')).toBe("Cookiebot");
    expect(isNonEssentialCookie("_ga")).toBe(true);
    expect(isNonEssentialCookie("_fbp")).toBe(true);
    expect(isNonEssentialCookie("PHPSESSID")).toBe(false);
  });
});

it("detects OneTrust from its standard loader script (tracker 14a, fixed in Step 17)", () => {
  expect(detectCmp('<script src="https://cdn.cookielaw.org/scripttemplates/otSDKStub.js"></script>')).toBe("OneTrust");
});

describe("page-inspect", () => {
  it("recognises reject and accept button wording", () => {
    for (const s of ["Reject all", "Decline", "Only necessary", "Refuse"]) expect(REJECT_RE.test(s), s).toBe(true);
    for (const s of ["Accept all", "Allow cookies", "I agree", "Got it"]) expect(ACCEPT_RE.test(s), s).toBe(true);
  });

  it("spots bot walls but not ordinary pages", () => {
    expect(looksBlocked("Just a moment...", "<html></html>")).toBe(true);
    expect(looksBlocked("Home", "<p>x</p>", 403)).toBe(true);
    expect(looksBlocked("Harbour Assurance", `<main>${"Insurance you can trust. ".repeat(200)}</main>`, 200)).toBe(false);
  });

  it("picks data-collection pages first, same site only", () => {
    const picked = pickSubpages(
      [
        { href: "https://harbour.ng/about", text: "About us" },
        { href: "https://harbour.ng/get-a-quote", text: "Get started" },
        { href: "https://www.harbour.ng/login", text: "Log in" },
        { href: "https://harbour.ng/contact", text: "Contact" },
        { href: "https://evil.test/signup", text: "Sign up" },
        { href: "https://harbour.ng/brochure.pdf", text: "Brochure" },
      ],
      "https://harbour.ng/",
      undefined,
      4,
    );
    expect(picked.map((p) => p.kind)).toEqual(["signup", "login", "contact", "other"]);
    expect(picked.some((p) => p.url.includes("evil.test") || p.url.endsWith(".pdf"))).toBe(false);
  });

  it("finds forms, consent boxes and the privacy link", () => {
    const html = `<html><body><a href="/privacy-policy">Privacy policy</a>
      <form action="http://harbour.ng/subscribe"><input type="email" name="email"><input type="checkbox" checked> Send me offers<button>Join</button></form></body></html>`;
    const d = inspectDomContent(html, "https://harbour.ng/", "https://harbour.ng/");
    expect(JSON.stringify(d)).toMatch(/privacy-policy/);
    expect(d.forms.length).toBe(1);
  });
});

describe("policy rules", () => {
  it("marks every clause unavailable when there is no policy", () => {
    const r = evaluatePolicyClausesByRules("", false);
    expect(r).toHaveLength(NDPA_CLAUSE_RULES.length);
    expect(r.every((c) => c.status === "unavailable")).toBe(true);
  });

  it("finds disclosures in a real-looking policy", () => {
    const text = `Harbour Assurance Plc is the data controller. Contact our Data Protection Officer at dpo@harbour.ng.
      We process personal data to provide insurance cover, on the lawful basis of contract and legal obligation under the Nigeria Data Protection Act 2023.
      We retain policy records for six years. You have the right to access, rectify, erase and port your data, and to object.
      You may lodge a complaint with the Nigeria Data Protection Commission. We transfer data outside Nigeria only with adequate safeguards.`;
    const r = evaluatePolicyClausesByRules(text, true);
    const found = r.filter((c) => c.status === "found").length;
    expect(found).toBeGreaterThanOrEqual(4);
  });
});

describe("retention rule", () => {
  it("accepts a stated period and rejects a bare promise", async () => {
    const { evaluatePolicyClausesByRules } = await import("../src/policy-analyzer.js");
    const pad = " We are committed to protecting the privacy of everyone who uses our services and visits this website.".repeat(2);
    const status = (t: string) => evaluatePolicyClausesByRules(t + pad, true).find((c) => c.id === "retention-period")!.status;
    expect(status("We retain policy records for six years after the policy ends.")).toBe("found");
    expect(status("We keep your account data for 24 months.")).toBe("found");
    expect(status("We keep your information safe.")).toBe("missing");
  });
});

describe("cookie classification (PRD §5.3)", () => {
  it("separates known tracking, essential and unknown cookies", async () => {
    const { classifyCookie } = await import("../src/trackers.js");
    for (const n of ["_ga", "_ga_ABC123", "_gid", "_fbp", "fr", "_hjSessionUser_1", "_clck", "IDE", "_gcl_au", "_ttp"]) expect(classifyCookie(n), n).toBe("tracking");
    for (const n of ["PHPSESSID", "_GRECAPTCHA", "cf_clearance", "cmplz_consented_services", "XSRF-TOKEN"]) expect(classifyCookie(n), n).toBe("essential");
    for (const n of ["ays_show_popup_only_once_2", "wp_theme_pref", "frankly"]) expect(classifyCookie(n), n).toBe("unknown");
  });
});
