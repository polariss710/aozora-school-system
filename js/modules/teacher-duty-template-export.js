// === v9.6.4 teacher duty declaration template export ===
// 导出给老师填写的勤务申报模板。
// v9.6.2 改为真实 .xlsx 输出，避免 .xls HTML 文件的扩展名不匹配警告。
// 注意：模板不包含业务归属、时给、课程工资、系统工资金额等内部保密信息。

(function () {
  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function currentMonth() {
    return document.getElementById("teacherWageMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function teacherDisplayName(row) {
    return row?.teacher_name || row?.row?.teacher?.display_name || row?.row?.teacher?.name || "老师";
  }

  function safeFileName(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "template";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = String(value).slice(0, 10);
    const dt = new Date(`${d}T00:00:00`);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    if (Number.isNaN(dt.getTime())) return d;
    return `${d.replaceAll("-", "/")}（${weekdays[dt.getDay()]}）`;
  }

  function formatTime(value) {
    if (!value) return "";
    return String(value).slice(0, 5);
  }

  function formatHours(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }

  function studentText(row) {
    return row.student_name || "";
  }

  function workContent(row) {
    const parts = [
      row.subject_name || "",
      row.lesson_content || row.row?.lesson_content || row.row?.note || "",
    ].filter(Boolean);

    return parts.join(" / ");
  }

  function currentRows() {
    const api = window.SchoolTeacherWagesModule;
    if (!api?.currentWageRowsForLock) return [];
    return api.currentWageRowsForLock()
      .filter(item => item?.row && item?.wage?.hasRule)
      .sort((a, b) =>
        String(a.teacher_name || "").localeCompare(String(b.teacher_name || ""), "zh-Hans-CN") ||
        String(a.student_name || "").localeCompare(String(b.student_name || ""), "zh-Hans-CN") ||
        String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")) ||
        String(a.start_time || "").localeCompare(String(b.start_time || ""))
      );
  }

  function groupByTeacher(rows) {
    const map = new Map();
    rows.forEach(row => {
      const id = row.teacher_id || row.teacher_name || "unknown";
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(row);
    });
    return Array.from(map.values());
  }

  const COLORS = {
    title: "EAF4FF",
    green: "D9EAD3",
    orange: "FCE5CD",
    white: "FFFFFF",
    border: "999999",
  };

  function borderStyle() {
    return {
      top: { style: "thin", color: { argb: COLORS.border } },
      left: { style: "thin", color: { argb: COLORS.border } },
      bottom: { style: "thin", color: { argb: COLORS.border } },
      right: { style: "thin", color: { argb: COLORS.border } },
    };
  }

  function fill(color) {
    return { type: "pattern", pattern: "solid", fgColor: { argb: color } };
  }

  function styleCell(cell, options = {}) {
    cell.border = borderStyle();
    cell.font = {
      name: "Microsoft YaHei",
      size: options.size || 11,
      bold: !!options.bold,
      color: options.fontColor ? { argb: options.fontColor } : undefined,
    };
    cell.alignment = {
      vertical: options.vertical || "middle",
      horizontal: options.align || "center",
      wrapText: options.wrap !== false,
    };
    if (options.fill) cell.fill = fill(options.fill);
    if (options.numFmt) cell.numFmt = options.numFmt;
  }

  function styleRange(ws, range, options) {
    const [start, end] = range.split(":");
    const startCell = ws.getCell(start);
    const endCell = ws.getCell(end);
    for (let r = startCell.row; r <= endCell.row; r++) {
      for (let c = startCell.col; c <= endCell.col; c++) {
        styleCell(ws.getCell(r, c), options);
      }
    }
  }

  function setMergeValue(ws, range, value, options = {}) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    styleRange(ws, range, options);
  }

  function addWorksheetContent(wb, rows) {
    const month = currentMonth();
    const [year, monthNo] = month.split("-");
    const teacher = teacherDisplayName(rows[0]);
    const ws = wb.addWorksheet("勤务申报表");

    ws.columns = [
      { key: "date", width: 18 },
      { key: "student", width: 16 },
      { key: "content1", width: 34 },
      { key: "content2", width: 34 },
      { key: "start", width: 12 },
      { key: "end", width: 12 },
      { key: "hours", width: 10 },
      { key: "transport", width: 14 },
      { key: "classroom", width: 14 },
      { key: "note", width: 18 },
    ];

    setMergeValue(ws, "A1:J1", "勤务申报表（讲师填写用）", {
      fill: COLORS.title, bold: true, size: 16, align: "center",
    });

    ws.getCell("A2").value = "月份";
    ws.getCell("B2").value = `${year || ""}年${monthNo || ""}月`;
    ws.getCell("C2").value = "姓名";
    setMergeValue(ws, "D2:E2", teacher, { align: "center" });
    ws.getCell("F2").value = "支付方式";
    setMergeValue(ws, "G2:J2", "日元银行 / 支付宝 / 微信", { align: "center" });

    ["A2", "C2", "F2"].forEach(addr => styleCell(ws.getCell(addr), { fill: COLORS.green, bold: true, align: "center" }));
    ["B2", "D2", "E2", "G2", "H2", "I2", "J2"].forEach(addr => styleCell(ws.getCell(addr), { align: "center" }));

    setMergeValue(ws, "A3:J3", "※ 本表仅用于勤务时间、交通费、教室费和支付方式申报。请勿修改系统已填写的日期、工作内容、开始时间、结束时间、时长。", {
      align: "left", size: 10,
    });

    const headers = ["日期及星期", "学生", "工作内容", "", "开始时间", "结束时间", "时长", "当日交通费", "当日教室费", "备注"];
    ws.getRow(4).values = headers;
    ws.mergeCells("C4:D4");
    styleRange(ws, "A4:J4", { fill: COLORS.green, bold: true, align: "center" });

    const safeRows = rows.slice(0, 31);
    for (let i = 0; i < 31; i++) {
      const rowNo = i + 5;
      const row = safeRows[i];
      if (row) {
        ws.getCell(rowNo, 1).value = formatDate(row.lesson_date);
        ws.getCell(rowNo, 2).value = studentText(row);
        ws.getCell(rowNo, 3).value = workContent(row);
        ws.mergeCells(rowNo, 3, rowNo, 4);
        ws.getCell(rowNo, 5).value = formatTime(row.start_time);
        ws.getCell(rowNo, 6).value = formatTime(row.end_time);
        ws.getCell(rowNo, 7).value = formatHours(row.wage?.hours);
      } else {
        ws.getCell(rowNo, 7).value = 0;
      }
      ws.getCell(rowNo, 8).value = 0;
      ws.getCell(rowNo, 9).value = 0;

      for (let c = 1; c <= 10; c++) {
        const align = (c === 3 || c === 10) ? "left" : (c >= 7 && c <= 9 ? "right" : "center");
        const vertical = c === 3 ? "top" : "middle";
        styleCell(ws.getCell(rowNo, c), { align, vertical });
      }
      ws.getRow(rowNo).height = row ? 48 : 18;
    }

    // 合计行：只填充 A:I 表格范围，不影响右侧空白列。
    const totalRow = 36;
    setMergeValue(ws, `A${totalRow}:F${totalRow}`, "合计", { fill: COLORS.orange, bold: true, align: "left" });
    ws.getCell(`G${totalRow}`).value = { formula: `SUM(G5:G35)` };
    ws.getCell(`H${totalRow}`).value = { formula: `SUM(H5:H35)` };
    ws.getCell(`I${totalRow}`).value = { formula: `SUM(I5:I35)` };
    ws.getCell(`J${totalRow}`).value = "";
    styleRange(ws, `G${totalRow}:J${totalRow}`, { fill: COLORS.orange, bold: true, align: "right" });

    setMergeValue(ws, "A37:J37", "日元支付（银行振込）", { fill: COLORS.orange, bold: true, align: "left" });

    ws.getCell("A38").value = "銀行名";
    ws.getCell("B38").value = "支店番号";
    ws.getCell("C38").value = "支店名";
    ws.getCell("D38").value = "口座番号";
    setMergeValue(ws, "E38:G38", "名義", { fill: COLORS.green, bold: true, align: "center" });
    setMergeValue(ws, "H38:J38", "备注", { fill: COLORS.green, bold: true, align: "center" });
    ["A38", "B38", "C38", "D38"].forEach(addr => styleCell(ws.getCell(addr), { fill: COLORS.green, bold: true, align: "center" }));

    ws.getRow(39).values = ["", "", "", "", "", "", "", "", "", ""];
    ws.mergeCells("E39:G39");
    ws.mergeCells("H39:J39");
    styleRange(ws, "A39:J39", { align: "center" });

    setMergeValue(ws, "A40:J40", "人民币支付", { fill: COLORS.orange, bold: true, align: "left" });

    ws.getCell("A41").value = "支付宝";
    setMergeValue(ws, "B41:E41", "微信", { fill: COLORS.green, bold: true, align: "center" });
    setMergeValue(ws, "F41:J41", "备注", { fill: COLORS.green, bold: true, align: "center" });
    styleCell(ws.getCell("A41"), { fill: COLORS.green, bold: true, align: "center" });

    ws.getRow(42).values = ["", "", "", "", "", "", "", "", "", ""];
    ws.mergeCells("B42:E42");
    ws.mergeCells("F42:J42");
    styleRange(ws, "A42:J42", { align: "center" });

    ws.views = [{ state: "frozen", ySplit: 4 }];
    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    };

    // 统一高度，避免打开后观感跳动。
    [1, 2, 3, 4, 36, 37, 38, 40, 41].forEach(r => ws.getRow(r).height = r === 1 ? 24 : 20);

    return { ws, teacher, month };
  }

  async function downloadXlsx(rows) {
    if (!window.ExcelJS) {
      showMessage("Excel 导出库还没有加载完成，请稍等几秒后重试。", "error");
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "青空进学塾运营管理系统";
    wb.created = new Date();

    const { teacher, month } = addWorksheetContent(wb, rows);
    const buffer = await wb.xlsx.writeBuffer();

    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safeFileName(teacher)}_${month}_勤务申报表.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportTemplates() {
    const rows = currentRows();
    if (!rows.length) {
      showMessage("当前筛选范围没有可导出的老师勤务记录。", "error");
      return;
    }

    const selectedTeacher = document.getElementById("teacherWageTeacherFilter")?.value || "";
    const groups = selectedTeacher ? [rows] : groupByTeacher(rows);

    if (groups.length > 1) {
      const ok = confirm(`当前未选择具体老师，将按老师分别导出 ${groups.length} 个勤务申报表。\n是否继续？`);
      if (!ok) return;
    }

    groups.forEach((group, index) => {
      setTimeout(() => downloadXlsx(group), index * 500);
    });

    showMessage(`已导出 ${groups.length} 个 .xlsx 勤务申报模板。模板不包含业务归属、时给和课程工资。`, "ok");
  }

  function bindExportButton() {
    const btn = document.getElementById("teacherDutyTemplateExportBtn");
    if (!btn || btn.dataset.boundTeacherDutyExport === "true") return;
    btn.dataset.boundTeacherDutyExport = "true";
    btn.addEventListener("click", exportTemplates);
  }

  const switchPageBeforeV962 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV962) {
    window.switchPage = function(page) {
      switchPageBeforeV962(page);
      if (page === "teacher-wages") setTimeout(bindExportButton, 0);
    };
  }

  const renderAllBeforeV962 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV962) {
    window.renderAll = function() {
      renderAllBeforeV962();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        setTimeout(bindExportButton, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindExportButton, 1000);
  });

  window.SchoolTeacherDutyTemplateExportV962 = {
    version: "9.6.4",
    exportTemplates,
  };
})();
