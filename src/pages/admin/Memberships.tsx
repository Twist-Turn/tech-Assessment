import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { api } from "../../lib/api";
import type { Assignment, Page, Role, Team, User } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Select } from "../../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";
import { TeamSelector } from "../../components/TeamSelector";
import { UserPicker } from "../../components/UserPicker";
import { roleClasses } from "../../lib/roleColor";
import { cn } from "../../lib/cn";

interface Member {
  user_id: string;
  joined_at: string;
  profiles: User;
}

export default function AdminMemberships() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [addPicker, setAddPicker] = useState<User | null>(null);
  const [rolePicker, setRolePicker] = useState<User | null>(null);
  const [pickerRole, setPickerRole] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    api.get<Page<Role>>("/roles").then((d) => setRoles(d.items));
  }, []);

  const reload = async () => {
    if (!teamId) {
      setMembers([]);
      setAssignments([]);
      return;
    }
    const [m, a] = await Promise.all([
      api.get<{ items: Member[] }>(`/memberships?teamId=${teamId}`),
      api.get<{ items: Assignment[] }>(`/assignments?teamId=${teamId}`),
    ]);
    setMembers(m.items);
    setAssignments(a.items);
    setRefreshKey((k) => k + 1);
  };

  useEffect(() => {
    setAddPicker(null);
    setRolePicker(null);
    setPickerRole("");
    reload().catch((e: Error) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const addMember = async (u: User) => {
    if (!teamId) return;
    try {
      await api.post("/memberships", { userId: u.id, teamId });
      toast.success(`Added ${u.name}`);
      setAddPicker(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeMember = async (userId: string) => {
    if (!teamId) return;
    try {
      await api.del(`/memberships/${teamId}/${userId}`);
      toast.success("Removed");
      if (rolePicker?.id === userId) setRolePicker(null);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const assignRole = async () => {
    if (!teamId || !rolePicker || !pickerRole) return;
    try {
      await api.post("/assignments", { userId: rolePicker.id, teamId, roleId: pickerRole });
      toast.success("Role updated");
      setRolePicker(null);
      setPickerRole("");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const removeAssignment = async (a: Assignment) => {
    try {
      await api.del(`/assignments/${a.team_id}/${a.user_id}/${a.role_id}`);
      toast.success("Removed");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const rolesForUser = (userId: string) => assignments.filter((a) => a.user_id === userId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Memberships & Role Assignments</CardTitle>
          <CardDescription>
            Pick a team, then add members and assign each one a role within this team. Each member
            holds exactly one role per team — assigning a new role replaces the previous one. Click
            a member's role chip to remove it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <TeamSelector value={teamId} onChange={setTeamId} />
          </div>
        </CardContent>
      </Card>

      {teamId && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" /> Add a member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <UserPicker value={addPicker?.id ?? null} onChange={setAddPicker} />
              <Button
                disabled={!addPicker}
                onClick={() => addPicker && addMember(addPicker)}
                className="w-full"
              >
                <Plus className="mr-1 h-4 w-4" /> Add to team
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Set member's role</CardTitle>
              <CardDescription>
                The user must already be a member of this team. Assigning replaces any existing
                role.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <UserPicker
                key={`role-picker-${teamId}-${refreshKey}`}
                value={rolePicker?.id ?? null}
                onChange={setRolePicker}
                teamId={teamId}
              />
              <Select value={pickerRole} onChange={(e) => setPickerRole(e.target.value)}>
                <option value="">— Select role —</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <Button onClick={assignRole} disabled={!rolePicker || !pickerRole} className="w-full">
                Set role
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Members of this team</CardTitle>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              ) : (
                <ul className="divide-y">
                  {members.map((m) => {
                    const userRole = rolesForUser(m.user_id)[0];
                    return (
                      <li key={m.user_id} className="flex items-start justify-between py-3">
                        <div>
                          <div className="font-medium">{m.profiles.name}</div>
                          <div className="text-xs text-muted-foreground">{m.profiles.email}</div>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {!userRole ? (
                              <Badge variant="outline">no role</Badge>
                            ) : (
                              <button
                                onClick={() => removeAssignment(userRole)}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors hover:bg-destructive hover:text-destructive-foreground",
                                  roleClasses(userRole.roles.name)
                                )}
                                title="Click to remove this role"
                              >
                                {userRole.roles.name}
                                <span aria-hidden>×</span>
                              </button>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMember(m.user_id)}
                          title="Remove from team"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
