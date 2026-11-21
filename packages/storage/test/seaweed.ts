import { GenericContainer, type StartedTestContainer, Wait } from "testcontainers";
import type { StorageConfig } from "../src/index.js";

const KEYS = { accessKeyId: "test-access", secretAccessKey: "test-secret-0123456789" };

/** SeaweedFS S3 gateway for integration tests (same image as infra/dev). */
export async function startSeaweed(bucket = "test-bucket"): Promise<{ container: StartedTestContainer; config: StorageConfig }> {
  const s3json = JSON.stringify({
    identities: [{ name: "test", credentials: [{ accessKey: KEYS.accessKeyId, secretKey: KEYS.secretAccessKey }], actions: ["Admin", "Read", "List", "Tagging", "Write"] }],
  });
  const container = await new GenericContainer("chrislusf/seaweedfs:4.54")
    .withCommand(["server", "-dir=/data", "-s3", "-s3.port=8333", "-s3.config=/etc/seaweedfs/s3.json"])
    .withCopyContentToContainer([{ content: s3json, target: "/etc/seaweedfs/s3.json" }])
    .withExposedPorts(8333)
    .withWaitStrategy(Wait.forHttp("/healthz", 8333).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();
  return {
    container,
    config: {
      endpoint: `http://${container.getHost()}:${container.getMappedPort(8333)}`,
      region: "auto",
      bucket,
      forcePathStyle: true,
      ...KEYS,
    },
  };
}
