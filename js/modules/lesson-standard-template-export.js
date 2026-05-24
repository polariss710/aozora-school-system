// === v9.8-stable-final.16-settlement-border-fix lesson standard template export ===
// 课时管理「导出Excel」改为导出标准课时登记模板。
// 用于未来月份预登记：只生成该月每个周一代表的周，默认时长 2H，其他业务字段留空。

(function () {
  function requireXLSX() {
    if (typeof XLSX === "undefined") {
      if (typeof showMessage === "function") showMessage("Excel 导出库还没有加载完成，请稍后重试。", "error");
      return false;
    }
    return true;
  }

  function selectedMonth() {
    return document.getElementById("lessonMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function monthLabel(ym) {
    const [y, m] = String(ym || "").split("-");
    return y && m ? `${y}年${Number(m)}月` : ym;
  }

  function safeName(v) {
    return String(v || "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  }

  function mondayLabelsOfMonth(ym) {
    const [year, month] = String(ym || "").split("-").map(Number);
    if (!year || !month) return [];

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const d = new Date(first);

    // JS: Sunday=0, Monday=1
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);

    const labels = [];
    while (d <= last) {
      labels.push(`${d.getMonth() + 1}.${d.getDate()}周`);
      d.setDate(d.getDate() + 7);
    }
    return labels;
  }

  function personName(item) {
    return item?.display_name || item?.name || item?.full_name || "";
  }

  function sortedNames(list, getter) {
    return (list || [])
      .map(getter)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN"));
  }

  function buildWorkbook(ym) {
    const students = sortedNames(state.students, personName);
    const teachers = sortedNames(state.teachers, personName);
    const subjects = sortedNames(state.subjects, item => item?.name || "");
    const labels = mondayLabelsOfMonth(ym);

    const rows = [
      ["参考列表", "", "", "", monthLabel(ym)],
      ["", "", "", "", "预定课时"],
      ["学生列表", "老师列表", "科目列表", "", "学生姓名", "担当老师", "科目", "日期", "回数", "内容", "时长（H）", "课程单价", "应收课时费"],
    ];

    const bodyCount = Math.max(students.length, teachers.length, subjects.length, labels.length);
    for (let i = 0; i < bodyCount; i++) {
      rows.push([
        students[i] || "",
        teachers[i] || "",
        subjects[i] || "",
        "",
        "",
        "",
        "",
        labels[i] || "",
        "",
        "",
        labels[i] ? 2 : "",
        "",
        labels[i] ? 0 : "",
      ]);
    }

    const firstTemplateRow = 4;
    const lastTemplateRow = firstTemplateRow + labels.length - 1;
    const totalFormula = labels.length ? `SUM(K${firstTemplateRow}:K${lastTemplateRow})` : "0";
    rows.push(["", "", "", "", "", "", "", "", "", "", { f: totalFormula }, "", ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    ws["!cols"] = [
      { wch: 16 }, // 学生列表
      { wch: 16 }, // 老师列表
      { wch: 16 }, // 科目列表
      { wch: 4 },  // 分隔
      { wch: 14 }, // 学生姓名
      { wch: 14 }, // 担当老师
      { wch: 14 }, // 科目
      { wch: 12 }, // 日期
      { wch: 8 },  // 回数
      { wch: 24 }, // 内容
      { wch: 10 }, // 时长
      { wch: 12 }, // 课程单价
      { wch: 14 }, // 应收
    ];

    ws["!merges"] = [
      { s: { r: 1, c: 4 }, e: { r: 1, c: 12 } },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "标准课时登记");
    return wb;
  }

  function exportStandardLessonTemplate() {
    if (!requireXLSX()) return;

    const ym = selectedMonth();
    if (!ym) {
      if (typeof showMessage === "function") showMessage("请先选择月份。", "error");
      return;
    }

    const wb = buildWorkbook(ym);
    XLSX.writeFile(wb, `标准课时登记模板_${safeName(ym)}.xlsx`);
    if (typeof showMessage === "function") showMessage("标准课时登记 Excel 已导出。", "ok");
  }

  function bind() {
    const btn = document.getElementById("lessonExportExcelBtn");
    if (!btn) return;

    btn.textContent = "导出标准登记Excel";
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("aria-disabled");

    // 覆盖旧的课时记录导出功能
    btn.onclick = exportStandardLessonTemplate;
    btn.dataset.boundStandardTemplateExportV988 = "true";
  }

  const renderLessonsBeforeV988 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV988) {
    window.renderLessons = function () {
      renderLessonsBeforeV988();
      setTimeout(bind, 0);
    };
    try { renderLessons = window.renderLessons; } catch (e) {}
  }

  const renderAllBeforeV988 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV988) {
    window.renderAll = function () {
      renderAllBeforeV988();
      setTimeout(bind, 0);
    };
    try { renderAll = window.renderAll; } catch (e) {}
  }

  const switchPageBeforeV988 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV988) {
    window.switchPage = function (page) {
      switchPageBeforeV988(page);
      if (page === "lessons") setTimeout(bind, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(bind, 800));

  window.SchoolLessonStandardTemplateExport = {
    version: "9.8-stable-recovery-final12",
    export: exportStandardLessonTemplate,
    mondayLabelsOfMonth,
  };
})();
