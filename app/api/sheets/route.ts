import { NextResponse } from "next/server";
import { isValidAppData } from "@/lib/storage";
import { callAppsScript, isCloudStorageConfigured } from "@/lib/server-sheets";
import { getSession, isAuthConfigured } from "@/lib/server-auth";

export async function GET() {
  if (!isCloudStorageConfigured()) return NextResponse.json({ configured: false, data: null });
  const session = await getSession();
  if (isAuthConfigured() && !session) return NextResponse.json({ message: "Bạn cần đăng nhập để xem dữ liệu." }, { status: 401 });

  try {
    const result = await callAppsScript({ action: "loadData", userId: session?.id || "local" });
    if (result.data !== null && result.data !== undefined && !isValidAppData(result.data)) return NextResponse.json({ message: "Dữ liệu nhận từ Google Sheet không hợp lệ." }, { status: 502 });
    return NextResponse.json({ configured: true, data: result.data ?? null }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể tải dữ liệu từ Google Sheet." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isCloudStorageConfigured()) return NextResponse.json({ message: "Google Sheets chưa được cấu hình." }, { status: 503 });
  const session = await getSession();
  if (isAuthConfigured() && !session) return NextResponse.json({ message: "Bạn cần đăng nhập để lưu dữ liệu." }, { status: 401 });

  try {
    const body = (await request.json()) as { data?: unknown };
    if (!isValidAppData(body.data)) return NextResponse.json({ message: "Dữ liệu ứng dụng không hợp lệ." }, { status: 400 });
    await callAppsScript({ action: "saveData", userId: session?.id || "local", data: body.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể lưu dữ liệu vào Google Sheet." }, { status: 502 });
  }
}
