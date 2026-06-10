import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import WorkQueue from "./pages/WorkQueue";
import ActivityLog from "./pages/ActivityLog";
import WorkflowPage from "./pages/WorkflowPage";
import MonitoringGrid from "./pages/MonitoringGrid";
import DecisionSupport from "./pages/DecisionSupport";
import Assistant from "./pages/Assistant";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/monitoring-sheet" element={<MonitoringGrid />} />
        <Route path="/work-queue" element={<WorkQueue />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/decision-support" element={<DecisionSupport />} />
        <Route path="/assistant" element={<Assistant />} />
        <Route path="/workflow/:slug" element={<WorkflowPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
