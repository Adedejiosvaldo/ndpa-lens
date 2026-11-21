import { evaluatePolicyClausesByRules, isNonEssentialCookie } from "@ndpa/scan-engine";
import { classifyHost } from "@ndpa/vendors";
import { type CheckDef, desktop, evidenceFor, home, inState, list, nonEssentialRequests, uniq } from "../core.js";

const NG = "NG";

export const C01: CheckDef = {
  id: "C-01",
  version: "1",
  area: "consent",
  severity: "critical",
  legalRef: "NDPA 2023 s.25–26 (lawful basis, consent). Draft, pending legal review.",
  run(b) {
    const before = inState(b, "none");
    const { hits, unknown } = nonEssentialRequests(before, "initial");
    if (hits.length) {
      const vendors = uniq(hits.map((h) => h.vendor));
      const pages = uniq(hits.map((h) => h.page.pageId));
      return [
        {
          status: "fail",
          title: `${vendors[0]}${vendors.length > 1 ? ` and ${vendors.length - 1} other tracker${vendors.length > 2 ? "s" : ""}` : ""} load before the visitor consents`,
          whyItMatters: "Tracking a visitor before they agree has no lawful basis.",
          explanation: `Before any choice was made, the site contacted ${list(vendors)} on ${pages.length} page${pages.length > 1 ? "s" : ""}.`,
          remediation: "Load analytics, advertising and session-recording tools only after the visitor clicks “Accept”. Most consent tools can hold scripts until then.",
          pageKeys: pages,
          evidence: hits.slice(0, 10).flatMap((h) => evidenceFor(b, h.page, ["har", "screenshot_fold"], h.url)),
        },
      ];
    }
    if (unknown.length) {
      return [
        {
          status: "needs_review",
          title: "Unrecognised third-party scripts load before consent",
          whyItMatters: "If any of these track visitors, they need consent first.",
          explanation: `Scripts from ${list(uniq(unknown.map((u) => u.host)))} loaded before any choice. They are not on our vendor list, so an analyst should confirm what they do.`,
          remediation: "Confirm what each script does. Hold any that track visitors until consent.",
          pageKeys: uniq(unknown.map((u) => u.page.pageId)),
          evidence: unknown.slice(0, 10).flatMap((u) => evidenceFor(b, u.page, ["har"], u.url)),
        },
      ];
    }
    return [pass("No trackers load before consent", "Before any choice, no analytics, advertising or session-recording tools were contacted.", before.map((p) => p.pageId))];
  },
};

export const C02: CheckDef = {
  id: "C-02",
  version: "1",
  area: "consent",
  severity: "critical",
  legalRef: "NDPA 2023 s.26 (consent may be refused). Draft, pending legal review.",
  run(b) {
    const rejected = inState(b, "reject");
    const clicked = rejected.some((p) => p.choice?.clicked);
    if (!clicked) {
      return [
        {
          status: "needs_review",
          title: "We couldn't test what happens after “reject all”",
          whyItMatters: "Refusal has to stop tracking, so this needs a manual check.",
          explanation: "No “reject” control could be clicked on the tested pages.",
          remediation: "Check the banner offers a reject option (see the banner findings), then rescan.",
          pageKeys: rejected.map((p) => p.pageId),
          evidence: rejected.slice(0, 1).flatMap((p) => evidenceFor(b, p, ["screenshot_fold"])),
        },
      ];
    }
    const { hits } = nonEssentialRequests(rejected, "after-choice");
    if (hits.length) {
      const vendors = uniq(hits.map((h) => h.vendor));
      return [
        {
          status: "fail",
          title: `Tracking continues after the visitor clicks “reject all”`,
          whyItMatters: "Ignoring a refusal makes the consent banner meaningless.",
          explanation: `After rejecting and reloading, the site still contacted ${list(vendors)}.`,
          remediation: "Make the reject choice block every non-essential tool, and test it after a reload.",
          pageKeys: uniq(hits.map((h) => h.page.pageId)),
          evidence: hits.slice(0, 10).flatMap((h) => evidenceFor(b, h.page, ["har"], h.url)),
        },
      ];
    }
    return [pass("“Reject all” stops tracking", "After rejecting and reloading, no non-essential tools were contacted.", rejected.map((p) => p.pageId))];
  },
};

export const C03: CheckDef = {
  id: "C-03",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.26; GAID 2025 cookie provisions. Draft, pending legal review.",
  run(b) {
    const h = home(b);
    const anyTrackers = nonEssentialRequests(desktop(b)).hits.length > 0;
    const anyBanner = inState(b, "none").some((p) => p.banner.found);
    if (anyTrackers && !anyBanner) {
      return [
        {
          status: "fail",
          title: "The site uses trackers but shows no consent banner",
          whyItMatters: "Visitors can't agree to, or refuse, tracking they aren't told about.",
          explanation: "Non-essential trackers were found, but no cookie or consent banner appeared on any tested page.",
          remediation: "Add a consent banner that appears on first visit and holds trackers until the visitor chooses.",
          pageKeys: h ? [h.pageId] : [],
          evidence: h ? evidenceFor(b, h, ["screenshot_fold", "dom"]) : [],
        },
      ];
    }
    return [pass(anyBanner ? "A consent banner is shown" : "No banner needed: no trackers found", anyBanner ? "A consent banner appeared on first visit." : "No non-essential trackers were found on any tested page.", h ? [h.pageId] : [])];
  },
};

export const C04: CheckDef = {
  id: "C-04",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.26 (consent must be freely given). Draft, pending legal review.",
  run(b) {
    const h = home(b);
    if (!h?.banner.found) return [pass("No banner to assess", "No consent banner was found, so button prominence doesn't apply.", h ? [h.pageId] : [])];
    const accept = h.banner.buttons.filter((x) => x.role === "accept" && x.visible).sort((a, z) => z.area - a.area)[0];
    const reject = h.banner.buttons.filter((x) => x.role === "reject" && x.visible).sort((a, z) => z.area - a.area)[0];
    const problems: string[] = [];
    if (!reject) problems.push("there is no visible “reject” option on the first layer");
    else if (accept) {
      if (reject.area < accept.area * 0.5) problems.push(`“${reject.label}” is less than half the size of “${accept.label}”`);
      if (reject.fontSize + 2 < accept.fontSize) problems.push(`“${reject.label}” uses smaller text`);
      if (!reject.inViewport && accept.inViewport) problems.push(`“${reject.label}” is off-screen while “${accept.label}” is visible`);
    }
    if (problems.length) {
      return [
        {
          status: "fail",
          title: "Rejecting is harder than accepting",
          whyItMatters: "Consent isn't freely given when refusing takes more effort than agreeing.",
          explanation: `On the homepage banner, ${problems.join("; ")}.`,
          remediation: "Give “Reject all” the same size, colour weight and position as “Accept all”, on the first layer of the banner.",
          pageKeys: [h.pageId],
          evidence: evidenceFor(b, h, ["screenshot_fold", "dom"], reject?.label ?? accept?.label),
        },
      ];
    }
    return [pass("Reject and accept are equally easy", `“${reject!.label}” and “${accept?.label ?? "accept"}” have similar size and placement.`, [h.pageId])];
  },
};

export const C05: CheckDef = {
  id: "C-05",
  version: "1",
  area: "consent",
  severity: "medium",
  legalRef: "GAID 2025 cookie provisions (notice visible on arrival). Draft, pending legal review.",
  run(b) {
    const h = home(b);
    if (!h?.banner.found) return [pass("No banner to assess", "No consent banner was found, so placement doesn't apply.", h ? [h.pageId] : [])];
    if (!h.banner.aboveFold) {
      return [
        {
          status: "fail",
          title: "The consent banner isn't visible when the page opens",
          whyItMatters: "Visitors who don't scroll never see the choice.",
          explanation: "On the homepage, the banner sits below the first screen at 1366×768.",
          remediation: "Fix the banner to the visible part of the screen so it shows on arrival.",
          pageKeys: [h.pageId],
          evidence: evidenceFor(b, h, ["screenshot_fold"]),
        },
      ];
    }
    return [pass("The banner is visible on arrival", "The banner appears within the first screen.", [h.pageId])];
  },
};

export const C06: CheckDef = {
  id: "C-06",
  version: "1",
  area: "consent",
  severity: "high",
  legalRef: "NDPA 2023 s.26. Draft, pending legal review.",
  run(b) {
    const pages = inState(b, "none");
    const bad: Array<{ page: (typeof pages)[number]; name: string; domain: string }> = [];
    for (const p of pages) {
      for (const c of p.cookies) {
        if (!c.setBeforeChoice) continue;
        const vendor = classifyHost(c.domain.replace(/^\./, ""));
        if (isNonEssentialCookie(c.name) || (c.thirdParty && vendor.nonEssential)) bad.push({ page: p, name: c.name, domain: c.domain });
      }
    }
    if (bad.length) {
      const names = uniq(bad.map((x) => x.name));
      return [
        {
          status: "fail",
          title: `Tracking cookies are set before consent (${list(names, 3)})`,
          whyItMatters: "Storing tracking identifiers on a device needs the visitor's consent first.",
          explanation: `Before any choice, the browser received ${names.length} non-essential cookie${names.length > 1 ? "s" : ""}: ${list(names)}.`,
          remediation: "Set analytics and advertising cookies only after the visitor accepts them.",
          pageKeys: uniq(bad.map((x) => x.page.pageId)),
          evidence: bad.slice(0, 10).flatMap((x) => evidenceFor(b, x.page, ["cookies"], `${x.name} (${x.domain})`)),
        },
      ];
    }
    return [pass("No tracking cookies before consent", "Before any choice, only essential cookies were set.", pages.map((p) => p.pageId))];
  },
};

export const C07: CheckDef = {
  id: "C-07",
  version: "1",
  area: "transparency",
  severity: "high",
  legalRef: "NDPA 2023 s.27 (information to data subjects). Draft, pending legal review.",
  run(b) {
    const h = home(b);
    const linked = b.homeLinks.some((l) => /privacy|data[\s_-]?protection/i.test(`${l.text} ${l.href}`));
    if (!linked) {
      return [
        {
          status: "fail",
          title: "The homepage doesn't link to a privacy policy",
          whyItMatters: "Visitors must be able to find how their data is used before they share it.",
          explanation: "No link to a privacy policy or data protection notice was found on the homepage.",
          remediation: "Add a “Privacy policy” link to the homepage, usually in the footer and the main menu.",
          pageKeys: h ? [h.pageId] : [],
          evidence: h ? evidenceFor(b, h, ["dom"]) : [],
        },
      ];
    }
    return [pass("The homepage links to a privacy policy", "A privacy policy link is on the homepage.", h ? [h.pageId] : [])];
  },
};

/** PRD C-08 items mapped to the engine's NDPA clause rules. */
const C08_ITEMS: Array<{ ruleId: string; item: string; fix: string }> = [
  { ruleId: "controller-dpo", item: "who the data controller is", fix: "Name the company that decides how data is used, with its address." },
  { ruleId: "purpose-lawful-basis", item: "why data is used and the lawful basis", fix: "List each purpose and the lawful basis for it (consent, contract, legal obligation…)." },
  { ruleId: "retention-period", item: "how long data is kept", fix: "State how long each kind of data is kept, or how that is decided." },
  { ruleId: "data-subject-rights", item: "the visitor's rights", fix: "List the rights to access, correct, delete, port, object and withdraw consent." },
  { ruleId: "cross-border-transfer", item: "transfers outside Nigeria", fix: "Say whether data leaves Nigeria, where to, and the safeguard relied on." },
  { ruleId: "ndpc-complaint-right", item: "the right to complain to the NDPC", fix: "Tell visitors they can complain to the Nigeria Data Protection Commission." },
];

export const C08: CheckDef = {
  id: "C-08",
  version: "1",
  area: "transparency",
  severity: "medium",
  legalRef: "NDPA 2023 s.27. Draft, pending legal review.",
  run(b) {
    if (!b.policy.found) {
      return [
        {
          status: "needs_review",
          title: "The privacy policy couldn't be read",
          whyItMatters: "Its contents decide whether visitors are properly informed.",
          explanation: b.policy.url ? "A privacy link was found but no readable policy text was captured." : "No privacy policy page was found.",
          remediation: "Publish the privacy policy as a normal web page linked from the homepage.",
          pageKeys: [],
          evidence: [],
        },
      ];
    }
    const policyEv = b.evidence.filter((e) => e.kind === "policy_text").map((e) => ({ kind: "policy_text" as const, sha256: e.sha256 }));
    const clauses = evaluatePolicyClausesByRules(b.policy.text, true);
    return C08_ITEMS.map(({ ruleId, item, fix }) => {
      const c = clauses.find((x) => x.id === ruleId);
      const status = c?.status === "found" ? "pass" : c?.status === "partial" ? "needs_review" : "fail";
      return {
        subId: ruleId,
        status,
        title: status === "pass" ? `The policy explains ${item}` : status === "fail" ? `The privacy policy doesn't explain ${item}` : `The policy only partly explains ${item}`,
        whyItMatters: "Visitors are entitled to this information before their data is collected.",
        explanation: c?.evidence ? `Closest match in the policy: “${c.evidence.slice(0, 200)}”.` : `No wording about ${item} was found in the policy.`,
        remediation: fix,
        pageKeys: [],
        evidence: policyEv.map((e) => ({ ...e, pointer: ruleId })),
      };
    });
  },
};

const DPO_RE = /data\s+protection\s+officer|\bDPO\b/i;
const CONTACT_RE = /[\w.+-]+@[\w-]+(\.[\w-]+)+|\+?234[\s\d-]{7,}|\b0[789]\d[\s\d-]{7,}/;

export const C09: CheckDef = {
  id: "C-09",
  version: "1",
  area: "rights",
  severity: "medium",
  legalRef: "NDPA 2023 s.32 (Data Protection Officer). Draft, pending legal review.",
  run(b) {
    const text = b.policy.text;
    const at = text.search(DPO_RE);
    const nearby = at >= 0 ? text.slice(Math.max(0, at - 200), at + 300) : "";
    if (at >= 0 && CONTACT_RE.test(nearby)) {
      return [pass("A DPO contact is published", "The policy names a Data Protection Officer with contact details.", [])];
    }
    return [
      {
        status: "fail",
        title: "No Data Protection Officer contact is published",
        whyItMatters: "Data subjects and the NDPC need a direct way to reach the DPO.",
        explanation: at >= 0
          ? "The policy mentions a DPO but gives no email or phone number nearby."
          : b.policy.found
            ? "The privacy policy doesn't name a Data Protection Officer."
            : "No privacy policy was found, so no Data Protection Officer contact was published where visitors would look.",
        remediation: "Publish the DPO's name or role with a dedicated email address, such as dpo@yourdomain.ng.",
        pageKeys: [],
        evidence: b.evidence.filter((e) => e.kind === "policy_text").map((e) => ({ kind: "policy_text" as const, sha256: e.sha256 })),
      },
    ];
  },
};

export const C10: CheckDef = {
  id: "C-10",
  version: "1",
  area: "transfers",
  severity: "high",
  legalRef: "NDPA 2023 s.41–43 (cross-border transfers). Draft, pending legal review.",
  run(b) {
    const foreign = b.flows
      .map((f) => {
        const v = classifyHost(f.host);
        // Geolocation of the server first; the vendor's HQ when the address can't be located.
        const country = f.country ?? v.vendor?.hqCountry ?? null;
        return { ...f, country, vendor: v.vendor?.name ?? f.host, essential: v.nonEssential === false };
      })
      .filter((f) => f.country && f.country !== NG && !f.essential);
    if (foreign.length === 0) return [pass("No data goes to non-essential services abroad", "No non-essential third party outside Nigeria was contacted.", [])];
    const clauses = b.policy.found ? evaluatePolicyClausesByRules(b.policy.text, true) : [];
    const transfer = clauses.find((c) => c.id === "cross-border-transfer");
    const countries = uniq(foreign.map((f) => f.country!)).sort();
    if (transfer?.status === "found") {
      return [pass("Transfers abroad are disclosed", `Data goes to ${list(countries)}, and the policy states the basis for transfers outside Nigeria.`, [])];
    }
    return [
      {
        status: "fail",
        title: `Data goes abroad (${list(countries, 3)}) with no stated transfer basis`,
        whyItMatters: "Personal data may leave Nigeria only on a lawful basis that visitors are told about.",
        explanation: `The site sends visitor data to ${list(uniq(foreign.map((f) => f.vendor)))} in ${list(countries)}, but the privacy policy doesn't explain transfers outside Nigeria.`,
        remediation: "State in the policy which countries data goes to and the safeguard relied on (for example adequacy or contractual clauses), or keep the data in Nigeria.",
        pageKeys: [],
        evidence: b.evidence.filter((e) => e.kind === "policy_text").map((e) => ({ kind: "policy_text" as const, sha256: e.sha256, pointer: "cross-border-transfer" })),
      },
    ];
  },
};

function pass(title: string, explanation: string, pageKeys: string[]) {
  return { status: "pass" as const, title, whyItMatters: "Checked and found compliant.", explanation, remediation: "No action needed.", pageKeys, evidence: [] };
}

export const CHECKS_01_10 = [C01, C02, C03, C04, C05, C06, C07, C08, C09, C10];
