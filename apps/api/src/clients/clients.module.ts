import { Module } from "@nestjs/common";
import { OrgsModule } from "../orgs/orgs.module.js";
import { ClientsController } from "./clients.controller.js";
import { ClientsService } from "./clients.service.js";

@Module({
  imports: [OrgsModule],
  controllers: [ClientsController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class ClientsModule {}
