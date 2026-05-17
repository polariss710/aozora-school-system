const SUPABASE_URL = "https://xlcdqvlfzspcxdoidsrr.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_6c7EFHXfq256rvv8KvY0Yw_FrAZtb6x";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const state = {
  page: "dashboard",
  businessEntities: [],
  subjects: [],
  students: [],
  teachers: [],
  accounts: [],
  incomeRecords: [],
  expenseRecords: [],
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
  backup: ["备份/恢复", "导出基础数据 JSON 备份"],
};

const tables = {
  business: "school_business_entities",
  subjects: "school_subjects",
  students: "school_students",
  teachers: "school_teachers",
  accounts: "school_accounts",
  income: "school_income_records",
  expenses: "school_expense_records",
  transactions: "school_account_transactions",
};

document.addEventListener("DOMContentLoaded", async () => {
  bindNavigation();
  bindGlobalActions();
  bindSearch();
  await init();
});

async function init() {
  await checkConnection();
  await loadAll();
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
    loadStudents(),
    loadTeachers(),
    loadAccounts(),
    loadIncomeRecords(),
    loadExpenseRecords(),
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
  const { data, error } = await db
    .from(tables.expenses)
    .select("*, business_entity:school_business_entities(name, code), account:school_accounts(name, currency)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return showMessage(error.message, "error");
  state.expenseRecords = data || [];
}

function renderAll() {
  renderStats();
  renderBusinessTable();
  renderSubjectsTable();
  renderStudentsTable();
  renderTeachersTable();
  renderAccountsTable();
  updateFinanceFilters();
  renderIncomeTable();
  renderExpensesTable();
  renderFinanceSummary();
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

function renderIncomeTable() {
  const tbody = document.getElementById("incomeTable");
  if (!tbody) return;
  const rows = filterFinanceRows(state.incomeRecords, "income");
  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${esc(item.income_date || "")}</td>
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
  `).join("");
}

function renderExpensesTable() {
  const tbody = document.getElementById("expensesTable");
  if (!tbody) return;
  const rows = filterFinanceRows(state.expenseRecords, "expense");
  tbody.innerHTML = rows.map(item => `
    <tr>
      <td>${esc(item.expense_date || "")}</td>
      <td>${esc(item.year_month || "")}</td>
      <td>${esc(item.business_entity?.name || "")}</td>
      <td>${esc(expenseCategoryLabel(item.expense_category))}</td>
      <td>${esc(short(item.description || item.note, 28))}</td>
      <td>${esc(item.account?.name || "")}</td>
      <td>${esc(item.currency || "")}</td>
      <td>${money(item.amount)}</td>
      <td>${financeStatusBadge(item.status)}</td>
      <td>${item.is_business_expense ? badge("可经费") : badge("不可/待确认", "gray")}</td>
      <td>${esc(item.receipt_status || "")}</td>
      <td>${actionButtons("expense", item.id)}</td>
    </tr>
  `).join("");
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
  const rows = state.accounts.filter(x => !entity || x.business_entity_id === entity);
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
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchPage(btn.dataset.page));
  });
}

function switchPage(page) {
  state.page = page;
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.page === page));
  document.querySelectorAll(".page").forEach(section => section.classList.toggle("active", section.id === `page-${page}`));
  setText("pageTitle", pageMeta[page][0]);
  setText("pageSubtitle", pageMeta[page][1]);
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

  document.getElementById("exportBackupBtn").addEventListener("click", exportBackup);
  bindFinanceFilters();

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

function bindFinanceFilters() {
  ["incomeMonthFilter", "incomeEntityFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderIncomeTable);
  });
  ["expenseMonthFilter", "expenseEntityFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderExpensesTable);
  });
  ["financeMonthFilter", "financeEntityFilter"].forEach(id => {
    document.getElementById(id)?.addEventListener("change", renderFinanceSummary);
  });
  document.getElementById("incomeClearFilter")?.addEventListener("click", () => {
    document.getElementById("incomeMonthFilter").value = "";
    document.getElementById("incomeEntityFilter").value = "";
    renderIncomeTable();
  });
  document.getElementById("expenseClearFilter")?.addEventListener("click", () => {
    document.getElementById("expenseMonthFilter").value = "";
    document.getElementById("expenseEntityFilter").value = "";
    renderExpensesTable();
  });
  document.getElementById("financeClearFilter")?.addEventListener("click", () => {
    document.getElementById("financeMonthFilter").value = "";
    document.getElementById("financeEntityFilter").value = "";
    renderFinanceSummary();
  });
}

function updateFinanceFilters() {
  const options = `<option value="">全部业务归属</option>` + state.businessEntities
    .map(x => `<option value="${escAttr(x.id)}">${esc(x.name)}</option>`)
    .join("");
  ["incomeEntityFilter", "expenseEntityFilter", "financeEntityFilter"].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const old = el.value;
    el.innerHTML = options;
    el.value = old;
  });
}

function openCreateModal(type) {
  state.editing = { type, id: null };
  buildForm(type);
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
}

function buildForm(type, data = {}) {
  const form = document.getElementById("modalForm");
  const fields = getFields(type);

  form.innerHTML = fields.map(field => renderField(field, data[field.name], data)).join("") + `
    <div class="form-actions">
      <button type="button" class="secondary-btn" id="cancelFormBtn">取消</button>
      <button type="submit" class="primary-btn">保存</button>
    </div>
  `;

  document.getElementById("cancelFormBtn").addEventListener("click", closeModal);
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
      options = subjectTertiaryCategoryOptions(currentCategory);
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

  if (field.type === "color-palette") {
    const colors = subjectColorOptions();
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

  return `
    <div class="form-row${full}${extraClass}">
      <label>${field.label}</label>
      <input name="${field.name}" type="${field.type || "text"}" value="${escAttr(val)}" ${required} />
    </div>
  `;
}

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
    { name: "primary_category", label: "一级分类", type: "select", default: "班课", options: subjectPrimaryCategoryOptions() },
    { name: "category", label: "二级分类", type: "select", default: "学部进学", options: subjectCategoryOptions() },
    { name: "tertiary_category", label: "三级分类", type: "select", default: "EJU留考课程", options: subjectTertiaryCategoryOptions("学部进学") },
    { name: "color", label: "颜色", type: "color-palette", default: "#dff2fb" },
    { name: "sort_order", label: "排序", type: "number", default: 0 },
    { name: "is_active", label: "状态启用", type: "checkbox", default: true },
    { name: "note", label: "备注", type: "textarea", full: true },
  ];

  if (type === "student") return [
    { name: "name", label: "学生姓名", required: true },
    { name: "display_name", label: "显示名" },
    { name: "business_entity_id", label: "默认业务归属", type: "select", options: businessOptions, required: true },
    { name: "target_type", label: "学习目标", placeholder: "EJU / JLPT / 大学院" },
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

  if (type === "account") return [
    { name: "name", label: "账户名称", required: true },
    { name: "account_code", label: "账户代码" },
    { name: "account_type", label: "账户类型", type: "select", default: "bank", options: [
      { value: "bank", label: "银行" },
      { value: "cash", label: "现金" },
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

async function saveForm(e) {
  e.preventDefault();
  if (!state.editing) return;

  const type = state.editing.type;
  const fd = new FormData(e.target);
  const fields = getFields(type);
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

  const table = tableForType(type);
  const oldRecord = state.editing.id ? findLocal(type, state.editing.id) : null;
  let result;
  if (state.editing.id) {
    result = await db.from(table).update(payload).eq("id", state.editing.id).select().single();
  } else {
    result = await db.from(table).insert(payload).select().single();
  }

  if (result.error) {
    showMessage(result.error.message, "error");
    return;
  }

  if (type === "income" || type === "expense") {
    await syncFinanceAccountEffect(type, oldRecord, result.data);
  }

  closeModal();
  await loadAll();
  renderAll();
  showMessage("保存成功。", "ok");
}

async function deleteRecord(type, id) {
  const item = findLocal(type, id);
  if (!confirm(`确定删除「${item?.name || item?.title || "这条记录"}」吗？`)) return;

  if (type === "income" || type === "expense") {
    await syncFinanceAccountEffect(type, item, null);
  }

  const { error } = await db.from(tableForType(type)).delete().eq("id", id);
  if (error) {
    showMessage(error.message, "error");
    return;
  }

  await loadAll();
  renderAll();
  showMessage("删除成功。", "ok");
}

function findLocal(type, id) {
  const map = {
    business: state.businessEntities,
    subject: state.subjects,
    student: state.students,
    teacher: state.teachers,
    account: state.accounts,
    income: state.incomeRecords,
    expense: state.expenseRecords,
  };
  return (map[type] || []).find(x => x.id === id) || {};
}

function tableForType(type) {
  return {
    business: tables.business,
    subject: tables.subjects,
    student: tables.students,
    teacher: tables.teachers,
    account: tables.accounts,
    income: tables.income,
    expense: tables.expenses,
  }[type];
}

function modalTitle(type, edit) {
  const map = {
    business: "业务归属",
    subject: "科目",
    student: "学生",
    teacher: "老师",
    account: "账户",
    income: "收入",
    expense: "支出",
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
  if (scope === "income") {
    month = document.getElementById("incomeMonthFilter")?.value || "";
    entity = document.getElementById("incomeEntityFilter")?.value || "";
  } else if (scope === "expense") {
    month = document.getElementById("expenseMonthFilter")?.value || "";
    entity = document.getElementById("expenseEntityFilter")?.value || "";
  } else {
    month = document.getElementById("financeMonthFilter")?.value || "";
    entity = document.getElementById("financeEntityFilter")?.value || "";
  }
  return rows.filter(x => (!month || x.year_month === month) && (!entity || x.business_entity_id === entity));
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
