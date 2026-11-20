-- ownership_transfers: tenant table, same pattern as memberships (see 0002).
GRANT SELECT, INSERT, UPDATE ON ownership_transfers TO ndpa_api;--> statement-breakpoint
ALTER TABLE ownership_transfers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE ownership_transfers FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY ownership_transfers_api ON ownership_transfers FOR ALL TO ndpa_api
  USING (org_id = app_current_org()) WITH CHECK (org_id = app_current_org());
