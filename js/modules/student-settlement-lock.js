// === student settlement lock readonly panel ===
// Owns the lock panel display, preview, lock-state history, and button state.

const STUDENT_SETTLEMENT_LOCK_TABLE = "school_student_monthly_settlements";
const STUDENT_SETTLEMENT_CARRYOVER_TABLE = "school_student_settlement_carryovers";
const STUDENT_SETTLEMENT_SUMMARY_RPC = "school_get_student_monthly_settlement_summary";
let studentSettlementLockHistoryRequest = 0;

function settlementLockDbClient() {
  if (typeof db !== "undefined" && db?.from) return db;
  if (typeof supabase !== "undefined" && supabase?.from) return supabase;
  if (window.db?.from) return window.db;
  if (window.supabase?.from) return window.supabase;
  return null;
}

function settlementLockEsc(value) {
  if (typeof esc === "function") return esc(value);
  return String(value ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function settlementLockRoundCny(value) {
  return Math.round(Number(value || 0));
}

function settlementLockSignedCny(value) {
  const n = settlementLockRoundCny(value);
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toLocaleString()} CNY`;
}

function settlementLockStatusLabel(value) {
  const n = settlementLockRoundCny(value);
  if (n > 0) return "需补交";
  if (n < 0) return "有结余";
  return "已结清";
}

function settlementLockStatusClass(value) {
  const n = settlementLockRoundCny(value);
  if (n > 0) return "due";
  if (n < 0) return "credit";
  return "clear";
}

function settlementLockContext() {
  const month = document.getElementById("settlementMonthFilter")?.value || (typeof currentYearMonth === "function" ? currentYearMonth() : new Date().toISOString().slice(0, 7));
  const studentId = document.getElementById("settlementStudentFilter")?.value || "";
  return { month, studentId };
}

function nextSettlementMonth(ym) {
  const [y, m] = String(ym || "").split("-").map(Number);
  if (!y || !m) return "";
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function upsertStudentCarryover(client, snapshot, settlementId = null) {
  if (!client || !snapshot) return;
  const toMonth = nextSettlementMonth(snapshot.year_month);
  if (!toMonth) return;

  const payload = {
    student_id: snapshot.student_id,
    from_year_month: snapshot.year_month,
    to_year_month: toMonth,
    amount_cny: Number(snapshot.carryover_amount_cny || 0),
    source_settlement_id: settlementId || null,
    source_settlement_month: snapshot.year_month,
    status: "active",
    note: snapshot.adjustment_reason || "",
    updated_at: new Date().toISOString(),
  };

  const { error } = await client
    .from(STUDENT_SETTLEMENT_CARRYOVER_TABLE)
    .upsert(payload, { onConflict: "student_id,from_year_month,to_year_month" });

  if (error) throw error;
}

async function voidStudentCarryover(client, lock) {
  if (!client || !lock) return;
  const toMonth = nextSettlementMonth(lock.year_month);
  if (!toMonth) return;

  const { error } = await client
    .from(STUDENT_SETTLEMENT_CARRYOVER_TABLE)
    .update({
      status: "void",
      updated_at: new Date().toISOString(),
      note: "来源学生月度结算已撤销",
    })
    .eq("student_id", lock.student_id)
    .eq("from_year_month", lock.year_month)
    .eq("to_year_month", toMonth);

  if (error) throw error;
  if (window.__studentSettlementCarryoverV987 &&
    window.__studentSettlementCarryoverV987.month === toMonth &&
    window.__studentSettlementCarryoverV987.studentId === lock.student_id) {
    window.__studentSettlementCarryoverV987 = null;
  }
}

function settlementLockNormalizeSummary(row) {
  if (!row) return null;
  const num = value => {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
  };
  return {
    studentId: row.student_id,
    month: row.year_month,
    rate: num(row.exchange_rate),
    carryoverCny: num(row.carryover_cny),
    plannedHours: num(row.planned_hours),
    actualHours: num(row.actual_hours),
    plannedFeeJpy: num(row.planned_fee_jpy),
    plannedFeeCny: num(row.planned_fee_cny),
    plannedTotalCny: num(row.planned_total_cny),
    actualFeeJpy: num(row.actual_fee_jpy),
    actualFeeCny: num(row.actual_fee_cny),
    receivedJpy: num(row.received_jpy),
    receivedCny: num(row.received_cny),
    receivedEquivalentCny: num(row.received_equivalent_cny),
    finalDueCny: num(row.final_due_cny),
    lockedCarryoverCny: num(row.locked_carryover_cny ?? row.final_due_cny),
  };
}

async function refreshSettlementLockSummaryFromRpc() {
  const { month, studentId } = settlementLockContext();
  if (!studentId || !month) return null;

  const client = settlementLockDbClient();
  if (!client?.rpc) throw new Error("数据库客户端未初始化");

  const { data, error } = await client.rpc(STUDENT_SETTLEMENT_SUMMARY_RPC, {
    p_student_id: studentId,
    p_year_month: month,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const summary = settlementLockNormalizeSummary(row);
  if (!summary) return null;

  window.__studentSettlementSummaryClean = summary;
  window.__studentSettlementSummaryDbV989 = summary;
  window.__studentSettlementCarryoverV987 = {
    month: summary.month,
    studentId: summary.studentId,
    amount: summary.carryoverCny,
  };
  return summary;
}

function settlementLockHasDbSummary() {
  const { month, studentId } = settlementLockContext();
  const summary = window.__studentSettlementSummaryClean || window.__studentSettlementSummaryDbV989;
  return !!summary && summary.studentId === studentId && summary.month === month;
}

function settlementLockSnapshot(adjustment = 0, reason = "") {
  if (!settlementLockHasDbSummary()) return null;
  if (typeof computeSettlementSnapshotV87 !== "function") return null;
  return computeSettlementSnapshotV87(adjustment, reason);
}

function settlementLockMode() {
  return document.getElementById("settlementAdjustModeV87")?.value || "carry";
}

function settlementLockNormalizeAdjustmentInput(base = null) {
  const mode = settlementLockMode();
  const input = document.getElementById("settlementAdjustmentAmountV87");
  if (!input) return;

  if (mode === "carry") {
    input.value = "0";
    input.placeholder = "0";
    input.disabled = true;
    input.title = "按最终差额结转时，结转金额等于系统计算差额，不再单独修改。需要修正时请选择手动调整。";
    return;
  }

  input.disabled = false;
  input.title = "";

  if (mode === "clear") {
    if (base) input.value = String(-settlementLockRoundCny(base.system_difference_cny));
    input.placeholder = "自动抹平";
    return;
  }

  if (mode === "custom") {
    if (input.value === "0") input.value = "";
    input.placeholder = "请输入调整金额";
  }
}

function settlementLockAdjustmentFromPanel(base = null) {
  const mode = settlementLockMode();
  const input = document.getElementById("settlementAdjustmentAmountV87");
  const reason = document.getElementById("settlementAdjustmentReasonV87")?.value || "";

  if (mode === "carry") return { adjustment: 0, reason };
  if (mode === "clear") {
    const amount = input?.value === "" && base
      ? -settlementLockRoundCny(base.system_difference_cny)
      : Number(input?.value || 0);
    return { adjustment: amount, reason };
  }
  return { adjustment: Number(input?.value || 0), reason };
}

function settlementLockSnapshotPayload(snapshot) {
  return {
    student_id: snapshot.student_id,
    year_month: snapshot.year_month,
    business_entity_id: snapshot.business_entity_id || null,
    preset_exchange_rate: snapshot.preset_exchange_rate,
    planned_lesson_fee_jpy: snapshot.planned_lesson_fee_jpy,
    planned_lesson_fee_cny: snapshot.planned_lesson_fee_cny,
    actual_lesson_fee_jpy: snapshot.actual_lesson_fee_jpy,
    actual_lesson_fee_cny: snapshot.actual_lesson_fee_cny,
    previous_balance_cny: snapshot.previous_balance_cny,
    received_jpy: snapshot.received_jpy,
    received_cny: snapshot.received_cny,
    received_equivalent_cny: snapshot.received_equivalent_cny,
    system_difference_cny: snapshot.system_difference_cny,
    adjustment_amount_cny: snapshot.adjustment_amount_cny,
    adjustment_reason: snapshot.adjustment_reason,
    carryover_amount_cny: snapshot.carryover_amount_cny,
    settlement_status: snapshot.settlement_status,
    locked_at: snapshot.locked_at,
  };
}

async function lockSettlementV87() {
  const { month, studentId } = settlementLockContext();
  if (!studentId || !month) {
    alert("请先选择学生和月份。");
    return;
  }

  const client = settlementLockDbClient();
  if (!client) {
    alert("锁定结算失败：数据库客户端未初始化");
    return;
  }

  try {
    await refreshSettlementLockSummaryFromRpc();
  } catch (error) {
    alert(`锁定前刷新结算摘要失败：${error.message || error}`);
    return;
  }

  const base = settlementLockSnapshot(0, "");
  if (!base) {
    alert("锁定结算失败：无法读取最新DB结算摘要。");
    return;
  }

  const adjustment = settlementLockAdjustmentFromPanel(base);
  const snapshot = settlementLockSnapshot(adjustment.adjustment, adjustment.reason);
  if (!snapshot) {
    alert("锁定结算失败：无法生成锁定快照。");
    return;
  }

  const ok = confirm(`确认锁定 ${snapshot.year_month} 的结算吗？\n状态：${settlementLockStatusLabel(snapshot.carryover_amount_cny)}\n结转：${settlementLockSignedCny(snapshot.carryover_amount_cny)}`);
  if (!ok) return;

  try {
    const { data: saved, error } = await client
      .from(STUDENT_SETTLEMENT_LOCK_TABLE)
      .upsert(settlementLockSnapshotPayload(snapshot), { onConflict: "student_id,year_month" })
      .select("id")
      .single();
    if (error) throw error;

    await upsertStudentCarryover(client, snapshot, saved?.id || null);
    window.__studentSettlementCarryoverV987 = {
      month: nextSettlementMonth(snapshot.year_month),
      studentId: snapshot.student_id,
      amount: Number(snapshot.carryover_amount_cny || 0),
    };

    alert("结算已锁定，并已写入下月结转记录。");
    await refreshSettlementLockSummaryFromRpc();
    updateSettlementLockPreviewV87();
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
    if (window.SchoolStudentSettlementClean?.render) {
      await window.SchoolStudentSettlementClean.render();
    }
  } catch (error) {
    alert(`锁定结算失败：${error.message || error}`);
  }
}

async function unlockSettlementV932() {
  const { month, studentId } = settlementLockContext();
  if (!studentId || !month) {
    alert("请先选择学生和月份。");
    return;
  }

  const lock = await getCurrentStudentSettlementLockV932();
  if (!lock) {
    alert("当前学生月份尚未锁定。");
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
    return;
  }

  const ok = confirm(`确定撤销 ${lock.year_month} 的学生月度结算锁定吗？\n\n撤销后可重新修改课时和学费收入记录。`);
  if (!ok) return;

  const client = settlementLockDbClient();
  if (!client) {
    alert("撤销锁定失败：数据库客户端未初始化");
    return;
  }

  try {
    const { error } = await client
      .from(STUDENT_SETTLEMENT_LOCK_TABLE)
      .update({
        settlement_status: "unlocked",
        locked_at: null,
      })
      .eq("id", lock.id);

    if (error) throw error;
    await voidStudentCarryover(client, lock);

    alert("学生月度结算锁定已撤销。");
    await refreshSettlementLockSummaryFromRpc();
    updateSettlementLockPreviewV87();
    await fetchSettlementLockHistoryV871();
    await refreshStudentSettlementButtonStateV932();
    if (window.SchoolStudentSettlementClean?.render) {
      await window.SchoolStudentSettlementClean.render();
    }
  } catch (error) {
    alert(`撤销锁定失败：${error.message || error}`);
  }
}

function ensureSettlementPanelV87() {
  const page = document.getElementById("page-student-settlement") || document.querySelector("[data-page='student-settlement']");
  if (!page) return;

  const existing = page.querySelector("#settlementLockPanelV87");
  if (existing) {
    bindSettlementLockPanelV87();
    return;
  }

  const html = `
    <section class="settlement-lock-panel-v87" id="settlementLockPanelV87">
      <div class="section-title-row">
        <div><h3>结算确认 / 锁定</h3><p class="muted-small">确认本月结算结果，并处理汇率差额、尾差、小额差异。</p></div>
        <button class="secondary-btn" id="refreshSettlementLockV87" type="button">刷新计算</button>
      </div>
      <div class="settlement-lock-grid-v87">
        <div class="settlement-lock-summary-v87">
          <div class="settlement-lock-row-v87"><span>系统计算差额</span><strong id="settlementSystemDiffV87">暂未计算</strong></div>
          <div class="settlement-lock-row-v87"><span>调整后结转</span><strong id="settlementCarryoverV87">暂未计算</strong></div>
          <div class="settlement-lock-row-v87"><span>结算状态</span><strong id="settlementStatusTextV87">暂未计算</strong></div>
        </div>
        <div class="settlement-lock-form-v87">
          <label><span>差额处理方式</span><select id="settlementAdjustModeV87"><option value="carry">按最终差额结转</option><option value="clear">抹平差额</option><option value="custom">手动调整</option></select></label>
          <label><span>手动调整金额（人民币）</span><input id="settlementAdjustmentAmountV87" type="number" step="1" value="0" /></label>
          <label class="full"><span>调整原因 / 备注</span><textarea id="settlementAdjustmentReasonV87" rows="2" placeholder="例：汇率差额抹平"></textarea></label>
          <div class="settlement-lock-actions-v87"><button class="secondary-btn" id="previewSettlementLockV87" type="button">预览结果</button><button class="primary-btn" id="lockSettlementV87" type="button">确认并锁定本月结算</button><button class="danger-btn" id="unlockSettlementV932" type="button">撤销本月锁定</button></div>
        </div>
      </div>
      <div class="settlement-lock-history-v87" id="settlementLockHistoryV87"></div>
    </section>`;
  const anchor = page.querySelector("#settlementLessonsTable")?.closest(".section-card, .card, .table-wrap") || page.querySelector(".section-card:last-of-type") || page;
  anchor.insertAdjacentHTML("afterend", html);
  bindSettlementLockPanelV87();
}

function updateSettlementLockPreviewV87() {
  ensureSettlementPanelV87();

  const base = settlementLockSnapshot(0, "");
  if (!base) {
    const diffEl = document.getElementById("settlementSystemDiffV87");
    const carryEl = document.getElementById("settlementCarryoverV87");
    const statusEl = document.getElementById("settlementStatusTextV87");
    if (diffEl) diffEl.textContent = "请先读取结算摘要";
    if (carryEl) carryEl.textContent = "暂未计算";
    if (statusEl) statusEl.textContent = "暂未计算";
    return;
  }

  settlementLockNormalizeAdjustmentInput(base);
  const adjustment = settlementLockAdjustmentFromPanel(base);
  const result = settlementLockSnapshot(adjustment.adjustment, adjustment.reason);
  if (!result) return;

  const diffEl = document.getElementById("settlementSystemDiffV87");
  const carryEl = document.getElementById("settlementCarryoverV87");
  const statusEl = document.getElementById("settlementStatusTextV87");
  if (diffEl) {
    diffEl.textContent = settlementLockSignedCny(result.system_difference_cny);
    diffEl.className = `settlement-result ${settlementLockStatusClass(result.system_difference_cny)}`;
  }
  if (carryEl) {
    carryEl.textContent = settlementLockSignedCny(result.carryover_amount_cny);
    carryEl.className = `settlement-result ${settlementLockStatusClass(result.carryover_amount_cny)}`;
  }
  if (statusEl) {
    statusEl.textContent = settlementLockStatusLabel(result.carryover_amount_cny);
    statusEl.className = `settlement-result ${settlementLockStatusClass(result.carryover_amount_cny)}`;
  }

  const finalEl = document.getElementById("settlementFinalStatusCny");
  if (finalEl) {
    const label = settlementLockStatusLabel(result.carryover_amount_cny);
    finalEl.textContent = settlementLockRoundCny(result.carryover_amount_cny) === 0
      ? "已结清"
      : `${label}：${settlementLockSignedCny(result.carryover_amount_cny)}`;
    finalEl.className = `settlement-result ${settlementLockStatusClass(result.carryover_amount_cny)}`;
  }
}

function setStudentSettlementLockButtonStateV932(hasLocked) {
  const lockBtn = document.getElementById("lockSettlementV87");
  const unlockBtn = document.getElementById("unlockSettlementV932");

  if (lockBtn) {
    lockBtn.disabled = !!hasLocked;
    lockBtn.title = hasLocked ? "当前学生月份已经锁定，请先撤销后再重新锁定。" : "";
  }

  if (unlockBtn) {
    unlockBtn.disabled = !hasLocked;
    unlockBtn.title = hasLocked ? "" : "当前学生月份尚未锁定。";
  }
}

async function getCurrentStudentSettlementLockV932() {
  const { month, studentId } = settlementLockContext();
  if (!studentId || !month) return null;

  const client = settlementLockDbClient();
  if (!client) return null;

  const { data, error } = await client
    .from(STUDENT_SETTLEMENT_LOCK_TABLE)
    .select("*")
    .eq("student_id", studentId)
    .eq("year_month", month)
    .eq("settlement_status", "locked")
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    console.warn("student settlement lock state check failed", error);
    return null;
  }
  return data || null;
}

async function refreshStudentSettlementButtonStateV932() {
  const lock = await getCurrentStudentSettlementLockV932();
  setStudentSettlementLockButtonStateV932(!!lock);
}

async function fetchSettlementLockHistoryV871() {
  const requestId = ++studentSettlementLockHistoryRequest;
  const { month, studentId } = settlementLockContext();
  const history = document.getElementById("settlementLockHistoryV87");
  if (!history) return;

  const currentContextStillSame = () => {
    const now = settlementLockContext();
    return requestId === studentSettlementLockHistoryRequest && now.month === month && now.studentId === studentId;
  };

  if (!studentId || !month) {
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="muted-small">请选择学生和月份。</div>`;
    return;
  }

  setStudentSettlementLockButtonStateV932(false);
  history.innerHTML = `<div class="muted-small">正在读取 ${settlementLockEsc(month)} 的锁定状态...</div>`;

  const client = settlementLockDbClient();
  if (!client) {
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="error-text">读取结算锁定状态失败：数据库客户端未初始化</div>`;
    return;
  }

  try {
    const { data, error } = await client
      .from(STUDENT_SETTLEMENT_LOCK_TABLE)
      .select("*")
      .eq("student_id", studentId)
      .eq("year_month", month)
      .eq("settlement_status", "locked")
      .maybeSingle();

    if (!currentContextStillSame()) return;
    if (error && error.code !== "PGRST116") throw error;

    if (!data) {
      setStudentSettlementLockButtonStateV932(false);
      history.innerHTML = `<div class="muted-small">当前月份尚未锁定。</div>`;
      return;
    }

    setStudentSettlementLockButtonStateV932(true);
    history.innerHTML = `
      <div class="locked-settlement-v87">
        <strong>已锁定：</strong>
        <span>${settlementLockEsc(data.year_month)}</span>
        <span>${settlementLockEsc(settlementLockStatusLabel(data.carryover_amount_cny))}</span>
        <span>结转 ${settlementLockSignedCny(data.carryover_amount_cny)}</span>
        <span>调整 ${settlementLockSignedCny(data.adjustment_amount_cny)}</span>
        <span>${data.locked_at ? settlementLockEsc(new Date(data.locked_at).toLocaleString()) : ""}</span>
      </div>
    `;
  } catch (error) {
    if (!currentContextStillSame()) return;
    setStudentSettlementLockButtonStateV932(false);
    history.innerHTML = `<div class="error-text">读取结算锁定状态失败：${settlementLockEsc(error.message || error)}</div>`;
  }
}

function bindSettlementLockPanelV87() {
  const refresh = document.getElementById("refreshSettlementLockV87");
  const preview = document.getElementById("previewSettlementLockV87");
  const lock = document.getElementById("lockSettlementV87");
  const unlock = document.getElementById("unlockSettlementV932");
  const mode = document.getElementById("settlementAdjustModeV87");
  const amount = document.getElementById("settlementAdjustmentAmountV87");
  const reason = document.getElementById("settlementAdjustmentReasonV87");

  if (refresh && refresh.dataset.boundSettlementLock !== "true") {
    refresh.dataset.boundSettlementLock = "true";
    refresh.addEventListener("click", () => {
      updateSettlementLockPreviewV87();
      fetchSettlementLockHistoryV871();
      refreshStudentSettlementButtonStateV932();
    });
  }
  if (preview && preview.dataset.boundSettlementLock !== "true") {
    preview.dataset.boundSettlementLock = "true";
    preview.addEventListener("click", updateSettlementLockPreviewV87);
  }
  if (lock && lock.dataset.boundSettlementLock !== "true") {
    lock.dataset.boundSettlementLock = "true";
    lock.addEventListener("click", lockSettlementV87);
  }
  if (unlock && unlock.dataset.boundSettlementLock !== "true") {
    unlock.dataset.boundSettlementLock = "true";
    unlock.addEventListener("click", unlockSettlementV932);
  }
  if (mode && mode.dataset.boundSettlementLock !== "true") {
    mode.dataset.boundSettlementLock = "true";
    mode.addEventListener("change", updateSettlementLockPreviewV87);
  }
  if (amount && amount.dataset.boundSettlementLock !== "true") {
    amount.dataset.boundSettlementLock = "true";
    amount.addEventListener("input", (event) => {
      if (event.target?.disabled) return;
      const currentMode = document.getElementById("settlementAdjustModeV87");
      if (currentMode) currentMode.value = "custom";
      updateSettlementLockPreviewV87();
    });
    amount.addEventListener("focus", () => {
      if (settlementLockMode() === "custom" && amount.value === "0") amount.value = "";
    });
  }
  if (reason && reason.dataset.boundSettlementLock !== "true") {
    reason.dataset.boundSettlementLock = "true";
    reason.addEventListener("input", updateSettlementLockPreviewV87);
  }

  settlementLockNormalizeAdjustmentInput(settlementLockSnapshot(0, ""));
}

function refreshStudentSettlementLockReadonly() {
  ensureSettlementPanelV87();
  updateSettlementLockPreviewV87();
  fetchSettlementLockHistoryV871();
  refreshStudentSettlementButtonStateV932();
}

function bindStudentSettlementLockReadonlyEvents() {
  if (document.body?.dataset.boundStudentSettlementLockReadonly === "true") return;
  if (document.body) document.body.dataset.boundStudentSettlementLockReadonly = "true";

  document.body?.addEventListener("change", (event) => {
    if (event.target?.id === "settlementMonthFilter" || event.target?.id === "settlementStudentFilter") {
      const history = document.getElementById("settlementLockHistoryV87");
      if (history) history.innerHTML = `<div class="muted-small">正在切换结算月份...</div>`;
      setStudentSettlementLockButtonStateV932(false);
      setTimeout(refreshStudentSettlementLockReadonly, 0);
    }
  }, true);
}

function installStudentSettlementLockReadonly() {
  bindStudentSettlementLockReadonlyEvents();
  setTimeout(refreshStudentSettlementLockReadonly, 0);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installStudentSettlementLockReadonly);
} else {
  installStudentSettlementLockReadonly();
}
