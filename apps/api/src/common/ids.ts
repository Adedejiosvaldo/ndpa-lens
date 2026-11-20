import { randomBytes } from "node:crypto";

/**
 * RFC 9562 uuid v7 generated in the app (same layout as the SQL uuidv7()).
 * Needed when a row's id must be known before insert, e.g. a new organisation
 * whose id becomes app.org_id for its own RLS-checked insert.
 */
export function uuidv7(now = Date.now()): string {
  const b = randomBytes(16);
  b.writeUIntBE(now, 0, 6);
  b[6] = (b[6]! & 0x0f) | 0x70;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
