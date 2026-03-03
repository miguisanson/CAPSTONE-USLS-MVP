import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { canAccessAdmin, canAccessAnalytics, canAccessAudit, roleLabel } from "../utils/roles";

type NavItem = {
  to: string;
  label: string;
};

const baseNav: NavItem[] = [
  { to: "/", label: "Dashboard" },
  { to: "/students", label: "Students" },
  { to: "/tasks", label: "Task Queue" },
  { to: "/documents", label: "Documents" },
  { to: "/scheduling", label: "Scheduling" },
  { to: "/alerts", label: "Monitoring Alerts" },
];

export const AppLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const roles = user?.roles ?? [];

  const dynamicNav: NavItem[] = [
    ...baseNav,
    ...(canAccessAnalytics(roles) ? [{ to: "/analytics", label: "Analytics" }] : []),
    ...(canAccessAudit(roles) ? [{ to: "/audit", label: "Audit Log" }] : []),
    ...(canAccessAdmin(roles) ? [{ to: "/admin", label: "Admin Config" }] : []),
  ];

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-[var(--gs-bg)] text-slate-800">
      <div className="mx-auto flex min-h-screen max-w-[1600px]">
        <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-white p-6 lg:block">
          <h1 className="text-lg font-semibold text-[var(--gs-dark)]">Graduate Lifecycle</h1>
          <p className="mt-1 text-xs text-slate-500">Monitoring & Analytics Platform</p>
          <nav className="mt-6 space-y-1">
            {dynamicNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? "bg-[var(--gs-primary)]/10 text-[var(--gs-dark)]"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="flex-1 p-4 md:p-6">
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--gs-dark)]">Graduate Lifecycle</p>
                <p className="text-[11px] text-slate-500">Monitoring & Analytics Platform</p>
              </div>
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-nav"
              >
                {mobileMenuOpen ? "Close Menu" : "Open Menu"}
              </button>
            </div>
            {mobileMenuOpen ? (
              <nav id="mobile-nav" className="mt-3 grid gap-1">
                {dynamicNav.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 text-sm ${
                        isActive
                          ? "bg-[var(--gs-primary)]/10 text-[var(--gs-dark)]"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            ) : null}
          </section>

          <header className="mb-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--gs-dark)]">{user?.fullName}</p>
                <p className="text-xs text-slate-500">{(user?.roles ?? []).map(roleLabel).join(", ")}</p>
              </div>
              <button
                onClick={onLogout}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </header>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
