// === v9.1.15 teacher wage variable fees ===
// 改善工资结算显示：
// 1. 汇总表显示业务归属、学生、规则状态。
// 2. 排序优先级：业务归属 → 老师 → 学生 → 科目 → 日期 → 时间。
// 3. 规则未设置时显示缺少哪条规则。
// 4. 不修改数据库。

(function () {
  const payHourOverrides = new Map();
  const rowFeeOverrides = new Map();
  let wageRules = [];

  function n(v){ const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function currentMonth(){ return new Date().toISOString().slice(0, 7); }
  function fmtHours(v){
    const x = Number(v || 0);
    if (!Number.isFinite(x)) return "0";
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  }
  function fmtAmount(v, c="JPY"){
    const amount = c === "CNY" ? Math.round(n(v) * 100) / 100 : Math.round(n(v));
    return `${amount.toLocaleString()} ${c}`;
  }

  function monthFromDateV9110(dateText){
    const text = String(dateText || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.slice(0, 7).replace("/", "-");
    return "";
  }

  function teacherSettlementMonth(row){
    return row.teacher_settlement_month || monthFromDateV9110(row.lesson_date) || row.year_month || "";
  }

  function teacherObj(row){ return (state.teachers || []).find(t => t.id === row.teacher_id) || row.teacher || {}; }
  function subjectObj(row){ return (state.subjects || []).find(s => s.id === row.subject_id) || row.subject || {}; }
  function businessObj(row) { return (state.businessEntities || []).find(x => x.id === row.business_entity_id) || row.business_entity || {}; }
  function studentObj(row) { return (state.students || []).find(x => x.id === row.student_id) || row.student || {}; }

  function teacherName(row){ const t = teacherObj(row); return t.display_name || t.name || ""; }
  function subjectName(row){ const s = subjectObj(row); return s.name || ""; }
  function businessName(row){ const b = businessObj(row); return b.name || businessNameForRule(row) || ""; }
  function studentName(row){ const s = studentObj(row); return s.display_name || s.name || ""; }

  function lessonTeacherId(row) {
    return String(row?.teacher_id || row?.teacher?.id || "");
  }

  function lessonStudentId(row) {
    return String(row?.student_id || row?.student?.id || "");
  }

  function lessonSubjectId(row) {
    return String(row?.subject_id || row?.subject?.id || "");
  }

  function lessonBusinessId(row) {
    if (row?.business_entity_id) return String(row.business_entity_id);
    if (row?.business_entity?.id) return String(row.business_entity.id);
    const student = (state.students || []).find(x => String(x.id) === lessonStudentId(row));
    return String(student?.business_entity_id || student?.business_entity?.id || "");
  }

  function businessObjById(id) {
    return (state.businessEntities || []).find(x => String(x.id) === String(id)) || {};
  }

  function businessNameForRule(row) {
    const id = lessonBusinessId(row);
    const direct = businessObj(row);
    return direct.name || businessObjById(id).name || "";
  }


  function parseTime(v){
    const m = String(v || "").trim().match(/^(\d{1,2}):(\d{1,2})$/);
    return m ? Number(m[1]) * 60 + Number(m[2]) : null;
  }

  function actualMinutes(row){
    if (n(row.actual_minutes) > 0) return n(row.actual_minutes);
    const s = parseTime(row.start_time), e = parseTime(row.end_time);
    if (s !== null && e !== null && e > s) return e - s;
    return Math.round(n(row.duration_hours) * 60);
  }

  function defaultPayHoursFromMinutes(minutes){
    return Math.floor(n(minutes) / 30) * 0.5;
  }

  function rowKey(row) {
    return String(row.id || `${lessonTeacherId(row)}_${lessonStudentId(row)}_${lessonSubjectId(row)}_${lessonBusinessId(row)}_${row.lesson_date || ""}_${row.start_time || ""}`);
  }

  function payHoursForRow(row) {
    const key = rowKey(row);
    if (payHourOverrides.has(key)) return n(payHourOverrides.get(key));
    return defaultPayHoursFromMinutes(actualMinutes(row));
  }

  function feeForRow(row) {
    const key = rowKey(row);
    const current = rowFeeOverrides.get(key) || {};
    return {
      transport: n(current.transport),
      classroom: n(current.classroom),
    };
  }

  function setFeeForRow(key, field, value) {
    const current = rowFeeOverrides.get(key) || {};
    current[field] = Math.max(0, Math.round(n(value)));
    rowFeeOverrides.set(key, current);
  }

  function isTarget(row){
    if (!row || row.lesson_type !== "actual") return false;
    const s = String(row.status || "").trim();
    return !(s === "cancelled" || s === "取消课" || s === "holiday");
  }

  async function loadWageRules() {
    const { data, error } = await db
      .from("school_teacher_wage_rules")
      .select("*")
      .eq("is_active", true);

    if (error) {
      showMessage(`读取老师工资规则失败：${error.message}`, "error");
      wageRules = [];
      return;
    }

    wageRules = data || [];
  }

  function ruleMatches(rule, row) {
    return String(rule.teacher_id || "") === lessonTeacherId(row) &&
      String(rule.student_id || "") === lessonStudentId(row) &&
      String(rule.subject_id || "") === lessonSubjectId(row) &&
      String(rule.business_entity_id || "") === lessonBusinessId(row);
  }

  function ruleMatchesByLabel(rule, row) {
    return normText(ruleTeacherName(rule)) === normText(teacherName(row)) &&
      normText(ruleStudentName(rule)) === normText(studentName(row)) &&
      normText(ruleSubjectName(rule)) === normText(subjectName(row)) &&
      normText(ruleBusinessName(rule)) === normText(businessNameForRule(row) || businessName(row));
  }

  function findRule(row) {
    return wageRules.find(rule => ruleMatches(rule, row)) ||
      wageRules.find(rule => ruleMatchesByLabel(rule, row)) ||
      null;
  }

  function ruleMatchMode(row) {
    const exact = wageRules.find(rule => ruleMatches(rule, row));
    if (exact) return "exact";
    const label = wageRules.find(rule => ruleMatchesByLabel(rule, row));
    if (label) return "label";
    return "missing";
  }

  function missingRuleText(row) {
    const businessLabel = businessNameForRule(row) || businessName(row) || "业务归属未定";
    return [
      teacherName(row) || "老师未定",
      studentName(row) || "学生未定",
      subjectName(row) || "科目未定",
      businessLabel,
    ].join(" / ");
  }

  function missingRuleHelp(row) {
    return `请在工资规则中新增：${missingRuleText(row)}`;
  }

  function ruleTeacherName(rule) {
    const item = (state.teachers || []).find(x => String(x.id) === String(rule?.teacher_id || ""));
    return item?.display_name || item?.name || "";
  }

  function ruleStudentName(rule) {
    const item = (state.students || []).find(x => String(x.id) === String(rule?.student_id || ""));
    return item?.display_name || item?.name || "";
  }

  function ruleSubjectName(rule) {
    const item = (state.subjects || []).find(x => String(x.id) === String(rule?.subject_id || ""));
    return item?.name || "";
  }

  function ruleBusinessName(rule) {
    const item = (state.businessEntities || []).find(x => String(x.id) === String(rule?.business_entity_id || ""));
    return item?.name || "";
  }

  function normText(value) {
    return String(value || "").trim();
  }

  function settlementTypeLabel(value) {
    const map = {
      jpy_hourly: "日元时薪",
      cny_hourly: "人民币时薪",
      no_wage: "不计工资",
    };
    return map[value] || value || "未设置";
  }

  function ensureTeacherWageSummaryHeaderV91102() {
    const tbody = document.getElementById("teacherWageSummaryTable");
    const table = tbody?.closest("table");
    const head = table?.querySelector("thead");
    if (!head) return;

    head.innerHTML = `
      <tr>
        <th>业务归属</th>
        <th>老师</th>
        <th>学生</th>
        <th>科目</th>
        <th>实际分钟</th>
        <th>工资课时</th>
        <th>结算方式</th>
        <th>时给</th>
        <th>预计合计</th>
        <th>课时数</th>
        <th>规则</th>
      </tr>
    `;
  }


  function calcRowWage(row) {
    const rule = findRule(row);
    const hours = payHoursForRow(row);
    const type = rule?.settlement_type || "jpy_hourly";
    const rateJpy = n(rule?.hourly_rate_jpy);
    const rateCny = n(rule?.hourly_rate_cny);
    const exchangeRate = n(rule?.exchange_rate);

    let jpyAmount = 0;
    let cnyAmount = 0;

    if (type === "no_wage") {
      jpyAmount = 0;
      cnyAmount = 0;
    } else if (type === "cny_hourly") {
      cnyAmount = hours * rateCny;
      jpyAmount = exchangeRate > 0 ? cnyAmount / exchangeRate : 0;
    } else {
      jpyAmount = hours * rateJpy;
      cnyAmount = exchangeRate > 0 ? jpyAmount * exchangeRate : 0;
    }

    const fees = feeForRow(row);
    const feeJpyAmount = fees.transport + fees.classroom;
    const totalJpyAmount = jpyAmount + feeJpyAmount;
    const totalCnyAmount = exchangeRate > 0 ? cnyAmount + (feeJpyAmount * exchangeRate) : cnyAmount;

    return {
      rule,
      type,
      hours,
      rateJpy,
      rateCny,
      exchangeRate,
      transportFeeJpy: fees.transport,
      classroomFeeJpy: fees.classroom,
      feeJpyAmount,
      jpyAmount,
      cnyAmount,
      totalJpyAmount,
      totalCnyAmount,
      isNoWage: type === "no_wage",
      hasRule: !!rule,
      matchMode: rule ? ruleMatchMode(row) : "missing",
      missingRuleText: rule ? "" : missingRuleText(row),
      missingRuleHelp: rule ? "" : missingRuleHelp(row),
    };
  }

  function fillFilters(){
    const m = document.getElementById("teacherWageMonthFilter");
    if (m && !m.value) m.value = currentMonth();

    const sel = document.getElementById("teacherWageTeacherFilter");
    if (!sel) return;

    const old = sel.value;
    sel.innerHTML = `<option value="">所有老师</option>` + (state.teachers || [])
      .filter(t => t.status !== "inactive" && t.status !== "retired")
      .map(t => `<option value="${escAttr(t.id)}">${esc(t.display_name || t.name || "")}</option>`).join("");
    sel.value = old;
  }

  function sortLessons(list) {
    return list.sort((a,b) =>
      businessName(a).localeCompare(businessName(b),"zh-Hans-CN") ||
      teacherName(a).localeCompare(teacherName(b),"zh-Hans-CN") ||
      studentName(a).localeCompare(studentName(b),"zh-Hans-CN") ||
      subjectName(a).localeCompare(subjectName(b),"zh-Hans-CN") ||
      String(a.lesson_date||"").localeCompare(String(b.lesson_date||"")) ||
      String(a.start_time||"").localeCompare(String(b.start_time||""))
    );
  }

  function targetLessons(){
    const month = document.getElementById("teacherWageMonthFilter")?.value || currentMonth();
    const teacherId = document.getElementById("teacherWageTeacherFilter")?.value || "";
    return sortLessons((state.lessonRecords || [])
      .filter(r => teacherSettlementMonth(r) === month && (!teacherId || r.teacher_id === teacherId) && isTarget(r)));
  }

  function summarize(list){
    const map = new Map();

    list.forEach(r => {
      const wage = calcRowWage(r);
      const key = [
        lessonBusinessId(r),
        lessonTeacherId(r),
        lessonStudentId(r),
        lessonSubjectId(r),
        wage.type,
        wage.rateJpy,
        wage.rateCny,
        wage.exchangeRate,
        wage.hasRule ? "rule" : "missing",
        wage.missingRuleText,
      ].join("|");

      if (!map.has(key)) {
        map.set(key, {
          business: businessName(r),
          teacher: teacherName(r),
          student: studentName(r),
          subject: subjectName(r),
          settlementType: wage.type,
          rateJpy: wage.rateJpy,
          rateCny: wage.rateCny,
          exchangeRate: wage.exchangeRate,
          hasRule: wage.hasRule,
          isNoWage: wage.isNoWage,
          matchMode: wage.matchMode,
          missingRuleText: wage.missingRuleText,
          missingRuleHelp: wage.missingRuleHelp,
          minutes: 0,
          hours: 0,
          feeJpyAmount: 0,
          jpyAmount: 0,
          cnyAmount: 0,
          totalJpyAmount: 0,
          totalCnyAmount: 0,
          count: 0,
        });
      }

      const x = map.get(key);
      x.minutes += actualMinutes(r);
      x.hours += wage.hours;
      x.feeJpyAmount += wage.feeJpyAmount;
      x.jpyAmount += wage.jpyAmount;
      x.cnyAmount += wage.cnyAmount;
      x.totalJpyAmount += wage.totalJpyAmount;
      x.totalCnyAmount += wage.totalCnyAmount;
      x.count += 1;
    });

    return Array.from(map.values()).sort((a,b) =>
      String(a.business || "").localeCompare(String(b.business || ""),"zh-Hans-CN") ||
      String(a.teacher || "").localeCompare(String(b.teacher || ""),"zh-Hans-CN") ||
      String(a.student || "").localeCompare(String(b.student || ""),"zh-Hans-CN") ||
      String(a.subject || "").localeCompare(String(b.subject || ""),"zh-Hans-CN")
    );
  }

  function render(){
    ensureTeacherWageSummaryHeaderV91102();
    fillFilters();
    const list = targetLessons();
    const summary = summarize(list);

    setOptionalText("teacherWageTotalMinutes", String(summary.reduce((s,x)=>s+n(x.minutes),0)));
    setOptionalText("teacherWagePayHours", fmtHours(summary.reduce((s,x)=>s+n(x.hours),0)));
    setOptionalText("teacherWageTotalAmount", fmtAmount(summary.reduce((s,x)=>s+n(x.totalJpyAmount),0), "JPY") + " / " + fmtAmount(summary.reduce((s,x)=>s+n(x.totalCnyAmount),0), "CNY"));
    setOptionalText("teacherWageLessonCount", String(list.length));

    const sumBody = document.getElementById("teacherWageSummaryTable");
    if (sumBody) {
      sumBody.innerHTML = summary.length ? summary.map(x => {
        const rateText = x.settlementType === "no_wage"
          ? "-"
          : (x.settlementType === "cny_hourly" ? fmtAmount(x.rateCny, "CNY") : fmtAmount(x.rateJpy, "JPY"));
        return `
          <tr>
            <td>${esc(x.business)}</td>
            <td>${esc(x.teacher)}</td>
            <td>${esc(x.student)}</td>
            <td>${esc(x.subject)}</td>
            <td>${Math.round(x.minutes)}</td>
            <td>${fmtHours(x.hours)}H</td>
            <td>${esc(settlementTypeLabel(x.settlementType))}</td>
            <td>${rateText}</td>
            <td><strong>${fmtAmount(x.totalJpyAmount, "JPY")}</strong><br><span class="muted-small">${fmtAmount(x.totalCnyAmount, "CNY")}</span><br><span class="muted-small">课时 ${fmtAmount(x.jpyAmount, "JPY")} / 费用 ${fmtAmount(x.feeJpyAmount, "JPY")}</span></td>
            <td>${x.count}</td>
            <td>${x.hasRule ? `${x.isNoWage ? badge("不计工资", "gray") : badge("已匹配")}${x.matchMode === "label" ? `<br><span class="muted-small">名称匹配</span>` : ""}` : `${badge("未设置", "red")}<br><span class="muted-small">${esc(x.missingRuleHelp || ("缺少：" + x.missingRuleText))}</span>`}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="11" class="empty-row">当前条件下没有可计算工资的实际课时</td></tr>`;
    }

    const detail = document.getElementById("teacherWageDetailTable");
    if (detail) {
      detail.innerHTML = list.length ? list.map(r => {
        const key = rowKey(r);
        const mins = actualMinutes(r);
        const defaultHours = defaultPayHoursFromMinutes(mins);
        const wage = calcRowWage(r);
        const currentHours = wage.hours;
        const overridden = payHourOverrides.has(key);
        const rateText = wage.type === "no_wage" ? "-" : (wage.type === "cny_hourly" ? fmtAmount(wage.rateCny, "CNY") : fmtAmount(wage.rateJpy, "JPY"));
        return `
          <tr>
            <td>${esc(displayRecordDate(r.lesson_date||""))}</td>
            <td>${esc(teacherName(r))}</td>
            <td>${esc(studentName(r))}</td>
            <td>${esc(subjectName(r))}</td>
            <td>${esc([r.start_time,r.end_time].filter(Boolean).join(" - ") || "时间未定")}</td>
            <td>${Math.round(mins)}</td>
            <td>${fmtHours(r.duration_hours)}H</td>
            <td>
              <input
                class="teacher-pay-hours-input"
                data-teacher-pay-key="${escAttr(key)}"
                type="number"
                step="0.25"
                min="0"
                inputmode="decimal"
                value="${escAttr(fmtHours(currentHours))}"
                title="默认：${escAttr(fmtHours(defaultHours))}H"
              />
              ${overridden ? `<button type="button" class="secondary-btn teacher-pay-reset-btn" data-teacher-pay-reset="${escAttr(key)}">默认</button>` : ""}
            </td>
            <td>${esc(businessName(r))}</td>
            <td>${esc(settlementTypeLabel(wage.type))}</td>
            <td>${rateText}</td>
            <td><strong>${fmtAmount(wage.jpyAmount, "JPY")}</strong></td>
            <td><input class="teacher-fee-input" data-teacher-fee-key="${escAttr(key)}" data-teacher-fee-field="transport" type="number" step="1" min="0" inputmode="numeric" value="${escAttr(String(wage.transportFeeJpy || 0))}" /></td>
            <td><input class="teacher-fee-input" data-teacher-fee-key="${escAttr(key)}" data-teacher-fee-field="classroom" type="number" step="1" min="0" inputmode="numeric" value="${escAttr(String(wage.classroomFeeJpy || 0))}" /></td>
            <td><strong>${fmtAmount(wage.totalJpyAmount, "JPY")}</strong></td>
            <td>${fmtAmount(wage.totalCnyAmount, "CNY")}</td>
            <td>${wage.hasRule ? `${wage.isNoWage ? badge("不计工资", "gray") : badge("已匹配")}${wage.matchMode === "label" ? `<br><span class="muted-small">名称匹配</span>` : ""}` : `${badge("未设置", "red")}<br><span class="muted-small">${esc(wage.missingRuleHelp || ("缺少：" + wage.missingRuleText))}</span>`}</td>
            <td>${badge(lessonStatusLabel(r.status),"")}</td>
            <td>${esc(short(r.lesson_content || r.note, 32))}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="18" class="empty-row">当前条件下没有课时明细</td></tr>`;

      bindPayHourInputs();
      bindFeeInputs();
    }
  }

  function bindFeeInputs() {
    document.querySelectorAll("[data-teacher-fee-key]").forEach(input => {
      if (input.dataset.boundTeacherFee === "true") return;
      input.dataset.boundTeacherFee = "true";
      input.addEventListener("change", () => {
        setFeeForRow(input.dataset.teacherFeeKey, input.dataset.teacherFeeField, input.value);
        render();
      });
    });
  }

  function bindPayHourInputs() {
    document.querySelectorAll("[data-teacher-pay-key]").forEach(input => {
      if (input.dataset.boundPayHour === "true") return;
      input.dataset.boundPayHour = "true";
      input.addEventListener("change", () => {
        const key = input.dataset.teacherPayKey;
        const value = Number(input.value || 0);
        if (!Number.isFinite(value) || value < 0) {
          input.value = "0";
          payHourOverrides.set(key, 0);
        } else {
          payHourOverrides.set(key, Math.round(value * 100) / 100);
        }
        render();
      });
    });

    document.querySelectorAll("[data-teacher-pay-reset]").forEach(btn => {
      if (btn.dataset.boundReset === "true") return;
      btn.dataset.boundReset = "true";
      btn.addEventListener("click", () => {
        payHourOverrides.delete(btn.dataset.teacherPayReset);
        render();
      });
    });
  }

  async function bind(){
    fillFilters();
    await loadWageRules();

    const refresh = document.getElementById("teacherWageRefreshBtn");
    if (refresh && refresh.dataset.boundTeacherWageV9110 !== "true") {
      refresh.dataset.boundTeacherWageV9110 = "true";
      refresh.addEventListener("click", async () => {
        await loadWageRules();
        render();
      });
    }

    const month = document.getElementById("teacherWageMonthFilter");
    if (month && month.dataset.boundTeacherWageV9110 !== "true") {
      month.dataset.boundTeacherWageV9110 = "true";
      month.addEventListener("change", render);
    }

    const teacher = document.getElementById("teacherWageTeacherFilter");
    if (teacher && teacher.dataset.boundTeacherWageV9110 !== "true") {
      teacher.dataset.boundTeacherWageV9110 = "true";
      teacher.addEventListener("change", render);
    }

    const clear = document.getElementById("teacherWageClearFilter");
    if (clear && clear.dataset.boundTeacherWageV9110 !== "true") {
      clear.dataset.boundTeacherWageV9110 = "true";
      clear.addEventListener("click", () => {
        const m = document.getElementById("teacherWageMonthFilter"), t = document.getElementById("teacherWageTeacherFilter");
        if (m) m.value = currentMonth();
        if (t) t.value = "";
        payHourOverrides.clear();
        rowFeeOverrides.clear();
        render();
      });
    }

    render();
  }

  const oldSwitch = typeof switchPage === "function" ? switchPage : null;
  if (oldSwitch) {
    window.switchPage = function(page){
      oldSwitch(page);
      if (page === "teacher-wages") {
        const title = document.getElementById("pageTitle"), sub = document.getElementById("pageSubtitle");
        if (title) title.textContent = "老师工资结算";
        if (sub) sub.textContent = "按业务归属、老师、学生、科目汇总工资，并提示缺少的工资规则";
        setTimeout(bind, 0);
      }
    };
  }

  const oldRenderAll = typeof renderAll === "function" ? renderAll : null;
  if (oldRenderAll) {
    window.renderAll = function(){
      oldRenderAll();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) setTimeout(bind, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) bind();
    }, 1000);
  });

  window.debugTeacherWageRuleMatchV91103 = function(rowOrId) {
    const row = typeof rowOrId === "string"
      ? (state.lessonRecords || []).find(x => String(x.id) === String(rowOrId))
      : rowOrId;
    if (!row) return null;
    return {
      teacher_id: lessonTeacherId(row),
      student_id: lessonStudentId(row),
      subject_id: lessonSubjectId(row),
      business_entity_id: lessonBusinessId(row),
      display: missingRuleText(row),
      matched_rule: findRule(row),
      match_mode: ruleMatchMode(row),
      loaded_rules_count: wageRules.length,
      target_labels: {
        teacher: teacherName(row),
        student: studentName(row),
        subject: subjectName(row),
        business: businessNameForRule(row) || businessName(row),
      },
    };
  };

  window.SchoolTeacherWagesModule = {
    version: "9.1.15",
    render,
    summarize,
    targetLessons,
    payHoursFromMinutes: defaultPayHoursFromMinutes,
    payHourOverrides,
    rowFeeOverrides,
    loadWageRules,
  };
})();
