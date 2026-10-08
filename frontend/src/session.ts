import type { Session } from "./types";

const KEY = "gridline.session";

export function loadSession(): Session | null {
  const raw = sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  if (!session) sessionStorage.removeItem(KEY);
  else sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function getToken(): string | null {
  return loadSession()?.access_token ?? null;
}
