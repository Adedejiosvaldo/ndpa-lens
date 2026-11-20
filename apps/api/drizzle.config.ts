import { defineConfig } from "drizzle-kit";

// Generates SQL from src/db/schema.ts. Roles, RLS and grants live in hand-written
// (custom) migrations. Apply with `pnpm db:migrate`.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
