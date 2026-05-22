// === v9.7.0 teacher duty declaration template import/check ===
// 读取老师填写后的勤务申报表，核对课程时间，并把交通费 / 教室费带回工资结算画面。
// 本版不写入数据库；费用确认后参与当前画面的工资锁定。

(function () {
  let lastImportResult = null;

  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function norm(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function normName(value) {
    return norm(value).replace(/[　\s]/g, "");
  }

  function normDate(value) {
    if (!value) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
    }

    if (typeof value === "number") {
      // Excel serial date. ExcelJS may already convert dates, but keep fallback.
      const epoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(epoch.getTime() + value * 86400000);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    }

    const text = norm(value).replace(/[（）]/g, " ").replace(/\(.+?\)/g, " ");
    const m = text.match(/(\d{4})[\/\-年.](\d{1,2})[\/\-月.](\d{1,2})/);
    if (m) return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;

    return "";
  }

  function normTime(value) {
    if (!value && value !== 0) return "";
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    }
    if (typeof value === "number") {
      const totalMinutes = Math.round(value * 24 * 60);
      return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
    }
    const text = norm(value);
    const m = text.match(/(\d{1,2})[:：](\d{1,2})/);
    if (m) return `${String(m[1]).padStart(2, "0")}:${String(m[2]).padStart(2, "0")}`;
    return text.slice(0, 5);
  }

  function cellText(ws, addr) {
    const v = ws.getCell(addr).value;
    if (v && typeof v === "object" && "richText" in v) return v.richText.map(x => x.text || "").join("");
    if (v && typeof v === "object" && "text" in v) return v.text || "";
    if (v && typeof v === "object" && "result" in v) return v.result ?? "";
    return v ?? "";
  }

  function rowValue(ws, rowNo, colNo) {
    const v = ws.getRow(rowNo).getCell(colNo).value;
    if (v && typeof v === "object" && "richText" in v) return v.richText.map(x => x.text || "").join("");
    if (v && typeof v === "object" && "text" in v) return v.text || "";
    if (v && typeof v === "object" && "result" in v) return v.result ?? "";
    return v ?? "";
  }

  function readTeacherName(ws) {
    // v9.6.x template uses D2:E2 merged for teacher name.
    return norm(cellText(ws, "D2") || cellText(ws, "E2"));
  }

  function readDutyRows(ws) {
    const rows = [];
    for (let r = 5; r <= 35; r++) {
      const date = normDate(rowValue(ws, r, 1));
      const student = norm(rowValue(ws, r, 2));
      const content = norm(rowValue(ws, r, 3));
      const start = normTime(rowValue(ws, r, 5));
      const end = normTime(rowValue(ws, r, 6));
      const hours = n(rowValue(ws, r, 7));
      const transport = n(rowValue(ws, r, 8));
      const classroom = n(rowValue(ws, r, 9));
      const note = norm(rowValue(ws, r, 10));

      if (!date && !student && !content && !start && !end && !hours && !transport && !classroom && !note) continue;

      rows.push({ rowNo: r, date, student, content, start, end, hours, transport, classroom, note });
    }
    return rows;
  }

  function currentSystemRows() {
    const api = window.SchoolTeacherWagesModule;
    if (!api?.currentWageRowsForLock) return [];
    return api.currentWageRowsForLock().filter(x => x?.row && x?.wage?.hasRule);
  }

  function sameTime(a, b) {
    return normTime(a) === normTime(b);
  }

  function findMatch(importRow, teacherName, systemRows, usedKeys) {
    const candidates = systemRows.filter(item => {
      if (usedKeys.has(item.rowKey)) return false;
      return normName(item.teacher_name) === normName(teacherName) &&
        normName(item.student_name) === normName(importRow.student) &&
        normDate(item.lesson_date) === importRow.date &&
        sameTime(item.start_time, importRow.start) &&
        sameTime(item.end_time, importRow.end);
    });

    if (candidates.length === 1) return candidates[0];

    // Fallback: if student/date/time are enough but teacher filter in page caused a name mismatch.
    const fallback = systemRows.filter(item => {
      if (usedKeys.has(item.rowKey)) return false;
      return normName(item.student_name) === normName(importRow.student) &&
        normDate(item.lesson_date) === importRow.date &&
        sameTime(item.start_time, importRow.start) &&
        sameTime(item.end_time, importRow.end);
    });

    return fallback.length === 1 ? fallback[0] : null;
  }

  function compareHours(importHours, systemHours) {
    return Math.abs(n(importHours) - n(systemHours)) < 0.01;
  }

  function ensureResultPanel() {
    let panel = document.getElementById("teacherDutyImportResultPanel");
    if (panel) return panel;

    const detailTitle = document.querySelector(".teacher-wage-detail-title");
    panel = document.createElement("div");
    panel.id = "teacherDutyImportResultPanel";
    panel.className = "teacher-duty-import-result hidden";
    panel.innerHTML = `
      <div class="panel-header">
        <div>
          <h3>勤务申报表导入核对结果</h3>
          <p class="muted-small">核对成功后，可以把老师填写的交通费 / 教室费带入当前工资结算画面。</p>
        </div>
        <div class="panel-actions">
          <button class="primary-btn" id="teacherDutyApplyImportBtn" type="button">应用交通费 / 教室费</button>
          <button class="secondary-btn" id="teacherDutyClearImportBtn" type="button">清除结果</button>
        </div>
      </div>
      <div class="cards-grid finance-mini-stats">
        <div class="stat-card"><span>匹配成功</span><strong id="teacherDutyMatchedCount">0</strong></div>
        <div class="stat-card"><span>未匹配</span><strong id="teacherDutyUnmatchedCount">0</strong></div>
        <div class="stat-card"><span>时长不一致</span><strong id="teacherDutyMismatchCount">0</strong></div>
        <div class="stat-card"><span>费用合计</span><strong id="teacherDutyFeeTotal">0 JPY</strong></div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>状态</th><th>行号</th><th>学生</th><th>日期</th><th>时间</th><th>申报时长</th><th>系统时长</th><th>交通费</th><th>教室费</th><th>备注</th>
            </tr>
          </thead>
          <tbody id="teacherDutyImportResultTable"></tbody>
        </table>
      </div>
    `;

    if (detailTitle?.parentElement) detailTitle.parentElement.insertBefore(panel, detailTitle);
    else document.getElementById("page-teacher-wages")?.querySelector(".panel")?.appendChild(panel);

    document.getElementById("teacherDutyApplyImportBtn")?.addEventListener("click", applyImportResult);
    document.getElementById("teacherDutyClearImportBtn")?.addEventListener("click", () => {
      lastImportResult = null;
      panel.classList.add("hidden");
    });

    return panel;
  }

  function renderResult(result) {
    const panel = ensureResultPanel();
    panel.classList.remove("hidden");

    const matched = result.items.filter(x => x.status === "matched");
    const unmatched = result.items.filter(x => x.status === "unmatched");
    const mismatched = result.items.filter(x => x.status === "mismatch");
    const totalFee = matched.reduce((sum, x) => sum + n(x.importRow.transport) + n(x.importRow.classroom), 0);

    setOptionalText("teacherDutyMatchedCount", String(matched.length));
    setOptionalText("teacherDutyUnmatchedCount", String(unmatched.length));
    setOptionalText("teacherDutyMismatchCount", String(mismatched.length));
    setOptionalText("teacherDutyFeeTotal", `${Math.round(totalFee).toLocaleString()} JPY`);

    const tbody = document.getElementById("teacherDutyImportResultTable");
    if (!tbody) return;

    tbody.innerHTML = result.items.map(item => {
      const r = item.importRow;
      const statusText = item.status === "matched" ? "匹配成功" : item.status === "mismatch" ? "时长不一致" : "未匹配";
      const statusClass = item.status === "matched" ? "" : item.status === "mismatch" ? "yellow" : "red";
      return `
        <tr>
          <td>${badge(statusText, statusClass)}</td>
          <td>${r.rowNo}</td>
          <td>${esc(r.student)}</td>
          <td>${esc(r.date)}</td>
          <td>${esc([r.start, r.end].filter(Boolean).join(" - "))}</td>
          <td>${r.hours || 0}</td>
          <td>${item.systemHours ?? ""}</td>
          <td>${Math.round(n(r.transport)).toLocaleString()}</td>
          <td>${Math.round(n(r.classroom)).toLocaleString()}</td>
          <td>${esc(item.message || r.note || "")}</td>
        </tr>
      `;
    }).join("");
  }

  async function readWorkbook(file) {
    if (!window.ExcelJS) throw new Error("Excel 读取库还没有加载完成，请稍后重试。");

    const buffer = await file.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    return wb;
  }

  async function importDutyTemplate(file) {
    try {
      const wb = await readWorkbook(file);
      const ws = wb.worksheets[0];
      if (!ws) throw new Error("Excel 文件中没有工作表。");

      const teacherName = readTeacherName(ws);
      const importRows = readDutyRows(ws);
      const systemRows = currentSystemRows();
      const usedKeys = new Set();

      if (!importRows.length) {
        showMessage("没有读取到勤务明细。", "error");
        return;
      }

      const items = importRows.map(importRow => {
        const match = findMatch(importRow, teacherName, systemRows, usedKeys);
        if (!match) {
          return {
            status: "unmatched",
            importRow,
            message: "系统当前筛选范围中找不到对应课时。请确认月份、老师、学生、日期和时间。",
          };
        }

        usedKeys.add(match.rowKey);
        const systemHours = n(match.wage?.hours);
        if (!compareHours(importRow.hours, systemHours)) {
          return {
            status: "mismatch",
            importRow,
            match,
            systemHours,
            message: "老师申报时长与系统工资课时不一致。",
          };
        }

        return {
          status: "matched",
          importRow,
          match,
          systemHours,
          message: "",
        };
      });

      lastImportResult = { fileName: file.name, teacherName, items };
      renderResult(lastImportResult);

      const hasProblem = items.some(x => x.status !== "matched");
      showMessage(hasProblem ? "导入完成，但存在未匹配或时长不一致，请确认。": "导入核对完成，全部匹配。", hasProblem ? "error" : "ok");
    } catch (error) {
      console.error(error);
      showMessage(`读取勤务申报表失败：${error.message || error}`, "error");
    }
  }

  function applyImportResult() {
    if (!lastImportResult) {
      showMessage("没有可应用的导入结果。", "error");
      return;
    }

    const matched = lastImportResult.items.filter(x => x.status === "matched" && x.match);
    if (!matched.length) {
      showMessage("没有匹配成功的记录可以应用。", "error");
      return;
    }

    const updates = matched.map(item => ({
      rowKey: item.match.rowKey,
      transport: item.importRow.transport,
      classroom: item.importRow.classroom,
    }));

    const result = window.SchoolTeacherWagesModule?.applyFeeOverridesFromDutyImport?.(updates);
    showMessage(`已应用 ${result?.applied || updates.length} 条交通费 / 教室费。请确认工资合计后再锁定。`, "ok");
  }

  function bindImportButton() {
    const btn = document.getElementById("teacherDutyTemplateImportBtn");
    const input = document.getElementById("teacherDutyTemplateImportInput");
    if (!btn || !input || btn.dataset.boundTeacherDutyImport === "true") return;

    btn.dataset.boundTeacherDutyImport = "true";
    btn.addEventListener("click", () => input.click());
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      input.value = "";
      if (file) importDutyTemplate(file);
    });
  }

  const switchPageBeforeV970 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV970) {
    window.switchPage = function(page) {
      switchPageBeforeV970(page);
      if (page === "teacher-wages") setTimeout(bindImportButton, 0);
    };
  }

  const renderAllBeforeV970 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV970) {
    window.renderAll = function() {
      renderAllBeforeV970();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        setTimeout(bindImportButton, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(bindImportButton, 1000);
  });

  window.SchoolTeacherDutyTemplateImportV970 = {
    version: "9.7.0",
    importDutyTemplate,
    applyImportResult,
    lastResult: () => lastImportResult,
  };
})();
