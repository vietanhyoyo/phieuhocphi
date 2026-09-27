import { NextResponse } from "next/server";
import { getSession } from "@/lib/server-auth";
import { callAppsScript } from "@/lib/server-sheets";
import { getReceiptPayment } from "@/lib/receipt-payment";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Vui lòng đăng nhập lại." }, { status: 401 });
  try {
    const result = await callAppsScript({ action: "findUser", username: session.username });
    const user = result.user as Record<string, unknown> | null;
    if (!user || user.id !== session.id) return NextResponse.json({ message: "Không tìm thấy tài khoản." }, { status: 401 });
    return NextResponse.json({ payment: getReceiptPayment(user) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Không thể tải thông tin chuyển khoản. Vui lòng đóng và mở lại phiếu." }, { status: 502 });
  }
}
