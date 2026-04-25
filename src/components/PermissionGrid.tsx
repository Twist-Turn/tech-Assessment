import { useEffect, useMemo, useState } from "react";
import {
  Check,
  X,
  FilePlus2,
  FileEdit,
  FileX2,
  Eye,
  Settings,
  UserCog,
  KeySquare,
  Shield,
} from "lucide-react";
import { api } from "../lib/api";
import type { Page, Permission } from "../lib/types";
import { cn } from "../lib/cn";
import { roleClasses } from "../lib/roleColor";

interface Props {
  granted: string[];
  roles: { id: string; name: string }[];
  empty?: string;
}

const ICON_FOR: Record<string, React.ComponentType<{ className?: string }>> = {
  CREATE_TASK: FilePlus2,
  EDIT_TASK: FileEdit,
  DELETE_TASK: FileX2,
  VIEW_ONLY: Eye,
  MANAGE_TEAM: Settings,
  MANAGE_MEMBERS: UserCog,
  ASSIGN_ROLES: KeySquare,
};

function categorize(key: string): "task" | "admin" | "other" {
  if (key.endsWith("_TASK") || key === "VIEW_ONLY") return "task";
  if (key.startsWith("MANAGE_") || key.startsWith("ASSIGN_")) return "admin";
  return "other";
}

const GROUP_META: Record<"task" | "admin" | "other", { label: string; description: string }> = {
  task: { label: "Task permissions", description: "Day-to-day actions on team content." },
  admin: { label: "Admin permissions", description: "Manage the team, its members, and role assignments." },
  other: { label: "Other permissions", description: "" },
};

export function PermissionGrid({ granted, roles, empty }: Props) {
  const [allPerms, setAllPerms] = useState<Permission[]>([]);

  useEffect(() => {
    api.get<Page<Permission>>("/permissions").then((d) => setAllPerms(d.items));
  }, []);

  const grouped = useMemo(() => {
    const buckets: Record<"task" | "admin" | "other", Permission[]> = {
      task: [],
      admin: [],
      other: [],
    };
    for (const p of allPerms) buckets[categorize(p.key)].push(p);
    return buckets;
  }, [allPerms]);

  if (allPerms.length === 0) {
    return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Roles in this team:</span>
        {roles.length === 0 ? (
          <span className="rounded-md border border-dashed px-2 py-0.5 text-xs text-muted-foreground">
            none
          </span>
        ) : (
          roles.map((r) => (
            <span
              key={r.id}
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
                roleClasses(r.name)
              )}
            >
              <Shield className="h-3 w-3" />
              {r.name}
            </span>
          ))
        )}
      </div>

      {granted.length === 0 && empty && (
        <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {empty}
        </div>
      )}

      {(["task", "admin", "other"] as const).map((cat) => {
        const perms = grouped[cat];
        if (perms.length === 0) return null;
        const grantedCount = perms.filter((p) => granted.includes(p.key)).length;
        return (
          <section key={cat} className="space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <h3 className="text-sm font-semibold">{GROUP_META[cat].label}</h3>
                {GROUP_META[cat].description && (
                  <p className="text-xs text-muted-foreground">{GROUP_META[cat].description}</p>
                )}
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">
                {grantedCount} / {perms.length} granted
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {perms.map((p) => (
                <PermissionCard key={p.id} perm={p} granted={granted.includes(p.key)} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PermissionCard({ perm, granted }: { perm: Permission; granted: boolean }) {
  const Icon = ICON_FOR[perm.key] ?? Shield;
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border p-3 transition-all",
        granted
          ? "border-emerald-500/30 bg-emerald-500/5 shadow-sm"
          : "border-dashed border-border bg-card opacity-70 hover:opacity-100"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
            granted ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-xs font-medium">{perm.key}</span>
            {granted ? (
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
            ) : (
              <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
          </div>
          {perm.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{perm.description}</p>
          )}
        </div>
      </div>
    </div>
  );
}
