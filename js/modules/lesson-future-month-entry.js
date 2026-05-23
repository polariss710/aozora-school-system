// === v9.8-stable-final.7 lesson future month entry ===
// 课时管理：筛选栏继续只显示当前月份有课的学生/老师。
// 但导入和新增入口用于录入，不能依赖当前月份已有课时。
// 本模块只做入口优化，不修改 DB 和学生月度结算逻辑。

(function () {
  function appState() {
    if (typeof state !== "undefined" && state) return state;
    return window.state || {};
  }

  function currentLessonMonth() {
    return document.getElementById("lessonMonthFilter")?.value || new Date().toISOString().slice(0, 7);
  }

  function optionText(item) {
    return item?.display_name || item?.name || "";
  }

  function isActiveEntity(item, type) {
    if (!item) return false;
    const status = String(item.status || "").toLowerCase();
    if (type === "student") return !["inactive", "退塾", "退学", "停止"].includes(status);
    if (type === "teacher") return !["inactive", "退職", "离职", "停止"].includes(status);
    return true;
  }

  function escAttr(v) {
    if (typeof escAttr === "function") return escAttr(v);
    return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function escText(v) {
    if (typeof esc === "function") return esc(v);
    return String(v ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function ensureImportButtonsEnabled() {
    const month = currentLessonMonth();
    const canImport = !!month;

    [
      "lessonImportExcelBtn",
      "lessonImportBtn",
      "importLessonBtn",
      "importPlannedLessonBtn",
      "importCompletedLessonBtn",
      "lessonImportCompletedBtn",
      "lessonImportPlannedBtn"
    ].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.disabled = !canImport;
      btn.classList.toggle("disabled", !canImport);
      if (canImport) btn.removeAttribute("aria-disabled");
      else btn.setAttribute("aria-disabled", "true");
    });

    document.querySelectorAll("[data-action='import-lessons'],[data-import='lesson'],[data-import-lesson]").forEach(btn => {
      btn.disabled = !canImport;
      btn.classList.toggle("disabled", !canImport);
    });
  }

  function fillSelectWithAllOptions(select, items, current, placeholder) {
    if (!select) return;
    const active = items.filter(Boolean).filter(x => isActiveEntity(x, select.name?.includes("teacher") ? "teacher" : "student"));
    const options = [`<option value="">${escText(placeholder)}</option>`]
      .concat(active.map(x => `<option value="${escAttr(x.id)}">${escText(optionText(x))}</option>`));
    select.innerHTML = options.join("");
    if (current && active.some(x => x.id === current)) select.value = current;
  }

  function patchLessonModalFullOptions() {
    const form = document.getElementById("modalForm");
    if (!form || !window.state?.editing || window.state.editing.type !== "lesson") return;

    const st = appState();
    const studentSelect = form.querySelector('[name="student_id"]');
    const teacherSelect = form.querySelector('[name="teacher_id"]');
    const subjectSelect = form.querySelector('[name="subject_id"]');

    const current = window.state.editing?.id && typeof findLocal === "function"
      ? findLocal("lesson", window.state.editing.id)
      : (window.state.editing?.data || {});

    if (studentSelect && studentSelect.dataset.fullOptionsV987 !== "true") {
      fillSelectWithAllOptions(studentSelect, st.students || [], current.student_id || studentSelect.value, "请选择学生");
      studentSelect.dataset.fullOptionsV987 = "true";
    }

    if (teacherSelect && teacherSelect.dataset.fullOptionsV987 !== "true") {
      const teachers = (st.teachers || []).filter(x => isActiveEntity(x, "teacher"));
      teacherSelect.innerHTML = [`<option value="">请选择老师</option>`]
        .concat(teachers.map(x => `<option value="${escAttr(x.id)}">${escText(optionText(x))}</option>`))
        .join("");
      if (current.teacher_id && teachers.some(x => x.id === current.teacher_id)) teacherSelect.value = current.teacher_id;
      teacherSelect.dataset.fullOptionsV987 = "true";
    }

    if (subjectSelect && subjectSelect.dataset.fullOptionsV987 !== "true") {
      const subjects = (st.subjects || []).filter(x => x.status !== "inactive");
      subjectSelect.innerHTML = [`<option value="">请选择科目</option>`]
        .concat(subjects.map(x => `<option value="${escAttr(x.id)}">${escText(x.name || "")}</option>`))
        .join("");
      if (current.subject_id && subjects.some(x => x.id === current.subject_id)) subjectSelect.value = current.subject_id;
      subjectSelect.dataset.fullOptionsV987 = "true";
    }

    const ymInput = form.querySelector('[name="year_month"]');
    if (ymInput && !ymInput.value) ymInput.value = currentLessonMonth();

    const dateInput = form.querySelector('[name="lesson_date"]');
    if (dateInput && !dateInput.value && currentLessonMonth()) {
      dateInput.min = `${currentLessonMonth()}-01`;
    }
  }

  function installModalObserver() {
    if (window.__lessonFutureMonthModalObserverV987) return;
    window.__lessonFutureMonthModalObserverV987 = new MutationObserver(() => {
      setTimeout(patchLessonModalFullOptions, 0);
      setTimeout(ensureImportButtonsEnabled, 0);
    });
    window.__lessonFutureMonthModalObserverV987.observe(document.body, { childList: true, subtree: true });
  }

  function patchImportPrecheck() {
    // 部分旧导入函数要求课时管理筛选栏必须选择学生。
    // 未来月份导入时，筛选栏可能为空；这里仅在调用导入时临时补一个有效学生，避免按钮被错误拦截。
    const names = ["importPlannedLessonExcel", "importPlannedLessonExcelV871", "importCompletedLessonExcelV886", "importCompletedLessonExcelV904"];
    names.forEach(name => {
      const fn = window[name];
      if (typeof fn !== "function" || fn.__futureMonthPatchedV987) return;
      const patched = async function (...args) {
        const st = appState();
        const filter = document.getElementById("lessonStudentFilter");
        const oldValue = filter?.value || "";
        let changed = false;
        if (filter && !filter.value) {
          const first = (st.students || []).find(x => isActiveEntity(x, "student"));
          if (first) {
            filter.value = first.id;
            changed = true;
          }
        }
        try {
          return await fn.apply(this, args);
        } finally {
          if (filter && changed) filter.value = oldValue;
        }
      };
      patched.__futureMonthPatchedV987 = true;
      window[name] = patched;
      try { eval(`${name} = window["${name}"];`); } catch (e) {}
    });
  }

  function bind() {
    const monthInput = document.getElementById("lessonMonthFilter");
    if (monthInput && monthInput.dataset.futureEntryBoundV987 !== "true") {
      monthInput.dataset.futureEntryBoundV987 = "true";
      monthInput.addEventListener("change", () => setTimeout(ensureImportButtonsEnabled, 0));
    }

    ensureImportButtonsEnabled();
    patchImportPrecheck();
    installModalObserver();
  }

  const renderLessonsBeforeV987 = typeof renderLessons === "function" ? renderLessons : null;
  if (renderLessonsBeforeV987) {
    window.renderLessons = function () {
      renderLessonsBeforeV987();
      setTimeout(bind, 0);
    };
    try { renderLessons = window.renderLessons; } catch (e) {}
  }

  const renderAllBeforeV987 = typeof renderAll === "function" ? renderAll : null;
  if (renderAllBeforeV987) {
    window.renderAll = function () {
      renderAllBeforeV987();
      setTimeout(bind, 0);
    };
    try { renderAll = window.renderAll; } catch (e) {}
  }

  const switchPageBeforeV987 = typeof switchPage === "function" ? switchPage : null;
  if (switchPageBeforeV987) {
    window.switchPage = function (page) {
      switchPageBeforeV987(page);
      if (page === "lessons") setTimeout(bind, 0);
    };
  }

  document.addEventListener("DOMContentLoaded", () => setTimeout(bind, 500));

  window.SchoolLessonFutureMonthEntry = {
    version: "9.8-stable-final.7",
    bind,
    ensureImportButtonsEnabled,
    patchLessonModalFullOptions,
  };
})();
