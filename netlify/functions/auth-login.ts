import type { Handler } from "@netlify/functions";
import bcrypt from "bcryptjs";
import { json, error, parseJson, preflight } from "./_lib/http.js";
import { collections, getDb } from "./_lib/db.js";
import { signJwt } from "./_lib/auth.js";

interface Body {
  email?: string;
  password?: string;
}

export const handler: Handler = async (event) => {
  const pre = preflight(event);
  if (pre) return pre;
  if (event.httpMethod !== "POST") return error("Method not allowed", 405);

  const body = parseJson<Body>(event);
  if (!body?.email || !body.password) return error("email and password are required");
  const email = body.email.trim().toLowerCase();

  try {
    const db = await getDb();
    const user = await db.collection(collections.users).findOne({ email });
    if (!user) return error("Invalid email or password", 401);

    const ok = await bcrypt.compare(body.password, (user as any).passwordHash || "");
    if (!ok) return error("Invalid email or password", 401);

    const userId = user._id.toString();
    const token = await signJwt({ sub: userId, email: user.email, name: user.name });
    return json({
      token,
      user: { id: userId, name: user.name, email: user.email, createdAt: user.createdAt },
    });
  } catch (e: any) {
    console.error(e);
    return error(e?.message || "Login failed", 500);
  }
};
