const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}) {
  const exports = {};
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? {}, process, Buffer, URLSearchParams });
  return exports;
}

const changeSet = load('lib/change-set.ts');
const store = load('lib/sheets-store.ts', { './change-set': changeSet });
const { TABLES } = store;

// In-memory spreadsheet: tab name → raw rows (header included).
function memoryBackend(tabs = {}, timeZone = 'Asia/Ho_Chi_Minh') {
  const backend = {
    tabs,
    reads: 0,
    writes: [],
    async read(tables) {
      backend.reads++;
      return { values: tables.map((table) => (tabs[table.name] || []).map((row) => row.slice())), timeZone };
    },
    async write(changes) {
      backend.writes.push(changes.map((change) => change.table.name));
      for (const { table, rows } of changes) tabs[table.name] = rows.map((row) => row.slice());
    },
    rowChanges: [],
    async applyRows(changes) {
      backend.rowChanges.push(changes);
      for (const { table, set, remove } of changes) {
        const rows = tabs[table.name] || (tabs[table.name] = []);
        for (const { row, values } of set) rows[row] = values.slice();
        for (const row of [...remove].sort((a, b) => b - a)) rows.splice(row, 1);
      }
    },
  };
  return backend;
}

const stamp = { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' };
function appData(overrides = {}) {
  return {
    version: 1,
    subjects: [{ id: 'math', name: 'Toán', active: true, ...stamp }],
    students: [{ id: 's1', name: 'An', phone: '0912345678', parentName: '', parentPhone: '', note: '', active: true, ...stamp }],
    studentSubjects: [{ id: 'ss1', studentId: 's1', subjectId: 'math', defaultFee: 200000, defaultDurationMinutes: 90, active: true, ...stamp }],
    lessons: [{ id: 'l1', studentId: 's1', subjectId: 'math', lessonDate: '2026-11-02', startTime: '18:00', durationMinutes: 90, fee: 200000, note: '', paid: true, ...stamp }],
    timetable: [],
    timetableTitle: 'Lịch dạy',
    ...overrides,
  };
}

test('Sheets API store saves an account and loads it back without touching other accounts', async () => {
  const backend = memoryBackend({ App_Students: [TABLES.students.headers, ['other', 'Bình', '', '', '', '', true, '', '', 'user-b']] });
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: appData() });
  const { data } = await store.handleSheetsAction(backend, { action: 'loadData', userId: 'user-a' });
  assert.equal(data.students.length, 1);
  assert.equal(data.students[0].phone, '0912345678');
  assert.deepEqual({ ...data.lessons[0] }, { ...appData().lessons[0], userId: 'user-a' });
  assert.equal(data.timetableTitle, 'Lịch dạy');
  assert.ok(backend.tabs.App_Students.some((row) => row[0] === 'other' && row[9] === 'user-b'));
});

test('Sheets API store reads every table in a single request when loading', async () => {
  const backend = memoryBackend();
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: appData() });
  backend.reads = 0;
  await store.handleSheetsAction(backend, { action: 'loadData', userId: 'user-a' });
  assert.equal(backend.reads, 1);
});

test('Sheets API store writes only changed tables and nothing for an unchanged save', async () => {
  const backend = memoryBackend();
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: appData() });
  backend.writes = [];
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: appData() });
  assert.deepEqual(backend.writes, []);
  const paidLater = appData({ lessons: [{ ...appData().lessons[0], paid: false }] });
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: paidLater });
  assert.equal(JSON.stringify(backend.writes), JSON.stringify([['App_Lessons', 'App_Meta']]));
});

test('Sheets API store reports the old row count so a shrunk table can clear its tail', async () => {
  const backend = memoryBackend();
  const twoLessons = appData({ lessons: [appData().lessons[0], { ...appData().lessons[0], id: 'l2' }] });
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: twoLessons });
  let captured;
  const write = backend.write;
  backend.write = async (changes) => { captured = changes; return write(changes); };
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: appData() });
  const lessons = captured.find((change) => change.table.name === 'App_Lessons');
  assert.equal(lessons.previousRowCount, 3);
  assert.equal(lessons.rows.length, 2);
});

test('Sheets API store reads date, time and timestamp cells written by the old Apps Script', async () => {
  const serial = (utcMs) => utcMs / 86400000 + 25569;
  const backend = memoryBackend({
    App_Users: [TABLES.users.headers, ['user-a', 'a', 'h', 's']],
    App_Lessons: [TABLES.lessons.headers, ['l1', 's1', 'math', serial(Date.UTC(2026, 10, 2)), 0.75, 90, 200000, '', serial(Date.UTC(2026, 10, 2, 21, 30)), '2026-11-02T14:30:00.000Z', 'user-a', 'TRUE']],
  });
  const { data } = await store.handleSheetsAction(backend, { action: 'loadData', userId: 'user-a' });
  const lesson = data.lessons[0];
  assert.equal(lesson.lessonDate, '2026-11-02');
  assert.equal(lesson.startTime, '18:00');
  // 21:30 wall clock in Vietnam (UTC+7) is 14:30 UTC.
  assert.equal(lesson.createdAt, '2026-11-02T14:30:00.000Z');
  assert.equal(lesson.paid, true);
});

test('Sheets API store gives rows without an owner to the only account', async () => {
  const backend = memoryBackend({
    App_Users: [TABLES.users.headers, ['user-a', 'a', 'h', 's']],
    App_Subjects: [TABLES.subjects.headers, ['math', 'Toán', true, '', '', '']],
  });
  const { data } = await store.handleSheetsAction(backend, { action: 'loadData', userId: 'user-a' });
  assert.equal(data.subjects[0].id, 'math');
  assert.equal(backend.tabs.App_Subjects[1][5], 'user-a');
});

test('Sheets API store creates accounts once and changes passwords only from the expected hash', async () => {
  const backend = memoryBackend();
  const user = { id: 'user-a', username: 'An', passwordHash: 'a'.repeat(64), passwordSalt: 'b'.repeat(32), ...stamp };
  await store.handleSheetsAction(backend, { action: 'createUser', user });
  await assert.rejects(store.handleSheetsAction(backend, { action: 'createUser', user: { ...user, id: 'user-b', username: 'an ' } }), /đã tồn tại/);
  const found = (await store.handleSheetsAction(backend, { action: 'findUser', username: 'an' })).user;
  assert.equal(found.bankName, 'TECHCOMBANK');
  const change = { action: 'updateUserPassword', userId: 'user-a', passwordHash: 'c'.repeat(64), passwordSalt: 'd'.repeat(32) };
  assert.equal((await store.handleSheetsAction(backend, { ...change, expectedPasswordHash: 'x', expectedPasswordSalt: 'y' })).updated, false);
  assert.equal((await store.handleSheetsAction(backend, { ...change, expectedPasswordHash: user.passwordHash, expectedPasswordSalt: user.passwordSalt })).updated, true);
  assert.equal((await store.handleSheetsAction(backend, { action: 'listUsers' })).userCount, 1);
});

test('Sheets API backend writes new rows before clearing the leftover tail', async () => {
  const calls = [];
  const api = {
    serviceAccountConfig: () => ({ email: 'x', key: 'y' }),
    getSpreadsheetInfo: async () => ({ timeZone: 'Asia/Ho_Chi_Minh', sheets: { App_Lessons: { sheetId: 7, title: 'App_Lessons', rowCount: 2, columnCount: 12 } } }),
    batchGetValues: async () => [],
    batchUpdateSpreadsheet: async (id, requests) => { if (requests.length) calls.push(['structure', requests]); },
    batchUpdateValues: async (id, data) => calls.push(['update', data.map((item) => item.range)]),
    batchClearValues: async (id, ranges) => { if (ranges.length) calls.push(['clear', ranges]); },
    quoteSheet: (title) => `'${title}'`,
    columnLetter: (n) => String.fromCharCode(64 + n),
  };
  const server = load('lib/server-sheets.ts', { '@/lib/google-sheets-api': api, '@/lib/sheets-store': store, '@/lib/change-set': changeSet });
  const rows = [TABLES.lessons.headers, ['l1'], ['l2']];
  await server.sheetsApiBackend('sheet').write([
    { table: TABLES.lessons, rows, previousRowCount: 5 },
    { table: TABLES.meta, rows: [TABLES.meta.headers], previousRowCount: 0 },
  ]);
  assert.deepEqual(calls.map((call) => call[0]), ['structure', 'update', 'clear']);
  assert.equal(calls[0][1][0].appendDimension.sheetId, 7);
  assert.equal(calls[0][1][1].addSheet.properties.title, 'App_Meta');
  assert.deepEqual(calls[2][1], ["'App_Lessons'!A4:L5"]);
});

test('a change set lists only added, edited and deleted records and ignores the server userId', () => {
  const base = appData({ lessons: [appData().lessons[0], { ...appData().lessons[0], id: 'l2' }] });
  const server = { ...base, students: base.students.map((item) => ({ ...item, userId: 'user-a' })) };
  const next = { ...base, lessons: [{ ...base.lessons[0], note: 'sửa' }, { ...base.lessons[0], id: 'l3' }], timetableTitle: 'Lịch mới' };
  const changes = changeSet.diffData(server, next);
  assert.equal(JSON.stringify(Object.keys(changes).sort()), JSON.stringify(['lessons', 'timetableTitle']));
  assert.equal(changes.lessons.upsert.map((item) => item.id).join(), 'l1,l3');
  assert.equal(changes.lessons.delete.join(), 'l2');
  assert.ok(changeSet.isEmptyChangeSet(changeSet.diffData(next, next)));
  const applied = changeSet.applyChangeSet(base, changes);
  assert.equal(applied.lessons.map((item) => `${item.id}:${item.note}`).join(), 'l1:sửa,l3:');
  assert.equal(changeSet.parseChangeSet({ lessons: { upsert: [{ name: 'no id' }], delete: [] } }), null);
  assert.equal(changeSet.parseChangeSet({ hacked: { upsert: [], delete: [] } }), null);
});

test('applying changes edits only the named rows of this account in place', async () => {
  const backend = memoryBackend();
  const twoLessons = appData({ lessons: [appData().lessons[0], { ...appData().lessons[0], id: 'l2' }] });
  await store.handleSheetsAction(backend, { action: 'saveData', userId: 'user-a', data: twoLessons });
  backend.tabs.App_Lessons.push(['other', 's9', 'math', '2026-11-03', '08:00', 60, 1, '', '', '', 'user-b', false]);
  backend.reads = 0;
  const changes = { lessons: { upsert: [{ ...twoLessons.lessons[1], note: 'sửa' }, { ...twoLessons.lessons[0], id: 'l3' }], delete: ['l1'] } };
  await store.handleSheetsAction(backend, { action: 'applyChanges', userId: 'user-a', changes });
  assert.equal(backend.reads, 1);
  const [[lessons]] = backend.rowChanges;
  assert.equal(JSON.stringify(lessons.set.map((item) => item.row)), JSON.stringify([2, 4]));
  assert.equal(JSON.stringify(lessons.remove), JSON.stringify([1]));
  assert.equal(backend.tabs.App_Lessons.map((row) => `${row[0]}:${row[7]}:${row[10]}`).join(), 'id:note:userId,l2:sửa:user-a,other::user-b,l3::user-a');
  const { data } = await store.handleSheetsAction(backend, { action: 'loadData', userId: 'user-a' });
  assert.equal(data.lessons.map((item) => item.id).join(), 'l2,l3');
});

test('applying changes never deletes a row of another account with the same id', async () => {
  const backend = memoryBackend({ App_Students: [TABLES.students.headers, ['s1', 'Của B', '', '', '', '', true, '', '', 'user-b']] });
  await store.handleSheetsAction(backend, { action: 'applyChanges', userId: 'user-a', changes: { students: { upsert: [], delete: ['s1'] }, timetableTitle: 'Lịch' } });
  assert.equal(backend.tabs.App_Students.length, 2);
  assert.equal(backend.tabs.App_TimetableSettings[1].join(), 'title,Lịch,user-a');
});

test('Sheets API row changes go out as one batch: grow, edit, then delete bottom-up', async () => {
  const batches = [];
  const api = {
    serviceAccountConfig: () => ({ email: 'x', key: 'y' }),
    getSpreadsheetInfo: async () => ({ timeZone: 'Asia/Ho_Chi_Minh', sheets: { App_Lessons: { sheetId: 7, title: 'App_Lessons', rowCount: 3, columnCount: 12 } } }),
    batchUpdateSpreadsheet: async (id, requests) => batches.push(requests),
  };
  const server = load('lib/server-sheets.ts', { '@/lib/google-sheets-api': api, '@/lib/sheets-store': store, '@/lib/change-set': changeSet });
  await server.sheetsApiBackend('sheet').applyRows([{ table: TABLES.lessons, set: [{ row: 4, values: ['l9', '', 'math', '2026-11-02', '18:00', 90, 200000, '', '', '', 'user-a', true] }], remove: [1, 2] }]);
  assert.equal(batches.length, 1);
  const kinds = batches[0].map((request) => Object.keys(request)[0]);
  assert.equal(kinds.join(), 'appendDimension,updateCells,deleteDimension,deleteDimension');
  assert.equal(batches[0][2].deleteDimension.range.startIndex, 2);
  const cells = batches[0][1].updateCells.rows[0].values;
  assert.equal(JSON.stringify(cells[1]), '{}');
  assert.equal(cells[5].userEnteredValue.numberValue, 90);
  assert.equal(cells[11].userEnteredValue.boolValue, true);
  assert.equal(cells[3].userEnteredValue.stringValue, '2026-11-02');
});
