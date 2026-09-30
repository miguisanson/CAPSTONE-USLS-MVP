import { createContext, useContext, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, Spinner } from "../../components/ui";
import { PortalNavProvider } from "../../components/portalNav";

const FacultyContext = createContext(null);

// One fetch of the faculty member's portal context, shared by every page so
// signing a paper or submitting a verdict refreshes the dashboard and sidebar.
export function FacultyProvider({ children }) {
  const { data, loading, error, refetch } = useApi(() => api.facultyPortalContext(), []);
  const counts = useMemo(
    () => ({
      pendingSignatures: (data?.advisees || []).reduce((sum, row) => sum + (row.pending_count || 0), 0),
      pendingVerdicts: (data?.panels || []).filter((panel) => panel.can_submit_verdict).length,
    }),
    [data],
  );
  const value = useMemo(() => ({ data, loading, error, refetch }), [data, loading, error, refetch]);
  return (
    <PortalNavProvider counts={counts} flags={null}>
      <FacultyContext.Provider value={value}>{children}</FacultyContext.Provider>
    </PortalNavProvider>
  );
}

export function useFaculty() {
  const value = useContext(FacultyContext);
  if (!value) throw new Error("useFaculty must be used inside FacultyProvider.");
  return value;
}

export function FacultyGate({ children }) {
  const { data, loading, error } = useFaculty();
  if (loading && !data) {
    return (
      <Card className="p-6">
        <Spinner label="Loading faculty portal..." />
      </Card>
    );
  }
  if (error && !data) {
    return (
      <Card className="p-6">
        <EmptyState icon={AlertTriangle} title="Could not load the faculty portal" hint={error} />
      </Card>
    );
  }
  if (!data) return null;
  return children;
}
