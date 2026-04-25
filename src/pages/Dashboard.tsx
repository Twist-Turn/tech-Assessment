import { useEffect, useMemo, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { TeamSelector } from "../components/TeamSelector";
import { UserPicker } from "../components/UserPicker";
import { PermissionGrid } from "../components/PermissionGrid";
import { useResolvedPermissions } from "../hooks/usePermissions";
import { useSession } from "../hooks/useSession";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";
import { api } from "../lib/api";
import type { Page, Team, User } from "../lib/types";

interface MembershipRow {
  team_id: string;
  joined_at: string;
  teams: Team;
}

export default function Dashboard() {
  const { session } = useSession();
  const me = session?.user;

  const [teamId, setTeamId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Smart default: pre-fill (current user, their first team) so the dashboard is
  // immediately useful on first load without any clicks.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    (async () => {
      const [meTeams, allUsers] = await Promise.all([
        api.get<{ items: MembershipRow[] }>(
          `/memberships?userId=${encodeURIComponent(me.id)}`
        ),
        api.get<Page<User>>(`/users?q=${encodeURIComponent(me.email ?? "")}`),
      ]);
      if (cancelled) return;
      const myProfile = allUsers.items.find((u) => u.id === me.id) ?? null;
      if (myProfile) setUser(myProfile);
      if (meTeams.items[0]?.team_id) setTeamId(meTeams.items[0].team_id);
    })().catch(() => {
      // Non-fatal: user can still pick manually.
    });
    return () => {
      cancelled = true;
    };
  }, [me]);

  const { data, loading, error } = useResolvedPermissions(user?.id ?? null, teamId);

  const summary = useMemo(() => {
    if (!data) return null;
    return {
      granted: data.permissions.length,
      roles: data.roles.length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Permission Inspector
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          What can <span className="text-primary">{user?.name ?? "this user"}</span> do?
        </h1>
        <p className="text-sm text-muted-foreground">
          Permissions are resolved per <code className="rounded bg-muted px-1 text-xs">(user, team)</code>.
          Switch the team to see how the same user's permissions change.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                  1
                </span>
                <CardTitle className="text-sm">Team</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <TeamSelector
                value={teamId}
                onChange={(id) => setTeamId(id)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    2
                  </span>
                  <CardTitle className="text-sm">User</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {teamId ? "team members" : "all users"}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <UserPicker value={user?.id ?? null} onChange={setUser} teamId={teamId} />
            </CardContent>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                  <CardTitle className="text-sm">Resolved permissions</CardTitle>
                </div>
                <CardDescription className="mt-1">
                  {user && teamId
                    ? "Computed live from the database. Updates as you change inputs."
                    : "Pick a team and user on the left."}
                </CardDescription>
              </div>
              {summary && (
                <div className="hidden text-right sm:block">
                  <div className="text-2xl font-semibold leading-none">{summary.granted}</div>
                  <div className="text-xs text-muted-foreground">permissions</div>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {!teamId || !user ? (
              <EmptyState />
            ) : loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : data ? (
              <PermissionGrid
                granted={data.permissions}
                roles={data.roles}
                empty="No role assigned in this team — therefore no permissions. (Spec rule: no role → no permissions.)"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Select a team and a user to see what they can do.
      </p>
    </div>
  );
}
