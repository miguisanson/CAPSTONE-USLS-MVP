import { createContext, useContext, useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, Spinner } from "../../components/ui/index.js";
import { PortalNavProvider } from "../../components/portalNav";
import { formatDay as formatDayShared, formatTimeRange as formatTimeRangeShared } from "../../lib/format";

const FacultyContext = createContext(null);

// Dates and times use the one app-wide style from lib/format (I-207); only the "not set" wording is local.
export function formatDay(value) {
  return value ? formatDayShared(value) : "Not set";
}

export function formatTimeRange(start, end) {
  return start ? formatTimeRangeShared(start, end) : "Time not set";
}

// One fetch of the faculty member's portal context, shared by every page so
// signing a paper or submitting a verdict refreshes the dashboard and sidebar.
export function FacultyProvider({ children }) {
  const { data, loading, error, refetch } = useApi(() => api.facultyPortalContext(), []);
  const counts = useMemo(
    () => ({
      pendingSignatures: (data?.advisees || []).reduce((sum, row) => sum + (row.pending_count || 0), 0),
      pendingVerdicts: (data?.panels || []).filter((panel) => panel.can_submit_verdict).length,
      pendingInvitations: data?.counts?.pending_invitations || 0,
      pendingAdviserRequests: data?.counts?.pending_adviser_requests || 0,
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
      <Card>
        <Spinner label="Loading faculty portal…" />
      </Card>
    );
  }
  if (error && !data) {
    return (
      <Card>
        <EmptyState icon={AlertTriangle} title="Could not load the faculty portal" hint={error} />
      </Card>
    );
  }
  if (!data) return null;
  return children;
}
