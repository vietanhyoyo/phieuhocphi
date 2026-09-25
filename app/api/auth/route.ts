import { NextResponse } from "next/server";
import { callAppsScript, isCloudStorageConfigured } from "@/lib/server-sheets";
import { clearSession, getSession, hashPassword, isAuthConfigured, publicUser, setSession, UserRecord, verifyPassword } from "@/lib/server-auth";

function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function validPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 8;
}

function asUser(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const user = value as Partial<UserRecord>;
  if (!user.id || !user.username || !user.passwordHash || !user.passwordSalt) return null;
  return user as UserRecord;
}

export async function GET() {
  if (!isCloudStorageConfigured() || !isAuthConfigured()) {
    return NextResponse.json({ configured: false, authenticated: true, user: null, hasUsers: false });
  }
  try {
    const [session, result] = await Promise.all([getSession(), callAppsScript({ action: "listUsers" })]);
    return NextResponse.json({ configured: true, authenticated: Boolean(session), user: session, hasUsers: Boolean(result.hasUsers) });
  } catch (error) {
    return NextResponse.json({ configured: true, authenticated: false, user: null, hasUsers: false, message: error instanceof Error ? error.message : "Không thể kiểm tra tài khoản." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ message: "Đăng nhập chưa được cấu hình." }, { status: 503 });
  try {
    const body = (await request.json()) as { action?: string; username?: unknown; password?: unknown };
    const username = normalizeUsername(body.username);
    if (!username || !validPassword(body.password)) return NextResponse.json({ message: "Tên đăng nhập và mật khẩu tối thiểu 8 ký tự là bắt buộc." }, { status: 400 });

    const found = asUser((await callAppsScript({ action: "findUser", username })).user);
    if (body.action === "register") {
      if (found) return NextResponse.json({ message: "Tên đăng nhập đã tồn tại." }, { status: 409 });
      const password = hashPassword(body.password);
      const created = asUser((await callAppsScript({
        action: "createUser",
        user: { id: `user-${crypto.randomUUID()}`, username, passwordHash: password.hash, passwordSalt: password.salt, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      })).user);
      if (!created) throw new Error("Google Sheet không trả về tài khoản vừa tạo.");
      const response = NextResponse.json({ user: publicUser(created) });
      setSession(response, publicUser(created));
      return response;
    }

    if (!found || !verifyPassword(body.password, found)) return NextResponse.json({ message: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
    const response = NextResponse.json({ user: publicUser(found) });
    setSession(response, publicUser(found));
    return response;
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Không thể đăng nhập." }, { status: 502 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}
