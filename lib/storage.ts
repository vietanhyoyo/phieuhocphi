import { AppData } from "./types";

export const STORAGE_KEY = "tutor-manager:data";
export const DATA_VERSION = 1;

function scopedStorageKey(scope: string) {
  return `${STORAGE_KEY}:${scope}`;
}

const now = () => new Date().toISOString();

export function createInitialData(): AppData {
  const timestamp = now();
  return {
    version: DATA_VERSION,
    subjects: [
      {
        id: "subject-math",
        name: "Toán",
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    students: [],
    studentSubjects: [],
    lessons: [],
  };
}

export function loadData(scope = "local"): AppData {
  if (typeof window === "undefined") return createInitialData();
  try {
    const key = scopedStorageKey(scope);
    let raw = window.localStorage.getItem(key);

    // Migrate the pre-account local cache to the first account only. Once it
    // is copied, remove the legacy key so a second account cannot see it.
    if (!raw) {
      raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) window.localStorage.setItem(key, raw);
      window.localStorage.removeItem(STORAGE_KEY);
    }
    if (!raw) return createInitialData();
    const parsed = JSON.parse(raw) as AppData;
    if (!isValidAppData(parsed)) return createInitialData();
    return parsed;
  } catch {
    return createInitialData();
  }
}

export function saveData(data: AppData, scope = "local") {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(scopedStorageKey(scope), JSON.stringify(data));
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function isValidAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppData>;
  return (
    typeof candidate.version === "number" &&
    Array.isArray(candidate.subjects) &&
    Array.isArray(candidate.students) &&
    Array.isArray(candidate.studentSubjects) &&
    Array.isArray(candidate.lessons)
  );
}

export function exportBackup(data: AppData) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `tutor-app-backup-${date}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
