// === v9.6.1 teacher duty declaration template export ===
// 导出给老师填写的勤务申报模板。
// 注意：模板不包含业务归属、时给、课程工资、系统工资金额等内部保密信息。

(function () {
  function escHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function currentMonth() {
    return document.getElementById("teacherWageMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function teacherDisplayName(row) {
    return row?.teacher_name || row?.row?.teacher?.display_name || row?.row?.teacher?.name || "老师";
  }

  function safeFileName(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "template";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = String(value).slice(0, 10);
    const dt = new Date(`${d}T00:00:00`);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    if (Number.isNaN(dt.getTime())) return d;
    return `${d.replaceAll("-", "/")}（${weekdays[dt.getDay()]}）`;
  }

  function formatTime(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }

  function formatHours(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function workContent(row) {
    const parts = [
      row.student_name || "",
      row.subject_name || "",
    ].filter(Boolean);

    const content = row.lesson_content || row.row?.lesson_content || row.row?.note || "";
    if (content && !parts.join(" ").includes(content)) parts.push(content);

    return parts.join(" / ");
  }

  function currentRows() {
    const api = window.SchoolTeacherWagesModule;
    if (!api?.currentWageRowsForLock) return [];
    return api.currentWageRowsForLock()
      .filter(item => item?.row && item?.wage?.hasRule)
      .sort((a, b) =>
        String(a.teacher_name || "").localeCompare(String(b.teacher_name || ""), "zh-Hans-CN") ||
        String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")) ||
        String(a.start_time || "").localeCompare(String(b.start_time || ""))
      );
  }

  function groupByTeacher(rows) {
    const map = new Map();
    rows.forEach(row => {
      const id = row.teacher_id || row.teacher_name || "unknown";
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    });
    return Array.from(map.values());
  }

  function rowsHtml(rows) {
    const safeRows = rows.slice(0, 31);
    const bodyRows = safeRows.map((row, i) => {
      const excelRow = i + 4;
      return `
        <tr>
          <td class="center">${escHtml(formatDate(row.lesson_date))}</td>
          <td colspan="2" class="left">${escHtml(workContent(row))}</td>
          <td class="center">${escHtml(formatTime(row.start_time))}</td>
          <td class="center">${escHtml(formatTime(row.end_time))}</td>
          <td class="num">${formatHours(row.wage?.hours)}</td>
          <td class="num">0</td>
          <td class="num">0</td>
          <td class="left"></td>
        </tr>`;
    });

    for (let i = safeRows.length; i < 31; i++) {
      bodyRows.push(`
        <tr>
          <td class="center"></td><td colspan="2" class="left"></td><td class="center"></td><td class="center"></td><td class="num">0</td><td class="num">0</td><td class="num">0</td><td class="left"></td>
        </tr>`);
    }

    return bodyRows.join("");
  }

  function buildWorkbookHtml(rows) {
    const month = currentMonth();
    const [year, monthNo] = month.split("-");
    const teacher = teacherDisplayName(rows[0]);
    const totalRow = 35;

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  body { font-family: "Yu Gothic", "Meiryo", sans-serif; }
  table { border-collapse: collapse; width: 100%; table-layout: fixed; }
  td, th { border: 1px solid #999; padding: 6px; font-size: 12px; vertical-align: middle; }
  .title { font-size: 18px; font-weight: 700; text-align: center; background: #eaf4ff; }
  .head { background: #d9ead3; font-weight: 700; text-align: center; }
  .section { background: #fce5cd; font-weight: 700; }
  .center { text-align: center; }
  .left { text-align: left; }
  .num { text-align: right; }
  .muted { color: #666; font-size: 11px; background: #fff; }
  .plain { background: #fff; }
</style>
</head>
<body>
<table>
  <colgroup>
    <col style="width: 17%;" />
    <col style="width: 19%;" />
    <col style="width: 19%;" />
    <col style="width: 8.5%;" />
    <col style="width: 8.5%;" />
    <col style="width: 8%;" />
    <col style="width: 10%;" />
    <col style="width: 10%;" />
    <col style="width: 10%;" />
  </colgroup>
  <tr><td colspan="9" class="title">勤务申报表（讲师填写用）</td></tr>
  <tr>
    <td class="head">月份</td><td class="center">${escHtml(year || "")}年${escHtml(monthNo || "")}月</td>
    <td class="head">姓名</td><td colspan="2" class="center">${escHtml(teacher)}</td>
    <td class="head">支付方式</td><td colspan="3" class="center">日元银行 / 支付宝 / 微信</td>
  </tr>
  <tr>
    <td colspan="9" class="muted">
      ※ 本表仅用于勤务时间、交通费、教室费和支付方式申报。请勿修改系统已填写的日期、工作内容、开始时间、结束时间、时长。
    </td>
  </tr>
  <tr>
    <td class="head">日期及星期</td>
    <td colspan="2" class="head">工作内容</td>
    <td class="head">开始时间</td>
    <td class="head">结束时间</td>
    <td class="head">时长</td>
    <td class="head">当日交通费</td>
    <td class="head">当日教室费</td>
    <td class="head">备注</td>
  </tr>
  ${rowsHtml(rows)}
  <tr>
    <td colspan="5" class="section">合计</td>
    <td class="num section">=SUM(F4:F34)</td>
    <td class="num section">=SUM(G4:G34)</td>
    <td class="num section">=SUM(H4:H34)</td>
    <td class="section"></td>
  </tr>
  <tr><td colspan="9" class="section">日元支付（银行振込）</td></tr>
  <tr>
    <td class="head">銀行名</td><td class="head">支店番号</td><td class="head">支店名</td><td class="head">口座番号</td><td colspan="2" class="head">名義</td><td colspan="3" class="head">备注</td>
  </tr>
  <tr><td class="center"></td><td class="center"></td><td class="center"></td><td class="center"></td><td colspan="2" class="center"></td><td colspan="3" class="left"></td></tr>
  <tr><td colspan="9" class="section">人民币支付</td></tr>
  <tr>
    <td class="head">支付宝</td><td colspan="3" class="head">微信</td><td colspan="5" class="head">备注</td>
  </tr>
  <tr><td class="center"></td><td colspan="3" class="center"></td><td colspan="5" class="left"></td></tr>
</table>
</body>
</html>`;
  }

  function downloadExcelHtml(rows) {
    const teacher = teacherDisplayName(rows[0]);
    const month = currentMonth();
    const html = buildWorkbookHtml(rows);
    const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(teacher)}_${month}_勤务申报表.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportTemplates() {
    const rows = currentRows();
    if (!rows.length) {
      showMessage("当前筛选范围没有可导出的老师勤务记录。", "error");
      return;
    }

    const selectedTeacher = document.getElementById("teacherWageTeacherFilter")?.value || "";
    const groups = selectedTeacher ? [rows] : groupByTeacher(rows);

    if (groups.length > 1) {
      const ok = confirm(`当前未选择具体老师，将按老师分别导出 ${groups.length} 个勤务申报表。\n是否继续？`);
      if (!ok) return;
    }

    groups.forEach((group, index) => {
      setTimeout(() => downloadExcelHtml(group), index * 300);
    });

    showMessage(`已导出 ${groups.length} 个勤务申报模板。模板不包含业务归属、时给和课程工资。`, "ok");
  }

  function bindExportButton() {
    const btn = document.getElementById("teacherDutyTemplateExportBtn");
    if (!btn || btn.dataset.boundTeacherDutyExport === "true") return;
    btn.dataset.boundTeacherDutyExport = "true";
    btn.addEventListener("click", exportTemplates);
  }

  const switchPageBeforeV960 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV960) {
    window.switchPage = function(page) {
      switchPageBeforeV960(page);
      if (page === "teacher-wages") setTimeout(bindExportButton, 0);
    };
  }

  const renderAllBeforeV960 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV960) {
    window.renderAll = function() {
      renderAllBeforeV960();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        setTimeout(bindExportButton, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindExportButton, 1000);
  });

  window.SchoolTeacherDutyTemplateExportV960 = {
    version: "9.6.1",
    exportTemplates,
  };
})();
