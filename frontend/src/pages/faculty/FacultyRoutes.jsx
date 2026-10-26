import { Navigate, Route, Routes } from "react-router-dom";
import Assistant from "../Assistant";
import BusinessRules from "../BusinessRules";
import { FacultyGate, FacultyProvider, useFaculty } from "./FacultyContext";
import CalendarPage from "../../components/calendar/CalendarPage";
import FacultyAvailabilityEditor from "./FacultyAvailabilityEditor";
import { FacultyCalendarConnection } from "./FacultyCalendar";
import FacultyInvitationsPage from "./FacultyInvitationsPage";
import {
  FacultyAdviseesPage,
  FacultyClassesPage,
  CalendarNotice,
  FacultyDashboard,
  FacultyDefensesPage,
  FacultyPanelsPage,
  FacultySignaturesPage,
  FacultyVerdictsPage,
} from "./FacultyPages";

function FacultyCalendarScreen() {
  const { data, refetch } = useFaculty();
  return (
    <div className="space-y-5">
      <CalendarNotice />
      <CalendarPage
        scope="faculty"
        title="My Calendar"
        description="Defenses you sit on or advise, your advisees' deadlines, your availability and (when connected) your Google busy times."
        connectionPanel={<FacultyCalendarConnection calendar={data?.faculty?.calendar} onChanged={refetch} />}
      />
    </div>
  );
}

// Faculty portal routes. Mounted at /faculty-portal/* inside the shared Layout.
// /faculty-portal itself stays the landing page because the Google Calendar
// OAuth callback redirects to /faculty-portal/calendar?calendar=...
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
          element={<FacultyCalendarScreen />}
        />
        <Route path="assistant" element={<Assistant policyOnly />} />
        <Route path="business-rules" element={<BusinessRules />} />
        <Route path="*" element={<Navigate to="/faculty-portal" replace />} />
      </Routes>
    </FacultyGate>
  );
}

export { FacultyProvider };
