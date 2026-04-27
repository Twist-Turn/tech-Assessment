/**
 * Seed script for MongoDB: roles, permissions, demo teams + users + assignments.
 * Idempotent — safe to run multiple times. Run with: `npm run seed`
 * Requires: MONGODB_URI, MONGODB_DB in .env
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { MongoClient, ObjectId } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "rengy";
if (!uri) {
  console.error("Missing MONGODB_URI in env");
  process.exit(1);
}

const PERMISSIONS = [
  { key: "CREATE_TASK", description: "Create tasks in the team" },
  { key: "EDIT_TASK", description: "Edit existing tasks" },
  { key: "DELETE_TASK", description: "Delete tasks" },
  { key: "VIEW_ONLY", description: "Read-only access" },
  { key: "MANAGE_TEAM", description: "Edit team settings" },
  { key: "MANAGE_MEMBERS", description: "Add/remove team members" },
  { key: "ASSIGN_ROLES", description: "Assign roles to members within the team" },
];

const ROLES: Record<string, { description: string; perms: string[] }> = {
  Admin: {
    description: "Full control within a team",
    perms: PERMISSIONS.map((p) => p.key),
  },
  Manager: {
    description: "Day-to-day team management",
    perms: ["CREATE_TASK", "EDIT_TASK", "VIEW_ONLY", "MANAGE_MEMBERS"],
  },
  Viewer: {
    description: "Read-only",
    perms: ["VIEW_ONLY"],
  },
};

const DEMO_USERS = [
  { email: "alice@example.com", password: "Password123!", name: "Alice Anderson" },
  { email: "bob@example.com", password: "Password123!", name: "Bob Brown" },
];

async function main() {
  const client = new MongoClient(uri!);
  await client.connect();
  const db = client.db(dbName);

  console.log("Seeding permissions…");
  for (const p of PERMISSIONS) {
    await db
      .collection("permissions")
      .updateOne(
        { key: p.key },
        { $set: { key: p.key, description: p.description } },
        { upsert: true }
      );
  }
  const permDocs = await db.collection("permissions").find().toArray();
  const permIdByKey: Record<string, ObjectId> = Object.fromEntries(
    permDocs.map((d) => [d.key, d._id])
  );

  console.log("Seeding roles…");
  const roleIdByName: Record<string, ObjectId> = {};
  for (const [name, r] of Object.entries(ROLES)) {
    const permissionIds = r.perms.map((k) => permIdByKey[k]).filter(Boolean);
    const result = await db
      .collection("roles")
      .findOneAndUpdate(
        { name },
        { $set: { name, description: r.description, permissionIds } },
        { upsert: true, returnDocument: "after" }
      );
    roleIdByName[name] = result!._id;
  }

  console.log("Seeding demo users…");
  const userIdByEmail: Record<string, ObjectId> = {};
  for (const u of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    const result = await db.collection("users").findOneAndUpdate(
      { email: u.email },
      {
        $set: { name: u.name, email: u.email, passwordHash },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true, returnDocument: "after" }
    );
    userIdByEmail[u.email] = result!._id;
  }
  const aliceId = userIdByEmail["alice@example.com"];
  const bobId = userIdByEmail["bob@example.com"];

  console.log("Seeding demo teams…");
  const teamIdByName: Record<string, ObjectId> = {};
  for (const teamName of ["Team Alpha", "Team Beta"]) {
    const result = await db.collection("teams").findOneAndUpdate(
      { name: teamName },
      { $set: { name: teamName, createdBy: aliceId }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, returnDocument: "after" }
    );
    teamIdByName[teamName] = result!._id;
  }
  const alphaId = teamIdByName["Team Alpha"];
  const betaId = teamIdByName["Team Beta"];

  console.log("Seeding memberships…");
  const memberships = [
    { userId: aliceId, teamId: alphaId },
    { userId: aliceId, teamId: betaId },
    { userId: bobId, teamId: betaId },
  ];
  for (const m of memberships) {
    await db
      .collection("memberships")
      .updateOne(
        m,
        { $set: m, $setOnInsert: { joinedAt: new Date() } },
        { upsert: true }
      );
  }

  console.log("Seeding role assignments…");
  // The literal spec example: Alice = Admin in Alpha, Viewer in Beta. Bob = Manager in Beta.
  const assigns = [
    { userId: aliceId, teamId: alphaId, roleId: roleIdByName.Admin, assignedBy: aliceId },
    { userId: aliceId, teamId: betaId, roleId: roleIdByName.Viewer, assignedBy: aliceId },
    { userId: bobId, teamId: betaId, roleId: roleIdByName.Manager, assignedBy: aliceId },
  ];
  for (const a of assigns) {
    await db
      .collection("userTeamRoles")
      .updateOne(
        { userId: a.userId, teamId: a.teamId, roleId: a.roleId },
        { $set: a, $setOnInsert: { assignedAt: new Date() } },
        { upsert: true }
      );
  }

  console.log("\nSeed complete.");
  console.log("  Alice  →  alice@example.com / Password123!  (Admin in Alpha, Viewer in Beta)");
  console.log("  Bob    →  bob@example.com   / Password123!  (Manager in Beta)");
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
