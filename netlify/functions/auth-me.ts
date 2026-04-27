import { ObjectId } from "mongodb";
import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";

export const handler = withAuth(async (event, ctx) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);
  const db = await getDb();
  const user = await db
    .collection(collections.users)
    .findOne({ _id: new ObjectId(ctx.userId) }, { projection: { passwordHash: 0 } });
  if (!user) return error("User no longer exists", 404);
  return json({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  });
});
