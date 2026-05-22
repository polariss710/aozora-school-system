// === v9.8.0 student monthly settlement Excel export ===
// 学生月度结算 Excel 导出。用于发给学生/家长或内部留档。
// 本版先做 Excel，不导出下月收费明细；下月收费明细后续单独设计。

(function () {
  const COLORS = {
    title: "EAF4FF",
    green: "D9EAD3",
    orange: "FCE5CD",
    blue: "D9EAF7",
    white: "FFFFFF",
    border: "999999",
  };

  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function money(value) {
    return Math.round(n(value)).toLocaleString();
  }

  function safeFileName(value) {
    return String(value || "")
      .replace(/[\\/:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "settlement";
  }

  function currentMonth() {
    return document.getElementById("settlementMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function currentStudentId() {
    return document.getElementById("settlementStudentFilter")?.value || "";
  }

  function studentName(student) {
    return student?.display_name || student?.name || "";
  }

  function formatDate(value) {
    if (!value) return "";
    const d = String(value).slice(0, 10);
    const dt = new Date(`${d}T00:00:00`);
    const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    if (Number.isNaN(dt.getTime())) return d;
    return `${d.replaceAll("-", "/")}（${weekdays[dt.getDay()]}）`;
  }

  function formatLessonType(value) {
    return value === "planned" ? "预定" : value === "actual" ? "实际" : value || "";
  }

  function formatStatus(value) {
    const map = {
      planned: "预定",
      completed: "已上课",
      makeup: "补课",
      cancelled: "取消",
      holiday: "放假",
    };
    return map[value] || value || "";
  }

  function feeOfLesson(item) {
    return n(item?.lesson_fee || (n(item?.unit_price) * n(item?.duration_hours)));
  }

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
    const s = ws.getCell(start);
    const e = ws.getCell(end);
    for (let r = s.row; r <= e.row; r++) {
      for (let c = s.col; c <= e.col; c++) styleCell(ws.getCell(r, c), options);
    }
  }

  function setMergeValue(ws, range, value, options = {}) {
    ws.mergeCells(range);
    const cell = ws.getCell(range.split(":")[0]);
    cell.value = value;
    styleRange(ws, range, options);
  }

  function settlementData() {
    const month = currentMonth();
    const studentId = currentStudentId();
    const student = (state.students || []).find(x => x.id === studentId);

    if (!studentId || !student) return null;

    const lessons = (state.lessonRecords || [])
      .filter(x => x.student_id === studentId && x.year_month === month && x.is_billable !== false);

    const planned = lessons.filter(x => x.lesson_type === "planned");
    const actual = lessons.filter(x =>
      x.lesson_type === "actual" &&
      (x.status === "completed" || x.status === "makeup" || x.status === "planned")
    );

    const rate = n(student.preset_exchange_rate);
    const prevBalanceCny = n(student.previous_balance_cny);
    const plannedJpy = planned.reduce((sum, x) => sum + feeOfLesson(x), 0);
    const actualJpy = actual.reduce((sum, x) => sum + feeOfLesson(x), 0);
    const plannedHours = planned.reduce((sum, x) => sum + n(x.duration_hours), 0);
    const actualHours = actual.reduce((sum, x) => sum + n(x.duration_hours), 0);

    const incomes = (state.incomeRecords || []).filter(x =>
      x.student_id === studentId &&
      x.year_month === month &&
      x.income_category === "tuition" &&
      x.status === "received"
    );

    const receivedCny = incomes.filter(x => x.currency === "CNY").reduce((sum, x) => sum + n(x.amount), 0);
    const receivedJpy = incomes.filter(x => x.currency === "JPY").reduce((sum, x) => sum + n(x.amount), 0);
    const plannedCny = plannedJpy * rate;
    const actualCny = actualJpy * rate;
    const receivedEquivalentCny = receivedCny + receivedJpy * rate;
    const monthBalanceCny = actualCny - receivedEquivalentCny - prevBalanceCny;

    return {
      month,
      student,
      lessons,
      planned,
      actual,
      rate,
      prevBalanceCny,
      plannedJpy,
      actualJpy,
      plannedHours,
      actualHours,
      plannedCny,
      actualCny,
      receivedCny,
      receivedJpy,
      receivedEquivalentCny,
      monthBalanceCny,
    };
  }

  function addSummary(ws, data) {
    setMergeValue(ws, "A1:I1", "学生月度课程结算表", { fill: COLORS.title, bold: true, size: 16, align: "center" });

    ws.getCell("A2").value = "结算月份";
    ws.getCell("B2").value = data.month;
    ws.getCell("C2").value = "学生";
    setMergeValue(ws, "D2:E2", studentName(data.student), { align: "center" });
    ws.getCell("F2").value = "汇率";
    ws.getCell("G2").value = data.rate;
    setMergeValue(ws, "H2:I2", "青空进学塾", { align: "center" });

    ["A2", "C2", "F2"].forEach(addr => styleCell(ws.getCell(addr), { fill: COLORS.green, bold: true }));
    ["B2", "D2", "E2", "G2", "H2", "I2"].forEach(addr => styleCell(ws.getCell(addr), { align: "center" }));

    setMergeValue(ws, "A4:I4", "月初预定结算", { fill: COLORS.orange, bold: true, align: "left" });
    const plannedRows = [
      ["上月结余/补交（人民币）", data.prevBalanceCny],
      ["本月预定课时", data.plannedHours],
      ["本月应收（日元）", data.plannedJpy],
      ["本月应收（人民币）", Math.round(data.plannedCny)],
      ["本月应收合计（人民币）", Math.round(data.plannedCny - data.prevBalanceCny)],
    ];
    plannedRows.forEach((row, i) => {
      const r = 5 + i;
      setMergeValue(ws, `A${r}:C${r}`, row[0], { fill: COLORS.green, bold: i === plannedRows.length - 1, align: "left" });
      setMergeValue(ws, `D${r}:I${r}`, row[1], { bold: i === plannedRows.length - 1, align: "right" });
    });

    setMergeValue(ws, "A11:I11", "月底实际结算", { fill: COLORS.orange, bold: true, align: "left" });
    const actualRows = [
      ["本月实际课时", data.actualHours],
      ["实际课时费（日元）", data.actualJpy],
      ["实际课时费（人民币）", Math.round(data.actualCny)],
      ["已收学费（人民币）", Math.round(data.receivedCny)],
      ["已收学费（日元）", Math.round(data.receivedJpy)],
      ["本月课时费结余/补交（人民币）", Math.round(data.monthBalanceCny)],
    ];
    actualRows.forEach((row, i) => {
      const r = 12 + i;
      setMergeValue(ws, `A${r}:C${r}`, row[0], { fill: COLORS.green, bold: i === actualRows.length - 1, align: "left" });
      setMergeValue(ws, `D${r}:I${r}`, row[1], { bold: i === actualRows.length - 1, align: "right" });
    });
  }

  function addLessons(ws, data) {
    const start = 20;
    setMergeValue(ws, `A${start}:I${start}`, "课时明细", { fill: COLORS.orange, bold: true, align: "left" });

    const headers = ["区分", "日期", "老师", "科目", "时间", "课时", "单价（日元）", "课时费（日元）", "状态/内容"];
    ws.getRow(start + 1).values = headers;
    styleRange(ws, `A${start + 1}:I${start + 1}`, { fill: COLORS.green, bold: true, align: "center" });

    const rows = data.lessons.slice().sort((a, b) =>
      String(a.lesson_type || "").localeCompare(String(b.lesson_type || "")) ||
      String(a.lesson_date || "").localeCompare(String(b.lesson_date || "")) ||
      String(a.start_time || "").localeCompare(String(b.start_time || ""))
    );

    rows.forEach((item, i) => {
      const r = start + 2 + i;
      const time = [item.start_time, item.end_time].filter(Boolean).join(" - ");
      ws.getCell(r, 1).value = formatLessonType(item.lesson_type);
      ws.getCell(r, 2).value = formatDate(item.lesson_date);
      ws.getCell(r, 3).value = item.teacher?.display_name || item.teacher?.name || "";
      ws.getCell(r, 4).value = item.subject?.name || "";
      ws.getCell(r, 5).value = time;
      ws.getCell(r, 6).value = n(item.duration_hours);
      ws.getCell(r, 7).value = n(item.unit_price);
      ws.getCell(r, 8).value = feeOfLesson(item);
      ws.getCell(r, 9).value = [formatStatus(item.status), item.lesson_content || item.note || ""].filter(Boolean).join(" / ");

      for (let c = 1; c <= 9; c++) {
        const align = c === 9 ? "left" : (c >= 6 && c <= 8 ? "right" : "center");
        const vertical = c === 9 ? "top" : "middle";
        styleCell(ws.getCell(r, c), { align, vertical });
      }
      ws.getRow(r).height = 28;
    });

    if (!rows.length) {
      setMergeValue(ws, `A${start + 2}:I${start + 2}`, "当前学生和月份没有课时记录", { align: "center" });
    }
  }

  async function exportExcel() {
    if (!window.ExcelJS) {
      showMessage("Excel 导出库还没有加载完成，请稍后重试。", "error");
      return;
    }

    const data = settlementData();
    if (!data) {
      showMessage("请先选择学生和月份。", "error");
      return;
    }

    const wb = new ExcelJS.Workbook();
    wb.creator = "青空进学塾运营管理系统";
    wb.created = new Date();

    const ws = wb.addWorksheet("月度结算");
    ws.columns = [
      { width: 14 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 16 },
      { width: 10 }, { width: 14 }, { width: 16 }, { width: 32 },
    ];

    addSummary(ws, data);
    addLessons(ws, data);

    ws.views = [{ state: "frozen", ySplit: 21 }];
    ws.pageSetup = {
      paperSize: 9,
      orientation: "landscape",
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    };

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = `${safeFileName(studentName(data.student))}_${data.month}_月度课程结算.xlsx`;
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    showMessage("学生月度结算 Excel 已导出。", "ok");
  }

  function bindExportButton() {
    const btn = document.getElementById("studentSettlementExportExcelBtn");
    if (!btn || btn.dataset.boundSettlementExport === "true") return;
    btn.dataset.boundSettlementExport = "true";
    btn.addEventListener("click", exportExcel);
  }

  const switchPageBeforeV980 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV980) {
    window.switchPage = function(page) {
      switchPageBeforeV980(page);
      if (page === "student-settlement") setTimeout(bindExportButton, 0);
    };
  }

  const renderAllBeforeV980 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV980) {
    window.renderAll = function() {
      renderAllBeforeV980();
      if (document.getElementById("page-student-settlement")?.classList.contains("active")) {
        setTimeout(bindExportButton, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindExportButton, 1000);
  });

  window.SchoolStudentSettlementExportV980 = {
    version: "9.8.0",
    exportExcel,
    settlementData,
  };
})();
