import { Injectable } from "@nestjs/common";
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import { AuditService } from "../audit/audit.service.js";
import { decodeCursor, encodeCursor } from "../common/pagination.js";
import { ProblemException } from "../common/problem.js";
import { DbService, type Tx } from "../db/db.service.js";
import { authorisations, clients, domains, organisations, users } from "../db/schema.js";
import type { Actor } from "../orgs/orgs.service.js";
import { ATTESTATION_VERSION, attestationText } from "./clients.dto.js";

export interface ClientInput {
  name: string;
  rcNumber?: string;
  sector: string;
  ndpcTier: "uhl" | "ehl" | "ohl" | "unknown";
  contact: { name?: string; email?: string; phone?: string };
}

const notFound = (what: string) => new ProblemException(404, "not_found", `${what} not found`);

/** Clients, domains and authorisation attestations (CLI-01..05). Runs as ndpa_api under RLS. */
@Injectable()
export class ClientsService {
  constructor(
    private readonly db: DbService,
    private readonly audit: AuditService,
  ) {}

  async list(orgId: string, q: { search?: string; sector?: string; tier?: string; archived: "true" | "false"; cursor?: string; limit: number }) {
    const after = decodeCursor(q.cursor);
    return this.db.withOrg(orgId, async (tx) => {
      const conds = [
        eq(clients.orgId, orgId),
        q.archived === "true" ? isNotNull(clients.archivedAt) : isNull(clients.archivedAt),
        q.sector ? eq(clients.sector, q.sector) : undefined,
        q.tier ? eq(clients.ndpcTier, q.tier as ClientInput["ndpcTier"]) : undefined,
        after ? sql`${clients.id} > ${after}` : undefined,
      ];
      if (q.search) {
        const like = `%${q.search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        conds.push(
          or(
            ilike(clients.name, like),
            ilike(clients.rcNumber, like),
            sql`exists (select 1 from ${domains} d where d.client_id = ${clients.id} and d.hostname ilike ${like})`,
          ),
        );
      }
      const rows = await tx
        .select({
          id: clients.id,
          name: clients.name,
          rcNumber: clients.rcNumber,
          sector: clients.sector,
          ndpcTier: clients.ndpcTier,
          archivedAt: clients.archivedAt,
          createdAt: clients.createdAt,
          domainCount: sql<number>`(select count(*)::int from ${domains} d where d.client_id = ${clients.id})`,
        })
        .from(clients)
        .where(and(...conds))
        .orderBy(asc(clients.id))
        .limit(q.limit + 1);
      const items = rows.slice(0, q.limit).map((r) => ({
        ...r,
        // Filled in once scans exist (Step 22).
        lastScanAt: null as string | null,
        openFindings: null as { critical: number; high: number } | null,
      }));
      const last = items[items.length - 1];
      return { items, nextCursor: rows.length > q.limit && last ? encodeCursor(last.id) : null };
    });
  }

  async create(orgId: string, actor: Actor, input: ClientInput) {
    return this.db.withOrg(orgId, async (tx) => {
      const [c] = await tx
        .insert(clients)
        .values({ orgId, ...input, rcNumber: input.rcNumber || null, createdBy: actor.userId })
        .returning({ id: clients.id });
      await this.audit.recordInOrg(tx, orgId, { action: "client.created", actorUserId: actor.userId, ip: actor.ip, targetType: "client", targetId: c!.id, metadata: { name: input.name } });
      return this.detailIn(tx, orgId, c!.id);
    });
  }

  async detail(orgId: string, clientId: string) {
    return this.db.withOrg(orgId, (tx) => this.detailIn(tx, orgId, clientId));
  }

  async update(orgId: string, actor: Actor, clientId: string, patch: Partial<ClientInput>) {
    return this.db.withOrg(orgId, async (tx) => {
      const c = await this.clientOrThrow(tx, clientId);
      if (c.archivedAt) throw archived();
      await tx.update(clients).set({ ...patch, ...(patch.rcNumber !== undefined ? { rcNumber: patch.rcNumber || null } : {}) }).where(eq(clients.id, clientId));
      await this.audit.recordInOrg(tx, orgId, { action: "client.updated", actorUserId: actor.userId, ip: actor.ip, targetType: "client", targetId: clientId, metadata: { fields: Object.keys(patch) } });
      return this.detailIn(tx, orgId, clientId);
    });
  }

  /** CLI-04: archive keeps history and blocks new scans. */
  async archive(orgId: string, actor: Actor, clientId: string) {
    await this.db.withOrg(orgId, async (tx) => {
      const c = await this.clientOrThrow(tx, clientId);
      if (c.archivedAt) return;
      await tx.update(clients).set({ archivedAt: new Date() }).where(eq(clients.id, clientId));
      await this.audit.recordInOrg(tx, orgId, { action: "client.archived", actorUserId: actor.userId, ip: actor.ip, targetType: "client", targetId: clientId });
    });
  }

  async addDomain(orgId: string, actor: Actor, clientId: string, input: { hostname: string; extraUrls: string[] }) {
    return this.db.withOrg(orgId, async (tx) => {
      const c = await this.clientOrThrow(tx, clientId);
      if (c.archivedAt) throw archived();
      const [taken] = await tx.select({ clientId: domains.clientId }).from(domains).where(and(eq(domains.orgId, orgId), eq(domains.hostname, input.hostname)));
      if (taken) {
        throw new ProblemException(409, "conflict", "That domain is already added", taken.clientId === clientId ? "It's already on this client." : "It belongs to another of your clients.");
      }
      const [d] = await tx.insert(domains).values({ orgId, clientId, ...input }).returning({ id: domains.id });
      await this.audit.recordInOrg(tx, orgId, { action: "domain.added", actorUserId: actor.userId, ip: actor.ip, targetType: "domain", targetId: d!.id, metadata: { hostname: input.hostname, clientId } });
      return this.detailIn(tx, orgId, clientId);
    });
  }

  async updateDomain(orgId: string, actor: Actor, domainId: string, extraUrls: string[]) {
    return this.db.withOrg(orgId, async (tx) => {
      const d = await this.domainOrThrow(tx, domainId);
      await tx.update(domains).set({ extraUrls }).where(eq(domains.id, domainId));
      await this.audit.recordInOrg(tx, orgId, { action: "domain.updated", actorUserId: actor.userId, ip: actor.ip, targetType: "domain", targetId: domainId, metadata: { extraUrls: extraUrls.length } });
      return this.detailIn(tx, orgId, d.clientId);
    });
  }

  async removeDomain(orgId: string, actor: Actor, domainId: string) {
    await this.db.withOrg(orgId, async (tx) => {
      const d = await this.domainOrThrow(tx, domainId);
      // Once scans exist (Step 22) a scanned domain is kept for its evidence history.
      await tx.delete(domains).where(eq(domains.id, domainId));
      await this.audit.recordInOrg(tx, orgId, { action: "domain.removed", actorUserId: actor.userId, ip: actor.ip, targetType: "domain", targetId: domainId, metadata: { hostname: d.hostname } });
    });
  }

  async domainHost(orgId: string, domainId: string): Promise<string> {
    return this.db.withOrg(orgId, async (tx) => (await this.domainOrThrow(tx, domainId)).hostname);
  }

  /** The exact statement the user is asked to confirm, for this firm, client and domain. */
  async statementFor(orgId: string, domainId: string) {
    return this.db.withOrg(orgId, async (tx) => {
      const d = await this.domainOrThrow(tx, domainId);
      const [c] = await tx.select({ name: clients.name }).from(clients).where(eq(clients.id, d.clientId));
      const [o] = await tx.select({ name: organisations.name }).from(organisations).where(eq(organisations.id, orgId));
      return { statementVersion: ATTESTATION_VERSION, statement: attestationText(o!.name, c!.name, d.hostname) };
    });
  }

  /** CLI-03: record who confirmed the engagement, when and from where. */
  async attest(orgId: string, actor: Actor, domainId: string) {
    const { statement, statementVersion } = await this.statementFor(orgId, domainId);
    return this.db.withOrg(orgId, async (tx) => {
      const d = await this.domainOrThrow(tx, domainId);
      const [a] = await tx
        .insert(authorisations)
        .values({ orgId, domainId, userId: actor.userId, statementVersion, statement, ip: actor.ip ?? null })
        .returning({ id: authorisations.id, createdAt: authorisations.createdAt });
      await this.audit.recordInOrg(tx, orgId, {
        action: "domain.authorised",
        actorUserId: actor.userId,
        ip: actor.ip,
        targetType: "domain",
        targetId: domainId,
        metadata: { hostname: d.hostname, statementVersion },
      });
      return { id: a!.id, statementVersion, createdAt: a!.createdAt };
    });
  }

  /**
   * Scan precondition (used by Step 22): the client is active and every domain
   * to scan carries an attestation for the current statement version.
   */
  async assertScannable(tx: Tx, clientId: string, domainIds: string[]) {
    const c = await this.clientOrThrow(tx, clientId);
    if (c.archivedAt) throw archived();
    if (domainIds.length === 0) throw new ProblemException(400, "validation_failed", "Add a domain before scanning");
    const ds = await tx.select({ id: domains.id, hostname: domains.hostname }).from(domains).where(and(eq(domains.clientId, clientId), inArray(domains.id, domainIds)));
    if (ds.length !== domainIds.length) throw notFound("Domain");
    const attested = await tx
      .selectDistinct({ domainId: authorisations.domainId })
      .from(authorisations)
      .where(and(inArray(authorisations.domainId, domainIds), eq(authorisations.statementVersion, ATTESTATION_VERSION)));
    const ok = new Set(attested.map((a) => a.domainId));
    const missing = ds.filter((d) => !ok.has(d.id)).map((d) => d.hostname);
    if (missing.length) {
      throw new ProblemException(409, "attestation_required", "Confirm you're engaged before scanning", `Sign the authorisation for ${missing.join(", ")} first.`);
    }
  }

  // ---- helpers ----

  private async detailIn(tx: Tx, orgId: string, clientId: string) {
    const c = await this.clientOrThrow(tx, clientId);
    const ds = await tx.select().from(domains).where(eq(domains.clientId, clientId)).orderBy(asc(domains.createdAt));
    const atts = ds.length
      ? await tx
          .select({
            domainId: authorisations.domainId,
            statementVersion: authorisations.statementVersion,
            createdAt: authorisations.createdAt,
            userName: users.name,
          })
          .from(authorisations)
          .leftJoin(users, eq(users.id, authorisations.userId))
          .where(inArray(authorisations.domainId, ds.map((d) => d.id)))
          .orderBy(desc(authorisations.createdAt))
      : [];
    const [{ n } = { n: 0 }] = await tx.select({ n: count() }).from(domains).where(eq(domains.orgId, orgId));
    return {
      ...c,
      domains: ds.map((d) => {
        const latest = atts.find((a) => a.domainId === d.id);
        return {
          id: d.id,
          hostname: d.hostname,
          extraUrls: d.extraUrls,
          createdAt: d.createdAt,
          authorisation: latest
            ? { current: latest.statementVersion === ATTESTATION_VERSION, by: latest.userName, at: latest.createdAt, statementVersion: latest.statementVersion }
            : null,
        };
      }),
      orgDomainCount: n,
    };
  }

  private async clientOrThrow(tx: Tx, clientId: string) {
    const [c] = await tx.select().from(clients).where(eq(clients.id, clientId));
    if (!c) throw notFound("Client");
    return c;
  }

  private async domainOrThrow(tx: Tx, domainId: string) {
    const [d] = await tx.select().from(domains).where(eq(domains.id, domainId));
    if (!d) throw notFound("Domain");
    return d;
  }
}

function archived() {
  return new ProblemException(409, "client_archived", "This client is archived", "Archived clients keep their history but can't be changed or scanned.");
}
