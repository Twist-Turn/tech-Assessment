import { ObjectId } from "mongodb";
import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { serialize } from "./_lib/serialize.js";
import { writeAudit } from "./_lib/audit.js";

interface CreateTeamBody {
  name?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const handler = withAuth(async (event, ctx) => {
  const db = await getDb();
  const teams = db.collection(collections.teams);

  if (event.httpMethod === "GET") {
    const q = (event.queryStringParameters?.q || "").trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50", 10) || 50, 100);
    const cursor = event.queryStringParameters?.cursor;

    const filter: Record<string, unknown> = {};
    if (q) filter.name = new RegExp(escapeRegex(q), "i");
    if (cursor) {
      const d = new Date(cursor);
      if (!isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }

    const docs = await teams.find(filter).sort({ createdAt: -1 }).limit(limit + 1).toArray();
    const hasMore = docs.length > limit;
    const items = (hasMore ? docs.slice(0, limit) : docs).map((t) => serialize(t));
    return json({
      items,
      nextCursor: hasMore ? (items[items.length - 1] as any).createdAt : null,
    });
  }

  if (event.httpMethod === "POST") {
    const body = parseJson<CreateTeamBody>(event);
    if (!body?.name?.trim()) return error("name is required");

    const actor = new ObjectId(ctx.userId);
    const now = new Date();
    const result = await teams.insertOne({
      name: body.name.trim(),
      createdBy: actor,
      createdAt: now,
    });
    const teamId = result.insertedId;

    // Auto-add creator as a member.
    await db
      .collection(collections.memberships)
      .updateOne(
        { userId: actor, teamId },
        { $setOnInsert: { userId: actor, teamId, joinedAt: now } },
        { upsert: true }
      );

    // Auto-grant creator the Admin role on this team.
    const adminRole = await db
      .collection(collections.roles)
      .findOne({ name: { $regex: /^admin$/i } });
    if (adminRole) {
      await db.collection(collections.userTeamRoles).updateOne(
        { userId: actor, teamId, roleId: adminRole._id },
        {
          $setOnInsert: {
            userId: actor,
            teamId,
            roleId: adminRole._id,
            assignedBy: actor,
            assignedAt: now,
          },
        },
        { upsert: true }
      );
      await writeAudit({
        actorUserId: actor,
        action: "ASSIGN_ROLE",
        teamId,
        targetUserId: actor,
        roleId: adminRole._id,
        metadata: { reason: "auto-assigned to team creator" },
      });
    } else {
      console.warn("No 'Admin' role found — team created without auto-assigning a role.");
    }

    await writeAudit({
      actorUserId: actor,
      action: "CREATE_TEAM",
      teamId,
      metadata: { name: body.name.trim(), creatorAssignedAdmin: !!adminRole },
    });

    return json(
      {
        id: teamId.toString(),
        name: body.name.trim(),
        createdBy: ctx.userId,
        createdAt: now.toISOString(),
      },
      201
    );
  }

  return error("Method not allowed", 405);
});
