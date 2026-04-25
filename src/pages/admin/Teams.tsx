import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { Page, Team } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function AdminTeams() {
  const [items, setItems] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);

  const load = async (reset = true) => {
    const url = `/teams?limit=20${cursor && !reset ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const d = await api.get<Page<Team>>(url);
    setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
    setCursor(d.nextCursor);
  };

  useEffect(() => {
    load(true).catch((e: Error) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.post("/teams", { name: name.trim() });
      setName("");
      setCursor(null);
      await load(true);
      toast.success("Team created");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[400px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create a team</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Team name</Label>
              <Input
                id="team-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Team Gamma"
              />
            </div>
            <Button type="submit" disabled={busy || !name.trim()}>
              {busy ? "Creating…" : "Create team"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teams ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No teams yet.</p>
          ) : (
            <ul className="divide-y">
              {items.map((t) => (
                <li key={t.id} className="flex items-center justify-between py-2">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => load(false)}>
              Load more
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
