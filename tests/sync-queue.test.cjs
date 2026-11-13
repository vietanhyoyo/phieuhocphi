const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports = {}, context = {}) {
  const exports = {};
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? {}, ...context });
  return exports;
}

const timetable = load('lib/timetable.ts');
const storage = load('lib/storage.ts', { './timetable': timetable });
const cells = new Map();
const localStorage = {
  getItem: (key) => cells.get(key) ?? null,
  setItem: (key, value) => cells.set(key, value),
  removeItem: (key) => cells.delete(key),
  key: (index) => [...cells.keys()][index] ?? null,
  get length() { return cells.size; },
};
let counter = 0;
const queue = load('lib/sync-queue.ts', { './storage': storage }, {
  window: { localStorage },
  crypto: { randomUUID: () => `revision-${++counter}` },
});
const accountCache = load('lib/account-cache.ts', { './storage': storage }, { window: { localStorage } });

function data(lessons = []) {
  return storage.normalizeAppData({
    version: 1,
    subjects: [{ id: 'math', name: 'Toán', active: true }],
    students: [{ id: 'student', name: 'An', active: true }],
    studentSubjects: [],
    lessons,
    timetable: [],
    timetableTitle: 'Thời khóa biểu',
  });
}

function lesson(id, fee = 100000) {
  return { id, studentId: 'student', subjectId: 'math', lessonDate: '2026-11-01', startTime: '09:00', durationMinutes: 90, fee, paid: false };
}

function fullData() {
  const createdAt = '2026-01-01';
  const updatedAt = '2026-11-01';
  const stamp = { createdAt, updatedAt };
  return storage.normalizeAppData({
    version: 1,
    subjects: [{ id: 'subject-new', name: 'Văn', active: true, ...stamp }],
    students: [{ id: 'student-new', name: 'Bình', active: true, ...stamp }],
    studentSubjects: [{ id: 'assignment-new', studentId: 'student-new', subjectId: 'subject-new', defaultFee: 120000, defaultDurationMinutes: 90, active: true, ...stamp }],
    lessons: [{ ...lesson('lesson-new', 120000), studentId: 'student-new', subjectId: 'subject-new', paid: true, ...stamp }],
    timetable: [{ id: 'slot-new', dayOfWeek: 1, startTime: '08:00', endTime: '09:30', title: 'Văn', studentName: 'Bình', mode: 'in-person', color: '#fef08a', note: '', ...stamp }],
    timetableTitle: 'Lịch của Bình',
  });
}

test('pending data survives reload and a late acknowledgement cannot clear a newer edit', () => {
  cells.clear();
  const first = queue.stagePendingSave('account-a', data([lesson('one')]));
  assert.equal(queue.loadPendingSave('account-a').data.lessons[0].id, 'one');
  const second = queue.stagePendingSave('account-a', data([lesson('one'), lesson('two')]));
  queue.clearPendingSave('account-a', first.revision);
  assert.equal(queue.loadPendingSave('account-a').revision, second.revision);
  queue.clearPendingSave('account-a', second.revision);
  assert.equal(queue.loadPendingSave('account-a'), null);
});

test('the durable queue and reconciliation retain every collection and timetable title', () => {
  cells.clear();
  const local = fullData();
  queue.stagePendingSave('user-a', local);
  const pending = queue.loadPendingSave('user-a').data;
  const merged = queue.reconcileData(pending, data(), data());
  for (const [collection, id] of [['subjects', 'subject-new'], ['students', 'student-new'], ['studentSubjects', 'assignment-new'], ['lessons', 'lesson-new'], ['timetable', 'slot-new']]) {
    assert.ok(pending[collection].some((record) => record.id === id), `pending ${collection}`);
    assert.ok(merged[collection].some((record) => record.id === id), `merged ${collection}`);
  }
  assert.equal(merged.lessons[0].paid, true);
  assert.equal(merged.timetableTitle, 'Lịch của Bình');
});

test('reconciliation restores missing server records, keeps local edits, and deduplicates IDs', () => {
  const local = data([lesson('one', 120000), lesson('two')]);
  const remote = data([lesson('one'), lesson('one'), lesson('three')]);
  const merged = queue.reconcileData(local, remote, data([lesson('one')]));
  assert.deepEqual(Array.from(merged.lessons, (item) => item.id), ['one', 'two', 'three']);
  assert.equal(merged.lessons[0].fee, 120000);
});

test('a locally deleted lesson is not restored from the last synced server snapshot', () => {
  const before = data([lesson('deleted')]);
  const merged = queue.reconcileData(data(), before, before);
  assert.equal(merged.lessons.length, 0);
});

test('an offline lesson deletion survives reload and is pushed before server data is reused', () => {
  cells.clear();
  const synced = data([lesson('keep'), lesson('deleted')]);
  queue.saveSyncedData('user-a', synced);
  // Delete while offline: only the durable queue is written.
  queue.stagePendingSave('user-a', data([lesson('keep')]));
  // After reload the queue, not the stale server copy, is the local source.
  const pending = queue.loadPendingSave('user-a');
  assert.equal(pending.data.lessons.map((item) => item.id).join(), 'keep');
  // Back online: the server still has the lesson, plus one added elsewhere.
  const remote = data([lesson('keep'), lesson('deleted'), lesson('other-device')]);
  const merged = queue.reconcileData(pending.data, remote, queue.loadSyncedData('user-a'));
  assert.equal(merged.lessons.map((item) => item.id).join(), 'keep,other-device');
  assert.equal(queue.sameData(merged, remote), false, 'merged data must be pushed to the server');
});

test('pending saves and sync baselines are isolated per account', () => {
  cells.clear();
  queue.stagePendingSave('account-a', data([lesson('private')]));
  queue.saveSyncedData('account-a', data([lesson('private')]));
  assert.equal(queue.loadPendingSave('account-b'), null);
  assert.equal(queue.loadSyncedData('account-b'), null);
});

test('Apps Script keeps one row per ID when a save is retried', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.dedupe = dedupeById_;`, context);
  const rows = context.dedupe([{ id: 'one' }, { id: 'one' }, { id: 'two' }]);
  assert.deepEqual(Array.from(rows, (row) => row.id), ['one', 'two']);
});

test('Apps Script sends every collection and the timetable title to its Sheet tab', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const context = { LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) } };
  vm.runInNewContext(`${source}\nglobalThis.saveForTest = function(data) {
    var writes = [];
    writeTable_ = function(table, records) { writes.push({ name: table.name, records: records }); };
    mergeUserTable_ = function(table, userId, records) { writes.push({ name: table.name, records: records }); return true; };
    saveAppData_('user-a', data);
    return writes;
  };`, context);
  const writes = context.saveForTest(fullData());
  const names = Array.from(writes, (write) => write.name);
  assert.deepEqual(names, ['App_Subjects', 'App_Students', 'App_StudentSubjects', 'App_Lessons', 'App_Timetable', 'App_TimetableSettings', 'App_Meta']);
  assert.equal(writes.find((write) => write.name === 'App_TimetableSettings').records[0].title, 'Lịch của Bình');
  assert.equal(writes.find((write) => write.name === 'App_Lessons').records[0].paid, true);
});

test('offline reload retains the verified account and upgrades a single existing account cache', () => {
  cells.clear();
  accountCache.cacheAccount({ id: 'user-a', username: 'a@example.com' });
  assert.equal(accountCache.loadCachedAccount().id, 'user-a');
  accountCache.clearCachedAccount();
  cells.set('tutor-manager:data:user-a', JSON.stringify(data()));
  assert.equal(accountCache.loadCachedAccount().id, 'user-a');
  cells.set('tutor-manager:data:user-b', JSON.stringify(data()));
  assert.equal(accountCache.loadCachedAccount(), null);
});

test('Apps Script accepts every timetable color offered by the app', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.validate = validateTimetable_;`, context);
  for (const { value: color } of timetable.TIMETABLE_COLORS) {
    const entry = { id: 'slot', dayOfWeek: 1, startTime: '08:00', endTime: '09:30', title: 'Toán', studentName: '', mode: 'in-person', color, note: '', createdAt: 'now', updatedAt: 'now' };
    assert.doesNotThrow(() => context.validate({ timetable: [entry] }), color);
  }
});

test('offline edits of every record type written to the old local scope are recovered once', () => {
  cells.clear();
  const oldEntry = { id: 'slot', dayOfWeek: 1, startTime: '08:00', endTime: '09:30', title: 'Cũ', studentName: '', mode: 'in-person', color: '#fef08a', note: '', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  const newerEntry = { ...oldEntry, title: 'Mới', updatedAt: '2026-11-01' };
  const account = { ...data(), timetable: [oldEntry], subjects: [{ id: 'subject-math', name: 'Toán nâng cao', active: true, createdAt: '2026-01-01', updatedAt: '2026-06-01' }] };
  const misplaced = { ...fullData(), subjects: [...fullData().subjects, { id: 'subject-math', name: 'Toán', active: true, createdAt: '2026-11-01', updatedAt: '2026-11-01' }], timetable: [newerEntry, ...fullData().timetable] };
  const merged = queue.recoverMisScopedData(account, misplaced);
  assert.deepEqual(Array.from(merged.timetable, (entry) => entry.id), ['slot', 'slot-new']);
  assert.equal(merged.timetable[0].title, 'Mới');
  assert.equal(merged.timetableTitle, 'Lịch của Bình');
  assert.equal(merged.subjects.find((item) => item.id === 'subject-math').name, 'Toán nâng cao');
  for (const [collection, id] of [['subjects', 'subject-new'], ['students', 'student-new'], ['studentSubjects', 'assignment-new'], ['lessons', 'lesson-new'], ['timetable', 'slot-new']]) {
    assert.ok(merged[collection].some((record) => record.id === id), collection);
  }
  cells.set('tutor-manager:data:migrated-local:user-a', 'revision-1');
  assert.equal(queue.wasMisScopedSaveMigrated('user-a', 'revision-1'), false);
  queue.markMisScopedSaveMigrated('user-a', 'revision-1');
  assert.equal(queue.wasMisScopedSaveMigrated('user-a', 'revision-1'), true);
});

test('a deleted student and its assignments and lessons are not restored from the server', () => {
  const stamp = { createdAt: '2026-01-01', updatedAt: '2026-11-01' };
  const withStudent = storage.normalizeAppData({
    ...data([lesson('keep'), { ...lesson('gone'), studentId: 'left' }]),
    students: [{ id: 'student', name: 'An', active: true, ...stamp }, { id: 'left', name: 'Bình', active: false, ...stamp }],
    studentSubjects: [{ id: 'assign-left', studentId: 'left', subjectId: 'math', defaultFee: 1, defaultDurationMinutes: 90, active: true, ...stamp }],
  });
  const afterDelete = storage.normalizeAppData({
    ...withStudent,
    students: withStudent.students.filter((item) => item.id !== 'left'),
    studentSubjects: [],
    lessons: withStudent.lessons.filter((item) => item.studentId !== 'left'),
  });
  const merged = queue.reconcileData(afterDelete, withStudent, withStudent);
  assert.equal(merged.students.map((item) => item.id).join(), 'student');
  assert.equal(merged.studentSubjects.length, 0);
  assert.equal(merged.lessons.map((item) => item.id).join(), 'keep');
});

test('Apps Script drops rows missing from an account save but keeps other accounts', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const context = {};
  vm.runInNewContext(`${source}\nglobalThis.mergeForTest = function(rows, records) {
    var written;
    readTable_ = function() { return rows; };
    writeTable_ = function(table, next) { written = next; };
    mergeUserTable_(TABLES.students, 'user-a', records);
    return written;
  };`, context);
  const written = context.mergeForTest(
    [{ id: 'left', userId: 'user-a' }, { id: 'stay', userId: 'user-a' }, { id: 'other', userId: 'user-b' }],
    [{ id: 'stay' }],
  );
  assert.equal(Array.from(written, (row) => `${row.userId}:${row.id}`).sort().join(), 'user-a:stay,user-b:other');
});

test('Apps Script skips rewriting tables and meta when an account save changes nothing', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const context = { LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) } };
  vm.runInNewContext(`${source}\nglobalThis.saveTwice = function(data) {
    var stored = {}, writes = [];
    readTable_ = function(table) { return stored[table.name] || []; };
    writeTable_ = function(table, records) {
      writes.push(table.name);
      stored[table.name] = records.map(function(record) { var row = {}; table.headers.forEach(function(h) { row[h] = record[h] === undefined ? '' : record[h]; }); return row; });
    };
    saveAppData_('user-a', data);
    var first = writes.length;
    writes = [];
    saveAppData_('user-a', data);
    return { first: first, second: writes };
  };`, context);
  const result = context.saveTwice(fullData());
  assert.ok(result.first > 0);
  assert.deepEqual(Array.from(result.second), []);
});

function twoDevices() {
  const at = (updatedAt) => ({ createdAt: '2026-11-01T00:00:00.000Z', updatedAt });
  const student = (id, name, updatedAt = '2026-11-01T00:00:00.000Z') => ({ id, name, phone: '', parentName: '', parentPhone: '', note: '', active: true, ...at(updatedAt) });
  const synced = storage.normalizeAppData({ ...data([lesson('keep'), lesson('gone')]), students: [student('a', 'An'), student('b', 'Bình')] });
  return { student, synced };
}

test('a student and lesson deleted on another device stay deleted on a device with old local data', () => {
  const { synced } = twoDevices();
  // Device A deleted student b and lesson "gone"; device B still has them unchanged.
  const server = { ...synced, students: synced.students.filter((item) => item.id !== 'b'), lessons: synced.lessons.filter((item) => item.id !== 'gone') };
  const merged = queue.reconcileData(synced, server, synced);
  assert.equal(merged.students.map((item) => item.id).join(), 'a');
  assert.equal(merged.lessons.map((item) => item.id).join(), 'keep');
});

test('a stale device keeps its own new edits while taking deletions and edits from another device', () => {
  const { student, synced } = twoDevices();
  const server = { ...synced, students: [student('a', 'An (sửa ở máy A)', '2026-11-05T00:00:00.000Z')] };
  const local = { ...synced, students: [...synced.students, student('c', 'Cường', '2026-11-06T00:00:00.000Z')], lessons: [...synced.lessons, lesson('new-here')] };
  const merged = queue.reconcileData(local, server, synced);
  assert.equal(merged.students.map((item) => `${item.id}:${item.name}`).join(), 'a:An (sửa ở máy A),c:Cường');
  assert.equal(merged.lessons.map((item) => item.id).sort().join(), 'gone,keep,new-here');
});

test('a local edit wins over an unchanged server copy and survives a delete on another device', () => {
  const { student, synced } = twoDevices();
  const server = { ...synced, students: [synced.students[0]] };
  const local = { ...synced, students: [student('a', 'An mới', '2026-11-07T00:00:00.000Z'), student('b', 'Bình mới', '2026-11-07T00:00:00.000Z')] };
  const merged = queue.reconcileData(local, server, synced);
  assert.equal(merged.students.map((item) => item.name).join(), 'An mới,Bình mới');
});

test('an empty server copy never wipes this device', () => {
  const { synced } = twoDevices();
  assert.equal(queue.reconcileData(synced, null, synced).students.length, 2);
});

test('the timetable title follows whichever side changed it', () => {
  const { synced } = twoDevices();
  const base = { ...synced, timetableTitle: 'Lịch' };
  assert.equal(queue.reconcileData(base, { ...base, timetableTitle: 'Lịch mới' }, base).timetableTitle, 'Lịch mới');
  assert.equal(queue.reconcileData({ ...base, timetableTitle: 'Lịch của tôi' }, base, base).timetableTitle, 'Lịch của tôi');
});
