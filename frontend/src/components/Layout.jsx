import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Activity,
  UserPlus,
  CalendarOff,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  CalendarCheck,
  Menu,
  X,
  GraduationCap,
  Briefcase,
  ChevronRight,
  Lightbulb,
  Bot,
  Table2,
  FileText,
  BookOpenCheck,
  SlidersHorizontal,
  UsersRound,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { useAuth } from "../auth";
import { api } from "../api";

// Ordered top-to-bottom to follow the graduate lifecycle, so a new staff user
// moves down the list step by step instead of hunting between pages.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/students", label: "Students", icon: Users },
      { to: "/faculty", label: "Faculty", icon: UsersRound },
      { to: "/admin/terms", label: "Semester Management", icon: CalendarCheck, roles: ["staff"] },
      { to: "/monitoring-sheet", label: "Monitoring Sheet", icon: Table2 },
    ],
  },
  {
    label: "Lifecycle workflows",
    items: [
      { to: "/workflow/student-handoff", label: "1 · Student Handoff", icon: UserPlus },
      { to: "/curriculum-planning", label: "2 · Curriculum planning", icon: BookOpenCheck },
      { to: "/course-adjustments", label: "3 · Course Adjustments", icon: SlidersHorizontal },
      { to: "/workflow/course-audit", label: "4 · Course Audit", icon: ClipboardCheck },
      { to: "/workflow/research-gate", label: "5 - Research Gate", icon: FileCheck },
      { to: "/workflow/panel-matching", label: "6 · Panel Matching", icon: UsersRound },
      { to: "/workflow/defense-scheduling", label: "7 · Defense Scheduling", icon: CalendarCheck },
      { to: "/workflow/practicum", label: "8 · Practicum", icon: Briefcase },
      { to: "/workflow/graduation", label: "9 · Graduation", icon: GraduationCap },
    ],
  },
  {
    label: "Standing changes",
    items: [
      { to: "/workflow/leave-of-absence", label: "Leave of Absence", icon: CalendarOff },
      { to: "/workflow/readmission", label: "Readmission", icon: UserCheck },
      { to: "/workflow/withdrawal", label: "Withdrawal Requests", icon: LogOut },
    ],
  },
  {
    label: "Monitoring & support",
    items: [
      { to: "/work-queue", label: "Work Queue", icon: ListTodo },
      { to: "/activity", label: "Activity Log", icon: Activity },
      { to: "/decision-support", label: "Recommendations", icon: Lightbulb },
      { to: "/assistant", label: "Policy Assistant", icon: Bot },
    ],
  },
];

const ROLE_LABELS = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  registrar: "Registrar",
};

const ROLE_PATHS = {
  academic_coordinator: new Set(["/monitoring-sheet", "/curriculum-planning", "/workflow/course-audit", "/workflow/research-gate", "/workflow/practicum", "/workflow/graduation", "/workflow/withdrawal", "/work-queue"]),
  research_coordinator: new Set(["/workflow/research-gate", "/workflow/graduation", "/work-queue"]),
  registrar: new Set(["/workflow/graduation", "/workflow/withdrawal", "/work-queue"]),
};

function NavItem({ to, label, icon: Icon, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
          isActive
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        }`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );
}

function SidebarContent({ onNavigate, user, onResetDemo, resettingDemo }) {
  const allowedPaths = ROLE_PATHS[user?.role];
  const roleAllowed = (item) => !item.roles || item.roles.includes(user?.role);
  const groups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => roleAllowed(item) && (!allowedPaths || allowedPaths.has(item.to))),
    }))
    .filter((group) => group.items.length);
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-semibold text-ink">USLS Graduate School</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Lifecycle Monitoring</p>
        </div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="mb-1 text-xs font-bold text-brand-700">{ROLE_LABELS[user?.role] || "Graduate School Staff"}</p>
        <p className="text-[11px] leading-relaxed text-slate-400">
          Demo dataset · figures are computed live from recorded transactions.
        </p>
        <button
          type="button"
          onClick={onResetDemo}
          disabled={resettingDemo}
          className="mt-3 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${resettingDemo ? "animate-spin" : ""}`} />
          {resettingDemo ? "Resetting demo..." : "Reset demo data"}
        </button>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();

  async function resetDemo() {
    if (!window.confirm("Reset the demo database and delete generated uploads? The Demo_Files folder will not be touched.")) return;
    setResettingDemo(true);
    try {
      await api.resetDemoData();
      window.location.assign("/");
    } catch (err) {
      window.alert(err.message || "Could not reset demo data.");
      setResettingDemo(false);
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent user={user} onResetDemo={resetDemo} resettingDemo={resettingDemo} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-white shadow-lift animate-fade-up">
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} onResetDemo={resetDemo} resettingDemo={resettingDemo} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Breadcrumb path={location.pathname} />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
              {user?.full_name || "Graduate School Staff"} · {ROLE_LABELS[user?.role] || "Staff"}
            </span>
            <button
              type="button"
              onClick={logout}
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
              GS
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

function Breadcrumb({ path }) {
  const parts = path.split("/").filter(Boolean);
  const label = parts.length === 0 ? "Dashboard" : parts[0].replace(/-/g, " ");
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-slate-400">Platform</span>
      <ChevronRight className="h-4 w-4 text-slate-300" />
      <span className="font-semibold capitalize text-ink">{label}</span>
    </div>
  );
}
