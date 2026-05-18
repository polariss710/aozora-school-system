-- =========================================================
-- school v4.9 报销管理模块
-- =========================================================

ALTER TABLE school_expense_records
ADD COLUMN IF NOT EXISTS reimbursement_status TEXT DEFAULT 'not_required';

ALTER TABLE school_expense_records
ADD COLUMN IF NOT EXISTS reimbursement_note TEXT;

CREATE TABLE IF NOT EXISTS school_reimbursements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_date DATE NOT NULL,
  year_month TEXT NOT NULL,
  business_entity_id UUID REFERENCES school_business_entities(id),
  from_account_id UUID REFERENCES school_accounts(id),
  to_account_id UUID REFERENCES school_accounts(id),
  amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'JPY',
  status TEXT NOT NULL DEFAULT 'paid',
  note TEXT,
  app_type TEXT NOT NULL DEFAULT 'school',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS school_reimbursement_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id UUID REFERENCES school_reimbursements(id) ON DELETE CASCADE,
  expense_id UUID REFERENCES school_expense_records(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  note TEXT,
  app_type TEXT NOT NULL DEFAULT 'school',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_school_reimbursements_updated_at ON school_reimbursements;
CREATE TRIGGER trg_school_reimbursements_updated_at
BEFORE UPDATE ON school_reimbursements
FOR EACH ROW
EXECUTE FUNCTION school_set_updated_at();

DROP TRIGGER IF EXISTS trg_school_reimbursement_items_updated_at ON school_reimbursement_items;
CREATE TRIGGER trg_school_reimbursement_items_updated_at
BEFORE UPDATE ON school_reimbursement_items
FOR EACH ROW
EXECUTE FUNCTION school_set_updated_at();

CREATE INDEX IF NOT EXISTS idx_school_reimbursements_year_month ON school_reimbursements(year_month);
CREATE INDEX IF NOT EXISTS idx_school_reimbursements_from_account ON school_reimbursements(from_account_id);
CREATE INDEX IF NOT EXISTS idx_school_reimbursements_to_account ON school_reimbursements(to_account_id);
CREATE INDEX IF NOT EXISTS idx_school_reimbursement_items_reimbursement ON school_reimbursement_items(reimbursement_id);
CREATE INDEX IF NOT EXISTS idx_school_reimbursement_items_expense ON school_reimbursement_items(expense_id);

ALTER TABLE school_reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE school_reimbursement_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_allow_all_reimbursements" ON school_reimbursements;
CREATE POLICY "school_allow_all_reimbursements"
ON school_reimbursements FOR ALL
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "school_allow_all_reimbursement_items" ON school_reimbursement_items;
CREATE POLICY "school_allow_all_reimbursement_items"
ON school_reimbursement_items FOR ALL
USING (true)
WITH CHECK (true);

UPDATE school_expense_records e
SET reimbursement_status =
  CASE
    WHEN a.is_company_account = true THEN 'not_required'
    ELSE 'pending'
  END
FROM school_accounts a
WHERE e.account_id = a.id
  AND (e.reimbursement_status IS NULL OR e.reimbursement_status = 'not_required');