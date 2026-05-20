CREATE TABLE IF NOT EXISTS school_student_monthly_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES school_students(id) ON DELETE CASCADE,
  year_month TEXT NOT NULL,
  business_entity_id UUID REFERENCES school_business_entities(id),
  preset_exchange_rate NUMERIC DEFAULT 0,
  planned_lesson_fee_jpy NUMERIC DEFAULT 0,
  planned_lesson_fee_cny NUMERIC DEFAULT 0,
  actual_lesson_fee_jpy NUMERIC DEFAULT 0,
  actual_lesson_fee_cny NUMERIC DEFAULT 0,
  previous_balance_cny NUMERIC DEFAULT 0,
  received_jpy NUMERIC DEFAULT 0,
  received_cny NUMERIC DEFAULT 0,
  received_equivalent_cny NUMERIC DEFAULT 0,
  system_difference_cny NUMERIC DEFAULT 0,
  adjustment_amount_cny NUMERIC DEFAULT 0,
  adjustment_reason TEXT,
  carryover_amount_cny NUMERIC DEFAULT 0,
  settlement_status TEXT DEFAULT 'draft',
  locked_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, year_month)
);

COMMENT ON TABLE school_student_monthly_settlements IS '学生月度结算确认/锁定结果';
COMMENT ON COLUMN school_student_monthly_settlements.system_difference_cny IS '系统计算差额：实际应收人民币 - 已收折算人民币 - 上月结转';
COMMENT ON COLUMN school_student_monthly_settlements.adjustment_amount_cny IS '结算调整金额，用于抹平汇率差、尾差、小额差异';
COMMENT ON COLUMN school_student_monthly_settlements.carryover_amount_cny IS '确认后结转到下月的金额。正数=下月需补交，负数=下月结余抵扣';

CREATE INDEX IF NOT EXISTS idx_school_student_monthly_settlements_student_month
ON school_student_monthly_settlements(student_id, year_month);