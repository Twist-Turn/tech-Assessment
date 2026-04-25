import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { Page, User } from "../../lib/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function AdminUsers() {
  const [items, setItems] = useState<User[]>([]);
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async (reset = true) => {
    const params = new URLSearchParams({ limit: "20" });
    if (q.trim()) params.set("q", q.trim());
    if (!reset && cursor) params.set("cursor", cursor);
    const d = await api.get<Page<User>>(`/users?${params}`);
    setItems((prev) => (reset ? d.items : [...prev, ...d.items]));
    setCursor(d.nextCursor);
  };

  useEffect(() => {
    const t = setTimeout(() => {
      load(true).catch((e: Error) => toast.error(e.message));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setBusy(true);
    try {
      await api.post("/users", {
        name: name.trim(),
        email: email.trim(),
        password: password || undefined,
      });
      setName("");
      setEmail("");
      setPassword("");
      await load(true);
      toast.success("User created");
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
          <CardTitle>Create a user</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onCreate} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">Name</Label>
              <Input id="u-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-pass">Initial password (optional)</Label>
              <Input
                id="u-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Random if blank"
              />
            </div>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create user"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search by name or email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users.</p>
          ) : (
            <ul className="divide-y">
              {items.map((u) => (
                <li key={u.id} className="flex items-center justify-between py-2">
                  <span>
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-sm text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {cursor && (
            <Button variant="outline" size="sm" onClick={() => load(false)}>
              Load more
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
