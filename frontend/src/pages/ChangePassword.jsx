import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote } from "../components/ui";

const HOME = { staff: "/", academic_coordinator: "/monitoring-sheet", research_coordinator: "/workflow/graduation", admin: "/", dean: "/dean", student: "/student", faculty: "/faculty-portal" };

// First sign-in with a generated initial password: choose your own before anything else works.
// Also reachable later at /change-password to change a password voluntarily.
export default function ChangePassword() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  const forced = Boolean(user.must_change_password);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    if (form.next.length < 10) {
      setError("Choose a password of at least 10 characters.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("The new password and its confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      await api.changePassword({ current_password: form.current, new_password: form.next });
      await refresh();
      navigate(HOME[user.role] || "/", { replace: true });
    } catch (err) {
      setError(err.message || "Could not change the password.");
    } finally {
      setBusy(false);
    }
  }

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg" aria-labelledby="change-password-title">
        <div className="mb-4 flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-white">
            <KeyRound className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h1 id="change-password-title" className="font-display text-xl font-semibold text-ink">
              {forced ? "Choose your own password" : "Change password"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {forced
                ? "You signed in with an initial password that was given to you. Choose a password only you know before you continue."
                : "Enter your current password and a new one."}
            </p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
          <label className="block">
            <span className="field-label">{forced ? "Initial password" : "Current password"}</span>
            <input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} className="field-input" required />
          </label>
          <label className="block">
            <span className="field-label">New password</span>
            <input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} className="field-input" minLength={10} required />
            <span className="mt-1 block text-xs text-slate-400">At least 10 characters.</span>
          </label>
          <label className="block">
            <span className="field-label">Confirm new password</span>
            <input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} className="field-input" minLength={10} required />
          </label>
          <ErrorNote message={error} />
          <div className="flex flex-wrap justify-between gap-2">
            <button type="button" onClick={logout} className="btn-ghost">
              <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
            </button>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? "Saving..." : "Save password"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
