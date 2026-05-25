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

// === v9.1.8 independent lesson form and save flow ===
(function () {
  const PLANNED_STATUSES_V918 = [
    { value: "planned", label: "待上课" },
    { value: "pending_makeup", label: "待补课" },
  ];
  const ACTUAL_STATUSES_V918 = [
    { value: "completed", label: "已上课" },
    { value: "cancelled", label: "取消课" },
    { value: "makeup_completed", label: "已补课" },
  ];
  const LEGACY_ACTUAL_STATUS_V918 = { value: "makeup", label: "补课" };

  function hV918(value) {
    if (typeof esc === "function") return esc(value);
    return String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  function aV918(value) {
    if (typeof escAttr === "function") return escAttr(value);
    return hV918(value);
  }

  function todayV918() {
    if (typeof todayStr === "function") return todayStr();
    return new Date().toISOString().slice(0, 10);
  }

  function monthV918(dateText) {
    const text = String(dateText || "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 7);
    if (/^\d{4}-\d{2}$/.test(text)) return text;
    if (typeof currentYearMonth === "function") return currentYearMonth();
    return new Date().toISOString().slice(0, 7);
  }

  function rowByIdV918(rows, id) {
    return (rows || []).find(row => String(row.id) === String(id)) || null;
  }

  function optionRowsV918(rows, labelFn, includeEmpty = false) {
    const options = includeEmpty ? [`<option value="">未设置</option>`] : [];
    (rows || []).forEach(row => {
      options.push(`<option value="${aV918(row.id)}">${hV918(labelFn(row))}</option>`);
    });
    return options.join("");
  }

  function businessOptionsV918() {
    return optionRowsV918(state.businessEntities || [], row => row.name || row.code || row.id, true);
  }

  function studentOptionsV918() {
    return optionRowsV918(state.students || [], row => row.display_name || row.name || row.id, true);
  }

  function teacherOptionsV918() {
    return optionRowsV918(state.teachers || [], row => row.display_name || row.name || row.id, true);
  }

  function subjectOptionsV918() {
    return optionRowsV918(state.subjects || [], row => row.name || row.id, true);
  }

  function selectedV918(value, current) {
    return String(value ?? "") === String(current ?? "") ? "selected" : "";
  }

  function statusOptionsV918(lessonType, currentStatus) {
    const base = lessonType === "planned" ? PLANNED_STATUSES_V918 : ACTUAL_STATUSES_V918;
    const options = base.slice();
    if (lessonType === "actual" && currentStatus === "makeup") options.push(LEGACY_ACTUAL_STATUS_V918);
    return options.map(opt => `<option value="${aV918(opt.value)}" ${selectedV918(opt.value, currentStatus)}>${hV918(opt.label)}</option>`).join("");
  }

  function defaultStatusV918(lessonType) {
    return lessonType === "planned" ? "planned" : "completed";
  }

  function defaultBillableV918(lessonType, status) {
    if (lessonType === "planned") return true;
    if (status === "cancelled") return false;
    if (status === "makeup_completed") return false;
    return true;
  }

  function normalizeStatusV918(lessonType, status) {
    const text = String(status || "").trim();
    if (lessonType === "planned") {
      return ["planned", "pending_makeup"].includes(text) ? text : "planned";
    }
    return ["completed", "cancelled", "makeup_completed", "makeup"].includes(text) ? text : "completed";
  }

  function numberOrNullV918(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function lessonTableV918() {
    return tables?.lessons || "school_lesson_records";
  }

  function baseLessonRecordV918(data = {}) {
    const lessonType = data.lesson_type || "actual";
    const status = normalizeStatusV918(lessonType, data.status || defaultStatusV918(lessonType));
    const date = data.lesson_date || todayV918();
    return {
      lesson_type: lessonType,
      planned_lesson_id: data.planned_lesson_id || "",
      lesson_date: date,
      year_month: data.year_month || monthV918(date),
      student_id: data.student_id || "",
      teacher_id: data.teacher_id || "",
      subject_id: data.subject_id || "",
      business_entity_id: data.business_entity_id || "",
      start_time: data.start_time || "",
      end_time: data.end_time || "",
      duration_hours: data.duration_hours ?? 2,
      unit_price: data.unit_price ?? "",
      lesson_fee: data.lesson_fee ?? "",
      status,
      is_billable: data.is_billable ?? defaultBillableV918(lessonType, status),
      lesson_count: data.lesson_count ?? "",
      lesson_content: data.lesson_content || "",
      note: data.note || "",
      teacher_settlement_month: data.teacher_settlement_month || (lessonType === "actual" ? monthV918(date) : ""),
    };
  }

  function lessonFormHtmlV918(record, mode) {
    const item = baseLessonRecordV918(record);
    return `
      <input type="hidden" name="planned_lesson_id" value="${aV918(item.planned_lesson_id)}" />
      <div class="form-row">
        <label>课时类型</label>
        <select name="lesson_type" required>
          <option value="planned" ${selectedV918("planned", item.lesson_type)}>预定计划</option>
          <option value="actual" ${selectedV918("actual", item.lesson_type)}>实际结果</option>
        </select>
      </div>
      <div class="form-row">
        <label>上课日期</label>
        <input name="lesson_date" type="date" value="${aV918(item.lesson_date)}" required />
      </div>
      <div class="form-row">
        <label>归属月份</label>
        <input name="year_month" type="month" value="${aV918(item.year_month)}" required />
      </div>
      <div class="form-row teacher-settlement-month-field-v918">
        <label>工资结算月份</label>
        <input name="teacher_settlement_month" type="month" value="${aV918(item.teacher_settlement_month)}" />
      </div>
      <div class="form-row">
        <label>学生</label>
        <select name="student_id" required>${studentOptionsV918()}</select>
      </div>
      <div class="form-row">
        <label>老师</label>
        <select name="teacher_id" required>${teacherOptionsV918()}</select>
      </div>
      <div class="form-row">
        <label>科目</label>
        <select name="subject_id" required>${subjectOptionsV918()}</select>
      </div>
      <div class="form-row">
        <label>业务归属</label>
        <select name="business_entity_id" required>${businessOptionsV918()}</select>
      </div>
      <div class="form-row">
        <label>开始时间</label>
        <input name="start_time" type="time" value="${aV918(item.start_time)}" />
      </div>
      <div class="form-row">
        <label>结束时间</label>
        <input name="end_time" type="time" value="${aV918(item.end_time)}" />
      </div>
      <div class="form-row">
        <label>时长（H）</label>
        <input name="duration_hours" type="number" step="0.01" min="0" inputmode="decimal" value="${aV918(item.duration_hours)}" required />
      </div>
      <div class="form-row">
        <label>课程单价</label>
        <input name="unit_price" type="number" step="1" min="0" inputmode="numeric" value="${aV918(item.unit_price)}" />
      </div>
      <div class="form-row">
        <label>应收课时费</label>
        <input name="lesson_fee" type="number" step="1" min="0" inputmode="numeric" value="${aV918(item.lesson_fee)}" />
      </div>
      <div class="form-row lesson-count-field-v918">
        <label>回数</label>
        <input name="lesson_count" type="number" step="1" min="1" value="${aV918(item.lesson_count)}" />
      </div>
      <div class="form-row">
        <label>状态</label>
        <select name="status">${statusOptionsV918(item.lesson_type, item.status)}</select>
      </div>
      <div class="form-row">
        <label>计费</label>
        <select name="is_billable">
          <option value="true" ${selectedV918("true", String(item.is_billable !== false))}>是</option>
          <option value="false" ${selectedV918("false", String(item.is_billable !== false))}>否</option>
        </select>
      </div>
      <div class="form-row full">
        <label>上课内容</label>
        <textarea name="lesson_content">${hV918(item.lesson_content)}</textarea>
      </div>
      <div class="form-row full">
        <label>备注</label>
        <textarea name="note">${hV918(item.note)}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="secondary-btn" data-lesson-cancel>取消</button>
        <button type="submit" class="primary-btn">${mode === "edit" ? "保存" : "新增"}</button>
      </div>
    `;
  }

  function setSelectValueV918(form, name, value) {
    const select = form.querySelector(`[name="${name}"]`);
    if (select) select.value = value || "";
  }

  function applyInitialSelectValuesV918(form, record) {
    ["student_id", "teacher_id", "subject_id", "business_entity_id"].forEach(name => {
      setSelectValueV918(form, name, record?.[name] || "");
    });
  }

  function syncLessonStatusOptionsV918(form) {
    const type = form.querySelector('[name="lesson_type"]')?.value || "actual";
    const status = form.querySelector('[name="status"]');
    if (!status) return;
    const nextStatus = normalizeStatusV918(type, status.value || defaultStatusV918(type));
    status.innerHTML = statusOptionsV918(type, nextStatus);
    status.value = nextStatus;
  }

  function syncTeacherSettlementMonthV918(form) {
    const type = form.querySelector('[name="lesson_type"]')?.value || "actual";
    const row = form.querySelector(".teacher-settlement-month-field-v918");
    const input = form.querySelector('[name="teacher_settlement_month"]');
    if (row) row.classList.toggle("hidden", type !== "actual");
    if (type === "actual" && input && !input.value) {
      input.value = monthV918(form.querySelector('[name="lesson_date"]')?.value || form.querySelector('[name="year_month"]')?.value);
    }
  }

  function syncBillableDefaultV918(form, force = false) {
    const type = form.querySelector('[name="lesson_type"]')?.value || "actual";
    const status = form.querySelector('[name="status"]')?.value || defaultStatusV918(type);
    const billable = form.querySelector('[name="is_billable"]');
    if (!billable) return;
    if (type === "planned" || status === "cancelled") {
      billable.value = String(defaultBillableV918(type, status));
      return;
    }
    if (force || billable.dataset.manualEditedV918 !== "true") {
      billable.value = String(defaultBillableV918(type, status));
    }
  }

  function parseTimeToMinutesV918(value) {
    const m = String(value || "").match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
  }

  function bindLessonTimeCalcV918(form) {
    const start = form.querySelector('[name="start_time"]');
    const end = form.querySelector('[name="end_time"]');
    const duration = form.querySelector('[name="duration_hours"]');
    const unit = form.querySelector('[name="unit_price"]');
    const fee = form.querySelector('[name="lesson_fee"]');

    function updateFee() {
      if (!fee || fee.dataset.manualEditedV918 === "true") return;
      const hours = Number(duration?.value || 0);
      const price = Number(unit?.value || 0);
      if (hours && price) fee.value = String(Math.round(hours * price));
    }

    function updateDuration() {
      const s = parseTimeToMinutesV918(start?.value);
      const e = parseTimeToMinutesV918(end?.value);
      if (s === null || e === null || e <= s || !duration) return;
      if (duration.dataset.manualEditedV918 !== "true" || !duration.value) {
        const hours = Math.round(((e - s) / 60) * 100) / 100;
        duration.value = Number.isInteger(hours) ? String(hours) : String(hours);
        updateFee();
      }
    }

    [start, end].forEach(input => {
      input?.addEventListener("input", updateDuration);
      input?.addEventListener("change", updateDuration);
    });
    duration?.addEventListener("input", () => {
      duration.dataset.manualEditedV918 = "true";
      updateFee();
    });
    unit?.addEventListener("input", updateFee);
    fee?.addEventListener("input", () => {
      fee.dataset.manualEditedV918 = "true";
    });
  }

  function bindLessonFormEventsV918(form) {
    form.querySelector('[data-lesson-cancel]')?.addEventListener("click", () => closeModal());
    form.querySelector('[name="lesson_type"]')?.addEventListener("change", () => {
      syncLessonStatusOptionsV918(form);
      syncTeacherSettlementMonthV918(form);
      syncBillableDefaultV918(form, true);
    });
    form.querySelector('[name="status"]')?.addEventListener("change", () => {
      syncBillableDefaultV918(form);
    });
    form.querySelector('[name="is_billable"]')?.addEventListener("change", e => {
      e.target.dataset.manualEditedV918 = "true";
      syncBillableDefaultV918(form);
    });
    form.querySelector('[name="lesson_date"]')?.addEventListener("change", () => {
      const ym = form.querySelector('[name="year_month"]');
      const teacherMonth = form.querySelector('[name="teacher_settlement_month"]');
      if (ym && !ym.value) ym.value = monthV918(form.querySelector('[name="lesson_date"]')?.value);
      if (teacherMonth && teacherMonth.dataset.manualEditedV918 !== "true") {
        teacherMonth.value = monthV918(form.querySelector('[name="lesson_date"]')?.value);
      }
    });
    form.querySelector('[name="teacher_settlement_month"]')?.addEventListener("input", e => {
      e.target.dataset.manualEditedV918 = "true";
    });
    form.addEventListener("submit", submitLessonFormV918);
    bindLessonTimeCalcV918(form);
  }

  function openLessonModalV918(mode, record = {}) {
    const modal = document.getElementById("modal");
    const title = document.getElementById("modalTitle");
    const form = document.getElementById("modalForm");
    if (!modal || !form) return;

    state.editing = { type: "lesson", id: mode === "edit" ? record.id : null, data: record };
    form.onsubmit = null;
    form.innerHTML = lessonFormHtmlV918(record, mode);
    applyInitialSelectValuesV918(form, record);
    syncLessonStatusOptionsV918(form);
    syncTeacherSettlementMonthV918(form);
    syncBillableDefaultV918(form);
    bindLessonFormEventsV918(form);
    if (title) title.textContent = mode === "edit" ? "编辑课时" : (mode === "copy" ? "复制课时" : "新增课时");
    modal.classList.remove("hidden");
  }

  function openLessonCreateModalV918(prefill = {}) {
    openLessonModalV918("create", prefill);
  }

  function openLessonEditModalV918(id) {
    const record = rowByIdV918(state.lessonRecords || [], id);
    if (!record) {
      showMessage?.("未找到课时记录。", "error");
      return;
    }
    openLessonModalV918("edit", record);
  }

  function openLessonCopyModalV918(id) {
    const record = rowByIdV918(state.lessonRecords || [], id);
    if (!record) {
      showMessage?.("未找到课时记录。", "error");
      return;
    }
    const copy = { ...record, id: null };
    openLessonModalV918("copy", copy);
  }

  function openLessonActualFromPlannedModalV918(id) {
    const plan = rowByIdV918(state.lessonRecords || [], id);
    if (!plan) {
      showMessage?.("未找到预定课时。", "error");
      return;
    }
    const isMakeup = plan.status === "pending_makeup";
    const date = isMakeup ? todayV918() : (plan.lesson_date || todayV918());
    openLessonModalV918("create", {
      lesson_type: "actual",
      planned_lesson_id: plan.id,
      lesson_date: date,
      year_month: monthV918(date),
      student_id: plan.student_id || "",
      teacher_id: plan.teacher_id || "",
      subject_id: plan.subject_id || "",
      business_entity_id: plan.business_entity_id || "",
      start_time: plan.start_time || "",
      end_time: plan.end_time || "",
      duration_hours: plan.duration_hours || 0,
      unit_price: plan.unit_price || "",
      lesson_fee: plan.lesson_fee ?? "",
      status: isMakeup ? "makeup_completed" : "completed",
      is_billable: isMakeup ? false : plan.is_billable !== false,
      lesson_count: plan.lesson_count ?? "",
      lesson_content: "",
      note: "",
      teacher_settlement_month: monthV918(date),
    });
    const title = document.getElementById("modalTitle");
    if (title) title.textContent = "从预定生成实际课时";
  }

  function collectLessonFormPayloadV918(form) {
    console.log("[lesson-save] collect:start", { form });
    const fd = new FormData(form);
    console.log("[lesson-save] collect:form-data-created", Array.from(fd.entries()));
    const lessonType = String(fd.get("lesson_type") || "actual");
    const status = normalizeStatusV918(lessonType, fd.get("status"));
    const date = String(fd.get("lesson_date") || "");
    const payload = {
      lesson_type: lessonType,
      planned_lesson_id: fd.get("planned_lesson_id") || null,
      lesson_date: date || null,
      year_month: fd.get("year_month") || monthV918(date),
      student_id: fd.get("student_id") || null,
      teacher_id: fd.get("teacher_id") || null,
      subject_id: fd.get("subject_id") || null,
      business_entity_id: fd.get("business_entity_id") || null,
      start_time: fd.get("start_time") || null,
      end_time: fd.get("end_time") || null,
      duration_hours: numberOrNullV918(fd.get("duration_hours")) || 0,
      unit_price: numberOrNullV918(fd.get("unit_price")),
      lesson_fee: numberOrNullV918(fd.get("lesson_fee")),
      status,
      is_billable: String(fd.get("is_billable")) === "true",
      lesson_count: numberOrNullV918(fd.get("lesson_count")),
      lesson_content: fd.get("lesson_content") || null,
      note: fd.get("note") || null,
      teacher_settlement_month: fd.get("teacher_settlement_month") || null,
    };

    if (payload.lesson_type === "planned") {
      payload.status = normalizeStatusV918("planned", payload.status);
      payload.is_billable = true;
      payload.planned_lesson_id = null;
      payload.teacher_settlement_month = null;
    } else {
      payload.status = normalizeStatusV918("actual", payload.status);
      if (payload.status === "cancelled") payload.is_billable = false;
      if (!payload.teacher_settlement_month) payload.teacher_settlement_month = monthV918(payload.lesson_date);
    }

    if (!payload) console.warn("[lesson-save] collect returned empty payload", payload);
    console.log("[lesson-save] collect:return", {
      payload,
      required: {
        business_entity_id: payload.business_entity_id,
        student_id: payload.student_id,
        teacher_id: payload.teacher_id,
        subject_id: payload.subject_id,
        lesson_date: payload.lesson_date,
        year_month: payload.year_month,
      },
      rules: {
        lesson_type: payload.lesson_type,
        status: payload.status,
        is_billable: payload.is_billable,
        duration_hours: payload.duration_hours,
        duration_hours_type: typeof payload.duration_hours,
        lesson_fee: payload.lesson_fee,
        lesson_fee_type: typeof payload.lesson_fee,
      },
    });
    return payload;
  }

  function validateLessonPayloadV918(payload) {
    console.log("[lesson-save] validate:start", payload);
    if (!payload.lesson_date) {
      console.warn("[lesson-save] validate:failed", "请填写上课日期。");
      return "请填写上课日期。";
    }
    if (!payload.year_month) {
      console.warn("[lesson-save] validate:failed", "请填写归属月份。");
      return "请填写归属月份。";
    }
    if (!payload.student_id) {
      console.warn("[lesson-save] validate:failed", "请选择学生。");
      return "请选择学生。";
    }
    if (!payload.teacher_id) {
      console.warn("[lesson-save] validate:failed", "请选择老师。");
      return "请选择老师。";
    }
    if (!payload.subject_id) {
      console.warn("[lesson-save] validate:failed", "请选择科目。");
      return "请选择科目。";
    }
    if (!payload.business_entity_id) {
      console.warn("[lesson-save] validate:failed", "请选择业务归属。");
      return "请选择业务归属。";
    }
    if (!payload.duration_hours || payload.duration_hours <= 0) {
      console.warn("[lesson-save] validate:failed", "请填写有效时长。");
      return "请填写有效时长。";
    }
    if (payload.lesson_type === "planned" && !["planned", "pending_makeup"].includes(payload.status)) {
      console.warn("[lesson-save] validate:failed", "预定课时状态不合法。");
      return "预定课时状态不合法。";
    }
    if (payload.lesson_type === "actual" && !["completed", "cancelled", "makeup_completed", "makeup"].includes(payload.status)) {
      console.warn("[lesson-save] validate:failed", "实际课时状态不合法。");
      return "实际课时状态不合法。";
    }
    console.log("[lesson-save] validate:return", "");
    return "";
  }

  async function saveLessonRecordV918(payload, id) {
    console.log("[lesson-save] save:start", { id, payload });
    const client = typeof db !== "undefined" ? db : null;
    console.log("[lesson-save] save:client", { hasClient: !!client, hasFrom: !!client?.from });
    if (!client?.from) throw new Error("数据库客户端未初始化。");
    const tableName = lessonTableV918();
    console.log("[lesson-save] save:before-db", { tableName, action: id ? "update" : "insert", payload });
    const query = client.from(tableName);
    console.log("[lesson-save] save:query-created", query);
    const result = id
      ? await query.update(payload).eq("id", id).select().single()
      : await query.insert(payload).select().single();
    console.log("[lesson-save] save:db-result", { data: result.data, error: result.error });
    if (result.error) console.error("[lesson-save] save:supabase-error", result.error);
    console.log("[lesson-save] save:return", result);
    return result;
  }

  async function submitLessonFormV918(e) {
    console.log("[lesson-save] submit");
    console.log("[lesson-save] submit:start", { event: e, form: e?.currentTarget });
    let form = null;
    try {
      console.log("[lesson-save] before preventDefault");
      e.preventDefault();
      console.log("[lesson-save] before stopPropagation");
      e.stopPropagation();
      console.log("[lesson-save] before stopImmediatePropagation");
      e.stopImmediatePropagation();
      console.log("[lesson-save] after event guards");

      form = e.currentTarget;
      console.log("[lesson-save] form found", form);
      const mode = state.editing?.id ? "edit" : "create";
      console.log("[lesson-save] mode", mode);
      if (form.dataset.lessonSavingV918 === "true") {
        console.warn("[lesson-save] submit:already-saving");
        return;
      }
      console.log("[lesson-save] before collect");
      const payload = collectLessonFormPayloadV918(form);
      if (!payload) console.warn("[lesson-save] payload collected empty", payload);
      console.log("[lesson-save] payload collected", payload);
      console.log("[lesson-save] before validate");
      const validateResult = validateLessonPayloadV918(payload);
      console.log("[lesson-save] validate result", validateResult || "ok");
      if (validateResult) {
        console.warn("[lesson-save] submit:validate-failed", validateResult);
        showMessage?.(validateResult, "error");
        return;
      }

      form.dataset.lessonSavingV918 = "true";
      form.querySelector('button[type="submit"]')?.setAttribute("disabled", "disabled");

      const id = state.editing?.id || null;
      console.log("[lesson-save] before save");
      const result = await saveLessonRecordV918(payload, id);
      console.log("[lesson-save] save result", result);
      if (result.error) throw result.error;
      console.log("[lesson-save] before close modal");
      closeModal();
      console.log("[lesson-save] before refresh");
      console.log("[lesson-save] before loadAll");
      await loadAll();
      console.log("[lesson-save] before renderAll");
      renderAll();
      console.log("[lesson-save] done");
      showMessage?.(id ? "课时已更新。" : "课时已新增。", "ok");
    } catch (error) {
      console.error("[lesson-save] failed", error);
      showMessage?.(`保存课时失败：${error.message || error}`, "error");
      if (form) {
        form.dataset.lessonSavingV918 = "false";
        form.querySelector('button[type="submit"]')?.removeAttribute("disabled");
      }
    }
  }

  function bindLessonPageActionsV918() {
    document.getElementById("lessonAddBtn")?.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openLessonCreateModalV918();
    });

    document.addEventListener("click", e => {
      const createActual = e.target?.closest?.("[data-create-actual]");
      const copy = e.target?.closest?.("[data-copy-lesson]");
      const edit = e.target?.closest?.('[data-edit][data-type="lesson"]');

      if (createActual) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openLessonActualFromPlannedModalV918(createActual.dataset.createActual);
        return;
      }

      if (copy) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openLessonCopyModalV918(copy.dataset.copyLesson);
        return;
      }

      if (edit) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openLessonEditModalV918(edit.dataset.edit);
      }
    }, true);
  }

  document.addEventListener("DOMContentLoaded", bindLessonPageActionsV918);

  window.SchoolLessonsModule = window.SchoolLessonsModule || {};
  window.SchoolLessonsModule.openCreateModal = openLessonCreateModalV918;
  window.SchoolLessonsModule.openEditModal = openLessonEditModalV918;
  window.SchoolLessonsModule.openCopyModal = openLessonCopyModalV918;
  window.SchoolLessonsModule.openActualFromPlannedModal = openLessonActualFromPlannedModalV918;
  window.SchoolLessonsModule.collectPayload = collectLessonFormPayloadV918;
  window.SchoolLessonsModule.saveLessonRecord = saveLessonRecordV918;
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
      const dateText = item && typeof lessonDateDisplayV86 === "function" ? lessonDateDisplayV86(item) : null;
      const mainText = dateText?.main || item?.lesson_date || item?.created_at || "";
      const subText = dateText?.sub || item?.year_month || "";
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

  function removeLessonDateTimeRowsV917() {
    document
      .querySelectorAll("#page-lessons #lessonsTable .col-date .actual-time-v887, #page-lessons #lessonsTable .col-date .actual-time-v888")
      .forEach(node => node.remove());
  }

  const renderLessonsBeforeV917 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV917) {
    window.renderLessons = function () {
      if (typeof renderLessonRowsStrictV873 === "function") renderLessonRowsStrictV873 = renderLessonRowsV917;
      renderLessonsBeforeV917();
      patchLessonListCountV917();
      removeLessonDateTimeRowsV917();
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      patchLessonListCountV917();
      removeLessonDateTimeRowsV917();
    }, 1000);
  });

  window.patchActualTimeDisplayV887 = removeLessonDateTimeRowsV917;
  window.patchActualTimeDisplayV888 = removeLessonDateTimeRowsV917;
  window.lessonCellV86 = lessonCellV917;
  window.lessonPairCells = lessonCellV917;
  window.renderLessonRowsStrictV873 = renderLessonRowsV917;
  window.SchoolLessonsModule = window.SchoolLessonsModule || {};
  window.SchoolLessonsModule.lessonCell = lessonCellV917;
  window.SchoolLessonsModule.renderLessonRows = renderLessonRowsV917;
  window.SchoolLessonsModule.patchLessonListCount = patchLessonListCountV917;
  window.SchoolLessonsModule.removeLessonDateTimeRows = removeLessonDateTimeRowsV917;
})();
