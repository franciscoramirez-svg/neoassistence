CREATE TABLE IF NOT EXISTS login_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employee_id TEXT,
  employee_name TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  detail TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE login_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read login_log"
  ON login_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service can insert login_log"
  ON login_log FOR INSERT
  WITH CHECK (true);
