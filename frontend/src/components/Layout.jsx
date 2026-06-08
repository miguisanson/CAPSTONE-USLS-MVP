import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  ListTodo,
  Activity,
  UserPlus,
  CalendarOff,
  ClipboardCheck,
  FileCheck,
  CalendarCheck,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
} from "lucide-react";

const ICONS = {
  "user-plus": UserPlus,
  "calendar-off": CalendarOff,
  "clipboard-check": ClipboardCheck,
  "file-check": FileCheck,
  users: Users,
  "calendar-check": CalendarCheck,
};

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Monitoring",
    items: [
      { to: "/students", label: "Students", icon: Users },
      { to: "/work-queue", label: "Work Queue", icon: ListTodo },
      { to: "/activity", label: "Activity Log", icon: Activity },
    ],
  },
];

const WORKFLOWS = [
  { slug: "student-handoff", label: "Student Handoff", icon: "user-plus" },
  { slug: "course-audit", label: "Course Audit", icon: "clipboard-check" },
  { slug: "research-gate", label: "Research Gate", icon: "file-check" },
  { slug: "panel-matching", label: "Panel Matching", icon: "users" },
  { slug: "defense-scheduling", label: "Defense Scheduling", icon: "calendar-check" },
  { slug: "loa-decision", label: "LOA / Readmission", icon: "calendar-off" },
];

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

function SidebarContent({ onNavigate }) {
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
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="px-3 pb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Workflows</p>
          <div className="space-y-1">
            {WORKFLOWS.map((wf) => {
              const Icon = ICONS[wf.icon] || FileCheck;
              return (
                <NavLink
                  key={wf.slug}
                  to={`/workflow/${wf.slug}`}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
                      isActive
                        ? "bg-brand-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
                    }`
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
                  <span>{wf.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="border-t border-slate-200 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Demo dataset · figures are computed live from recorded transactions.
        </p>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent />
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
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
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
              Graduate School Staff
            </span>
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
