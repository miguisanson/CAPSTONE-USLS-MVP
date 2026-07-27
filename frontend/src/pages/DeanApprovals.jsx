import { useEffect, useMemo, useRef, useState } from "react";
import { Gavel, LogOut, CheckCircle2, RotateCcw, AlertTriangle, Inbox, Clock, LayoutDashboard, Briefcase, GraduationCap, CalendarOff, BarChart3, Download, Search, SlidersHorizontal, ArrowUpRight, Eye, MessageSquare, X, CheckSquare, Users, Printer } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { useAuth } from "../auth";
import { Card, Spinner, EmptyState, StatusBadge } from "../components/ui";
import { formatDate, formatDateTime } from "../lib/format";
import RoleSidebar from "../components/RoleSidebar";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../components/WorkflowTimeline";
import WorkflowDiscussion from "../components/WorkflowDiscussion";
import HistoryDisclosure from "../components/HistoryDisclosure";
import ExportFollowUpModal from "../components/ExportFollowUpModal";
import { printDataTable } from "../lib/print";
import { GraduationRoster } from "./WorkflowPage";

const DEAN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Lifecycle Workflows",
    items: [
      { id: "practicum", number: 7, label: "Practicum Reports", icon: Briefcase },
      { id: "graduation", number: 8, label: "Graduation Review", icon: GraduationCap },
    ],
  },
  {
    label: "Standalone Processes",
    items: [
      { id: "leave", label: "LOA / Readmission / AWOL", icon: CalendarOff },
      { id: "withdrawal", label: "Withdrawal Requests", icon: LogOut },
    ],
  },
  {
    label: "Monitoring & Support",
    items: [
      { id: "reports", label: "Reports / Analytics", icon: BarChart3 },
    ],
  },
];

const CLARIFICATION_TEMPLATES = [
  "Please upload the correct document.",
  "The submitted file is unreadable. Please re-upload a clearer copy.",
  "Please complete the missing required fields.",
  "The document needs the proper signature before approval.",
  "Please clarify the information entered in this section.",
  "Returned for revision. Please review the comments and resubmit.",
  "Forwarding this request for dean review.",
  "Sending this back to the previous stage for correction.",
  "Other / Custom comment",
];

function deanItemDate(item) {
  return item.last_activity_at || item.submitted_at || item.record?.updated_at || "";
}

function deanDateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

function sortDeanItems(items, sort) {
  return [...items].sort((left, right) => {
    if (sort === "student") return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    const leftDate = new Date(deanItemDate(left) || 0).getTime();
    const rightDate = new Date(deanItemDate(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

function graduationBatchLabel(item, fallback = "No batch assigned") {
  return item.batch_name || item.record?.batch_name || fallback;
}

function groupGraduationItemsByBatch(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = graduationBatchLabel(item);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });
  return [...groups.entries()].map(([label, rows]) => ({ label, rows }));
}

function graduationBatchExportPayload(batch) {
  return {
    batchLabel: batch.label,
    reviewWindow: "",
    endorsementIds: batch.rows.map((item) => item.id),
    count: batch.rows.length,
    rows: batch.rows,
  };
}

function printGraduationBatch(batch) {
  printDataTable({
    title: `Graduate Endorsement - ${batch.label}`,
    subtitle: "Dean-approved Graduate School endorsement list",
    columns: ["Student ID", "Student name", "Program", "Coursework", "Thesis / research", "Practicum", "Eligibility", "Endorsement status"],
    rows: batch.rows.map((item) => [
      item.student.student_number,
      item.student.name,
      item.student.program_code,
      "Completed",
      "Completed",
      item.eligibility?.practicum_status === "Not Required" ? "Not required" : "Completed",
      "Eligible for graduation",
      item.status,
    ]),
  });
}

function graduationRegistrarStatus(item) {
  return item.record?.registrar_status || item.registrar_status || "";
}

function graduationBatchReadyToSend(batch, exportedBatchLabels) {
  return exportedBatchLabels.has(batch.label) || batch.rows.every((item) => graduationRegistrarStatus(item) === "Exported - Ready to Send");
}

function isReadyForDeanReview(item) {
  const workflowStatus = item.workflow_status || item.status;
  return (
    (item.type === "practicum" && workflowStatus === "Report Sent to Dean")
    || (item.type === "withdrawal" && workflowStatus === "Dean Review")
    || (item.type === "graduation" && item.status === "Ready for Dean Review")
  );
}

const DEAN_GRADUATION_BATCH_STAGES = [
  {
    label: "Compile graduation list",
    detail: "GS Staff created the candidate batch.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Academic Coordinator checks course completion",
    detail: "Coursework completion was checked before Dean review.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Research Coordinator validates research requirements",
    detail: "Research completion evidence was validated before endorsement.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "GS Staff prepares endorsement list",
    detail: "The endorsement list was prepared or revised for Dean action.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Dean reviews endorsement list",
    detail: "Dean approves the batch or returns it for revision.",
    currentStatuses: ["Ready for Dean Review"],
    completeStatuses: ["Dean Approved"],
    attentionStatuses: ["Returned for Revision"],
  },
  {
    label: "Export endorsed list",
    detail: "Dean-approved candidates are available as a CSV download for manual email to the Registrar.",
    currentStatuses: ["Dean Approved"],
    completeStatuses: ["Dean Approved"],
    attentionStatuses: ["Returned for Revision"],
  },
];

function deanGraduationStageState(stage, batch) {
  const statuses = batch.rows.map((item) => item.status);
  const hasAttention = statuses.some((status) => stage.attentionStatuses?.includes(status));
  const allComplete = statuses.length > 0 && statuses.every((status) => stage.completeStatuses?.includes(status));
  const hasCurrent = statuses.some((status) => stage.currentStatuses?.includes(status));
  if (hasAttention) return "Needs action";
  if (allComplete) return "Complete";
  if (hasCurrent) return "Current";
  return "Pending";
}

function deanGraduationStageChecks(batch) {
  return DEAN_GRADUATION_BATCH_STAGES.map((stage, index) => ({
    ...stage,
    number: index + 1,
    state: deanGraduationStageState(stage, batch),
  }));
}

function deanGraduationCurrentStage(batch) {
  const stages = deanGraduationStageChecks(batch);
  return stages.find((stage) => ["Needs action", "Current", "Pending"].includes(stage.state)) || stages[stages.length - 1];
}

function deanGraduationBatchActionLabel(action) {
  return action === "return" ? "Return endorsement list for revision" : "Approve endorsement list";
}

function deanGraduationRequirementTone(item) {
  if (item?.passed === true || item?.complete === true || item?.status === "Passed") return "complete";
  return "missing";
}

function deanGraduationRequirementClasses(tone) {
  return tone === "complete"
    ? {
      card: "border-emerald-200 bg-emerald-50 text-emerald-900",
      icon: "bg-emerald-600 text-white",
      text: "text-emerald-800",
      muted: "text-emerald-700",
    }
    : {
      card: "border-red-200 bg-red-50 text-red-900",
      icon: "bg-red-600 text-white",
      text: "text-red-800",
      muted: "text-red-700",
    };
}

function deanGraduationRequirementDetailLines(item) {
  const actual = item.actual_value ?? item.actual ?? item.status ?? "Pending";
  const required = item.required_value ?? item.required;
  return [
    String(actual),
    required != null ? `Required: ${String(required)}` : "",
    item.note || "",
  ].filter(Boolean);
}

function deanGraduationFallbackChecklist(item) {
  const eligibility = item.eligibility || {};
  return [
    {
      key: "coursework",
      label: "Coursework",
      actual_value: eligibility.coursework_status || "Pending",
      status: eligibility.coursework_status === "Complete" ? "Passed" : eligibility.coursework_status || "Not met",
      passed: eligibility.coursework_status === "Complete",
      note: eligibility.missing_coursework?.length ? `Missing: ${eligibility.missing_coursework.slice(0, 2).join(", ")}${eligibility.missing_coursework.length > 2 ? "..." : ""}` : "",
    },
    {
      key: "research",
      label: "Thesis / research",
      actual_value: eligibility.research_status || "Pending",
      status: eligibility.research_status === "Complete" ? "Passed" : eligibility.research_status || "Not met",
      passed: eligibility.research_status === "Complete",
      note: eligibility.missing_research_requirements?.length ? `Missing: ${eligibility.missing_research_requirements.slice(0, 2).join(", ")}${eligibility.missing_research_requirements.length > 2 ? "..." : ""}` : "",
    },
    {
      key: "practicum",
      label: "Practicum",
      actual_value: eligibility.practicum_status || "Pending",
      status: ["Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"].includes(eligibility.practicum_status) ? "Passed" : eligibility.practicum_status || "Not met",
      passed: ["Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"].includes(eligibility.practicum_status),
      note: eligibility.missing_practicum_requirement || "",
    },
  ];
}

function DeanGraduationRequirementBoxes({ item }) {
  const eligibility = item.eligibility || {};
  const items = ["Coursework completed", "Thesis / research completed", eligibility.practicum_status === "Not Required" ? "Practicum not required" : "Practicum completed", "Eligible for graduation"];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((label) => <div key={label} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-3.5 w-3.5" /></span><p className="text-xs font-semibold">{label}</p></div>)}
      </div>
  );
}

function DeanGraduationBatchStudentList({ rows }) {
  return (
    <ul className="space-y-3">
      {rows.map((item) => (
        <li key={item.student.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.student.name}</p>
              <p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code}</p>
            </div>
            <StatusBadge value={item.status || item.workflow_status} dot={false} />
          </div>
          <DeanGraduationRequirementBoxes item={item} />
        </li>
      ))}
    </ul>
  );
}

function sortSelectedDeanItems(items, selectedIds) {
  if (!selectedIds?.size) return items;
  return [...items].sort((left, right) => {
    const leftSelected = selectedIds.has(left.student?.id);
    const rightSelected = selectedIds.has(right.student?.id);
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    return 0;
  });
}

function DeanGraduationWorkspace() {
  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext("graduation"),
    [],
  );
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  if (loading && !context) return <Card className="p-6"><Spinner label="Loading graduation workflow…" /></Card>;
  if (error && !context) return <Card className="p-6"><EmptyState icon={AlertTriangle} title="Could not load graduation workflow" hint={error} /></Card>;

  return (
    <Card className="p-6">
      <GraduationRoster
        context={context || { roster: [] }}
        submit={async () => false}
        submitting={false}
        refreshing={loading}
        result={result}
        submitError={submitError}
        clearSubmitFeedback={() => {
          setResult(null);
          setSubmitError("");
        }}
        refetch={refetch}
        accountRole="dean"
      />
    </Card>
  );
}

export default function DeanApprovals() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.approvals(), []);
  const [busy, setBusy] = useState(0);
  const [note, setNote] = useState({});
  const [template, setTemplate] = useState({});
  const [recipient, setRecipient] = useState({});
  const [visibility, setVisibility] = useState({});
  const [msg, setMsg] = useState("");
  const [actErr, setActErr] = useState("");
  const [view, setView] = useState("overview");
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [pendingDecision, setPendingDecision] = useState(null);
  const [exportedGraduationBatches, setExportedGraduationBatches] = useState(() => new Set());
  const [exportNotice, setExportNotice] = useState(null);
  const [selectedGraduationIds, setSelectedGraduationIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [stageBatch, setStageBatch] = useState(null);
  const [expandedGraduationBatches, setExpandedGraduationBatches] = useState(() => new Set());
  const [filters, setFilters] = useState({ query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" });
  const graduationEligibleItem = (item) => item.type !== "graduation" || item.eligibility?.eligible === true;
  const workflowPending = (data?.workflow_pending || []).filter(graduationEligibleItem);
  const workflowRecent = (data?.workflow_recent || []).filter(graduationEligibleItem);
  const workflowOverview = (data?.workflow_overview || []).filter(graduationEligibleItem);
  const isStandingChange = (item) => ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  const belongsToView = (item) => view === "overview" || (view === "leave" ? isStandingChange(item) : item.type === view);
  const baseWorkflowPending = workflowPending.filter(belongsToView);
  const baseWorkflowRecent = (view === "overview" ? workflowRecent : workflowOverview).filter(belongsToView);
  const matchesFilters = (item) => {
    const program = item.student?.program_code || item.program_code || "";
    const text = `${item.title || ""} ${item.subtitle || ""} ${item.student?.name || ""} ${item.student?.student_number || ""} ${program} ${graduationBatchLabel(item, "")}`.toLowerCase();
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (!filters.program || program === filters.program)
      && (!filters.status || item.status === filters.status || item.workflow_status === filters.status)
      && (view === "graduation" || deanDateMatches(deanItemDate(item), filters.dateFrom, filters.dateTo));
  };
  const workflowSort = view === "graduation" ? "student" : filters.sort;
  const visibleWorkflowPending = sortDeanItems(baseWorkflowPending.filter(matchesFilters), workflowSort);
  const visibleWorkflowRecent = sortDeanItems(baseWorkflowRecent.filter(matchesFilters), workflowSort);
  const visibleWorkflowOverview = sortDeanItems(workflowOverview.filter(belongsToView).filter(matchesFilters), workflowSort);
  const boardWorkflowRows = sortSelectedDeanItems(visibleWorkflowOverview.filter((item) => !isStandingChange(item)), selectedGraduationIds);
  const pendingPlans = (data?.pending || []).filter(matchesFilters);
  const recentPlans = (data?.recent || []).filter(matchesFilters);
  const programs = useMemo(() => [...new Set([
    ...(data?.pending || []).map((item) => item.program_code),
    ...(data?.recent || []).map((item) => item.program_code),
    ...workflowOverview.map((item) => item.student?.program_code),
  ].filter(Boolean))].sort(), [data, workflowOverview]);
  const statuses = useMemo(() => [...new Set([
    ...(view === "overview" ? [...(data?.pending || []), ...workflowOverview] : workflowOverview.filter(belongsToView)).flatMap((item) => [item.status, item.workflow_status]),
  ].filter(Boolean))].sort(), [data, workflowOverview, view]);
  const approvedGraduation = workflowOverview.filter((item) => item.type === "graduation" && item.status === "Dean Approved" && matchesFilters(item));
  const readyGraduation = visibleWorkflowOverview.filter((item) => item.type === "graduation" && item.status === "Ready for Dean Review");
  const selectedGraduation = sortSelectedDeanItems(workflowOverview.filter((item) => selectedGraduationIds.has(item.student?.id)), selectedGraduationIds);
  const readyGraduationBatches = groupGraduationItemsByBatch(readyGraduation);
  const approvedGraduationBatches = groupGraduationItemsByBatch(approvedGraduation);

  useEffect(() => {
    setFilters((current) => ({ ...current, status: "" }));
    setSelectedGraduationIds(new Set());
    setExpandedGraduationBatches(new Set());
  }, [view]);

  function toggleGraduationBatchStudents(label) {
    setExpandedGraduationBatches((current) => {
      const next = new Set(current);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  async function decide(plan, decision) {
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
      setSelectedWorkflow(null);
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
      setSelectedWorkflow(null);
    } catch (error) {
      setActErr(error.message || "Could not save the workflow comment.");
    } finally {
      setBusy(0);
    }
  }

  async function exportApproved({ reviewWindow = "", endorsementIds = [], batchLabel = "Selected approved candidates" }) {
    const key = `export-${batchLabel || reviewWindow || "all"}`;
    setBusy(key);
    setMsg("");
    setActErr("");
    try {
      const result = await api.exportGraduationCsv(reviewWindow, endorsementIds);
      setExportedGraduationBatches((current) => new Set(current).add(batchLabel));
      setExportNotice({ filename: result.filename, batchLabel });
      setMsg(`${batchLabel} exported as ${result.filename}. The Dean must email the file to the Registrar and wait for acknowledgement.`);
      await refetch();
    } catch (error) {
      setActErr(error.message || "Could not export the endorsed list.");
    } finally {
      setBusy(0);
    }
  }

  function toggleGraduation(studentId) {
    setSelectedGraduationIds((current) => {
      const next = new Set(current);
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }

  async function batchSaved(result) {
    const skipped = result.skipped?.length || 0;
    setMsg(`${result.message}${skipped ? ` Review ${skipped} skipped candidate${skipped === 1 ? "" : "s"} before retrying.` : ""}`);
    setSelectedGraduationIds(new Set());
    setBatchOpen(false);
    await refetch();
  }

  if (view === "graduation") {
    return (
      <div className="min-h-screen bg-canvas lg:flex">
        <RoleSidebar roleLabel="Dean Portal" groups={DEAN_NAV_GROUPS} active={view} onChange={setView} />
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white"><Gavel className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-display text-[15px] font-semibold text-ink">Dean · Graduation Review</p>
              <p className="text-[11px] text-slate-400">{user?.full_name}</p>
            </div>
            <button type="button" onClick={logout} className="btn-ghost cursor-pointer"><LogOut className="h-4 w-4" /> Sign out</button>
          </header>
          <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
            <DeanGraduationWorkspace />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar roleLabel="Dean Portal" groups={DEAN_NAV_GROUPS} active={view} onChange={setView} />
      <div className="min-w-0 flex-1">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white">
          <Gavel className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <p className="font-display text-[15px] font-semibold text-ink">Dean · Approvals</p>
          <p className="text-[11px] text-slate-400">{user?.full_name}</p>
        </div>
        <button type="button" onClick={logout} className="btn-ghost">
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto w-full max-w-[1600px] px-4 py-6 lg:px-8">
        <div className="mb-5">
          <h1 className="font-display text-2xl font-semibold text-ink">Items awaiting your approval</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review what the Graduate School submitted, then approve or return it. Your decision is recorded against your account.
          </p>
        </div>

        <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} showAdvanced={view !== "graduation"} />
        {(view === "overview" || view === "graduation") && readyGraduation.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
            <span className="mr-auto text-sm font-semibold text-slate-700">{selectedGraduationIds.size} graduation candidate{selectedGraduationIds.size === 1 ? "" : "s"} selected</span>
            <button type="button" onClick={() => setSelectedGraduationIds(new Set(readyGraduation.map((item) => item.student.id)))} className="btn-ghost cursor-pointer px-3 py-2">Select all ready</button>
            {selectedGraduationIds.size > 0 && <button type="button" onClick={() => setSelectedGraduationIds(new Set())} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
            <button type="button" disabled={!selectedGraduationIds.size} onClick={() => setBatchOpen(true)} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> Apply Dean group action</button>
          </div>
        )}
        {(view === "overview" || view === "graduation") && selectedGraduation.length > 0 && (
          <div className="mb-4 rounded-xl border border-brand-100 bg-brand-50/40 p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected graduation candidates</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedGraduation.map((item) => (
                <span key={item.student.id} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 ring-1 ring-brand-100">
                  {item.student.name} · {item.student.student_number} · {graduationBatchLabel(item)}
                </span>
              ))}
            </div>
          </div>
        )}
        {(view === "overview" || view === "graduation") && readyGraduationBatches.length > 0 && (
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-ink">Ready graduation batches</p>
                <p className="text-xs text-slate-500">Select or process a whole batch while still seeing every student in it.</p>
              </div>
              <StatusBadge value={`${readyGraduationBatches.length} batch${readyGraduationBatches.length === 1 ? "" : "es"}`} dot={false} />
            </div>
            <div className="space-y-2">
              {readyGraduationBatches.map((batch) => {
                const currentStage = deanGraduationCurrentStage(batch);
                const names = batch.rows.map((item) => item.student.name).slice(0, 4).join(", ");
                const hiddenCount = batch.rows.length - Math.min(batch.rows.length, 4);
                const expanded = expandedGraduationBatches.has(batch.label);
                return (
                  <div
                    key={batch.label}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", `graduation-batch:${batch.label}`);
                    }}
                    className="cursor-grab rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 transition-colors hover:border-emerald-500 active:cursor-grabbing"
                  >
                    <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(230px,0.95fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                        <p className="text-xs text-slate-500">{batch.rows.length} candidate{batch.rows.length === 1 ? "" : "s"}</p>
                        <span className="mt-1 inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span>
                      </div>
                      <p className="truncate text-xs text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                        <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                        <button type="button" onClick={() => setStageBatch(batch)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${batch.label}`}><Eye className="h-4 w-4" /></button>
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                        <button type="button" onClick={() => toggleGraduationBatchStudents(batch.label)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>
                        <button type="button" onClick={() => printGraduationBatch(batch)} className="btn-ghost cursor-pointer px-2.5 py-1"><Printer className="h-4 w-4" /> Print endorsement</button>
                        <button type="button" onClick={() => setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id)))} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>
                        <button type="button" onClick={() => { setSelectedGraduationIds(new Set(batch.rows.map((item) => item.student.id))); setBatchOpen(true); }} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left"><CheckSquare className="h-4 w-4 shrink-0" /> Review endorsement list</button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-2 border-t border-slate-100 pt-2">
                        <DeanGraduationBatchStudentList rows={batch.rows} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {boardWorkflowRows.length > 0 && (
          <DeanWorkflowBoard rows={boardWorkflowRows} onOpen={setSelectedWorkflow} selectedIds={selectedGraduationIds} onToggle={toggleGraduation} />
        )}
        {approvedGraduationBatches.length > 0 && (view === "overview" || view === "graduation") && (
          <div className="mb-5 rounded-xl border border-emerald-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-display text-lg font-semibold text-ink">Approved graduation batches</p>
                <p className="text-xs text-slate-500">Export the Dean-approved list, then email it to the Registrar and wait for acknowledgement.</p>
              </div>
              <StatusBadge value={`${approvedGraduation.length} approved`} dot={false} />
            </div>
            <div className="space-y-2">
              {approvedGraduationBatches.map((batch) => {
                const payload = graduationBatchExportPayload(batch);
                const currentStage = deanGraduationCurrentStage(batch);
                const names = batch.rows.map((item) => item.student.name).slice(0, 4).join(", ");
                const hiddenCount = batch.rows.length - Math.min(batch.rows.length, 4);
                const expanded = expandedGraduationBatches.has(batch.label);
                const readyToSend = graduationBatchReadyToSend(batch, exportedGraduationBatches);
                const exportBusy = busy === `export-${batch.label}`;
                return (
                  <div key={`approved-${batch.label}`} className="rounded-xl border border-emerald-200 bg-emerald-50/40 px-3 py-1.5">
                    <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(320px,1.25fr)] lg:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{batch.label}</p>
                        <p className="text-xs text-slate-500">{batch.rows.length} approved candidate{batch.rows.length === 1 ? "" : "s"}</p>
                      </div>
                      <p className="truncate text-xs text-slate-600"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                        <StatusBadge value={readyToSend ? "Exported" : `Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                        <button type="button" onClick={() => setStageBatch(batch)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${batch.label}`}><Eye className="h-4 w-4" /></button>
                      </div>
                      <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                        <button type="button" onClick={() => toggleGraduationBatchStudents(batch.label)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>
                        <button type="button" disabled={exportBusy} onClick={() => exportApproved(payload)} className="btn min-w-0 cursor-pointer whitespace-normal bg-emerald-600 px-2.5 py-1 text-left text-white hover:bg-emerald-700"><Download className="h-4 w-4 shrink-0" /> {exportBusy ? "Exporting..." : readyToSend ? "Export again" : "Export approved list"}</button>
                      </div>
                    </div>
                    {expanded && (
                      <div className="mt-2 border-t border-emerald-100 pt-2">
                        <DeanGraduationBatchStudentList rows={batch.rows} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {msg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {msg}
          </div>
        )}
        {actErr && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{actErr}</div>
        )}

        {loading ? (
          <Spinner label="Loading approvals…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load approvals" hint={error} />
        ) : (
          <>
            {(view !== "overview" || pendingPlans.length === 0) && visibleWorkflowPending.length === 0 ? (
              <Card className="p-6">
                <EmptyState icon={Inbox} title="Nothing to review in this section" hint={view === "leave" ? "LOA and readmission reviews will appear here when routed to the Dean." : view === "reports" ? "No report items are awaiting a Dean decision." : "Submitted items for this role will appear here."} />
              </Card>
            ) : (
              <div className="space-y-4">
                {view === "overview" && pendingPlans.map((plan) => {
                  const offered = plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested");
                  return (
                    <Card key={plan.id} className="p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h2 className="font-display text-lg font-semibold text-ink">
                            Course offerings · {plan.program_code}
                          </h2>
                          <p className="text-sm text-slate-500">
                            {plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}
                          </p>
                        </div>
                        <StatusBadge value={plan.status} dot={false} />
                      </div>

                      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                              <th className="px-4 py-2">Subject</th>
                              <th className="px-3 py-2">Demand</th>
                              <th className="px-3 py-2">Sections</th>
                              <th className="px-3 py-2">Decision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {plan.offerings.map((o) => (
                              <tr key={o.id} className="border-b border-slate-50">
                                <td className="px-4 py-2">
                                  <span className="font-semibold text-ink">{o.code}</span>
                                  <span className="ml-1 text-slate-500">{o.title}</span>
                                </td>
                                <td className="px-3 py-2 text-slate-600">{o.demand_count}</td>
                                <td className="px-3 py-2 text-slate-600">{o.section_count}</td>
                                <td className="px-3 py-2"><StatusBadge value={o.status} dot={false} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <input
                        value={note[plan.id] || ""}
                        onChange={(e) => setNote((n) => ({ ...n, [plan.id]: e.target.value }))}
                        placeholder="Optional note to the Graduate School…"
                        aria-label={`Optional decision note for ${plan.program_code} ${plan.term_label}`}
                        className="field-input mt-3"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "approve")} className="btn-primary">
                          <CheckCircle2 className="h-4 w-4" /> Approve
                        </button>
                        <button type="button" disabled={busy === plan.id} onClick={() => decide(plan, "return")} className="btn-ghost">
                          <RotateCcw className="h-4 w-4" /> Return for revision
                        </button>
                      </div>
                    </Card>
                  );
                })}
                {visibleWorkflowPending.map((item) => (
                  <WorkflowApprovalCard
                    key={`${item.type}-${item.id}`}
                    item={item}
                    note={note}
                    setNote={setNote}
                    template={template}
                    setTemplate={setTemplate}
                    recipient={recipient}
                    setRecipient={setRecipient}
                    visibility={visibility}
                    setVisibility={setVisibility}
                    busy={busy}
                    onDecide={requestWorkflowDecision}
                    onMessage={messageWorkflow}
                  />
                ))}
              </div>
            )}

            {view === "overview" && recentPlans.length > 0 && (
              <Card className="mt-6 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Recent decisions
                </p>
                <ul className="divide-y divide-slate-100">
                  {recentPlans.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-700">
                        {p.program_code} · {p.term_label}
                        {p.approved_by && <span className="text-slate-400"> · by {p.approved_by}</span>}
                      </span>
                      <StatusBadge value={p.status} dot={false} />
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            {visibleWorkflowRecent.length > 0 && (
              <Card className="mt-6 p-5">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
                  <Clock className="h-3.5 w-3.5" /> Recent workflow decisions
                </p>
                <ul className="divide-y divide-slate-100">
                  {visibleWorkflowRecent.map((item) => (
                    <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{item.title}</span>
                      <span className="flex items-center gap-2"><StatusBadge value={item.status} dot={false} /></span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </>
        )}
      </main>
      {selectedWorkflow && (
        <DeanDialog id={`dean-workflow-${selectedWorkflow.type}-${selectedWorkflow.id}`} title={selectedWorkflow.title} subtitle="Request details, files, messages, history, and Dean actions" onClose={() => setSelectedWorkflow(null)}>
            <WorkflowApprovalCard
              item={selectedWorkflow}
              note={note}
              setNote={setNote}
              template={template}
              setTemplate={setTemplate}
              recipient={recipient}
              setRecipient={setRecipient}
              visibility={visibility}
              setVisibility={setVisibility}
              busy={busy}
              onDecide={requestWorkflowDecision}
              onMessage={messageWorkflow}
            />
        </DeanDialog>
      )}
      {pendingDecision && <DeanDecisionModal pending={pendingDecision} busy={busy === `${pendingDecision.item.type}-${pendingDecision.item.id}`} onClose={() => setPendingDecision(null)} onConfirm={confirmWorkflowDecision} />}
      {batchOpen && selectedGraduation.length > 0 && <DeanGraduationBatchModal rows={selectedGraduation} onClose={() => setBatchOpen(false)} onSaved={batchSaved} />}
      {stageBatch && <DeanGraduationStageModal batch={stageBatch} onClose={() => setStageBatch(null)} />}
      {exportNotice && (
        <ExportFollowUpModal
          id="dean-graduation-export-follow-up"
          title="Graduation CSV export complete"
          filename={exportNotice.filename}
          actorLabel="The Dean"
          fileLabel="endorsed graduation list"
          onClose={() => setExportNotice(null)}
        />
      )}
      </div>
    </div>
  );
}

function DeanDialog({ id, title, subtitle, onClose, children, footer = null, size = "default" }) {
  const closeRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const widthClass = size === "wide" ? "max-w-[96rem]" : "max-w-4xl";
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function keydown(event) {
      const dialog = closeRef.current?.closest('[role="dialog"]');
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (dialog && dialogs[dialogs.length - 1] !== dialog) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [id]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} className={`flex max-h-[90vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}>
        <header className="flex items-start gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1"><h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">{title}</h2><p id={`${id}-description`} className="mt-1 text-sm text-slate-500">{subtitle}</p></div>
          <button ref={closeRef} type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 focus:ring-2 focus:ring-brand-500" aria-label="Close dialog"><X className="h-4 w-4" /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><div className="w-full">{children}</div></div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">{footer}</footer>}
      </section>
    </div>
  );
}

function DeanGraduationStageModal({ batch, onClose }) {
  const stages = deanGraduationStageChecks(batch);
  const currentStage = deanGraduationCurrentStage(batch);
  const modalId = `dean-graduation-stage-${String(batch.label).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  return (
    <DeanDialog
      id={modalId}
      title={`Graduation stage check for ${batch.label}`}
      subtitle={`${batch.rows.length} candidate${batch.rows.length === 1 ? "" : "s"} · Step ${currentStage.number}: ${currentStage.label}`}
      onClose={onClose}
      size="wide"
    >
      <div className="w-full max-w-none rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-ink">Stage check</p>
            <p className="text-xs text-slate-500">Follow where this batch is in the graduation endorsement process.</p>
          </div>
          <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
        </div>
        <ol className="mt-3 grid w-full grid-cols-1 gap-2 2xl:grid-cols-2">
          {stages.map((stage) => (
            <li key={stage.label} className="flex w-full max-w-none gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stage.state === "Complete" ? "bg-brand-600 text-white" : stage.state === "Current" ? "bg-amber-100 text-amber-800" : stage.state === "Needs action" ? "bg-red-100 text-red-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{stage.number}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                  <StatusBadge value={stage.state} dot={false} />
                </div>
                <p className="mt-1 text-xs text-slate-500">{stage.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </DeanDialog>
  );
}

function DeanDecisionModal({ pending, busy, onClose, onConfirm }) {
  const { item, decision, note } = pending;
  const label = decision === "approve" || decision === "review" ? "Approve current stage" : decision === "deny" ? "Deny request" : "Return for revision";
  return (
    <DeanDialog
      id={`dean-confirm-${item.type}-${item.id}`}
      title={`Confirm: ${label}`}
      subtitle={`${item.student?.name} · ${item.student?.student_number} · ${item.type}`}
      onClose={onClose}
      footer={<button type="button" disabled={busy} onClick={onConfirm} className={decision === "deny" ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}>{busy ? "Saving…" : label}</button>}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow movement</p><p className="mt-2 text-sm font-semibold text-ink">{item.workflow_status || item.status} <span className="mx-1 text-slate-300">→</span> {decision === "approve" || decision === "review" ? "Approved / reviewed" : decision === "deny" ? "Denied" : "Returned for revision"}</p></div>
        {note ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-amber-700">Recorded comment</p><p className="mt-2 whitespace-pre-wrap text-sm text-amber-900">{note}</p></div> : <p className="text-sm text-slate-600">No optional comment was entered. A student-visible status notice will still be recorded.</p>}
      </div>
    </DeanDialog>
  );
}

function DeanGraduationBatchModal({ rows, onClose, onSaved }) {
  const [form, setForm] = useState({ action: "approve", comment: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const batchLabels = [...new Set(rows.map((item) => graduationBatchLabel(item)))];
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault();
    if (form.action === "return" && !form.comment.trim()) {
      setError("Enter one return reason for the selected candidates.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.graduationBatchAction({ student_ids: rows.map((item) => item.student.id), ...form });
      await onSaved(result);
    } catch (err) {
      setError(err.message || "Could not apply the Dean group action.");
    } finally {
      setBusy(false);
    }
  }
  const submitLabel = deanGraduationBatchActionLabel(form.action);
  return (
    <DeanDialog
      id="dean-graduation-batch"
      title="Confirm Dean graduation group action"
      subtitle={`${rows.length} selected candidate${rows.length === 1 ? "" : "s"} · ${batchLabels.join(", ")} · stage checks apply to every record`}
      onClose={onClose}
      size="wide"
      footer={<button type="submit" form="dean-graduation-batch-form" disabled={busy} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> {busy ? "Applying…" : submitLabel}</button>}
    >
      <form id="dean-graduation-batch-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Dean decision</span><select value={form.action} onChange={update("action")} className="field-input cursor-pointer"><option value="approve">Approve endorsement list</option><option value="return">Return endorsement list for revision</option></select></label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">{form.action === "return" ? "Required revision reason" : "Optional Dean comment"}</span><textarea value={form.comment} onChange={update("comment")} required={form.action === "return"} className="field-input min-h-28" /></label>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Selected candidates</p>
          <ul className="mt-2 space-y-3 text-sm text-slate-600">
            {rows.map((item) => (
              <li key={item.student.id} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{item.student.name}</p>
                    <p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code} · {graduationBatchLabel(item)}</p>
                  </div>
                  <StatusBadge value={item.status || item.workflow_status} dot={false} />
                </div>
                <DeanGraduationRequirementBoxes item={item} />
              </li>
            ))}
          </ul>
        </div>
      </form>
    </DeanDialog>
  );
}

function DeanListFilters({ filters, setFilters, programs, statuses, showAdvanced = true }) {
  const active = Object.entries(filters).filter(([key, value]) => {
    if (!showAdvanced && ["dateFrom", "dateTo", "sort"].includes(key)) return false;
    return Boolean(value) && !(key === "sort" && value === "newest");
  }).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Card className="mb-4 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search Dean review lists</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search student, ID, or item…" aria-label="Search Dean review lists" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter Dean list by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter Dean list by stage or status"><option value="">All stages / statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated from</span><input type="date" value={filters.dateFrom} onChange={update("dateFrom")} className="field-input" /></label>}
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated through</span><input type="date" value={filters.dateTo} onChange={update("dateTo")} className="field-input" /></label>}
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Sort</span><select value={filters.sort} onChange={update("sort")} className="field-input cursor-pointer"><option value="newest">Newest updated</option><option value="oldest">Oldest updated</option><option value="student">Student name</option></select></label>}
      </div>
      {active > 0 && <div className="mt-2 flex justify-end"><button type="button" onClick={() => setFilters({ query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" })} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button></div>}
    </Card>
  );
}

function WorkflowApprovalCard({ item, note, setNote, template, setTemplate, recipient, setRecipient, visibility, setVisibility, busy, onDecide, onMessage }) {
  const key = `${item.type}-${item.id}`;
  const isBusy = busy === key;
  const standingChange = ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  const decisionOnly = ["practicum", "withdrawal", "graduation"].includes(item.type);
  const approveLabel = item.type === "practicum" ? "Mark reviewed" : standingChange || item.type === "withdrawal" ? "Approve" : "Approve and prepare for export";
  const returnLabel = "Return for revision";
  const timeline = standingChange
    ? null
    : item.type === "practicum"
    ? (item.timeline || []).map((step) => ({ ...step, optional: ["Hours Incomplete", "Additional Certificates Requested"].includes(step.label) }))
    : item.type === "withdrawal"
      ? withdrawalTimelineSteps(item.workflow_status)
      : graduationTimelineSteps(item.status, item.eligibility || { eligible: true, coursework_status: "Complete" });
  const timelineTitle = standingChange
    ? ""
    : item.type === "practicum"
    ? "Practicum workflow timeline"
    : item.type === "withdrawal"
      ? "Withdrawal workflow timeline"
      : "Graduation endorsement timeline";
  const files = item.record?.attachments || [];
  const canDecide = (
    (item.type === "practicum" && item.status === "Report Sent to Dean")
    || (item.type === "withdrawal" && item.status === "Pending" && item.workflow_status === "Dean Review")
    || (item.type === "graduation" && item.status === "Ready for Dean Review")
    || (standingChange && item.workflow_status === "Dean Review")
  );
  const batchName = item.type === "graduation" ? graduationBatchLabel(item) : "";
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
          <p className="text-sm text-slate-500">{item.subtitle} · submitted {formatDate(item.submitted_at)}</p>
          {batchName && <p className="mt-1 text-xs font-semibold text-brand-700">{batchName}</p>}
        </div>
        <StatusBadge value={item.status} dot={false} />
      </div>
      <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
        {item.details}
      </p>
      {timeline && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <WorkflowTimeline steps={timeline} title={timelineTitle} />
      </div>}
      {files.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Submitted files</p>
          <ul className="mt-2 space-y-2">{files.map((file) => <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-ink">{file.name}</p><p className="text-xs text-slate-500">Uploaded by {file.uploaded_by || "Uploader not recorded"} ({file.uploaded_by_role || "role not recorded"}) · {formatDate(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p></div>{file.file_exists !== false ? <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5"><Eye className="h-3.5 w-3.5" /> View <ArrowUpRight className="h-3.5 w-3.5" /></a> : <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">File unavailable</span>}</li>)}</ul>
        </div>
      )}
      {item.messages?.length > 0 && (
        <div className="mt-4">
          <WorkflowDiscussion messages={item.messages} title="Case discussion / saved messages" />
        </div>
      )}
      {item.history?.length > 0 && (
        <HistoryDisclosure className="mt-4" label="View logs" hideLabel="Hide logs" count={item.history.length}>
          <div className="rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stage history · Request #{item.request_id || item.id}</p>
            <ol className="mt-2 space-y-2">{[...item.history].reverse().map((entry) => <li key={entry.id} className="rounded-lg bg-slate-50 px-3 py-2"><p className="text-sm font-semibold text-ink">{entry.result}</p><p className="mt-1 text-xs text-slate-500">{entry.actor_role}{entry.actor_user_id ? ` · User #${entry.actor_user_id}` : ""}{entry.action_type ? ` · ${entry.action_type}` : ""} · {entry.previous_status || "—"} → {entry.new_status || "—"} · {formatDate(entry.created_at)}</p>{entry.notes && <p className="mt-1 text-xs text-slate-600">{entry.notes}</p>}</li>)}</ol>
          </div>
        </HistoryDisclosure>
      )}
      {!standingChange && !decisionOnly && <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <select value={template[key] || ""} onChange={(e) => setTemplate((current) => ({ ...current, [key]: e.target.value }))} className="field-input cursor-pointer" aria-label="Clarification message template">
        <option value="">Optional message template</option>
        {CLARIFICATION_TEMPLATES.map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={recipient[key] || "Graduate School Staff"} onChange={(e) => { const value = e.target.value; setRecipient((current) => ({ ...current, [key]: value })); setVisibility((current) => ({ ...current, [key]: value === "Student" ? "student_visible" : "internal" })); }} className="field-input cursor-pointer" aria-label="Message recipient">
        {["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Student"].map((role) => <option key={role}>{role}</option>)}
      </select>
      <select value={(recipient[key] || "Graduate School Staff") === "Student" ? "student_visible" : (visibility[key] || "internal")} onChange={(e) => setVisibility((current) => ({ ...current, [key]: e.target.value }))} disabled={(recipient[key] || "Graduate School Staff") === "Student"} className="field-input cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100" aria-label="Message visibility"><option value="internal">Internal reviewers only</option><option value="student_visible">Visible to student</option></select>
      <input
        value={note[key] || ""}
        onChange={(e) => setNote((n) => ({ ...n, [key]: e.target.value }))}
        placeholder={template[key] === "Other / Custom comment" ? "Enter a custom clarification message..." : "Comment or return reason..."}
        aria-label={`Comment or return reason for ${item.student?.name || item.title}`}
        className="field-input"
      />
      </div>}
      {decisionOnly && <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Review comment <span className="font-normal text-slate-400">({item.type === "withdrawal" ? "required when denying" : "required when returning for revision"})</span></span><textarea value={note[key] || ""} onChange={(event) => setNote((current) => ({ ...current, [key]: event.target.value }))} className="field-input min-h-24" placeholder="Add a review comment. It will be saved with your name, role, date, and time." /></label>}
      <div className="mt-3 flex flex-wrap gap-2">
        {canDecide && (
          <>
            <button type="button" disabled={isBusy} onClick={() => onDecide(item, item.type === "practicum" ? "review" : "approve")} className="btn-primary">
              <CheckCircle2 className="h-4 w-4" /> {approveLabel}
            </button>
            {(item.type === "withdrawal" || standingChange) && (
              <button type="button" disabled={isBusy} onClick={() => onDecide(item, "deny")} className="btn-ghost text-red-600">
                <AlertTriangle className="h-4 w-4" /> Deny
              </button>
            )}
            {item.type !== "withdrawal" && <button type="button" disabled={isBusy} onClick={() => onDecide(item, "return")} className="btn-ghost">
              <RotateCcw className="h-4 w-4" /> {returnLabel}
            </button>}
          </>
        )}
        {!standingChange && !decisionOnly && <button type="button" disabled={busy === `message-${key}`} onClick={() => onMessage(item)} className="btn-ghost">
          <MessageSquare className="h-4 w-4" /> Add comment
        </button>}
        {!canDecide && (
          <span className="self-center text-xs font-semibold text-slate-500">
            No Dean decision is due at this stage.
          </span>
        )}
      </div>
    </Card>
  );
}

const DEAN_BOARD_COLUMNS = [
  "New / Submitted",
  "Pending Dean Review",
  "Returned for Revision",
  "Approved / Completed",
  "Rejected / Withdrawn",
];

function deanBoardGroup(item) {
  const workflowStatus = item.workflow_status || item.status;
  if (["Report Sent to Dean", "Ready for Dean Review", "Dean Review"].includes(workflowStatus)) return "Pending Dean Review";
  if (["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(item.status)
    || ["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(workflowStatus)) return "Returned for Revision";
  if (["Dean Approved", "Dean Reviewed", "Approved", "Withdrawn Confirmed"].includes(item.status)
    || ["Dean Approved", "Dean Reviewed", "Approved", "Withdrawn Confirmed"].includes(workflowStatus)) return "Approved / Completed";
  if (["Denied", "Rejected", "Cancelled"].includes(item.status) || ["Denied", "Rejected", "Cancelled"].includes(workflowStatus)) return "Rejected / Withdrawn";
  return "New / Submitted";
}

function DeanWorkflowBoard({ rows, onOpen, selectedIds, onToggle }) {
  const selectedRows = rows.filter((item) => item.type === "graduation" && selectedIds.has(item.student?.id));
  const boardRows = selectedRows.length ? rows.filter((item) => !(item.type === "graduation" && selectedIds.has(item.student?.id))) : rows;
  const renderCard = (item) => {
    const selectable = item.type === "graduation" && item.status === "Ready for Dean Review";
    const readyToDrag = isReadyForDeanReview(item);
    return (
      <article
        key={`${item.type}-${item.id}`}
        draggable={readyToDrag}
        onDragStart={(event) => {
          if (!readyToDrag) return;
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", `dean-review:${item.type}:${item.id}`);
        }}
        className={`rounded-xl border p-3 shadow-sm transition-colors ${readyToDrag ? "cursor-grab border-emerald-300 bg-emerald-50 hover:border-emerald-500 active:cursor-grabbing" : "border-slate-200 bg-white hover:border-slate-300"}`}
      >
        <div className="flex items-start gap-2">
          {selectable && <input type="checkbox" checked={selectedIds.has(item.student.id)} onChange={() => onToggle(item.student.id)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${item.student.name} for Dean group action`} />}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{item.student?.name || item.title}</p>
            <p className="text-xs text-slate-400">{item.student?.student_number} · {item.student?.program_code}</p>
            {item.type === "graduation" && <p className="mt-1 truncate text-xs font-semibold text-brand-700">{graduationBatchLabel(item)}</p>}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <StatusBadge value={item.workflow_status || item.status} dot={false} />
          {readyToDrag
            ? <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span>
            : !item.has_submitted_documents && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">{item.type} · updated {formatDate(item.last_activity_at || item.submitted_at)}</p>
        {item.messages?.length > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-800"><MessageSquare className="mr-1 inline h-3.5 w-3.5" /> {item.messages.length} visible message{item.messages.length === 1 ? "" : "s"}</p>}
        <button type="button" onClick={() => onOpen(item)} className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 focus:ring-2 focus:ring-brand-500">View full request <Eye className="h-3.5 w-3.5" /></button>
      </article>
    );
  };
  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between gap-3"><div><p className="font-display text-lg font-semibold text-ink">Grouped workflow board</p><p className="text-xs text-slate-500">Open a card to review files, history, messages, and role-appropriate actions.</p></div><StatusBadge value={`${rows.length} requests`} dot={false} /></div>
      {selectedRows.length > 0 && (
        <section className="mb-4 rounded-2xl border border-brand-200 bg-brand-50/50 p-3">
          <header className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-brand-800">Selected graduation candidates</h2>
              <p className="text-xs text-brand-700">Alphabetized selected cards ready for Dean group action.</p>
            </div>
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-brand-700 ring-1 ring-brand-100">{selectedRows.length}</span>
          </header>
          <div className="max-w-full overflow-x-auto pb-1">
            <div className="flex w-max gap-3">
              {selectedRows.map((item) => <div key={`${item.type}-${item.id}`} className="w-[285px] shrink-0">{renderCard(item)}</div>)}
            </div>
          </div>
        </section>
      )}
      <div className="max-w-full overflow-x-auto pb-3">
        <div className="flex w-max snap-x gap-4">
        {DEAN_BOARD_COLUMNS.map((column) => {
          const items = boardRows.filter((item) => deanBoardGroup(item) === column);
          return (
            <section key={column} className="w-[285px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <header className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-slate-700">{column}</h2><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span></header>
              <div className="space-y-3">{items.length ? items.map(renderCard) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">No requests</p>}</div>
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}
