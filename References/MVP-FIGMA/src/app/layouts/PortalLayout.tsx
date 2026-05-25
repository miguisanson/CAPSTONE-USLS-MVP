import { Outlet, Link, useLocation, useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  FileText,
  Calendar,
  AlertTriangle,
  BarChart3,
  ScrollText,
  Settings,
  Bell,
  Search,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Badge } from "../components/ui/badge";

const navigationItems = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard, allowedRoles: ["all"] },
  { name: "Students", path: "/students", icon: Users, allowedRoles: ["all"] },
  { name: "Task Queue", path: "/tasks", icon: CheckSquare, allowedRoles: ["all"] },
  { name: "Documents", path: "/documents", icon: FileText, allowedRoles: ["all"] },
  { name: "Scheduling", path: "/scheduling", icon: Calendar, allowedRoles: ["all"] },
  { name: "Alerts", path: "/alerts", icon: AlertTriangle, allowedRoles: ["all"] },
  { 
    name: "Analytics", 
    path: "/analytics", 
    icon: BarChart3, 
    allowedRoles: ["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator"] 
  },
  { 
    name: "Audit Log", 
    path: "/audit-log", 
    icon: ScrollText, 
    allowedRoles: ["Admin", "Graduate School Staff", "Academic Coordinator", "Research Coordinator"] 
  },
  { 
    name: "Admin Config", 
    path: "/admin", 
    icon: Settings, 
    allowedRoles: ["Admin"] 
  },
];

export function PortalLayout() {
  const { user, logout, hasAccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const canViewItem = (allowedRoles: string[]) => {
    if (!user) return false;
    if (allowedRoles.includes("all")) return true;
    return allowedRoles.includes(user.role);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50">
        <div className="h-full flex items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:block p-2 hover:bg-accent rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-accent rounded-md"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-semibold text-sm">USLS</span>
              </div>
              <div className="hidden md:block">
                <h1 className="text-sm font-semibold text-foreground">Graduate School Portal</h1>
                <p className="text-xs text-muted-foreground">University of St. La Salle</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden md:flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search students..."
                className="w-64 h-9"
              />
            </div>

            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-1 right-1 h-2 w-2 bg-destructive rounded-full"></span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="hidden md:block text-left">
                    <p className="text-sm font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.role}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 hidden md:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div>
                    <p className="font-medium">{user?.name}</p>
                    <p className="text-xs text-muted-foreground">{user?.email}</p>
                    <Badge variant="outline" className="mt-1 text-xs">{user?.role}</Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Sidebar - Desktop */}
      <aside
        className={`hidden lg:block fixed left-0 top-16 bottom-0 bg-card border-r border-border transition-all duration-300 z-40 ${
          sidebarOpen ? "w-64" : "w-0"
        } overflow-hidden`}
      >
        <nav className="p-4 space-y-1">
          {navigationItems.map((item) => {
            if (!canViewItem(item.allowedRoles)) return null;
            
            const isActive = location.pathname === item.path || 
              (item.path !== "/" && location.pathname.startsWith(item.path));
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span className="whitespace-nowrap">{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background">
          <div className="h-16 border-b border-border flex items-center justify-between px-4">
            <h2 className="text-lg font-semibold">Menu</h2>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-accent rounded-md"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="p-4 space-y-1">
            {navigationItems.map((item) => {
              if (!canViewItem(item.allowedRoles)) return null;
              
              const isActive = location.pathname === item.path || 
                (item.path !== "/" && location.pathname.startsWith(item.path));
              const Icon = item.icon;

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main
        className={`pt-16 transition-all duration-300 ${
          sidebarOpen ? "lg:pl-64" : "lg:pl-0"
        }`}
      >
        <div className="p-4 lg:p-6 max-w-[1600px] mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
