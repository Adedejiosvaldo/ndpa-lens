-- Clients, domains, authorisations: tenant tables (same pattern as 0002/0004).
-- authorisations is append-only: an attestation is evidence, never edited.
GRANT SELECT, INSERT, UPDATE ON clients, domains TO ndpa_api;--> statement-breakpoint
GRANT DELETE ON domains TO ndpa_api;--> statement-breakpoint
GRANT SELECT, INSERT ON authorisations TO ndpa_api;--> statement-breakpoint
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE clients FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE domains ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE domains FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE authorisations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE authorisations FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY clients_api ON clients FOR ALL TO ndpa_api
  USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY domains_api ON domains FOR ALL TO ndpa_api
  USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY authorisations_api_read ON authorisations FOR SELECT TO ndpa_api
  USING (org_id = app_current_org());--> statement-breakpoint
CREATE POLICY authorisations_api_insert ON authorisations FOR INSERT TO ndpa_api
  WITH CHECK (org_id = app_current_org());--> statement-breakpoint
-- A domain belongs to a client of the same organisation.
CREATE OR REPLACE FUNCTION domains_same_org() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM clients c WHERE c.id = NEW.client_id AND c.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'domain client must belong to the same organisation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
CREATE TRIGGER domains_same_org BEFORE INSERT OR UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION domains_same_org();
