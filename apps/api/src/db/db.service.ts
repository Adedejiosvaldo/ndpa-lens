import { Inject, Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import { APP_CONFIG, type AppConfig } from "../config/config.js";

export type Db = NodePgDatabase;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly pool: pg.Pool;
  readonly db: Db;
  private readonly logger = new Logger(DbService.name);

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 10, connectionTimeoutMillis: 3_000 });
    // Idle clients emit 'error' when Postgres restarts or drops them. Without a
    // listener Node treats it as unhandled and the whole API exits.
    this.pool.on("error", (err) => this.logger.warn(`Idle Postgres connection lost: ${err.message}`));
    this.db = drizzle(this.pool);
  }

  /**
   * Run `fn` in a transaction scoped to one organisation. Sets `app.org_id`
   * with is_local=true, so it ends with the transaction and never leaks to the
   * next user of the pooled connection. RLS policies (Step 06) key on it.
   */
  async withOrg<T>(orgId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.org_id', ${orgId}, true)`);
      return fn(tx);
    });
  }

  async ping(): Promise<void> {
    await this.pool.query("select 1");
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
