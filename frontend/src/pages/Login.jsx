import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BriefcaseBusiness, CheckCircle2, ChevronDown, Eye, EyeOff, GraduationCap, LockKeyhole, LogOut, RotateCcw, UserCog, UserRound, Gavel } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote } from "../components/ui";

const DEMO = {
  staff: { email: "staff@usls.edu.ph", password: "DemoPass123!" },
  academic_coordinator: { email: "academic@usls.edu.ph", password: "DemoPass123!" },
  research_coordinator: { email: "research@usls.edu.ph", password: "DemoPass123!" },
  admin: { email: "admin@usls.edu.ph", password: "DemoPass123!" },
  dean: { email: "dean@usls.edu.ph", password: "DemoPass123!" },
  student: { email: "student@usls.edu.ph", password: "DemoPass123!" },
  faculty: { email: "liwayway.bautista@usls.edu.ph", password: "DemoPass123!" },
};

const HOME = { staff: "/", academic_coordinator: "/monitoring-sheet", research_coordinator: "/workflow/graduation", admin: "/", dean: "/approvals", student: "/student", faculty: "/faculty-portal" };
const LABEL = { staff: "Staff", dean: "Dean", student: "Student" };
const STAFF_ACCOUNTS = [
  { role: "staff", label: "GS Staff", detail: "Intake and records" },
  { role: "academic_coordinator", label: "Academic Coordinator", detail: "Coursework and practicum" },
  { role: "research_coordinator", label: "Research Coordinator", detail: "Research completion" },
  { role: "admin", label: "Administrator", detail: "All staff screens (review)" },
];

export default function Login() {
  const { user, login, loading, error } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState("staff");
  const [staffAccount, setStaffAccount] = useState("staff");
  const [form, setForm] = useState(DEMO.staff);
  const [localError, setLocalError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [demoStudents, setDemoStudents] = useState([]);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState("");
  const [demoNotice, setDemoNotice] = useState("");
  const [quickLoginBusy, setQuickLoginBusy] = useState("");
  const [resetBusy, setResetBusy] = useState("");
  const [openDemoGroup, setOpenDemoGroup] = useState("");

  useEffect(() => {
    setForm(DEMO[role === "staff" ? staffAccount : role]);
    setLocalError("");
    if (role !== "student") setOpenDemoGroup("");
  }, [role, staffAccount]);

  useEffect(() => {
    let active = true;
    api.demoStudents()
      .then((result) => {
        if (active) setDemoStudents(result.items || []);
      })
      .catch((requestError) => {
        if (active) setDemoError(requestError.message || "Demo student accounts could not be loaded.");
      })
      .finally(() => {
        if (active) setDemoLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  async function quickLogin(student) {
    setLocalError("");
    setDemoError("");
    setDemoNotice("");
    setQuickLoginBusy(student.key);
    try {
      const signedIn = await login({
        role: "student",
        email: student.email,
        password: student.password,
      });
      navigate(HOME[signedIn.role] || "/student", { replace: true });
    } catch (requestError) {
      setDemoError(requestError.message || `Could not sign in as ${student.name}.`);
    } finally {
      setQuickLoginBusy("");
    }
  }

  async function resetDemoStudent(student) {
    const confirmed = window.confirm(
      `Reset ${student.name}'s ${student.workflow} demo? This clears this workflow's submissions, messages, tasks, and staff actions for the student.`,
    );
    if (!confirmed) return;
    setDemoError("");
    setDemoNotice("");
    setResetBusy(student.key);
    try {
      const result = await api.resetDemoStudent(student.key);
      if (result.item) {
        setDemoStudents((items) => items.map((item) => (item.key === student.key ? result.item : item)));
      }
      setDemoNotice(result.message || `${student.name}'s demo data was reset.`);
    } catch (requestError) {
      setDemoError(requestError.message || `Could not reset ${student.name}.`);
    } finally {
      setResetBusy("");
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
              Sign in with your role account to access the correct workflow steps.
            </p>
          </div>

          {role === "staff" && (
            <div className="mb-5">
              <p className="field-label">Choose staff responsibility</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {STAFF_ACCOUNTS.map((account) => (
                  <button
                    key={account.role}
                    type="button"
                    onClick={() => setStaffAccount(account.role)}
                    className={`cursor-pointer rounded-xl border px-3 py-3 text-left transition-colors ${staffAccount === account.role ? "border-brand-500 bg-brand-50 ring-1 ring-brand-200" : "border-slate-200 bg-white hover:border-brand-200 hover:bg-slate-50"}`}
                  >
                    <span className="block text-sm font-bold text-ink">{account.label}</span>
                    <span className="mt-0.5 block text-xs text-slate-500">{account.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {role === "student" && <div className="space-y-3 pt-1">
            <div>
              <p className="field-label">Student workflow demos</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Select a student to sign in instantly, or reset one case for a clean walkthrough.
              </p>
            </div>

            {demoLoading ? (
              <div className="rounded-xl border border-slate-200 bg-white px-4 py-5 text-sm text-slate-500">
                Loading demo students…
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <DemoStudentGroup
                  open={openDemoGroup === "practicum"}
                  onToggle={() => setOpenDemoGroup((current) => current === "practicum" ? "" : "practicum")}
                  title="Practicum"
                  description="Prerequisites complete; ready to begin Practicum."
                  icon={BriefcaseBusiness}
                  students={demoStudents.filter((student) => student.workflow === "practicum")}
                  quickLoginBusy={quickLoginBusy}
                  resetBusy={resetBusy}
                  onLogin={quickLogin}
                  onReset={resetDemoStudent}
                />
                <DemoStudentGroup
                  open={openDemoGroup === "graduation"}
                  onToggle={() => setOpenDemoGroup((current) => current === "graduation" ? "" : "graduation")}
                  title="Graduation"
                  description="All prior requirements complete; ready for Graduation."
                  icon={GraduationCap}
                  students={demoStudents.filter((student) => student.workflow === "graduation")}
                  quickLoginBusy={quickLoginBusy}
                  resetBusy={resetBusy}
                  onLogin={quickLogin}
                  onReset={resetDemoStudent}
                />
              </div>
            )}

            {!demoLoading && <div className="space-y-3 pt-2">
              <div>
                <p className="field-label">Standalone processes</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  These active students are enrolled in a specific course and ready to demonstrate a lifecycle withdrawal.
                </p>
              </div>
              <DemoStudentGroup
                open={openDemoGroup === "withdrawal"}
                onToggle={() => setOpenDemoGroup((current) => current === "withdrawal" ? "" : "withdrawal")}
                title="Withdrawal"
                description="Active enrollment; ready to apply for lifecycle withdrawal."
                icon={LogOut}
                students={demoStudents.filter((student) => student.workflow === "withdrawal")}
                quickLoginBusy={quickLoginBusy}
                resetBusy={resetBusy}
                onLogin={quickLogin}
                onReset={resetDemoStudent}
              />
            </div>}

            <div aria-live="polite" className="min-h-5">
              {demoNotice && (
                <p className="flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {demoNotice}
                </p>
              )}
              {demoError && <ErrorNote message={demoError} />}
            </div>
          </div>}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Accounts are created by the Graduate School office.</p>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <ModeButton active={role === "staff"} icon={UserCog} label="Staff" onClick={() => setRole("staff")} />
            <ModeButton active={role === "faculty"} icon={GraduationCap} label="Faculty" onClick={() => setRole("faculty")} />
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
                  <LockKeyhole className="h-4 w-4" /> Sign in as {role === "staff" ? STAFF_ACCOUNTS.find((item) => item.role === staffAccount)?.label : LABEL[role] || "Staff"}
                </>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function DemoStudentGroup({ open, onToggle, title, description, icon: Icon, students, quickLoginBusy, resetBusy, onLogin, onReset }) {
  const contentId = `demo-${title.toLowerCase()}-students`;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label={`${title} demo students`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={contentId}
        className={`flex w-full cursor-pointer items-center justify-between gap-3 bg-slate-50 px-3.5 py-3 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${open ? "border-b border-slate-100" : ""}`}
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <Icon className="h-4 w-4 text-brand-700" /> {title}
          </span>
          <span className="mt-1 block text-[11px] leading-relaxed text-slate-500">{description}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
            {students.length}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
      <div id={contentId} className="divide-y divide-slate-100">
        {students.map((student) => {
          const isLoggingIn = quickLoginBusy === student.key;
          const isResetting = resetBusy === student.key;
          const anyBusy = Boolean(quickLoginBusy || resetBusy);
          return (
            <div key={student.key} className="flex items-stretch gap-1.5 p-2">
              <button
                type="button"
                onClick={() => onLogin(student)}
                disabled={anyBusy}
                className="min-w-0 flex-1 cursor-pointer rounded-xl px-2 py-2 text-left transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-wait disabled:opacity-60"
                aria-label={`Sign in as ${student.name}, ${title} demo student`}
              >
                <span className="block truncate text-sm font-bold text-ink">
                  {isLoggingIn ? "Signing in…" : student.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  {student.student_number} · {student.program_code}
                </span>
                <span className="mt-1 flex items-start gap-1 text-[11px] font-semibold leading-snug text-emerald-700">
                  <CheckCircle2 className="mt-px h-3 w-3 shrink-0" /> {student.ready_label}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onReset(student)}
                disabled={anyBusy}
                className="my-1 flex shrink-0 cursor-pointer items-center justify-center gap-1 rounded-xl border border-red-700 bg-red-600 px-2.5 text-[11px] font-bold text-white transition-colors hover:border-red-800 hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50"
                aria-label={`Reset ${student.name}'s ${title} demo data`}
                title={`Reset ${student.name}'s demo data`}
              >
                <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? "animate-spin" : ""}`} />
                {isResetting ? "Resetting" : "Reset"}
              </button>
            </div>
          );
        })}
      </div>
      )}
    </section>
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
