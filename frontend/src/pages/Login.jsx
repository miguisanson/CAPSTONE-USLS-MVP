import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Eye, EyeOff, GraduationCap, LockKeyhole, UserCog, UserRound, Gavel } from "lucide-react";
import { useAuth } from "../auth";
import { ErrorNote } from "../components/ui";

const DEMO = {
  staff: { email: "staff@gs.local", password: "DemoPass123!" },
  dean: { email: "dean@gs.local", password: "DemoPass123!" },
  student: { email: "student@gs.local", password: "DemoPass123!" },
};

const HOME = { staff: "/", dean: "/approvals", student: "/student" };
const LABEL = { staff: "Staff", dean: "Dean", student: "Student" };

export default function Login() {
  const { user, login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("staff");
  const [form, setForm] = useState(DEMO.staff);
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setForm(DEMO[role]);
    setLocalError("");
  }, [role]);

  if (user?.role) return <Navigate to={HOME[user.role] || "/"} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setLocalError("");
    try {
      const signedIn = await login({ role, ...form });
      navigate(HOME[signedIn.role] || "/", { replace: true });
    } catch {
      setLocalError("Login failed. Check the account type, email, and password.");
    }
  }

  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-8 lg:grid-cols-2 lg:px-8">
        <section className="space-y-5">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-sm">
            <GraduationCap className="h-8 w-8" />
          </span>
          <div>
            <p className="text-sm font-bold uppercase text-brand-700">University of St. La Salle</p>
            <h1 className="mt-2 font-display text-4xl font-semibold leading-tight text-ink">
              Graduate School Lifecycle Portal
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600">
              Sign in with the demo staff or student account to access the correct workspace.
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Accounts are created by the Graduate School office.</p>
          </div>

          <div className="mb-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-100 p-1">
            <ModeButton active={role === "staff"} icon={UserCog} label="Staff" onClick={() => setRole("staff")} />
            <ModeButton active={role === "dean"} icon={Gavel} label="Dean" onClick={() => setRole("dean")} />
            <ModeButton active={role === "student"} icon={UserRound} label="Student" onClick={() => setRole("student")} />
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="field-label">Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="field-input"
                required
              />
            </label>
            <label className="block">
              <span className="field-label">Password</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="field-input pr-11"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <ErrorNote message={localError || error} />

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Signing in...
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" /> Sign in as {LABEL[role] || "Staff"}
                </>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function ModeButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
        active ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}
