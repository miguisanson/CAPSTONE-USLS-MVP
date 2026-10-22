import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
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
  Scale,
} from "lucide-react";
import { useAuth } from "../auth";
import { Button, Drawer } from "./ui/index.js";
import { PORTAL_NAV, PORTAL_FOOTERS, findNavItem, usePortalNav } from "./portalNav";
import NotificationBell from "./NotificationBell";
import { PAGE, PORTAL_NAMES, RECORD_LABELS, stepLabel, withoutStep } from "../lib/labels.js";

// Ordered top-to-bottom to follow the graduate lifecycle, so a new staff user
// moves down the list step by step instead of hunting between pages.
const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/", label: PAGE.dashboard, icon: LayoutDashboard, end: true },
      { to: "/reports", label: PAGE.reportsAnalytics, icon: FileText },
      { to: "/term-settings", label: PAGE.academicSemesters, icon: CalendarRange, roles: ["staff", "admin"] },
    ],
  },
  {
    label: "Records",
    items: [
      { to: "/students", label: PAGE.students, icon: Users },
      { to: "/faculty", label: PAGE.faculty, icon: UsersRound },
      { to: "/monitoring-sheet", label: PAGE.monitoringSheet, icon: Table2 },
      { to: "/enrollment-class-list", label: PAGE.enrollmentClassList, icon: BookOpenCheck },
    ],
  },
  {
    label: "Lifecycle Workflows",
    items: [
      { to: "/workflow/student-handoff", label: stepLabel(1, PAGE.studentHandoff), icon: UserPlus },
      { to: "/course-adjustments", label: stepLabel(2, PAGE.courseAdjustments), icon: SlidersHorizontal },
      { to: "/enrollment", label: stepLabel(3, PAGE.enrollment), icon: BookPlus },
      // Not a numbered step: a read-only check of subjects against the curriculum, done before the research gate (I-101).
      { to: "/workflow/course-audit", label: PAGE.courseAudit, icon: ClipboardCheck },
      { to: "/workflow/research-gate", label: stepLabel(4, PAGE.researchGate), icon: FileCheck },
      { to: "/workflow/panel-matching", label: stepLabel(5, PAGE.panelMatching), icon: UsersRound },
      { to: "/workflow/defense-scheduling", label: stepLabel(6, PAGE.defenseScheduling), icon: CalendarCheck },
      { to: "/workflow/practicum", label: stepLabel(7, PAGE.practicum), icon: Briefcase },
      { to: "/workflow/graduation", label: stepLabel(8, PAGE.graduationEndorsement), icon: GraduationCap },
    ],
  },
  {
    label: "Standalone Processes",
    items: [
      { to: "/workflow/leave-of-absence", label: PAGE.leaveOfAbsence, icon: CalendarOff },
      { to: "/workflow/readmission", label: PAGE.readmission, icon: UserCheck },
      { to: "/workflow/awol", label: PAGE.awolResidency, icon: UserX },
      { to: "/workflow/withdrawal", label: PAGE.subjectWithdrawal, icon: LogOut },
    ],
  },
  {
    label: "Monitoring & support",
    items: [
      { to: "/work-queue", label: PAGE.workQueue, icon: ListTodo },
      { to: "/activity", label: PAGE.activityLog, icon: Activity },
      { to: "/assistant", label: PAGE.assistant, icon: Bot },
      { to: "/policy-documents", label: PAGE.policyDocuments, icon: LibraryBig, roles: ["staff", "admin"] },
      { to: "/business-rules", label: PAGE.businessRules, icon: Scale },
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

// The pages a coordinator may open (I-066: the Dashboard at "/" is every back-office role's home).
const ROLE_PATHS = {
  academic_coordinator: new Set(["/", "/reports", "/students", "/faculty", "/monitoring-sheet", "/enrollment-class-list", "/course-adjustments", "/enrollment", "/workflow/course-audit", "/workflow/research-gate", "/workflow/panel-matching", "/workflow/practicum", "/workflow/graduation", "/workflow/awol", "/work-queue", "/assistant", "/business-rules"]),
  // Protocol: the Research Coordinator nominates the panel and informs panel and student of the date.
  research_coordinator: new Set(["/", "/workflow/research-gate", "/workflow/panel-matching", "/workflow/defense-scheduling", "/workflow/graduation", "/monitoring-sheet", "/work-queue", "/assistant", "/business-rules"]),
};

function NavItem({ to, label, icon: Icon, end, onClick, matches, badge }) {
  const { pathname } = useLocation();
  const alsoActive = (matches || []).some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      data-also-active={alsoActive || undefined}
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
        <span className="ml-auto inline-flex min-w-[1.4rem] items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-800" aria-label={`${badge} waiting`}>
          {badge}
        </span>
      )}
    </NavLink>
  );
}

// A faint shadow at the top and/or bottom edge of the nav while there is more to scroll in that direction (I-103): the
// "local" layers hide the shadow once the list is scrolled to that end, the "scroll" layers stay put on the box.
const NAV_SCROLL_SHADOW = {
  background: [
    "linear-gradient(#fff 30%, rgba(255,255,255,0)) top / 100% 28px no-repeat local",
    "linear-gradient(rgba(255,255,255,0), #fff 70%) bottom / 100% 28px no-repeat local",
    "radial-gradient(farthest-side at 50% 0, rgba(15,23,42,0.16), rgba(15,23,42,0)) top / 100% 10px no-repeat scroll",
    "radial-gradient(farthest-side at 50% 100%, rgba(15,23,42,0.16), rgba(15,23,42,0)) bottom / 100% 10px no-repeat scroll",
  ].join(", "),
};

function SidebarContent({ onNavigate, onClose, user }) {
  const { counts, flags } = usePortalNav();
  const { pathname } = useLocation();
  const navRef = useRef(null);
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
  const shape = groups.map((group) => group.items.length).join(",");

  // I-103: the nav scrolls between the brand and the footer; open it with the page you are on in view (only the nav
  // moves, never the page).
  useEffect(() => {
    const nav = navRef.current;
    const current = nav?.querySelector('a[aria-current="page"], a[data-also-active]');
    if (!nav || !current) return;
    const box = nav.getBoundingClientRect();
    const item = current.getBoundingClientRect();
    const margin = 40; // leaves the next item (or the group's label above) peeking in
    if (item.bottom + margin > box.bottom) nav.scrollTop += item.bottom + margin - box.bottom;
    else if (item.top - margin < box.top) nav.scrollTop -= box.top - (item.top - margin);
  }, [pathname, shape]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 px-5 py-5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
          <GraduationCap className="h-6 w-6" />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="card-title">USLS Graduate School</p>
          <p className="text-2xs font-semibold uppercase tracking-wide text-brand-600">Lifecycle Monitoring</p>
        </div>
        {onClose && <Button variant="icon" icon={X} aria-label="Close menu" onClick={onClose} className="ml-auto" />}
      </div>

      <nav ref={navRef} style={NAV_SCROLL_SHADOW} className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-3 pb-6">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="eyebrow px-3 pb-2">{group.label}</p>
            <div className="space-y-1">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} onClick={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 px-5 py-4">
        <p className="mb-1 text-xs font-semibold text-brand-700">{ROLE_LABELS[user?.role] || "Graduate School Staff"}</p>
        <p className="micro leading-relaxed">
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
  // Every role has a sidebar; the page's name is its sidebar label (without a "3 · " step number).
  const current = findNavItem(PORTAL_NAV[user?.role] || NAV_GROUPS, location.pathname);
  const pageTitle = current ? withoutStep(current.item.label) : FALLBACK_LABELS[location.pathname] || null;

  // The menu is a small-screen control: if the window grows to desktop width while it is open, close it
  // (the old drawer was lg:hidden).
  useEffect(() => {
    if (!mobileOpen) return undefined;
    const wide = window.matchMedia("(min-width: 1024px)");
    const onChange = () => wide.matches && setMobileOpen(false);
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [mobileOpen]);

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
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-toast focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-brand-700 focus:shadow-lift"
      >
        Skip to main content
      </a>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:block 2xl:w-72">
        <div className="sticky top-0 h-screen">
          <SidebarContent user={user} />
        </div>
      </aside>

      {/* Mobile menu: the library Drawer (focus moves in and is trapped, Escape and the backdrop close it, focus returns to the menu button) */}
      {mobileOpen && (
        <Drawer side="left" label="Menu" width="w-80 max-w-[85vw]" onClose={() => setMobileOpen(false)}>
          <SidebarContent user={user} onNavigate={() => setMobileOpen(false)} onClose={() => setMobileOpen(false)} />
        </Drawer>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-header flex items-center gap-3 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:px-6 2xl:px-8">
          <Button variant="icon" icon={Menu} aria-label="Open menu" onClick={() => setMobileOpen(true)} className="lg:hidden" />
          <Breadcrumb path={location.pathname} current={current} role={user?.role} />
          <div className="ml-auto flex min-w-0 shrink-0 items-center gap-3">
            <span className="hidden max-w-[16rem] truncate rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-block xl:max-w-[24rem]" title={`${user?.full_name || "Graduate School Staff"} · ${user?.program || ROLE_LABELS[user?.role] || "Staff"}`}>
              {user?.full_name || "Graduate School Staff"} · {user?.program || ROLE_LABELS[user?.role] || "Staff"}
            </span>
            <NotificationBell />
            <Button variant="icon" icon={LogOut} aria-label="Sign out" onClick={logout} />
            <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white" aria-hidden="true">
              {initials}
            </span>
          </div>
        </header>

        <main id="main-content" tabIndex={-1} className="mx-auto w-full min-w-0 max-w-page flex-1 px-4 py-6 focus:outline-none lg:px-6 lg:py-7 2xl:px-8 2xl:py-8">{children}</main>
      </div>
    </div>
  );
}

// Pages reached by a link, not from the sidebar.
const FALLBACK_LABELS = {
  "/form1-endorsements": PAGE.form1Endorsements,
};

// One rule for every role: "<Portal name> > <Page name>", the page name being the sidebar label and the page's own
// title (lib/labels.js). A record page that is not in the sidebar adds its list page in between and the record last:
// "<Portal name> > Students > Student Record".
function Breadcrumb({ path, current, role }) {
  const portal = PORTAL_NAMES[role] || PORTAL_NAMES.staff;
  const crumbs = [{ label: portal, hide: "hidden sm:flex" }];
  if (current) {
    const name = withoutStep(current.item.label);
    const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
    if (trimmed === current.item.to) {
      crumbs.push({ label: name, page: true });
    } else {
      const prefix = [current.item.to, ...(current.item.matches || [])].find((candidate) => trimmed === candidate || trimmed.startsWith(`${candidate}/`));
      crumbs.push({ label: name, to: current.item.to, hide: "hidden md:flex" });
      crumbs.push({ label: RECORD_LABELS[prefix] || "Details", page: true });
    }
  } else {
    const segment = path.split("/").filter(Boolean)[0] || "";
    const guess = segment.replace(/-/g, " ").replace(/\w/g, (letter) => letter.toUpperCase());
    crumbs.push({ label: FALLBACK_LABELS[path] || guess || PAGE.dashboard, page: true });
  }
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 text-sm">
      <ol className="flex min-w-0 items-center gap-1.5">
        {crumbs.map((crumb, index) => (
          <li key={`${index}-${crumb.label}`} className={`min-w-0 items-center gap-1.5 ${crumb.hide || "flex"}`}>
            {index > 0 && <ChevronRight className={`h-4 w-4 shrink-0 text-slate-300 ${index === 1 && crumbs[0].hide ? "max-sm:hidden" : ""}`} aria-hidden="true" />}
            {crumb.to ? (
              <Link to={crumb.to} className="truncate font-semibold text-slate-500 hover:text-brand-700 hover:underline">{crumb.label}</Link>
            ) : (
              <span className={`truncate font-semibold ${crumb.page ? "text-ink" : "text-slate-500"}`} aria-current={crumb.page ? "page" : undefined}>{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
