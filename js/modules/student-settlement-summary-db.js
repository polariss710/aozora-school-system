// === v9.8.12 student settlement DB summary reader ===
(function () {
  function n(v) { const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function money(v) { const x = Number(v || 0); return Number.isFinite(x) ? Math.round(x).toLocaleString() : "0"; }
  function cny(v) { return `${money(v)} CNY`; }
  function jpy(v) { return `${money(v)} JPY`; }

  function dbClientV989() {
    if (typeof db !== "undefined" && db?.rpc) return db;
    if (typeof supabase !== "undefined" && supabase?.rpc) return supabase;
    if (window.db?.rpc) return window.db;
    if (window.supabase?.rpc) return window.supabase;
    return null;
  }

  function currentContext() {
    return {
      month: document.getElementById("settlementMonthFilter")?.value || "",
      studentId: document.getElementById("settlementStudentFilter")?.value || "",
    };
  }

  async function fetchSummary(studentId, month) {
    const client = dbClientV989();
    if (!client || !studentId || !month) return null;
    const { data, error } = await client.rpc("school_get_student_monthly_settlement_summary", {
      p_student_id: studentId,
      p_year_month: month,
    });
    if (error) {
      console.error("student settlement summary rpc failed", error);
      showMessage(`读取学生月度结算DB汇总失败：${error.message || error}`, "error");
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  }

  function applySummary(row) {
    if (!row) return;

    const summary = {
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

    window.__studentSettlementSummaryDbV989 = summary;
    window.__studentSettlementCarryoverV987 = { month: summary.month, studentId: summary.studentId, amount: summary.carryoverCny };

    setOptionalText("settlementPlannedHours", money(summary.plannedHours));
    setOptionalText("settlementActualHours", money(summary.actualHours));
    setOptionalText("settlementPlannedJpy", jpy(summary.plannedFeeJpy));
    setOptionalText("settlementActualJpy", jpy(summary.actualFeeJpy));

    setOptionalText("settlementPrevBalanceCny", cny(summary.carryoverCny));
    setOptionalText("settlementExchangeRate", money(summary.rate));
    setOptionalText("settlementPlannedJpy2", jpy(summary.plannedFeeJpy));
    setOptionalText("settlementPlannedCny", cny(summary.plannedFeeCny));
    setOptionalText("settlementPlannedTotalCny", cny(summary.plannedTotalCny));

    setOptionalText("settlementActualJpy2", jpy(summary.actualFeeJpy));
    setOptionalText("settlementActualCny", cny(summary.actualFeeCny));
    setOptionalText("settlementReceivedCny", cny(summary.receivedCny));
    setOptionalText("settlementReceivedJpy", jpy(summary.receivedJpy));
    setOptionalText("settlementFinalStatusCny", cny(summary.finalDueCny));

    const prevEl = document.getElementById("settlementPrevBalanceCny");
    const totalEl = document.getElementById("settlementPlannedTotalCny");
    if (prevEl) prevEl.dataset.source = "db_rpc";
    if (totalEl) totalEl.dataset.source = "db_rpc";

    if (typeof updateSettlementLockPreviewV87 === "function") updateSettlementLockPreviewV87();
  }

  async function refreshSummary() {
    const { studentId, month } = currentContext();
    if (!studentId || !month) return;
    applySummary(await fetchSummary(studentId, month));
  }

  function scheduleRefresh() { [0, 200, 700].forEach(ms => setTimeout(refreshSummary, ms)); }

  const renderStudentSettlementBeforeV989 = typeof window.renderStudentSettlement === "function" ? window.renderStudentSettlement : null;
  if (renderStudentSettlementBeforeV989) {
    window.renderStudentSettlement = function() {
      renderStudentSettlementBeforeV989();
      scheduleRefresh();
    };
  }

  document.addEventListener("change", e => {
    if (e.target?.id === "settlementMonthFilter" || e.target?.id === "settlementStudentFilter") scheduleRefresh();
  });
  document.addEventListener("DOMContentLoaded", () => setTimeout(scheduleRefresh, 1000));

  window.SchoolStudentSettlementSummaryDbV989 = { version: "9.8.12", refresh: refreshSummary, fetchSummary };
})();
