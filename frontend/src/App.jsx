import { Routes, Route, Navigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Card, EmptyState, Spinner } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Students from "./pages/Students";
import Faculty from "./pages/Faculty";
import StudentDetail from "./pages/StudentDetail";
import WorkQueue from "./pages/WorkQueue";
import ActivityLog from "./pages/ActivityLog";
import WorkflowPage from "./pages/WorkflowPage";
import MonitoringGrid from "./pages/MonitoringGrid";
import CoursePlanning from "./pages/CoursePlanning";
import EnrollmentClassList from "./pages/EnrollmentClassList";
import Enrollment from "./pages/Enrollment";
import DecisionSupport from "./pages/DecisionSupport";
import Assistant from "./pages/Assistant";
import { StudentPortalProvider, StudentRoutes } from "./pages/student/StudentRoutes";
import { DeanProvider, DeanRoutes } from "./pages/dean/DeanRoutes";
import Login from "./pages/Login";
import ChangePassword from "./pages/ChangePassword";
import Form1Endorsements from "./pages/Form1Endorsements";
import { FacultyProvider, FacultyRoutes } from "./pages/faculty/FacultyRoutes";
import TermSettings from "./pages/TermSettings";
import PolicyDocuments from "./pages/PolicyDocuments";
import BusinessRules from "./pages/BusinessRules";

// Where each role lands by default.
function homeFor(user) {
  if (!user) return "/login";
  if (user.role === "student") return "/student";
  if (user.role === "faculty") return "/faculty-portal";
  if (user.role === "dean") return "/dean";
  if (user.role === "academic_coordinator") return "/monitoring-sheet";
  if (user.role === "research_coordinator") return "/workflow/research-gate";
  return "/";
}

const BACKOFFICE_ROLES = new Set(["staff", "academic_coordinator", "research_coordinator", "admin"]);

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking account..." />;
  // An account created with a generated initial password must choose its own first.
  if (user?.must_change_password) return <ChangePassword />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/change-password" element={<ChangePassword />} />
      {/* Role portals: student, dean and faculty use the same Layout shell as the
          staff side; only the navigation items differ (see components/portalNav.jsx).
          Each provider wraps the Layout so the sidebar can show action badges. */}
      <Route
        path="/student/*"
        element={
          <RoleOnly user={user} role="student">
            <StudentPortalProvider>
              <Layout>
                <StudentRoutes />
              </Layout>
            </StudentPortalProvider>
          </RoleOnly>
        }
      />
      <Route
        path="/dean/*"
        element={
          <RoleOnly user={user} role="dean">
            <DeanProvider>
              <Layout>
                <DeanRoutes />
              </Layout>
            </DeanProvider>
          </RoleOnly>
        }
      />
      {/* Old Dean URL, kept so bookmarks and saved links still work. */}
      <Route path="/approvals" element={<Navigate to="/dean/approvals" replace />} />
      <Route
        path="/faculty-portal/*"
        element={
          <RoleOnly user={user} role="faculty">
            <FacultyProvider>
              <Layout>
                <FacultyRoutes />
              </Layout>
            </FacultyProvider>
          </RoleOnly>
        }
      />
      <Route
        path="/*"
        element={
          <BackofficeOnly user={user}>
            <Layout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/students" element={<Students />} />
                <Route path="/faculty" element={<Faculty />} />
                <Route path="/students/:id" element={<StudentDetail />} />
                <Route path="/monitoring-sheet" element={<MonitoringGrid />} />
                <Route path="/enrollment-class-list" element={<EnrollmentClassList />} />
                <Route path="/course-adjustments" element={<CoursePlanning />} />
                <Route path="/course-planning" element={<Navigate to="/course-adjustments?view=adjustments" replace />} />
                <Route path="/curriculum-planning" element={<Navigate to="/course-adjustments?view=adjustments" replace />} />
                <Route path="/course-offerings" element={<Navigate to="/course-adjustments?view=offerings" replace />} />
                <Route path="/enrollment" element={<Enrollment />} />
                <Route path="/term-settings" element={<TermSettings />} />
                <Route path="/work-queue" element={<WorkQueue />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/decision-support" element={<DecisionSupport />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/policy-documents" element={<RoleOnly user={user} roles={["staff", "admin"]}><PolicyDocuments /></RoleOnly>} />
                <Route path="/business-rules" element={<BusinessRules />} />
                <Route path="/workflow/:slug" element={<WorkflowPage />} />
                <Route
                  path="/form1-endorsements"
                  element={
                    <RoleOnly user={user} role="academic_coordinator">
                      <Form1Endorsements />
                    </RoleOnly>
                  }
                />
                <Route path="*" element={<UnavailablePage />} />
              </Routes>
            </Layout>
          </BackofficeOnly>
        }
      />
    </Routes>
  );
}

function UnavailablePage() {
  return (
    <Card>
      <EmptyState
        icon={AlertTriangle}
        title="This page is not available yet"
        hint="The route exists in the navigation history, but this screen has not been implemented. Use the sidebar to open an available module."
      />
    </Card>
  );
}

function BackofficeOnly({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!BACKOFFICE_ROLES.has(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

// Generic single-role guard; sends anyone else to their own home.
function RoleOnly({ user, role, roles, children }) {
  if (!user) return <Navigate to="/login" replace />;
  const allowedRoles = roles || [role];
  if (!allowedRoles.includes(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}
