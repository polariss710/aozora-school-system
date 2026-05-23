// === v9.8.7 student settlement carryover DB reader ===
// 当前月份的上月结余/补交优先读取 school_student_settlement_carryovers。
// 本表由学生月度结算锁定时写入，避免前端临时反推上一月结转。

(function () {
  const TABLE = "school_student_settlement_carryovers";

  function n(v) {
    const x = Number(v || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function fmtCny(v) {
    return `${Math.round(n(v)).toLocaleString()} CNY`;
  }

  function dbClientV987() {
    if (typeof db !== "undefined" && db?.from) return db;
    if (typeof supabase !== "undefined" && supabase?.from) return supabase;
    if (window.db?.from) return window.db;
    if (window.supabase?.from) return window.supabase;
    return null;
  }

  function currentContext() {
    const month = document.getElementById("settlementMonthFilter")?.value || "";
    const studentId = document.getElementById("settlementStudentFilter")?.value || "";
    const student = (window.state?.students || []).find(x => x.id === studentId);
    return { month, studentId, student };
  }

  function lessonsFor(studentId, month, type) {
    return (window.state?.lessonRecords || [])
      .filter(x => x.student_id === studentId && x.year_month === month && x.lesson_type === type && x.is_billable !== false)
      .filter(x => type === "planned" || x.status === "completed" || x.status === "makeup" || x.status === "planned");
  }

  function feeOfLesson(item) {
    return n(item.lesson_fee || (n(item.unit_price) * n(item.duration_hours)));
  }

  function sumFee(rows) {
    return rows.reduce((sum, x) => sum + feeOfLesson(x), 0);
  }

  async function fetchCarryover(studentId, month, student) {
    const client = dbClientV987();
    if (!studentId || !month || !client?.from) return n(student?.previous_balance_cny);

    const { data, error } = await client
      .from(TABLE)
      .select("amount_cny,status,updated_at,from_year_month,to_year_month")
      .eq("student_id", studentId)
      .eq("to_year_month", month)
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (error) {
      console.warn("load student carryover failed", error);
      return n(student?.previous_balance_cny);
    }

    const row = data?.[0];
    return row ? n(row.amount_cny) : n(student?.previous_balance_cny);
  }

  async function applyCarryover() {
    const { month, studentId, student } = currentContext();
    if (!month || !studentId || !student) return;

    const carry = await fetchCarryover(studentId, month, student);
    window.__studentSettlementCarryoverV987 = { month, studentId, amount: carry };

    const rate = n(student.preset_exchange_rate);
    const plannedJpy = sumFee(lessonsFor(studentId, month, "planned"));
    const plannedCny = plannedJpy * rate;
    const plannedTotal = plannedCny + carry;

    const prevEl = document.getElementById("settlementPrevBalanceCny");
    const totalEl = document.getElementById("settlementPlannedTotalCny");

    if (prevEl) prevEl.textContent = fmtCny(carry);
    if (totalEl) totalEl.textContent = fmtCny(plannedTotal);

    if (typeof updateSettlementLockPreviewV87 === "function") {
      updateSettlementLockPreviewV87();
    }
  }

  function scheduleApply() {
    setTimeout(applyCarryover, 80);
  }

  const renderStudentSettlementBeforeV987 = typeof window.renderStudentSettlement === "function" ? window.renderStudentSettlement : null;
  if (renderStudentSettlementBeforeV987) {
    window.renderStudentSettlement = function() {
      renderStudentSettlementBeforeV987();
      scheduleApply();
    };
  }

  document.addEventListener("change", e => {
    if (e.target?.id === "settlementMonthFilter" || e.target?.id === "settlementStudentFilter") {
      scheduleApply();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(scheduleApply, 1000);
  });

  window.SchoolStudentSettlementCarryoverV987 = {
    version: "9.8.7",
    apply: applyCarryover,
    fetchCarryover,
  };
})();
