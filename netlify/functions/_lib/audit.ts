import { ObjectId } from "mongodb";
import { collections, getDb } from "./db.js";

export type AuditAction =
  | "ADD_MEMBER"
  | "REMOVE_MEMBER"
  | "ASSIGN_ROLE"
  | "UPDATE_ROLE"
  | "REMOVE_ROLE"
  | "CREATE_TEAM"
  | "CREATE_ROLE"
  | "ASSIGN_PERMISSION"
  | "CREATE_USER";

export interface AuditEntry {
  actorUserId: string | ObjectId;
  action: AuditAction;
  teamId?: string | ObjectId | null;
  targetUserId?: string | ObjectId | null;
  roleId?: string | ObjectId | null;
  metadata?: Record<string, unknown> | null;
}

function toOid(v: string | ObjectId | null | undefined): ObjectId | null {
  if (v == null) return null;
  return v instanceof ObjectId ? v : new ObjectId(v);
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(collections.auditLog).insertOne({
      actorUserId: toOid(entry.actorUserId),
      action: entry.action,
      teamId: toOid(entry.teamId),
      targetUserId: toOid(entry.targetUserId),
      roleId: toOid(entry.roleId),
      metadata: entry.metadata ?? null,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("audit insert failed", e);
  }
}
