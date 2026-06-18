CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  facebook_link TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  niche TEXT NOT NULL,
  dm_eligible BOOLEAN DEFAULT false,
  dm_pipeline_status TEXT DEFAULT 'pending' CHECK (dm_pipeline_status IN ('pending', 'browser_active', 'message_typed', 'sent_successfully')),
  customized_script TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  scan_session_id UUID DEFAULT gen_random_uuid()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_leads" ON leads FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_leads" ON leads FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_leads" ON leads FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_leads" ON leads FOR DELETE
  TO authenticated USING (true);

CREATE INDEX idx_leads_scan_session ON leads(scan_session_id);
CREATE INDEX idx_leads_status ON leads(dm_pipeline_status);