import { getServiceClient } from "./supabase.js";

/**
 * Returns the union of permission keys granted to `userId` within `teamId`.
 * Empty array if the user has no roles in that team — the "no role, no permissions" rule.
 */
export async function resolvePermissions(userId: string, teamId: string): Promise<string[]> {
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("user_team_roles")
    .select("roles ( role_permissions ( permissions ( key ) ) )")
    .eq("user_id", userId)
    .eq("team_id", teamId);
  if (error) throw error;

  const set = new Set<string>();
  for (const row of data ?? []) {
    const role = (row as any).roles;
    if (!role) continue;
    const rps = role.role_permissions ?? [];
    for (const rp of rps) {
      const key = rp?.permissions?.key;
      if (typeof key === "string") set.add(key);
    }
  }
  return [...set];
}

export async function hasPermission(userId: string, teamId: string, perm: string): Promise<boolean> {
  const perms = await resolvePermissions(userId, teamId);
  return perms.includes(perm);
}

export class PermissionError extends Error {
  constructor(message = "Forbidden") {
    super(message);
  }
}

export async function requirePermission(userId: string, teamId: string, perm: string): Promise<void> {
  if (!(await hasPermission(userId, teamId, perm))) {
    throw new PermissionError(`Missing required permission: ${perm}`);
  }
}

/** True if the user has ANY of the listed permissions in ANY team — used to gate admin UI. */
export async function hasAnyPermissionAnywhere(userId: string, perms: string[]): Promise<boolean> {
  if (perms.length === 0) return false;
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("user_team_roles")
    .select("roles ( role_permissions ( permissions ( key ) ) )")
    .eq("user_id", userId);
  if (error) throw error;
  for (const row of data ?? []) {
    const role = (row as any).roles;
    if (!role) continue;
    for (const rp of role.role_permissions ?? []) {
      const key = rp?.permissions?.key;
      if (typeof key === "string" && perms.includes(key)) return true;
    }
  }
  return false;
}
