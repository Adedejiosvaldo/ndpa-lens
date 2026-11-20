import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import type { z } from "zod";
import { clientIp } from "../auth/http.js";
import { type AuthContext, CurrentAuth, SessionGuard } from "../auth/session.guard.js";
import { PageQuery } from "../common/pagination.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { CurrentOrg, OrgGuard, type OrgContext, OrgRole } from "./org.guard.js";
import { InviteBody, OrgPatchBody, RoleBody, TransferBody } from "./orgs.dto.js";
import { type Actor, OrgsService } from "./orgs.service.js";

const actor = (a: AuthContext, o: OrgContext, req: Request): Actor => ({ userId: a.user.id, role: o.role, ip: clientIp(req) });

/** /v1/orgs/{orgId}/… — membership and role checked by OrgGuard, rows confined by RLS. */
@ApiTags("orgs")
@Controller("orgs/:orgId")
@UseGuards(SessionGuard, OrgGuard)
export class OrgsController {
  constructor(private readonly orgs: OrgsService) {}

  @Get()
  profile(@CurrentOrg() o: OrgContext) {
    return this.orgs.profile(o.id);
  }

  @Patch()
  @OrgRole("admin")
  update(@Body(new ZodPipe(OrgPatchBody)) body: z.infer<typeof OrgPatchBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.orgs.updateProfile(o.id, actor(a, o, req), body);
  }

  @Get("members")
  @OrgRole("admin")
  async members(@CurrentOrg() o: OrgContext) {
    return { items: await this.orgs.members(o.id) };
  }

  @Patch("members/:userId")
  @OrgRole("admin")
  @HttpCode(204)
  changeRole(
    @Param("userId", new ParseUUIDPipe()) userId: string,
    @Body(new ZodPipe(RoleBody)) body: z.infer<typeof RoleBody>,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    return this.orgs.changeRole(o.id, actor(a, o, req), userId, body.role);
  }

  /** Admins remove members; anyone may remove themselves (leave). */
  @Delete("members/:userId")
  @HttpCode(204)
  remove(@Param("userId", new ParseUUIDPipe()) userId: string, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.orgs.removeMember(o.id, actor(a, o, req), userId);
  }

  @Get("invitations")
  @OrgRole("admin")
  async invitations(@CurrentOrg() o: OrgContext) {
    return { items: await this.orgs.invitations(o.id) };
  }

  @Post("invitations")
  @OrgRole("admin")
  @HttpCode(201)
  invite(@Body(new ZodPipe(InviteBody)) body: z.infer<typeof InviteBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.orgs.invite(o.id, actor(a, o, req), body.email, body.role);
  }

  @Delete("invitations/:invitationId")
  @OrgRole("admin")
  @HttpCode(204)
  cancelInvitation(
    @Param("invitationId", new ParseUUIDPipe()) invitationId: string,
    @CurrentAuth() a: AuthContext,
    @CurrentOrg() o: OrgContext,
    @Req() req: Request,
  ) {
    return this.orgs.cancelInvitation(o.id, actor(a, o, req), invitationId);
  }

  @Get("ownership-transfer")
  async transfer(@CurrentOrg() o: OrgContext) {
    return { pending: await this.orgs.pendingTransfer(o.id) };
  }

  @Post("ownership-transfer")
  @OrgRole("owner")
  @HttpCode(202)
  async requestTransfer(@Body(new ZodPipe(TransferBody)) body: z.infer<typeof TransferBody>, @CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    await this.orgs.requestTransfer(o.id, actor(a, o, req), body.userId);
    return { status: "pending" };
  }

  @Delete("ownership-transfer")
  @OrgRole("owner")
  @HttpCode(204)
  cancelTransfer(@CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.orgs.cancelTransfer(o.id, actor(a, o, req));
  }

  /** The named member accepts the transfer. */
  @Post("ownership-transfer/accept")
  @HttpCode(204)
  acceptTransfer(@CurrentAuth() a: AuthContext, @CurrentOrg() o: OrgContext, @Req() req: Request) {
    return this.orgs.acceptTransfer(o.id, actor(a, o, req));
  }

  @Get("audit-log")
  @OrgRole("admin")
  auditLog(@Query(new ZodPipe(PageQuery)) q: z.infer<typeof PageQuery>, @CurrentOrg() o: OrgContext) {
    return this.orgs.auditLog(o.id, q.cursor, q.limit);
  }
}
