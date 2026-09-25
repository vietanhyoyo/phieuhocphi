import { AppData } from "@/lib/types";
import { isValidAppData } from "@/lib/storage";

type RemoteLoadResult = {
  configured: boolean;
  data: AppData | null;
};

async function parseResponse(response: Response) {
  const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
  if (!response.ok) throw new Error(body.message || body.error || `Không thể đồng bộ dữ liệu (${response.status}).`);
  return body;
}

export async function loadRemoteData(): Promise<RemoteLoadResult> {
  const response = await fetch("/api/sheets", { cache: "no-store" });
  const body = (await parseResponse(response)) as { configured?: boolean; data?: AppData | null };
  if (body.data !== null && body.data !== undefined && !isValidAppData(body.data)) throw new Error("Dữ liệu nhận từ Google Sheet không hợp lệ.");
  return { configured: Boolean(body.configured), data: body.data ?? null };
}

export async function saveRemoteData(data: AppData) {
  const response = await fetch("/api/sheets", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  });
  await parseResponse(response);
}
