// === v9.0 lesson-import.js ===
// 完整课时导入模块边界。后续 Excel 读取、回数、计费、实际分钟数逻辑迁移到这里。
window.SchoolModules = window.SchoolModules || {};
window.SchoolModules["lesson-import.js"] = { version: "9.0", migrated: false };


// === v9.1.6 import teacher settlement month ===
// 完整课时导入读取“工资结算月份”列。
// 支持：2026.4 / 2026.04 / 2026-04 / 2026/04 / 2026年4月。
// 只写入实际课时的 teacher_settlement_month；预定课时不写入。
function normalizeTeacherSettlementMonthV916(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(value);
    const m = text.match(/^(\d{4})(?:\.(\d{1,2}))?$/);
    if (m) {
      const month = String(Number(m[2] || "1")).padStart(2, "0");
      return `${m[1]}-${month}`;
    }
  }

  const text = String(value).trim();
  if (!text) return "";

  let m = text.match(/^(\d{4})[.\-/年](\d{1,2})月?$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  m = text.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return "";
}

window.normalizeTeacherSettlementMonthV916 = normalizeTeacherSettlementMonthV916;

