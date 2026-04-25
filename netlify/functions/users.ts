import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";
import { writeAudit } from "./_lib/audit.js";

interface CreateUserBody {
  email?: string;
  name?: string;
  password?: string;
}

export const handler = withAuth(async (event, ctx) => {
  const sb = getServiceClient();

  if (event.httpMethod === "GET") {
    const q = (event.queryStringParameters?.q || "").trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "20", 10) || 20, 100);
    const cursor = event.queryStringParameters?.cursor;

    let query = sb
      .from("profiles")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (cursor) query = query.lt("created_at", cursor);
    if (q) query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%`);

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
    const body = parseJson<CreateUserBody>(event);
    if (!body?.email || !body.name) return error("email and name are required");
    const password = body.password || crypto.randomUUID();

    const { data, error: e } = await sb.auth.admin.createUser({
      email: body.email,
      password,
      email_confirm: true,
      user_metadata: { name: body.name },
    });
    if (e) return error(e.message, 400);
    await writeAudit({
      actorUserId: ctx.userId,
      action: "CREATE_USER",
      targetUserId: data.user!.id,
      metadata: { email: body.email, name: body.name },
    });
    return json({ id: data.user!.id, email: body.email, name: body.name }, 201);
  }

  return error("Method not allowed", 405);
});
