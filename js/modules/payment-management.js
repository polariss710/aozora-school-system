// === v9.3.1 payment management module ===
// 支付管理页面：显示 9.2 工资锁定后生成的支付要求。
// 本版只管理支付要求状态，不生成实际账户流水；实际支付记录联动放到后续版本。

(function () {
  const TABLE = "school_payment_requests";
  let paymentRequests = [];

  function n(value) {
    const x = Number(value || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  function fmtAmount(value, currency) {
    const amount = currency === "CNY" ? Math.round(n(value) * 100) / 100 : Math.round(n(value));
    return `${amount.toLocaleString()} ${currency || ""}`.trim();
  }

  function statusLabel(value) {
    const map = {
      pending: "待支付",
      paid: "已支付",
      cancelled: "已取消",
      void: "已作废",
    };
    return map[value] || value || "";
  }

  function sourceTypeLabel(value) {
    const map = {
      teacher_wage: "老师工资",
    };
    return map[value] || value || "";
  }

  function statusBadge(value) {
    if (value === "paid") return badge("已支付");
    if (value === "pending") return badge("待支付", "yellow");
    if (value === "cancelled") return badge("已取消", "gray");
    if (value === "void") return badge("已作废", "gray");
    return badge(value || "", "gray");
  }

  function fillFilters() {
    const month = document.getElementById("paymentMonthFilter");
    if (month && !month.value) month.value = currentMonth();

    const business = document.getElementById("paymentBusinessFilter");
    if (business) {
      const old = business.value;
      business.innerHTML = `<option value="">全部业务归属</option>` + (state.businessEntities || [])
        .map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")}</option>`)
        .join("");
      business.value = old;
    }
  }

  async function loadPaymentRequests() {
    const { data, error } = await db
      .from(TABLE)
      .select("*")
      .order("request_month", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      showMessage(`读取支付要求失败：${error.message}`, "error");
      paymentRequests = [];
      renderPayments();
      return;
    }

    paymentRequests = data || [];
    renderPayments();
  }

  function filteredRows() {
    const month = document.getElementById("paymentMonthFilter")?.value || "";
    const status = document.getElementById("paymentStatusFilter")?.value || "";
    const sourceType = document.getElementById("paymentSourceTypeFilter")?.value || "";
    const businessId = document.getElementById("paymentBusinessFilter")?.value || "";
    const currency = document.getElementById("paymentCurrencyFilter")?.value || "";

    return paymentRequests.filter(row =>
      (!month || row.request_month === month) &&
      (status ? row.status === status : row.status !== "void") &&
      (!sourceType || row.source_type === sourceType) &&
      (!businessId || row.business_entity_id === businessId) &&
      (!currency || row.currency === currency)
    );
  }

  function renderSummary(rows) {
    const pending = rows.filter(x => x.status === "pending");
    const paid = rows.filter(x => x.status === "paid");

    const pendingJpy = pending.reduce((s, x) => s + n(x.amount_jpy), 0);
    const pendingCny = pending.reduce((s, x) => s + n(x.amount_cny), 0);
    const paidJpy = paid.reduce((s, x) => s + n(x.amount_jpy), 0);
    const paidCny = paid.reduce((s, x) => s + n(x.amount_cny), 0);
    const totalJpy = rows.reduce((s, x) => s + n(x.amount_jpy), 0);
    const totalCny = rows.reduce((s, x) => s + n(x.amount_cny), 0);

    setOptionalText("paymentPendingTotal", `${fmtAmount(pendingJpy, "JPY")} / ${fmtAmount(pendingCny, "CNY")}`);
    setOptionalText("paymentPaidTotal", `${fmtAmount(paidJpy, "JPY")} / ${fmtAmount(paidCny, "CNY")}`);
    setOptionalText("paymentFilteredTotal", `${fmtAmount(totalJpy, "JPY")} / ${fmtAmount(totalCny, "CNY")}`);
    setOptionalText("paymentRecordCount", String(rows.length));
  }

  function renderPayments() {
    fillFilters();

    const rows = filteredRows();
    renderSummary(rows);

    const tbody = document.getElementById("paymentRequestsTable");
    if (!tbody) return;

    tbody.innerHTML = rows.length ? rows.map(row => `
      <tr>
        <td>${esc(row.request_month || "")}</td>
        <td>${esc(sourceTypeLabel(row.source_type))}</td>
        <td>${esc(row.payee_name || "")}</td>
        <td>${esc(row.business_name || "")}</td>
        <td>${esc(row.currency || "")}</td>
        <td><strong>${fmtAmount(row.amount, row.currency)}</strong></td>
        <td>${fmtAmount(row.amount_jpy, "JPY")}</td>
        <td>${fmtAmount(row.amount_cny, "CNY")}</td>
        <td>${statusBadge(row.status)}</td>
        <td>${esc((row.paid_at || "").slice(0, 16).replace("T", " "))}</td>
        <td>${esc(short(row.note || "", 24))}</td>
        <td>
          <div class="table-actions">
            ${row.status === "pending" ? `<button class="primary-btn payment-mini-btn" data-payment-paid="${escAttr(row.id)}">标记已支付</button>` : ""}
            ${row.status === "pending" ? `<button class="danger-btn payment-mini-btn" data-payment-cancel="${escAttr(row.id)}">取消</button>` : ""}
            ${row.status === "paid" || row.status === "cancelled" ? `<button class="secondary-btn payment-mini-btn" data-payment-pending="${escAttr(row.id)}">恢复待支付</button>` : ""}
          </div>
        </td>
      </tr>
    `).join("") : `<tr><td colspan="12" class="empty-row">当前条件下没有支付要求</td></tr>`;

    bindPaymentRowActions();
  }

  function bindPaymentRowActions() {
    document.querySelectorAll("[data-payment-paid]").forEach(btn => {
      if (btn.dataset.boundPayment === "true") return;
      btn.dataset.boundPayment = "true";
      btn.addEventListener("click", () => markPaymentPaid(btn.dataset.paymentPaid));
    });

    document.querySelectorAll("[data-payment-cancel]").forEach(btn => {
      if (btn.dataset.boundPayment === "true") return;
      btn.dataset.boundPayment = "true";
      btn.addEventListener("click", () => cancelPayment(btn.dataset.paymentCancel));
    });

    document.querySelectorAll("[data-payment-pending]").forEach(btn => {
      if (btn.dataset.boundPayment === "true") return;
      btn.dataset.boundPayment = "true";
      btn.addEventListener("click", () => restorePaymentPending(btn.dataset.paymentPending));
    });
  }

  async function updatePayment(id, payload, successMessage) {
    const { error } = await db
      .from(TABLE)
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      showMessage(`更新支付要求失败：${error.message}`, "error");
      return;
    }

    showMessage(successMessage, "ok");
    await loadPaymentRequests();
  }

  async function markPaymentPaid(id) {
    const ok = confirm("确定将这条支付要求标记为已支付吗？\n\n本版只更新支付状态，实际账户流水联动将在后续版本处理。");
    if (!ok) return;

    await updatePayment(id, {
      status: "paid",
      paid_at: new Date().toISOString(),
    }, "已标记为已支付。");
  }

  async function cancelPayment(id) {
    const ok = confirm("确定取消这条支付要求吗？");
    if (!ok) return;

    await updatePayment(id, {
      status: "cancelled",
      paid_at: null,
    }, "已取消支付要求。");
  }

  async function restorePaymentPending(id) {
    const ok = confirm("确定恢复为待支付吗？");
    if (!ok) return;

    await updatePayment(id, {
      status: "pending",
      paid_at: null,
    }, "已恢复为待支付。");
  }

  function bindPayments() {
    fillFilters();

    ["paymentMonthFilter", "paymentStatusFilter", "paymentSourceTypeFilter", "paymentBusinessFilter", "paymentCurrencyFilter"].forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.boundPaymentFilter === "true") return;
      el.dataset.boundPaymentFilter = "true";
      el.addEventListener("change", renderPayments);
    });

    const clear = document.getElementById("paymentClearFilter");
    if (clear && clear.dataset.boundPaymentFilter !== "true") {
      clear.dataset.boundPaymentFilter = "true";
      clear.addEventListener("click", () => {
        const month = document.getElementById("paymentMonthFilter");
        const status = document.getElementById("paymentStatusFilter");
        const source = document.getElementById("paymentSourceTypeFilter");
        const business = document.getElementById("paymentBusinessFilter");
        const currency = document.getElementById("paymentCurrencyFilter");
        if (month) month.value = currentMonth();
        if (status) status.value = "";
        if (source) source.value = "";
        if (business) business.value = "";
        if (currency) currency.value = "";
        renderPayments();
      });
    }

    const refresh = document.getElementById("paymentRefreshBtn");
    if (refresh && refresh.dataset.boundPaymentRefresh !== "true") {
      refresh.dataset.boundPaymentRefresh = "true";
      refresh.addEventListener("click", loadPaymentRequests);
    }

    loadPaymentRequests();
  }

  const switchPageBeforeV930 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV930) {
    window.switchPage = function(page) {
      switchPageBeforeV930(page);
      if (page === "payments") {
        const title = document.getElementById("pageTitle");
        const subtitle = document.getElementById("pageSubtitle");
        if (title) title.textContent = "支付管理";
        if (subtitle) subtitle.textContent = "管理工资锁定后生成的待支付要求";
        setTimeout(bindPayments, 0);
      }
    };
  }

  const renderAllBeforeV930 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV930) {
    window.renderAll = function() {
      renderAllBeforeV930();
      if (document.getElementById("page-payments")?.classList.contains("active")) {
        setTimeout(bindPayments, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-payments")?.classList.contains("active")) bindPayments();
    }, 1000);
  });

  window.SchoolPaymentManagementV930 = {
    version: "9.3.1",
    load: loadPaymentRequests,
    render: renderPayments,
    rows: () => paymentRequests,
  };
})();
