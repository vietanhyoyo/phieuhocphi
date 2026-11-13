const DEFAULT_SPREADSHEET_ID = "1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI";
const SYNC_SECRET_PROPERTY = "TUTOR_SYNC_SECRET";
const LEGACY_CLAIMED_PROPERTY = "LEGACY_DATA_CLAIMED";

// Keep the existing userId column position in App_Lessons so older sheets
// remain readable; the payment flag is appended after it.
const TABLES = {
  meta: { name: "App_Meta", headers: ["key", "value"] },
  users: { name: "App_Users", headers: ["id", "username", "passwordHash", "passwordSalt", "createdAt", "updatedAt", "bankName", "bankAccountName", "bankAccountNumber", "bankQrImage"] },
  subjects: { name: "App_Subjects", headers: ["id", "name", "active", "createdAt", "updatedAt", "userId"] },
  students: { name: "App_Students", headers: ["id", "name", "phone", "parentName", "parentPhone", "note", "active", "createdAt", "updatedAt", "userId"] },
  studentSubjects: { name: "App_StudentSubjects", headers: ["id", "studentId", "subjectId", "defaultFee", "defaultDurationMinutes", "active", "createdAt", "updatedAt", "userId"] },
  lessons: { name: "App_Lessons", headers: ["id", "studentId", "subjectId", "lessonDate", "startTime", "durationMinutes", "fee", "note", "createdAt", "updatedAt", "userId", "paid"] },
  timetable: { name: "App_Timetable", headers: ["id", "dayOfWeek", "startTime", "endTime", "title", "studentName", "mode", "color", "note", "createdAt", "updatedAt", "userId"] },
  timetableSettings: { name: "App_TimetableSettings", headers: ["id", "title", "userId"] },
};

function doGet(event) {
  try {
    authorize_(event && event.parameter && event.parameter.secret);
    return json_(handle_(event.parameter.action || "loadData", event.parameter));
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function doPost(event) {
  try {
    const payload = parsePostPayload_(event);
    authorize_(payload.secret);
    return json_(handle_(payload.action || "loadData", payload));
  } catch (error) {
    return json_({ ok: false, error: String(error.message || error) });
  }
}

function parsePostPayload_(event) {
  const raw = (event && event.postData && event.postData.contents) || "";
  try {
    return raw ? JSON.parse(raw) : (event && event.parameter) || {};
  } catch (error) {
    const payload = Object.assign({}, (event && event.parameter) || {});
    ["data", "user"].forEach((key) => {
      if (typeof payload[key] === "string") {
        try { payload[key] = JSON.parse(payload[key]); } catch (ignored) {}
      }
    });
    return payload;
  }
}

function handle_(action, payload) {
  if (action === "loadData") return { ok: true, data: readAppData_(requiredUserId_(payload)) };
  if (action === "saveData") {
    saveAppData_(requiredUserId_(payload), payload.data);
    return { ok: true };
  }
  if (action === "listUsers") {
    const users = readTable_(TABLES.users);
    return { ok: true, hasUsers: users.length > 0, userCount: users.length };
  }
  if (action === "findUser") {
    const username = String(payload.username || "").trim().toLowerCase();
    const user = readTable_(TABLES.users).find((item) => String(item.username).toLowerCase() === username) || null;
    return { ok: true, user };
  }
  if (action === "createUser") return createUser_(payload.user);
  if (action === "updateUserPassword") return updateUserPassword_(payload);
  throw new Error("Action không được hỗ trợ.");
}

function requiredUserId_(payload) {
  const userId = String((payload && payload.userId) || "").trim();
  if (!userId) throw new Error("Thiếu mã tài khoản.");
  return userId;
}

function createUser_(user) {
  if (!user || !user.id || !user.username || !user.passwordHash || !user.passwordSalt) throw new Error("Tài khoản không hợp lệ.");
  user = Object.assign({}, user, bankAccountForUsername_(user.username));
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const users = readTable_(TABLES.users);
    if (users.some((item) => String(item.username).trim().toLowerCase() === String(user.username).trim().toLowerCase())) throw new Error("Tên đăng nhập đã tồn tại.");

    // Data created before multi-account support has no userId. Assign it to
    // the first account so the existing user's data is not lost.
    if (users.length === 0) claimLegacyData_(user.id);
    writeTable_(TABLES.users, users.concat([user]));
    return { ok: true, user };
  } finally {
    lock.releaseLock();
  }
}

function updateUserPassword_(payload) {
  const userId = requiredUserId_(payload);
  const expectedPasswordHash = String(payload.expectedPasswordHash || "");
  const expectedPasswordSalt = String(payload.expectedPasswordSalt || "");
  const passwordHash = String(payload.passwordHash || "");
  const passwordSalt = String(payload.passwordSalt || "");
  const updatedAt = String(payload.updatedAt || new Date().toISOString());
  if (!/^[a-f0-9]{64}$/i.test(passwordHash) || !/^[a-f0-9]{32}$/i.test(passwordSalt)) throw new Error("Mật khẩu mới không hợp lệ.");

  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const users = readTable_(TABLES.users);
    const index = users.findIndex((user) => String(user.id) === userId);
    if (index < 0) return { ok: true, updated: false };
    const user = users[index];
    if (String(user.passwordHash) !== expectedPasswordHash || String(user.passwordSalt) !== expectedPasswordSalt) {
      return { ok: true, updated: false };
    }
    users[index] = Object.assign({}, user, { passwordHash, passwordSalt, updatedAt });
    writeTable_(TABLES.users, users);
    return { ok: true, updated: true };
  } finally {
    lock.releaseLock();
  }
}

function authorize_(providedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty(SYNC_SECRET_PROPERTY);
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) throw new Error("Unauthorized");
}

function testConnection() {
  return spreadsheet_().getName();
}

function bankAccountForUsername_(username) {
  return String(username || "").trim().toLowerCase() === "khadang2004cm@gmail.com"
    ? { bankName: "MB BANK", bankAccountName: "DANG VU KHA", bankAccountNumber: "20402023979", bankQrImage: "/dang-vu-kha-qr.png" }
    : { bankName: "TECHCOMBANK", bankAccountName: "DANH MINH HIEU", bankAccountNumber: "8804040202", bankQrImage: "/danh-minh-hieu-qr.png" };
}

// Apply the designated-email payment rule to existing accounts, changing only G:J.
function setupBankAccounts() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = spreadsheet_().getSheetByName(TABLES.users.name);
    if (!sheet) throw new Error("Chưa có bảng App_Users.");
    const headers = TABLES.users.headers.slice(6);
    const existing = sheet.getRange(1, 7, 1, 4).getValues()[0];
    if (existing.some((value, index) => value && value !== headers[index])) throw new Error("Cột G:J đang chứa dữ liệu khác. Vui lòng kiểm tra trước khi cấu hình.");
    sheet.getRange(1, 7, 1, 4).setValues([headers]);
    sheet.getRange(2, 7, Math.max(sheet.getMaxRows() - 1, 1), 4).setNumberFormat("@");
    if (sheet.getLastRow() < 2) return;
    const usernames = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
    usernames.forEach((row, index) => {
      if (!String(row[0]).trim()) return;
      const config = bankAccountForUsername_(row[0]);
      const range = sheet.getRange(index + 2, 7, 1, 4);
      range.setValues([headers.map((header) => config[header])]);
    });
    sheet.autoResizeColumns(7, 4);
  } finally {
    lock.releaseLock();
  }
}

// Global scope is re-evaluated on every execution, so these caches live for
// a single request only. They avoid reopening the spreadsheet for each table
// and each date/time cell.
var spreadsheetCache_ = null;
var timeZoneCache_ = null;

function spreadsheet_() {
  if (!spreadsheetCache_) {
    const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID;
    spreadsheetCache_ = SpreadsheetApp.openById(id);
  }
  return spreadsheetCache_;
}

function readAppData_(userId) {
  migrateSingleAccountLegacyData_(userId);
  const subjects = readUserTable_(TABLES.subjects, userId);
  const students = readUserTable_(TABLES.students, userId);
  const studentSubjects = readUserTable_(TABLES.studentSubjects, userId);
  const lessons = readUserTable_(TABLES.lessons, userId);
  const timetable = readUserTable_(TABLES.timetable, userId);
  const timetableSettings = readUserTable_(TABLES.timetableSettings, userId);
  const timetableTitle = timetableSettings.length ? String(timetableSettings[0].title || "Thời khóa biểu") : "Thời khóa biểu";
  if (!subjects.length && !students.length && !studentSubjects.length && !lessons.length && !timetable.length && !timetableSettings.length) return null;
  const meta = readTable_(TABLES.meta);
  const version = Number((meta.find((item) => item.key === "version") || {}).value || 1);
  return { version, subjects, students, studentSubjects, lessons, timetable, timetableTitle };
}

function readUserTable_(table, userId) {
  return dedupeById_(readTable_(table).filter((item) => String(item.userId || "").trim() === userId));
}

// Legacy rows (no userId) only come from the pre-multi-account version, so
// this check runs until it has been done once, then is skipped on every load.
function migrateSingleAccountLegacyData_(userId) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty(LEGACY_CLAIMED_PROPERTY) === "1") return;
  const users = readTable_(TABLES.users);
  if (users.length > 1) {
    properties.setProperty(LEGACY_CLAIMED_PROPERTY, "1");
    return;
  }
  if (users.length !== 1 || String(users[0].id) !== userId) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const currentUsers = readTable_(TABLES.users);
    if (currentUsers.length === 1 && String(currentUsers[0].id) === userId) {
      claimLegacyData_(userId);
      properties.setProperty(LEGACY_CLAIMED_PROPERTY, "1");
    }
  } finally {
    lock.releaseLock();
  }
}

function saveAppData_(userId, data) {
  if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.students) || !Array.isArray(data.studentSubjects) || !Array.isArray(data.lessons)) throw new Error("Dữ liệu ứng dụng không hợp lệ.");
  validateTimetable_(data);
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    let changed = false;
    changed = mergeUserTable_(TABLES.subjects, userId, data.subjects) || changed;
    changed = mergeUserTable_(TABLES.students, userId, data.students) || changed;
    changed = mergeUserTable_(TABLES.studentSubjects, userId, data.studentSubjects) || changed;
    changed = mergeUserTable_(TABLES.lessons, userId, data.lessons) || changed;
    // Older clients omit these fields: preserve the existing weekly schedule.
    if (Array.isArray(data.timetable)) changed = mergeUserTable_(TABLES.timetable, userId, data.timetable) || changed;
    if (typeof data.timetableTitle === "string") changed = mergeUserTable_(TABLES.timetableSettings, userId, [{ id: "title", title: data.timetableTitle }]) || changed;
    if (changed) writeTable_(TABLES.meta, [{ key: "version", value: data.version }, { key: "updatedAt", value: new Date().toISOString() }]);
  } finally {
    lock.releaseLock();
  }
}

function validateTimetable_(data) {
  if (data.timetableTitle !== undefined && (typeof data.timetableTitle !== "string" || data.timetableTitle.length > 120)) throw new Error("Tiêu đề thời khóa biểu không hợp lệ.");
  if (data.timetable === undefined) return;
  if (!Array.isArray(data.timetable)) throw new Error("Thời khóa biểu không hợp lệ.");
  const ids = new Set();
  const colors = ["#fef08a", "#fdba74", "#fca5a5", "#fbcfe8", "#f0abfc", "#ddd6fe", "#67e8f9", "#93c5fd", "#5eead4", "#bbf7d0", "#bef264", "#a5f3fc", "#fde68a", "#d1d5db"];
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  data.timetable.forEach((item) => {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)
      || !Number.isInteger(item.dayOfWeek) || item.dayOfWeek < 1 || item.dayOfWeek > 7
      || !time.test(item.startTime) || !time.test(item.endTime) || item.startTime >= item.endTime
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 100
      || typeof item.studentName !== "string" || item.studentName.length > 100
      || (item.mode !== "online" && item.mode !== "in-person") || colors.indexOf(item.color) < 0
      || typeof item.note !== "string" || item.note.length > 300
      || typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") throw new Error("Ca trong thời khóa biểu không hợp lệ.");
    ids.add(item.id);
  });
}

// Creates only missing timetable tabs; existing sheets and records are untouched.
function setupTimetable() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    [TABLES.timetable, TABLES.timetableSettings].forEach((table) => {
      if (!spreadsheet_().getSheetByName(table.name)) writeTable_(table, []);
    });
  } finally { lock.releaseLock(); }
}

// Returns true when the sheet was rewritten. Unchanged tables are skipped,
// since clearing and rewriting a whole sheet is the slowest part of a save.
function mergeUserTable_(table, userId, records) {
  const allRecords = readTable_(table);
  const otherAccounts = allRecords.filter((record) => String(record.userId || "").trim() !== userId);
  const accountRecords = dedupeById_((records || []).map((record) => Object.assign({}, record, { userId })));
  const nextRecords = otherAccounts.concat(accountRecords);
  if (sameRows_(table, allRecords, nextRecords)) return false;
  writeTable_(table, nextRecords);
  return true;
}

// Compares records the way writeTable_ would store them. Any doubt (for
// example a Date cell against a string) counts as a change, so a needed write
// is never skipped.
function sameRows_(table, current, next) {
  if (current.length !== next.length) return false;
  const cell = (value) => {
    if (value === undefined || value === null) return "";
    if (Object.prototype.toString.call(value) === "[object Date]") return isNaN(value.getTime()) ? "" : value.toISOString();
    // Sheets turns "5"/"true" input into 5/true, so string form is enough.
    return String(value);
  };
  for (let row = 0; row < current.length; row++) {
    for (let col = 0; col < table.headers.length; col++) {
      const header = table.headers[col];
      if (cell(current[row][header]) !== cell(next[row][header])) return false;
    }
  }
  return true;
}

function dedupeById_(records) {
  const seen = Object.create(null);
  return records.filter((record) => {
    const id = String(record.id || "").trim();
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

function claimLegacyData_(userId) {
  [TABLES.subjects, TABLES.students, TABLES.studentSubjects, TABLES.lessons].forEach((table) => {
    const records = readTable_(table);
    if (!records.some((record) => !String(record.userId || "").trim())) return;
    writeTable_(table, records.map((record) => String(record.userId || "").trim() ? record : Object.assign({}, record, { userId })));
  });
}

function readTable_(table) {
  const sheet = spreadsheet_().getSheetByName(table.name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(1, 1, sheet.getLastRow(), Math.min(sheet.getMaxColumns(), table.headers.length)).getValues();
  return values.slice(1).filter((row) => row.some((value) => value !== "" && value !== null)).map((row) => {
    const item = {};
    table.headers.forEach((header, index) => { item[header] = row[index]; });
    ["active", "paid"].forEach((key) => { if (key in item) item[key] = item[key] === true || String(item[key]).toLowerCase() === "true"; });
    ["defaultFee", "defaultDurationMinutes", "durationMinutes", "fee", "dayOfWeek"].forEach((key) => { if (key in item) item[key] = finiteNumber_(item[key]); });
    if ("lessonDate" in item) item.lessonDate = normalizeDateCell_(item.lessonDate);
    if ("startTime" in item) item.startTime = normalizeTimeCell_(item.startTime);
    if ("endTime" in item) item.endTime = normalizeTimeCell_(item.endTime);
    return item;
  });
}

function writeTable_(table, records) {
  const sheet = spreadsheet_().getSheetByName(table.name) || spreadsheet_().insertSheet(table.name);
  if (sheet.getMaxColumns() < table.headers.length) sheet.insertColumnsAfter(sheet.getMaxColumns(), table.headers.length - sheet.getMaxColumns());
  sheet.clearContents();
  const rows = [table.headers].concat((records || []).map((record) => table.headers.map((header) => record[header] === undefined ? "" : record[header])));
  if (table === TABLES.users && rows.length > 1) sheet.getRange(2, 7, rows.length - 1, 4).setNumberFormat("@");
  if (table === TABLES.timetable && rows.length > 1) sheet.getRange(2, 3, rows.length - 1, 2).setNumberFormat("@");
  sheet.getRange(1, 1, rows.length, table.headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function spreadsheetTimeZone_() {
  if (!timeZoneCache_) timeZoneCache_ = spreadsheet_().getSpreadsheetTimeZone() || Session.getScriptTimeZone() || "Asia/Ho_Chi_Minh";
  return timeZoneCache_;
}

function pad2_(value) {
  return ("0" + Number(value)).slice(-2);
}

function normalizeDateCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, spreadsheetTimeZone_(), "yyyy-MM-dd");
  const text = String(value || "").trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return match[1] + "-" + pad2_(match[2]) + "-" + pad2_(match[3]);
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? text : Utilities.formatDate(parsed, spreadsheetTimeZone_(), "yyyy-MM-dd");
}

function normalizeTimeCell_(value) {
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) return Utilities.formatDate(value, spreadsheetTimeZone_(), "HH:mm");
  const text = String(value || "").trim();
  const match = /(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/.exec(text) || /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (match) return pad2_(match[1]) + ":" + match[2];
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? text : Utilities.formatDate(parsed, spreadsheetTimeZone_(), "HH:mm");
}

function finiteNumber_(value) {
  const parsed = Number(value || 0);
  return isFinite(parsed) ? parsed : 0;
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
