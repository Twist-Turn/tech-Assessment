/**
 * Create the indexes and uniqueness constraints for the RBAC schema.
 * Idempotent — run as many times as you like. `npm run db:init`.
 */
import "dotenv/config";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "rengy";
if (!uri) {
  console.error("Missing MONGODB_URI in env");
  process.exit(1);
}

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);

  console.log(`Connected to ${dbName}. Creating indexes…`);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  await db.collection("teams").createIndex({ name: 1 });

  await db
    .collection("memberships")
    .createIndex({ userId: 1, teamId: 1 }, { unique: true });
  await db.collection("memberships").createIndex({ teamId: 1 });

  await db.collection("roles").createIndex({ name: 1 }, { unique: true });

  await db.collection("permissions").createIndex({ key: 1 }, { unique: true });

  await db
    .collection("userTeamRoles")
    .createIndex({ userId: 1, teamId: 1, roleId: 1 }, { unique: true });
  await db.collection("userTeamRoles").createIndex({ userId: 1, teamId: 1 });
  await db.collection("userTeamRoles").createIndex({ teamId: 1 });

  await db.collection("auditLog").createIndex({ teamId: 1, createdAt: -1 });
  await db.collection("auditLog").createIndex({ createdAt: -1 });

  console.log("Indexes created.");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
