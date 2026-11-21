import { ObjectStore, sha256Hex } from "@ndpa/storage";
import type { ConsentState } from "@ndpa/schema";

/**
 * Evidence store (PRD §7): each file is uploaded under
 * orgs/{orgId}/scans/{scanId}/{pageId}/{state}/{kind}.{ext} and recorded in a
 * manifest with its SHA-256, so the bundle can be verified file by file
 * (PACK-03) and checks can re-run from stored evidence alone (§5.4).
 */
export type EvidenceKind = "screenshot" | "screenshot_fold" | "har" | "dom" | "cookies" | "storage" | "console" | "preflight" | "policy_text" | "forms";

export interface EvidenceFile {
  key: string;
  kind: EvidenceKind;
  pageId: string | null;
  consentState: ConsentState | null;
  contentType: string;
  sha256: string;
  bytes: number;
}

const EXT: Record<string, string> = {
  "image/png": "png",
  "application/json": "json",
  "text/html": "html",
  "text/plain": "txt",
};

export class EvidenceWriter {
  readonly files: EvidenceFile[] = [];

  constructor(
    private readonly store: ObjectStore,
    readonly orgId: string,
    readonly scanId: string,
  ) {}

  private key(kind: EvidenceKind, pageId: string | null, state: ConsentState | null, contentType: string) {
    const ext = EXT[contentType] ?? "bin";
    return pageId ? `orgs/${this.orgId}/scans/${this.scanId}/${pageId}/${state ?? "none"}/${kind}.${ext}` : `orgs/${this.orgId}/scans/${this.scanId}/${kind}.${ext}`;
  }

  async put(kind: EvidenceKind, data: Uint8Array | string | object, opts: { pageId?: string; consentState?: ConsentState; contentType?: string } = {}): Promise<EvidenceFile> {
    const contentType = opts.contentType ?? (typeof data === "string" ? "text/plain" : data instanceof Uint8Array ? "application/octet-stream" : "application/json");
    const bytes =
      data instanceof Uint8Array ? data : new TextEncoder().encode(typeof data === "string" ? data : JSON.stringify(data, null, 2));
    const key = this.key(kind, opts.pageId ?? null, opts.consentState ?? null, contentType);
    const put = await this.store.put(key, bytes, contentType);
    const file: EvidenceFile = { key, kind, pageId: opts.pageId ?? null, consentState: opts.consentState ?? null, contentType, sha256: put.sha256, bytes: put.bytes };
    this.files.push(file);
    return file;
  }

  /** Re-read a file and confirm its bytes still hash to what was recorded. */
  async verify(file: EvidenceFile): Promise<boolean> {
    return sha256Hex(await this.store.get(file.key)) === file.sha256;
  }
}
