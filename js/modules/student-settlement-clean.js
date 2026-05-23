// === v9.8-stable-final.3-student-settlement-list-css ===
// 学生月度结算清理版：只保留一个渲染入口。
// 核心统计和金额读取 DB RPC；JS 只负责读取、显示、课时明细排版和锁定触发。

(function () {
  const SUMMARY_RPC = "school_get_student_monthly_settlement_summary";

  function appState() {
    if (typeof state !== "undefined" && state) return state;
    return window.state || {};
  }

  function n(v) {
    const x = Number(v || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function money(v) {
    const x = Math.round(n(v));
    return x.toLocaleString();
  }

  function hours(v) {
    const x = n(v);
    if (Number.isInteger(x)) return String(x);
    return x.toFixed(2).replace(/\.00$/, "").replace(/0$/, "");
  }

  function jpy(v) {
    return `${money(v)} JPY`;
  }

  function cny(v) {
    return `${money(v)} CNY`;
  }

  function escText(v) {
    if (typeof esc === "function") return esc(v);
    return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function escAttribute(v) {
    if (typeof escAttr === "function") return escAttr(v);
    return escText(v).replace(/"/g, "&quot;");
  }

  function setText(id, value) {
    if (typeof setOptionalText === "function") {
      setOptionalText(id, value);
      return;
    }
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function dbClient() {
    if (typeof db !== "undefined" && db?.rpc) return db;
    if (typeof supabase !== "undefined" && supabase?.rpc) return supabase;
    if (window.db?.rpc) return window.db;
    if (window.supabase?.rpc) return window.supabase;
    return null;
  }

  function selectedMonth() {
    return document.getElementById("settlementMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function selectedStudentId() {
    return document.getElementById("settlementStudentFilter")?.value || "";
  }

  function studentName(row) {
    return row?.display_name || row?.name || "";
  }

  function teacherName(row) {
    return row?.display_name || row?.name || "";
  }

  function subjectName(row) {
    return row?.name || row?.subject_name || "";
  }

  function lessonStudentName(row) {
    return row?.student?.display_name || row?.student?.name || "";
  }

  function lessonTeacherName(row) {
    return row?.teacher?.display_name || row?.teacher?.name || "";
  }

  function lessonSubjectName(row) {
    return row?.subject?.name || row?.subject_name || "";
  }

  function lessonDate(row) {
    if (!row) return "";
    if (typeof displayRecordDate === "function") return displayRecordDate(row.lesson_date || "");
    return String(row.lesson_date || "").slice(0, 10);
  }

  function timeText(row) {
    return [row?.start_time, row?.end_time].filter(Boolean).join("-");
  }

  function statusLabel(row) {
    if (!row) return "";
    const value = row.status || "";
    if (typeof lessonStatusLabel === "function") return lessonStatusLabel(value);
    const map = {
      completed: "已上课",
      pending_makeup: "待补课",
      makeup_completed: "已补课",
      makeup: "补课",
      planned: "预定",
      cancelled: "取消课",
      holiday: "放假",
      absent: "缺席",
    };
    return map[value] || value;
  }

  function badgeHtml(text, kind = "") {
    if (typeof badge === "function") return badge(text, kind);
    return `<span class="badge ${kind}">${escText(text)}</span>`;
  }

  function statusHtml(row) {
    if (!row) return "";
    const danger = row.status === "cancelled" || row.status === "holiday";
    const billable = row.is_billable !== false;
    return `${badgeHtml(statusLabel(row), danger ? "red" : "")}<br>${billable ? badgeHtml("计费") : badgeHtml("不计费", "gray")}`;
  }

  function lessonFee(row) {
    return n(row?.lesson_fee || (n(row?.unit_price) * n(row?.duration_hours)));
  }

  function compareLessons(a, b) {
    const s = lessonSubjectName(a).localeCompare(lessonSubjectName(b), "zh-Hans-CN");
    if (s !== 0) return s;
    const d = String(a.lesson_date || "").localeCompare(String(b.lesson_date || ""));
    if (d !== 0) return d;
    return String(a.start_time || "").localeCompare(String(b.start_time || ""));
  }

  function currentStudent() {
    const id = selectedStudentId();
    return (appState().students || []).find(x => x.id === id) || null;
  }

  async function fetchDbSummary(studentId, month) {
    const client = dbClient();
    if (!client || !studentId || !month) return null;
    const { data, error } = await client.rpc(SUMMARY_RPC, {
      p_student_id: studentId,
      p_year_month: month,
    });
    if (error) {
      console.error("student settlement DB summary failed", error);
      if (typeof showMessage === "function") showMessage(`读取学生月度结算DB汇总失败：${error.message || error}`, "error");
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  }

  function normalizeSummary(row) {
    if (!row) return null;
    return {
      studentId: row.student_id,
      month: row.year_month,
      rate: n(row.exchange_rate),
      carryoverCny: n(row.carryover_cny),
      plannedHours: n(row.planned_hours),
      actualHours: n(row.actual_hours),
      plannedFeeJpy: n(row.planned_fee_jpy),
      plannedFeeCny: n(row.planned_fee_cny),
      plannedTotalCny: n(row.planned_total_cny),
      actualFeeJpy: n(row.actual_fee_jpy),
      actualFeeCny: n(row.actual_fee_cny),
      receivedJpy: n(row.received_jpy),
      receivedCny: n(row.received_cny),
      receivedEquivalentCny: n(row.received_equivalent_cny),
      finalDueCny: n(row.final_due_cny),
      lockedCarryoverCny: n(row.locked_carryover_cny ?? row.final_due_cny),
    };
  }

  function applySummary(summary) {
    if (!summary) return;

    window.__studentSettlementSummaryClean = summary;
    window.__studentSettlementSummaryDbV989 = summary;
    window.__studentSettlementCarryoverV987 = {
      month: summary.month,
      studentId: summary.studentId,
      amount: summary.carryoverCny,
    };

    setText("settlementPlannedHours", hours(summary.plannedHours));
    setText("settlementActualHours", hours(summary.actualHours));
    setText("settlementPlannedJpy", jpy(summary.plannedFeeJpy));
    setText("settlementActualJpy", jpy(summary.actualFeeJpy));

    setText("settlementPrevBalanceCny", cny(summary.carryoverCny));
    setText("settlementExchangeRate", money(summary.rate));
    setText("settlementPlannedJpy2", jpy(summary.plannedFeeJpy));
    setText("settlementPlannedCny", cny(summary.plannedFeeCny));
    setText("settlementPlannedTotalCny", cny(summary.plannedTotalCny));

    setText("settlementActualJpy2", jpy(summary.actualFeeJpy));
    setText("settlementActualCny", cny(summary.actualFeeCny));
    setText("settlementReceivedCny", cny(summary.receivedCny));
    setText("settlementReceivedJpy", jpy(summary.receivedJpy));
    setText("settlementFinalStatusCny", cny(summary.finalDueCny));

    const finalCell = document.querySelector("#page-student-settlement .settlement-board .settlement-card:nth-child(2) tr.total-row td");
    if (finalCell) {
      finalCell.textContent = summary.finalDueCny >= 0
        ? `需补交：${cny(summary.finalDueCny)}`
        : `有结余：${cny(Math.abs(summary.finalDueCny))}`;
      finalCell.className = summary.finalDueCny >= 0 ? "negative-text" : "positive-text";
    }
  }

  function renderStudentOptions() {
    const select = document.getElementById("settlementStudentFilter");
    if (!select) return;
    const students = (appState().students || []).filter(x => x.status !== "inactive");
    const current = select.value || new URLSearchParams(location.search).get("student_id") || students[0]?.id || "";
    select.innerHTML = students.map(s => `<option value="${escAttribute(s.id)}">${escText(studentName(s))}</option>`).join("");
    if (current && students.some(s => s.id === current)) select.value = current;
    const hint = document.getElementById("settlementStudentHint");
    if (hint) hint.textContent = select.value ? "已选择学生" : "学生必选";
  }

  function ensureMonth() {
    const input = document.getElementById("settlementMonthFilter");
    if (!input) return;
    if (!input.value) {
      input.value = new URLSearchParams(location.search).get("settlement_month")
        || new URLSearchParams(location.search).get("year_month")
        || new Date().toISOString().slice(0, 7);
    }
  }

  function matchActualToPlan(actual, plannedRows) {
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
    ) || null;
  }

  function sideCells(row, side) {
    if (!row) {
      return `<td colspan="7" class="empty-row">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
    }

    const actions = `
      <div class="table-actions lesson-actions">
        ${row.lesson_type === "planned" ? `<button class="secondary-btn" data-create-actual="${escAttribute(row.id)}">生成实际</button>` : ""}
        <button class="secondary-btn" data-copy-lesson="${escAttribute(row.id)}">复制</button>
        <button class="secondary-btn" data-edit="${escAttribute(row.id)}" data-type="lesson">编辑</button>
        <button class="danger-btn" data-delete="${escAttribute(row.id)}" data-type="lesson">删除</button>
      </div>
    `;

    return `
      <td class="date-col">
        <strong>${escText(lessonDate(row))}</strong><br>
        <span class="muted-small">${escText(row.lesson_date || "")}</span>
      </td>
      <td>${escText(lessonStudentName(row))}</td>
      <td>${escText(lessonTeacherName(row))}</td>
      <td>
        <strong>${escText(lessonSubjectName(row))}</strong><br>
        <span class="muted-small">${escText(timeText(row))} / ${hours(row.duration_hours)}H<br>${jpy(lessonFee(row))}</span>
      </td>
      <td>${statusHtml(row)}</td>
      <td><div class="lesson-content-cell">${escText((row.lesson_content || row.note || "").slice(0, 42))}</div></td>
      <td>${actions}</td>
    `;
  }

  function ensureSettlementTableHead() {
    const table = document.getElementById("settlementLessonsTable")?.closest("table");
    const thead = table?.querySelector("thead");
    const wrap = table?.closest(".table-wrap");
    if (wrap) wrap.classList.add("settlement-lessons-wrap");
    if (table) table.classList.add("settlement-lessons-table");
    if (!thead || thead.dataset.cleanPairedHead === "true") return;
    thead.dataset.cleanPairedHead = "true";
    thead.innerHTML = `
      <tr>
        <th colspan="7" class="lesson-pair-head">预定课时</th>
        <th colspan="7" class="lesson-pair-head actual">实际课时</th>
      </tr>
      <tr class="lesson-sub-head">
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
        <th>日期</th><th>姓名</th><th>担当老师</th><th>科目</th><th>状态</th><th>内容</th><th>操作</th>
      </tr>
    `;
  }

  function renderLessonDetails() {
    const tbody = document.getElementById("settlementLessonsTable");
    if (!tbody) return;

    ensureSettlementTableHead();

    const studentId = selectedStudentId();
    const month = selectedMonth();
    const rows = (appState().lessonRecords || []).filter(x => x.student_id === studentId && x.year_month === month);

    const plannedRows = rows.filter(x => x.lesson_type === "planned").sort(compareLessons);
    const actualRows = rows.filter(x => x.lesson_type === "actual").sort(compareLessons);

    const actualByPlan = new Map();
    const unlinkedActual = [];

    actualRows.forEach(actual => {
      const plan = matchActualToPlan(actual, plannedRows);
      if (plan) {
        if (!actualByPlan.has(plan.id)) actualByPlan.set(plan.id, []);
        actualByPlan.get(plan.id).push(actual);
      } else {
        unlinkedActual.push(actual);
      }
    });

    const html = [];

    plannedRows.forEach(plan => {
      const actuals = actualByPlan.get(plan.id) || [];
      if (!actuals.length) {
        html.push(`<tr class="lesson-pair-row">${sideCells(plan, "planned")}${sideCells(null, "actual")}</tr>`);
      } else {
        actuals.forEach((actual, idx) => {
          const left = idx === 0 ? sideCells(plan, "planned") : `<td colspan="7" class="empty-row">同一预定课时</td>`;
          html.push(`<tr class="lesson-pair-row">${left}${sideCells(actual, "actual")}</tr>`);
        });
      }
    });

    unlinkedActual.forEach(actual => {
      html.push(`<tr class="lesson-pair-row">${sideCells(null, "planned")}${sideCells(actual, "actual")}</tr>`);
    });

    tbody.innerHTML = html.length ? html.join("") : `<tr><td colspan="14" class="empty-row">当前学生和月份没有课时记录</td></tr>`;

    if (typeof bindTableActionButtons === "function") bindTableActionButtons();
    if (typeof bindLessonPairButtonsV43 === "function") bindLessonPairButtonsV43();
  }

  function computeSnapshotFromDb(adjustment = 0, reason = "") {
    const summary = window.__studentSettlementSummaryClean || window.__studentSettlementSummaryDbV989;
    const student = currentStudent();
    const studentId = selectedStudentId();
    const month = selectedMonth();
    if (!summary || !student || summary.studentId !== studentId || summary.month !== month) return null;

    const systemDifferenceCny = summary.finalDueCny;
    const carryoverAmountCny = systemDifferenceCny + n(adjustment);

    return {
      student,
      student_id: studentId,
      year_month: month,
      business_entity_id: student.business_entity_id || null,
      preset_exchange_rate: summary.rate,
      planned_lesson_fee_jpy: summary.plannedFeeJpy,
      planned_lesson_fee_cny: summary.plannedFeeCny,
      actual_lesson_fee_jpy: summary.actualFeeJpy,
      actual_lesson_fee_cny: summary.actualFeeCny,
      previous_balance_cny: summary.carryoverCny,
      received_jpy: summary.receivedJpy,
      received_cny: summary.receivedCny,
      received_equivalent_cny: summary.receivedEquivalentCny,
      system_difference_cny: systemDifferenceCny,
      adjustment_amount_cny: n(adjustment),
      adjustment_reason: reason || "",
      carryover_amount_cny: carryoverAmountCny,
      settlement_status: "locked",
      locked_at: new Date().toISOString(),
    };
  }

  async function renderCleanStudentSettlement() {
    ensureMonth();
    renderStudentOptions();

    const studentId = selectedStudentId();
    const month = selectedMonth();

    if (!studentId || !month) {
      renderLessonDetails();
      return;
    }

    const summary = normalizeSummary(await fetchDbSummary(studentId, month));
    applySummary(summary);
    renderLessonDetails();

    if (typeof ensureSettlementPanelV87 === "function") ensureSettlementPanelV87();
    if (typeof updateSettlementLockPreviewV87 === "function") updateSettlementLockPreviewV87();
    if (typeof fetchSettlementLockHistoryV871 === "function") fetchSettlementLockHistoryV871();
    else if (typeof fetchSettlementLockHistoryV87 === "function") fetchSettlementLockHistoryV87();
  }

  function bindCleanEvents() {
    document.getElementById("settlementMonthFilter")?.addEventListener("change", renderCleanStudentSettlement);
    document.getElementById("settlementStudentFilter")?.addEventListener("change", renderCleanStudentSettlement);
    document.getElementById("settlementRefreshBtn")?.addEventListener("click", renderCleanStudentSettlement);
  }

  function install() {
    window.renderStudentSettlement = renderCleanStudentSettlement;
    try { renderStudentSettlement = renderCleanStudentSettlement; } catch (e) {}
    window.computeSettlementSnapshotV87 = computeSnapshotFromDb;
    try { computeSettlementSnapshotV87 = computeSnapshotFromDb; } catch (e) {}

    bindCleanEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install);
  } else {
    install();
  }

  window.SchoolStudentSettlementClean = {
    version: "v9.8-stable-final.3-student-settlement-list-css",
    render: renderCleanStudentSettlement,
    fetchSummary: fetchDbSummary,
  };
})();
