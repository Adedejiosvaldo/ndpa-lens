import { createHash } from "node:crypto";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Object storage over the S3 API (PRD §7, §10): Cloudflare R2 in production,
 * SeaweedFS in dev. Buckets stay private; reads go through short-lived
 * pre-signed URLs. Keys are content-addressed (SHA-256 of the bytes).
 */
export interface StorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
}

/** PRD §7: downloads only via 5-minute pre-signed URLs. */
export const PRESIGN_SECONDS = 5 * 60;

export const sha256Hex = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export class ObjectStore {
  readonly client: S3Client;

  constructor(readonly config: StorageConfig) {
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  /** Store bytes; returns the key and their SHA-256. */
  async put(key: string, bytes: Uint8Array, contentType: string): Promise<{ key: string; sha256: string; bytes: number }> {
    const sha256 = sha256Hex(bytes);
    await this.client.send(
      new PutObjectCommand({ Bucket: this.config.bucket, Key: key, Body: bytes, ContentType: contentType, Metadata: { sha256 } }),
    );
    return { key, sha256, bytes: bytes.byteLength };
  }

  async get(key: string): Promise<Uint8Array> {
    const out = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
    return out.Body!.transformToByteArray();
  }

  /** A short-lived GET URL. `filename` sets Content-Disposition for downloads. */
  presignGet(key: string, opts: { seconds?: number; filename?: string; contentType?: string } = {}): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        ResponseContentDisposition: opts.filename ? `attachment; filename="${opts.filename.replace(/"/g, "")}"` : undefined,
        ResponseContentType: opts.contentType,
      }),
      { expiresIn: opts.seconds ?? PRESIGN_SECONDS },
    );
  }

  /** Dev and test helper: create the bucket if it is missing. Production buckets come from Terraform. */
  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.config.bucket }));
    }
  }

  async ping(): Promise<void> {
    await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
  }
}
