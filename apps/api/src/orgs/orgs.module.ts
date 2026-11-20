import { Module, type OnModuleInit } from "@nestjs/common";
import { SignupContext } from "../auth/signup-context.js";
import { InvitationsController } from "./invitations.controller.js";
import { OrgGuard } from "./org.guard.js";
import { OrgsController } from "./orgs.controller.js";
import { OrgsService } from "./orgs.service.js";

@Module({
  controllers: [OrgsController, InvitationsController],
  providers: [OrgsService, OrgGuard],
  exports: [OrgsService, OrgGuard],
})
export class OrgsModule implements OnModuleInit {
  constructor(
    private readonly signup: SignupContext,
    private readonly orgs: OrgsService,
  ) {}

  /** ORG-01: a new account's sign-up creates its organisation, with the user as Owner. */
  onModuleInit(): void {
    this.signup.onNewUser((userId, organisation) => this.orgs.createForNewUser(userId, organisation).then(() => undefined));
  }
}
