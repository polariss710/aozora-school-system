// === v9.0 lesson-import.js ===
// 完整课时导入模块边界。后续 Excel 读取、回数、计费、实际分钟数逻辑迁移到这里。
window.SchoolModules = window.SchoolModules || {};
window.SchoolModules["lesson-import.js"] = { version: "9.0", migrated: false };




// 导入完整课时功能
async function importCompletedLessonExcel(file) {
  if (!lessonExcelRequireXLSX()) return;

  const importedStudents = new Map();
  const missingStudents = new Set();

  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findHeader88(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含科目、日期、回数、时长、单价等列。", "error");
    return;
  }

  const col = headerMap88(rows[hi]);
  const records = [];
  let curT = "";
  let curS = "";
  let skipped = 0;
  let actualSkipped = 0;
  const baseYear = Number(document.getElementById("lessonMonthFilter")?.value?.slice(0, 4) || new Date().getFullYear());

  for (let r = hi + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const line = row.map(x => String(x || "").trim()).join("");
    if (!line || /合计|总计|總計|小计|小計/.test(line)) continue;
    const studentCell = String((col.student !== undefined ? row[col.student] : row[0]) || "").trim();
    const student = studentFromExcelNameV9810(studentCell);

    if (!student) {
      if (studentCell) missingStudents.add(studentCell);
      skipped++;
      continue;
    }

    const studentId = student.id;
    const studentName = student.display_name || student.name || "";
    const businessEntityId = student.business_entity_id || state.businessEntities?.[0]?.id || null;
    importedStudents.set(studentId, studentName);
    const teacherCell = col.teacher !== undefined ? String(row[col.teacher] || "").trim() : "";
    const subjectCell = col.subject !== undefined ? String(row[col.subject] || "").trim() : "";
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;

    const plannedDate = dt88(col.plannedDate !== undefined ? row[col.plannedDate] : row[col.actualDate], baseYear);
    const rawActualDate = col.actualDate !== undefined ? row[col.actualDate] : "";
    const actualDate = dt88(rawActualDate, baseYear);

    const duration = num88(col.duration !== undefined ? row[col.duration] : "");
    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!plannedDate || !duration || !subjectId || !teacherId) {
      skipped++;
      continue;
    }

    const tr = timeRange88(col.timeRange !== undefined ? row[col.timeRange] : "");
    const start = col.start !== undefined ? cleanTimeForDisplayV888(row[col.start]) : tr.start;
    const end = col.end !== undefined ? cleanTimeForDisplayV888(row[col.end]) : tr.end;
    const actualMinutes = typeof minutesBetweenV887 === "function" ? minutesBetweenV887(start, end) : null;
    const actualDuration = actualMinutes ? hoursFromMinutesExactV887(actualMinutes) : duration;

    const unit = num88(col.unitPrice !== undefined ? row[col.unitPrice] : "");
    const plannedFee = num88(col.lessonFee !== undefined ? row[col.lessonFee] : "") || (unit && duration ? unit * duration : 0);
    const actualFee = unit && actualDuration ? Math.round(unit * actualDuration) : plannedFee;

    const plannedContent = String((col.plannedContent !== undefined ? row[col.plannedContent] : row[col.content]) || "");
    const actualContent = String((col.actualContent !== undefined ? row[col.actualContent] : row[col.content]) || "");
    const count = normalizeLessonCountV886(col.count !== undefined ? row[col.count] : null);
    const normalNote = String(col.note !== undefined ? row[col.note] || "" : "");
    const salaryNote = String(col.salaryNote !== undefined ? row[col.salaryNote] || "" : "");
    const status = normalizeLessonStatusTextV8810(col.status !== undefined ? row[col.status] : "");
    const explicitBillable = col.billable !== undefined ? row[col.billable] : "";
    const billable = parseBillableTextV8810(explicitBillable, defaultBillableByStatusV8810(status || "completed"));

    const plannedId = crypto.randomUUID();
    const actualId = crypto.randomUUID();
    const plannedYm = plannedDate.slice(0, 7);
    const baseNote = `完整课时导入：${sheetName}`;
    const mergedNote = buildCompletedLessonNoteV885(baseNote, "", normalNote, salaryNote);

    const common = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      start_time: start || "",
      end_time: end || "",
      unit_price: unit || 0,
      lesson_count: count,
      is_billable: billable,
      note: mergedNote,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    records.push({
      id: plannedId,
      lesson_type: "planned",
      lesson_date: plannedDate,
      year_month: plannedYm,
      lesson_content: plannedContent,
      status: status || "completed",
      planned_lesson_id: null,
      duration_hours: duration,
      lesson_fee: plannedFee || 0,
      actual_minutes: null,
      ...common,
    });

    const shouldCreateActual =
      actualDate &&
      status !== "pending_makeup" &&
      status !== "cancelled" &&
      (!status || status === "completed" || status === "makeup_completed");

    if (shouldCreateActual) {
      records.push({
        id: actualId,
        lesson_type: "actual",
        planned_lesson_id: plannedId,
        lesson_date: actualDate,
        year_month: plannedYm,
        lesson_content: actualContent,
        status: status || "completed",
        duration_hours: actualDuration || duration,
        lesson_fee: actualFee || 0,
        actual_minutes: actualMinutes,
        ...common,
      });
    } else {
      actualSkipped++;
    }
  }

  if (!records.length) {
    const extra = missingStudents.size ? ` 未识别学生：${Array.from(missingStudents).join("、")}` : "";
    showMessage(`没有读取到可导入的完整课时记录。${extra}`, "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);
  const billableCount = records.filter(x => x.lesson_type === "planned" && x.is_billable !== false).length;
  const nonBillableCount = records.filter(x => x.lesson_type === "planned" && x.is_billable === false).length;
  const studentNameText = Array.from(importedStudents.values()).filter(Boolean).join("、") || "自动识别";
  const firstStudentId = Array.from(importedStudents.keys())[0] || "";
  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentNameText}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n计费预定：${billableCount} 条\n不计费预定：${nonBillableCount} 条\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条\n\n确认导入吗？`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  const { error } = await client.from(tables.lessons).insert(records);
  if (error) {
    showMessage(`导入失败：${error.message}`, "error");
    return;
  }

  if (typeof saveLastImportBatchV871 === "function") {
    saveLastImportBatchV871({
      batchId,
      studentId: firstStudentId,
      studentName: studentNameText,
      fileName: file.name,
      count: records.length,
      importedAt
    });
  }

  await loadAll();
  renderAll();
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。`, "ok");
}

//辅助函数1
function normalizePersonNameV9810(value) {
  return String(value || "")
    .replace(/（.*?）|\(.*?\)|\/.*$/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

//辅助函数2
function studentFromExcelNameV9810(name) {
  const text = normalizePersonNameV9810(name);
  if (!text || /学生|姓名|生徒/.test(text)) return null;
  return (state.students || []).find(s => {
    const n1 = normalizePersonNameV9810(s.name);
    const n2 = normalizePersonNameV9810(s.display_name);
    const n3 = normalizePersonNameV9810(s.full_name);
    return (n1 && (n1 === text || n1.includes(text) || text.includes(n1))) ||
      (n2 && (n2 === text || n2.includes(text) || text.includes(n2))) ||
      (n3 && (n3 === text || n3.includes(text) || text.includes(n3)));
  }) || null;
}

// === v9.1.6 import teacher settlement month ===
// 完整课时导入读取“工资结算月份”列。
// 支持：2026.4 / 2026.04 / 2026-04 / 2026/04 / 2026年4月。
// 只写入实际课时的 teacher_settlement_month；预定课时不写入。
function normalizeTeacherSettlementMonthV916(value) {
  if (value === null || value === undefined || value === "") return "";

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const text = String(value);
    const m = text.match(/^(\d{4})(?:\.(\d{1,2}))?$/);
    if (m) {
      const month = String(Number(m[2] || "1")).padStart(2, "0");
      return `${m[1]}-${month}`;
    }
  }

  const text = String(value).trim();
  if (!text) return "";

  let m = text.match(/^(\d{4})[.\-/年](\d{1,2})月?$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, "0")}`;

  m = text.match(/^(\d{4})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}`;

  return "";
}

window.normalizeTeacherSettlementMonthV916 = normalizeTeacherSettlementMonthV916;



// === v9.1.7 require month before completed lesson import ===
// 完整课时导入必须先选择课时管理顶部月份。
// 页面月份主要用于给“3.2周 / 3.30周 / 4.1”这类模板日期提供年份。
// 例：导入 2026年3月模板时，请先选择 2026-03。

(function () {
  function selectedImportMonthV917() {
    return document.getElementById("lessonMonthFilter")?.value || "";
  }

  function requireCompletedImportMonthV917() {
    const month = selectedImportMonthV917();
    if (!month) {
      showMessage("请先选择导入模板对应的年月。例如导入 2026年3月课时，请先选择 2026-03。", "error");
      return "";
    }
    return month;
  }

  function confirmImportMonthV917(month) {
    return true;
  }

  function patchCompletedImportButtonV917() {
    const btn = document.getElementById("lessonImportCompletedExcelBtnV88");
    const input = document.getElementById("lessonImportCompletedExcelInputV88");
    if (!btn || !input || btn.dataset.boundMonthRequiredV917 === "true") return;

    btn.dataset.boundMonthRequiredV917 = "true";
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("title");
    btn.removeAttribute("aria-disabled");
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("title");
    btn.removeAttribute("aria-disabled");
    btn.onclick = () => {
      input.click();
    };
  }

  function wrapCompletedImportFunctionV917(name) {
    // v9.8-final.14: no month/student restriction wrapper for completed import.
  }

  function applyCompletedImportMonthRequiredV917() {
    patchCompletedImportButtonV917();

    [
      "importCompletedLessonExcelV88",
      "importCompletedLessonExcelV884",
      "importCompletedLessonExcelV885",
      "importCompletedLessonExcelV886"
    ].forEach(wrapCompletedImportFunctionV917);
  }

  const ensureBeforeV917 = typeof ensureCompletedImportButtonV884 === "function"
    ? ensureCompletedImportButtonV884
    : (typeof ensureCompletedImportButtonV88 === "function" ? ensureCompletedImportButtonV88 : null);

  if (ensureBeforeV917) {
    window.ensureCompletedImportButtonV884 = function () {
      ensureBeforeV917();
      setTimeout(applyCompletedImportMonthRequiredV917, 0);
    };
  }

  const switchPageBeforeV917 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV917) {
    window.switchPage = function (page) {
      switchPageBeforeV917(page);
      if (page === "lessons") setTimeout(applyCompletedImportMonthRequiredV917, 0);
    };
  }

  const renderAllBeforeV917 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV917) {
    window.renderAll = function () {
      renderAllBeforeV917();
      if (document.getElementById("page-lessons")?.classList.contains("active")) {
        setTimeout(applyCompletedImportMonthRequiredV917, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(applyCompletedImportMonthRequiredV917, 1000);
  });

  window.CompletedImportMonthRequiredV917 = {
    selectedMonth: selectedImportMonthV917,
    requireMonth: requireCompletedImportMonthV917,
    apply: applyCompletedImportMonthRequiredV917,
  };
})();

