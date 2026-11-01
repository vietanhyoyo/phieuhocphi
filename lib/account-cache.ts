import { AuthUser } from "./types";
import { STORAGE_KEY } from "./storage";

const ACCOUNT_KEY = "tutor-manager:last-account";

export function cacheAccount(user: AuthUser) {
  try { window.localStorage.setItem(ACCOUNT_KEY, JSON.stringify(user)); } catch { /* Offline data remains available in memory. */ }
}

export function clearCachedAccount() {
  try { window.localStorage.removeItem(ACCOUNT_KEY); } catch { /* Ignore unavailable storage. */ }
}

export function loadCachedAccount(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(ACCOUNT_KEY) || "null") as Partial<AuthUser> | null;
    if (typeof value?.id === "string" && value.id && typeof value.username === "string") return { id: value.id, username: value.username };
  } catch { /* A damaged cache must not hide the local data. */ }

  // Upgrade existing installations with a single account cache. The ID is
  // enough to keep offline edits in the correct account's pending queue.
  try {
    const prefix = `${STORAGE_KEY}:user-`;
    const accounts = new Set<string>();
    for (let index = 0; index < window.localStorage.length; index++) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(prefix)) accounts.add(key.slice(`${STORAGE_KEY}:`.length));
    }
    return accounts.size === 1 ? { id: [...accounts][0], username: "" } : null;
  } catch {
    return null;
  }
}
