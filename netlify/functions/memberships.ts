import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { writeAudit } from "./_lib/audit.js";
import { requirePermission } from "./_lib/permissions.js";

interface MembershipBody {
  userId?: string;
  teamId?: string;
}

export const handler = withAuth(async (event, ctx) => {
  const sb = getServiceClient();

  if (event.httpMethod === "GET") {
    // GET /memberships?teamId=...   → members of a team
    // GET /memberships?userId=...   → teams a user belongs to
    const teamId = event.queryStringParameters?.teamId;
    const userId = event.queryStringParameters?.userId;
    if (!teamId && !userId) return error("teamId or userId required");

    if (teamId) {
      const { data, error: e } = await sb
        .from("team_memberships")
        .select("user_id, joined_at, profiles ( id, name, email )")
        .eq("team_id", teamId);
      if (e) return error(e.message, 500);
      return json({ items: data });
    }
    const { data, error: e } = await sb
      .from("team_memberships")
      .select("team_id, joined_at, teams ( id, name )")
      .eq("user_id", userId!);
    if (e) return error(e.message, 500);
    return json({ items: data });
  }

  if (event.httpMethod === "POST") {
    const body = parseJson<MembershipBody>(event);
    if (!body?.userId || !body.teamId) return error("userId and teamId required");
    await requirePermission(ctx.userId, body.teamId, "MANAGE_MEMBERS");
    const { error: e } = await sb
      .from("team_memberships")
      .upsert({ user_id: body.userId, team_id: body.teamId }, { onConflict: "user_id,team_id" });
    if (e) return error(e.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "ADD_MEMBER",
      teamId: body.teamId,
      targetUserId: body.userId,
    });
    return json({ ok: true }, 201);
  }

  if (event.httpMethod === "DELETE") {
    // DELETE /memberships/:teamId/:userId
    const seg = pathSegments(event, "memberships");
    const teamId = seg[0] || event.queryStringParameters?.teamId;
    const userId = seg[1] || event.queryStringParameters?.userId;
    if (!teamId || !userId) return error("teamId and userId required");
    await requirePermission(ctx.userId, teamId, "MANAGE_MEMBERS");
    // Removing membership also removes any role assignments in that team (FK cascade not on this pair).
    await sb.from("user_team_roles").delete().eq("user_id", userId).eq("team_id", teamId);
    const { error: e } = await sb
      .from("team_memberships")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", teamId);
    if (e) return error(e.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "REMOVE_MEMBER",
      teamId,
      targetUserId: userId,
    });
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
});
