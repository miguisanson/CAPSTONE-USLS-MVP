import { useEffect, useState } from "react";
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
  UserX,
  CalendarRange,
  BookPlus,
  LibraryBig,
} from "lucide-react";
import { useAuth } from "../auth";
import { api } from "../api";
import { PORTAL_NAV, PORTAL_FOOTERS, findNavItem, usePortalNav } from "./portalNav";

// Ordered top-to-bottom to follow the graduate lifecycle, so a new staff user
// moves down the list step by step instead of hunting between pages.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/reports", label: "Reports", icon: FileText },
      { to: "/term-settings", label: "Academic Semesters", icon: CalendarRange, roles: ["staff", "admin"] },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/students", label: "Students", icon: Users },
      { to: "/faculty", label: "Faculty", icon: UsersRound },
      { to: "/monitoring-sheet", label: "Monitoring Sheet", icon: Table2 },
      { to: "/enrollment-class-list", label: "Enrollment Class List", icon: BookOpenCheck },
    ],
  },
  {
    label: "Lifecycle Workflows",
    items: [
      { to: "/workflow/student-handoff", label: "1 · Student Handoff", icon: UserPlus },
      { to: "/course-adjustments", label: "2 · Course Adjustments", icon: SlidersHorizontal },
      { to: "/enrollment", label: "3 · Enrollment", icon: BookPlus },
      { to: "/workflow/research-gate", label: "4 · Research Gate", icon: FileCheck },
      { to: "/workflow/panel-matching", label: "5 · Panel Matching", icon: UsersRound },
      { to: "/workflow/defense-scheduling", label: "6 · Defense Scheduling", icon: CalendarCheck },
      { to: "/workflow/practicum", label: "7 · Practicum", icon: Briefcase },
      { to: "/workflow/graduation", label: "8 · Graduation", icon: GraduationCap },
    ],
  },
  {
    label: "Standalone Processes",
    items: [
      { to: "/workflow/leave-of-absence", label: "Leave of Absence", icon: CalendarOff },
      { to: "/workflow/readmission", label: "Readmission", icon: UserCheck },
      { to: "/workflow/awol", label: "AWOL & Residency", icon: UserX },
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
      { to: "/policy-documents", label: "Policy Documents", icon: LibraryBig, roles: ["staff", "admin"] },
    ],
  },
];

const ROLE_LABELS = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  admin: "Administrator",
  dean: "Dean",
  student: "Student",
  faculty: "Faculty",
};

const ROLE_PATHS = {
  academic_coordinator: new Set(["/reports", "/students", "/faculty", "/monitoring-sheet", "/enrollment-class-list", "/course-adjustments", "/enrollment", "/workflow/research-gate", "/workflow/panel-matching", "/workflow/practicum", "/workflow/graduation", "/workflow/awol", "/work-queue"]),
  research_coordinator: new Set(["/workflow/research-gate", "/workflow/graduation", "/monitoring-sheet", "/work-queue"]),
};

function NavItem({ to, label, icon: Icon, end, onClick, matches, badge }) {
  const { pathname } = useLocation();
  const alsoActive = (matches || []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
          isActive || alsoActive
            ? "bg-brand-600 text-white shadow-sm"
            : "text-slate-600 hover:bg-brand-50 hover:text-brand-700"
        }`
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
      <span className="min-w-0 flex-1">{label}</span>
      {badge > 0 && (
        <span className="ml-auto inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate, user }) {
  const { counts, flags } = usePortalNav();
  const portalGroups = PORTAL_NAV[user?.role];
  const allowedPaths = ROLE_PATHS[user?.role];
  const roleAllowed = (item) => !item.roles || item.roles.includes(user?.role);
  const groups = (portalGroups || NAV_GROUPS)
    .map((group) => ({
      ...group,
      items: group.items
        .filter((item) => roleAllowed(item) && (!allowedPaths || allowedPaths.has(item.to)) && !(item.hideWhen && flags[item.hideWhen]))
        .map((item) => ({ ...item, badge: item.badge ? counts[item.badge] || 0 : 0 })),
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
          {PORTAL_FOOTERS[user?.role] || "Figures are computed live from recorded transactions."}
        </p>
      </div>
    </div>
  );
}

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user, logout } = useAuth();
  const portalGroups = PORTAL_NAV[user?.role];
  const current = portalGroups ? findNavItem(portalGroups, location.pathname) : null;
  const pageTitle = current?.item.label || null;

  // Keep the browser tab title in step with the page (helps history and tabs).
  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · USLS Graduate School` : "USLS Graduate School";
  }, [pageTitle]);

  const initials = (user?.full_name || "GS")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-lift"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white lg:block">
        <div className="sticky top-0 h-screen">
          <SidebarContent user={user} />
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
            <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} />
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
          <Breadcrumb path={location.pathname} current={current} role={user?.role} />
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
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden="true">
              {initials}
            </span>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 focus:outline-none lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

const BREADCRUMB_LABELS = {
  "term-settings": "Academic Semesters",
  enrollment: "Enrollment",
  "course-adjustments": "Course Adjustments",
  "enrollment-class-list": "Enrollment Class List",
  "policy-documents": "Policy Documents",
};

function Breadcrumb({ path, current, role }) {
  // Role portals (student, dean, faculty): "<Portal> > <Group> > <Page>" from the nav config.
  if (current) {
    return (
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
        <span className="hidden font-semibold text-slate-400 sm:inline">{ROLE_LABELS[role]} Portal</span>
        <ChevronRight className="hidden h-4 w-4 text-slate-300 sm:block" />
        <span className="hidden font-semibold text-slate-400 md:inline">{current.group.label}</span>
        <ChevronRight className="hidden h-4 w-4 text-slate-300 md:block" />
        <span className="truncate font-semibold text-ink" aria-current="page">{current.item.label}</span>
      </nav>
    );
  }
  const parts = path.split("/").filter(Boolean);
  const label = parts.length === 0 ? "Dashboard" : BREADCRUMB_LABELS[parts[0]] || parts[0].replace(/-/g, " ");
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span className="font-semibold text-slate-400">Platform</span>
      <ChevronRight className="h-4 w-4 text-slate-300" />
      <span className="font-semibold capitalize text-ink">{label}</span>
    </div>
  );
}
