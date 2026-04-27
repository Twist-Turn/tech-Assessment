import type { Handler } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { json, error, parseJson, preflight } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { signJwt } from "./_lib/auth.js";

interface Body {
  email?: string;
  password?: string;
  name?: string;
}

export const handler: Handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== "POST") return error("Method not allowed", 405);

  const body = parseJson<Body>(event);
  if (!body?.email || !body.password || !body.name) {
    return error("name, email, and password are required");
  }
  if (body.password.length < 8) return error("password must be at least 8 characters");

  const email = body.email.trim().toLowerCase();
  const name = body.name.trim();

  try {
    const db = await getDb();
    const passwordHash = await bcrypt.hash(body.password, 10);
    const now = new Date();
    const result = await db
      .collection(collections.users)
      .insertOne({ name, email, passwordHash, createdAt: now });
    const userId = result.insertedId.toString();
    const token = await signJwt({ sub: userId, email, name });
    return json({ token, user: { id: userId, name, email, createdAt: now } }, 201);
  } catch (e: any) {
    if (e?.code === 11000) return error("That email is already in use", 409);
    console.error(e);
    return error(e?.message || "Signup failed", 500);
  }
};
