import { Controller, HttpCode, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { clientIp } from "../auth/http.js";
import { AllowWithoutMfa, type AuthContext, CurrentAuth, SessionGuard } from "../auth/session.guard.js";
import { ZodPipe } from "../common/zod.pipe.js";
import { InvitationToken } from "./orgs.dto.js";
import { OrgsService } from "./orgs.service.js";

@ApiTags("orgs")
@Controller("invitations")
export class InvitationsController {
  constructor(private readonly orgs: OrgsService) {}

  /** ORG-04: the invitee, signed in with the invited email, joins the organisation. */
  @Post(":token/accept")
  @HttpCode(200)
  @UseGuards(SessionGuard)
  @AllowWithoutMfa()
  accept(@Param("token", new ZodPipe(InvitationToken)) token: string, @CurrentAuth() a: AuthContext, @Req() req: Request) {
    return this.orgs.acceptInvitation(token, a.user, clientIp(req));
  }
}
