// === v9.0 lessons module boundary ===
// 当前版本先建立模块边界，不重写已测试通过的课时逻辑。
// 课时管理后续修改统一放到本文件，避免继续在 legacy-core.js 末尾叠加补丁。
window.SchoolLessonsModule = window.SchoolLessonsModule || {
  version: "9.0",
  note: "Lesson management module boundary established. Existing tested logic remains in legacy-core.js.",
};
