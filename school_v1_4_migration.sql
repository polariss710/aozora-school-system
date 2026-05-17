-- school v1.4 科目分类扩展
ALTER TABLE school_subjects
ADD COLUMN IF NOT EXISTS primary_category TEXT DEFAULT '班课';

ALTER TABLE school_subjects
ADD COLUMN IF NOT EXISTS tertiary_category TEXT;

-- 兼容旧数据：原 category 作为二级分类
UPDATE school_subjects
SET primary_category = COALESCE(primary_category, '班课')
WHERE primary_category IS NULL;

UPDATE school_subjects
SET category = COALESCE(category, '学部进学')
WHERE category IS NULL OR category = '';

-- 如果已有排序为空，补默认排序
UPDATE school_subjects
SET sort_order = 0
WHERE sort_order IS NULL;
