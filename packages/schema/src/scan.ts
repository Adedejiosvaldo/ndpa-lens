import { z } from "zod";
import { ConsentState, HttpUrl, Id, Timestamp } from "./common.js";

export const ScanStatus = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export type ScanStatus = z.infer<typeof ScanStatus>;

export const ScanTrigger = z.enum(["manual", "rescan", "public"]);
export type ScanTrigger = z.infer<typeof ScanTrigger>;

/** Phases shown in live progress (SCAN-04). */
export const ScanPhase = z.enum([
  "queued",
  "preflight",
  "discovering",
  "capturing",
  "checking",
  "building_pack",
  "done",
]);
export type ScanPhase = z.infer<typeof ScanPhase>;

export const MAX_PAGES_PER_DOMAIN = 25;

/** API → queue job contract (PRD §8). */
export const ScanJob = z.object({
  scanId: Id,
  orgId: Id,
  targets: z
    .array(
      z.object({
        domainId: Id,
        urls: z.array(HttpUrl).min(1),
      }),
    )
    .min(1),
  states: z.array(ConsentState).min(1).default(["none", "reject", "accept"]),
  maxPages: z.number().int().min(1).max(MAX_PAGES_PER_DOMAIN).default(MAX_PAGES_PER_DOMAIN),
  engineVersion: z.string().min(1),
  checksVersion: z.string().min(1),
});
export type ScanJob = z.infer<typeof ScanJob>;

/** Worker → API progress event (PRD §8), relayed to the browser over SSE. */
export const ScanProgressEvent = z
  .object({
    scanId: Id,
    phase: ScanPhase,
    pageDone: z.number().int().nonnegative(),
    pageTotal: z.number().int().nonnegative(),
    /** Optional human line, e.g. the page being visited. */
    detail: z.string().max(500).optional(),
    at: Timestamp,
  })
  .refine((e) => e.pageDone <= e.pageTotal, { message: "pageDone exceeds pageTotal", path: ["pageDone"] });
export type ScanProgressEvent = z.infer<typeof ScanProgressEvent>;

/** Plain-English failure reasons (SCAN-05). Failed scans never consume credits. */
export const ScanFailureReason = z.enum([
  "dns_not_found",
  "unreachable",
  "timeout",
  "bot_blocked",
  "private_address",
  "tls_error",
  "cancelled",
  "internal_error",
]);
export type ScanFailureReason = z.infer<typeof ScanFailureReason>;

export const SCAN_FAILURE_MESSAGE: Record<ScanFailureReason, string> = {
  dns_not_found: "The website address could not be found. Check the domain is spelt correctly.",
  unreachable: "The website did not respond. It may be down; try again later.",
  timeout: "The website took too long to load, so the scan stopped.",
  bot_blocked: "The site blocked automated browsers. Ask the client to allow our scanner, then try again.",
  private_address: "This address points to a private network, so it can't be scanned.",
  tls_error: "The website's security certificate could not be checked.",
  cancelled: "The scan was cancelled.",
  internal_error: "Something went wrong on our side. The scan has been logged and no credit was spent.",
};
