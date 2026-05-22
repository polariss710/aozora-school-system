// === v9.2.0 teacher wage lock module ===
// 工资锁定：保存当前老师工资结算快照，并生成待支付要求数据。
// 9.2 只保存数据和显示锁定结果，不做完整支付管理页面。

(function () {
  const LOCK_TABLE = "school_teacher_wage_locks";
  const DETAIL_TABLE = "school_teacher_wage_lock_details";
  const PAY_TABLE = "school_payment_requests";

  function n(v) {
    const x = Number(v || 0);
    return Number.isFinite(x) ? x : 0;
  }

  function fmtAmount(value, currency = "JPY") {
    const amount = currency === "CNY" ? Math.round(n(value) * 100) / 100 : Math.round(n(value));
    return `${amount.toLocaleString()} ${currency}`;
  }

  function currentMonth() {
    return document.getElementById("teacherWageMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function currentTeacherId() {
    return document.getElementById("teacherWageTeacherFilter")?.value || "";
  }

  function ensureLockPanel() {
    const page = document.getElementById("page-teacher-wages");
    if (!page || document.getElementById("teacherWageLockPanel")) return;

    const panel = page.querySelector(".panel");
    if (!panel) return;

    panel.insertAdjacentHTML("beforeend", `
      <div class="section-title-row teacher-wage-lock-title" id="teacherWageLockPanel">
        <div>
          <h3>工资锁定 / 支付准备</h3>
          <p class="muted-small">锁定后保存当前工资结算快照，并生成支付管理用的待支付数据。不计工资记录会跳过支付要求。</p>
        </div>
        <div class="panel-actions">
          <button class="secondary-btn" id="teacherWageLockRefreshBtn" type="button">刷新锁定结果</button>
          <button class="primary-btn" id="teacherWageLockBtn" type="button">锁定当前工资</button>
          <button class="danger-btn" id="teacherWageUnlockBtn" type="button">撤销当前锁定</button>
        </div>
      </div>
      <div class="table-wrap teacher-wage-lock-table-wrap">
        <table>
          <thead>
            <tr>
              <th>月份</th>
              <th>老师</th>
              <th>业务归属</th>
              <th>工资课时</th>
              <th>课时工资</th>
              <th>交通/教室费</th>
              <th>合计</th>
              <th>支付要求</th>
              <th>状态</th>
              <th>锁定时间</th>
            </tr>
          </thead>
          <tbody id="teacherWageLocksTable"></tbody>
        </table>
      </div>
    `);

    document.getElementById("teacherWageLockBtn")?.addEventListener("click", lockCurrentWages);
    document.getElementById("teacherWageUnlockBtn")?.addEventListener("click", unlockCurrentWages);
    document.getElementById("teacherWageLockRefreshBtn")?.addEventListener("click", renderLocks);
  }

  function wageRows() {
    return window.SchoolTeacherWagesModule?.currentWageRowsForLock?.() || [];
  }

  function groupRows(rows) {
    const map = new Map();

    rows.forEach(item => {
      const wage = item.wage || {};
      if (!wage.hasRule) return;

      const key = [
        item.teacher_id || "",
        item.business_entity_id || "",
        wage.type || "",
        wage.exchangeRate || 0,
      ].join("|");

      if (!map.has(key)) {
        map.set(key, {
          teacher_id: item.teacher_id || null,
          teacher_name: item.teacher_name || "",
          business_entity_id: item.business_entity_id || null,
          business_name: item.business_name || "",
          settlement_type: wage.type || "jpy_hourly",
          exchange_rate: n(wage.exchangeRate),
          total_minutes: 0,
          pay_hours: 0,
          lesson_wage_jpy: 0,
          lesson_wage_cny: 0,
          fee_jpy: 0,
          total_jpy: 0,
          total_cny: 0,
          billable_jpy: 0,
          billable_cny: 0,
          lesson_count: 0,
          detail_rows: [],
        });
      }

      const g = map.get(key);
      const minutes = typeof actualMinutes === "function" ? actualMinutes(item.row) : Math.round(n(item.row?.actual_minutes || item.row?.duration_hours * 60));
      g.total_minutes += minutes;
      g.pay_hours += n(wage.hours);
      g.lesson_wage_jpy += n(wage.jpyAmount);
      g.lesson_wage_cny += n(wage.cnyAmount);
      g.fee_jpy += n(wage.feeJpyAmount);
      g.total_jpy += n(wage.totalJpyAmount);
      g.total_cny += n(wage.totalCnyAmount);
      g.lesson_count += 1;

      if (wage.type !== "no_wage") {
        g.billable_jpy += n(wage.totalJpyAmount);
        g.billable_cny += n(wage.totalCnyAmount);
      }

      g.detail_rows.push(item);
    });

    return Array.from(map.values()).filter(g => g.lesson_count > 0);
  }

  async function existingLocks(month, teacherId = "") {
    let query = db.from(LOCK_TABLE).select("*").eq("settlement_month", month).neq("status", "void");
    if (teacherId) query = query.eq("teacher_id", teacherId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      showMessage(`读取工资锁定结果失败：${error.message}`, "error");
      return [];
    }
    return data || [];
  }

  function lockKey(lock) {
    return [lock.teacher_id || "", lock.business_entity_id || "", lock.settlement_type || "", String(lock.exchange_rate || 0)].join("|");
  }

  function groupKey(group) {
    return [group.teacher_id || "", group.business_entity_id || "", group.settlement_type || "", String(group.exchange_rate || 0)].join("|");
  }

  async function lockCurrentWages() {
    ensureLockPanel();

    const month = currentMonth();
    const teacherId = currentTeacherId();
    const rows = wageRows();
    if (!rows.length) {
      showMessage("当前条件下没有可锁定的工资明细。", "error");
      return;
    }

    const missing = rows.filter(x => !x.wage?.hasRule);
    if (missing.length) {
      showMessage(`还有 ${missing.length} 条明细未匹配工资规则，不能锁定。`, "error");
      return;
    }

    const groups = groupRows(rows);
    if (!groups.length) {
      showMessage("当前条件下没有可锁定的工资分组。", "error");
      return;
    }

    const existing = await existingLocks(month, teacherId);
    const existingKeys = new Set(existing.map(lockKey));
    const conflict = groups.filter(g => existingKeys.has(groupKey(g)));
    if (conflict.length) {
      const ok = confirm(`当前月份已有 ${conflict.length} 个工资锁定结果。\n是否覆盖这些锁定结果？\n\n覆盖会先撤销旧锁定和对应待支付要求，再重新锁定。`);
      if (!ok) return;
      await voidLocks(existing.filter(l => conflict.some(g => groupKey(g) === lockKey(l))));
    }

    const ok = confirm(`确定锁定 ${month} 的当前工资吗？\n将生成 ${groups.length} 个工资锁定结果，并为非“不计工资”的金额生成待支付数据。`);
    if (!ok) return;

    for (const group of groups) {
      const { data: lock, error } = await db.from(LOCK_TABLE).insert([{
        settlement_month: month,
        teacher_id: group.teacher_id,
        teacher_name: group.teacher_name,
        business_entity_id: group.business_entity_id,
        business_name: group.business_name,
        settlement_type: group.settlement_type,
        exchange_rate: group.exchange_rate,
        total_minutes: Math.round(group.total_minutes),
        pay_hours: group.pay_hours,
        lesson_wage_jpy: Math.round(group.lesson_wage_jpy),
        lesson_wage_cny: Math.round(group.lesson_wage_cny * 100) / 100,
        fee_jpy: Math.round(group.fee_jpy),
        total_jpy: Math.round(group.total_jpy),
        total_cny: Math.round(group.total_cny * 100) / 100,
        lesson_count: group.lesson_count,
        status: "locked",
        locked_at: new Date().toISOString(),
      }]).select("*").single();

      if (error) {
        showMessage(`工资锁定失败：${error.message}`, "error");
        await renderLocks();
        return;
      }

      const details = group.detail_rows.map(item => {
        const wage = item.wage || {};
        return {
          lock_id: lock.id,
          lesson_record_id: item.row?.id || null,
          lesson_date: item.lesson_date || null,
          start_time: item.start_time || null,
          end_time: item.end_time || null,
          student_id: item.student_id || null,
          student_name: item.student_name || "",
          subject_id: item.subject_id || null,
          subject_name: item.subject_name || "",
          business_entity_id: item.business_entity_id || null,
          business_name: item.business_name || "",
          pay_hours: n(wage.hours),
          lesson_wage_jpy: Math.round(n(wage.jpyAmount)),
          lesson_wage_cny: Math.round(n(wage.cnyAmount) * 100) / 100,
          transport_fee_jpy: Math.round(n(wage.transportFeeJpy)),
          classroom_fee_jpy: Math.round(n(wage.classroomFeeJpy)),
          total_jpy: Math.round(n(wage.totalJpyAmount)),
          total_cny: Math.round(n(wage.totalCnyAmount) * 100) / 100,
          settlement_type: wage.type || "",
          exchange_rate: n(wage.exchangeRate),
          is_no_wage: wage.type === "no_wage",
          status: item.status || "",
          lesson_content: item.lesson_content || "",
        };
      });

      if (details.length) {
        const { error: detailError } = await db.from(DETAIL_TABLE).insert(details);
        if (detailError) {
          showMessage(`工资明细锁定失败：${detailError.message}`, "error");
          await renderLocks();
          return;
        }
      }

      if (group.settlement_type !== "no_wage" && (group.billable_jpy > 0 || group.billable_cny > 0)) {
        const payCurrency = group.settlement_type === "cny_hourly" ? "CNY" : "JPY";
        const payAmount = payCurrency === "CNY" ? group.billable_cny : group.billable_jpy;
        const { error: payError } = await db.from(PAY_TABLE).insert([{
          source_type: "teacher_wage",
          source_id: lock.id,
          request_month: month,
          payee_type: "teacher",
          payee_id: group.teacher_id,
          payee_name: group.teacher_name,
          business_entity_id: group.business_entity_id,
          business_name: group.business_name,
          currency: payCurrency,
          amount: Math.round(n(payAmount) * 100) / 100,
          amount_jpy: Math.round(group.billable_jpy),
          amount_cny: Math.round(group.billable_cny * 100) / 100,
          status: "pending",
          note: `${month} ${group.teacher_name} 工资`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
        if (payError) {
          showMessage(`生成支付要求失败：${payError.message}`, "error");
          await renderLocks();
          return;
        }
      }
    }

    await renderLocks();
    showMessage("工资锁定完成。", "ok");
  }

  async function voidLocks(locks) {
    for (const lock of locks) {
      await db.from(PAY_TABLE).update({ status: "void", updated_at: new Date().toISOString() }).eq("source_type", "teacher_wage").eq("source_id", lock.id);
      await db.from(LOCK_TABLE).update({ status: "void", voided_at: new Date().toISOString() }).eq("id", lock.id);
    }
  }

  async function unlockCurrentWages() {
    const month = currentMonth();
    const teacherId = currentTeacherId();
    const locks = await existingLocks(month, teacherId);
    if (!locks.length) {
      showMessage("当前条件下没有可撤销的工资锁定。", "error");
      return;
    }

    const ok = confirm(`确定撤销当前条件下的 ${locks.length} 个工资锁定结果吗？\n对应待支付要求也会被作废。`);
    if (!ok) return;

    await voidLocks(locks);
    await renderLocks();
    showMessage("已撤销工资锁定。", "ok");
  }

  async function renderLocks() {
    ensureLockPanel();

    const tbody = document.getElementById("teacherWageLocksTable");
    if (!tbody) return;

    const rows = await existingLocks(currentMonth(), currentTeacherId());
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-row">当前条件下没有已锁定工资</td></tr>`;
      return;
    }

    const payReqs = await loadPaymentRequests(rows.map(x => x.id));
    tbody.innerHTML = rows.map(item => {
      const pay = payReqs.filter(x => String(x.source_id) === String(item.id) && x.status !== "void");
      const payText = pay.length
        ? pay.map(x => `${fmtAmount(x.amount, x.currency)} / ${x.status === "pending" ? "待支付" : x.status}`).join("<br>")
        : (item.settlement_type === "no_wage" ? "不计工资" : "未生成");

      return `
        <tr>
          <td>${esc(item.settlement_month || "")}</td>
          <td>${esc(item.teacher_name || "")}</td>
          <td>${esc(item.business_name || "")}</td>
          <td>${item.pay_hours || 0}H</td>
          <td>${fmtAmount(item.lesson_wage_jpy, "JPY")}<br><span class="muted-small">${fmtAmount(item.lesson_wage_cny, "CNY")}</span></td>
          <td>${fmtAmount(item.fee_jpy, "JPY")}</td>
          <td><strong>${fmtAmount(item.total_jpy, "JPY")}</strong><br><span class="muted-small">${fmtAmount(item.total_cny, "CNY")}</span></td>
          <td>${payText}</td>
          <td>${item.status === "locked" ? badge("已锁定") : badge("已撤销", "gray")}</td>
          <td>${esc((item.locked_at || item.created_at || "").slice(0, 16).replace("T", " "))}</td>
        </tr>
      `;
    }).join("");
  }

  async function loadPaymentRequests(lockIds) {
    if (!lockIds.length) return [];
    const { data, error } = await db.from(PAY_TABLE).select("*").eq("source_type", "teacher_wage").in("source_id", lockIds);
    if (error) {
      console.warn("payment request load failed", error);
      return [];
    }
    return data || [];
  }

  function protectDeleteMessage(type) {
    if (type === "lesson") return "该实际课时所属工资月份已有锁定工资，请先撤销工资锁定后再删除。";
    return "该记录关联的月份已有锁定数据，请先撤销锁定后再删除。";
  }

  async function isLessonLocked(item) {
    if (!item || item.lesson_type !== "actual") return false;
    const month = item.teacher_settlement_month || String(item.lesson_date || "").slice(0, 7) || item.year_month || "";
    if (!month || !item.teacher_id) return false;
    const { data, error } = await db.from(LOCK_TABLE).select("id").eq("settlement_month", month).eq("teacher_id", item.teacher_id).eq("status", "locked").limit(1);
    if (error) return false;
    return !!(data && data.length);
  }

  const deleteRecordBeforeV920 = typeof deleteRecord === "function" ? deleteRecord : null;
  if (deleteRecordBeforeV920) {
    window.deleteRecord = async function(type, id) {
      if (type === "lesson") {
        const item = typeof findLocal === "function" ? findLocal(type, id) : null;
        if (await isLessonLocked(item)) {
          showMessage(protectDeleteMessage(type), "error");
          return;
        }
      }
      return deleteRecordBeforeV920(type, id);
    };
  }

  const switchPageBeforeV920 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV920) {
    window.switchPage = function(page) {
      switchPageBeforeV920(page);
      if (page === "teacher-wages") {
        setTimeout(() => {
          ensureLockPanel();
          renderLocks();
        }, 0);
      }
    };
  }

  const renderAllBeforeV920 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV920) {
    window.renderAll = function() {
      renderAllBeforeV920();
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        setTimeout(() => {
          ensureLockPanel();
          renderLocks();
        }, 0);
      }
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      if (document.getElementById("page-teacher-wages")?.classList.contains("active")) {
        ensureLockPanel();
        renderLocks();
      }
    }, 1000);
  });

  window.SchoolTeacherWageLocksV920 = {
    version: "9.2.0",
    lockCurrentWages,
    unlockCurrentWages,
    renderLocks,
    isLessonLocked,
  };
})();
