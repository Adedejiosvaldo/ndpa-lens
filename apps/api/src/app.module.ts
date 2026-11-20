import { randomUUID } from "node:crypto";
import { type DynamicModule, Global, Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { LoggerModule } from "nestjs-pino";
import { IdempotencyInterceptor } from "./common/idempotency.js";
import { ProblemFilter } from "./common/problem.filter.js";
import { AuthModule } from "./auth/auth.module.js";
import { APP_CONFIG, type AppConfig } from "./config/config.js";
import { DbService } from "./db/db.service.js";
import { HealthController } from "./health/health.controller.js";
import { RedisService } from "./redis/redis.service.js";

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{1,128}$/;

@Global()
@Module({})
export class AppModule {
  static forRoot(config: AppConfig): DynamicModule {
    return {
      module: AppModule,
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: config.LOG_LEVEL,
            // Keep a caller's X-Request-Id when it looks safe, else mint one; echo it back.
            genReqId: (req, res) => {
              const incoming = req.headers["x-request-id"];
              const id = typeof incoming === "string" && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
              res.setHeader("X-Request-Id", id);
              return id;
            },
            redact: ["req.headers.cookie", "req.headers.authorization", 'req.headers["x-csrf-token"]', 'res.headers["set-cookie"]'],
            autoLogging: { ignore: (req) => req.url === "/v1/health" },
            ...(config.NODE_ENV === "development" ? { transport: { target: "pino-pretty" } } : {}),
          },
        }),
        AuthModule,
      ],
      controllers: [HealthController],
      providers: [
        { provide: APP_CONFIG, useValue: config },
        DbService,
        RedisService,
        { provide: APP_FILTER, useClass: ProblemFilter },
        { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
      ],
      exports: [APP_CONFIG, DbService, RedisService, AuthModule],
    };
  }
}
