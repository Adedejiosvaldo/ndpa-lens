/**
 * Create (or promote) a Platform Admin. Run once per environment:
 *   PLATFORM_ADMIN_PASSWORD='…' pnpm --filter api seed:admin -- admin@example.com "Joseph"
 * The account still has to enrol MFA at first sign-in (AUTH-05, Step 08).
 */
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { hashPassword } from "../auth/auth.factory.js";
import { accounts, auditLog, users } from "../db/schema.js";

export async function seedPlatformAdmin(authDbUrl: string, email: string, name: string, password: string) {
  if (password.length < 12) throw new Error("Password must be at least 12 characters");
  const pool = new pg.Pool({ connectionString: authDbUrl, max: 1 });
  const db = drizzle(pool);
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email.toLowerCase()));
      if (existing) {
        await tx.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, existing.id));
        await tx.insert(auditLog).values({ actorType: "system", action: "admin.promoted", targetType: "user", targetId: existing.id });
        return { id: existing.id, created: false };
      }
      const [u] = await tx
        .insert(users)
        .values({ email: email.toLowerCase(), name, emailVerified: true, isPlatformAdmin: true })
        .returning({ id: users.id });
      // Same shape Better Auth uses for email/password credentials.
      await tx.insert(accounts).values({ userId: u!.id, accountId: u!.id, providerId: "credential", password: await hashPassword(password) });
      await tx.insert(auditLog).values({ actorType: "system", action: "admin.seeded", targetType: "user", targetId: u!.id });
      return { id: u!.id, created: true };
    });
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [email, name] = process.argv.slice(2).filter((a) => a !== "--");
  const url = process.env.AUTH_DATABASE_URL;
  const password = process.env.PLATFORM_ADMIN_PASSWORD ?? "";
  if (!email || !name || !url) throw new Error('Usage: PLATFORM_ADMIN_PASSWORD=… seed:admin -- <email> "<name>" (needs AUTH_DATABASE_URL)');
  const r = await seedPlatformAdmin(url, email, name, password);
  console.log(r.created ? `Platform Admin created: ${email}` : `Existing user promoted to Platform Admin: ${email}`);
}
