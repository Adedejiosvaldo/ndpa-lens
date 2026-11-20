import { z } from "zod";
import { ConsentState, Hostname, Id, NdpcTier, Sha256, Timestamp } from "./common.js";
import { AnalystStatus, Finding } from "./finding.js";

export const PACK_SCHEMA_ID = "ndpa-lens/pack@1" as const;

export const DiffResult = z.enum(["fixed", "open", "new", "regressed"]);
export type DiffResult = z.infer<typeof DiffResult>;

/** One third-party destination for the data-flow map (FLOW-01). */
export const DataFlow = z.object({
  host: Hostname,
  vendor: z.string().nullable(),
  category: z.string().nullable(),
  ip: z.string().nullable(),
  country: z.string().length(2).nullable(),
  asn: z.string().nullable(),
  firstSeenState: ConsentState,
  personalDataObserved: z.boolean(),
});
export type DataFlow = z.infer<typeof DataFlow>;

/**
 * Machine-readable evidence pack (PACK-02). Skeleton for Step 03; Step 24
 * fills in anything the PDF needs. Changes that break readers need pack@2.
 */
export const PackV1 = z.object({
  schema: z.literal(PACK_SCHEMA_ID),
  packId: Id,
  version: z.number().int().min(1),
  generatedAt: Timestamp,
  dpco: z.object({
    orgId: Id,
    name: z.string().min(1),
    licenceNumber: z.string().nullable(),
  }),
  client: z.object({
    clientId: Id,
    name: z.string().min(1),
    ndpcTier: NdpcTier,
  }),
  scan: z.object({
    scanId: Id,
    startedAt: Timestamp,
    finishedAt: Timestamp,
    domains: z.array(Hostname).min(1),
    pages: z.array(
      z.object({ pageId: Id, url: z.string(), pageType: z.string(), states: z.array(ConsentState) }),
    ),
    egress: z.object({ ip: z.string(), country: z.string().length(2) }),
    engineVersion: z.string(),
    checksVersion: z.string(),
    vendorListVersion: z.string(),
  }),
  findings: z.array(
    Finding.extend({
      findingId: Id,
      analystStatus: AnalystStatus,
      analystNote: z.string().nullable(),
    }),
  ),
  dataFlows: z.array(DataFlow),
  diff: z
    .object({
      baselineScanId: Id,
      items: z.array(z.object({ checkId: z.string(), pageKey: z.string(), result: DiffResult })),
    })
    .nullable(),
  /** SHA-256 of the evidence-bundle manifest this JSON was built with. */
  manifestSha256: Sha256,
  disclaimer: z.string().min(1),
});
export type PackV1 = z.infer<typeof PackV1>;

/** Manifest inside the ZIP bundle (PACK-03); its hash is signed (PACK-04). */
export const PackManifest = z.object({
  schema: z.literal("ndpa-lens/manifest@1"),
  packId: Id,
  version: z.number().int().min(1),
  files: z.array(z.object({ path: z.string().min(1), sha256: Sha256, bytes: z.number().int().nonnegative() })).min(1),
});
export type PackManifest = z.infer<typeof PackManifest>;
