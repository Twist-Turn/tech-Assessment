import { Navigate, Route, Routes, Link, NavLink } from "react-router-dom";
import {
  LogOut,
  ShieldCheck,
  LayoutDashboard,
  Users2,
  KeyRound,
  Building2,
  Network,
  ScrollText,
} from "lucide-react";
import { useSession } from "./hooks/useSession";
import { logout } from "./lib/auth";
import { Button } from "./components/ui/button";
import { cn } from "./lib/cn";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AdminTeams from "./pages/admin/Teams";
import AdminUsers from "./pages/admin/Users";
import AdminRoles from "./pages/admin/Roles";
import AdminMemberships from "./pages/admin/Memberships";
import AdminAuditLog from "./pages/admin/AuditLog";

const NAV = [
  { to: "/", label: "Dashboard", Icon: LayoutDashboard },
  { to: "/admin/teams", label: "Teams", Icon: Building2 },
  { to: "/admin/users", label: "Users", Icon: Users2 },
  { to: "/admin/roles", label: "Roles", Icon: KeyRound },
  { to: "/admin/memberships", label: "Memberships", Icon: Network },
  { to: "/admin/audit", label: "Audit", Icon: ScrollText },
];

function NavItem({ to, label, Icon }: (typeof NAV)[number]) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        cn(
          "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
          isActive
            ? "bg-secondary text-secondary-foreground"
            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
        )
      }
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </NavLink>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { session } = useSession();
  const email = session?.user.email;
  const initial = email?.[0]?.toUpperCase() ?? "?";
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-slate-900 to-slate-700 text-slate-50">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <span>Rengy RBAC</span>
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex">
            {NAV.map((n) => (
              <NavItem key={n.to} {...n} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border bg-card py-1 pl-1 pr-3 sm:flex">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
                {initial}
              </div>
              <span className="text-xs text-muted-foreground">{email}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <nav className="flex items-center gap-0.5 overflow-x-auto border-t px-2 py-1.5 md:hidden">
          {NAV.map((n) => (
            <NavItem key={n.to} {...n} />
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}

export default function App() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Shell>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/admin/teams" element={<AdminTeams />} />
        <Route path="/admin/users" element={<AdminUsers />} />
        <Route path="/admin/roles" element={<AdminRoles />} />
        <Route path="/admin/memberships" element={<AdminMemberships />} />
        <Route path="/admin/audit" element={<AdminAuditLog />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}
