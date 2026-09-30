import { Navigate, Route, Routes } from "react-router-dom";
import { DeanProvider } from "./DeanContext";
import { DeanCasePage, DeanDashboard, DeanProcessPage, DeanQueue } from "./DeanPages";
import { DeanGraduationPage } from "./DeanGraduationPage";
import { DeanAnalyticsPage, DeanAssistantPage, DeanGateReportsPage, DeanHistoryPage } from "./DeanReportPages";

// Dean portal routes. Mounted at /dean/* inside the shared Layout shell; the
// provider wraps the Layout (see App.jsx) so the sidebar can show pending counts.
export function DeanRoutes() {
  return (
    <Routes>
      <Route index element={<DeanDashboard />} />
      <Route path="approvals" element={<DeanQueue />} />
      <Route path="approvals/graduation" element={<DeanGraduationPage />} />
      <Route path="approvals/:process" element={<DeanProcessPage />} />
      <Route path="case/:type/:id" element={<DeanCasePage />} />
      {/* NAV SLOT: a Business Rules page can be mounted here, e.g. <Route path="business-rules" ... /> */}
      <Route path="gate-reports" element={<DeanGateReportsPage />} />
      <Route path="analytics" element={<DeanAnalyticsPage />} />
      <Route path="activity" element={<DeanHistoryPage />} />
      <Route path="assistant" element={<DeanAssistantPage />} />
      <Route path="*" element={<Navigate to="/dean" replace />} />
    </Routes>
  );
}

export { DeanProvider };
