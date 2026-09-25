import { AppData } from "@/lib/types";

export const DEFAULT_GOOGLE_SHEET_ID = "1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI";

type AppsScriptPayload = Record<string, unknown>;

export function isCloudStorageConfigured() {
  return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_SHEETS_SYNC_SECRET);
}

export function getGoogleSheetId() {
  return process.env.GOOGLE_SHEET_ID || DEFAULT_GOOGLE_SHEET_ID;
}

export async function callAppsScript(payload: AppsScriptPayload) {
  const endpoint = process.env.GOOGLE_APPS_SCRIPT_URL;
  const secret = process.env.GOOGLE_SHEETS_SYNC_SECRET;
  if (!endpoint || !secret) throw new Error("Google Sheets chưa được cấu hình.");

  const requestBody = new URLSearchParams();
  Object.entries({ ...payload, secret, spreadsheetId: getGoogleSheetId() }).forEach(([key, value]) => {
    requestBody.set(key, typeof value === "string" ? value : JSON.stringify(value));
  });
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded;charset=UTF-8" },
    body: requestBody.toString(),
    cache: "no-store",
  });
  const text = await response.text();
  let result: { ok?: boolean; error?: string; [key: string]: unknown };
  try {
    result = JSON.parse(text) as { ok?: boolean; error?: string; [key: string]: unknown };
  } catch {
    throw new Error(`Google Apps Script trả về dữ liệu không hợp lệ (${response.status}).`);
  }
  if (!response.ok || result.ok === false) {
    throw new Error(result.error || `Không thể kết nối Google Sheet (${response.status}).`);
  }
  return result;
}

export function isValidRemoteData(value: unknown): value is AppData {
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
