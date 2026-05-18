INSERT INTO storage.buckets (id, name, public)
VALUES ('school-expense-files', 'school-expense-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE TABLE IF NOT EXISTS school_expense_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES school_expense_records(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  storage_bucket TEXT NOT NULL DEFAULT 'school-expense-files',
  storage_path TEXT NOT NULL,
  public_url TEXT,
  source_type TEXT DEFAULT 'manual',
  extracted_text TEXT,
  note TEXT,
  app_type TEXT NOT NULL DEFAULT 'school',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_school_expense_attachments_updated_at ON school_expense_attachments;
CREATE TRIGGER trg_school_expense_attachments_updated_at
BEFORE UPDATE ON school_expense_attachments
FOR EACH ROW
EXECUTE FUNCTION school_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_school_expense_attachments_expense
ON school_expense_attachments(expense_id);

ALTER TABLE school_expense_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_allow_all_expense_attachments" ON school_expense_attachments;
CREATE POLICY "school_allow_all_expense_attachments"
ON school_expense_attachments FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "school_allow_all_storage_expense_files_select" ON storage.objects;
DROP POLICY IF EXISTS "school_allow_all_storage_expense_files_insert" ON storage.objects;
DROP POLICY IF EXISTS "school_allow_all_storage_expense_files_update" ON storage.objects;
DROP POLICY IF EXISTS "school_allow_all_storage_expense_files_delete" ON storage.objects;

CREATE POLICY "school_allow_all_storage_expense_files_select"
ON storage.objects FOR SELECT
USING (bucket_id = 'school-expense-files');

CREATE POLICY "school_allow_all_storage_expense_files_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'school-expense-files');

CREATE POLICY "school_allow_all_storage_expense_files_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'school-expense-files')
WITH CHECK (bucket_id = 'school-expense-files');

CREATE POLICY "school_allow_all_storage_expense_files_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'school-expense-files');