import { Navigate, Route, Routes } from "react-router-dom";
import Assistant from "../Assistant";
import BusinessRules from "../BusinessRules";
import { FacultyGate, FacultyProvider } from "./FacultyContext";
import CalendarPage from "../../components/calendar/CalendarPage";
import FacultyAvailabilityEditor from "./FacultyAvailabilityEditor";
import FacultyInvitationsPage from "./FacultyInvitationsPage";
import {
  FacultyAdviseesPage,
  FacultyClassesPage,
  FacultyDashboard,
  FacultyDefensesPage,
  FacultyPanelsPage,
  FacultySignaturesPage,
  FacultyVerdictsPage,
} from "./FacultyPages";

// Faculty portal routes. Mounted at /faculty-portal/* inside the shared Layout.
// /faculty-portal itself stays the landing page because the Google Calendar
// OAuth callback redirects to /faculty-portal?calendar=...
export function FacultyRoutes() {
  return (
    <FacultyGate>
      <Routes>
        <Route index element={<FacultyDashboard />} />
        <Route path="advisees" element={<FacultyAdviseesPage />} />
        <Route path="signatures" element={<FacultySignaturesPage />} />
        <Route path="panels" element={<FacultyPanelsPage />} />
        <Route path="defenses" element={<FacultyDefensesPage />} />
        <Route path="verdicts" element={<FacultyVerdictsPage />} />
        <Route path="classes" element={<FacultyClassesPage />} />
        <Route path="availability" element={<FacultyAvailabilityEditor />} />
        <Route path="invitations" element={<FacultyInvitationsPage />} />
        <Route
          path="calendar"
          element={<CalendarPage scope="faculty" title="My calendar" description="Defenses you sit on or advise, your advisees' deadlines, your availability and (when connected) your Google busy times." />}
        />
        <Route path="assistant" element={<Assistant policyOnly />} />
        <Route path="business-rules" element={<BusinessRules />} />
        <Route path="*" element={<Navigate to="/faculty-portal" replace />} />
      </Routes>
    </FacultyGate>
  );
}

export { FacultyProvider };
