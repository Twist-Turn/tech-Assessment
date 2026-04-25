import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { hasAnyPermissionAnywhere } from "./_lib/permissions.js";

export const handler = withAuth(async (event, ctx) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);

  // Visible to anyone who can manage roles or members anywhere.
  const allowed = await hasAnyPermissionAnywhere(ctx.userId, [
    "ASSIGN_ROLES",
    "MANAGE_MEMBERS",
    "MANAGE_TEAM",
  ]);
  if (!allowed) return error("Forbidden", 403);

  const sb = getServiceClient();
  const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50", 10) || 50, 200);
  const teamId = event.queryStringParameters?.teamId;

  let q = sb
    .from("audit_log")
    .select(
      "id, action, created_at, metadata, " +
        "actor:profiles!actor_user_id ( id, name, email ), " +
        "target:profiles!target_user_id ( id, name, email ), " +
        "team:teams ( id, name ), role:roles ( id, name )"
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (teamId) q = q.eq("team_id", teamId);

  const { data, error: e } = await q;
  if (e) return error(e.message, 500);
  return json({ items: data });
});
