import type { HandlerEvent, HandlerResponse } from "@netlify/functions";

const baseHeaders = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};

export function json(body: unknown, status = 200): HandlerResponse {
  return { statusCode: status, headers: baseHeaders, body: JSON.stringify(body) };
}

export function error(message: string, status = 400, extra?: Record<string, unknown>): HandlerResponse {
  return json({ error: message, ...(extra ?? {}) }, status);
}

export function preflight(event: HandlerEvent): HandlerResponse | null {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: baseHeaders, body: "" };
  }
  return null;
}

export function parseJson<T = unknown>(event: HandlerEvent): T | null {
  if (!event.body) return null;
  try {
    return JSON.parse(event.body) as T;
  } catch {
    return null;
  }
}

/**
 * Returns the path segments after the function name.
 * For "/.netlify/functions/roles/abc/permissions" → ["abc", "permissions"].
 */
export function pathSegments(event: HandlerEvent, functionName: string): string[] {
  const path = event.path || "";
  const marker = `/.netlify/functions/${functionName}`;
  const idx = path.indexOf(marker);
  if (idx === -1) return [];
  const rest = path.slice(idx + marker.length).replace(/^\/+|\/+$/g, "");
  return rest ? rest.split("/") : [];
}
