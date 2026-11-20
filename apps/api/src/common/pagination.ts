import { z } from "zod";

export const MAX_PAGE_LIMIT = 100;

/** `?cursor=&limit=` (PRD §8). The cursor is opaque to clients. */
export const PageQuery = z.object({
  cursor: z.string().max(512).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).default(25),
});
export type PageQuery = z.infer<typeof PageQuery>;

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

/** Cursor = base64url of the last item's sort key (uuid v7 ids sort by time). */
export function encodeCursor(lastId: string): string {
  return Buffer.from(JSON.stringify({ id: lastId })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): string | null {
  if (!cursor) return null;
  try {
    const parsed = z.object({ id: z.uuid() }).parse(JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")));
    return parsed.id;
  } catch {
    throw new z.ZodError([{ code: "custom", path: ["cursor"], message: "Invalid cursor", input: cursor }]);
  }
}

/** Build a page from `limit + 1` fetched rows. */
export function toPage<T extends { id: string }>(rows: T[], limit: number): Page<T> {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.id) : null };
}
