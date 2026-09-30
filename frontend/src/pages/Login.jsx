import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { BookPlus, BriefcaseBusiness, CalendarOff, CheckCircle2, ChevronDown, Eye, EyeOff, GitBranch, GraduationCap, LockKeyhole, LogOut, PlayCircle, RotateCcw, SlidersHorizontal, UserCog, UserRound, UserX } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { ErrorNote } from "../components/ui";

const HOME = { staff: "/", academic_coordinator: "/monitoring-sheet", research_coordinator: "/workflow/graduation", admin: "/", dean: "/dean", student: "/student", faculty: "/faculty-portal" };

const STUDENT_LIFECYCLE_DEMOS = [
  {
    workflow: "student-handoff",
    title: "1 · Student Handoff",
    description: "New-student profiles after admissions handoff.",
    icon: UserCog,
  },
  {
    workflow: "course-adjustments",
    title: "2 · Course Adjustments",
    description: "Missing-subject demand scenarios for official course offerings.",
    icon: SlidersHorizontal,
  },
  {
    workflow: "enrollment",
    title: "3 · Enrollment",
    description: "Ready for single-student offered-subject enrollment.",
    icon: BookPlus,
  },
  {
    workflow: "research",
    title: "4–6 · Research, Panel & Defense",
    description: "Courses and comprehensive exam complete; ready for Title Defense requirements.",
    icon: GitBranch,
  },
  {
    workflow: "practicum",
    title: "7 · Practicum",
    description: "Psychology and MSGC students only; prerequisites complete.",
    icon: BriefcaseBusiness,
  },
  {
    workflow: "graduation",
    title: "8 · Graduation",
    description: "All prior requirements complete; ready for Graduation.",
    icon: GraduationCap,
  },
];

const STANDALONE_STUDENT_DEMOS = [
  {
    workflow: "leave-of-absence",
    title: "Leave of Absence",
    description: "Structured LOA requests with deterministic policy checks.",
    icon: CalendarOff,
  },
  {
    workflow: "readmission",
    title: "Readmission",
    description: "Approved-LOA personas ready for structured return requests.",
    icon: UserRound,
  },
  {
    workflow: "awol",
    title: "AWOL & Residency",
    description: "One automatically flagged AWOL return and one residency-ready persona.",
    icon: UserX,
  },
  {
    workflow: "withdrawal",
    title: "Withdrawal",
    description: "Active subject enrollment; ready to apply before classes or during the first week.",
    icon: LogOut,
  },
];

export default function Login() {
  const { user, login, loading, error } = useAuth();
  const navigate = useNavigate();
  // The form always starts empty: nothing is pre-filled, so a real typed login can be shown.
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoAccounts, setDemoAccounts] = useState([]);
  const [demoStudents, setDemoStudents] = useState([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const [demoError, setDemoError] = useState("");
  const [demoNotice, setDemoNotice] = useState("");
  const [quickLoginBusy, setQuickLoginBusy] = useState("");
  const [resetBusy, setResetBusy] = useState("");
  const [openDemoGroup, setOpenDemoGroup] = useState("");

  // Ask the server whether demo mode is on. With it off, this page is only the form.
  useEffect(() => {
    let active = true;
    api.authConfig()
      .then((result) => {
        if (active) setDemoMode(Boolean(result.demo_mode));
      })
      .catch(() => {
        if (active) setDemoMode(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Demo credentials are fetched only when the presenter expands the panel.
  useEffect(() => {
    if (!demoMode || !demoOpen || demoLoaded) return undefined;
    let active = true;
    setDemoLoading(true);
    Promise.all([api.demoAccounts(), api.demoStudents()])
      .then(([accounts, students]) => {
        if (!active) return;
        setDemoAccounts(accounts.items || []);
        setDemoStudents(students.items || []);
        setDemoLoaded(true);
      })
      .catch((requestError) => {
        if (active) setDemoError(requestError.message || "Demo accounts could not be loaded.");
      })
      .finally(() => {
        if (active) setDemoLoading(false);
      });
    return () => {
      active = false;
    };
  }, [demoMode, demoOpen, demoLoaded]);

  if (user?.role) return <Navigate to={HOME[user.role] || "/"} replace />;

  async function signIn(credentials) {
    // The role is decided by the server from the account; the form never sends one.
    const signedIn = await login({ email: credentials.email.trim(), password: credentials.password });
    navigate(HOME[signedIn.role] || "/", { replace: true });
  }

  async function onSubmit(e) {
    e.preventDefault();
    try {
      await signIn(form);
    } catch {
      /* the message is shown from the auth context */
    }
  }

  function fillForm(account) {
    setDemoError("");
    setForm({ email: account.email, password: account.password });
    setShowPassword(true);
  }

  async function quickLogin(account, busyKey) {
    setDemoError("");
    setDemoNotice("");
    setQuickLoginBusy(busyKey);
    try {
      await signIn(account);
    } catch (requestError) {
      setDemoError(requestError.message || `Could not sign in as ${account.name || account.label}.`);
    } finally {
      setQuickLoginBusy("");
    }
  }

  async function resetDemoStudent(student) {
    const confirmed = window.confirm(
      `Reset ${student.name}'s ${student.workflow_title || student.workflow} demo? This clears this workflow's submissions, messages, tasks, and staff actions for the student.`,
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

  const sharedPassword = demoAccounts[0]?.password || demoStudents[0]?.password || "";

  return (
    <div className="min-h-screen bg-canvas">
      <main className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-start gap-8 px-4 py-8 lg:grid-cols-2 lg:items-center lg:px-8">
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
              Sign in with your Graduate School account. The screens you see depend on the role your account holds.
            </p>
          </div>

          {demoMode && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60">
              <button
                type="button"
                onClick={() => setDemoOpen((value) => !value)}
                aria-expanded={demoOpen}
                aria-controls="demo-accounts-panel"
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-amber-900">
                    <PlayCircle className="h-4 w-4" /> Demo accounts
                    <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Demo mode</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-amber-800/80">
                    For presentations only. Expand to see ready-made accounts; nothing is filled in until you choose.
                  </span>
                </span>
                <ChevronDown className={`h-4 w-4 shrink-0 text-amber-800 transition-transform ${demoOpen ? "rotate-180" : ""}`} />
              </button>

              {demoOpen && (
                <div id="demo-accounts-panel" className="space-y-4 border-t border-amber-200 px-4 pb-4 pt-3">
                  {demoLoading && <p className="text-sm text-slate-500">Loading demo accounts…</p>}

                  {demoAccounts.length > 0 && (
                    <div className="space-y-2">
                      <p className="field-label">Staff, Dean, Faculty and Student</p>
                      {sharedPassword && (
                        <p className="text-xs text-slate-600">
                          Demo password for every account below:{" "}
                          <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px] text-ink ring-1 ring-slate-200">{sharedPassword}</code>
                        </p>
                      )}
                      <ul className="divide-y divide-amber-100 overflow-hidden rounded-xl border border-amber-100 bg-white">
                        {demoAccounts.map((account) => (
                          <li key={account.email} className="flex items-center gap-2 p-2">
                            <span className="min-w-0 flex-1 px-1">
                              <span className="block truncate text-sm font-bold text-ink">{account.label}</span>
                              <span className="block truncate text-[11px] text-slate-500">{account.email} · {account.detail}</span>
                            </span>
                            <button type="button" onClick={() => fillForm(account)} className="btn-ghost shrink-0 px-2.5 py-1.5 text-xs">
                              Fill form
                            </button>
                            <button
                              type="button"
                              onClick={() => quickLogin(account, account.email)}
                              disabled={Boolean(quickLoginBusy || resetBusy)}
                              className="btn-primary shrink-0 px-2.5 py-1.5 text-xs"
                              aria-label={`Sign in as ${account.label} (demo)`}
                            >
                              {quickLoginBusy === account.email ? "Signing in…" : "Sign in"}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {demoStudents.length > 0 && (
                    <div className="space-y-3">
                      <div>
                        <p className="field-label">Student workflow demos</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Arranged in the Graduate School lifecycle sequence. Select a student to sign in, or reset one case for a clean walkthrough.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {STUDENT_LIFECYCLE_DEMOS.map((group) => (
                          <DemoStudentGroup
                            key={group.workflow}
                            open={openDemoGroup === group.workflow}
                            onToggle={() => setOpenDemoGroup((current) => (current === group.workflow ? "" : group.workflow))}
                            title={group.title}
                            description={group.description}
                            icon={group.icon}
                            students={demoStudents.filter((student) => student.workflow === group.workflow)}
                            quickLoginBusy={quickLoginBusy}
                            resetBusy={resetBusy}
                            onLogin={(student) => quickLogin(student, student.key)}
                            onReset={resetDemoStudent}
                          />
                        ))}
                      </div>
                      <div>
                        <p className="field-label">Standalone processes</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          Leave, return, AWOL or residency, and early subject-withdrawal scenarios that branch from the main student lifecycle.
                        </p>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {STANDALONE_STUDENT_DEMOS.map((group) => (
                          <DemoStudentGroup
                            key={group.workflow}
                            open={openDemoGroup === group.workflow}
                            onToggle={() => setOpenDemoGroup((current) => (current === group.workflow ? "" : group.workflow))}
                            title={group.title}
                            description={group.description}
                            icon={group.icon}
                            students={demoStudents.filter((student) => student.workflow === group.workflow)}
                            quickLoginBusy={quickLoginBusy}
                            resetBusy={resetBusy}
                            onLogin={(student) => quickLogin(student, student.key)}
                            onReset={resetDemoStudent}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <div aria-live="polite" className="min-h-5">
                    {demoNotice && (
                      <p className="flex items-start gap-1.5 text-xs font-semibold leading-relaxed text-emerald-700">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {demoNotice}
                      </p>
                    )}
                    {demoError && <ErrorNote message={demoError} />}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Accounts are created by the Graduate School office.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
            <label className="block">
              <span className="field-label">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
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
                  name="password"
                  autoComplete="current-password"
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

            <ErrorNote message={error} />

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Signing in...
                </>
              ) : (
                <>
                  <LockKeyhole className="h-4 w-4" /> Sign in
                </>
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function DemoStudentGroup({ className = "", open, onToggle, title, description, icon: Icon, students, quickLoginBusy, resetBusy, onLogin, onReset }) {
  const contentId = `demo-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-students`;
  return (
    <section className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`} aria-label={`${title} demo students`}>
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
