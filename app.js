
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

async function saveForm(e) {
  e.preventDefault();
  const form = e.target;
  const submitButton = form?.querySelector('button[type="submit"], .primary-btn');
  if (!state.editing) return;

  const type = state.editing.type;
  if (state.isSavingForm || form?.dataset?.saving === "true") return;
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
  let result;
  if (state.editing.id) {
    result = await db.from(table).update(payload).eq("id", state.editing.id).select().single();
  } else {
    result = await db.from(table).insert(payload).select().single();
  }

  if (result.error) {
    resetFormSavingStateV71(form, submitButton);
    showMessage(result.error.message, "error");
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
      const studentId = document.getElementById("lessonStudentFilter")?.value || "";
      if (!studentId) {
        showMessage("请先在课时管理筛选中选择学生，再导入 Excel。", "error");
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

function fillStudentSelectV83(selectId, keepValue = true) {
  const el = document.getElementById(selectId);
  if (!el) return;
  const old = keepValue ? el.value : "";
  el.innerHTML = `<option value="">选择学生</option>` + (state.students || [])
    .map(s => `<option value="${escAttr(s.id)}">${esc(studentLabelV83(s))}</option>`)
    .join("");
  el.value = old;
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
    (x.status === "completed" || x.status === "makeup" || x.status === "planned")
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

