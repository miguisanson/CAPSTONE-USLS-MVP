import { Navigate, Route, Routes } from "react-router-dom";
import { StudentGate, StudentPortalProvider } from "./StudentPortalContext";
import StudentOverview from "./StudentOverview";
import StudentProgress from "./StudentProgress";
import { StudentDefensePage, StudentRequestCenter, StudentRequestPage, StudentResearchPage } from "./StudentRequestPages";
import {
  StudentActivityPage,
  StudentAssistantPage,
  StudentDocumentsPage,
  StudentEnrollmentPage,
  StudentMessagesPage,
  StudentProfilePage,
} from "./StudentSupportPages";

// Student portal routes. Mounted at /student/* inside the shared Layout shell.
// The provider must wrap the Layout (see App.jsx) so the sidebar can show the
// unread-message badge from the same data the pages use.
export function StudentRoutes() {
  return (
    <StudentGate>
      <Routes>
        <Route index element={<StudentOverview />} />
        <Route path="progress" element={<StudentProgress />} />
        <Route path="enrollment" element={<StudentEnrollmentPage />} />
        <Route path="research" element={<StudentResearchPage />} />
        <Route path="defense-schedule" element={<StudentDefensePage />} />
        <Route path="practicum" element={<StudentRequestPage id="practicum" />} />
        <Route path="graduation" element={<StudentRequestPage id="graduation" />} />
        <Route path="requests" element={<StudentRequestCenter />} />
        <Route path="requests/leave-of-absence" element={<StudentRequestPage id="loa" />} />
        <Route path="requests/readmission" element={<StudentRequestPage id="readmission" />} />
        <Route path="requests/awol-return" element={<StudentRequestPage id="awol" />} />
        <Route path="requests/withdrawal" element={<StudentRequestPage id="withdrawal" />} />
        <Route path="messages" element={<StudentMessagesPage />} />
        <Route path="documents" element={<StudentDocumentsPage />} />
        <Route path="activity" element={<StudentActivityPage />} />
        <Route path="assistant" element={<StudentAssistantPage />} />
        <Route path="profile" element={<StudentProfilePage />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    </StudentGate>
  );
}

export { StudentPortalProvider };
