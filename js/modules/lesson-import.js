// === v9.0 lesson-import.js ===
// 完整课时导入模块边界。后续 Excel 读取、回数、计费、实际分钟数逻辑迁移到这里。
window.SchoolModules = window.SchoolModules || {};
window.SchoolModules["lesson-import.js"] = { version: "9.0", migrated: false };

function requireXlsxForLessonImport() {
  if (typeof XLSX === "undefined") {
    showMessage("Excel 功能库尚未加载，请刷新页面后再试。", "error");
    return false;
  }
  return true;
}

function formatImportDateYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function createLessonImportBatchId() {
  return `lesson_import_${new Date().toISOString().replace(/[-:.TZ]/g, "")}_${Math.random().toString(36).slice(2, 8)}`;
}

function saveLastLessonImportBatch(info) {
  localStorage.setItem("lastLessonImportBatchV871", JSON.stringify(info));
  updateUndoLessonImportButton();
}

function lastLessonImportBatch() {
  try {
    return JSON.parse(localStorage.getItem("lastLessonImportBatchV871") || "null");
  } catch {
    return null;
  }
}

function ensureLessonImportUndoPanel() {
  const page = document.getElementById("page-lessons") || document.querySelector("[data-page='lessons']");
  if (!page || page.querySelector("#undoLastLessonImportV871")) return;
  const toolbar = page.querySelector(".section-title-row") || page;
  toolbar.insertAdjacentHTML("beforeend", `
    <button class="secondary-btn" id="undoLastLessonImportV871" style="display:none;">撤回本次导入</button>
  `);
  document.getElementById("undoLastLessonImportV871")?.addEventListener("click", undoLastLessonImport);
}

function updateUndoLessonImportButton() {
  const btn = document.getElementById("undoLastLessonImportV871");
  if (!btn) return;
  const info = lastLessonImportBatch();
  if (info?.batchId) {
    btn.style.display = "";
    btn.textContent = `撤回本次导入（${info.count || 0}条）`;
  } else {
    btn.style.display = "none";
  }
}

async function undoLastLessonImport() {
  const info = lastLessonImportBatch();
  if (!info?.batchId) {
    showMessage("没有可撤回的导入批次。", "error");
    return;
  }

  const ok = confirm(`确认撤回本次导入吗？\n学生：${info.studentName || ""}\n文件：${info.fileName || ""}\n记录数：${info.count || 0}\n\n撤回后会删除该批次导入的课时记录。`);
  if (!ok) return;

  const client = (typeof db !== "undefined" && db?.from) ? db : supabase;
  if (!client?.from) {
    showMessage("撤回失败：数据库客户端未初始化。", "error");
    return;
  }

  const { error } = await client
    .from(tables.lessons)
    .delete()
    .eq("import_batch_id", info.batchId);

  if (error) {
    console.error("[lesson-import] undo failed", error);
    showMessage(`撤回失败：${error.message}`, "error");
    return;
  }

  localStorage.removeItem("lastLessonImportBatchV871");
  await loadAll();
  renderAll();
  updateUndoLessonImportButton();
  showMessage(`已撤回本次导入：${info.count || 0} 条。`, "ok");
}

function teacherIdFromLessonImportName(name) {
  const text = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!text) return "";
  const matched = (state.teachers || []).find(t => {
    const name1 = String(t.name || "").replace(/\s+/g, "").toLowerCase();
    const name2 = String(t.display_name || "").replace(/\s+/g, "").toLowerCase();
    return (name1 && (name1.includes(text) || text.includes(name1))) ||
      (name2 && (name2.includes(text) || text.includes(name2)));
  });
  return matched?.id || "";
}

function subjectIdFromLessonImportName(name) {
  const text = String(name || "").replace(/\s+/g, "").toLowerCase();
  if (!text) return "";
  const matched = (state.subjects || []).find(s => {
    const subject = String(s.name || "").replace(/\s+/g, "").toLowerCase();
    return subject && (subject.includes(text) || text.includes(subject));
  });
  return matched?.id || "";
}

function normalizeLessonImportCount(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseImportDate(value, baseYear) {
  if (!value && value !== 0) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return formatImportDateYmd(value);
  if (typeof value === "number") {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) return formatImportDateYmd(date);
  }
  const text = String(value).trim()
    .replace(/周|週|星期|礼拜/g, "")
    .replace(/[年月]/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-");
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(text)) {
    const [y, m, d] = text.split("-").map(Number);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  if (/^\d{1,2}[-.]\d{1,2}$/.test(text)) {
    const [m, d] = text.replace(".", "-").split("-").map(Number);
    const y = Number(baseYear || new Date().getFullYear());
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return "";
}

function parseImportClockMinutes(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const match = text.match(/(\d{1,2})[:：](\d{1,2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const min = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
}

function minutesBetweenTimes(start, end) {
  const s = parseImportClockMinutes(start);
  const e = parseImportClockMinutes(end);
  if (s === null || e === null) return null;
  let diff = e - s;
  if (diff < 0) diff += 24 * 60;
  return diff > 0 ? diff : null;
}

function hoursFromMinutesExact(minutes) {
  if (!minutes) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

function excelTimeToHHMMForImport(value) {
  if (value === null || value === undefined || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    if (value >= 0 && value < 1) {
      const total = Math.round(value * 24 * 60);
      return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
    }
    return "";
  }
  const text = String(value).trim();
  if (!text) return "";
  const dateLike = text.match(/(?:Sat Dec 30 1899\s+)?(\d{1,2}):(\d{2}):?\d{0,2}/);
  if (dateLike) return `${String(Number(dateLike[1])).padStart(2, "0")}:${dateLike[2]}`;
  const match = text.match(/(\d{1,2})[:：](\d{1,2})/);
  if (match) return `${String(Number(match[1])).padStart(2, "0")}:${String(Number(match[2])).padStart(2, "0")}`;
  return "";
}

function cleanImportTimeText(value) {
  return excelTimeToHHMMForImport(value) || "";
}

function buildImportHeaderMap(header) {
  const map = {};
  (header || []).forEach((cell, index) => {
    const key = txImportV920(cell);
    if (!key) return;
    if ((/学生|学生姓名|生徒/.test(key) || (index === 0 && /姓名/.test(key))) && map.student === undefined) map.student = index;
    if (/担当|老师|教師|先生/.test(key) && map.teacher === undefined) map.teacher = index;
    if (/科目|课程|講座/.test(key) && map.subject === undefined) map.subject = index;
    if ((/预定.*日期|予定.*日|^日期$|^周$|^週$/.test(key)) && map.plannedDate === undefined) map.plannedDate = index;
    if (/实际.*日期|実際.*日|实际上课日期|上课日/.test(key) && map.actualDate === undefined) map.actualDate = index;
    if (/时间帯|时间段|時間帯|时段/.test(key) && map.timeRange === undefined) map.timeRange = index;
    if (/开始|開始/.test(key) && map.start === undefined) map.start = index;
    if (/结束|終了/.test(key) && map.end === undefined) map.end = index;
    if (/时长|時間数|课时|授業時間/.test(key) && map.duration === undefined) map.duration = index;
    if (/单价|単価/.test(key) && map.unitPrice === undefined) map.unitPrice = index;
    if (/应收|课时费|授業料|金額|金额/.test(key) && map.lessonFee === undefined) map.lessonFee = index;
    if (/内容|授業内容/.test(key)) {
      if (/预定|予定/.test(key) && map.plannedContent === undefined) map.plannedContent = index;
      else if (/实际|実際/.test(key) && map.actualContent === undefined) map.actualContent = index;
      else if (map.content === undefined) map.content = index;
    }
    if (/状态|ステータス/.test(key) && map.status === undefined) map.status = index;
    if (/备注|備考|メモ/.test(key) && map.note === undefined) map.note = index;
    if (/回数|回次|课次|回/.test(key) && map.count === undefined) map.count = index;
    if (/工资.*结算.*月份|工资结算月份|給料.*締.*月|給料.*月|工资月份/.test(key) && map.teacherSettlementMonth === undefined) map.teacherSettlementMonth = index;
    if (/工资.*结算.*备注|工资结算备注|給料.*備考|工资备注/.test(key) && map.salaryNote === undefined) map.salaryNote = index;
    if (/^计费$|^是否计费$|^收费$|^是否收费$|^請求$|^請求対象$/.test(key) && map.billable === undefined) map.billable = index;
  });
  return map;
}

function findImportHeader(rows) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const text = (rows[i] || []).map(txImportV920).join("|");
    if (/科目/.test(text) && (/日期|予定|预定|上课|実際|实际/.test(text)) && (/时长|時間|单价|课时费|金额/.test(text))) return i;
  }
  return -1;
}




// 导入完整课时功能
async function importCompletedLessonExcel(file) {
  if (!requireXlsxForLessonImport()) return;

  const importedStudents = new Map();
  const errors = [];
  const warnings = [];

  const batchId = createLessonImportBatchId();
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
    const subjectId = subjectIdFromLessonImportName(curS) || document.getElementById("lessonSubjectFilter")?.value || "";
    const teacherId = teacherIdFromLessonImportName(curT) || document.getElementById("lessonTeacherFilter")?.value || "";

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

  saveLastLessonImportBatch({
    batchId,
    studentId: firstStudentId,
    studentName: studentNameText,
    fileName: file.name,
    count: records.length,
    importedAt
  });

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
  const count = normalizeLessonImportCount(readImportCellRawV920(row, col.plannedCount));

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
  const actualMinutes = minutesBetweenTimes(start, end);

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
  return findImportHeader(rows);
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

  const legacy = buildImportHeaderMap(header);
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
  if (value instanceof Date) return formatImportDateYmd(value);
  return String(value ?? "").trim();
}

function parseImportDateV920(row, index, baseYear, rowNo, field, errors) {
  const raw = readImportCellRawV920(row, index);
  const date = parseImportDate(raw, baseYear);
  if (!date && String(raw ?? "").trim()) addImportErrorV920(errors, rowNo, field, raw, "无法转换为日期。");
  return date;
}

function parseImportTimeV920(row, index) {
  if (index === undefined) return "";
  return cleanImportTimeText(row[index]);
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
    if (!btn || !input || btn.dataset.boundLessonImportV922 === "true") return;

    btn.dataset.boundLessonImportV922 = "true";
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("title");
    btn.removeAttribute("aria-disabled");
    btn.onclick = () => {
      input.click();
    };
    input.onchange = async event => {
      const file = event.target.files?.[0];
      if (file) await importCompletedLessonExcel(file);
      event.target.value = "";
    };
    ensureLessonImportUndoPanel();
    updateUndoLessonImportButton();
  }

  function applyCompletedImportMonthRequiredV917() {
    patchCompletedImportButtonV917();
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
