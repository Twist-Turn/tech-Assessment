import { withAuth } from "./_lib/handler.js";
import { json, error } from "./_lib/http.js";
import { tryOid } from "./_lib/serialize.js";
import { resolvePermissionsAndRoles } from "./_lib/permissions.js";

export const handler = withAuth(async (event) => {
  if (event.httpMethod !== "GET") return error("Method not allowed", 405);
  const userId = tryOid(event.queryStringParameters?.userId);
  const teamId = tryOid(event.queryStringParameters?.teamId);
  if (!userId || !teamId) return error("userId and teamId required");

  const { permissions, roles } = await resolvePermissionsAndRoles(userId, teamId);
  return json({
    userId: userId.toString(),
    teamId: teamId.toString(),
    permissions,
    roles,
  });
});
