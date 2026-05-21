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
  window.normalizeLessonPayload = function(payload, type) {
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
    window.openCreateModal = function(type, prefill = {}) {
      openCreateModalBeforeV904(type, prefill);
      if (type === "lesson") setTimeout(patchLessonCountFieldV904, 0);
    };
  }

  const openEditModalBeforeV904 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV904) {
    window.openEditModal = function(type, id) {
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
    window.openCreateModal = function(type, prefill = {}) {
      openCreateModalBeforeV905(type, prefill);
      if (type === "lesson") setTimeout(bindManualLessonTimeCalcV905, 0);
    };
  }

  const openEditModalBeforeV905 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV905) {
    window.openEditModal = function(type, id) {
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
    window.openCreateModal = function(type, prefill = {}) {
      openCreateModalBeforeV906(type, prefill);
      if (type === "lesson") setTimeout(patchLessonDurationDecimalV906, 0);
    };
  }

  const openEditModalBeforeV906 = typeof openEditModal === "function" ? openEditModal : null;
  if (openEditModalBeforeV906) {
    window.openEditModal = function(type, id) {
      openEditModalBeforeV906(type, id);
      if (type === "lesson") setTimeout(patchLessonDurationDecimalV906, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(patchLessonDurationDecimalV906, 800);
  });
})();
