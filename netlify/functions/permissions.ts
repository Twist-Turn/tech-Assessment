import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { getServiceClient } from "./_lib/supabase.js";

export const handler = withAuth(async (event) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);
  const sb = getServiceClient();
  const { data, error: e } = await sb
    .from("permissions")
    .select("id, key, description")
    .order("key");
  if (e) return error(e.message, 500);
  return json({ items: data });
});
