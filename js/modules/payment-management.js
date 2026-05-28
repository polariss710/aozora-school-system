// === v9.4.1 payment management module ===
// 支付管理页面：显示 9.2 工资锁定后生成的支付要求。
// 本版标记已支付时会生成支出记录，并联动账户余额。

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
      reversed: "已撤销",
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
    if (value === "reversed") return badge("已撤销", "gray");
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

  async function renderPaymentSummaryFromRpc() {
    const month = document.getElementById("paymentMonthFilter")?.value || null;
    const status = document.getElementById("paymentStatusFilter")?.value || null;
    const sourceType = document.getElementById("paymentSourceTypeFilter")?.value || null;
    const businessId = document.getElementById("paymentBusinessFilter")?.value || null;
    const currency = document.getElementById("paymentCurrencyFilter")?.value || null;

    const { data, error } = await db.rpc("school_get_payment_management_summary", {
      p_request_month: month,
      p_status: status,
      p_source_type: sourceType,
      p_business_entity_id: businessId,
      p_currency: currency,
    });

    if (error) {
      console.warn("payment summary rpc failed", error);
      showMessage(`支付汇总读取失败：${error.message}`, "error");
      return;
    }

    const summary = Array.isArray(data) ? data[0] : data;
    if (!summary) return;

    setOptionalText("paymentPendingTotal", `${fmtAmount(summary.pending_amount_jpy, "JPY")} / ${fmtAmount(summary.pending_amount_cny, "CNY")}`);
    setOptionalText("paymentPaidTotal", `${fmtAmount(summary.paid_amount_jpy, "JPY")} / ${fmtAmount(summary.paid_amount_cny, "CNY")}`);
    setOptionalText("paymentFilteredTotal", `${fmtAmount(summary.filtered_amount_jpy, "JPY")} / ${fmtAmount(summary.filtered_amount_cny, "CNY")}`);
    setOptionalText("paymentRecordCount", String(summary.record_count || 0));
  }

  function renderPayments() {
    fillFilters();

    const rows = filteredRows();
    renderPaymentSummaryFromRpc();

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
            ${row.status === "paid" ? `<button class="danger-btn payment-mini-btn" data-payment-reverse="${escAttr(row.id)}">撤销支付</button>` : ""}
            ${row.status === "cancelled" ? `<button class="secondary-btn payment-mini-btn" data-payment-pending="${escAttr(row.id)}">恢复待支付</button>` : ""}
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

    document.querySelectorAll("[data-payment-reverse]").forEach(btn => {
      if (btn.dataset.boundPayment === "true") return;
      btn.dataset.boundPayment = "true";
      btn.addEventListener("click", () => reversePaidPayment(btn.dataset.paymentReverse));
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

  function activeAccountsForPayment(payment) {
    const currency = payment?.currency || "";
    const businessId = payment?.business_entity_id || "";
    const active = (state.accounts || []).filter(x => x.is_active !== false);

    const matched = active.filter(x =>
      (!currency || x.currency === currency) &&
      (!businessId || !x.business_entity_id || x.business_entity_id === businessId)
    );

    return matched.length ? matched : active.filter(x => !currency || x.currency === currency);
  }

  function ensurePaymentConfirmModal() {
    if (document.getElementById("paymentConfirmModal")) return;

    document.body.insertAdjacentHTML("beforeend", `
      <div class="modal hidden" id="paymentConfirmModal">
        <div class="modal-backdrop" id="paymentConfirmBackdrop"></div>
        <div class="modal-panel payment-confirm-card">
          <div class="modal-header">
            <h3>确认支付</h3>
            <button type="button" class="icon-btn" id="paymentConfirmCloseBtn">×</button>
          </div>
          <form id="paymentConfirmForm" class="modal-form">
            <input type="hidden" id="paymentConfirmId" />
            <label class="form-row">
              <span>支付对象</span>
              <input id="paymentConfirmPayee" type="text" readonly />
            </label>
            <label class="form-row">
              <span>业务归属</span>
              <input id="paymentConfirmBusiness" type="text" readonly />
            </label>
            <label class="form-row">
              <span>支付账户</span>
              <select id="paymentConfirmAccount" required></select>
            </label>
            <label class="form-row">
              <span>支付日期</span>
              <input id="paymentConfirmDate" type="date" required />
            </label>
            <label class="form-row">
              <span>币种</span>
              <input id="paymentConfirmCurrency" type="text" readonly />
            </label>
            <label class="form-row">
              <span>支付金额</span>
              <input id="paymentConfirmAmount" type="number" step="0.01" required />
            </label>
            <label class="form-row">
              <span>日元金额</span>
              <input id="paymentConfirmAmountJpy" type="number" step="1" readonly />
            </label>
            <label class="form-row">
              <span>人民币金额</span>
              <input id="paymentConfirmAmountCny" type="number" step="0.01" readonly />
            </label>
            <label class="form-row full">
              <span>备注</span>
              <textarea id="paymentConfirmNote" rows="3"></textarea>
            </label>
            <div class="form-actions">
              <button type="button" class="secondary-btn" id="paymentConfirmCancelBtn">取消</button>
              <button type="submit" class="primary-btn">确认支付并生成支出记录</button>
            </div>
          </form>
        </div>
      </div>
    `);

    document.getElementById("paymentConfirmCloseBtn")?.addEventListener("click", closePaymentConfirmModal);
    document.getElementById("paymentConfirmCancelBtn")?.addEventListener("click", closePaymentConfirmModal);
    document.getElementById("paymentConfirmBackdrop")?.addEventListener("click", closePaymentConfirmModal);
    document.getElementById("paymentConfirmForm")?.addEventListener("submit", submitPaymentConfirm);
  }

  function openPaymentConfirmModal(id) {
    const payment = paymentRequests.find(x => String(x.id) === String(id));
    if (!payment) {
      showMessage("找不到支付要求。", "error");
      return;
    }

    ensurePaymentConfirmModal();

    const accounts = activeAccountsForPayment(payment);
    const accountSelect = document.getElementById("paymentConfirmAccount");
    if (accountSelect) {
      accountSelect.innerHTML = accounts.length
        ? accounts.map(x => `<option value="${escAttr(x.id)}">${esc(x.name || "")} / ${esc(x.currency || "")}${x.business_entity?.name ? " / " + esc(x.business_entity.name) : ""}</option>`).join("")
        : `<option value="">没有可用账户</option>`;
    }

    document.getElementById("paymentConfirmId").value = payment.id;
    document.getElementById("paymentConfirmPayee").value = payment.payee_name || "";
    document.getElementById("paymentConfirmBusiness").value = payment.business_name || "";
    document.getElementById("paymentConfirmDate").value = new Date().toISOString().slice(0, 10);
    document.getElementById("paymentConfirmCurrency").value = payment.currency || "";
    document.getElementById("paymentConfirmAmount").value = String(n(payment.amount));
    document.getElementById("paymentConfirmAmountJpy").value = String(Math.round(n(payment.amount_jpy)));
    document.getElementById("paymentConfirmAmountCny").value = String(Math.round(n(payment.amount_cny) * 100) / 100);
    document.getElementById("paymentConfirmNote").value = payment.note || "";

    const modal = document.getElementById("paymentConfirmModal");
    modal?.classList.remove("hidden");
  }

  function closePaymentConfirmModal() {
    document.getElementById("paymentConfirmModal")?.classList.add("hidden");
  }

  async function submitPaymentConfirm(e) {
    e.preventDefault();

    const id = document.getElementById("paymentConfirmId")?.value || "";
    const payment = paymentRequests.find(x => String(x.id) === String(id));
    if (!payment) {
      showMessage("找不到支付要求。", "error");
      return;
    }

    const accountId = document.getElementById("paymentConfirmAccount")?.value || "";
    const payDate = document.getElementById("paymentConfirmDate")?.value || new Date().toISOString().slice(0, 10);
    const amount = n(document.getElementById("paymentConfirmAmount")?.value);
    const note = document.getElementById("paymentConfirmNote")?.value || "";

    if (!accountId) {
      showMessage("请选择支付账户。", "error");
      return;
    }
    if (!amount) {
      showMessage("支付金额不能为 0。", "error");
      return;
    }

    const ok = confirm("确定支付并生成支出记录吗？\n\n保存后会减少所选账户余额。");
    if (!ok) return;

    const { error } = await db.rpc("school_confirm_payment_request", {
      p_payment_request_id: id,
      p_account_id: accountId,
      p_pay_date: payDate,
      p_amount: amount,
      p_note: note || null,
      p_payment_method: "bank_transfer",
    });

    if (error) {
      console.error("payment confirm rpc failed", error);
      showMessage(`支付失败：${error.message}`, "error");
      await loadAll();
      await loadPaymentRequests();
      return;
    }

    closePaymentConfirmModal();
    await loadAll();
    await loadPaymentRequests();
    showMessage("支付完成，已生成支出记录并更新账户余额。", "ok");
  }

  async function markPaymentPaid(id) {
    openPaymentConfirmModal(id);
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
    const payment = paymentRequests.find(x => String(x.id) === String(id));
    if (!payment || payment.status !== "cancelled") {
      showMessage("只有已取消的支付要求可以恢复为待支付。", "error");
      return;
    }

    const ok = confirm("确定恢复为待支付吗？");
    if (!ok) return;

    await updatePayment(id, {
      status: "pending",
      paid_at: null,
    }, "已恢复为待支付。");
  }

  async function reversePaidPayment(id) {
    const payment = paymentRequests.find(x => String(x.id) === String(id));
    if (!payment || payment.status !== "paid") {
      showMessage("只有已支付的支付要求可以撤销。", "error");
      return;
    }

    const ok = confirm("撤销支付会生成反向账户流水，并恢复账户余额。\n原支付记录、支出记录和原账户流水会保留作为历史。\n是否继续？");
    if (!ok) return;

    const reason = prompt("请输入撤销原因（可空）：", "");
    if (reason === null) return;

    const { error } = await db.rpc("school_reverse_paid_payment_request", {
      p_payment_request_id: id,
      p_reason: reason || null,
      p_reverse_date: new Date().toISOString().slice(0, 10),
    });

    if (error) {
      console.error("payment reverse rpc failed", error);
      showMessage(`撤销支付失败：${error.message}`, "error");
      await loadAll();
      await loadPaymentRequests();
      return;
    }

    await loadAll();
    await loadPaymentRequests();
    showMessage("支付已撤销，账户余额已恢复。", "ok");
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
    version: "9.4.1",
    load: loadPaymentRequests,
    render: renderPayments,
    rows: () => paymentRequests,
  };
})();
