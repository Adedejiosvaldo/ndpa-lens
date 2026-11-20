/**
 * Identity and tenancy tables (PRD §7), shaped for Better Auth (Step 07).
 *
 * JS property names follow Better Auth's field names so its Drizzle adapter can
 * use these tables directly; SQL column names follow the PRD (snake_case).
 * IDs default to uuidv7() (SQL function from migration 0000).
 *
 * Row-level security, roles and grants are in the custom migration
 * 0002_rls_and_grants.sql — Drizzle does not manage them.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  inet,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const citext = customType<{ data: string }>({ dataType: () => "citext" });

const id = () =>
  uuid("id")
    .primaryKey()
    .default(sql`uuidv7()`);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const memberRole = pgEnum("member_role", ["owner", "admin", "analyst", "viewer"]);
export const licenceStatus = pgEnum("licence_status", ["unsubmitted", "pending", "verified", "rejected"]);
export const invitationStatus = pgEnum("invitation_status", ["pending", "accepted", "rejected", "canceled"]);
export const actorType = pgEnum("actor_type", ["user", "platform_admin", "system", "public"]);

// ---- global identity (not tenant-scoped) ----

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: citext("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_org_id").references(() => organisations.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** Credentials per provider. The password hash (argon2id, Step 07) lives here. */
export const accounts = pgTable(
  "accounts",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("accounts_provider_account_uq").on(t.providerId, t.accountId),
    index("accounts_user_id_idx").on(t.userId),
  ],
);

/** Email-verification and password-reset tokens (identifiers stored hashed, Step 07). */
export const verifications = pgTable(
  "verifications",
  {
    id: id(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("verifications_identifier_idx").on(t.identifier)],
);

/** TOTP secret and recovery codes, both encrypted by Better Auth (Step 08). */
export const twoFactors = pgTable("two_factors", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  secret: text("secret").notNull(),
  backupCodes: text("backup_codes").notNull(),
  verified: boolean("verified").notNull().default(false),
  failedVerificationCount: integer("failed_verification_count").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});

// ---- tenancy (RLS-protected) ----

export const organisations = pgTable("organisations", {
  id: id(),
  /** Display (trading) name; Better Auth's `name`. */
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  legalName: text("legal_name"),
  address: text("address"),
  phone: text("phone"),
  dpcoLicenceNo: text("dpco_licence_no"),
  licenceStatus: licenceStatus("licence_status").notNull().default("unsubmitted"),
  licenceNote: text("licence_note"),
  verifiedBy: uuid("verified_by").references(() => users.id, { onDelete: "set null" }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  branding: jsonb("branding").notNull().default(sql`'{}'::jsonb`),
  createdAt: createdAt(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    organizationId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_org_user_uq").on(t.organizationId, t.userId), index("memberships_user_idx").on(t.userId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    organizationId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    email: citext("email").notNull(),
    role: memberRole("role").notNull(),
    status: invitationStatus("status").notNull().default("pending"),
    /** SHA-256 of the secret half of the emailed token (`<orgId>.<secret>`). */
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    inviterId: uuid("inviter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("invitations_org_idx").on(t.organizationId), index("invitations_email_idx").on(t.email)],
);

export const transferStatus = pgEnum("transfer_status", ["pending", "accepted", "cancelled"]);

/** Ownership transfer: the new Owner must accept (PRD §2). */
export const ownershipTransfers = pgTable(
  "ownership_transfers",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organisations.id, { onDelete: "cascade" }),
    fromUserId: uuid("from_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    toUserId: uuid("to_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: transferStatus("status").notNull().default("pending"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("ownership_transfers_org_idx").on(t.orgId),
    // At most one pending transfer per org.
    uniqueIndex("ownership_transfers_one_pending_uq").on(t.orgId).where(sql`status = 'pending'`),
  ],
);

/** Append-only (no UPDATE/DELETE grant). org_id is null for account-level events such as login. */
export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: uuid("org_id").references(() => organisations.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorType: actorType("actor_type").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    ip: inet("ip"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.orgId, t.createdAt.desc()), index("audit_log_actor_idx").on(t.actorUserId)],
);
