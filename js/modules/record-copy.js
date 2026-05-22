// === v9.1.14.1 record copy button size fix ===
// 在工资规则、收入记录、支出记录的每行操作区增加“复制”按钮。
// 复制 = 以当前记录为模板打开新增/录入画面，不会直接保存新记录。

(function () {
  function cloneForCreate(row) {
    const copy = { ...(row || {}) };
    [
      "id",
      "created_at",
      "updated_at",
      "student",
      "teacher",
      "subject",
      "business_entity",
      "account",
      "attachments",
    ].forEach(key => delete copy[key]);
    return copy;
  }

  function insertButtonBefore(target, button) {
    if (!target || !target.parentElement) return;
    target.parentElement.insertBefore(button, target);
  }

  function makeCopyButton(kind, id) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = kind === "teacherRule"
      ? "secondary-btn teacher-rule-mini-btn copy-record-btn"
      : "secondary-btn copy-record-btn";
    btn.textContent = "复制";
    btn.dataset.copyKind = kind;
    btn.dataset.copyId = id;
    return btn;
  }

  function ensureIncomeExpenseCopyButtons() {
    document.querySelectorAll("[data-edit][data-type='income'], [data-edit][data-type='expense']").forEach(editBtn => {
      const type = editBtn.dataset.type;
      const id = editBtn.dataset.edit;
      const parent = editBtn.parentElement;
      if (!parent || parent.querySelector(`[data-copy-kind="${type}"][data-copy-id="${CSS.escape(id)}"]`)) return;

      const btn = makeCopyButton(type, id);
      btn.addEventListener("click", () => copyFinanceRecord(type, id));
      insertButtonBefore(editBtn, btn);
    });
  }

  function ensureTeacherRuleCopyButtons() {
    document.querySelectorAll("[data-rule-edit]").forEach(editBtn => {
      const id = editBtn.dataset.ruleEdit;
      const parent = editBtn.parentElement;
      if (!parent || parent.querySelector(`[data-copy-kind="teacherRule"][data-copy-id="${CSS.escape(id)}"]`)) return;

      const btn = makeCopyButton("teacherRule", id);
      btn.addEventListener("click", () => copyTeacherWageRule(id));
      insertButtonBefore(editBtn, btn);
    });
  }

  function copyFinanceRecord(type, id) {
    const source = type === "income"
      ? (state.incomeRecords || []).find(x => String(x.id) === String(id))
      : (state.expenseRecords || []).find(x => String(x.id) === String(id));

    if (!source) {
      showMessage("找不到要复制的记录。", "error");
      return;
    }

    const prefill = cloneForCreate(source);

    if (type === "expense") {
      state.pendingExpenseAttachment = null;
    }

    openCreateModal(type, prefill);
    showMessage(type === "income" ? "已复制收入内容，请确认后保存。" : "已复制支出内容，请确认后保存。", "ok");
  }

  async function copyTeacherWageRule(id) {
    try {
      const { data, error } = await db
        .from("school_teacher_wage_rules")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        showMessage(`读取工资规则失败：${error.message}`, "error");
        return;
      }

      const item = data || {};
      const fieldMap = {
        teacherWageRuleId: "",
        teacherWageRuleTeacher: item.teacher_id || "",
        teacherWageRuleStudent: item.student_id || "",
        teacherWageRuleSubject: item.subject_id || "",
        teacherWageRuleBusiness: item.business_entity_id || "",
        teacherWageRuleSettlementType: item.settlement_type || "jpy_hourly",
        teacherWageRuleHourlyJpy: item.hourly_rate_jpy || "",
        teacherWageRuleHourlyCny: item.hourly_rate_cny || "",
        teacherWageRuleExchangeRate: item.exchange_rate || "",
        teacherWageRuleActive: item.is_active === false ? "false" : "true",
        teacherWageRuleNote: item.note || "",
      };

      Object.entries(fieldMap).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
      });

      showMessage("已复制工资规则到输入区，请确认后保存。", "ok");
      document.getElementById("teacherWageRuleTeacher")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (e) {
      showMessage(`复制工资规则失败：${e.message || e}`, "error");
    }
  }

  function applyCopyButtons() {
    ensureIncomeExpenseCopyButtons();
    ensureTeacherRuleCopyButtons();
  }

  function observeTables() {
    ["incomeTable", "expensesTable", "teacherWageRulesTable"].forEach(id => {
      const tbody = document.getElementById(id);
      if (!tbody || tbody.dataset.copyObserved === "true") return;

      tbody.dataset.copyObserved = "true";
      const observer = new MutationObserver(() => setTimeout(applyCopyButtons, 0));
      observer.observe(tbody, { childList: true, subtree: true });
    });
  }

  const renderAllBeforeV9114 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV9114) {
    window.renderAll = function() {
      renderAllBeforeV9114();
      setTimeout(() => {
        observeTables();
        applyCopyButtons();
      }, 0);
    };
  }

  const switchPageBeforeV9114 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV9114) {
    window.switchPage = function(page) {
      switchPageBeforeV9114(page);
      setTimeout(() => {
        observeTables();
        applyCopyButtons();
      }, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      observeTables();
      applyCopyButtons();
    }, 1000);
  });

  window.SchoolRecordCopyV9114 = {
    version: "9.1.14.1",
    apply: applyCopyButtons,
    copyFinanceRecord,
    copyTeacherWageRule,
  };
})();
