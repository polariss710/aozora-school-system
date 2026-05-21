// === v9.0 income.js ===
// 收入记录模块边界。后续学费收入校验、学生关联逻辑迁移到这里。
window.SchoolModules = window.SchoolModules || {};
window.SchoolModules["income.js"] = { version: "9.0", migrated: false };

// === v9.0.4 income mini stats fix ===
// 收入记录顶部统计栏兜底修复。
// 部分历史数据使用 payment_currency / payment_amount / status中文值，旧统计只看 currency/amount/status，可能显示为0。

(function () {
  function amountOf(row) {
    const value = row?.amount ?? row?.payment_amount ?? row?.received_amount ?? 0;
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  }

  function currencyOf(row) {
    return row?.currency || row?.payment_currency || row?.actual_currency || "JPY";
  }

  function isReceived(row) {
    const s = String(row?.status || "").trim();
    return s === "received" || s === "已收" || s === "paid" || s === "已支付";
  }

  function isPending(row) {
    const s = String(row?.status || "").trim();
    return s === "pending" || s === "未收" || s === "unpaid" || s === "未支付";
  }

  function totalsByCurrency(rows) {
    const totals = {};
    (rows || []).forEach(row => {
      const c = currencyOf(row);
      totals[c] = (totals[c] || 0) + amountOf(row);
    });
    return totals;
  }

  function formatTotals(totals) {
    const order = ["JPY", "CNY"];
    const parts = [];
    order.forEach(c => {
      if (totals[c]) {
        const suffix = c === "JPY" ? "JPY" : "CNY";
        parts.push(`${Math.round(totals[c]).toLocaleString()} ${suffix}`);
      }
    });
    Object.keys(totals).filter(c => !order.includes(c) && totals[c]).forEach(c => {
      parts.push(`${Math.round(totals[c]).toLocaleString()} ${c}`);
    });
    return parts.length ? parts.join(" / ") : "0";
  }

  function renderIncomeMiniStatsV904(rows) {
    const list = rows || [];
    const received = list.filter(isReceived);
    const pending = list.filter(isPending);

    setOptionalText("incomeTotalAmount", formatTotals(totalsByCurrency(list)));
    setOptionalText("incomeReceivedAmount", formatTotals(totalsByCurrency(received)));
    setOptionalText("incomePendingAmount", formatTotals(totalsByCurrency(pending)));
    setOptionalText("incomeRecordCount", String(list.length));
  }

  const renderFinanceMiniStatsBeforeV904 = typeof renderFinanceMiniStats === "function" ? renderFinanceMiniStats : null;
  window.renderFinanceMiniStats = function(type, rows) {
    if (type === "income") {
      renderIncomeMiniStatsV904(rows);
      return;
    }
    if (renderFinanceMiniStatsBeforeV904) return renderFinanceMiniStatsBeforeV904(type, rows);
  };

  const renderIncomeTableBeforeV904 = typeof renderIncomeTable === "function" ? renderIncomeTable : null;
  if (renderIncomeTableBeforeV904) {
    window.renderIncomeTable = function() {
      renderIncomeTableBeforeV904();
      const rows = typeof filterFinanceRows === "function"
        ? filterFinanceRows(state.incomeRecords || [], "income")
        : (state.incomeRecords || []);
      renderIncomeMiniStatsV904(rows);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-income")?.classList.contains("active")) {
        const rows = typeof filterFinanceRows === "function"
          ? filterFinanceRows(state.incomeRecords || [], "income")
          : (state.incomeRecords || []);
        renderIncomeMiniStatsV904(rows);
      }
    }, 1000);
  });
})();
