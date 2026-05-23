// === v9.8-stable-final.1-student-settlement-pdf ===
// 学生月度结算 PDF 输出。
// 不参与计算；核心金额读取 DB RPC / clean summary。输出采用接近课时管理列表的上下分组格式。

(function () {
  const SUMMARY_RPC = "school_get_student_monthly_settlement_summary";

  function appState() {
    if (typeof state !== "undefined" && state) return state;
    return window.state || {};
  }

  function n(v) {
    const x = Number(v || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function money(v) {
    return Math.round(n(v)).toLocaleString();
  }

  function hours(v) {
    const x = n(v);
    if (Number.isInteger(x)) return String(x);
    return x.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }

  function jpy(v) { return `${money(v)} JPY`; }
  function cny(v) { return `${money(v)} CNY`; }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function dbClient() {
    if (typeof db !== "undefined" && db?.rpc) return db;
    if (typeof supabase !== "undefined" && supabase?.rpc) return supabase;
    if (window.db?.rpc) return window.db;
    if (window.supabase?.rpc) return window.supabase;
    return null;
  }

  function currentMonth() {
    return document.getElementById("settlementMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function currentStudentId() {
    return document.getElementById("settlementStudentFilter")?.value || "";
  }

  function monthLabel(ym) {
    const [y, m] = String(ym || "").split("-");
    return y && m ? `${y}年${Number(m)}月` : ym;
  }

  function studentName(s) {
    return s?.display_name || s?.name || "";
  }

  function getStudent(id) {
    return (appState().students || []).find(s => s.id === id) || null;
  }

  function subjectName(row) {
    return row?.subject?.name || row?.subject_name || "";
  }

  function teacherName(row) {
    return row?.teacher?.display_name || row?.teacher?.name || "";
  }

  function lessonDate(row) {
    return String(row?.lesson_date || "").slice(0, 10);
  }

  function timeText(row) {
    return [row?.start_time, row?.end_time].filter(Boolean).join("-");
  }

  function lessonFee(row) {
    return n(row?.lesson_fee || (n(row?.unit_price) * n(row?.duration_hours)));
  }

  function statusLabel(row) {
    const v = row?.status || "";
    if (typeof lessonStatusLabel === "function") return lessonStatusLabel(v);
    const map = {
      completed: "已上课",
      pending_makeup: "待补课",
      makeup_completed: "已补课",
      makeup: "补课",
      cancelled: "取消课",
      holiday: "放假",
      absent: "缺席",
      planned: "预定",
    };
    return map[v] || v;
  }

  function billableLabel(row) {
    return row?.is_billable === false ? "不计费" : "计费";
  }

  function normalizeSummary(row) {
    if (!row) return null;
    return {
      studentId: row.student_id,
      month: row.year_month,
      rate: n(row.exchange_rate),
      carryoverCny: n(row.carryover_cny),
      plannedHours: n(row.planned_hours),
      actualHours: n(row.actual_hours),
      plannedFeeJpy: n(row.planned_fee_jpy),
      plannedFeeCny: n(row.planned_fee_cny),
      plannedTotalCny: n(row.planned_total_cny),
      actualFeeJpy: n(row.actual_fee_jpy),
      actualFeeCny: n(row.actual_fee_cny),
      receivedJpy: n(row.received_jpy),
      receivedCny: n(row.received_cny),
      receivedEquivalentCny: n(row.received_equivalent_cny),
      finalDueCny: n(row.final_due_cny),
      lockedCarryoverCny: n(row.locked_carryover_cny ?? row.final_due_cny),
    };
  }

  async function fetchSummary(studentId, ym) {
    const cached = window.__studentSettlementSummaryClean || window.__studentSettlementSummaryDbV989;
    if (cached && cached.studentId === studentId && cached.month === ym) return cached;

    const client = dbClient();
    if (!client || !studentId || !ym) return null;
    const { data, error } = await client.rpc(SUMMARY_RPC, {
      p_student_id: studentId,
      p_year_month: ym,
    });
    if (error) {
      console.error("student settlement pdf summary failed", error);
      if (typeof showMessage === "function") showMessage(`读取学生月度结算DB汇总失败：${error.message || error}`, "error");
      return null;
    }
    return normalizeSummary(Array.isArray(data) ? data[0] : data);
  }

  function rowsFor(type, studentId, ym) {
    return (appState().lessonRecords || [])
      .filter(r => r.student_id === studentId && r.year_month === ym && r.lesson_type === type)
      .sort((a, b) => {
        const d = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
        if (d !== 0) return d;
        const s = subjectName(a).localeCompare(subjectName(b), "zh-Hans-CN");
        if (s !== 0) return s;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });
  }

  function detailTable(title, rows) {
    const body = rows.length ? rows.map(row => `
      <tr>
        <td>${esc(lessonDate(row))}</td>
        <td>${esc(subjectName(row))}</td>
        <td>${esc(teacherName(row))}</td>
        <td>${esc(timeText(row))}</td>
        <td class="num">${esc(hours(row.duration_hours))}</td>
        <td>${esc(statusLabel(row))}</td>
        <td>${esc(billableLabel(row))}</td>
        <td class="num">${esc(jpy(lessonFee(row)))}</td>
        <td>${esc(row.lesson_content || row.note || "")}</td>
      </tr>
    `).join("") : `<tr><td colspan="9" class="empty">没有记录</td></tr>`;

    return `
      <h2>${esc(title)}</h2>
      <table class="detail-table">
        <thead>
          <tr>
            <th>日期</th>
            <th>科目</th>
            <th>老师</th>
            <th>时间</th>
            <th>时长</th>
            <th>状态</th>
            <th>计费</th>
            <th>课时费</th>
            <th>内容</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    `;
  }

  function summaryHtml(summary) {
    const finalLabel = summary.finalDueCny >= 0
      ? `需补交 ${cny(summary.finalDueCny)}`
      : `有结余 ${cny(Math.abs(summary.finalDueCny))}`;

    return `
      <section class="summary-grid">
        <div><span>预定课时</span><strong>${esc(hours(summary.plannedHours))}</strong></div>
        <div><span>实际课时</span><strong>${esc(hours(summary.actualHours))}</strong></div>
        <div><span>预定课时费</span><strong>${esc(jpy(summary.plannedFeeJpy))}</strong></div>
        <div><span>实际课时费</span><strong>${esc(jpy(summary.actualFeeJpy))}</strong></div>
      </section>

      <section class="settlement-grid">
        <table>
          <caption>月初预定结算</caption>
          <tbody>
            <tr><th>上月结余/补交（人民币）</th><td>${esc(cny(summary.carryoverCny))}</td></tr>
            <tr><th>本月应收（日元）</th><td>${esc(jpy(summary.plannedFeeJpy))}</td></tr>
            <tr><th>本月应收（人民币）</th><td>${esc(cny(summary.plannedFeeCny))}</td></tr>
            <tr class="total"><th>本月应收合计（人民币）</th><td>${esc(cny(summary.plannedTotalCny))}</td></tr>
          </tbody>
        </table>
        <table>
          <caption>月底实际结算</caption>
          <tbody>
            <tr><th>实际课时费（日元）</th><td>${esc(jpy(summary.actualFeeJpy))}</td></tr>
            <tr><th>实际课时费（人民币）</th><td>${esc(cny(summary.actualFeeCny))}</td></tr>
            <tr><th>已收学费（人民币）</th><td>${esc(cny(summary.receivedCny))}</td></tr>
            <tr><th>已收学费（日元）</th><td>${esc(jpy(summary.receivedJpy))}</td></tr>
            <tr class="total"><th>本月补/退/结余</th><td>${esc(finalLabel)}</td></tr>
          </tbody>
        </table>
      </section>
    `;
  }

  function buildHtml(student, ym, summary, plannedRows, actualRows) {
    const printedAt = new Date().toLocaleString("ja-JP");
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${esc(studentName(student))}_${esc(ym)}_月度结算</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body { font-family: "Microsoft YaHei", "Meiryo", sans-serif; color: #1f2937; margin: 0; font-size: 11px; }
    h1 { font-size: 20px; margin: 0 0 4px; text-align: center; }
    .meta { text-align: center; color: #64748b; margin-bottom: 12px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
    .summary-grid div { border: 1px solid #bfdbfe; border-radius: 8px; padding: 8px; background: #f8fbff; }
    .summary-grid span { display: block; color: #64748b; font-size: 10px; margin-bottom: 4px; }
    .summary-grid strong { font-size: 16px; }
    .settlement-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 12px 0 14px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    caption { text-align: left; font-weight: 700; margin-bottom: 4px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; word-break: break-word; }
    th { background: #eaf4ff; font-weight: 700; }
    .settlement-grid th { width: 58%; }
    .settlement-grid td { text-align: right; font-weight: 600; }
    .total th, .total td { background: #e9fbf2; color: #065f46; }
    h2 { font-size: 14px; margin: 14px 0 5px; padding: 5px 8px; background: #eaf4ff; border-left: 4px solid #60a5fa; }
    .detail-table th:nth-child(1) { width: 11%; }
    .detail-table th:nth-child(2) { width: 12%; }
    .detail-table th:nth-child(3) { width: 10%; }
    .detail-table th:nth-child(4) { width: 11%; }
    .detail-table th:nth-child(5) { width: 7%; }
    .detail-table th:nth-child(6) { width: 8%; }
    .detail-table th:nth-child(7) { width: 7%; }
    .detail-table th:nth-child(8) { width: 12%; }
    .detail-table th:nth-child(9) { width: 22%; }
    .num { text-align: right; white-space: nowrap; }
    .empty { text-align: center; color: #64748b; padding: 14px; }
    .footer { margin-top: 12px; color: #94a3b8; text-align: right; font-size: 9px; }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      h2 { break-after: avoid; }
      table { break-inside: auto; }
      tr { break-inside: avoid; break-after: auto; }
    }
  </style>
</head>
<body>
  <h1>学生月度结算通知单</h1>
  <div class="meta">${esc(monthLabel(ym))}　${esc(studentName(student))}</div>
  ${summaryHtml(summary)}
  ${detailTable("预定课时", plannedRows)}
  ${detailTable("实际课时", actualRows)}
  <div class="footer">输出时间：${esc(printedAt)}</div>
  <script>
    window.addEventListener("load", () => {
      setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`;
  }

  async function exportPdf() {
    const studentId = currentStudentId();
    const ym = currentMonth();
    const student = getStudent(studentId);
    if (!studentId || !student) {
      if (typeof showMessage === "function") showMessage("请先选择学生。", "error");
      return;
    }

    const summary = await fetchSummary(studentId, ym);
    if (!summary) {
      if (typeof showMessage === "function") showMessage("无法读取月度结算数据。", "error");
      return;
    }

    const plannedRows = rowsFor("planned", studentId, ym);
    const actualRows = rowsFor("actual", studentId, ym);
    const html = buildHtml(student, ym, summary, plannedRows, actualRows);

    const win = window.open("", "_blank");
    if (!win) {
      if (typeof showMessage === "function") showMessage("浏览器阻止了弹出窗口，请允许弹窗后重试。", "error");
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();

    if (typeof showMessage === "function") showMessage("PDF 输出页面已打开，请在打印窗口中选择保存为 PDF。", "ok");
  }

  function bind() {
    const btn = document.getElementById("studentSettlementExportPdfBtn");
    if (!btn || btn.dataset.boundStudentSettlementPdf === "true") return;
    btn.dataset.boundStudentSettlementPdf = "true";
    btn.addEventListener("click", exportPdf);
  }

  const switchPageBeforePdf = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforePdf) {
    window.switchPage = function (page) {
      switchPageBeforePdf(page);
      if (page === "student-settlement") setTimeout(bind, 0);
    };
  }

  const renderAllBeforePdf = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforePdf) {
    window.renderAll = function () {
      renderAllBeforePdf();
      setTimeout(bind, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(bind, 500));

  window.SchoolStudentSettlementPdfExport = {
    version: "9.8-stable-final.1-student-settlement-pdf",
    exportPdf,
  };
})();
