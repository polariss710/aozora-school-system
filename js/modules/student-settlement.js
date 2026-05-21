// === v9.0.2 student settlement statistics scope ===
// 月度结算统计口径与课时管理顶部统计口径统一。
// planned: 所有预定课时都计入预定课时/预定课时费，包括取消课。
// actual: 实际课时 + 待补课且计费的预定课时；取消课、不计费补课不计入。

(function () {
  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function lessonHours(row) {
    return n(row?.duration_hours);
  }

  function lessonFee(row, hours = lessonHours(row)) {
    return n(row?.unit_price) * n(hours);
  }

  function statusOf(row) {
    return String(row?.status || "").trim();
  }

  function isPendingMakeup(row) {
    const s = statusOf(row);
    return s === "pending_makeup" || s === "待补课" || s === "待补";
  }

  function isCancelled(row) {
    const s = statusOf(row);
    return s === "cancelled" || s === "取消课" || s === "取消";
  }

  function isActualSettlementStatus(row) {
    if (!row || row.lesson_type !== "actual") return false;
    if (isCancelled(row)) return false;
    const s = statusOf(row);
    return (
      s === "completed" ||
      s === "makeup_completed" ||
      s === "makeup" ||
      s === "已上课" ||
      s === "已补课" ||
      s === "已上" ||
      s === "已补" ||
      !s
    );
  }

  function settlementAllLessons(studentId, month) {
    return (state.lessonRecords || []).filter(row =>
      row.student_id === studentId &&
      row.year_month === month
    );
  }

  function settlementPlannedRows(studentId, month) {
    return settlementAllLessons(studentId, month).filter(row => row.lesson_type === "planned");
  }

  function settlementActualRows(studentId, month) {
    return settlementAllLessons(studentId, month).filter(row => row.lesson_type === "actual" && isActualSettlementStatus(row));
  }

  function settlementPendingBillableRows(studentId, month) {
    return settlementPlannedRows(studentId, month).filter(row => isPendingMakeup(row) && row.is_billable !== false);
  }

  function settlementStats(studentId, month) {
    const planned = settlementPlannedRows(studentId, month);
    const actual = settlementActualRows(studentId, month);
    const pendingBillable = settlementPendingBillableRows(studentId, month);

    const plannedHours = planned.reduce((sum, row) => sum + lessonHours(row), 0);
    const plannedJpy = planned.reduce((sum, row) => sum + lessonFee(row), 0);

    const actualHoursBase = actual.reduce((sum, row) => sum + lessonHours(row), 0);
    const actualJpyBase = actual
      .filter(row => row.is_billable !== false)
      .reduce((sum, row) => sum + lessonFee(row), 0);

    const pendingHours = pendingBillable.reduce((sum, row) => sum + lessonHours(row), 0);
    const pendingJpy = pendingBillable.reduce((sum, row) => sum + lessonFee(row), 0);

    return {
      planned,
      actual,
      pendingBillable,
      plannedHours,
      plannedJpy,
      actualHours: actualHoursBase + pendingHours,
      actualJpy: actualJpyBase + pendingJpy,
    };
  }

  function moneyText(value) {
    if (typeof money === "function") return money(value);
    const x = Number(value || 0);
    return Number.isInteger(x) ? String(x) : String(Math.round(x * 100) / 100);
  }

  // 锁定结算区域也同步使用新口径。
  window.sumLessonsForSettlementV87 = function (studentId, month, type) {
    const stats = settlementStats(studentId, month);
    if (type === "planned") return stats.plannedJpy;
    return stats.actualJpy;
  };

  window.renderStudentSettlementV902 = function () {
    fillStudentSelectV83("settlementStudentFilter");

    const month = document.getElementById("settlementMonthFilter")?.value || currentYearMonth();
    const studentId = document.getElementById("settlementStudentFilter")?.value || "";
    const student = (state.students || []).find(row => row.id === studentId);
    const hint = document.getElementById("settlementStudentHint");

    if (hint) {
      hint.classList.toggle("ok", !!studentId && !!student && Number(student.preset_exchange_rate || 0) > 0);
      hint.textContent = !studentId ? "学生必选" : (rateErrorTextV834(student) || "已选择学生");
    }

    if (!studentId || !student) {
      [
        "settlementPlannedHours", "settlementActualHours", "settlementPlannedJpy", "settlementActualJpy",
        "settlementPrevBalanceCny", "settlementExchangeRate", "settlementPlannedJpy2", "settlementPlannedCny",
        "settlementPlannedTotalCny", "settlementActualJpy2", "settlementActualCny", "settlementReceivedCny", "settlementReceivedJpy"
      ].forEach(id => setOptionalText(id, "0"));

      const tbody = document.getElementById("settlementLessonsTable");
      if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="empty-row">请先选择学生</td></tr>`;
      return;
    }

    const rate = Number(student.preset_exchange_rate || 0);
    if (rate <= 0) showMessage(rateErrorTextV834(student), "error");

    const stats = settlementStats(studentId, month);
    const prevBalanceCny = Number(student.previous_balance_cny || 0);

    const plannedJpy = stats.plannedJpy;
    const actualJpy = stats.actualJpy;
    const plannedCny = plannedJpy * rate;
    const actualCny = actualJpy * rate;
    const plannedTotalCny = plannedCny - prevBalanceCny;

    const receivedCny = sumIncomeV83(studentId, month, "CNY");
    const receivedJpy = sumIncomeV83(studentId, month, "JPY");

    setOptionalText("settlementPlannedHours", moneyText(stats.plannedHours));
    setOptionalText("settlementActualHours", moneyText(stats.actualHours));
    setOptionalText("settlementPlannedJpy", formatJpyV83(plannedJpy));
    setOptionalText("settlementActualJpy", formatJpyV83(actualJpy));

    setOptionalText("settlementPrevBalanceCny", formatCnyV83(prevBalanceCny));
    setOptionalText("settlementExchangeRate", moneyText(rate));
    setOptionalText("settlementPlannedJpy2", formatJpyV83(plannedJpy));
    setOptionalText("settlementPlannedCny", formatCnyV83(plannedCny));
    setOptionalText("settlementPlannedTotalCny", formatCnyV83(plannedTotalCny));

    setOptionalText("settlementActualJpy2", formatJpyV83(actualJpy));
    setOptionalText("settlementActualCny", formatCnyV83(actualCny));
    setOptionalText("settlementReceivedCny", formatCnyV83(receivedCny));
    setOptionalText("settlementReceivedJpy", formatCnyV83(receivedJpy));

    // 明细表仍然显示全部预定课时，实际侧显示真实实际课时。
    // 待补课且计费已纳入统计，但不会伪造实际课时行。
    renderSettlementPairedLessonsV834(stats.planned, stats.actual);

    if (typeof updateSettlementLockPreviewV87 === "function") {
      setTimeout(updateSettlementLockPreviewV87, 0);
    }
  };

  window.renderStudentSettlement = window.renderStudentSettlementV902;
  window.renderStudentSettlementV834 = window.renderStudentSettlementV902;
  window.renderStudentSettlementV889 = window.renderStudentSettlementV902;

  window.bindStudentSettlementV902 = function () {
    if (typeof fillStudentSelectV83 === "function") fillStudentSelectV83("settlementStudentFilter");

    const refresh = document.getElementById("settlementRefreshBtn");
    if (refresh) refresh.onclick = window.renderStudentSettlementV902;

    const month = document.getElementById("settlementMonthFilter");
    if (month) month.onchange = window.renderStudentSettlementV902;

    const student = document.getElementById("settlementStudentFilter");
    if (student) student.onchange = window.renderStudentSettlementV902;

    window.renderStudentSettlementV902();
  };

  window.bindStudentSettlementV834 = window.bindStudentSettlementV902;
  window.bindStudentSettlementV889 = window.bindStudentSettlementV902;

  const switchPageBeforeV902 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV902) {
    window.switchPage = function (page) {
      switchPageBeforeV902(page);
      if (page === "student-settlement") setTimeout(window.bindStudentSettlementV902, 0);
    };
  }

  const renderAllBeforeV902 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV902) {
    window.renderAll = function () {
      renderAllBeforeV902();
      if (document.getElementById("page-student-settlement")?.classList.contains("active")) {
        setTimeout(window.bindStudentSettlementV902, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-student-settlement")?.classList.contains("active")) {
        window.bindStudentSettlementV902();
      }
    }, 1000);
  });

  window.debugStudentSettlementStatsV902 = settlementStats;
})();
