import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { AppLayout } from "./AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { StudentsPage } from "../pages/StudentsPage";
import { StudentProfilePage } from "../pages/StudentProfilePage";
import { TaskQueuePage } from "../pages/TaskQueuePage";
import { DocumentsPage } from "../pages/DocumentsPage";
import { SchedulingPage } from "../pages/SchedulingPage";
import { AlertsPage } from "../pages/AlertsPage";
import { AnalyticsPage } from "../pages/AnalyticsPage";
import { ReportPrintPage } from "../pages/ReportPrintPage";
import { AuditLogPage } from "../pages/AuditLogPage";
import { AdminConfigPage } from "../pages/AdminConfigPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/analytics/print" element={<ReportPrintPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/students/:id" element={<StudentProfilePage />} />
            <Route path="/tasks" element={<TaskQueuePage />} />
            <Route path="/documents" element={<DocumentsPage />} />
            <Route path="/scheduling" element={<SchedulingPage />} />
            <Route path="/alerts" element={<AlertsPage />} />

            <Route
              element={
                <ProtectedRoute
                  allowedRoles={[
                    "ADMIN",
                    "GRADUATE_SCHOOL_STAFF",
                    "ACADEMIC_COORDINATOR",
                    "RESEARCH_COORDINATOR",
                  ]}
                />
              }
            >
              <Route path="/analytics" element={<AnalyticsPage />} />
            </Route>

            <Route
              element={
                <ProtectedRoute
                  allowedRoles={["ADMIN", "GRADUATE_SCHOOL_STAFF", "ACADEMIC_COORDINATOR", "RESEARCH_COORDINATOR"]}
                />
              }
            >
              <Route path="/audit" element={<AuditLogPage />} />
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route path="/admin" element={<AdminConfigPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  </AuthProvider>
);
