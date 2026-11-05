import { Navigate, Route, Routes } from "react-router-dom";
import { DeanProvider } from "./DeanContext";
import { DeanCasePage, DeanDashboard, DeanProcessPage, DeanQueue } from "./DeanPages";
import { DeanGraduationPage } from "./DeanGraduationPage";
import { DeanAnalyticsPage, DeanAssistantPage, DeanGateReportsPage, DeanHistoryPage } from "./DeanReportPages";
import BusinessRules from "../BusinessRules";

// Dean portal routes. Mounted at /dean/* inside the shared Layout shell; the
// provider wraps the Layout (see App.jsx) so the sidebar can show pending counts.
export function DeanRoutes() {
  return (
    <Routes>
      <Route index element={<DeanDashboard />} />
      <Route path="approvals" element={<DeanQueue />} />
      <Route path="approvals/graduation" element={<DeanGraduationPage />} />
      {/* Adviser decisions now sit in the Approvals Queue; the defense calendar is part of the research flow. */}
      <Route path="adviser-appointments" element={<Navigate to="/dean/approvals" replace />} />
      <Route path="approvals/adviser" element={<Navigate to="/dean/approvals" replace />} />
      <Route path="calendar" element={<Navigate to="/dean/approvals" replace />} />
      <Route path="approvals/:process" element={<DeanProcessPage />} />
      <Route path="case/:type/:id" element={<DeanCasePage />} />
      <Route path="business-rules" element={<BusinessRules />} />
      <Route path="gate-reports" element={<DeanGateReportsPage />} />
      <Route path="analytics" element={<DeanAnalyticsPage />} />
      <Route path="activity" element={<DeanHistoryPage />} />
      <Route path="assistant" element={<DeanAssistantPage />} />
      <Route path="*" element={<Navigate to="/dean" replace />} />
    </Routes>
  );
}

export { DeanProvider };
