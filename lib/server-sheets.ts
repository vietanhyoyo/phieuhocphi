import { AppData } from "@/lib/types";
import {
  batchClearValues, batchGetValues, batchUpdateSpreadsheet, batchUpdateValues, columnLetter, getSpreadsheetInfo, quoteSheet, serviceAccountConfig,
} from "@/lib/google-sheets-api";
import { handleSheetsAction, SheetsBackend, TableWrite } from "@/lib/sheets-store";

export const DEFAULT_GOOGLE_SHEET_ID = "1zBAWSnDb0h1oLsTkJzgclUXHtUrcG8FSIQ32NJ1jiDI";

type SheetsPayload = Record<string, unknown>;
type SheetsResult = { ok?: boolean; error?: string; [key: string]: unknown };

function isAppsScriptConfigured() {
  return Boolean(process.env.GOOGLE_APPS_SCRIPT_URL && process.env.GOOGLE_SHEETS_SYNC_SECRET);
}

export function isSheetsApiConfigured() {
  return Boolean(serviceAccountConfig());
}

export function isCloudStorageConfigured() {
  return isSheetsApiConfigured() || isAppsScriptConfigured();
}

export function getGoogleSheetId() {
  return process.env.GOOGLE_SHEET_ID || DEFAULT_GOOGLE_SHEET_ID;
}

// The Sheets API (service account) is used when configured; otherwise the
// older Apps Script web app. Both read and write the same tabs.
export async function callSheets(payload: SheetsPayload): Promise<SheetsResult> {
  if (isSheetsApiConfigured()) return handleSheetsAction(sheetsApiBackend(getGoogleSheetId()), payload);
  return callAppsScript(payload);
}

export function sheetsApiBackend(spreadsheetId: string): SheetsBackend {
  return {
    async read(tables) {
      const info = await getSpreadsheetInfo(spreadsheetId);
      const present = tables.filter((table) => info.sheets[table.name]);
      const values = await batchGetValues(spreadsheetId, present.map((table) => `${quoteSheet(table.name)}!A1:${columnLetter(table.headers.length)}`));
      const byName = new Map(present.map((table, index) => [table.name, values[index]]));
      return { values: tables.map((table) => byName.get(table.name) ?? []), timeZone: info.timeZone };
    },

    async write(changes: TableWrite[]) {
      if (!changes.length) return;
      // Fresh metadata: grid sizes must be exact before writing past them.
      const info = await getSpreadsheetInfo(spreadsheetId, true);
      const structure: object[] = [];
      for (const { table, rows } of changes) {
        const sheet = info.sheets[table.name];
        const width = table.headers.length;
        if (!sheet) {
          structure.push({ addSheet: { properties: { title: table.name, gridProperties: { rowCount: Math.max(rows.length + 100, 1000), columnCount: Math.max(width, 26), frozenRowCount: 1 } } } });
          continue;
        }
        if (sheet.rowCount < rows.length) structure.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "ROWS", length: rows.length - sheet.rowCount + 100 } });
        if (sheet.columnCount < width) structure.push({ appendDimension: { sheetId: sheet.sheetId, dimension: "COLUMNS", length: width - sheet.columnCount } });
      }
      await batchUpdateSpreadsheet(spreadsheetId, structure);

      // New rows are written over the old ones first, then only the leftover
      // tail is cleared, so a failure in between never leaves a table empty.
      await batchUpdateValues(spreadsheetId, changes.map(({ table, rows }) => ({ range: `${quoteSheet(table.name)}!A1`, values: rows })));
      await batchClearValues(spreadsheetId, changes
        .filter(({ rows, previousRowCount }) => previousRowCount > rows.length)
        .map(({ table, rows, previousRowCount }) => `${quoteSheet(table.name)}!A${rows.length + 1}:${columnLetter(table.headers.length)}${previousRowCount}`));
    },
  };
}

export async function callAppsScript(payload: SheetsPayload): Promise<SheetsResult> {
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
  let result: SheetsResult;
  try {
    result = JSON.parse(text) as SheetsResult;
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
