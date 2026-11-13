import { NextResponse } from "next/server";
import { isValidAppData } from "@/lib/storage";
import { parseChangeSet } from "@/lib/change-set";
import { callSheets, isCloudStorageConfigured } from "@/lib/server-sheets";
import { getSession, isAuthConfigured } from "@/lib/server-auth";

export async function GET() {
  if (!isCloudStorageConfigured()) return NextResponse.json({ configured: false, data: null });
  const session = await getSession();
  if (isAuthConfigured() && !session) return NextResponse.json({ message: "Bạn cần đăng nhập để xem dữ liệu." }, { status: 401 });

  try {
    const result = await callSheets({ action: "loadData", userId: session?.id || "local" });
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
    const body = (await request.json()) as { data?: unknown; changes?: unknown; accountId?: unknown };
    if (body.accountId !== (session?.id || "local")) return NextResponse.json({ message: "Tài khoản đồng bộ không khớp." }, { status: 403 });
    const userId = session?.id || "local";
    if (body.changes !== undefined) {
      const changes = parseChangeSet(body.changes);
      if (!changes) return NextResponse.json({ message: "Dữ liệu thay đổi không hợp lệ." }, { status: 400 });
      await callSheets({ action: "applyChanges", userId, changes });
      return NextResponse.json({ ok: true });
    }
    // Whole snapshots still come from tabs opened before the update.
    if (!isValidAppData(body.data)) return NextResponse.json({ message: "Dữ liệu ứng dụng không hợp lệ." }, { status: 400 });
    await callSheets({ action: "saveData", userId, data: body.data });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể lưu dữ liệu vào Google Sheet." }, { status: 502 });
  }
}
