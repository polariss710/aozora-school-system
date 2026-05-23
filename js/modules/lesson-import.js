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



// === v9.1.7 require month before completed lesson import ===
// 完整课时导入必须先选择课时管理顶部月份。
// 页面月份主要用于给“3.2周 / 3.30周 / 4.1”这类模板日期提供年份。
// 例：导入 2026年3月模板时，请先选择 2026-03。

(function () {
  function selectedImportMonthV917() {
    return document.getElementById("lessonMonthFilter")?.value || "";
  }

  function requireCompletedImportMonthV917() {
    const month = selectedImportMonthV917();
    if (!month) {
      showMessage("请先选择导入模板对应的年月。例如导入 2026年3月课时，请先选择 2026-03。", "error");
      return "";
    }
    return month;
  }

  function confirmImportMonthV917(month) {
    return confirm(
      `当前选择年月：${month}\n\n系统将按 ${month.slice(0, 4)} 年解析模板中的日期。\n例如 3.30周、4.1 会按 ${month.slice(0, 4)} 年处理。\n\n确认继续导入吗？`
    );
  }

  function patchCompletedImportButtonV917() {
    const btn = document.getElementById("lessonImportCompletedExcelBtnV88");
    const input = document.getElementById("lessonImportCompletedExcelInputV88");
    if (!btn || !input || btn.dataset.boundMonthRequiredV917 === "true") return;

    btn.dataset.boundMonthRequiredV917 = "true";
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("title");
    btn.removeAttribute("aria-disabled");
    btn.onclick = () => {
      const month = requireCompletedImportMonthV917();
      if (!month) return;

      if (!confirmImportMonthV917(month)) return;
      input.click();
    };
  }

  function wrapCompletedImportFunctionV917(name) {
    const fn = window[name] || (typeof globalThis !== "undefined" ? globalThis[name] : null);
    if (typeof fn !== "function" || fn.__monthRequiredV917) return;

    const wrapped = async function(file) {
      const month = requireCompletedImportMonthV917();
      if (!month) return;
      return fn.call(this, file);
    };
    wrapped.__monthRequiredV917 = true;
    window[name] = wrapped;
  }

  function applyCompletedImportMonthRequiredV917() {
    patchCompletedImportButtonV917();

    [
      "importCompletedLessonExcelV88",
      "importCompletedLessonExcelV884",
      "importCompletedLessonExcelV885",
      "importCompletedLessonExcelV886"
    ].forEach(wrapCompletedImportFunctionV917);
  }

  const ensureBeforeV917 = typeof ensureCompletedImportButtonV884 === "function"
    ? ensureCompletedImportButtonV884
    : (typeof ensureCompletedImportButtonV88 === "function" ? ensureCompletedImportButtonV88 : null);

  if (ensureBeforeV917) {
    window.ensureCompletedImportButtonV884 = function() {
      ensureBeforeV917();
      setTimeout(applyCompletedImportMonthRequiredV917, 0);
    };
  }

  const switchPageBeforeV917 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV917) {
    window.switchPage = function(page) {
      switchPageBeforeV917(page);
      if (page === "lessons") setTimeout(applyCompletedImportMonthRequiredV917, 0);
    };
  }

  const renderAllBeforeV917 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV917) {
    window.renderAll = function() {
      renderAllBeforeV917();
      if (document.getElementById("page-lessons")?.classList.contains("active")) {
        setTimeout(applyCompletedImportMonthRequiredV917, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(applyCompletedImportMonthRequiredV917, 1000);
  });

  window.CompletedImportMonthRequiredV917 = {
    selectedMonth: selectedImportMonthV917,
    requireMonth: requireCompletedImportMonthV917,
    apply: applyCompletedImportMonthRequiredV917,
  };
})();

