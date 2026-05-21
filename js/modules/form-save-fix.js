// === v9.0 form save guard ===
(function () {
  const originalSaveFormV90 = typeof saveForm === "function" ? saveForm : null;
  if (!originalSaveFormV90 || originalSaveFormV90.__v90Wrapped) return;

  function safeEventV90() {
    return {
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {},
      target: document.getElementById("modalForm"),
    };
  }

  async function saveFormV90(e) {
    return originalSaveFormV90.call(this, e || safeEventV90());
  }
  saveFormV90.__v90Wrapped = true;
  saveForm = saveFormV90;
})();
