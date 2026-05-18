
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
      <td>${esc(item.target_type || "")}</td>
      <td>${esc(item.wechat || "")}</td>
      <td>${esc(item.parent_name || "")}</td>
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


function updateLessonFilters() {
  const studentEl = document.getElementById("lessonStudentFilter");
  const teacherEl = document.getElementById("lessonTeacherFilter");
  const subjectEl = document.getElementById("lessonSubjectFilter");

  if (studentEl) {
    const old = studentEl.value;
    studentEl.innerHTML = `<option value="">全部学生</option>` + state.students.map(x => `<option value="${escAttr(x.id)}">${esc(x.display_name || x.name)}</option>`).join("");
    studentEl.value = old;
  }

  if (teacherEl) {
    const old = teacherEl.value;
    teacherEl.innerHTML = `<option value="">全部老师</option>` + state.teachers.map(x => `<option value="${escAttr(x.id)}">${esc(x.display_name || x.name)}</option>`).join("");
    teacherEl.value = old;
  }

  if (subjectEl) {
    const old = subjectEl.value;
    subjectEl.innerHTML = `<option value="">全部科目</option>` + state.subjects.map(x => `<option value="${escAttr(x.id)}">${esc(x.name)}</option>`).join("");
    subjectEl.value = old;
  }
}

function filterLessons() {
  const month = document.getElementById("lessonMonthFilter")?.value || "";
  const student = document.getElementById("lessonStudentFilter")?.value || "";
  const teacher = document.getElementById("lessonTeacherFilter")?.value || "";
  const subject = document.getElementById("lessonSubjectFilter")?.value || "";
  const type = document.getElementById("lessonTypeFilter")?.value || "";
  const status = document.getElementById("lessonStatusFilter")?.value || "";

  return (state.lessonRecords || []).filter(x =>
    (!month || x.year_month === month) &&
    (!student || x.student_id === student) &&
    (!teacher || x.teacher_id === teacher) &&
    (!subject || x.subject_id === subject) &&
    (!type || x.lesson_type === type) &&
    (!status || x.status === status)
  );
}

function renderLessonStats(rows) {
  const plannedHours = rows
    .filter(x => x.lesson_type === "planned")
    .reduce((sum, x) => sum + Number(x.duration_hours || 0), 0);
  const actualHours = rows
    .filter(x => x.lesson_type === "actual" && x.status !== "cancelled" && x.status !== "holiday")
    .reduce((sum, x) => sum + Number(x.duration_hours || 0), 0);
  const completedCount = rows.filter(x => x.status === "completed").length;
  const cancelledCount = rows.filter(x => x.status === "cancelled" || x.status === "holiday").length;

  setOptionalText("lessonPlannedHours", money(plannedHours));
  setOptionalText("lessonActualHours", money(actualHours));
  setOptionalText("lessonCompletedCount", completedCount);
  setOptionalText("lessonCancelledCount", cancelledCount);
  setOptionalText("lessonRecordCount", rows.length);
}

function renderLessons() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice().sort((a, b) => {
    const da = String(a.lesson_date || "");
    const db = String(b.lesson_date || "");
    if (da !== db) return db.localeCompare(da);
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  });

  renderLessonStats(rows);

  let lastMonth = "";
  const html = [];

  rows.forEach(item => {
    const ym = item.year_month || "未归属月份";
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="12">${esc(expenseMonthLabel(ym))}</td></tr>`);
    }

    const timeText = [item.start_time, item.end_time].filter(Boolean).join(" - ");
    html.push(`
      <tr>
        <td>${esc(displayRecordDate(item.lesson_date || item.created_at))}</td>
        <td>${esc(item.year_month || "")}</td>
        <td>${esc(lessonTypeLabel(item.lesson_type))}</td>
        <td>${esc(item.student?.display_name || item.student?.name || "")}</td>
        <td>${esc(item.teacher?.display_name || item.teacher?.name || "")}</td>
        <td>${esc(item.subject?.name || "")}</td>
        <td>${esc(timeText)}</td>
        <td>${money(item.duration_hours)}</td>
        <td>${badge(lessonStatusLabel(item.status), item.status === "cancelled" || item.status === "holiday" ? "red" : "")}</td>
        <td>${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
        <td>${esc(short(item.lesson_content || item.note, 24))}</td>
        <td>${actionButtons("lesson", item.id)}</td>
      </tr>
    `);
  });

  tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
}

function bindLessonFilters() {
  ["lessonMonthFilter", "lessonStudentFilter", "lessonTeacherFilter", "lessonSubjectFilter", "lessonTypeFilter", "lessonStatusFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el || el.dataset.boundLesson === "true") return;
    el.dataset.boundLesson = "true";
    el.addEventListener("change", renderLessons);
  });

  const clearBtn = document.getElementById("lessonClearFilter");
  if (clearBtn && clearBtn.dataset.boundLesson !== "true") {
    clearBtn.dataset.boundLesson = "true";
    clearBtn.addEventListener("click", () => {
      document.getElementById("lessonMonthFilter").value = "";
      document.getElementById("lessonStudentFilter").value = "";
      document.getElementById("lessonTeacherFilter").value = "";
      document.getElementById("lessonSubjectFilter").value = "";
      document.getElementById("lessonTypeFilter").value = "";
      document.getElementById("lessonStatusFilter").value = "";
      renderLessons();
    });
  }
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
    updateLessonFilters?.();
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
        .filter(x => x.account_id === account.id && x.status === "received")
        .reduce((sum, x) => sum + Number(x.amount || 0), 0);

      const expenseTotal = (state.expenseRecords || [])
        .filter(x => x.account_id === account.id && (x.status === "paid" || x.status === "reimbursed"))
        .reduce((sum, x) => sum + Number(x.amount || 0), 0);

      const nextBalance = Number(account.opening_balance || 0) + incomeTotal - expenseTotal;

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

  document.querySelectorAll("[data-open-modal]").forEach(btn => {
    btn.addEventListener("click", () => openCreateModal(btn.dataset.openModal));
  });

  document.getElementById("closeModalBtn").addEventListener("click", closeModal);
  document.getElementById("modalBackdrop").addEventListener("click", closeModal);

  document.getElementById("exportBackupBtn")?.addEventListener("click", exportBackup);
  document.getElementById("recalcAccountBalancesBtn")?.addEventListener("click", () => { if (typeof recalcAccountBalances === "function") recalcAccountBalances(); });
  document.getElementById("recalcAccountBalancesBtnFinance")?.addEventListener("click", () => { if (typeof recalcAccountBalances === "function") recalcAccountBalances(); });
  bindExpensePdfImport();
  bindFinanceFilters();
  bindLessonFilters();
  bindReimbursementActions();

  document.body.addEventListener("click", async (e) => {
    const editBtn = e.target.closest("[data-edit]");
    const deleteBtn = e.target.closest("[data-delete]");
    if (editBtn) openEditModal(editBtn.dataset.type, editBtn.dataset.edit);
    if (deleteBtn) await deleteRecord(deleteBtn.dataset.type, deleteBtn.dataset.delete);
  });
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
  document.getElementById("reimburseSelectedBtn")?.addEventListener("click", createReimbursementFromSelectedExpenses);
  bindPendingReimbursementSelectionControls();
  ["reimbursementMonthFilter", "reimbursementEntityFilter", "reimbursementStatusFilter", "reimbursementAccountFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderReimbursements);
  });
  document.getElementById("reimbursementClearFilter")?.addEventListener("click", () => {
    document.getElementById("reimbursementMonthFilter").value = "";
    document.getElementById("reimbursementEntityFilter").value = "";
    document.getElementById("reimbursementStatusFilter").value = "";
    document.getElementById("reimbursementAccountFilter").value = "";
    renderReimbursements();
  });
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
  document.getElementById("modalTitle").textContent = modalTitle(type, false);
  document.getElementById("modal").classList.remove("hidden");
}

function openEditModal(type, id) {
  state.editing = { type, id };
  buildForm(type, findLocal(type, id));
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
    { name: "entity_type", label: "类型", type: "select", default: "company", options: [
      { value: "company", label: "公司" },
      { value: "personal", label: "个人" },
      { value: "other", label: "其他" },
    ]},
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
    { name: "target_type", label: "学习目标" },
    { name: "wechat", label: "微信" },
    { name: "phone", label: "电话" },
    { name: "parent_name", label: "家长姓名" },
    { name: "parent_wechat", label: "家长微信" },
    { name: "entrance_date", label: "入塾日期", type: "date" },
    { name: "status", label: "状态", type: "select", default: "active", options: statusOptions() },
    { name: "target_schools", label: "志望校/目标", type: "textarea", full: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "lesson") return [
    { name: "lesson_type", label: "课时类型", type: "select", default: "actual", options: lessonTypeOptions(), required: true },
    { name: "lesson_date", label: "上课日期", type: "date", default: todayStr(), required: true },
    { name: "year_month", label: "归属月份", type: "month", default: currentYearMonth(), required: true },
    { name: "student_id", label: "学生", type: "select", options: studentOptions(), required: true },
    { name: "teacher_id", label: "老师", type: "select", options: teacherOptions(), required: true },
    { name: "subject_id", label: "科目", type: "select", options: lessonSubjectOptions(), required: true },
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "start_time", label: "开始时间", type: "time" },
    { name: "end_time", label: "结束时间", type: "time" },
    { name: "duration_hours", label: "时长（H）", type: "number", default: 2, required: true },
    { name: "status", label: "状态", type: "select", default: "completed", options: lessonStatusOptions() },
    { name: "is_billable", label: "计费", type: "checkbox", default: true },
    { name: "lesson_content", label: "上课内容", type: "textarea", full: true },
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
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "入账账户", type: "select", options: accountOptions(), required: true },
    { name: "income_category", label: "收入分类", type: "select", default: "tuition", options: incomeCategoryOptions() },
    { name: "student_id", label: "学生", type: "select", options: studentOptions(), className: "tuition-student-row" },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "CNY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: 0, required: true },
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
    { name: "amount", label: "金额", type: "number", default: 0, required: true },
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
    { name: "amount", label: "报销金额", type: "number", default: 0, required: true },
    { name: "status", label: "状态", type: "select", default: "paid", options: reimbursementStatusOptions() },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "account") return [
    { name: "name", label: "账户名称", required: true },
    { name: "account_code", label: "账户代码" },
    { name: "account_type", label: "账户类型", type: "select", default: "bank", options: [
      { value: "bank", label: "银行" },
      { value: "cash", label: "现金" },
    { value: "card", label: "信用卡" },
      { value: "wechat", label: "微信" },
      { value: "alipay", label: "支付宝" },
      { value: "paypay", label: "PayPay" },
      { value: "other", label: "其他" },
    ]},
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
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "支付账户", type: "select", options: accountOptions(), required: true },
    { name: "expense_category", label: "支出分类", type: "select", default: "other", options: expenseCategoryOptions() },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "JPY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: 0, required: true },
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
    { name: "business_entity_id", label: "业务归属", type: "select", options: businessOptions, required: true },
    { name: "account_id", label: "入账账户", type: "select", options: accountOptions(), required: true },
    { name: "income_category", label: "收入分类", type: "select", default: "tuition", options: incomeCategoryOptions() },
    { name: "student_id", label: "学生", type: "select", options: studentOptions(), className: "tuition-student-row" },
    { name: "description", label: "说明", full: true },
    { name: "currency", label: "币种", type: "select", default: "CNY", options: currencyOptions() },
    { name: "amount", label: "金额", type: "number", default: 0, required: true },
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


function findMatchingPlannedLesson(payload) {
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

function normalizeLessonPayload(payload, type) {
  if (type !== "lesson") return payload;

  if (payload.lesson_date && !payload.year_month) {
    payload.year_month = String(payload.lesson_date).slice(0, 7);
  }

  if (payload.lesson_type === "planned") {
    payload.planned_lesson_id = null;
    return payload;
  }

  if (payload.planned_lesson_id === "") {
    payload.planned_lesson_id = null;
  }

  if (payload.lesson_type === "actual" && !payload.planned_lesson_id && state.pendingActualPlanId) {
    payload.planned_lesson_id = state.pendingActualPlanId;
  }

  if (payload.lesson_type === "actual" && !payload.planned_lesson_id) {
    const matched = findMatchingPlannedLesson(payload);
    if (matched) payload.planned_lesson_id = matched.id;
  }

  return payload;
}


async function repairLessonPlannedLinkAfterSave(type, payload, saved) {
  if (type !== "lesson") return;
  if (payload.lesson_type !== "actual") return;
  if (!payload.planned_lesson_id) return;
  if (!saved?.id) return;

  // Ensure the relation is definitely written even if insert payload was affected by older form handling.
  if (saved.planned_lesson_id !== payload.planned_lesson_id) {
    const { error } = await db
      .from(tables.lessons)
      .update({ planned_lesson_id: payload.planned_lesson_id })
      .eq("id", saved.id);

    if (error) {
      console.warn("Failed to repair planned_lesson_id", error);
    }
  }
}

async function saveForm(e) {
  e.preventDefault();
  const form = e.target;
  if (!state.editing) return;

  const type = state.editing.type;
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
      state.isSavingForm = false;
      if (typeof form !== "undefined" && form) form.dataset.saving = "false";
      if (typeof submitButton !== "undefined" && submitButton) submitButton.disabled = false;
      return;
    }
  }

  normalizeLessonPayload(payload, type);

  const table = tableForType(type);
  const oldRecord = state.editing.id ? findLocal(type, state.editing.id) : null;
  let result;
  if (state.editing.id) {
    result = await db.from(table).update(payload).eq("id", state.editing.id).select().single();
  } else {
    result = await db.from(table).insert(payload).select().single();
  }

  if (result.error) {
    state.isSavingForm = false;
    if (typeof form !== "undefined" && form) form.dataset.saving = "false";
    if (typeof submitButton !== "undefined" && submitButton) submitButton.disabled = false;
    showMessage(result.error.message, "error");
    return;
  }

  await repairLessonPlannedLinkAfterSave(type, payload, result.data);

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
  state.isSavingForm = false;
  if (typeof form !== "undefined" && form) form.dataset.saving = "false";
  if (typeof submitButton !== "undefined" && submitButton) submitButton.disabled = false;
  state.pendingActualPlanId = null;
  showMessage("保存成功。", "ok");
}

async function deleteRecord(type, id) {
  const item = findLocal(type, id);
  if (!confirm(`确定删除「${item?.name || item?.title || "这条记录"}」吗？`)) return;

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
    showMessage(error.message, "error");
    return;
  }

  await loadAll();
  setDefaultExpenseMonthFilter();
  renderAll();
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
      <td>${reimbursementStatusBadge(item.status)}</td>
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
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
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

renderStats = function() {
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

renderFinanceSummary = function() {
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

updateFinanceFilters = function() {
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

filterFinanceRows = function(rows, scope) {
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
renderAll = function() {
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


// === v5.9 hard override: lesson planned/actual paired view ===
function lessonPairDateText(item) {
  return esc(displayRecordDate(item?.lesson_date || item?.created_at || ""));
}

function lessonPairTimeText(item) {
  return esc([item?.start_time, item?.end_time].filter(Boolean).join(" - "));
}

function lessonPairStudentText(item) {
  return esc(item?.student?.display_name || item?.student?.name || "");
}

function lessonPairTeacherText(item) {
  return esc(item?.teacher?.display_name || item?.teacher?.name || "");
}

function lessonPairSubjectText(item) {
  return esc(item?.subject?.name || "");
}

function lessonPairStatus(item) {
  const danger = item?.status === "cancelled" || item?.status === "holiday";
  return `${badge(lessonStatusLabel(item?.status), danger ? "red" : "")}<br>${item?.is_billable ? badge("计费") : badge("不计费", "gray")}`;
}

function lessonPairActions(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  return `
    <div class="table-actions lesson-actions">
      ${actualButton}
      <button class="secondary-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCells(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  return `
    <td>
      ${lessonPairDateText(item)}<br>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td>${lessonPairStudentText(item)}</td>
    <td>${lessonPairTeacherText(item)}</td>
    <td>
      ${lessonPairSubjectText(item)}<br>
      <span class="muted-small">${lessonPairTimeText(item)} / ${money(item.duration_hours)}H</span>
    </td>
    <td>${lessonPairStatus(item)}</td>
    <td>
      ${esc(short(item.lesson_content || item.note, 18))}
      ${lessonPairActions(item)}
    </td>
  `;
}

function makeActualFromPlanned(id) {
  const plan = state.lessonRecords.find(x => x.id === id);
  if (!plan) return;

  const prefill = {
    lesson_type: "actual",
    planned_lesson_id: plan.id,
    lesson_date: plan.lesson_date || todayStr(),
    year_month: plan.year_month || currentYearMonth(),
    student_id: plan.student_id || "",
    teacher_id: plan.teacher_id || "",
    subject_id: plan.subject_id || "",
    business_entity_id: plan.business_entity_id || "",
    start_time: plan.start_time || "",
    end_time: plan.end_time || "",
    duration_hours: plan.duration_hours || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: plan.lesson_content || "",
    note: plan.note || "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  // Some older form builders may drop hidden/unknown fields, so force the relation value into the form.
  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  document.getElementById("modalTitle").textContent = "从预定生成实际课时";
}

function copyLessonRecordV59(id) {
  const item = state.lessonRecords.find(x => x.id === id);
  if (!item) return;

  const prefill = {
    lesson_type: item.lesson_type || "actual",
    planned_lesson_id: item.lesson_type === "actual" ? (item.planned_lesson_id || "") : "",
    lesson_date: item.lesson_date || todayStr(),
    year_month: item.year_month || currentYearMonth(),
    student_id: item.student_id || "",
    teacher_id: item.teacher_id || "",
    subject_id: item.subject_id || "",
    business_entity_id: item.business_entity_id || "",
    start_time: item.start_time || "",
    end_time: item.end_time || "",
    duration_hours: item.duration_hours || 0,
    status: item.status || (item.lesson_type === "planned" ? "planned" : "completed"),
    is_billable: item.is_billable !== false,
    lesson_content: item.lesson_content || "",
    note: item.note || "",
  };

  openCreateModal("lesson", prefill);
  document.getElementById("modalTitle").textContent = "复制课时";
}

function bindLessonPairButtonsV59() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlanned(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

renderLessons = function() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice().sort((a, b) => {
    const ma = String(b.year_month || "").localeCompare(String(a.year_month || ""));
    if (ma !== 0) return ma;
    const da = String(b.lesson_date || "").localeCompare(String(a.lesson_date || ""));
    if (da !== 0) return da;
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  });

  renderLessonStats(rows);

  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual");
  const actualByPlan = new Map();
  const unlinkedActual = [];

  actualRows.forEach(actual => {
    let planId = actual.planned_lesson_id;

    if (!planId) {
      const matched = findMatchingPlannedLesson(actual);
      if (matched) planId = matched.id;
    }

    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(actual);
    } else {
      unlinkedActual.push(actual);
    }
  });

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="12">${esc(expenseMonthLabel(ym))}</td></tr>`);
    }
  }

  plannedRows.forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = actualByPlan.get(plan.id) || [];

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row">${lessonPairCells(plan, "planned")}${lessonPairCells(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCells(plan, "planned")
          : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row">${left}${lessonPairCells(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row">${lessonPairCells(null, "planned")}${lessonPairCells(actual, "actual")}</tr>`);
  });

  tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonPairButtonsV59();
};
