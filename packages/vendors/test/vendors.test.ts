import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classifyHost, DBIP_ATTRIBUTION, geoFromReaders, NON_ESSENTIAL, openGeo, VENDOR_LIST_VERSION, VENDORS } from "../src/index.js";

describe("vendor list (FLOW-02, §5.3)", () => {
  it("is well formed: unique ids and hostnames, bare hostnames, ISO countries", () => {
    const ids = new Set<string>();
    const hosts = new Map<string, string>();
    for (const v of VENDORS) {
      expect(ids.has(v.id), v.id).toBe(false);
      ids.add(v.id);
      expect(v.hqCountry, v.id).toMatch(/^[A-Z]{2}$/);
      for (const h of v.hostnames) {
        expect(h, v.id).toMatch(/^([a-z0-9-]+\.)+[a-z]{2,}$/);
        expect(hosts.get(h), `${h} on ${v.id} and ${hosts.get(h)}`).toBeUndefined();
        hosts.set(h, v.id);
      }
    }
    expect(VENDOR_LIST_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
  });

  it("covers the PRD's named vendors and Nigerian payment providers", () => {
    for (const host of ["connect.facebook.net", "www.google-analytics.com", "analytics.tiktok.com", "static.hotjar.com", "www.clarity.ms", "js.paystack.co", "checkout.flutterwave.com", "api.termii.com"]) {
      expect(classifyHost(host).vendor, host).not.toBeNull();
    }
  });

  it("matches subdomains, prefers the longest suffix, and classifies consent needs", () => {
    expect(classifyHost("region1.google-analytics.com").vendor?.id).toBe("google-analytics");
    expect(classifyHost("Static.Hotjar.com.").vendor).toMatchObject({ id: "hotjar", category: "session_replay", hqCountry: "MT" });
    expect(classifyHost("js.paystack.co")).toMatchObject({ nonEssential: false, needsReview: false });
    expect(classifyHost("connect.facebook.net").nonEssential).toBe(true);
    expect(NON_ESSENTIAL.has("cdn")).toBe(false);
  });

  it("flags unknown hosts for review and never assumes they are necessary", () => {
    expect(classifyHost("cdn.unknown-vendor.ng")).toEqual({ host: "cdn.unknown-vendor.ng", vendor: null, needsReview: true, nonEssential: null });
    // A lookalike is not a subdomain.
    expect(classifyHost("notfacebook.net").vendor).toBeNull();
  });
});

describe("GeoIP (FLOW-01)", () => {
  it("maps country and ASN from the readers, null when unknown", () => {
    const geo = geoFromReaders(
      { get: (ip: string) => (ip === "157.240.1.35" ? ({ country: { iso_code: "IE" } } as never) : null) },
      { get: (ip: string) => (ip === "157.240.1.35" ? ({ autonomous_system_number: 32934, autonomous_system_organization: "Facebook, Inc." } as never) : null) },
    );
    expect(geo.lookup("157.240.1.35")).toEqual({ ip: "157.240.1.35", country: "IE", asn: 32934, asOrg: "Facebook, Inc." });
    expect(geo.lookup("10.0.0.1")).toEqual({ ip: "10.0.0.1", country: null, asn: null, asOrg: null });
    expect(geo.attribution).toBe(DBIP_ATTRIBUTION);
  });

  const country = new URL("../data/dbip-country-lite.mmdb", import.meta.url).pathname;
  const asn = new URL("../data/dbip-asn-lite.mmdb", import.meta.url).pathname;
  it.skipIf(!existsSync(country) || !existsSync(asn))("reads the real DB-IP Lite files when present", async () => {
    const geo = await openGeo(country, asn);
    const r = geo.lookup("8.8.8.8");
    expect(r.country).toBe("US");
    expect(r.asn).toBe(15169);
  });
});
