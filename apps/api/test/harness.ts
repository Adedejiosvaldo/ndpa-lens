import type { INestApplication, Type } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../src/app.factory.js";
import { AppModule } from "../src/app.module.js";
import { PwnedPasswords } from "../src/auth/pwned.js";
import type { AppConfig } from "../src/config/config.js";
import { Mailer, type MailMessage } from "../src/mail/mail.service.js";

export class Outbox extends Mailer {
  readonly sent: MailMessage[] = [];
  async send(msg: MailMessage): Promise<void> {
    this.sent.push(msg);
  }
  to(email: string): MailMessage[] {
    return this.sent.filter((m) => m.to === email);
  }
  /** The ?token=… from the latest email to `email` whose subject matches. */
  token(email: string, subject: RegExp): string {
    const m = this.to(email).filter((x) => subject.test(x.subject)).at(-1);
    const t = m?.text.match(/[?&]token=([^\s&]+)/)?.[1];
    if (!t) throw new Error(`No token email for ${email} matching ${subject}`);
    return decodeURIComponent(t);
  }
}

export const BREACHED = new Set(["password123456", "correcthorsebatterystaple"]);

export interface TestApp {
  app: INestApplication;
  outbox: Outbox;
}

export async function createTestApp(config: AppConfig, controllers: Type[] = []): Promise<TestApp> {
  const outbox = new Outbox();
  const mod = await Test.createTestingModule({ imports: [AppModule.forRoot(config)], controllers })
    .overrideProvider(Mailer)
    .useValue(outbox)
    .overrideProvider(PwnedPasswords)
    .useValue({ isBreached: async (p: string) => BREACHED.has(p) })
    .compile();
  const app = mod.createNestApplication({ logger: false });
  configureApp(app, config);
  await app.init();
  return { app, outbox };
}

/**
 * A browser-like client: keeps cookies (including Secure ones, which superagent's
 * jar drops over plain HTTP), fetches a CSRF token and sends it on unsafe calls.
 */
export class Client {
  private cookies = new Map<string, string>();
  private csrf: string | null = null;

  constructor(
    private readonly app: INestApplication,
    readonly ip = "203.0.113.10",
  ) {}

  get cookieHeader(): string {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(res: request.Response): request.Response {
    const set = res.headers["set-cookie"] as unknown as string[] | undefined;
    for (const c of set ?? []) {
      const [pair, ...attrs] = c.split(";");
      const i = pair!.indexOf("=");
      const name = pair!.slice(0, i).trim();
      const value = pair!.slice(i + 1).trim();
      const expired = attrs.some((a) => /max-age=0\b/i.test(a)) || value === "";
      if (expired) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
    return res;
  }

  async ensureCsrf(): Promise<string> {
    if (!this.csrf) {
      const res = await this.get("/v1/auth/csrf");
      this.csrf = res.body.csrfToken as string;
    }
    return this.csrf!;
  }

  async get(path: string): Promise<request.Response> {
    const res = await request(this.app.getHttpServer()).get(path).set("Cookie", this.cookieHeader).set("X-Forwarded-For", this.ip);
    return this.absorb(res);
  }

  async send(method: "post" | "patch" | "put" | "delete", path: string, body?: object, headers: Record<string, string> = {}) {
    const token = await this.ensureCsrf();
    let r = request(this.app.getHttpServer())
      [method](path)
      .set("Cookie", this.cookieHeader)
      .set("X-Forwarded-For", this.ip)
      .set("X-CSRF-Token", token);
    for (const [k, v] of Object.entries(headers)) r = r.set(k, v);
    const res = await (body ? r.send(body) : r);
    return this.absorb(res);
  }

  post(path: string, body?: object, headers?: Record<string, string>) {
    return this.send("post", path, body, headers);
  }
  delete(path: string) {
    return this.send("delete", path);
  }
}

/** Sign up, verify and return a signed-in client. */
export async function signedInUser(t: TestApp, email: string, password = "a-long-safe-passphrase-1", ip?: string) {
  const c = new Client(t.app, ip);
  await c.post("/v1/auth/signup", { name: email.split("@")[0], email, password });
  const token = t.outbox.token(email, /Confirm your email/);
  const res = await c.post("/v1/auth/verify-email", { token });
  if (res.status !== 200) throw new Error(`verify failed: ${res.status} ${JSON.stringify(res.body)}`);
  return c;
}
