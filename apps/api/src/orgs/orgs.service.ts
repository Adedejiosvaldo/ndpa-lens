import { createHash, randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Role } from "@ndpa/schema";
import { and, count, desc, eq, gt, lt, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import type { SignupOrganisation } from "../auth/signup-context.js";
import { uuidv7 } from "../common/ids.js";
import { decodeCursor, type Page, toPage } from "../common/pagination.js";
import { ProblemException } from "../common/problem.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { DbService, type Tx } from "../db/db.service.js";
import { auditLog, invitations, memberships, organisations, ownershipTransfers, users } from "../db/schema.js";
import { Mailer } from "../mail/mail.service.js";
import * as T from "../mail/templates.js";
import { atLeast } from "./roles.js";

const INVITE_DAYS = 7; // ORG-04
const TRANSFER_DAYS = 7;
const days = (n: number) => new Date(Date.now() + n * 864e5);
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export interface Actor {
  userId: string;
  role: Role;
  ip?: string | null;
}

export interface OrgProfilePatch {
  name?: string;
  legalName?: string;
  address?: string;
  phone?: string;
}

/**
 * Organisations, members, invitations and ownership transfer (ORG-01, 04, 05).
 * Every query runs as ndpa_api inside withOrg(), so RLS confines it to one org
 * even if a check here were wrong.
 */
@Injectable()
export class OrgsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
    private readonly mailer: Mailer,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  // ---- ORG-01 ----

  /** Create the organisation a new account signs up with; the user becomes its Owner. */
  async createForNewUser(userId: string, o: SignupOrganisation): Promise<string> {
    const id = uuidv7();
    await this.db.withOrg(id, async (tx) => {
      await tx.insert(organisations).values({
        id,
        name: o.tradingName,
        legalName: o.legalName,
        address: o.address,
        phone: o.phone,
        slug: `${slugify(o.tradingName)}-${randomBytes(3).toString("hex")}`,
      });
      await tx.insert(memberships).values({ organizationId: id, userId, role: "owner" });
      await this.audit.recordInOrg(tx, id, { action: "org.created", actorUserId: userId, targetType: "organisation", targetId: id });
    });
    return id;
  }

  async profile(orgId: string) {
    const [o] = await this.db.withOrg(orgId, (tx) =>
      tx
        .select({
          id: organisations.id,
          name: organisations.name,
          legalName: organisations.legalName,
          address: organisations.address,
          phone: organisations.phone,
          dpcoLicenceNo: organisations.dpcoLicenceNo,
          licenceStatus: organisations.licenceStatus,
          branding: organisations.branding,
          createdAt: organisations.createdAt,
        })
        .from(organisations)
        .where(eq(organisations.id, orgId)),
    );
    if (!o) throw new ProblemException(404, "not_found", "Not found");
    return o;
  }

  async updateProfile(orgId: string, actor: Actor, patch: OrgProfilePatch) {
    await this.db.withOrg(orgId, async (tx) => {
      await tx.update(organisations).set(patch).where(eq(organisations.id, orgId));
      await this.audit.recordInOrg(tx, orgId, {
        action: "org.updated",
        actorUserId: actor.userId,
        ip: actor.ip,
        metadata: { fields: Object.keys(patch) },
      });
    });
    return this.profile(orgId);
  }

  // ---- members (ORG-05) ----

  async members(orgId: string) {
    return this.db.withOrg(orgId, (tx) =>
      tx
        .select({ userId: memberships.userId, name: users.name, email: users.email, role: memberships.role, since: memberships.createdAt })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(eq(memberships.organizationId, orgId))
        .orderBy(memberships.createdAt),
    );
  }

  async changeRole(orgId: string, actor: Actor, userId: string, role: Exclude<Role, "owner">) {
    await this.db.withOrg(orgId, async (tx) => {
      const target = await this.memberOrThrow(tx, orgId, userId);
      if (target.role === role) return;
      if (target.role === "owner") {
        this.requireOwner(actor, "Only an Owner can change another Owner's role");
        await this.keepAnOwner(tx, orgId);
      }
      await tx
        .update(memberships)
        .set({ role })
        .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, userId)));
      await this.audit.recordInOrg(tx, orgId, {
        action: "member.role_changed",
        actorUserId: actor.userId,
        ip: actor.ip,
        targetType: "user",
        targetId: userId,
        metadata: { from: target.role, to: role },
      });
    });
  }

  /** Remove a member, or leave (any role may remove themselves). */
  async removeMember(orgId: string, actor: Actor, userId: string) {
    const self = userId === actor.userId;
    if (!self && !atLeast(actor.role, "admin")) {
      throw new ProblemException(403, "forbidden", "Your role can't do that", "Removing members needs the admin role or higher.");
    }
    await this.db.withOrg(orgId, async (tx) => {
      const target = await this.memberOrThrow(tx, orgId, userId);
      if (target.role === "owner") {
        if (!self) this.requireOwner(actor, "Only an Owner can remove another Owner");
        await this.keepAnOwner(tx, orgId);
      }
      await tx.delete(memberships).where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, userId)));
      await this.audit.recordInOrg(tx, orgId, {
        action: self ? "member.left" : "member.removed",
        actorUserId: actor.userId,
        ip: actor.ip,
        targetType: "user",
        targetId: userId,
        metadata: { role: target.role },
      });
    });
  }

  // ---- invitations (ORG-04) ----

  async invitations(orgId: string) {
    return this.db.withOrg(orgId, (tx) =>
      tx
        .select({ id: invitations.id, email: invitations.email, role: invitations.role, expiresAt: invitations.expiresAt, createdAt: invitations.createdAt })
        .from(invitations)
        .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, "pending"), gt(invitations.expiresAt, new Date())))
        .orderBy(desc(invitations.createdAt)),
    );
  }

  async invite(orgId: string, actor: Actor, email: string, role: Exclude<Role, "owner">) {
    const secret = randomBytes(32).toString("base64url");
    const token = `${orgId}.${secret}`;
    const { id, orgName, inviterName } = await this.db.withOrg(orgId, async (tx) => {
      const existing = await tx
        .select({ id: users.id })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(and(eq(memberships.organizationId, orgId), sql`${users.email} = ${email}::citext`));
      if (existing.length) throw new ProblemException(409, "conflict", "That person is already a member");
      // One live invitation per email: a new one replaces the old.
      await tx
        .update(invitations)
        .set({ status: "canceled" })
        .where(and(eq(invitations.organizationId, orgId), eq(invitations.status, "pending"), sql`${invitations.email} = ${email}::citext`));
      const [inv] = await tx
        .insert(invitations)
        .values({ organizationId: orgId, email, role, tokenHash: sha256(secret), expiresAt: days(INVITE_DAYS), inviterId: actor.userId })
        .returning({ id: invitations.id });
      await this.audit.recordInOrg(tx, orgId, {
        action: "invitation.created",
        actorUserId: actor.userId,
        ip: actor.ip,
        targetType: "invitation",
        targetId: inv!.id,
        metadata: { email, role },
      });
      const [o] = await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, orgId));
      const [u] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actor.userId));
      return { id: inv!.id, orgName: o!.name, inviterName: u!.name };
    });
    const link = `${this.config.WEB_URL}/invitations/accept?token=${encodeURIComponent(token)}`;
    await this.mailer.send({ to: email, ...T.invitation(inviterName, orgName, role, link, INVITE_DAYS) });
    return { id, email, role };
  }

  async cancelInvitation(orgId: string, actor: Actor, invitationId: string) {
    await this.db.withOrg(orgId, async (tx) => {
      const r = await tx
        .update(invitations)
        .set({ status: "canceled" })
        .where(and(eq(invitations.id, invitationId), eq(invitations.organizationId, orgId), eq(invitations.status, "pending")))
        .returning({ id: invitations.id });
      if (!r.length) throw new ProblemException(404, "not_found", "Invitation not found");
      await this.audit.recordInOrg(tx, orgId, { action: "invitation.cancelled", actorUserId: actor.userId, ip: actor.ip, targetType: "invitation", targetId: invitationId });
    });
  }

  /** The invitee (signed in with the invited email) joins the organisation. */
  async acceptInvitation(token: string, user: { id: string; email: string }, ip: string | null) {
    const [orgId, secret] = token.split(".");
    if (!orgId || !secret || !/^[0-9a-f-]{36}$/.test(orgId)) throw invalidInvite();
    return this.db.withOrg(orgId, async (tx) => {
      const [inv] = await tx.select().from(invitations).where(eq(invitations.tokenHash, sha256(secret)));
      if (!inv || inv.status !== "pending") throw invalidInvite();
      if (inv.expiresAt <= new Date()) {
        throw new ProblemException(410, "invitation_expired", "This invitation has expired", "Ask the organisation to send a new one.");
      }
      if (inv.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new ProblemException(403, "forbidden", "This invitation is for a different email address", "Sign in with the address the invitation was sent to.");
      }
      await tx
        .insert(memberships)
        .values({ organizationId: orgId, userId: user.id, role: inv.role, invitedBy: inv.inviterId })
        .onConflictDoNothing();
      await tx.update(invitations).set({ status: "accepted" }).where(eq(invitations.id, inv.id));
      await this.audit.recordInOrg(tx, orgId, { action: "invitation.accepted", actorUserId: user.id, ip, targetType: "invitation", targetId: inv.id, metadata: { role: inv.role } });
      return { orgId, role: inv.role };
    });
  }

  // ---- ownership transfer (ORG-05) ----

  async pendingTransfer(orgId: string) {
    const [t] = await this.db.withOrg(orgId, (tx) =>
      tx
        .select({ id: ownershipTransfers.id, fromUserId: ownershipTransfers.fromUserId, toUserId: ownershipTransfers.toUserId, expiresAt: ownershipTransfers.expiresAt })
        .from(ownershipTransfers)
        .where(and(eq(ownershipTransfers.orgId, orgId), eq(ownershipTransfers.status, "pending"), gt(ownershipTransfers.expiresAt, new Date()))),
    );
    return t ?? null;
  }

  async requestTransfer(orgId: string, actor: Actor, toUserId: string) {
    this.requireOwner(actor, "Only an Owner can transfer ownership");
    if (toUserId === actor.userId) throw new ProblemException(400, "validation_failed", "Choose another member");
    const { email, name, orgName } = await this.db.withOrg(orgId, async (tx) => {
      const target = await this.memberOrThrow(tx, orgId, toUserId);
      if (target.role === "owner") throw new ProblemException(409, "conflict", "That member is already an Owner");
      // Expired pending transfers no longer block a new one.
      await tx
        .update(ownershipTransfers)
        .set({ status: "cancelled", decidedAt: new Date() })
        .where(and(eq(ownershipTransfers.orgId, orgId), eq(ownershipTransfers.status, "pending"), lt(ownershipTransfers.expiresAt, new Date())));
      try {
        await tx.insert(ownershipTransfers).values({ orgId, fromUserId: actor.userId, toUserId, expiresAt: days(TRANSFER_DAYS) });
      } catch {
        throw new ProblemException(409, "conflict", "A transfer is already waiting to be accepted", "Cancel it first.");
      }
      await this.audit.recordInOrg(tx, orgId, { action: "ownership.transfer_requested", actorUserId: actor.userId, ip: actor.ip, targetType: "user", targetId: toUserId });
      const [u] = await tx.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, toUserId));
      const [o] = await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, orgId));
      return { email: u!.email, name: u!.name, orgName: o!.name };
    });
    await this.mailer.send({ to: email, ...T.ownershipTransfer(name, orgName, `${this.config.WEB_URL}/orgs/${orgId}/settings/members`) });
  }

  async cancelTransfer(orgId: string, actor: Actor) {
    this.requireOwner(actor, "Only an Owner can cancel a transfer");
    await this.db.withOrg(orgId, async (tx) => {
      const r = await tx
        .update(ownershipTransfers)
        .set({ status: "cancelled", decidedAt: new Date() })
        .where(and(eq(ownershipTransfers.orgId, orgId), eq(ownershipTransfers.status, "pending")))
        .returning({ id: ownershipTransfers.id });
      if (!r.length) throw new ProblemException(404, "not_found", "No transfer is waiting");
      await this.audit.recordInOrg(tx, orgId, { action: "ownership.transfer_cancelled", actorUserId: actor.userId, ip: actor.ip });
    });
  }

  /** The named member accepts: they become Owner, the previous Owner becomes Admin. */
  async acceptTransfer(orgId: string, actor: Actor) {
    await this.db.withOrg(orgId, async (tx) => {
      const [t] = await tx
        .select()
        .from(ownershipTransfers)
        .where(and(eq(ownershipTransfers.orgId, orgId), eq(ownershipTransfers.status, "pending"), eq(ownershipTransfers.toUserId, actor.userId)));
      if (!t) throw new ProblemException(404, "not_found", "No transfer is waiting for you");
      if (t.expiresAt <= new Date()) throw new ProblemException(410, "invitation_expired", "This transfer has expired");
      await tx.update(memberships).set({ role: "owner" }).where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, actor.userId)));
      await tx
        .update(memberships)
        .set({ role: "admin" })
        .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, t.fromUserId), eq(memberships.role, "owner")));
      await tx.update(ownershipTransfers).set({ status: "accepted", decidedAt: new Date() }).where(eq(ownershipTransfers.id, t.id));
      await this.audit.recordInOrg(tx, orgId, {
        action: "ownership.transfer_accepted",
        actorUserId: actor.userId,
        ip: actor.ip,
        targetType: "user",
        targetId: t.fromUserId,
      });
    });
  }

  // ---- audit log (PRD §2: Owner, Admin) ----

  async auditLog(orgId: string, cursor: string | undefined, limit: number): Promise<Page<Record<string, unknown> & { id: string }>> {
    const after = decodeCursor(cursor);
    const rows = await this.db.withOrg(orgId, (tx) =>
      tx
        .select({
          id: auditLog.id,
          action: auditLog.action,
          actorUserId: auditLog.actorUserId,
          actorName: users.name,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          ip: auditLog.ip,
          metadata: auditLog.metadata,
          createdAt: auditLog.createdAt,
        })
        .from(auditLog)
        .leftJoin(users, eq(users.id, auditLog.actorUserId))
        .where(and(eq(auditLog.orgId, orgId), after ? lt(auditLog.id, after) : undefined))
        .orderBy(desc(auditLog.id))
        .limit(limit + 1),
    );
    return toPage(rows, limit);
  }

  // ---- helpers ----

  private async memberOrThrow(tx: Tx, orgId: string, userId: string) {
    const [m] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, userId)));
    if (!m) throw new ProblemException(404, "not_found", "Member not found");
    return m;
  }

  /** An org must always keep at least one Owner (PRD §2). Locks the owner rows. */
  private async keepAnOwner(tx: Tx, orgId: string) {
    const owners = await tx
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.role, "owner")))
      .for("update");
    if (owners.length <= 1) {
      throw new ProblemException(409, "last_owner", "An organisation must keep at least one Owner", "Transfer ownership first.");
    }
  }

  private requireOwner(actor: Actor, title: string) {
    if (actor.role !== "owner") throw new ProblemException(403, "forbidden", title);
  }

  /** Used by tests and admin tooling. */
  async ownerCount(orgId: string) {
    const [r] = await this.db.withOrg(orgId, (tx) =>
      tx.select({ n: count() }).from(memberships).where(and(eq(memberships.organizationId, orgId), eq(memberships.role, "owner"))),
    );
    return r?.n ?? 0;
  }
}

function invalidInvite() {
  return new ProblemException(404, "not_found", "This invitation link is not valid", "It may have been used or cancelled. Ask for a new one.");
}

function slugify(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org"
  );
}
