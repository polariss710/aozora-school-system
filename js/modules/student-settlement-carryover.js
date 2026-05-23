// === v9.8.6 student previous settlement carryover ===
// 修正学生月度结算页面：当前月的上月结余/补交优先读取上一月份已锁定结算。
// 约定：上月 carryover_amount_cny > 0 表示需补交，应加到本月应收合计；<0 表示结余，应抵扣。

(function () {
  const TABLE = "school_student_monthly_settlements";

  function dbClientV986() {
    if (typeof db !== "undefined" && db?.from) return db;
    if (typeof supabase !== "undefined" && supabase?.from) return supabase;
    if (window.db?.from) return window.db;
    if (window.supabase?.from) return window.supabase;
    return null;
  }

  function n(v) {
    const x = Number(v || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function fmtCny(v) {
    return `${Math.round(n(v)).toLocaleString()} CNY`;
  }

  function prevMonth(ym) {
    const [y, m] = String(ym || "").split("-").map(Number);
    if (!y || !m) return "";
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  async function fetchPrevCarryover(studentId, month, student) {
    const pm = prevMonth(month);
    const client = dbClientV986();
    if (!studentId || !pm || !client?.from) return n(student?.previous_balance_cny);

    const { data, error } = await client
      .from(TABLE)
      .select("carryover_amount_cny,carryover_cny,balance_cny,settlement_status,status,locked_at,updated_at")
      .eq("student_id", studentId)
      .eq("year_month", pm)
      .order("locked_at", { ascending: false })
      .limit(5);

    if (error) {
      console.warn("load previous settlement carryover failed", error);
      return n(student?.previous_balance_cny);
    }

    const row = (data || []).find(x =>
      x.settlement_status === "locked" || x.status === "locked" || x.locked_at
    ) || data?.[0];
    if (!row) return n(student?.previous_balance_cny);
    return n(row.carryover_amount_cny ?? row.carryover_cny ?? row.balance_cny);
  }

  async function applyPrevCarryover() {
    const { month, studentId, student } = currentContext();
    if (!month || !studentId || !student) return;

    const carry = await fetchPrevCarryover(studentId, month, student);
    const rate = n(student.preset_exchange_rate);
    const plannedJpy = sumFee(lessonsFor(studentId, month, "planned"));
    const plannedCny = plannedJpy * rate;
    const plannedTotal = plannedCny + carry;

    const prevEl = document.getElementById("settlementPrevBalanceCny");
    const totalEl = document.getElementById("settlementPlannedTotalCny");

    if (prevEl) prevEl.textContent = fmtCny(carry);
    if (totalEl) totalEl.textContent = fmtCny(plannedTotal);
  }

  function scheduleApply() {
    setTimeout(applyPrevCarryover, 80);
  }

  const renderStudentSettlementBeforeV984 = typeof window.renderStudentSettlement === "function" ? window.renderStudentSettlement : null;
  if (renderStudentSettlementBeforeV984) {
    window.renderStudentSettlement = function() {
      renderStudentSettlementBeforeV984();
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

  window.SchoolStudentSettlementCarryoverV984 = { version: "9.8.6", apply: applyPrevCarryover, fetchPrevCarryover };
})();
