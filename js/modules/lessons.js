// === v9.0.3 lessons sorting module ===
// 课时管理与月度结算共用同一套课时排序。
// 排序规则：月份 → 科目优先级 → 老师 → 日期 → 回数 → 开始时间。
// 注意：不改表格 HTML，只替换排序函数，避免破坏 v8.8.13 稳定画面。

(function () {
  function lessonCountNumber(row) {
    if (row?.lesson_count === null || row?.lesson_count === undefined || row?.lesson_count === "") return null;
    const n = Number(String(row.lesson_count).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function subjectPriority(row) {
    const name = row?.subject?.name || row?.subject_name || "";
    const order = ["日语", "数学", "物理", "化学", "生物", "文综"];
    const idx = order.findIndex(x => name.includes(x));
    return idx < 0 ? 99 : idx;
  }

  function teacherName(row) {
    return row?.teacher?.display_name || row?.teacher?.name || row?.teacher_name || row?.teacher_id || "";
  }

  function compareLessonsV903(a, b) {
    const month = String(a?.year_month || "").localeCompare(String(b?.year_month || ""));
    if (month) return month;

    const subject = subjectPriority(a) - subjectPriority(b);
    if (subject) return subject;

    const subjectName = String(a?.subject?.name || "").localeCompare(String(b?.subject?.name || ""), "zh-Hans-CN");
    if (subjectName) return subjectName;

    const teacher = String(teacherName(a)).localeCompare(String(teacherName(b)), "zh-Hans-CN");
    if (teacher) return teacher;

    const date = String(a?.lesson_date || "").localeCompare(String(b?.lesson_date || ""));
    if (date) return date;

    const ac = lessonCountNumber(a);
    const bc = lessonCountNumber(b);
    if (ac !== null || bc !== null) {
      if (ac === null) return 1;
      if (bc === null) return -1;
      if (ac !== bc) return ac - bc;
    }

    const start = String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
    if (start) return start;

    const created = String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
    if (created) return created;

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  }

  window.compareLessonsV77 = compareLessonsV903;
  window.compareLessonsV78 = compareLessonsV903;
  window.compareLessonsV83 = compareLessonsV903;
  window.compareLessonsV872 = compareLessonsV903;
  window.compareLessonsV8813 = compareLessonsV903;
  window.compareLessonsV903 = compareLessonsV903;

  window.SchoolLessonsModule = window.SchoolLessonsModule || {};
  window.SchoolLessonsModule.version = "9.0.3";
  window.SchoolLessonsModule.compareLessons = compareLessonsV903;

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-lessons")?.classList.contains("active") && typeof renderLessons === "function") {
        renderLessons();
      }
    }, 1000);
  });
})();

// === 清理旧函数-课程排序
function comparePlannedLessonsV86(a, b) {
  const month = String(a?.year_month || "").localeCompare(String(b?.year_month || ""));
  if (month !== 0) return month;

  const rank = subjectRankV86(a) - subjectRankV86(b);
  if (rank !== 0) return rank;

  const subject = String(a?.subject?.name || "").localeCompare(String(b?.subject?.name || ""));
  if (subject !== 0) return subject;

  const teacher = String(a?.teacher?.display_name || a?.teacher?.name || "")
    .localeCompare(String(b?.teacher?.display_name || b?.teacher?.name || ""));
  if (teacher !== 0) return teacher;

  const dateTime = compareDateTimeV86(a, b);
  if (dateTime !== 0) return dateTime;

  const ac = Number(String(a?.lesson_count ?? "").replace(/[^\d.-]/g, ""));
  const bc = Number(String(b?.lesson_count ?? "").replace(/[^\d.-]/g, ""));
  if (Number.isFinite(ac) || Number.isFinite(bc)) {
    if (!Number.isFinite(ac)) return 1;
    if (!Number.isFinite(bc)) return -1;
    if (ac !== bc) return ac - bc;
  }

  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

// ===课程排序相关函数1
function subjectRankV86(item) {
  const order = lessonTrackV86(item) === "humanities"
    ? SCHOOL_STABLE_V86.subjectOrderHumanities
    : SCHOOL_STABLE_V86.subjectOrderScience;
  const idx = order.indexOf(subjectKindV86(item));
  return idx >= 0 ? idx : 999;
}

// ===课程排序相关函数2
function compareDateTimeV86(a, b) {
  const date = String(a?.lesson_date || "").localeCompare(String(b?.lesson_date || ""));
  if (date !== 0) return date;
  const start = String(a?.start_time || "").localeCompare(String(b?.start_time || ""));
  if (start !== 0) return start;
  const end = String(a?.end_time || "").localeCompare(String(b?.end_time || ""));
  if (end !== 0) return end;
  return String(a?.created_at || "").localeCompare(String(b?.created_at || ""));
}

// === 显示第几回相关函数2
function lessonPairDateText(item) {
  const dateText = esc(displayRecordDate(item?.lesson_date || item?.created_at || ""));
  const count = item?.lesson_count;
  const countText = count !== undefined && count !== null && String(count).trim() !== ""
    ? `<br><span class="muted-small">第${esc(count)}回</span>`
    : "";
  return `${dateText}${countText}`;
}


// === v9.0.4 lesson count modal field ===
// 新增/编辑课时时正式显示“回数”输入框。
// 旧记录没有 lesson_count 时，可以通过编辑课时补录。
// 不强制必填；为空时继续允许保存。

(function () {
  function normalizeLessonCountV904(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(String(value).replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }

  function patchLessonCountFieldV904() {
    const form = document.getElementById("modalForm");
    if (!form || state.editing?.type !== "lesson") return;
    if (form.querySelector('[name="lesson_count"]')) return;

    const rowHtml = `
      <div class="form-row lesson-count-field-v904">
        <label>回数</label>
        <input name="lesson_count" type="number" step="1" min="1" placeholder="例：1" />
      </div>
    `;

    const statusRow = form.querySelector('[name="status"]')?.closest(".form-row");
    const contentRow = form.querySelector('[name="lesson_content"]')?.closest(".form-row");
    const actionsRow = form.querySelector(".form-actions");

    if (statusRow) statusRow.insertAdjacentHTML("beforebegin", rowHtml);
    else if (contentRow) contentRow.insertAdjacentHTML("beforebegin", rowHtml);
    else if (actionsRow) actionsRow.insertAdjacentHTML("beforebegin", rowHtml);
    else form.insertAdjacentHTML("beforeend", rowHtml);

    const input = form.querySelector('[name="lesson_count"]');
    const current = state.editing?.id ? findLocal("lesson", state.editing.id)?.lesson_count : "";
    if (input && current !== undefined && current !== null && current !== "") input.value = current;
  }

  // The older v8.8.6 patch inserted a <label class="form-field"> which did not match the current form layout.
  window.patchLessonCountFieldV886 = patchLessonCountFieldV904;
  window.patchLessonCountFieldV904 = patchLessonCountFieldV904;

  const normalizeLessonPayloadBeforeV904 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
  window.normalizeLessonPayload = function (payload, type) {
    if (normalizeLessonPayloadBeforeV904) payload = normalizeLessonPayloadBeforeV904(payload, type);

    if (type === "lesson") {
      const raw = document.getElementById("modalForm")?.querySelector('[name="lesson_count"]')?.value;
      const count = normalizeLessonCountV904(raw ?? payload.lesson_count);
      payload.lesson_count = count;
    }

    return payload;
  };

  const openCreateModalBeforeV904 = typeof openCreateModal === "function" ? openCreateModal : null;
  if (openCreateModalBeforeV904) {
    window.openCreateModal = function (type, prefill = {}) {
      openCreateModalBeforeV904(type, prefill);
      if (type === "lesson") setTimeout(patchLessonCountFieldV904, 0);
    };
  }

  const openEditModalBeforeV904 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV904) {
    window.openEditModal = function (type, id) {
      openEditModalBeforeV904(type, id);
      if (type === "lesson") setTimeout(patchLessonCountFieldV904, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(patchLessonCountFieldV904, 800);
  });
})();


// === v9.0.5 manual lesson time auto calculation ===
// 手动新增/编辑课时时：
// - 输入开始时间 + 结束时间后，自动计算时长（H）
// - 根据课程单价 × 时长，自动计算应收课时费
// - 允许手动修正时长和课时费；手动改过后不再强制覆盖

(function () {
  function parseTimeToMinutesV905(value) {
    const text = String(value || "").trim();
    if (!text) return null;

    const m = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;

    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;

    return h * 60 + min;
  }

  function calcHoursFromTimeV905(start, end) {
    const s = parseTimeToMinutesV905(start);
    const e = parseTimeToMinutesV905(end);
    if (s === null || e === null || e <= s) return null;

    // 这里用实际分钟数 / 60，不做15分钟取整。
    // 老师工资结算需要按总分钟数再统一取整，手动登录这里保留实际时长。
    return Math.round(((e - s) / 60) * 100) / 100;
  }

  function numberValueV905(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function formatHourInputV905(value) {
    if (value === null || value === undefined || value === "") return "";
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function bindManualLessonTimeCalcV905() {
    const form = document.getElementById("modalForm");
    if (!form || state.editing?.type !== "lesson") return;
    if (form.dataset.lessonTimeCalcBoundV905 === "true") return;
    form.dataset.lessonTimeCalcBoundV905 = "true";

    const startInput = form.querySelector('[name="start_time"]');
    const endInput = form.querySelector('[name="end_time"]');
    const durationInput = form.querySelector('[name="duration_hours"]');
    const unitInput = form.querySelector('[name="unit_price"]');
    const feeInput = form.querySelector('[name="lesson_fee"]');

    if (!durationInput) return;

    function updateFeeFromDuration() {
      if (!feeInput || feeInput.dataset.manualEditedV905 === "true") return;
      const unit = numberValueV905(unitInput?.value);
      const hours = numberValueV905(durationInput.value);
      if (!unit || !hours) return;
      feeInput.value = String(Math.round(unit * hours));
    }

    function updateDurationFromTimes() {
      if (!startInput || !endInput) return;

      const hours = calcHoursFromTimeV905(startInput.value, endInput.value);
      if (hours === null) return;

      // 如果用户手动修正过时长，则不覆盖。
      // 但如果当前时长为空，仍然自动填入。
      if (durationInput.dataset.manualEditedV905 !== "true" || !durationInput.value) {
        durationInput.value = formatHourInputV905(hours);
        durationInput.dataset.autoCalculatedV905 = "true";
        updateFeeFromDuration();
      }
    }

    [startInput, endInput].forEach(input => {
      if (!input) return;
      input.addEventListener("input", updateDurationFromTimes);
      input.addEventListener("change", updateDurationFromTimes);
    });

    if (durationInput) {
      durationInput.addEventListener("input", () => {
        durationInput.dataset.manualEditedV905 = "true";
        updateFeeFromDuration();
      });
      durationInput.addEventListener("change", () => {
        durationInput.dataset.manualEditedV905 = "true";
        updateFeeFromDuration();
      });
    }

    if (unitInput) {
      unitInput.addEventListener("input", updateFeeFromDuration);
      unitInput.addEventListener("change", updateFeeFromDuration);
    }

    if (feeInput) {
      feeInput.addEventListener("input", () => {
        feeInput.dataset.manualEditedV905 = "true";
      });
      feeInput.addEventListener("change", () => {
        feeInput.dataset.manualEditedV905 = "true";
      });
    }

    // 打开编辑弹窗时，如果已有开始/结束时间但时长为空，自动补一次。
    setTimeout(updateDurationFromTimes, 0);
  }

  window.bindManualLessonTimeCalcV905 = bindManualLessonTimeCalcV905;

  const openCreateModalBeforeV905 = typeof openCreateModal === "function" ? openCreateModal : null;
  if (openCreateModalBeforeV905) {
    window.openCreateModal = function (type, prefill = {}) {
      openCreateModalBeforeV905(type, prefill);
      if (type === "lesson") setTimeout(bindManualLessonTimeCalcV905, 0);
    };
  }

  const openEditModalBeforeV905 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV905) {
    window.openEditModal = function (type, id) {
      openEditModalBeforeV905(type, id);
      if (type === "lesson") setTimeout(bindManualLessonTimeCalcV905, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindManualLessonTimeCalcV905, 800);
  });
})();


// === v9.0.6 manual decimal duration fix ===
// 允许手动输入小数课时，例如 1.25 / 1.5 / 2.08。
// 同时保留 v9.0.5 的开始/结束时间自动计算。

(function () {
  function patchLessonDurationDecimalV906() {
    const form = document.getElementById("modalForm");
    if (!form || state.editing?.type !== "lesson") return;

    const duration = form.querySelector('[name="duration_hours"]');
    if (duration) {
      duration.setAttribute("type", "number");
      duration.setAttribute("step", "0.01");
      duration.setAttribute("min", "0");
      duration.setAttribute("inputmode", "decimal");
    }

    const unit = form.querySelector('[name="unit_price"]');
    if (unit) {
      unit.setAttribute("type", "number");
      unit.setAttribute("step", "1");
      unit.setAttribute("min", "0");
      unit.setAttribute("inputmode", "numeric");
    }

    const fee = form.querySelector('[name="lesson_fee"]');
    if (fee) {
      fee.setAttribute("type", "number");
      fee.setAttribute("step", "1");
      fee.setAttribute("min", "0");
      fee.setAttribute("inputmode", "numeric");
    }
  }

  window.patchLessonDurationDecimalV906 = patchLessonDurationDecimalV906;

  const openCreateModalBeforeV906 = typeof openCreateModal === "function" ? openCreateModal : null;
  if (openCreateModalBeforeV906) {
    window.openCreateModal = function (type, prefill = {}) {
      openCreateModalBeforeV906(type, prefill);
      if (type === "lesson") setTimeout(patchLessonDurationDecimalV906, 0);
    };
  }

  const openEditModalBeforeV906 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV906) {
    window.openEditModal = function (type, id) {
      openEditModalBeforeV906(type, id);
      if (type === "lesson") setTimeout(patchLessonDurationDecimalV906, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(patchLessonDurationDecimalV906, 800);
  });
})();

// === v9.1.5 teacher settlement month for actual lessons ===
(function () {
  function monthFromDateV915(dateText) {
    const text = String(dateText || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
    if (/^\d{4}\/\d{2}\/\d{2}$/.test(text)) return text.slice(0, 7).replace("/", "-");
    return "";
  }

  function currentRecordV915() {
    if (state.editing?.type !== "lesson") return null;
    if (!state.editing?.id) return state.editing?.data || null;
    return typeof findLocal === "function" ? findLocal("lesson", state.editing.id) : null;
  }

  function patchTeacherSettlementMonthFieldV915() {
    const form = document.getElementById("modalForm");
    if (!form || state.editing?.type !== "lesson") return;

    const typeValue = form.querySelector('[name="lesson_type"]')?.value || currentRecordV915()?.lesson_type || "actual";
    const existingRow = form.querySelector('[name="teacher_settlement_month"]')?.closest(".form-row, label, .form-field");

    if (typeValue !== "actual") {
      existingRow?.remove();
      return;
    }

    if (!form.querySelector('[name="teacher_settlement_month"]')) {
      const html = `
        <div class="form-row teacher-settlement-month-field-v915">
          <label>工资结算月份</label>
          <input name="teacher_settlement_month" type="month" />
        </div>
      `;
      const ymRow = form.querySelector('[name="year_month"]')?.closest(".form-row");
      const dateRow = form.querySelector('[name="lesson_date"]')?.closest(".form-row");
      const anchor = ymRow || dateRow;
      if (anchor) anchor.insertAdjacentHTML("afterend", html);
      else form.insertAdjacentHTML("afterbegin", html);
    }

    const input = form.querySelector('[name="teacher_settlement_month"]');
    const record = currentRecordV915();
    if (input && !input.value) {
      input.value = record?.teacher_settlement_month ||
        monthFromDateV915(form.querySelector('[name="lesson_date"]')?.value) ||
        monthFromDateV915(record?.lesson_date) ||
        record?.year_month ||
        "";
    }
  }

  function bindTeacherSettlementMonthEventsV915() {
    const form = document.getElementById("modalForm");
    if (!form || state.editing?.type !== "lesson") return;
    if (form.dataset.teacherSettlementMonthBoundV915 === "true") return;
    form.dataset.teacherSettlementMonthBoundV915 = "true";

    form.querySelector('[name="lesson_type"]')?.addEventListener("change", patchTeacherSettlementMonthFieldV915);

    form.querySelector('[name="lesson_date"]')?.addEventListener("change", () => {
      const input = form.querySelector('[name="teacher_settlement_month"]');
      if (input && input.dataset.manualEditedV915 !== "true") {
        input.value = monthFromDateV915(form.querySelector('[name="lesson_date"]')?.value) || input.value;
      }
    });

    form.addEventListener("input", e => {
      if (e.target?.name === "teacher_settlement_month") e.target.dataset.manualEditedV915 = "true";
    });
  }

  function patchLessonModalV915() {
    patchTeacherSettlementMonthFieldV915();
    bindTeacherSettlementMonthEventsV915();
  }

  const normalizeBeforeV915 = typeof normalizeLessonPayload === "function" ? normalizeLessonPayload : null;
  window.normalizeLessonPayload = function (payload, type) {
    if (normalizeBeforeV915) payload = normalizeBeforeV915(payload, type);
    if (type === "lesson") {
      const form = document.getElementById("modalForm");
      const lessonType = payload.lesson_type || form?.querySelector('[name="lesson_type"]')?.value;
      if (lessonType === "actual") {
        payload.teacher_settlement_month =
          form?.querySelector('[name="teacher_settlement_month"]')?.value ||
          monthFromDateV915(payload.lesson_date) ||
          payload.year_month ||
          null;
      } else {
        payload.teacher_settlement_month = null;
      }
    }
    return payload;
  };

  const openCreateBeforeV915 = typeof openCreateModal === "function" ? openCreateModal : null;
  if (openCreateBeforeV915) {
    window.openCreateModal = function (type, prefill = {}) {
      if (type === "lesson" && (prefill.lesson_type || "actual") === "actual" && !prefill.teacher_settlement_month) {
        prefill = { ...prefill, teacher_settlement_month: monthFromDateV915(prefill.lesson_date) || prefill.year_month || "" };
      }
      openCreateBeforeV915(type, prefill);
      if (type === "lesson") setTimeout(patchLessonModalV915, 0);
    };
  }

  const openEditBeforeV915 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditBeforeV915) {
    window.openEditModal = function (type, id) {
      openEditBeforeV915(type, id);
      if (type === "lesson") setTimeout(patchLessonModalV915, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(patchLessonModalV915, 800));
  window.SchoolLessonTeacherSettlementMonthV915 = { monthFromDate: monthFromDateV915, patch: patchLessonModalV915 };
})();

// === v9.1.6 lesson management stats RPC ===
// 过渡方案：legacy-core.js 里的旧统计暂时保留，这里用 DB/RPC 结果覆盖课时管理顶部统计。
(function () {
  const RPC_NAME_V916 = "school_get_lesson_management_stats";
  const LESSON_STATS_IDS_V916 = [
    "lessonPlannedHours",
    "lessonActualHours",
    "lessonPlannedFeeTotal",
    "lessonActualFeeTotal",
    "lessonCompletedCount",
    "lessonCancelledCount",
    "lessonRecordCount",
  ];
  let requestSeqV916 = 0;
  let refreshTimerV916 = null;

  function optionalValueV916(id) {
    const value = document.getElementById(id)?.value || "";
    return value || null;
  }

  function normalizeStudentFilterV916() {
    if (typeof normalizeLessonSelectedStudentFilterV9812 === "function") {
      return normalizeLessonSelectedStudentFilterV9812() || null;
    }
    return optionalValueV916("lessonStudentFilter");
  }

  function lessonStatsFilterParamsV916() {
    return {
      p_year_month: optionalValueV916("lessonMonthFilter"),
      p_student_id: normalizeStudentFilterV916(),
      p_teacher_id: optionalValueV916("lessonTeacherFilter"),
      p_subject_id: optionalValueV916("lessonSubjectFilter"),
      p_lesson_type: optionalValueV916("lessonTypeFilter"),
      p_status: optionalValueV916("lessonStatusFilter"),
      p_business_entity_id: optionalValueV916("lessonBusinessEntityFilter"),
    };
  }

  function formatHoursV916(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0";
    return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
  }

  function formatJpyV916(value) {
    const n = Number(value || 0);
    if (typeof formatJpyV83 === "function") return formatJpyV83(n);
    return `${Math.round(n).toLocaleString()} JPY`;
  }

  function setTextV916(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderLessonStatsLoadingV916() {
    LESSON_STATS_IDS_V916.forEach(id => setTextV916(id, "读取中"));
  }

  function renderLessonStatsZeroV916() {
    setTextV916("lessonPlannedHours", "0");
    setTextV916("lessonActualHours", "0");
    setTextV916("lessonPlannedFeeTotal", formatJpyV916(0));
    setTextV916("lessonActualFeeTotal", formatJpyV916(0));
    setTextV916("lessonCompletedCount", "0");
    setTextV916("lessonCancelledCount", "0");
    setTextV916("lessonRecordCount", "0");
  }

  async function fetchLessonManagementStatsV916() {
    if (typeof db === "undefined" || !db?.rpc) return null;
    const { data, error } = await db.rpc(RPC_NAME_V916, lessonStatsFilterParamsV916());
    if (error) {
      console.warn(`${RPC_NAME_V916} failed`, error);
      return null;
    }
    return Array.isArray(data) ? data[0] : data;
  }

  function renderLessonManagementStatsV916(stats) {
    if (!stats) return;
    setTextV916("lessonPlannedHours", formatHoursV916(stats.planned_hours));
    setTextV916("lessonActualHours", formatHoursV916(stats.actual_hours));
    setTextV916("lessonPlannedFeeTotal", formatJpyV916(stats.planned_fee_jpy));
    setTextV916("lessonActualFeeTotal", formatJpyV916(stats.actual_fee_jpy));
    setTextV916("lessonCompletedCount", String(Number(stats.completed_count || 0)));
    setTextV916("lessonCancelledCount", String(Number(stats.cancelled_count || 0)));
    setTextV916("lessonRecordCount", String(Number(stats.record_count || 0)));
  }

  async function refreshLessonManagementStatsV916() {
    const seq = ++requestSeqV916;
    renderLessonStatsLoadingV916();
    const stats = await fetchLessonManagementStatsV916();
    if (seq !== requestSeqV916) return;
    if (stats) renderLessonManagementStatsV916(stats);
    else renderLessonStatsZeroV916();
  }

  function scheduleLessonManagementStatsRefreshV916(delay = 0) {
    renderLessonStatsLoadingV916();
    clearTimeout(refreshTimerV916);
    refreshTimerV916 = setTimeout(refreshLessonManagementStatsV916, delay);
  }

  function bindLessonStatsRefreshV916() {
    const ids = [
      "lessonMonthFilter",
      "lessonStudentFilter",
      "lessonTeacherFilter",
      "lessonSubjectFilter",
      "lessonTypeFilter",
      "lessonStatusFilter",
      "lessonBusinessEntityFilter",
    ];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.lessonStatsRpcBoundV916 === "true") return;
      el.dataset.lessonStatsRpcBoundV916 = "true";
      el.addEventListener("change", () => scheduleLessonManagementStatsRefreshV916(50));
    });
  }

  const renderLessonsBeforeV916 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV916) {
    window.renderLessons = function () {
      renderLessonsBeforeV916();
      scheduleLessonManagementStatsRefreshV916(0);
    };
  }

  const renderAllBeforeV916 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV916) {
    window.renderAll = function () {
      renderAllBeforeV916();
      bindLessonStatsRefreshV916();
      scheduleLessonManagementStatsRefreshV916(0);
    };
  }

  const loadLessonRecordsBeforeV916 = typeof loadLessonRecords === "function" ? loadLessonRecords : null;
  if (loadLessonRecordsBeforeV916) {
    window.loadLessonRecords = async function () {
      const result = await loadLessonRecordsBeforeV916();
      scheduleLessonManagementStatsRefreshV916(0);
      return result;
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      bindLessonStatsRefreshV916();
      scheduleLessonManagementStatsRefreshV916(0);
    }, 1000);
  });

  window.SchoolLessonStatsRpcV916 = {
    refresh: refreshLessonManagementStatsV916,
    render: renderLessonManagementStatsV916,
    params: lessonStatsFilterParamsV916,
  };
})();

// === v9.1.7 lesson list display cleanup ===
// Keep list rendering in legacy-core.js, but normalize the visible lesson count in the lesson page.
(function () {
  function lessonCountTextV917(item) {
    const raw = item?.lesson_count;
    if (raw === null || raw === undefined || String(raw).trim() === "") return "";
    return `第${String(raw).trim()}回`;
  }

  function lessonCellV917(item, side) {
    if (!item) {
      return `<td colspan="8" class="lesson-empty-side">${side === "actual" ? "未登录实际课时" : "未关联预定课时"}</td>`;
    }

    const d = lessonDateDisplayV86(item);
    const statusClass = item.status === "cancelled" || item.status === "holiday" ? "red" : "";
    const timeText = lessonPairTimeText(item) || "时间未定";
    const countText = lessonCountTextV917(item);
    const content = esc(short(item.lesson_content || item.note || "", 22));
    const countHtml = countText ? `<div class="lesson-count-v917">${esc(countText)}</div>` : "";

    return `
      <td class="col-check"><label class="lesson-check-only"><input type="checkbox" class="lesson-delete-check" value="${escAttr(item.id)}" /></label></td>
      <td class="col-date"><div>${esc(d.main)}</div><span>${esc(d.sub)}</span>${countHtml}</td>
      <td class="col-student">${lessonPairStudentText(item)}</td>
      <td class="col-teacher">${lessonPairTeacherText(item)}</td>
      <td class="col-subject"><strong>${lessonPairSubjectText(item)}</strong><span>${timeText} / ${money(item.duration_hours)}H</span></td>
      <td class="col-status">${badge(lessonStatusLabel(item.status), statusClass)}${item.is_billable ? badge("计费") : badge("不计费", "gray")}</td>
      <td class="col-content"><div class="lesson-content-text" title="${escAttr(item.lesson_content || item.note || "")}">${content}</div></td>
      <td class="col-actions">${lessonRowActionsV86(item)}</td>
    `;
  }

  function renderLessonRowsV917(rows) {
    const pairBuilder = typeof buildLessonPairsStrictV873 === "function" ? buildLessonPairsStrictV873 : buildLessonPairsStrictV872;
    const { planned, actualByPlan, unlinkedActual, dateSort, countMap } = pairBuilder(rows);
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

    planned.forEach(plan => {
      addMonthRow(plan.year_month || "未归属月份");
      const planId = typeof planIdTextV872 === "function" ? planIdTextV872(plan.id) : String(plan.id || "").trim();
      const actuals = (actualByPlan.get(planId) || []).slice().sort(dateSort);
      const isDup = typeof isDuplicatePlannedV872 === "function" && isDuplicatePlannedV872(plan, countMap);
      const basePlannedCell = lessonCellV917(plan, "planned");
      const plannedCell = typeof appendDuplicateWarningToPlannedCellsV873 === "function"
        ? appendDuplicateWarningToPlannedCellsV873(basePlannedCell, plan, countMap)
        : basePlannedCell;

      if (!actuals.length) {
        html.push(`<tr class="lesson-pair-row v8310 ${isDup ? "duplicate-planned-row-v872" : ""}">${plannedCell}${lessonCellV917(null, "actual")}</tr>`);
        return;
      }

      actuals.forEach((actual, index) => {
        const left = index === 0 ? plannedCell : `<td colspan="8" class="lesson-empty-side">同一预定课时</td>`;
        html.push(`<tr class="lesson-pair-row v8310 ${isDup ? "duplicate-planned-row-v872" : ""}">${left}${lessonCellV917(actual, "actual")}</tr>`);
      });
    });

    unlinkedActual.forEach(actual => {
      addMonthRow(actual.year_month || "未归属月份");
      html.push(`<tr class="lesson-pair-row v8310">${lessonCellV917(null, "planned")}${lessonCellV917(actual, "actual")}</tr>`);
    });

    return html.join("");
  }

  function lessonIdFromDateCellV917(td) {
    const row = td?.closest?.("tr.lesson-pair-row");
    if (!row) return "";
    const cells = Array.from(row.cells || []);
    const index = cells.indexOf(td);
    if (index < 0) return "";
    const actionCell = cells[index + 6];
    const action = actionCell?.querySelector?.("[data-edit][data-type='lesson'], [data-delete][data-type='lesson'], [data-copy-lesson], [data-create-actual]");
    return action?.dataset?.edit || action?.dataset?.delete || action?.dataset?.copyLesson || action?.dataset?.createActual || "";
  }

  function patchLessonListCountV917() {
    const page = document.getElementById("page-lessons");
    if (!page) return;

    page.querySelectorAll("#lessonsTable .col-date").forEach(td => {
      const id = lessonIdFromDateCellV917(td);
      const item = (state.lessonRecords || []).find(row => String(row.id) === String(id));
      const mainText = td.querySelector("div")?.textContent?.trim() || item?.lesson_date || item?.created_at || "";
      const subText = td.querySelector("span:not(.lesson-count-v886):not(.lesson-count-v917)")?.textContent?.trim() || item?.year_month || "";
      const text = lessonCountTextV917(item);

      td.textContent = "";

      const main = document.createElement("div");
      main.textContent = mainText;
      td.appendChild(main);

      if (subText) {
        const sub = document.createElement("span");
        sub.textContent = subText;
        td.appendChild(sub);
      }

      if (text) {
        const marker = document.createElement("div");
        marker.className = "lesson-count-v917";
        marker.textContent = text;
        td.appendChild(marker);
      }
    });
  }

  const renderLessonsBeforeV917 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV917) {
    window.renderLessons = function () {
      if (typeof renderLessonRowsStrictV873 === "function") renderLessonRowsStrictV873 = renderLessonRowsV917;
      renderLessonsBeforeV917();
      patchLessonListCountV917();
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(patchLessonListCountV917, 1000);
  });

  window.lessonCellV86 = lessonCellV917;
  window.lessonPairCells = lessonCellV917;
  window.renderLessonRowsStrictV873 = renderLessonRowsV917;
  window.SchoolLessonsModule = window.SchoolLessonsModule || {};
  window.SchoolLessonsModule.lessonCell = lessonCellV917;
  window.SchoolLessonsModule.renderLessonRows = renderLessonRowsV917;
  window.SchoolLessonsModule.patchLessonListCount = patchLessonListCountV917;
})();
