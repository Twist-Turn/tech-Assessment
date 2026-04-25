import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { resolvePermissions } from "./_lib/permissions.js";
import { getServiceClient } from "./_lib/supabase.js";

export const handler = withAuth(async (event) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);
  const userId = event.queryStringParameters?.userId;
  const teamId = event.queryStringParameters?.teamId;
  if (!userId || !teamId) return error("userId and teamId required");

  const sb = getServiceClient();
  const perms = await resolvePermissions(userId, teamId);

  // Also return the role names so the UI can show "Roles: Admin, Approver"
  const { data: roles } = await sb
    .from("user_team_roles")
    .select("roles ( id, name )")
    .eq("user_id", userId)
    .eq("team_id", teamId);

  return json({
    userId,
    teamId,
    permissions: perms,
    roles: (roles ?? []).map((r: any) => r.roles).filter(Boolean),
  });
});
