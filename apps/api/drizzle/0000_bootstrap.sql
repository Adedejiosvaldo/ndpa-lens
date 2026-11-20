-- Bootstrap: extensions, uuidv7(), app_current_org() and the two NOLOGIN roles.
-- Runs as the database owner. Role passwords/LOGIN are set outside migrations
-- (`pnpm db:roles`) so no secret is ever stored in SQL.

CREATE EXTENSION IF NOT EXISTS citext;--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS pgcrypto;--> statement-breakpoint

-- RFC 9562 UUID version 7: 48-bit Unix ms timestamp + random. Sortable by time.
-- (Postgres 18 has a built-in uuidv7(); we run 16.)
CREATE OR REPLACE FUNCTION uuidv7() RETURNS uuid
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  b bytea;
BEGIN
  b := substring(int8send(floor(extract(epoch FROM clock_timestamp()) * 1000)::bigint) FROM 3)
       || gen_random_bytes(10);
  b := set_byte(b, 6, (b'0111' || get_byte(b, 6)::bit(4))::bit(8)::int);  -- version 7
  b := set_byte(b, 8, (b'10' || get_byte(b, 8)::bit(6))::bit(8)::int);    -- RFC 4122 variant
  RETURN encode(b, 'hex')::uuid;
END $$;--> statement-breakpoint

-- The organisation of the current request, set by DbService.withOrg() with
-- set_config('app.org_id', …, true). NULL when unset, so policies fail closed.
CREATE OR REPLACE FUNCTION app_current_org() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.org_id', true), '')::uuid
$$;--> statement-breakpoint

DO $$
BEGIN
  -- API traffic: tenant-scoped by RLS, no access to credentials or sessions.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ndpa_api') THEN
    CREATE ROLE ndpa_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
  -- Better Auth only: identity tables, never tenant business data.
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ndpa_auth') THEN
    CREATE ROLE ndpa_auth NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END $$;
