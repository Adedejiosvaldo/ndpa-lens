import { createHash } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service.js";

export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;

const key = (kind: "acct" | "ip", value: string) =>
  `login:fail:${kind}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;

/**
 * AUTH-03: 5 failed logins per 15 minutes, counted per account and per IP.
 * Keys are hashed so Redis holds no email addresses or IPs.
 */
@Injectable()
export class LoginLimiter {
  constructor(private readonly redis: RedisService) {}

  /** Seconds until sign-in is allowed again, or 0 if it is allowed now. */
  async blockedFor(email: string, ip: string): Promise<number> {
    await this.redis.ping();
    const r = this.redis.client;
    const keys = [key("acct", email), key("ip", ip)];
    const counts = await r.mget(...keys);
    let wait = 0;
    for (const [i, c] of counts.entries()) {
      if (Number(c ?? 0) >= LOGIN_MAX_FAILURES) wait = Math.max(wait, await r.ttl(keys[i]!));
    }
    return wait;
  }

  /** Record a failure. Returns the account's failure count in this window. */
  async fail(email: string, ip: string): Promise<number> {
    const r = this.redis.client;
    const [acct, ipKey] = [key("acct", email), key("ip", ip)];
    const res = await r
      .multi()
      .incr(acct)
      .expire(acct, LOGIN_WINDOW_SECONDS, "NX")
      .incr(ipKey)
      .expire(ipKey, LOGIN_WINDOW_SECONDS, "NX")
      .exec();
    return Number(res?.[0]?.[1] ?? 0);
  }

  async reset(email: string): Promise<void> {
    await this.redis.client.del(key("acct", email));
  }

  /** Generic fixed-window limiter for email-sending endpoints. True if allowed. */
  async allow(name: string, value: string, max: number, windowSeconds: number): Promise<boolean> {
    await this.redis.ping();
    const k = `limit:${name}:${createHash("sha256").update(value.toLowerCase()).digest("hex").slice(0, 32)}`;
    const res = await this.redis.client.multi().incr(k).expire(k, windowSeconds, "NX").exec();
    return Number(res?.[0]?.[1] ?? 0) <= max;
  }
}
