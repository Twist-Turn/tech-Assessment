import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ShieldCheck, Sparkles, UserCircle2 } from "lucide-react";
import { login as doLogin } from "../lib/auth";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";

const DEMO = [
  {
    email: "alice@example.com",
    password: "Password123!",
    name: "Alice",
    sub: "Admin in Alpha · Viewer in Beta",
  },
  {
    email: "bob@example.com",
    password: "Password123!",
    name: "Bob",
    sub: "Manager in Beta",
  },
];

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const signIn = async (e?: FormEvent, override?: { email: string; password: string }) => {
    e?.preventDefault();
    const creds = override ?? { email, password };
    setBusy(true);
    try {
      await doLogin(creds.email, creds.password);
      nav("/", { replace: true });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-12 text-slate-50 lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-6 w-6" />
          Rengy RBAC
        </div>
        <div className="space-y-4">
          <h1 className="text-3xl font-semibold leading-tight">
            Role-based access control,
            <br />
            scoped per team.
          </h1>
          <p className="max-w-md text-sm text-slate-300">
            Users belong to multiple teams. Each team grants its own roles. Permissions are computed
            per <code className="rounded bg-slate-700/50 px-1.5 py-0.5 text-xs">(user, team)</code>{" "}
            and enforced both server-side and in the UI.
          </p>
          <ul className="space-y-1.5 text-sm text-slate-400">
            <li>· One user can be Admin in one team and Viewer in another</li>
            <li>· No role assigned → no permissions</li>
            <li>· Multiple roles per (user, team) supported</li>
          </ul>
        </div>
        <div className="text-xs text-slate-500">
          MongoDB Atlas · Netlify Functions · React + Vite · custom JWT
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1 text-center lg:hidden">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-semibold">Rengy RBAC</h1>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sign in</CardTitle>
              <CardDescription>Welcome back.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => signIn(e)} className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  No account?{" "}
                  <Link to="/signup" className="underline">
                    Sign up
                  </Link>
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Demo accounts (one click)</span>
            </div>
            <div className="grid gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  onClick={() => signIn(undefined, { email: d.email, password: d.password })}
                  disabled={busy}
                  className="group flex items-center gap-3 rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-accent disabled:opacity-50"
                >
                  <UserCircle2 className="h-8 w-8 text-muted-foreground transition-colors group-hover:text-primary" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{d.name}</div>
                    <div className="text-xs text-muted-foreground">{d.sub}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">{d.email}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
