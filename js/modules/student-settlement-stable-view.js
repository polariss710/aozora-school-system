// === v9.8-stable2-student-settlement student settlement stable paired view ===
// 恢复学生月度结算课时明细的左右对照显示稳定性。
// 核心统计金额仍读取 DB RPC；这里仅负责课时明细排版。

(function () {
  function appStateV981Stable1() {
    if (typeof state !== "undefined" && state) return state;
    return window.state || {};
  }

  function getMonth() {
    return document.getElementById("settlementMonthFilter")?.value || "";
  }

  function getStudentId() {
    return document.getElementById("settlementStudentFilter")?.value || "";
  }

  function escText(value) {
    return typeof esc === "function" ? esc(value) : String(value ?? "");
  }

  function escAttribute(value) {
    return typeof escAttr === "function" ? escAttr(value) : String(value ?? "").replace(/"/g, "&quot;");
  }

  function moneyText(value) {
    return typeof money === "function" ? money(value) : String(value ?? "");
  }

  function jpyText(value) {
    return typeof formatCurrencyTotal === "function"
      ? formatCurrencyTotal(Number(value || 0), "JPY")
      : `${Number(value || 0).toLocaleString()} JPY`;
  }

  function dateText(item) {
    if (!item) return "";
    return typeof displayRecordDate === "function"
      ? displayRecordDate(item.lesson_date || item.created_at || "")
      : String(item.lesson_date || "");
  }

  function statusText(item) {
    if (!item) return "";
    const label = typeof lessonStatusLabel === "function" ? lessonStatusLabel(item.status) : item.status;
    const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
    const statusBadge = typeof badge === "function" ? badge(label, statusClass) : label;
    const billableBadge = item.is_billable !== false
      ? (typeof badge === "function" ? badge("计费") : "计费")
      : (typeof badge === "function" ? badge("不计费", "gray") : "不计费");
    return `${statusBadge}<br>${billableBadge}`;
  }

  function feeText(item) {
    if (!item) return "";
    const fee = Number(item.lesson_fee || (Number(item.unit_price || 0) * Number(item.duration_hours || 0)) || 0);
    return jpyText(fee);
  }

  function subjectText(item) {
    return item?.subject?.name || item?.subject_name || "";
  }

  function teacherText(item) {
    return item?.teacher?.display_name || item?.teacher?.name || "";
  }

  function studentText(item) {
    return item?.student?.display_name || item?.student?.name || "";
  }

  function timeText(item) {
    return [item?.start_time, item?.end_time].filter(Boolean).join("-");
  }

  function cellHtml(item, side) {
    if (!item) {
      return `<td colspan="6" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
    }

    return `
      <td>
        ${escText(dateText(item))}<br>
        <span class="muted-small">${escText(item.year_month || "")}</span>
      </td>
      <td>${escText(studentText(item))}</td>
      <td>${escText(teacherText(item))}</td>
      <td>
        <strong>${escText(subjectText(item))}</strong><br>
        <span class="muted-small">${escText(timeText(item))} / ${moneyText(item.duration_hours)}H<br>${feeText(item)}</span>
      </td>
      <td>${statusText(item)}</td>
      <td>
        <div class="lesson-content-cell">${escText((item.lesson_content || item.note || "").slice(0, 36))}</div>
        <div class="table-actions lesson-actions">
          <button class="secondary-btn" data-edit="${escAttribute(item.id)}" data-type="lesson">编辑</button>
          <button class="danger-btn" data-delete="${escAttribute(item.id)}" data-type="lesson">删除</button>
        </div>
      </td>
    `;
  }

  function compareLessons(a, b) {
    const subject = subjectText(a).localeCompare(subjectText(b), "zh-Hans-CN");
    if (subject !== 0) return subject;
    const date = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
    if (date !== 0) return date;
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  }

  function findMatch(actual, plannedRows) {
    if (actual.planned_lesson_id) {
      const byId = plannedRows.find(x => x.id === actual.planned_lesson_id);
      if (byId) return byId;
    }

    return plannedRows.find(p =>
      p.student_id === actual.student_id &&
      p.teacher_id === actual.teacher_id &&
      p.subject_id === actual.subject_id &&
      p.year_month === actual.year_month &&
      String(p.lesson_date || "") === String(actual.lesson_date || "") &&
      String(p.start_time || "") === String(actual.start_time || "")
    ) || plannedRows.find(p =>
      p.student_id === actual.student_id &&
      p.teacher_id === actual.teacher_id &&
      p.subject_id === actual.subject_id &&
      p.year_month === actual.year_month &&
      String(p.start_time || "") === String(actual.start_time || "")
    ) || null;
  }

  function renderStableTable() {
    const tbody = document.getElementById("settlementLessonsTable");
    if (!tbody) return;

    const month = getMonth();
    const studentId = getStudentId();
    if (!month || !studentId) return;

    const rows = (appStateV981Stable1().lessonRecords || []).filter(x =>
      x.student_id === studentId &&
      x.year_month === month
    );

    const plannedRows = rows
      .filter(x => x.lesson_type === "planned")
      .sort(compareLessons);

    const actualRows = rows
      .filter(x => x.lesson_type === "actual")
      .sort(compareLessons);

    const actualByPlan = new Map();
    const unlinkedActual = [];

    actualRows.forEach(actual => {
      const matched = findMatch(actual, plannedRows);
      if (matched) {
        if (!actualByPlan.has(matched.id)) actualByPlan.set(matched.id, []);
        actualByPlan.get(matched.id).push(actual);
      } else {
        unlinkedActual.push(actual);
      }
    });

    const html = [];

    plannedRows.forEach(plan => {
      const actuals = actualByPlan.get(plan.id) || [];
      if (!actuals.length) {
        html.push(`<tr class="lesson-pair-row">${cellHtml(plan, "planned")}${cellHtml(null, "actual")}</tr>`);
      } else {
        actuals.forEach((actual, index) => {
          const left = index === 0 ? cellHtml(plan, "planned") : `<td colspan="6" class="lesson-empty-side">同一预定课时</td>`;
          html.push(`<tr class="lesson-pair-row">${left}${cellHtml(actual, "actual")}</tr>`);
        });
      }
    });

    unlinkedActual.forEach(actual => {
      html.push(`<tr class="lesson-pair-row">${cellHtml(null, "planned")}${cellHtml(actual, "actual")}</tr>`);
    });

    tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="12" class="empty-row">当前学生和月份没有课时记录</td></tr>`;

    if (typeof bindTableActionButtons === "function") {
      bindTableActionButtons();
    }
  }

  function scheduleStableRender() {
    [50, 250, 700].forEach(ms => setTimeout(renderStableTable, ms));
  }

  const renderStudentSettlementBeforeV9814 = typeof window.renderStudentSettlement === "function" ? window.renderStudentSettlement : null;
  if (renderStudentSettlementBeforeV9814) {
    window.renderStudentSettlement = function() {
      renderStudentSettlementBeforeV9814();
      scheduleStableRender();
    };
  }

  document.addEventListener("change", e => {
    if (e.target?.id === "settlementMonthFilter" || e.target?.id === "settlementStudentFilter") {
      scheduleStableRender();
    }
  });

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(scheduleStableRender, 1000);
  });

  window.SchoolStudentSettlementStableViewV9814 = {
    version: "9.8-stable2-student-settlement",
    render: renderStableTable,
  };
})();
