import { z } from "zod";

/** uuid v7 everywhere (PRD §7): sortable by creation time. */
export const Id = z.uuidv7();
export type Id = z.infer<typeof Id>;

/** ISO 8601 timestamp with offset; stored as timestamptz, shown in Africa/Lagos. */
export const Timestamp = z.iso.datetime({ offset: true });

/** Lowercase hex SHA-256. */
export const Sha256 = z.string().regex(/^[a-f0-9]{64}$/, "Expected a lowercase hex SHA-256");
export type Sha256 = z.infer<typeof Sha256>;

/** Money is integer kobo (PRD §7). */
export const Kobo = z.number().int().nonnegative();

export const Role = z.enum(["owner", "admin", "analyst", "viewer"]);
export type Role = z.infer<typeof Role>;

/** The three states each page is captured in (SCAN-03). */
export const ConsentState = z.enum(["none", "reject", "accept"]);
export type ConsentState = z.infer<typeof ConsentState>;

export const Severity = z.enum(["critical", "high", "medium", "low", "info"]);
export type Severity = z.infer<typeof Severity>;

/** Plain labels shown next to severity colour (PRD §3.1: never colour alone). */
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const PageType = z.enum([
  "home",
  "policy",
  "cookie",
  "signup",
  "login",
  "account",
  "checkout",
  "contact",
  "careers",
  "other",
]);
export type PageType = z.infer<typeof PageType>;

export const NdpcTier = z.enum(["uhl", "ehl", "ohl", "unknown"]);
export type NdpcTier = z.infer<typeof NdpcTier>;

/** Public website hostname: lowercase, at least one dot, no scheme/port/path. */
export const Hostname = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/, "Expected a hostname such as example.com.ng");

export const HttpUrl = z.url({ protocol: /^https?$/ });
