import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { useAuth } from "../app/AuthContext";

export const LoginPage = () => {
  const { user, login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@gs.local");
  const [password, setPassword] = useState("DemoPass123!");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      navigate("/", { replace: true });
    }
  }, [navigate, user]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLocalError(null);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch {
      setLocalError("Sign-in failed. Check email and password.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gs-bg)] p-4 md:p-8">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1200px] overflow-hidden rounded-3xl border border-[var(--gs-border)] bg-white shadow-xl md:min-h-[calc(100vh-4rem)] md:grid-cols-[1.15fr_1fr]">
        <section className="relative hidden bg-[linear-gradient(125deg,#00552b_0%,#006633_52%,#0b7a43_100%)] p-10 text-white md:block">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.16),transparent_45%)]" />
          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 text-center text-lg font-bold leading-[3rem]">USLS</div>
              <div>
                <p className="text-xl font-semibold">Graduate School Monitoring Portal</p>
                <p className="text-sm text-white/85">University of St. La Salle</p>
              </div>
            </div>
            <p className="mt-8 max-w-xl text-base leading-relaxed text-white/90">
              Internal platform for graduate student lifecycle monitoring, academic workflow routing, alerts, scheduling, analytics, and
              institutional decision support.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/75">Core Scope</p>
                <p className="mt-1 text-sm font-semibold">Lifecycle + Workflow Monitoring</p>
              </div>
              <div className="rounded-xl border border-white/20 bg-white/10 p-3">
                <p className="text-xs uppercase tracking-wide text-white/75">Security</p>
                <p className="mt-1 text-sm font-semibold">Role-Based + Audit Trail</p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center p-6 sm:p-10">
          <div className="w-full">
            <div className="mb-5">
              <p className="text-2xl font-semibold text-slate-900">Sign In</p>
              <p className="mt-1 text-sm text-slate-500">Use your authorized Graduate School account to continue.</p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-[var(--gs-primary)] focus:ring-2 focus:ring-[var(--gs-primary)]/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm outline-none transition focus:border-[var(--gs-primary)] focus:ring-2 focus:ring-[var(--gs-primary)]/20"
                />
              </div>

              {localError || error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  {localError ?? error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing In..." : "Sign In"}
              </Button>
            </form>

            <p className="mt-4 text-xs text-slate-500">
              Demo password for seeded users: <span className="font-semibold text-slate-700">DemoPass123!</span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
