import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { writeAudit } from "./_lib/audit.js";

interface CreateTeamBody {
  name?: string;
}

export const handler = withAuth(async (event, ctx) => {
  const sb = getServiceClient();

  if (event.httpMethod === "GET") {
    const q = (event.queryStringParameters?.q || "").trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "50", 10) || 50, 100);
    const cursor = event.queryStringParameters?.cursor;

    let query = sb
      .from("teams")
      .select("id, name, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (cursor) query = query.lt("created_at", cursor);
    if (q) query = query.ilike("name", `%${q}%`);

    const { data, error: e } = await query;
    if (e) return error(e.message, 500);
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    return json({
      items,
      nextCursor: hasMore ? items[items.length - 1].created_at : null,
    });
  }

  if (event.httpMethod === "POST") {
    const body = parseJson<CreateTeamBody>(event);
    if (!body?.name?.trim()) return error("name is required");
    const { data, error: e } = await sb
      .from("teams")
      .insert({ name: body.name.trim(), created_by: ctx.userId })
      .select("id, name, created_at")
      .single();
    if (e) return error(e.message, 400);
    // Auto-add the creator as a member.
    await sb
      .from("team_memberships")
      .upsert({ user_id: ctx.userId, team_id: data.id }, { onConflict: "user_id,team_id" });
    await writeAudit({
      actorUserId: ctx.userId,
      action: "CREATE_TEAM",
      teamId: data.id,
      metadata: { name: data.name },
    });
    return json(data, 201);
  }

  return error("Method not allowed", 405);
});
