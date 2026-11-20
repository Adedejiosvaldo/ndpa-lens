import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Role } from "@ndpa/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { AuthedRequest } from "../auth/session.guard.js";
import { ProblemException } from "../common/problem.js";
import { DbService } from "../db/db.service.js";
import { memberships } from "../db/schema.js";
import { atLeast } from "./roles.js";

const MIN_ROLE = "ndpa:min-role";

/** Minimum org role for a route (PRD §2). Default: viewer. */
export const OrgRole = (role: Role) => SetMetadata(MIN_ROLE, role);

export interface OrgContext {
  id: string;
  role: Role;
}

export type OrgRequest = AuthedRequest & { org: OrgContext };

const OrgId = z.uuid();

/**
 * Service-layer tenant check (the first of PRD §9's two layers; RLS is the
 * second). Non-members get 404 so another org's existence never leaks;
 * members without the role get 403. Must run after SessionGuard.
 */
@Injectable()
export class OrgGuard implements CanActivate {
  constructor(
    private readonly db: DbService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<OrgRequest>();
    const parsed = OrgId.safeParse(req.params.orgId);
    if (!parsed.success) throw notFound();
    const orgId = parsed.data;
    const [m] = await this.db.withOrg(orgId, (tx) =>
      tx
        .select({ role: memberships.role })
        .from(memberships)
        .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, req.auth.user.id))),
    );
    if (!m) throw notFound();
    const min = this.reflector.getAllAndOverride<Role>(MIN_ROLE, [ctx.getHandler(), ctx.getClass()]) ?? "viewer";
    if (!atLeast(m.role, min)) {
      throw new ProblemException(403, "forbidden", "Your role can't do that", `This needs the ${min} role or higher.`);
    }
    req.org = { id: orgId, role: m.role };
    return true;
  }
}

export const CurrentOrg = createParamDecorator((_: unknown, ctx: ExecutionContext): OrgContext => {
  return ctx.switchToHttp().getRequest<OrgRequest>().org;
});

function notFound() {
  return new ProblemException(404, "not_found", "Not found");
}
