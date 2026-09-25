const DEFAULT_SPREADSHEET_ID = "1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI";
const SYNC_SECRET_PROPERTY = "TUTOR_SYNC_SECRET";

// Every application table keeps userId in its last column. Keeping it last
// lets the script read the old single-account tables and migrate them safely.
const TABLES = {
  meta: { name: "App_Meta", headers: ["key", "value"] },
  users: { name: "App_Users", headers: ["id", "username", "passwordHash", "passwordSalt", "createdAt", "updatedAt"] },
  subjects: { name: "App_Subjects", headers: ["id", "name", "active", "createdAt", "updatedAt", "userId"] },
  students: { name: "App_Students", headers: ["id", "name", "phone", "parentName", "parentPhone", "note", "active", "createdAt", "updatedAt", "userId"] },
  studentSubjects: { name: "App_StudentSubjects", headers: ["id", "studentId", "subjectId", "defaultFee", "defaultDurationMinutes", "active", "createdAt", "updatedAt", "userId"] },
  lessons: { name: "App_Lessons", headers: ["id", "studentId", "subjectId", "lessonDate", "startTime", "durationMinutes", "fee", "note", "createdAt", "updatedAt", "userId"] },
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
  throw new Error("Action không được hỗ trợ.");
}

function requiredUserId_(payload) {
  const userId = String((payload && payload.userId) || "").trim();
  if (!userId) throw new Error("Thiếu mã tài khoản.");
  return userId;
}

function createUser_(user) {
  if (!user || !user.id || !user.username || !user.passwordHash || !user.passwordSalt) throw new Error("Tài khoản không hợp lệ.");
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

function authorize_(providedSecret) {
  const expectedSecret = PropertiesService.getScriptProperties().getProperty(SYNC_SECRET_PROPERTY);
  if (!expectedSecret || !providedSecret || providedSecret !== expectedSecret) throw new Error("Unauthorized");
}

function testConnection() {
  return spreadsheet_().getName();
}

function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID") || DEFAULT_SPREADSHEET_ID;
  return SpreadsheetApp.openById(id);
}

function readAppData_(userId) {
  migrateSingleAccountLegacyData_(userId);
  const subjects = readUserTable_(TABLES.subjects, userId);
  const students = readUserTable_(TABLES.students, userId);
  const studentSubjects = readUserTable_(TABLES.studentSubjects, userId);
  const lessons = readUserTable_(TABLES.lessons, userId);
  if (!subjects.length && !students.length && !studentSubjects.length && !lessons.length) return null;
  const meta = readTable_(TABLES.meta);
  const version = Number((meta.find((item) => item.key === "version") || {}).value || 1);
  return { version, subjects, students, studentSubjects, lessons };
}

function readUserTable_(table, userId) {
  return readTable_(table).filter((item) => String(item.userId || "").trim() === userId);
}

function migrateSingleAccountLegacyData_(userId) {
  const users = readTable_(TABLES.users);
  if (users.length !== 1 || String(users[0].id) !== userId) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const currentUsers = readTable_(TABLES.users);
    if (currentUsers.length === 1 && String(currentUsers[0].id) === userId) claimLegacyData_(userId);
  } finally {
    lock.releaseLock();
  }
}

function saveAppData_(userId, data) {
  if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.students) || !Array.isArray(data.studentSubjects) || !Array.isArray(data.lessons)) throw new Error("Dữ liệu ứng dụng không hợp lệ.");
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    writeTable_(TABLES.meta, [{ key: "version", value: data.version }, { key: "updatedAt", value: new Date().toISOString() }]);
    mergeUserTable_(TABLES.subjects, userId, data.subjects);
    mergeUserTable_(TABLES.students, userId, data.students);
    mergeUserTable_(TABLES.studentSubjects, userId, data.studentSubjects);
    mergeUserTable_(TABLES.lessons, userId, data.lessons);
  } finally {
    lock.releaseLock();
  }
}

function mergeUserTable_(table, userId, records) {
  const allRecords = readTable_(table);
  const otherAccounts = allRecords.filter((record) => String(record.userId || "").trim() !== userId);
  const accountRecords = (records || []).map((record) => Object.assign({}, record, { userId }));
  writeTable_(table, otherAccounts.concat(accountRecords));
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
  const values = sheet.getRange(1, 1, sheet.getLastRow(), table.headers.length).getValues();
  return values.slice(1).filter((row) => row.some((value) => value !== "" && value !== null)).map((row) => {
    const item = {};
    table.headers.forEach((header, index) => { item[header] = row[index]; });
    ["active"].forEach((key) => { if (key in item) item[key] = item[key] === true || item[key] === "true"; });
    ["defaultFee", "defaultDurationMinutes", "durationMinutes", "fee"].forEach((key) => { if (key in item) item[key] = Number(item[key] || 0); });
    return item;
  });
}

function writeTable_(table, records) {
  const sheet = spreadsheet_().getSheetByName(table.name) || spreadsheet_().insertSheet(table.name);
  sheet.clearContents();
  const rows = [table.headers].concat((records || []).map((record) => table.headers.map((header) => record[header] === undefined ? "" : record[header])));
  sheet.getRange(1, 1, rows.length, table.headers.length).setValues(rows);
  sheet.setFrozenRows(1);
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
