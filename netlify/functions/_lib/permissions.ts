import { ObjectId } from "mongodb";
import { collections, getDb } from "./db.js";

export class PermissionError extends Error {
  constructor(message = "Forbidden") {
    super(message);
  }
}

function asObjectId(v: string | ObjectId): ObjectId {
  return v instanceof ObjectId ? v : new ObjectId(v);
}

interface ResolvedRow {
  permissions: string[];
  roles: { id: string; name: string }[];
}

/**
 * Returns the union of permission keys granted to userId within teamId, plus the
 * names of the roles that produced them. Empty arrays if the user has no roles
 * in that team — the "no role, no permissions" rule.
 */
export async function resolvePermissionsAndRoles(
  userId: string | ObjectId,
  teamId: string | ObjectId
): Promise<ResolvedRow> {
  const db = await getDb();
  const docs = await db
    .collection(collections.userTeamRoles)
    .aggregate([
      { $match: { userId: asObjectId(userId), teamId: asObjectId(teamId) } },
      {
        $lookup: {
          from: collections.roles,
          localField: "roleId",
          foreignField: "_id",
          as: "role",
        },
      },
      { $unwind: { path: "$role", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: collections.permissions,
          localField: "role.permissionIds",
          foreignField: "_id",
          as: "perms",
        },
      },
      {
        $project: {
          _id: 0,
          roleId: "$role._id",
          roleName: "$role.name",
          permKeys: "$perms.key",
        },
      },
    ])
    .toArray();

  const permsSet = new Set<string>();
  const rolesMap = new Map<string, { id: string; name: string }>();
  for (const d of docs) {
    const id = (d as any).roleId.toString();
    rolesMap.set(id, { id, name: (d as any).roleName });
    for (const k of (d as any).permKeys ?? []) permsSet.add(k);
  }
  return {
    permissions: [...permsSet],
    roles: [...rolesMap.values()],
  };
}

export async function resolvePermissions(
  userId: string | ObjectId,
  teamId: string | ObjectId
): Promise<string[]> {
  return (await resolvePermissionsAndRoles(userId, teamId)).permissions;
}

export async function hasPermission(
  userId: string | ObjectId,
  teamId: string | ObjectId,
  perm: string
): Promise<boolean> {
  return (await resolvePermissions(userId, teamId)).includes(perm);
}

export async function requirePermission(
  userId: string | ObjectId,
  teamId: string | ObjectId,
  perm: string
): Promise<void> {
  if (!(await hasPermission(userId, teamId, perm))) {
    throw new PermissionError(`Missing required permission: ${perm}`);
  }
}

/** True if the user has ANY of the listed permissions in ANY team — used to gate admin UI. */
export async function hasAnyPermissionAnywhere(
  userId: string | ObjectId,
  perms: string[]
): Promise<boolean> {
  if (perms.length === 0) return false;
  const db = await getDb();
  const count = await db
    .collection(collections.userTeamRoles)
    .aggregate([
      { $match: { userId: asObjectId(userId) } },
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
        $lookup: {
          from: collections.permissions,
          let: { permIds: "$role.permissionIds" },
          pipeline: [
            { $match: { $expr: { $in: ["$_id", "$$permIds"] } } },
            { $match: { key: { $in: perms } } },
            { $limit: 1 },
          ],
          as: "match",
        },
      },
      { $match: { match: { $ne: [] } } },
      { $limit: 1 },
      { $count: "n" },
    ])
    .toArray();
  return (count[0] as any)?.n > 0;
}
