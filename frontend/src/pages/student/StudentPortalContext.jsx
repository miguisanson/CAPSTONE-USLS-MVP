import { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, Spinner } from "../../components/ui";
import { PortalNavProvider } from "../../components/portalNav";
import { StudentPortalSectionBoundary } from "./shared";

const StudentPortalContext = createContext(null);

// One fetch of the student's portal context, shared by every student page so
// moving between pages is instant and a save on one page refreshes the rest.
export function StudentPortalProvider({ children }) {
  const { data, loading, error, refetch } = useApi(() => api.studentPortalContext(), []);
  const counts = useMemo(
    () => ({ unreadMessages: (data?.workflow_messages || []).filter((message) => message.is_unread).length }),
    [data],
  );
  const flags = useMemo(() => ({ noPracticum: !data?.student?.program_has_practicum }), [data]);
  const value = useMemo(() => ({ data, loading, error, refetch }), [data, loading, error, refetch]);
  return (
    <PortalNavProvider counts={counts} flags={flags}>
      <StudentPortalContext.Provider value={value}>{children}</StudentPortalContext.Provider>
    </PortalNavProvider>
  );
}

export function useStudentPortal() {
  const value = useContext(StudentPortalContext);
  if (!value) throw new Error("useStudentPortal must be used inside StudentPortalProvider.");
  return value;
}

// Wraps every student route: shared loading / error states plus an error
// boundary so one broken page never takes the whole portal down.
export function StudentGate({ children }) {
  const { data, loading, error } = useStudentPortal();
  const location = useLocation();
  if (loading && !data) {
    return (
      <Card className="p-6">
        <Spinner label="Loading student portal..." />
      </Card>
    );
  }
  if (error && !data) {
    return (
      <Card className="p-6">
        <EmptyState icon={AlertTriangle} title="Could not load your student portal" hint={error} />
      </Card>
    );
  }
  if (!data?.student) return null;
  return <StudentPortalSectionBoundary view={location.pathname}>{children}</StudentPortalSectionBoundary>;
}
