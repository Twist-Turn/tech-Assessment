import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { tryOid } from "./_lib/serialize.js";
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
  const db = await getDb();
  const utr = db.collection(collections.userTeamRoles);

  // GET /assignments?teamId=...&userId=... → list role assignments
  if (event.httpMethod === "GET") {
    const teamId = tryOid(event.queryStringParameters?.teamId);
    const userId = tryOid(event.queryStringParameters?.userId);
    const match: Record<string, unknown> = {};
    if (teamId) match.teamId = teamId;
    if (userId) match.userId = userId;

    const items = await utr
      .aggregate([
        { $match: match },
        { $sort: { assignedAt: -1 } },
        {
          $lookup: {
            from: collections.users,
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $lookup: {
            from: collections.teams,
            localField: "teamId",
            foreignField: "_id",
            as: "team",
          },
        },
        { $unwind: "$team" },
        {
          $lookup: {
            from: collections.roles,
            localField: "roleId",
            foreignField: "_id",
            as: "role",
          },
        },
        { $unwind: "$role" },
        {
          $project: {
            _id: 0,
            user_id: { $toString: "$userId" },
            team_id: { $toString: "$teamId" },
            role_id: { $toString: "$roleId" },
            assigned_at: "$assignedAt",
            profiles: {
              id: { $toString: "$user._id" },
              name: "$user.name",
              email: "$user.email",
            },
            teams: { id: { $toString: "$team._id" }, name: "$team.name" },
            roles: { id: { $toString: "$role._id" }, name: "$role.name" },
          },
        },
      ])
      .toArray();
    return json({ items });
  }

  // POST /assignments
  if (event.httpMethod === "POST") {
    const body = parseJson<AssignBody>(event);
    const userId = tryOid(body?.userId);
    const teamId = tryOid(body?.teamId);
    const roleId = tryOid(body?.roleId);
    if (!userId || !teamId || !roleId) return error("userId, teamId, roleId required");

    await requirePermission(ctx.userId, teamId, "ASSIGN_ROLES");

    const now = new Date();
    await db.collection(collections.memberships).updateOne(
      { userId, teamId },
      { $setOnInsert: { userId, teamId, joinedAt: now } },
      { upsert: true }
    );
    // One role per (user, team): clear any other roles before assigning this one.
    await utr.deleteMany({ userId, teamId, roleId: { $ne: roleId } });
    await utr.updateOne(
      { userId, teamId, roleId },
      {
        $setOnInsert: {
          userId,
          teamId,
          roleId,
          assignedBy: tryOid(ctx.userId),
          assignedAt: now,
        },
      },
      { upsert: true }
    );
    await writeAudit({
      actorUserId: ctx.userId,
      action: "ASSIGN_ROLE",
      teamId,
      targetUserId: userId,
      roleId,
    });
    return json({ ok: true }, 201);
  }

  // PUT /assignments → swap fromRoleId for roleId for (user, team)
  if (event.httpMethod === "PUT") {
    const body = parseJson<UpdateBody>(event);
    const userId = tryOid(body?.userId);
    const teamId = tryOid(body?.teamId);
    const roleId = tryOid(body?.roleId);
    const fromRoleId = tryOid(body?.fromRoleId);
    if (!userId || !teamId || !roleId || !fromRoleId) {
      return error("userId, teamId, fromRoleId, roleId required");
    }
    await requirePermission(ctx.userId, teamId, "ASSIGN_ROLES");
    await utr.deleteOne({ userId, teamId, roleId: fromRoleId });
    const now = new Date();
    await utr.updateOne(
      { userId, teamId, roleId },
      {
        $setOnInsert: {
          userId,
          teamId,
          roleId,
          assignedBy: tryOid(ctx.userId),
          assignedAt: now,
        },
      },
      { upsert: true }
    );
    await writeAudit({
      actorUserId: ctx.userId,
      action: "UPDATE_ROLE",
      teamId,
      targetUserId: userId,
      roleId,
      metadata: { fromRoleId: body?.fromRoleId },
    });
    return json({ ok: true });
  }

  // DELETE /assignments/:teamId/:userId/:roleId
  if (event.httpMethod === "DELETE") {
    const seg = pathSegments(event, "assignments");
    const teamId = tryOid(seg[0] || event.queryStringParameters?.teamId);
    const userId = tryOid(seg[1] || event.queryStringParameters?.userId);
    const roleId = tryOid(seg[2] || event.queryStringParameters?.roleId);
    if (!teamId || !userId || !roleId) {
      return error("teamId, userId, roleId required");
    }
    await requirePermission(ctx.userId, teamId, "ASSIGN_ROLES");
    await utr.deleteOne({ userId, teamId, roleId });
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
