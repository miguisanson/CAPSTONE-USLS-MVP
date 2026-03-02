import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
      setLocalError("Login failed. Check your credentials.");
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[var(--gs-bg)] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(0,143,70,0.14),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(2,111,56,0.12),transparent_35%)]" />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <h1 className="text-xl font-semibold text-[var(--gs-dark)]">Graduate Lifecycle Platform</h1>
        <p className="mt-2 text-sm text-slate-500">
          Monitoring and decision support portal for graduate student lifecycle management.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-slate-600">
              Email
            </label>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--gs-primary)] focus:ring-2"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-slate-600">
              Password
            </label>
            <input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-[var(--gs-primary)] focus:ring-2"
            />
          </div>

          {(localError || error) && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {localError ?? error}
            </div>
          )}

          <button
            disabled={loading}
            className="w-full rounded-md bg-[var(--gs-primary)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--gs-dark)] disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
};

