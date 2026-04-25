import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { writeAudit } from "./_lib/audit.js";
import { requirePermission } from "./_lib/permissions.js";

interface AssignBody {
  userId?: string;
  teamId?: string;
  roleId?: string;
}

interface UpdateBody extends AssignBody {
  /** The id of the role being replaced; new role goes in roleId. */
  fromRoleId?: string;
}

export const handler = withAuth(async (event, ctx) => {
  const sb = getServiceClient();

  // GET /assignments?teamId=...&userId=... → list role assignments (any combination)
  if (event.httpMethod === "GET") {
    const teamId = event.queryStringParameters?.teamId;
    const userId = event.queryStringParameters?.userId;
    let q = sb
      .from("user_team_roles")
      .select(
        "user_id, team_id, role_id, assigned_at, " +
          "profiles:profiles!user_id ( id, name, email ), " +
          "teams ( id, name ), roles ( id, name )"
      )
      .order("assigned_at", { ascending: false });
    if (teamId) q = q.eq("team_id", teamId);
    if (userId) q = q.eq("user_id", userId);
    const { data, error: e } = await q;
    if (e) return error(e.message, 500);
    return json({ items: data });
  }

  // POST /assignments → assign role to user in team
  if (event.httpMethod === "POST") {
    const body = parseJson<AssignBody>(event);
    if (!body?.userId || !body.teamId || !body.roleId) {
      return error("userId, teamId, roleId required");
    }
    await requirePermission(ctx.userId, body.teamId, "ASSIGN_ROLES");

    // Ensure membership exists.
    await sb
      .from("team_memberships")
      .upsert({ user_id: body.userId, team_id: body.teamId }, { onConflict: "user_id,team_id" });

    const { error: e } = await sb.from("user_team_roles").upsert(
      {
        user_id: body.userId,
        team_id: body.teamId,
        role_id: body.roleId,
        assigned_by: ctx.userId,
      },
      { onConflict: "user_id,team_id,role_id" }
    );
    if (e) return error(e.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "ASSIGN_ROLE",
      teamId: body.teamId,
      targetUserId: body.userId,
      roleId: body.roleId,
    });
    return json({ ok: true }, 201);
  }

  // PUT /assignments → swap fromRoleId for roleId for (user, team)
  if (event.httpMethod === "PUT") {
    const body = parseJson<UpdateBody>(event);
    if (!body?.userId || !body.teamId || !body.roleId || !body.fromRoleId) {
      return error("userId, teamId, fromRoleId, roleId required");
    }
    await requirePermission(ctx.userId, body.teamId, "ASSIGN_ROLES");
    const { error: eDel } = await sb
      .from("user_team_roles")
      .delete()
      .eq("user_id", body.userId)
      .eq("team_id", body.teamId)
      .eq("role_id", body.fromRoleId);
    if (eDel) return error(eDel.message, 400);
    const { error: eIns } = await sb.from("user_team_roles").upsert(
      {
        user_id: body.userId,
        team_id: body.teamId,
        role_id: body.roleId,
        assigned_by: ctx.userId,
      },
      { onConflict: "user_id,team_id,role_id" }
    );
    if (eIns) return error(eIns.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "UPDATE_ROLE",
      teamId: body.teamId,
      targetUserId: body.userId,
      roleId: body.roleId,
      metadata: { fromRoleId: body.fromRoleId },
    });
    return json({ ok: true });
  }

  // DELETE /assignments/:teamId/:userId/:roleId
  if (event.httpMethod === "DELETE") {
    const seg = pathSegments(event, "assignments");
    const teamId = seg[0] || event.queryStringParameters?.teamId;
    const userId = seg[1] || event.queryStringParameters?.userId;
    const roleId = seg[2] || event.queryStringParameters?.roleId;
    if (!teamId || !userId || !roleId) {
      return error("teamId, userId, roleId required");
    }
    await requirePermission(ctx.userId, teamId, "ASSIGN_ROLES");
    const { error: e } = await sb
      .from("user_team_roles")
      .delete()
      .eq("user_id", userId)
      .eq("team_id", teamId)
      .eq("role_id", roleId);
    if (e) return error(e.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "REMOVE_ROLE",
      teamId,
      targetUserId: userId,
      roleId,
    });
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
});
