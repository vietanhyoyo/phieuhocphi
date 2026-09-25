import { AppData } from "./types";

export const STORAGE_KEY = "tutor-manager:data";
export const DATA_VERSION = 1;

function scopedStorageKey(scope: string) {
  return `${STORAGE_KEY}:${scope}`;
}

const now = () => new Date().toISOString();

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function localDateValue(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function normalizeDateValue(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return localDateValue(value);
  const text = String(value ?? "").trim();
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  if (match) return `${match[1]}-${pad(Number(match[2]))}-${pad(Number(match[3]))}`;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? localDateValue(parsed) : "";
}

export function normalizeTimeValue(value: unknown) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return `${pad(value.getHours())}:${pad(value.getMinutes())}`;
  const text = String(value ?? "").trim();
  const match = /(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/.exec(text) || /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (match) return `${pad(Number(match[1]))}:${match[2]}`;
  const parsed = new Date(text);
  return Number.isFinite(parsed.getTime()) ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : "";
}

function normalizeNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBoolean(value: unknown) {
  return value === true || value === 1 || String(value).toLowerCase() === "true";
}

export function normalizeAppData(data: AppData): AppData {
  return {
    ...data,
    subjects: data.subjects.map((subject) => ({ ...subject, active: normalizeBoolean(subject.active) })),
    students: data.students.map((student) => ({ ...student, active: normalizeBoolean(student.active) })),
    studentSubjects: data.studentSubjects.map((item) => ({ ...item, defaultFee: normalizeNumber(item.defaultFee), defaultDurationMinutes: normalizeNumber(item.defaultDurationMinutes), active: normalizeBoolean(item.active) })),
    lessons: data.lessons.map((lesson) => ({ ...lesson, lessonDate: normalizeDateValue(lesson.lessonDate), startTime: normalizeTimeValue(lesson.startTime), durationMinutes: normalizeNumber(lesson.durationMinutes), fee: normalizeNumber(lesson.fee) })),
  };
}

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
    return normalizeAppData(parsed);
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
