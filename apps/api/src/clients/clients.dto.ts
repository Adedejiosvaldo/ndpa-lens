import { isIP } from "node:net";
import { z } from "zod";

export const SECTORS = [
  "insurance",
  "banking",
  "fintech",
  "betting",
  "telecoms",
  "healthcare",
  "education",
  "ecommerce",
  "government",
  "other",
] as const;
export const Sector = z.enum(SECTORS);
export const Tier = z.enum(["uhl", "ehl", "ohl", "unknown"]);

const Contact = z
  .object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional().or(z.literal("")),
    phone: z.string().trim().max(30).optional(),
  })
  .default({});

/** CLI-01 */
export const ClientBody = z.object({
  name: z.string().trim().min(1).max(200),
  rcNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^(RC|BN|IT|LP)?\s?\d{3,10}$/, "Use the CAC number, such as RC 123456")
    .optional()
    .or(z.literal("")),
  sector: Sector,
  ndpcTier: Tier.default("unknown"),
  contact: Contact,
});
export const ClientPatch = ClientBody.partial().refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const ClientListQuery = z.object({
  search: z.string().trim().max(100).optional(),
  sector: Sector.optional(),
  tier: Tier.optional(),
  archived: z.enum(["true", "false"]).default("false"),
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * A public website hostname from whatever the user pasted ("https://Www.Example.ng/x"
 * → "www.example.ng"). Refuses IPs, ports, single labels and internal names.
 */
export function normaliseHostname(input: string): string | null {
  const raw = input.trim();
  let host: string;
  try {
    host = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  host = host.replace(/\.$/, "");
  if (isIP(host.replace(/^\[|\]$/g, ""))) return null;
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)) return null;
  if (/\.(local|localhost|internal|test|invalid|example)$/.test(host)) return null;
  return host;
}

const sameSite = (host: string, url: URL) => url.hostname === host || url.hostname.endsWith(`.${host}`) || host.endsWith(`.${url.hostname}`);

/** CLI-02: named pages on the same site, http(s) only, at most 25. */
export function ExtraUrls(host: string) {
  return z
    .array(z.string().trim().max(2000))
    .max(25, "At most 25 named pages per domain")
    .default([])
    .transform((urls, ctx) => {
      const out: string[] = [];
      for (const [i, u] of urls.entries()) {
        if (!u) continue;
        let parsed: URL;
        try {
          parsed = new URL(/^https?:\/\//i.test(u) ? u : `https://${host}${u.startsWith("/") ? "" : "/"}${u}`);
        } catch {
          ctx.addIssue({ code: "custom", path: [i], message: "Not a valid web address" });
          continue;
        }
        if (!/^https?:$/.test(parsed.protocol) || !sameSite(host, parsed)) {
          ctx.addIssue({ code: "custom", path: [i], message: `Pages must be on ${host}` });
          continue;
        }
        parsed.hash = "";
        if (!out.includes(parsed.toString())) out.push(parsed.toString());
      }
      return out;
    });
}

export const DomainBody = z
  .object({ hostname: z.string().min(1).max(2000), extraUrls: z.array(z.string()).default([]) })
  .transform((v, ctx) => {
    const hostname = normaliseHostname(v.hostname);
    if (!hostname) {
      ctx.addIssue({ code: "custom", path: ["hostname"], message: "Enter a public website address, such as harbourassurance.ng" });
      return z.NEVER;
    }
    const extra = ExtraUrls(hostname).safeParse(v.extraUrls);
    if (!extra.success) {
      for (const i of extra.error.issues) ctx.addIssue({ ...i, path: ["extraUrls", ...i.path] } as z.core.$ZodRawIssue);
      return z.NEVER;
    }
    return { hostname, extraUrls: extra.data };
  });

export const DomainPatch = z.object({ extraUrls: z.array(z.string()) });

/**
 * CLI-03 attestation text. Bump the version whenever the wording changes: a
 * domain then needs a fresh attestation before its next scan.
 */
export const ATTESTATION_VERSION = "2026-11-21";
export const attestationText = (firm: string, client: string, hostname: string) =>
  `I confirm that ${firm} is engaged by ${client} to assess the website at ${hostname}, and is authorised to run automated scans of it for that purpose. NDPA Lens will load its public pages in a browser, never submit forms, and identify itself as a scanner.`;

export const AttestBody = z.object({
  statementVersion: z.literal(ATTESTATION_VERSION, { message: "The authorisation statement has changed. Reload and read it again." }),
  confirm: z.literal(true, { message: "Tick the box to confirm" }),
});
