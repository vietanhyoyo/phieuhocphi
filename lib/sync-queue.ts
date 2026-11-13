import { AppData } from "./types";
import { isValidAppData, normalizeAppData, STORAGE_KEY } from "./storage";

type PendingSave = { revision: string; data: AppData };
const pendingKey = (scope: string) => `${STORAGE_KEY}:pending:${scope}`;
const syncedKey = (scope: string) => `${STORAGE_KEY}:synced:${scope}`;
const migratedLocalKey = (scope: string) => `${STORAGE_KEY}:migrated-local:${scope}`;
const MISSCOPED_MIGRATION_VERSION = "all-v2";

function readData(key: string): AppData | null {
  if (typeof window === "undefined") return null;
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(key) || "null");
    return isValidAppData(value) ? normalizeAppData(value) : null;
  } catch {
    return null;
  }
}

export function loadPendingSave(scope: string): PendingSave | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(pendingKey(scope)) || "null") as Partial<PendingSave>;
    return typeof value?.revision === "string" && isValidAppData(value.data)
      ? { revision: value.revision, data: normalizeAppData(value.data) }
      : null;
  } catch {
    return null;
  }
}

export function stagePendingSave(scope: string, data: AppData): PendingSave {
  const pending = { revision: crypto.randomUUID(), data: normalizeAppData(data) };
  window.localStorage.setItem(pendingKey(scope), JSON.stringify(pending));
  return pending;
}

export function clearPendingSave(scope: string, revision: string) {
  if (loadPendingSave(scope)?.revision === revision) window.localStorage.removeItem(pendingKey(scope));
}

export function loadSyncedData(scope: string) {
  return readData(syncedKey(scope));
}

export function saveSyncedData(scope: string, data: AppData) {
  window.localStorage.setItem(syncedKey(scope), JSON.stringify(normalizeAppData(data)));
}

export function hasLocalData(scope: string) {
  return typeof window !== "undefined" && window.localStorage.getItem(`${STORAGE_KEY}:${scope}`) !== null;
}

export function wasMisScopedSaveMigrated(scope: string, revision: string) {
  return window.localStorage.getItem(migratedLocalKey(scope)) === `${MISSCOPED_MIGRATION_VERSION}:${revision}`;
}

export function markMisScopedSaveMigrated(scope: string, revision: string) {
  window.localStorage.setItem(migratedLocalKey(scope), `${MISSCOPED_MIGRATION_VERSION}:${revision}`);
}

type SyncedRecord = { id: string; updatedAt?: string };

// Every edit in the app stamps updatedAt, so it identifies a record's
// version. Records without one fall back to their full content.
function recordVersion(record: SyncedRecord) {
  if (record.updatedAt) return String(record.updatedAt);
  const { userId: _owner, ...rest } = record as SyncedRecord & { userId?: unknown };
  return JSON.stringify(Object.keys(rest).sort().map((key) => [key, (rest as Record<string, unknown>)[key] ?? ""]));
}

const newer = <T extends SyncedRecord>(local: T, remote: T) => (String(remote.updatedAt ?? "") > String(local.updatedAt ?? "") ? remote : local);

// Three-way merge against the last snapshot both sides agreed on (base):
// - a record unchanged on one side takes the other side's version;
// - a record missing on one side but unchanged on the other since the base
//   was deleted there, so it stays deleted (on this device or another one);
// - a record new on either side is kept; a delete never beats a later edit.
function mergeRecords<T extends SyncedRecord>(local: T[], remote: T[], base: T[]): T[] {
  const remoteById = new Map(remote.map((record) => [record.id, record]));
  const baseById = new Map(base.map((record) => [record.id, record]));
  const changed = (record: T, baseRecord: T | undefined) => !baseRecord || recordVersion(record) !== recordVersion(baseRecord);
  const seen = new Set<string>();
  const records: T[] = [];
  for (const record of local) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    const remoteRecord = remoteById.get(record.id);
    const baseRecord = baseById.get(record.id);
    if (remoteRecord) {
      if (!baseRecord) records.push(newer(record, remoteRecord));
      else if (!changed(record, baseRecord)) records.push(remoteRecord);
      else if (!changed(remoteRecord, baseRecord)) records.push(record);
      else records.push(newer(record, remoteRecord));
    } else if (changed(record, baseRecord)) {
      records.push(record);
    }
  }
  for (const record of remote) {
    if (seen.has(record.id)) continue;
    seen.add(record.id);
    if (changed(record, baseById.get(record.id))) records.push(record);
  }
  return records;
}

// An empty server copy (null) is never read as "everything was deleted":
// that would wipe this device if the sheet were cleared or replaced.
export function reconcileData(local: AppData, remote: AppData | null, lastSynced: AppData | null): AppData {
  if (!remote) return normalizeAppData(local);
  const titleChangedHere = !lastSynced || local.timetableTitle !== lastSynced.timetableTitle;
  return normalizeAppData({
    ...local,
    subjects: mergeRecords(local.subjects, remote.subjects, lastSynced?.subjects || []),
    students: mergeRecords(local.students, remote.students, lastSynced?.students || []),
    studentSubjects: mergeRecords(local.studentSubjects, remote.studentSubjects, lastSynced?.studentSubjects || []),
    lessons: mergeRecords(local.lessons, remote.lessons, lastSynced?.lessons || []),
    timetable: mergeRecords(local.timetable || [], remote.timetable || [], lastSynced?.timetable || []),
    timetableTitle: titleChangedHere ? local.timetableTitle : remote.timetableTitle,
  });
}

export function sameData(left: AppData | null, right: AppData | null) {
  return JSON.stringify(left && normalizeAppData(left)) === JSON.stringify(right && normalizeAppData(right));
}

function recoverRecords<T extends { id: string; createdAt: string; updatedAt: string }>(account: T[], misplaced: T[]): T[] {
  const byId = new Map(account.map((record) => [record.id, record]));
  for (const record of misplaced) {
    const existing = byId.get(record.id);
    // The default math subject is seeded on every fresh local scope. It must
    // not overwrite a renamed subject in the account unless it was edited.
    const untouchedSeed = record.id === "subject-math" && record.updatedAt === record.createdAt;
    if (!existing || (!untouchedSeed && record.updatedAt > existing.updatedAt)) {
      byId.set(record.id, record);
    }
  }
  return [...byId.values()];
}

// Older offline sessions could write edits into the generic "local" scope
// when the authentication check failed. Move newer records of every type back
// to the verified account without replacing its unrelated records.
export function recoverMisScopedData(account: AppData, misplaced: AppData): AppData {
  return normalizeAppData({
    ...account,
    subjects: recoverRecords(account.subjects, misplaced.subjects),
    students: recoverRecords(account.students, misplaced.students),
    studentSubjects: recoverRecords(account.studentSubjects, misplaced.studentSubjects),
    lessons: recoverRecords(account.lessons, misplaced.lessons),
    timetable: recoverRecords(account.timetable, misplaced.timetable),
    timetableTitle: misplaced.timetableTitle !== "Thời khóa biểu" ? misplaced.timetableTitle : account.timetableTitle,
  });
}
