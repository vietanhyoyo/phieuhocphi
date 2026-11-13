import { createSign } from "node:crypto";

// Minimal Google Sheets REST client authenticated as a service account.
// Signing the JWT with node:crypto avoids pulling in the googleapis package.

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const METADATA_TTL_MS = 5 * 60 * 1000;

export type SheetProperties = { sheetId: number; title: string; rowCount: number; columnCount: number };
export type SpreadsheetInfo = { timeZone: string; sheets: Record<string, SheetProperties> };

const unquote = (value: string) => {
  const text = value.trim();
  return text.length > 1 && (text[0] === '"' || text[0] === "'") && text.at(-1) === text[0] ? text.slice(1, -1).trim() : text;
};

// Hosting dashboards mangle multi-line secrets in many ways: wrapping
// quotes, literal "\n", real or Windows line breaks, newlines turned into
// spaces, base64, or the whole JSON key file. Rebuild a clean PEM from any.
export function normalizePrivateKey(raw: string) {
  let key = unquote(raw);
  if (key.startsWith("{")) {
    try { key = String((JSON.parse(key) as { private_key?: unknown }).private_key ?? ""); } catch { /* not JSON */ }
  }
  if (!key.includes("-----BEGIN")) {
    const decoded = Buffer.from(key, "base64").toString("utf8");
    if (decoded.includes("-----BEGIN")) key = decoded;
  }
  key = key.replace(/\\r/g, "").replace(/\\n/g, "\n");
  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]*?)-----END \1-----/.exec(key);
  if (!match) return key.trim();
  const body = match[2].replace(/[^A-Za-z0-9+/=]/g, "");
  return `-----BEGIN ${match[1]}-----\n${body.match(/.{1,64}/g)?.join("\n") ?? ""}\n-----END ${match[1]}-----\n`;
}

export function serviceAccountConfig() {
  const email = unquote(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ?? "");
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  const key = raw.trim() ? normalizePrivateKey(raw) : "";
  return email && key ? { email, key } : null;
}

let tokenPromise: Promise<{ value: string; expiresAt: number }> | null = null;

async function fetchToken() {
  const config = serviceAccountConfig();
  if (!config) throw new Error("Chưa cấu hình service account cho Google Sheets.");
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({ iss: config.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`;
  let signature: string;
  try {
    signature = createSign("RSA-SHA256").update(unsigned).sign(config.key, "base64url");
  } catch {
    throw new Error("Không đọc được GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY. Hãy dán lại giá trị private_key trong file JSON của service account.");
  }
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) throw new Error(`Không lấy được quyền truy cập Google Sheets: ${body.error_description || response.status}`);
  return { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
}

async function accessToken() {
  const cached = tokenPromise && (await tokenPromise.catch(() => null));
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;
  tokenPromise = fetchToken();
  tokenPromise.catch(() => { tokenPromise = null; });
  return (await tokenPromise).value;
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  });
  const body = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) {
    const message = body.error?.message || `HTTP ${response.status}`;
    throw new Error(response.status === 403
      ? `Service account chưa được chia sẻ quyền chỉnh sửa Google Sheet (${message}).`
      : `Google Sheets API lỗi: ${message}`);
  }
  return body;
}

const metadataCache = new Map<string, { info: SpreadsheetInfo; expiresAt: number }>();

export async function getSpreadsheetInfo(spreadsheetId: string, fresh = false): Promise<SpreadsheetInfo> {
  const cached = metadataCache.get(spreadsheetId);
  if (!fresh && cached && cached.expiresAt > Date.now()) return cached.info;
  const body = await request<{ properties?: { timeZone?: string }; sheets?: { properties: { sheetId: number; title: string; gridProperties?: { rowCount?: number; columnCount?: number } } }[] }>(
    `${SHEETS_API}/${encodeURIComponent(spreadsheetId)}?fields=${encodeURIComponent("properties.timeZone,sheets.properties(sheetId,title,gridProperties)")}`,
  );
  const sheets: Record<string, SheetProperties> = {};
  for (const { properties } of body.sheets ?? []) {
    sheets[properties.title] = { sheetId: properties.sheetId, title: properties.title, rowCount: properties.gridProperties?.rowCount ?? 0, columnCount: properties.gridProperties?.columnCount ?? 0 };
  }
  const info = { timeZone: body.properties?.timeZone || "Asia/Ho_Chi_Minh", sheets };
  metadataCache.set(spreadsheetId, { info, expiresAt: Date.now() + METADATA_TTL_MS });
  return info;
}

export function quoteSheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

export function columnLetter(index: number) {
  let letter = "";
  for (let n = index; n > 0; n = Math.floor((n - 1) / 26)) letter = String.fromCharCode(65 + ((n - 1) % 26)) + letter;
  return letter;
}

// Dates come back as serial numbers so they never depend on the sheet's
// display locale; the caller converts the columns it knows are dates.
export async function batchGetValues(spreadsheetId: string, ranges: string[]): Promise<unknown[][][]> {
  if (!ranges.length) return [];
  const params = new URLSearchParams({ valueRenderOption: "UNFORMATTED_VALUE", dateTimeRenderOption: "SERIAL_NUMBER", majorDimension: "ROWS" });
  ranges.forEach((range) => params.append("ranges", range));
  const body = await request<{ valueRanges?: { values?: unknown[][] }[] }>(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`);
  return ranges.map((_, index) => body.valueRanges?.[index]?.values ?? []);
}

// RAW keeps "2026-11-02" or "0912…" as text instead of letting Sheets guess.
export async function batchUpdateValues(spreadsheetId: string, data: { range: string; values: unknown[][] }[]) {
  if (!data.length) return;
  await request(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
}

export async function batchClearValues(spreadsheetId: string, ranges: string[]) {
  if (!ranges.length) return;
  await request(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}/values:batchClear`, {
    method: "POST",
    body: JSON.stringify({ ranges }),
  });
}

// Cached sheet sizes stay valid unless rows, columns or tabs change.
const STRUCTURAL = ["addSheet", "appendDimension", "deleteDimension", "insertDimension", "deleteSheet"];

export async function batchUpdateSpreadsheet(spreadsheetId: string, requests: object[]) {
  if (!requests.length) return;
  try {
    await request(`${SHEETS_API}/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });
  } catch (error) {
    metadataCache.delete(spreadsheetId);
    throw error;
  }
  if (requests.some((item) => STRUCTURAL.some((key) => key in item))) metadataCache.delete(spreadsheetId);
}
