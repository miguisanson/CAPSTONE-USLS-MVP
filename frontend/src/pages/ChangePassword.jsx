import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { KeyRound, LogOut } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Card, Field, InlineNotice, Input, PageHeader } from "../components/ui/index.js";

const HOME = { staff: "/", academic_coordinator: "/monitoring-sheet", research_coordinator: "/workflow/graduation", admin: "/", dean: "/dean", student: "/student", faculty: "/faculty-portal" };

// First sign-in with a generated initial password: choose your own before anything else works.
// Also reachable later at /change-password to change a password voluntarily.
export default function ChangePassword() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  // `fields` holds a message per field (shown under it and read out with it); `error` is a problem with the whole request
  const [fields, setFields] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user) return <Navigate to="/login" replace />;
  const forced = Boolean(user.must_change_password);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    const problems = {};
    if (form.next.length < 10) problems.next = "Choose a password of at least 10 characters.";
    if (form.next !== form.confirm) problems.confirm = "The new password and its confirmation do not match.";
    setFields(problems);
    if (Object.keys(problems).length) return;
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
    <main className="grid min-h-screen place-items-center bg-canvas p-4">
      <Card pad="lg" as="section" className="w-full max-w-md" aria-labelledby="change-password-title">
        <PageHeader
          icon={KeyRound}
          title={forced ? "Choose your own password" : "Change password"}
          titleProps={{ id: "change-password-title" }}
          description={
            forced
              ? "You signed in with an initial password that was given to you. Choose a password only you know before you continue."
              : "Enter your current password and a new one."
          }
        />
        <form onSubmit={onSubmit} className="mt-5 space-y-4" autoComplete="off" noValidate>
          <Field label={forced ? "Initial password" : "Current password"}>
            <Input type="password" autoComplete="current-password" value={form.current} onChange={set("current")} required />
          </Field>
          <Field label="New password" hint="At least 10 characters." error={fields.next}>
            <Input type="password" autoComplete="new-password" value={form.next} onChange={set("next")} required />
          </Field>
          <Field label="Confirm new password" error={fields.confirm}>
            <Input type="password" autoComplete="new-password" value={form.confirm} onChange={set("confirm")} required />
          </Field>
          {error && <InlineNotice tone="danger">{error}</InlineNotice>}
          <div className="flex flex-wrap justify-between gap-2 max-sm:flex-col-reverse">
            <Button variant="secondary" icon={LogOut} onClick={logout}>
              Sign out
            </Button>
            <Button type="submit" loading={busy}>
              {busy ? "Saving…" : "Save password"}
            </Button>
          </div>
        </form>
      </Card>
    </main>
  );
}
