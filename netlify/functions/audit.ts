import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { tryOid } from "./_lib/serialize.js";
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

  const db = await getDb();
  const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50", 10) || 50, 200);
  const teamId = tryOid(event.queryStringParameters?.teamId);

  const match: Record<string, unknown> = {};
  if (teamId) match.teamId = teamId;

  const items = await db
    .collection(collections.auditLog)
    .aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: collections.users,
          localField: "actorUserId",
          foreignField: "_id",
          as: "actor",
        },
      },
      {
        $lookup: {
          from: collections.users,
          localField: "targetUserId",
          foreignField: "_id",
          as: "target",
        },
      },
      {
        $lookup: {
          from: collections.teams,
          localField: "teamId",
          foreignField: "_id",
          as: "team",
        },
      },
      {
        $lookup: {
          from: collections.roles,
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          action: 1,
          created_at: "$createdAt",
          metadata: 1,
          actor: {
            $let: {
              vars: { a: { $arrayElemAt: ["$actor", 0] } },
              in: {
                $cond: [
                  { $ifNull: ["$$a", false] },
                  {
                    id: { $toString: "$$a._id" },
                    name: "$$a.name",
                    email: "$$a.email",
                  },
                  null,
                ],
              },
            },
          },
          target: {
            $let: {
              vars: { t: { $arrayElemAt: ["$target", 0] } },
              in: {
                $cond: [
                  { $ifNull: ["$$t", false] },
                  {
                    id: { $toString: "$$t._id" },
                    name: "$$t.name",
                    email: "$$t.email",
                  },
                  null,
                ],
              },
            },
          },
          team: {
            $let: {
              vars: { t: { $arrayElemAt: ["$team", 0] } },
              in: {
                $cond: [
                  { $ifNull: ["$$t", false] },
                  { id: { $toString: "$$t._id" }, name: "$$t.name" },
                  null,
                ],
              },
            },
          },
          role: {
            $let: {
              vars: { r: { $arrayElemAt: ["$role", 0] } },
              in: {
                $cond: [
                  { $ifNull: ["$$r", false] },
                  { id: { $toString: "$$r._id" }, name: "$$r.name" },
                  null,
                ],
              },
            },
          },
        },
      },
    ])
    .toArray();

  return json({ items });
});
