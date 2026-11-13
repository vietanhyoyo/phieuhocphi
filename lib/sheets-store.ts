// Server-side port of google-apps-script/Code.gs that talks to the Sheets API
// directly. Table layout and rules must stay identical to Code.gs so either
// backend can read what the other wrote.

export type TableDef = { name: string; headers: string[] };
export type SheetRecord = Record<string, unknown>;
export type TableWrite = { table: TableDef; rows: unknown[][]; previousRowCount: number };

// Reads always return the raw cell rows (header included) of every table asked
// for, in one round trip. Missing tabs come back as [].
export interface SheetsBackend {
  read(tables: TableDef[]): Promise<{ values: unknown[][][]; timeZone: string }>;
  write(changes: TableWrite[]): Promise<void>;
}

export const TABLES = {
  meta: { name: "App_Meta", headers: ["key", "value"] },
  users: { name: "App_Users", headers: ["id", "username", "passwordHash", "passwordSalt", "createdAt", "updatedAt", "bankName", "bankAccountName", "bankAccountNumber", "bankQrImage"] },
  subjects: { name: "App_Subjects", headers: ["id", "name", "active", "createdAt", "updatedAt", "userId"] },
  students: { name: "App_Students", headers: ["id", "name", "phone", "parentName", "parentPhone", "note", "active", "createdAt", "updatedAt", "userId"] },
  studentSubjects: { name: "App_StudentSubjects", headers: ["id", "studentId", "subjectId", "defaultFee", "defaultDurationMinutes", "active", "createdAt", "updatedAt", "userId"] },
  lessons: { name: "App_Lessons", headers: ["id", "studentId", "subjectId", "lessonDate", "startTime", "durationMinutes", "fee", "note", "createdAt", "updatedAt", "userId", "paid"] },
  timetable: { name: "App_Timetable", headers: ["id", "dayOfWeek", "startTime", "endTime", "title", "studentName", "mode", "color", "note", "createdAt", "updatedAt", "userId"] },
  timetableSettings: { name: "App_TimetableSettings", headers: ["id", "title", "userId"] },
} satisfies Record<string, TableDef>;

const ACCOUNT_TABLES = [TABLES.subjects, TABLES.students, TABLES.studentSubjects, TABLES.lessons, TABLES.timetable, TABLES.timetableSettings];
const LEGACY_TABLES = [TABLES.subjects, TABLES.students, TABLES.studentSubjects, TABLES.lessons];
const TIMETABLE_COLORS = ["#fef08a", "#fdba74", "#fca5a5", "#fbcfe8", "#f0abfc", "#ddd6fe", "#67e8f9", "#93c5fd", "#5eead4", "#bbf7d0", "#bef264", "#a5f3fc", "#fde68a", "#d1d5db"];

// Apps Script had LockService; here one process serialises its own writes.
let lockChain: Promise<unknown> = Promise.resolve();
function withLock<T>(task: () => Promise<T>): Promise<T> {
  const run = lockChain.then(task, task);
  lockChain = run.catch(() => undefined);
  return run;
}

// ---- Cell conversion -------------------------------------------------------

const SERIAL_EPOCH_DAYS = 25569; // 1899-12-30 → 1970-01-01
const pad2 = (value: number) => String(value).padStart(2, "0");

// A serial number is the wall-clock time in the sheet's time zone.
function serialToWallClock(serial: number) {
  return new Date(Math.round((serial - SERIAL_EPOCH_DAYS) * 86_400_000));
}

function zoneOffsetMs(utcMs: number, timeZone: string) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(utcMs)).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

function serialToIso(serial: number, timeZone: string) {
  const wall = serialToWallClock(serial).getTime();
  let utc = wall - zoneOffsetMs(wall, timeZone);
  utc = wall - zoneOffsetMs(utc, timeZone);
  return new Date(utc).toISOString();
}

export function normalizeDateCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = serialToWallClock(value);
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
  }
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  return match ? `${match[1]}-${pad2(Number(match[2]))}-${pad2(Number(match[3]))}` : text;
}

export function normalizeTimeCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const minutes = Math.round((((value % 1) + 1) % 1) * 24 * 60) % (24 * 60);
    return `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`;
  }
  const text = String(value ?? "").trim();
  const match = /(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/.exec(text) || /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  return match ? `${pad2(Number(match[1]))}:${match[2]}` : text;
}

function finiteNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseTable(table: TableDef, values: unknown[][], timeZone: string): SheetRecord[] {
  return values.slice(1)
    .filter((row) => row.some((value) => value !== "" && value !== null && value !== undefined))
    .map((row) => {
      const item: SheetRecord = {};
      table.headers.forEach((header, index) => { item[header] = row[index] ?? ""; });
      for (const key of ["active", "paid"]) if (key in item) item[key] = item[key] === true || String(item[key]).toLowerCase() === "true";
      for (const key of ["defaultFee", "defaultDurationMinutes", "durationMinutes", "fee", "dayOfWeek"]) if (key in item) item[key] = finiteNumber(item[key]);
      if ("lessonDate" in item) item.lessonDate = normalizeDateCell(item.lessonDate);
      for (const key of ["startTime", "endTime"]) if (key in item) item[key] = normalizeTimeCell(item[key]);
      // Older Apps Script writes let Sheets turn ISO stamps into date cells.
      for (const key of ["createdAt", "updatedAt"]) if (typeof item[key] === "number") item[key] = serialToIso(item[key] as number, timeZone);
      return item;
    });
}

function toRows(table: TableDef, records: SheetRecord[]) {
  return [table.headers as unknown[]].concat(records.map((record) => table.headers.map((header) => {
    const value = record[header];
    return value === undefined || value === null ? "" : value;
  })));
}

// Any doubt counts as a change, so a needed write is never skipped.
export function sameRecords(table: TableDef, current: SheetRecord[], next: SheetRecord[]) {
  if (current.length !== next.length) return false;
  const cell = (value: unknown) => (value === undefined || value === null ? "" : String(value));
  return current.every((record, row) => table.headers.every((header) => cell(record[header]) === cell(next[row][header])));
}

function dedupeById(records: SheetRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const id = String(record.id ?? "").trim();
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

const ownerOf = (record: SheetRecord) => String(record.userId ?? "").trim();

// ---- Snapshot of several tables read in one request ------------------------

type Snapshot = Map<TableDef, { records: SheetRecord[]; rowCount: number }>;

async function readSnapshot(backend: SheetsBackend, tables: TableDef[]): Promise<Snapshot> {
  const { values, timeZone } = await backend.read(tables);
  return new Map(tables.map((table, index) => [table, { records: parseTable(table, values[index] ?? [], timeZone), rowCount: (values[index] ?? []).length }]));
}

function tableWrite(snapshot: Snapshot, table: TableDef, records: SheetRecord[]): TableWrite {
  return { table, rows: toRows(table, records), previousRowCount: snapshot.get(table)?.rowCount ?? 0 };
}

function legacyClaims(snapshot: Snapshot, userId: string): TableWrite[] {
  return LEGACY_TABLES.flatMap((table) => {
    const records = snapshot.get(table)?.records ?? [];
    if (!records.some((record) => !ownerOf(record))) return [];
    return [tableWrite(snapshot, table, records.map((record) => (ownerOf(record) ? record : { ...record, userId })))];
  });
}

// ---- Actions ---------------------------------------------------------------

function requiredUserId(payload: SheetRecord) {
  const userId = String(payload.userId ?? "").trim();
  if (!userId) throw new Error("Thiếu mã tài khoản.");
  return userId;
}

async function loadData(backend: SheetsBackend, userId: string) {
  let snapshot = await readSnapshot(backend, [TABLES.users, TABLES.meta, ...ACCOUNT_TABLES]);
  const users = snapshot.get(TABLES.users)!.records;
  // Data created before multi-account support belongs to the only account.
  if (users.length === 1 && String(users[0].id) === userId && legacyClaims(snapshot, userId).length) {
    snapshot = await withLock(async () => {
      const fresh = await readSnapshot(backend, [TABLES.users, TABLES.meta, ...ACCOUNT_TABLES]);
      const freshUsers = fresh.get(TABLES.users)!.records;
      if (freshUsers.length === 1 && String(freshUsers[0].id) === userId) await backend.write(legacyClaims(fresh, userId));
      return readSnapshot(backend, [TABLES.users, TABLES.meta, ...ACCOUNT_TABLES]);
    });
  }
  const mine = (table: TableDef) => dedupeById(snapshot.get(table)!.records.filter((record) => ownerOf(record) === userId));
  const [subjects, students, studentSubjects, lessons, timetable, timetableSettings] = ACCOUNT_TABLES.map(mine);
  if (!subjects.length && !students.length && !studentSubjects.length && !lessons.length && !timetable.length && !timetableSettings.length) return null;
  const meta = snapshot.get(TABLES.meta)!.records;
  const version = Number(meta.find((item) => item.key === "version")?.value || 1);
  const timetableTitle = timetableSettings.length ? String(timetableSettings[0].title || "Thời khóa biểu") : "Thời khóa biểu";
  return { version, subjects, students, studentSubjects, lessons, timetable, timetableTitle };
}

export function validateTimetable(data: SheetRecord) {
  if (data.timetableTitle !== undefined && (typeof data.timetableTitle !== "string" || data.timetableTitle.length > 120)) throw new Error("Tiêu đề thời khóa biểu không hợp lệ.");
  if (data.timetable === undefined) return;
  if (!Array.isArray(data.timetable)) throw new Error("Thời khóa biểu không hợp lệ.");
  const ids = new Set<string>();
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  for (const item of data.timetable as SheetRecord[]) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)
      || !Number.isInteger(item.dayOfWeek) || (item.dayOfWeek as number) < 1 || (item.dayOfWeek as number) > 7
      || typeof item.startTime !== "string" || typeof item.endTime !== "string" || !time.test(item.startTime) || !time.test(item.endTime) || item.startTime >= item.endTime
      || typeof item.title !== "string" || !item.title.trim() || item.title.length > 100
      || typeof item.studentName !== "string" || item.studentName.length > 100
      || (item.mode !== "online" && item.mode !== "in-person") || !TIMETABLE_COLORS.includes(item.color as string)
      || typeof item.note !== "string" || item.note.length > 300
      || typeof item.createdAt !== "string" || typeof item.updatedAt !== "string") throw new Error("Ca trong thời khóa biểu không hợp lệ.");
    ids.add(item.id);
  }
}

async function saveData(backend: SheetsBackend, userId: string, data: SheetRecord) {
  if (!data || !Array.isArray(data.subjects) || !Array.isArray(data.students) || !Array.isArray(data.studentSubjects) || !Array.isArray(data.lessons)) throw new Error("Dữ liệu ứng dụng không hợp lệ.");
  validateTimetable(data);
  const incoming = new Map<TableDef, SheetRecord[]>([
    [TABLES.subjects, data.subjects as SheetRecord[]],
    [TABLES.students, data.students as SheetRecord[]],
    [TABLES.studentSubjects, data.studentSubjects as SheetRecord[]],
    [TABLES.lessons, data.lessons as SheetRecord[]],
  ]);
  // Older clients omit these fields: preserve the existing weekly schedule.
  if (Array.isArray(data.timetable)) incoming.set(TABLES.timetable, data.timetable as SheetRecord[]);
  if (typeof data.timetableTitle === "string") incoming.set(TABLES.timetableSettings, [{ id: "title", title: data.timetableTitle }]);

  await withLock(async () => {
    const tables = [...incoming.keys()];
    const snapshot = await readSnapshot(backend, [TABLES.meta, ...tables]);
    const changes: TableWrite[] = [];
    for (const table of tables) {
      const current = snapshot.get(table)!.records;
      const others = current.filter((record) => ownerOf(record) !== userId);
      const mine = dedupeById(incoming.get(table)!.map((record) => ({ ...record, userId })));
      const next = others.concat(mine);
      if (!sameRecords(table, current, next)) changes.push(tableWrite(snapshot, table, next));
    }
    if (!changes.length) return;
    changes.push(tableWrite(snapshot, TABLES.meta, [{ key: "version", value: data.version }, { key: "updatedAt", value: new Date().toISOString() }]));
    await backend.write(changes);
  });
}

export function bankAccountForUsername(username: unknown) {
  return String(username ?? "").trim().toLowerCase() === "khadang2004cm@gmail.com"
    ? { bankName: "MB BANK", bankAccountName: "DANG VU KHA", bankAccountNumber: "20402023979", bankQrImage: "/dang-vu-kha-qr.png" }
    : { bankName: "TECHCOMBANK", bankAccountName: "DANH MINH HIEU", bankAccountNumber: "8804040202", bankQrImage: "/danh-minh-hieu-qr.png" };
}

async function createUser(backend: SheetsBackend, input: unknown) {
  const raw = input as SheetRecord | null;
  if (!raw || !raw.id || !raw.username || !raw.passwordHash || !raw.passwordSalt) throw new Error("Tài khoản không hợp lệ.");
  const user: SheetRecord = { ...raw, ...bankAccountForUsername(raw.username) };
  return withLock(async () => {
    const snapshot = await readSnapshot(backend, [TABLES.users, ...LEGACY_TABLES]);
    const users = snapshot.get(TABLES.users)!.records;
    const username = String(user.username).trim().toLowerCase();
    if (users.some((item) => String(item.username).trim().toLowerCase() === username)) throw new Error("Tên đăng nhập đã tồn tại.");
    // The first account inherits data saved before accounts existed.
    const changes = users.length === 0 ? legacyClaims(snapshot, String(user.id)) : [];
    changes.push(tableWrite(snapshot, TABLES.users, users.concat([user])));
    await backend.write(changes);
    return { ok: true, user };
  });
}

async function updateUserPassword(backend: SheetsBackend, payload: SheetRecord) {
  const userId = requiredUserId(payload);
  const passwordHash = String(payload.passwordHash ?? "");
  const passwordSalt = String(payload.passwordSalt ?? "");
  const updatedAt = String(payload.updatedAt || new Date().toISOString());
  if (!/^[a-f0-9]{64}$/i.test(passwordHash) || !/^[a-f0-9]{32}$/i.test(passwordSalt)) throw new Error("Mật khẩu mới không hợp lệ.");
  return withLock(async () => {
    const snapshot = await readSnapshot(backend, [TABLES.users]);
    const users = snapshot.get(TABLES.users)!.records;
    const index = users.findIndex((user) => String(user.id) === userId);
    if (index < 0) return { ok: true, updated: false };
    const user = users[index];
    if (String(user.passwordHash) !== String(payload.expectedPasswordHash ?? "") || String(user.passwordSalt) !== String(payload.expectedPasswordSalt ?? "")) {
      return { ok: true, updated: false };
    }
    users[index] = { ...user, passwordHash, passwordSalt, updatedAt };
    await backend.write([tableWrite(snapshot, TABLES.users, users)]);
    return { ok: true, updated: true };
  });
}

export async function handleSheetsAction(backend: SheetsBackend, payload: SheetRecord): Promise<{ ok: boolean; [key: string]: unknown }> {
  const action = String(payload.action || "loadData");
  if (action === "loadData") return { ok: true, data: await loadData(backend, requiredUserId(payload)) };
  if (action === "saveData") {
    await saveData(backend, requiredUserId(payload), payload.data as SheetRecord);
    return { ok: true };
  }
  if (action === "listUsers") {
    const users = (await readSnapshot(backend, [TABLES.users])).get(TABLES.users)!.records;
    return { ok: true, hasUsers: users.length > 0, userCount: users.length };
  }
  if (action === "findUser") {
    const username = String(payload.username ?? "").trim().toLowerCase();
    const users = (await readSnapshot(backend, [TABLES.users])).get(TABLES.users)!.records;
    return { ok: true, user: users.find((item) => String(item.username).toLowerCase() === username) || null };
  }
  if (action === "createUser") return createUser(backend, payload.user);
  if (action === "updateUserPassword") return updateUserPassword(backend, payload);
  throw new Error("Action không được hỗ trợ.");
}
