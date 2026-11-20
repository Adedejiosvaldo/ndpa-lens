-- Row-level security and least-privilege grants (PRD §7, §9).
--
--   ndpa_api   tenant tables only, rows of app_current_org(); read-only, column-
--              limited access to users; nothing on sessions/accounts/
--              verifications/two_factors.
--   ndpa_auth  Better Auth: identity tables (all rows); may only INSERT audit_log.
--   audit_log  append-only for everyone: no UPDATE or DELETE grant at all.
--
-- FORCE makes the table owner obey RLS too, so a mistaken owner connection
-- fails closed. (Superusers still bypass RLS: never run the app as one.)

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO ndpa_api, ndpa_auth;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION uuidv7(), app_current_org() TO ndpa_api, ndpa_auth;--> statement-breakpoint

-- ndpa_auth: identity tables
GRANT SELECT, INSERT, UPDATE, DELETE ON users, sessions, accounts, verifications, two_factors,
  organisations, memberships, invitations TO ndpa_auth;--> statement-breakpoint
GRANT INSERT ON audit_log TO ndpa_auth;--> statement-breakpoint

-- ndpa_api: tenant tables + member display fields
GRANT SELECT (id, name, email, image, email_verified, two_factor_enabled) ON users TO ndpa_api;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON organisations TO ndpa_api;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON memberships, invitations TO ndpa_api;--> statement-breakpoint
GRANT SELECT, INSERT ON audit_log TO ndpa_api;--> statement-breakpoint

ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE organisations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invitations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;--> statement-breakpoint

CREATE POLICY organisations_api ON organisations FOR ALL TO ndpa_api
  USING (id = app_current_org()) WITH CHECK (id = app_current_org());--> statement-breakpoint
CREATE POLICY memberships_api ON memberships FOR ALL TO ndpa_api
  USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY invitations_api ON invitations FOR ALL TO ndpa_api
  USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY audit_log_api_read ON audit_log FOR SELECT TO ndpa_api
  USING (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY audit_log_api_insert ON audit_log FOR INSERT TO ndpa_api
  WITH CHECK (org_id = app_current_org());--> statement-breakpoint

CREATE POLICY organisations_auth ON organisations FOR ALL TO ndpa_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY memberships_auth ON memberships FOR ALL TO ndpa_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY invitations_auth ON invitations FOR ALL TO ndpa_auth USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY audit_log_auth_insert ON audit_log FOR INSERT TO ndpa_auth WITH CHECK (true);
