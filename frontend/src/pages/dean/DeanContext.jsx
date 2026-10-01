import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, Spinner } from "../../components/ui";
import { PortalNavProvider } from "../../components/portalNav";
import { DeanDecisionModal } from "./DeanParts";

// Approval "processes" as the Dean sees them. Several workflow types share a
// page (LOA, readmission and AWOL returns are all standing changes).
export const DEAN_PROCESSES = {
  "course-adjustments": { label: "Course Adjustments", types: [] },
  "leave-of-absence": { label: "Leave of Absence", types: ["leave-of-absence"] },
  readmission: { label: "Readmission", types: ["readmission"] },
  awol: { label: "AWOL & Residency", types: ["awol-return"] },
  withdrawal: { label: "Withdrawal Requests", types: ["withdrawal"] },
  practicum: { label: "Practicum Reports", types: ["practicum"] },
  graduation: { label: "Graduation Endorsement", types: ["graduation"] },
};

export function processOfType(type) {
  return Object.keys(DEAN_PROCESSES).find((key) => DEAN_PROCESSES[key].types.includes(type)) || null;
}

const DeanContext = createContext(null);

export function DeanProvider({ children }) {
  const { data, loading, error, refetch: refetchApprovals } = useApi(() => api.approvals(), []);
  // Adviser appointments waiting for the Dean's decision; a failed call counts as none.
  const { data: adviserData, refetch: refetchAdviser } = useApi(
    () => api.adviserAppointments({ scope: "open" }).catch(() => ({ appointments: [] })),
    [],
  );
  const refetch = () => {
    refetchAdviser();
    return refetchApprovals();
  };
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState({});
  const [template, setTemplate] = useState({});
  const [recipient, setRecipient] = useState({});
  const [visibility, setVisibility] = useState({});
  const [msg, setMsg] = useState("");
  const [actErr, setActErr] = useState("");
  const [pendingDecision, setPendingDecision] = useState(null);
  const keepFeedbackOnce = useRef(false);

  // Banners belong to the page where the action happened; clear them when the
  // Dean moves elsewhere (except right after a decision sends them back to a list).
  useEffect(() => {
    if (keepFeedbackOnce.current) {
      keepFeedbackOnce.current = false;
      return;
    }
    setMsg("");
    setActErr("");
  }, [location.pathname]);

  // The adviser queue is decided on its own page; refresh the sidebar number when the Dean moves around.
  const adviserFirstRun = useRef(true);
  useEffect(() => {
    if (adviserFirstRun.current) {
      adviserFirstRun.current = false;
      return;
    }
    refetchAdviser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Graduation rows only count while the student is eligible (same rule as before).
  const graduationEligibleItem = (item) => item.type !== "graduation" || item.eligibility?.eligible === true;
  const workflowPending = useMemo(() => (data?.workflow_pending || []).filter(graduationEligibleItem), [data]);
  const workflowRecent = useMemo(() => (data?.workflow_recent || []).filter(graduationEligibleItem), [data]);
  const workflowOverview = useMemo(() => (data?.workflow_overview || []).filter(graduationEligibleItem), [data]);
  const pendingPlans = useMemo(() => data?.pending || [], [data]);
  const recentPlans = useMemo(() => data?.recent || [], [data]);

  const pendingAdviser = useMemo(
    () => (adviserData?.appointments || []).filter((row) => (row.actions || []).includes("appoint")).length,
    [adviserData],
  );

  const counts = useMemo(() => {
    const byProcess = (key) => workflowPending.filter((item) => DEAN_PROCESSES[key].types.includes(item.type)).length;
    return {
      pendingPlans: pendingPlans.length,
      pendingLeaveOfAbsence: byProcess("leave-of-absence"),
      pendingReadmission: byProcess("readmission"),
      pendingAwol: byProcess("awol"),
      pendingWithdrawal: byProcess("withdrawal"),
      pendingPracticum: byProcess("practicum"),
      pendingGraduation: byProcess("graduation"),
      pendingAdviser,
      pendingTotal: pendingPlans.length + workflowPending.length + pendingAdviser,
    };
  }, [workflowPending, pendingPlans, pendingAdviser]);

  function findCase(type, id) {
    const key = String(id);
    return [...workflowPending, ...workflowOverview, ...workflowRecent].find((item) => item.type === type && String(item.id) === key) || null;
  }

  async function decidePlan(plan, decision) {
    setBusy(plan.id);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideApproval(plan.id, { decision, note: note[plan.id] || "" });
      setMsg(res.message);
      refetch();
    } catch (e) {
      setActErr(e.message);
    } finally {
      setBusy(0);
    }
  }

  function requestWorkflowDecision(item, decision) {
    const key = `${item.type}-${item.id}`;
    const selectedTemplate = template[key] || "";
    const customNote = note[key] || "";
    const combinedNote = [selectedTemplate !== "Other / Custom comment" ? selectedTemplate : "", customNote].filter(Boolean).join(" · ");
    if (["return", "deny"].includes(decision) && !combinedNote.trim()) {
      setActErr("Choose a reason or enter a comment before returning or denying the request.");
      return;
    }
    setActErr("");
    setPendingDecision({ item, decision, note: combinedNote });
  }

  async function confirmWorkflowDecision() {
    if (!pendingDecision) return;
    const { item, decision, note: decisionNote } = pendingDecision;
    const key = `${item.type}-${item.id}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const res = await api.decideWorkflowApproval(item.type, item.id, { decision, note: decisionNote });
      setMsg(res.message);
      await refetch();
      setPendingDecision(null);
      // After deciding from a case page, go back to that process's list.
      if (location.pathname.startsWith("/dean/case/")) {
        keepFeedbackOnce.current = true;
        navigate(`/dean/approvals/${processOfType(item.type) || ""}`.replace(/\/$/, ""));
      }
    } catch (e) {
      setActErr(e.message);
    } finally {
      setBusy(0);
    }
  }

  async function messageWorkflow(item) {
    const key = `${item.type}-${item.id}`;
    const selectedTemplate = template[key] || "";
    const customNote = (note[key] || "").trim();
    const messageTemplate = selectedTemplate || (customNote ? "Other / Custom comment" : "");
    if (!messageTemplate || (messageTemplate === "Other / Custom comment" && !customNote)) {
      setActErr("Choose a message template or enter a custom comment.");
      return;
    }
    setBusy(`message-${key}`);
    setMsg("");
    setActErr("");
    try {
      const res = await api.sendWorkflowMessage(item.type, {
        student_id: item.student.id,
        action_type: "note",
        recipient_role: recipient[key] || "Graduate School Staff",
        visibility: (recipient[key] || "Graduate School Staff") === "Student" ? "student_visible" : (visibility[key] || "internal"),
        template: messageTemplate,
        comment: customNote,
      });
      setMsg(res.message);
      await refetch();
    } catch (error) {
      setActErr(error.message || "Could not save the workflow comment.");
    } finally {
      setBusy(0);
    }
  }

  const value = {
    data, loading, error, refetch,
    workflowPending, workflowRecent, workflowOverview, pendingPlans, recentPlans,
    counts, findCase,
    busy, setBusy, msg, setMsg, actErr, setActErr,
    note, setNote, template, setTemplate, recipient, setRecipient, visibility, setVisibility,
    decidePlan, requestWorkflowDecision, messageWorkflow,
  };

  return (
    <PortalNavProvider counts={counts} flags={null}>
      <DeanContext.Provider value={value}>
        {children}
        {pendingDecision && (
          <DeanDecisionModal
            pending={pendingDecision}
            busy={busy === `${pendingDecision.item.type}-${pendingDecision.item.id}`}
            onClose={() => setPendingDecision(null)}
            onConfirm={confirmWorkflowDecision}
          />
        )}
      </DeanContext.Provider>
    </PortalNavProvider>
  );
}

export function useDean() {
  const value = useContext(DeanContext);
  if (!value) throw new Error("useDean must be used inside DeanProvider.");
  return value;
}

// Shared loading / error gate for Dean pages that need the approvals data.
export function DeanGate({ children }) {
  const { data, loading, error } = useDean();
  if (loading && !data) {
    return (
      <Card className="p-6">
        <Spinner label="Loading approvals…" />
      </Card>
    );
  }
  if (error && !data) {
    return (
      <Card className="p-6">
        <EmptyState icon={AlertTriangle} title="Could not load approvals" hint={error} />
      </Card>
    );
  }
  if (!data) return null;
  return children;
}

// Result / error banners shared by every Dean page.
export function DeanFeedback() {
  const { msg, actErr } = useDean();
  return (
    <>
      {msg && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {msg}
        </div>
      )}
      {actErr && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {actErr}
        </div>
      )}
    </>
  );
}
