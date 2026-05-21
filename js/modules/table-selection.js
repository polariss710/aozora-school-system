// === v9.1.11 table row checkbox module ===
// 给逐条录入页面增加行选择 checkbox 与全选 checkbox。
// 当前对象：老师工资规则、收入记录、支出记录。
// 只增加 UI 选择，不改变保存/删除/导入逻辑，不修改数据库。

(function () {
  const configs = [
    {
      tbodyId: "teacherWageRulesTable",
      key: "teacherWageRules",
      label: "选择工资规则",
    },
    {
      tbodyId: "incomeTable",
      key: "income",
      label: "选择收入",
    },
    {
      tbodyId: "expensesTable",
      key: "expenses",
      label: "选择支出",
    },
  ];

  function visibleDataRows(tbody) {
    return Array.from(tbody.querySelectorAll("tr"))
      .filter(row => !row.classList.contains("month-group-row") && !row.querySelector(".empty-row"));
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
      if (first?.dataset?.selectionCell === config.key) return;

      const td = document.createElement("td");
      td.className = "selection-col";
      td.dataset.selectionCell = config.key;
      td.innerHTML = `
        <label class="row-select-wrap">
          <input type="checkbox" class="table-row-select" data-row-select="${config.key}" aria-label="${config.label}" />
        </label>
      `;
      row.insertBefore(td, first || null);
    });

    // 月份分组行需要多占一列。用 data-base-colspan 避免重复 +1。
    Array.from(tbody.querySelectorAll("tr.month-group-row td")).forEach(td => {
      if (!td.dataset.baseColspan) {
        td.dataset.baseColspan = String(td.colSpan || 1);
      }
      td.colSpan = Number(td.dataset.baseColspan || 1) + 1;
    });
  }

  function updateSelectAll(tbody, config) {
    const table = tbody.closest("table");
    const all = table?.querySelector(`[data-select-all="${config.key}"]`);
    if (!all) return;

    const boxes = visibleDataRows(tbody)
      .map(row => row.querySelector(`[data-row-select="${config.key}"]`))
      .filter(Boolean);

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

    visibleDataRows(tbody).forEach(row => {
      const box = row.querySelector(`[data-row-select="${config.key}"]`);
      if (box && box.dataset.boundRowSelection !== "true") {
        box.dataset.boundRowSelection = "true";
        box.addEventListener("change", () => updateSelectAll(tbody, config));
      }
    });
  }

  function applyOne(config) {
    const tbody = document.getElementById(config.tbodyId);
    if (!tbody) return;

    const table = tbody.closest("table");
    if (!table) return;

    ensureHeader(table, config);
    ensureRows(tbody, config);
    bindEvents(tbody, config);
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
        // 等待当前渲染完成后再补 checkbox，避免和原始渲染抢 DOM。
        setTimeout(() => applyOne(config), 0);
      });
      observer.observe(tbody, { childList: true });
    });
  }

  const renderAllBeforeV9111 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV9111) {
    window.renderAll = function() {
      renderAllBeforeV9111();
      setTimeout(() => {
        observeTables();
        applyAll();
      }, 0);
    };
  }

  const switchPageBeforeV9111 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV9111) {
    window.switchPage = function(page) {
      switchPageBeforeV9111(page);
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

  window.SchoolTableSelectionV9111 = {
    version: "9.1.11",
    apply: applyAll,
    configs,
  };
})();
