import { MongoClient, Db } from "mongodb";

/**
 * Cache the MongoClient across invocations of the same lambda container.
 * Mongo recommends one client per process; serverless cold starts otherwise
 * pay the TLS handshake on every request.
 */
let cached: { client: MongoClient; db: Db } | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached.db;
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB || "rengy";
  if (!uri) throw new Error("Missing MONGODB_URI");

  const client = new MongoClient(uri, {
    // Atlas free tier has connection limits; keep the per-lambda pool small.
    maxPoolSize: 5,
  });
  await client.connect();
  const db = client.db(dbName);
  cached = { client, db };
  return db;
}

export const collections = {
  users: "users",
  teams: "teams",
  memberships: "memberships",
  roles: "roles",
  permissions: "permissions",
  userTeamRoles: "userTeamRoles",
  auditLog: "auditLog",
} as const;
