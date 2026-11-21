import maxmind, { type AsnResponse, type CountryResponse, type Reader } from "maxmind";
import { NON_ESSENTIAL, type Vendor, type VendorCategory, VENDOR_LIST_VERSION, VENDORS } from "./list.js";

export { NON_ESSENTIAL, type Vendor, type VendorCategory, VENDOR_LIST_VERSION, VENDORS };

export interface HostClassification {
  host: string;
  vendor: Pick<Vendor, "id" | "name" | "category" | "hqCountry"> | null;
  /** True when the host is not on the list: flagged for review, never assumed necessary (§5.3). */
  needsReview: boolean;
  /** Needs consent before loading. Unknown hosts are not assumed essential either. */
  nonEssential: boolean | null;
}

/** host → vendor, built once; longest matching suffix wins. */
const INDEX = new Map<string, Vendor>();
for (const v of VENDORS) for (const h of v.hostnames) INDEX.set(h.toLowerCase(), v);

export function classifyHost(rawHost: string): HostClassification {
  const host = rawHost.toLowerCase().replace(/\.$/, "");
  const labels = host.split(".");
  for (let i = 0; i < labels.length - 1; i++) {
    const v = INDEX.get(labels.slice(i).join("."));
    if (v) return { host, vendor: { id: v.id, name: v.name, category: v.category, hqCountry: v.hqCountry }, needsReview: false, nonEssential: NON_ESSENTIAL.has(v.category) };
  }
  return { host, vendor: null, needsReview: true, nonEssential: null };
}

export interface GeoResult {
  ip: string;
  country: string | null;
  asn: number | null;
  asOrg: string | null;
}

/** Country and ASN lookups (FLOW-01) over DB-IP Lite (CC BY 4.0) mmdb files. */
export interface GeoLookup {
  lookup(ip: string): GeoResult;
  /** Attribution required by the DB-IP Lite licence; printed in packs. */
  readonly attribution: string;
}

export const DBIP_ATTRIBUTION = "IP geolocation by DB-IP (https://db-ip.com), CC BY 4.0";

export function geoFromReaders(country: Pick<Reader<CountryResponse>, "get"> | null, asn: Pick<Reader<AsnResponse>, "get"> | null): GeoLookup {
  return {
    attribution: DBIP_ATTRIBUTION,
    lookup(ip) {
      const c = country?.get(ip) ?? null;
      const a = asn?.get(ip) ?? null;
      return {
        ip,
        country: c?.country?.iso_code ?? null,
        asn: a?.autonomous_system_number ?? null,
        asOrg: a?.autonomous_system_organization ?? null,
      };
    },
  };
}

/** Open DB-IP Lite country and ASN databases (paths from GEOIP_COUNTRY_DB / GEOIP_ASN_DB). */
export async function openGeo(countryPath: string, asnPath: string): Promise<GeoLookup> {
  const [country, asn] = await Promise.all([maxmind.open<CountryResponse>(countryPath), maxmind.open<AsnResponse>(asnPath)]);
  return geoFromReaders(country, asn);
}
