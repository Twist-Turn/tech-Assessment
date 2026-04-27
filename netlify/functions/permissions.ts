import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { serialize } from "./_lib/serialize.js";

export const handler = withAuth(async (event) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);
  const db = await getDb();
  const docs = await db.collection(collections.permissions).find({}).sort({ key: 1 }).toArray();
  return json({ items: docs.map((d) => serialize(d)) });
});
