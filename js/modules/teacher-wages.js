// === v9.1 teacher wage settlement basic module ===
// 基础版：只计算，不锁定、不写入支出。
// 规则：实际授课分钟按老师 + 科目 + 月份汇总，再按30分钟向下取整。
// 例：135分钟 → 老师工资课时 2.0H；150分钟 → 2.5H。

(function () {
  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function teacherName(row) {
    const teacher = (state.teachers || []).find(t => t.id === row.teacher_id) || row.teacher;
    return teacher?.display_name || teacher?.name || "";
  }

  function studentName(row) {
    return row.student?.display_name || row.student?.name || "";
  }

  function subjectName(row) {
    const subject = (state.subjects || []).find(s => s.id === row.subject_id) || row.subject;
    return subject?.name || "";
  }

  function teacherOf(row) {
    return (state.teachers || []).find(t => t.id === row.teacher_id) || row.teacher || {};
  }

  function hourlyRate(row) {
    const teacher = teacherOf(row);
    return n(teacher.default_hourly_rate);
  }

  function teacherCurrency(row) {
    const teacher = teacherOf(row);
    return teacher.default_currency || "JPY";
  }

  function parseTimeMinutes(value) {
    const text = String(value || "").trim();
    const m = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    return h * 60 + min;
  }

  function minutesBetween(start, end) {
    const s = parseTimeMinutes(start);
    const e = parseTimeMinutes(end);
    if (s === null || e === null || e <= s) return null;
    return e - s;
  }

  function actualMinutes(row) {
    const fromField = n(row.actual_minutes);
    if (fromField > 0) return fromField;

    const fromTime = minutesBetween(row.start_time, row.end_time);
    if (fromTime !== null && fromTime > 0) return fromTime;

    return Math.round(n(row.duration_hours) * 60);
  }

  function payHoursFromMinutes(totalMinutes) {
    return Math.floor(n(totalMinutes) / 30) * 0.5;
  }

  function isActualPayTarget(row) {
    if (!row || row.lesson_type !== "actual") return false;
    const status = String(row.status || "").trim();
    if (status === "cancelled" || status === "取消课" || status === "holiday") return false;
    return true;
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function selectedMonth() {
    return document.getElementById("teacherWageMonthFilter")?.value || currentMonth();
  }

  function selectedTeacherId() {
    return document.getElementById("teacherWageTeacherFilter")?.value || "";
  }

  function formatHours(value) {
    const x = Number(value || 0);
    if (!Number.isFinite(x)) return "0";
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  }

  function formatAmount(value, currency = "JPY") {
    const amount = Math.round(n(value));
    return `${amount.toLocaleString()} ${currency}`;
  }

  function fillTeacherWageFilters() {
    const month = document.getElementById("teacherWageMonthFilter");
    if (month && !month.value) month.value = currentMonth();

    const select = document.getElementById("teacherWageTeacherFilter");
    if (!select) return;

    const old = select.value;
    const options = [
      `<option value="">所有老师</option>`,
      ...(state.teachers || [])
        .filter(t => t.status !== "inactive" && t.status !== "retired")
        .map(t => `<option value="${escAttr(t.id)}">${esc(t.display_name || t.name || "")}</option>`)
    ];

    select.innerHTML = options.join("");
    select.value = old;
  }

  function targetLessons() {
    const month = selectedMonth();
    const teacherId = selectedTeacherId();

    return (state.lessonRecords || [])
      .filter(row =>
        row.year_month === month &&
        (!teacherId || row.teacher_id === teacherId) &&
        isActualPayTarget(row)
      )
      .slice()
      .sort((a, b) => {
        const teacher = teacherName(a).localeCompare(teacherName(b), "zh-Hans-CN");
        if (teacher) return teacher;
        const subject = subjectName(a).localeCompare(subjectName(b), "zh-Hans-CN");
        if (subject) return subject;
        const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
        if (date) return date;
        return String(a.start_time || "").localeCompare(String(b.start_time || ""));
      });
  }

  function summarize(rows) {
    const map = new Map();

    rows.forEach(row => {
      const key = `${row.teacher_id || ""}|${row.subject_id || ""}|${hourlyRate(row)}|${teacherCurrency(row)}`;
      if (!map.has(key)) {
        map.set(key, {
          teacher_id: row.teacher_id || "",
          teacher_name: teacherName(row),
          subject_id: row.subject_id || "",
          subject_name: subjectName(row),
          hourly_rate: hourlyRate(row),
          currency: teacherCurrency(row),
          total_minutes: 0,
          lesson_count: 0,
        });
      }

      const item = map.get(key);
      item.total_minutes += actualMinutes(row);
      item.lesson_count += 1;
    });

    return Array.from(map.values()).map(item => {
      const payHours = payHoursFromMinutes(item.total_minutes);
      return {
        ...item,
        pay_hours: payHours,
        amount: payHours * n(item.hourly_rate),
      };
    });
  }

  function renderTeacherWageSummary(rows) {
    const tbody = document.getElementById("teacherWageSummaryTable");
    if (!tbody) return;

    const summary = summarize(rows);

    const totalMinutes = summary.reduce((sum, x) => sum + n(x.total_minutes), 0);
    const totalPayHours = summary.reduce((sum, x) => sum + n(x.pay_hours), 0);
    const totalAmount = summary.reduce((sum, x) => sum + n(x.amount), 0);

    setOptionalText("teacherWageTotalMinutes", String(totalMinutes));
    setOptionalText("teacherWagePayHours", formatHours(totalPayHours));
    setOptionalText("teacherWageTotalAmount", formatAmount(totalAmount, "JPY"));
    setOptionalText("teacherWageLessonCount", String(rows.length));

    tbody.innerHTML = summary.length ? summary.map(item => `
      <tr>
        <td>${esc(item.teacher_name || "")}</td>
        <td>${esc(item.subject_name || "")}</td>
        <td>${Math.round(item.total_minutes).toLocaleString()}</td>
        <td>${formatHours(item.pay_hours)}H</td>
        <td>${formatAmount(item.hourly_rate, item.currency)}</td>
        <td><strong>${formatAmount(item.amount, item.currency)}</strong></td>
        <td>${item.lesson_count}</td>
      </tr>
    `).join("") : `<tr><td colspan="7" class="empty-row">当前条件下没有可计算工资的实际课时</td></tr>`;
  }

  function renderTeacherWageDetails(rows) {
    const tbody = document.getElementById("teacherWageDetailTable");
    if (!tbody) return;

    tbody.innerHTML = rows.length ? rows.map(row => {
      const mins = actualMinutes(row);
      const time = [row.start_time, row.end_time].filter(Boolean).join(" - ") || "时间未定";
      return `
        <tr>
          <td>${esc(displayRecordDate(row.lesson_date || ""))}</td>
          <td>${esc(teacherName(row))}</td>
          <td>${esc(studentName(row))}</td>
          <td>${esc(subjectName(row))}</td>
          <td>${esc(time)}</td>
          <td>${Math.round(mins)}</td>
          <td>${formatHours(row.duration_hours)}H</td>
          <td>${badge(lessonStatusLabel(row.status), "")}</td>
          <td>${esc(short(row.lesson_content || row.note, 32))}</td>
        </tr>
      `;
    }).join("") : `<tr><td colspan="9" class="empty-row">当前条件下没有课时明细</td></tr>`;
  }

  function renderTeacherWages() {
    fillTeacherWageFilters();
    const rows = targetLessons();
    renderTeacherWageSummary(rows);
    renderTeacherWageDetails(rows);
  }

  function bindTeacherWages() {
    fillTeacherWageFilters();

    const refresh = document.getElementById("teacherWageRefreshBtn");
    if (refresh) refresh.onclick = renderTeacherWages;

    const month = document.getElementById("teacherWageMonthFilter");
    if (month && month.dataset.boundTeacherWage !== "true") {
      month.dataset.boundTeacherWage = "true";
      month.addEventListener("change", renderTeacherWages);
    }

    const teacher = document.getElementById("teacherWageTeacherFilter");
    if (teacher && teacher.dataset.boundTeacherWage !== "true") {
      teacher.dataset.boundTeacherWage = "true";
      teacher.addEventListener("change", renderTeacherWages);
    }

    const clear = document.getElementById("teacherWageClearFilter");
    if (clear && clear.dataset.boundTeacherWage !== "true") {
      clear.dataset.boundTeacherWage = "true";
      clear.addEventListener("click", () => {
        const m = document.getElementById("teacherWageMonthFilter");
        const t = document.getElementById("teacherWageTeacherFilter");
        if (m) m.value = currentMonth();
        if (t) t.value = "";
        renderTeacherWages();
      });
    }

    renderTeacherWages();
  }

  const switchPageBeforeV91 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV91) {
    window.switchPage = function(page) {
      switchPageBeforeV91(page);
      if (page === "teacher-wages") {
        const titleEl = document.getElementById("pageTitle");
        const subtitleEl = document.getElementById("pageSubtitle");
        if (titleEl) titleEl.textContent = "老师工资结算";
        if (subtitleEl) subtitleEl.textContent = "按老师、科目、月份汇总实际授课分钟并计算预计工资";
        setTimeout(bindTeacherWages, 0);
      }
    };
  }

  const renderAllBeforeV91 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV91) {
    window.renderAll = function() {
      renderAllBeforeV91();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        setTimeout(bindTeacherWages, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        bindTeacherWages();
      }
    }, 1000);
  });

  window.SchoolTeacherWagesModule = {
    version: "9.1",
    render: renderTeacherWages,
    summarize,
    targetLessons,
    payHoursFromMinutes,
  };
})();
