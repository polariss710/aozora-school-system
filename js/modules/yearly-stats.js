// === v9.5.0 yearly statistics module ===
// 首页和收支汇总增加年度统计。
// 工资以支付要求 school_payment_requests 中有效 teacher_wage 为准。
// 普通支出排除 teacher_wage，避免工资重复统计。

(function () {
  let paymentRequestsCache = [];
  let paymentRequestsLoadedAt = 0;

  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function yearMonthYear(ym) {
    return String(ym || "").slice(0, 4);
  }

  function monthOfYear(year, monthIndex) {
    return `${year}-${String(monthIndex).padStart(2, "0")}`;
  }

  function fmtCny(value) {
    return `¥${Math.round(n(value) * 100) / 100}`;
  }

  function fmtSignedCny(value) {
    const v = Math.round(n(value) * 100) / 100;
    return `${v < 0 ? "-" : ""}¥${Math.abs(v).toLocaleString()}`;
  }

  function isReceivedIncome(row) {
    return row?.status === "received";
  }

  function isPaidExpense(row) {
    return row?.status === "paid" || row?.status === "reimbursed";
  }

  function isTeacherWageExpense(row) {
    return String(row?.expense_category || "") === "teacher_wage";
  }

  function validTeacherWageRequest(row) {
    return row?.source_type === "teacher_wage" && row?.status !== "void" && row?.status !== "cancelled";
  }

  function rowEntityId(row) {
    return row?.business_entity_id || "";
  }

  function selectedFinanceYear() {
    const ym = document.getElementById("financeMonthFilter")?.value || "";
    const y = document.getElementById("financeYearFilter")?.value || "";
    return y || (ym ? ym.slice(0, 4) : String(currentYear()));
  }

  function selectedFinanceEntity() {
    return document.getElementById("financeEntityFilter")?.value || "";
  }

  function selectedFinanceAccount() {
    return document.getElementById("financeAccountFilter")?.value || "";
  }

  async function loadPaymentRequestsForStats(force = false) {
    const now = Date.now();
    if (!force && paymentRequestsCache.length && now - paymentRequestsLoadedAt < 30_000) {
      return paymentRequestsCache;
    }

    if (!window.db?.from) return [];

    const { data, error } = await db
      .from("school_payment_requests")
      .select("*")
      .eq("source_type", "teacher_wage");

    if (error) {
      console.warn("yearly stats payment request load failed", error);
      paymentRequestsCache = [];
      paymentRequestsLoadedAt = now;
      return [];
    }

    paymentRequestsCache = data || [];
    paymentRequestsLoadedAt = now;
    return paymentRequestsCache;
  }

  function sumIncomeCny(rows, year, entity = "", month = "") {
    return (rows || [])
      .filter(x =>
        isReceivedIncome(x) &&
        (!year || yearMonthYear(x.year_month) === String(year)) &&
        (!month || x.year_month === month) &&
        (!entity || rowEntityId(x) === entity)
      )
      .reduce((sum, x) => sum + n(x.amount_cny || (x.currency === "CNY" ? x.amount : 0)), 0);
  }

  function sumExpenseCny(rows, year, entity = "", month = "") {
    return (rows || [])
      .filter(x =>
        isPaidExpense(x) &&
        !isTeacherWageExpense(x) &&
        (!year || yearMonthYear(x.year_month) === String(year)) &&
        (!month || x.year_month === month) &&
        (!entity || rowEntityId(x) === entity)
      )
      .reduce((sum, x) => sum + n(x.amount_cny || (x.currency === "CNY" ? x.amount : 0)), 0);
  }

  function sumTeacherWageCny(rows, year, entity = "", month = "") {
    return (rows || [])
      .filter(x =>
        validTeacherWageRequest(x) &&
        (!year || yearMonthYear(x.request_month) === String(year)) &&
        (!month || x.request_month === month) &&
        (!entity || rowEntityId(x) === entity)
      )
      .reduce((sum, x) => sum + n(x.amount_cny), 0);
  }

  function allYears() {
    const years = new Set();

    (state.incomeRecords || []).forEach(x => {
      if (x.year_month) years.add(String(x.year_month).slice(0, 4));
    });
    (state.expenseRecords || []).forEach(x => {
      if (x.year_month) years.add(String(x.year_month).slice(0, 4));
    });
    paymentRequestsCache.forEach(x => {
      if (x.request_month) years.add(String(x.request_month).slice(0, 4));
    });

    if (!years.size) years.add(String(currentYear()));

    return Array.from(years).filter(Boolean).sort((a, b) => b.localeCompare(a));
  }

  function fillFinanceYearFilter() {
    const el = document.getElementById("financeYearFilter");
    if (!el) return;

    const old = el.value || String(currentYear());
    const years = allYears();
    el.innerHTML = years.map(y => `<option value="${escAttr(y)}">${esc(y)}年</option>`).join("");
    el.value = years.includes(old) ? old : (years[0] || String(currentYear()));
  }

  function renderHomeYearStats() {
    const year = String(currentYear());
    const income = sumIncomeCny(state.incomeRecords || [], year);
    const expense = sumExpenseCny(state.expenseRecords || [], year);
    const wage = sumTeacherWageCny(paymentRequestsCache || [], year);
    const net = income - expense - wage;

    setOptionalText("statYearIncome", fmtCny(income));
    setOptionalText("statYearExpense", fmtCny(expense));
    setOptionalText("statYearWage", fmtCny(wage));
    setOptionalText("statYearNet", fmtSignedCny(net));
  }

  function renderFinanceYearlyTable(year, entity) {
    const tbody = document.getElementById("financeYearlySummaryTable");
    if (!tbody) return;

    const months = Array.from({ length: 12 }, (_, i) => monthOfYear(year, i + 1));
    const rows = months.map(month => {
      const income = sumIncomeCny(state.incomeRecords || [], year, entity, month);
      const expense = sumExpenseCny(state.expenseRecords || [], year, entity, month);
      const wage = sumTeacherWageCny(paymentRequestsCache || [], year, entity, month);
      const net = income - expense - wage;
      const incomeCount = (state.incomeRecords || []).filter(x => isReceivedIncome(x) && x.year_month === month && (!entity || rowEntityId(x) === entity)).length;
      const expenseCount = (state.expenseRecords || []).filter(x => isPaidExpense(x) && !isTeacherWageExpense(x) && x.year_month === month && (!entity || rowEntityId(x) === entity)).length;
      return { month, income, expense, wage, net, incomeCount, expenseCount };
    }).filter(x => x.income || x.expense || x.wage || x.incomeCount || x.expenseCount);

    tbody.innerHTML = rows.length ? rows.map(x => `
      <tr>
        <td>${esc(x.month)}</td>
        <td>${fmtCny(x.income)}</td>
        <td>${fmtCny(x.expense)}</td>
        <td>${fmtCny(x.wage)}</td>
        <td><strong>${fmtSignedCny(x.net)}</strong></td>
        <td>${x.incomeCount}</td>
        <td>${x.expenseCount}</td>
      </tr>
    `).join("") : `<tr><td colspan="7" class="empty-row">当前年度没有收支数据</td></tr>`;
  }

  function renderFinanceYearStats() {
    fillFinanceYearFilter();

    const year = selectedFinanceYear();
    const month = document.getElementById("financeMonthFilter")?.value || "";
    const entity = selectedFinanceEntity();
    const account = selectedFinanceAccount();

    const incomeRows = filterFinanceRows(state.incomeRecords || [], "finance").filter(isReceivedIncome);
    const expenseRows = filterFinanceRows(state.expenseRecords || [], "finance").filter(x => isPaidExpense(x) && !isTeacherWageExpense(x));

    const income = incomeRows.reduce((sum, x) => sum + n(x.amount_cny || (x.currency === "CNY" ? x.amount : 0)), 0);
    const expense = expenseRows.reduce((sum, x) => sum + n(x.amount_cny || (x.currency === "CNY" ? x.amount : 0)), 0);

    // 工资没有账户维度，按月份/年度 + 业务归属统计。选择具体账户时，工资仍显示为当前业务范围的工资。
    const wage = sumTeacherWageCny(paymentRequestsCache || [], year, entity, month || "");
    const net = income - expense - wage;

    setOptionalText("financeIncomeTotal", fmtCny(income));
    setOptionalText("financeExpenseTotal", fmtCny(expense));
    setOptionalText("financeNetTotal", fmtSignedCny(income - expense));
    setOptionalText("financeWageTotal", fmtCny(wage));
    setOptionalText("financeRealNetTotal", fmtSignedCny(net));
    setOptionalText("financeRecordCount", String(incomeRows.length + expenseRows.length));

    renderFinanceYearlyTable(year, entity);

    const tbody = document.getElementById("financeAccountsTable");
    if (!tbody) return;

    const accountRows = (state.accounts || []).filter(x =>
      (!entity || x.business_entity_id === entity) &&
      (!account || x.id === account)
    );

    tbody.innerHTML = accountRows.map(item => `
      <tr>
        <td>${esc(item.name)}</td>
        <td>${esc(item.business_entity?.name || "")}</td>
        <td>${esc(item.currency)}</td>
        <td>${money(item.current_balance)}</td>
        <td>${esc(item.account_type)}</td>
        <td>${item.is_active ? badge("启用") : badge("停用", "red")}</td>
      </tr>
    `).join("");
  }

  async function renderYearlyStats(force = false) {
    await loadPaymentRequestsForStats(force);
    renderHomeYearStats();
    if (document.getElementById("page-finance")?.classList.contains("active")) {
      renderFinanceYearStats();
    } else {
      // 财务页未打开时也可以安全刷新年度表元素
      renderFinanceYearStats();
    }
  }

  const renderStatsBeforeV950 = typeof renderStats === "function" ? renderStats : null;
  if (renderStatsBeforeV950) {
    window.renderStats = function() {
      renderStatsBeforeV950();
      renderYearlyStats();
    };
  }

  const renderFinanceSummaryBeforeV950 = typeof renderFinanceSummary === "function" ? renderFinanceSummary : null;
  if (renderFinanceSummaryBeforeV950) {
    window.renderFinanceSummary = function() {
      // 不调用旧函数，避免旧逻辑覆盖 v9.5 年度统计卡片
      renderYearlyStats();
    };
  }

  const switchPageBeforeV950 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV950) {
    window.switchPage = function(page) {
      switchPageBeforeV950(page);
      if (page === "finance") {
        const title = document.getElementById("pageTitle");
        const subtitle = document.getElementById("pageSubtitle");
        if (title) title.textContent = "收支汇总";
        if (subtitle) subtitle.textContent = "查看月度与年度收入、普通支出、老师工资和净收入";
        setTimeout(() => renderYearlyStats(true), 0);
      }
    };
  }

  function bindFinanceYearFilterV950() {
    const year = document.getElementById("financeYearFilter");
    if (year && year.dataset.boundYearlyStats !== "true") {
      year.dataset.boundYearlyStats = "true";
      year.addEventListener("change", () => renderYearlyStats(true));
    }

    ["financeMonthFilter", "financeEntityFilter", "financeAccountFilter"].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.boundYearlyStats === "true") return;
      el.dataset.boundYearlyStats = "true";
      el.addEventListener("change", () => renderYearlyStats(true));
    });

    const clear = document.getElementById("financeClearFilter");
    if (clear && clear.dataset.boundYearlyClear !== "true") {
      clear.dataset.boundYearlyClear = "true";
      clear.addEventListener("click", () => setTimeout(() => renderYearlyStats(true), 0));
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      bindFinanceYearFilterV950();
      renderYearlyStats(true);
    }, 1000);
  });

  window.SchoolYearlyStatsV950 = {
    version: "9.5.0",
    loadPaymentRequestsForStats,
    render: renderYearlyStats,
    paymentRequests: () => paymentRequestsCache,
  };
})();
