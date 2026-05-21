// === v9.1.8 teacher wage rules module ===
// 基础版：维护老师 + 科目 + 业务归属的工资规则。
// 本版只做规则维护，不改老师工资结算计算逻辑；v9.1.9 再把规则接入工资结算明细。

(function () {
  const TABLE = "school_teacher_wage_rules";
  let rules = [];

  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function teacherName(id) {
    const item = (state.teachers || []).find(x => x.id === id);
    return item?.display_name || item?.name || "";
  }

  function subjectName(id) {
    const item = (state.subjects || []).find(x => x.id === id);
    return item?.name || "";
  }

  function businessName(id) {
    const item = (state.businessEntities || []).find(x => x.id === id);
    return item?.name || "";
  }

  function moneyText(value, currency = "JPY") {
    const amount = currency === "CNY" ? Math.round(n(value) * 100) / 100 : Math.round(n(value));
    return `${amount.toLocaleString()} ${currency}`;
  }

  function fillSelects() {
    const teacher = document.getElementById("teacherWageRuleTeacher");
    const subject = document.getElementById("teacherWageRuleSubject");
    const business = document.getElementById("teacherWageRuleBusiness");
    if (!teacher || !subject || !business) return;

    const oldTeacher = teacher.value;
    const oldSubject = subject.value;
    const oldBusiness = business.value;

    teacher.innerHTML = `<option value="">请选择老师</option>` + (state.teachers || [])
      .map(x => `<option value="${escAttr(x.id)}">${esc(x.display_name || x.name || "")}</option>`)
      .join("");

    subject.innerHTML = `<option value="">请选择科目</option>` + (state.subjects || [])
      .map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")}</option>`)
      .join("");

    business.innerHTML = `<option value="">请选择业务归属</option>` + (state.businessEntities || [])
      .map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")}</option>`)
      .join("");

    teacher.value = oldTeacher;
    subject.value = oldSubject;
    business.value = oldBusiness;
  }

  async function loadRules() {
    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      showMessage(`读取老师工资规则失败：${error.message}`, "error");
      rules = [];
      renderRules();
      return;
    }

    rules = data || [];
    renderRules();
  }

  function formValue(id) {
    return document.getElementById(id)?.value || "";
  }

  function clearForm() {
    [
      "teacherWageRuleId",
      "teacherWageRuleTeacher",
      "teacherWageRuleSubject",
      "teacherWageRuleBusiness",
      "teacherWageRuleHourlyJpy",
      "teacherWageRuleHourlyCny",
      "teacherWageRuleExchangeRate",
      "teacherWageRuleTransportJpy",
      "teacherWageRuleClassroomJpy",
      "teacherWageRuleNote"
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

    const type = document.getElementById("teacherWageRuleSettlementType");
    if (type) type.value = "jpy_hourly";

    const active = document.getElementById("teacherWageRuleActive");
    if (active) active.value = "true";
  }

  function readPayload() {
    const teacherId = formValue("teacherWageRuleTeacher");
    const subjectId = formValue("teacherWageRuleSubject");
    const businessId = formValue("teacherWageRuleBusiness");
    const settlementType = formValue("teacherWageRuleSettlementType") || "jpy_hourly";

    if (!teacherId) throw new Error("请选择老师。");
    if (!subjectId) throw new Error("请选择科目。");
    if (!businessId) throw new Error("请选择业务归属。");

    return {
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessId,
      settlement_type: settlementType,
      hourly_rate_jpy: n(formValue("teacherWageRuleHourlyJpy")),
      hourly_rate_cny: n(formValue("teacherWageRuleHourlyCny")),
      exchange_rate: n(formValue("teacherWageRuleExchangeRate")),
      transport_fee_jpy: n(formValue("teacherWageRuleTransportJpy")),
      classroom_fee_jpy: n(formValue("teacherWageRuleClassroomJpy")),
      is_active: formValue("teacherWageRuleActive") !== "false",
      note: formValue("teacherWageRuleNote"),
      updated_at: new Date().toISOString(),
    };
  }

  async function saveRule() {
    let payload;
    try {
      payload = readPayload();
    } catch (e) {
      showMessage(e.message, "error");
      return;
    }

    const id = formValue("teacherWageRuleId");
    let result;

    if (id) {
      result = await db.from(TABLE).update(payload).eq("id", id);
    } else {
      result = await db.from(TABLE).insert([{ ...payload, created_at: new Date().toISOString() }]);
    }

    if (result.error) {
      showMessage(`保存老师工资规则失败：${result.error.message}`, "error");
      return;
    }

    showMessage("已保存老师工资规则。", "ok");
    clearForm();
    await loadRules();
  }

  function editRule(id) {
    const item = rules.find(x => String(x.id) === String(id));
    if (!item) return;

    document.getElementById("teacherWageRuleId").value = item.id || "";
    document.getElementById("teacherWageRuleTeacher").value = item.teacher_id || "";
    document.getElementById("teacherWageRuleSubject").value = item.subject_id || "";
    document.getElementById("teacherWageRuleBusiness").value = item.business_entity_id || "";
    document.getElementById("teacherWageRuleSettlementType").value = item.settlement_type || "jpy_hourly";
    document.getElementById("teacherWageRuleHourlyJpy").value = item.hourly_rate_jpy || "";
    document.getElementById("teacherWageRuleHourlyCny").value = item.hourly_rate_cny || "";
    document.getElementById("teacherWageRuleExchangeRate").value = item.exchange_rate || "";
    document.getElementById("teacherWageRuleTransportJpy").value = item.transport_fee_jpy || "";
    document.getElementById("teacherWageRuleClassroomJpy").value = item.classroom_fee_jpy || "";
    document.getElementById("teacherWageRuleActive").value = item.is_active === false ? "false" : "true";
    document.getElementById("teacherWageRuleNote").value = item.note || "";
  }

  async function deleteRule(id) {
    if (!confirm("确定删除这条老师工资规则吗？")) return;

    const { error } = await db.from(TABLE).delete().eq("id", id);
    if (error) {
      showMessage(`删除老师工资规则失败：${error.message}`, "error");
      return;
    }

    showMessage("已删除老师工资规则。", "ok");
    await loadRules();
  }

  function settlementTypeLabel(value) {
    const map = {
      jpy_hourly: "日元时薪",
      cny_hourly: "人民币时薪",
    };
    return map[value] || value || "";
  }

  function renderRules() {
    const tbody = document.getElementById("teacherWageRulesTable");
    if (!tbody) return;

    tbody.innerHTML = rules.length ? rules.map(item => `
      <tr>
        <td>${esc(teacherName(item.teacher_id))}</td>
        <td>${esc(subjectName(item.subject_id))}</td>
        <td>${esc(businessName(item.business_entity_id))}</td>
        <td>${esc(settlementTypeLabel(item.settlement_type))}</td>
        <td>${moneyText(item.hourly_rate_jpy, "JPY")}</td>
        <td>${moneyText(item.hourly_rate_cny, "CNY")}</td>
        <td>${item.exchange_rate ? esc(String(item.exchange_rate)) : ""}</td>
        <td>${moneyText(item.transport_fee_jpy, "JPY")}</td>
        <td>${moneyText(item.classroom_fee_jpy, "JPY")}</td>
        <td>${item.is_active === false ? badge("停用", "gray") : badge("启用")}</td>
        <td>${esc(short(item.note || "", 18))}</td>
        <td>
          <button type="button" class="secondary-btn teacher-rule-mini-btn" data-rule-edit="${escAttr(item.id)}">编辑</button>
          <button type="button" class="danger-btn teacher-rule-mini-btn" data-rule-delete="${escAttr(item.id)}">删除</button>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="12" class="empty-row">暂无老师工资规则</td></tr>`;

    tbody.querySelectorAll("[data-rule-edit]").forEach(btn => {
      btn.onclick = () => editRule(btn.dataset.ruleEdit);
    });

    tbody.querySelectorAll("[data-rule-delete]").forEach(btn => {
      btn.onclick = () => deleteRule(btn.dataset.ruleDelete);
    });
  }

  function bindTeacherWageRules() {
    fillSelects();

    const save = document.getElementById("teacherWageRuleSaveBtn");
    if (save && save.dataset.boundTeacherRule !== "true") {
      save.dataset.boundTeacherRule = "true";
      save.addEventListener("click", saveRule);
    }

    const clear = document.getElementById("teacherWageRuleClearBtn");
    if (clear && clear.dataset.boundTeacherRule !== "true") {
      clear.dataset.boundTeacherRule = "true";
      clear.addEventListener("click", clearForm);
    }

    const reload = document.getElementById("teacherWageRuleReloadBtn");
    if (reload && reload.dataset.boundTeacherRule !== "true") {
      reload.dataset.boundTeacherRule = "true";
      reload.addEventListener("click", loadRules);
    }

    loadRules();
  }

  const switchPageBeforeV918 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV918) {
    window.switchPage = function(page) {
      switchPageBeforeV918(page);
      if (page === "teacher-wage-rules") {
        const titleEl = document.getElementById("pageTitle");
        const subtitleEl = document.getElementById("pageSubtitle");
        if (titleEl) titleEl.textContent = "老师工资规则";
        if (subtitleEl) subtitleEl.textContent = "维护老师、科目、业务归属对应的时给、交通费、教室费与结算方式";
        setTimeout(bindTeacherWageRules, 0);
      }
    };
  }

  const renderAllBeforeV918 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV918) {
    window.renderAll = function() {
      renderAllBeforeV918();
      if (document.getElementById("page-teacher-wage-rules")?.classList.contains("active")) {
        setTimeout(bindTeacherWageRules, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-teacher-wage-rules")?.classList.contains("active")) bindTeacherWageRules();
    }, 1000);
  });

  window.SchoolTeacherWageRulesModule = {
    version: "9.1.8",
    load: loadRules,
    render: renderRules,
  };
})();
