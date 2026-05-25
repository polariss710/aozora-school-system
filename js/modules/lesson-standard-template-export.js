// === v9.8-stable-final.16-settlement-border-fix lesson standard template export ===
// 课时管理「导出Excel」改为导出标准课时登记模板。
// 用于未来月份预登记：只生成该月每个周一代表的周，默认时长 2H，其他业务字段留空。

(function () {
  function requireExcelJS() {
    if (typeof ExcelJS === "undefined") {
      if (typeof showMessage === "function") showMessage("Excel 导出库还没有加载完成，请稍后重试。", "error");
      return false;
    }
    return true;
  }

  function selectedMonth() {
    return document.getElementById("lessonMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function monthLabel(ym) {
    const [y, m] = String(ym || "").split("-");
    return y && m ? `${y}年${Number(m)}月` : ym;
  }

  function safeName(v) {
    return String(v || "").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
  }

  function mondayDatesOfMonth(ym) {
    const [year, month] = String(ym || "").split("-").map(Number);
    if (!year || !month) return [];

    const first = new Date(year, month - 1, 1);
    const last = new Date(year, month, 0);
    const d = new Date(first);

    // JS: Sunday=0, Monday=1
    while (d.getDay() !== 1) d.setDate(d.getDate() + 1);

    const dates = [];
    while (d <= last) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dates.push(`${yy}-${mm}-${dd}`);
      d.setDate(d.getDate() + 7);
    }
    return dates;
  }

  function mondayLabelsOfMonth(ym) {
    return mondayDatesOfMonth(ym).map(date => {
      const [, month, day] = date.split("-");
      return `${Number(month)}.${Number(day)}周`;
    });
  }

  function personName(item) {
    return item?.display_name || item?.name || item?.full_name || "";
  }

  function sortedNames(list, getter) {
    return (list || [])
      .map(getter)
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b), "zh-Hans-CN"));
  }

  function buildWorkbook(ym) {
    const students = sortedNames(state.students, personName);
    const teachers = sortedNames(state.teachers, personName);
    const subjects = sortedNames(state.subjects, item => item?.name || "");
    const businessEntities = sortedNames(state.businessEntities, item => item?.name || item?.code || "");
    const dates = mondayDatesOfMonth(ym);
    const plannedStatuses = ["待上课", "待补课"];
    const plannedBillable = ["是"];
    const actualStatuses = ["已上课", "取消课", "已补课"];
    const actualBillable = ["是", "否"];

    const headers = [
      "学生姓名",
      "担当老师",
      "科目",
      "业务归属",
      "归属月份",
      "预定日期",
      "预定第几回",
      "预定开始时间",
      "预定结束时间",
      "预定课时时长",
      "预定单价",
      "预定课时费",
      "预定状态",
      "预定计费",
      "预定备注",
      "实际日期",
      "实际开始时间",
      "实际结束时间",
      "实际课时时长",
      "实际状态",
      "实际计费",
      "实际课时费",
      "上课内容及作业",
      "实际备注",
      "关联标识",
    ];

    const rows = [
      [`标准课时登记模板 - ${monthLabel(ym)}`],
      ["左侧填写预定课时，右侧填写实际课时。预定状态只能选“待上课 / 待补课”；实际状态只能选“已上课 / 取消课 / 已补课”。补以前月份已收费课程：实际侧“已补课”且实际计费“否”；本月临时加课或本月收费补课：实际侧“已补课”且实际计费“是”；取消课：实际侧“取消课”且实际计费“否”。"],
      ["基础信息", "", "", "", "", "预定课时", "", "", "", "", "", "", "", "", "", "实际课时", "", "", "", "", "", "", "", "", ""],
      headers,
    ];

    for (let i = 0; i < dates.length; i++) {
      const rowNumber = 5 + i;
      rows.push([
        "",
        "",
        "",
        "",
        ym,
        dates[i] || "",
        i + 1,
        "",
        "",
        dates[i] ? 2 : "",
        "",
        { formula: `IF(AND(J${rowNumber}<>"",K${rowNumber}<>""),J${rowNumber}*K${rowNumber},"")` },
        "待上课",
        "是",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        { formula: `IF(AND(S${rowNumber}<>"",K${rowNumber}<>""),S${rowNumber}*K${rowNumber},"")` },
        "",
        "",
        "",
      ]);
    }

    const firstTemplateRow = 5;
    const lastTemplateRow = firstTemplateRow + dates.length - 1;
    const totalRow = lastTemplateRow + 1;
    rows.push([
      "", "", "", "", "", "", "", "", "合计",
      dates.length ? { formula: `SUM(J${firstTemplateRow}:J${lastTemplateRow})` } : "",
      "",
      dates.length ? { formula: `SUM(L${firstTemplateRow}:L${lastTemplateRow})` } : "",
      "", "", "",
      "", "", "合计",
      dates.length ? { formula: `SUM(S${firstTemplateRow}:S${lastTemplateRow})` } : "",
      "", "",
      dates.length ? { formula: `SUM(V${firstTemplateRow}:V${lastTemplateRow})` } : "",
      "", "", "",
    ]);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("标准课时登记");
    rows.forEach(row => ws.addRow(row));

    const listWs = wb.addWorksheet("_lists");
    listWs.state = "hidden";
    const listCount = Math.max(
      students.length,
      teachers.length,
      subjects.length,
      businessEntities.length,
      plannedStatuses.length,
      plannedBillable.length,
      actualStatuses.length,
      actualBillable.length
    );
    for (let i = 0; i < listCount; i++) {
      listWs.addRow([
        students[i] || "",
        teachers[i] || "",
        subjects[i] || "",
        businessEntities[i] || "",
        plannedStatuses[i] || "",
        plannedBillable[i] || "",
        actualStatuses[i] || "",
        actualBillable[i] || "",
      ]);
    }
    listWs.columns = [
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 12 },
      { width: 8 },
      { width: 12 },
      { width: 8 },
    ];

    ws.columns = [
      { width: 14 }, // 学生姓名
      { width: 14 }, // 担当老师
      { width: 14 }, // 科目
      { width: 14 }, // 业务归属
      { width: 10 }, // 归属月份
      { width: 12 }, // 预定日期
      { width: 10 }, // 预定第几回
      { width: 10 }, // 预定开始时间
      { width: 10 }, // 预定结束时间
      { width: 12 }, // 预定课时时长
      { width: 12 }, // 预定单价
      { width: 14 }, // 预定课时费
      { width: 12 }, // 预定状态
      { width: 10 }, // 预定计费
      { width: 22 }, // 预定备注
      { width: 12 }, // 实际日期
      { width: 10 }, // 实际开始时间
      { width: 10 }, // 实际结束时间
      { width: 12 }, // 实际课时时长
      { width: 12 }, // 实际状态
      { width: 10 }, // 实际计费
      { width: 14 }, // 实际课时费
      { width: 30 }, // 上课内容及作业
      { width: 22 }, // 实际备注
      { width: 14 }, // 关联标识
    ];

    ws.mergeCells(1, 1, 1, 25);
    ws.mergeCells(2, 1, 2, 25);
    ws.mergeCells(3, 1, 3, 5);
    ws.mergeCells(3, 6, 3, 15);
    ws.mergeCells(3, 16, 3, 25);
    ws.views = [{ state: "frozen", ySplit: 4 }];

    function applyListValidation(targetCol, listCol, count, strict = false) {
      if (!dates.length || !count) return;
      const formula = `'_lists'!$${listCol}$1:$${listCol}$${count}`;
      for (let row = firstTemplateRow; row <= lastTemplateRow; row++) {
        ws.getCell(`${targetCol}${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [formula],
          showErrorMessage: true,
          errorStyle: strict ? "stop" : "warning",
          errorTitle: "不在参考列表中",
          error: strict ? "请选择下拉列表中的值。" : "请选择参考列表中的值，或确认后手动输入。",
        };
      }
    }

    applyListValidation("A", "A", students.length);
    applyListValidation("B", "B", teachers.length);
    applyListValidation("C", "C", subjects.length);
    applyListValidation("D", "D", businessEntities.length);
    applyListValidation("M", "E", plannedStatuses.length, true);
    applyListValidation("N", "F", plannedBillable.length, true);
    applyListValidation("T", "G", actualStatuses.length, true);
    applyListValidation("U", "H", actualBillable.length, true);

    for (let row = firstTemplateRow; row <= totalRow; row++) {
      ["F", "P"].forEach(col => {
        ws.getCell(`${col}${row}`).numFmt = "yyyy-mm-dd";
      });
      ["H", "I", "Q", "R"].forEach(col => {
        ws.getCell(`${col}${row}`).numFmt = "hh:mm";
      });
      ["J", "K", "L", "S", "V"].forEach(col => {
        ws.getCell(`${col}${row}`).numFmt = "#,##0.##";
      });
    }

    ws.getRow(1).height = 24;
    ws.getRow(2).height = 42;
    ws.getRow(3).height = 22;
    ws.getRow(4).height = 28;

    ws.getCell("A1").font = { bold: true, size: 14 };
    ws.getCell("A2").alignment = { wrapText: true, vertical: "middle" };
    ws.getRow(3).font = { bold: true };
    ws.getRow(4).font = { bold: true };

    ws.getRow(3).eachCell(cell => {
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });
    ws.getRow(4).eachCell(cell => {
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border = { top: { style: "thin" }, left: { style: "thin" }, bottom: { style: "thin" }, right: { style: "thin" } };
    });

    const baseFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F1FF" } };
    const plannedFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3D8" } };
    const actualFill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8F7EA" } };
    for (let col = 1; col <= 5; col++) {
      ws.getCell(3, col).fill = baseFill;
      ws.getCell(4, col).fill = baseFill;
    }
    for (let col = 6; col <= 15; col++) {
      ws.getCell(3, col).fill = plannedFill;
      ws.getCell(4, col).fill = plannedFill;
    }
    for (let col = 16; col <= 25; col++) {
      ws.getCell(3, col).fill = actualFill;
      ws.getCell(4, col).fill = actualFill;
    }

    ws.getColumn("W").alignment = { wrapText: true, vertical: "top" };
    ws.getColumn("O").alignment = { wrapText: true, vertical: "top" };
    ws.getColumn("X").alignment = { wrapText: true, vertical: "top" };

    return wb;
  }

  async function exportStandardLessonTemplate() {
    if (!requireExcelJS()) return;

    const ym = selectedMonth();
    if (!ym) {
      if (typeof showMessage === "function") showMessage("请先选择月份。", "error");
      return;
    }

    const wb = buildWorkbook(ym);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `标准课时登记模板_${safeName(ym)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (typeof showMessage === "function") showMessage("标准课时登记 Excel 已导出。", "ok");
  }

  function bind() {
    const btn = document.getElementById("lessonExportExcelBtn");
    if (!btn) return;

    btn.textContent = "导出标准登记Excel";
    btn.disabled = false;
    btn.classList.remove("disabled");
    btn.removeAttribute("aria-disabled");

    // 覆盖旧的课时记录导出功能
    btn.onclick = exportStandardLessonTemplate;
    btn.dataset.boundStandardTemplateExportV988 = "true";
  }

  const renderLessonsBeforeV988 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV988) {
    window.renderLessons = function () {
      renderLessonsBeforeV988();
      setTimeout(bind, 0);
    };
    try { renderLessons = window.renderLessons; } catch (e) {}
  }

  const renderAllBeforeV988 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV988) {
    window.renderAll = function () {
      renderAllBeforeV988();
      setTimeout(bind, 0);
    };
    try { renderAll = window.renderAll; } catch (e) {}
  }

  const switchPageBeforeV988 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV988) {
    window.switchPage = function (page) {
      switchPageBeforeV988(page);
      if (page === "lessons") setTimeout(bind, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(bind, 800));

  window.SchoolLessonStandardTemplateExport = {
    version: "9.8-stable-recovery-final12",
    export: exportStandardLessonTemplate,
    mondayLabelsOfMonth,
  };
})();
