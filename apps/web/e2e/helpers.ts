import { createHmac } from "node:crypto";
import { mailpitUrl } from "./env";

/** Latest email to `to` whose subject matches; polls Mailpit for up to 10 s. */
export async function latestEmail(to: string, subject: RegExp): Promise<{ subject: string; text: string }> {
  for (let i = 0; i < 40; i++) {
    const r = await fetch(`${mailpitUrl()}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await r.json()) as { messages: { ID: string; Subject: string }[] };
    const m = messages.find((x) => subject.test(x.Subject));
    if (m) {
      const full = (await (await fetch(`${mailpitUrl()}/api/v1/message/${m.ID}`)).json()) as { Text: string };
      return { subject: m.Subject, text: full.Text };
    }
    await new Promise((res) => setTimeout(res, 250));
  }
  throw new Error(`No email to ${to} matching ${subject}`);
}

/** First link in an email body. */
export const linkIn = (text: string) => text.match(/https?:\/\/\S+/)![0];

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s). */
export function totp(base32: string, step = 0): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const ch of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(ch).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g)!.map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + step));
  const h = createHmac("sha1", key).update(counter).digest();
  const o = h[h.length - 1]! & 0xf;
  return ((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
}

export const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@e2e.test`;
export const PASSWORD = `E2e-${Math.random().toString(36).slice(2)}-passphrase!`;
