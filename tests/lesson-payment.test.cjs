const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

function loadTypeScript(file, imports = {}) {
  const exports = {};
  const source = readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(compiled, { exports, require: (name) => imports[name] ?? {} });
  return exports;
}

const storage = loadTypeScript('lib/storage.ts');
const utils = loadTypeScript('lib/utils.ts');

function fixture() {
  return {
    version: 1,
    subjects: [{ id: 'math', name: 'Toán', active: true }],
    students: [{ id: 'a', name: 'An', active: true }],
    studentSubjects: [],
    lessons: [
      { id: 'old', studentId: 'a', subjectId: 'math', lessonDate: '2026-10-01', startTime: '09:00', durationMinutes: 90, fee: 100000 },
      { id: 'paid', studentId: 'a', subjectId: 'math', lessonDate: '2026-10-02', startTime: '09:00', durationMinutes: 90, fee: 100000, paid: true },
      { id: 'other-month', studentId: 'a', subjectId: 'math', lessonDate: '2026-09-30', startTime: '09:00', durationMinutes: 90, fee: 100000, paid: false },
    ],
    timetable: [],
    timetableTitle: 'Thời khóa biểu',
  };
}

test('old lessons default to unpaid and paid lessons survive normalization', () => {
  const normalized = storage.normalizeAppData(fixture());
  assert.equal(normalized.lessons[0].paid, false);
  assert.equal(normalized.lessons[1].paid, true);
  assert.equal(storage.normalizeAppData(normalized).lessons[1].paid, true);
});

test('payment filter combines with month and search, and status changes update results', () => {
  const data = storage.normalizeAppData(fixture());
  const ids = (payment) => Array.from(utils.filterLessons(data, ['2026-10'], 'all', 'all', payment, 'An'), (lesson) => lesson.id);
  assert.deepEqual(ids('unpaid'), ['old']);
  assert.deepEqual(ids('paid'), ['paid']);
  assert.deepEqual(ids('all'), ['paid', 'old']);
  data.lessons[0].paid = true;
  assert.deepEqual(ids('unpaid'), []);
  assert.deepEqual(ids('paid'), ['paid', 'old']);
});

test('confirming payment on a receipt updates only its student and selected months', () => {
  const data = storage.normalizeAppData(fixture());
  data.lessons.push({ ...data.lessons[0], id: 'other-student', studentId: 'b' });
  const target = { studentId: 'a', months: ['2026-10'] };
  assert.deepEqual(Array.from(utils.getReceiptLessons(data, target), (lesson) => lesson.id), ['old', 'paid']);
  const confirmed = utils.updateReceiptLessonsPaid(data, target, true, 'now');
  assert.deepEqual(Array.from(confirmed.lessons, (lesson) => lesson.paid), [true, true, false, false]);
  assert.equal(confirmed.lessons[0].updatedAt, 'now');
  assert.equal(confirmed.lessons[1], data.lessons[1]);
  const undone = utils.updateReceiptLessonsPaid(confirmed, target, false, 'later');
  assert.deepEqual(Array.from(undone.lessons, (lesson) => lesson.paid), [false, false, false, false]);
});

test('tuition card is fully paid only when every lesson in its selected period is paid', () => {
  const data = storage.normalizeAppData(fixture());
  const target = { studentId: 'a', months: ['2026-10'] };
  assert.equal(utils.getReceiptPaymentProgress(data, target).allPaid, false);
  assert.equal(utils.getReceiptPaymentProgress(data, target).paidCount, 1);
  const paid = utils.updateReceiptLessonsPaid(data, target, true, 'now');
  assert.equal(utils.getReceiptPaymentProgress(paid, target).allPaid, true);
  assert.equal(utils.getReceiptPaymentProgress(paid, { studentId: 'a', months: ['2026-09', '2026-10'] }).allPaid, false);
  assert.equal(utils.getReceiptPaymentProgress(paid, { studentId: 'missing', months: ['2026-10'] }).allPaid, false);
});

test('Google Sheets reads legacy rows and appends paid without moving userId', () => {
  const source = readFileSync(path.join(__dirname, '../google-apps-script/Code.gs'), 'utf8');
  const rows = [
    ['id', 'studentId', 'subjectId', 'lessonDate', 'startTime', 'durationMinutes', 'fee', 'note', 'createdAt', 'updatedAt', 'userId'],
    ['old', 'a', 'math', '2026-10-01', '09:00', 90, 100000, '', 'created', 'updated', 'account-a'],
  ];
  let columns = 11;
  const sheet = {
    getLastRow: () => rows.length,
    getMaxColumns: () => columns,
    getRange: (row, col, height, width) => ({
      getValues: () => rows.slice(row - 1, row - 1 + height).map((item) => item.slice(col - 1, col - 1 + width)),
      setValues: (values) => { rows.splice(row - 1, values.length, ...values.map((item) => [...item])); },
    }),
    insertColumnsAfter: (_after, count) => { columns += count; },
    clearContents: () => { rows.length = 0; },
    setFrozenRows: () => {},
  };
  const context = { SpreadsheetApp: { openById: () => ({ getSheetByName: () => sheet }) }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } };
  vm.runInNewContext(`${source}\nglobalThis.hooks = { TABLES, readTable_, writeTable_ };`, context);
  const { TABLES, readTable_, writeTable_ } = context.hooks;
  const legacy = readTable_(TABLES.lessons);
  assert.equal(legacy[0].userId, 'account-a');
  assert.equal(legacy[0].paid, false);
  writeTable_(TABLES.lessons, [{ ...legacy[0], paid: true }]);
  assert.equal(columns, 12);
  assert.equal(rows[0][10], 'userId');
  assert.equal(rows[0][11], 'paid');
  assert.equal(readTable_(TABLES.lessons)[0].paid, true);
  assert.equal(readTable_(TABLES.lessons)[0].userId, 'account-a');
});
