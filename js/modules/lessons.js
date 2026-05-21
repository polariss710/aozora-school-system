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
