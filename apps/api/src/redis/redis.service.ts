import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    // Fail fast instead of queueing commands while Redis is down.
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 3_000,
    });
    this.client.on("error", () => {
      /* surfaced through ping(); avoid unhandled error events */
    });
  }

  async ping(): Promise<void> {
    if (this.client.status === "wait" || this.client.status === "end") await this.client.connect();
    const reply = await this.client.ping();
    if (reply !== "PONG") throw new Error(`Unexpected Redis reply: ${reply}`);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
