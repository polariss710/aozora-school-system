
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


function updateLessonFilters() {
  const month = document.getElementById("lessonMonthFilter")?.value || "";
  const studentEl = document.getElementById("lessonStudentFilter");
  const teacherEl = document.getElementById("lessonTeacherFilter");
  const subjectEl = document.getElementById("lessonSubjectFilter");

  const monthLessons = month
    ? (state.lessonRecords || []).filter(x => x.year_month === month)
    : (state.lessonRecords || []);

  const studentIds = new Set(monthLessons.filter(x => x.student_id).map(x => x.student_id));
  const teacherIds = new Set(monthLessons.filter(x => x.teacher_id).map(x => x.teacher_id));
  const subjectIds = new Set(monthLessons.filter(x => x.subject_id).map(x => x.subject_id));

  if (studentEl) {
    const old = studentEl.value;
    const students = (state.students || [])
      .filter(x => !month || studentIds.has(x.id))
      .sort((a, b) => (a.display_name || a.name || "").localeCompare((b.display_name || b.name || ""), "zh-Hans-CN"));

    studentEl.innerHTML = `<option value="">${month && !students.length ? "该月无课时学生" : "全部学生"}</option>` +
      students.map(x => `<option value="${escAttr(x.id)}">${esc(x.display_name || x.name)}</option>`).join("");
    studentEl.value = students.some(x => x.id === old) ? old : "";
  }

  if (teacherEl) {
    const old = teacherEl.value;
    const teachers = (state.teachers || [])
      .filter(x => !month || teacherIds.has(x.id))
      .sort((a, b) => (a.display_name || a.name || "").localeCompare((b.display_name || b.name || ""), "zh-Hans-CN"));

    teacherEl.innerHTML = `<option value="">${month && !teachers.length ? "该月无课时老师" : "全部老师"}</option>` +
      teachers.map(x => `<option value="${escAttr(x.id)}">${esc(x.display_name || x.name)}</option>`).join("");
    teacherEl.value = teachers.some(x => x.id === old) ? old : "";
  }

  if (subjectEl) {
    const old = subjectEl.value;
    const subjects = (state.subjects || [])
      .filter(x => !month || subjectIds.has(x.id))
      .sort((a, b) => (a.name || "").localeCompare((b.name || ""), "zh-Hans-CN"));

    subjectEl.innerHTML = `<option value="">${month && !subjects.length ? "该月无课时科目" : "全部科目"}</option>` +
      subjects.map(x => `<option value="${escAttr(x.id)}">${esc(x.name)}</option>`).join("");
    subjectEl.value = subjects.some(x => x.id === old) ? old : "";
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


function formatCurrencyTotal(value, currency = "JPY") {
  const n = Number(value || 0);
  return `${n.toLocaleString()} ${currency}`;
}

function renderLessonStats(rows) {
  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual" && x.status !== "cancelled" && x.status !== "holiday");
  const plannedHours = plannedRows.reduce((sum, x) => sum + Number(x.duration_hours || 0), 0);
  const actualHours = actualRows.reduce((sum, x) => sum + Number(x.duration_hours || 0), 0);

  const plannedFee = plannedRows
    .filter(x => x.is_billable !== false)
    .reduce((sum, x) => sum + Number(x.lesson_fee || (Number(x.unit_price || 0) * Number(x.duration_hours || 0)) || 0), 0);

  const actualFee = actualRows
    .filter(x => x.is_billable !== false)
    .reduce((sum, x) => sum + Number(x.lesson_fee || (Number(x.unit_price || 0) * Number(x.duration_hours || 0)) || 0), 0);

  const completedCount = rows.filter(x => x.status === "completed").length;
  const cancelledCount = rows.filter(x => x.status === "cancelled" || x.status === "holiday").length;

  setOptionalText("lessonPlannedHours", money(plannedHours));
  setOptionalText("lessonActualHours", money(actualHours));
  setOptionalText("lessonPlannedFeeTotal", formatCurrencyTotal(plannedFee, "JPY"));
  setOptionalText("lessonActualFeeTotal", formatCurrencyTotal(actualFee, "JPY"));
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

  if (document.body.dataset.boundTableActionsV72 !== "true") {
    document.body.dataset.boundTableActionsV72 = "true";
    document.body.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit][data-type]");
      const deleteBtn = e.target.closest("[data-delete][data-type]");

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
    { name: "unit_price", label: "课程单价", type: "number", default: "" },
    { name: "lesson_fee", label: "应收课时费", type: "number", default: "" },
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

async function schoolStableRepairLessonPairV70(type, payload, saved) {
  if (type !== "lesson" || payload.lesson_type !== "actual" || !saved?.id) return;

  let planId = payload.planned_lesson_id || state.pendingActualPlanId || null;
  if (!planId) {
    const matched = schoolStableFindMatchingPlannedLessonV70(payload);
    if (matched) planId = matched.id;
  }

  if (planId && saved.planned_lesson_id !== planId) {
    const { error } = await db.from(tables.lessons).update({ planned_lesson_id: planId }).eq("id", saved.id);
    if (error) console.warn("v7.0 lesson pair repair failed", error);
  }
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
  e = e || { preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}, target: document.getElementById("modalForm") };
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

  normalizeLessonPayload(payload, type);


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

  await repairLessonPlannedLinkAfterSave(type, payload, result.data);

  await schoolStableRepairLessonPairV70(type, payload, result.data);

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
      <span class="muted-small">${lessonPairTimeText(item)} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0), "JPY")}</span>
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


// === v7.0 stable page switch override ===
switchPage = function(page) {
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

  if (page === "lessons") {
    if (typeof updateLessonFilters === "function") updateLessonFilters();
    if (typeof renderLessons === "function") renderLessons();
  }
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




// === v7.3 lesson Excel import/export ===
function lessonExcelRequireXLSX() {
  if (typeof XLSX === "undefined") {
    showMessage("Excel 功能库尚未加载，请刷新页面后再试。", "error");
    return false;
  }
  return true;
}

function parseLessonExcelWeekStart(value, baseYear) {
  if (value === null || value === undefined || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return mondayOfDate(value);
  }

  if (typeof value === "number") {
    // Excel serial date
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      return mondayOfDate(new Date(parsed.y, parsed.m - 1, parsed.d));
    }
  }

  const text = String(value).trim();
  const md = text.match(/(\d{1,2})\s*[\.\/月-]\s*(\d{1,2})/);
  if (md) {
    const date = new Date(Number(baseYear), Number(md[1]) - 1, Number(md[2]));
    return mondayOfDate(date);
  }

  const ymd = text.match(/(\d{4})\s*[\/-]\s*(\d{1,2})\s*[\/-]\s*(\d{1,2})/);
  if (ymd) {
    const date = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return mondayOfDate(date);
  }

  return null;
}

function mondayOfDate(date) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 Sun, 1 Mon
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function formatDateYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function weekLabelFromDate(date) {
  return `${date.getMonth() + 1}.${date.getDate()}周`;
}


function teacherIdFromExcelName(name) {
  const text = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!text) return "";

  const matched = (state.teachers || []).find(t => {
    const name1 = String(t.name || "").replace(/\s+/g, "").toLowerCase();
    const name2 = String(t.display_name || "").replace(/\s+/g, "").toLowerCase();
    return (name1 && (name1.includes(text) || text.includes(name1))) ||
           (name2 && (name2.includes(text) || text.includes(name2)));
  });

  return matched?.id || "";
}

function numericExcelValue(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function subjectIdFromExcelName(name) {
  const text = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!text) return "";

  const matched = (state.subjects || []).find(s => {
    const subject = String(s.name || "").replace(/\s+/g, "").toLowerCase();
    return subject && (subject.includes(text) || text.includes(subject));
  });

  return matched?.id || "";
}

function findLessonImportHeaderRow(rows) {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r].map(x => String(x || "").trim());
    const joined = row.join("|");
    if (joined.includes("科目") && joined.includes("日期") && (joined.includes("时长") || joined.includes("時間") || joined.includes("H"))) {
      return r;
    }
  }
  return -1;
}

function buildLessonImportColumnMap(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const text = String(cell || "").trim();
    if (!text) return;

    if (text.includes("担当") || text.includes("老师") || text.includes("教師") || text.includes("讲师")) map.teacher = idx;
    if (text.includes("科目")) map.subject = idx;
    if (text.includes("日期")) map.date = idx;
    if (text.includes("回数")) map.count = idx;
    if (text.includes("内容")) map.content = idx;
    if (text.includes("時長") || text.includes("时长") || text === "H" || text.includes("時間")) map.duration = idx;
    if (text.includes("课程单价") || text.includes("単価") || text.includes("单价")) map.unitPrice = idx;
    if (text.includes("应收课时费") || text.includes("應收課時費") || text.includes("课时费") || text.includes("授業料")) map.lessonFee = idx;
    if (text.includes("教室")) map.roomFee = idx;
    if (text.includes("开始") || text.includes("開始")) map.start = idx;
    if (text.includes("结束") || text.includes("終了")) map.end = idx;
  });
  return map;
}

function selectedLessonImportContext() {
  const month = document.getElementById("lessonMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  const teacherId = document.getElementById("lessonTeacherFilter")?.value || "";
  const subjectId = document.getElementById("lessonSubjectFilter")?.value || "";

  return {
    month,
    baseYear: Number(String(month).slice(0, 4)) || new Date().getFullYear(),
    studentId,
    teacherId,
    subjectId,
  };
}

async function importLessonExcelFile(file) {
  if (!lessonExcelRequireXLSX()) return;

  const ctx = selectedLessonImportContext();
  if (!ctx.studentId) {
    showMessage("导入前请先在课时管理筛选中选择学生。", "error");
    return;
  }

  const businessEntityId = state.students.find(x => x.id === ctx.studentId)?.business_entity_id || state.businessEntities[0]?.id || "";
  const fallbackTeacherId = ctx.teacherId || "";
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const headerIndex = findLessonImportHeaderRow(rows);
  if (headerIndex < 0) {
    showMessage("没有找到包含「科目 / 日期 / 时长」的预定课时表头。", "error");
    return;
  }

  const col = buildLessonImportColumnMap(rows[headerIndex]);
  const records = [];
  let currentTeacherText = "";
  let currentSubjectText = "";
  let skipped = 0;

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const lineText = row.map(x => String(x || "").trim()).join("");
    if (!lineText) continue;
    if (/合计|小计|總計|总计/.test(lineText)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";

    // Merged cells appear as blank in following rows, so forward-fill teacher and subject.
    if (teacherCell) currentTeacherText = teacherCell;
    if (subjectCell) currentSubjectText = subjectCell;

    const dateValue = col.date !== undefined ? row[col.date] : "";
    const durationRaw = col.duration !== undefined ? row[col.duration] : "";
    const weekStart = parseLessonExcelWeekStart(dateValue, ctx.baseYear);
    const duration = numericExcelValue(durationRaw);

    if (!weekStart || !duration) {
      skipped++;
      continue;
    }

    const subjectId = subjectIdFromExcelName(currentSubjectText) || ctx.subjectId;
    const teacherId = teacherIdFromExcelName(currentTeacherText) || fallbackTeacherId;

    if (!subjectId) {
      console.warn("Subject not matched, skipped row", row);
      skipped++;
      continue;
    }

    if (!teacherId) {
      console.warn("Teacher not matched and no fallback teacher, skipped row", row);
      skipped++;
      continue;
    }

    const unitPrice = col.unitPrice !== undefined ? numericExcelValue(row[col.unitPrice]) : 0;
    const lessonFee = col.lessonFee !== undefined ? numericExcelValue(row[col.lessonFee]) : (unitPrice && duration ? unitPrice * duration : 0);
    const yearMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    records.push({
      lesson_type: "planned",
      lesson_date: formatDateYmd(weekStart),
      year_month: yearMonth,
      student_id: ctx.studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId || null,
      start_time: col.start !== undefined ? String(row[col.start] || "") : "",
      end_time: col.end !== undefined ? String(row[col.end] || "") : "",
      duration_hours: duration,
      unit_price: unitPrice || 0,
      lesson_fee: lessonFee || 0,
      lesson_content: col.content !== undefined ? String(row[col.content] || "") : "",
      status: "planned",
      is_billable: true,
      note: `Excel导入：${sheetName} / ${weekLabelFromDate(weekStart)}${col.count !== undefined && row[col.count] ? " / 回数:" + row[col.count] : ""}`,
    });
  }

  if (!records.length) {
    showMessage("没有读取到可导入的课时记录。请确认已选择学生，且模板中有日期、时长、科目和担当老师。", "error");
    return;
  }

  const totalFee = records.reduce((sum, x) => sum + Number(x.lesson_fee || 0), 0);
  const ok = confirm(`将导入 ${records.length} 条预定课时。\n预定课时费合计：${totalFee.toLocaleString()} JPY\n跳过行数：${skipped}\n归属月份按周一所在月份计算。\n是否继续？`);
  if (!ok) return;

  const { error } = await db.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  await loadAll();
  renderAll();
  showMessage(`已导入 ${records.length} 条预定课时。`, "ok");
}

function exportCurrentLessonsExcel() {
  if (!lessonExcelRequireXLSX()) return;

  const rows = typeof filterLessons === "function" ? filterLessons() : (state.lessonRecords || []);
  if (!rows.length) {
    showMessage("当前筛选条件下没有可导出的课时记录。", "error");
    return;
  }

  const data = rows
    .slice()
    .sort((a, b) => {
      const d = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
      if (d !== 0) return d;
      return String(a.start_time || "").localeCompare(String(b.start_time || ""));
    })
    .map(item => {
      const date = item.lesson_date ? new Date(item.lesson_date + "T00:00:00") : null;
      const weekStart = date ? mondayOfDate(date) : null;
      return {
        "类型": lessonTypeLabel(item.lesson_type),
        "关联预定ID": item.planned_lesson_id || "",
        "日期": item.lesson_date || "",
        "周表示": weekStart ? weekLabelFromDate(weekStart) : "",
        "归属月份": item.year_month || "",
        "学生": item.student?.display_name || item.student?.name || "",
        "老师": item.teacher?.display_name || item.teacher?.name || "",
        "科目": item.subject?.name || "",
        "开始": item.start_time || "",
        "结束": item.end_time || "",
        "时长H": Number(item.duration_hours || 0),
        "课程单价": Number(item.unit_price || 0),
        "应收课时费": Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0),
        "状态": lessonStatusLabel(item.status),
        "计费": item.is_billable ? "是" : "否",
        "内容": item.lesson_content || "",
        "备注": item.note || "",
      };
    });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "课时记录");

  const month = document.getElementById("lessonMonthFilter")?.value || "all";
  const studentText = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || "all";
  const safeStudent = studentText.replace(/[\\/:*?"<>|]/g, "_").slice(0, 20);
  XLSX.writeFile(workbook, `课时记录_${safeStudent}_${month}.xlsx`);
}

function bindLessonExcelActions() {
  const importBtn = document.getElementById("lessonImportExcelBtn");
  const importInput = document.getElementById("lessonImportExcelInput");
  const exportBtn = document.getElementById("lessonExportExcelBtn");

  if (importBtn && importBtn.dataset.boundExcelV73 !== "true") {
    importBtn.dataset.boundExcelV73 = "true";
    importBtn.onclick = () => {
      const month = document.getElementById("lessonMonthFilter")?.value || "";
      if (!month) {
        showMessage("请先在课时管理筛选中选择月份，再导入 Excel。", "error");
        return;
      }
      importInput?.click();
    };
  }

  if (importInput && importInput.dataset.boundExcelV73 !== "true") {
    importInput.dataset.boundExcelV73 = "true";
    importInput.onchange = async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      await importLessonExcelFile(file);
      importInput.value = "";
    };
  }

  if (exportBtn && exportBtn.dataset.boundExcelV73 !== "true") {
    exportBtn.dataset.boundExcelV73 = "true";
    exportBtn.onclick = exportCurrentLessonsExcel;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindLessonExcelActions, 500);
});

const renderAllBeforeLessonExcelV73 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeLessonExcelV73) {
  renderAll = function() {
    renderAllBeforeLessonExcelV73();
    bindLessonExcelActions();
  };
}




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
  renderReimbursements = function() {
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



// === v7.6 lesson Excel import robustness + selected delete ===
function normalizeLessonMatchTextV76(value) {
  return String(value || "")
    .replace(/\s+/g, "")
    .replace(/[・･／/\\_\-—–.,，。()（）]/g, "")
    .replace(/ｅｊｕ/gi, "eju")
    .toLowerCase();
}

function normalizeLessonSubjectAliasV76(value) {
  let text = normalizeLessonMatchTextV76(value);
  text = text.replace(/^eju/, "");
  text = text.replace(/留考/g, "");
  text = text.replace(/日語|日语|日本语/g, "日本語");
  text = text.replace(/数学|數学|理科数学|文科数学/g, "数学");
  text = text.replace(/物理/g, "物理");
  text = text.replace(/化学|化學/g, "化学");
  text = text.replace(/生物/g, "生物");
  text = text.replace(/総合科目|综合科目|文综|文綜/g, "総合科目");
  return text;
}

function teacherIdFromExcelNameV76(name) {
  const text = normalizeLessonMatchTextV76(name);
  if (!text) return "";
  const matched = (state.teachers || []).find(t => {
    const name1 = normalizeLessonMatchTextV76(t.name);
    const name2 = normalizeLessonMatchTextV76(t.display_name);
    return (name1 && (name1.includes(text) || text.includes(name1))) ||
           (name2 && (name2.includes(text) || text.includes(name2)));
  });
  return matched?.id || "";
}

function subjectIdFromExcelNameV76(name) {
  const raw = normalizeLessonMatchTextV76(name);
  const alias = normalizeLessonSubjectAliasV76(name);
  if (!raw && !alias) return "";
  const matched = (state.subjects || []).find(s => {
    const sRaw = normalizeLessonMatchTextV76(s.name);
    const sAlias = normalizeLessonSubjectAliasV76(s.name);
    return (sRaw && (sRaw.includes(raw) || raw.includes(sRaw))) ||
           (sAlias && (sAlias.includes(alias) || alias.includes(sAlias)));
  });
  return matched?.id || "";
}

function numericExcelValueV76(value) {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function buildLessonImportColumnMapV76(headerRow) {
  const map = {};
  headerRow.forEach((cell, idx) => {
    const text = String(cell || "").trim();
    if (!text) return;
    if (text.includes("担当") || text.includes("老师") || text.includes("教師") || text.includes("讲师")) map.teacher = idx;
    if (text.includes("科目")) map.subject = idx;
    if (text.includes("日期")) map.date = idx;
    if (text.includes("回数")) map.count = idx;
    if (text.includes("内容")) map.content = idx;
    if (text.includes("時長") || text.includes("时长") || text === "H" || text.includes("時間")) map.duration = idx;
    if (text.includes("课程单价") || text.includes("単価") || text.includes("单价")) map.unitPrice = idx;
    if (text.includes("应收课时费") || text.includes("應收課時費") || text.includes("课时费") || text.includes("授業料")) map.lessonFee = idx;
    if (text.includes("开始") || text.includes("開始")) map.start = idx;
    if (text.includes("结束") || text.includes("終了")) map.end = idx;
  });
  return map;
}

async function importLessonExcelFileV76(file) {
  if (!lessonExcelRequireXLSX()) return;
  const ctx = selectedLessonImportContext();
  if (!ctx.studentId) {
    showMessage("导入前请先在课时管理筛选中选择学生。", "error");
    return;
  }

  const businessEntityId = state.students.find(x => x.id === ctx.studentId)?.business_entity_id || state.businessEntities[0]?.id || "";
  const fallbackTeacherId = ctx.teacherId || "";
  const fallbackSubjectId = ctx.subjectId || "";
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });
  const headerIndex = findLessonImportHeaderRow(rows);
  if (headerIndex < 0) {
    showMessage("没有找到包含「科目 / 日期 / 时长」的预定课时表头。", "error");
    return;
  }

  const col = buildLessonImportColumnMapV76(rows[headerIndex]);
  const records = [];
  const warnings = [];
  let currentTeacherText = "";
  let currentSubjectText = "";

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const lineText = row.map(x => String(x || "").trim()).join("");
    if (!lineText) continue;
    if (/合计|小计|總計|总计/.test(lineText)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) currentTeacherText = teacherCell;
    if (subjectCell) currentSubjectText = subjectCell;

    const weekStart = parseLessonExcelWeekStart(col.date !== undefined ? row[col.date] : "", ctx.baseYear);
    const duration = numericExcelValueV76(col.duration !== undefined ? row[col.duration] : "");
    if (!weekStart || !duration) {
      warnings.push(`第 ${r + 1} 行跳过：日期或时长为空`);
      continue;
    }

    const subjectId = subjectIdFromExcelNameV76(currentSubjectText) || fallbackSubjectId || null;
    const teacherId = teacherIdFromExcelNameV76(currentTeacherText) || fallbackTeacherId || null;
    if (!subjectId) warnings.push(`第 ${r + 1} 行：科目「${currentSubjectText || "空"}」未匹配，已作为空科目导入`);
    if (!teacherId) warnings.push(`第 ${r + 1} 行：担当老师「${currentTeacherText || "空"}」未匹配，已作为空老师导入`);

    const unitPrice = col.unitPrice !== undefined ? numericExcelValueV76(row[col.unitPrice]) : 0;
    const lessonFee = col.lessonFee !== undefined ? numericExcelValueV76(row[col.lessonFee]) : (unitPrice && duration ? unitPrice * duration : 0);
    const yearMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    records.push({
      lesson_type: "planned",
      lesson_date: formatDateYmd(weekStart),
      year_month: yearMonth,
      student_id: ctx.studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId || null,
      start_time: col.start !== undefined ? String(row[col.start] || "") : "",
      end_time: col.end !== undefined ? String(row[col.end] || "") : "",
      duration_hours: duration,
      unit_price: unitPrice || 0,
      lesson_fee: lessonFee || 0,
      lesson_content: col.content !== undefined ? String(row[col.content] || "") : "",
      status: "planned",
      is_billable: true,
      note: `Excel导入：${sheetName} / ${weekLabelFromDate(weekStart)}${col.count !== undefined && row[col.count] ? " / 回数:" + row[col.count] : ""}${!subjectId && currentSubjectText ? " / 原科目:" + currentSubjectText : ""}${!teacherId && currentTeacherText ? " / 原担当:" + currentTeacherText : ""}`,
    });
  }

  if (!records.length) {
    showMessage("没有读取到可导入的课时记录。请确认模板中有日期和时长。", "error");
    return;
  }

  const totalFee = records.reduce((sum, x) => sum + Number(x.lesson_fee || 0), 0);
  const warningText = warnings.length ? `\n注意：${warnings.slice(0, 5).join(" / ")}${warnings.length > 5 ? " ..." : ""}` : "";
  const ok = confirm(`将导入 ${records.length} 条预定课时。\n预定课时费合计：${totalFee.toLocaleString()} JPY\n归属月份按周一所在月份计算。${warningText}\n是否继续？`);
  if (!ok) return;

  const { error } = await db.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }
  await loadAll();
  renderAll();
  showMessage(`已导入 ${records.length} 条预定课时。${warnings.length ? " 有部分老师/科目未匹配，请查看备注。" : ""}`, "ok");
}

importLessonExcelFile = importLessonExcelFileV76;

function lessonSelectCheckboxV76(item) {
  if (!item) return "";
  return `<label class="lesson-select-box"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /> 勾选</label>`;
}

const lessonPairActionsBeforeV76 = typeof lessonPairActions === "function" ? lessonPairActions : null;
if (lessonPairActionsBeforeV76) {
  lessonPairActions = function(item) {
    if (!item) return "";
    return `${lessonSelectCheckboxV76(item)}${lessonPairActionsBeforeV76(item)}`;
  };
}

function selectedLessonIdsV76() {
  return [...document.querySelectorAll(".lesson-delete-check:checked")].map(x => x.value);
}

function clearSelectedLessonsV76() {
  document.querySelectorAll(".lesson-delete-check").forEach(x => x.checked = false);
}

async function deleteSelectedLessonsV76() {
  const ids = selectedLessonIdsV76();
  if (!ids.length) {
    showMessage("请先勾选要删除的课时。", "error");
    return;
  }
  const ok = confirm(`确定删除已勾选的 ${ids.length} 条课时记录吗？`);
  if (!ok) return;

  const { error } = await db.from(tables.lessons).delete().in("id", ids);
  if (error) {
    showMessage(`删除失败：${error.message}`, "error");
    return;
  }
  await loadAll();
  renderAll();
  showMessage(`已删除 ${ids.length} 条课时记录。`, "ok");
}

function bindLessonDeleteSelectedV76() {
  const deleteBtn = document.getElementById("lessonDeleteSelectedBtn");
  const clearBtn = document.getElementById("lessonClearSelectionBtn");
  if (deleteBtn && deleteBtn.dataset.boundV76 !== "true") {
    deleteBtn.dataset.boundV76 = "true";
    deleteBtn.onclick = deleteSelectedLessonsV76;
  }
  if (clearBtn && clearBtn.dataset.boundV76 !== "true") {
    clearBtn.dataset.boundV76 = "true";
    clearBtn.onclick = clearSelectedLessonsV76;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindLessonDeleteSelectedV76, 500);
});

const renderAllBeforeV76 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV76) {
  renderAll = function() {
    renderAllBeforeV76();
    bindLessonDeleteSelectedV76();
  };
}




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

function selectAllLessonsV77() {
  document.querySelectorAll(".lesson-delete-check").forEach(x => {
    x.checked = true;
  });
}

const bindLessonDeleteSelectedBeforeV77 = typeof bindLessonDeleteSelectedV76 === "function" ? bindLessonDeleteSelectedV76 : null;
function bindLessonSelectAllV77() {
  if (bindLessonDeleteSelectedBeforeV77) bindLessonDeleteSelectedBeforeV77();

  const selectAllBtn = document.getElementById("lessonSelectAllBtn");
  if (selectAllBtn && selectAllBtn.dataset.boundV77 !== "true") {
    selectAllBtn.dataset.boundV77 = "true";
    selectAllBtn.onclick = selectAllLessonsV77;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindLessonSelectAllV77, 500);
});

// Override lesson renderer to use template-like ascending order.
// This keeps the existing v5.9 paired layout, but changes ordering to:
// 月份升序 → 周一日期升序 → 老师 → 科目 → 开始时间
const renderLessonsBeforeV77 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV77) {
  renderLessons = function() {
    const tbody = document.getElementById("lessonsTable");
    if (!tbody) return;

    updateLessonFilters();
    const rows = filterLessons().slice().sort(compareLessonsV77);

    renderLessonStats(rows);

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

      if (!planId && typeof findMatchingPlannedLesson === "function") {
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

    for (const list of actualByPlan.values()) {
      list.sort(compareLessonsV77);
    }

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

    unlinkedActual.sort(compareLessonsV77).forEach(actual => {
      const ym = actual.year_month || "未归属月份";
      addMonthRow(ym);
      html.push(`<tr class="lesson-pair-row">${lessonPairCells(null, "planned")}${lessonPairCells(actual, "actual")}</tr>`);
    });

    tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

    if (typeof bindLessonPairButtonsV59 === "function") bindLessonPairButtonsV59();
    if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
  };
}

const renderAllBeforeV77 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV77) {
  renderAll = function() {
    renderAllBeforeV77();
    bindLessonSelectAllV77();
  };
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

// Re-render lesson list with v7.8 order while keeping the paired planned/actual view.
const renderLessonsBeforeV78 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV78) {
  renderLessons = function() {
    const tbody = document.getElementById("lessonsTable");
    if (!tbody) return;

    updateLessonFilters();
    const rows = filterLessons().slice().sort(compareLessonsV78);

    renderLessonStats(rows);

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

      if (!planId && typeof findMatchingPlannedLesson === "function") {
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

    for (const list of actualByPlan.values()) {
      list.sort(compareLessonsV78);
    }

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

    unlinkedActual.sort(compareLessonsV78).forEach(actual => {
      const ym = actual.year_month || "未归属月份";
      addMonthRow(ym);
      html.push(`<tr class="lesson-pair-row">${lessonPairCells(null, "planned")}${lessonPairCells(actual, "actual")}</tr>`);
    });

    tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

    if (typeof bindLessonPairButtonsV59 === "function") bindLessonPairButtonsV59();
    if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
  };
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

function bindLessonExcelActionsV79() {
  setupDropUploadZoneV79(
    "lessonExcelDropZone",
    "lessonImportExcelInput",
    async (file) => {
      const studentId = document.getElementById("lessonStudentFilter")?.value || "";
      if (!studentId) {
        showMessage("请先在课时管理筛选中选择学生，再导入 Excel。", "error");
        return;
      }
      await importLessonExcelFile(file);
    },
    {
      acceptRegex: /\.(xlsx|xls)$/i,
      acceptTypeRegex: /(spreadsheet|excel|sheet)/i,
      rejectMessage: "暂时只支持 .xlsx / .xls 文件。",
    }
  );

  const exportBtn = document.getElementById("lessonExportExcelBtn");
  if (exportBtn && exportBtn.dataset.boundExportV79 !== "true") {
    exportBtn.dataset.boundExportV79 = "true";
    exportBtn.onclick = exportCurrentLessonsExcel;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindExpensePdfImportV79();
    bindLessonExcelActionsV79();
  }, 500);
});

const renderAllBeforeV79 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV79) {
  renderAll = function() {
    renderAllBeforeV79();
    bindExpensePdfImportV79();
    bindLessonExcelActionsV79();
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
  lessonTeacherOrderV77 = function(item) {
    const orderMap = window.lessonTeacherOrderMapV80;
    if (orderMap && item?.teacher_id && orderMap.has(item.teacher_id)) {
      const name = item?.teacher?.display_name || item?.teacher?.name || "";
      return `${String(orderMap.get(item.teacher_id)).padStart(6, "0")}_${name}`;
    }
    return lessonTeacherOrderBeforeV80(item);
  };
}

const renderLessonsBeforeV80 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV80) {
  renderLessons = function() {
    try {
      const rows = typeof filterLessons === "function" ? filterLessons() : (state.lessonRecords || []);
      window.lessonTeacherOrderMapV80 = buildLessonTeacherOrderMapV80(rows);
    } catch (error) {
      console.warn("teacher order map failed", error);
    }
    renderLessonsBeforeV80();
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

  const lessonBtn = document.getElementById("lessonImportExcelBtn");
  const lessonInput = document.getElementById("lessonImportExcelInput");
  if (lessonBtn && lessonInput && lessonBtn.dataset.boundDialogV80 !== "true") {
    lessonBtn.dataset.boundDialogV80 = "true";
    lessonBtn.onclick = () => {
      const studentId = document.getElementById("lessonStudentFilter")?.value || "";
      if (!studentId) {
        showMessage("请先在课时管理筛选中选择学生，再导入 Excel。", "error");
        return;
      }

      openUploadDialogV80({
        title: "导入课时 Excel",
        hint: "将 Excel 文件拖入这里",
        acceptText: "支持 .xlsx / .xls。也可以点击按钮选择文件。",
        input: lessonInput,
        onFile: async file => {
          if (!/\.(xlsx|xls)$/i.test(file.name)) {
            showMessage("暂时只支持 .xlsx / .xls 文件。", "error");
            return;
          }
          await importLessonExcelFile(file);
        },
      });
    };

    lessonInput.onchange = async () => {
      const file = lessonInput.files && lessonInput.files[0];
      lessonInput.value = "";
      if (!file) return;
      await importLessonExcelFile(file);
      closeUploadDialogV80();
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindUploadDialogButtonsV80, 600);
});

const renderAllBeforeV80Upload = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV80Upload) {
  renderAll = function() {
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

  const lessonBtn = document.getElementById("lessonImportExcelBtn");
  const lessonInput = document.getElementById("lessonImportExcelInput");
  if (lessonBtn && lessonInput) {
    lessonBtn.onclick = () => {
      const studentId = document.getElementById("lessonStudentFilter")?.value || "";
      if (!studentId) {
        showMessage("请先在课时管理筛选中选择学生，再导入 Excel。", "error");
        return;
      }

      openUploadDialogV81({
        title: "导入课时 Excel",
        hint: "将 Excel 文件拖入这里",
        acceptText: "支持 .xlsx / .xls。点击下方按钮选择文件。",
        input: lessonInput,
        onFile: async file => {
          if (!/\.(xlsx|xls)$/i.test(file.name)) {
            showMessage("暂时只支持 .xlsx / .xls 文件。", "error");
            return;
          }
          await importLessonExcelFile(file);
        },
      });
    };

    lessonInput.onchange = async () => {
      const file = lessonInput.files && lessonInput.files[0];
      lessonInput.value = "";
      if (!file) return;
      await importLessonExcelFile(file);
      closeUploadDialogV80();
    };
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindUploadDialogButtonsV81, 700);
});

const renderAllBeforeV81 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV81) {
  renderAll = function() {
    renderAllBeforeV81();
    bindUploadDialogButtonsV81();
  };
}




// === v8.2 lesson import dialog + student required final override ===
function updateLessonStudentRequiredStateV82() {
  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  const addBtn = document.getElementById("lessonAddBtn");
  const importBtn = document.getElementById("lessonImportExcelBtn");
  const hint = document.getElementById("lessonStudentRequiredHint");

  const disabled = !studentId;
  if (addBtn) {
    addBtn.disabled = disabled;
    addBtn.title = disabled ? "请先选择学生" : "";
  }
  if (importBtn) {
    importBtn.disabled = disabled;
    importBtn.title = disabled ? "请先选择学生" : "";
  }
  if (hint) {
    hint.classList.toggle("ok", !disabled);
    hint.textContent = disabled ? "学生必选" : "已选择学生";
  }
}

function bindLessonStudentRequiredV82() {
  const studentFilter = document.getElementById("lessonStudentFilter");
  if (studentFilter && studentFilter.dataset.boundRequiredV82 !== "true") {
    studentFilter.dataset.boundRequiredV82 = "true";
    studentFilter.addEventListener("change", updateLessonStudentRequiredStateV82);
  }
  updateLessonStudentRequiredStateV82();
}

function openLessonExcelUploadDialogV82() {
  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先在课时管理筛选中选择学生。", "error");
    updateLessonStudentRequiredStateV82();
    return;
  }

  const lessonInput = document.getElementById("lessonImportExcelInput");
  if (!lessonInput) return;

  const opener = typeof openUploadDialogV81 === "function" ? openUploadDialogV81 : openUploadDialogV80;
  opener({
    title: "导入课时 Excel",
    hint: "将 Excel 文件拖入这里",
    acceptText: "支持 .xlsx / .xls。点击下方按钮选择文件。",
    input: lessonInput,
    onFile: async file => {
      if (!/\.(xlsx|xls)$/i.test(file.name)) {
        showMessage("暂时只支持 .xlsx / .xls 文件。", "error");
        return;
      }
      await importLessonExcelFile(file);
    },
  });
}

function bindLessonUploadDialogFinalV82() {
  const lessonBtn = document.getElementById("lessonImportExcelBtn");
  const lessonInput = document.getElementById("lessonImportExcelInput");

  if (lessonBtn) {
    // Final override: click the page button only opens the upload dialog.
    // It never opens the OS file picker directly.
    lessonBtn.onclick = event => {
      event.preventDefault();
      event.stopPropagation();
      openLessonExcelUploadDialogV82();
    };
  }

  if (lessonInput) {
    lessonInput.onchange = async () => {
      const file = lessonInput.files && lessonInput.files[0];
      lessonInput.value = "";
      if (!file) return;
      await importLessonExcelFile(file);
      if (typeof closeUploadDialogV80 === "function") closeUploadDialogV80();
    };
  }

  bindLessonStudentRequiredV82();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindLessonUploadDialogFinalV82, 800);
});

const renderAllBeforeV82 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV82) {
  renderAll = function() {
    renderAllBeforeV82();
    bindLessonUploadDialogFinalV82();
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

function studentLabelV83(student) {
  return student?.display_name || student?.name || "";
}

function settlementMonthForStudentOptionsV933() {
  return document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
}

function studentIdsWithLessonsInMonthV933(month) {
  return new Set((state.lessonRecords || [])
    .filter(x => x.student_id && x.year_month === month)
    .map(x => x.student_id));
}

function fillStudentSelectV83(selectId, keepValue = true) {
  const el = document.getElementById(selectId);
  if (!el) return;

  const old = keepValue ? el.value : "";
  const month = settlementMonthForStudentOptionsV933();
  const ids = studentIdsWithLessonsInMonthV933(month);
  const students = (state.students || [])
    .filter(s => ids.has(s.id))
    .sort((a, b) => studentLabelV83(a).localeCompare(studentLabelV83(b), "zh-Hans-CN"));

  if (!students.length) {
    el.innerHTML = `<option value="">该月无课时学生</option>`;
    el.value = "";
    return;
  }

  el.innerHTML = `<option value="">选择学生</option>` + students
    .map(s => `<option value="${escAttr(s.id)}">${esc(studentLabelV83(s))}</option>`)
    .join("");

  el.value = students.some(s => s.id === old) ? old : "";
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

function renderStudentSettlement() {
  fillStudentSelectV83("settlementStudentFilter");
  const { month, studentId, lessons, planned, actual } = settlementRowsV83();
  const student = (state.students || []).find(x => x.id === studentId);
  const hint = document.getElementById("settlementStudentHint");

  if (hint) {
    hint.classList.toggle("ok", !!studentId);
    hint.textContent = studentId ? "已选择学生" : "学生必选";
  }

  if (!studentId || !student) {
    ["settlementPlannedHours", "settlementActualHours", "settlementPlannedJpy", "settlementActualJpy",
     "settlementPrevBalanceCny", "settlementExchangeRate", "settlementPlannedJpy2", "settlementPlannedCny",
     "settlementPlannedTotalCny", "settlementActualJpy2", "settlementActualCny", "settlementReceivedCny", "settlementReceivedJpy"].forEach(id => setOptionalText(id, "0"));
    const tbody = document.getElementById("settlementLessonsTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="empty-row">请先选择学生</td></tr>`;
    return;
  }

  const rate = Number(student.preset_exchange_rate || 0);
  const prevBalanceCny = Number(student.previous_balance_cny || 0);
  const plannedJpy = sumLessonFeeV83(planned);
  const actualJpy = sumLessonFeeV83(actual);
  const plannedCny = plannedJpy * rate;
  const actualCny = actualJpy * rate;
  const plannedTotalCny = plannedCny - prevBalanceCny;
  const receivedCny = sumIncomeV83(studentId, month, "CNY");
  const receivedJpy = sumIncomeV83(studentId, month, "JPY");

  setOptionalText("settlementPlannedHours", money(sumLessonHoursV83(planned)));
  setOptionalText("settlementActualHours", money(sumLessonHoursV83(actual)));
  setOptionalText("settlementPlannedJpy", formatJpyV83(plannedJpy));
  setOptionalText("settlementActualJpy", formatJpyV83(actualJpy));

  setOptionalText("settlementPrevBalanceCny", formatCnyV83(prevBalanceCny));
  setOptionalText("settlementExchangeRate", money(rate));
  setOptionalText("settlementPlannedJpy2", formatJpyV83(plannedJpy));
  setOptionalText("settlementPlannedCny", formatCnyV83(plannedCny));
  setOptionalText("settlementPlannedTotalCny", formatCnyV83(plannedTotalCny));

  setOptionalText("settlementActualJpy2", formatJpyV83(actualJpy));
  setOptionalText("settlementActualCny", formatCnyV83(actualCny));
  setOptionalText("settlementReceivedCny", formatCnyV83(receivedCny));
  setOptionalText("settlementReceivedJpy", formatJpyV83(receivedJpy));

  const sorted = lessons.slice().sort((a, b) => {
    const type = String(a.lesson_type || "").localeCompare(String(b.lesson_type || ""));
    if (type !== 0) return type;
    const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
    if (date !== 0) return date;
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  });

  const tbody = document.getElementById("settlementLessonsTable");
  if (!tbody) return;
  tbody.innerHTML = sorted.length ? sorted.map(item => `
    <tr>
      <td>${esc(lessonTypeLabel(item.lesson_type))}</td>
      <td>${esc(displayRecordDate(item.lesson_date || ""))}</td>
      <td>${esc(item.teacher?.display_name || item.teacher?.name || "")}</td>
      <td>${esc(item.subject?.name || "")}</td>
      <td>${money(item.duration_hours)}H</td>
      <td>${formatJpyV83(item.unit_price || 0)}</td>
      <td>${formatJpyV83(feeOfLessonV83(item))}</td>
      <td>${esc(lessonStatusLabel(item.status))}</td>
      <td>${esc(short(item.lesson_content || item.note, 24))}</td>
    </tr>
  `).join("") : `<tr><td colspan="9" class="empty-row">当前学生和月份没有课时记录</td></tr>`;
}

function bindStudentSettlementV83() {
  const month = document.getElementById("settlementMonthFilter");
  const student = document.getElementById("settlementStudentFilter");
  const refresh = document.getElementById("settlementRefreshBtn");

  fillStudentSelectV83("settlementStudentFilter");

  if (month && !month.value) month.value = currentYearMonth();

  if (month && month.dataset.boundV83 !== "true") {
    month.dataset.boundV83 = "true";
    month.addEventListener("change", renderStudentSettlement);
  }
  if (student && student.dataset.boundV83 !== "true") {
    student.dataset.boundV83 = "true";
    student.addEventListener("change", renderStudentSettlement);
  }
  if (refresh && refresh.dataset.boundV83 !== "true") {
    refresh.dataset.boundV83 = "true";
    refresh.onclick = renderStudentSettlement;
  }
  renderStudentSettlement();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindStudentSettlementV83, 700);
});

const renderAllBeforeV83 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV83) {
  renderAll = function() {
    renderAllBeforeV83();
    bindStudentSettlementV83();
  };
}

const switchPageBeforeV83 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV83) {
  switchPage = function(page) {
    switchPageBeforeV83(page);
    if (page === "student-settlement") {
      bindStudentSettlementV83();
    }
  };
}



// === v8.3.1 lesson UI and actual-copy fix ===
function lessonPairActionsNoContentV831(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  return `
    <div class="table-actions lesson-actions">
      ${lessonSelectCheckboxV76 ? lessonSelectCheckboxV76(item) : ""}
      ${actualButton}
      <button class="secondary-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsV831(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";

  return `
    <td>
      ${lessonPairDateText(item)}<br>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td>${lessonPairStudentText(item)}</td>
    <td>${lessonPairTeacherText(item)}</td>
    <td>
      ${lessonPairSubjectText(item)}<br>
      <span class="muted-small">${lessonPairTimeText(item)} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}</span>
    </td>
    <td>
      ${badge(lessonStatusLabel(item.status), statusClass)}<br>
      ${item.is_billable ? badge("计费") : badge("不计费", "gray")}
    </td>
    <td>
      <div class="lesson-content-cell">${esc(short(item.lesson_content || item.note, 28))}</div>
      ${lessonPairActionsNoContentV831(item)}
    </td>
  `;
}

// Override cell renderer used by existing renderLessons overrides.
lessonPairCells = lessonPairCellsV831;

function makeActualFromPlannedV831(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

// Override actual creation handler.
makeActualFromPlanned = makeActualFromPlannedV831;

// Rebind buttons after render to ensure override takes effect.
const bindLessonPairButtonsBeforeV831 = typeof bindLessonPairButtonsV59 === "function" ? bindLessonPairButtonsV59 : null;
if (bindLessonPairButtonsBeforeV831) {
  bindLessonPairButtonsV59 = function() {
    document.querySelectorAll("[data-create-actual]").forEach(btn => {
      btn.onclick = () => makeActualFromPlannedV831(btn.dataset.createActual);
    });
    document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
      btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
    });
  };
}



// === v8.3.3 compact lesson list layout ===
function lessonPairActionsCompactV833(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-mini-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";

  const selectBox = typeof lessonSelectCheckboxV76 === "function"
    ? lessonSelectCheckboxV76(item)
    : `<label class="lesson-select-box"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /> 勾选</label>`;

  return `
    <div class="lesson-actions-grid">
      ${selectBox}
      ${actualButton}
      <button class="secondary-btn lesson-mini-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-mini-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-mini-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsCompactV833(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeLine = `${lessonPairTimeText(item) || "时间未定"} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}`;

  return `
    <td class="lesson-date-cell">
      <div>${lessonPairDateText(item)}</div>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td class="lesson-name-cell">${lessonPairStudentText(item)}</td>
    <td class="lesson-teacher-cell">${lessonPairTeacherText(item)}</td>
    <td class="lesson-subject-cell">
      <div>${lessonPairSubjectText(item)}</div>
      <span class="muted-small">${timeLine}</span>
    </td>
    <td class="lesson-status-cell">
      ${badge(lessonStatusLabel(item.status), statusClass)}
      ${item.is_billable ? badge("计费") : badge("不计费", "gray")}
    </td>
    <td class="lesson-content-actions-cell">
      <div class="lesson-content-cell">${esc(short(item.lesson_content || item.note, 36))}</div>
      ${lessonPairActionsCompactV833(item)}
    </td>
  `;
}

lessonPairCells = lessonPairCellsCompactV833;

function makeActualFromPlannedCompactV833(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

makeActualFromPlanned = makeActualFromPlannedCompactV833;

function bindLessonPairButtonsCompactV833() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedCompactV833(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

bindLessonPairButtonsV59 = bindLessonPairButtonsCompactV833;

const renderLessonsBeforeV833 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV833) {
  renderLessons = function() {
    renderLessonsBeforeV833();
    bindLessonPairButtonsCompactV833();
  };
}



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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
      const matched = findMatchingPlannedLesson(row);
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

function renderStudentSettlementV834() {
  fillStudentSelectV83("settlementStudentFilter");
  const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  const student = (state.students || []).find(x => x.id === studentId);
  const hint = document.getElementById("settlementStudentHint");

  if (hint) {
    hint.classList.toggle("ok", !!studentId && !!student && Number(student.preset_exchange_rate || 0) > 0);
    hint.textContent = !studentId ? "学生必选" : (rateErrorTextV834(student) || "已选择学生");
  }

  if (!studentId || !student) {
    ["settlementPlannedHours", "settlementActualHours", "settlementPlannedJpy", "settlementActualJpy",
     "settlementPrevBalanceCny", "settlementExchangeRate", "settlementPlannedJpy2", "settlementPlannedCny",
     "settlementPlannedTotalCny", "settlementActualJpy2", "settlementActualCny", "settlementReceivedCny", "settlementReceivedJpy"].forEach(id => setOptionalText(id, "0"));
    const tbody = document.getElementById("settlementLessonsTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="empty-row">请先选择学生</td></tr>`;
    return;
  }

  const rate = Number(student.preset_exchange_rate || 0);
  if (rate <= 0) {
    showMessage(rateErrorTextV834(student), "error");
  }

  const lessonsAll = (state.lessonRecords || []).filter(x =>
    x.student_id === studentId &&
    x.year_month === month &&
    x.is_billable !== false
  );

  // Important: planned and actual are separated strictly.
  // Planned settlement must not include actual lessons.
  const planned = lessonsAll.filter(x => x.lesson_type === "planned");
  const actual = lessonsAll.filter(x =>
    x.lesson_type === "actual" &&
    (x.status === "completed" || x.status === "makeup")
  );

  const prevBalanceCny = Number(student.previous_balance_cny || 0);
  const plannedJpy = sumLessonFeeV83(planned);
  const actualJpy = sumLessonFeeV83(actual);
  const plannedCny = plannedJpy * rate;
  const actualCny = actualJpy * rate;
  const plannedTotalCny = plannedCny - prevBalanceCny;
  const receivedCny = sumIncomeV83(studentId, month, "CNY");
  const receivedJpy = sumIncomeV83(studentId, month, "JPY");

  setOptionalText("settlementPlannedHours", money(sumLessonHoursV83(planned)));
  setOptionalText("settlementActualHours", money(sumLessonHoursV83(actual)));
  setOptionalText("settlementPlannedJpy", formatJpyV83(plannedJpy));
  setOptionalText("settlementActualJpy", formatJpyV83(actualJpy));

  setOptionalText("settlementPrevBalanceCny", formatCnyV83(prevBalanceCny));
  setOptionalText("settlementExchangeRate", money(rate));
  setOptionalText("settlementPlannedJpy2", formatJpyV83(plannedJpy));
  setOptionalText("settlementPlannedCny", formatCnyV83(plannedCny));
  setOptionalText("settlementPlannedTotalCny", formatCnyV83(plannedTotalCny));

  setOptionalText("settlementActualJpy2", formatJpyV83(actualJpy));
  setOptionalText("settlementActualCny", formatCnyV83(actualCny));
  setOptionalText("settlementReceivedCny", formatCnyV83(receivedCny));
  setOptionalText("settlementReceivedJpy", formatJpyV83(receivedJpy));

  renderSettlementPairedLessonsV834(planned, actual);
}

// Override v8.3 settlement renderer.
renderStudentSettlement = renderStudentSettlementV834;

function bindStudentSettlementV834() {
  if (typeof bindStudentSettlementV83 === "function") bindStudentSettlementV83();

  const refresh = document.getElementById("settlementRefreshBtn");
  if (refresh) refresh.onclick = renderStudentSettlementV834;

  const month = document.getElementById("settlementMonthFilter");
  if (month) month.onchange = renderStudentSettlementV834;

  const student = document.getElementById("settlementStudentFilter");
  if (student) student.onchange = renderStudentSettlementV834;

  renderStudentSettlementV834();
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindStudentSettlementV834, 800);
});

const renderAllBeforeV834 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV834) {
  renderAll = function() {
    renderAllBeforeV834();
    bindStudentSettlementV834();
  };
}

const switchPageBeforeV834 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV834) {
  switchPage = function(page) {
    switchPageBeforeV834(page);
    if (page === "student-settlement") {
      bindStudentSettlementV834();
    }
  };
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
  buildForm = function(type, data = {}) {
    buildFormBeforeV835(type, data);
    if (type === "student") normalizeExchangeRateInputV835();
  };
}

function lessonPairActionsFinalV835(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-mini-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  const selectBox = typeof lessonSelectCheckboxV76 === "function"
    ? lessonSelectCheckboxV76(item)
    : `<label class="lesson-select-box"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /> 勾选</label>`;

  return `
    <div class="lesson-actions-grid final">
      ${selectBox}
      ${actualButton}
      <button class="secondary-btn lesson-mini-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-mini-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-mini-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsFinalV835(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";

  return `
    <td class="lesson-date-cell">
      <div>${lessonPairDateText(item)}</div>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td class="lesson-name-cell">${lessonPairStudentText(item)}</td>
    <td class="lesson-teacher-cell">${lessonPairTeacherText(item)}</td>
    <td class="lesson-subject-cell">
      <div class="lesson-main-text">${lessonPairSubjectText(item)}</div>
      <span class="muted-small">${timeText} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}</span>
    </td>
    <td class="lesson-status-cell">
      ${badge(lessonStatusLabel(item.status), statusClass)}
      ${item.is_billable ? badge("计费") : badge("不计费", "gray")}
    </td>
    <td class="lesson-content-actions-cell">
      <div class="lesson-content-cell">${esc(short(item.lesson_content || item.note, 42))}</div>
      ${lessonPairActionsFinalV835(item)}
    </td>
  `;
}

lessonPairCells = lessonPairCellsFinalV835;

function makeActualFromPlannedFinalV835(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

makeActualFromPlanned = makeActualFromPlannedFinalV835;

function bindLessonPairButtonsFinalV835() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedFinalV835(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

bindLessonPairButtonsV59 = bindLessonPairButtonsFinalV835;

function renderLessonRowsFinalV835(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="12">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head lesson-sub-head-body">
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态/计费</th><th>内容/操作</th>
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态/计费</th><th>内容/操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row compact">${lessonPairCellsFinalV835(plan, "planned")}${lessonPairCellsFinalV835(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsFinalV835(plan, "planned")
          : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row compact">${left}${lessonPairCellsFinalV835(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row compact">${lessonPairCellsFinalV835(null, "planned")}${lessonPairCellsFinalV835(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsFinalV835() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);

  const html = renderLessonRowsFinalV835(rows);
  tbody.innerHTML = html || `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonPairButtonsFinalV835();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsFinalV835;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsFinalV835();
    normalizeExchangeRateInputV835();
  }, 800);
});

const renderAllBeforeV835 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV835) {
  renderAll = function() {
    renderAllBeforeV835();
    renderLessonsFinalV835();
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
  buildForm = function(type, data = {}) {
    buildFormBeforeV836(type, data);
    if (type === "student") normalizeExchangeRateInputV836();
  };
}

function lessonPairActionsFinalV836(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-mini-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  const selectBox = typeof lessonSelectCheckboxV76 === "function"
    ? lessonSelectCheckboxV76(item)
    : `<label class="lesson-select-box"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /> 勾选</label>`;

  return `
    <div class="lesson-actions-grid final">
      ${selectBox}
      ${actualButton}
      <button class="secondary-btn lesson-mini-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-mini-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-mini-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsFinalV836(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";

  return `
    <td class="lesson-date-cell">
      <div>${lessonPairDateText(item)}</div>
      <span class="muted-small">${esc(item.year_month || "")}</span>
    </td>
    <td class="lesson-name-cell">${lessonPairStudentText(item)}</td>
    <td class="lesson-teacher-cell">${lessonPairTeacherText(item)}</td>
    <td class="lesson-subject-cell">
      <div class="lesson-main-text">${lessonPairSubjectText(item)}</div>
      <span class="muted-small">${timeText} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}</span>
    </td>
    <td class="lesson-status-cell">
      ${badge(lessonStatusLabel(item.status), statusClass)}
      ${item.is_billable ? badge("计费") : badge("不计费", "gray")}
    </td>
    <td class="lesson-content-actions-cell">
      <div class="lesson-content-cell">${esc(short(item.lesson_content || item.note, 42))}</div>
      ${lessonPairActionsFinalV836(item)}
    </td>
  `;
}

lessonPairCells = lessonPairCellsFinalV836;

function makeActualFromPlannedFinalV836(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

makeActualFromPlanned = makeActualFromPlannedFinalV836;

function bindLessonPairButtonsFinalV836() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedFinalV836(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

bindLessonPairButtonsV59 = bindLessonPairButtonsFinalV836;

function renderLessonRowsFinalV836(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="12">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head lesson-sub-head-body">
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态/计费</th><th>内容/操作</th>
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态/计费</th><th>内容/操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row compact">${lessonPairCellsFinalV836(plan, "planned")}${lessonPairCellsFinalV836(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsFinalV836(plan, "planned")
          : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row compact">${left}${lessonPairCellsFinalV836(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row compact">${lessonPairCellsFinalV836(null, "planned")}${lessonPairCellsFinalV836(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsFinalV836() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);

  const html = renderLessonRowsFinalV836(rows);
  tbody.innerHTML = html || `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonPairButtonsFinalV836();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsFinalV836;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsFinalV836();
    normalizeExchangeRateInputV836();
  }, 800);
});

const renderAllBeforeV836 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV836) {
  renderAll = function() {
    renderAllBeforeV836();
    renderLessonsFinalV836();
    normalizeExchangeRateInputV836();
  };
}



// === v8.3.7 force compact lesson layout ===
function lessonActionButtonsV837(item) {
  if (!item) return "";
  const selectBox = `<label class="lesson-check-inline"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /> 勾选</label>`;
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-row-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";

  return `
    <div class="lesson-action-row">
      ${selectBox}
      ${actualButton}
      <button class="secondary-btn lesson-row-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsV837(item, side) {
  if (!item) {
    return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 46));

  return `
    <td class="col-date"><div>${lessonPairDateText(item)}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-cell-flex"><div class="lesson-content-text">${content}</div>${lessonActionButtonsV837(item)}</div></td>
  `;
}

function makeActualFromPlannedV837(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

function renderLessonRowsV837(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="12">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body">
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容/操作</th>
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容/操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v837">${lessonPairCellsV837(plan, "planned")}${lessonPairCellsV837(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsV837(plan, "planned")
          : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v837">${left}${lessonPairCellsV837(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v837">${lessonPairCellsV837(null, "planned")}${lessonPairCellsV837(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function bindLessonButtonsV837() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV837(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

function renderLessonsV837() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV837(rows) || `<tr><td colspan="12" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonButtonsV837();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV837;
lessonPairCells = lessonPairCellsV837;
makeActualFromPlanned = makeActualFromPlannedV837;
bindLessonPairButtonsV59 = bindLessonButtonsV837;

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
  buildForm = function(type, data = {}) {
    buildFormBeforeV837(type, data);
    if (type === "student") normalizeExchangeRateInputV837();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsV837();
    normalizeExchangeRateInputV837();
  }, 900);
});

const renderAllBeforeV837 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV837) {
  renderAll = function() {
    renderAllBeforeV837();
    renderLessonsV837();
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
  renderStudentSettlement = function() {
    renderStudentSettlementBeforeV838();
    cleanupSettlementSummaryV838();
  };
}

const renderAllBeforeV838 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV838) {
  renderAll = function() {
    renderAllBeforeV838();
    cleanupSettlementSummaryV838();
  };
}

const switchPageBeforeV838 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV838) {
  switchPage = function(page) {
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
function lessonCheckCellV839(item) {
  if (!item) return "";
  return `<label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label>`;
}

function lessonActionButtonsV839(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-row-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  return `
    <div class="lesson-action-col">
      ${actualButton}
      <button class="secondary-btn lesson-row-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsV839(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 32));

  return `
    <td class="col-check">${lessonCheckCellV839(item)}</td>
    <td class="col-date"><div>${lessonPairDateText(item)}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H / ${formatCurrencyTotal(fee, "JPY")}</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text">${content}</div></td>
    <td class="col-actions">${lessonActionButtonsV839(item)}</td>
  `;
}

function makeActualFromPlannedV839(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

function renderLessonRowsV839(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v839">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v839">${lessonPairCellsV839(plan, "planned")}${lessonPairCellsV839(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsV839(plan, "planned")
          : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v839">${left}${lessonPairCellsV839(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v839">${lessonPairCellsV839(null, "planned")}${lessonPairCellsV839(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function bindLessonButtonsV839() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV839(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

function renderLessonsV839() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV839(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonButtonsV839();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV839;
lessonPairCells = lessonPairCellsV839;
makeActualFromPlanned = makeActualFromPlannedV839;
bindLessonPairButtonsV59 = bindLessonButtonsV839;

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
  buildForm = function(type, data = {}) {
    buildFormBeforeV839(type, data);
    if (type === "student") normalizeExchangeRateInputV839();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsV839();
    normalizeExchangeRateInputV839();
  }, 900);
});

const renderAllBeforeV839 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV839) {
  renderAll = function() {
    renderAllBeforeV839();
    renderLessonsV839();
    normalizeExchangeRateInputV839();
  };
}



// === v8.3.10 lesson and settlement fine layout ===
function lessonActionButtonsV8310(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-row-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  return `
    <div class="lesson-action-col">
      ${actualButton}
      <button class="secondary-btn lesson-row-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonPairCellsV8310(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));

  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${lessonPairDateText(item)}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${lessonActionButtonsV8310(item)}</td>
  `;
}

function makeActualFromPlannedV8310(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

function renderLessonRowsV8310(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV8310(plan, "planned")}${lessonPairCellsV8310(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsV8310(plan, "planned")
          : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV8310(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV8310(null, "planned")}${lessonPairCellsV8310(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function bindLessonButtonsV8310() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV8310(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}

function renderLessonsV8310() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV8310(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonButtonsV8310();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
      const matched = findMatchingPlannedLesson(row);
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

renderLessons = renderLessonsV8310;
lessonPairCells = lessonPairCellsV8310;
makeActualFromPlanned = makeActualFromPlannedV8310;
bindLessonPairButtonsV59 = bindLessonButtonsV8310;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsV8310();
  }, 900);
});

const renderAllBeforeV8310 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8310) {
  renderAll = function() {
    renderAllBeforeV8310();
    renderLessonsV8310();
  };
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
  renderAll = function() {
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

function compareLessonsByFixedSubjectV8311(a, b) {
  // 月份 → 老师 → 固定科目顺序（日语/数学/文综/物理/化学/生物）→ 日期 → 时间
  const month = String(a.year_month || "").localeCompare(String(b.year_month || ""));
  if (month !== 0) return month;

  const teacher = (a.teacher?.display_name || a.teacher?.name || "").localeCompare(b.teacher?.display_name || b.teacher?.name || "");
  if (teacher !== 0) return teacher;

  const rank = subjectRankV8311(a) - subjectRankV8311(b);
  if (rank !== 0) return rank;

  const subjectName = String(a.subject?.name || "").localeCompare(String(b.subject?.name || ""));
  if (subjectName !== 0) return subjectName;

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  return String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

// Override sort function used by the latest lesson/settlement renderers.
compareLessonsV78 = compareLessonsByFixedSubjectV8311;

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
  renderStudentSettlement = function() {
    renderStudentSettlementBeforeV8311();
    ensureSettlementReceivedJpyRowV8311();
  };
}

const renderAllBeforeV8311 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8311) {
  renderAll = function() {
    renderAllBeforeV8311();
    ensureSettlementReceivedJpyRowV8311();
    if (typeof renderLessons === "function") renderLessons();
  };
}

const switchPageBeforeV8311 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV8311) {
  switchPage = function(page) {
    switchPageBeforeV8311(page);
    if (page === "student-settlement") setTimeout(ensureSettlementReceivedJpyRowV8311, 0);
    if (page === "lessons" && typeof renderLessons === "function") setTimeout(renderLessons, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    ensureSettlementReceivedJpyRowV8311();
    if (typeof renderLessons === "function") renderLessons();
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

function compareLessonsByFixedSubjectV8312(a, b) {
  // 修正：课程顺序优先于老师顺序。
  // 月份 → 固定课程顺序（日语/数学/文综/物理/化学/生物）→ 老师 → 日期 → 时间
  const month = String(a.year_month || "").localeCompare(String(b.year_month || ""));
  if (month !== 0) return month;

  const subjectRank = subjectSortKeyV8312(a) - subjectSortKeyV8312(b);
  if (subjectRank !== 0) return subjectRank;

  const subjectName = String(a.subject?.name || "").localeCompare(String(b.subject?.name || ""));
  if (subjectName !== 0) return subjectName;

  const teacher = String(a.teacher?.display_name || a.teacher?.name || "").localeCompare(String(b.teacher?.display_name || b.teacher?.name || ""));
  if (teacher !== 0) return teacher;

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  return String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

// Override every known sort hook from previous versions.
compareLessonsV78 = compareLessonsByFixedSubjectV8312;
compareLessonsV77 = compareLessonsByFixedSubjectV8312;
compareLessonsByFixedSubjectV8311 = compareLessonsByFixedSubjectV8312;

// Re-render current pages after overriding sort hooks.
document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV8312 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8312) {
  renderAll = function() {
    renderAllBeforeV8312();
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}

const switchPageBeforeV8312 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV8312) {
  switchPage = function(page) {
    switchPageBeforeV8312(page);
    if (page === "lessons" && typeof renderLessons === "function") setTimeout(renderLessons, 0);
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

function compareLessonsByTrackSubjectV8314(a, b) {
  const month = String(a.year_month || "").localeCompare(String(b.year_month || ""));
  if (month !== 0) return month;

  const rank = subjectRankByTrackV8314(a) - subjectRankByTrackV8314(b);
  if (rank !== 0) return rank;

  const subjectName = String(a.subject?.name || "").localeCompare(String(b.subject?.name || ""));
  if (subjectName !== 0) return subjectName;

  const teacher = String(a.teacher?.display_name || a.teacher?.name || "").localeCompare(String(b.teacher?.display_name || b.teacher?.name || ""));
  if (teacher !== 0) return teacher;

  const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
  if (date !== 0) return date;

  return String(a.start_time || "").localeCompare(String(b.start_time || ""));
}

// Override all previous sort hooks.
compareLessonsV78 = compareLessonsByTrackSubjectV8314;
compareLessonsV77 = compareLessonsByTrackSubjectV8314;
compareLessonsByFixedSubjectV8311 = compareLessonsByTrackSubjectV8314;
compareLessonsByFixedSubjectV8312 = compareLessonsByTrackSubjectV8314;

function normalizeCourseTrackInputV8314() {
  document.querySelectorAll('select[name="course_track"]').forEach(select => {
    if (!select.value) select.value = "science";
  });
}

const buildFormBeforeV8314 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV8314) {
  buildForm = function(type, data = {}) {
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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV8314 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8314) {
  renderAll = function() {
    renderAllBeforeV8314();
    if (typeof renderStudentsTable === "function") renderStudentsTable();
    if (typeof renderLessons === "function") renderLessons();
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
  renderStudentSettlement = function() {
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
  renderAll = function() {
    renderAllBeforeV84();
    ensureSettlementDifferenceRowsV84();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  };
}

const switchPageBeforeV84 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV84) {
  switchPage = function(page) {
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
  computeStudentSettlementV84 = function() {
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
  renderStudentSettlement = function() {
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
  renderAll = function() {
    renderAllBeforeV85();
    if (typeof renderIncomeTable === "function") renderIncomeTable();
    ensureSettlementEquivalentRowsV85();
  };
}



// === v8.5.1 lesson payload whitelist + actual generation fix ===
const LESSON_ALLOWED_FIELDS_V851 = [
  "lesson_type",
  "planned_lesson_id",
  "lesson_date",
  "year_month",
  "student_id",
  "teacher_id",
  "subject_id",
  "business_entity_id",
  "start_time",
  "end_time",
  "duration_hours",
  "unit_price",
  "lesson_fee",
  "status",
  "is_billable",
  "lesson_content",
  "note",
];

function sanitizeLessonPayloadV851(payload) {
  const cleaned = {};
  LESSON_ALLOWED_FIELDS_V851.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(payload, key)) cleaned[key] = payload[key];
  });

  ["planned_lesson_id", "student_id", "teacher_id", "subject_id", "business_entity_id"].forEach(key => {
    if (cleaned[key] === "") cleaned[key] = null;
  });

  if (cleaned.lesson_date && !cleaned.year_month) {
    cleaned.year_month = String(cleaned.lesson_date).slice(0, 7);
  }

  if (cleaned.lesson_type === "planned") {
    cleaned.planned_lesson_id = null;
  }

  if (cleaned.lesson_type === "actual" && !cleaned.planned_lesson_id && state.pendingActualPlanId) {
    cleaned.planned_lesson_id = state.pendingActualPlanId;
  }

  return cleaned;
}

const normalizeLessonPayloadBeforeV851 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  if (normalizeLessonPayloadBeforeV851) {
    payload = normalizeLessonPayloadBeforeV851(payload, type);
  }
  if (type !== "lesson") return payload;
  const cleaned = sanitizeLessonPayloadV851(payload);
  Object.keys(payload).forEach(key => delete payload[key]);
  Object.assign(payload, cleaned);
  return payload;
};

function makeActualFromPlannedV851(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
}

makeActualFromPlanned = makeActualFromPlannedV851;

function bindActualButtonsV851() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV851(btn.dataset.createActual);
  });
}

const bindLessonPairButtonsBeforeV851 = typeof bindLessonPairButtonsV59 === "function" ? bindLessonPairButtonsV59 : null;
bindLessonPairButtonsV59 = function() {
  if (bindLessonPairButtonsBeforeV851) bindLessonPairButtonsBeforeV851();
  bindActualButtonsV851();
};

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindActualButtonsV851, 1000);
});



// === v8.5.2 week label for planned lesson dates ===
function lessonDateWithWeekLabelV852(item) {
  const base = lessonPairDateText(item);
  if (item?.lesson_type === "planned" && base && !String(base).endsWith("周")) {
    return `${base}周`;
  }
  return base;
}

function lessonPairCellsV852(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));

  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${lessonDateWithWeekLabelV852(item)}</div><span>${esc(item.year_month || "")}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${lessonActionButtonsV8310 ? lessonActionButtonsV8310(item) : ""}</td>
  `;
}

// Override lesson table date display.
lessonPairCells = lessonPairCellsV852;

function renderLessonRowsV852(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const sortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(sortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(sortFn);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(plan, "planned")}${lessonPairCellsV852(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsV852(plan, "planned")
          : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV852(actual, "actual")}</tr>`);
      });
    }
  });

  unlinkedActual.slice().sort(sortFn).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(null, "planned")}${lessonPairCellsV852(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV852() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV852(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  if (typeof bindLessonButtonsV8310 === "function") bindLessonButtonsV8310();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV852;

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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
      const matched = findMatchingPlannedLesson(row);
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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV852 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV852) {
  renderAll = function() {
    renderAllBeforeV852();
    if (typeof renderLessons === "function") renderLessons();
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

function renderLessonRowsV853(rows) {
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const plannedSortFn = typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : compareLessonDateTimeAscV853;

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(plannedSortFn).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);

    // Important: actual lessons on the right side must be chronological ascending.
    // Do not reuse subject/teacher sort here; it can look like date descending.
    const actuals = (actualByPlan.get(plan.id) || []).slice().sort(compareLessonDateTimeAscV853);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(plan, "planned")}${lessonPairCellsV852(null, "actual")}</tr>`);
    } else {
      actuals.forEach((actual, index) => {
        const left = index === 0
          ? lessonPairCellsV852(plan, "planned")
          : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV852(actual, "actual")}</tr>`);
      });
    }
  });

  // Unlinked actual lessons should also be chronological ascending inside each month.
  unlinkedActual.slice().sort(compareLessonDateTimeAscV853).forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(null, "planned")}${lessonPairCellsV852(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV853() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();

  const rows = filterLessons().slice().sort(typeof compareLessonsV78 === "function"
    ? compareLessonsV78
    : compareLessonDateTimeAscV853);

  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV853(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

  if (typeof bindLessonButtonsV8310 === "function") bindLessonButtonsV8310();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV853;

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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
      const matched = findMatchingPlannedLesson(row);
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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV853 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV853) {
  renderAll = function() {
    renderAllBeforeV853();
    if (typeof renderLessons === "function") renderLessons();
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
    if (!planId && typeof findMatchingPlannedLesson === "function") {
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

  const pairs = plannedRows.map(plan => ({
    plan,
    actuals: (actualByPlan.get(plan.id) || []).slice().sort(compareDateTimeAscV854),
  }));

  pairs.sort(compareLessonPairV854);
  unlinkedActual.sort(compareDateTimeAscV854);

  return { pairs, unlinkedActual };
}

function renderLessonRowsV854(rows) {
  const { pairs, unlinkedActual } = buildLessonPairGroupsV854(rows);

  const html = [];
  let lastMonth = "";

  function rowMonth(pairOrActual) {
    if (pairOrActual.plan) {
      const base = lessonPairSortKeyDateV854(pairOrActual.plan, pairOrActual.actuals);
      return base?.year_month || pairOrActual.plan?.year_month || "未归属月份";
    }
    return pairOrActual.year_month || "未归属月份";
  }

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  pairs.forEach(pair => {
    addMonthRow(rowMonth(pair));

    if (!pair.actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(pair.plan, "planned")}${lessonPairCellsV852(null, "actual")}</tr>`);
      return;
    }

    pair.actuals.forEach((actual, index) => {
      const left = index === 0
        ? lessonPairCellsV852(pair.plan, "planned")
        : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV852(actual, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(null, "planned")}${lessonPairCellsV852(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV854() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);

  tbody.innerHTML = renderLessonRowsV854(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

  if (typeof bindLessonButtonsV8310 === "function") bindLessonButtonsV8310();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV854;

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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV854 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV854) {
  renderAll = function() {
    renderAllBeforeV854();
    if (typeof renderLessons === "function") renderLessons();
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

function renderLessonRowsV855(rows) {
  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual");

  const { actualByPlan, unlinkedActual } = buildActualByExplicitPlanV855(actualRows);

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(comparePlannedRowsByCourseDateV855).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);

    const actuals = (actualByPlan.get(lessonIdTextV855(plan.id)) || []).slice()
      .sort(compareDateTimeAscV854 || compareDateTimeAscV853 || ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(plan, "planned")}${lessonPairCellsV852(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((actual, index) => {
      const left = index === 0
        ? lessonPairCellsV852(plan, "planned")
        : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV852(actual, "actual")}</tr>`);
    });
  });

  // Actual lessons without planned_lesson_id stay in unlinked area.
  // They are not guessed into duplicate planned rows.
  unlinkedActual.forEach(actual => {
    const ym = actual.year_month || "未归属月份";
    addMonthRow(ym);
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV852(null, "planned")}${lessonPairCellsV852(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV855() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;

  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);

  tbody.innerHTML = renderLessonRowsV855(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

  if (typeof bindLessonButtonsV8310 === "function") bindLessonButtonsV8310();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV855;

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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV855 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV855) {
  renderAll = function() {
    renderAllBeforeV855();
    if (typeof renderLessons === "function") renderLessons();
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

function attachLessonAutoCalcV856() {
  const form = document.getElementById("modalForm");
  if (!form || state.editing?.type !== "lesson") return;

  const duration = form.querySelector('[name="duration_hours"]');
  const unit = form.querySelector('[name="unit_price"]');
  const fee = form.querySelector('[name="lesson_fee"]');
  if (!duration || !unit || !fee) return;

  const recalc = () => {
    const h = Number(duration.value || 0);
    const p = Number(unit.value || 0);
    if (!Number.isFinite(h) || !Number.isFinite(p)) return;
    if (h <= 0 || p <= 0) {
      if (!fee.dataset.userEdited) fee.value = "";
      return;
    }
    // Always recalc when duration/unit change; user can still overwrite fee manually after.
    const result = h * p;
    fee.value = Number.isInteger(result) ? String(result) : String(Math.round(result));
    fee.dataset.autoCalculated = "true";
  };

  ["input", "change"].forEach(evt => {
    duration.addEventListener(evt, recalc);
    unit.addEventListener(evt, recalc);
  });

  fee.addEventListener("input", () => {
    fee.dataset.userEdited = "true";
  });

  recalc();
}

const buildFormBeforeV856 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV856) {
  buildForm = function(type, data = {}) {
    buildFormBeforeV856(type, data);
    if (type === "lesson") {
      attachLessonAutoCalcV856();
    }
  };
}

// Stronger copy: include unit price and lesson fee.
function copyLessonRecordV856(id) {
  const item = state.lessonRecords.find(x => x.id === id);
  if (!item) return;

  const data = {
    ...item,
    id: undefined,
    lesson_date: item.lesson_date || todayStr(),
    year_month: item.year_month || currentYearMonth(),
    start_time: item.start_time || "",
    end_time: item.end_time || "",
    duration_hours: item.duration_hours || 0,
    unit_price: item.unit_price || 0,
    lesson_fee: item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0,
    lesson_content: item.lesson_content || "",
    note: item.note || "",
  };

  openCreateModal("lesson", data);
  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "复制课时";
  setTimeout(attachLessonAutoCalcV856, 0);
}

copyLessonRecordV59 = copyLessonRecordV856;

function makeActualFromPlannedV856(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0,
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
  attachLessonAutoCalcV856();
}

makeActualFromPlanned = makeActualFromPlannedV856;

function lessonPairCellsV856(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));
  const dateDisplay = item.lesson_type === "planned" ? plannedWeekDateDisplayV856(item) : actualDateDisplayV856(item);

  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${esc(dateDisplay)}</div><span>${esc(yearMonthDateDisplayV856(item))}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${lessonActionButtonsV8310 ? lessonActionButtonsV8310(item) : ""}</td>
  `;
}

lessonPairCells = lessonPairCellsV856;

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

// Override render rows to use new cell formatter, keeping v8.5.5 stable link logic if available.
if (typeof renderLessonRowsV855 === "function") {
  const renderLessonRowsBeforeV856 = renderLessonRowsV855;
  renderLessonRowsV855 = function(rows) {
    const oldCells = lessonPairCells;
    lessonPairCells = lessonPairCellsV856;
    const html = renderLessonRowsBeforeV856(rows);
    lessonPairCells = lessonPairCellsV856;
    return html;
  };
}

if (typeof renderSettlementPairedLessonsV855 === "function") {
  const renderSettlementBeforeV856 = renderSettlementPairedLessonsV855;
  renderSettlementPairedLessonsV855 = function(planned, actual) {
    const oldCells = settlementLessonCellsV852;
    settlementLessonCellsV852 = settlementLessonCellsV856;
    const result = renderSettlementBeforeV856(planned, actual);
    settlementLessonCellsV852 = settlementLessonCellsV856;
    return result;
  };
}

function bindLessonButtonsV856() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV856(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV856(btn.dataset.copyLesson);
  });
}

bindLessonPairButtonsV59 = bindLessonButtonsV856;

const renderLessonsBeforeV856 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV856) {
  renderLessons = function() {
    renderLessonsBeforeV856();
    bindLessonButtonsV856();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindLessonButtonsV856();
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV856 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV856) {
  renderAll = function() {
    renderAllBeforeV856();
    bindLessonButtonsV856();
  };
}



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

// Store planned lesson dates as the Monday of that week.
// This prevents later rendering/sorting from falling back to a mid-week date.
const normalizeLessonPayloadBeforeV857 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  if (normalizeLessonPayloadBeforeV857) payload = normalizeLessonPayloadBeforeV857(payload, type);
  if (type === "lesson" && payload?.lesson_type === "planned" && payload.lesson_date) {
    const monday = mondayOfDateV857(payload.lesson_date);
    if (monday) {
      payload.lesson_date = monday;
      payload.year_month = monday.slice(0, 7);
    }
  }
  return payload;
};

function lessonPairCellsV857(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));
  const d = dateCellDisplayV857(item);

  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${typeof lessonActionButtonsV8310 === "function" ? lessonActionButtonsV8310(item) : ""}</td>
  `;
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

function renderLessonRowsV857(rows) {
  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual");

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actualRows.forEach(actual => {
    const planId = String(actual.planned_lesson_id || "").trim();
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(actual);
    } else {
      unlinkedActual.push(actual);
    }
  });

  const dateSort = typeof compareDateTimeAscV854 === "function"
    ? compareDateTimeAscV854
    : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));

  actualByPlan.forEach(list => list.sort(dateSort));
  unlinkedActual.sort(dateSort);

  const planSort = typeof comparePlannedRowsByCourseDateV855 === "function"
    ? comparePlannedRowsByCourseDateV855
    : (typeof compareLessonsV78 === "function" ? compareLessonsV78 : dateSort);

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(planSort).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(dateSort);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV857(plan, "planned")}${lessonPairCellsV857(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((actual, index) => {
      const left = index === 0
        ? lessonPairCellsV857(plan, "planned")
        : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV857(actual, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV857(null, "planned")}${lessonPairCellsV857(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV857() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV857(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  if (typeof bindLessonButtonsV856 === "function") bindLessonButtonsV856();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV857;
lessonPairCells = lessonPairCellsV857;

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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV857 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV857) {
  renderAll = function() {
    renderAllBeforeV857();
    if (typeof renderLessons === "function") renderLessons();
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

// v8.5.7 changed planned lesson_date to Monday on save.
// Override it: week label is display-only; the actual selected class date must stay in lesson_date.
const normalizeLessonPayloadBeforeV858 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  const originalLessonDate = payload?.lesson_date;
  if (normalizeLessonPayloadBeforeV858) payload = normalizeLessonPayloadBeforeV858(payload, type);

  if (type === "lesson" && payload?.lesson_type === "planned") {
    if (originalLessonDate) {
      const iso = toIsoDateV858(originalLessonDate);
      if (iso) {
        payload.lesson_date = iso;
        payload.year_month = iso.slice(0, 7);
      }
    }
    payload.planned_lesson_id = null;
  }

  return payload;
};

function lessonPairCellsV858(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }

  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));
  const d = dateCellDisplayV858(item);

  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${typeof lessonActionButtonsV8310 === "function" ? lessonActionButtonsV8310(item) : ""}</td>
  `;
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

function renderLessonRowsV858(rows) {
  const plannedRows = rows.filter(x => x.lesson_type === "planned");
  const actualRows = rows.filter(x => x.lesson_type === "actual");

  const actualByPlan = new Map();
  const unlinkedActual = [];

  actualRows.forEach(actual => {
    const planId = String(actual.planned_lesson_id || "").trim();
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(actual);
    } else {
      unlinkedActual.push(actual);
    }
  });

  const dateSort = typeof compareDateTimeAscV854 === "function"
    ? compareDateTimeAscV854
    : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));

  actualByPlan.forEach(list => list.sort(dateSort));
  unlinkedActual.sort(dateSort);

  const planSort = typeof comparePlannedRowsByCourseDateV855 === "function"
    ? comparePlannedRowsByCourseDateV855
    : (typeof compareLessonsV78 === "function" ? compareLessonsV78 : dateSort);

  const html = [];
  let lastMonth = "";

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  plannedRows.slice().sort(planSort).forEach(plan => {
    const ym = plan.year_month || "未归属月份";
    addMonthRow(ym);
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(dateSort);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV858(plan, "planned")}${lessonPairCellsV858(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((actual, index) => {
      const left = index === 0
        ? lessonPairCellsV858(plan, "planned")
        : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310">${left}${lessonPairCellsV858(actual, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${lessonPairCellsV858(null, "planned")}${lessonPairCellsV858(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsV858() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV858(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  if (typeof bindLessonButtonsV856 === "function") bindLessonButtonsV856();
  if (typeof bindActualButtonsV851 === "function") bindActualButtonsV851();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
}

renderLessons = renderLessonsV858;
lessonPairCells = lessonPairCellsV858;

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
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV858 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV858) {
  renderAll = function() {
    renderAllBeforeV858();
    if (typeof renderLessons === "function") renderLessons();
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

function subjectRankV86(item) {
  const order = lessonTrackV86(item) === "humanities"
    ? SCHOOL_STABLE_V86.subjectOrderHumanities
    : SCHOOL_STABLE_V86.subjectOrderScience;
  const idx = order.indexOf(subjectKindV86(item));
  return idx >= 0 ? idx : 999;
}

function compareDateTimeV86(a, b) {
  const date = String(a?.lesson_date || "").localeCompare(String(b?.lesson_date || ""));
  if (date !== 0) return date;
  const start = String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
  if (start !== 0) return start;
  const end = String(a?.end_time || "").localeCompare(String(b?.end_time || ""));
  if (end !== 0) return end;
  return String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
}

function comparePlannedLessonsV86(a, b) {
  const month = String(a?.year_month || "").localeCompare(String(b?.year_month || ""));
  if (month !== 0) return month;
  const rank = subjectRankV86(a) - subjectRankV86(b);
  if (rank !== 0) return rank;
  const subject = String(a?.subject?.name || "").localeCompare(String(b?.subject?.name || ""));
  if (subject !== 0) return subject;
  const teacher = String(a?.teacher?.display_name || a?.teacher?.name || "")
    .localeCompare(String(b?.teacher?.display_name || b?.teacher?.name || ""));
  if (teacher !== 0) return teacher;
  return compareDateTimeV86(a, b);
}

function lessonFeeV86(item) {
  return Number(item?.lesson_fee || (Number(item?.unit_price || 0) * Number(item?.duration_hours || 0)) || 0);
}

function buildLessonPairsV86(rows) {
  const planned = rows.filter(x => x.lesson_type === "planned").slice().sort(comparePlannedLessonsV86);
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

function lessonRowActionsV86(item) {
  if (!item) return "";
  const actualButton = item.lesson_type === "planned"
    ? `<button class="secondary-btn lesson-row-btn" data-create-actual="${escAttr(item.id)}">生成实际</button>`
    : "";
  return `
    <div class="lesson-action-col">
      ${actualButton}
      <button class="secondary-btn lesson-row-btn" data-copy-lesson="${escAttr(item.id)}">复制</button>
      <button class="secondary-btn lesson-row-btn" data-edit="${escAttr(item.id)}" data-type="lesson">编辑</button>
      <button class="danger-btn lesson-row-btn" data-delete="${escAttr(item.id)}" data-type="lesson">删除</button>
    </div>
  `;
}

function lessonCellV86(item, side) {
  if (!item) {
    return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
  }
  const d = lessonDateDisplayV86(item);
  const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
  const timeText = lessonPairTimeText(item) || "时间未定";
  const content = esc(short(item.lesson_content || item.note || "", 22));
  return `
    <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
    <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span></td>
    <td class="col-student">${lessonPairStudentText(item)}</td>
    <td class="col-teacher">${lessonPairTeacherText(item)}</td>
    <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
    <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
    <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
    <td class="col-actions">${lessonRowActionsV86(item)}</td>
  `;
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

function renderLessonRowsV86(rows) {
  const { planned, actualByPlan, unlinkedActual } = buildLessonPairsV86(rows);
  const html = [];
  let lastMonth = "";
  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }
  planned.forEach(plan => {
    addMonthRow(plan.year_month || "未归属月份");
    const actuals = (actualByPlan.get(String(plan.id || "").trim()) || []).slice().sort(compareDateTimeV86);
    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310">${lessonCellV86(plan, "planned")}${lessonCellV86(null, "actual")}</tr>`);
      return;
    }
    actuals.forEach((actual, index) => {
      const left = index === 0 ? lessonCellV86(plan, "planned") : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310">${left}${lessonCellV86(actual, "actual")}</tr>`);
    });
  });
  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${lessonCellV86(null, "planned")}${lessonCellV86(actual, "actual")}</tr>`);
  });
  return html.join("");
}

function renderLessonsV86() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsV86(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonButtonsV86();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
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

function attachLessonAutoCalcV86() {
  const form = document.getElementById("modalForm");
  if (!form || state.editing?.type !== "lesson") return;
  const duration = form.querySelector('[name="duration_hours"]');
  const unit = form.querySelector('[name="unit_price"]');
  const fee = form.querySelector('[name="lesson_fee"]');
  if (!duration || !unit || !fee) return;
  const recalc = () => {
    const h = Number(duration.value || 0);
    const p = Number(unit.value || 0);
    if (h > 0 && p > 0) {
      const result = h * p;
      fee.value = Number.isInteger(result) ? String(result) : String(Math.round(result));
    }
  };
  ["input", "change"].forEach(evt => {
    duration.addEventListener(evt, recalc);
    unit.addEventListener(evt, recalc);
  });
  recalc();
}

function copyLessonRecordV86(id) {
  const item = state.lessonRecords.find(x => x.id === id);
  if (!item) return;
  const data = {
    ...item,
    id: undefined,
    start_time: item.start_time || "",
    end_time: item.end_time || "",
    duration_hours: item.duration_hours || 0,
    unit_price: item.unit_price || 0,
    lesson_fee: lessonFeeV86(item),
    lesson_content: item.lesson_content || "",
    note: item.note || "",
  };
  openCreateModal("lesson", data);
  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "复制课时";
  setTimeout(attachLessonAutoCalcV86, 0);
}

function makeActualFromPlannedV86(id) {
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
    unit_price: plan.unit_price || 0,
    lesson_fee: lessonFeeV86(plan),
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };
  state.pendingActualPlanId = plan.id;
  openCreateModal("lesson", prefill);
  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;
  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
  attachLessonAutoCalcV86();
}

function bindLessonButtonsV86() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV86(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => copyLessonRecordV86(btn.dataset.copyLesson);
  });
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
renderLessons = renderLessonsV86;
lessonPairCells = lessonCellV86;
copyLessonRecordV59 = copyLessonRecordV86;
makeActualFromPlanned = makeActualFromPlannedV86;
bindLessonPairButtonsV59 = bindLessonButtonsV86;
compareLessonsV78 = comparePlannedLessonsV86;
compareLessonsV77 = comparePlannedLessonsV86;
sumIncomeV83 = sumIncomeV86;

if (typeof renderSettlementPairedLessonsV834 === "function") renderSettlementPairedLessonsV834 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV8310 === "function") renderSettlementPairedLessonsV8310 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV852 === "function") renderSettlementPairedLessonsV852 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV853 === "function") renderSettlementPairedLessonsV853 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV854 === "function") renderSettlementPairedLessonsV854 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV855 === "function") renderSettlementPairedLessonsV855 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV857 === "function") renderSettlementPairedLessonsV857 = renderSettlementPairsV86;
if (typeof renderSettlementPairedLessonsV858 === "function") renderSettlementPairedLessonsV858 = renderSettlementPairsV86;

const buildFormBeforeV86 = typeof buildForm === "function" ? buildForm : null;
if (buildFormBeforeV86) {
  buildForm = function(type, data = {}) {
    buildFormBeforeV86(type, data);
    if (type === "lesson") attachLessonAutoCalcV86();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof renderLessons === "function") renderLessons();
    if (typeof renderStudentSettlement === "function") renderStudentSettlement();
  }, 1000);
});

const renderAllBeforeV86 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV86) {
  renderAll = function() {
    renderAllBeforeV86();
    if (typeof renderLessons === "function") renderLessons();
  };
}



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
  renderStats = function() {
    renderStatsBeforeV861();
    renderBusinessSplitStatsV861();
  };
}

const renderAllBeforeV861 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV861) {
  renderAll = function() {
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
  renderStats = function() {
    renderStatsBeforeV862();
    renderSplitFinanceSummaryV862();
  };
}

const renderAllBeforeV862 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV862) {
  renderAll = function() {
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
  renderStats = function() {
    renderStatsBeforeV863();
    renderSplitFinanceSummaryV863();
  };
}

const renderAllBeforeV863 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV863) {
  renderAll = function() {
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
  normalizePayload = function(payload, type) {
    payload = normalizePayloadBeforeV864(payload, type);
    if (type === "expense") return sanitizeExpensePayloadV864(payload);
    if (type === "reimbursement") return sanitizeReimbursementPayloadV864(payload);
    return payload;
  };
}

const normalizeExpensePayloadBeforeV864 = typeof normalizeExpensePayload === "function" ? normalizeExpensePayload : null;
normalizeExpensePayload = function(payload, type) {
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
  buildForm = function(type, data = {}) {
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
function ensureSettlementPanelV87() {
  const page = document.getElementById("page-student-settlement") || document.querySelector("[data-page='student-settlement']");
  if (!page || page.querySelector("#settlementLockPanelV87")) return;
  const html = `
    <section class="settlement-lock-panel-v87" id="settlementLockPanelV87">
      <div class="section-title-row">
        <div><h3>结算确认 / 锁定</h3><p class="muted-small">确认本月结算结果，并处理汇率差额、尾差、小额差异。</p></div>
        <button class="secondary-btn" id="refreshSettlementLockV87">刷新计算</button>
      </div>
      <div class="settlement-lock-grid-v87">
        <div class="settlement-lock-summary-v87">
          <div class="settlement-lock-row-v87"><span>系统计算差额</span><strong id="settlementSystemDiffV87">暂未计算</strong></div>
          <div class="settlement-lock-row-v87"><span>调整后结转</span><strong id="settlementCarryoverV87">暂未计算</strong></div>
          <div class="settlement-lock-row-v87"><span>结算状态</span><strong id="settlementStatusTextV87">暂未计算</strong></div>
        </div>
        <div class="settlement-lock-form-v87">
          <label><span>差额处理方式</span><select id="settlementAdjustModeV87"><option value="carry">按最终差额结转</option><option value="clear">抹平差额</option><option value="custom">手动调整</option></select></label>
          <label><span>手动调整金额（人民币）</span><input id="settlementAdjustmentAmountV87" type="number" step="1" value="0" /></label>
          <label class="full"><span>调整原因 / 备注</span><textarea id="settlementAdjustmentReasonV87" rows="2" placeholder="例：汇率差额抹平"></textarea></label>
          <div class="settlement-lock-actions-v87"><button class="secondary-btn" id="previewSettlementLockV87">预览结果</button><button class="primary-btn" id="lockSettlementV87">确认并锁定本月结算</button><button class="danger-btn" id="unlockSettlementV932" type="button">撤销本月锁定</button></div>
        </div>
      </div>
      <div class="settlement-lock-history-v87" id="settlementLockHistoryV87"></div>
    </section>`;
  const anchor = page.querySelector("#settlementLessonsTable")?.closest(".section-card, .card, .table-wrap") || page.querySelector(".section-card:last-of-type") || page;
  anchor.insertAdjacentHTML("afterend", html);
  bindSettlementLockPanelV87();
}
function adjustmentFromPanelV87() {
  const mode = document.getElementById("settlementAdjustModeV87")?.value || "carry";
  const base = computeSettlementSnapshotV87(0, "");
  if (!base) return { adjustment: 0, reason: "" };
  if (mode === "clear") return { adjustment: -roundCnyV87(base.system_difference_cny), reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "汇率差额/尾差抹平" };
  if (mode === "custom") return { adjustment: Number(document.getElementById("settlementAdjustmentAmountV87")?.value || 0), reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "手动调整" };
  return { adjustment: 0, reason: document.getElementById("settlementAdjustmentReasonV87")?.value || "" };
}
function updateSettlementLockPreviewV87() {
  ensureSettlementPanelV87();
  const mode = document.getElementById("settlementAdjustModeV87")?.value || "carry";
  const base = computeSettlementSnapshotV87(0, "");
  if (!base) return;
  if (mode === "clear") {
    const input = document.getElementById("settlementAdjustmentAmountV87");
    if (input) input.value = String(-roundCnyV87(base.system_difference_cny));
    const reason = document.getElementById("settlementAdjustmentReasonV87");
    if (reason && !reason.value) reason.value = "汇率差额/尾差抹平";
  }
  const input = document.getElementById("settlementAdjustmentAmountV87");
  if (input) {
    if (mode === "carry") {
      input.value = "0";
      input.disabled = true;
      input.title = "按最终差额结转时，结转金额等于系统计算差额，不再单独修改。需要修正时请选择手动调整。";
    } else {
      input.disabled = false;
      input.title = "";
    }
  }
  const adj = adjustmentFromPanelV87();
  const result = computeSettlementSnapshotV87(adj.adjustment, adj.reason);
  if (!result) return;
  const diffEl = document.getElementById("settlementSystemDiffV87");
  const carryEl = document.getElementById("settlementCarryoverV87");
  const statusEl = document.getElementById("settlementStatusTextV87");
  if (diffEl) { diffEl.textContent = signedCnyV87(result.system_difference_cny); diffEl.className = `settlement-result ${settlementStatusClassV87(result.system_difference_cny)}`; }
  if (carryEl) { carryEl.textContent = signedCnyV87(result.carryover_amount_cny); carryEl.className = `settlement-result ${settlementStatusClassV87(result.carryover_amount_cny)}`; }
  if (statusEl) { statusEl.textContent = settlementStatusLabelV87(result.carryover_amount_cny); statusEl.className = `settlement-result ${settlementStatusClassV87(result.carryover_amount_cny)}`; }
  const finalEl = document.getElementById("settlementFinalStatusCny");
  if (finalEl) {
    const label = settlementStatusLabelV87(result.carryover_amount_cny);
    finalEl.textContent = roundCnyV87(result.carryover_amount_cny) === 0 ? "已结清" : `${label}：${signedCnyV87(result.carryover_amount_cny)}`;
    finalEl.className = `settlement-result ${settlementStatusClassV87(result.carryover_amount_cny)}`;
  }
}
async function fetchSettlementLockHistoryV87() {
  const { month, studentId } = selectedSettlementContextV87();
  const history = document.getElementById("settlementLockHistoryV87");
  if (!history || !studentId) return;
  try {
    const { data, error } = await supabase.from(SETTLEMENTS_TABLE_V87).select("*").eq("student_id", studentId).eq("year_month", month).maybeSingle();
    if (error && error.code !== "PGRST116") throw error;
    if (!data) { history.innerHTML = `<div class="muted-small">当前月份尚未锁定。</div>`; return; }
    history.innerHTML = `<div class="locked-settlement-v87"><strong>已锁定：</strong><span>${esc(data.year_month)}</span><span>${esc(settlementStatusLabelV87(data.carryover_amount_cny))}</span><span>结转 ${signedCnyV87(data.carryover_amount_cny)}</span><span>调整 ${signedCnyV87(data.adjustment_amount_cny)}</span><span>${data.locked_at ? esc(new Date(data.locked_at).toLocaleString()) : ""}</span></div>`;
  } catch (error) {
    history.innerHTML = `<div class="error-text">读取结算锁定状态失败：${esc(error.message || error)}</div>`;
  }
}
async function lockSettlementV87() {
  const adj = adjustmentFromPanelV87();
  const snapshot = computeSettlementSnapshotV87(adj.adjustment, adj.reason);
  if (!snapshot) { alert("请先选择学生和月份。"); return; }
  const ok = confirm(`确认锁定 ${snapshot.year_month} 的结算吗？\n状态：${settlementStatusLabelV87(snapshot.carryover_amount_cny)}\n结转：${signedCnyV87(snapshot.carryover_amount_cny)}`);
  if (!ok) return;
  const payload = { ...snapshot };
  delete payload.student;
  try {
    const { data: saved, error } = await supabase.from(SETTLEMENTS_TABLE_V87)
      .upsert(payload, { onConflict: "student_id,year_month" })
      .select("id")
      .single();
    if (error) throw error;
    await upsertStudentCarryoverV987(supabase, snapshot, saved?.id || null);
    window.__studentSettlementCarryoverV987 = {
      month: nextMonthV987(snapshot.year_month),
      studentId: snapshot.student_id,
      amount: Number(snapshot.carryover_amount_cny || 0),
    };
    alert("结算已锁定，并已写入下月结转记录。");
    await fetchSettlementLockHistoryV87();
  } catch (error) {
    alert(`锁定结算失败：${error.message || error}`);
  }
}
function bindSettlementLockPanelV87() {
  document.getElementById("refreshSettlementLockV87")?.addEventListener("click", () => { updateSettlementLockPreviewV87(); fetchSettlementLockHistoryV87(); });
  document.getElementById("previewSettlementLockV87")?.addEventListener("click", updateSettlementLockPreviewV87);
  document.getElementById("lockSettlementV87")?.addEventListener("click", lockSettlementV87);
  document.getElementById("unlockSettlementV932")?.addEventListener("click", unlockSettlementV932);
  document.getElementById("settlementAdjustModeV87")?.addEventListener("change", updateSettlementLockPreviewV87);
  document.getElementById("settlementAdjustmentAmountV87")?.addEventListener("input", (e) => { if (e.target?.disabled) return; const mode = document.getElementById("settlementAdjustModeV87"); if (mode) mode.value = "custom"; updateSettlementLockPreviewV87(); });
  document.getElementById("settlementAdjustmentReasonV87")?.addEventListener("input", updateSettlementLockPreviewV87);
}
const renderStudentSettlementBeforeV87 = typeof renderStudentSettlement === "function" ? renderStudentSettlement : null;
if (renderStudentSettlementBeforeV87) {
  renderStudentSettlement = function() {
    renderStudentSettlementBeforeV87();
    ensureSettlementPanelV87();
    updateSettlementLockPreviewV87();
    fetchSettlementLockHistoryV87();
    refreshStudentSettlementButtonStateV932();
  };
}
document.addEventListener("DOMContentLoaded", () => {
  document.body.addEventListener("change", (e) => {
    if (e.target?.id === "settlementMonthFilter" || e.target?.id === "settlementStudentFilter") {
      const history = document.getElementById("settlementLockHistoryV87");
      if (history) history.innerHTML = `<div class="muted-small">正在切换结算月份...</div>`;
      setStudentSettlementLockButtonStateV932(false);
      setTimeout(() => {
        updateSettlementLockPreviewV87();
        fetchSettlementLockHistoryV87();
        refreshStudentSettlementButtonStateV932();
      }, 0);
    }
  }, true);

  setTimeout(() => { ensureSettlementPanelV87(); updateSettlementLockPreviewV87(); fetchSettlementLockHistoryV87(); refreshStudentSettlementButtonStateV932(); }, 1000);
});
const renderAllBeforeV87 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV87) {
  renderAll = function() {
    renderAllBeforeV87();
    ensureSettlementPanelV87();
    if (document.getElementById("page-student-settlement")?.classList.contains("active")) {
      updateSettlementLockPreviewV87();
      fetchSettlementLockHistoryV87();
      refreshStudentSettlementButtonStateV932();
    }
  };
}



// === v8.7.1 fixes: db client, stable actual link, import batch undo ===
function dbClientV871() {
  return (typeof db !== "undefined" && db?.from) ? db : ((typeof supabase !== "undefined" && supabase?.from) ? supabase : null);
}

// Fix v8.7 error: supabase.from is not a function. Use existing db client.
let studentSettlementLockHistoryRequestV942 = 0;

async function fetchSettlementLockHistoryV871() {
  const requestId = ++studentSettlementLockHistoryRequestV942;
  const { month, studentId } = selectedSettlementContextV87 ? selectedSettlementContextV87() : { month: "", studentId: "" };
  const history = document.getElementById("settlementLockHistoryV87");
  if (!history) return;

  const currentContextStillSame = () => {
    const now = selectedSettlementContextV87 ? selectedSettlementContextV87() : { month: "", studentId: "" };
    return requestId === studentSettlementLockHistoryRequestV942 && now.month === month && now.studentId === studentId;
  };

  if (!studentId || !month) {
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="muted-small">请选择学生和月份。</div>`;
    return;
  }

  setStudentSettlementLockButtonStateV932(false);
  history.innerHTML = `<div class="muted-small">正在读取 ${esc(month)} 的锁定状态...</div>`;

  const client = dbClientV871();
  if (!client) {
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="error-text">读取结算锁定状态失败：数据库客户端未初始化</div>`;
    return;
  }
  try {
    const { data, error } = await client
      .from(SETTLEMENTS_TABLE_V87)
      .select("*")
      .eq("student_id", studentId)
      .eq("year_month", month)
      .eq("settlement_status", "locked")
      .maybeSingle();

    if (!currentContextStillSame()) return;

    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      setStudentSettlementLockButtonStateV932(false);
      history.innerHTML = `<div class="muted-small">当前月份尚未锁定。</div>`;
      return;
    }

    setStudentSettlementLockButtonStateV932(true);

    history.innerHTML = `
      <div class="locked-settlement-v87">
        <strong>已锁定：</strong>
        <span>${esc(data.year_month)}</span>
        <span>${esc(settlementStatusLabelV87(data.carryover_amount_cny))}</span>
        <span>结转 ${signedCnyV87(data.carryover_amount_cny)}</span>
        <span>调整 ${signedCnyV87(data.adjustment_amount_cny)}</span>
        <span>${data.locked_at ? esc(new Date(data.locked_at).toLocaleString()) : ""}</span>
      </div>
    `;
  } catch (error) {
    if (!currentContextStillSame()) return;
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="error-text">读取结算锁定状态失败：${esc(error.message || error)}</div>`;
  }
}


function setStudentSettlementLockButtonStateV932(hasLocked) {
  const lockBtn = document.getElementById("lockSettlementV87");
  const unlockBtn = document.getElementById("unlockSettlementV932");

  if (lockBtn) {
    lockBtn.disabled = !!hasLocked;
    lockBtn.title = hasLocked ? "当前学生月份已经锁定，请先撤销后再重新锁定。" : "";
  }

  if (unlockBtn) {
    unlockBtn.disabled = !hasLocked;
    unlockBtn.title = hasLocked ? "" : "当前学生月份尚未锁定。";
  }
}

async function getCurrentStudentSettlementLockV932() {
  const { month, studentId } = selectedSettlementContextV87 ? selectedSettlementContextV87() : { month: "", studentId: "" };
  if (!studentId || !month) return null;
  const client = dbClientV871();
  if (!client) return null;

  const { data, error } = await client
    .from(SETTLEMENTS_TABLE_V87)
    .select("*")
    .eq("student_id", studentId)
    .eq("year_month", month)
    .eq("settlement_status", "locked")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.warn("student settlement lock state check failed", error);
    return null;
  }
  return data || null;
}

async function refreshStudentSettlementButtonStateV932() {
  const lock = await getCurrentStudentSettlementLockV932();
  setStudentSettlementLockButtonStateV932(!!lock);
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

async function unlockSettlementV932() {
  const lock = await getCurrentStudentSettlementLockV932();
  if (!lock) {
    alert("当前学生月份尚未锁定。");
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
    return;
  }

  const ok = confirm(`确定撤销 ${lock.year_month} 的学生月度结算锁定吗？\n\n撤销后可重新修改课时和学费收入记录。`);
  if (!ok) return;

  const client = dbClientV871();
  if (!client) {
    alert("撤销锁定失败：数据库客户端未初始化");
    return;
  }

  try {
    const { error } = await client
      .from(SETTLEMENTS_TABLE_V87)
      .update({
        settlement_status: "unlocked",
        locked_at: null
      })
      .eq("id", lock.id);

    if (error) throw error;
    await voidStudentCarryoverV987(client, lock);
    alert("学生月度结算锁定已撤销。");
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
  } catch (error) {
    alert(`撤销锁定失败：${error.message || error}`);
  }
}

async function lockSettlementV871() {
  const adj = adjustmentFromPanelV87();
  const snapshot = computeSettlementSnapshotV87(adj.adjustment, adj.reason);
  if (!snapshot) {
    alert("请先选择学生和月份。");
    return;
  }
  const ok = confirm(`确认锁定 ${snapshot.year_month} 的结算吗？\n状态：${settlementStatusLabelV87(snapshot.carryover_amount_cny)}\n结转：${signedCnyV87(snapshot.carryover_amount_cny)}`);
  if (!ok) return;

  const client = dbClientV871();
  if (!client) {
    alert("锁定结算失败：数据库客户端未初始化");
    return;
  }

  const payload = { ...snapshot };
  delete payload.student;

  try {
    const { data: saved, error } = await client
      .from(SETTLEMENTS_TABLE_V87)
      .upsert(payload, { onConflict: "student_id,year_month" })
      .select("id")
      .single();
    if (error) throw error;
    await upsertStudentCarryoverV987(client, snapshot, saved?.id || null);
    window.__studentSettlementCarryoverV987 = {
      month: nextMonthV987(snapshot.year_month),
      studentId: snapshot.student_id,
      amount: Number(snapshot.carryover_amount_cny || 0),
    };
    alert("结算已锁定，并已写入下月结转记录。");
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
  } catch (error) {
    alert(`锁定结算失败：${error.message || error}`);
  }
}

// Override v8.7 functions if present.
fetchSettlementLockHistoryV87 = fetchSettlementLockHistoryV871;
lockSettlementV87 = lockSettlementV871;

// Force generated actual lesson to persist the clicked planned row ID.
function rememberPendingActualPlanV871(planId) {
  state.pendingActualPlanId = planId || "";
  if (planId) sessionStorage.setItem("pendingActualPlanIdV871", planId);
}

function consumePendingActualPlanV871() {
  return state.pendingActualPlanId || sessionStorage.getItem("pendingActualPlanIdV871") || "";
}

const normalizeLessonPayloadBeforeV871 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  if (normalizeLessonPayloadBeforeV871) payload = normalizeLessonPayloadBeforeV871(payload, type);

  if (type === "lesson" && payload?.lesson_type === "actual") {
    const pending = consumePendingActualPlanV871();
    if (pending && !payload.planned_lesson_id) payload.planned_lesson_id = pending;
  }

  if (type === "lesson" && payload?.lesson_type === "planned") {
    payload.planned_lesson_id = null;
  }

  return payload;
};

function makeActualFromPlannedV871(id) {
  const plan = state.lessonRecords.find(x => x.id === id);
  if (!plan) return;

  rememberPendingActualPlanV871(plan.id);

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
    unit_price: plan.unit_price || 0,
    lesson_fee: Number(plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0),
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  openCreateModal("lesson", prefill);

  const form = document.getElementById("modalForm");
  let hidden = form?.querySelector('input[name="planned_lesson_id"]');
  if (!hidden && form) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  if (hidden) hidden.value = plan.id;

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";

  if (typeof attachLessonAutoCalcV86 === "function") attachLessonAutoCalcV86();
}
makeActualFromPlanned = makeActualFromPlannedV871;

// Add import fields into lesson whitelist if previous code has whitelist sanitizer.
const normalizePayloadBeforeImportBatchV871 = typeof normalizePayload === "function" ? normalizePayload : null;
if (normalizePayloadBeforeImportBatchV871) {
  normalizePayload = function(payload, type) {
    payload = normalizePayloadBeforeImportBatchV871(payload, type);
    return payload;
  };
}

function newImportBatchIdV871() {
  return `lesson_import_${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${Math.random().toString(36).slice(2, 8)}`;
}

function selectedImportStudentNameV871() {
  const select = document.getElementById("lessonStudentFilter");
  return select?.selectedOptions?.[0]?.textContent?.trim() || "";
}

function ensureImportUndoPanelV871() {
  const page = document.getElementById("page-lessons") || document.querySelector("[data-page='lessons']");
  if (!page || page.querySelector("#lessonImportUndoPanelV871")) return;

  const toolbar =
    document.getElementById("lessonImportExcelBtn")?.closest(".toolbar, .actions, .page-actions, .section-title-row") ||
    page.querySelector(".section-title-row") ||
    page;

  toolbar.insertAdjacentHTML("beforeend", `
    <button class="secondary-btn" id="undoLastLessonImportV871" style="display:none;">撤回本次导入</button>
  `);

  document.getElementById("undoLastLessonImportV871")?.addEventListener("click", undoLastLessonImportV871);
}

function saveLastImportBatchV871(info) {
  localStorage.setItem("lastLessonImportBatchV871", JSON.stringify(info));
  updateUndoImportButtonV871();
}

function lastImportBatchV871() {
  try { return JSON.parse(localStorage.getItem("lastLessonImportBatchV871") || "null"); }
  catch { return null; }
}

function updateUndoImportButtonV871() {
  const btn = document.getElementById("undoLastLessonImportV871");
  if (!btn) return;
  const info = lastImportBatchV871();
  if (info?.batchId) {
    btn.style.display = "";
    btn.textContent = `撤回本次导入（${info.count || 0}条）`;
  } else {
    btn.style.display = "none";
  }
}

async function undoLastLessonImportV871() {
  const info = lastImportBatchV871();
  if (!info?.batchId) {
    showMessage("没有可撤回的导入批次。", "error");
    return;
  }

  const ok = confirm(`确认撤回本次导入吗？\n学生：${info.studentName || ""}\n文件：${info.fileName || ""}\n记录数：${info.count || 0}\n\n撤回后会删除该批次导入的课时记录。`);
  if (!ok) return;

  const client = dbClientV871();
  if (!client) {
    showMessage("撤回失败：数据库客户端未初始化。", "error");
    return;
  }

  const { error } = await client
    .from(tables.lessons)
    .delete()
    .eq("import_batch_id", info.batchId);

  if (error) {
    showMessage(`撤回失败：${error.message}`, "error");
    return;
  }

  localStorage.removeItem("lastLessonImportBatchV871");
  await loadAll();
  renderAll();
  updateUndoImportButtonV871();
  showMessage(`已撤回本次导入：${info.count || 0} 条。`, "ok");
}

async function importLessonExcelFileV871(file) {
  if (!lessonExcelRequireXLSX()) return;

  const ctx = selectedLessonImportContext();
  if (!ctx.studentId) {
    showMessage("导入前请先在课时管理筛选中选择学生。", "error");
    return;
  }

  const studentName = selectedImportStudentNameV871();
  const businessEntityId = state.students.find(x => x.id === ctx.studentId)?.business_entity_id || state.businessEntities[0]?.id || "";
  const fallbackTeacherId = ctx.teacherId || "";
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const headerIndex = findLessonImportHeaderRow(rows);
  if (headerIndex < 0) {
    showMessage("没有找到包含「科目 / 日期 / 时长」的预定课时表头。", "error");
    return;
  }

  const col = buildLessonImportColumnMap(rows[headerIndex]);
  const records = [];
  let currentTeacherText = "";
  let currentSubjectText = "";
  let skipped = 0;
  const batchId = newImportBatchIdV871();
  const importedAt = new Date().toISOString();

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const lineText = row.map(x => String(x || "").trim()).join("");
    if (!lineText) continue;
    if (/合计|小计|總計|总计/.test(lineText)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) currentTeacherText = teacherCell;
    if (subjectCell) currentSubjectText = subjectCell;

    const dateValue = col.date !== undefined ? row[col.date] : "";
    const durationRaw = col.duration !== undefined ? row[col.duration] : "";
    const weekStart = parseLessonExcelWeekStart(dateValue, ctx.baseYear);
    const duration = numericExcelValue(durationRaw);

    if (!weekStart || !duration) {
      skipped++;
      continue;
    }

    const subjectId = subjectIdFromExcelName(currentSubjectText) || ctx.subjectId;
    const teacherId = teacherIdFromExcelName(currentTeacherText) || fallbackTeacherId;

    if (!subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const unitPrice = col.unitPrice !== undefined ? numericExcelValue(row[col.unitPrice]) : 0;
    const lessonFee = col.lessonFee !== undefined ? numericExcelValue(row[col.lessonFee]) : (unitPrice && duration ? unitPrice * duration : 0);
    const yearMonth = `${weekStart.getFullYear()}-${String(weekStart.getMonth() + 1).padStart(2, "0")}`;

    records.push({
      lesson_type: "planned",
      lesson_date: formatDateYmd(weekStart),
      year_month: yearMonth,
      student_id: ctx.studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId || null,
      start_time: col.start !== undefined ? String(row[col.start] || "") : "",
      end_time: col.end !== undefined ? String(row[col.end] || "") : "",
      duration_hours: duration,
      unit_price: unitPrice || 0,
      lesson_fee: lessonFee || 0,
      lesson_content: col.content !== undefined ? String(row[col.content] || "") : "",
      status: "planned",
      is_billable: true,
      note: `Excel导入：${sheetName} / ${weekLabelFromDate(weekStart)}${col.count !== undefined && row[col.count] ? " / 回数:" + row[col.count] : ""}`,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    });
  }

  if (!records.length) {
    showMessage("没有读取到可导入的课时记录。请确认已选择学生，且模板中有日期、时长、科目和担当老师。", "error");
    return;
  }

  const totalFee = records.reduce((sum, x) => sum + Number(x.lesson_fee || 0), 0);
  const ok = confirm(`即将导入课时：\n\n学生：${studentName}\n文件：${file.name}\n读取记录：${records.length} 条\n预定课时费合计：${totalFee.toLocaleString()} JPY\n跳过行数：${skipped}\n\n确认导入吗？`);
  if (!ok) return;

  const client = dbClientV871();
  if (!client) {
    showMessage("导入失败：数据库客户端未初始化。", "error");
    return;
  }

  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  saveLastImportBatchV871({
    batchId,
    studentId: ctx.studentId,
    studentName,
    fileName: file.name,
    count: records.length,
    importedAt,
  });

  await loadAll();
  renderAll();
  showMessage(`已导入 ${records.length} 条预定课时。可点击“撤回本次导入”删除本批次。`, "ok");
}

importLessonExcelFile = importLessonExcelFileV871;

function bindLessonExcelActionsV871() {
  ensureImportUndoPanelV871();

  const importBtn = document.getElementById("lessonImportExcelBtn");
  const importInput = document.getElementById("lessonImportExcelInput");
  const exportBtn = document.getElementById("lessonExportExcelBtn");

  if (importBtn) {
    importBtn.onclick = () => {
      const studentId = document.getElementById("lessonStudentFilter")?.value || "";
      if (!studentId) {
        showMessage("请先在课时管理筛选中选择学生，再导入 Excel。", "error");
        return;
      }
      importInput?.click();
    };
  }

  if (importInput) {
    importInput.onchange = async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      await importLessonExcelFileV871(file);
      importInput.value = "";
    };
  }

  if (exportBtn && typeof exportCurrentLessonsExcel === "function") {
    exportBtn.onclick = exportCurrentLessonsExcel;
  }

  updateUndoImportButtonV871();
}

bindLessonExcelActions = bindLessonExcelActionsV871;

// Bind v8.7.1 lesson buttons and actual generation
function bindLessonButtonsV871() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = () => makeActualFromPlannedV871(btn.dataset.createActual);
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    if (typeof copyLessonRecordV86 === "function") btn.onclick = () => copyLessonRecordV86(btn.dataset.copyLesson);
    else if (typeof copyLessonRecordV59 === "function") btn.onclick = () => copyLessonRecordV59(btn.dataset.copyLesson);
  });
}
bindLessonPairButtonsV59 = bindLessonButtonsV871;

const renderLessonsBeforeV871 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV871) {
  renderLessons = function() {
    renderLessonsBeforeV871();
    bindLessonButtonsV871();
    bindLessonExcelActionsV871();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindLessonButtonsV871();
    bindLessonExcelActionsV871();
    fetchSettlementLockHistoryV871();
  }, 1000);
});

const renderAllBeforeV871 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV871) {
  renderAll = function() {
    renderAllBeforeV871();
    bindLessonButtonsV871();
    bindLessonExcelActionsV871();
  };
}



// === v8.7.2 strict lesson row link fix + duplicate planned warning ===
function planIdTextV872(value) {
  return String(value || "").trim();
}

function setPendingActualPlanV872(planId) {
  const id = planIdTextV872(planId);
  state.pendingActualPlanId = id;
  state.pendingActualPlanIdV872 = id;
  if (id) sessionStorage.setItem("pendingActualPlanIdV872", id);
}

function getPendingActualPlanV872() {
  return planIdTextV872(
    state.pendingActualPlanIdV872 ||
    state.pendingActualPlanId ||
    sessionStorage.getItem("pendingActualPlanIdV872") ||
    sessionStorage.getItem("pendingActualPlanIdV871")
  );
}

function clearPendingActualPlanV872() {
  state.pendingActualPlanId = "";
  state.pendingActualPlanIdV872 = "";
  sessionStorage.removeItem("pendingActualPlanIdV872");
  sessionStorage.removeItem("pendingActualPlanIdV871");
}

function ensureActualHiddenPlanFieldV872(planId) {
  const form = document.getElementById("modalForm");
  if (!form) return;
  let hidden = form.querySelector('input[name="planned_lesson_id"]');
  if (!hidden) {
    hidden = document.createElement("input");
    hidden.type = "hidden";
    hidden.name = "planned_lesson_id";
    form.appendChild(hidden);
  }
  hidden.value = planIdTextV872(planId);
}

function makeActualFromPlannedV872(id) {
  const plan = state.lessonRecords.find(x => String(x.id) === String(id));
  if (!plan) return;

  setPendingActualPlanV872(plan.id);

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
    unit_price: plan.unit_price || 0,
    lesson_fee: Number(plan.lesson_fee || (Number(plan.unit_price || 0) * Number(plan.duration_hours || 0)) || 0),
    status: "completed",
    is_billable: plan.is_billable !== false,
    lesson_content: "",
    note: "",
  };

  openCreateModal("lesson", prefill);
  ensureActualHiddenPlanFieldV872(plan.id);

  const title = document.getElementById("modalTitle");
  if (title) title.textContent = "从预定生成实际课时";
  if (typeof attachLessonAutoCalcV86 === "function") attachLessonAutoCalcV86();
}

makeActualFromPlanned = makeActualFromPlannedV872;
makeActualFromPlannedV871 = makeActualFromPlannedV872;

document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("[data-create-actual]");
  if (!btn) return;
  const planId = btn.dataset.createActual;
  if (!planId) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  makeActualFromPlannedV872(planId);
}, true);

document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!form || form.id !== "modalForm") return;
  if (state.editing?.type !== "lesson") return;

  const fd = new FormData(form);
  const lessonType = fd.get("lesson_type");
  if (lessonType !== "actual") return;

  const hiddenPlan = planIdTextV872(form.querySelector('input[name="planned_lesson_id"]')?.value);
  const pending = hiddenPlan || getPendingActualPlanV872();
  if (pending) {
    setPendingActualPlanV872(pending);
    ensureActualHiddenPlanFieldV872(pending);
  }
}, true);

const normalizeLessonPayloadBeforeV872 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  if (normalizeLessonPayloadBeforeV872) payload = normalizeLessonPayloadBeforeV872(payload, type);

  if (type === "lesson" && payload?.lesson_type === "actual" && !state.editing?.id) {
    const pending = getPendingActualPlanV872();
    if (pending) payload.planned_lesson_id = pending;
  }

  if (type === "lesson" && payload?.lesson_type === "planned") {
    payload.planned_lesson_id = null;
  }

  return payload;
};

const repairLessonPlannedLinkAfterSaveBeforeV872 = typeof repairLessonPlannedLinkAfterSave === "function" ? repairLessonPlannedLinkAfterSave : null;
repairLessonPlannedLinkAfterSave = async function(type, payload, saved) {
  if (repairLessonPlannedLinkAfterSaveBeforeV872) {
    await repairLessonPlannedLinkAfterSaveBeforeV872(type, payload, saved);
  }

  if (type !== "lesson" || payload?.lesson_type !== "actual" || !saved?.id) return;
  const planId = planIdTextV872(payload.planned_lesson_id || getPendingActualPlanV872());
  if (!planId) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : ((typeof supabase !== "undefined" && supabase?.from) ? supabase : null);
  if (!client) return;

  if (String(saved.planned_lesson_id || "") !== planId) {
    const { error } = await client.from(tables.lessons).update({ planned_lesson_id: planId }).eq("id", saved.id);
    if (error) console.warn("v8.7.2 planned_lesson_id repair failed", error);
  }
};

function plannedDuplicateKeyV872(item) {
  return [
    item.student_id || "",
    item.lesson_date || "",
    item.teacher_id || "",
    item.subject_id || "",
    item.start_time || "",
    item.end_time || "",
  ].join("|");
}

function plannedDuplicateCountMapV872(rows) {
  const map = new Map();
  rows.filter(x => x.lesson_type === "planned").forEach(item => {
    const key = plannedDuplicateKeyV872(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

function isDuplicatePlannedV872(item, countMap) {
  return item?.lesson_type === "planned" && (countMap.get(plannedDuplicateKeyV872(item)) || 0) > 1;
}

function appendDuplicateWarningToPlannedCellsV872(html, item, countMap) {
  if (!isDuplicatePlannedV872(item, countMap)) return html;
  const warning = `<div class="duplicate-planned-warning-v872">重复预定：请确认日期或时间</div>`;
  return html.replace('</td>\n    <td class="col-student">', `${warning}</td>\n    <td class="col-student">`);
}

function buildLessonPairsStrictV872(rows) {
  const planned = rows.filter(x => x.lesson_type === "planned").slice();
  const actual = rows.filter(x => x.lesson_type === "actual");
  const actualByPlan = new Map();
  const unlinkedActual = [];

  const plannedSort =
    typeof comparePlannedLessonsV86 === "function"
      ? comparePlannedLessonsV86
      : (typeof compareLessonsV78 === "function" ? compareLessonsV78 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));

  const dateSort =
    typeof compareDateTimeV86 === "function"
      ? compareDateTimeV86
      : (typeof compareDateTimeAscV854 === "function" ? compareDateTimeAscV854 : (a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")));

  planned.sort((a, b) => {
    const r = plannedSort(a, b);
    if (r !== 0) return r;
    return String(a.created_at || a.id || "").localeCompare(String(b.created_at || b.id || ""));
  });

  actual.forEach(row => {
    const planId = planIdTextV872(row.planned_lesson_id);
    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  actualByPlan.forEach(list => list.sort(dateSort));
  unlinkedActual.sort(dateSort);
  return { planned, actualByPlan, unlinkedActual, dateSort, countMap: plannedDuplicateCountMapV872(rows) };
}

function renderLessonRowsStrictV872(rows) {
  const { planned, actualByPlan, unlinkedActual, dateSort, countMap } = buildLessonPairsStrictV872(rows);
  const html = [];
  let lastMonth = "";

  const cell = typeof lessonCellV86 === "function" ? lessonCellV86 : (typeof lessonPairCellsV858 === "function" ? lessonPairCellsV858 : lessonPairCells);

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  planned.forEach(plan => {
    addMonthRow(plan.year_month || "未归属月份");
    const actuals = (actualByPlan.get(planIdTextV872(plan.id)) || []).slice().sort(dateSort);
    const plannedCell = appendDuplicateWarningToPlannedCellsV872(cell(plan, "planned"), plan, countMap);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310 ${isDuplicatePlannedV872(plan, countMap) ? "duplicate-planned-row-v872" : ""}">${plannedCell}${cell(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((actual, index) => {
      const left = index === 0 ? plannedCell : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310 ${isDuplicatePlannedV872(plan, countMap) ? "duplicate-planned-row-v872" : ""}">${left}${cell(actual, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${cell(null, "planned")}${cell(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsStrictV872() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsStrictV872(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;
  bindLessonButtonsStrictV872();
  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
  if (typeof bindLessonExcelActionsV871 === "function") bindLessonExcelActionsV871();
}

function bindLessonButtonsStrictV872() {
  document.querySelectorAll("[data-create-actual]").forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      makeActualFromPlannedV872(btn.dataset.createActual);
    };
  });
  document.querySelectorAll("[data-copy-lesson]").forEach(btn => {
    btn.onclick = () => {
      if (typeof copyLessonRecordV86 === "function") copyLessonRecordV86(btn.dataset.copyLesson);
      else if (typeof copyLessonRecordV59 === "function") copyLessonRecordV59(btn.dataset.copyLesson);
    };
  });
}

renderLessonRowsV86 = renderLessonRowsStrictV872;
renderLessonRowsV855 = renderLessonRowsStrictV872;
renderLessonRowsV858 = renderLessonRowsStrictV872;
renderLessons = renderLessonsStrictV872;
bindLessonPairButtonsV59 = bindLessonButtonsStrictV872;

const closeModalBeforeV872 = typeof closeModal === "function" ? closeModal : null;
if (closeModalBeforeV872) {
  closeModal = function() {
    closeModalBeforeV872();
    setTimeout(clearPendingActualPlanV872, 1500);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsStrictV872();
    bindLessonButtonsStrictV872();
  }, 1000);
});

const renderAllBeforeV872 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV872) {
  renderAll = function() {
    renderAllBeforeV872();
    renderLessonsStrictV872();
  };
}



// === v8.7.3 stable duplicate planned row order ===
function duplicateContentKeyV873(item) {
  return String(item?.lesson_content || item?.note || "").trim().toLocaleLowerCase("ja-JP");
}

function naturalCompareV873(a, b) {
  return String(a || "").localeCompare(String(b || ""), "ja-JP", {
    numeric: true,
    sensitivity: "base",
  });
}

function basePlannedSortV873(a, b) {
  const sort =
    typeof comparePlannedLessonsV86 === "function"
      ? comparePlannedLessonsV86
      : (typeof compareLessonsV78 === "function"
        ? compareLessonsV78
        : ((x, y) => String(x.lesson_date || "").localeCompare(String(y.lesson_date || ""))));
  return sort(a, b);
}

function stableDuplicatePlannedSortV873(a, b) {
  const base = basePlannedSortV873(a, b);
  if (base !== 0) return base;

  const duplicateKeyA = typeof plannedDuplicateKeyV872 === "function" ? plannedDuplicateKeyV872(a) : "";
  const duplicateKeyB = typeof plannedDuplicateKeyV872 === "function" ? plannedDuplicateKeyV872(b) : "";

  if (duplicateKeyA && duplicateKeyA === duplicateKeyB) {
    const content = naturalCompareV873(duplicateContentKeyV873(a), duplicateContentKeyV873(b));
    if (content !== 0) return content;
  }

  const created = String(a.created_at || "").localeCompare(String(b.created_at || ""));
  if (created !== 0) return created;

  return String(a.id || "").localeCompare(String(b.id || ""));
}

function buildLessonPairsStrictV873(rows) {
  const planned = rows.filter(x => x.lesson_type === "planned").slice();
  const actual = rows.filter(x => x.lesson_type === "actual");
  const actualByPlan = new Map();
  const unlinkedActual = [];

  const dateSort =
    typeof compareDateTimeV86 === "function"
      ? compareDateTimeV86
      : (typeof compareDateTimeAscV854 === "function"
        ? compareDateTimeAscV854
        : ((a, b) => String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""))));

  planned.sort(stableDuplicatePlannedSortV873);

  actual.forEach(row => {
    const planId = typeof planIdTextV872 === "function"
      ? planIdTextV872(row.planned_lesson_id)
      : String(row.planned_lesson_id || "").trim();

    if (planId) {
      if (!actualByPlan.has(planId)) actualByPlan.set(planId, []);
      actualByPlan.get(planId).push(row);
    } else {
      unlinkedActual.push(row);
    }
  });

  actualByPlan.forEach(list => list.sort(dateSort));
  unlinkedActual.sort(dateSort);

  return {
    planned,
    actualByPlan,
    unlinkedActual,
    dateSort,
    countMap: typeof plannedDuplicateCountMapV872 === "function" ? plannedDuplicateCountMapV872(rows) : new Map(),
  };
}

function appendDuplicateWarningToPlannedCellsV873(html, item, countMap) {
  const isDup = typeof isDuplicatePlannedV872 === "function" && isDuplicatePlannedV872(item, countMap);
  if (!isDup) return html;

  const warning = `<div class="duplicate-planned-warning-v872">重复预定：请确认日期或时间</div>`;
  const hint = `<div class="duplicate-planned-order-hint-v873">同条件重复时，按上课内容稳定排序</div>`;
  return html.replace('</td>\n    <td class="col-student">', `${warning}${hint}</td>\n    <td class="col-student">`);
}

function renderLessonRowsStrictV873(rows) {
  const { planned, actualByPlan, unlinkedActual, dateSort, countMap } = buildLessonPairsStrictV873(rows);
  const html = [];
  let lastMonth = "";

  const cell = typeof lessonCellV86 === "function"
    ? lessonCellV86
    : (typeof lessonPairCellsV858 === "function" ? lessonPairCellsV858 : lessonPairCells);

  function addMonthRow(ym) {
    if (ym !== lastMonth) {
      lastMonth = ym;
      html.push(`<tr class="month-group-row"><td colspan="16">${esc(expenseMonthLabel(ym))}</td></tr>`);
      html.push(`<tr class="lesson-sub-head-body v8310">
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>選択</th><th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>`);
    }
  }

  planned.forEach(plan => {
    addMonthRow(plan.year_month || "未归属月份");
    const planId = typeof planIdTextV872 === "function" ? planIdTextV872(plan.id) : String(plan.id || "").trim();
    const actuals = (actualByPlan.get(planId) || []).slice().sort(dateSort);
    const isDup = typeof isDuplicatePlannedV872 === "function" && isDuplicatePlannedV872(plan, countMap);
    const plannedCell = appendDuplicateWarningToPlannedCellsV873(cell(plan, "planned"), plan, countMap);

    if (!actuals.length) {
      html.push(`<tr class="lesson-pair-row v8310 ${isDup ? "duplicate-planned-row-v872" : ""}">${plannedCell}${cell(null, "actual")}</tr>`);
      return;
    }

    actuals.forEach((actual, index) => {
      const left = index === 0 ? plannedCell : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
      html.push(`<tr class="lesson-pair-row v8310 ${isDup ? "duplicate-planned-row-v872" : ""}">${left}${cell(actual, "actual")}</tr>`);
    });
  });

  unlinkedActual.forEach(actual => {
    addMonthRow(actual.year_month || "未归属月份");
    html.push(`<tr class="lesson-pair-row v8310">${cell(null, "planned")}${cell(actual, "actual")}</tr>`);
  });

  return html.join("");
}

function renderLessonsStrictV873() {
  const tbody = document.getElementById("lessonsTable");
  if (!tbody) return;
  updateLessonFilters();
  const rows = filterLessons().slice();
  renderLessonStats(rows);
  tbody.innerHTML = renderLessonRowsStrictV873(rows) || `<tr><td colspan="16" class="empty-row">当前筛选条件下没有课时记录</td></tr>`;

  if (typeof bindLessonButtonsStrictV872 === "function") bindLessonButtonsStrictV872();
  else if (typeof bindLessonPairButtonsV59 === "function") bindLessonPairButtonsV59();

  if (typeof bindLessonSelectAllV77 === "function") bindLessonSelectAllV77();
  if (typeof bindLessonExcelActionsV871 === "function") bindLessonExcelActionsV871();
}

buildLessonPairsStrictV872 = buildLessonPairsStrictV873;
renderLessonRowsStrictV872 = renderLessonRowsStrictV873;
renderLessonsStrictV872 = renderLessonsStrictV873;
renderLessonRowsV86 = renderLessonRowsStrictV873;
renderLessonRowsV855 = renderLessonRowsStrictV873;
renderLessonRowsV858 = renderLessonRowsStrictV873;
renderLessons = renderLessonsStrictV873;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    renderLessonsStrictV873();
  }, 1000);
});

const renderAllBeforeV873 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV873) {
  renderAll = function() {
    renderAllBeforeV873();
    renderLessonsStrictV873();
  };
}



// === v8.7.4 settlement RLS guidance ===
function settlementRlsHelpV874(message) {
  const text = String(message || "");
  if (!/row-level security|RLS|policy/i.test(text)) return message;
  return `${message}\n\n请先在 Supabase SQL Editor 执行 school_v8_7_4_rls_fix.sql，然后刷新页面再试。`;
}

const lockSettlementBeforeV874 = typeof lockSettlementV87 === "function" ? lockSettlementV87 : null;
if (lockSettlementBeforeV874) {
  lockSettlementV87 = async function() {
    try {
      await lockSettlementBeforeV874();
    } catch (error) {
      alert(`锁定结算失败：${settlementRlsHelpV874(error.message || error)}`);
    }
  };
}



// === v8.7.5 RLS role hint ===
function settlementRlsHelpV875(message) {
  const text = String(message || "");
  if (!/row-level security|RLS|policy/i.test(text)) return message;
  return `${message}\n\n当前系统可能使用的是 anon role。请执行 school_v8_7_5_rls_anon_fix.sql 后刷新页面再试。`;
}


// === v8.7.6 settlement adjustment input UX fix ===
function settlementModeV876() {
  return document.getElementById("settlementAdjustModeV87")?.value || "carry";
}

function normalizeSettlementAdjustmentInputV876() {
  const mode = settlementModeV876();
  const input = document.getElementById("settlementAdjustmentAmountV87");
  if (!input) return;

  if (mode === "carry") {
    input.value = "0";
    input.placeholder = "0";
  } else if (mode === "clear") {
    const base = typeof computeSettlementSnapshotV87 === "function" ? computeSettlementSnapshotV87(0, "") : null;
    if (base) input.value = String(-Math.round(Number(base.system_difference_cny || 0)));
    input.placeholder = "自动抹平";
  } else if (mode === "custom") {
    if (input.value === "0") input.value = "";
    input.placeholder = "请输入调整金额";
  }
}

const updateSettlementLockPreviewBeforeV876 = typeof updateSettlementLockPreviewV87 === "function" ? updateSettlementLockPreviewV87 : null;
if (updateSettlementLockPreviewBeforeV876) {
  updateSettlementLockPreviewV87 = function() {
    normalizeSettlementAdjustmentInputV876();
    updateSettlementLockPreviewBeforeV876();
    const input = document.getElementById("settlementAdjustmentAmountV87");
    if (input && settlementModeV876() === "custom" && input.value === "0") input.value = "";
  };
}

function bindSettlementAdjustmentInputV876() {
  const mode = document.getElementById("settlementAdjustModeV87");
  const input = document.getElementById("settlementAdjustmentAmountV87");
  if (!mode || !input || input.dataset.boundV876 === "true") return;

  input.dataset.boundV876 = "true";
  mode.addEventListener("change", normalizeSettlementAdjustmentInputV876);
  input.addEventListener("focus", () => {
    if (settlementModeV876() === "custom" && input.value === "0") input.value = "";
  });
  normalizeSettlementAdjustmentInputV876();
}

const ensureSettlementPanelBeforeV876 = typeof ensureSettlementPanelV87 === "function" ? ensureSettlementPanelV87 : null;
if (ensureSettlementPanelBeforeV876) {
  ensureSettlementPanelV87 = function() {
    ensureSettlementPanelBeforeV876();
    bindSettlementAdjustmentInputV876();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    bindSettlementAdjustmentInputV876();
    normalizeSettlementAdjustmentInputV876();
  }, 1000);
});

const renderAllBeforeV876 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV876) {
  renderAll = function() {
    renderAllBeforeV876();
    bindSettlementAdjustmentInputV876();
  };
}


// === v8.8 completed lesson import + reimbursed expense label ===
function tx88(v){return String(v||"").trim().replace(/\s+/g,"");}
function num88(v){if(typeof v==="number")return v; const n=Number(String(v||"").replace(/[,，円￥¥]/g,"").trim()); return Number.isFinite(n)?n:0;}
function dt88(v,baseYear){
  if(!v&&v!==0)return "";
  if(v instanceof Date&&!Number.isNaN(v.getTime()))return formatDateYmd(v);
  if(typeof v==="number"){const d=new Date(Math.round((v-25569)*86400*1000)); if(!Number.isNaN(d.getTime()))return formatDateYmd(d);}
  let s=String(v).trim().replace(/周|週|星期|礼拜/g,"").replace(/[年月]/g,"-").replace(/日/g,"").replace(/\//g,"-");
  if(/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)){const [y,m,d]=s.split("-").map(Number); return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
  if(/^\d{1,2}[-.]\d{1,2}$/.test(s)){const [m,d]=s.replace(".","-").split("-").map(Number); const y=Number(baseYear||new Date().getFullYear()); return `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}
  return "";
}
function timeRange88(v){const m=String(v||"").match(/(\d{1,2}:\d{2})\s*[-~〜～]\s*(\d{1,2}:\d{2})/); return m?{start:m[1],end:m[2]}:{start:"",end:""};}
function headerMap88(h){
  const m={};
  (h||[]).forEach((c,i)=>{const k=tx88(c); if(!k)return;
    if(/担当|老师|教師|先生/.test(k)&&m.teacher===undefined)m.teacher=i;
    if(/科目|课程|講座/.test(k)&&m.subject===undefined)m.subject=i;
    if((/预定.*日期|予定.*日|^日期$|^周$|^週$/.test(k))&&m.plannedDate===undefined)m.plannedDate=i;
    if(/实际.*日期|実際.*日|实际上课日期|上课日/.test(k)&&m.actualDate===undefined)m.actualDate=i;
    if(/时间帯|时间段|時間帯|时段/.test(k)&&m.timeRange===undefined)m.timeRange=i;
    if(/开始|開始/.test(k)&&m.start===undefined)m.start=i;
    if(/结束|終了/.test(k)&&m.end===undefined)m.end=i;
    if(/时长|時間数|课时|授業時間/.test(k)&&m.duration===undefined)m.duration=i;
    if(/单价|単価/.test(k)&&m.unitPrice===undefined)m.unitPrice=i;
    if(/应收|课时费|授業料|金額|金额/.test(k)&&m.lessonFee===undefined)m.lessonFee=i;
    if(/内容|授業内容/.test(k)){ if(/预定|予定/.test(k)&&m.plannedContent===undefined)m.plannedContent=i; else if(/实际|実際/.test(k)&&m.actualContent===undefined)m.actualContent=i; else if(m.content===undefined)m.content=i;}
    if(/状态|ステータス/.test(k)&&m.status===undefined)m.status=i;
    if(/备注|備考|メモ/.test(k)&&m.note===undefined)m.note=i;
  });
  return m;
}
function findHeader88(rows){for(let i=0;i<Math.min(rows.length,25);i++){const t=(rows[i]||[]).map(tx88).join("|"); if(/科目/.test(t)&&(/日期|予定|预定|上课|実際|实际/.test(t))&&(/时长|時間|单价|课时费|金额/.test(t)))return i;} return -1;}
function status88(v){const t=tx88(v); if(/休|取消|キャンセル|请假|欠席/.test(t))return"cancelled"; if(/预|予定|未/.test(t))return"planned"; return"completed";}

function ensureCompletedImportButtonV88(){
  const page=document.getElementById("page-lessons")||document.querySelector("[data-page='lessons']");
  if(!page||document.getElementById("lessonImportCompletedExcelBtnV88"))return;
  const anchor=document.getElementById("lessonImportExcelBtn")?.parentElement||page.querySelector(".section-title-row")||page;
  anchor.insertAdjacentHTML("beforeend",`<button class="secondary-btn" id="lessonImportCompletedExcelBtnV88">导入完整课时</button><input type="file" id="lessonImportCompletedExcelInputV88" accept=".xlsx,.xls" style="display:none" />`);
  document.getElementById("lessonImportCompletedExcelBtnV88").onclick=()=>{if(!document.getElementById("lessonStudentFilter")?.value){showMessage("请先选择学生，再导入完整课时记录。","error");return;} document.getElementById("lessonImportCompletedExcelInputV88")?.click();};
  document.getElementById("lessonImportCompletedExcelInputV88").onchange=async e=>{const f=e.target.files?.[0]; if(f) await importCompletedLessonExcelV88(f); e.target.value="";};
}
async function importCompletedLessonExcelV88(file){
  if(!lessonExcelRequireXLSX())return;
  const studentId=document.getElementById("lessonStudentFilter")?.value||""; if(!studentId){showMessage("请先选择学生。","error");return;}
  const student=(state.students||[]).find(x=>x.id===studentId);
  const studentName=document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent||student?.display_name||student?.name||"";
  const businessEntityId=student?.business_entity_id||state.businessEntities?.[0]?.id||null;
  const batchId=typeof newImportBatchIdV871==="function"?newImportBatchIdV871():`completed_import_${Date.now()}`;
  const importedAt=new Date().toISOString();
  const wb=XLSX.read(await file.arrayBuffer(),{type:"array",cellDates:true});
  const sheetName=wb.SheetNames[0], sheet=wb.Sheets[sheetName];
  const rows=XLSX.utils.sheet_to_json(sheet,{header:1,raw:true,defval:""});
  const hi=findHeader88(rows); if(hi<0){showMessage("没有找到完整课时模板表头。","error");return;}
  const col=headerMap88(rows[hi]), records=[]; let curT="",curS="",skipped=0;
  const baseYear=Number(document.getElementById("lessonMonthFilter")?.value?.slice(0,4)||new Date().getFullYear());
  for(let r=hi+1;r<rows.length;r++){
    const row=rows[r]||[], line=row.map(x=>String(x||"").trim()).join("");
    if(!line||/合计|总计|總計|小计|小計/.test(line))continue;
    const tc=col.teacher!==undefined?String(row[col.teacher]||"").trim():"", sc=col.subject!==undefined?String(row[col.subject]||"").trim():"";
    if(tc)curT=tc; if(sc)curS=sc;
    const plannedDate=dt88(col.plannedDate!==undefined?row[col.plannedDate]:row[col.actualDate],baseYear);
    const actualDate=dt88(col.actualDate!==undefined?row[col.actualDate]:plannedDate,baseYear)||plannedDate;
    const duration=num88(col.duration!==undefined?row[col.duration]:"");
    const subjectId=subjectIdFromExcelName(curS)||document.getElementById("lessonSubjectFilter")?.value||"";
    const teacherId=teacherIdFromExcelName(curT)||document.getElementById("lessonTeacherFilter")?.value||"";
    if(!plannedDate||!duration||!subjectId||!teacherId){skipped++; continue;}
    const tr=timeRange88(col.timeRange!==undefined?row[col.timeRange]:"");
    const start=col.start!==undefined?String(row[col.start]||""):tr.start, end=col.end!==undefined?String(row[col.end]||""):tr.end;
    const unit=num88(col.unitPrice!==undefined?row[col.unitPrice]:"");
    const fee=num88(col.lessonFee!==undefined?row[col.lessonFee]:"")||(unit&&duration?unit*duration:0);
    const plannedContent=String((col.plannedContent!==undefined?row[col.plannedContent]:row[col.content])||"");
    const actualContent=String((col.actualContent!==undefined?row[col.actualContent]:row[col.content])||"");
    const note=String(col.note!==undefined?row[col.note]||"":"");
    const plannedId=crypto.randomUUID?crypto.randomUUID():`p_${Date.now()}_${r}`;
    const common={student_id:studentId,teacher_id:teacherId,subject_id:subjectId,business_entity_id:businessEntityId,start_time:start||"",end_time:end||"",duration_hours:duration,unit_price:unit||0,lesson_fee:fee||0,is_billable:true,note:note||`完整课时导入：${sheetName}`,import_batch_id:batchId,import_source:file.name||sheetName,imported_at:importedAt};
    records.push({id:plannedId,lesson_type:"planned",lesson_date:plannedDate,year_month:plannedDate.slice(0,7),lesson_content:plannedContent,status:"planned",...common});
    records.push({lesson_type:"actual",planned_lesson_id:plannedId,lesson_date:actualDate,year_month:actualDate.slice(0,7),lesson_content:actualContent,status:status88(col.status!==undefined?row[col.status]:"已上"),...common});
  }
  if(!records.length){showMessage("没有读取到可导入的完整课时记录。","error");return;}
  const pc=records.filter(x=>x.lesson_type==="planned").length, ac=records.filter(x=>x.lesson_type==="actual").length;
  const total=records.filter(x=>x.lesson_type==="actual").reduce((s,x)=>s+Number(x.lesson_fee||0),0);
  if(!confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${pc} 条\n实际课时：${ac} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n\n确认导入吗？`))return;
  const client=(typeof db!=="undefined"&&db?.from)?db:supabase;
  const {error}=await client.from(tables.lessons).insert(records);
  if(error){showMessage(`导入失败：${error.message}`,"error");return;}
  if(typeof saveLastImportBatchV871==="function")saveLastImportBatchV871({batchId,studentId,studentName,fileName:file.name,count:records.length,importedAt});
  await loadAll(); renderAll(); showMessage(`已导入完整课时记录：预定 ${pc} 条 / 实际 ${ac} 条。`,"ok");
}
function isExpenseReimbursedV88(item){const t=`${item.status||""} ${item.reimbursement_status||""}`.toLowerCase(); return Boolean(item.reimbursement_id||item.reimbursed_at||item.reimbursement_record_id||t.includes("reimbursed")||t.includes("已报销"));}
function applyReimbursedLabelsV88(){
  document.querySelectorAll("tr").forEach(tr=>{
    const id=tr.querySelector("[data-edit][data-type='expense']")?.dataset?.edit||tr.querySelector("[data-delete][data-type='expense']")?.dataset?.delete;
    if(!id)return; const item=(state.expenseRecords||[]).find(x=>String(x.id)===String(id));
    if(!item||!isExpenseReimbursedV88(item)||tr.querySelector(".expense-reimbursed-badge-v88"))return;
    const cell=Array.from(tr.children).find(td=>/已支付|未支付|待确认|paid|pending/i.test(td.textContent||""))||tr.children[tr.children.length-2];
    if(cell)cell.insertAdjacentHTML("beforeend",`<span class="badge green expense-reimbursed-badge-v88">已报销</span>`);
  });
}
document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{ensureCompletedImportButtonV88();applyReimbursedLabelsV88();},1000));
const renderAllBeforeV88=typeof renderAll==="function"?renderAll:null;
if(renderAllBeforeV88){renderAll=function(){renderAllBeforeV88();ensureCompletedImportButtonV88();applyReimbursedLabelsV88();};}



// === v8.8.1 expense reimbursed status robust fix ===
// 之前只是尝试根据 expense 本身是否带 reimbursement_id / reimbursed_at 来显示“已报销”。
// 实际报销流程可能只在报销记录或报销明细里保存关联，所以支出本身不会自动有这些字段。
// 本版改为从报销记录 + 明细 + 本地状态多路径判断。

function collectReimbursedExpenseIdsV881() {
  const ids = new Set();

  const addId = (value) => {
    if (value !== null && value !== undefined && String(value).trim()) ids.add(String(value).trim());
  };

  // 1. expense 自身字段
  (state.expenseRecords || []).forEach(exp => {
    const statusText = `${exp.status || ""} ${exp.reimbursement_status || ""}`.toLowerCase();
    if (
      exp.reimbursement_id ||
      exp.reimbursed_at ||
      exp.reimbursement_record_id ||
      statusText.includes("reimbursed") ||
      statusText.includes("已报销")
    ) {
      addId(exp.id);
    }
  });

  // 2. 报销记录中可能直接保存 expense_ids / expenseIds / expense_id
  (state.reimbursementRecords || state.reimbursements || []).forEach(reim => {
    const statusText = `${reim.status || ""}`.toLowerCase();
    const isActive = !/cancel|delete|void|取消|删除|作废/.test(statusText);
    if (!isActive) return;

    addId(reim.expense_id);

    const possibleArrays = [
      reim.expense_ids,
      reim.expenseIds,
      reim.expenses,
      reim.selected_expense_ids,
      reim.reimbursed_expense_ids,
    ];

    possibleArrays.forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(x => {
          if (typeof x === "object") addId(x.id || x.expense_id);
          else addId(x);
        });
      } else if (typeof arr === "string") {
        try {
          const parsed = JSON.parse(arr);
          if (Array.isArray(parsed)) parsed.forEach(x => typeof x === "object" ? addId(x.id || x.expense_id) : addId(x));
        } catch {
          arr.split(",").forEach(addId);
        }
      }
    });
  });

  // 3. 报销明细表/本地明细状态
  const detailLists = [
    state.reimbursementExpenseRecords,
    state.reimbursementExpenseLinks,
    state.reimbursementDetails,
    state.reimbursementItems,
    state.reimbursementExpenseItems,
  ];

  detailLists.forEach(list => {
    (list || []).forEach(row => {
      const statusText = `${row.status || ""}`.toLowerCase();
      const isActive = !/cancel|delete|void|取消|删除|作废/.test(statusText);
      if (isActive) addId(row.expense_id || row.expense_record_id || row.id);
    });
  });

  return ids;
}

function isExpenseReimbursedV881(item) {
  if (!item) return false;
  const ids = collectReimbursedExpenseIdsV881();
  return ids.has(String(item.id));
}

function expenseStatusTextV881(item) {
  const base = typeof expenseStatusLabel === "function"
    ? expenseStatusLabel(item.status)
    : (item.status === "paid" ? "已支付" : item.status === "unpaid" ? "未支付" : (item.status || ""));
  return isExpenseReimbursedV881(item) ? `${base} / 已报销` : base;
}

function applyReimbursedLabelsV881() {
  const reimbursedIds = collectReimbursedExpenseIdsV881();

  document.querySelectorAll("tr").forEach(tr => {
    const editBtn = tr.querySelector("[data-edit][data-type='expense']");
    const delBtn = tr.querySelector("[data-delete][data-type='expense']");
    const id = editBtn?.dataset?.edit || delBtn?.dataset?.delete;
    if (!id || !reimbursedIds.has(String(id))) return;

    if (tr.querySelector(".expense-reimbursed-badge-v88, .expense-reimbursed-badge-v881")) return;

    // 优先放到包含状态文字的单元格，找不到就放到操作列前一格
    const statusCell =
      Array.from(tr.children).find(td => /已支付|未支付|待确认|paid|pending|报销/i.test(td.textContent || "")) ||
      tr.children[Math.max(0, tr.children.length - 2)];

    if (statusCell) {
      statusCell.insertAdjacentHTML("beforeend", `<span class="badge green expense-reimbursed-badge-v881">已报销</span>`);
    }
  });
}

// 如果页面渲染支出状态时调用了某些状态格式化函数，尽量覆盖为带“已报销”的状态。
if (typeof expenseStatusLabel === "function") {
  const expenseStatusLabelBeforeV881 = expenseStatusLabel;
  expenseStatusLabel = function(status, item) {
    const base = expenseStatusLabelBeforeV881(status, item);
    if (item && isExpenseReimbursedV881(item)) return `${base} / 已报销`;
    return base;
  };
}

// 部分版本有独立 renderExpenses，渲染后补标识。
const renderExpensesBeforeV881 = typeof renderExpenses === "function" ? renderExpenses : null;
if (renderExpensesBeforeV881) {
  renderExpenses = function() {
    renderExpensesBeforeV881();
    setTimeout(applyReimbursedLabelsV881, 0);
  };
}

const renderReimbursementsBeforeV881 = typeof renderReimbursements === "function" ? renderReimbursements : null;
if (renderReimbursementsBeforeV881) {
  renderReimbursements = function() {
    renderReimbursementsBeforeV881();
    setTimeout(applyReimbursedLabelsV881, 0);
  };
}

// 如果报销保存后没有刷新完整数据，补一次刷新和状态标记。
const renderAllBeforeV881 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV881) {
  renderAll = function() {
    renderAllBeforeV881();
    setTimeout(applyReimbursedLabelsV881, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(applyReimbursedLabelsV881, 1000);
});

// 调试辅助：在 console 可执行 debugReimbursedExpenseIdsV881()
function debugReimbursedExpenseIdsV881() {
  const ids = Array.from(collectReimbursedExpenseIdsV881());
  console.log("reimbursed expense ids", ids);
  return ids;
}



// === v8.8.2 reimbursement-expense link table ===
tables.reimbursementExpenses = "school_reimbursement_expenses";
state.reimbursementExpenseLinks = state.reimbursementExpenseLinks || [];

async function loadReimbursementExpenseLinksV882() {
  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { data, error } = await client
    .from(tables.reimbursementExpenses)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.warn("Reimbursement link table load failed.", error);
    state.reimbursementExpenseLinks = [];
    return;
  }
  state.reimbursementExpenseLinks = data || [];
}

const loadAllBeforeV882 = typeof loadAll === "function" ? loadAll : null;
if (loadAllBeforeV882) {
  loadAll = async function() {
    await loadAllBeforeV882();
    await loadReimbursementExpenseLinksV882();
  };
}

function activeReimbursementLinksV882() {
  const activeReimbursementIds = new Set(
    (state.reimbursements || [])
      .filter(r => !/cancel|delete|void|取消|删除|作废/.test(String(r.status || "").toLowerCase()))
      .map(r => String(r.id))
  );

  return (state.reimbursementExpenseLinks || []).filter(link =>
    activeReimbursementIds.has(String(link.reimbursement_id))
  );
}

function reimbursedExpenseIdsV882() {
  return new Set(activeReimbursementLinksV882().map(x => String(x.expense_id)));
}

const pendingReimbursementExpensesBeforeV882 = typeof pendingReimbursementExpenses === "function" ? pendingReimbursementExpenses : null;
if (pendingReimbursementExpensesBeforeV882) {
  pendingReimbursementExpenses = function() {
    const linked = reimbursedExpenseIdsV882();
    return pendingReimbursementExpensesBeforeV882().filter(x => !linked.has(String(x.id)));
  };
}

async function saveReimbursementExpenseLinksV882(reimbursement) {
  const ids = (state.pendingReimbursementExpenseIds || []).slice();
  if (!reimbursement?.id || !ids.length) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;

  // 删除当前报销记录旧关联，重新写入
  await client
    .from(tables.reimbursementExpenses)
    .delete()
    .eq("reimbursement_id", reimbursement.id);

  const rows = ids.map(expenseId => {
    const expense = (state.expenseRecords || []).find(x => String(x.id) === String(expenseId));
    return {
      reimbursement_id: reimbursement.id,
      expense_id: expenseId,
      amount: Number(expense?.amount || 0),
    };
  });

  const { error } = await client
    .from(tables.reimbursementExpenses)
    .insert(rows);

  if (error) {
    console.warn("Failed to save reimbursement-expense links", error);
    showMessage(`报销关联保存失败：${error.message}`, "error");
  }
}

const saveReimbursementItemsBeforeV882 = typeof saveReimbursementItems === "function" ? saveReimbursementItems : null;
saveReimbursementItems = async function(reimbursement) {
  const idsBackup = (state.pendingReimbursementExpenseIds || []).slice();

  if (saveReimbursementItemsBeforeV882) {
    await saveReimbursementItemsBeforeV882(reimbursement);
  }

  // 旧函数会清空 pendingReimbursementExpenseIds，所以这里用备份恢复写入新关联表
  const oldIds = state.pendingReimbursementExpenseIds;
  state.pendingReimbursementExpenseIds = idsBackup;
  await saveReimbursementExpenseLinksV882(reimbursement);
  state.pendingReimbursementExpenseIds = oldIds && oldIds.length ? oldIds : [];
};

function collectReimbursedExpenseIdsV882() {
  const ids = new Set();
  reimbursedExpenseIdsV882().forEach(id => ids.add(String(id)));

  // 兼容旧数据/旧字段
  if (typeof collectReimbursedExpenseIdsV881 === "function") {
    collectReimbursedExpenseIdsV881().forEach(id => ids.add(String(id)));
  }

  return ids;
}

function isExpenseReimbursedV882(item) {
  if (!item) return false;
  return collectReimbursedExpenseIdsV882().has(String(item.id));
}

function applyReimbursedLabelsV882() {
  const ids = collectReimbursedExpenseIdsV882();

  document.querySelectorAll("tr").forEach(tr => {
    const editBtn = tr.querySelector("[data-edit][data-type='expense']");
    const delBtn = tr.querySelector("[data-delete][data-type='expense']");
    const id = editBtn?.dataset?.edit || delBtn?.dataset?.delete;
    if (!id || !ids.has(String(id))) return;

    if (tr.querySelector(".expense-reimbursed-badge-v88, .expense-reimbursed-badge-v881, .expense-reimbursed-badge-v882")) return;

    const statusCell =
      Array.from(tr.children).find(td => /已支付|未支付|待确认|paid|pending|报销/i.test(td.textContent || "")) ||
      tr.children[Math.max(0, tr.children.length - 2)];

    if (statusCell) {
      statusCell.insertAdjacentHTML("beforeend", `<span class="badge green expense-reimbursed-badge-v882">已报销</span>`);
    }
  });
}

isExpenseReimbursedV88 = isExpenseReimbursedV882;
isExpenseReimbursedV881 = isExpenseReimbursedV882;
applyReimbursedLabelsV88 = applyReimbursedLabelsV882;
applyReimbursedLabelsV881 = applyReimbursedLabelsV882;
collectReimbursedExpenseIdsV881 = collectReimbursedExpenseIdsV882;

// 删除报销时，关联表有 ON DELETE CASCADE；这里额外先删一次，确保刷新前状态准确。
const deleteRecordBeforeV882 = typeof deleteRecord === "function" ? deleteRecord : null;
if (deleteRecordBeforeV882) {
  deleteRecord = async function(type, id) {
    if (type === "reimbursement") {
      const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
      await client.from(tables.reimbursementExpenses).delete().eq("reimbursement_id", id);
    }
    return deleteRecordBeforeV882(type, id);
  };
}

const renderAllBeforeV882 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV882) {
  renderAll = function() {
    renderAllBeforeV882();
    setTimeout(applyReimbursedLabelsV882, 0);
  };
}

const renderExpensesBeforeV882 = typeof renderExpensesTable === "function" ? renderExpensesTable : null;
if (renderExpensesBeforeV882) {
  renderExpensesTable = function() {
    renderExpensesBeforeV882();
    setTimeout(applyReimbursedLabelsV882, 0);
  };
}

const renderReimbursementsBeforeV882 = typeof renderReimbursements === "function" ? renderReimbursements : null;
if (renderReimbursementsBeforeV882) {
  renderReimbursements = function() {
    renderReimbursementsBeforeV882();
    setTimeout(applyReimbursedLabelsV882, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(applyReimbursedLabelsV882, 1000);
});

function debugReimbursementLinksV882() {
  console.log("reimbursement links", state.reimbursementExpenseLinks || []);
  console.log("reimbursed expense ids", Array.from(collectReimbursedExpenseIdsV882()));
  return {
    links: state.reimbursementExpenseLinks || [],
    ids: Array.from(collectReimbursedExpenseIdsV882()),
  };
}



// === v8.8.3 reimbursement recursion fix ===
function collectLegacyReimbursedExpenseIdsV883() {
  const ids = new Set();
  const add = (v) => {
    if (v !== null && v !== undefined && String(v).trim()) ids.add(String(v).trim());
  };

  (state.expenseRecords || []).forEach(exp => {
    const rs = String(exp.reimbursement_status || "").toLowerCase();
    if (
      exp.reimbursement_id ||
      exp.reimbursed_at ||
      exp.reimbursement_record_id ||
      rs === "paid" ||
      rs.includes("reimbursed") ||
      rs.includes("已报销")
    ) {
      add(exp.id);
    }
  });

  (state.reimbursements || []).forEach(reim => {
    const s = String(reim.status || "").toLowerCase();
    if (/cancel|delete|void|取消|删除|作废/.test(s)) return;

    (reim.items || []).forEach(item => add(item.expense_id || item.expense_record_id));

    ["expense_ids", "expenseIds", "expenses", "selected_expense_ids", "reimbursed_expense_ids"].forEach(key => {
      const val = reim[key];
      if (Array.isArray(val)) {
        val.forEach(x => typeof x === "object" ? add(x.id || x.expense_id) : add(x));
      } else if (typeof val === "string") {
        try {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) parsed.forEach(x => typeof x === "object" ? add(x.id || x.expense_id) : add(x));
        } catch {
          val.split(",").forEach(add);
        }
      }
    });
  });

  return ids;
}

function collectReimbursedExpenseIdsV883() {
  const ids = new Set();
  const activeReimIds = new Set(
    (state.reimbursements || [])
      .filter(r => !/cancel|delete|void|取消|删除|作废/.test(String(r.status || "").toLowerCase()))
      .map(r => String(r.id))
  );

  (state.reimbursementExpenseLinks || []).forEach(link => {
    if (activeReimIds.has(String(link.reimbursement_id)) && link.expense_id) {
      ids.add(String(link.expense_id));
    }
  });

  collectLegacyReimbursedExpenseIdsV883().forEach(id => ids.add(String(id)));
  return ids;
}

function isExpenseReimbursedV883(item) {
  return !!item && collectReimbursedExpenseIdsV883().has(String(item.id));
}

function applyReimbursedLabelsV883() {
  const ids = collectReimbursedExpenseIdsV883();

  document.querySelectorAll("tr").forEach(tr => {
    const editBtn = tr.querySelector("[data-edit][data-type='expense']");
    const delBtn = tr.querySelector("[data-delete][data-type='expense']");
    const id = editBtn?.dataset?.edit || delBtn?.dataset?.delete;
    if (!id || !ids.has(String(id))) return;

    if (tr.querySelector(".expense-reimbursed-badge-v88, .expense-reimbursed-badge-v881, .expense-reimbursed-badge-v882, .expense-reimbursed-badge-v883")) return;

    const statusCell =
      Array.from(tr.children).find(td => /已支付|未支付|待确认|paid|pending|报销/i.test(td.textContent || "")) ||
      tr.children[Math.max(0, tr.children.length - 2)];

    if (statusCell) {
      statusCell.insertAdjacentHTML("beforeend", `<span class="badge green expense-reimbursed-badge-v883">已报销</span>`);
    }
  });
}

collectReimbursedExpenseIdsV881 = collectReimbursedExpenseIdsV883;
collectReimbursedExpenseIdsV882 = collectReimbursedExpenseIdsV883;
isExpenseReimbursedV88 = isExpenseReimbursedV883;
isExpenseReimbursedV881 = isExpenseReimbursedV883;
isExpenseReimbursedV882 = isExpenseReimbursedV883;
applyReimbursedLabelsV88 = applyReimbursedLabelsV883;
applyReimbursedLabelsV881 = applyReimbursedLabelsV883;
applyReimbursedLabelsV882 = applyReimbursedLabelsV883;

const renderAllBeforeV883 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV883) {
  renderAll = function() {
    renderAllBeforeV883();
    setTimeout(applyReimbursedLabelsV883, 0);
  };
}

const renderExpensesBeforeV883 = typeof renderExpensesTable === "function" ? renderExpensesTable : null;
if (renderExpensesBeforeV883) {
  renderExpensesTable = function() {
    renderExpensesBeforeV883();
    setTimeout(applyReimbursedLabelsV883, 0);
  };
}

const renderReimbursementsBeforeV883 = typeof renderReimbursements === "function" ? renderReimbursements : null;
if (renderReimbursementsBeforeV883) {
  renderReimbursements = function() {
    renderReimbursementsBeforeV883();
    setTimeout(applyReimbursedLabelsV883, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(applyReimbursedLabelsV883, 1000);
});

function debugReimbursementLinksV883() {
  const ids = Array.from(collectReimbursedExpenseIdsV883());
  console.log("reimbursement links", state.reimbursementExpenseLinks || []);
  console.log("legacy ids", Array.from(collectLegacyReimbursedExpenseIdsV883()));
  console.log("reimbursed expense ids", ids);
  return { links: state.reimbursementExpenseLinks || [], ids };
}



// === v8.8.4 completed lesson import fix / default month / drop dialog ===
function ensureLessonMonthDefaultV884() {
  const input = document.getElementById("lessonMonthFilter");
  if (input && !input.value) {
    input.value = currentYearMonth();
  }
}

function uuidV884(prefix = "id") {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function openCompletedImportDialogV884() {
  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生，再导入完整课时记录。", "error");
    return;
  }

  let modal = document.getElementById("completedImportDialogV884");
  if (!modal) {
    document.body.insertAdjacentHTML("beforeend", `
      <div class="import-dialog-mask-v884" id="completedImportDialogV884">
        <div class="import-dialog-v884">
          <div class="import-dialog-head-v884">
            <div>
              <h3>导入完整课时</h3>
              <p>可拖入 Excel 文件，也可以点击选择文件。</p>
            </div>
            <button class="icon-btn" id="closeCompletedImportDialogV884">×</button>
          </div>
          <div class="import-drop-v884" id="completedImportDropV884">
            <div class="import-drop-title-v884">把完整课时 Excel 拖到这里</div>
            <div class="muted-small">支持 .xlsx / .xls。请先在课时管理筛选中选择学生。</div>
            <button class="primary-btn" id="chooseCompletedImportFileV884">选择文件</button>
            <input type="file" id="completedImportFileInputV884" accept=".xlsx,.xls" style="display:none" />
          </div>
        </div>
      </div>
    `);

    modal = document.getElementById("completedImportDialogV884");
    const close = () => modal.classList.remove("show");
    document.getElementById("closeCompletedImportDialogV884")?.addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });

    const input = document.getElementById("completedImportFileInputV884");
    document.getElementById("chooseCompletedImportFileV884")?.addEventListener("click", () => input?.click());
    input?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      close();
      await importCompletedLessonExcelV884(file);
      e.target.value = "";
    });

    const drop = document.getElementById("completedImportDropV884");
    ["dragenter", "dragover"].forEach(evt => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.add("dragging");
      });
    });
    ["dragleave", "drop"].forEach(evt => {
      drop.addEventListener(evt, (e) => {
        e.preventDefault();
        drop.classList.remove("dragging");
      });
    });
    drop.addEventListener("drop", async (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (!file) return;
      close();
      await importCompletedLessonExcelV884(file);
    });
  }

  modal.classList.add("show");
}

function ensureCompletedImportButtonV884() {
  const page = document.getElementById("page-lessons") || document.querySelector("[data-page='lessons']");
  if (!page) return;

  const oldBtn = document.getElementById("lessonImportCompletedExcelBtnV88");
  if (oldBtn) {
    oldBtn.onclick = openCompletedImportDialogV884;
    oldBtn.textContent = "导入完整课时";
    return;
  }

  const anchor = document.getElementById("lessonImportExcelBtn")?.parentElement || page.querySelector(".section-title-row") || page;
  anchor.insertAdjacentHTML("beforeend", `<button class="secondary-btn" id="lessonImportCompletedExcelBtnV88">导入完整课时</button>`);
  document.getElementById("lessonImportCompletedExcelBtnV88").onclick = openCompletedImportDialogV884;
}

async function importCompletedLessonExcelV884(file) {
  if (!lessonExcelRequireXLSX()) return;

  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生。", "error");
    return;
  }

  const student = (state.students || []).find(x => x.id === studentId);
  const studentName = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || student?.display_name || student?.name || "";
  const businessEntityId = student?.business_entity_id || state.businessEntities?.[0]?.id || null;
  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const actualDate = dt88(col.actualDate !== undefined ? row[col.actualDate] : plannedDate, baseYear) || plannedDate;
    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? String(row[col.start] || "") : tr.start;
    const end = col.end !== undefined ? String(row[col.end] || "") : tr.end;
    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const fee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);
    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const note = String(col.note !== undefined ? row[col.note] || "" : "");
    const plannedId = uuidV884("planned");
    const actualId = uuidV884("actual");

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      duration_hours: duration,
      unit_price: unit || 0,
      lesson_fee: fee || 0,
      is_billable: true,
      note: note || `完整课时导入：${sheetName}`,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedDate.slice(0, 7),
      lesson_content: plannedContent,
      status: "planned",
      planned_lesson_id: null,
      ...common,
    });

    records.push({
      id: actualId,
      lesson_type: "actual",
      planned_lesson_id: plannedId,
      lesson_date: actualDate,
      year_month: actualDate.slice(0, 7),
      lesson_content: actualContent,
      status: status88(col.status !== undefined ? row[col.status] : "已上"),
      ...common,
    });
  }

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);

  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({ batchId, studentId, studentName, fileName: file.name, count: records.length, importedAt });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

importCompletedLessonExcelV88 = importCompletedLessonExcelV884;

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    ensureLessonMonthDefaultV884();
    ensureCompletedImportButtonV884();
  }, 800);
});

const renderAllBeforeV884 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV884) {
  renderAll = function() {
    renderAllBeforeV884();
    ensureLessonMonthDefaultV884();
    ensureCompletedImportButtonV884();
  };
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
  lessonStatusLabel = function(status) {
    return lessonStatusLabelV885(status);
  };
}

// If generic field builder returns lesson status options inline, patch buildForm result after open.
function patchLessonStatusSelectV885() {
  const form = document.getElementById("modalForm");
  if (!form || state.editing?.type !== "lesson") return;
  const select = form.querySelector('[name="status"]');
  if (!select) return;

  const current = select.value;
  select.innerHTML = lessonStatusOptionsV885().map(opt => `<option value="${escAttr(opt.value)}">${esc(opt.label)}</option>`).join("");

  if (["completed", "pending_makeup", "makeup_completed"].includes(current)) {
    select.value = current;
  } else if (current === "planned") {
    // 新增/编辑预定课时时也使用“待补课/已上课/已补课”三选一；默认已上课更符合实际课时。
    select.value = "completed";
  } else {
    select.value = current || "completed";
  }
}

const openCreateModalBeforeV885 = typeof openCreateModal === "function" ? openCreateModal : null;
if (openCreateModalBeforeV885) {
  openCreateModal = function(type, prefill = {}) {
    if (type === "lesson") {
      if (prefill.lesson_type === "planned" && !prefill.status) prefill.status = "completed";
      if (prefill.lesson_type === "actual" && !prefill.status) prefill.status = "completed";
    }
    openCreateModalBeforeV885(type, prefill);
    setTimeout(patchLessonStatusSelectV885, 0);
  };
}

const openEditModalBeforeV885 = typeof openEditModal === "function" ? openEditModal : null;
if (openEditModalBeforeV885) {
  openEditModal = function(type, id) {
    openEditModalBeforeV885(type, id);
    if (type === "lesson") setTimeout(patchLessonStatusSelectV885, 0);
  };
}

function buildCompletedLessonNoteV885(baseNote, count, normalNote, salaryNote) {
  const parts = [];
  if (count !== "" && count !== null && count !== undefined) parts.push(`回数：${count}`);
  if (normalNote) parts.push(`备注：${normalNote}`);
  if (salaryNote) parts.push(`工资结算备注：${salaryNote}`);
  if (baseNote) parts.push(baseNote);
  return parts.join(" / ");
}

function isActualGeneratedFromStatusV885(status, actualDate) {
  if (!actualDate) return false;
  if (status === "pending_makeup") return false;
  if (!status) return true;
  return status === "completed" || status === "makeup_completed";
}

// Header map override: support 回数 and 工资结算备注
const headerMapBeforeV885 = typeof headerMap88 === "function" ? headerMap88 : null;
if (headerMapBeforeV885) {
  headerMap88 = function(header) {
    const map = headerMapBeforeV885(header);
    (header || []).forEach((cell, idx) => {
      const key = tx88(cell);
      if (/回数|回次|课次|回/.test(key) && map.count === undefined) map.count = idx;
      if (/工资.*结算.*月份|工资结算月份|給料.*締.*月|給料.*月|工资月份/.test(key) && map.teacherSettlementMonth === undefined) map.teacherSettlementMonth = idx;
      if (/工资.*结算.*备注|工资结算备注|給料.*備考|工资备注/.test(key) && map.salaryNote === undefined) map.salaryNote = idx;
    });
    return map;
  };
}

// v8.8.5 completed import rules:
// - always create planned row when planned date exists
// - create actual row only when actual date exists AND status is 已上课/已补课 or blank
// - 待补课 never creates actual row
// - actual year_month follows planned year_month
// - count / normal note / salary note saved into note
async function importCompletedLessonExcelV885(file) {
  if (!lessonExcelRequireXLSX()) return;

  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生。", "error");
    return;
  }

  const student = (state.students || []).find(x => x.id === studentId);
  const studentName = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || student?.display_name || student?.name || "";
  const businessEntityId = student?.business_entity_id || state.businessEntities?.[0]?.id || null;
  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、回数、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  let actualSkipped = 0;
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const rawActualDate = col.actualDate !== undefined ? row[col.actualDate] : "";
    const actualDate = dt88(rawActualDate, baseYear);

    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const actualDuration = num88(col.actualDuration !== undefined ? row[col.actualDuration] : (col.duration !== undefined ? row[col.duration] : ""));

    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? String(row[col.start] || "") : tr.start;
    const end = col.end !== undefined ? String(row[col.end] || "") : tr.end;
    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const fee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);

    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const count = col.count !== undefined ? row[col.count] : "";
    const normalNote = String(col.note !== undefined ? row[col.note] || "" : "");
    const salaryNote = String(col.salaryNote !== undefined ? row[col.salaryNote] || "" : "");
    const teacherSettlementMonth = normalizeTeacherSettlementMonthV916
      ? normalizeTeacherSettlementMonthV916(col.teacherSettlementMonth !== undefined ? row[col.teacherSettlementMonth] : "")
      : "";
    const status = normalizeLessonStatusTextV885(col.status !== undefined ? row[col.status] : "");

    const plannedId = uuidV884("planned");
    const actualId = uuidV884("actual");
    const plannedYm = plannedDate.slice(0, 7);
    const baseNote = `完整课时导入：${sheetName}`;
    const mergedNote = buildCompletedLessonNoteV885(baseNote, count, normalNote, salaryNote);

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      duration_hours: duration,
      unit_price: unit || 0,
      lesson_fee: fee || 0,
      is_billable: true,
      note: mergedNote,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedYm,
      lesson_content: plannedContent,
      status: status || "completed",
      planned_lesson_id: null,
      ...common,
    });

    if (isActualGeneratedFromStatusV885(status, actualDate)) {
      records.push({
        id: actualId,
        lesson_type: "actual",
        planned_lesson_id: plannedId,
        lesson_date: actualDate,
        year_month: plannedYm,
        lesson_content: actualContent,
        status: status || "completed",
        duration_hours: actualDuration || duration,
        lesson_fee: unit && (actualDuration || duration) ? unit * (actualDuration || duration) : fee,
        teacher_settlement_month: teacherSettlementMonth || (actualDate ? actualDate.slice(0, 7) : plannedYm),
        ...common,
      });
    } else {
      actualSkipped++;
    }
  }

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);

  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({ batchId, studentId, studentName, fileName: file.name, count: records.length, importedAt });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

importCompletedLessonExcelV88 = importCompletedLessonExcelV885;
importCompletedLessonExcelV884 = importCompletedLessonExcelV885;

// Patch status badges text if rendered from raw values.
function patchLessonStatusTextV885() {
  document.querySelectorAll("td, span, .badge").forEach(el => {
    const t = (el.textContent || "").trim();
    if (t === "已上" || t === "completed") el.textContent = "已上课";
    if (t === "待补" || t === "pending_makeup") el.textContent = "待补课";
    if (t === "已补" || t === "makeup_completed") el.textContent = "已补课";
  });
}

const renderLessonsBeforeV885 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV885) {
  renderLessons = function() {
    renderLessonsBeforeV885();
    setTimeout(patchLessonStatusTextV885, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    patchLessonStatusTextV885();
  }, 1000);
});

const renderAllBeforeV885 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV885) {
  renderAll = function() {
    renderAllBeforeV885();
    patchLessonStatusTextV885();
  };
}



// === v8.8.6 lesson_count field ===
// lesson_count becomes the formal field for 回数.
// It is used in completed lesson import, duplicate warning, display, and modal payload.

function normalizeLessonCountV886(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function lessonCountTextV886(item) {
  const count = normalizeLessonCountV886(item?.lesson_count);
  return count === null ? "" : `第${count}回`;
}

function patchLessonCountFieldV886() {
  const form = document.getElementById("modalForm");
  if (!form || state.editing?.type !== "lesson") return;
  if (form.querySelector('[name="lesson_count"]')) return;

  const statusField = form.querySelector('[name="status"]')?.closest("label, .form-field, .field");
  const html = `
    <label class="form-field lesson-count-field-v886">
      <span>回数</span>
      <input name="lesson_count" type="number" step="1" placeholder="例：1" />
    </label>
  `;

  if (statusField) statusField.insertAdjacentHTML("beforebegin", html);
  else form.insertAdjacentHTML("beforeend", html);

  const input = form.querySelector('[name="lesson_count"]');
  const current = state.editing?.id ? findLocal("lesson", state.editing.id)?.lesson_count : state.editing?.data?.lesson_count;
  if (input && current !== undefined && current !== null) input.value = current;
}

// Ensure saveForm includes lesson_count even if schoolGetFieldsV24 doesn't know this new field.
const normalizeLessonPayloadBeforeV886 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
normalizeLessonPayload = function(payload, type) {
  if (normalizeLessonPayloadBeforeV886) payload = normalizeLessonPayloadBeforeV886(payload, type);

  if (type === "lesson") {
    const form = document.getElementById("modalForm");
    const raw = form?.querySelector('[name="lesson_count"]')?.value;
    const count = normalizeLessonCountV886(raw ?? payload.lesson_count);
    payload.lesson_count = count;
  }

  return payload;
};

// Add lesson_count to completed import common payload.
const importCompletedLessonExcelBeforeV886 = typeof importCompletedLessonExcelV885 === "function" ? importCompletedLessonExcelV885 : null;

async function importCompletedLessonExcelV886(file) {
  if (!lessonExcelRequireXLSX()) return;

  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生。", "error");
    return;
  }

  const student = (state.students || []).find(x => x.id === studentId);
  const studentName = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || student?.display_name || student?.name || "";
  const businessEntityId = student?.business_entity_id || state.businessEntities?.[0]?.id || null;
  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、回数、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  let actualSkipped = 0;
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const rawActualDate = col.actualDate !== undefined ? row[col.actualDate] : "";
    const actualDate = dt88(rawActualDate, baseYear);

    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const actualDuration = num88(col.actualDuration !== undefined ? row[col.actualDuration] : (col.duration !== undefined ? row[col.duration] : ""));

    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? String(row[col.start] || "") : tr.start;
    const end = col.end !== undefined ? String(row[col.end] || "") : tr.end;
    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const fee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);

    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const count = normalizeLessonCountV886(col.count !== undefined ? row[col.count] : null);
    const normalNote = String(col.note !== undefined ? row[col.note] || "" : "");
    const salaryNote = String(col.salaryNote !== undefined ? row[col.salaryNote] || "" : "");
    const status = normalizeLessonStatusTextV885(col.status !== undefined ? row[col.status] : "");

    const plannedId = uuidV884("planned");
    const actualId = uuidV884("actual");
    const plannedYm = plannedDate.slice(0, 7);
    const baseNote = `完整课时导入：${sheetName}`;
    const mergedNote = buildCompletedLessonNoteV885(baseNote, "", normalNote, salaryNote);

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      duration_hours: duration,
      unit_price: unit || 0,
      lesson_fee: fee || 0,
      lesson_count: count,
      is_billable: true,
      note: mergedNote,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedYm,
      lesson_content: plannedContent,
      status: status || "completed",
      planned_lesson_id: null,
      ...common,
    });

    if (isActualGeneratedFromStatusV885(status, actualDate)) {
      records.push({
        id: actualId,
        lesson_type: "actual",
        planned_lesson_id: plannedId,
        lesson_date: actualDate,
        year_month: plannedYm,
        lesson_content: actualContent,
        status: status || "completed",
        duration_hours: actualDuration || duration,
        lesson_fee: unit && (actualDuration || duration) ? unit * (actualDuration || duration) : fee,
        ...common,
      });
    } else {
      actualSkipped++;
    }
  }

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);

  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({ batchId, studentId, studentName, fileName: file.name, count: records.length, importedAt });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

importCompletedLessonExcelV88 = importCompletedLessonExcelV886;
importCompletedLessonExcelV884 = importCompletedLessonExcelV886;
importCompletedLessonExcelV885 = importCompletedLessonExcelV886;

// Duplicate check includes lesson_count.
// If both rows have count and count differs, they are not duplicates.
function plannedDuplicateKeyV886(item) {
  return [
    item.student_id || "",
    item.lesson_date || "",
    item.teacher_id || "",
    item.subject_id || "",
    item.start_time || "",
    item.end_time || "",
    normalizeLessonCountV886(item.lesson_count) ?? "",
  ].join("|");
}

plannedDuplicateKeyV872 = plannedDuplicateKeyV886;

function plannedDuplicateCountMapV886(rows) {
  const map = new Map();
  rows.filter(x => x.lesson_type === "planned").forEach(item => {
    const key = plannedDuplicateKeyV886(item);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return map;
}

plannedDuplicateCountMapV872 = plannedDuplicateCountMapV886;

// Display count inside date cell when possible.
function patchLessonCountDisplayV886() {
  document.querySelectorAll("tr.lesson-pair-row").forEach(tr => {
    const cells = tr.querySelectorAll("td");
    [1, 9].forEach(idx => {
      const td = cells[idx];
      if (!td || td.querySelector(".lesson-count-v886")) return;

      const rowId =
        tr.querySelector("[data-edit][data-type='lesson']")?.dataset?.edit ||
        tr.querySelector("[data-delete][data-type='lesson']")?.dataset?.delete;
      const item = (state.lessonRecords || []).find(x => String(x.id) === String(rowId));
      const text = lessonCountTextV886(item);
      if (text) td.insertAdjacentHTML("beforeend", `<div class="lesson-count-v886">${esc(text)}</div>`);
    });
  });
}

// Full import button disabled when no student selected.
function updateLessonImportButtonsV886() {
  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  const disabled = !studentId;
  ["lessonImportCompletedExcelBtnV88", "lessonImportExcelBtn", "addLessonBtn"].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = disabled;
    btn.classList.toggle("disabled", disabled);
    if (disabled) btn.title = "请先选择学生";
    else btn.removeAttribute("title");
  });
}

const ensureCompletedImportButtonBeforeV886 = typeof ensureCompletedImportButtonV884 === "function" ? ensureCompletedImportButtonV884 : (typeof ensureCompletedImportButtonV88 === "function" ? ensureCompletedImportButtonV88 : null);
if (ensureCompletedImportButtonBeforeV886) {
  ensureCompletedImportButtonV884 = function() {
    ensureCompletedImportButtonBeforeV886();
    updateLessonImportButtonsV886();
  };
  ensureCompletedImportButtonV88 = ensureCompletedImportButtonV884;
}

document.addEventListener("change", (e) => {
  if (e.target?.id === "lessonStudentFilter") updateLessonImportButtonsV886();
});

const renderLessonsBeforeV886 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV886) {
  renderLessons = function() {
    renderLessonsBeforeV886();
    patchLessonCountDisplayV886();
    patchLessonCountFieldV886();
    updateLessonImportButtonsV886();
  };
}

const renderAllBeforeV886 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV886) {
  renderAll = function() {
    renderAllBeforeV886();
    patchLessonCountDisplayV886();
    updateLessonImportButtonsV886();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    patchLessonCountDisplayV886();
    updateLessonImportButtonsV886();
  }, 1000);
});



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

function actualTimeTextV887(item) {
  if (!item || item.lesson_type !== "actual") return "";
  const start = String(item.start_time || "").trim();
  const end = String(item.end_time || "").trim();
  if (!start && !end) return "";
  const minutes = Number(item.actual_minutes || minutesBetweenV887(start, end) || 0);
  const hourText = minutes ? ` / ${hoursFromMinutesExactV887(minutes)}H` : "";
  return `${start || "--:--"}-${end || "--:--"}${hourText}`;
}

function patchActualTimeDisplayV887() {
  document.querySelectorAll("tr.lesson-pair-row").forEach(tr => {
    const actualEditBtn = Array.from(tr.querySelectorAll("[data-edit][data-type='lesson']")).find(btn => {
      const item = (state.lessonRecords || []).find(x => String(x.id) === String(btn.dataset.edit));
      return item?.lesson_type === "actual";
    });
    const actualId = actualEditBtn?.dataset?.edit;
    const item = (state.lessonRecords || []).find(x => String(x.id) === String(actualId));
    if (!item || tr.querySelector(".actual-time-v887")) return;

    const cells = tr.querySelectorAll("td");
    const dateCell = cells[9]; // actual side date column
    const text = actualTimeTextV887(item);
    if (dateCell && text) {
      dateCell.insertAdjacentHTML("beforeend", `<div class="actual-time-v887">${esc(text)}</div>`);
    }
  });
}

function hideCancelHolidayStatV887() {
  document.querySelectorAll(".stat-card, .summary-card, .card, .metric-card").forEach(card => {
    const text = card.textContent || "";
    if (/取消\/放假数量|取消放假数量|取消|放假/.test(text) && /数量/.test(text)) {
      card.style.display = "none";
    }
  });
}

function updateMakeupStatLabelV887() {
  document.querySelectorAll(".stat-card, .summary-card, .card, .metric-card").forEach(card => {
    const label = card.querySelector(".label, .stat-label, small, span") || card.firstElementChild;
    if (!label) return;
    if (/已上课数量/.test(card.textContent || "")) return;
  });
}

// Robustly disable import/add buttons when no student selected.
function lessonStudentSelectedV887() {
  return Boolean(document.getElementById("lessonStudentFilter")?.value || "");
}

function updateLessonButtonsDisabledV887() {
  const disabled = !lessonStudentSelectedV887();
  [
    "lessonImportCompletedExcelBtnV88",
    "lessonImportExcelBtn",
    "addLessonBtn",
    "newLessonBtn",
    "createLessonBtn",
  ].forEach(id => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = disabled;
    btn.classList.toggle("disabled", disabled);
    if (disabled) btn.title = "请先选择学生";
    else btn.removeAttribute("title");
  });
}

document.addEventListener("click", (e) => {
  const btn = e.target?.closest?.("#lessonImportCompletedExcelBtnV88,#lessonImportExcelBtn,#addLessonBtn,#newLessonBtn,#createLessonBtn");
  if (!btn) return;
  if (!lessonStudentSelectedV887()) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    updateLessonButtonsDisabledV887();
    return;
  }
}, true);

document.addEventListener("change", (e) => {
  if (e.target?.id === "lessonStudentFilter") updateLessonButtonsDisabledV887();
});

// Header support:
// - old template: 时间
// - new template: 开始时间 / 结束时间
// - actual duration column can be absent
const headerMapBeforeV887 = typeof headerMap88 === "function" ? headerMap88 : null;
if (headerMapBeforeV887) {
  headerMap88 = function(header) {
    const map = headerMapBeforeV887(header);
    (header || []).forEach((cell, idx) => {
      const key = tx88(cell);
      if (/^开始时间$|^開始時間$|^实际开始时间$|^実際開始時間$/.test(key)) map.start = idx;
      if (/^结束时间$|^終了時間$|^实际结束时间$|^実際終了時間$/.test(key)) map.end = idx;
      if (/^时间$|^時間$|^上课时间$|^授课时间$/.test(key)) map.timeRange = idx;
    });
    return map;
  };
}

function buildCompletedImportRecordsV887(file, rows, sheetName, col, context) {
  const {
    studentId,
    studentName,
    businessEntityId,
    batchId,
    importedAt,
    baseYear,
  } = context;

  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  let actualSkipped = 0;

  for (let r = context.headerIndex + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const rawActualDate = col.actualDate !== undefined ? row[col.actualDate] : "";
    const actualDate = dt88(rawActualDate, baseYear);

    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? String(row[col.start] || "") : tr.start;
    const end = col.end !== undefined ? String(row[col.end] || "") : tr.end;
    const actualMinutes = minutesBetweenV887(start, end);
    const actualDuration = actualMinutes ? hoursFromMinutesExactV887(actualMinutes) : duration;

    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const plannedFee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);
    const actualFee = unit && actualDuration ? Math.round(unit * actualDuration) : plannedFee;

    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const count = normalizeLessonCountV886(col.count !== undefined ? row[col.count] : null);
    const normalNote = String(col.note !== undefined ? row[col.note] || "" : "");
    const salaryNote = String(col.salaryNote !== undefined ? row[col.salaryNote] || "" : "");
    const status = normalizeLessonStatusTextV885(col.status !== undefined ? row[col.status] : "");

    const plannedId = uuidV884("planned");
    const actualId = uuidV884("actual");
    const plannedYm = plannedDate.slice(0, 7);
    const baseNote = `完整课时导入：${sheetName}`;
    const mergedNote = buildCompletedLessonNoteV885(baseNote, "", normalNote, salaryNote);

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      unit_price: unit || 0,
      lesson_count: count,
      is_billable: true,
      note: mergedNote,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedYm,
      lesson_content: plannedContent,
      status: status || "completed",
      planned_lesson_id: null,
      duration_hours: duration,
      lesson_fee: plannedFee || 0,
      actual_minutes: null,
      ...common,
    });

    if (isActualGeneratedFromStatusV885(status, actualDate)) {
      records.push({
        id: actualId,
        lesson_type: "actual",
        planned_lesson_id: plannedId,
        lesson_date: actualDate,
        year_month: plannedYm,
        lesson_content: actualContent,
        status: status || "completed",
        duration_hours: actualDuration || duration,
        lesson_fee: actualFee || 0,
        actual_minutes: actualMinutes,
        ...common,
      });
    } else {
      actualSkipped++;
    }
  }

  return { records, skipped, actualSkipped };
}

async function importCompletedLessonExcelV887(file) {
  if (!lessonExcelRequireXLSX()) return;

  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生。", "error");
    return;
  }

  const student = (state.students || []).find(x => x.id === studentId);
  const studentName = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || student?.display_name || student?.name || "";
  const businessEntityId = student?.business_entity_id || state.businessEntities?.[0]?.id || null;
  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、回数、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  const { records, skipped, actualSkipped } = buildCompletedImportRecordsV887(file, rows, sheetName, col, {
    studentId,
    studentName,
    businessEntityId,
    batchId,
    importedAt,
    baseYear,
    headerIndex: hi,
  });

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);

  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({ batchId, studentId, studentName, fileName: file.name, count: records.length, importedAt });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

importCompletedLessonExcelV88 = importCompletedLessonExcelV887;
importCompletedLessonExcelV884 = importCompletedLessonExcelV887;
importCompletedLessonExcelV885 = importCompletedLessonExcelV887;
importCompletedLessonExcelV886 = importCompletedLessonExcelV887;

const renderAllBeforeV887 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV887) {
  renderAll = function() {
    renderAllBeforeV887();
    hideCancelHolidayStatV887();
    patchActualTimeDisplayV887();
    updateLessonButtonsDisabledV887();
  };
}

const renderLessonsBeforeV887 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV887) {
  renderLessons = function() {
    renderLessonsBeforeV887();
    hideCancelHolidayStatV887();
    patchActualTimeDisplayV887();
    updateLessonButtonsDisabledV887();
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    hideCancelHolidayStatV887();
    patchActualTimeDisplayV887();
    updateLessonButtonsDisabledV887();
  }, 1000);
});



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

function actualTimeTextV888(item) {
  if (!item || item.lesson_type !== "actual") return "";
  const start = cleanTimeForDisplayV888(item.start_time);
  const end = cleanTimeForDisplayV888(item.end_time);
  if (!start && !end) return "";
  const minutes = Number(item.actual_minutes || minutesBetweenV887(start, end) || 0);
  const hourText = minutes ? ` / ${hoursFromMinutesExactV887(minutes)}H` : "";
  return `${start || "--:--"}-${end || "--:--"}${hourText}`;
}
actualTimeTextV887 = actualTimeTextV888;

function patchBrokenExcelDateTimeTextV888() {
  const root = document.body;
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/Sat Dec 30 1899|GMT|日本標準時/.test(node.nodeValue || "")) nodes.push(node);
  }
  nodes.forEach(node => {
    node.nodeValue = node.nodeValue.replace(/Sat Dec 30 1899\s+(\d{1,2}):(\d{2}):\d{2}\s+GMT[^\s)]*(?:\s*\([^)]*\))?/g, (_, h, m) => `${String(Number(h)).padStart(2, "0")}:${m}`);
  });
}

const buildCompletedImportRecordsBeforeV888 = typeof buildCompletedImportRecordsV887 === "function" ? buildCompletedImportRecordsV887 : null;
if (buildCompletedImportRecordsBeforeV888) {
  buildCompletedImportRecordsV887 = function(file, rows, sheetName, col, context) {
    const result = buildCompletedImportRecordsBeforeV888(file, rows, sheetName, col, context);
    (result.records || []).forEach(row => {
      row.start_time = cleanTimeForDisplayV888(row.start_time);
      row.end_time = cleanTimeForDisplayV888(row.end_time);
      const minutes = minutesBetweenV887(row.start_time, row.end_time);
      if (row.lesson_type === "actual" && minutes) {
        row.actual_minutes = minutes;
        row.duration_hours = hoursFromMinutesExactV887(minutes);
        row.lesson_fee = Math.round(Number(row.unit_price || 0) * Number(row.duration_hours || 0));
      }
    });
    return result;
  };
}

function patchActualTimeDisplayV888() {
  patchBrokenExcelDateTimeTextV888();
  document.querySelectorAll("tr.lesson-pair-row").forEach(tr => {
    tr.querySelectorAll(".actual-time-v887, .actual-time-v888").forEach(x => x.remove());
    const actualEditBtn = Array.from(tr.querySelectorAll("[data-edit][data-type='lesson']")).find(btn => {
      const item = (state.lessonRecords || []).find(x => String(x.id) === String(btn.dataset.edit));
      return item?.lesson_type === "actual";
    });
    const item = (state.lessonRecords || []).find(x => String(x.id) === String(actualEditBtn?.dataset?.edit));
    if (!item) return;
    const dateCell = tr.querySelectorAll("td")[9];
    const text = actualTimeTextV888(item);
    if (dateCell && text) dateCell.insertAdjacentHTML("beforeend", `<div class="actual-time-v888">${esc(text)}</div>`);
  });
}
patchActualTimeDisplayV887 = patchActualTimeDisplayV888;

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

const renderAllBeforeV888 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV888) {
  renderAll = function() {
    renderAllBeforeV888();
    setTimeout(patchActualTimeDisplayV888, 0);
  };
}
const renderLessonsBeforeV888 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV888) {
  renderLessons = function() {
    renderLessonsBeforeV888();
    setTimeout(patchActualTimeDisplayV888, 0);
  };
}
document.addEventListener("DOMContentLoaded", () => setTimeout(patchActualTimeDisplayV888, 1000));



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
sumLessonsForSettlementV87 = function(studentId, month, type) {
  const rows = type === "planned"
    ? settlementPlannedLessonsV889(studentId, month)
    : settlementActualLessonsV889(studentId, month);
  return sumLessonFeeForSettlementV889(rows);
};

// Patch visible monthly settlement page.
function renderStudentSettlementV889() {
  fillStudentSelectV83("settlementStudentFilter");
  const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  const student = (state.students || []).find(x => x.id === studentId);
  const hint = document.getElementById("settlementStudentHint");

  if (hint) {
    hint.classList.toggle("ok", !!studentId && !!student && Number(student.preset_exchange_rate || 0) > 0);
    hint.textContent = !studentId ? "学生必选" : (rateErrorTextV834(student) || "已选择学生");
  }

  if (!studentId || !student) {
    ["settlementPlannedHours", "settlementActualHours", "settlementPlannedJpy", "settlementActualJpy",
     "settlementPrevBalanceCny", "settlementExchangeRate", "settlementPlannedJpy2", "settlementPlannedCny",
     "settlementPlannedTotalCny", "settlementActualJpy2", "settlementActualCny", "settlementReceivedCny", "settlementReceivedJpy"].forEach(id => setOptionalText(id, "0"));
    const tbody = document.getElementById("settlementLessonsTable");
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="empty-row">请先选择学生</td></tr>`;
    return;
  }

  const rate = Number(student.preset_exchange_rate || 0);
  if (rate <= 0) {
    showMessage(rateErrorTextV834(student), "error");
  }

  const planned = settlementPlannedLessonsV889(studentId, month);
  const actual = settlementActualLessonsV889(studentId, month);

  const prevBalanceCny = Number(student.previous_balance_cny || 0);
  const plannedJpy = sumLessonFeeForSettlementV889(planned);
  const actualJpy = sumLessonFeeForSettlementV889(actual);
  const plannedCny = plannedJpy * rate;
  const actualCny = actualJpy * rate;
  const plannedTotalCny = plannedCny - prevBalanceCny;
  const receivedCny = sumIncomeV83(studentId, month, "CNY");
  const receivedJpy = sumIncomeV83(studentId, month, "JPY");

  setOptionalText("settlementPlannedHours", money(sumLessonHoursV83(planned)));
  setOptionalText("settlementActualHours", money(sumLessonHoursV83(actual)));
  setOptionalText("settlementPlannedJpy", formatJpyV83(plannedJpy));
  setOptionalText("settlementActualJpy", formatJpyV83(actualJpy));

  setOptionalText("settlementPrevBalanceCny", formatCnyV83(prevBalanceCny));
  setOptionalText("settlementExchangeRate", money(rate));
  setOptionalText("settlementPlannedJpy2", formatJpyV83(plannedJpy));
  setOptionalText("settlementPlannedCny", formatCnyV83(plannedCny));
  setOptionalText("settlementPlannedTotalCny", formatCnyV83(plannedTotalCny));

  setOptionalText("settlementActualJpy2", formatJpyV83(actualJpy));
  setOptionalText("settlementActualCny", formatCnyV83(actualCny));
  setOptionalText("settlementReceivedCny", formatCnyV83(receivedCny));
  setOptionalText("settlementReceivedJpy", formatCnyV83(receivedJpy));

  renderSettlementPairedLessonsV834(planned, actual);

  if (typeof updateSettlementLockPreviewV87 === "function") {
    setTimeout(updateSettlementLockPreviewV87, 0);
  }
}

renderStudentSettlement = renderStudentSettlementV889;
renderStudentSettlementV834 = renderStudentSettlementV889;

function bindStudentSettlementV889() {
  if (typeof fillStudentSelectV83 === "function") fillStudentSelectV83("settlementStudentFilter");

  const refresh = document.getElementById("settlementRefreshBtn");
  if (refresh) refresh.onclick = renderStudentSettlementV889;

  const month = document.getElementById("settlementMonthFilter");
  if (month) month.onchange = renderStudentSettlementV889;

  const student = document.getElementById("settlementStudentFilter");
  if (student) student.onchange = renderStudentSettlementV889;

  renderStudentSettlementV889();
}
bindStudentSettlementV834 = bindStudentSettlementV889;

const renderAllBeforeV889 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV889) {
  renderAll = function() {
    renderAllBeforeV889();
    bindStudentSettlementV889();
  };
}

const switchPageBeforeV889 = typeof switchPage === "function" ? switchPage : null;
if (switchPageBeforeV889) {
  switchPage = function(page) {
    switchPageBeforeV889(page);
    if (page === "student-settlement") {
      bindStudentSettlementV889();
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindStudentSettlementV889, 800);
});

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

// Header map override: support 计费 column
const headerMapBeforeV8810 = typeof headerMap88 === "function" ? headerMap88 : null;
if (headerMapBeforeV8810) {
  headerMap88 = function(header) {
    const map = headerMapBeforeV8810(header);
    (header || []).forEach((cell, idx) => {
      const key = tx88(cell);
      if (/^计费$|^是否计费$|^收费$|^是否收费$|^請求$|^請求対象$/.test(key) && map.billable === undefined) {
        map.billable = idx;
      }
      if (/^开始时间$|^開始時間$|^实际开始时间$|^実際開始時間$/.test(key)) map.start = idx;
      if (/^结束时间$|^終了時間$|^实际结束时间$|^実際終了時間$/.test(key)) map.end = idx;
    });
    return map;
  };
}

// 2) 完整课时导入读取“计费”列，并支持取消课
async function importCompletedLessonExcelV8810(file) {
  if (!lessonExcelRequireXLSX()) return;

  const studentId = document.getElementById("lessonStudentFilter")?.value || "";
  if (!studentId) {
    showMessage("请先选择学生。", "error");
    return;
  }

  const student = (state.students || []).find(x => x.id === studentId);
  const studentName = document.getElementById("lessonStudentFilter")?.selectedOptions?.[0]?.textContent || student?.display_name || student?.name || "";
  const businessEntityId = student?.business_entity_id || state.businessEntities?.[0]?.id || null;
  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、回数、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  let actualSkipped = 0;
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;

    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const rawActualDate = col.actualDate !== undefined ? row[col.actualDate] : "";
    const actualDate = dt88(rawActualDate, baseYear);

    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? cleanTimeForDisplayV888(row[col.start]) : tr.start;
    const end = col.end !== undefined ? cleanTimeForDisplayV888(row[col.end]) : tr.end;
    const actualMinutes = typeof minutesBetweenV887 === "function" ? minutesBetweenV887(start, end) : null;
    const actualDuration = actualMinutes ? hoursFromMinutesExactV887(actualMinutes) : duration;

    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const plannedFee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);
    const actualFee = unit && actualDuration ? Math.round(unit * actualDuration) : plannedFee;

    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const count = normalizeLessonCountV886(col.count !== undefined ? row[col.count] : null);
    const normalNote = String(col.note !== undefined ? row[col.note] || "" : "");
    const salaryNote = String(col.salaryNote !== undefined ? row[col.salaryNote] || "" : "");
    const status = normalizeLessonStatusTextV8810(col.status !== undefined ? row[col.status] : "");
    const explicitBillable = col.billable !== undefined ? row[col.billable] : "";
    const billable = parseBillableTextV8810(explicitBillable, defaultBillableByStatusV8810(status || "completed"));

    const plannedId = uuidV884("planned");
    const actualId = uuidV884("actual");
    const plannedYm = plannedDate.slice(0, 7);
    const baseNote = `完整课时导入：${sheetName}`;
    const mergedNote = buildCompletedLessonNoteV885(baseNote, "", normalNote, salaryNote);

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      unit_price: unit || 0,
      lesson_count: count,
      is_billable: billable,
      note: mergedNote,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedYm,
      lesson_content: plannedContent,
      status: status || "completed",
      planned_lesson_id: null,
      duration_hours: duration,
      lesson_fee: plannedFee || 0,
      actual_minutes: null,
      ...common,
    });

    const shouldCreateActual =
      actualDate &&
      status !== "pending_makeup" &&
      status !== "cancelled" &&
      (!status || status === "completed" || status === "makeup_completed");

    if (shouldCreateActual) {
      records.push({
        id: actualId,
        lesson_type: "actual",
        planned_lesson_id: plannedId,
        lesson_date: actualDate,
        year_month: plannedYm,
        lesson_content: actualContent,
        status: status || "completed",
        duration_hours: actualDuration || duration,
        lesson_fee: actualFee || 0,
        actual_minutes: actualMinutes,
        ...common,
      });
    } else {
      actualSkipped++;
    }
  }

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);
  const billableCount = records.filter(x => x.lesson_type === "planned" && x.is_billable !== false).length;
  const nonBillableCount = records.filter(x => x.lesson_type === "planned" && x.is_billable === false).length;

  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentName}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n计费预定：${billableCount} 条\n不计费预定：${nonBillableCount} 条\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({ batchId, studentId, studentName, fileName: file.name, count: records.length, importedAt });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

importCompletedLessonExcelV88 = importCompletedLessonExcelV8810;
importCompletedLessonExcelV884 = importCompletedLessonExcelV8810;
importCompletedLessonExcelV885 = importCompletedLessonExcelV8810;
importCompletedLessonExcelV886 = importCompletedLessonExcelV8810;
importCompletedLessonExcelV887 = importCompletedLessonExcelV8810;

// 3) 新增/编辑课时状态下拉增加取消课
function patchLessonStatusSelectV8810() {
  const form = document.getElementById("modalForm");
  if (!form || state.editing?.type !== "lesson") return;
  const select = form.querySelector('[name="status"]');
  if (!select) return;
  const current = select.value;
  select.innerHTML = lessonStatusOptionsV8810().map(opt => `<option value="${escAttr(opt.value)}">${esc(opt.label)}</option>`).join("");
  select.value = ["completed", "pending_makeup", "makeup_completed", "cancelled"].includes(current) ? current : "completed";
}

// 4) 收入分类为学费时，必须指定学生
const saveFormBeforeV8810 = typeof saveForm === "function" ? saveForm : null;
if (saveFormBeforeV8810) {
  saveForm = async function(e) {
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

// 5) 结算调整原因允许清空。
// 之前出现“删到最后一个字自动回到初始状态”，不是业务设置，属于预览刷新时回填的问题。
const updateSettlementLockPreviewBeforeV8810 = typeof updateSettlementLockPreviewV87 === "function" ? updateSettlementLockPreviewV87 : null;
if (updateSettlementLockPreviewBeforeV8810) {
  updateSettlementLockPreviewV87 = function() {
    const reasonInput = document.getElementById("settlementAdjustmentReasonV87");
    const userReason = reasonInput ? reasonInput.value : "";
    updateSettlementLockPreviewBeforeV8810();
    if (reasonInput) {
      reasonInput.value = userReason;
    }
  };
}

const adjustmentFromPanelBeforeV8810 = typeof adjustmentFromPanelV87 === "function" ? adjustmentFromPanelV87 : null;
if (adjustmentFromPanelBeforeV8810) {
  adjustmentFromPanelV87 = function() {
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

const renderAllBeforeV8810 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8810) {
  renderAll = function() {
    renderAllBeforeV8810();
    setTimeout(patchLessonStatusSelectV8810, 0);
  };
}

const openCreateModalBeforeV8810 = typeof openCreateModal === "function" ? openCreateModal : null;
if (openCreateModalBeforeV8810) {
  openCreateModal = function(type, prefill = {}) {
    openCreateModalBeforeV8810(type, prefill);
    if (type === "lesson") setTimeout(patchLessonStatusSelectV8810, 0);
  };
}

const openEditModalBeforeV8810 = typeof openEditModal === "function" ? openEditModal : null;
if (openEditModalBeforeV8810) {
  openEditModal = function(type, id) {
    openEditModalBeforeV8810(type, id);
    if (type === "lesson") setTimeout(patchLessonStatusSelectV8810, 0);
  };
}



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
  saveForm = async function(...args) {
    if (!validateIncomeTuitionStudentV8811()) return;
    if (!args.length || !args[0]) args = [{ preventDefault(){}, stopPropagation(){}, stopImmediatePropagation(){}, target: document.getElementById("modalForm") }];
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
  openCreateModal = function(type, prefill = {}) {
    openCreateModalBeforeV8811(type, prefill);
    const form = document.getElementById("modalForm");
    if (form) form.dataset.type = type;
    if (type === "income") setTimeout(bindIncomeTuitionValidationV8811, 0);
  };
}

const openEditModalBeforeV8811 = typeof openEditModal === "function" ? openEditModal : null;
if (openEditModalBeforeV8811) {
  openEditModal = function(type, id) {
    openEditModalBeforeV8811(type, id);
    const form = document.getElementById("modalForm");
    if (form) form.dataset.type = type;
    if (type === "income") setTimeout(bindIncomeTuitionValidationV8811, 0);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(bindIncomeTuitionValidationV8811, 1000);
});



// === v8.8.12 lesson statistics scope fix ===
function lessonStatusV8812(row) {
  return String(row?.status || "").trim();
}

function lessonIsPendingMakeupV8812(row) {
  const s = lessonStatusV8812(row);
  return s === "pending_makeup" || s === "待补课" || s === "待补";
}

function lessonIsCancelledV8812(row) {
  const s = lessonStatusV8812(row);
  return s === "cancelled" || s === "取消课" || s === "取消";
}

function nV8812(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function lessonCalcFeeV8812(row, hours = nV8812(row?.duration_hours)) {
  return nV8812(row?.unit_price) * nV8812(hours);
}

function formatHoursV8812(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

function lessonStatsV8812(rows) {
  const list = rows || [];
  const planned = list.filter(x => x.lesson_type === "planned");
  const actual = list.filter(x => x.lesson_type === "actual");

  const plannedHours = planned.reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const plannedFee = planned
    .filter(row => row.is_billable !== false)
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const actualCountable = actual.filter(row => !lessonIsCancelledV8812(row));

  const actualHoursFromActual = actualCountable
    .reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const pendingBillable = planned.filter(row => lessonIsPendingMakeupV8812(row) && row.is_billable !== false);

  const pendingBillableHours = pendingBillable
    .reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const actualHoursForStats = actualHoursFromActual + pendingBillableHours;

  const actualFeeFromActual = actualCountable
    .filter(row => row.is_billable !== false)
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const pendingBillableFee = pendingBillable
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const actualFeeForStats = actualFeeFromActual + pendingBillableFee;

  return {
    plannedHours,
    actualHoursForStats,
    plannedFee,
    actualFeeForStats,
    completedCount: actualCountable.length,
    pendingMakeupCount: planned.filter(lessonIsPendingMakeupV8812).length,
    cancelledCount: planned.filter(lessonIsCancelledV8812).length,
    recordCount: list.length,
  };
}

function setLessonStatTextV8812(ids, value) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = value;
      return true;
    }
  }
  return false;
}

function patchLessonStatsCardsByTextV8812(stats) {
  const cards = Array.from(document.querySelectorAll(".stat-card, .summary-card, .metric-card, .card"));
  const setByLabel = (pattern, value) => {
    const card = cards.find(c => pattern.test(c.textContent || ""));
    if (!card) return;
    const candidates = Array.from(card.querySelectorAll("strong, .stat-value, .metric-value, h2, h3, .value"));
    const target = candidates.find(x => /\d|JPY|CNY/.test(x.textContent || "")) || candidates[candidates.length - 1];
    if (target) target.textContent = value;
  };

  setByLabel(/预定课时合计/, formatHoursV8812(stats.plannedHours));
  setByLabel(/实际课时合计/, formatHoursV8812(stats.actualHoursForStats));
  setByLabel(/预定课时费合计/, typeof formatJpyV83 === "function" ? formatJpyV83(stats.plannedFee) : `${Math.round(stats.plannedFee).toLocaleString()} JPY`);
  setByLabel(/实际课时费合计/, typeof formatJpyV83 === "function" ? formatJpyV83(stats.actualFeeForStats) : `${Math.round(stats.actualFeeForStats).toLocaleString()} JPY`);
  setByLabel(/已上课数量/, String(stats.completedCount));
  setByLabel(/待补课数量/, String(stats.pendingMakeupCount));
  setByLabel(/记录数/, String(stats.recordCount));

  cards.forEach(card => {
    if (/取消\/放假数量|取消放假数量/.test(card.textContent || "")) {
      card.style.display = "none";
    }
  });
}

function renderLessonStatsV8812(rows) {
  const stats = lessonStatsV8812(rows || []);
  setLessonStatTextV8812(["lessonPlannedHours", "lessonPlannedHoursTotal", "plannedLessonHoursTotal"], formatHoursV8812(stats.plannedHours));
  setLessonStatTextV8812(["lessonActualHours", "lessonActualHoursTotal", "actualLessonHoursTotal"], formatHoursV8812(stats.actualHoursForStats));
  setLessonStatTextV8812(["lessonPlannedFee", "lessonPlannedFeeTotal", "plannedLessonFeeTotal"], typeof formatJpyV83 === "function" ? formatJpyV83(stats.plannedFee) : `${Math.round(stats.plannedFee).toLocaleString()} JPY`);
  setLessonStatTextV8812(["lessonActualFee", "lessonActualFeeTotal", "actualLessonFeeTotal"], typeof formatJpyV83 === "function" ? formatJpyV83(stats.actualFeeForStats) : `${Math.round(stats.actualFeeForStats).toLocaleString()} JPY`);
  setLessonStatTextV8812(["lessonCompletedCount", "completedLessonCount"], String(stats.completedCount));
  setLessonStatTextV8812(["lessonPendingMakeupCount", "pendingMakeupLessonCount"], String(stats.pendingMakeupCount));
  setLessonStatTextV8812(["lessonRecordCount", "lessonTotalCount"], String(stats.recordCount));
  setTimeout(() => patchLessonStatsCardsByTextV8812(stats), 0);
}

renderLessonStats = renderLessonStatsV8812;

const renderLessonsBeforeV8812 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV8812) {
  renderLessons = function() {
    renderLessonsBeforeV8812();
    const rows = typeof filterLessons === "function" ? filterLessons().slice() : (state.lessonRecords || []);
    renderLessonStatsV8812(rows);
  };
}

const renderAllBeforeV8812 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8812) {
  renderAll = function() {
    renderAllBeforeV8812();
    if (typeof filterLessons === "function") {
      setTimeout(() => renderLessonStatsV8812(filterLessons().slice()), 0);
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof filterLessons === "function") renderLessonStatsV8812(filterLessons().slice());
  }, 1000);
});



// === v8.8.13 planned fee and lesson_count ordering fix ===
// 1. 预定课时费合计：按全部预定课时的 单价 × 预定时长 计算，包括取消课。
// 2. 同一天/同周同科目课程排序加入 lesson_count，回数小的在上。

function normalizeLessonCountV8813(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function lessonSubjectNameV8813(row) {
  return row?.subject?.name || row?.subject_name || "";
}

function subjectPriorityV8813(row) {
  const name = lessonSubjectNameV8813(row);
  const order = ["日语", "数学", "物理", "化学", "生物", "文综"];
  const idx = order.findIndex(x => name.includes(x));
  return idx < 0 ? 99 : idx;
}

function lessonSortKeyDateV8813(row) {
  return String(row?.lesson_date || "");
}

function compareLessonsV8813(a, b) {
  const dateCompare = lessonSortKeyDateV8813(a).localeCompare(lessonSortKeyDateV8813(b));
  if (dateCompare) return dateCompare;

  const subjectCompare = subjectPriorityV8813(a) - subjectPriorityV8813(b);
  if (subjectCompare) return subjectCompare;

  const teacherCompare = String(a?.teacher_id || "").localeCompare(String(b?.teacher_id || ""));
  if (teacherCompare) return teacherCompare;

  const aCount = normalizeLessonCountV8813(a?.lesson_count);
  const bCount = normalizeLessonCountV8813(b?.lesson_count);
  if (aCount !== null || bCount !== null) {
    if (aCount === null) return 1;
    if (bCount === null) return -1;
    if (aCount !== bCount) return aCount - bCount;
  }

  const timeCompare = String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
  if (timeCompare) return timeCompare;

  const createdCompare = String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
  if (createdCompare) return createdCompare;

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

compareLessonsV78 = compareLessonsV8813;
compareLessonsV83 = compareLessonsV8813;
compareLessonsV872 = compareLessonsV8813;

// v8.8.12 statistics correction:
// 预定课时费合计包含取消课，因为它表示“原始预定课时费合计”。
// 实际课时费合计仍然排除取消课、不计费课，并加入待补课且计费的课。
function lessonStatsV8813(rows) {
  const list = rows || [];
  const planned = list.filter(x => x.lesson_type === "planned");
  const actual = list.filter(x => x.lesson_type === "actual");

  const plannedHours = planned.reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const plannedFee = planned
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const actualCountable = actual.filter(row => !lessonIsCancelledV8812(row));

  const actualHoursFromActual = actualCountable
    .reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const pendingBillable = planned.filter(row => lessonIsPendingMakeupV8812(row) && row.is_billable !== false);

  const pendingBillableHours = pendingBillable
    .reduce((sum, row) => sum + nV8812(row.duration_hours), 0);

  const actualHoursForStats = actualHoursFromActual + pendingBillableHours;

  const actualFeeFromActual = actualCountable
    .filter(row => row.is_billable !== false)
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const pendingBillableFee = pendingBillable
    .reduce((sum, row) => sum + lessonCalcFeeV8812(row), 0);

  const actualFeeForStats = actualFeeFromActual + pendingBillableFee;

  return {
    plannedHours,
    actualHoursForStats,
    plannedFee,
    actualFeeForStats,
    completedCount: actualCountable.length,
    pendingMakeupCount: planned.filter(lessonIsPendingMakeupV8812).length,
    cancelledCount: planned.filter(lessonIsCancelledV8812).length,
    recordCount: list.length,
  };
}

lessonStatsV8812 = lessonStatsV8813;

function renderLessonStatsV8813(rows) {
  const stats = lessonStatsV8813(rows || []);
  setLessonStatTextV8812(["lessonPlannedHours", "lessonPlannedHoursTotal", "plannedLessonHoursTotal"], formatHoursV8812(stats.plannedHours));
  setLessonStatTextV8812(["lessonActualHours", "lessonActualHoursTotal", "actualLessonHoursTotal"], formatHoursV8812(stats.actualHoursForStats));
  setLessonStatTextV8812(["lessonPlannedFee", "lessonPlannedFeeTotal", "plannedLessonFeeTotal"], typeof formatJpyV83 === "function" ? formatJpyV83(stats.plannedFee) : `${Math.round(stats.plannedFee).toLocaleString()} JPY`);
  setLessonStatTextV8812(["lessonActualFee", "lessonActualFeeTotal", "actualLessonFeeTotal"], typeof formatJpyV83 === "function" ? formatJpyV83(stats.actualFeeForStats) : `${Math.round(stats.actualFeeForStats).toLocaleString()} JPY`);
  setLessonStatTextV8812(["lessonCompletedCount", "completedLessonCount"], String(stats.completedCount));
  setLessonStatTextV8812(["lessonPendingMakeupCount", "pendingMakeupLessonCount"], String(stats.pendingMakeupCount));
  setLessonStatTextV8812(["lessonRecordCount", "lessonTotalCount"], String(stats.recordCount));
  setTimeout(() => patchLessonStatsCardsByTextV8812(stats), 0);
}

renderLessonStats = renderLessonStatsV8813;
renderLessonStatsV8812 = renderLessonStatsV8813;

const renderLessonsBeforeV8813 = typeof renderLessons === "function" ? renderLessons : null;
if (renderLessonsBeforeV8813) {
  renderLessons = function() {
    renderLessonsBeforeV8813();
    const rows = typeof filterLessons === "function" ? filterLessons().slice() : (state.lessonRecords || []);
    renderLessonStatsV8813(rows);
  };
}

const renderAllBeforeV8813 = typeof renderAll === "function" ? renderAll : null;
if (renderAllBeforeV8813) {
  renderAll = function() {
    renderAllBeforeV8813();
    if (typeof filterLessons === "function") {
      setTimeout(() => renderLessonStatsV8813(filterLessons().slice()), 0);
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (typeof filterLessons === "function") renderLessonStatsV8813(filterLessons().slice());
  }, 1000);
});

