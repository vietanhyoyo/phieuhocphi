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

export async function PATCH(request: Request) {
  if (!isAuthConfigured()) return NextResponse.json({ message: "Đăng nhập chưa được cấu hình." }, { status: 503 });
  const session = await getSession();
  if (!session) return NextResponse.json({ message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." }, { status: 401 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await request.json() as { currentPassword?: unknown; newPassword?: unknown };
  } catch {
    return NextResponse.json({ message: "Thông tin đổi mật khẩu không hợp lệ." }, { status: 400 });
  }

  if (!validPassword(body.currentPassword) || !validPassword(body.newPassword)) {
    return NextResponse.json({ message: "Mật khẩu phải có ít nhất 8 ký tự." }, { status: 400 });
  }
  if (body.currentPassword === body.newPassword) {
    return NextResponse.json({ message: "Mật khẩu mới phải khác mật khẩu hiện tại." }, { status: 400 });
  }

  try {
    const found = asUser((await callAppsScript({ action: "findUser", username: normalizeUsername(session.username) })).user);
    if (!found || found.id !== session.id) return NextResponse.json({ message: "Không tìm thấy tài khoản." }, { status: 401 });
    if (!verifyPassword(body.currentPassword, found)) {
      return NextResponse.json({ message: "Mật khẩu hiện tại không đúng." }, { status: 401 });
    }

    const password = hashPassword(body.newPassword);
    const result = await callAppsScript({
      action: "updateUserPassword",
      userId: session.id,
      expectedPasswordHash: found.passwordHash,
      expectedPasswordSalt: found.passwordSalt,
      passwordHash: password.hash,
      passwordSalt: password.salt,
      updatedAt: new Date().toISOString(),
    });
    if (result.updated !== true) {
      return NextResponse.json({ message: "Mật khẩu tài khoản vừa thay đổi. Vui lòng đăng nhập lại rồi thử lại." }, { status: 409 });
    }
    const response = NextResponse.json({ message: "Đổi mật khẩu thành công." });
    clearSession(response);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Action không được hỗ trợ")) {
      return NextResponse.json({ message: "Google Apps Script đang dùng phiên bản cũ. Hãy triển khai phiên bản mới rồi thử lại." }, { status: 503 });
    }
    return NextResponse.json({ message: "Không thể lưu mật khẩu vào Google Sheet lúc này. Vui lòng thử lại." }, { status: 502 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearSession(response);
  return response;
}
