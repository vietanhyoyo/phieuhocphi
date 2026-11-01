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

function mergeRecords<T extends { id: string }>(local: T[], remote: T[], previous: T[]): T[] {
  const previousIds = new Set(previous.map((record) => record.id));
  const seen = new Set<string>();
  const records: T[] = [];
  for (const record of local) {
    if (!seen.has(record.id)) { records.push(record); seen.add(record.id); }
  }
  for (const record of remote) {
    if (!seen.has(record.id) && !previousIds.has(record.id)) { records.push(record); seen.add(record.id); }
  }
  return records;
}

// Local records win on ID conflicts. A record absent locally but present in
// the last confirmed snapshot was deleted locally, so it must not reappear.
export function reconcileData(local: AppData, remote: AppData | null, lastSynced: AppData | null): AppData {
  if (!remote) return normalizeAppData(local);
  return normalizeAppData({
    ...local,
    subjects: mergeRecords(local.subjects, remote.subjects, lastSynced?.subjects || []),
    students: mergeRecords(local.students, remote.students, lastSynced?.students || []),
    studentSubjects: mergeRecords(local.studentSubjects, remote.studentSubjects, lastSynced?.studentSubjects || []),
    lessons: mergeRecords(local.lessons, remote.lessons, lastSynced?.lessons || []),
    timetable: mergeRecords(local.timetable || [], remote.timetable || [], lastSynced?.timetable || []),
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
