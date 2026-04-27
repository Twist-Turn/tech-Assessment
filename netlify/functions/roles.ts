import { ObjectId } from "mongodb";
import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { tryOid } from "./_lib/serialize.js";
import { writeAudit } from "./_lib/audit.js";

interface CreateRoleBody {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

interface AssignPermsBody {
  permissionIds?: string[];
  /** If true, replace the role's permission set; otherwise append. */
  replace?: boolean;
}

function toOidArray(ids?: string[]): ObjectId[] {
  if (!ids) return [];
  return ids.map((s) => tryOid(s)).filter(Boolean) as ObjectId[];
}

export const handler = withAuth(async (event, ctx) => {
  const db = await getDb();
  const roles = db.collection(collections.roles);
  const seg = pathSegments(event, "roles");

  // GET /roles → list roles with their permissions
  if (event.httpMethod === "GET" && seg.length === 0) {
    const items = await roles
      .aggregate([
        { $sort: { name: 1 } },
        {
          $lookup: {
            from: collections.permissions,
            localField: "permissionIds",
            foreignField: "_id",
            as: "permissions",
          },
        },
        {
          $project: {
            _id: 0,
            id: { $toString: "$_id" },
            name: 1,
            description: 1,
            permissions: {
              $map: {
                input: "$permissions",
                as: "p",
                in: {
                  id: { $toString: "$$p._id" },
                  key: "$$p.key",
                  description: "$$p.description",
                },
              },
            },
          },
        },
      ])
      .toArray();
    return json({ items });
  }

  // POST /roles → create
  if (event.httpMethod === "POST" && seg.length === 0) {
    const body = parseJson<CreateRoleBody>(event);
    if (!body?.name?.trim()) return error("name is required");
    try {
      const result = await roles.insertOne({
        name: body.name.trim(),
        description: body.description?.trim() || null,
        permissionIds: toOidArray(body.permissionIds),
      });
      await writeAudit({
        actorUserId: ctx.userId,
        action: "CREATE_ROLE",
        roleId: result.insertedId,
        metadata: { name: body.name.trim(), permissionIds: body.permissionIds ?? [] },
      });
      return json(
        { id: result.insertedId.toString(), name: body.name.trim(), description: body.description ?? null },
        201
      );
    } catch (e: any) {
      if (e?.code === 11000) return error("A role with that name already exists", 409);
      throw e;
    }
  }

  // POST /roles/:id/permissions → assign permissions to a role
  if (event.httpMethod === "POST" && seg.length === 2 && seg[1] === "permissions") {
    const roleId = tryOid(seg[0]);
    if (!roleId) return error("invalid role id", 400);
    const body = parseJson<AssignPermsBody>(event);
    if (!body?.permissionIds || !Array.isArray(body.permissionIds)) {
      return error("permissionIds (array) required");
    }
    const permIds = toOidArray(body.permissionIds);
    if (body.replace) {
      await roles.updateOne({ _id: roleId }, { $set: { permissionIds: permIds } });
    } else {
      await roles.updateOne(
        { _id: roleId },
        { $addToSet: { permissionIds: { $each: permIds } } }
      );
    }
    await writeAudit({
      actorUserId: ctx.userId,
      action: "ASSIGN_PERMISSION",
      roleId,
      metadata: { permissionIds: body.permissionIds, replace: !!body.replace },
    });
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
});
