import { hash as argonHash, verify as argonVerify } from "@node-rs/argon2";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { AuditService } from "../audit/audit.service.js";
import type { AppConfig } from "../config/config.js";
import { accounts, sessions, twoFactors, users, verifications } from "../db/schema.js";
import type { Mailer } from "../mail/mail.service.js";
import type { SignupContext } from "./signup-context.js";
import * as T from "../mail/templates.js";

/** Header carrying the client IP as resolved by Express "trust proxy". Set by us, never by the client. */
export const CLIENT_IP_HEADER = "x-ndpa-client-ip";

export const SESSION_IDLE_SECONDS = 12 * 60 * 60; // AUTH-06: 12 h idle
export const SESSION_ABSOLUTE_SECONDS = 7 * 24 * 60 * 60; // AUTH-06: 7 d absolute (enforced in SessionGuard)
export const RESET_TOKEN_SECONDS = 30 * 60; // AUTH-04
export const VERIFY_TOKEN_SECONDS = 24 * 60 * 60;

// OWASP argon2id baseline: 19 MiB, 2 iterations, 1 lane.
// (algorithm 2 = Algorithm.Argon2id; it's a const enum, unusable under isolatedModules.)
const ARGON = { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (password: string) => argonHash(password, ARGON);

export interface AuthDeps {
  config: AppConfig;
  db: NodePgDatabase;
  mailer: Mailer;
  audit: AuditService;
  signup: SignupContext;
}

/**
 * Better Auth, used server-side only through `auth.api.*` from our controllers.
 * Its own HTTP handler is never mounted, so every auth route follows the PRD
 * paths, problem+json errors, CSRF and rate-limit rules.
 */
export function createAuth({ config, db, mailer, audit, signup }: AuthDeps) {
  const web = (path: string, token?: string) =>
    `${config.WEB_URL}${path}${token ? `?token=${encodeURIComponent(token)}` : ""}`;

  return betterAuth({
    appName: "NDPA Lens",
    baseURL: config.API_URL,
    basePath: "/v1/auth",
    secret: config.BETTER_AUTH_SECRET,
    trustedOrigins: [config.WEB_URL],
    database: drizzleAdapter(db, { provider: "pg", schema: { users, sessions, accounts, verifications, twoFactors } }),
    user: {
      modelName: "users",
      additionalFields: {
        isPlatformAdmin: { type: "boolean", required: false, defaultValue: false, input: false },
      },
    },
    session: {
      modelName: "sessions",
      // Sliding 12 h: each use after updateAge pushes expiry to now + 12 h, so
      // 12 h without activity ends the session. The 7 d cap is in SessionGuard.
      expiresIn: SESSION_IDLE_SECONDS,
      updateAge: 15 * 60,
      cookieCache: { enabled: false }, // revocation must take effect immediately
    },
    account: { modelName: "accounts" },
    verification: { modelName: "verifications", storeIdentifier: "hashed" },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      autoSignIn: false, // enables Better Auth's sign-up enumeration protection
      requireEmailVerification: false, // AUTH-02 blocks scans, not sign-in
      resetPasswordTokenExpiresIn: RESET_TOKEN_SECONDS,
      revokeSessionsOnPasswordReset: true,
      password: {
        hash: hashPassword,
        verify: ({ hash, password }) => argonVerify(hash, password),
      },
      sendResetPassword: async ({ user, token }) => {
        const m = T.resetPassword(user.name, web("/reset-password", token));
        await mailer.send({ to: user.email, ...m });
      },
      onExistingUserSignUp: async ({ user }) => {
        const m = T.existingAccount(user.name, web("/login"), web("/forgot-password"));
        await mailer.send({ to: user.email, ...m });
      },
      onPasswordReset: async ({ user }) => {
        await audit.record({ action: "auth.password_reset", actorUserId: user.id, targetType: "user", targetId: user.id });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: VERIFY_TOKEN_SECONDS,
      sendVerificationEmail: async ({ user, token }) => {
        const m = T.verifyEmail(user.name, web("/verify-email", token));
        await mailer.send({ to: user.email, ...m });
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            signup.markCreated(user.id);
            await audit.record({ action: "auth.signup", actorUserId: user.id, targetType: "user", targetId: user.id });
          },
        },
      },
    },
    plugins: [
      // AUTH-05: TOTP + 10 recovery codes. Secret and codes are stored encrypted
      // with BETTER_AUTH_SECRET. No "trust this device": every sign-in asks.
      twoFactor({
        issuer: "NDPA Lens",
        schema: { twoFactor: { modelName: "twoFactors" } },
        backupCodeOptions: { amount: 10, length: 10, storeBackupCodes: "encrypted" },
        accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
        twoFactorCookieMaxAge: 10 * 60,
      }),
    ],
    rateLimit: { enabled: false }, // our LoginLimiter owns rate limiting
    advanced: {
      useSecureCookies: true, // AUTH-06: Secure; HttpOnly and SameSite=Lax are Better Auth defaults
      cookiePrefix: "ndpa",
      database: { generateId: false }, // ids come from the uuidv7() column default
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
export const BETTER_AUTH = Symbol("BETTER_AUTH");
