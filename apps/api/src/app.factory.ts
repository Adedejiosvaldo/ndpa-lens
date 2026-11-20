import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import type { AppConfig } from "./config/config.js";

/** Build the configured app. Shared by main.ts and the integration tests. */
export async function createApp(config: AppConfig): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(config), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("v1");
  app.enableShutdownHooks();
  // Express defaults that leak or aren't wanted on a JSON API.
  app.getHttpAdapter().getInstance().disable("x-powered-by");

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("NDPA Lens API")
      .setDescription("Stage 1 API. Errors are RFC 9457 problem+json with a stable `code`.")
      .setVersion("1")
      .setOpenAPIVersion("3.1.0")
      .build(),
  );
  SwaggerModule.setup("v1/docs", app, doc, { jsonDocumentUrl: "v1/docs/openapi.json" });
  return app;
}
