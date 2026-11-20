import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import type { FactoryProvider } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

/** Drizzle on the ndpa_auth role (Better Auth and account-level audit only). */
export const AUTH_DB = Symbol("AUTH_DB");

export const authDbProvider: FactoryProvider = {
  provide: AUTH_DB,
  inject: [APP_CONFIG],
  useFactory: (config: AppConfig) => {
    const pool = new pg.Pool({ connectionString: config.AUTH_DATABASE_URL, max: 5, connectionTimeoutMillis: 3_000 });
    pool.on("error", () => {
      /* idle client dropped; next query reconnects */
    });
    return drizzle(pool);
  },
};
