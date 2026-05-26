
// === v7.0 stability helpers ===
window.addEventListener("error", (event) => {
  console.error("Global error:", event.error || event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
});

function safeCall(label, fn) {
  try {
    return fn();
  } catch (error) {
    console.error(`[${label}]`, error);
    if (typeof showMessage === "function") {
      showMessage(`${label} 执行出错：${error.message || error}`, "error");
    }
    return undefined;
  }
}

function safeAsync(label, fn) {
  return Promise.resolve()
    .then(fn)
    .catch(error => {
      console.error(`[${label}]`, error);
      if (typeof showMessage === "function") {
        showMessage(`${label} 执行出错：${error.message || error}`, "error");
      }
    });
}



// === v4.1 global attachment renderer ===
function renderAttachmentLinks(attachments) {
  const list = attachments || [];
  if (!Array.isArray(list) || list.length === 0) return "";

  return list.map(file => {
    const url = file.public_url || "";
    const name = file.file_name || "凭证";
    const label = typeof short === "function" ? short(name, 12) : String(name).slice(0, 12);

    if (url) {
      const safeUrl = typeof escAttr === "function" ? escAttr(url) : url;
      const safeLabel = typeof esc === "function" ? esc(label) : label;
      return `<a class="file-link" href="${safeUrl}" target="_blank" download>${safeLabel}</a>`;
    }

    return typeof esc === "function" ? esc(label) : label;
  }).join("<br>");
}

const SUPABASE_URL = "https://xlcdqvlfzspcxdoidsrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6c7EFHXfq256rvv8KvY0Yw_FrAZtb6x";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  page: "dashboard",
  businessEntities: [],
  subjects: [],
  lessonRecords: [],
  pendingActualPlanId: null,
  students: [],
  teachers: [],
  accounts: [],
  incomeRecords: [],
  expenseRecords: [],
  reimbursements: [],
  pendingExpenseAttachment: null,
  isSavingForm: false,
  isSavingReimbursement: false,
  activeReimbursementSubmitKey: "",
  activeDeleteKey: "",
  editing: null,
};

const pageMeta = {
  dashboard: ["首页", "系统基础骨架与云端连接测试"],
  business: ["业务归属", "区分青空进学塾、个人名义、待确认等账本归属"],
  students: ["学生管理", "维护学生基础资料与默认业务归属"],
  teachers: ["老师管理", "维护老师资料、默认科目、时薪和支付信息"],
  subjects: ["科目管理", "维护 EJU/JLPT/校内考等科目"],
  accounts: ["账户管理", "维护银行、微信、支付宝、现金等账户"],
  income: ["收入记录", "登记公司/个人名义收入，并联动账户余额"],
  expenses: ["支出记录", "登记公司/个人名义支出，并联动账户余额"],
  finance: ["公司收支", "按月份和业务归属查看收支与账户余额"],
  reimbursements: ["报销管理", "管理垫付账户向公司账户报销"],
  backup: ["备份/恢复", "导出基础数据 JSON 备份"],
};

const tables = {
  business: "school_business_entities",
  subjects: "school_subjects",
  lessons: "school_lesson_records",
  students: "school_students",
  teachers: "school_teachers",
  accounts: "school_accounts",
  income: "school_income_records",
  expenses: "school_expense_records",
  transactions: "school_account_transactions",
  reimbursements: "school_reimbursements",
  reimbursementItems: "school_reimbursement_items",
  expenseAttachments: "school_expense_attachments",
  reimbursements: "school_reimbursements",
  reimbursementItems: "school_reimbursement_items",
};

document.addEventListener("DOMContentLoaded", async () => {
  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  }
  bindNavigation();
  bindGlobalActions();
  bindSearch();
  await init();
});

async function init() {
  await checkConnection();
  await loadAll();
  setDefaultExpenseMonthFilter();
  renderAll();
}

async function checkConnection() {
  const dot = document.getElementById("connectionDot");
  const text = document.getElementById("connectionText");

  const { error } = await db.from("school_settings").select("id").limit(1);
  if (error) {
    dot.className = "dot bad";
    text.textContent = "连接失败";
    showMessage(error.message, "error");
    return;
  }
  dot.className = "dot ok";
  text.textContent = "已连接";
}

async function loadAll() {
  await Promise.all([
    loadBusinessEntities(),
    loadSubjects(),
    loadLessonRecords(),
    loadStudents(),
    loadTeachers(),
    loadAccounts(),
    loadIncomeRecords(),
    loadExpenseRecords(),
    loadReimbursements(),
  ]);
}

async function loadBusinessEntities() {
  const { data, error } = await db
    .from(tables.business)
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return showMessage(error.message, "error");
  state.businessEntities = data || [];
}

async function loadSubjects() {
  const { data, error } = await db
    .from(tables.subjects)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) return showMessage(error.message, "error");
  state.subjects = data || [];
}

async function loadStudents() {
  const { data, error } = await db
    .from(tables.students)
    .select("*, business_entity:school_business_entities(name, code)")
    .order("created_at", { ascending: false });
  if (error) return showMessage(error.message, "error");
  state.students = data || [];
}

async function loadTeachers() {
  const { data, error } = await db
    .from(tables.teachers)
    .select("*, default_subject:school_subjects(name), default_business_entity:school_business_entities(name)")
    .order("created_at", { ascending: false });
  if (error) return showMessage(error.message, "error");
  state.teachers = data || [];
}

async function loadAccounts() {
  const { data, error } = await db
    .from(tables.accounts)
    .select("*, business_entity:school_business_entities(name, code)")
    .order("created_at", { ascending: false });
  if (error) return showMessage(error.message, "error");
  state.accounts = data || [];
}

async function loadIncomeRecords() {
  const { data, error } = await db
    .from(tables.income)
    .select("*, business_entity:school_business_entities(name, code), account:school_accounts(name, currency), student:school_students(name)")
    .order("income_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return showMessage(error.message, "error");
  state.incomeRecords = data || [];
}

async function loadExpenseRecords() {
  let { data, error } = await db
    .from(tables.expenses)
    .select("*, business_entity:school_business_entities(name, code), account:school_accounts(name, currency), attachments:school_expense_attachments(*)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Expense attachment relation load failed, retrying without attachments.", error);
    const retry = await db
      .from(tables.expenses)
      .select("*, business_entity:school_business_entities(name, code), account:school_accounts(name, currency)")
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (retry.error) return showMessage(retry.error.message, "error");
    data = retry.data || [];
  }

  state.expenseRecords = data || [];
}

function renderAll() {
  renderStats();
  renderBusinessTable();
  renderSubjectsTable();
  renderLessons();
  renderStudentsTable();
  renderTeachersTable();
  renderAccountsTable();
  updateFinanceFilters();
  renderIncomeTable();
  renderExpensesTable();
  renderFinanceSummary();
  renderReimbursements();
}


async function loadReimbursements() {
  const { data, error } = await db
    .from(tables.reimbursements)
    .select("*, business_entity:school_business_entities(name, code), from_account:school_accounts!school_reimbursements_from_account_id_fkey(name, currency), to_account:school_accounts!school_reimbursements_to_account_id_fkey(name, currency), items:school_reimbursement_items(*)")
    .order("reimbursement_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Reimbursement relation load failed, retrying without relation", error);
    const retry = await db
      .from(tables.reimbursements)
      .select("*")
      .order("reimbursement_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (retry.error) return showMessage(retry.error.message, "error");
    state.reimbursements = retry.data || [];
    return;
  }

  state.reimbursements = data || [];
}


async function loadLessonRecords() {
  const { data, error } = await db
    .from(tables.lessons)
    .select("*, student:school_students(name, display_name), teacher:school_teachers(name, display_name), subject:school_subjects(name, color), business_entity:school_business_entities(name, code)")
    .order("lesson_date", { ascending: false })
    .order("start_time", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) return showMessage(error.message, "error");
  state.lessonRecords = data || [];
}

function renderStats() {
  setText("statStudents", state.students.length);
  setText("statTeachers", state.teachers.length);
  setText("statSubjects", state.subjects.length);
  setText("statAccounts", state.accounts.length);
  const ym = currentYearMonth();
  const income = sumCny(state.incomeRecords.filter(x => x.year_month === ym));
  const expense = sumCny(state.expenseRecords.filter(x => x.year_month === ym));
  setText("statIncome", formatCny(income));
  setText("statExpense", formatCny(expense));
  setText("statNet", formatCny(income - expense));
}

function renderBusinessTable() {
  const tbody = document.getElementById("businessTable");
  tbody.innerHTML = state.businessEntities.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.code)}</td>
      <td>${esc(item.entity_type)}</td>
      <td>${esc(item.default_currency || "")}</td>
      <td>${item.is_company_report ? badge("是") : badge("否", "gray")}</td>
      <td>${item.is_active ? badge("启用") : badge("停用", "red")}</td>
      <td>${actionButtons("business", item.id)}</td>
    </tr>
  `).join("");
}

function renderSubjectsTable() {
  const tbody = document.getElementById("subjectsTable");
  tbody.innerHTML = state.subjects.map(item => `
    <tr data-subject-row="${escAttr(item.id)}">
      <td>${esc(item.name)}</td>
      <td>${esc(item.primary_category || "班课")}</td>
      <td>${esc(item.category || "")}</td>
      <td>${esc(item.tertiary_category || "")}</td>
      <td><span class="color-chip" style="background:${esc(item.color || "#ffffff")}"></span></td>
      <td>${num(item.sort_order)}</td>
      <td>${item.is_active ? badge("启用") : badge("停用", "red")}</td>
      <td>${actionButtons("subject", item.id)}</td>
      <td><span class="drag-handle" draggable="true" title="拖动调整排序">☰</span></td>
    </tr>
  `).join("");
  bindSubjectDragSort();
}

function renderStudentsTable() {
  const keyword = (document.getElementById("studentSearch").value || "").trim().toLowerCase();
  const rows = state.students.filter(item => {
    if (!keyword) return true;
    return [item.name, item.display_name, item.wechat, item.target_type, item.target_schools, item.note]
      .filter(Boolean).join(" ").toLowerCase().includes(keyword);
  });

  const tbody = document.getElementById("studentsTable");
  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${courseTrackLabelV8314(item.course_track)}</td>
      <td>${money(item.preset_exchange_rate || 0)}</td>
      <td>${statusBadge(item.status)}</td>
      <td>${esc(short(item.note))}</td>
      <td>${actionButtons("student", item.id)}</td>
    </tr>
  `).join("");
}

function renderTeachersTable() {
  const keyword = (document.getElementById("teacherSearch").value || "").trim().toLowerCase();
  const rows = state.teachers.filter(item => {
    if (!keyword) return true;
    return [item.name, item.display_name, item.department, item.default_subject?.name, item.note]
      .filter(Boolean).join(" ").toLowerCase().includes(keyword);
  });

  const tbody = document.getElementById("teachersTable");
  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.department || "")}</td>
      <td>${esc(item.default_subject?.name || "")}</td>
      <td>${money(item.default_hourly_rate)}</td>
      <td>${esc(item.default_currency || "")}</td>
      <td>${esc(item.default_payment_method || "")}</td>
      <td>${teacherStatusBadge(item.status)}</td>
      <td>${actionButtons("teacher", item.id)}</td>
    </tr>
  `).join("");
}

function renderAccountsTable() {
  const tbody = document.getElementById("accountsTable");
  tbody.innerHTML = state.accounts.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.account_type)}</td>
      <td>${esc(item.currency)}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${money(item.opening_balance)}</td>
      <td>${money(item.current_balance)}</td>
      <td>${item.is_company_account ? badge("是") : badge("否", "gray")}</td>
      <td>${item.is_active ? badge("启用") : badge("停用", "red")}</td>
      <td>${actionButtons("account", item.id)}</td>
    </tr>
  `).join("");
}


function renderFinanceMiniStats(type, rows) {
  const total = typeof schoolV30Totals === "function" ? schoolV30Totals(rows) : sumFinanceByCurrency(rows);

  if (type === "income") {
    const received = rows.filter(x => x.status === "received");
    const pending = rows.filter(x => x.status === "pending");
    setOptionalText("incomeTotalAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(total) : formatFinanceTotals(total)));
    setOptionalText("incomeReceivedAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(schoolV30Totals(received)) : formatFinanceTotals(sumFinanceByCurrency(received))));
    setOptionalText("incomePendingAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(schoolV30Totals(pending)) : formatFinanceTotals(sumFinanceByCurrency(pending))));
    setOptionalText("incomeRecordCount", rows.length);
  }

  if (type === "expense") {
    const paid = rows.filter(x => x.status === "paid" || x.status === "reimbursed");
    const unpaid = rows.filter(x => x.status === "unpaid");
    setOptionalText("expenseTotalAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(total) : formatFinanceTotals(total)));
    setOptionalText("expensePaidAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(schoolV30Totals(paid)) : formatFinanceTotals(sumFinanceByCurrency(paid))));
    setOptionalText("expenseUnpaidAmount", (typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals(schoolV30Totals(unpaid)) : formatFinanceTotals(sumFinanceByCurrency(unpaid))));
    setOptionalText("expenseRecordCount", rows.length);
  }
}

function renderIncomeTable() {
  const tbody = document.getElementById("incomeTable");
  if (!tbody) return;
  const rows = filterFinanceRows(state.incomeRecords, "income")
    .slice()
    .sort((a, b) => {
      const ma = a.year_month || "";
      const mb = b.year_month || "";
      if (ma !== mb) return mb.localeCompare(ma);
      return String(b.income_date || b.created_at || "").localeCompare(String(a.income_date || a.created_at || ""));
    });

  renderFinanceMiniStats("income", rows);

  let lastMonth = "";
  const html = [];

  rows.forEach(item => {
    const ym = item.year_month || "未归属月份";
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`
        <tr class="month-group-row">
          <td colspan="12">${esc(incomeMonthLabel(ym))}</td>
        </tr>
      `);
    }

    html.push(`
      <tr>
        <td>${esc(displayRecordDate(item.income_date || item.created_at))}</td>
        <td>${esc(item.year_month || "")}</td>
        <td>${esc(item.business_entity?.name || "")}</td>
        <td>${esc(incomeCategoryLabel(item.income_category))}</td>
        <td>${esc(item.student?.name || "")}</td>
        <td>${esc(short(item.description || item.note, 28))}</td>
        <td>${esc(item.account?.name || "")}</td>
        <td>${esc(item.currency || "")}</td>
        <td>${money(item.amount)}</td>
        <td>${financeStatusBadge(item.status)}</td>
        <td>${item.is_taxable_income ? badge("计税") : badge("不计税", "gray")}</td>
        <td>${actionButtons("income", item.id)}</td>
      </tr>
    `);
  });

  tbody.innerHTML = html.join("");
}

function renderExpensesTable() {
  const tbody = document.getElementById("expensesTable");
  if (!tbody) return;
  const rows = filterFinanceRows(state.expenseRecords, "expense")
    .slice()
    .sort((a, b) => {
      const ma = a.year_month || "";
      const mb = b.year_month || "";
      if (ma !== mb) return mb.localeCompare(ma);
      return String(b.expense_date || b.created_at || "").localeCompare(String(a.expense_date || a.created_at || ""));
    });

  renderFinanceMiniStats("expense", rows);

  let lastMonth = "";
  const html = [];

  rows.forEach(item => {
    const ym = item.year_month || "未归属月份";
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`
        <tr class="month-group-row">
          <td colspan="14">${esc(expenseMonthLabel(ym))}</td>
        </tr>
      `);
    }

    html.push(`
      <tr>
        <td>${esc(displayRecordDate(item.expense_date || item.created_at))}</td>
        <td>${esc(item.year_month || "")}</td>
        <td>${esc(item.business_entity?.name || "")}</td>
        <td>${esc(expenseCategoryLabel(item.expense_category))}</td>
        <td>${esc(item.student?.name || "")}</td>
        <td>${esc(short(item.description || item.note, 28))}</td>
        <td>${esc(item.account?.name || "")}</td>
        <td>${esc(item.currency || "")}</td>
        <td>${money(item.amount)}</td>
        <td>${financeStatusBadge(item.status)}</td>
        <td>${item.is_business_expense ? badge("可经费") : badge("不可/待确认", "gray")}</td>
        <td>${esc(item.receipt_status || "")}</td>
        <td>${renderAttachmentLinks(item.attachments)}</td>
        <td>${actionButtons("expense", item.id)}</td>
      </tr>
    `);
  });

  tbody.innerHTML = html.join("");
}


function formatCurrencyTotal(value, currency = "JPY") {
  const n = Number(value || 0);
  return `${n.toLocaleString()} ${currency}`;
}

function normalizeLessonSelectedStudentFilterV9812() {
  const select = document.getElementById("lessonStudentFilter");
  if (!select || !select.value) return "";
  const ok = Array.from(select.options || []).some(opt => opt.value === select.value && opt.value);
  if (!ok) {
    select.value = "";
    return "";
  }
  return select.value;
}

function renderFinanceSummary() {
  const incomeRows = filterFinanceRows(state.incomeRecords, "finance");
  const expenseRows = filterFinanceRows(state.expenseRecords, "finance");
  const income = sumCny(incomeRows);
  const expense = sumCny(expenseRows);
  setOptionalText("financeIncomeTotal", formatCny(income));
  setOptionalText("financeExpenseTotal", formatCny(expense));
  setOptionalText("financeNetTotal", formatCny(income - expense));
  setOptionalText("financeRecordCount", incomeRows.length + expenseRows.length);

  const tbody = document.getElementById("financeAccountsTable");
  if (!tbody) return;
  const entity = document.getElementById("financeEntityFilter")?.value || "";
  const account = document.getElementById("financeAccountFilter")?.value || "";
  const rows = state.accounts.filter(x => (!entity || x.business_entity_id === entity) && (!account || x.id === account));
  tbody.innerHTML = rows.map(item => `
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

function bindNavigation() {
  document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
    btn.onclick = () => { if (btn.dataset.page) switchPage(btn.dataset.page); };
  });
}

function switchPage(page) {
  if (!page) return;

  document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  const metaSource =
    (typeof pageMeta !== "undefined" && pageMeta) ||
    (typeof pageInfo !== "undefined" && pageInfo) ||
    (typeof pageTitles !== "undefined" && pageTitles) ||
    {};

  const meta = metaSource[page] || {
    home: ["首页", "系统基础骨架与云端连接测试"],
    business: ["业务归属", "管理公司与个人业务归属"],
    students: ["学生管理", "管理学生基础资料与升学信息"],
    lessons: ["课时管理", "管理学生预定课时与实际课时"],
    "student-settlement": ["学生月度结算", "按学生和月份计算预定课时费与实际课时费"],
    teachers: ["老师管理", "管理老师资料与工资信息"],
    subjects: ["科目管理", "管理课程科目与分类"],
    accounts: ["账户管理", "管理公司账户与垫付账户"],
    income: ["收入记录", "登记学费等收入，并联动账户余额"],
    expense: ["支出记录", "登记公司/个人名义支出，并联动账户余额"],
    finance: ["公司收支", "按月份和业务归属查看收支与账户余额"],
    reimbursements: ["报销管理", "管理垫付账户向公司账户报销"],
    backup: ["备份/恢复", "导出当前数据备份"],
  }[page] || [page, ""];

  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  if (titleEl) titleEl.textContent = Array.isArray(meta) ? meta[0] : (meta.title || page);
  if (subtitleEl) subtitleEl.textContent = Array.isArray(meta) ? (meta[1] || "") : (meta.subtitle || "");

  if (page === "lessons") {
    renderLessons?.();
  }
}


async function recalcAccountBalances() {
  const ok = confirm("将根据当前收入/支出记录重新计算所有账户余额。\n\n计算方式：opening_balance + 已收收入 - 已支付/已报销支出\n\n是否继续？");
  if (!ok) return;

  try {
    showMessage("正在重算账户余额...", "ok");

    for (const account of state.accounts) {
      const incomeTotal = (state.incomeRecords || [])
        .map(x => accountEffect("income", x))
        .filter(x => x && x.accountId === account.id)
        .reduce((sum, x) => sum + Number(x.delta || 0), 0);

      const expenseTotal = (state.expenseRecords || [])
        .map(x => accountEffect("expense", x))
        .filter(x => x && x.accountId === account.id)
        .reduce((sum, x) => sum + Number(x.delta || 0), 0);

      const nextBalance = Number(account.opening_balance || 0) + incomeTotal + expenseTotal;

      const { error } = await db
        .from(tables.accounts)
        .update({ current_balance: nextBalance })
        .eq("id", account.id);

      if (error) throw error;
    }

    await loadAll();
    renderAll();
    showMessage("账户余额已重算完成。", "ok");
  } catch (error) {
    console.error(error);
    showMessage(`重算失败：${error.message || error}`, "error");
  }
}

function bindGlobalActions() {
  document.getElementById("refreshBtn").addEventListener("click", async () => {
    await loadAll();
    renderAll();
    showMessage("数据已刷新。", "ok");
  });

  document.querySelectorAll('[data-open-modal]:not([data-open-modal="lesson"])').forEach(btn => {
    btn.addEventListener("click", () => openCreateModal(btn.dataset.openModal));
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", closeModal);

  document.getElementById("exportBackupBtn")?.addEventListener("click", exportBackup);
  document.getElementById("recalcAccountBalancesBtn")?.addEventListener("click", () => { if (typeof recalcAccountBalances === "function") recalcAccountBalances(); });
  document.getElementById("recalcAccountBalancesBtnFinance")?.addEventListener("click", () => { if (typeof recalcAccountBalances === "function") recalcAccountBalances(); });
  bindExpensePdfImport();
  bindFinanceFilters();
  bindReimbursementActions();

  if (document.body.dataset.boundTableActionsV72 !== "true") {
    document.body.dataset.boundTableActionsV72 = "true";
    document.body.addEventListener("click", async (e) => {
      const editBtn = e.target.closest('[data-edit][data-type]:not([data-type="lesson"])');
      const deleteBtn = e.target.closest('[data-delete][data-type]:not([data-type="lesson"])');

      if (editBtn) {
        e.preventDefault();
        e.stopPropagation();
        openEditModal(editBtn.dataset.type, editBtn.dataset.edit);
        return;
      }

      if (deleteBtn) {
        e.preventDefault();
        e.stopPropagation();
        await deleteRecord(deleteBtn.dataset.type, deleteBtn.dataset.delete);
      }
    });
  }
}

function bindSearch() {
  document.getElementById("studentSearch").addEventListener("input", renderStudentsTable);
  document.getElementById("teacherSearch").addEventListener("input", renderTeachersTable);
}


function setDefaultExpenseMonthFilter() {
  const incomeMonth = document.getElementById("incomeMonthFilter");
  const expenseMonth = document.getElementById("expenseMonthFilter");
  const financeMonth = document.getElementById("financeMonthFilter");
  const reimbursementMonth = document.getElementById("reimbursementMonthFilter");
  if (incomeMonth && !incomeMonth.value) incomeMonth.value = currentYearMonth();
  if (expenseMonth && !expenseMonth.value) expenseMonth.value = currentYearMonth();
  if (financeMonth && !financeMonth.value) financeMonth.value = currentYearMonth();
  if (reimbursementMonth && !reimbursementMonth.value) reimbursementMonth.value = currentYearMonth();
}

function displayRecordDate(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}


function incomeMonthLabel(yearMonth) {
  if (!yearMonth) return "未归属月份";
  const [year, month] = String(yearMonth).split("-");
  if (!year || !month) return yearMonth;
  return `${year}年${Number(month)}月`;
}

function expenseMonthLabel(yearMonth) {
  if (!yearMonth) return "未归属月份";
  const [year, month] = String(yearMonth).split("-");
  if (!year || !month) return yearMonth;
  return `${year}年${Number(month)}月`;
}


function bindReimbursementActions() {
  const reimburseBtn = document.getElementById("reimburseSelectedBtn");
  if (reimburseBtn) {
    reimburseBtn.onclick = createReimbursementFromSelectedExpenses;
  }

  bindPendingReimbursementSelectionControls();

  ["reimbursementMonthFilter", "reimbursementEntityFilter", "reimbursementStatusFilter", "reimbursementAccountFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundReimbursementFilterV71 === "true") return;
    el.dataset.boundReimbursementFilterV71 = "true";
    el.addEventListener("change", renderReimbursements);
  });

  const clearBtn = document.getElementById("reimbursementClearFilter");
  if (clearBtn) {
    clearBtn.onclick = () => {
      document.getElementById("reimbursementMonthFilter").value = "";
      document.getElementById("reimbursementEntityFilter").value = "";
      document.getElementById("reimbursementStatusFilter").value = "";
      const accountFilter = document.getElementById("reimbursementAccountFilter");
      if (accountFilter) accountFilter.value = "";
      renderReimbursements();
    };
  }
}

function bindFinanceFilters() {
  ["incomeMonthFilter", "incomeEntityFilter", "incomeAccountFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderIncomeTable);
  });
  ["expenseMonthFilter", "expenseEntityFilter", "expenseAccountFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderExpensesTable);
  });
  ["financeMonthFilter", "financeEntityFilter", "financeAccountFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderFinanceSummary);
  });
  document.getElementById("incomeClearFilter")?.addEventListener("click", () => {
    document.getElementById("incomeMonthFilter").value = "";
    document.getElementById("incomeEntityFilter").value = "";
    document.getElementById("incomeAccountFilter").value = "";
    renderIncomeTable();
  });

  document.getElementById("incomeDeleteFilteredBtn")?.addEventListener("click", deleteFilteredIncome);
  document.getElementById("expenseClearFilter")?.addEventListener("click", () => {
    document.getElementById("expenseMonthFilter").value = "";
    document.getElementById("expenseEntityFilter").value = "";
    document.getElementById("expenseAccountFilter").value = "";
    renderExpensesTable();
  });

  document.getElementById("expenseDeleteFilteredBtn")?.addEventListener("click", deleteFilteredExpenses);
  document.getElementById("financeClearFilter")?.addEventListener("click", () => {
    document.getElementById("financeMonthFilter").value = "";
    document.getElementById("financeEntityFilter").value = "";
    document.getElementById("financeAccountFilter").value = "";
    renderFinanceSummary();
  });
}

async function deleteFilteredIncome() {
  const rows = filterFinanceRows(state.incomeRecords, "income");
  if (!rows.length) {
    showMessage("当前筛选条件下没有可删除的收入记录。", "error");
    return;
  }

  const month = document.getElementById("incomeMonthFilter")?.value || "全部月份";
  const entityText = document.getElementById("incomeEntityFilter")?.selectedOptions?.[0]?.textContent || "全部业务归属";

  const ok = confirm(`确定删除当前筛选下的 ${rows.length} 条收入记录吗？\n月份：${month}\n业务归属：${entityText}\n\n删除后会同步还原账户余额。`);
  if (!ok) return;

  for (const item of rows) {
    await syncFinanceAccountEffect("income", item, null);
    const { error } = await db.from(tables.income).delete().eq("id", item.id);
    if (error) {
      showMessage(`删除失败：${error.message}`, "error");
      await loadAll();
      renderAll();
      return;
    }
  }

  await loadAll();
  renderAll();
  showMessage(`已删除 ${rows.length} 条收入记录。`, "ok");
}

async function deleteFilteredExpenses() {
  const rows = filterFinanceRows(state.expenseRecords, "expense");
  if (!rows.length) {
    showMessage("当前筛选条件下没有可删除的支出记录。", "error");
    return;
  }

  const month = document.getElementById("expenseMonthFilter")?.value || "全部月份";
  const entityText = document.getElementById("expenseEntityFilter")?.selectedOptions?.[0]?.textContent || "全部业务归属";

  const ok = confirm(`确定删除当前筛选下的 ${rows.length} 条支出记录吗？\n月份：${month}\n业务归属：${entityText}\n\n删除后会同步还原账户余额。`);
  if (!ok) return;

  for (const item of rows) {
    await syncFinanceAccountEffect("expense", item, null);
    const { error } = await db.from(tables.expenses).delete().eq("id", item.id);
    if (error) {
      showMessage(`删除失败：${error.message}`, "error");
      await loadAll();
      renderAll();
      return;
    }
  }

  await loadAll();
  renderAll();
  showMessage(`已删除 ${rows.length} 条支出记录。`, "ok");
}

function updateFinanceFilters() {
  const options = `<option value="">全部业务归属</option>` + state.businessEntities
    .map(x => `<option value="${escAttr(x.id)}">${esc(x.name)}</option>`)
    .join("");
  ["incomeEntityFilter", "expenseEntityFilter", "financeEntityFilter", "reimbursementEntityFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = options;
    el.value = old;
  });
}

function openCreateModal(type, prefill = {}) {
  state.editing = { type, id: null };
  buildForm(type, prefill);
  clearModalSaveErrorV944();
  document.getElementById("modalTitle").textContent = modalTitle(type, false);
  document.getElementById("modal").classList.remove("hidden");
}

function openEditModal(type, id) {
  state.editing = { type, id };
  buildForm(type, findLocal(type, id));
  clearModalSaveErrorV944();
  document.getElementById("modalTitle").textContent = modalTitle(type, true);
  document.getElementById("modal").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  document.getElementById("modalForm").innerHTML = "";
  state.editing = null;
  state.pendingExpenseAttachment = null;
  state.isSavingForm = false;
}


// === v2.3 hard fix modal form functions ===
function getFields(type) {
  const businessOptions = state.businessEntities.map(x => ({ value: x.id, label: x.name }));
  const subjectOptions = [{ value: "", label: "未设置" }, ...state.subjects.map(x => ({ value: x.id, label: x.name }))];

  if (type === "business") return [
    { name: "name", label: "名称", required: true },
    { name: "code", label: "代码", required: true },
    {
      name: "entity_type", label: "类型", type: "select", default: "company", options: [
        { value: "company", label: "公司" },
        { value: "personal", label: "个人" },
        { value: "other", label: "其他" },
      ]
    },
    { name: "default_currency", label: "默认币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "is_company_report", label: "计入公司报表", type: "checkbox", default: false },
    { name: "is_active", label: "状态启用", type: "checkbox", default: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "subject") return [
    { name: "name", label: "科目名称", required: true },
    { name: "primary_category", label: "一级分类", type: "select", default: "班课", options: safeSubjectPrimaryCategoryOptions() },
    { name: "category", label: "二级分类", type: "select", default: "学部进学", options: subjectCategoryOptions() },
    { name: "tertiary_category", label: "三级分类", type: "select", default: "EJU留考课程", options: safeSubjectTertiaryCategoryOptions("学部进学") },
    { name: "color", label: "颜色", type: "color-palette", default: "#dff2fb" },
    { name: "sort_order", label: "排序", type: "number", default: 0 },
    { name: "is_active", label: "状态启用", type: "checkbox", default: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "student") return [
    { name: "name", label: "学生姓名", required: true },
    { name: "display_name", label: "显示名" },
    { name: "business_entity_id", label: "默认业务归属", type: "select", options: businessOptions, required: true },
    { name: "course_track", label: "文理区分", type: "select", default: "science", options: [{ value: "science", label: "理科" }, { value: "humanities", label: "文科" }] },
    { name: "preset_exchange_rate", label: "预设汇率", type: "number", default: "", step: "0.0001" },
    { name: "wechat", label: "微信" },
    { name: "phone", label: "电话" },
    { name: "parent_name", label: "家长姓名" },
    { name: "parent_wechat", label: "家长微信" },
    { name: "entrance_date", label: "入塾日期", type: "date" },
    { name: "status", label: "状态", type: "select", default: "active", options: statusOptions() },
    { name: "target_schools", label: "志望校/目标", type: "textarea", full: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "teacher") return [
    { name: "name", label: "老师姓名", required: true },
    { name: "display_name", label: "显示名" },
    { name: "department", label: "所属", type: "select", default: "常勤老师", options: teacherDepartmentOptions() },
    { name: "default_subject_id", label: "默认科目", type: "select", options: subjectOptions },
    { name: "default_hourly_rate", label: "默认时薪", type: "number", default: 0 },
    { name: "default_currency", label: "工资币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "default_payment_currency", label: "支付币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "default_business_entity_id", label: "默认业务归属", type: "select", options: [{ value: "", label: "未设置" }, ...businessOptions] },
    { name: "default_payment_method", label: "默认支付方式", type: "select", options: paymentMethodOptions() },
    { name: "bank_name", label: "银行名" },
    { name: "bank_branch_code", label: "支店番号" },
    { name: "bank_branch_name", label: "支店名" },
    { name: "bank_account_number", label: "口座番号" },
    { name: "bank_account_name", label: "名义" },
    { name: "alipay_account", label: "支付宝账号" },
    { name: "wechat_account", label: "微信账号" },
    { name: "status", label: "老师状态", type: "select", default: "employed", options: teacherStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "income") return [
    { name: "income_date", label: "收入日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "settlement_month", label: "学生结算月份", type: "month", default: currentYearMonth() },
    { name: "payment_currency", label: "实际付款币种", type: "select", default: "CNY", options: [{ value: "CNY", label: "人民币" }, { value: "JPY", label: "日元" }] },
    { name: "include_in_student_settlement", label: "计入学生月度结算", type: "checkbox", default: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "入账账户", type: "select", options: accountOptions(), required: true },
    { name: "income_category", label: "收入分类", type: "select", default: "tuition", options: incomeCategoryOptions() },
    { name: "student_id", label: "学生", type: "select", options: studentOptions(), className: "tuition-student-row" },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "CNY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: "", required: true },
    { name: "exchange_rate", label: "汇率", type: "number" },
    { name: "payment_method", label: "收款方式", type: "select", options: paymentMethodOptions() },
    { name: "status", label: "状态", type: "select", default: "received", options: incomeStatusOptions() },
    { name: "is_taxable_income", label: "计税收入", type: "checkbox", default: true },
    { name: "tax_category", label: "税务分类", default: "売上" },
    { name: "receipt_status", label: "收据/凭证", type: "select", default: "待确认", options: receiptStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "expense") return [
    { name: "expense_date", label: "支出日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "支付账户", type: "select", options: accountOptions(), required: true },
    { name: "expense_category", label: "支出分类", type: "select", default: "other", options: expenseCategoryOptions() },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: "", required: true },
    { name: "exchange_rate", label: "汇率", type: "number" },
    { name: "payment_method", label: "支付方式", type: "select", options: paymentMethodOptions() },
    { name: "status", label: "状态", type: "select", default: "paid", options: expenseStatusOptions() },
    { name: "is_business_expense", label: "可作为经费", type: "checkbox", default: true },
    { name: "tax_category", label: "税务分类", type: "select", default: "待确认", options: taxCategoryOptions() },
    { name: "receipt_status", label: "收据/发票", type: "select", default: "待确认", options: receiptStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "reimbursement") return [
    { name: "reimbursement_date", label: "报销日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "from_account_id", label: "公司出款账户", type: "select", options: companyAccountOptions(), required: true },
    { name: "to_account_id", label: "报销对象账户", type: "select", options: advanceAccountOptions(), required: true },
    { name: "currency", label: "币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "amount", label: "报销金额", type: "number", default: "", required: true },
    { name: "status", label: "状态", type: "select", default: "paid", options: reimbursementStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "account") return [
    { name: "name", label: "账户名称", required: true },
    { name: "account_code", label: "账户代码" },
    {
      name: "account_type", label: "账户类型", type: "select", default: "bank", options: [
        { value: "bank", label: "银行" },
        { value: "cash", label: "现金" },
        { value: "card", label: "信用卡" },
        { value: "wechat", label: "微信" },
        { value: "alipay", label: "支付宝" },
        { value: "paypay", label: "PayPay" },
        { value: "other", label: "其他" },
      ]
    },
    { name: "currency", label: "币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "business_entity_id", label: "业务归属", type: "select", options: [{ value: "", label: "未设置" }, ...businessOptions] },
    { name: "opening_balance", label: "初始余额", type: "number", default: 0 },
    { name: "current_balance", label: "当前余额", type: "number", default: 0 },
    { name: "is_company_account", label: "公司账户", type: "checkbox", default: false },
    { name: "is_active", label: "状态启用", type: "checkbox", default: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  return [];
}

function safeSubjectPrimaryCategoryOptions() {
  return typeof subjectPrimaryCategoryOptions === "function"
    ? subjectPrimaryCategoryOptions()
    : [{ value: "班课", label: "班课" }, { value: "VIP", label: "VIP" }];
}

function safeSubjectTertiaryCategoryOptions(category) {
  return typeof subjectTertiaryCategoryOptions === "function"
    ? subjectTertiaryCategoryOptions(category)
    : [{ value: "EJU留考课程", label: "EJU留考课程" }, { value: "校内考课程", label: "校内考课程" }];
}

function renderField(field, value, formData = {}) {
  const val = value ?? field.default ?? "";
  const full = field.full ? " full" : "";
  const extraClass = field.className ? " " + field.className : "";
  const required = field.required ? "required" : "";

  if (field.type === "select") {
    let options = field.options || [];
    if (field.name === "tertiary_category") {
      options = safeSubjectTertiaryCategoryOptions(formData.category || "学部进学");
    }
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <select name="${field.name}" ${required}>
          ${options.map(opt => `<option value="${escAttr(opt.value)}" ${String(val) === String(opt.value) ? "selected" : ""}>${esc(opt.label)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  if (field.type === "textarea") {
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <textarea name="${field.name}" ${required}>${esc(val)}</textarea>
      </div>
    `;
  }

  if (field.type === "checkbox") {
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <select name="${field.name}">
          <option value="true" ${val === true || val === "true" ? "selected" : ""}>是</option>
          <option value="false" ${val === false || val === "false" ? "selected" : ""}>否</option>
        </select>
      </div>
    `;
  }

  if (field.type === "color-palette") {
    const colors = typeof subjectColorOptions === "function" ? subjectColorOptions() : ["#6fb7df", "#f6d365", "#81c784"];
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <div class="color-field">
          <input name="${field.name}" type="color" value="${escAttr(val || "#dff2fb")}" ${required} />
          <div class="color-palette">
            ${colors.map(color => `
              <button type="button" class="color-swatch" style="background:${escAttr(color)}" data-color="${escAttr(color)}" title="${escAttr(color)}"></button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="form-row${full}${extraClass}">
      <label>${field.label}</label>
      <input name="${field.name}" type="${field.type || "text"}" value="${escAttr(val)}" ${required} />
    </div>
  `;
}


function schoolGetFieldsV24(type) {
  if (typeof getFields === "function") {
    return getFields(type);
  }

  const businessOptions = state.businessEntities.map(x => ({ value: x.id, label: x.name }));
  const subjectOptions = [{ value: "", label: "未设置" }, ...state.subjects.map(x => ({ value: x.id, label: x.name }))];

  if (type === "expense") return [
    { name: "expense_date", label: "支出日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "settlement_month", label: "学生结算月份", type: "month", default: currentYearMonth() },
    { name: "payment_currency", label: "实际付款币种", type: "select", default: "CNY", options: [{ value: "CNY", label: "人民币" }, { value: "JPY", label: "日元" }] },
    { name: "include_in_student_settlement", label: "计入学生月度结算", type: "checkbox", default: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "支付账户", type: "select", options: accountOptions(), required: true },
    { name: "expense_category", label: "支出分类", type: "select", default: "other", options: expenseCategoryOptions() },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: "", required: true },
    { name: "exchange_rate", label: "汇率", type: "number" },
    { name: "payment_method", label: "支付方式", type: "select", options: paymentMethodOptions() },
    { name: "status", label: "状态", type: "select", default: "paid", options: expenseStatusOptions() },
    { name: "is_business_expense", label: "可作为经费", type: "checkbox", default: true },
    { name: "tax_category", label: "税务分类", type: "select", default: "待确认", options: taxCategoryOptions() },
    { name: "receipt_status", label: "收据/发票", type: "select", default: "待确认", options: receiptStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "income") return [
    { name: "income_date", label: "收入日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "settlement_month", label: "学生结算月份", type: "month", default: currentYearMonth() },
    { name: "payment_currency", label: "实际付款币种", type: "select", default: "CNY", options: [{ value: "CNY", label: "人民币" }, { value: "JPY", label: "日元" }] },
    { name: "include_in_student_settlement", label: "计入学生月度结算", type: "checkbox", default: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "入账账户", type: "select", options: accountOptions(), required: true },
    { name: "income_category", label: "收入分类", type: "select", default: "tuition", options: incomeCategoryOptions() },
    { name: "student_id", label: "学生", type: "select", options: studentOptions(), className: "tuition-student-row" },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "CNY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: "", required: true },
    { name: "exchange_rate", label: "汇率", type: "number" },
    { name: "payment_method", label: "收款方式", type: "select", options: paymentMethodOptions() },
    { name: "status", label: "状态", type: "select", default: "received", options: incomeStatusOptions() },
    { name: "is_taxable_income", label: "计税收入", type: "checkbox", default: true },
    { name: "tax_category", label: "税务分类", default: "売上" },
    { name: "receipt_status", label: "收据/凭证", type: "select", default: "待确认", options: receiptStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  // Fallback for old basic forms. Use getFields should normally exist in v2.4 package.
  return [];
}


// === v6.2 expense modal manual attachment upload ===
function attachManualExpenseAttachmentAreaV62(type) {
  if (type !== "expense") return;

  const form = document.getElementById("modalForm");
  if (!form || document.getElementById("manualExpenseAttachmentInput")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-row full attachment-upload-row";
  wrapper.innerHTML = `
    <label>凭证附件</label>
    <div class="attachment-upload-box">
      <button type="button" class="secondary-btn" id="manualExpenseAttachmentBtn">上传凭证</button>
      <span id="manualExpenseAttachmentName" class="attachment-upload-name">未选择文件</span>
      <input type="file" id="manualExpenseAttachmentInput" accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png" class="hidden" />
      <p class="form-help">用于给手动输入或已存在的支出追加凭证。这里不会自动识别金额；保存支出后自动上传并关联。</p>
    </div>
  `;

  form.appendChild(wrapper);

  const btn = document.getElementById("manualExpenseAttachmentBtn");
  const input = document.getElementById("manualExpenseAttachmentInput");
  const name = document.getElementById("manualExpenseAttachmentName");

  btn.onclick = () => input.click();
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;

    state.pendingExpenseAttachment = {
      file,
      extractedText: "",
      sourceType: "manual_upload",
    };

    if (name) name.textContent = file.name;
    showMessage("凭证已选择。保存支出后会自动上传。", "ok");
  };
}

function buildForm(type, data = {}) {
  const form = document.getElementById("modalForm");
  const fields = schoolGetFieldsV24(type);

  form.innerHTML = fields.map(field => renderField(field, data[field.name], data)).join("") + `
    <div class="form-actions">
      <button type="button" class="secondary-btn" id="cancelFormBtn">取消</button>
      <button type="submit" class="primary-btn">保存</button>
    </div>
  `;

  document.getElementById("cancelFormBtn").addEventListener("click", closeModal);
  attachManualExpenseAttachmentAreaV62(type);
  attachManualExpenseAttachmentAreaStableV70(type);
  form.onsubmit = saveForm;
  bindTuitionStudentField(form);
  form.querySelectorAll("[data-color]").forEach(btn => {
    btn.addEventListener("click", () => {
      const input = form.querySelector('input[name="color"]');
      if (input) input.value = btn.dataset.color;
    });
  });

  const categorySelect = form.querySelector('select[name="category"]');
  const tertiarySelect = form.querySelector('select[name="tertiary_category"]');
  if (categorySelect && tertiarySelect) {
    categorySelect.addEventListener("change", () => {
      const options = subjectTertiaryCategoryOptions(categorySelect.value);
      tertiarySelect.innerHTML = options.map(opt => `<option value="${escAttr(opt.value)}">${esc(opt.label)}</option>`).join("");
    });
  }
}

function renderField(field, value, formData = {}) {
  const val = value ?? field.default ?? "";
  const full = field.full ? " full" : "";
  const extraClass = field.className ? " " + field.className : "";
  const required = field.required ? "required" : "";

  if (field.type === "select") {
    let options = field.options || [];
    if (field.name === "tertiary_category") {
      const currentCategory = formData.category || "学部进学";
      options = subjectTertiaryCategoryOptions ? subjectTertiaryCategoryOptions(currentCategory) : options;
    }
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <select name="${field.name}" ${required}>
          ${options.map(opt => `<option value="${escAttr(opt.value)}" ${String(val) === String(opt.value) ? "selected" : ""}>${esc(opt.label)}</option>`).join("")}
        </select>
      </div>
    `;
  }

  if (field.type === "textarea") {
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <textarea name="${field.name}" ${required}>${esc(val)}</textarea>
      </div>
    `;
  }

  if (field.type === "checkbox") {
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <select name="${field.name}">
          <option value="true" ${val === true || val === "true" ? "selected" : ""}>是</option>
          <option value="false" ${val === false || val === "false" ? "selected" : ""}>否</option>
        </select>
      </div>
    `;
  }

  if (field.type === "color-palette") {
    const colors = subjectColorOptions ? subjectColorOptions() : ["#6fb7df", "#f6d365", "#81c784"];
    return `
      <div class="form-row${full}${extraClass}">
        <label>${field.label}</label>
        <div class="color-field">
          <input name="${field.name}" type="color" value="${escAttr(val || "#dff2fb")}" ${required} />
          <div class="color-palette">
            ${colors.map(color => `
              <button type="button" class="color-swatch" style="background:${escAttr(color)}" data-color="${escAttr(color)}" title="${escAttr(color)}"></button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  return `
    <div class="form-row${full}${extraClass}">
      <label>${field.label}</label>
      <input name="${field.name}" type="${field.type || "text"}" value="${escAttr(val)}" ${required} />
    </div>
  `;
}



function bindTuitionStudentField(form) {
  const incomeCategory = form.querySelector('select[name="income_category"]');
  const studentRow = form.querySelector(".tuition-student-row");
  const studentSelect = form.querySelector('select[name="student_id"]');

  if (!incomeCategory || !studentRow || !studentSelect) return;

  function update() {
    const isTuition = incomeCategory.value === "tuition";
    studentRow.classList.toggle("hidden", !isTuition);
    if (!isTuition) studentSelect.value = "";
  }

  incomeCategory.addEventListener("change", update);
  update();
}


function syncFinanceFilterAfterSave(type, record) {
  if (!record?.year_month) return;

  if (type === "expense") {
    const el = document.getElementById("expenseMonthFilter");
    if (el) el.value = record.year_month;
  }

  if (type === "income") {
    const el = document.getElementById("incomeMonthFilter");
    if (el) el.value = record.year_month;
  }

  const financeEl = document.getElementById("financeMonthFilter");
  if (financeEl && !financeEl.value) {
    financeEl.value = record.year_month;
  }
}


// === v7.0 stable lesson pairing fallback ===
function schoolStableFindMatchingPlannedLessonV70(payload) {
  if (!payload || payload.lesson_type !== "actual") return null;
  const same = (a, b) => String(a || "") === String(b || "");
  return (state.lessonRecords || []).find(x =>
    x.lesson_type === "planned" &&
    same(x.student_id, payload.student_id) &&
    same(x.teacher_id, payload.teacher_id) &&
    same(x.subject_id, payload.subject_id) &&
    same(x.lesson_date, payload.lesson_date) &&
    same(x.start_time, payload.start_time) &&
    same(x.end_time, payload.end_time)
  ) || null;
}

function resetFormSavingStateV71(form, submitButton) {
  state.isSavingForm = false;
  state.isSavingReimbursement = false;
  state.activeReimbursementSubmitKey = "";
  state.activeReimbursementSubmitKey = "";
  if (form) form.dataset.saving = "false";
  if (submitButton) submitButton.disabled = false;
}



function showModalSaveErrorV944(message) {
  const form = document.getElementById("modalForm");
  if (!form) {
    showMessage(message, "error");
    return;
  }

  let box = document.getElementById("modalSaveErrorV944");
  if (!box) {
    box = document.createElement("div");
    box.id = "modalSaveErrorV944";
    box.className = "modal-save-error-v944 full";
    const actions = form.querySelector(".modal-actions, .form-actions");
    if (actions && actions.parentElement === form) form.insertBefore(box, actions);
    else form.appendChild(box);
  }

  box.textContent = message;
  box.classList.remove("hidden");
  box.scrollIntoView({ behavior: "smooth", block: "center" });
  showMessage(message, "error");
}

function clearModalSaveErrorV944() {
  const box = document.getElementById("modalSaveErrorV944");
  if (box) {
    box.textContent = "";
    box.classList.add("hidden");
  }
}

function lessonStudentSettlementMonthForLockV943(record) {
  return record?.year_month || record?.settlement_month || String(record?.lesson_date || "").slice(0, 7) || "";
}

function lessonTeacherSettlementMonthForLockV943(record) {
  return record?.teacher_settlement_month || String(record?.lesson_date || "").slice(0, 7) || record?.year_month || "";
}

function sameValueV943(a, b) {
  const va = a === undefined || a === null ? "" : String(a);
  const vb = b === undefined || b === null ? "" : String(b);
  return va === vb;
}

function lessonChangedFieldsV943(oldRecord, newRecord, fields) {
  return fields.filter(field => !sameValueV943(oldRecord?.[field], newRecord?.[field]));
}

async function hasLockedStudentSettlementV943(studentId, month) {
  if (!studentId || !month) return false;
  const { data, error } = await db
    .from("school_student_monthly_settlements")
    .select("id")
    .eq("student_id", studentId)
    .eq("year_month", month)
    .eq("settlement_status", "locked")
    .limit(1);

  if (error) {
    console.warn("student settlement edit-lock check failed", error);
    return false;
  }
  return !!(data && data.length);
}

async function hasLockedTeacherWageV943(teacherId, month) {
  if (!teacherId || !month) return false;
  const { data, error } = await db
    .from("school_teacher_wage_locks")
    .select("id")
    .eq("teacher_id", teacherId)
    .eq("settlement_month", month)
    .eq("status", "locked")
    .limit(1);

  if (error) {
    console.warn("teacher wage edit-lock check failed", error);
    return false;
  }
  return !!(data && data.length);
}

async function assertLessonEditAllowedV943(oldRecord, payload) {
  if (!oldRecord || oldRecord.lesson_type !== "actual") return { ok: true };

  const nextRecord = { ...oldRecord, ...payload };

  if (oldRecord.planned_lesson_id && !sameValueV943(oldRecord.year_month, nextRecord.year_month)) {
    return {
      ok: false,
      message: "该实际课时已关联预定课时，不能单独修改归属月份。请删除/撤销实际课时后，从正确月份的预定课时重新生成实际课时。",
    };
  }

  const studentLockedMonths = new Set([
    lessonStudentSettlementMonthForLockV943(oldRecord),
    lessonStudentSettlementMonthForLockV943(nextRecord),
  ].filter(Boolean));

  const teacherLockedTargets = [
    {
      teacherId: oldRecord.teacher_id,
      month: lessonTeacherSettlementMonthForLockV943(oldRecord),
    },
    {
      teacherId: nextRecord.teacher_id,
      month: lessonTeacherSettlementMonthForLockV943(nextRecord),
    },
  ].filter(x => x.teacherId && x.month);

  const studentFields = [
    "student_id",
    "year_month",
    "lesson_type",
    "lesson_date",
    "subject_id",
    "duration_hours",
    "unit_price",
    "lesson_fee",
    "is_billable",
    "status",
    "business_entity_id",
    "settlement_month",
  ];

  const teacherFields = [
    "teacher_id",
    "teacher_settlement_month",
    "lesson_date",
    "start_time",
    "end_time",
    "duration_hours",
    "actual_minutes",
    "teacher_pay_hours",
    "subject_id",
    "student_id",
    "business_entity_id",
    "status",
  ];

  const changedStudentFields = lessonChangedFieldsV943(oldRecord, nextRecord, studentFields);
  const changedTeacherFields = lessonChangedFieldsV943(oldRecord, nextRecord, teacherFields);

  if (changedStudentFields.length) {
    for (const month of studentLockedMonths) {
      const studentId = oldRecord.student_id || nextRecord.student_id;
      if (await hasLockedStudentSettlementV943(studentId, month)) {
        return {
          ok: false,
          message: `该课时关联的学生 ${month} 月度结算已锁定，请先撤销学生月度结算锁定后再修改。`,
        };
      }
    }
  }

  if (changedTeacherFields.length) {
    for (const target of teacherLockedTargets) {
      if (await hasLockedTeacherWageV943(target.teacherId, target.month)) {
        return {
          ok: false,
          message: `该课时关联的老师 ${target.month} 工资已经锁定，请先撤销老师工资锁定后再修改。`,
        };
      }
    }
  }

  return { ok: true };
}

async function saveForm(e) {
  e = e || { preventDefault() { }, stopPropagation() { }, stopImmediatePropagation() { }, target: document.getElementById("modalForm") };
  e.preventDefault();
  const form = e.target;
  const submitButton = form?.querySelector('button[type="submit"], .primary-btn');
  if (!state.editing) return;

  const type = state.editing.type;
  if (state.isSavingForm || form?.dataset?.saving === "true") return;
  clearModalSaveErrorV944();
  state.isSavingForm = true;
  if (form) form.dataset.saving = "true";
  if (submitButton) submitButton.disabled = true;
  const fd = new FormData(e.target);
  const fields = schoolGetFieldsV24(type);
  const payload = {};

  for (const field of fields) {
    let value = fd.get(field.name);
    if (field.type === "checkbox") value = value === "true";
    if (field.type === "number") value = value === "" ? 0 : Number(value);
    if (value === "") value = null;
    payload[field.name] = value;
  }

  if (type === "income" && payload.income_category !== "tuition") {
    payload.student_id = null;
  }

  if (type === "income" || type === "expense") {
    normalizeFinancePayload(payload);
  }

  if (type === "expense" && !state.editing.id) {
    const okToSave = await confirmDuplicateExpenseIfNeeded(payload);
    if (!okToSave) {
      resetFormSavingStateV71(form, submitButton);
      return;
    }
  }

  if (type === "reimbursement" && !state.editing.id) {
    payload.status = payload.status || "paid";

    const ids = (state.pendingReimbursementExpenseIds || []).slice().sort();
    const submitKey = [
      payload.year_month || "",
      payload.from_account_id || "",
      payload.to_account_id || "",
      payload.currency || "",
      String(payload.amount || 0),
      ids.join(",")
    ].join("|");

    if (state.activeReimbursementSubmitKey === submitKey) {
      return;
    }

    state.activeReimbursementSubmitKey = submitKey;
  }

  const table = tableForType(type);
  const oldRecord = state.editing.id ? findLocal(type, state.editing.id) : null;

  if (type === "lesson" && state.editing.id) {
    const lockCheck = await assertLessonEditAllowedV943(oldRecord, payload);
    if (!lockCheck.ok) {
      resetFormSavingStateV71(form, submitButton);
      showModalSaveErrorV944(lockCheck.message);
      return;
    }
  }

  let result;
  if (state.editing.id) {
    result = await db.from(table).update(payload).eq("id", state.editing.id).select().single();
  } else {
    result = await db.from(table).insert(payload).select().single();
  }

  if (result.error) {
    resetFormSavingStateV71(form, submitButton);
    showModalSaveErrorV944(result.error.message);
    return;
  }

  if (type === "expense") {
    await uploadPendingExpenseAttachment(result.data);
  }

  if (type === "reimbursement") {
    await syncReimbursementAccountEffect(oldRecord, result.data);
    await saveReimbursementItems(result.data);
  }

  if (type === "income" || type === "expense") {
    await syncFinanceAccountEffect(type, oldRecord, result.data);
  }

  closeModal();
  await loadAll();
  if (type === "income" || type === "expense") {
    syncFinanceFilterAfterSave(type, result.data);
  }
  setDefaultExpenseMonthFilter();
  renderAll();
  resetFormSavingStateV71(form, submitButton);
  state.pendingActualPlanId = null;
  showMessage("保存成功。", "ok");
}

async function deleteRecord(type, id) {
  const deleteKey = `${type}:${id}`;
  if (state.activeDeleteKey === deleteKey) return;
  state.activeDeleteKey = deleteKey;

  const item = findLocal(type, id);
  if (!confirm(`确定删除「${item?.name || item?.title || "这条记录"}」吗？`)) {
    state.activeDeleteKey = "";
    return;
  }

  if (type === "income" || type === "expense") {
    await syncFinanceAccountEffect(type, item, null);
  }

  if (type === "reimbursement") {
    await syncReimbursementAccountEffect(item, null);
    const itemRows = item.items || [];
    for (const row of itemRows) {
      if (row.expense_id) {
        await db.from(tables.expenses).update({ reimbursement_status: "pending" }).eq("id", row.expense_id);
      }
    }
  }

  const { error } = await db.from(tableForType(type)).delete().eq("id", id);
  if (error) {
    state.activeDeleteKey = "";
    showMessage(error.message, "error");
    return;
  }

  await loadAll();
  setDefaultExpenseMonthFilter();
  renderAll();
  state.activeDeleteKey = "";
  showMessage("删除成功。", "ok");
}

function findLocal(type, id) {
  const map = {
    business: state.businessEntities,
    subject: state.subjects,
    lesson: state.lessonRecords,
    student: state.students,
    teacher: state.teachers,
    account: state.accounts,
    income: state.incomeRecords,
    expense: state.expenseRecords,
    reimbursement: state.reimbursements,
  };
  return (map[type] || []).find(x => x.id === id) || {};
}

function tableForType(type) {
  return {
    business: tables.business,
    subject: tables.subjects,
    lesson: tables.lessons,
    student: tables.students,
    teacher: tables.teachers,
    account: tables.accounts,
    income: tables.income,
    expense: tables.expenses,
    reimbursement: tables.reimbursements,
  }[type];
}

function modalTitle(type, edit) {
  const map = {
    business: "业务归属",
    subject: "科目",
    lesson: "课时",
    student: "学生",
    teacher: "老师",
    account: "账户",
    income: "收入",
    expense: "支出",
    reimbursement: "报销",
  };
  return `${edit ? "编辑" : "新增"}${map[type]}`;
}

function actionButtons(type, id) {
  return `
    <div class="table-actions">
      <button class="secondary-btn" data-edit="${id}" data-type="${type}">编辑</button>
      <button class="danger-btn" data-delete="${id}" data-type="${type}">删除</button>
    </div>
  `;
}

let subjectDragId = null;
let subjectOrderSaving = false;

function bindSubjectDragSort() {
  const rows = document.querySelectorAll("[data-subject-row]");
  rows.forEach(row => {
    const handle = row.querySelector(".drag-handle");
    if (!handle) return;

    handle.addEventListener("dragstart", (e) => {
      subjectDragId = row.dataset.subjectRow;
      row.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
    });

    handle.addEventListener("dragend", async () => {
      row.classList.remove("dragging");
      if (subjectDragId && !subjectOrderSaving) {
        await saveSubjectOrderFromDom();
      }
      subjectDragId = null;
    });

    row.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = document.querySelector(".dragging");
      if (!dragging || dragging === row) return;
      const tbody = row.parentElement;
      const rect = row.getBoundingClientRect();
      const isAfter = e.clientY > rect.top + rect.height / 2;
      const reference = isAfter ? row.nextSibling : row;
      if (reference !== dragging) {
        tbody.insertBefore(dragging, reference);
      }
    });
  });
}

async function saveSubjectOrderFromDom() {
  subjectOrderSaving = true;
  const rows = [...document.querySelectorAll("[data-subject-row]")];
  const currentOrder = new Map(state.subjects.map(item => [item.id, Number(item.sort_order || 0)]));
  const updates = rows
    .map((row, index) => ({
      id: row.dataset.subjectRow,
      sort_order: (index + 1) * 10,
    }))
    .filter(item => currentOrder.get(item.id) !== item.sort_order);

  if (updates.length === 0) {
    subjectOrderSaving = false;
    return;
  }

  for (const item of updates) {
    const { error } = await db.from(tables.subjects).update({ sort_order: item.sort_order }).eq("id", item.id);
    if (error) {
      subjectOrderSaving = false;
      showMessage(error.message, "error");
      await loadSubjects();
      renderSubjectsTable();
      return;
    }
  }

  await loadSubjects();
  renderSubjectsTable();
  subjectOrderSaving = false;
  showMessage("科目排序已更新。", "ok");
}

function normalizeFinancePayload(payload) {
  const amount = Number(payload.amount || 0);
  const currency = payload.currency || "JPY";
  const rate = Number(payload.exchange_rate || 0);

  payload.amount = amount;
  payload.amount_jpy = currency === "JPY" ? amount : (rate ? amount * rate : 0);
  payload.amount_cny = currency === "CNY" ? amount : (rate ? amount / rate : 0);
}



function makeSafeStorageFileName(file) {
  const originalName = file?.name || "receipt";
  const extMatch = originalName.match(/\.([A-Za-z0-9]{1,10})$/);
  let ext = extMatch ? extMatch[1].toLowerCase() : "";

  if (!ext) {
    const type = file?.type || "";
    if (type.includes("jpeg")) ext = "jpg";
    else if (type.includes("png")) ext = "png";
    else if (type.includes("pdf")) ext = "pdf";
    else ext = "dat";
  }

  const base = originalName
    .replace(/\.[^.]+$/, "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "receipt";

  return `${base}.${ext}`;
}


function normalizeTextForDuplicate(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[（）()・/\\_\-—–.,，。]/g, "")
    .toLowerCase();
}

function findPossibleDuplicateExpense(record) {
  if (!record) return null;

  const amount = Number(record.amount || 0);
  const date = record.expense_date || "";
  const ym = record.year_month || "";
  const desc = normalizeTextForDuplicate(record.description || record.note || "");

  return state.expenseRecords.find(item => {
    const sameAmount = Math.abs(Number(item.amount || 0) - amount) < 0.0001;
    const sameDate = (item.expense_date || "") === date;
    const sameMonth = (item.year_month || "") === ym;
    const itemDesc = normalizeTextForDuplicate(item.description || item.note || "");
    const similarDesc = desc && itemDesc && (desc.includes(itemDesc.slice(0, 8)) || itemDesc.includes(desc.slice(0, 8)));

    return sameAmount && (sameDate || sameMonth) && similarDesc;
  }) || null;
}


function findPossibleDuplicateAttachment() {
  const file = state.pendingExpenseAttachment?.file;
  if (!file) return null;

  return state.expenseRecords.find(item => {
    const attachments = item.attachments || [];
    return attachments.some(att => {
      return att.file_name === file.name && Number(att.file_size || 0) === Number(file.size || 0);
    });
  }) || null;
}

async function confirmDuplicateExpenseIfNeeded(record) {
  const fileDuplicate = findPossibleDuplicateAttachment();
  const duplicate = fileDuplicate || findPossibleDuplicateExpense(record);
  if (!duplicate) return true;

  const message = [
    fileDuplicate ? "可能已经上传过相同凭证文件。" : "可能存在重复支出记录。",
    "",
    `现有记录：${duplicate.expense_date || duplicate.year_month || ""} / ${duplicate.description || ""} / ${duplicate.amount || 0} ${duplicate.currency || ""}`,
    `本次记录：${record.expense_date || record.year_month || ""} / ${record.description || ""} / ${record.amount || 0} ${record.currency || ""}`,
    "",
    "是否仍然保存？"
  ].join("\n");

  return confirm(message);
}

async function uploadPendingExpenseAttachment(expenseRecord) {
  if (!expenseRecord || !state.pendingExpenseAttachment?.file) return;

  const pending = state.pendingExpenseAttachment;
  const file = pending.file;
  const safeName = makeSafeStorageFileName(file);
  const ym = expenseRecord.year_month || currentYearMonth();
  const path = `expenses/${ym}/${expenseRecord.id}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await db.storage
    .from("school-expense-files")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "application/octet-stream",
    });

  if (uploadError) {
    console.error("Storage upload error", uploadError, { path, safeName, originalName: file.name });
    showMessage(`支出已保存，但凭证上传失败：${uploadError.message || "Storage 400 Bad Request"}。可能是文件名或 Storage 设置问题。`, "error");
    return;
  }

  const { data: publicData } = db.storage.from("school-expense-files").getPublicUrl(path);

  const { error: insertError } = await db.from(tables.expenseAttachments).insert({
    expense_id: expenseRecord.id,
    file_name: file.name,
    file_type: file.type,
    file_size: file.size,
    storage_bucket: "school-expense-files",
    storage_path: path,
    public_url: publicData?.publicUrl || "",
    source_type: pending.sourceType || "manual",
    extracted_text: pending.extractedText || "",
    note: "支出记录保存时自动上传",
  });

  if (insertError) {
    showMessage(`支出已保存，但附件记录保存失败：${insertError.message}`, "error");
    return;
  }

  state.pendingExpenseAttachment = null;
  showMessage("凭证已上传并关联到支出记录。", "ok");
}

async function syncFinanceAccountEffect(type, oldRecord, newRecord) {
  const oldEffect = accountEffect(type, oldRecord);
  const newEffect = accountEffect(type, newRecord);
  const accountIds = [...new Set([oldEffect?.accountId, newEffect?.accountId].filter(Boolean))];

  for (const accountId of accountIds) {
    const account = state.accounts.find(x => x.id === accountId);
    if (!account) continue;

    let delta = 0;
    if (oldEffect && oldEffect.accountId === accountId) delta -= oldEffect.delta;
    if (newEffect && newEffect.accountId === accountId) delta += newEffect.delta;

    if (delta !== 0) {
      const nextBalance = Number(account.current_balance || 0) + delta;
      const { error } = await db.from(tables.accounts).update({ current_balance: nextBalance }).eq("id", accountId);
      if (error) {
        showMessage(error.message, "error");
        return;
      }

      await db.from(tables.transactions).insert({
        account_id: accountId,
        business_entity_id: (newRecord || oldRecord)?.business_entity_id || null,
        transaction_date: (newRecord?.income_date || newRecord?.expense_date || oldRecord?.income_date || oldRecord?.expense_date || todayStr()),
        year_month: (newRecord || oldRecord)?.year_month || currentYearMonth(),
        transaction_type: type === "income" ? "income_adjust" : "expense_adjust",
        related_table: type === "income" ? "school_income_records" : "school_expense_records",
        related_id: (newRecord || oldRecord)?.id || null,
        currency: account.currency,
        amount: delta,
        balance_after: nextBalance,
        description: "前端收支记录联动账户余额",
      });
    }
  }
}

function accountEffect(type, record) {
  if (!record || !record.account_id) return null;
  const isActiveIncome = type === "income" && record.status === "received";
  const isActiveExpense = type === "expense" && (record.status === "paid" || record.status === "reimbursed");
  if (!isActiveIncome && !isActiveExpense) return null;

  const account = state.accounts.find(x => x.id === record.account_id);
  const currency = account?.currency || record.currency;
  const amount = Number(record.amount || 0);
  const amountForAccount = record.currency === currency ? amount : Number(currency === "JPY" ? record.amount_jpy : record.amount_cny) || 0;
  const delta = type === "income" ? amountForAccount : -amountForAccount;
  return { accountId: record.account_id, delta };
}

function filterFinanceRows(rows, scope) {
  let month = "";
  let entity = "";
  let account = "";

  if (scope === "income") {
    month = document.getElementById("incomeMonthFilter")?.value || "";
    entity = document.getElementById("incomeEntityFilter")?.value || "";
    account = document.getElementById("incomeAccountFilter")?.value || "";
  } else if (scope === "expense") {
    month = document.getElementById("expenseMonthFilter")?.value || "";
    entity = document.getElementById("expenseEntityFilter")?.value || "";
    account = document.getElementById("expenseAccountFilter")?.value || "";
  } else {
    month = document.getElementById("financeMonthFilter")?.value || "";
    entity = document.getElementById("financeEntityFilter")?.value || "";
    account = document.getElementById("financeAccountFilter")?.value || "";
  }

  return rows.filter(x =>
    (!month || x.year_month === month) &&
    (!entity || x.business_entity_id === entity) &&
    (!account || x.account_id === account)
  );
}

function sumCny(rows) {
  return rows.reduce((sum, item) => sum + Number(item.amount_cny || (item.currency === "CNY" ? item.amount : 0) || 0), 0);
}

function formatCny(value) {
  return `¥${money(value)}`;
}

function incomeCategoryLabel(value) {
  const item = incomeCategoryOptions().find(x => x.value === value);
  return item?.label || value || "";
}

function expenseCategoryLabel(value) {
  const item = expenseCategoryOptions().find(x => x.value === value);
  return item?.label || value || "";
}

function financeStatusBadge(status) {
  const map = {
    received: ["已收", ""],
    pending: ["未收", "gray"],
    refunded: ["已退款", "red"],
    paid: ["已支付", ""],
    unpaid: ["未支付", "gray"],
    reimbursed: ["已报销", ""],
  };
  const [text, cls] = map[status] || [status || "", "gray"];
  return badge(text, cls);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function currentYearMonth() {
  return new Date().toISOString().slice(0, 7);
}

function setOptionalText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}



function setExpenseFilterToParsedMonth(parsed) {
  const el = document.getElementById("expenseMonthFilter");
  if (el && parsed?.year_month) el.value = parsed.year_month;
}

function applyExpensePrefillToModal(data) {
  const form = document.getElementById("modalForm");
  if (!form || !data) return;

  Object.entries(data).forEach(([key, value]) => {
    const el = form.querySelector(`[name="${key}"]`);
    if (!el || value === undefined || value === null) return;
    el.value = value;
  });
}



function attachManualExpenseAttachmentArea(type) {
  if (type !== "expense") return;

  const form = document.getElementById("modalForm");
  if (!form || document.getElementById("manualExpenseAttachmentInput")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-row full attachment-upload-row";
  wrapper.innerHTML = `
    <label>凭证附件</label>
    <div class="attachment-upload-box">
      <button type="button" class="secondary-btn" id="manualExpenseAttachmentBtn">上传凭证</button>
      <span id="manualExpenseAttachmentName" class="attachment-upload-name">未选择文件</span>
      <input type="file" id="manualExpenseAttachmentInput" accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png" class="hidden" />
      <p class="form-help">用于给手动输入或已存在的支出追加凭证，不会自动识别金额。</p>
    </div>
  `;

  form.appendChild(wrapper);

  const btn = document.getElementById("manualExpenseAttachmentBtn");
  const input = document.getElementById("manualExpenseAttachmentInput");
  const name = document.getElementById("manualExpenseAttachmentName");

  btn.onclick = () => input.click();
  input.onchange = () => {
    const file = input.files && input.files[0];
    if (!file) return;

    state.pendingExpenseAttachment = {
      file,
      extractedText: "",
      sourceType: "manual_upload",
    };

    name.textContent = file.name;
    showMessage("凭证已选择。保存支出后会自动上传。", "ok");
  };
}

function bindExpensePdfImport() {
  const btn = document.getElementById("importExpensePdfBtn");
  const input = document.getElementById("expensePdfInput");
  if (!btn || !input) return;

  btn.onclick = () => input.click();

  input.onchange = async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;

    try {
      showMessage("凭证读取中，请稍等...", "ok");
      let text = "";
      const lowerName = file.name.toLowerCase();

      if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
        text = await extractPdfText(file);
      } else if (file.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(file.name)) {
        text = await extractImageText(file);
      } else {
        throw new Error("暂时只支持 PDF / JPG / PNG 文件。");
      }

      const parsed = normalizeParsedExpenseAmount(parseExpenseReceiptText(text, file.name), text);
      state.pendingExpenseAttachment = {
        file,
        extractedText: text,
        sourceType: file.type.startsWith("image/") ? "image_ocr" : "pdf_text",
      };

      openCreateModal("expense", parsed);
      applyExpensePrefillToModal(parsed);
      setExpenseFilterToParsedMonth(parsed);
      showMessage(`凭证读取完成。识别金额：${parsed.amount || 0} ${parsed.currency || ""}。请确认内容后保存。`, "ok");
    } catch (error) {
      console.error(error);
      showMessage(`凭证读取失败：${error.message || error}`, "error");
    }
  };
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) throw new Error("PDF.js 未加载。请刷新页面后再试。");
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => item.str).join("\n"));
  }
  return pages.join("\n\n");
}

async function extractImageText(file) {
  if (!window.Tesseract) throw new Error("图片OCR组件未加载。请刷新页面后再试。");
  const result = await Tesseract.recognize(file, "jpn+eng", {
    logger: m => {
      if (m.status === "recognizing text" && m.progress) {
        showMessage(`图片识别中：${Math.round(m.progress * 100)}%`, "ok");
      }
    }
  });
  return result?.data?.text || "";
}

function applyExpensePrefillToModal(data) {
  const form = document.getElementById("modalForm");
  if (!form || !data) return;
  Object.entries(data).forEach(([key, value]) => {
    const el = form.querySelector(`[name="${key}"]`);
    if (!el || value === undefined || value === null) return;
    el.value = value;
  });
}


function normalizeParsedExpenseAmount(parsed, rawText) {
  if (!parsed) return parsed;
  const amount = Number(parsed.amount || 0);
  if (amount > 0 && amount >= 100) return parsed;

  const fallback = extractAnyYenAmount(rawText || "");
  if (fallback > 0) {
    parsed.amount = fallback;
  }

  return parsed;
}


function extractBankDebitAmount(text) {
  const normalized = (text || "").replace(/\s+/g, " ");
  // Bank-app style: "150,000 円 -" or "150,000円 -"
  const debit = normalized.match(/([0-9][0-9,]*)\s*円\s*[−\-ー―]/);
  if (debit) return Number(debit[1].replace(/,/g, ""));

  // If OCR misses yen, prefer large number before balance marker
  const beforeBalance = normalized.split(/残高|balance/i)[0] || normalized;
  const amounts = [...beforeBalance.matchAll(/([0-9][0-9,]{2,})/g)]
    .map(m => Number(m[1].replace(/,/g, "")))
    .filter(n => Number.isFinite(n) && n >= 100);

  return amounts.length ? Math.max(...amounts) : 0;
}

function parseExpenseReceiptText(text, fileName = "") {
  const rawText = text || "";
  const base = {
    expense_date: todayStr(),
    year_month: currentYearMonth(),
    business_entity_id: defaultCompanyEntityId(),
    account_id: "",
    expense_category: "other",
    description: fileName ? `凭证读取：${fileName}` : "凭证读取支出",
    currency: "JPY",
    amount: 0,
    exchange_rate: null,
    payment_method: "",
    status: "paid",
    is_business_expense: true,
    tax_category: "待确认",
    receipt_status: "有",
    note: `凭证读取来源：${fileName || "未命名文件"}`,
  };

  if (/いいオフィス|e-office|設備予約/i.test(rawText)) {
    const paymentDate = extractJapaneseDateAfter(rawText, "決済日時") || extractJapaneseDateAfter(rawText, "発行日") || todayStr();
    const usageDate = extractJapaneseDateAfter(rawText, "利用日時");
    return {
      ...base,
      expense_date: paymentDate,
      year_month: toYearMonth(usageDate || paymentDate),
      expense_category: "classroom",
      description: extractIiofficeDescription(rawText) || "いいオフィス 会議室利用",
      amount: extractYenAmountAfter(rawText, "合計（税込）") || extractYenAmountAfter(rawText, "ご請求額合計") || extractAnyYenAmount(rawText),
      payment_method: /Visa|カード|card/i.test(rawText) ? "card" : "",
      tax_category: "地代家賃",
      note: buildReceiptNote(fileName, rawText, [usageDate ? `利用日：${usageDate}` : "", extractJapaneseInvoiceNo(rawText) ? `登録番号：${extractJapaneseInvoiceNo(rawText)}` : ""]),
    };
  }

  if (/MainFunc|Genspark|Plus Monthly Subscription/i.test(rawText)) {
    const paymentDate = extractJapaneseDateAfter(rawText, "付款日期") || extractFirstJapaneseDate(rawText) || todayStr();
    const usdAmount = extractUsdAmount(rawText);
    const rate = extractUsdJpyRate(rawText);
    return {
      ...base,
      expense_date: paymentDate,
      year_month: toYearMonth(paymentDate),
      expense_category: "software",
      description: "Genspark Plus Monthly Subscription",
      amount: extractYenAmountAfter(rawText, "已扣款") || extractAnyYenAmount(rawText) || Math.round((usdAmount || 0) * (rate || 0)),
      exchange_rate: rate || null,
      payment_method: /Link|card|カード/i.test(rawText) ? "card" : "",
      tax_category: "通信費",
      note: buildReceiptNote(fileName, rawText, [usdAmount ? `原始金额：US$${usdAmount}` : "", rate ? `PDF汇率：1 USD = ${rate} JPY` : "", extractReceiptNo(rawText) ? `收据编号：${extractReceiptNo(rawText)}` : ""]),
    };
  }

  if (/Regus|リージャス|IWG|ビジネスラウンジ/i.test(rawText)) {
    const date = extractJapaneseSlashDateAfter(rawText, "請求日付") || extractJapaneseSlashDateAfter(rawText, "お支払い期日") || todayStr();
    return {
      ...base,
      expense_date: date,
      year_month: toYearMonth(date),
      expense_category: "classroom",
      description: "Regus / IWG ビジネスラウンジ・メンバーシップ",
      amount: extractYenAmountAfter(rawText, "総計") || extractYenAmountAfter(rawText, "合計金額（税込") || extractAnyYenAmount(rawText),
      payment_method: /Amex|カード/i.test(rawText) ? "card" : "",
      tax_category: "地代家賃",
      note: buildReceiptNote(fileName, rawText, [extractInvoiceNo(rawText) ? `請求書番号：${extractInvoiceNo(rawText)}` : ""]),
    };
  }

  if (/ラクスル|Raksul|名刺|チラシ|フライヤー/i.test(rawText) || /R-\d{12}/.test(fileName)) {
    const date = extractJapaneseDateAfter(rawText, "取引年月日") || extractFirstJapaneseDate(rawText) || todayStr();
    return {
      ...base,
      expense_date: date,
      year_month: toYearMonth(date),
      expense_category: "advertising",
      description: "ラクスル 名刺・チラシ印刷",
      amount: extractYenAmountAfter(rawText, "合計金額") || extractAnyYenAmount(rawText) || 4908,
      payment_method: /クレジットカード|card/i.test(rawText) ? "card" : "",
      tax_category: "広告宣伝費",
      note: buildReceiptNote(fileName, rawText, [extractReceiptCode(rawText) ? `領収書番号：${extractReceiptCode(rawText)}` : ""]),
    };
  }

  if (/ホウムショウ|法務省|電子定款|定款|PE/i.test(rawText) || /青空教育/.test(fileName)) {
    const date = extractWarekiDate(rawText) || extractShortJapaneseDate(rawText) || "2026-04-16";
    return {
      ...base,
      expense_date: date,
      year_month: toYearMonth(date),
      expense_category: "tax_accounting",
      description: /150,000/.test(rawText) ? "PE ホウムショウ" : "会社設立・行政手続き関連費用",
      amount: extractBankDebitAmount(rawText) || extractAnyYenAmount(rawText) || (/150,000/.test(rawText) ? 150000 : 40300),
      payment_method: /クレジット|card/i.test(rawText) ? "card" : "bank",
      tax_category: "租税公課",
      note: buildReceiptNote(fileName, rawText, ["司法/行政手续类凭证"]),
    };
  }

  const date = extractFirstJapaneseDate(rawText) || extractShortJapaneseDate(rawText) || todayStr();
  return {
    ...base,
    expense_date: date,
    year_month: toYearMonth(date),
    amount: extractAnyYenAmount(rawText),
    note: buildReceiptNote(fileName, rawText, ["未识别模板，请手动确认分类、金额和日期。"]),
  };
}

function buildReceiptNote(fileName, text, lines = []) {
  return [
    `凭证读取来源：${fileName || "未命名文件"}`,
    ...lines.filter(Boolean),
    `读取文本片段：${(text || "").replace(/\s+/g, " ").slice(0, 500)}`,
  ].filter(Boolean).join("\n");
}

function defaultCompanyEntityId() {
  const company = state.businessEntities.find(x => x.code === "aosora") || state.businessEntities.find(x => x.is_company_report);
  return company?.id || state.businessEntities[0]?.id || "";
}

function extractJapaneseDateAfter(text, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${safeLabel}[\\s\\S]{0,80}(20\\d{2})年\\s*(\\d{1,2})月\\s*(\\d{1,2})日`);
  const match = text.match(regex);
  return match ? `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}` : "";
}

function extractJapaneseSlashDateAfter(text, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`${safeLabel}[\\s\\S]{0,80}(20\\d{2})[\\/-](\\d{1,2})[\\/-](\\d{1,2})`);
  const match = text.match(regex);
  return match ? `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}` : "";
}

function extractFirstJapaneseDate(text) {
  const match = text.match(/(20\d{2})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  return match ? `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}` : "";
}

function extractShortJapaneseDate(text) {
  const match = text.match(/(\d{2})[\.\/](\d{2})[\.\/](\d{2})/);
  return match ? `20${match[1]}-${match[2]}-${match[3]}` : "";
}

function extractWarekiDate(text) {
  const match = text.match(/令和\s*8\s*年\s*(\d{1,2})月\s*(\d{1,2})日/);
  return match ? `2026-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}` : "";
}

function extractYenAmountAfter(text, label) {
  const safeLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${safeLabel}[\\s\\S]{0,180}(?:JP\\s*)?[¥￥]\\s*([0-9][0-9,]*)`),
    new RegExp(`${safeLabel}[\\s\\S]{0,180}([0-9][0-9,]*)\\s*円`)
  ];

  for (const regex of patterns) {
    const match = text.match(regex);
    if (match) return Number(match[1].replace(/,/g, ""));
  }

  return 0;
}

function extractAnyYenAmount(text) {
  const source = text || "";
  const beforeBalance = source.split(/残高|balance/i)[0] || source;

  const preferred = [
    /已扣款[\s\S]{0,100}(?:JP\s*)?[¥￥]\s*([0-9][0-9,]*)/,
    /合計金額(?:（税込）)?[\s\S]{0,100}(?:JP\s*)?[¥￥]?\s*([0-9][0-9,]*)\s*円?/,
    /総計[\s\S]{0,100}(?:JP\s*)?[¥￥]?\s*([0-9][0-9,]*)\s*円?/,
    /ご請求額合計(?:（税込）)?[\s\S]{0,100}(?:JP\s*)?[¥￥]?\s*([0-9][0-9,]*)\s*円?/,
    /(?:JP\s*)?[¥￥]\s*([0-9][0-9,]*)/,
    /([0-9][0-9,]*)\s*円/,
  ];

  for (const regex of preferred) {
    const match = beforeBalance.match(regex);
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      if (amount >= 100) return amount;
    }
  }

  const all = [
    ...[...beforeBalance.matchAll(/(?:JP\s*)?[¥￥]\s*([0-9][0-9,]*)/g)].map(m => Number(m[1].replace(/,/g, ""))),
    ...[...beforeBalance.matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => Number(m[1].replace(/,/g, ""))),
  ].filter(n => Number.isFinite(n) && n >= 100);

  return all.length ? Math.max(...all) : 0;
}

function extractUsdAmount(text) {
  const match = text.match(/US\$\s*([0-9,.]+)/);
  return match ? Number(match[1].replace(/,/g, "")) : 0;
}

function extractUsdJpyRate(text) {
  const match = text.match(/1\s*USD\s*=\s*([0-9.]+)\s*JPY/i);
  return match ? Number(match[1]) : 0;
}

function extractReceiptNo(text) {
  const match = text.match(/收据编号\s*([A-Za-z0-9\-]+)/);
  return match ? match[1] : "";
}

function extractReceiptCode(text) {
  const match = text.match(/R-\d{12}/);
  return match ? match[0] : "";
}

function extractInvoiceNo(text) {
  const match = text.match(/請求書番号[:：]?\s*([0-9\/-]+)/);
  return match ? match[1] : "";
}

function extractJapaneseInvoiceNo(text) {
  const match = text.match(/登録番号\s*(T\d+)/);
  return match ? match[1] : "";
}

function extractIiofficeDescription(text) {
  const match = text.match(/設備予約（([^）]+)）/);
  return match ? `いいオフィス ${match[1]}` : "";
}

function toYearMonth(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : currentYearMonth();
}



function reimbursementStatusBadge(status) {
  const map = {
    pending: ["待报销", "gray"],
    paid: ["已报销", ""],
    cancelled: ["取消", "red"],
    not_required: ["不需要", "gray"],
  };
  const [text, cls] = map[status] || [status || "", "gray"];
  return badge(text, cls);
}

function accountName(id) {
  return state.accounts.find(x => x.id === id)?.name || "";
}

function filterReimbursements(rows) {
  const month = document.getElementById("reimbursementMonthFilter")?.value || "";
  const entity = document.getElementById("reimbursementEntityFilter")?.value || "";
  const status = document.getElementById("reimbursementStatusFilter")?.value || "";
  const account = document.getElementById("reimbursementAccountFilter")?.value || "";
  return (rows || []).filter(x =>
    (!month || x.year_month === month) &&
    (!entity || x.business_entity_id === entity) &&
    (!status || x.status === status) &&
    (!account || x.from_account_id === account || x.to_account_id === account)
  );
}

function pendingReimbursementExpenses() {
  const month = document.getElementById("reimbursementMonthFilter")?.value || "";
  const entity = document.getElementById("reimbursementEntityFilter")?.value || "";
  const account = document.getElementById("reimbursementAccountFilter")?.value || "";
  return (state.expenseRecords || []).filter(x =>
    x.reimbursement_status === "pending" &&
    (!month || x.year_month === month) &&
    (!entity || x.business_entity_id === entity) &&
    (!account || x.account_id === account)
  );
}

function renderReimbursements() {
  const table = document.getElementById("reimbursementsTable");
  const pendingTable = document.getElementById("pendingReimbursementTable");
  if (!table || !pendingTable) return;

  const rows = filterReimbursements(state.reimbursements);
  const pendingRows = pendingReimbursementExpenses();

  const totalPaid = typeof schoolV30Totals === "function" ? schoolV30Totals(rows.filter(x => x.status === "paid")) : sumFinanceByCurrency(rows.filter(x => x.status === "paid"));
  const pendingTotal = typeof schoolV30Totals === "function" ? schoolV30Totals(pendingRows) : sumFinanceByCurrency(pendingRows);
  const totalAll = typeof schoolV30Totals === "function" ? schoolV30Totals(rows) : sumFinanceByCurrency(rows);
  const fmt = typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals : formatFinanceTotals;

  setOptionalText("reimbursementTotalAmount", fmt(totalAll));
  setOptionalText("reimbursementPaidAmount", fmt(totalPaid));
  setOptionalText("pendingReimbursementAmount", fmt(pendingTotal));
  setOptionalText("reimbursementRecordCount", rows.length);

  pendingTable.innerHTML = pendingRows.length ? pendingRows.map(item => `
    <tr>
      <td><input type="checkbox" class="reimbursement-expense-check" value="${escAttr(item.id)}" /></td>
      <td>${esc(displayRecordDate(item.expense_date || item.created_at))}</td>
      <td>${esc(item.year_month || "")}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${esc(item.account?.name || "")}</td>
      <td>${esc(expenseCategoryLabel(item.expense_category))}</td>
      <td>${esc(short(item.description || item.note, 24))}</td>
      <td>${esc(item.currency || "")}</td>
      <td>${money(item.amount)}</td>
      <td>${reimbursementStatusBadge(item.reimbursement_status)}</td>
    </tr>
  `).join("") : `<tr><td colspan="10" class="empty-row">当前筛选条件下没有待报销支出</td></tr>`;

  pendingTable.querySelectorAll(".reimbursement-expense-check").forEach(el => {
    el.addEventListener("change", updateSelectedReimbursementTotal);
  });
  updateSelectedReimbursementTotal();
  bindPendingReimbursementSelectionControls();

  table.innerHTML = rows.length ? rows.map(item => `
    <tr>
      <td>${esc(displayRecordDate(item.reimbursement_date || item.created_at))}</td>
      <td>${esc(item.year_month || "")}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${esc(item.from_account?.name || accountName(item.from_account_id))}</td>
      <td>${esc(item.to_account?.name || accountName(item.to_account_id))}</td>
      <td>${esc(item.currency || "")}</td>
      <td>${money(item.amount)}</td>
      <td>${reimbursementStatusBadge(item.status || "paid")}</td>
      <td>${esc(short(item.note, 24))}</td>
      <td>${actionButtons("reimbursement", item.id)}</td>
    </tr>
  `).join("") : `<tr><td colspan="10" class="empty-row">当前筛选条件下没有报销记录</td></tr>`;
}


function updateSelectedReimbursementTotal() {
  const ids = [...document.querySelectorAll(".reimbursement-expense-check:checked")].map(x => x.value);
  const selected = state.expenseRecords.filter(x => ids.includes(x.id));
  const totals = typeof schoolV30Totals === "function" ? schoolV30Totals(selected) : sumFinanceByCurrency(selected);
  const fmt = typeof schoolV30FormatTotals === "function" ? schoolV30FormatTotals : formatFinanceTotals;
  setOptionalText("selectedReimbursementAmount", fmt(totals));
}


function getPendingReimbursementCheckboxes() {
  return [...document.querySelectorAll(".reimbursement-expense-check")];
}

function selectAllPendingReimbursement() {
  getPendingReimbursementCheckboxes().forEach(el => {
    el.checked = true;
  });
  const checkAll = document.getElementById("pendingReimbursementCheckAll");
  if (checkAll) checkAll.checked = true;
  updateSelectedReimbursementTotal();
}

function clearPendingReimbursementSelection() {
  getPendingReimbursementCheckboxes().forEach(el => {
    el.checked = false;
  });
  const checkAll = document.getElementById("pendingReimbursementCheckAll");
  if (checkAll) checkAll.checked = false;
  updateSelectedReimbursementTotal();
}

function bindPendingReimbursementSelectionControls() {
  const selectAllBtn = document.getElementById("selectAllPendingReimbursementBtn");
  const clearBtn = document.getElementById("clearPendingReimbursementSelectionBtn");
  const checkAll = document.getElementById("pendingReimbursementCheckAll");

  if (selectAllBtn && selectAllBtn.dataset.boundV51 !== "true") {
    selectAllBtn.dataset.boundV51 = "true";
    selectAllBtn.addEventListener("click", selectAllPendingReimbursement);
  }

  if (clearBtn && clearBtn.dataset.boundV51 !== "true") {
    clearBtn.dataset.boundV51 = "true";
    clearBtn.addEventListener("click", clearPendingReimbursementSelection);
  }

  if (checkAll && checkAll.dataset.boundV51 !== "true") {
    checkAll.dataset.boundV51 = "true";
    checkAll.addEventListener("change", () => {
      getPendingReimbursementCheckboxes().forEach(el => {
        el.checked = checkAll.checked;
      });
      updateSelectedReimbursementTotal();
    });
  }
}

async function createReimbursementFromSelectedExpenses() {
  const ids = [...document.querySelectorAll(".reimbursement-expense-check:checked")].map(x => x.value);
  if (!ids.length) return showMessage("请先选择待报销支出。", "error");

  const selected = state.expenseRecords.filter(x => ids.includes(x.id));
  const first = selected[0];
  const accountIds = [...new Set(selected.map(x => x.account_id))];
  const currencies = [...new Set(selected.map(x => x.currency || "JPY"))];

  if (accountIds.length > 1) return showMessage("一次报销暂时只支持同一个垫付账户。", "error");
  if (currencies.length > 1) return showMessage("一次报销暂时只支持同一种币种。", "error");

  const companyAccount = state.accounts.find(x => x.is_company_account === true && x.currency === currencies[0]) || state.accounts.find(x => x.is_company_account === true);
  if (!companyAccount) return showMessage("请先在账户管理中设置公司账户。", "error");

  const amount = selected.reduce((sum, x) => sum + Number(x.amount || 0), 0);
  state.activeReimbursementSubmitKey = "";

  const prefill = {
    reimbursement_date: todayStr(),
    year_month: first.year_month || currentYearMonth(),
    business_entity_id: first.business_entity_id || "",
    from_account_id: companyAccount.id,
    to_account_id: first.account_id,
    currency: currencies[0],
    amount,
    status: "paid",
    note: `关联支出：${selected.map(x => x.description || x.id).join(" / ")}`,
  };

  state.pendingReimbursementExpenseIds = ids;
  openCreateModal("reimbursement", prefill);
  applyExpensePrefillToModal(prefill);
}

async function syncReimbursementAccountEffect(oldRecord, newRecord) {
  const effects = [];
  if (oldRecord && oldRecord.status === "paid") {
    effects.push({ accountId: oldRecord.from_account_id, delta: Number(oldRecord.amount || 0) });
    effects.push({ accountId: oldRecord.to_account_id, delta: -Number(oldRecord.amount || 0) });
  }
  if (newRecord && newRecord.status === "paid") {
    effects.push({ accountId: newRecord.from_account_id, delta: -Number(newRecord.amount || 0) });
    effects.push({ accountId: newRecord.to_account_id, delta: Number(newRecord.amount || 0) });
  }

  for (const effect of effects) {
    if (!effect.accountId || !effect.delta) continue;
    const account = state.accounts.find(x => x.id === effect.accountId);
    if (!account) continue;
    const nextBalance = Number(account.current_balance || 0) + effect.delta;
    const { error } = await db.from(tables.accounts).update({ current_balance: nextBalance }).eq("id", effect.accountId);
    if (error) throw error;

    await db.from(tables.transactions).insert({
      account_id: effect.accountId,
      business_entity_id: (newRecord || oldRecord)?.business_entity_id || null,
      transaction_date: (newRecord || oldRecord)?.reimbursement_date || todayStr(),
      year_month: (newRecord || oldRecord)?.year_month || currentYearMonth(),
      transaction_type: effect.delta < 0 ? "reimbursement_out" : "reimbursement_in",
      related_table: "school_reimbursements",
      related_id: (newRecord || oldRecord)?.id || null,
      currency: account.currency,
      amount: effect.delta,
      balance_after: nextBalance,
      description: "报销账户联动",
    });
  }
}

async function saveReimbursementItems(reimbursement) {
  const ids = state.pendingReimbursementExpenseIds || [];
  if (!ids.length || !reimbursement?.id) return;

  for (const expenseId of ids) {
    const expense = state.expenseRecords.find(x => x.id === expenseId);
    await db.from(tables.reimbursementItems).insert({
      reimbursement_id: reimbursement.id,
      expense_id: expenseId,
      amount: Number(expense?.amount || 0),
      note: expense?.description || "",
    });
    await db.from(tables.expenses).update({ reimbursement_status: "paid" }).eq("id", expenseId);
  }
  state.pendingReimbursementExpenseIds = [];
}

function exportBackup() {
  const data = {
    exportedAt: new Date().toISOString(),
    appType: "school",
    version: "v1",
    tables: {
      school_business_entities: state.businessEntities,
      school_subjects: state.subjects,
      school_students: state.students,
      school_teachers: state.teachers,
      school_accounts: state.accounts,
      school_income_records: state.incomeRecords,
      school_expense_records: state.expenseRecords,
    },
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `school_backup_${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}


function companyAccountOptions() {
  return state.accounts
    .filter(x => x.is_active !== false && x.is_company_account === true)
    .map(x => ({ value: x.id, label: `${x.name} / ${x.currency || ""}` }));
}

function advanceAccountOptions() {
  return state.accounts
    .filter(x => x.is_active !== false && x.is_company_account !== true)
    .map(x => ({ value: x.id, label: `${x.name} / ${x.currency || ""}` }));
}

function reimbursementStatusOptions() {
  return [
    { value: "pending", label: "待报销" },
    { value: "paid", label: "已报销" },
    { value: "cancelled", label: "取消" },
  ];
}

function accountOptions() {
  return state.accounts
    .filter(x => x.is_active !== false)
    .map(x => ({
      value: x.id,
      label: `${x.name} / ${x.currency}${x.business_entity?.name ? " / " + x.business_entity.name : ""}`,
    }));
}

function studentOptions() {
  return [
    { value: "", label: "未选择" },
    ...state.students
      .filter(x => x.status === "active" || !x.status)
      .map(x => ({
        value: x.id,
        label: `${x.name}${x.business_entity?.name ? " / " + x.business_entity.name : ""}`,
      }))
  ];
}

function incomeCategoryOptions() {
  return [
    { value: "tuition", label: "学费" },
    { value: "material", label: "教材费" },
    { value: "registration", label: "报名费" },
    { value: "exam", label: "考试相关" },
    { value: "consulting", label: "咨询费" },
    { value: "other", label: "其他收入" },
  ];
}

function expenseCategoryOptions() {
  return [
    { value: "teacher_salary", label: "老师工资" },
    { value: "transportation", label: "交通费" },
    { value: "classroom", label: "教室费" },
    { value: "material", label: "教材/资料" },
    { value: "advertising", label: "广告宣传" },
    { value: "office", label: "办公用品" },
    { value: "software", label: "软件订阅" },
    { value: "bank_fee", label: "手续费" },
    { value: "tax_accounting", label: "税理士/会计" },
    { value: "other", label: "其他支出" },
  ];
}

function incomeStatusOptions() {
  return [
    { value: "received", label: "已收" },
    { value: "pending", label: "未收" },
    { value: "refunded", label: "已退款" },
  ];
}

function expenseStatusOptions() {
  return [
    { value: "paid", label: "已支付" },
    { value: "unpaid", label: "未支付" },
    { value: "reimbursed", label: "已报销" },
  ];
}

function receiptStatusOptions() {
  return [
    { value: "有", label: "有" },
    { value: "无", label: "无" },
    { value: "待确认", label: "待确认" },
    { value: "待补", label: "待补" },
  ];
}

function taxCategoryOptions() {
  return [
    { value: "待确认", label: "待确认" },
    { value: "外注費", label: "外注費" },
    { value: "給与", label: "給与" },
    { value: "旅費交通費", label: "旅費交通費" },
    { value: "地代家賃", label: "地代家賃" },
    { value: "広告宣伝費", label: "広告宣伝費" },
    { value: "消耗品費", label: "消耗品費" },
    { value: "通信費", label: "通信費" },
    { value: "支払手数料", label: "支払手数料" },
    { value: "会議費", label: "会議費" },
    { value: "交際費", label: "交際費" },
    { value: "雑費", label: "雑費" },
  ];
}

function currencyOptions() {
  return [
    { value: "JPY", label: "日元 JPY" },
    { value: "CNY", label: "人民币 CNY" },
  ];
}



function teacherOptions() {
  return [
    { value: "", label: "未选择" },
    ...state.teachers
      .filter(x => x.status !== "retired" && x.status !== "stopped")
      .map(x => ({
        value: x.id,
        label: x.display_name || x.name || "",
      }))
  ];
}


function lessonSubjectOptions() {
  return [
    { value: "", label: "未选择" },
    ...state.subjects
      .filter(x => x.is_active !== false)
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
      .map(x => ({
        value: x.id,
        label: x.name || "",
      }))
  ];
}

function lessonTypeOptions() {
  return [
    { value: "planned", label: "预定课时" },
    { value: "actual", label: "实际课时" },
  ];
}

function lessonStatusOptions() {
  return [
    { value: "planned", label: "预定" },
    { value: "completed", label: "已上课" },
    { value: "cancelled", label: "取消" },
    { value: "holiday", label: "放假" },
    { value: "makeup", label: "补课" },
    { value: "absent", label: "缺席" },
  ];
}

function lessonTypeLabel(value) {
  const item = lessonTypeOptions().find(x => x.value === value);
  return item?.label || value || "";
}

function lessonStatusLabel(value) {
  const item = lessonStatusOptions().find(x => x.value === value);
  return item?.label || value || "";
}

function statusOptions() {
  return [
    { value: "active", label: "启用/在读" },
    { value: "paused", label: "暂停" },
    { value: "finished", label: "结束/毕业" },
    { value: "inactive", label: "停用" },
  ];
}

function subjectPrimaryCategoryOptions() {
  return [
    { value: "班课", label: "班课" },
    { value: "VIP", label: "VIP" },
  ];
}

function subjectCategoryOptions() {
  return [
    { value: "学部进学", label: "学部进学" },
    { value: "大学院进学", label: "大学院进学" },
    { value: "资格考试对策", label: "资格考试对策" },
    { value: "特殊课程", label: "特殊课程" },
  ];
}

function subjectTertiaryCategoryOptions(category) {
  const map = {
    "学部进学": ["EJU留考课程", "校内考课程"],
    "资格考试对策": ["JLPT_N1", "JLPT_N2", "TOEIC", "TOEFL"],
    "大学院进学": ["专业考试", "面试模拟"],
    "特殊课程": ["特殊课程"],
  };
  return (map[category] || ["未分类"]).map(value => ({ value, label: value }));
}

function subjectColorOptions() {
  return [
    "#6fb7df",
    "#2f80b7",
    "#7db7ff",
    "#f6d365",
    "#f9a825",
    "#b39ddb",
    "#81c784",
    "#80cbc4",
    "#4fc3f7",
    "#bcaaa4",
    "#d6a84f",
    "#f28b82",
  ];
}

function teacherDepartmentOptions() {
  return [
    { value: "常勤老师", label: "常勤老师" },
    { value: "バイト老师", label: "バイト老师" },
    { value: "事务老师", label: "事务老师" },
  ];
}

function teacherStatusOptions() {
  return [
    { value: "employed", label: "在职" },
    { value: "on_leave", label: "休假" },
    { value: "paused", label: "暂停" },
    { value: "resigned", label: "离职" },
    { value: "inactive", label: "停用" },
  ];
}

function paymentMethodOptions() {
  return [
    { value: "", label: "未设置" },
    { value: "bank", label: "银行转账" },
    { value: "wechat", label: "微信" },
    { value: "alipay", label: "支付宝" },
    { value: "cash", label: "现金" },
    { value: "card", label: "信用卡" },
    { value: "paypay", label: "PayPay" },
  ];
}

function showMessage(text, type = "ok") {
  const area = document.getElementById("messageArea");
  area.textContent = text;
  area.className = `message-area ${type}`;
  area.classList.remove("hidden");
  setTimeout(() => area.classList.add("hidden"), 4000);
}

function setText(id, value) {
  document.getElementById(id).textContent = value;
}

function esc(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[c]));
}

function escAttr(value) {
  return esc(value).replace(/`/g, "&#096;");
}

function short(value, len = 24) {
  if (!value) return "";
  const text = String(value);
  return text.length > len ? text.slice(0, len) + "..." : text;
}

function money(value) {
  const n = Number(value || 0);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function num(value) {
  return Number(value || 0).toLocaleString();
}

function badge(text, cls = "") {
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

function statusBadge(status) {
  const map = {
    active: ["启用/在读", ""],
    paused: ["暂停", "gray"],
    finished: ["结束/毕业", "gray"],
    inactive: ["停用", "red"],
  };
  const [text, cls] = map[status] || [status || "", "gray"];
  return badge(text, cls);
}

function teacherStatusBadge(status) {
  const map = {
    employed: ["在职", ""],
    on_leave: ["休假", "gray"],
    paused: ["暂停", "gray"],
    resigned: ["离职", "red"],
    inactive: ["停用", "red"],
    active: ["在职", ""],
  };
  const [text, cls] = map[status] || [status || "", "gray"];
  return badge(text, cls);
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => { });
  });
}


// === v3.0 hard override: finance summary by record currency + amount ===
function schoolV30ParseAmount(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function schoolV30Totals(rows) {
  const totals = { JPY: 0, CNY: 0, OTHER: {} };

  (rows || []).forEach(item => {
    const currency = item.currency || "JPY";
    const amount = schoolV30ParseAmount(item.amount);

    if (currency === "JPY") {
      totals.JPY += amount;
    } else if (currency === "CNY") {
      totals.CNY += amount;
    } else {
      totals.OTHER[currency] = (totals.OTHER[currency] || 0) + amount;
    }
  });

  return totals;
}

function schoolV30FormatTotals(totals) {
  const parts = [];
  if (schoolV30ParseAmount(totals.JPY) !== 0) parts.push(`JPY ${money(totals.JPY)}`);
  if (schoolV30ParseAmount(totals.CNY) !== 0) parts.push(`CNY ${money(totals.CNY)}`);

  Object.entries(totals.OTHER || {}).forEach(([currency, value]) => {
    if (schoolV30ParseAmount(value) !== 0) parts.push(`${currency} ${money(value)}`);
  });

  return parts.length ? parts.join(" / ") : "0";
}

function schoolV30NetTotals(incomeTotals, expenseTotals) {
  const net = {
    JPY: schoolV30ParseAmount(incomeTotals.JPY) - schoolV30ParseAmount(expenseTotals.JPY),
    CNY: schoolV30ParseAmount(incomeTotals.CNY) - schoolV30ParseAmount(expenseTotals.CNY),
    OTHER: {},
  };

  const currencies = new Set([
    ...Object.keys(incomeTotals.OTHER || {}),
    ...Object.keys(expenseTotals.OTHER || {}),
  ]);

  currencies.forEach(currency => {
    net.OTHER[currency] = schoolV30ParseAmount(incomeTotals.OTHER?.[currency]) - schoolV30ParseAmount(expenseTotals.OTHER?.[currency]);
  });

  return net;
}

renderStats = function () {
  setText("statStudents", state.students.length);
  setText("statTeachers", state.teachers.length);
  setText("statSubjects", state.subjects.length);
  setText("statAccounts", state.accounts.length);

  const ym = currentYearMonth();
  const incomeTotals = schoolV30Totals(state.incomeRecords.filter(x => x.year_month === ym));
  const expenseTotals = schoolV30Totals(state.expenseRecords.filter(x => x.year_month === ym));
  const netTotals = schoolV30NetTotals(incomeTotals, expenseTotals);

  setOptionalText("statIncome", schoolV30FormatTotals(incomeTotals));
  setOptionalText("statExpense", schoolV30FormatTotals(expenseTotals));
  setOptionalText("statNet", schoolV30FormatTotals(netTotals));
};

renderFinanceSummary = function () {
  const incomeRows = filterFinanceRows(state.incomeRecords, "finance");
  const expenseRows = filterFinanceRows(state.expenseRecords, "finance");

  const incomeTotals = schoolV30Totals(incomeRows);
  const expenseTotals = schoolV30Totals(expenseRows);
  const netTotals = schoolV30NetTotals(incomeTotals, expenseTotals);

  setOptionalText("financeIncomeTotal", schoolV30FormatTotals(incomeTotals));
  setOptionalText("financeExpenseTotal", schoolV30FormatTotals(expenseTotals));
  setOptionalText("financeNetTotal", schoolV30FormatTotals(netTotals));
  setOptionalText("financeRecordCount", incomeRows.length + expenseRows.length);

  const tbody = document.getElementById("financeAccountsTable");
  if (!tbody) return;
  const entity = document.getElementById("financeEntityFilter")?.value || "";
  const account = document.getElementById("financeAccountFilter")?.value || "";
  const rows = state.accounts.filter(x => (!entity || x.business_entity_id === entity) && (!account || x.id === account));
  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${esc(item.name)}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${esc(item.currency)}</td>
      <td>${money(item.current_balance)}</td>
      <td>${esc(item.account_type)}</td>
      <td>${item.is_active ? badge("启用") : badge("停用", "red")}</td>
    </tr>
  `).join("");
};


// === v4.7 hard override: finance filter options and account filters ===
function buildAccountFilterOptionsV47() {
  const accounts = state.accounts || [];
  return `<option value="">全部账户</option>` + accounts
    .map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")} / ${esc(x.currency || "")}</option>`)
    .join("");
}

function buildEntityFilterOptionsV47() {
  const entities = state.businessEntities || [];
  return `<option value="">全部业务归属</option>` + entities
    .map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")}</option>`)
    .join("");
}

updateFinanceFilters = function () {
  const entityOptions = buildEntityFilterOptionsV47();
  const accountOptions = buildAccountFilterOptionsV47();

  ["incomeEntityFilter", "expenseEntityFilter", "financeEntityFilter", "reimbursementEntityFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = entityOptions;
    if ([...el.options].some(opt => opt.value === old)) el.value = old;
  });

  ["incomeAccountFilter", "expenseAccountFilter", "financeAccountFilter", "reimbursementAccountFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = accountOptions;
    if ([...el.options].some(opt => opt.value === old)) el.value = old;
  });
};

filterFinanceRows = function (rows, scope) {
  let month = "";
  let entity = "";
  let account = "";

  if (scope === "income") {
    month = document.getElementById("incomeMonthFilter")?.value || "";
    entity = document.getElementById("incomeEntityFilter")?.value || "";
    account = document.getElementById("incomeAccountFilter")?.value || "";
  } else if (scope === "expense") {
    month = document.getElementById("expenseMonthFilter")?.value || "";
    entity = document.getElementById("expenseEntityFilter")?.value || "";
    account = document.getElementById("expenseAccountFilter")?.value || "";
  } else {
    month = document.getElementById("financeMonthFilter")?.value || "";
    entity = document.getElementById("financeEntityFilter")?.value || "";
    account = document.getElementById("financeAccountFilter")?.value || "";
  }

  return (rows || []).filter(x =>
    (!month || x.year_month === month) &&
    (!entity || x.business_entity_id === entity) &&
    (!account || x.account_id === account)
  );
};

function bindAccountFilterListenersV47() {
  ["incomeAccountFilter", "expenseAccountFilter", "financeAccountFilter", "reimbursementAccountFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundV47 === "true") return;
    el.dataset.boundV47 = "true";
    el.addEventListener("change", () => {
      if (id === "incomeAccountFilter") renderIncomeTable();
      if (id === "expenseAccountFilter") renderExpensesTable();
      if (id === "financeAccountFilter") renderFinanceSummary();
    });
  });
}

const renderAllOriginalV47 = renderAll;
renderAll = function () {
  updateFinanceFilters();
  bindAccountFilterListenersV47();
  renderAllOriginalV47();
  updateFinanceFilters();
  bindAccountFilterListenersV47();
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    updateFinanceFilters();
    bindAccountFilterListenersV47();
  }, 800);
});

// === v7.0 stable page switch override ===
switchPage = function (page) {
  if (!page) return;

  document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach(section => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  const fallbackMeta = {
    home: ["首页", "系统基础骨架与云端连接测试"],
    business: ["业务归属", "管理公司与个人业务归属"],
    students: ["学生管理", "管理学生基础资料与升学信息"],
    lessons: ["课时管理", "管理学生预定课时与实际课时"],
    "student-settlement": ["学生月度结算", "按学生和月份计算预定课时费与实际课时费"],
    teachers: ["老师管理", "管理老师资料与工资信息"],
    subjects: ["科目管理", "管理课程科目与分类"],
    accounts: ["账户管理", "管理公司账户与垫付账户"],
    income: ["收入记录", "登记学费等收入，并联动账户余额"],
    expense: ["支出记录", "登记公司/个人名义支出，并联动账户余额"],
    finance: ["公司收支", "按月份和业务归属查看收支与账户余额"],
    reimbursements: ["报销管理", "管理垫付账户向公司账户报销"],
    backup: ["备份/恢复", "导出当前数据备份"],
  };

  const metaSource =
    (typeof pageMeta !== "undefined" && pageMeta) ||
    (typeof pageInfo !== "undefined" && pageInfo) ||
    (typeof pageTitles !== "undefined" && pageTitles) ||
    {};

  const meta = metaSource[page] || fallbackMeta[page] || [page, ""];
  const title = Array.isArray(meta) ? meta[0] : (meta.title || page);
  const subtitle = Array.isArray(meta) ? (meta[1] || "") : (meta.subtitle || "");

  const titleEl = document.getElementById("pageTitle");
  const subtitleEl = document.getElementById("pageSubtitle");
  if (titleEl) titleEl.textContent = title;
  if (subtitleEl) subtitleEl.textContent = subtitle;

};



// v7.2: table action delegation removed here to avoid duplicate edit/delete handling.
// === v7.0 stable navigation binding ===
function bindNavigationStableV70() {
  document.querySelectorAll(".nav-btn[data-page]").forEach(btn => {
    btn.onclick = () => {
      if (btn.dataset.page && typeof switchPage === "function") {
        switchPage(btn.dataset.page);
      }
    };
  });
}
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindNavigationStableV70, 0);
});



// === v7.0 stable expense manual attachment upload ===
function attachManualExpenseAttachmentAreaStableV70(type) {
  if (type !== "expense") return;

  const form = document.getElementById("modalForm");
  if (!form || document.getElementById("manualExpenseAttachmentInput")) return;

  const wrapper = document.createElement("div");
  wrapper.className = "form-row full attachment-upload-row";
  wrapper.innerHTML = `
    <label>凭证附件</label>
    <div class="attachment-upload-box">
      <button type="button" class="secondary-btn" id="manualExpenseAttachmentBtn">上传凭证</button>
      <span id="manualExpenseAttachmentName" class="attachment-upload-name">未选择文件</span>
      <input type="file" id="manualExpenseAttachmentInput" accept="application/pdf,.pdf,image/*,.jpg,.jpeg,.png" class="hidden" />
      <p class="form-help">用于给手动输入或已存在的支出追加凭证。保存支出后自动上传并关联。</p>
    </div>
  `;

  form.appendChild(wrapper);

  const btn = document.getElementById("manualExpenseAttachmentBtn");
  const input = document.getElementById("manualExpenseAttachmentInput");
  const name = document.getElementById("manualExpenseAttachmentName");

  if (btn && input) {
    btn.onclick = () => input.click();
    input.onchange = () => {
      const file = input.files && input.files[0];
      if (!file) return;

      state.pendingExpenseAttachment = {
        file,
        extractedText: "",
        sourceType: "manual_upload",
      };

      if (name) name.textContent = file.name;
      if (typeof showMessage === "function") showMessage("凭证已选择。保存支出后会自动上传。", "ok");
    };
  }
}



// === v7.0 missing function fallbacks ===
if (typeof setOptionalText !== "function") {
  function setOptionalText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value ?? "";
  }
}

if (typeof money !== "function") {
  function money(value) {
    const n = Number(value || 0);
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }
}




// v9.8-final.10: old lesson Excel import/export action block removed. Use completed import + standard template export.



// === v7.4 reimbursement selection reset fix ===
function resetReimbursementSelectionV74() {
  const checkAll = document.getElementById("pendingReimbursementCheckAll");
  if (checkAll) checkAll.checked = false;

  document.querySelectorAll(".reimbursement-expense-check").forEach(el => {
    el.checked = false;
  });

  if (typeof updateSelectedReimbursementTotal === "function") {
    updateSelectedReimbursementTotal();
  } else if (typeof setOptionalText === "function") {
    setOptionalText("selectedReimbursementAmount", "0");
  }
}

const renderReimbursementsBeforeV74 = typeof renderReimbursements === "function" ? renderReimbursements : null;
if (renderReimbursementsBeforeV74) {
  renderReimbursements = function () {
    renderReimbursementsBeforeV74();
    const checkAll = document.getElementById("pendingReimbursementCheckAll");
    if (checkAll) checkAll.checked = false;
    if (typeof updateSelectedReimbursementTotal === "function") {
      updateSelectedReimbursementTotal();
    }
  };
}

function bindReimbursementFilterResetV74() {
  ["reimbursementMonthFilter", "reimbursementEntityFilter", "reimbursementStatusFilter", "reimbursementAccountFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundResetV74 === "true") return;
    el.dataset.boundResetV74 = "true";
    el.addEventListener("change", () => {
      setTimeout(resetReimbursementSelectionV74, 0);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindReimbursementFilterResetV74, 500);
});



// === v7.7 lesson sort + select all ===
function lessonTeacherOrderV77(item) {
  const name = item?.teacher?.display_name || item?.teacher?.name || "";
  const idx = (state.teachers || []).findIndex(t => t.id === item?.teacher_id);
  return `${idx < 0 ? 9999 : idx}_${name}`;
}

function lessonSubjectOrderV77(item) {
  const sort = Number(item?.subject?.sort_order ?? 9999);
  const name = item?.subject?.name || "";
  return `${String(sort).padStart(6, "0")}_${name}`;
}

function compareLessonsV77(a, b) {
  // 月份升序 → 周/日期升序 → 老师顺序 → 科目顺序 → 开始时间
  const month = String(a.year_month || "").localeCompare(String(b.year_month || ""));
  if (month !== 0) return month;

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  const teacher = lessonTeacherOrderV77(a).localeCompare(lessonTeacherOrderV77(b));
  if (teacher !== 0) return teacher;

  const subject = lessonSubjectOrderV77(a).localeCompare(lessonSubjectOrderV77(b));
  if (subject !== 0) return subject;

  return String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

// === v7.8 lesson sort adjustment ===
function compareLessonsV78(a, b) {
  // 月份升序 → 老师顺序 → 科目顺序 → 周一日期/上课日期升序 → 开始时间
  const month = String(a.year_month || "").localeCompare(String(b.year_month || ""));
  if (month !== 0) return month;

  const teacher = lessonTeacherOrderV77(a).localeCompare(lessonTeacherOrderV77(b));
  if (teacher !== 0) return teacher;

  const subject = lessonSubjectOrderV77(a).localeCompare(lessonSubjectOrderV77(b));
  if (subject !== 0) return subject;

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  return String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

// === v7.9 drag & drop upload zones ===
function setupDropUploadZoneV79(zoneId, inputId, onFile, options = {}) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  if (!zone || !input || zone.dataset.boundDropV79 === "true") return;

  zone.dataset.boundDropV79 = "true";

  const pickFile = () => input.click();

  zone.addEventListener("click", (event) => {
    // Let any button inside the drop zone also open the same file picker.
    event.preventDefault();
    pickFile();
  });

  input.onchange = async () => {
    const file = input.files && input.files[0];
    input.value = "";
    if (!file) return;
    await onFile(file);
  };

  ["dragenter", "dragover"].forEach(name => {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.add("drag-over");
    });
  });

  ["dragleave", "drop"].forEach(name => {
    zone.addEventListener(name, (event) => {
      event.preventDefault();
      event.stopPropagation();
      zone.classList.remove("drag-over");
    });
  });

  zone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    if (options.acceptRegex && !options.acceptRegex.test(file.name.toLowerCase()) && !(file.type && options.acceptTypeRegex?.test(file.type))) {
      showMessage(options.rejectMessage || "文件格式不支持。", "error");
      return;
    }

    await onFile(file);
  });
}

async function handleExpenseReceiptFileV79(file) {
  try {
    showMessage("凭证读取中，请稍等...", "ok");
    let text = "";
    const lowerName = file.name.toLowerCase();

    if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
      text = await extractPdfText(file);
    } else if (file.type.startsWith("image/") || /\.(jpg|jpeg|png)$/i.test(file.name)) {
      text = await extractImageText(file);
    } else {
      throw new Error("暂时只支持 PDF / JPG / PNG 文件。");
    }

    const parsed = normalizeParsedExpenseAmount(parseExpenseReceiptText(text, file.name), text);
    state.pendingExpenseAttachment = {
      file,
      extractedText: text,
      sourceType: file.type.startsWith("image/") ? "image_ocr" : "pdf_text",
    };

    openCreateModal("expense", parsed);
    applyExpensePrefillToModal(parsed);
    setExpenseFilterToParsedMonth(parsed);
    showMessage(`读取完成，识别金额：${money(parsed.amount)}。`, "ok");
  } catch (error) {
    console.error(error);
    showMessage(`凭证读取失败：${error.message || error}`, "error");
  }
}

function bindExpensePdfImportV79() {
  setupDropUploadZoneV79(
    "expenseReceiptDropZone",
    "expensePdfInput",
    handleExpenseReceiptFileV79,
    {
      acceptRegex: /\.(pdf|jpg|jpeg|png)$/i,
      acceptTypeRegex: /^(application\/pdf|image\/)/,
      rejectMessage: "暂时只支持 PDF / JPG / PNG 文件。",
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindExpensePdfImportV79();
  }, 500);
});

const renderAllBeforeV79 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV79) {
  renderAll = function () {
    renderAllBeforeV79();
    bindExpensePdfImportV79();
  };
}



// === v8.0 upload dialog + teacher order adjustment ===
function lessonCreatedAtTimeV80(item) {
  const t = item?.created_at ? new Date(item.created_at).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

function buildLessonTeacherOrderMapV80(rows) {
  const map = new Map();
  const sorted = (rows || [])
    .filter(x => x.teacher_id)
    .slice()
    .sort((a, b) => {
      const ca = lessonCreatedAtTimeV80(a);
      const cb = lessonCreatedAtTimeV80(b);
      if (ca !== cb) return ca - cb;
      return String(a.id || "").localeCompare(String(b.id || ""));
    });

  sorted.forEach(item => {
    if (!map.has(item.teacher_id)) {
      map.set(item.teacher_id, map.size);
    }
  });

  return map;
}

const lessonTeacherOrderBeforeV80 = typeof lessonTeacherOrderV77 === "function" ? lessonTeacherOrderV77 : null;
if (lessonTeacherOrderBeforeV80) {
  lessonTeacherOrderV77 = function (item) {
    const orderMap = window.lessonTeacherOrderMapV80;
    if (orderMap && item?.teacher_id && orderMap.has(item.teacher_id)) {
      const name = item?.teacher?.display_name || item?.teacher?.name || "";
      return `${String(orderMap.get(item.teacher_id)).padStart(6, "0")}_${name}`;
    }
    return lessonTeacherOrderBeforeV80(item);
  };
}

function ensureUploadDialogV80() {
  let modal = document.getElementById("uploadDialogV80");
  if (modal) return modal;

  modal = document.createElement("div");
  modal.id = "uploadDialogV80";
  modal.className = "upload-dialog hidden";
  modal.innerHTML = `
    <div class="upload-dialog-card">
      <div class="upload-dialog-header">
        <h3 id="uploadDialogTitleV80">上传文件</h3>
        <button type="button" class="icon-btn" id="uploadDialogCloseV80">×</button>
      </div>
      <div class="upload-dialog-drop" id="uploadDialogDropV80">
        <div class="upload-dialog-icon">⬆</div>
        <p id="uploadDialogHintV80">拖入文件到这里</p>
        <button type="button" class="primary-btn" id="uploadDialogPickV80">选择文件</button>
        <p class="form-help" id="uploadDialogAcceptV80"></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById("uploadDialogCloseV80").onclick = closeUploadDialogV80;
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeUploadDialogV80();
  });

  return modal;
}

function closeUploadDialogV80() {
  const modal = document.getElementById("uploadDialogV80");
  if (modal) modal.classList.add("hidden");
  window.uploadDialogHandlerV80 = null;
  window.uploadDialogInputV80 = null;
}

function openUploadDialogV80(config) {
  const modal = ensureUploadDialogV80();
  const drop = document.getElementById("uploadDialogDropV80");
  const title = document.getElementById("uploadDialogTitleV80");
  const hint = document.getElementById("uploadDialogHintV80");
  const accept = document.getElementById("uploadDialogAcceptV80");
  const pick = document.getElementById("uploadDialogPickV80");

  title.textContent = config.title || "上传文件";
  hint.textContent = config.hint || "拖入文件到这里";
  accept.textContent = config.acceptText || "";
  window.uploadDialogHandlerV80 = config.onFile;
  window.uploadDialogInputV80 = config.input;

  pick.onclick = () => config.input?.click();

  if (drop.dataset.boundV80 !== "true") {
    drop.dataset.boundV80 = "true";

    ["dragenter", "dragover"].forEach(name => {
      drop.addEventListener(name, event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(name => {
      drop.addEventListener(name, event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.remove("drag-over");
      });
    });

    drop.addEventListener("drop", async event => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      if (typeof window.uploadDialogHandlerV80 === "function") {
        await window.uploadDialogHandlerV80(file);
        closeUploadDialogV80();
      }
    });
  }

  modal.classList.remove("hidden");
}

function bindUploadDialogButtonsV80() {
  const expenseBtn = document.getElementById("importExpensePdfBtn");
  const expenseInput = document.getElementById("expensePdfInput");
  if (expenseBtn && expenseInput && expenseBtn.dataset.boundDialogV80 !== "true") {
    expenseBtn.dataset.boundDialogV80 = "true";
    expenseBtn.onclick = () => openUploadDialogV80({
      title: "凭证读取",
      hint: "将 PDF / JPG / PNG 拖入这里",
      acceptText: "支持 PDF、JPG、PNG。也可以点击按钮选择文件。",
      input: expenseInput,
      onFile: async file => {
        const lower = file.name.toLowerCase();
        if (!(file.type === "application/pdf" || file.type.startsWith("image/") || /\.(pdf|jpg|jpeg|png)$/i.test(lower))) {
          showMessage("暂时只支持 PDF / JPG / PNG 文件。", "error");
          return;
        }
        await handleExpenseReceiptFileV79(file);
      },
    });

    expenseInput.onchange = async () => {
      const file = expenseInput.files && expenseInput.files[0];
      expenseInput.value = "";
      if (!file) return;
      await handleExpenseReceiptFileV79(file);
      closeUploadDialogV80();
    };
  }

}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindUploadDialogButtonsV80, 600);
});

const renderAllBeforeV80Upload = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV80Upload) {
  renderAll = function () {
    renderAllBeforeV80Upload();
    bindUploadDialogButtonsV80();
  };
}




// === v8.1 upload dialog click behavior fix ===
function openUploadDialogV81(config) {
  const modal = ensureUploadDialogV80();
  const drop = document.getElementById("uploadDialogDropV80");
  const title = document.getElementById("uploadDialogTitleV80");
  const hint = document.getElementById("uploadDialogHintV80");
  const accept = document.getElementById("uploadDialogAcceptV80");
  const pick = document.getElementById("uploadDialogPickV80");

  title.textContent = config.title || "上传文件";
  hint.textContent = config.hint || "拖入文件到这里";
  accept.textContent = config.acceptText || "";
  window.uploadDialogHandlerV80 = config.onFile;
  window.uploadDialogInputV80 = config.input;

  // Important: only this button opens the file picker.
  // Clicking the dialog/drop area itself should not open the picker.
  pick.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    config.input?.click();
  };

  if (drop && drop.dataset.boundV81 !== "true") {
    drop.dataset.boundV81 = "true";

    ["dragenter", "dragover"].forEach(name => {
      drop.addEventListener(name, event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.add("drag-over");
      });
    });

    ["dragleave", "drop"].forEach(name => {
      drop.addEventListener(name, event => {
        event.preventDefault();
        event.stopPropagation();
        drop.classList.remove("drag-over");
      });
    });

    drop.addEventListener("drop", async event => {
      const file = event.dataTransfer?.files?.[0];
      if (!file) return;
      if (typeof window.uploadDialogHandlerV80 === "function") {
        await window.uploadDialogHandlerV80(file);
        closeUploadDialogV80();
      }
    });
  }

  modal.classList.remove("hidden");
}

function bindUploadDialogButtonsV81() {
  const expenseBtn = document.getElementById("importExpensePdfBtn");
  const expenseInput = document.getElementById("expensePdfInput");
  if (expenseBtn && expenseInput) {
    expenseBtn.onclick = () => openUploadDialogV81({
      title: "凭证读取",
      hint: "将 PDF / JPG / PNG 拖入这里",
      acceptText: "支持 PDF、JPG、PNG。点击下方按钮选择文件。",
      input: expenseInput,
      onFile: async file => {
        const lower = file.name.toLowerCase();
        if (!(file.type === "application/pdf" || file.type.startsWith("image/") || /\.(pdf|jpg|jpeg|png)$/i.test(lower))) {
          showMessage("暂时只支持 PDF / JPG / PNG 文件。", "error");
          return;
        }
        await handleExpenseReceiptFileV79(file);
      },
    });

    expenseInput.onchange = async () => {
      const file = expenseInput.files && expenseInput.files[0];
      expenseInput.value = "";
      if (!file) return;
      await handleExpenseReceiptFileV79(file);
      closeUploadDialogV80();
    };
  }

}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindUploadDialogButtonsV81, 700);
});

const renderAllBeforeV81 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV81) {
  renderAll = function () {
    renderAllBeforeV81();
    bindUploadDialogButtonsV81();
  };
}




// === v8.3 student monthly settlement ===
function formatCnyV83(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString()} CNY`;
}

function formatJpyV83(value) {
  const n = Math.round(Number(value || 0));
  return `${n.toLocaleString()} JPY`;
}

function feeOfLessonV83(item) {
  return Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
}

function settlementRowsV83() {
  const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  const lessons = (state.lessonRecords || []).filter(x =>
    x.student_id === studentId &&
    x.year_month === month &&
    x.is_billable !== false
  );
  const planned = lessons.filter(x => x.lesson_type === "planned");
  const actual = lessons.filter(x =>
    x.lesson_type === "actual" &&
    x.status !== "cancelled" &&
    x.status !== "holiday"
  );
  return { month, studentId, lessons, planned, actual };
}

function sumLessonHoursV83(rows) {
  return rows.reduce((sum, x) => sum + Number(x.duration_hours || 0), 0);
}

function sumLessonFeeV83(rows) {
  return rows.reduce((sum, x) => sum + feeOfLessonV83(x), 0);
}

function sumIncomeV83(studentId, month, currency) {
  return (state.incomeRecords || [])
    .filter(x =>
      x.student_id === studentId &&
      x.year_month === month &&
      x.income_category === "tuition" &&
      x.status === "received" &&
      x.currency === currency
    )
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

// === v8.3.3 compact lesson list layout ===
// === v8.3.4 settlement calculation and paired detail fix ===
function rateErrorTextV834(student) {
  const rate = Number(student?.preset_exchange_rate || 0);
  if (rate > 0) return "";
  return "该学生预设汇率为 0，请先到「学生管理」编辑学生，填写预设汇率。";
}

function settlementLessonCellsV834(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join(" - ");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";

  return `
    <td class="lesson-date-cell">
      <div>${esc(displayRecordDate(item.lesson_date || ""))}</div>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td class="lesson-name-cell">${esc(studentName)}</td>
    <td class="lesson-teacher-cell">${esc(teacherName)}</td>
    <td class="lesson-subject-cell">
      <div>${esc(subjectName)}</div>
      <span class="muted-small">${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H / ${formatJpyV83(fee)}</span>
    </td>
    <td class="lesson-status-cell">
      ${badge(lessonStatusLabel(item.status), statusClass)}
      ${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}
    </td>
    <td class="lesson-content-actions-cell">
      <div class="lesson-content-cell">${esc(short(item.lesson_content || item.note, 36))}</div>
    </td>
  `;
}

function renderSettlementPairedLessonsV834(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    let planId = row.planned_lesson_id;

    if (!planId && typeof schoolStableFindMatchingPlannedLessonV70 === "function") {
      const matched = schoolStableFindMatchingPlannedLessonV70(row);
      if (matched) planId = matched.id;
    }
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const html = [];
  const plannedSorted = planned.slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));

  plannedSorted.forEach(plan => {
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row">${settlementLessonCellsV834(plan, "planned")}${settlementLessonCellsV834(null, "actual")}</tr>`);
    } else {
      actuals.forEach((act, index) => {
        const left = index === 0
          ? settlementLessonCellsV834(plan, "planned")
          : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row">${left}${settlementLessonCellsV834(act, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual
    .slice()
    .sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")))
    .forEach(act => {
      html.push(`<tr class="lesson-pair-row">${settlementLessonCellsV834(null, "planned")}${settlementLessonCellsV834(act, "actual")}</tr>`);
    });

  tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

// === v8.3.5 lesson list final compact layout ===
function normalizeExchangeRateInputV835() {
  document.querySelectorAll('input[name="preset_exchange_rate"]').forEach(input => {
    input.step = "0.0001";
    input.placeholder = "例：0.0485";
  });
}

const buildFormBeforeV835 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV835) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV835(type, data);
    if (type === "student") normalizeExchangeRateInputV835();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    normalizeExchangeRateInputV835();
  }, 800);
});

const renderAllBeforeV835 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV835) {
  renderAll = function () {
    renderAllBeforeV835();
    normalizeExchangeRateInputV835();
  };
}



// === v8.3.6 lesson table width + settlement grid cleanup ===
function normalizeExchangeRateInputV836() {
  document.querySelectorAll('input[name="preset_exchange_rate"]').forEach(input => {
    input.step = "0.0001";
    input.placeholder = "例：0.0485";
    if (input.value === "0" || input.value === "0.0000") {
      input.value = "";
    }
  });
}

const buildFormBeforeV836 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV836) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV836(type, data);
    if (type === "student") normalizeExchangeRateInputV836();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    normalizeExchangeRateInputV836();
  }, 800);
});

const renderAllBeforeV836 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV836) {
  renderAll = function () {
    renderAllBeforeV836();
    normalizeExchangeRateInputV836();
  };
}



// === v8.3.7 force compact lesson layout ===
function normalizeExchangeRateInputV837() {
  document.querySelectorAll('input[name="preset_exchange_rate"]').forEach(input => {
    input.type = "number";
    input.step = "0.0001";
    input.placeholder = "例：0.0485";
    if (input.value === "0" || input.value === "0.0000") input.value = "";
  });
}

const buildFormBeforeV837 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV837) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV837(type, data);
    if (type === "student") normalizeExchangeRateInputV837();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    normalizeExchangeRateInputV837();
  }, 900);
});

const renderAllBeforeV837 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV837) {
  renderAll = function () {
    renderAllBeforeV837();
    normalizeExchangeRateInputV837();
  };
}



// === v8.3.8 settlement summary layout adjustment ===
function cleanupSettlementSummaryV838() {
  // Hide "preset exchange rate" and "received JPY" rows if old DOM remains after cache.
  document.querySelectorAll(".settlement-mini-table tr").forEach(row => {
    const text = row.textContent || "";
    if (text.includes("预设汇率") || text.includes("已收学费（日元）")) {
      row.classList.add("hidden-settlement-row-v838");
    }
  });
}

const renderStudentSettlementBeforeV838 = typeof renderStudentSettlement === "function" ? renderStudentSettlement : null;
if (renderStudentSettlementBeforeV838) {
  renderStudentSettlement = function () {
    renderStudentSettlementBeforeV838();
    cleanupSettlementSummaryV838();
  };
}

const renderAllBeforeV838 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV838) {
  renderAll = function () {
    renderAllBeforeV838();
    cleanupSettlementSummaryV838();
  };
}

const switchPageBeforeV838 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV838) {
  switchPage = function (page) {
    switchPageBeforeV838(page);
    if (page === "student-settlement") {
      setTimeout(cleanupSettlementSummaryV838, 0);
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(cleanupSettlementSummaryV838, 800);
});



// === v8.3.9 lesson table column redesign ===
function normalizeExchangeRateInputV839() {
  document.querySelectorAll('input[name="preset_exchange_rate"]').forEach(input => {
    input.type = "number";
    input.step = "0.0001";
    input.placeholder = "例：0.0485";
    if (input.value === "0" || input.value === "0.0000") input.value = "";
  });
}

const buildFormBeforeV839 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV839) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV839(type, data);
    if (type === "student") normalizeExchangeRateInputV839();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    normalizeExchangeRateInputV839();
  }, 900);
});

const renderAllBeforeV839 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV839) {
  renderAll = function () {
    renderAllBeforeV839();
    normalizeExchangeRateInputV839();
  };
}



// === v8.3.10 lesson and settlement fine layout ===
function settlementActionButtonsV8310(item) {
  if (!item) return "";
  return `
    <div class="settlement-action-col">
      <button class="secondary-btn settlement-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn settlement-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function settlementLessonCellsV8310(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";

  return `
    <td class="col-date"><div>${esc(displayRecordDate(item.lesson_date || ""))}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${esc(studentName)}</td>
    <td class="col-teacher">${esc(teacherName)}</td>
    <td class="col-subject">
      <strong>${esc(subjectName)}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${settlementActionButtonsV8310(item)}</td>
  `;
}

function renderSettlementPairedLessonsV8310(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    let planId = row.planned_lesson_id;
    if (!planId && typeof schoolStableFindMatchingPlannedLessonV70 === "function") {
      const matched = schoolStableFindMatchingPlannedLessonV70(row);
      if (matched) planId = matched.id;
    }
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(sortFn).forEach(plan => {
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV8310(plan, "planned")}${settlementLessonCellsV8310(null, "actual")}</tr>`);
    } else {
      actuals.forEach((act, index) => {
        const left = index === 0
          ? settlementLessonCellsV8310(plan, "planned")
          : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV8310(act, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV8310(null, "planned")}${settlementLessonCellsV8310(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") {
  renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV8310;
}

// === v8.3.10 settlement received JPY restore ===
function showSettlementReceivedJpyV8310() {
  document.querySelectorAll(".settlement-mini-table tr").forEach(row => {
    const text = row.textContent || "";
    if (text.includes("已收学费（日元）")) {
      row.classList.remove("hidden-settlement-row-v838");
      row.style.display = "";
    }
  });
}

document.addEventListener("DOMContentLoaded", () => setTimeout(showSettlementReceivedJpyV8310, 1000));
const renderAllBeforeReceivedJpyV8310 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeReceivedJpyV8310) {
  renderAll = function () {
    renderAllBeforeReceivedJpyV8310();
    showSettlementReceivedJpyV8310();
  };
}


// === v8.3.11 subject sort and settlement received JPY fix ===
const SUBJECT_ORDER_V8311 = [
  "日语", "日語", "日本語", "日本语", "EJU日语", "EJU日語",
  "数学", "EJU数学",
  "文综", "文綜", "综合科目", "総合科目", "EJU文综", "EJU総合科目",
  "物理", "EJU物理",
  "化学", "化學", "EJU化学",
  "生物", "EJU生物",
];

function normalizeSubjectSortTextV8311(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[・･／/\\_\-—–.,，。()（）]/g, "")
    .replace(/ｅｊｕ/gi, "EJU")
    .toLowerCase();
}

function subjectRankV8311(item) {
  const raw = item?.subject?.name || item?.subject_name || "";
  const text = normalizeSubjectSortTextV8311(raw);

  const contains = (patterns) => patterns.some(p => text.includes(normalizeSubjectSortTextV8311(p)));

  if (contains(["日语", "日語", "日本語", "日本语"])) return 10;
  if (contains(["数学"])) return 20;
  if (contains(["文综", "文綜", "综合科目", "総合科目"])) return 30;
  if (contains(["物理"])) return 40;
  if (contains(["化学", "化學"])) return 50;
  if (contains(["生物"])) return 60;

  return 999;
}

function ensureSettlementReceivedJpyRowV8311() {
  const actualTable = [...document.querySelectorAll(".settlement-card")].find(card => (card.textContent || "").includes("月底实际结算"));
  if (!actualTable) return;

  const tbody = actualTable.querySelector("tbody");
  const actualCnyRow = [...actualTable.querySelectorAll("tr")].find(row => (row.textContent || "").includes("实际课时费（人民币）"));
  const receivedCnyRow = [...actualTable.querySelectorAll("tr")].find(row => (row.textContent || "").includes("已收学费（人民币）"));
  let receivedJpyRow = document.getElementById("settlementReceivedJpy")?.closest("tr");

  if (!receivedJpyRow && tbody && receivedCnyRow) {
    receivedJpyRow = document.createElement("tr");
    receivedJpyRow.innerHTML = `<th>已收学费（日元）</th><td id="settlementReceivedJpy">0</td>`;
    tbody.insertBefore(receivedJpyRow, receivedCnyRow);
  } else if (receivedJpyRow && actualCnyRow && receivedCnyRow && receivedJpyRow.nextElementSibling !== receivedCnyRow) {
    tbody.insertBefore(receivedJpyRow, receivedCnyRow);
  }

  if (receivedJpyRow) {
    receivedJpyRow.classList.remove("hidden-settlement-row-v838");
    receivedJpyRow.style.display = "";
  }
}

// Patch settlement renderer to restore JPY row after older cleanup code runs.
const renderStudentSettlementBeforeV8311 = typeof renderStudentSettlement === "function" ? renderStudentSettlement : null;
if (renderStudentSettlementBeforeV8311) {
  renderStudentSettlement = function () {
    renderStudentSettlementBeforeV8311();
    ensureSettlementReceivedJpyRowV8311();
  };
}

const renderAllBeforeV8311 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8311) {
  renderAll = function () {
    renderAllBeforeV8311();
    ensureSettlementReceivedJpyRowV8311();
  };
}

const switchPageBeforeV8311 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV8311) {
  switchPage = function (page) {
    switchPageBeforeV8311(page);
    if (page === "student-settlement") setTimeout(ensureSettlementReceivedJpyRowV8311, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    ensureSettlementReceivedJpyRowV8311();
  }, 1000);
});



// === v8.3.12 force fixed subject sort ===
function subjectSortKeyV8312(item) {
  const name = String(item?.subject?.name || item?.subject_name || "")
    .replace(/\s+/g, "")
    .replace(/[・･／/\\_\-—–.,，。()（）]/g, "")
    .toLowerCase();

  // Do not depend on DB sort_order. Force business-defined course order.
  if (/日语|日語|日本語|日本语/.test(name)) return 10;
  if (/数学|數学/.test(name)) return 20;
  if (/文综|文綜|综合科目|綜合科目|総合科目/.test(name)) return 30;
  if (/物理/.test(name)) return 40;
  if (/化学|化學/.test(name)) return 50;
  if (/生物/.test(name)) return 60;
  return 999;
}

// Re-render current pages after overriding sort hooks.
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV8312 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8312) {
  renderAll = function () {
    renderAllBeforeV8312();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}

const switchPageBeforeV8312 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV8312) {
  switchPage = function (page) {
    switchPageBeforeV8312(page);
    if (page === "student-settlement" && typeof renderStudentSettlement === "function") setTimeout(renderStudentSettlement, 0);
  };
}



// === v8.3.14 student course track sort ===
function courseTrackLabelV8314(value) {
  if (value === "humanities") return "文科";
  if (value === "science") return "理科";
  return "理科";
}

function lessonStudentTrackV8314(item) {
  const studentId = item?.student_id || item?.student?.id;
  const student = (state.students || []).find(s => s.id === studentId) || item?.student;
  return student?.course_track || "science";
}

function normalizeSubjectSortTextV8314(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[・･／/\\_\-—–.,，。()（）]/g, "")
    .toLowerCase();
}

function subjectRankByTrackV8314(item) {
  const track = lessonStudentTrackV8314(item);
  const name = normalizeSubjectSortTextV8314(item?.subject?.name || item?.subject_name || "");

  const isJapanese = /日语|日語|日本語|日本语/.test(name);
  const isMath = /数学|數学/.test(name);
  const isHumanities = /文综|文綜|综合科目|綜合科目|総合科目/.test(name);
  const isPhysics = /物理/.test(name);
  const isChemistry = /化学|化學/.test(name);
  const isBiology = /生物/.test(name);

  if (track === "humanities") {
    if (isJapanese) return 10;
    if (isMath) return 20;
    if (isHumanities) return 30;
    if (isPhysics) return 90;
    if (isChemistry) return 91;
    if (isBiology) return 92;
    return 999;
  }

  // science default: 日语 → 数学 → 物理 → 化学 → 生物 → 文综
  if (isJapanese) return 10;
  if (isMath) return 20;
  if (isPhysics) return 30;
  if (isChemistry) return 40;
  if (isBiology) return 50;
  if (isHumanities) return 60;
  return 999;
}

function normalizeCourseTrackInputV8314() {
  document.querySelectorAll('select[name="course_track"]').forEach(select => {
    if (!select.value) select.value = "science";
  });
}

const buildFormBeforeV8314 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV8314) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV8314(type, data);
    if (type === "student") {
      normalizeCourseTrackInputV8314();
      if (typeof normalizeExchangeRateInputV837 === "function") normalizeExchangeRateInputV837();
      if (typeof normalizeExchangeRateInputV839 === "function") normalizeExchangeRateInputV839();
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentsTable === "function") renderStudentsTable();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV8314 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8314) {
  renderAll = function () {
    renderAllBeforeV8314();
    if (typeof renderStudentsTable === "function") renderStudentsTable();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.4 settlement difference calculation ===
function formatSignedCnyV84(value) {
  const n = Math.round(Number(value || 0));
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()} CNY`;
}

function settlementDifferenceLabelV84(value) {
  const n = Math.round(Number(value || 0));
  if (n > 0) return "应补交";
  if (n < 0) return "应退还 / 转下月结余";
  return "已结清";
}

function settlementDifferenceClassV84(value) {
  const n = Math.round(Number(value || 0));
  if (n > 0) return "due";
  if (n < 0) return "credit";
  return "clear";
}

function ensureSettlementDifferenceRowsV84() {
  const cards = [...document.querySelectorAll("#page-student-settlement .settlement-card")];
  const actualCard = cards.find(card => (card.textContent || "").includes("月底实际结算"));
  if (!actualCard) return;

  const tbody = actualCard.querySelector("tbody");
  if (!tbody) return;

  // Keep 已收学费（日元） visible; older versions hid this row.
  let receivedJpyRow = document.getElementById("settlementReceivedJpy")?.closest("tr");
  const receivedCnyRow = document.getElementById("settlementReceivedCny")?.closest("tr");

  if (!receivedJpyRow && receivedCnyRow) {
    receivedJpyRow = document.createElement("tr");
    receivedJpyRow.innerHTML = `<th>已收学费（日元）</th><td id="settlementReceivedJpy">0</td>`;
    tbody.insertBefore(receivedJpyRow, receivedCnyRow);
  }
  if (receivedJpyRow) {
    receivedJpyRow.classList.remove("hidden-settlement-row-v838");
    receivedJpyRow.style.display = "";
  }

  let plannedVsActualRow = document.getElementById("settlementPlannedActualDiffCny")?.closest("tr");
  let finalStatusRow = document.getElementById("settlementFinalStatusCny")?.closest("tr");

  if (!plannedVsActualRow) {
    plannedVsActualRow = document.createElement("tr");
    plannedVsActualRow.innerHTML = `<th>预定/实际差额（人民币）</th><td id="settlementPlannedActualDiffCny">0</td>`;
  }

  if (!finalStatusRow) {
    finalStatusRow = document.createElement("tr");
    finalStatusRow.className = "total-row settlement-final-row";
    finalStatusRow.innerHTML = `<th>本月应补/应退/结余</th><td id="settlementFinalStatusCny">暂未计算</td>`;
  }

  // Remove older placeholder total row if it exists, then append our rows at the bottom.
  [...tbody.querySelectorAll("tr")].forEach(row => {
    if ((row.textContent || "").includes("本月课时费结余/补交") && !row.querySelector("#settlementFinalStatusCny")) {
      row.remove();
    }
  });

  if (!plannedVsActualRow.parentElement) tbody.appendChild(plannedVsActualRow);
  if (!finalStatusRow.parentElement) tbody.appendChild(finalStatusRow);
}

function computeStudentSettlementV84() {
  const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  const student = (state.students || []).find(x => x.id === studentId);
  if (!studentId || !student) return null;

  const rate = Number(student.preset_exchange_rate || 0);
  const prevBalanceCny = Number(student.previous_balance_cny || 0);

  const lessonsAll = (state.lessonRecords || []).filter(x =>
    x.student_id === studentId &&
    x.year_month === month &&
    x.is_billable !== false
  );

  const planned = lessonsAll.filter(x => x.lesson_type === "planned");
  const actual = lessonsAll.filter(x =>
    x.lesson_type === "actual" &&
    (x.status === "completed" || x.status === "makeup")
  );

  const plannedJpy = sumLessonFeeV83(planned);
  const actualJpy = sumLessonFeeV83(actual);
  const plannedCny = plannedJpy * rate;
  const actualCny = actualJpy * rate;
  const plannedTotalCny = plannedCny - prevBalanceCny;

  const receivedCny = sumIncomeV83(studentId, month, "CNY");
  const receivedJpy = sumIncomeV83(studentId, month, "JPY");

  // 预定/实际差额：实际应收 - 预定应收。正数表示实际比预定多，应补；负数表示实际比预定少。
  const plannedActualDiffCny = actualCny - plannedCny;

  // 月末最终结果：实际应收 - 已收 - 上月结余/补交
  // 正数：还需要补交；负数：多收/结余/可退。
  const finalDueCny = actualCny - receivedCny - prevBalanceCny;

  return {
    month,
    studentId,
    student,
    rate,
    prevBalanceCny,
    planned,
    actual,
    plannedJpy,
    actualJpy,
    plannedCny,
    actualCny,
    plannedTotalCny,
    receivedCny,
    receivedJpy,
    plannedActualDiffCny,
    finalDueCny,
  };
}

const renderStudentSettlementBeforeV84 = typeof renderStudentSettlement === "function" ? renderStudentSettlement : null;
if (renderStudentSettlementBeforeV84) {
  renderStudentSettlement = function () {
    renderStudentSettlementBeforeV84();
    ensureSettlementDifferenceRowsV84();

    const result = computeStudentSettlementV84();
    if (!result) {
      setOptionalText("settlementPlannedActualDiffCny", "0");
      setOptionalText("settlementFinalStatusCny", "暂未计算");
      return;
    }

    setOptionalText("settlementPlannedActualDiffCny", formatSignedCnyV84(result.plannedActualDiffCny));

    const finalLabel = settlementDifferenceLabelV84(result.finalDueCny);
    const finalText = result.finalDueCny === 0
      ? "已结清"
      : `${finalLabel}：${formatSignedCnyV84(result.finalDueCny)}`;

    const finalEl = document.getElementById("settlementFinalStatusCny");
    if (finalEl) {
      finalEl.textContent = finalText;
      finalEl.className = `settlement-result ${settlementDifferenceClassV84(result.finalDueCny)}`;
    }

    const diffEl = document.getElementById("settlementPlannedActualDiffCny");
    if (diffEl) {
      diffEl.className = `settlement-result ${settlementDifferenceClassV84(result.plannedActualDiffCny)}`;
    }

    // Re-apply the core amount fields so older renderers cannot leave stale values.
    setOptionalText("settlementReceivedJpy", formatJpyV83(result.receivedJpy));
    setOptionalText("settlementReceivedCny", formatCnyV83(result.receivedCny));
    setOptionalText("settlementActualJpy2", formatJpyV83(result.actualJpy));
    setOptionalText("settlementActualCny", formatCnyV83(result.actualCny));
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    ensureSettlementDifferenceRowsV84();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV84 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV84) {
  renderAll = function () {
    renderAllBeforeV84();
    ensureSettlementDifferenceRowsV84();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}

const switchPageBeforeV84 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV84) {
  switchPage = function (page) {
    switchPageBeforeV84(page);
    if (page === "student-settlement") {
      setTimeout(() => {
        ensureSettlementDifferenceRowsV84();
        if (typeof renderStudentSettlement === "function") renderStudentSettlement();
      }, 0);
    }
  };
}



// === v8.5 income payment currency and settlement month ===
function paymentCurrencyLabelV85(value) {
  if (value === "JPY") return "日元";
  return "人民币";
}

function incomeSettlementMonthV85(item) {
  return item.settlement_month || item.year_month || "";
}

function incomePaymentCurrencyV85(item) {
  return item.payment_currency || item.currency || "CNY";
}

function incomeIncludeSettlementV85(item) {
  return item.include_in_student_settlement !== false;
}

function renderIncomeTableV85() {
  const tbody = document.getElementById("incomeTable");
  if (!tbody) return;

  const rows = filterFinanceRows(state.incomeRecords, "income")
    .slice()
    .sort((a, b) => {
      const ma = a.year_month || "";
      const mb = b.year_month || "";
      if (ma !== mb) return mb.localeCompare(ma);
      return String(b.income_date || b.created_at || "").localeCompare(String(a.income_date || a.created_at || ""));
    });

  const html = [];
  let lastMonth = "";

  rows.forEach(item => {
    const ym = item.year_month || "未归属月份";
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`
        <tr class="month-group-row">
          <td colspan="14">${esc(expenseMonthLabel(ym))}</td>
        </tr>
      `);
    }

    const paymentCurrency = incomePaymentCurrencyV85(item);

    html.push(`
      <tr>
        <td>${esc(displayRecordDate(item.income_date || item.created_at))}</td>
        <td>${esc(item.year_month || "")}</td>
        <td>${esc(incomeSettlementMonthV85(item))}</td>
        <td>${esc(item.business_entity?.name || "")}</td>
        <td>${esc(incomeCategoryLabel(item.income_category))}</td>
        <td>${esc(item.student?.name || "")}</td>
        <td>${esc(short(item.description || item.note, 28))}</td>
        <td>${esc(item.account?.name || "")}</td>
        <td>${esc(paymentCurrencyLabelV85(paymentCurrency))}</td>
        <td>${money(item.amount)}</td>
        <td>${incomeIncludeSettlementV85(item) ? badge("计入") : badge("不计入", "gray")}</td>
        <td>${financeStatusBadge(item.status)}</td>
        <td>${item.is_taxable_income ? badge("计税") : badge("不计税", "gray")}</td>
        <td>${actionButtons("income", item.id)}</td>
      </tr>
    `);
  });

  tbody.innerHTML = html.join("");
}

renderIncomeTable = renderIncomeTableV85;

function sumIncomeV85(studentId, month, currency) {
  return (state.incomeRecords || [])
    .filter(x =>
      x.student_id === studentId &&
      incomeSettlementMonthV85(x) === month &&
      x.income_category === "tuition" &&
      x.status === "received" &&
      incomePaymentCurrencyV85(x) === currency &&
      incomeIncludeSettlementV85(x)
    )
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

// Override older settlement income calculation hook.
sumIncomeV83 = sumIncomeV85;

function computeReceivedEquivalentCnyV85(studentId, month, rate) {
  const receivedCny = sumIncomeV85(studentId, month, "CNY");
  const receivedJpy = sumIncomeV85(studentId, month, "JPY");
  return {
    receivedCny,
    receivedJpy,
    receivedEquivalentCny: receivedCny + (receivedJpy * Number(rate || 0)),
  };
}

const computeStudentSettlementBeforeV85 = typeof computeStudentSettlementV84 === "function" ? computeStudentSettlementV84 : null;
if (computeStudentSettlementBeforeV85) {
  computeStudentSettlementV84 = function () {
    const result = computeStudentSettlementBeforeV85();
    if (!result) return result;

    const received = computeReceivedEquivalentCnyV85(result.studentId, result.month, result.rate);
    result.receivedCny = received.receivedCny;
    result.receivedJpy = received.receivedJpy;
    result.receivedEquivalentCny = received.receivedEquivalentCny;

    // v8.5: final result uses CNY-equivalent received amount.
    result.finalDueCny = result.actualCny - result.receivedEquivalentCny - result.prevBalanceCny;
    return result;
  };
}

function ensureSettlementEquivalentRowsV85() {
  const actualCard = [...document.querySelectorAll("#page-student-settlement .settlement-card")]
    .find(card => (card.textContent || "").includes("月底实际结算"));
  if (!actualCard) return;

  const tbody = actualCard.querySelector("tbody");
  if (!tbody) return;

  const finalRow = document.getElementById("settlementFinalStatusCny")?.closest("tr");
  let equivalentRow = document.getElementById("settlementReceivedEquivalentCny")?.closest("tr");

  if (!equivalentRow) {
    equivalentRow = document.createElement("tr");
    equivalentRow.innerHTML = `<th>已收折算合计（人民币）</th><td id="settlementReceivedEquivalentCny">0</td>`;
  }

  if (finalRow) {
    tbody.insertBefore(equivalentRow, finalRow);
  } else if (!equivalentRow.parentElement) {
    tbody.appendChild(equivalentRow);
  }
}

const renderStudentSettlementBeforeV85 = typeof renderStudentSettlement === "function" ? renderStudentSettlement : null;
if (renderStudentSettlementBeforeV85) {
  renderStudentSettlement = function () {
    renderStudentSettlementBeforeV85();
    ensureSettlementEquivalentRowsV85();

    const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
    const studentId = document.getElementById("settlementStudentFilter")?.value || "";
    const student = (state.students || []).find(x => x.id === studentId);
    if (!student) return;

    const rate = Number(student.preset_exchange_rate || 0);
    const received = computeReceivedEquivalentCnyV85(studentId, month, rate);

    setOptionalText("settlementReceivedCny", formatCnyV83(received.receivedCny));
    setOptionalText("settlementReceivedJpy", formatJpyV83(received.receivedJpy));
    setOptionalText("settlementReceivedEquivalentCny", formatCnyV83(received.receivedEquivalentCny));

    // If v8.4 final field exists, recalc it with equivalent received amount.
    const actualJpy = Number((state.lessonRecords || [])
      .filter(x => x.student_id === studentId && x.year_month === month && x.lesson_type === "actual" && x.is_billable !== false && (x.status === "completed" || x.status === "makeup"))
      .reduce((sum, x) => sum + Number(x.lesson_fee || (Number(x.unit_price || 0) * Number(x.duration_hours || 0)) || 0), 0));
    const actualCny = actualJpy * rate;
    const prevBalanceCny = Number(student.previous_balance_cny || 0);
    const finalDueCny = actualCny - received.receivedEquivalentCny - prevBalanceCny;

    const finalEl = document.getElementById("settlementFinalStatusCny");
    if (finalEl) {
      const label = settlementDifferenceLabelV84(finalDueCny);
      finalEl.textContent = finalDueCny === 0 ? "已结清" : `${label}：${formatSignedCnyV84(finalDueCny)}`;
      finalEl.className = `settlement-result ${settlementDifferenceClassV84(finalDueCny)}`;
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderIncomeTable === "function") renderIncomeTable();
    ensureSettlementEquivalentRowsV85();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV85 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV85) {
  renderAll = function () {
    renderAllBeforeV85();
    if (typeof renderIncomeTable === "function") renderIncomeTable();
    ensureSettlementEquivalentRowsV85();
  };
}



// === v8.5.2 week label for planned lesson dates ===
function lessonDateWithWeekLabelV852(item) {
  const base = lessonPairDateText(item);
  if (item?.lesson_type === "planned" && base && !String(base).endsWith("周")) {
    return `${base}周`;
  }
  return base;
}

function settlementLessonCellsV852(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";

  return `
    <td class="col-date"><div>${esc(item.lesson_type === "planned" ? `${displayRecordDate(item.lesson_date || "")}周` : displayRecordDate(item.lesson_date || ""))}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${esc(studentName)}</td>
    <td class="col-teacher">${esc(teacherName)}</td>
    <td class="col-subject">
      <strong>${esc(subjectName)}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${typeof settlementActionButtonsV8310 === "function" ? settlementActionButtonsV8310(item) : ""}</td>
  `;
}

function renderSettlementPairedLessonsV852(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    let planId = row.planned_lesson_id;
    if (!planId && typeof schoolStableFindMatchingPlannedLessonV70 === "function") {
      const matched = schoolStableFindMatchingPlannedLessonV70(row);
      if (matched) planId = matched.id;
    }
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(sortFn).forEach(plan => {
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(plan, "planned")}${settlementLessonCellsV852(null, "actual")}</tr>`);
    } else {
      actuals.forEach((act, index) => {
        const left = index === 0
          ? settlementLessonCellsV852(plan, "planned")
          : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV852(act, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(null, "planned")}${settlementLessonCellsV852(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") {
  renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV852;
}
if (typeof renderSettlementPairedLessonsV8310 === "function") {
  renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV852;
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV852 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV852) {
  renderAll = function () {
    renderAllBeforeV852();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.5.3 actual lesson chronological sort fix ===
function compareLessonDateTimeAscV853(a, b) {
  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  const start = String(a.start_time || "").localeCompare(String(b.start_time || ""));
  if (start !== 0) return start;

  const end = String(a.end_time || "").localeCompare(String(b.end_time || ""));
  if (end !== 0) return end;

  return String(a.created_at || "").localeCompare(String(b.created_at || ""));
}

function renderSettlementPairedLessonsV853(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    let planId = row.planned_lesson_id;
    if (!planId && typeof schoolStableFindMatchingPlannedLessonV70 === "function") {
      const matched = schoolStableFindMatchingPlannedLessonV70(row);
      if (matched) planId = matched.id;
    }
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const plannedSortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : compareLessonDateTimeAscV853;

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(plannedSortFn).forEach(plan => {
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(compareLessonDateTimeAscV853);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(plan, "planned")}${settlementLessonCellsV852(null, "actual")}</tr>`);
    } else {
      actuals.forEach((act, index) => {
        const left = index === 0
          ? settlementLessonCellsV852(plan, "planned")
          : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV852(act, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(compareLessonDateTimeAscV853).forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(null, "planned")}${settlementLessonCellsV852(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") {
  renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV853;
}
if (typeof renderSettlementPairedLessonsV8310 === "function") {
  renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV853;
}
if (typeof renderSettlementPairedLessonsV852 === "function") {
  renderSettlementPairedLessonsV852 = renderSettlementPairedLessonsV853;
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV853 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV853) {
  renderAll = function () {
    renderAllBeforeV853();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.5.4 lesson pair row chronological sort fix ===
function compareDateTimeAscV854(a, b) {
  const date = String(a?.lesson_date || "").localeCompare(String(b?.lesson_date || ""));
  if (date !== 0) return date;

  const start = String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
  if (start !== 0) return start;

  const end = String(a?.end_time || "").localeCompare(String(b?.end_time || ""));
  if (end !== 0) return end;

  return String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
}

function subjectRankForSortV854(item) {
  if (typeof subjectRankByTrackV8314 === "function") return subjectRankByTrackV8314(item);
  if (typeof subjectSortKeyV8312 === "function") return subjectSortKeyV8312(item);
  return 999;
}

function lessonPairSortKeyDateV854(plan, actuals) {
  // 右侧有实际课时的行，按实际课时日期排序；否则按预定课时日期排序。
  const firstActual = (actuals || []).slice().sort(compareDateTimeAscV854)[0];
  return firstActual || plan;
}

function compareLessonPairV854(a, b) {
  const aBase = lessonPairSortKeyDateV854(a.plan, a.actuals);
  const bBase = lessonPairSortKeyDateV854(b.plan, b.actuals);

  const month = String((aBase || a.plan)?.year_month || "").localeCompare(String((bBase || b.plan)?.year_month || ""));
  if (month !== 0) return month;

  // 课程顺序仍然优先：日语 → 数学 → 文/理科顺序。
  const ar = subjectRankForSortV854(a.plan || aBase);
  const br = subjectRankForSortV854(b.plan || bBase);
  if (ar !== br) return ar - br;

  const subject = String((a.plan || aBase)?.subject?.name || "").localeCompare(String((b.plan || bBase)?.subject?.name || ""));
  if (subject !== 0) return subject;

  // 同一课程下，按右侧实际课时日期/时间正序。如果没有实际课时，按预定日期/时间正序。
  const dt = compareDateTimeAscV854(aBase, bBase);
  if (dt !== 0) return dt;

  const teacher = String((a.plan || aBase)?.teacher?.display_name || (a.plan || aBase)?.teacher?.name || "")
    .localeCompare(String((b.plan || bBase)?.teacher?.display_name || (b.plan || bBase)?.teacher?.name || ""));
  if (teacher !== 0) return teacher;

  return String((a.plan || aBase)?.id || "").localeCompare(String((b.plan || bBase)?.id || ""));
}

function buildLessonPairGroupsV854(rows) {
  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual");
  const actualByPlan = new Map();
  const unlinkedActual = [];

  actualRows.forEach(actual => {
    let planId = actual.planned_lesson_id;

    if (!planId && typeof schoolStableFindMatchingPlannedLessonV70 === "function") {
      const matched = schoolStableFindMatchingPlannedLessonV70(actual);
      if (matched) planId = matched.id;
    }
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(actual);
    } else {
      unlinkedActual.push(actual);
    }
  });

  const pairs = plannedRows.map(plan => ({
    plan,
    actuals: (actualByPlan.get(plan.id) || []).slice().sort(compareDateTimeAscV854),
  }));

  pairs.sort(compareLessonPairV854);
  unlinkedActual.sort(compareDateTimeAscV854);

  return { pairs, unlinkedActual };
}

function renderSettlementPairedLessonsV854(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const rows = [...planned, ...actual];
  const { pairs, unlinkedActual } = buildLessonPairGroupsV854(rows);

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  pairs.forEach(pair => {
    if (!pair.actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(pair.plan, "planned")}${settlementLessonCellsV852(null, "actual")}</tr>`);
      return;
    }

    pair.actuals.forEach((act, index) => {
      const left = index === 0
        ? settlementLessonCellsV852(pair.plan, "planned")
        : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV852(act, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(null, "planned")}${settlementLessonCellsV852(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV854;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV854;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairedLessonsV854;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairedLessonsV854;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV854 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV854) {
  renderAll = function () {
    renderAllBeforeV854();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.5.5 stable planned lesson link priority ===
function lessonIdTextV855(value) {
  return String(value || "").trim();
}

function buildActualByExplicitPlanV855(actualRows) {
  const actualByPlan = new Map();
  const unlinkedActual = [];

  actualRows.forEach(actual => {
    const explicitPlanId = lessonIdTextV855(actual.planned_lesson_id);

    // v8.5.5 important rule:
    // If actual lesson has planned_lesson_id, trust it absolutely.
    // Do not re-match by date/time/subject, otherwise duplicate weekly planned rows can attach to the wrong row.
    if (explicitPlanId) {
      if (!actualByPlan.has(explicitPlanId)) actualByPlan.set(explicitPlanId, []);
      actualByPlan.get(explicitPlanId).push(actual);
    } else {
      unlinkedActual.push(actual);
    }
  });

  actualByPlan.forEach((items, key) => {
    items.sort(compareDateTimeAscV854 || compareDateTimeAscV853 || ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));
  });
  unlinkedActual.sort(compareDateTimeAscV854 || compareDateTimeAscV853 || ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));

  return { actualByPlan, unlinkedActual };
}

function comparePlannedRowsByCourseDateV855(a, b) {
  // Left side planned lessons should keep the stable planned-course order.
  if (typeof compareLessonsV78 === "function") {
    const r = compareLessonsV78(a, b);
    if (r !== 0) return r;
  }

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  const start = String(a.start_time || "").localeCompare(String(b.start_time || ""));
  if (start !== 0) return start;

  return String(a.id || "").localeCompare(String(b.id || ""));
}

function renderSettlementPairedLessonsV855(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const { actualByPlan, unlinkedActual } = buildActualByExplicitPlanV855(actual);

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(comparePlannedRowsByCourseDateV855).forEach(plan => {
    const actuals = (actualByPlan.get(lessonIdTextV855(plan.id)) || []).slice()
      .sort(compareDateTimeAscV854 || compareDateTimeAscV853 || ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(plan, "planned")}${settlementLessonCellsV852(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((act, index) => {
      const left = index === 0
        ? settlementLessonCellsV852(plan, "planned")
        : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV852(act, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV852(null, "planned")}${settlementLessonCellsV852(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV855;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV855;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairedLessonsV855;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairedLessonsV855;
if (typeof renderSettlementPairedLessonsV854 === "function") renderSettlementPairedLessonsV854 = renderSettlementPairedLessonsV855;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV855 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV855) {
  renderAll = function () {
    renderAllBeforeV855();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.5.6 lesson fee auto calc + planned week-start display ===
function toIsoDateV856(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replaceAll("/", "-");
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfDateV856(value) {
  const iso = toIsoDateV856(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function plannedWeekDateDisplayV856(item) {
  const monday = mondayOfDateV856(item?.lesson_date);
  if (!monday) return "";
  return `${monday}周`;
}

function actualDateDisplayV856(item) {
  return toIsoDateV856(item?.lesson_date) || lessonPairDateText(item) || "";
}

function yearMonthDateDisplayV856(item) {
  const iso = toIsoDateV856(item?.lesson_date);
  return iso || item?.year_month || "";
}

function settlementLessonCellsV856(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";
  const dateDisplay = item.lesson_type === "planned" ? plannedWeekDateDisplayV856(item) : actualDateDisplayV856(item);

  return `
    <td class="col-date"><div>${esc(dateDisplay)}</div><span>${esc(yearMonthDateDisplayV856(item))}</span></td>
    <td class="col-student">${esc(studentName)}</td>
    <td class="col-teacher">${esc(teacherName)}</td>
    <td class="col-subject">
      <strong>${esc(subjectName)}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${typeof settlementActionButtonsV8310 === "function" ? settlementActionButtonsV8310(item) : ""}</td>
  `;
}

if (typeof renderSettlementPairedLessonsV855 === "function") {
  const renderSettlementBeforeV856 = renderSettlementPairedLessonsV855;
  renderSettlementPairedLessonsV855 = function (planned, actual) {
    const oldCells = settlementLessonCellsV852;
    settlementLessonCellsV852 = settlementLessonCellsV856;
    const result = renderSettlementBeforeV856(planned, actual);
    settlementLessonCellsV852 = settlementLessonCellsV856;
    return result;
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

// === v8.5.7 strong planned-week Monday fix ===
function toIsoDateV857(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replaceAll("/", "-");
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfDateV857(value) {
  const iso = toIsoDateV857(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dateCellDisplayV857(item) {
  if (item?.lesson_type === "planned") {
    const monday = mondayOfDateV857(item.lesson_date);
    return {
      main: monday ? `${monday}周` : "",
      sub: monday || toIsoDateV857(item.lesson_date) || item.year_month || "",
    };
  }
  const actual = toIsoDateV857(item?.lesson_date);
  return {
    main: actual || lessonPairDateText(item) || "",
    sub: actual || item?.year_month || "",
  };
}

function settlementLessonCellsV857(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";
  const d = dateCellDisplayV857(item);

  return `
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${esc(studentName)}</td>
    <td class="col-teacher">${esc(teacherName)}</td>
    <td class="col-subject">
      <strong>${esc(subjectName)}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${typeof settlementActionButtonsV8310 === "function" ? settlementActionButtonsV8310(item) : ""}</td>
  `;
}

function renderSettlementPairedLessonsV857(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    const planId = String(row.planned_lesson_id || "").trim();
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const dateSort = typeof compareDateTimeAscV854 === "function"
    ? compareDateTimeAscV854
    : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  const planSort = typeof comparePlannedRowsByCourseDateV855 === "function"
    ? comparePlannedRowsByCourseDateV855
    : (typeof compareLessonsV78 === "function" ? compareLessonsV78 : dateSort);

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(planSort).forEach(plan => {
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(dateSort);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV857(plan, "planned")}${settlementLessonCellsV857(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((act, index) => {
      const left = index === 0
        ? settlementLessonCellsV857(plan, "planned")
        : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV857(act, "actual")}</tr>`);
    });
  });

  unlinkedActual.slice().sort(dateSort).forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV857(null, "planned")}${settlementLessonCellsV857(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV857;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV857;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairedLessonsV857;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairedLessonsV857;
if (typeof renderSettlementPairedLessonsV854 === "function") renderSettlementPairedLessonsV854 = renderSettlementPairedLessonsV857;
if (typeof renderSettlementPairedLessonsV855 === "function") renderSettlementPairedLessonsV855 = renderSettlementPairedLessonsV857;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV857 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV857) {
  renderAll = function () {
    renderAllBeforeV857();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.5.8 planned week display only; keep original lesson_date ===
function toIsoDateV858(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replaceAll("/", "-");
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfDateV858(value) {
  const iso = toIsoDateV858(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function dateCellDisplayV858(item) {
  const lessonDate = toIsoDateV858(item?.lesson_date);
  if (item?.lesson_type === "planned") {
    const monday = mondayOfDateV858(lessonDate);
    return {
      main: monday ? `${monday}周` : "",
      sub: lessonDate || monday || item?.year_month || "",
    };
  }
  return {
    main: lessonDate || lessonPairDateText(item) || "",
    sub: lessonDate || item?.year_month || "",
  };
}

function settlementLessonCellsV858(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = feeOfLessonV83(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const studentName = item.student?.display_name || item.student?.name || "";
  const teacherName = item.teacher?.display_name || item.teacher?.name || "";
  const subjectName = item.subject?.name || "";
  const d = dateCellDisplayV858(item);

  return `
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${esc(studentName)}</td>
    <td class="col-teacher">${esc(teacherName)}</td>
    <td class="col-subject">
      <strong>${esc(subjectName)}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${typeof settlementActionButtonsV8310 === "function" ? settlementActionButtonsV8310(item) : ""}</td>
  `;
}

function renderSettlementPairedLessonsV858(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actual.forEach(row => {
    const planId = String(row.planned_lesson_id || "").trim();
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  const dateSort = typeof compareDateTimeAscV854 === "function"
    ? compareDateTimeAscV854
    : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  const planSort = typeof comparePlannedRowsByCourseDateV855 === "function"
    ? comparePlannedRowsByCourseDateV855
    : (typeof compareLessonsV78 === "function" ? compareLessonsV78 : dateSort);

  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);

  planned.slice().sort(planSort).forEach(plan => {
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(dateSort);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV858(plan, "planned")}${settlementLessonCellsV858(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((act, index) => {
      const left = index === 0
        ? settlementLessonCellsV858(plan, "planned")
        : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementLessonCellsV858(act, "actual")}</tr>`);
    });
  });

  unlinkedActual.slice().sort(dateSort).forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementLessonCellsV858(null, "planned")}${settlementLessonCellsV858(act, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV854 === "function") renderSettlementPairedLessonsV854 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV855 === "function") renderSettlementPairedLessonsV855 = renderSettlementPairedLessonsV858;
if (typeof renderSettlementPairedLessonsV857 === "function") renderSettlementPairedLessonsV857 = renderSettlementPairedLessonsV858;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV858 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV858) {
  renderAll = function () {
    renderAllBeforeV858();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}



// === v8.6 stable core for lessons and settlement ===
const SCHOOL_STABLE_V86 = {
  version: "8.6",
  subjectOrderScience: ["japanese", "math", "physics", "chemistry", "biology", "humanities", "other"],
  subjectOrderHumanities: ["japanese", "math", "humanities", "physics", "chemistry", "biology", "other"],
};

function isoDateV86(value) {
  if (!value) return "";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.replaceAll("/", "-");
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfDateV86(value) {
  const iso = isoDateV86(value);
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function lessonDateDisplayV86(item) {
  const actualDate = isoDateV86(item?.lesson_date);
  if (item?.lesson_type === "planned") {
    const monday = mondayOfDateV86(actualDate);
    return { main: monday ? `${monday}周` : "", sub: actualDate || monday || item?.year_month || "" };
  }
  return { main: actualDate || "", sub: actualDate || item?.year_month || "" };
}

function subjectKindV86(item) {
  const name = String(item?.subject?.name || item?.subject_name || "")
    .replace(/\s+/g, "")
    .replace(/[・･／/\\_\-—–.,，。()（）]/g, "")
    .toLowerCase();
  if (/日语|日語|日本語|日本语/.test(name)) return "japanese";
  if (/数学|數学/.test(name)) return "math";
  if (/文综|文綜|综合科目|綜合科目|総合科目/.test(name)) return "humanities";
  if (/物理/.test(name)) return "physics";
  if (/化学|化學/.test(name)) return "chemistry";
  if (/生物/.test(name)) return "biology";
  return "other";
}

function lessonStudentV86(item) {
  const studentId = item?.student_id || item?.student?.id;
  return (state.students || []).find(s => s.id === studentId) || item?.student || null;
}

function lessonTrackV86(item) {
  return lessonStudentV86(item)?.course_track || "science";
}

function lessonFeeV86(item) {
  return Number(item?.lesson_fee || (Number(item?.unit_price || 0) * Number(item?.duration_hours || 0)) || 0);
}

function buildLessonPairsV86(rows) {
  const plannedSortV86 =
    typeof comparePlannedLessonsV86 === "function"
      ? comparePlannedLessonsV86
      : (typeof compareLessonsV78 === "function"
        ? compareLessonsV78
        : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));

  const planned = rows.filter(x => x.lesson_type === "planned").slice().sort(plannedSortV86);

  const actual = rows.filter(x => x.lesson_type === "actual");
  const actualByPlan = new Map();
  const unlinkedActual = [];
  actual.forEach(row => {
    const planId = String(row.planned_lesson_id || "").trim();
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });
  actualByPlan.forEach(list => list.sort(compareDateTimeV86));
  unlinkedActual.sort(compareDateTimeV86);
  return { planned, actualByPlan, unlinkedActual };
}

function settlementActionsV86(item) {
  if (!item) return "";
  return `
    <div class="settlement-action-col">
      <button class="secondary-btn settlement-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn settlement-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function settlementCellV86(item, side) {
  if (!item) {
    return `<td colspan="7" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }
  const d = lessonDateDisplayV86(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = [item.start_time, item.end_time].filter(Boolean).join("-");
  const fee = lessonFeeV86(item);
  return `
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${esc(item.student?.display_name || item.student?.name || "")}</td>
    <td class="col-teacher">${esc(item.teacher?.display_name || item.teacher?.name || "")}</td>
    <td class="col-subject">
      <strong>${esc(item.subject?.name || "")}</strong>
      <span>${esc(timeText || "时间未定")} / ${money(item.duration_hours)}H</span>
      <span>${formatJpyV83(fee)}</span>
    </td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable !== false ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="settlement-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${esc(short(item.lesson_content || item.note || "", 28))}</div></td>
    <td class="col-actions">${settlementActionsV86(item)}</td>
  `;
}

function renderSettlementPairsV86(planned, actual) {
  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;
  const { planned: plans, actualByPlan, unlinkedActual } = buildLessonPairsV86([...planned, ...actual]);
  const html = [];
  html.push(`<tr class="lesson-sub-head-body settlement-v8310">
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
    <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
  </tr>`);
  plans.forEach(plan => {
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(compareDateTimeV86);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementCellV86(plan, "planned")}${settlementCellV86(null, "actual")}</tr>`);
      return;
    }
    actuals.forEach((act, index) => {
      const left = index === 0 ? settlementCellV86(plan, "planned") : `<td colspan="7" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row settlement-v8310">${left}${settlementCellV86(act, "actual")}</tr>`);
    });
  });
  unlinkedActual.forEach(act => {
    html.push(`<tr class="lesson-pair-row settlement-v8310">${settlementCellV86(null, "planned")}${settlementCellV86(act, "actual")}</tr>`);
  });
  tbody.innerHTML = html.length > 1 ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

function incomeSettlementMonthV86(item) {
  return item.settlement_month || item.year_month || "";
}
function incomePaymentCurrencyV86(item) {
  return item.payment_currency || item.currency || "CNY";
}
function incomeIncludeSettlementV86(item) {
  return item.include_in_student_settlement !== false;
}
function sumIncomeV86(studentId, month, currency) {
  return (state.incomeRecords || [])
    .filter(x =>
      x.student_id === studentId &&
      incomeSettlementMonthV86(x) === month &&
      x.income_category === "tuition" &&
      x.status === "received" &&
      incomePaymentCurrencyV86(x) === currency &&
      incomeIncludeSettlementV86(x)
    )
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

// Final ownership.
sumIncomeV83 = sumIncomeV86;

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV854 === "function") renderSettlementPairedLessonsV854 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV855 === "function") renderSettlementPairedLessonsV855 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV857 === "function") renderSettlementPairedLessonsV857 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV858 === "function") renderSettlementPairedLessonsV858 = renderSettlementPairsV86;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});



// === v8.6.1 business entity split statistics ===
function businessEntityNameV861(id) {
  const item = (state.businessEntities || []).find(x => x.id === id);
  return item?.name || "";
}

function businessEntityCodeV861(id) {
  const item = (state.businessEntities || []).find(x => x.id === id);
  return item?.code || "";
}

function businessEntityGroupV861(row) {
  const name = row.business_entity?.name || businessEntityNameV861(row.business_entity_id) || "";
  const code = row.business_entity?.code || businessEntityCodeV861(row.business_entity_id) || "";
  const text = `${name} ${code}`.toLowerCase();

  if (text.includes("个人") || text.includes("personal") || text.includes("private")) {
    return "personal";
  }
  if (text.includes("青空") || text.includes("aosora") || text.includes("company") || text.includes("法人")) {
    return "aosora";
  }

  // Fallback: unknown is shown separately to avoid mixing private/company money.
  return "other";
}

function groupLabelV861(group) {
  if (group === "personal") return "个人名义";
  if (group === "aosora") return "青空塾";
  return "未分类";
}

function monthFilterValueV861() {
  return document.getElementById("financeMonthFilter")?.value
    || document.getElementById("dashboardMonthFilter")?.value
    || currentYearMonth();
}

function financeRowsForMonthV861(rows, ym) {
  return (rows || []).filter(x => (x.year_month || "") === ym);
}

function sumFinanceByGroupV861(rows, group) {
  return rows
    .filter(x => businessEntityGroupV861(x) === group)
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

function calcBusinessSplitStatsV861(ym) {
  const incomes = financeRowsForMonthV861(state.incomeRecords || [], ym);
  const expenses = financeRowsForMonthV861(state.expenseRecords || [], ym);

  return ["aosora", "personal", "other"].map(group => {
    const income = sumFinanceByGroupV861(incomes, group);
    const expense = sumFinanceByGroupV861(expenses, group);
    return {
      group,
      label: groupLabelV861(group),
      income,
      expense,
      net: income - expense,
    };
  }).filter(x => x.income || x.expense || x.group !== "other");
}

function splitStatsHtmlV861(ym) {
  const stats = calcBusinessSplitStatsV861(ym);

  return `
    <section class="business-split-card" id="businessSplitStatsV861">
      <div class="section-title-row">
        <div>
          <h3>业务归属统计</h3>
          <p class="muted-small">${esc(expenseMonthLabel(ym))}：青空塾 / 个人名义 分开统计</p>
        </div>
      </div>
      <div class="business-split-grid">
        ${stats.map(item => `
          <div class="business-split-item ${item.group}">
            <div class="business-split-title">${esc(item.label)}</div>
            <div class="business-split-row"><span>收入</span><strong>${formatCny(item.income)}</strong></div>
            <div class="business-split-row"><span>支出</span><strong>${formatCny(item.expense)}</strong></div>
            <div class="business-split-row total"><span>净额</span><strong>${formatCny(item.net)}</strong></div>
            ${item.group === "personal" ? `<div class="privacy-note">后续仅最高权限可见</div>` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderBusinessSplitStatsV861() {
  const ym = monthFilterValueV861();

  // Dashboard: insert after the top stat grid/card area.
  const dashboardPage = document.getElementById("page-dashboard") || document.querySelector("[data-page='dashboard']");
  if (dashboardPage) {
    let holder = dashboardPage.querySelector("#businessSplitStatsV861");
    if (!holder) {
      const anchor = dashboardPage.querySelector(".stats-grid, .dashboard-grid, .cards-grid, .section-card");
      if (anchor) {
        anchor.insertAdjacentHTML("afterend", splitStatsHtmlV861(ym));
      } else {
        dashboardPage.insertAdjacentHTML("beforeend", splitStatsHtmlV861(ym));
      }
    } else {
      holder.outerHTML = splitStatsHtmlV861(ym);
    }
  }

  // Finance summary: insert near summary cards if the page exists.
  const financePage = document.getElementById("page-finance-summary") || document.getElementById("page-summary") || document.querySelector("[data-page='finance-summary']");
  if (financePage) {
    let holder = financePage.querySelector("#businessSplitStatsV861");
    if (!holder) {
      const anchor = financePage.querySelector(".stats-grid, .summary-grid, .cards-grid, .section-card");
      if (anchor) {
        anchor.insertAdjacentHTML("afterend", splitStatsHtmlV861(ym));
      } else {
        financePage.insertAdjacentHTML("beforeend", splitStatsHtmlV861(ym));
      }
    } else {
      holder.outerHTML = splitStatsHtmlV861(ym);
    }
  }
}

const renderStatsBeforeV861 = typeof renderStats === "function" ? renderStats : null;
if (renderStatsBeforeV861) {
  renderStats = function () {
    renderStatsBeforeV861();
    renderBusinessSplitStatsV861();
  };
}

const renderAllBeforeV861 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV861) {
  renderAll = function () {
    renderAllBeforeV861();
    renderBusinessSplitStatsV861();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderBusinessSplitStatsV861, 1000);
  document.addEventListener("change", (e) => {
    if (e.target?.id === "financeMonthFilter" || e.target?.id === "dashboardMonthFilter") {
      renderBusinessSplitStatsV861();
    }
  });
});



// === v8.6.2 split dashboard and finance summary by business entity ===
function currencyAmountTextV862(amounts) {
  const parts = [];
  if (Number(amounts.JPY || 0) !== 0) parts.push(`JPY ${money(amounts.JPY)}`);
  if (Number(amounts.CNY || 0) !== 0) parts.push(`CNY ${money(amounts.CNY)}`);
  return parts.length ? parts.join(" / ") : "0";
}

function emptyCurrencyAmountsV862() {
  return { JPY: 0, CNY: 0 };
}

function addCurrencyAmountV862(bucket, currency, amount) {
  const cur = currency || "JPY";
  if (!Object.prototype.hasOwnProperty.call(bucket, cur)) bucket[cur] = 0;
  bucket[cur] += Number(amount || 0);
}

function rowBusinessGroupV862(row) {
  if (typeof businessEntityGroupV861 === "function") return businessEntityGroupV861(row);
  const name = row.business_entity?.name || "";
  const code = row.business_entity?.code || "";
  const text = `${name} ${code}`.toLowerCase();
  if (text.includes("个人") || text.includes("personal") || text.includes("private")) return "personal";
  if (text.includes("青空") || text.includes("aosora") || text.includes("company") || text.includes("法人")) return "aosora";
  return "other";
}

function financeRowsInMonthV862(rows, ym) {
  return (rows || []).filter(row => (row.year_month || "") === ym);
}

function calcSplitFinanceByGroupV862(ym) {
  const groups = {
    aosora: {
      key: "aosora",
      label: "青空塾",
      income: emptyCurrencyAmountsV862(),
      expense: emptyCurrencyAmountsV862(),
      balance: emptyCurrencyAmountsV862(),
      accounts: {},
    },
    personal: {
      key: "personal",
      label: "个人名义",
      income: emptyCurrencyAmountsV862(),
      expense: emptyCurrencyAmountsV862(),
      balance: emptyCurrencyAmountsV862(),
      accounts: {},
    },
    other: {
      key: "other",
      label: "未分类",
      income: emptyCurrencyAmountsV862(),
      expense: emptyCurrencyAmountsV862(),
      balance: emptyCurrencyAmountsV862(),
      accounts: {},
    },
  };

  financeRowsInMonthV862(state.incomeRecords || [], ym).forEach(row => {
    const group = rowBusinessGroupV862(row);
    const currency = row.currency || row.payment_currency || "JPY";
    addCurrencyAmountV862(groups[group].income, currency, row.amount);
  });

  financeRowsInMonthV862(state.expenseRecords || [], ym).forEach(row => {
    const group = rowBusinessGroupV862(row);
    const currency = row.currency || "JPY";
    addCurrencyAmountV862(groups[group].expense, currency, row.amount);
  });

  Object.values(groups).forEach(group => {
    ["JPY", "CNY"].forEach(cur => {
      group.balance[cur] = Number(group.income[cur] || 0) - Number(group.expense[cur] || 0);
    });
  });

  // Account current balance is already account-level; split by account's business_entity_id.
  (state.accounts || []).filter(a => a.status !== "inactive").forEach(acc => {
    const group = rowBusinessGroupV862({ business_entity_id: acc.business_entity_id, business_entity: acc.business_entity });
    const currency = acc.currency || "JPY";
    if (!groups[group].accounts[currency]) groups[group].accounts[currency] = [];
    groups[group].accounts[currency].push(acc);
  });

  return Object.values(groups).filter(group => {
    const hasMoney =
      Number(group.income.JPY || 0) || Number(group.income.CNY || 0) ||
      Number(group.expense.JPY || 0) || Number(group.expense.CNY || 0) ||
      Object.values(group.accounts).some(list => list.length);
    return hasMoney || group.key !== "other";
  });
}

function splitFinanceSummaryHtmlV862(ym, options = {}) {
  const groups = calcSplitFinanceByGroupV862(ym);
  const title = options.title || "收支分组统计";
  const showAccounts = options.showAccounts !== false;

  return `
    <section class="split-finance-summary-v862" id="${escAttr(options.id || "splitFinanceSummaryV862")}">
      <div class="section-title-row">
        <div>
          <h3>${esc(title)}</h3>
          <p class="muted-small">${esc(expenseMonthLabel(ym))}：青空塾 / 个人名义 独立显示</p>
        </div>
      </div>
      <div class="split-finance-groups-v862">
        ${groups.map(group => `
          <div class="split-finance-group-v862 ${group.key}">
            <div class="split-finance-group-title-v862">
              <span>${esc(group.label)}</span>
              ${group.key === "personal" ? `<em>后续仅最高权限可见</em>` : ""}
            </div>
            <div class="split-finance-cards-v862">
              <div class="split-finance-mini-card-v862">
                <span>本月收入</span>
                <strong>${currencyAmountTextV862(group.income)}</strong>
              </div>
              <div class="split-finance-mini-card-v862">
                <span>本月支出</span>
                <strong>${currencyAmountTextV862(group.expense)}</strong>
              </div>
              <div class="split-finance-mini-card-v862">
                <span>本月结余</span>
                <strong>${currencyAmountTextV862(group.balance)}</strong>
              </div>
            </div>
            ${showAccounts ? `
              <div class="split-account-block-v862">
                <div class="split-account-title-v862">账户余额</div>
                ${Object.keys(group.accounts).length ? Object.entries(group.accounts).map(([currency, accounts]) => `
                  <div class="split-account-currency-v862">${esc(currency)}</div>
                  ${accounts.map(acc => `
                    <div class="split-account-row-v862">
                      <span>${esc(acc.name || "")}</span>
                      <strong>${esc(currency)} ${money(acc.current_balance || 0)}</strong>
                    </div>
                  `).join("")}
                `).join("") : `<div class="split-account-empty-v862">暂无账户</div>`}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderSplitFinanceSummaryV862() {
  const ym =
    document.getElementById("financeMonthFilter")?.value ||
    document.getElementById("summaryMonthFilter")?.value ||
    document.getElementById("dashboardMonthFilter")?.value ||
    currentYearMonth();

  // Home/dashboard: replace old business split block and add split cards under the top stats.
  const dashboardPage =
    document.getElementById("page-dashboard") ||
    document.getElementById("page-home") ||
    document.querySelector("[data-page='dashboard']");

  if (dashboardPage) {
    const old = dashboardPage.querySelector("#businessSplitStatsV861");
    if (old) old.remove();

    let holder = dashboardPage.querySelector("#dashboardSplitFinanceV862");
    const html = splitFinanceSummaryHtmlV862(ym, { id: "dashboardSplitFinanceV862", title: "首页收支分组统计", showAccounts: false });

    if (holder) {
      holder.outerHTML = html;
    } else {
      const anchor =
        dashboardPage.querySelector(".stats-grid") ||
        dashboardPage.querySelector(".dashboard-grid") ||
        dashboardPage.querySelector(".cards-grid") ||
        dashboardPage.querySelector(".section-card");
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
      else dashboardPage.insertAdjacentHTML("beforeend", html);
    }
  }

  // Finance summary: remove business-entity filter UX by showing all groups split.
  const summaryPage =
    document.getElementById("page-finance-summary") ||
    document.getElementById("page-summary") ||
    document.getElementById("page-finance") ||
    document.querySelector("[data-page='finance-summary']");

  if (summaryPage) {
    const old = summaryPage.querySelector("#businessSplitStatsV861");
    if (old) old.remove();

    let holder = summaryPage.querySelector("#summarySplitFinanceV862");
    const html = splitFinanceSummaryHtmlV862(ym, { id: "summarySplitFinanceV862", title: "收支汇总分组统计", showAccounts: true });

    if (holder) {
      holder.outerHTML = html;
    } else {
      const anchor =
        summaryPage.querySelector(".stats-grid") ||
        summaryPage.querySelector(".summary-grid") ||
        summaryPage.querySelector(".cards-grid") ||
        summaryPage.querySelector(".section-card");
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
      else summaryPage.insertAdjacentHTML("beforeend", html);
    }

    // Hide business entity filter in summary page; the page now shows both groups side by side.
    summaryPage.querySelectorAll("select").forEach(select => {
      const text = select.textContent || "";
      if (text.includes("全部业务归属") || text.includes("青空") || text.includes("个人")) {
        const wrapper = select.closest(".field, .filter-item, .toolbar-control") || select;
        wrapper.classList.add("hide-business-filter-v862");
      }
    });
  }
}

const renderStatsBeforeV862 = typeof renderStats === "function" ? renderStats : null;
if (renderStatsBeforeV862) {
  renderStats = function () {
    renderStatsBeforeV862();
    renderSplitFinanceSummaryV862();
  };
}

const renderAllBeforeV862 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV862) {
  renderAll = function () {
    renderAllBeforeV862();
    renderSplitFinanceSummaryV862();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderSplitFinanceSummaryV862, 1000);
  document.addEventListener("change", (e) => {
    if (String(e.target?.id || "").includes("MonthFilter")) {
      renderSplitFinanceSummaryV862();
    }
  });
});



// === v8.6.3 split summary cleanup ===
function currencyAmountTextV863(amounts) {
  const parts = [];
  if (Number(amounts.JPY || 0) !== 0) parts.push(`JPY ${money(amounts.JPY)}`);
  if (Number(amounts.CNY || 0) !== 0) parts.push(`CNY ${money(amounts.CNY)}`);
  return parts.length ? parts.join(" / ") : "0";
}

function emptyCurrencyAmountsV863() {
  return { JPY: 0, CNY: 0 };
}

function addCurrencyAmountV863(bucket, currency, amount) {
  const cur = currency || "JPY";
  if (!Object.prototype.hasOwnProperty.call(bucket, cur)) bucket[cur] = 0;
  bucket[cur] += Number(amount || 0);
}

function rowBusinessGroupV863(row) {
  if (typeof businessEntityGroupV861 === "function") return businessEntityGroupV861(row);
  const name = row.business_entity?.name || "";
  const code = row.business_entity?.code || "";
  const text = `${name} ${code}`.toLowerCase();
  if (text.includes("个人") || text.includes("personal") || text.includes("private")) return "personal";
  if (text.includes("青空") || text.includes("aosora") || text.includes("company") || text.includes("法人")) return "aosora";
  return "other";
}

function calcSplitFinanceByGroupV863(ym) {
  const groups = {
    aosora: { key: "aosora", label: "青空塾", income: emptyCurrencyAmountsV863(), expense: emptyCurrencyAmountsV863(), balance: emptyCurrencyAmountsV863(), incomeCount: 0, expenseCount: 0, accounts: {} },
    personal: { key: "personal", label: "个人名义", income: emptyCurrencyAmountsV863(), expense: emptyCurrencyAmountsV863(), balance: emptyCurrencyAmountsV863(), incomeCount: 0, expenseCount: 0, accounts: {} },
    other: { key: "other", label: "未分类", income: emptyCurrencyAmountsV863(), expense: emptyCurrencyAmountsV863(), balance: emptyCurrencyAmountsV863(), incomeCount: 0, expenseCount: 0, accounts: {} },
  };

  (state.incomeRecords || []).filter(row => (row.year_month || "") === ym).forEach(row => {
    const group = rowBusinessGroupV863(row);
    const currency = row.currency || row.payment_currency || "JPY";
    addCurrencyAmountV863(groups[group].income, currency, row.amount);
    groups[group].incomeCount += 1;
  });

  (state.expenseRecords || []).filter(row => (row.year_month || "") === ym).forEach(row => {
    const group = rowBusinessGroupV863(row);
    const currency = row.currency || "JPY";
    addCurrencyAmountV863(groups[group].expense, currency, row.amount);
    groups[group].expenseCount += 1;
  });

  Object.values(groups).forEach(group => {
    ["JPY", "CNY"].forEach(cur => {
      group.balance[cur] = Number(group.income[cur] || 0) - Number(group.expense[cur] || 0);
    });
    group.totalCount = group.incomeCount + group.expenseCount;
  });

  (state.accounts || []).filter(a => a.status !== "inactive").forEach(acc => {
    const group = rowBusinessGroupV863({ business_entity_id: acc.business_entity_id, business_entity: acc.business_entity });
    const currency = acc.currency || "JPY";
    if (!groups[group].accounts[currency]) groups[group].accounts[currency] = [];
    groups[group].accounts[currency].push(acc);
  });

  // 不显示“未分类”空模块：只有有收入/支出/账户时才显示
  return Object.values(groups).filter(group => {
    const hasMoney =
      Number(group.income.JPY || 0) || Number(group.income.CNY || 0) ||
      Number(group.expense.JPY || 0) || Number(group.expense.CNY || 0) ||
      Object.values(group.accounts).some(list => list.length);
    if (group.key === "other") return hasMoney;
    return true;
  });
}

function splitFinanceSummaryHtmlV863(ym, options = {}) {
  const groups = calcSplitFinanceByGroupV863(ym);
  const title = options.title || "收支分组统计";
  const showAccounts = options.showAccounts !== false;

  return `
    <section class="split-finance-summary-v862" id="${escAttr(options.id || "splitFinanceSummaryV863")}">
      <div class="section-title-row">
        <div>
          <h3>${esc(title)}</h3>
          <p class="muted-small">${esc(expenseMonthLabel(ym))}：按青空塾 / 个人名义独立统计</p>
        </div>
      </div>
      <div class="split-finance-groups-v862">
        ${groups.map(group => `
          <div class="split-finance-group-v862 ${group.key}">
            <div class="split-finance-group-title-v862">
              <span>${esc(group.label)}</span>
              ${group.key === "personal" ? `<em>后续仅最高权限可见</em>` : ""}
            </div>
            <div class="split-finance-cards-v862">
              <div class="split-finance-mini-card-v862">
                <span>本月收入</span>
                <strong>${currencyAmountTextV863(group.income)}</strong>
              </div>
              <div class="split-finance-mini-card-v862">
                <span>本月支出</span>
                <strong>${currencyAmountTextV863(group.expense)}</strong>
              </div>
              <div class="split-finance-mini-card-v862">
                <span>本月结余</span>
                <strong>${currencyAmountTextV863(group.balance)}</strong>
              </div>
              <div class="split-finance-mini-card-v862 record-count">
                <span>记录数</span>
                <strong>${group.totalCount}</strong>
                <small>收入 ${group.incomeCount} / 支出 ${group.expenseCount}</small>
              </div>
            </div>
            ${showAccounts ? `
              <div class="split-account-block-v862">
                <div class="split-account-title-v862">账户余额</div>
                ${Object.keys(group.accounts).length ? Object.entries(group.accounts).map(([currency, accounts]) => `
                  <div class="split-account-currency-v862">${esc(currency)}</div>
                  ${accounts.map(acc => `
                    <div class="split-account-row-v862">
                      <span>${esc(acc.name || "")}</span>
                      <strong>${esc(currency)} ${money(acc.current_balance || 0)}</strong>
                    </div>
                  `).join("")}
                `).join("") : `<div class="split-account-empty-v862">暂无账户</div>`}
              </div>
            ` : ""}
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function hideSummaryTotalCardsV863(root) {
  if (!root) return;
  const labels = ["本月收入", "本月支出", "本月结余", "筛选收入", "筛选支出", "筛选结余", "记录数"];
  root.querySelectorAll(".stat-card, .summary-card, .metric-card, .card").forEach(card => {
    const text = card.textContent || "";
    if (labels.some(label => text.includes(label))) {
      // 只隐藏旧的汇总卡片；v8.6.3 自己的新分组卡片不隐藏
      if (!card.closest(".split-finance-summary-v862")) {
        card.classList.add("hide-total-summary-v863");
      }
    }
  });
}

function hideBusinessFiltersV863(root) {
  if (!root) return;
  root.querySelectorAll("select").forEach(select => {
    const text = select.textContent || "";
    if (text.includes("全部业务归属") || text.includes("青空") || text.includes("个人")) {
      const wrapper = select.closest(".field, .filter-item, .toolbar-control, .filter-control") || select;
      wrapper.classList.add("hide-business-filter-v862");
    }
  });
}

function renderSplitFinanceSummaryV863() {
  const ym =
    document.getElementById("financeMonthFilter")?.value ||
    document.getElementById("summaryMonthFilter")?.value ||
    document.getElementById("dashboardMonthFilter")?.value ||
    currentYearMonth();

  const dashboardPage =
    document.getElementById("page-dashboard") ||
    document.getElementById("page-home") ||
    document.querySelector("[data-page='dashboard']");

  if (dashboardPage) {
    dashboardPage.querySelector("#businessSplitStatsV861")?.remove();
    dashboardPage.querySelector("#dashboardSplitFinanceV862")?.remove();

    let holder = dashboardPage.querySelector("#dashboardSplitFinanceV863");
    const html = splitFinanceSummaryHtmlV863(ym, { id: "dashboardSplitFinanceV863", title: "首页收支分组统计", showAccounts: false });
    if (holder) {
      holder.outerHTML = html;
    } else {
      const anchor = dashboardPage.querySelector(".stats-grid, .dashboard-grid, .cards-grid, .section-card");
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
      else dashboardPage.insertAdjacentHTML("beforeend", html);
    }

    hideSummaryTotalCardsV863(dashboardPage);
  }

  const summaryPage =
    document.getElementById("page-finance-summary") ||
    document.getElementById("page-summary") ||
    document.getElementById("page-finance") ||
    document.querySelector("[data-page='finance-summary']");

  if (summaryPage) {
    summaryPage.querySelector("#businessSplitStatsV861")?.remove();
    summaryPage.querySelector("#summarySplitFinanceV862")?.remove();

    let holder = summaryPage.querySelector("#summarySplitFinanceV863");
    const html = splitFinanceSummaryHtmlV863(ym, { id: "summarySplitFinanceV863", title: "收支汇总分组统计", showAccounts: true });
    if (holder) {
      holder.outerHTML = html;
    } else {
      const anchor = summaryPage.querySelector(".stats-grid, .summary-grid, .cards-grid, .section-card");
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
      else summaryPage.insertAdjacentHTML("beforeend", html);
    }

    hideSummaryTotalCardsV863(summaryPage);
    hideBusinessFiltersV863(summaryPage);
  }
}

const renderStatsBeforeV863 = typeof renderStats === "function" ? renderStats : null;
if (renderStatsBeforeV863) {
  renderStats = function () {
    renderStatsBeforeV863();
    renderSplitFinanceSummaryV863();
  };
}

const renderAllBeforeV863 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV863) {
  renderAll = function () {
    renderAllBeforeV863();
    renderSplitFinanceSummaryV863();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(renderSplitFinanceSummaryV863, 1000);
  document.addEventListener("change", (e) => {
    if (String(e.target?.id || "").includes("MonthFilter")) {
      renderSplitFinanceSummaryV863();
    }
  });
});



// === v8.6.4 expense/reimbursement payload whitelist fix ===
const EXPENSE_ALLOWED_FIELDS_V864 = [
  "expense_date",
  "year_month",
  "business_entity_id",
  "account_id",
  "expense_category",
  "student_id",
  "description",
  "currency",
  "amount",
  "exchange_rate",
  "payment_method",
  "status",
  "is_business_expense",
  "tax_category",
  "receipt_status",
  "note",
];

const REIMBURSEMENT_ALLOWED_FIELDS_V864 = [
  "reimbursement_date",
  "year_month",
  "business_entity_id",
  "company_account_id",
  "advance_account_id",
  "currency",
  "amount",
  "status",
  "note",
];

function filterPayloadByKeysV864(payload, allowed) {
  const cleaned = {};
  allowed.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) cleaned[key] = payload[key];
  });
  return cleaned;
}

function sanitizeExpensePayloadV864(payload) {
  const cleaned = filterPayloadByKeysV864(payload, EXPENSE_ALLOWED_FIELDS_V864);
  ["business_entity_id", "student_id", "account_id"].forEach(key => {
    if (cleaned[key] === "") cleaned[key] = null;
  });
  if (cleaned.expense_date && !cleaned.year_month) {
    cleaned.year_month = String(cleaned.expense_date).slice(0, 7);
  }
  return cleaned;
}

function sanitizeReimbursementPayloadV864(payload) {
  const cleaned = filterPayloadByKeysV864(payload, REIMBURSEMENT_ALLOWED_FIELDS_V864);
  ["business_entity_id", "company_account_id", "advance_account_id"].forEach(key => {
    if (cleaned[key] === "") cleaned[key] = null;
  });
  if (cleaned.reimbursement_date && !cleaned.year_month) {
    cleaned.year_month = String(cleaned.reimbursement_date).slice(0, 7);
  }
  return cleaned;
}

const normalizePayloadBeforeV864 = typeof normalizePayload === "function" ? normalizePayload : null;
if (normalizePayloadBeforeV864) {
  normalizePayload = function (payload, type) {
    payload = normalizePayloadBeforeV864(payload, type);
    if (type === "expense") return sanitizeExpensePayloadV864(payload);
    if (type === "reimbursement") return sanitizeReimbursementPayloadV864(payload);
    return payload;
  };
}

const normalizeExpensePayloadBeforeV864 = typeof normalizeExpensePayload === "function" ? normalizeExpensePayload : null;
normalizeExpensePayload = function (payload, type) {
  if (normalizeExpensePayloadBeforeV864) payload = normalizeExpensePayloadBeforeV864(payload, type);
  return type === "expense" ? sanitizeExpensePayloadV864(payload) : payload;
};

function removeIncomeOnlyFieldsFromNonIncomeFormsV864() {
  const form = document.getElementById("modalForm");
  if (!form || !["expense", "reimbursement"].includes(state.editing?.type)) return;
  [
    "settlement_month",
    "payment_currency",
    "include_in_student_settlement",
    "include_in_studuent_settlement",
  ].forEach(name => {
    form.querySelectorAll(`[name="${name}"]`).forEach(el => el.remove());
  });
}

const buildFormBeforeV864 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV864) {
  buildForm = function (type, data = {}) {
    buildFormBeforeV864(type, data);
    if (["expense", "reimbursement"].includes(type)) removeIncomeOnlyFieldsFromNonIncomeFormsV864();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(removeIncomeOnlyFieldsFromNonIncomeFormsV864, 500);
});



// === v9.4.2 student settlement switch lock display fix ===
const SETTLEMENTS_TABLE_V87 = "school_student_monthly_settlements";
const STUDENT_CARRYOVERS_TABLE_V987 = "school_student_settlement_carryovers";

function nextMonthV987(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return "";
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentSettlementCarryoverAmountV987(studentId, month, student) {
  const cached = window.__studentSettlementCarryoverV987;
  if (cached && cached.studentId === studentId && cached.month === month) {
    return Number(cached.amount || 0);
  }
  return Number(student?.previous_balance_cny || 0);
}

function roundCnyV87(value) { return Math.round(Number(value || 0)); }
function signedCnyV87(value) {
  const n = roundCnyV87(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()} CNY`;
}
function settlementStatusLabelV87(carryover) {
  const n = roundCnyV87(carryover);
  if (n > 0) return "需补交";
  if (n < 0) return "有结余";
  return "已结清";
}
function settlementStatusClassV87(carryover) {
  const n = roundCnyV87(carryover);
  if (n > 0) return "due";
  if (n < 0) return "credit";
  return "clear";
}
function selectedSettlementContextV87() {
  const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  const student = (state.students || []).find(x => x.id === studentId);
  return { month, studentId, student };
}
function sumLessonsForSettlementV87(studentId, month, type) {
  return (state.lessonRecords || [])
    .filter(x => x.student_id === studentId && x.year_month === month && x.lesson_type === type && x.is_billable !== false && (type === "planned" || (x.status !== "cancelled" && x.status !== "holiday")))
    .reduce((sum, x) => sum + Number(x.lesson_fee || (Number(x.unit_price || 0) * Number(x.duration_hours || 0)) || 0), 0);
}
function sumIncomeForSettlementV87(studentId, month, currency) {
  const sumFunc = typeof sumIncomeV86 === "function" ? sumIncomeV86 : (typeof sumIncomeV83 === "function" ? sumIncomeV83 : null);
  if (sumFunc) return sumFunc(studentId, month, currency);
  return (state.incomeRecords || [])
    .filter(x => x.student_id === studentId && (x.settlement_month || x.year_month) === month && x.income_category === "tuition" && x.status === "received" && (x.payment_currency || x.currency || "CNY") === currency && x.include_in_student_settlement !== false)
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}
function computeSettlementSnapshotV87(adjustment = 0, reason = "") {
  const { month, studentId, student } = selectedSettlementContextV87();
  if (!studentId || !student) return null;

  const dbSummary = window.__studentSettlementSummaryDbV989;
  const useDbSummary = dbSummary && dbSummary.studentId === studentId && dbSummary.month === month;

  const rate = useDbSummary ? Number(dbSummary.rate || 0) : Number(student.preset_exchange_rate || 0);
  const previousBalanceCny = useDbSummary ? Number(dbSummary.carryoverCny || 0) : currentSettlementCarryoverAmountV987(studentId, month, student);
  const plannedJpy = useDbSummary ? Number(dbSummary.plannedFeeJpy || 0) : sumLessonsForSettlementV87(studentId, month, "planned");
  const actualJpy = useDbSummary ? Number(dbSummary.actualFeeJpy || 0) : sumLessonsForSettlementV87(studentId, month, "actual");
  const plannedCny = useDbSummary ? Number(dbSummary.plannedFeeCny || 0) : plannedJpy * rate;
  const actualCny = useDbSummary ? Number(dbSummary.actualFeeCny || 0) : actualJpy * rate;
  const receivedJpy = useDbSummary ? Number(dbSummary.receivedJpy || 0) : sumIncomeForSettlementV87(studentId, month, "JPY");
  const receivedCny = useDbSummary ? Number(dbSummary.receivedCny || 0) : sumIncomeForSettlementV87(studentId, month, "CNY");
  const receivedEquivalentCny = useDbSummary ? Number(dbSummary.receivedEquivalentCny || 0) : receivedCny + receivedJpy * rate;
  const systemDifferenceCny = useDbSummary ? Number(dbSummary.finalDueCny || 0) : actualCny + previousBalanceCny - receivedEquivalentCny;
  const carryoverAmountCny = systemDifferenceCny + Number(adjustment || 0);

  return {
    student, student_id: studentId, year_month: month,
    business_entity_id: student.business_entity_id || null,
    preset_exchange_rate: rate,
    planned_lesson_fee_jpy: plannedJpy,
    planned_lesson_fee_cny: plannedCny,
    actual_lesson_fee_jpy: actualJpy,
    actual_lesson_fee_cny: actualCny,
    previous_balance_cny: previousBalanceCny,
    received_jpy: receivedJpy,
    received_cny: receivedCny,
    received_equivalent_cny: receivedEquivalentCny,
    system_difference_cny: systemDifferenceCny,
    adjustment_amount_cny: Number(adjustment || 0),
    adjustment_reason: reason || "",
    carryover_amount_cny: carryoverAmountCny,
    settlement_status: "locked",
    locked_at: new Date().toISOString()
  };
}
function adjustmentFromPanelV87() {
  const mode = document.getElementById("settlementAdjustModeV87")?.value || "carry";
  const base = computeSettlementSnapshotV87(0, "");
  if (!base) return { adjustment: 0, reason: "" };
  if (mode === "clear") return { adjustment: -roundCnyV87(base.system_difference_cny), reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "汇率差额/尾差抹平" };
  if (mode === "custom") return { adjustment: Number(document.getElementById("settlementAdjustmentAmountV87")?.value || 0), reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "手动调整" };
  return { adjustment: 0, reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "" };
}
// === v8.7.1 fixes: db client, stable actual link, import batch undo ===
function dbClientV871() {
  return (typeof db !== "undefined" && db?.from) ? db : ((typeof supabase !== "undefined" && supabase?.from) ? supabase : null);
}

async function upsertStudentCarryoverV987(client, snapshot, settlementId = null) {
  if (!client || !snapshot) return;
  const toMonth = nextMonthV987(snapshot.year_month);
  if (!toMonth) return;

  const payload = {
    student_id: snapshot.student_id,
    from_year_month: snapshot.year_month,
    to_year_month: toMonth,
    amount_cny: Number(snapshot.carryover_amount_cny || 0),
    source_settlement_id: settlementId || null,
    source_settlement_month: snapshot.year_month,
    status: "active",
    note: snapshot.adjustment_reason || "",
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from(STUDENT_CARRYOVERS_TABLE_V987)
    .upsert(payload, { onConflict: "student_id,from_year_month,to_year_month" });

  if (error) throw error;
}

async function voidStudentCarryoverV987(client, lock) {
  if (!client || !lock) return;
  const toMonth = nextMonthV987(lock.year_month);
  if (!toMonth) return;

  const { error } = await client
    .from(STUDENT_CARRYOVERS_TABLE_V987)
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
      note: "来源学生月度结算已撤销",
    })
    .eq("student_id", lock.student_id)
    .eq("from_year_month", lock.year_month)
    .eq("to_year_month", toMonth);

  if (error) throw error;
  if (window.__studentSettlementCarryoverV987 &&
    window.__studentSettlementCarryoverV987.month === toMonth &&
    window.__studentSettlementCarryoverV987.studentId === lock.student_id) {
    window.__studentSettlementCarryoverV987 = null;
  }
}

// Add import fields into lesson whitelist if previous code has whitelist sanitizer.
const normalizePayloadBeforeImportBatchV871 = typeof normalizePayload === "function" ? normalizePayload : null;
if (normalizePayloadBeforeImportBatchV871) {
  normalizePayload = function (payload, type) {
    payload = normalizePayloadBeforeImportBatchV871(payload, type);
    return payload;
  };
}

// === v8.7.5 RLS role hint ===
function settlementRlsHelpV875(message) {
  const text = String(message || "");
  if (!/row-level security|RLS|policy/i.test(text)) return message;
  return `${message}\n\n当前系统可能使用的是 anon role。请执行 school_v8_7_5_rls_anon_fix.sql 后刷新页面再试。`;
}


// === v8.8.5 lesson status options + completed import business rules ===
// 课时状态统一：已上课 / 待补课 / 已补课
function lessonStatusOptionsV885() {
  return [
    { value: "completed", label: "已上课" },
    { value: "pending_makeup", label: "待补课" },
    { value: "makeup_completed", label: "已补课" },
  ];
}

function lessonStatusLabelV885(status) {
  const map = {
    completed: "已上课",
    pending_makeup: "待补课",
    makeup_completed: "已补课",
    planned: "预定",
    cancelled: "取消",
  };
  return map[status] || status || "";
}

function normalizeLessonStatusTextV885(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/待补|未补/.test(text)) return "pending_makeup";
  if (/已补|補完|补课完成/.test(text)) return "makeup_completed";
  if (/已上|上课|已上课|済|completed/.test(text)) return "completed";
  return "";
}

// Override existing status options where possible.
if (typeof lessonStatusOptions === "function") {
  lessonStatusOptions = lessonStatusOptionsV885;
}

if (typeof lessonStatusLabel === "function") {
  lessonStatusLabel = function (status) {
    return lessonStatusLabelV885(status);
  };
}

// === v8.8.7 lesson time display / actual minutes / stats cleanup ===
function parseClockMinutesV887(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const m = text.match(/(\d{1,2})[:：](\d{1,2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function minutesBetweenV887(start, end) {
  const s = parseClockMinutesV887(start);
  const e = parseClockMinutesV887(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff > 0 ? diff : null;
}

function hoursFromMinutesExactV887(minutes) {
  if (!minutes) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

function floorHoursBy15MinV887(totalMinutes) {
  if (!totalMinutes) return 0;
  return Math.floor(totalMinutes / 15) * 0.25;
}

// Used later by teacher wage module: group by teacher + subject + year_month.
function summarizeTeacherSubjectMinutesV887(rows) {
  const map = new Map();
  (rows || []).filter(x => x.lesson_type === "actual").forEach(row => {
    const key = [row.teacher_id || "", row.subject_id || "", row.year_month || ""].join("|");
    const minutes = Number(row.actual_minutes || minutesBetweenV887(row.start_time, row.end_time) || 0);
    if (!map.has(key)) {
      map.set(key, {
        teacher_id: row.teacher_id || "",
        subject_id: row.subject_id || "",
        year_month: row.year_month || "",
        total_minutes: 0,
        rounded_hours: 0,
      });
    }
    map.get(key).total_minutes += minutes;
  });
  map.forEach(value => {
    value.rounded_hours = floorHoursBy15MinV887(value.total_minutes);
  });
  return Array.from(map.values());
}

// === v8.8.8 Excel time parse/display fix ===
function excelTimeToHHMMV888(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    if (value >= 0 && value < 1) {
      const total = Math.round(value * 24 * 60);
      return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }
    return "";
  }
  const text = String(value).trim();
  if (!text) return "";
  const dateLike = text.match(/(?:Sat Dec 30 1899\s+)?(\d{1,2}):(\d{2}):?\d{0,2}/);
  if (dateLike) return `${String(Number(dateLike[1])).padStart(2, "0")}:${dateLike[2]}`;
  const m = text.match(/(\d{1,2})[:：](\d{1,2})/);
  if (m) return `${String(Number(m[1])).padStart(2, "0")}:${String(Number(m[2])).padStart(2, "0")}`;
  return "";
}

function parseTimeRangeSmartV888(value) {
  if (value instanceof Date || typeof value === "number") return { start: excelTimeToHHMMV888(value), end: "" };
  const text = String(value || "").trim();
  if (!text) return { start: "", end: "" };
  const m = text.match(/(.+?)\s*[-~〜～]\s*(.+)/);
  if (!m) return { start: excelTimeToHHMMV888(text), end: "" };
  return { start: excelTimeToHHMMV888(m[1]), end: excelTimeToHHMMV888(m[2]) };
}

timeRange88 = parseTimeRangeSmartV888;

function cleanTimeForDisplayV888(value) {
  return excelTimeToHHMMV888(value) || "";
}

async function repairLessonTimeStringsV888() {
  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const targets = (state.lessonRecords || []).filter(row =>
    /1899|GMT|日本標準時/.test(String(row.start_time || "")) ||
    /1899|GMT|日本標準時/.test(String(row.end_time || ""))
  );
  for (const row of targets) {
    const start = cleanTimeForDisplayV888(row.start_time);
    const end = cleanTimeForDisplayV888(row.end_time);
    const minutes = minutesBetweenV887(start, end);
    await client.from(tables.lessons).update({
      start_time: start || null,
      end_time: end || null,
      actual_minutes: row.lesson_type === "actual" ? minutes : null,
      duration_hours: row.lesson_type === "actual" && minutes ? hoursFromMinutesExactV887(minutes) : row.duration_hours,
      lesson_fee: row.lesson_type === "actual" && minutes ? Math.round(Number(row.unit_price || 0) * hoursFromMinutesExactV887(minutes)) : row.lesson_fee,
    }).eq("id", row.id);
  }
  await loadAll();
  renderAll();
  showMessage(`已修复 ${targets.length} 条课时时间。`, "ok");
}



// === v8.8.9 settlement makeup lesson logic ===
// 月度结算要和课时管理保持同一套状态逻辑：
// 已上课(completed) / 已补课(makeup_completed) 计入实际课时；
// 待补课(pending_makeup) 不生成/不计入实际课时。
// 同时用 year_month 作为结算归属月份，因此跨月补课也能算回预定月份。

function isActualBillableSettlementStatusV889(row) {
  if (!row || row.lesson_type !== "actual") return false;
  const status = String(row.status || "").trim();
  return (
    status === "completed" ||
    status === "makeup_completed" ||
    status === "makeup" ||
    status === "已上课" ||
    status === "已补课" ||
    status === "已上" ||
    status === "已补"
  );
}

function settlementLessonsForMonthV889(studentId, month) {
  return (state.lessonRecords || []).filter(x =>
    x.student_id === studentId &&
    x.year_month === month &&
    x.is_billable !== false
  );
}

function settlementPlannedLessonsV889(studentId, month) {
  return settlementLessonsForMonthV889(studentId, month).filter(x => x.lesson_type === "planned");
}

function settlementActualLessonsV889(studentId, month) {
  return settlementLessonsForMonthV889(studentId, month).filter(isActualBillableSettlementStatusV889);
}

function lessonFeeForSettlementV889(row) {
  return Number(row?.lesson_fee || (Number(row?.unit_price || 0) * Number(row?.duration_hours || 0)) || 0);
}

function sumLessonFeeForSettlementV889(rows) {
  return (rows || []).reduce((sum, row) => sum + lessonFeeForSettlementV889(row), 0);
}

// Patch lock/preview calculation.
sumLessonsForSettlementV87 = function (studentId, month, type) {
  const rows = type === "planned"
    ? settlementPlannedLessonsV889(studentId, month)
    : settlementActualLessonsV889(studentId, month);
  return sumLessonFeeForSettlementV889(rows);
};

function debugSettlementLessonsV889(studentId, month) {
  const planned = settlementPlannedLessonsV889(studentId, month);
  const actual = settlementActualLessonsV889(studentId, month);
  console.log("settlement planned", planned);
  console.log("settlement actual", actual);
  console.log("planned fee", sumLessonFeeForSettlementV889(planned), "actual fee", sumLessonFeeForSettlementV889(actual));
  return { planned, actual };
}



// === v8.8.10 lesson billing/status + tuition income validation + settlement reason fix ===

// 1) 课时状态增加“取消课”
function lessonStatusOptionsV8810() {
  return [
    { value: "completed", label: "已上课" },
    { value: "pending_makeup", label: "待补课" },
    { value: "makeup_completed", label: "已补课" },
    { value: "cancelled", label: "取消课" },
  ];
}

function lessonStatusLabelV8810(status) {
  const map = {
    completed: "已上课",
    pending_makeup: "待补课",
    makeup_completed: "已补课",
    cancelled: "取消课",
    planned: "预定",
    makeup: "已补课",
  };
  return map[status] || status || "";
}

function normalizeLessonStatusTextV8810(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/取消|请假|休|放假|不上|不补/.test(text)) return "cancelled";
  if (/待补|未补/.test(text)) return "pending_makeup";
  if (/已补|補完|补课完成/.test(text)) return "makeup_completed";
  if (/已上|上课|已上课|済|completed/.test(text)) return "completed";
  return "";
}

lessonStatusOptions = lessonStatusOptionsV8810;
lessonStatusLabel = lessonStatusLabelV8810;
normalizeLessonStatusTextV885 = normalizeLessonStatusTextV8810;

function parseBillableTextV8810(value, defaultValue = true) {
  const text = String(value ?? "").trim();
  if (!text) return defaultValue;
  if (/^(否|不|不要|不计费|免費|免费|no|false|0)$/i.test(text)) return false;
  if (/^(是|要|计费|收費|收费|yes|true|1)$/i.test(text)) return true;
  return defaultValue;
}

function defaultBillableByStatusV8810(status) {
  if (status === "makeup_completed") return false;
  if (status === "cancelled") return false;
  return true; // 已上课、待补课默认计费
}

// 4) 收入分类为学费时，必须指定学生
const saveFormBeforeV8810 = typeof saveForm === "function" ? saveForm : null;
if (saveFormBeforeV8810) {
  saveForm = async function (e) {
    const form = document.getElementById("modalForm");
    const type = state.editing?.type;
    if (form && type === "income") {
      const category = form.querySelector('[name="income_category"]')?.value || "";
      const studentId = form.querySelector('[name="student_id"]')?.value || "";
      if (category === "tuition" && !studentId) {
        showMessage("收入分类为学费时，必须指定学生。", "error");
        return;
      }
    }
    return saveFormBeforeV8810(e);
  };
}

const adjustmentFromPanelBeforeV8810 = typeof adjustmentFromPanelV87 === "function" ? adjustmentFromPanelV87 : null;
if (adjustmentFromPanelBeforeV8810) {
  adjustmentFromPanelV87 = function () {
    const result = adjustmentFromPanelBeforeV8810();
    const reasonInput = document.getElementById("settlementAdjustmentReasonV87");
    if (reasonInput) {
      result.reason = reasonInput.value || "";
    }
    return result;
  };
}

document.addEventListener("input", (e) => {
  if (e.target?.id === "settlementAdjustmentReasonV87") {
    e.target.dataset.userEditedV8810 = "true";
  }
});

// === v8.8.11 income tuition student validation fix ===
// v8.8.10 只在 saveForm 外层拦截，但部分版本的保存按钮/submit 流程没有进入该分支，
// 导致未选学生时没有保存、同时页面回到首页。本版在 submit/click/saveForm 三层都拦截。

function incomeCategoryIsTuitionV8811(value) {
  const text = String(value || "").trim();
  return (
    text === "tuition" ||
    text === "学费" ||
    text === "授業料" ||
    /学费|授業料|tuition/i.test(text)
  );
}

function currentModalTypeV8811() {
  return state?.editing?.type || document.getElementById("modalForm")?.dataset?.type || "";
}

function validateIncomeTuitionStudentV8811({ show = true } = {}) {
  const form = document.getElementById("modalForm");
  const type = currentModalTypeV8811();
  if (!form || type !== "income") return true;

  const category =
    form.querySelector('[name="income_category"]')?.value ||
    form.querySelector('[name="category"]')?.value ||
    form.querySelector('[name="income_type"]')?.value ||
    "";

  const studentId =
    form.querySelector('[name="student_id"]')?.value ||
    form.querySelector('[name="student"]')?.value ||
    "";

  if (incomeCategoryIsTuitionV8811(category) && !studentId) {
    if (show) {
      showMessage("收入分类为学费时，必须指定学生。", "error");
      const select = form.querySelector('[name="student_id"], [name="student"]');
      if (select) {
        select.focus();
        select.classList.add("input-error-v8811");
        setTimeout(() => select.classList.remove("input-error-v8811"), 1800);
      }
    }
    return false;
  }

  return true;
}

function bindIncomeTuitionValidationV8811() {
  const form = document.getElementById("modalForm");
  if (!form || form.dataset.incomeValidationBoundV8811 === "true") return;
  form.dataset.incomeValidationBoundV8811 = "true";

  // 标记 form 类型，避免 state.editing 在某些 submit 路径中被重置后判断不到。
  if (state?.editing?.type) form.dataset.type = state.editing.type;

  form.addEventListener("submit", (e) => {
    if (!validateIncomeTuitionStudentV8811()) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);
}

const saveFormBeforeV8811 = typeof saveForm === "function" ? saveForm : null;
if (saveFormBeforeV8811) {
  saveForm = async function (...args) {
    if (!validateIncomeTuitionStudentV8811()) return;
    if (!args.length || !args[0]) args = [{ preventDefault() { }, stopPropagation() { }, stopImmediatePropagation() { }, target: document.getElementById("modalForm") }];
    return saveFormBeforeV8811.apply(this, args);
  };
}

// 兜底：保存按钮 click 阶段提前拦截，防止原生 submit 或旧 onclick 导航。
document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("#saveModalBtn, [data-save-modal], button[type='submit']");
  if (!btn) return;

  const form = document.getElementById("modalForm");
  if (!form || currentModalTypeV8811() !== "income") return;

  if (!validateIncomeTuitionStudentV8811()) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    return false;
  }
}, true);

const openCreateModalBeforeV8811 = typeof openCreateModal === "function" ? openCreateModal : null;
if (openCreateModalBeforeV8811) {
  openCreateModal = function (type, prefill = {}) {
    openCreateModalBeforeV8811(type, prefill);
    const form = document.getElementById("modalForm");
    if (form) form.dataset.type = type;
    if (type === "income") setTimeout(bindIncomeTuitionValidationV8811, 0);
  };
}

const openEditModalBeforeV8811 = typeof openEditModal === "function" ? openEditModal : null;
if (openEditModalBeforeV8811) {
  openEditModal = function (type, id) {
    openEditModalBeforeV8811(type, id);
    const form = document.getElementById("modalForm");
    if (form) form.dataset.type = type;
    if (type === "income") setTimeout(bindIncomeTuitionValidationV8811, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindIncomeTuitionValidationV8811, 1000);
});
