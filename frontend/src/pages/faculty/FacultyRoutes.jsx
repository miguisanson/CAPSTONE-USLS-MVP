import { Navigate, Route, Routes } from "react-router-dom";
import { FacultyGate, FacultyProvider } from "./FacultyContext";
import {
  FacultyAdviseesPage,
  FacultyAvailabilityPage,
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
        <Route path="availability" element={<FacultyAvailabilityPage />} />
        <Route path="*" element={<Navigate to="/faculty-portal" replace />} />
      </Routes>
    </FacultyGate>
  );
}

export { FacultyProvider };
