-- =========================================================
-- school v4.8 测试数据清理脚本
-- 用途：
-- 1. 删除全部收入记录
-- 2. 删除全部支出记录
-- 3. 删除全部支出附件记录
-- 4. 重置账户余额为 opening_balance
--
-- 注意：
-- Storage bucket 中已上传的实际文件不会被此 SQL 删除。
-- 如需要删除 Storage 文件，请在 Supabase Storage 页面手动清理
-- school-expense-files bucket，或后续增加系统内删除功能。
-- =========================================================

delete from school_expense_attachments;
delete from school_expense_records;
delete from school_income_records;

update school_accounts
set current_balance = opening_balance;

-- 确认结果
select
  name,
  currency,
  opening_balance,
  current_balance
from school_accounts
order by name;