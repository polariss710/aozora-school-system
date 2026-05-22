// === v9.1.12 table row checkbox + selected delete module ===
// 给逐条录入页面增加行选择 checkbox、全选 checkbox、删除选中记录。
// 当前对象：老师工资规则、收入记录、支出记录。
// 不修改数据库结构。

(function () {
  const configs = [
    {
      tbodyId: "teacherWageRulesTable",
      key: "teacherWageRules",
      label: "工资规则",
      tableName: "school_teacher_wage_rules",
      selectedDeleteBtnId: "teacherWageRuleDeleteSelectedBtn",
      actionSelector: "[data-rule-delete]",
      afterDelete: async () => {
        if (window.SchoolTeacherWageRulesModule?.load) await window.SchoolTeacherWageRulesModule.load();
        else { await loadAll(); renderAll(); }
      },
    },
    {
      tbodyId: "incomeTable",
      key: "income",
      label: "收入记录",
      tableName: tables.income,
      selectedDeleteBtnId: "incomeDeleteSelectedBtn",
      actionSelector: "[data-delete][data-type='income']",
      beforeDeleteOne: async (item) => {
        if (typeof syncFinanceAccountEffect === "function") {
          await syncFinanceAccountEffect("income", item, null);
        }
      },
      findItem: (id) => (state.incomeRecords || []).find(x => String(x.id) === String(id)),
      afterDelete: async () => { await loadAll(); renderAll(); },
    },
    {
      tbodyId: "expensesTable",
      key: "expenses",
      label: "支出记录",
      tableName: tables.expenses,
      selectedDeleteBtnId: "expenseDeleteSelectedBtn",
      actionSelector: "[data-delete][data-type='expense']",
      beforeDeleteOne: async (item) => {
        if (typeof syncFinanceAccountEffect === "function") {
          await syncFinanceAccountEffect("expense", item, null);
        }
      },
      findItem: (id) => (state.expenseRecords || []).find(x => String(x.id) === String(id)),
      afterDelete: async () => { await loadAll(); renderAll(); },
    },
  ];

  function visibleDataRows(tbody) {
    return Array.from(tbody.querySelectorAll("tr"))
      .filter(row => !row.classList.contains("month-group-row") && !row.querySelector(".empty-row"));
  }

  function recordIdFromRow(row, config) {
    const btn = row.querySelector(config.actionSelector);
    return btn?.dataset?.ruleDelete || btn?.dataset?.delete || "";
  }

  function ensureHeader(table, config) {
    const headerRow = table?.querySelector("thead tr");
    if (!headerRow) return;

    const first = headerRow.firstElementChild;
    if (first?.dataset?.selectionHeader === config.key) return;

    const th = document.createElement("th");
    th.className = "selection-col";
    th.dataset.selectionHeader = config.key;
    th.innerHTML = `
      <label class="row-select-wrap" title="全选">
        <input type="checkbox" class="table-select-all" data-select-all="${config.key}" aria-label="${config.label}全选" />
      </label>
    `;
    headerRow.insertBefore(th, first || null);
  }

  function ensureRows(tbody, config) {
    visibleDataRows(tbody).forEach(row => {
      const first = row.firstElementChild;
      const id = recordIdFromRow(row, config);

      if (first?.dataset?.selectionCell === config.key) {
        const existing = first.querySelector(`[data-row-select="${config.key}"]`);
        if (existing && id) existing.dataset.recordId = id;
        return;
      }

      const td = document.createElement("td");
      td.className = "selection-col";
      td.dataset.selectionCell = config.key;
      td.innerHTML = `
        <label class="row-select-wrap">
          <input type="checkbox" class="table-row-select" data-row-select="${config.key}" data-record-id="${escAttr(id)}" aria-label="${config.label}" />
        </label>
      `;
      row.insertBefore(td, first || null);
    });

    Array.from(tbody.querySelectorAll("tr.month-group-row td")).forEach(td => {
      if (!td.dataset.baseColspan) {
        td.dataset.baseColspan = String(td.colSpan || 1);
      }
      td.colSpan = Number(td.dataset.baseColspan || 1) + 1;
    });
  }

  function rowBoxes(tbody, config) {
    return visibleDataRows(tbody)
      .map(row => row.querySelector(`[data-row-select="${config.key}"]`))
      .filter(Boolean);
  }

  function selectedIds(config) {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return [];
    return rowBoxes(tbody, config)
      .filter(box => box.checked)
      .map(box => box.dataset.recordId)
      .filter(Boolean);
  }

  function updateSelectAll(tbody, config) {
    const table = tbody.closest("table");
    const all = table?.querySelector(`[data-select-all="${config.key}"]`);
    if (!all) return;

    const boxes = rowBoxes(tbody, config);
    const checked = boxes.filter(x => x.checked);

    all.checked = boxes.length > 0 && checked.length === boxes.length;
    all.indeterminate = checked.length > 0 && checked.length < boxes.length;
  }

  function bindEvents(tbody, config) {
    const table = tbody.closest("table");
    const all = table?.querySelector(`[data-select-all="${config.key}"]`);

    if (all && all.dataset.boundSelectionAll !== "true") {
      all.dataset.boundSelectionAll = "true";
      all.addEventListener("change", () => {
        visibleDataRows(tbody).forEach(row => {
          const box = row.querySelector(`[data-row-select="${config.key}"]`);
          if (box) box.checked = all.checked;
        });
        updateSelectAll(tbody, config);
      });
    }

    rowBoxes(tbody, config).forEach(box => {
      if (box.dataset.boundRowSelection === "true") return;
      box.dataset.boundRowSelection = "true";
      box.addEventListener("change", () => updateSelectAll(tbody, config));
    });
  }

  async function deleteSelected(config) {
    const ids = selectedIds(config);
    if (!ids.length) {
      showMessage(`请先选择要删除的${config.label}。`, "error");
      return;
    }

    const ok = confirm(`确定删除选中的 ${ids.length} 条${config.label}吗？\n\n删除后不可恢复。`);
    if (!ok) return;

    for (const id of ids) {
      const item = config.findItem ? config.findItem(id) : null;
      if (config.beforeDeleteOne) await config.beforeDeleteOne(item || { id });

      const { error } = await db.from(config.tableName).delete().eq("id", id);
      if (error) {
        showMessage(`删除失败：${error.message}`, "error");
        if (config.afterDelete) await config.afterDelete();
        return;
      }
    }

    showMessage(`已删除 ${ids.length} 条${config.label}。`, "ok");
    if (config.afterDelete) await config.afterDelete();
  }

  function bindDeleteButton(config) {
    const btn = document.getElementById(config.selectedDeleteBtnId);
    if (!btn || btn.dataset.boundSelectedDelete === "true") return;
    btn.dataset.boundSelectedDelete = "true";
    btn.addEventListener("click", () => deleteSelected(config));
  }

  function applyOne(config) {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return;

    const table = tbody.closest("table");
    if (!table) return;

    ensureHeader(table, config);
    ensureRows(tbody, config);
    bindEvents(tbody, config);
    bindDeleteButton(config);
    updateSelectAll(tbody, config);
  }

  function applyAll() {
    configs.forEach(applyOne);
  }

  function observeTables() {
    configs.forEach(config => {
      const tbody = document.getElementById(config.tbodyId);
      if (!tbody || tbody.dataset.selectionObserved === "true") return;

      tbody.dataset.selectionObserved = "true";
      const observer = new MutationObserver(() => {
        setTimeout(() => applyOne(config), 0);
      });
      observer.observe(tbody, { childList: true });
    });
  }

  const renderAllBeforeV9112 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV9112) {
    window.renderAll = function() {
      renderAllBeforeV9112();
      setTimeout(() => {
        observeTables();
        applyAll();
      }, 0);
    };
  }

  const switchPageBeforeV9112 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV9112) {
    window.switchPage = function(page) {
      switchPageBeforeV9112(page);
      setTimeout(() => {
        observeTables();
        applyAll();
      }, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      observeTables();
      applyAll();
    }, 1000);
  });

  window.SchoolTableSelectionV9112 = {
    version: "9.1.12",
    apply: applyAll,
    selectedIds,
    configs,
  };
})();
