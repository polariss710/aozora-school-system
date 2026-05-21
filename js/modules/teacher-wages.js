// === v9.1.5 teacher wage settlement basic module ===
// 新增“工资课时”临时调整：
// - 默认值 = 实际分钟按30分钟向下取整
// - 可以在明细表中手动修改
// - 汇总表和顶部预计工资实时重算
// - 暂不保存数据库，刷新后恢复默认计算值
(function () {
  const payHourOverrides = new Map();

  function n(v){ const x = Number(v || 0); return Number.isFinite(x) ? x : 0; }
  function currentMonth(){ return new Date().toISOString().slice(0, 7); }
  function monthFromDateV915(dateText){
    const text = String(dateText || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.slice(0, 7).replace("/", "-");
    return "";
  }
  function teacherSettlementMonth(row){
    return row.teacher_settlement_month || monthFromDateV915(row.lesson_date) || row.year_month || "";
  }
  function fmtHours(v){
    const x = Number(v || 0);
    if (!Number.isFinite(x)) return "0";
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  }
  function fmtAmount(v, c="JPY"){ return `${Math.round(n(v)).toLocaleString()} ${c}`; }
  function teacherObj(row){ return (state.teachers || []).find(t => t.id === row.teacher_id) || row.teacher || {}; }
  function subjectObj(row){ return (state.subjects || []).find(s => s.id === row.subject_id) || row.subject || {}; }
  function teacherName(row){ const t = teacherObj(row); return t.display_name || t.name || ""; }
  function subjectName(row){ const s = subjectObj(row); return s.name || ""; }
  function studentName(row){ return row.student?.display_name || row.student?.name || ""; }
  function hourlyRate(row){ const t = teacherObj(row); return n(t.default_hourly_rate || t.hourly_rate || t.unit_price); }
  function currency(row){ return teacherObj(row).default_currency || "JPY"; }

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
    return String(row.id || `${row.teacher_id || ""}_${row.subject_id || ""}_${row.lesson_date || ""}_${row.start_time || ""}`);
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
        subjectName(a).localeCompare(subjectName(b),"zh-Hans-CN") ||
        String(a.lesson_date||"").localeCompare(String(b.lesson_date||"")) ||
        String(a.start_time||"").localeCompare(String(b.start_time||""))
      );
  }

  function summarize(list){
    const map = new Map();

    list.forEach(r => {
      const key = `${r.teacher_id}|${r.subject_id}|${hourlyRate(r)}|${currency(r)}`;
      if (!map.has(key)) {
        map.set(key, {
          teacher: teacherName(r),
          subject: subjectName(r),
          rate: hourlyRate(r),
          currency: currency(r),
          minutes: 0,
          hours: 0,
          amount: 0,
          count: 0,
        });
      }
      const x = map.get(key);
      const h = payHoursForRow(r);
      x.minutes += actualMinutes(r);
      x.hours += h;
      x.amount += h * hourlyRate(r);
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
    setOptionalText("teacherWageTotalAmount", fmtAmount(summary.reduce((s,x)=>s+n(x.amount),0)));
    setOptionalText("teacherWageLessonCount", String(list.length));

    const sumBody = document.getElementById("teacherWageSummaryTable");
    if (sumBody) {
      sumBody.innerHTML = summary.length ? summary.map(x => `
        <tr>
          <td>${esc(x.teacher)}</td>
          <td>${esc(x.subject)}</td>
          <td>${Math.round(x.minutes)}</td>
          <td>${fmtHours(x.hours)}H</td>
          <td>${fmtAmount(x.rate,x.currency)}</td>
          <td><strong>${fmtAmount(x.amount,x.currency)}</strong></td>
          <td>${x.count}</td>
        </tr>
      `).join("") : `<tr><td colspan="7" class="empty-row">当前条件下没有可计算工资的实际课时</td></tr>`;
    }

    const detail = document.getElementById("teacherWageDetailTable");
    if (detail) {
      detail.innerHTML = list.length ? list.map(r => {
        const key = rowKey(r);
        const mins = actualMinutes(r);
        const defaultHours = defaultPayHoursFromMinutes(mins);
        const currentHours = payHoursForRow(r);
        const overridden = payHourOverrides.has(key);
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
            <td>${badge(lessonStatusLabel(r.status),"")}</td>
            <td>${esc(short(r.lesson_content || r.note, 32))}</td>
          </tr>
        `;
      }).join("") : `<tr><td colspan="10" class="empty-row">当前条件下没有课时明细</td></tr>`;

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

  function bind(){
    fillFilters();
    document.getElementById("teacherWageRefreshBtn")?.addEventListener("click", render);
    document.getElementById("teacherWageMonthFilter")?.addEventListener("change", render);
    document.getElementById("teacherWageTeacherFilter")?.addEventListener("change", render);
    document.getElementById("teacherWageClearFilter")?.addEventListener("click", () => {
      const m = document.getElementById("teacherWageMonthFilter"), t = document.getElementById("teacherWageTeacherFilter");
      if (m) m.value = currentMonth();
      if (t) t.value = "";
      payHourOverrides.clear();
      render();
    });
    render();
  }

  const oldSwitch = typeof switchPage === "function" ? switchPage : null;
  if (oldSwitch) {
    window.switchPage = function(page){
      oldSwitch(page);
      if (page === "teacher-wages") {
        const title = document.getElementById("pageTitle"), sub = document.getElementById("pageSubtitle");
        if (title) title.textContent = "老师工资结算";
        if (sub) sub.textContent = "按老师、科目、月份汇总实际授课分钟并计算预计工资";
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
    version: "9.1.5",
    render,
    summarize,
    targetLessons,
    payHoursFromMinutes: defaultPayHoursFromMinutes,
    payHourOverrides,
  };
})();
