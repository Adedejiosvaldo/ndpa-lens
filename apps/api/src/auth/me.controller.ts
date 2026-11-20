import { Controller, Delete, Get, HttpCode, Inject, Param, ParseUUIDPipe, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Request } from "express";
import { AuditService } from "../audit/audit.service.js";
import { ProblemException } from "../common/problem.js";
import { memberships, organisations, users } from "../db/schema.js";
import { AUTH_DB } from "./auth-db.js";
import { type Auth, BETTER_AUTH } from "./auth.factory.js";
import { authHeaders, clientIp } from "./http.js";
import { AllowWithoutMfa, type AuthContext, CurrentAuth, SessionGuard } from "./session.guard.js";

@ApiTags("me")
@Controller("me")
@UseGuards(SessionGuard)
@AllowWithoutMfa()
export class MeController {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    @Inject(AUTH_DB) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
  ) {}

  /** Profile + memberships. */
  @Get()
  async me(@CurrentAuth() a: AuthContext) {
    const [u] = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        emailVerified: users.emailVerified,
        twoFactorEnabled: users.twoFactorEnabled,
        isPlatformAdmin: users.isPlatformAdmin,
      })
      .from(users)
      .where(eq(users.id, a.user.id));
    const orgs = await this.db
      .select({ orgId: organisations.id, name: organisations.name, role: memberships.role })
      .from(memberships)
      .innerJoin(organisations, eq(organisations.id, memberships.organizationId))
      .where(eq(memberships.userId, a.user.id));
    return { user: u, memberships: orgs };
  }

  /** AUTH-06: list active sessions. Tokens never leave the server. */
  @Get("sessions")
  async sessions(@CurrentAuth() a: AuthContext, @Req() req: Request) {
    const list = await this.auth.api.listSessions({ headers: authHeaders(req) });
    return {
      items: list.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress ?? null,
        userAgent: s.userAgent ?? null,
        createdAt: s.createdAt,
        lastSeenAt: s.updatedAt,
        expiresAt: s.expiresAt,
        current: s.id === a.session.id,
      })),
    };
  }

  /** AUTH-06: revoke one of your own sessions. */
  @Delete("sessions/:id")
  @HttpCode(204)
  async revoke(@CurrentAuth() a: AuthContext, @Param("id", new ParseUUIDPipe()) id: string, @Req() req: Request) {
    const headers = authHeaders(req);
    const target = (await this.auth.api.listSessions({ headers })).find((s) => s.id === id);
    if (!target) throw new ProblemException(404, "not_found", "Session not found");
    await this.auth.api.revokeSession({ headers, body: { token: target.token } });
    await this.audit.record({ action: "auth.session_revoked", actorUserId: a.user.id, targetType: "session", targetId: id, ip: clientIp(req) });
  }
}
