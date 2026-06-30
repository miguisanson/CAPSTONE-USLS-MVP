import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import { Spinner } from "./components/ui";
import Dashboard from "./pages/Dashboard";
import Reports from "./pages/Reports";
import Students from "./pages/Students";
import Faculty from "./pages/Faculty";
import StudentDetail from "./pages/StudentDetail";
import WorkQueue from "./pages/WorkQueue";
import ActivityLog from "./pages/ActivityLog";
import WorkflowPage from "./pages/WorkflowPage";
import MonitoringGrid from "./pages/MonitoringGrid";
import CurriculumPlanning from "./pages/CurriculumPlanning";
import CourseAdjustments from "./pages/CourseAdjustments";
import DecisionSupport from "./pages/DecisionSupport";
import Assistant from "./pages/Assistant";
import StudentPortal from "./pages/StudentPortal";
import DeanApprovals from "./pages/DeanApprovals";
import Login from "./pages/Login";
import Form1Endorsements from "./pages/Form1Endorsements";
import FacultyPortal from "./pages/FacultyPortal";

// Where each role lands by default.
function homeFor(user) {
  if (!user) return "/login";
  if (user.role === "student") return "/student";
  if (user.role === "faculty") return "/faculty-portal";
  if (user.role === "dean") return "/approvals";
  if (user.role === "academic_coordinator") return "/workflow/course-audit";
  if (user.role === "research_coordinator") return "/workflow/graduation";
  return "/";
}

const BACKOFFICE_ROLES = new Set(["staff", "academic_coordinator", "research_coordinator"]);

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking account..." />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/student"
        element={
          <RoleOnly user={user} role="student">
            <StudentPortal />
          </RoleOnly>
        }
      />
      <Route
        path="/approvals"
        element={
          <RoleOnly user={user} role="dean">
            <DeanApprovals />
          </RoleOnly>
        }
      />
      <Route
        path="/faculty-portal"
        element={
          <RoleOnly user={user} role="faculty">
            <FacultyPortal />
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
                <Route path="/curriculum-planning" element={<CurriculumPlanning />} />
                <Route path="/course-adjustments" element={<CourseAdjustments />} />
                <Route path="/work-queue" element={<WorkQueue />} />
                <Route path="/activity" element={<ActivityLog />} />
                <Route path="/decision-support" element={<DecisionSupport />} />
                <Route path="/assistant" element={<Assistant />} />
                <Route path="/workflow/:slug" element={<WorkflowPage />} />
                <Route path="/form1-endorsements" element={<Form1Endorsements />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          </BackofficeOnly>
        }
      />
    </Routes>
  );
}

function BackofficeOnly({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (!BACKOFFICE_ROLES.has(user.role)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

// Generic single-role guard; sends anyone else to their own home.
function RoleOnly({ user, role, children }) {
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== role) return <Navigate to={homeFor(user)} replace />;
  return children;
}
