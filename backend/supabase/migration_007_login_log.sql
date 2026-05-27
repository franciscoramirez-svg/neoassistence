CREATE TABLE IF NOT EXISTS login_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id TEXT,
  employee_name TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  detail TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_log ENABLE ROW LEVEL SECURITY;

-- Allow inserts from any source (backend uses anon key)
CREATE POLICY "Anyone can insert"
  ON login_log FOR INSERT
  WITH CHECK (true);

-- Allow reads from any source
CREATE POLICY "Anyone can read"
  ON login_log FOR SELECT
  USING (true);
