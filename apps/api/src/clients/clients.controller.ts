import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { z } from "zod";
import { clientIp } from "../auth/http.js";
import { type AuthContext, CurrentAuth, SessionGuard } from "../auth/session.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CurrentOrg, OrgGuard, type OrgContext, OrgRole } from "../orgs/org.guard.js";
import type { Actor } from "../orgs/orgs.service.js";
import { AttestBody, ClientBody, ClientListQuery, ClientPatch, DomainBody, DomainPatch, ExtraUrls } from "./clients.dto.js";
import { ClientsService } from "./clients.service.js";

const actor = (a: AuthContext, o: OrgContext, req: Request): Actor => ({ userId: a.user.id, role: o.role, ip: clientIp(req) });
const uuid = new ParseUUIDPipe();

/** CLI-01..05: Viewers read; Analysts and above create, edit, archive and attest (PRD §2). */
@ApiTags("clients")
@Controller("orgs/:orgId")
@UseGuards(SessionGuard, OrgGuard)
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get("clients")
  list(@Query(new ZodPipe(ClientListQuery)) q: z.infer<typeof ClientListQuery>, @CurrentOrg() o: OrgContext) {
    return this.clients.list(o.id, q);
  }

  @Post("clients")
  @OrgRole("analyst")
  @HttpCode(201)
  create(@Body(new ZodPipe(ClientBody)) body: z.infer<typeof ClientBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.clients.create(o.id, actor(a, o, req), body);
  }

  @Get("clients/:clientId")
  detail(@Param("clientId", uuid) clientId: string, @CurrentOrg() o: OrgContext) {
    return this.clients.detail(o.id, clientId);
  }

  @Patch("clients/:clientId")
  @OrgRole("analyst")
  update(
    @Param("clientId", uuid) clientId: string,
    @Body(new ZodPipe(ClientPatch)) body: z.infer<typeof ClientPatch>,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    return this.clients.update(o.id, actor(a, o, req), clientId, body);
  }

  /** CLI-04: DELETE archives; history is kept and new scans are blocked. */
  @Delete("clients/:clientId")
  @OrgRole("analyst")
  @HttpCode(204)
  archive(@Param("clientId", uuid) clientId: string, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.clients.archive(o.id, actor(a, o, req), clientId);
  }

  @Post("clients/:clientId/domains")
  @OrgRole("analyst")
  @HttpCode(201)
  addDomain(
    @Param("clientId", uuid) clientId: string,
    @Body(new ZodPipe(DomainBody)) body: z.infer<typeof DomainBody>,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    return this.clients.addDomain(o.id, actor(a, o, req), clientId, body);
  }

  @Patch("domains/:domainId")
  @OrgRole("analyst")
  async updateDomain(
    @Param("domainId", uuid) domainId: string,
    @Body(new ZodPipe(DomainPatch)) body: z.infer<typeof DomainPatch>,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    const detail = await this.clients.domainHost(o.id, domainId);
    const extra = new ZodPipe(ExtraUrls(detail)).transform(body.extraUrls);
    return this.clients.updateDomain(o.id, actor(a, o, req), domainId, extra);
  }

  @Delete("domains/:domainId")
  @OrgRole("analyst")
  @HttpCode(204)
  removeDomain(@Param("domainId", uuid) domainId: string, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.clients.removeDomain(o.id, actor(a, o, req), domainId);
  }

  /** The statement to show before attesting. */
  @Get("domains/:domainId/authorisation")
  statement(@Param("domainId", uuid) domainId: string, @CurrentOrg() o: OrgContext) {
    return this.clients.statementFor(o.id, domainId);
  }

  /** CLI-03: confirm the DPCO is engaged by the client for this domain. */
  @Post("domains/:domainId/authorisation")
  @OrgRole("analyst")
  @HttpCode(201)
  attest(
    @Param("domainId", uuid) domainId: string,
    @Body(new ZodPipe(AttestBody)) _body: z.infer<typeof AttestBody>,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    return this.clients.attest(o.id, actor(a, o, req), domainId);
  }
}
