import bcrypt from "bcryptjs";
import { withAuth } from "./_lib/handler.js";
import { json, error, parseJson } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { serialize } from "./_lib/serialize.js";
import { writeAudit } from "./_lib/audit.js";

interface CreateUserBody {
  email?: string;
  name?: string;
  password?: string;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const handler = withAuth(async (event, ctx) => {
  const db = await getDb();
  const users = db.collection(collections.users);

  if (event.httpMethod === "GET") {
    const q = (event.queryStringParameters?.q || "").trim();
    const limit = Math.min(parseInt(event.queryStringParameters?.limit || "20", 10) || 20, 100);
    const cursor = event.queryStringParameters?.cursor;

    const filter: Record<string, unknown> = {};
    if (q) {
      const r = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: r }, { email: r }];
    }
    if (cursor) {
      const d = new Date(cursor);
      if (!isNaN(d.getTime())) filter.createdAt = { $lt: d };
    }

    const docs = await users
      .find(filter, { projection: { passwordHash: 0 } })
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .toArray();
    const hasMore = docs.length > limit;
    const items = (hasMore ? docs.slice(0, limit) : docs).map((u) =>
      serialize<{ id: string; name: string; email: string; createdAt: string }>(u)
    );
    return json({
      items,
      nextCursor: hasMore ? (items[items.length - 1] as any).createdAt : null,
    });
  }

  if (event.httpMethod === "POST") {
    const body = parseJson<CreateUserBody>(event);
    if (!body?.email || !body.name) return error("email and name are required");
    const password = body.password || crypto.randomUUID();
    if (password.length < 8) return error("password must be at least 8 characters");

    try {
      const passwordHash = await bcrypt.hash(password, 10);
      const now = new Date();
      const result = await users.insertOne({
        name: body.name.trim(),
        email: body.email.trim().toLowerCase(),
        passwordHash,
        createdAt: now,
      });
      await writeAudit({
        actorUserId: ctx.userId,
        action: "CREATE_USER",
        targetUserId: result.insertedId,
        metadata: { email: body.email, name: body.name },
      });
      return json(
        {
          id: result.insertedId.toString(),
          name: body.name,
          email: body.email,
          createdAt: now.toISOString(),
        },
        201
      );
    } catch (e: any) {
      if (e?.code === 11000) return error("That email is already in use", 409);
      throw e;
    }
  }

  return error("Method not allowed", 405);
});
