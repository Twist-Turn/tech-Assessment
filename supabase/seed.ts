/**
 * Seed script: roles, permissions, demo teams & users, demo assignments.
 * Idempotent — safe to run multiple times.
 *
 * Usage: npm run seed
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

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

const DEMO_TEAMS = ["Team Alpha", "Team Beta"];

async function upsertPermissions() {
  const { error } = await sb.from("permissions").upsert(PERMISSIONS, { onConflict: "key" });
  if (error) throw error;
  const { data, error: e2 } = await sb.from("permissions").select("id, key");
  if (e2) throw e2;
  return Object.fromEntries(data.map((p) => [p.key, p.id]));
}

async function upsertRoles(permId: Record<string, string>) {
  const rows = Object.entries(ROLES).map(([name, r]) => ({ name, description: r.description }));
  const { error } = await sb.from("roles").upsert(rows, { onConflict: "name" });
  if (error) throw error;
  const { data, error: e2 } = await sb.from("roles").select("id, name");
  if (e2) throw e2;
  const roleId = Object.fromEntries(data.map((r) => [r.name, r.id]));

  for (const [name, r] of Object.entries(ROLES)) {
    const rp = r.perms.map((k) => ({ role_id: roleId[name], permission_id: permId[k] }));
    const { error } = await sb.from("role_permissions").upsert(rp, {
      onConflict: "role_id,permission_id",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }
  return roleId;
}

async function upsertUser(email: string, password: string, name: string) {
  // Try to find existing first.
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listErr) throw listErr;
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) return existing.id;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw error;
  return data.user!.id;
}

async function upsertTeam(name: string, createdBy: string) {
  const { data: existing } = await sb.from("teams").select("id").eq("name", name).maybeSingle();
  if (existing) return existing.id as string;
  const { data, error } = await sb
    .from("teams")
    .insert({ name, created_by: createdBy })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function ensureMembership(userId: string, teamId: string) {
  const { error } = await sb
    .from("team_memberships")
    .upsert({ user_id: userId, team_id: teamId }, { onConflict: "user_id,team_id" });
  if (error) throw error;
}

async function ensureAssignment(userId: string, teamId: string, roleId: string, actor: string) {
  const { error } = await sb.from("user_team_roles").upsert(
    { user_id: userId, team_id: teamId, role_id: roleId, assigned_by: actor },
    { onConflict: "user_id,team_id,role_id" }
  );
  if (error) throw error;
}

async function main() {
  console.log("Seeding permissions...");
  const permId = await upsertPermissions();

  console.log("Seeding roles + role_permissions...");
  const roleId = await upsertRoles(permId);

  console.log("Seeding demo users...");
  const aliceId = await upsertUser(DEMO_USERS[0].email, DEMO_USERS[0].password, DEMO_USERS[0].name);
  const bobId = await upsertUser(DEMO_USERS[1].email, DEMO_USERS[1].password, DEMO_USERS[1].name);

  console.log("Seeding demo teams...");
  const alphaId = await upsertTeam("Team Alpha", aliceId);
  const betaId = await upsertTeam("Team Beta", aliceId);

  console.log("Seeding memberships...");
  await ensureMembership(aliceId, alphaId);
  await ensureMembership(aliceId, betaId);
  await ensureMembership(bobId, betaId);

  console.log("Seeding role assignments...");
  // The literal spec example: UserA Admin in Team Alpha, Viewer in Team Beta.
  await ensureAssignment(aliceId, alphaId, roleId.Admin, aliceId);
  await ensureAssignment(aliceId, betaId, roleId.Viewer, aliceId);
  await ensureAssignment(bobId, betaId, roleId.Manager, aliceId);

  console.log("\nSeed complete.");
  console.log("  Alice  →  alice@example.com / Password123!  (Admin in Alpha, Viewer in Beta)");
  console.log("  Bob    →  bob@example.com   / Password123!  (Manager in Beta)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
