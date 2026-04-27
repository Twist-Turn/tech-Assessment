import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { tryOid } from "./_lib/serialize.js";
import { writeAudit } from "./_lib/audit.js";
import { requirePermission } from "./_lib/permissions.js";

interface MembershipBody {
  userId?: string;
  teamId?: string;
}

export const handler = withAuth(async (event, ctx) => {
  const db = await getDb();
  const memberships = db.collection(collections.memberships);

  if (event.httpMethod === "GET") {
    const teamId = tryOid(event.queryStringParameters?.teamId);
    const userId = tryOid(event.queryStringParameters?.userId);
    if (!teamId && !userId) return error("teamId or userId required");

    if (teamId) {
      const items = await memberships
        .aggregate([
          { $match: { teamId } },
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
            $project: {
              _id: 0,
              user_id: { $toString: "$userId" },
              joined_at: "$joinedAt",
              profiles: {
                id: { $toString: "$user._id" },
                name: "$user.name",
                email: "$user.email",
              },
            },
          },
        ])
        .toArray();
      return json({ items });
    }

    const items = await memberships
      .aggregate([
        { $match: { userId } },
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
          $project: {
            _id: 0,
            team_id: { $toString: "$teamId" },
            joined_at: "$joinedAt",
            teams: {
              id: { $toString: "$team._id" },
              name: "$team.name",
            },
          },
        },
      ])
      .toArray();
    return json({ items });
  }

  if (event.httpMethod === "POST") {
    const body = parseJson<MembershipBody>(event);
    const userId = tryOid(body?.userId);
    const teamId = tryOid(body?.teamId);
    if (!userId || !teamId) return error("userId and teamId required");

    await requirePermission(ctx.userId, teamId, "MANAGE_MEMBERS");

    await memberships.updateOne(
      { userId, teamId },
      { $setOnInsert: { userId, teamId, joinedAt: new Date() } },
      { upsert: true }
    );
    await writeAudit({
      actorUserId: ctx.userId,
      action: "ADD_MEMBER",
      teamId,
      targetUserId: userId,
    });
    return json({ ok: true }, 201);
  }

  if (event.httpMethod === "DELETE") {
    const seg = pathSegments(event, "memberships");
    const teamIdRaw = seg[0] || event.queryStringParameters?.teamId;
    const userIdRaw = seg[1] || event.queryStringParameters?.userId;
    const teamId = tryOid(teamIdRaw);
    const userId = tryOid(userIdRaw);
    if (!teamId || !userId) return error("teamId and userId required");

    await requirePermission(ctx.userId, teamId, "MANAGE_MEMBERS");

    // Removing membership also removes any role assignments in that team.
    await db.collection(collections.userTeamRoles).deleteMany({ userId, teamId });
    await memberships.deleteOne({ userId, teamId });
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
