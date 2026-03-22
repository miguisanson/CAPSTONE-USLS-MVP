import { createBrowserRouter } from "react-router";
import { PortalLayout } from "./layouts/PortalLayout";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StudentsPage } from "./pages/StudentsPage";
import { StudentProfilePage } from "./pages/StudentProfilePage";
import { TaskQueuePage } from "./pages/TaskQueuePage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { SchedulingPage } from "./pages/SchedulingPage";
import { AlertsPage } from "./pages/AlertsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { PrintableReportPage } from "./pages/PrintableReportPage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { AdminConfigPage } from "./pages/AdminConfigPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/",
    Component: PortalLayout,
    children: [
      { index: true, Component: DashboardPage },
      { path: "students", Component: StudentsPage },
      { path: "students/:id", Component: StudentProfilePage },
      { path: "tasks", Component: TaskQueuePage },
      { path: "documents", Component: DocumentsPage },
      { path: "scheduling", Component: SchedulingPage },
      { path: "alerts", Component: AlertsPage },
      { path: "analytics", Component: AnalyticsPage },
      { path: "analytics/print", Component: PrintableReportPage },
      { path: "audit-log", Component: AuditLogPage },
      { path: "admin", Component: AdminConfigPage },
      { path: "*", Component: NotFoundPage },
    ],
  },
]);
