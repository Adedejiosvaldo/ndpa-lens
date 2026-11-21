import { z } from "zod";

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** Contrast of a colour against the white pack cover. */
export const contrastOnWhite = (hex: string) => 1.05 / (luminance(hex) + 0.05);

const Colour = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour such as #7a2e1d")
  .transform((v) => v.toLowerCase())
  .refine((v) => contrastOnWhite(v) >= 3, "This colour is too light to read on a white pack cover. Choose a darker shade.");

/** BRAND-01: what appears on the pack cover. */
export const BrandingBody = z.object({
  firmName: z.string().trim().min(1).max(120),
  primaryColour: Colour,
  contactBlock: z.string().trim().max(500).default(""),
  showLicenceOnCover: z.boolean().default(true),
});
export type BrandingInput = z.infer<typeof BrandingBody>;

export interface Branding extends BrandingInput {
  logo: { key: string; contentType: "image/png" | "image/svg+xml"; sha256: string; bytes: number } | null;
}

/** ORG-02: the NDPC DPCO licence number as printed on the licence. */
export const LicenceBody = z.object({
  licenceNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9/.\- ]{3,39}$/, "Enter the licence number as it appears on your NDPC licence"),
});

export const LOGO_MAX_BYTES = 1024 * 1024;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * Validate an uploaded logo. PNG: magic bytes. SVG: refused if it carries
 * anything that can run or fetch (scripts, event handlers, foreignObject,
 * external references, entities). Logos are only ever served through
 * pre-signed URLs and rendered in <img>, where SVG cannot script anyway;
 * this is the second layer. Returns a reason when rejected.
 */
export function checkLogo(bytes: Buffer, contentType: string): string | null {
  if (bytes.length === 0) return "The file is empty.";
  if (bytes.length > LOGO_MAX_BYTES) return "Logos can be at most 1 MB.";
  if (contentType === "image/png") {
    return PNG_MAGIC.every((b, i) => bytes[i] === b) ? null : "That file is not a valid PNG.";
  }
  if (contentType === "image/svg+xml") {
    const text = bytes.toString("utf8");
    if (!/<svg[\s>]/i.test(text)) return "That file is not a valid SVG.";
    const banned: [RegExp, string][] = [
      [/<script/i, "scripts"],
      [/\son[a-z]+\s*=/i, "event handlers"],
      [/<foreignObject/i, "embedded HTML"],
      [/<!ENTITY|<!DOCTYPE/i, "entity declarations"],
      [/javascript:/i, "script links"],
      [/(?:href|src)\s*=\s*["'](?!#)/i, "external links"],
      [/url\(\s*["']?(?!#)/i, "external resources"],
      [/<(?:iframe|embed|object|use)\b/i, "embedded content"],
    ];
    for (const [re, what] of banned) if (re.test(text)) return `SVG logos can't contain ${what}. Export a plain SVG or use a PNG.`;
    return null;
  }
  return "Upload a PNG or SVG.";
}
