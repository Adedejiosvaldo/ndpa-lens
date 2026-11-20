import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import type { Express } from "express";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { CSRF_HEADER } from "./auth/csrf.js";
import type { AppConfig } from "./config/config.js";

/** Build the configured app. Shared by main.ts; tests use configureApp on a testing module. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  return configureApp(app, config);
}

export function configureApp(app: INestApplication, config: AppConfig): INestApplication {
  const express = app.getHttpAdapter().getInstance() as Express;
  express.disable("x-powered-by");
  express.set("trust proxy", config.TRUST_PROXY);
  app.use(cookieParser());
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();
  // The web app (another origin in dev) calls the API with cookies.
  app.enableCors({
    origin: [config.WEB_URL],
    credentials: true,
    allowedHeaders: ["Content-Type", CSRF_HEADER, "Idempotency-Key", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id", "Retry-After"],
  });

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("NDPA Lens API")
      .setDescription("Stage 1 API. Errors are RFC 9457 problem+json with a stable `code`. Unsafe methods need X-CSRF-Token (GET /v1/auth/csrf).")
      .setVersion("1")
      .setOpenAPIVersion("3.1.0")
      .addCookieAuth("__Secure-ndpa.session_token")
      .build(),
  );
  SwaggerModule.setup("v1/docs", app, doc, { jsonDocumentUrl: "v1/docs/openapi.json" });
  return app;
}
