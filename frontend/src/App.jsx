import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import Students from "./pages/Students";
import StudentDetail from "./pages/StudentDetail";
import WorkQueue from "./pages/WorkQueue";
import ActivityLog from "./pages/ActivityLog";
import WorkflowPage from "./pages/WorkflowPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/students" element={<Students />} />
        <Route path="/students/:id" element={<StudentDetail />} />
        <Route path="/work-queue" element={<WorkQueue />} />
        <Route path="/activity" element={<ActivityLog />} />
        <Route path="/workflow/:slug" element={<WorkflowPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
