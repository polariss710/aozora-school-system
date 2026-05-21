// === v9.1.9 teacher wage settlement with wage rules ===
// 接入老师工资规则：老师 + 学生 + 科目 + 业务归属。
// 本版计算：工资课时 × 时给，并显示日元工资/人民币折算。
// 交通费、教室费暂不接入，后续在明细行逐行维护。

(function () {
  const payHourOverrides = new Map();
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

  function monthFromDateV919(dateText){
    const text = String(dateText || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.slice(0, 7).replace("/", "-");
    return "";
  }

  function teacherSettlementMonth(row){
    return row.teacher_settlement_month || monthFromDateV919(row.lesson_date) || row.year_month || "";
  }

  function teacherObj(row){ return (state.teachers || []).find(t => t.id === row.teacher_id) || row.teacher || {}; }
  function subjectObj(row){ return (state.subjects || []).find(s => s.id === row.subject_id) || row.subject || {}; }
  function businessObj(row) { return (state.businessEntities || []).find(x => x.id === row.business_entity_id) || row.business_entity || {}; }
  function teacherName(row){ const t = teacherObj(row); return t.display_name || t.name || ""; }
  function subjectName(row){ const s = subjectObj(row); return s.name || ""; }
  function businessName(row){ const b = businessObj(row); return b.name || ""; }
  function studentName(row){ return row.student?.display_name || row.student?.name || ""; }

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
    return String(row.id || `${row.teacher_id || ""}_${row.student_id || ""}_${row.subject_id || ""}_${row.lesson_date || ""}_${row.start_time || ""}`);
  }

  function payHoursForRow(row) {
    const key = rowKey(row);
    if (payHourOverrides.has(key)) return n(payHourOverrides.get(key));
    return defaultPayHoursFromMinutes(actualMinutes(row));
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
    return String(rule.teacher_id || "") === String(row.teacher_id || "") &&
      String(rule.student_id || "") === String(row.student_id || "") &&
      String(rule.subject_id || "") === String(row.subject_id || "") &&
      String(rule.business_entity_id || "") === String(row.business_entity_id || "");
  }

  function findRule(row) {
    return wageRules.find(ruleMatches) || null;
  }

  function settlementTypeLabel(value) {
    const map = {
      jpy_hourly: "日元时薪",
      cny_hourly: "人民币时薪",
    };
    return map[value] || value || "未设置";
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

    if (type === "cny_hourly") {
      cnyAmount = hours * rateCny;
      jpyAmount = exchangeRate > 0 ? cnyAmount / exchangeRate : 0;
    } else {
      jpyAmount = hours * rateJpy;
      cnyAmount = exchangeRate > 0 ? jpyAmount * exchangeRate : 0;
    }

    return {
      rule,
      type,
      hours,
      rateJpy,
      rateCny,
      exchangeRate,
      jpyAmount,
      cnyAmount,
      hasRule: !!rule,
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

  function targetLessons(){
    const month = document.getElementById("teacherWageMonthFilter")?.value || currentMonth();
    const teacherId = document.getElementById("teacherWageTeacherFilter")?.value || "";
    return (state.lessonRecords || [])
      .filter(r => teacherSettlementMonth(r) === month && (!teacherId || r.teacher_id === teacherId) && isTarget(r))
      .sort((a,b) =>
        teacherName(a).localeCompare(teacherName(b),"zh-Hans-CN") ||
        studentName(a).localeCompare(studentName(b),"zh-Hans-CN") ||
        subjectName(a).localeCompare(subjectName(b),"zh-Hans-CN") ||
        businessName(a).localeCompare(businessName(b),"zh-Hans-CN") ||
        String(a.lesson_date||"").localeCompare(String(b.lesson_date||"")) ||
        String(a.start_time||"").localeCompare(String(b.start_time||""))
      );
  }

  function summarize(list){
    const map = new Map();

    list.forEach(r => {
      const wage = calcRowWage(r);
      const key = [
        r.teacher_id || "",
        r.student_id || "",
        r.subject_id || "",
        r.business_entity_id || "",
        wage.type,
        wage.rateJpy,
        wage.rateCny,
        wage.exchangeRate,
        wage.hasRule ? "rule" : "missing"
      ].join("|");

      if (!map.has(key)) {
        map.set(key, {
          teacher: teacherName(r),
          student: studentName(r),
          subject: subjectName(r),
          business: businessName(r),
          settlementType: wage.type,
          rateJpy: wage.rateJpy,
          rateCny: wage.rateCny,
          exchangeRate: wage.exchangeRate,
          hasRule: wage.hasRule,
          minutes: 0,
          hours: 0,
          jpyAmount: 0,
          cnyAmount: 0,
          count: 0,
        });
      }

      const x = map.get(key);
      x.minutes += actualMinutes(r);
      x.hours += wage.hours;
      x.jpyAmount += wage.jpyAmount;
      x.cnyAmount += wage.cnyAmount;
      x.count += 1;
    });

    return Array.from(map.values());
  }

  function render(){
    fillFilters();
    const list = targetLessons();
    const summary = summarize(list);

    setOptionalText("teacherWageTotalMinutes", String(summary.reduce((s,x)=>s+n(x.minutes),0)));
    setOptionalText("teacherWagePayHours", fmtHours(summary.reduce((s,x)=>s+n(x.hours),0)));
    setOptionalText("teacherWageTotalAmount", fmtAmount(summary.reduce((s,x)=>s+n(x.jpyAmount),0), "JPY") + " / " + fmtAmount(summary.reduce((s,x)=>s+n(x.cnyAmount),0), "CNY"));
    setOptionalText("teacherWageLessonCount", String(list.length));

    const sumBody = document.getElementById("teacherWageSummaryTable");
    if (sumBody) {
      sumBody.innerHTML = summary.length ? summary.map(x => {
        const rateText = x.settlementType === "cny_hourly"
          ? fmtAmount(x.rateCny, "CNY")
          : fmtAmount(x.rateJpy, "JPY");
        return `
          <tr>
            <td>${esc(x.teacher)}</td>
            <td>${esc(x.subject)}</td>
            <td>${Math.round(x.minutes)}</td>
            <td>${fmtHours(x.hours)}H</td>
            <td>${rateText}</td>
            <td><strong>${fmtAmount(x.jpyAmount, "JPY")}</strong><br><span class="muted-small">${fmtAmount(x.cnyAmount, "CNY")}</span></td>
            <td>${x.count}${x.hasRule ? "" : `<br><span class="badge red">规则未设置</span>`}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="7" class="empty-row">当前条件下没有可计算工资的实际课时</td></tr>`;
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
        const rateText = wage.type === "cny_hourly" ? fmtAmount(wage.rateCny, "CNY") : fmtAmount(wage.rateJpy, "JPY");
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
            <td>${fmtAmount(wage.cnyAmount, "CNY")}</td>
            <td>${wage.hasRule ? badge("已匹配") : badge("未设置", "red")}</td>
            <td>${badge(lessonStatusLabel(r.status),"")}</td>
            <td>${esc(short(r.lesson_content || r.note, 32))}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="16" class="empty-row">当前条件下没有课时明细</td></tr>`;

      bindPayHourInputs();
    }
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
    if (refresh && refresh.dataset.boundTeacherWageV919 !== "true") {
      refresh.dataset.boundTeacherWageV919 = "true";
      refresh.addEventListener("click", async () => {
        await loadWageRules();
        render();
      });
    }

    const month = document.getElementById("teacherWageMonthFilter");
    if (month && month.dataset.boundTeacherWageV919 !== "true") {
      month.dataset.boundTeacherWageV919 = "true";
      month.addEventListener("change", render);
    }

    const teacher = document.getElementById("teacherWageTeacherFilter");
    if (teacher && teacher.dataset.boundTeacherWageV919 !== "true") {
      teacher.dataset.boundTeacherWageV919 = "true";
      teacher.addEventListener("change", render);
    }

    const clear = document.getElementById("teacherWageClearFilter");
    if (clear && clear.dataset.boundTeacherWageV919 !== "true") {
      clear.dataset.boundTeacherWageV919 = "true";
      clear.addEventListener("click", () => {
        const m = document.getElementById("teacherWageMonthFilter"), t = document.getElementById("teacherWageTeacherFilter");
        if (m) m.value = currentMonth();
        if (t) t.value = "";
        payHourOverrides.clear();
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
        if (sub) sub.textContent = "按工资规则计算课时工资，并显示日元工资和人民币折算";
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

  window.SchoolTeacherWagesModule = {
    version: "9.1.9",
    render,
    summarize,
    targetLessons,
    payHoursFromMinutes: defaultPayHoursFromMinutes,
    payHourOverrides,
    loadWageRules,
  };
})();
