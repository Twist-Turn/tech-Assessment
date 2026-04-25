import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { Page, Permission, Role } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [perms, setPerms] = useState<Permission[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [r, p] = await Promise.all([
      api.get<Page<Role>>("/roles"),
      api.get<Page<Permission>>("/permissions"),
    ]);
    setRoles(r.items);
    setPerms(p.items);
  };

  useEffect(() => {
    load().catch((e: Error) => toast.error(e.message));
  }, []);

  const togglePerm = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/roles", {
        name: name.trim(),
        description: description.trim() || undefined,
        permissionIds: [...selected],
      });
      setName("");
      setDescription("");
      setSelected(new Set());
      await load();
      toast.success("Role created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const replacePerms = async (role: Role, permissionIds: string[]) => {
    try {
      await api.post(`/roles/${role.id}/permissions`, { permissionIds, replace: true });
      await load();
      toast.success(`Updated ${role.name}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create a role</CardTitle>
          <CardDescription>Pick the permissions this role grants.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">Name</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-desc">Description</Label>
              <Input
                id="r-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Permissions</Label>
              <div className="grid max-h-60 grid-cols-1 gap-1 overflow-y-auto rounded-md border p-2">
                {perms.map((p) => (
                  <label key={p.id} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selected.has(p.id)}
                      onChange={() => togglePerm(p.id)}
                    />
                    <span>
                      <span className="font-mono text-xs">{p.key}</span>
                      {p.description && (
                        <span className="block text-xs text-muted-foreground">{p.description}</span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create role"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Roles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {roles.map((r) => (
            <div key={r.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground">{r.description}</div>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {r.permissions.length === 0 ? (
                  <span className="text-xs text-muted-foreground">no permissions</span>
                ) : (
                  r.permissions.map((p) => (
                    <Badge key={p.id} variant="outline" className="font-mono text-xs">
                      {p.key}
                    </Badge>
                  ))
                )}
              </div>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Edit permissions
                </summary>
                <RoleEditor role={r} perms={perms} onSave={(ids) => replacePerms(r, ids)} />
              </details>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function RoleEditor({
  role,
  perms,
  onSave,
}: {
  role: Role;
  perms: Permission[];
  onSave: (ids: string[]) => Promise<void>;
}) {
  const [sel, setSel] = useState<Set<string>>(new Set(role.permissions.map((p) => p.id)));
  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-1">
        {perms.map((p) => (
          <label key={p.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sel.has(p.id)}
              onChange={() => {
                const next = new Set(sel);
                if (next.has(p.id)) next.delete(p.id);
                else next.add(p.id);
                setSel(next);
              }}
            />
            <span className="font-mono text-xs">{p.key}</span>
          </label>
        ))}
      </div>
      <Button size="sm" variant="secondary" onClick={() => onSave([...sel])}>
        Save
      </Button>
    </div>
  );
}
