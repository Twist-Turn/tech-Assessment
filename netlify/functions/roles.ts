import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson, pathSegments } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
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

export const handler = withAuth(async (event, ctx) => {
  const sb = getServiceClient();
  const seg = pathSegments(event, "roles");

  // GET /roles → list roles with their permissions
  if (event.httpMethod === "GET" && seg.length === 0) {
    const { data, error: e } = await sb
      .from("roles")
      .select("id, name, description, role_permissions ( permissions ( id, key ) )")
      .order("name");
    if (e) return error(e.message, 500);
    const items = (data ?? []).map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      permissions: (r as any).role_permissions
        .map((rp: any) => rp.permissions)
        .filter(Boolean),
    }));
    return json({ items });
  }

  // POST /roles → create
  if (event.httpMethod === "POST" && seg.length === 0) {
    const body = parseJson<CreateRoleBody>(event);
    if (!body?.name?.trim()) return error("name is required");
    const { data, error: e } = await sb
      .from("roles")
      .insert({ name: body.name.trim(), description: body.description ?? null })
      .select("id, name, description")
      .single();
    if (e) return error(e.message, 400);
    if (body.permissionIds?.length) {
      const rows = body.permissionIds.map((pid) => ({ role_id: data.id, permission_id: pid }));
      const { error: e2 } = await sb
        .from("role_permissions")
        .upsert(rows, { onConflict: "role_id,permission_id", ignoreDuplicates: true });
      if (e2) return error(e2.message, 400);
    }
    await writeAudit({
      actorUserId: ctx.userId,
      action: "CREATE_ROLE",
      roleId: data.id,
      metadata: { name: data.name, permissionIds: body.permissionIds ?? [] },
    });
    return json(data, 201);
  }

  // POST /roles/:id/permissions → assign permissions to a role
  if (event.httpMethod === "POST" && seg.length === 2 && seg[1] === "permissions") {
    const roleId = seg[0];
    const body = parseJson<AssignPermsBody>(event);
    if (!body?.permissionIds || !Array.isArray(body.permissionIds)) {
      return error("permissionIds (array) required");
    }
    if (body.replace) {
      const { error: eDel } = await sb.from("role_permissions").delete().eq("role_id", roleId);
      if (eDel) return error(eDel.message, 400);
    }
    if (body.permissionIds.length) {
      const rows = body.permissionIds.map((pid) => ({ role_id: roleId, permission_id: pid }));
      const { error: e } = await sb
        .from("role_permissions")
        .upsert(rows, { onConflict: "role_id,permission_id", ignoreDuplicates: true });
      if (e) return error(e.message, 400);
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
