import type { Handler, HandlerEvent, HandlerResponse } from "@netlify/functions";
import { AuthError, requireAuth, AuthContext } from "./auth.js";
import { PermissionError } from "./permissions.js";
import { error, preflight } from "./http.js";

type AuthedHandler = (event: HandlerEvent, ctx: AuthContext) => Promise<HandlerResponse>;

/**
 * Wraps an authed handler with: CORS preflight, JWT verification, and unified error mapping.
 */
export function withAuth(fn: AuthedHandler): Handler {
  return async (event) => {
    const pre = preflight(event);
    if (pre) return pre;
    try {
      const ctx = await requireAuth(event);
      return await fn(event, ctx);
    } catch (e) {
      if (e instanceof AuthError) return error(e.message, e.status);
      if (e instanceof PermissionError) return error(e.message, 403);
      console.error(e);
      return error(e instanceof Error ? e.message : "Internal error", 500);
    }
  };
}
