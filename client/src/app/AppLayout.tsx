import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckSquare,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { useAuth } from "./AuthContext";
import { canAccessAdmin, canAccessAnalytics, canAccessAudit, roleLabel } from "../utils/roles";
import { roleTone } from "../utils/presentation";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  visible: boolean;
};

const sectionTitleByPath: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: "Dashboard" },
  { match: /^\/dashboard/, title: "Dashboard" },
  { match: /^\/students/, title: "Students" },
  { match: /^\/tasks/, title: "Task Queue" },
  { match: /^\/documents/, title: "Documents" },
  { match: /^\/scheduling/, title: "Scheduling" },
  { match: /^\/alerts/, title: "Monitoring Alerts" },
  { match: /^\/analytics/, title: "Analytics" },
  { match: /^\/audit/, title: "Audit Log" },
  { match: /^\/admin/, title: "Admin Configuration" },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const roles = user?.roles ?? [];
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const items = useMemo<NavItem[]>(
    () => [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, visible: true },
      { to: "/students", label: "Students", icon: Users, visible: true },
      { to: "/tasks", label: "Task Queue", icon: CheckSquare, visible: true },
      { to: "/documents", label: "Documents", icon: FileText, visible: true },
      { to: "/scheduling", label: "Scheduling", icon: CalendarClock, visible: true },
      { to: "/alerts", label: "Monitoring Alerts", icon: AlertTriangle, visible: true },
      { to: "/analytics", label: "Analytics", icon: BarChart3, visible: canAccessAnalytics(roles) },
      { to: "/audit", label: "Audit Log", icon: ScrollText, visible: canAccessAudit(roles) },
      { to: "/admin", label: "Admin Config", icon: Settings, visible: canAccessAdmin(roles) },
    ],
    [roles]
  );

  const activeTitle = useMemo(() => {
    const matched = sectionTitleByPath.find((item) => item.match.test(location.pathname));
    return matched?.title ?? "Portal";
  }, [location.pathname]);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navNode = (
    <nav className="space-y-1 p-3">
      {items
        .filter((item) => item.visible)
        .map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
                  isActive
                    ? "border-[var(--gs-primary)] bg-[var(--gs-primary)] !text-white hover:!text-white [&>svg]:!text-white [&>span]:!text-white"
                    : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                }`
              }
            >
              <Icon className="h-4 w-4" />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-3 px-4 md:px-6">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              className="hidden rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 lg:inline-flex"
              aria-label="Toggle sidebar"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex rounded-md border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="h-8 w-8 rounded-lg bg-[var(--gs-primary)] text-center text-xs font-bold leading-8 text-white">USLS</div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Graduate School Monitoring Portal</p>
              <p className="text-xs text-slate-500">University of St. La Salle</p>
            </div>
          </div>
          <div className="hidden min-w-0 flex-1 px-2 md:block">
            <p className="truncate text-sm text-slate-600">{activeTitle}</p>
          </div>
          <div className="flex items-center gap-2">
            {roles.map((role) => (
              <Badge key={role} tone={roleTone(role)} className="hidden sm:inline-flex">
                {roleLabel(role)}
              </Badge>
            ))}
            <Button variant="outline" size="sm" onClick={() => void onLogout()}>
              <LogOut className="h-3.5 w-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <aside
        className={`fixed bottom-0 left-0 top-16 z-40 hidden border-r border-slate-200 bg-white transition-all duration-200 lg:block ${
          sidebarOpen ? "w-72" : "w-20"
        }`}
      >
        {sidebarOpen ? (
          navNode
        ) : (
          <nav className="space-y-1 p-3">
            {items
              .filter((item) => item.visible)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `flex items-center justify-center rounded-lg border p-2 transition ${
                        isActive
                          ? "border-[var(--gs-primary)] bg-[var(--gs-primary)] !text-white hover:!text-white [&>svg]:!text-white"
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50"
                      }`
                    }
                    aria-label={item.label}
                    title={item.label}
                  >
                    <Icon className="h-4 w-4" />
                  </NavLink>
                );
              })}
          </nav>
        )}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 bg-slate-900/40 lg:hidden">
          <aside className="h-full w-80 max-w-[90vw] border-r border-slate-200 bg-white">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4">
              <p className="text-sm font-semibold text-slate-900">Navigation</p>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md border border-slate-300 p-1.5 text-slate-700"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {navNode}
          </aside>
        </div>
      ) : null}

      <main className={`pt-16 transition-all duration-200 ${sidebarOpen ? "lg:pl-72" : "lg:pl-20"}`}>
        <div className="mx-auto w-full max-w-[1680px] px-4 py-5 md:px-6 md:py-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
