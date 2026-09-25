import { cookies } from "next/headers";
import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { isCloudStorageConfigured } from "@/lib/server-sheets";
import { AuthUser } from "@/lib/types";

const SESSION_COOKIE = "tutor_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export type UserRecord = AuthUser & {
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  updatedAt: string;
};

type Session = AuthUser & { expiresAt: number };

export function isAuthConfigured() {
  return isCloudStorageConfigured() && Boolean(process.env.AUTH_SECRET);
}

function encode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", process.env.AUTH_SECRET || "").update(value).digest("base64url");
}

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: pbkdf2Sync(password, salt, 310_000, 32, "sha256").toString("hex"),
  };
}

export function verifyPassword(password: string, record: Pick<UserRecord, "passwordHash" | "passwordSalt">) {
  const candidate = Buffer.from(hashPassword(password, record.passwordSalt).hash, "hex");
  const expected = Buffer.from(record.passwordHash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export function publicUser(record: Pick<UserRecord, "id" | "username">): AuthUser {
  return { id: record.id, username: record.username };
}

export function setSession(response: Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }, user: AuthUser) {
  const session: Session = { ...user, expiresAt: Date.now() + SESSION_MAX_AGE * 1000 };
  const payload = encode(JSON.stringify(session));
  response.cookies.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export function clearSession(response: Response & { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator < 1) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(decode(payload)) as Session;
    if (!session.id || !session.username || session.expiresAt < Date.now()) return null;
    return publicUser(session);
  } catch {
    return null;
  }
}
