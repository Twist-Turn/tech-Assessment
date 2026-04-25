import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "../../lib/api";
import type { AuditEntry } from "../../lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../components/ui/card";
import { Badge } from "../../components/ui/badge";

export default function AdminAuditLog() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ items: AuditEntry[] }>("/audit?limit=100")
      .then((d) => setItems(d.items))
      .catch((e: Error) => {
        setError(e.message);
        toast.error(e.message);
      });
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit log</CardTitle>
        <CardDescription>
          Every membership and role change. Visible to anyone with MANAGE_TEAM, MANAGE_MEMBERS, or
          ASSIGN_ROLES anywhere.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-4">When</th>
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Actor</th>
                  <th className="py-2 pr-4">Target</th>
                  <th className="py-2 pr-4">Team</th>
                  <th className="py-2 pr-4">Role</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 text-xs text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">
                      <Badge variant="outline" className="font-mono text-xs">
                        {e.action}
                      </Badge>
                    </td>
                    <td className="py-2 pr-4">{e.actor?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{e.target?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{e.team?.name ?? "—"}</td>
                    <td className="py-2 pr-4">{e.role?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
