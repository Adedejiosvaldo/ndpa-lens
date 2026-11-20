import { createHash } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";

/**
 * Breached-password check via Have I Been Pwned's k-anonymity range API
 * (AUTH-01). Only the first 5 hex chars of the SHA-1 leave the server.
 */
export abstract class PwnedPasswords {
  abstract isBreached(password: string): Promise<boolean>;
}

@Injectable()
export class HibpPwnedPasswords extends PwnedPasswords {
  private readonly logger = new Logger(HibpPwnedPasswords.name);

  async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);
    try {
      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { "Add-Padding": "true", "User-Agent": "ndpa-lens-api" },
        signal: AbortSignal.timeout(3_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.text();
      return body.split("\n").some((line) => {
        const [s, count] = line.trim().split(":");
        return s === suffix && Number(count) > 0;
      });
    } catch (err) {
      // Fail open: an HIBP outage must not stop sign-ups. Logged for follow-up.
      this.logger.warn(`HIBP check skipped: ${(err as Error).message}`);
      return false;
    }
  }
}
