// === v9.0 lesson-import.js ===
// 完整课时导入模块边界。后续 Excel 读取、回数、计费、实际分钟数逻辑迁移到这里。
window.SchoolModules = window.SchoolModules || {};
window.SchoolModules["lesson-import.js"] = { version: "9.0", migrated: false };




// 导入完整课时功能
async function importCompletedLessonExcel(file) {
  if (!lessonExcelRequireXLSX()) return;

  const importedStudents = new Map();
  const errors = [];
  const warnings = [];

  const batchId = typeof newImportBatchIdV871 === "function" ? newImportBatchIdV871() : `completed_import_${Date.now()}`;
  const importedAt = new Date().toISOString();

  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

  const hi = findLessonPairHeaderRowV920(rows);
  if (hi < 0) {
    showMessage("没有找到完整课时模板表头。请确认包含学生姓名、预定日期、实际日期、预定状态、实际状态等列。", "error");
    return;
  }

  const col = buildLessonPairColumnMapV920(rows[hi]);
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
    const rowNo = r + 1;
    const plannedHasData = lessonImportSideHasDataV920(row, col.plannedSide);
    const actualHasData = lessonImportSideHasDataV920(row, col.actualSide);
    if (!plannedHasData && !actualHasData) {
      skipped++;
      continue;
    }

    const studentCell = readImportCellV920(row, col.student);
    const student = studentFromExcelNameV9810(studentCell);

    if (!student) {
      addImportErrorV920(errors, rowNo, "学生姓名", studentCell, "未能在学生列表中识别该学生。");
      continue;
    }

    const studentId = student.id;
    const studentName = student.display_name || student.name || "";
    const businessCell = readImportCellV920(row, col.businessEntity);
    const businessEntityId = businessEntityIdFromExcelNameV920(businessCell) || student.business_entity_id || state.businessEntities?.[0]?.id || null;
    if (businessCell && !businessEntityIdFromExcelNameV920(businessCell)) {
      addImportErrorV920(errors, rowNo, "业务归属", businessCell, "未能在业务归属列表中识别。");
      continue;
    }
    importedStudents.set(studentId, studentName);
    const teacherCell = readImportCellV920(row, col.teacher);
    const subjectCell = readImportCellV920(row, col.subject);
    if (teacherCell) curT = teacherCell;
    if (subjectCell) curS = subjectCell;
    const subjectId = subjectIdFromExcelName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromExcelName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

    if (!teacherId) addImportErrorV920(errors, rowNo, "担当老师", teacherCell, "未能在老师列表中识别。");
    if (!subjectId) addImportErrorV920(errors, rowNo, "科目", subjectCell, "未能在科目列表中识别。");
    if (!teacherId || !subjectId) {
      continue;
    }

    const baseNote = `完整课时导入：${sheetName}`;
    const yearMonth = readImportCellV920(row, col.yearMonth);
    const commonBase = {
      student_id: studentId,
      teacher_id: teacherId,
      subject_id: subjectId,
      business_entity_id: businessEntityId,
      import_batch_id: batchId,
      import_source: file.name || sheetName,
      imported_at: importedAt,
    };

    let plannedId = "";
    if (plannedHasData) {
      const planned = buildPlannedImportRecordV920({ row, rowNo, col, baseYear, yearMonth, commonBase, baseNote, errors, warnings });
      if (planned) {
        plannedId = planned.id;
        records.push(planned);
      }
    }

    if (actualHasData) {
      const actual = buildActualImportRecordV920({ row, rowNo, col, baseYear, yearMonth, commonBase, baseNote, generatedPlannedId: plannedId, errors, warnings });
      if (actual) {
        if (!actual.planned_lesson_id && plannedId) actual.planned_lesson_id = plannedId;
        records.push(actual);
      } else {
        actualSkipped++;
      }
    } else {
      actualSkipped++;
    }
  }

  if (errors.length) {
    showMessage(`导入校验失败：发现 ${errors.length} 个错误，请修正后重新导入。\n${errors.slice(0, 8).join("\n")}${errors.length > 8 ? "\n..." : ""}`, "error");
    console.error("[lesson-import] validation errors", errors);
    if (warnings.length) console.warn("[lesson-import] validation warnings", warnings);
    return;
  }

  if (!records.length) {
    showMessage("没有读取到可导入的完整课时记录。", "error");
    return;
  }

  const plannedCount = records.filter(x => x.lesson_type === "planned").length;
  const actualCount = records.filter(x => x.lesson_type === "actual").length;
  const total = records.filter(x => x.lesson_type === "actual").reduce((s, x) => s + Number(x.lesson_fee || 0), 0);
  const warningText = warnings.length ? `\n自动修正规则：${warnings.length} 条\n${warnings.slice(0, 5).join("\n")}${warnings.length > 5 ? "\n..." : ""}` : "";
  const studentNameText = Array.from(importedStudents.values()).filter(Boolean).join("、") || "自动识别";
  const firstStudentId = Array.from(importedStudents.keys())[0] || "";
  const ok = confirm(`即将导入完整课时记录：\n\n学生：${studentNameText}\n文件：${file.name}\n预定课时：${plannedCount} 条\n实际课时：${actualCount} 条\n实际课时费合计：${total.toLocaleString()} JPY\n跳过行数：${skipped}\n未生成实际课时：${actualSkipped} 条${warningText}\n\n确认导入吗？`);
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
  showMessage(`已导入完整课时记录：预定 ${plannedCount} 条 / 实际 ${actualCount} 条。${warnings.length ? ` 自动修正 ${warnings.length} 条。` : ""}`, "ok");
}

function buildPlannedImportRecordV920({ row, rowNo, col, baseYear, yearMonth, commonBase, baseNote, errors, warnings }) {
  const plannedDate = parseImportDateV920(row, col.plannedDate, baseYear, rowNo, "预定日期", errors);
  const duration = parseImportNumberV920(row, col.plannedDuration, rowNo, "预定课时时长", errors, true);
  const unit = parseImportNumberV920(row, col.plannedUnitPrice, rowNo, "预定单价", errors, false);
  const fee = parseImportFeeV920(row, col.plannedFee, duration, unit, rowNo, "预定课时费", errors);
  const statusRaw = readImportCellV920(row, col.plannedStatus);
  const status = normalizePlannedStatusV920(statusRaw);
  const billableRaw = readImportCellV920(row, col.plannedBillable);
  const plannedDateRaw = readImportCellRawV920(row, col.plannedDate);
  const count = normalizeLessonCountV886(readImportCellRawV920(row, col.plannedCount));

  if (!plannedDate && !String(plannedDateRaw ?? "").trim()) addImportErrorV920(errors, rowNo, "预定日期", plannedDateRaw, "必须填写预定日期。");
  if (!duration) addImportErrorV920(errors, rowNo, "预定课时时长", readImportCellRawV920(row, col.plannedDuration), "必须填写可转换为数字且大于 0 的课时时长。");
  if (!status) addImportErrorV920(errors, rowNo, "预定状态", statusRaw, "预定课时只允许“待上课 / 待补课”。");
  if (billableRaw && !isBillableYesV920(billableRaw)) {
    warnings.push(`第${rowNo}行 预定计费：原始值“${billableRaw}”已自动改为“是”。`);
  }
  if (!plannedDate || !duration || !status) return null;

  return {
    id: crypto.randomUUID(),
    ...commonBase,
    lesson_type: "planned",
    planned_lesson_id: null,
    lesson_date: plannedDate,
    year_month: yearMonth || plannedDate.slice(0, 7),
    start_time: parseImportTimeV920(row, col.plannedStart),
    end_time: parseImportTimeV920(row, col.plannedEnd),
    duration_hours: duration,
    unit_price: unit || 0,
    lesson_fee: fee,
    lesson_count: count,
    status,
    is_billable: true,
    lesson_content: "",
    note: mergeImportNoteV920(baseNote, readImportCellV920(row, col.plannedNote)),
    actual_minutes: null,
  };
}

function buildActualImportRecordV920({ row, rowNo, col, baseYear, yearMonth, commonBase, baseNote, generatedPlannedId, errors, warnings }) {
  const actualDate = parseImportDateV920(row, col.actualDate, baseYear, rowNo, "实际日期", errors);
  const duration = parseImportNumberV920(row, col.actualDuration, rowNo, "实际课时时长", errors, true);
  const unit = parseImportNumberV920(row, col.plannedUnitPrice, rowNo, "预定单价", errors, false);
  const fee = parseImportFeeV920(row, col.actualFee, duration, unit, rowNo, "实际课时费", errors);
  const statusRaw = readImportCellV920(row, col.actualStatus);
  const status = normalizeActualStatusV920(statusRaw);
  const billableRaw = readImportCellV920(row, col.actualBillable);
  const billableRecognized = !billableRaw || isRecognizedBillableV920(billableRaw);
  const actualDateRaw = readImportCellRawV920(row, col.actualDate);
  const start = parseImportTimeV920(row, col.actualStart);
  const end = parseImportTimeV920(row, col.actualEnd);
  const actualMinutes = typeof minutesBetweenV887 === "function" ? minutesBetweenV887(start, end) : null;

  if (!actualDate && !String(actualDateRaw ?? "").trim()) addImportErrorV920(errors, rowNo, "实际日期", actualDateRaw, "必须填写实际日期。");
  if (!duration) addImportErrorV920(errors, rowNo, "实际课时时长", readImportCellRawV920(row, col.actualDuration), "必须填写可转换为数字且大于 0 的课时时长。");
  if (!status) addImportErrorV920(errors, rowNo, "实际状态", statusRaw, "实际课时只允许“已上课 / 取消课 / 已补课”。");
  if (!billableRecognized) addImportErrorV920(errors, rowNo, "实际计费", billableRaw, "实际计费只允许“是 / 否”。");
  if (!actualDate || !duration || !status || !billableRecognized) return null;

  let billable = false;
  if (status === "completed") {
    billable = true;
    if (billableRaw && !isBillableYesV920(billableRaw)) warnings.push(`第${rowNo}行 实际计费：已上课必须计费，原始值“${billableRaw}”已自动改为“是”。`);
  } else if (status === "cancelled") {
    billable = false;
    if (billableRaw && isBillableYesV920(billableRaw)) warnings.push(`第${rowNo}行 实际计费：取消课必须不计费，原始值“${billableRaw}”已自动改为“否”。`);
  } else if (status === "makeup_completed") {
    billable = billableRaw ? isBillableYesV920(billableRaw) : false;
  }

  return {
    id: crypto.randomUUID(),
    ...commonBase,
    lesson_type: "actual",
    planned_lesson_id: generatedPlannedId || existingPlannedIdFromAssociationV920(readImportCellV920(row, col.association)),
    lesson_date: actualDate,
    year_month: yearMonth || actualDate.slice(0, 7),
    start_time: start || "",
    end_time: end || "",
    duration_hours: duration,
    unit_price: unit || 0,
    lesson_fee: fee,
    lesson_count: null,
    status,
    is_billable: billable,
    lesson_content: readImportCellV920(row, col.actualContent),
    note: mergeImportNoteV920(baseNote, readImportCellV920(row, col.actualNote)),
    actual_minutes: actualMinutes,
  };
}

function findLessonPairHeaderRowV920(rows) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const text = (rows[i] || []).map(txImportV920).join("|");
    if (/学生姓名/.test(text) && /预定日期/.test(text) && /实际日期/.test(text) && /预定状态/.test(text) && /实际状态/.test(text)) return i;
  }
  return typeof findHeader88 === "function" ? findHeader88(rows) : -1;
}

function buildLessonPairColumnMapV920(header) {
  const map = {};
  (header || []).forEach((cell, index) => {
    const key = txImportV920(cell);
    if (!key) return;
    const set = name => { if (map[name] === undefined) map[name] = index; };
    if (/^学生姓名$|^学生$|^生徒$/.test(key)) set("student");
    if (/^担当老师$|^老师$|^教師$|^先生$/.test(key)) set("teacher");
    if (/^科目$|^课程$|^講座$/.test(key)) set("subject");
    if (/^业务归属$/.test(key)) set("businessEntity");
    if (/^归属月份$|^年月$|^月份$/.test(key)) set("yearMonth");
    if (/^预定日期$/.test(key)) set("plannedDate");
    if (/^预定第几回$|^预定回数$|^回数$/.test(key)) set("plannedCount");
    if (/^预定开始时间$/.test(key)) set("plannedStart");
    if (/^预定结束时间$/.test(key)) set("plannedEnd");
    if (/^预定课时时长$/.test(key)) set("plannedDuration");
    if (/^预定单价$|^课程单价$|^单价$/.test(key)) set("plannedUnitPrice");
    if (/^预定课时费$|^应收课时费$/.test(key)) set("plannedFee");
    if (/^预定状态$/.test(key)) set("plannedStatus");
    if (/^预定计费$/.test(key)) set("plannedBillable");
    if (/^预定备注$/.test(key)) set("plannedNote");
    if (/^实际日期$/.test(key)) set("actualDate");
    if (/^实际开始时间$/.test(key)) set("actualStart");
    if (/^实际结束时间$/.test(key)) set("actualEnd");
    if (/^实际课时时长$/.test(key)) set("actualDuration");
    if (/^实际状态$/.test(key)) set("actualStatus");
    if (/^实际计费$/.test(key)) set("actualBillable");
    if (/^实际课时费$/.test(key)) set("actualFee");
    if (/^上课内容及作业$|^实际内容$|^上课内容$/.test(key)) set("actualContent");
    if (/^实际备注$/.test(key)) set("actualNote");
    if (/^关联标识$/.test(key)) set("association");
  });

  const legacy = typeof headerMap88 === "function" ? headerMap88(header) : {};
  return {
    student: map.student ?? legacy.student,
    teacher: map.teacher ?? legacy.teacher,
    subject: map.subject ?? legacy.subject,
    businessEntity: map.businessEntity,
    yearMonth: map.yearMonth,
    plannedDate: map.plannedDate ?? legacy.plannedDate,
    plannedCount: map.plannedCount ?? legacy.count,
    plannedStart: map.plannedStart ?? legacy.start,
    plannedEnd: map.plannedEnd ?? legacy.end,
    plannedDuration: map.plannedDuration ?? legacy.duration,
    plannedUnitPrice: map.plannedUnitPrice ?? legacy.unitPrice,
    plannedFee: map.plannedFee ?? legacy.lessonFee,
    plannedStatus: map.plannedStatus ?? legacy.status,
    plannedBillable: map.plannedBillable ?? legacy.billable,
    plannedNote: map.plannedNote ?? legacy.note,
    actualDate: map.actualDate ?? legacy.actualDate,
    actualStart: map.actualStart ?? legacy.start,
    actualEnd: map.actualEnd ?? legacy.end,
    actualDuration: map.actualDuration ?? legacy.duration,
    actualStatus: map.actualStatus ?? legacy.status,
    actualBillable: map.actualBillable ?? legacy.billable,
    actualFee: map.actualFee ?? legacy.lessonFee,
    actualContent: map.actualContent ?? legacy.actualContent ?? legacy.content,
    actualNote: map.actualNote ?? legacy.note,
    association: map.association,
    plannedSide: [map.plannedDate, map.plannedCount, map.plannedStart, map.plannedEnd, map.plannedDuration, map.plannedUnitPrice, map.plannedFee, map.plannedStatus, map.plannedBillable, map.plannedNote],
    actualSide: [map.actualDate, map.actualStart, map.actualEnd, map.actualDuration, map.actualStatus, map.actualBillable, map.actualFee, map.actualContent, map.actualNote, map.association],
  };
}

function lessonImportSideHasDataV920(row, cols) {
  return (cols || []).some(index => index !== undefined && String(row[index] ?? "").trim() !== "");
}

function txImportV920(value) {
  return String(value || "").trim().replace(/\s+/g, "");
}

function readImportCellRawV920(row, index) {
  return index === undefined ? "" : row[index];
}

function readImportCellV920(row, index) {
  const value = readImportCellRawV920(row, index);
  if (value instanceof Date) return formatDateYmd(value);
  return String(value ?? "").trim();
}

function parseImportDateV920(row, index, baseYear, rowNo, field, errors) {
  const raw = readImportCellRawV920(row, index);
  const date = dt88(raw, baseYear);
  if (!date && String(raw ?? "").trim()) addImportErrorV920(errors, rowNo, field, raw, "无法转换为日期。");
  return date;
}

function parseImportTimeV920(row, index) {
  if (index === undefined) return "";
  return typeof cleanTimeForDisplayV888 === "function" ? cleanTimeForDisplayV888(row[index]) : String(row[index] || "").trim();
}

function parseImportNumberV920(row, index, rowNo, field, errors, required) {
  const raw = readImportCellRawV920(row, index);
  const text = String(raw ?? "").trim();
  if (!text && !required) return 0;
  if (!text && required) return 0;
  const n = typeof raw === "number" ? raw : Number(text.replace(/[,，円￥¥小时時間HhＨ]/g, ""));
  if (!Number.isFinite(n)) {
    addImportErrorV920(errors, rowNo, field, raw, "无法转换为数字。");
    return 0;
  }
  return n;
}

function parseImportFeeV920(row, index, duration, unit, rowNo, field, errors) {
  const raw = readImportCellRawV920(row, index);
  const text = String(raw ?? "").trim();
  if (text) return parseImportNumberV920(row, index, rowNo, field, errors, false);
  return duration && unit ? Math.round(Number(duration) * Number(unit)) : 0;
}

function normalizePlannedStatusV920(value) {
  const text = txImportV920(value).toLowerCase();
  if (!text) return "";
  if (text === "planned" || /待上课|待上|预定|予定/.test(text)) return "planned";
  if (text === "pending_makeup" || /待补课|待补|未补/.test(text)) return "pending_makeup";
  return "";
}

function normalizeActualStatusV920(value) {
  const text = txImportV920(value).toLowerCase();
  if (!text) return "";
  if (text === "completed" || /已上课|已上|上课済|済/.test(text)) return "completed";
  if (text === "cancelled" || /取消课|取消|请假|休|放假/.test(text)) return "cancelled";
  if (text === "makeup_completed" || text === "makeup" || /已补课|已补|補完|补课完成/.test(text)) return "makeup_completed";
  return "";
}

function isBillableYesV920(value) {
  const text = txImportV920(value).toLowerCase();
  return /^(是|要|计费|收費|收费|yes|true|1)$/.test(text);
}

function isBillableNoV920(value) {
  const text = txImportV920(value).toLowerCase();
  return /^(否|不|不计费|不收費|不收费|no|false|0)$/.test(text);
}

function isRecognizedBillableV920(value) {
  return isBillableYesV920(value) || isBillableNoV920(value);
}

function businessEntityIdFromExcelNameV920(name) {
  const text = txImportV920(name).toLowerCase();
  if (!text) return "";
  const matched = (state.businessEntities || []).find(item => {
    const nameText = txImportV920(item.name).toLowerCase();
    const codeText = txImportV920(item.code).toLowerCase();
    return (nameText && (nameText === text || nameText.includes(text) || text.includes(nameText))) ||
      (codeText && (codeText === text || codeText.includes(text) || text.includes(codeText)));
  });
  return matched?.id || "";
}

function existingPlannedIdFromAssociationV920(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const row = (state.lessonRecords || []).find(item => item.lesson_type === "planned" && String(item.id) === text);
  return row?.id || null;
}

function mergeImportNoteV920(baseNote, note) {
  return [String(note || "").trim(), baseNote].filter(Boolean).join(" / ");
}

function addImportErrorV920(errors, rowNo, field, value, reason) {
  errors.push(`第${rowNo}行【${field}】原始值“${String(value ?? "")}”：${reason}`);
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
    // 旧完整课时导入包装逻辑已废弃。
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
