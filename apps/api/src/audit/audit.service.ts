import { Inject, Injectable, Logger } from "@nestjs/common";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Tx } from "../db/db.service.js";
import { auditLog } from "../db/schema.js";
import { AUTH_DB } from "../auth/auth-db.js";

export interface AuditEvent {
  action: string;
  actorType?: "user" | "platform_admin" | "system" | "public";
  actorUserId?: string | null;
  orgId?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Append-only security audit trail (PRD §9). Account-level events (org_id null)
 * are written through the ndpa_auth role, which may only INSERT.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@Inject(AUTH_DB) private readonly db: NodePgDatabase) {}

  /**
   * Org-scoped event inside the caller's withOrg() transaction, so it commits or
   * rolls back with the change it describes. RLS checks org_id.
   */
  async recordInOrg(tx: Tx, orgId: string, e: Omit<AuditEvent, "orgId">): Promise<void> {
    await tx.insert(auditLog).values({
      action: e.action,
      actorType: e.actorType ?? "user",
      actorUserId: e.actorUserId ?? null,
      orgId,
      targetType: e.targetType,
      targetId: e.targetId,
      ip: e.ip ?? null,
      metadata: e.metadata ?? {},
    });
  }

  async record(e: AuditEvent): Promise<void> {
    try {
      await this.db.insert(auditLog).values({
        action: e.action,
        actorType: e.actorType ?? "user",
        actorUserId: e.actorUserId ?? null,
        orgId: e.orgId ?? null,
        targetType: e.targetType,
        targetId: e.targetId,
        ip: e.ip ?? null,
        metadata: e.metadata ?? {},
      });
    } catch (err) {
      // An audit failure is serious but must not turn a login into a 500.
      this.logger.error(`Audit write failed for ${e.action}: ${(err as Error).message}`);
    }
  }
}
