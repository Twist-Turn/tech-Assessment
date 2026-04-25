import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import type { Page, User } from "../lib/types";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { cn } from "../lib/cn";

interface Props {
  value: string | null;
  onChange: (user: User | null) => void;
  /** When set, only show members of this team. */
  teamId?: string | null;
}

function useDebounced<T>(value: T, delay = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function UserPicker({ value, onChange, teamId }: Props) {
  const [q, setQ] = useState("");
  const dq = useDebounced(q, 250);
  const [items, setItems] = useState<User[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // For team-scoped mode we fetch members and then client-filter by q.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const url = teamId
      ? `/memberships?teamId=${encodeURIComponent(teamId)}`
      : `/users?limit=20${dq ? `&q=${encodeURIComponent(dq)}` : ""}`;

    api
      .get<any>(url)
      .then((d) => {
        if (cancelled) return;
        if (teamId) {
          const all: User[] = (d.items ?? [])
            .map((m: any) => m.profiles)
            .filter(Boolean);
          const filtered = dq
            ? all.filter(
                (u) =>
                  u.name.toLowerCase().includes(dq.toLowerCase()) ||
                  u.email.toLowerCase().includes(dq.toLowerCase())
              )
            : all;
          setItems(filtered);
          setNextCursor(null);
        } else {
          setItems(d.items ?? []);
          setNextCursor(d.nextCursor ?? null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [dq, teamId]);

  const loadMore = async () => {
    if (!nextCursor || teamId) return;
    setLoading(true);
    const d = await api.get<Page<User>>(
      `/users?limit=20&cursor=${encodeURIComponent(nextCursor)}${dq ? `&q=${encodeURIComponent(dq)}` : ""}`
    );
    setItems((prev) => [...prev, ...d.items]);
    setNextCursor(d.nextCursor);
    setLoading(false);
  };

  const selected = useMemo(() => items.find((u) => u.id === value), [items, value]);

  return (
    <div className="space-y-2">
      <Input
        placeholder={teamId ? "Filter team members…" : "Search by name or email…"}
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      <div className="max-h-72 overflow-y-auto rounded-md border bg-card">
        {items.length === 0 && !loading ? (
          <div className="p-4 text-sm text-muted-foreground">
            {teamId ? "No members in this team." : "No users found."}
          </div>
        ) : (
          <ul className="divide-y">
            {items.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onClick={() => onChange(u)}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent",
                    value === u.id && "bg-accent"
                  )}
                >
                  <span>
                    <span className="font-medium">{u.name}</span>
                    <span className="ml-2 text-muted-foreground">{u.email}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {nextCursor && !teamId && (
        <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </Button>
      )}
      {selected && (
        <div className="text-xs text-muted-foreground">
          Selected: {selected.name} ({selected.email})
        </div>
      )}
    </div>
  );
}
