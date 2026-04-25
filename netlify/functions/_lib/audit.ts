import { getServiceClient } from "./supabase.js";

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
  actorUserId: string;
  action: AuditAction;
  teamId?: string | null;
  targetUserId?: string | null;
  roleId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function writeAudit(entry: AuditEntry): Promise<void> {
  const sb = getServiceClient();
  const { error } = await sb.from("audit_log").insert({
    actor_user_id: entry.actorUserId,
    action: entry.action,
    team_id: entry.teamId ?? null,
    target_user_id: entry.targetUserId ?? null,
    role_id: entry.roleId ?? null,
    metadata: entry.metadata ?? null,
  });
  if (error) console.error("audit insert failed", error);
}
