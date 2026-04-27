/**
 * Custom token-based auth client. The browser stores a JWT in localStorage and
 * dispatches a `rengy-session` event whenever it changes so React hooks can
 * react. The token is signed and verified server-side; the client treats it
 * as opaque except for decoding the payload to display the user's email/name.
 */

const STORAGE_KEY = "rengy.session";
const EVENT_NAME = "rengy-session";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  createdAt?: string;
}

export interface Session {
  token: string;
  user: SessionUser;
}

function emit(session: Session | null) {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: session }));
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function setSession(session: Session | null) {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
  emit(session);
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function onSessionChange(cb: (s: Session | null) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<Session | null>).detail);
  // Cross-tab updates via the `storage` event.
  const storage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb(getSession());
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener("storage", storage);
  };
}

const BASE = "/.netlify/functions";

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export async function login(email: string, password: string): Promise<Session> {
  const data = await postAuth<{ token: string; user: SessionUser }>("/auth-login", {
    email,
    password,
  });
  setSession(data);
  return data;
}

export async function signup(name: string, email: string, password: string): Promise<Session> {
  const data = await postAuth<{ token: string; user: SessionUser }>("/auth-signup", {
    name,
    email,
    password,
  });
  setSession(data);
  return data;
}

export function logout() {
  setSession(null);
}
