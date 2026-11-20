import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

/** apps/api/drizzle, from both src/db (tsx, tests) and dist/db (built). */
export const MIGRATIONS_DIR = fileURLToPath(new URL("../../drizzle", import.meta.url));

/** Apply pending migrations as the database owner. */
export async function runMigrations(ownerUrl: string): Promise<void> {
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await pool.end();
  }
}

/**
 * Give the NOLOGIN roles created by migration 0000 a login and password.
 * Kept out of migrations so secrets never land in SQL files or the journal.
 */
export async function configureRoles(ownerUrl: string, passwords: { api: string; auth: string }): Promise<void> {
  const pool = new pg.Pool({ connectionString: ownerUrl, max: 1 });
  try {
    for (const [role, password] of [
      ["ndpa_api", passwords.api],
      ["ndpa_auth", passwords.auth],
    ] as const) {
      if (password.length < 16) throw new Error(`${role} password must be at least 16 characters`);
      const { rows } = await pool.query<{ stmt: string }>("select format('ALTER ROLE %I LOGIN PASSWORD %L', $1::text, $2::text) as stmt", [
        role,
        password,
      ]);
      await pool.query(rows[0]!.stmt);
    }
  } finally {
    await pool.end();
  }
}

// CLI: `pnpm db:migrate` (migrations) and `pnpm db:roles` (role logins).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const owner = process.env.MIGRATION_DATABASE_URL;
  if (!owner) throw new Error("MIGRATION_DATABASE_URL is not set");
  if (process.argv.includes("--roles")) {
    const api = process.env.DB_API_PASSWORD ?? "";
    const auth = process.env.DB_AUTH_PASSWORD ?? "";
    await configureRoles(owner, { api, auth });
    console.log("Roles ndpa_api and ndpa_auth can log in.");
  } else {
    await runMigrations(owner);
    console.log("Migrations applied.");
  }
}
