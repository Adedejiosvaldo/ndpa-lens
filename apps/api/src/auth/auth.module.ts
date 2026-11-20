import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { AuditService } from "../audit/audit.service.js";
import { APP_CONFIG, type AppConfig } from "../config/config.js";
import { Mailer, SmtpMailer } from "../mail/mail.service.js";
import { AUTH_DB, authDbProvider } from "./auth-db.js";
import { AuthController } from "./auth.controller.js";
import { BETTER_AUTH, createAuth } from "./auth.factory.js";
import { CsrfMiddleware } from "./csrf.js";
import { LoginLimiter } from "./login-limiter.js";
import { MeController } from "./me.controller.js";
import { HibpPwnedPasswords, PwnedPasswords } from "./pwned.js";
import { SessionGuard } from "./session.guard.js";

@Module({
  controllers: [AuthController, MeController],
  providers: [
    authDbProvider,
    AuditService,
    LoginLimiter,
    SessionGuard,
    { provide: Mailer, useClass: SmtpMailer },
    { provide: PwnedPasswords, useClass: HibpPwnedPasswords },
    {
      provide: BETTER_AUTH,
      inject: [APP_CONFIG, AUTH_DB, Mailer, AuditService],
      useFactory: (config: AppConfig, db: NodePgDatabase, mailer: Mailer, audit: AuditService) =>
        createAuth({ config, db, mailer, audit }),
    },
  ],
  exports: [BETTER_AUTH, AUTH_DB, AuditService, SessionGuard, Mailer],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CsrfMiddleware).forRoutes("*path");
  }
}
