import { getToken, logout } from "./auth";

const BASE = "/.netlify/functions";

export class ApiError extends Error {
  constructor(message: string, public status: number, public detail?: string) {
    super(message);
    this.name = "ApiError";
  }
}

function authHeader(): HeadersInit {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function friendly(status: number, backendMessage?: string): string {
  if (status === 401) return "Unauthorized — please sign in again.";
  if (status === 403) {
    const perm = backendMessage?.match(/permission:\s*([A-Z_]+)/)?.[1];
    return perm
      ? `Unauthorized — your role doesn't grant ${perm} in this team.`
      : "Unauthorized — you don't have permission to do that.";
  }
  if (status === 404) return "Not found.";
  if (status >= 500) return backendMessage || "Server error. Try again.";
  return backendMessage || `Request failed (${status}).`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: HeadersInit = {
    "content-type": "application/json",
    ...authHeader(),
    ...(init.headers ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let backendMessage: string | undefined;
    try {
      const body = await res.json();
      backendMessage = body?.error;
    } catch {
      // ignore
    }
    if (res.status === 401) logout();
    throw new ApiError(friendly(res.status, backendMessage), res.status, backendMessage);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body == null ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body == null ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
