import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  UserPlus,
  CalendarOff,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  FileText,
  Users,
  CalendarCheck,
  Briefcase,
  GraduationCap,
  LogOut,
  CheckCircle2,
  Info,
  Sparkles,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  GitMerge,
  X,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserRoundCheck,
  Trash2,
  Inbox,
  Eye,
  Search,
  MoreVertical,
  SlidersHorizontal,
  History,
  UserX,
  Download,
  HelpCircle,
  MessageSquare,
  Columns3,
  List,
  Send,
  CheckSquare,
  Printer,
  Pencil,
  Database,
  BookOpenCheck,
  FileUp,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { Field, Input, Textarea, Select, CheckList } from "../components/forms";
import StudentPicker from "../components/StudentPicker";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../components/WorkflowTimeline";
import WorkflowDiscussion from "../components/WorkflowDiscussion";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { formatDate } from "../lib/format";
import { printDataTable } from "../lib/print";
import { useAuth } from "../auth";
import { Form1EndorsementQueue } from "./Form1Endorsements";

const WORKFLOW_ROLE_LABELS = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  dean: "Dean",
  admin: "Administrator",
};
const GRADUATION_BATCH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const PANEL_MATCHING_DEFAULT_LIMIT = 15;
const PANEL_MATCHING_RECOMMENDED_COUNT = 4;

const ICONS = {
  "student-handoff": UserPlus,
  "leave-of-absence": CalendarOff,
  readmission: UserCheck,
  awol: UserX,
  "course-audit": ClipboardCheck,
  "research-gate": FileCheck,
  "panel-matching": Users,
  "defense-scheduling": CalendarCheck,
  practicum: Briefcase,
  withdrawal: LogOut,
  graduation: GraduationCap,
};

// Student-initiated workflows: staff pick from the submitted-request queue,
// not the full student list (students file these from their own portal).
const USES_REQUEST_QUEUE = {
  "leave-of-absence": true,
  readmission: true,
  awol: false,
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "leave-of-absence": true,
  readmission: true,
  "course-audit": false,
  "research-gate": true,
  "panel-matching": true,
  "defense-scheduling": true,
  practicum: false,
  withdrawal: false,
  graduation: false,
};

const OVERVIEW_WORKFLOWS = new Set(["practicum", "withdrawal", "graduation", "leave-of-absence", "readmission", "awol"]);

const REQUEST_BOARD_COLUMNS = [
  { label: "For Review", statuses: ["Pending Review", "In Progress"] },
  { label: "Approved", statuses: ["Approved"] },
  { label: "Returned for Revision", statuses: ["Returned for Revision"] },
  { label: "Denied", statuses: ["Denied"] },
];

const AWOL_BOARD_COLUMNS = [
  { label: "AWOL", statuses: ["AWOL Declared"] },
  { label: "Return Review", statuses: ["Return Submitted", "Returned for Revision"] },
  { label: "Dean Review", statuses: ["Dean Review"] },
  { label: "Return Outcome", statuses: ["Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required", "Return Denied"] },
  { label: "Residency", statuses: ["Residency", "Residency Completed"] },
];

export default function WorkflowPage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(() => {
    const value = searchParams.get("student_id") || window.localStorage.getItem("workflowStudentId");
    return value ? Number(value) : null;
  });
  const [studentLabel, setStudentLabel] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [supportModal, setSupportModal] = useState("");

  // Keep the same student while staff move through research gate, panel
  // matching, and scheduling. The query string also makes the view shareable.
  useEffect(() => {
    setSpecialization("");
    setResult(null);
    setSubmitError("");
    if (USES_REQUEST_QUEUE[slug]) {
      window.localStorage.removeItem("workflowStudentId");
      if (!searchParams.get("student_id")) {
        setStudentId(null);
        setStudentLabel("");
      }
    }
  }, [slug]);

  useEffect(() => {
    if (studentId) {
      if (USES_REQUEST_QUEUE[slug]) {
        window.localStorage.removeItem("workflowStudentId");
      } else {
        window.localStorage.setItem("workflowStudentId", String(studentId));
      }
      if (searchParams.get("student_id") !== String(studentId)) {
        const next = new URLSearchParams(searchParams);
        next.set("student_id", String(studentId));
        setSearchParams(next, { replace: true });
      }
    }
  }, [slug, studentId, searchParams, setSearchParams]);

  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext(slug, { student_id: studentId, specialization }),
    [slug, studentId, specialization]
  );

  const tx = context?.transaction || meta?.transactions?.find((t) => t.slug === slug);
  const Icon = ICONS[slug] || FileCheck;
  const needsStudent = NEEDS_STUDENT[slug];
  const usesQueue = USES_REQUEST_QUEUE[slug];
  const overviewWorkflow = OVERVIEW_WORKFLOWS.has(slug);
  const hideSideRail = overviewWorkflow || slug === "course-audit";

  useEffect(() => {
    if (!usesQueue || loading || !studentId || !context?.submitted_requests) return;
    if (context.submitted_requests.some((request) => request.id === studentId)) return;
    setStudentId(null);
    setStudentLabel("");
    const next = new URLSearchParams(searchParams);
    next.delete("student_id");
    setSearchParams(next, { replace: true });
  }, [usesQueue, loading, studentId, context?.submitted_requests, searchParams, setSearchParams]);

  useEffect(() => {
    if (!studentLabel && context?.selected_student?.search_label) {
      setStudentLabel(context.selected_student.search_label);
    }
  }, [context, studentLabel]);

  async function submit(payload) {
    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const res = await api.submitTransaction(slug, payload);
      setResult(res);
      await refetch();
      return true;
    } catch (err) {
      setSubmitError(err.message || "Could not save. Please review the form.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  if (!tx) return <Spinner label="Loading workflow…" />;

  const formProps = {
    meta,
    context,
    studentId,
    studentLabel,
    setStudentId,
    setStudentLabel,
    specialization,
    setSpecialization,
    submit,
    submitting,
    refreshing: loading,
    result,
    submitError,
    clearSubmitFeedback: () => {
      setResult(null);
      setSubmitError("");
    },
    refetch,
    accountRole: user?.role,
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{tx.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{tx.short}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>
                {tx.actor}
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>
                {tx.data}
              </p>
            </div>
          </div>
          {overviewWorkflow && (
            <div className="flex shrink-0 flex-wrap gap-2 sm:ml-auto sm:justify-end">
              <button type="button" onClick={() => setSupportModal("guide")} className="btn-ghost cursor-pointer px-3 py-2">
                <HelpCircle className="h-4 w-4" /> How this works
              </button>
              <button type="button" onClick={() => setSupportModal("activity")} className="btn-ghost cursor-pointer px-3 py-2">
                <History className="h-4 w-4" /> View recent activity
              </button>
            </div>
          )}
        </div>
      </Card>

      {slug !== "defense-scheduling" && result && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 animate-fade-up">
          <CheckCircle2 className="h-5 w-5" /> {result.message}
        </div>
      )}
      {slug !== "defense-scheduling" && <ErrorNote message={submitError} />}

      <div className={hideSideRail ? "grid grid-cols-1 gap-5" : "grid grid-cols-1 gap-5 lg:grid-cols-3"}>
        <div className={hideSideRail ? "space-y-5" : "space-y-5 lg:col-span-2"}>
          {needsStudent && !usesQueue && (
            <Card className="p-6">
              <SectionTitle title="Choose a student" subtitle="Pick the record this action applies to" icon={Users} />
              <StudentPicker
                value={studentId}
                selectedLabel={studentLabel}
                meta={meta}
                onChange={(id, label) => {
                  setStudentId(id);
                  setStudentLabel(label || "");
                  setResult(null);
                  if (!id) {
                    window.localStorage.removeItem("workflowStudentId");
                    const next = new URLSearchParams(searchParams);
                    next.delete("student_id");
                    setSearchParams(next, { replace: true });
                  }
                }}
              />
            </Card>
          )}

          {usesQueue && (
            <RequestQueue
              slug={slug}
              context={context}
              formProps={formProps}
              requests={context?.submitted_requests}
              selectedId={studentId}
              onPick={(r) => {
                setStudentId(r.id);
                setStudentLabel(r.search_label || r.name);
                setResult(null);
              }}
              onClear={() => {
                setStudentId(null);
                setStudentLabel("");
                setResult(null);
                const next = new URLSearchParams(searchParams);
                next.delete("student_id");
                setSearchParams(next, { replace: true });
              }}
            />
          )}

          {needsStudent && !studentId ? (
            usesQueue ? null : (
              <Card className="p-6">
                <EmptyState icon={Info} title="Select a student to begin" hint="Search above to load this student's current monitoring data." />
              </Card>
            )
          ) : loading && !context ? (
            <Card className="p-6">
              <Spinner label="Loading workflow data…" />
            </Card>
          ) : error && !context ? (
            <Card className="p-6">
              <EmptyState icon={AlertTriangle} title="Could not load workflow" hint={error} />
            </Card>
          ) : usesQueue ? (
            null
          ) : slug === "research-gate" ? (
            <ResearchGateForm {...formProps} />
          ) : (
            <Card className="p-6">
              {slug === "student-handoff" && <HandoffPanel {...formProps} />}
              {slug === "course-audit" && <CourseAuditPanel meta={meta} />}
              {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
              {slug === "defense-scheduling" && <DefenseSchedulingForm {...formProps} />}
              {slug === "practicum" && <PracticumRoster {...formProps} />}
              {slug === "withdrawal" && <WithdrawalRoster {...formProps} />}
              {slug === "graduation" && <GraduationRoster {...formProps} />}
              {slug === "awol" && <AwolResidencyPanel {...formProps} />}
              {slug === "leave-of-absence" && <LeaveOfAbsenceForm {...formProps} />}
              {slug === "readmission" && <ReadmissionForm {...formProps} />}
            </Card>
          )}
        </div>

        {/* Side rail */}
        {!hideSideRail && <div className="space-y-5">
          <Card className="p-6">
            <SectionTitle title="How this works" icon={Sparkles} />
            <p className="text-sm leading-relaxed text-slate-600">{workflowGuidance(slug)}</p>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Recent in this workflow" icon={Info} />
            {context?.recent_logs?.length ? (
              <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={context.recent_logs.length}>
                <ul className="space-y-3">
                  {context.recent_logs.map((log) => (
                    <li key={log.id} className="rounded-xl border border-slate-100 p-3">
                      <p className="text-sm font-semibold text-ink">{log.result}</p>
                      <p className="text-xs text-slate-500">
                        {log.student_name || log.source_reference || "Workflow"} · {formatDate(log.created_at)}
                      </p>
                      {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
                    </li>
                  ))}
                </ul>
              </HistoryDisclosure>
            ) : (
              <EmptyState title="No recent actions" />
            )}
          </Card>
        </div>}
      </div>
      {supportModal && (
        <WorkflowSupportModal
          slug={slug}
          mode={supportModal}
          logs={context?.recent_logs || []}
          policyQuestions={context?.deployment_policy_questions || []}
          onClose={() => setSupportModal("")}
        />
      )}
    </div>
  );
}

// Submitted-request queue for student-initiated workflows (LOA / Readmission).
function RequestQueue({ slug, context, formProps, requests, selectedId, onPick, onClear }) {
  const list = requests || [];
  const [viewMode, setViewMode] = useState("board");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const selected = list.find((r) => r.id === selectedId);
  const selectedContextReady = Boolean(
    selected && context?.selected_request?.id === selected.id
  );
  const reviewCount = list.filter((r) => ["Pending Review", "In Progress"].includes(r.status)).length;
  const statuses = uniqueValues(list.map((r) => r.status));
  const filtered = list.filter((r) => {
    const haystack = `${r.name} ${r.student_number} ${r.program_code} ${r.request_label || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.status || r.status === filters.status);
  });

  return (
    <div className="space-y-4">
      {messageNotice && (
        <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {messageNotice}
        </div>
      )}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Submitted requests" subtitle="Student-filed applications grouped by current status" icon={Inbox} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500">
              <Users className="h-4 w-4" /> {reviewCount} for review
            </span>
            <ViewModeToggle value={viewMode} onChange={setViewMode} />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1">
            <span className="sr-only">Search submitted requests</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="Search name, student ID, or program…"
              className="field-input pl-9"
            />
          </label>
          <select
            value={filters.status}
            onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
            className="field-input cursor-pointer sm:w-56"
            aria-label="Filter submitted requests by status"
          >
            <option value="">All statuses</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </div>
        {!list.length ? (
          <EmptyState
            icon={Inbox}
            title="No submitted requests yet"
            hint="Student-filed LOA or readmission requests will appear here."
          />
        ) : viewMode === "board" ? (
          <WorkflowBoard
            columns={REQUEST_BOARD_COLUMNS}
            rows={filtered}
            getStatus={(request) => request.status}
            renderCard={(request) => (
              <RequestBoardCard
                key={request.request_log_id || request.id}
                item={request}
                onOpen={() => onPick(request)}
                onMessage={() => setMessageRow(request)}
              />
            )}
            empty="No requests match the current filters."
          />
        ) : (
          <RequestTable rows={filtered} onOpen={onPick} onMessage={setMessageRow} />
        )}
      </Card>
      {selected && (
        <WorkflowCaseModal
          id={`${slug}-request-${selected.request_log_id || selected.id}`}
          title={selected.name}
          subtitle={`${selected.student_number} · ${selected.program_code} · ${slug === "leave-of-absence" ? "Leave of Absence" : "Readmission"} request`}
          status={selected.status}
          onClose={onClear}
          footer={(
            <button type="button" onClick={() => setMessageRow(selected)} className="btn-ghost cursor-pointer px-4 py-2">
              <MessageSquare className="h-4 w-4" /> Message / Return
            </button>
          )}
        >
          <div className="space-y-5">
            <WorkflowSubmitFeedback result={formProps.result} error={formProps.submitError} />
            <RequestSummary request={selected} />
            <CaseMessageHistory messages={selected.messages || []} />
            <WorkflowActivityList logs={selected.history || []} />
            <WorkflowFileHistory files={[selected.attachment_detail].filter(Boolean)} />
            {selectedContextReady ? (
              slug === "leave-of-absence"
                ? <LeaveOfAbsenceForm {...formProps} embedded />
                : <ReadmissionForm {...formProps} embedded />
            ) : (
              <Spinner label="Loading request details…" />
            )}
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && (
        <WorkflowMessageModal
          slug={slug}
          row={messageRow}
          context={context}
          onClose={() => setMessageRow(null)}
          onSaved={async (message) => {
            setMessageNotice(message);
            await formProps.refetch();
          }}
        />
      )}
    </div>
  );
}

function RequestBoardCard({ item, onOpen, onMessage }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
          <p className="text-xs text-slate-400">{item.student_number} · {item.program_code}</p>
        </div>
        <StatusBadge value={item.status} dot={false} />
      </div>
      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.request_label || "Student request"}</p>
      <p className="mt-2 text-xs text-slate-500">Submitted {formatDate(item.submitted_at)}</p>
      <p className="mt-2 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">
        Next: {item.next_action_owner || "GS Staff"}
      </p>
      {item.unresolved_messages > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{item.unresolved_messages} concern(s)</p>}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={onOpen} className="btn-ghost cursor-pointer px-2 py-1.5">
          <Eye className="h-3.5 w-3.5" /> {item.status === "Pending Review" ? "Review" : "View"}
        </button>
        <button type="button" onClick={onMessage} className="btn-ghost cursor-pointer px-2 py-1.5">
          <MessageSquare className="h-3.5 w-3.5" /> Message
        </button>
      </div>
    </article>
  );
}

function RequestTable({ rows, onOpen, onMessage }) {
  if (!rows.length) {
    return <EmptyState icon={Inbox} title="No requests match the filters" hint="Clear the search or status filter and try again." />;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Student</th>
            <th className="px-3 py-3">Request</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Submitted</th>
            <th className="px-3 py-3">Next owner</th>
            <th className="px-3 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((request) => (
            <tr key={request.request_log_id || request.id} className="border-b border-slate-50 transition-colors hover:bg-slate-50/60">
              <td className="px-4 py-3">
                <p className="font-semibold text-ink">{request.name}</p>
                <p className="text-xs text-slate-400">{request.student_number} · {request.program_code}</p>
              </td>
              <td className="px-3 py-3 text-slate-600">{request.request_label || "Student request"}</td>
              <td className="px-3 py-3"><StatusBadge value={request.status} dot={false} /></td>
              <td className="px-3 py-3 text-slate-500">{formatDate(request.submitted_at)}</td>
              <td className="px-3 py-3 text-xs font-semibold text-slate-600">{request.next_action_owner || "—"}</td>
              <td className="px-3 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => onOpen(request)} className="btn-ghost cursor-pointer px-3 py-1.5">
                    <Eye className="h-3.5 w-3.5" /> {request.status === "Pending Review" ? "Review" : "View"}
                  </button>
                  <button type="button" onClick={() => onMessage(request)} className="btn-ghost cursor-pointer px-3 py-1.5">
                    <MessageSquare className="h-3.5 w-3.5" /> Message
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestSummary({ request, compact = false }) {
  if (!request) return null;
  const applicationSource = request.attachment || "Structured portal form";
  return (
    <div className={`grid gap-3 text-sm ${compact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
      <Detail label="Request" value={request.request_label || "Submitted application"} />
      <Detail label={request.attachment ? "Application file" : "Request format"} value={applicationSource} />
      <Detail label="Submitted" value={formatDate(request.submitted_at)} />
      {request.attachment_detail?.file_exists && request.attachment_detail?.url && (
        <a href={request.attachment_detail.url} target="_blank" rel="noreferrer" className="btn-ghost w-fit px-3 py-2">
          View PDF <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

function SubmitButton({ submitting, children }) {
  return (
    <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
      {submitting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — AIMS export import & reconciliation (no manual student creation).
// Students come from the official AIMS export only (checklist items 2, 5, 66).
// ---------------------------------------------------------------------------
function HandoffPanel() {
  return (
    <div className="space-y-6">
      <HandoffImport />
    </div>
  );
}

function HandoffImport({ context }) {
  const isAudit = context === "audit";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [resolvingIssue, setResolvingIssue] = useState(false);
  const [issueError, setIssueError] = useState("");
  const { data: uploadHistory, refetch: refetchUploadHistory } = useApi(() => api.monitoringUploads(), []);

  function pick(f) {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      setError("Please choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.importHandoff(file);
      setResult(res);
      setFile(null);
      refetchUploadHistory();
    } catch (err) {
      setError(err.message || "Could not import the file.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveIssue(action, edited = null) {
    if (!selectedIssue) return;
    setResolvingIssue(true);
    setIssueError("");
    try {
      const response = await api.resolveMonitoringIssue(selectedIssue.id, { action, edited });
      setResult((current) => current ? {
        ...current,
        validation_issues: (current.validation_issues || []).map((item) =>
          item.id === response.issue.id ? response.issue : item
        ),
        unresolved_count: Math.max(0, (current.unresolved_count || 0) - 1),
        conflict_count: Math.max(0, (current.conflict_count || 0) - 1),
      } : current);
      setSelectedIssue(null);
      refetchUploadHistory();
    } catch (err) {
      setIssueError(err.message || "Could not resolve this validation issue.");
    } finally {
      setResolvingIssue(false);
    }
  }

  function applyBulkResolution(response) {
    const updatedById = new Map((response.issues || []).map((item) => [item.id, item]));
    setResult((current) => {
      if (!current) return current;
      const validationIssues = (current.validation_issues || []).map((item) => updatedById.get(item.id) || item);
      const unresolvedCount = validationIssues.filter((item) => item.status === "Unresolved").length;
      return {
        ...current,
        validation_issues: validationIssues,
        unresolved_count: unresolvedCount,
        conflict_count: unresolvedCount,
      };
    });
    if (selectedIssue && updatedById.has(selectedIssue.id)) {
      setSelectedIssue(updatedById.get(selectedIssue.id));
    }
    refetchUploadHistory();
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={isAudit ? "Update audits from monitoring sheet" : "Import from monitoring sheet"}
        subtitle={
          isAudit
            ? "Upload the latest AC Student Monitoring sheet — each student's completed subjects are updated from it"
            : "Upload the AC Student Monitoring Excel file — students, programs, and course audits are created automatically"
        }
        icon={FileSpreadsheet}
        action={
          <Link to="/monitoring-sheet" className="btn-ghost shrink-0">
            <Table2 className="h-4 w-4" /> Full sheet
          </Link>
        }
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <UploadCloud className="h-6 w-6" />
        </span>
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-brand-600" />
            <span className="font-semibold text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600 cursor-pointer"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Drag &amp; drop your .xlsx here</p>
            <p className="text-xs text-slate-500">or</p>
          </>
        )}
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <span className="btn-ghost cursor-pointer">{file ? "Choose a different file" : "Browse files"}</span>
        </label>
        <p className="mt-3 text-xs text-slate-400">
          Expected format: AC Student Monitoring template — program in cell A1, one student per row.
        </p>
      </div>

      <ErrorNote message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={runImport} disabled={!file || busy} className="btn-primary w-full sm:w-auto">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Importing…
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" /> {isAudit ? "Update audits" : "Import students"}
            </>
          )}
        </button>
      </div>

      {result && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 animate-fade-up">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {result.message}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-7">
            <ResultStat label="New" value={result.created} />
            <ResultStat label="AY/YR refreshed" value={result.updated ?? 0} />
            <ResultStat label="Existing / skipped" value={result.skipped ?? 0} />
            <ResultStat label="Cell changes" value={result.subject_changes ?? 0} />
            <ResultStat label="Conflicts" value={result.conflict_count ?? 0} />
            <ResultStat label="Subjects" value={result.subjects} />
            <ResultStat label="Program" value={result.program} />
          </div>
          {result.program_id && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/monitoring-sheet?program_id=${result.program_id}`} className="btn-primary">
                <Table2 className="h-4 w-4" /> Open Monitoring Sheet
              </Link>
              <Link to="/students" className="btn-ghost">
                <Users className="h-4 w-4" /> View Students
              </Link>
            </div>
          )}
          {result.duplicates?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Already in the system
              </p>
              <p className="mb-2 text-sm font-medium text-slate-600">
                These students were already added, so they were not imported again.
              </p>
              <ul className="space-y-2">
                {result.duplicates.slice(0, 8).map((d) => (
                  <li key={`${d.incoming_student_number}-${d.matched_student.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{d.incoming_name || d.matched_student.name} · {d.incoming_student_number}</p>
                    <p className="text-xs text-slate-500">
                      Student is in the system as {d.matched_student.name} · {d.matched_student.student_number}.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.validation_issues?.length > 0 && (
            <ValidationIssueTable
              issues={result.validation_issues}
              onOpen={setSelectedIssue}
              onBulkResolved={applyBulkResolution}
              title="Validation results"
            />
          )}
          {result.sample?.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {isAudit ? "Updated students (sample)" : "Imported students (sample)"}
              </p>
              <ul className="divide-y divide-slate-100">
                {result.sample.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-slate-400">
                        {s.student_number} · {s.program_code} · {s.stage} · {s.completed}/{s.total_subjects} subjects
                      </p>
                    </div>
                    <Link
                      to={`/students/${s.id}`}
                      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
                    >
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-ink"><History className="h-4 w-4 text-brand-600" /> Upload history</h3>
            <p className="mt-1 text-xs text-slate-500">Every uploaded workbook is preserved. Open a version to review conflicts between its values and the current record.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">{uploadHistory?.items?.length || 0} backups</span>
        </div>
        {uploadHistory?.items?.length ? (
          <HistoryDisclosure label="View upload history" hideLabel="Hide upload history" count={uploadHistory.items.length}>
          <div className="space-y-2">
            {uploadHistory.items.map((upload) => (
              <details key={upload.id} className="group rounded-xl border border-slate-200 p-3">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{upload.original_name}</p>
                    <p className="text-xs text-slate-500">{upload.program} · {upload.rows} students · {formatDate(upload.uploaded_at)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={upload.unresolved_count ? `${upload.unresolved_count} unresolved` : "Validated"} dot={false} />
                    <a href={upload.download_url} onClick={(event) => event.stopPropagation()} className="btn-ghost px-2.5 py-1.5" aria-label={`Download ${upload.original_name}`}>
                      <Download className="h-3.5 w-3.5" /> Backup
                    </a>
                  </div>
                </summary>
                <div className="mt-3 border-t border-slate-100 pt-3">
                  {upload.issues?.length ? (
                    <ValidationIssueTable issues={upload.issues} onOpen={setSelectedIssue} onBulkResolved={applyBulkResolution} compact />
                  ) : (
                    <p className="text-sm text-slate-500">This version matches existing records or added new students without conflicts.</p>
                  )}
                </div>
              </details>
            ))}
          </div>
          </HistoryDisclosure>
        ) : (
          <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No monitoring-sheet backups yet.</p>
        )}
      </div>
      {selectedIssue && (
        <MonitoringIssueModal
          issue={selectedIssue}
          busy={resolvingIssue}
          error={issueError}
          onClose={() => { setSelectedIssue(null); setIssueError(""); }}
          onResolve={resolveIssue}
        />
      )}
    </div>
  );
}

function ValidationIssueTable({ issues = [], onOpen, onBulkResolved, title = "", compact = false }) {
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [correctionFile, setCorrectionFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadMessage, setUploadMessage] = useState("");
  const ordered = [...issues].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Unresolved" ? -1 : 1;
    return (a.row_number || 0) - (b.row_number || 0);
  });
  const unresolved = ordered.filter((item) => item.status === "Unresolved");
  const selectedUnresolved = unresolved.filter((item) => selectedIds.has(item.id));
  const allUnresolvedSelected = unresolved.length > 0 && selectedUnresolved.length === unresolved.length;

  useEffect(() => {
    const unresolvedIds = new Set(issues.filter((item) => item.status === "Unresolved").map((item) => item.id));
    setSelectedIds((current) => new Set([...current].filter((id) => unresolvedIds.has(id))));
  }, [issues]);

  function toggleIssue(issueId) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) next.delete(issueId); else next.add(issueId);
      return next;
    });
    setUploadError("");
    setUploadMessage("");
  }

  function toggleAll() {
    setSelectedIds(allUnresolvedSelected ? new Set() : new Set(unresolved.map((item) => item.id)));
    setUploadError("");
    setUploadMessage("");
  }

  function chooseCorrectionFile(file) {
    if (!file) return;
    if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
      setUploadError("Choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setCorrectionFile(file);
    setUploadError("");
    setUploadMessage("");
  }

  async function uploadCorrection() {
    if (!correctionFile || !selectedUnresolved.length) return;
    setUploading(true);
    setUploadError("");
    setUploadMessage("");
    try {
      const response = await api.resolveMonitoringIssuesWithFile(
        selectedUnresolved.map((item) => item.id),
        correctionFile,
      );
      setUploadMessage(response.message);
      setCorrectionFile(null);
      setSelectedIds(new Set());
      onBulkResolved?.(response);
    } catch (err) {
      setUploadError(err.message || "Could not check the corrected workbook.");
    } finally {
      setUploading(false);
    }
  }

  function DiscrepancyList({ issue }) {
    const rows = issue.discrepancies?.length
      ? issue.discrepancies
      : [{ type: issue.issue, messages: issue.details || [issue.summary].filter(Boolean) }];
    return (
      <div className="space-y-1.5">
        {rows.map((item, index) => (
          <div key={`${item.type}-${index}`} className="rounded-lg border border-amber-100 bg-amber-50/60 px-2.5 py-2">
            <p className="text-xs font-bold text-amber-900">{item.type}</p>
            {(item.messages || []).map((message, messageIndex) => (
              <p key={messageIndex} className="mt-0.5 text-xs leading-relaxed text-slate-600">{message}</p>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className={`rounded-xl border ${compact ? "border-slate-200" : "border-amber-200 bg-white"}`}>
      {(title || !compact) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> {title || "Validation issues"}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">Each student can have several discrepancies. Select rows to resolve several students with one corrected workbook.</p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
            {ordered.filter((item) => item.status === "Unresolved").length} unresolved
          </span>
        </div>
      )}
      {unresolved.length > 0 && (
        <div className="border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Bulk resolution</p>
              <p className="mt-0.5 text-xs text-slate-500">Select students below, then upload one corrected monitoring workbook containing those students.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{selectedUnresolved.length} selected</span>
              <label className={`btn-ghost cursor-pointer ${selectedUnresolved.length ? "" : "pointer-events-none opacity-50"}`}>
                <FileUp className="h-4 w-4" /> {correctionFile ? "Change file" : "Choose corrected file"}
                <input type="file" accept=".xlsx,.xlsm" className="sr-only" disabled={!selectedUnresolved.length || uploading} onChange={(event) => chooseCorrectionFile(event.target.files?.[0])} />
              </label>
              <button type="button" onClick={uploadCorrection} disabled={!correctionFile || !selectedUnresolved.length || uploading} className="btn-primary cursor-pointer">
                {uploading ? "Checking…" : "Apply to selected students"}
              </button>
            </div>
          </div>
          {correctionFile && <p className="mt-2 text-xs font-semibold text-brand-700">Selected file: {correctionFile.name}</p>}
          {uploadMessage && <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{uploadMessage}</p>}
          {uploadError && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{uploadError}</p>}
        </div>
      )}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500">
            <tr><th className="w-12 px-4 py-2.5"><input type="checkbox" checked={allUnresolvedSelected} onChange={toggleAll} disabled={!unresolved.length} className="h-4 w-4 cursor-pointer accent-brand-600" aria-label="Select all unresolved students" /></th><th className="px-4 py-2.5">Student</th><th className="px-4 py-2.5">Discrepancies</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Action</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ordered.map((issue) => (
              <tr key={issue.id} className="transition-colors hover:bg-slate-50">
                <td className="px-4 py-3 align-top"><input type="checkbox" checked={selectedIds.has(issue.id)} onChange={() => toggleIssue(issue.id)} disabled={issue.status !== "Unresolved"} className="h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`Select ${issue.incoming_name || issue.existing?.name || `row ${issue.row_number}`}`} /></td>
                <td className="px-4 py-3"><p className="font-semibold text-ink">{issue.incoming_name || issue.existing?.name || `Row ${issue.row_number}`}</p><p className="text-xs text-slate-500">{issue.incoming_student_number || "No student ID"}</p></td>
                <td className="max-w-lg px-4 py-3"><DiscrepancyList issue={issue} /></td>
                <td className="px-4 py-3"><StatusBadge value={issue.status} dot={false} /></td>
                <td className="px-4 py-3 text-right"><button type="button" onClick={() => onOpen(issue)} className="btn-ghost cursor-pointer px-3 py-1.5">Compare</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-slate-100 md:hidden">
        {ordered.map((issue) => (
          <div key={issue.id} className="px-4 py-3">
            <div className="flex items-start gap-3"><input type="checkbox" checked={selectedIds.has(issue.id)} onChange={() => toggleIssue(issue.id)} disabled={issue.status !== "Unresolved"} className="mt-1 h-4 w-4 cursor-pointer accent-brand-600 disabled:cursor-not-allowed" aria-label={`Select ${issue.incoming_name || issue.existing?.name || `row ${issue.row_number}`}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-ink">{issue.incoming_name || issue.existing?.name || `Row ${issue.row_number}`}</p><p className="text-xs text-slate-500">{issue.incoming_student_number || "No student ID"}</p></div><StatusBadge value={issue.status} dot={false} /></div><div className="mt-2"><DiscrepancyList issue={issue} /></div><button type="button" onClick={() => onOpen(issue)} className="btn-ghost mt-2 cursor-pointer px-3 py-1.5">Compare records</button></div></div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MonitoringIssueModal({ issue, busy, error, onClose, onResolve }) {
  const uploaded = issue.uploaded || {};
  const existing = issue.existing || {};
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState({
    student_number: uploaded.student_number || "",
    first_name: uploaded.first_name || "",
    last_name: uploaded.last_name || "",
    academic_year_entry: uploaded.academic_year_entry || "",
    subjects: { ...(uploaded.subjects || {}) },
  });
  const subjectRows = issue.subject_comparison || [];
  const unresolved = issue.status === "Unresolved";
  const footer = unresolved ? (
    <>
      <button type="button" disabled={busy} onClick={() => onResolve("keep_existing")} className="btn-ghost cursor-pointer">
        <Database className="h-4 w-4" /> Keep Existing
      </button>
      <button type="button" disabled={busy} onClick={() => onResolve("use_uploaded")} className="btn-ghost cursor-pointer border-brand-200 text-brand-700">
        <FileUp className="h-4 w-4" /> Use Uploaded
      </button>
      {editMode ? (
        <button type="button" disabled={busy} onClick={() => onResolve("edit", edited)} className="btn-primary cursor-pointer">
          {busy ? "Saving…" : "Save Edited Record"}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => setEditMode(true)} className="btn-primary cursor-pointer">
          <Pencil className="h-4 w-4" /> Edit
        </button>
      )}
    </>
  ) : <span className="text-sm font-medium text-emerald-700">Resolved: {(issue.resolution_action || "").replaceAll("_", " ")}</span>;
  return (
    <WorkflowCaseModal
      id={`monitoring-issue-${issue.id}`}
      title={issue.incoming_name || existing.name || `Monitoring row ${issue.row_number}`}
      subtitle={`Row ${issue.row_number || "—"} · ${issue.issue}`}
      status={issue.status}
      onClose={onClose}
      footer={footer}
      size="wide"
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Detected discrepancies</p>
          <div className="mt-2 space-y-2">
            {(issue.discrepancies?.length ? issue.discrepancies : [{ type: issue.issue, messages: issue.details || [issue.summary] }]).map((item, index) => (
              <div key={`${item.type}-${index}`} className="rounded-lg bg-white/70 px-3 py-2">
                <p className="text-sm font-semibold text-amber-950">{item.type}</p>
                {(item.messages || []).map((message, messageIndex) => <p key={messageIndex} className="mt-0.5 text-xs text-slate-600">{message}</p>)}
              </div>
            ))}
          </div>
        </div>
        <ErrorNote message={error} />
        <div className="grid gap-4 lg:grid-cols-2">
          <ComparisonRecord title="Existing record" icon={Database} record={existing} empty="No matching student record" />
          <ComparisonRecord title="Uploaded record" icon={FileUp} record={uploaded} />
        </div>
        {subjectRows.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-ink">Subject comparison</h3>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs font-bold uppercase text-slate-500"><tr><th className="px-3 py-2">Subject</th><th className="px-3 py-2">Existing</th><th className="px-3 py-2">Uploaded</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{subjectRows.map((row) => <tr key={row.code} className={row.regression ? "bg-amber-50" : ""}><td className="px-3 py-2 font-semibold text-ink">{row.code}</td><td className="px-3 py-2 text-slate-600">{row.existing}</td><td className="px-3 py-2 text-slate-600">{row.uploaded}{row.regression ? " · needs review" : ""}</td></tr>)}</tbody>
              </table>
            </div>
          </section>
        )}
        {editMode && (
          <section className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
            <h3 className="flex items-center gap-2 font-semibold text-ink"><Pencil className="h-4 w-4 text-brand-700" /> Edit uploaded values</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {[['student_number', 'Student ID'], ['first_name', 'First name'], ['last_name', 'Last name'], ['academic_year_entry', 'School Year / AY Entry']].map(([key, label]) => (
                <label key={key} htmlFor={`monitoring-${issue.id}-${key}`} className="text-sm font-semibold text-slate-700">{label}<input id={`monitoring-${issue.id}-${key}`} value={edited[key]} onChange={(event) => setEdited((current) => ({ ...current, [key]: event.target.value }))} className="input mt-1 w-full" /></label>
              ))}
            </div>
            {Object.keys(edited.subjects).length > 0 && <fieldset className="mt-4"><legend className="text-sm font-semibold text-slate-700">Completed subjects</legend><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.keys(edited.subjects).sort().map((code) => <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"><input type="checkbox" checked={Boolean(edited.subjects[code])} onChange={(event) => setEdited((current) => ({ ...current, subjects: { ...current.subjects, [code]: event.target.checked } }))} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" /><span>{code}</span></label>)}</div></fieldset>}
          </section>
        )}
      </div>
    </WorkflowCaseModal>
  );
}

function ComparisonRecord({ title, icon: Icon, record, empty = "No values supplied" }) {
  if (!record || !Object.keys(record).length) return <div className="rounded-xl border border-dashed border-slate-300 p-4"><h3 className="flex items-center gap-2 font-semibold text-ink"><Icon className="h-4 w-4 text-slate-500" /> {title}</h3><p className="mt-4 text-sm text-slate-500">{empty}</p></div>;
  return <section className="rounded-xl border border-slate-200 p-4"><h3 className="flex items-center gap-2 font-semibold text-ink"><Icon className="h-4 w-4 text-brand-700" /> {title}</h3><dl className="mt-4 space-y-3 text-sm">{[["Name", record.name || `${record.first_name || ""} ${record.last_name || ""}`.trim()], ["Student ID", record.student_number], ["School Year", record.academic_year_entry], ["Completed subjects", record.completed_count ?? (record.completed_subjects || []).length]].map(([label, value]) => <div key={label} className="grid grid-cols-[8rem_1fr] gap-2"><dt className="text-slate-500">{label}</dt><dd className="font-semibold text-slate-800">{value || "—"}</dd></div>)}</dl></section>;
}

function ResultStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-100">
      <p className="font-display text-xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — manual entry (fallback)
// ---------------------------------------------------------------------------
function HandoffForm({ meta, context, submit, submitting }) {
  const onboarding = context.onboarding_requirements || [];
  const [form, setForm] = useState({
    program_id: "",
    term_id: "",
    admission_signal: "Admission Confirmed",
    first_name: "",
    last_name: "",
    student_number: "",
    email: "",
    entry_year: new Date().getFullYear(),
    additional_missing_items: "",
    source_reference: "",
    transcript_status: "Not verified",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const derivedRequirements = onboarding.map((item) => {
    let complete = false;
    let evidence = "Missing or not verified";
    if (item === "Admission approval") {
      complete = ["Admission Confirmed", "Enrollment Confirmed"].includes(form.admission_signal);
      evidence = complete ? form.admission_signal : "Admission has not been confirmed";
    } else if (item === "Student profile sheet") {
      complete = Boolean(form.source_reference.trim());
      evidence = complete ? form.source_reference : "Add the source/profile reference";
    } else if (item === "Program assignment") {
      complete = Boolean(form.program_id);
      evidence = complete ? "Selected program" : "Choose a program";
    } else if (item === "Enrollment signal") {
      complete = Boolean(form.term_id && form.admission_signal);
      evidence = complete ? `${form.admission_signal} · selected semester` : "Choose a semester and signal";
    } else if (item === "Official transcript") {
      complete = form.transcript_status === "Received";
      evidence = `Transcript: ${form.transcript_status}`;
    }
    return { item, complete, evidence };
  });

  function onSubmit(e) {
    e.preventDefault();
    submit(form);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Or add a student manually" subtitle="One-off entry — compares received onboarding items against requirements" icon={UserPlus} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input value={form.first_name} onChange={set("first_name")} required />
        </Field>
        <Field label="Last name" required>
          <Input value={form.last_name} onChange={set("last_name")} required />
        </Field>
        <Field label="Program" required>
          <Select
            value={form.program_id}
            onChange={set("program_id")}
            required
            options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </Field>
        <Field label="Entry semester" required>
          <Select value={form.term_id} onChange={set("term_id")} required options={(meta?.terms || []).map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Admission / enrollment signal" required>
          <Select
            value={form.admission_signal}
            onChange={set("admission_signal")}
            placeholder=""
            options={["Admission Confirmed", "Enrollment Confirmed", "For Completion"]}
          />
        </Field>
        <Field label="Entry year">
          <Input type="number" value={form.entry_year} onChange={set("entry_year")} />
        </Field>
        <Field label="Student number" hint="Leave blank to auto-generate">
          <Input value={form.student_number} onChange={set("student_number")} placeholder="2026-0001" />
        </Field>
        <Field label="Email" hint="Leave blank to auto-generate">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
      </div>

      <Field label="Official transcript">
        <Select
          value={form.transcript_status}
          onChange={set("transcript_status")}
          placeholder=""
          options={["Received", "Not received", "Not verified"]}
        />
      </Field>

      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-sm font-semibold text-ink">Automatic handoff requirement check</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Statuses are derived from the form and stored evidence; there are no manual “received” checkboxes.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2.5">Requirement</th>
                <th className="px-3 py-2.5">Evidence used</th>
                <th className="px-4 py-2.5 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {derivedRequirements.map((requirement) => (
                <tr key={requirement.item} className="border-b border-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-ink">{requirement.item}</td>
                  <td className="px-3 py-2.5 text-slate-500">{requirement.evidence}</td>
                  <td className="px-4 py-2.5 text-right">
                    <StatusBadge value={requirement.complete ? "Complete" : "Missing"} dot={false} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Field label="Other missing items" hint="Comma- or line-separated, optional">
        <Textarea value={form.additional_missing_items} onChange={set("additional_missing_items")} />
      </Field>
      <Field label="Source reference" hint="e.g. AIMS batch, email subject">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>

      <SubmitButton submitting={submitting}>Create monitoring record</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Course Audit — roster (by subject) or sheet upload
// ---------------------------------------------------------------------------
function CourseAuditPanel({ meta }) {
  return (
    <Card className="p-6">
      <SectionTitle
        title="Course records are read-only"
        subtitle="USLS grades remain in AIMS and are not encoded again in this portal."
        icon={Database}
      />
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        <p className="font-semibold">Use the dedicated coursework modules:</p>
        <p className="mt-1 leading-relaxed">
          Enrollment tags students into declared offerings. The Monitoring Sheet then reflects the term-scoped source records automatically and remains read-only.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link to="/monitoring-sheet" className="btn-primary"><Table2 className="h-4 w-4" /> Open Monitoring Sheet</Link>
        <Link to="/enrollment" className="btn-ghost"><BookOpenCheck className="h-4 w-4" /> Open Enrollment</Link>
      </div>
    </Card>
  );
}



// ---------------------------------------------------------------------------
// Course Audit (legacy single-student form — retained but unused)
// ---------------------------------------------------------------------------
function CourseAuditForm({ context, studentId, submit, submitting }) {
  const audit = context.course_audit;
  const [form, setForm] = useState({ course_id: "", status: "Completed", term_label: "", evidence_reference: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (panel.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={CalendarCheck} title="Panel matching is required" hint="The calendar stays empty until this student has an assigned panel. This prevents schedules from being created against the wrong or incomplete participant list." />
        <div className="mt-4 flex justify-center">
          <Link to={`/workflow/panel-matching?student_id=${studentId}`} className="btn-primary">
            Open Panel Matching <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Update course audit" subtitle="Map a subject's status against curriculum requirements" icon={ClipboardCheck} />
      {audit && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniBox label="Completed" value={audit.completed.length} tone="brand" />
          <MiniBox label="Current" value={audit.current.length} tone="blue" />
          <MiniBox label="Incomplete" value={audit.incomplete.length} tone="amber" />
          <MiniBox label="Missing" value={audit.missing.length} tone="red" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subject" required>
          <Select
            value={form.course_id}
            onChange={set("course_id")}
            required
            options={(context.courses || []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
          />
        </Field>
        <Field label="Status" required>
          <Select value={form.status} onChange={set("status")} placeholder="" options={["Completed", "Current", "Missing", "Incomplete"]} />
        </Field>
        <Field label="Academic year / semester taken">
          <Input value={form.term_label} onChange={set("term_label")} placeholder="AY 2025-2026 1st Semester" />
        </Field>
        <Field label="Evidence reference">
          <Input value={form.evidence_reference} onChange={set("evidence_reference")} placeholder="Monitoring sheet row / grade slip" />
        </Field>
      </div>
      <SubmitButton submitting={submitting}>Save audit update</SubmitButton>

      {context.offering_demand?.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Subject demand (offerings planning)</p>
          <ul className="space-y-1.5">
            {context.offering_demand.slice(0, 6).map((row) => (
              <li key={row.code} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold">{row.code}</span> · {row.title}
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{row.count} students</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Research Gate
// ---------------------------------------------------------------------------
function ResearchGateForm({ context, studentId, submit, submitting, result, submitError }) {
  const { user } = useAuth();
  const student = context.selected_student || {};
  const researchCase = context.research_case || {};
  const progress = context.research_progress || {};
  const milestone = context.current_milestone || progress.milestone || {};
  const requirements = milestone.requirements || [];
  const [ethicsReview, setEthicsReview] = useState({ status: "Cleared", date: new Date().toISOString().slice(0, 10) });
  const completed = requirements.filter((item) => item.status === "Complete");
  const pending = requirements.filter((item) => item.status !== "Complete");
  const panel = context.panel_status || {};
  const scheduleRequirement = requirements.find((item) => item.source_type?.includes("schedule"));
  const outcomeRequirement = requirements.find((item) => item.source_type === "system_defense_result");

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId });
  }

  function recordEthicsClearance() {
    submit({
      student_id: studentId,
      ethics_clearance_status: ethicsReview.status,
      ethics_clearance_date: ethicsReview.date,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Research Gate record"
        subtitle="The stage and checklist are calculated from uploads, endorsements, and workflow results"
        icon={FileCheck}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {[
          ["Student", student.name], ["Student ID", student.student_number], ["Program", student.program_name],
          ["Adviser", student.adviser_name || "Not assigned"], ["Research title", researchCase.title || "Pending Form 1"], ["Current stage", progress.stage || "Title Defense"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-semibold text-ink">{value}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="field-label">Automatic research progress</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-4">
          {(progress.stages || []).map((stage, index) => (
            <div key={stage.name} className={`rounded-xl border px-3 py-3 ${index === progress.stage_index ? "border-brand-300 bg-brand-50" : stage.complete ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"}`}>
              <p className={`text-xs font-bold ${index === progress.stage_index ? "text-brand-700" : stage.complete ? "text-emerald-700" : "text-slate-500"}`}>{stage.name}</p>
              <p className="mt-1 text-[11px] text-slate-500">{stage.status}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniBox label="Completed requirements" value={completed.length} tone="brand" />
        <MiniBox label="Pending requirements" value={pending.length} tone={pending.length ? "amber" : "brand"} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div><p className="field-label">{progress.stage || "Current"} requirements</p><p className="text-xs text-slate-500">Uploaded and pending documents appear together. Open any file to preview it.</p></div>
          <StatusBadge value={progress.status || "Pending"} dot={false} />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {requirements.map((requirement) => (
            <div key={requirement.item_name} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
                  <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">{requirement.student_upload ? `Student upload · ${requirement.file_count}/${requirement.required_file_count} files` : "Staff / system managed"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
                  <StatusBadge value={requirement.status_label} dot={false} />
                  {requirement.source_type === "coordinator_endorsement" && user?.role === "academic_coordinator" && (
                    <a href="#form1-endorsement-queue" className="btn-primary cursor-pointer justify-center whitespace-nowrap">
                      <UserRoundCheck className="h-4 w-4" /> Form 1 endorsements
                    </a>
                  )}
                  {requirement.item_name === "Ethics Clearance" && user?.role === "research_coordinator" && (
                    <button type="button" disabled={!requirement.files?.length} onClick={() => document.getElementById("ethics-clearance-record")?.scrollIntoView({ behavior: "smooth", block: "center" })} className="btn-ghost cursor-pointer justify-center whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60">
                      <FileCheck className="h-4 w-4" /> Record clearance
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(requirement.files || []).map((file) => (
                  <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition-colors hover:bg-brand-100">
                    {file.name} · PDF · {formatDate(file.uploaded_at)} <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {requirements.some((item) => item.item_name === "Ethics Clearance") && (
        <section id="ethics-clearance-record" className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Research Protocol Form 5.2 ethics clearance</p>
              <p className="mt-1 text-xs text-slate-500">Preview the signed Ethics Office form, then record the clearance status and date before panel matching or scheduling can proceed.</p>
            </div>
            <StatusBadge value={requirements.find((item) => item.item_name === "Ethics clearance status and date")?.status_label || "Pending"} dot={false} />
          </div>
          {user?.role === "research_coordinator" && (
            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <Field label="Clearance status">
                <Select value={ethicsReview.status} onChange={(event) => setEthicsReview((current) => ({ ...current, status: event.target.value }))} options={["Cleared", "Returned", "Not cleared"]} />
              </Field>
              <Field label="Clearance date">
                <Input type="date" value={ethicsReview.date} onChange={(event) => setEthicsReview((current) => ({ ...current, date: event.target.value }))} />
              </Field>
              <button type="button" disabled={submitting} onClick={recordEthicsClearance} className="btn-primary mt-6 cursor-pointer px-4 py-2">
                <CheckCircle2 className="h-4 w-4" /> Record ethics clearance
              </button>
            </div>
          )}
        </section>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Panel Matching</p><p className="text-xs text-slate-500">System-generated from the active paper body after required clearances.</p></div>
          <div className="flex items-center gap-2"><StatusBadge value={panel.status || "Not yet generated"} dot={false} /><Link to={`/workflow/panel-matching?student_id=${studentId}`} className="btn-ghost cursor-pointer">Open matching <ArrowUpRight className="h-4 w-4" /></Link></div>
        </div>
        {panel.recommendations?.length > 0 && <p className="mt-2 text-xs text-slate-600">{panel.recommendations.map((item) => item.faculty_name).filter(Boolean).join(" · ")}</p>}
      </div>

      <SubmitButton submitting={submitting}>Verify submitted requirements</SubmitButton>
      <WorkflowSubmitFeedback result={result} error={submitError} />

      {outcomeRequirement && (
        <section className={`rounded-2xl border p-5 ${outcomeRequirement.status === "Complete" ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/70"}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Defense result gate</p>
              <h3 className="mt-1 font-display text-lg font-semibold text-ink">{outcomeRequirement.label}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {scheduleRequirement?.status === "Complete"
                  ? "Record whether the scheduled defense was passed before the student can move to the next Research Gate stage."
                  : "Confirm the defense schedule first. The student cannot move to the next Research Gate stage until a passing result is recorded."}
              </p>
            </div>
            <StatusBadge value={outcomeRequirement.status_label} dot={false} />
          </div>
          {user?.role === "staff" && <p className="mt-4 text-xs font-semibold text-slate-600">Read-only for GS staff. The assigned panel chair or panel lead submits the verdict from the Faculty Portal.</p>}
        </section>
      )}

      {user?.role === "academic_coordinator" && (
        <section id="form1-endorsement-queue" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <Form1EndorsementQueue embedded />
        </section>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Panel Matching
// ---------------------------------------------------------------------------
function PanelMatchingForm({ context, studentId, submit, submitting, refetch }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filters, setFilters] = useState({ query: "", specialization: "", college: "", availability: "" });
  const roles = context.panel_roles || [];
  const profile = context.matching_profile || {};
  const recs = profile.ready ? context.panel_recommendations || [] : [];
  const searchActive = Object.values(filters).some((value) => value.trim());
  const filteredRecommendations = recs.filter((item) => {
    const query = filters.query.trim().toLowerCase();
    const specialization = filters.specialization.toLowerCase();
    const college = filters.college.toLowerCase();
    const queryHaystack = [
      item.faculty_name,
      item.college,
      item.specialization,
      item.availability_status,
      item.note,
      ...(item.matched_keywords || []),
    ].filter(Boolean).join(" ").toLowerCase();
    return (!query || queryHaystack.includes(query))
      && (!specialization || item.specialization.toLowerCase().includes(specialization))
      && (!college || item.college.toLowerCase().includes(college))
      && (!filters.availability || item.availability_status === filters.availability);
  });
  const visibleRecommendations = searchActive ? filteredRecommendations : recs.slice(0, PANEL_MATCHING_DEFAULT_LIMIT);
  const displayedCandidateIds = new Set(visibleRecommendations.map((item) => item.faculty_id));
  const selectedOutsideView = recs.filter((item) => selectedIds.includes(item.faculty_id) && !displayedCandidateIds.has(item.faculty_id));
  const selectorOptions = [...visibleRecommendations, ...selectedOutsideView];
  const rankByFacultyId = new Map(recs.map((item, index) => [item.faculty_id, index + 1]));
  const defaultLimited = !searchActive && recs.length > PANEL_MATCHING_DEFAULT_LIMIT;
  const finalizedPanel = context.assigned_panel || [];
  const recommendedCount = Math.min(PANEL_MATCHING_RECOMMENDED_COUNT, roles.length || PANEL_MATCHING_RECOMMENDED_COUNT, recs.length);
  const topRecommendedIds = new Set(recs.slice(0, recommendedCount).map((item) => item.faculty_id));
  const selectionComplete = selectedIds.length === roles.length && new Set(selectedIds).size === roles.length;
  const sourceLabel = profile.source_label || "research manuscript";
  const documentCount = profile.document_count ?? profile.concept_paper_count ?? 0;
  const readableCount = profile.readable_document_count ?? profile.readable_paper_count ?? 0;
  const requiredCount = profile.required_file_count || 1;
  const ragModeLabel = {
    "document-rag": "Document RAG",
    "local-rag": "Local RAG",
    "local-rag-fallback": "Local RAG fallback",
    waiting: "Waiting for RAG",
  }[profile.rag_mode] || "RAG analysis";
  const ragStatus = profile.ready ? `Analyzed with ${ragModeLabel}` : "Waiting for RAG analysis";

  useEffect(() => {
    const finalizedIds = finalizedPanel.map((item) => item.faculty_id).filter(Boolean);
    const recommendedIds = recs.slice(0, recommendedCount).map((item) => item.faculty_id);
    setSelectedIds(finalizedIds.length === roles.length ? finalizedIds : recommendedIds);
  }, [studentId, roles.length, recommendedCount, recs.map((item) => item.faculty_id).join(","), finalizedPanel.map((item) => item.faculty_id).join(",")]);

  function onSubmit(e) {
    e.preventDefault();
    if (!profile.ready || !selectionComplete) return;
    submit({ student_id: studentId, faculty_ids: selectedIds });
  }

  function selectFaculty(index, value) {
    setSelectedIds((current) => {
      const next = [...current];
      next[index] = Number(value);
      return next;
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Panel recommendation workspace" subtitle="Review the research evidence, adjust the RAG-generated shortlist, then finalize the panel" icon={Users} action={<Link to="/faculty" className="btn-ghost cursor-pointer"><Users className="h-4 w-4" /> Faculty profiles</Link>} />
      <div className={`rounded-xl border px-4 py-3 ${profile.ready ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${profile.ready ? "text-brand-800" : "text-amber-900"}`}>
              {profile.ready ? `${sourceLabel} content ready` : profile.blocked_reason || `Readable ${sourceLabel} PDF text is required`}
            </p>
            <p className={`mt-1 text-xs ${profile.ready ? "text-brand-700" : "text-amber-800"}`}>
              {documentCount} of {requiredCount} PDFs uploaded. {readableCount} of {requiredCount} successfully read. Source: {profile.source || "No research evidence yet"}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={ragStatus} dot={false} />
            <StatusBadge value={profile.ready ? "Ready" : "Blocked"} dot={false} />
          </div>
        </div>
        <div className={`mt-3 rounded-lg border px-3 py-2 text-xs ${profile.ready ? "border-brand-200 bg-white/80 text-brand-800" : "border-amber-200 bg-white/70 text-amber-900"}`}>
          <p className="font-semibold">{ragStatus}</p>
          <p className="mt-1 leading-relaxed">
            {profile.ready
              ? profile.rag_summary || "The uploaded document body was analyzed against faculty specializations before ranking panel candidates."
              : profile.blocked_reason || "Upload readable source PDFs so the system can run RAG analysis for panel matching."}
          </p>
        </div>
        {profile.research_title && <p className="mt-3 text-sm font-medium text-slate-700">Research title <span className="font-normal text-slate-500">(display only; excluded from matching)</span>: {profile.research_title}</p>}
        {profile.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{keyword}</span>)}
          </div>
        )}
        {profile.concept_papers?.length > 0 && (
          <div className="mt-4 grid gap-2">
            {profile.concept_papers.slice(0, 3).map((paper) => (
              <div key={paper.id} className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand-700">{paper.name}</a>
                  <StatusBadge value={paper.extracted ? "Text extracted" : "No readable text"} dot={false} />
                </div>
                {paper.keywords?.length > 0 && (
                  <p className="mt-2 text-slate-500">Analyzed keywords: {paper.keywords.slice(0, 5).join(", ")}</p>
                )}
                {paper.excerpt && <p className="mt-2 leading-relaxed text-slate-500">{paper.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <MiniBox label="Specialization / keywords" value="50%" tone="brand" />
        <MiniBox label="Availability" value="30%" tone="blue" />
        <MiniBox label="Workload / suitability" value="20%" tone="amber" />
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm text-slate-600">{context.research_case_type || "Thesis"} panel needs {roles.length} members: {roles.join(", ")}. Recommendations refresh automatically from the active stage uploads.</p>
      </div>

      <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label><span className="field-label">Search faculty</span><input className="field-input" value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Name, expertise, keyword, department" /></label>
        <label><span className="field-label">Specialization</span><input className="field-input" value={filters.specialization} onChange={(event) => setFilters((current) => ({ ...current, specialization: event.target.value }))} placeholder="e.g. analytics" /></label>
        <label><span className="field-label">Department / program</span><input className="field-input" value={filters.college} onChange={(event) => setFilters((current) => ({ ...current, college: event.target.value }))} placeholder="Search college" /></label>
        <label><span className="field-label">Availability</span><select className="field-input cursor-pointer" value={filters.availability} onChange={(event) => setFilters((current) => ({ ...current, availability: event.target.value }))}><option value="">All availability</option><option>Available</option><option>Limited availability</option><option>No availability recorded</option></select></label>
      </div>

      {profile.ready && recs.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <span>{searchActive ? `Showing ${visibleRecommendations.length} matching faculty from ${recs.length} ranked candidates.` : `Showing the top ${Math.min(PANEL_MATCHING_DEFAULT_LIMIT, recs.length)} ranked candidates.`} The top {recommendedCount} are highlighted and preselected.</span>
          {defaultLimited && <span className="font-medium text-brand-700">Use search or filters to find the other {recs.length - PANEL_MATCHING_DEFAULT_LIMIT} faculty.</span>}
        </div>
      )}

      {profile.ready && visibleRecommendations.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {searchActive ? "No faculty match the current search. Clear or broaden the filters to return to the top 15." : "No eligible faculty profiles were found. Add an active faculty profile with specialization and availability data, then run matching again."}
        </div>
      )}

      {visibleRecommendations.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[920px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Rank / faculty</th>
              <th className="px-3 py-3">Expertise match</th>
              <th className="px-3 py-3">Availability</th>
              <th className="px-3 py-3">Workload</th>
              <th className="px-3 py-3 text-right">Match score</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecommendations.map((r) => {
              const rank = rankByFacultyId.get(r.faculty_id);
              const isTopRecommended = topRecommendedIds.has(r.faculty_id);
              const isSelected = selectedIds.includes(r.faculty_id);
              const rowClass = isTopRecommended
                ? "bg-emerald-50/80 ring-1 ring-inset ring-emerald-200"
                : isSelected
                  ? "bg-brand-50/50"
                  : "bg-white";
              return (
              <tr key={r.faculty_id} className={`border-b border-slate-100 last:border-0 ${rowClass}`}>
                <td className="px-4 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${isTopRecommended ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{rank}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link to={`/faculty?faculty=${r.faculty_id}`} className="font-semibold text-ink transition-colors hover:text-brand-700 hover:underline">{r.faculty_name}</Link>
                        {isTopRecommended && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Top 4 recommended</span>}
                        {isSelected && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-700">Selected</span>}
                      </div>
                      <p className="text-xs text-slate-500">{r.college}</p>
                    </div>
                  </div>
                </td>
                <td className="max-w-[300px] px-3 py-2.5 text-slate-600">
                  <p>{r.specialization}</p>
                  <p className="mt-1 text-xs text-brand-700">{r.matched_keywords?.length ? `Matched: ${r.matched_keywords.slice(0, 4).join(", ")}` : "No direct keyword overlap"}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.note}</p>
                </td>
                <td className="px-3 py-2.5"><p className="font-medium text-slate-700">{r.availability_status}</p><p className="text-xs text-slate-400">{r.availability_windows} conflict-free windows</p></td>
                <td className="px-3 py-2.5"><p className="font-medium text-slate-700">{r.workload} active</p><p className="text-xs text-slate-400">panel assignments</p></td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{r.score}/100</span>
                  <p className="mt-1 whitespace-nowrap text-[10px] text-slate-400">{r.score_breakdown?.specialization}/50 · {r.score_breakdown?.availability}/30 · {r.score_breakdown?.suitability}/20</p>
                </td>
              </tr>
            );})}
          </tbody>
        </table>
      </div>}

      {visibleRecommendations.length > 0 && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-sm font-semibold text-ink">Review and adjust the panel set</p><p className="mt-0.5 text-xs text-slate-500">The top 4 recommended faculty are preselected. Staff may change any role before finalizing.</p></div>
          <StatusBadge value={finalizedPanel.length === roles.length ? "Final panel selected" : "Staff review"} dot={false} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {roles.map((role, index) => (
            <label key={role} className="block text-xs font-semibold text-slate-600">
              {role}
              <select value={selectedIds[index] || ""} onChange={(event) => selectFaculty(index, event.target.value)} className="mt-1.5 w-full cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100">
                <option value="">Select faculty</option>
                {selectorOptions.map((item) => <option key={item.faculty_id} value={item.faculty_id}>#{rankByFacultyId.get(item.faculty_id)} {item.faculty_name} - {item.score}/100</option>)}
              </select>
            </label>
          ))}
        </div>
        {!selectionComplete && <p className="mt-3 text-xs font-medium text-amber-700">Choose a different eligible faculty member for every required role.</p>}
      </div>}

      <button type="submit" disabled={submitting || !profile.ready || !selectionComplete} className="btn-primary w-full cursor-pointer sm:w-auto">
        <CheckCircle2 className="h-4 w-4" /> {submitting ? "Finalizing..." : finalizedPanel.length === roles.length ? "Update final panel" : "Finalize selected panel"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Defense Scheduling
// ---------------------------------------------------------------------------
function DefenseSchedulingForm({ context, studentId, submit, submitting, result, submitError }) {
  const availability = context.availability || {};
  const readiness = context.schedule_readiness || {};
  const participants = availability.participants || [];
  const possibleSlots = availability.possible_slots || [];
  const schedules = context.schedules || [];
  const [form, setForm] = useState({
    preferred_date: "",
    preferred_end_date: "",
    selected_start: "",
    selected_end: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
    override_requirements: false,
    override_conflicts: false,
  });
  const [window, setWindow] = useState({ start: "", end: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const panel = context.assigned_panel || [];
  const requiredPanelCount = context.panel_roles?.length || 4;
  const panelComplete = panel.length >= requiredPanelCount;
  const facultyDirectory = context.faculty_directory || [];
  const panelRoleLabels = context.panel_roles || [];
  const [editingPanel, setEditingPanel] = useState(false);
  const [panelEditIds, setPanelEditIds] = useState([]);
  const chosenPanelIds = panelEditIds.filter((id) => id);
  const panelSelectionValid = chosenPanelIds.length === requiredPanelCount && new Set(chosenPanelIds).size === requiredPanelCount;
  function updatePanel() {
    if (!panelSelectionValid) return;
    submit({ student_id: studentId, panel_faculty_ids: chosenPanelIds, reassign_only: true });
    setEditingPanel(false);
  }
  const isFailedStageRetry = schedules.some(
    (schedule) => schedule.defense_type === form.defense_type && schedule.defense_outcome === "Failed"
  );

  useEffect(() => {
    setWindow({
      start: availability.window_start || "",
      end: availability.window_end || "",
    });
    setForm((current) => ({
      ...current,
      preferred_date: "",
      preferred_end_date: availability.window_end || "",
      selected_start: "",
      selected_end: "",
      defense_type: readiness.stage || "Proposal Defense",
      override_requirements: false,
      override_conflicts: false,
    }));
  }, [studentId, availability.window_start, availability.window_end, readiness.stage]);

  useEffect(() => {
    setPanelEditIds(panel.map((member) => member.faculty_id));
    setEditingPanel(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studentId, panel.map((member) => member.faculty_id).join(",")]);

  const filteredSlots = useMemo(
    () =>
      possibleSlots
        .filter(
          (slot) =>
            slot.conflict_free !== false &&
            (!window.start || slot.date >= window.start) &&
            (!window.end || slot.date <= window.end)
        )
        .sort((left, right) => `${left.date}${left.start}`.localeCompare(`${right.date}${right.start}`)),
    [possibleSlots, window]
  );
  const blockedSlots = useMemo(
    () =>
      possibleSlots.filter(
        (slot) =>
          slot.conflict_free === false &&
          (!window.start || slot.date >= window.start) &&
          (!window.end || slot.date <= window.end)
      ),
    [possibleSlots, window]
  );

  const visibleDates = useMemo(() => {
    const recordedDates = new Set();
    participants.forEach((participant) => {
      participant.slots.forEach((slot) => {
        recordedDates.add(slot.date);
      });
    });
    if (!window.start || !window.end) return [...recordedDates].sort().slice(0, 14);
    const dates = [];
    const cursor = new Date(`${window.start}T00:00:00`);
    const end = new Date(`${window.end}T00:00:00`);
    while (cursor <= end && dates.length < 14) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      if (!weekend || recordedDates.has(isoDate)) dates.push(isoDate);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [participants, window]);

  const possibleDates = useMemo(
    () => new Set(filteredSlots.map((slot) => slot.date)),
    [filteredSlots]
  );

  function chooseSlot(slot) {
    setForm((current) => ({
      ...current,
      preferred_date: slot.date,
      selected_start: slot.start,
      selected_end: slot.end,
    }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form, preferred_end_date: window.end || form.preferred_date });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Coordinate the defense schedule"
        subtitle="Review readiness and the matched panel, compare overlap, then make the final staff decision"
        icon={CalendarCheck}
      />
      <section aria-labelledby="student-readiness-heading" className={`rounded-2xl border p-5 ${readiness.ready ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p id="student-readiness-heading" className="text-xs font-bold uppercase tracking-wide text-slate-500">Student readiness</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-ink">{readiness.stage || "Research stage unavailable"}</h3>
            <p className="mt-1 text-sm text-slate-600">{readiness.research_title || "Research title not recorded"}</p>
            <p className="mt-1 text-xs text-slate-500">Adviser: {readiness.adviser_name || "Not assigned"}</p>
          </div>
          <StatusBadge value={readiness.ready ? "Requirements complete" : readiness.status || "Pending requirements"} />
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {(readiness.requirements || []).map((item) => (
            <div key={item.item_name} className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2.5 ring-1 ring-black/5">
              {item.status === "Complete" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
              <div><p className="text-sm font-semibold text-slate-700">{item.label || item.item_name}</p><p className="text-xs text-slate-500">{item.status_label || item.status}</p></div>
            </div>
          ))}
        </div>
        {!readiness.ready && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-amber-300 bg-white px-3.5 py-3 text-sm text-amber-900">
            <input type="checkbox" checked={form.override_requirements} onChange={(e) => setForm((current) => ({ ...current, override_requirements: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-amber-400" />
            <span><strong>Staff override:</strong> I reviewed the pending Research Gate requirements and still want to schedule this defense.</span>
          </label>
        )}
      </section>

      <section aria-labelledby="panel-members-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><p id="panel-members-heading" className="text-sm font-semibold text-ink">Panel members</p><p className="text-xs text-slate-500">Matched panel is the default — you can reassign from the full faculty list</p></div>
          <div className="flex items-center gap-2">
            <StatusBadge value={panelComplete ? `${panel.length} selected` : `${panel.length}/${requiredPanelCount} selected`} />
            <button type="button" onClick={() => setEditingPanel((value) => !value)} className="btn-ghost cursor-pointer px-3 py-1.5 text-xs">{editingPanel ? "Close" : "Change panel"}</button>
          </div>
        </div>
        {editingPanel && (
          <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
            <p className="text-xs font-semibold text-brand-700">Reassign the defense panel — pick {requiredPanelCount} faculty from the full directory. This updates the student's official panel for this gate, then availability recomputes.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: requiredPanelCount }).map((_, idx) => (
                <label key={idx} className="block">
                  <span className="field-label">{panelRoleLabels[idx] || `Panel member ${idx + 1}`}</span>
                  <select
                    className="field-input cursor-pointer"
                    value={panelEditIds[idx] || ""}
                    onChange={(event) => {
                      const next = [...panelEditIds];
                      next[idx] = event.target.value ? Number(event.target.value) : "";
                      setPanelEditIds(next);
                    }}
                  >
                    <option value="">Select faculty…</option>
                    {facultyDirectory.map((faculty) => (
                      <option
                        key={faculty.faculty_id}
                        value={faculty.faculty_id}
                        disabled={panelEditIds.includes(faculty.faculty_id) && panelEditIds[idx] !== faculty.faculty_id}
                      >
                        {faculty.name}{faculty.specialization ? ` — ${faculty.specialization}` : ""} · {faculty.upcoming_windows} slot{faculty.upcoming_windows === 1 ? "" : "s"} · load {faculty.workload}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {facultyDirectory.length === 0 && <p className="text-xs text-amber-700">No faculty with an active login are available to assign yet.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={updatePanel} disabled={submitting || !panelSelectionValid} className="btn-primary cursor-pointer px-4 py-2 text-sm">{submitting ? "Updating…" : "Update panel"}</button>
              <button type="button" onClick={() => { setPanelEditIds(panel.map((member) => member.faculty_id)); setEditingPanel(false); }} className="btn-ghost cursor-pointer px-4 py-2 text-sm">Cancel</button>
              {!panelSelectionValid && <span className="self-center text-xs text-slate-500">Choose {requiredPanelCount} different faculty to enable Update.</span>}
            </div>
          </div>
        )}
        {panel.length ? <div className="grid gap-3 sm:grid-cols-2">
          {panel.map((member) => {
            const participant = participants.find((item) => item.faculty_id === member.faculty_id);
            return <div key={member.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{member.faculty_name}</p><p className="text-xs font-semibold text-brand-700">{member.panel_role}</p></div><StatusBadge value={participant?.calendar_status || "Profile only"} /></div>
              <p className="mt-3 text-xs text-slate-500">{member.college || "Department not recorded"}</p>
              <p className="mt-1 text-sm text-slate-700">{member.specialization || "Specialization not recorded"}</p>
            </div>;
          })}
        </div> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No final panel is available. Complete Panel Matching before scheduling.</div>}
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Monday-Friday use faculty working hours. Profile commitments and Google Calendar busy times are removed.</span>
        <Link to="/faculty" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">View faculty profiles <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
      <AvailabilityWorkspace
        availability={availability}
        participants={participants}
        filteredSlots={filteredSlots}
        blockedSlots={blockedSlots}
        visibleDates={visibleDates}
        possibleDates={possibleDates}
        window={window}
        setWindow={setWindow}
        form={form}
        chooseSlot={chooseSlot}
      />
      <div className="border-t border-slate-200 pt-5"><p className="text-sm font-semibold text-ink">Final schedule</p><p className="text-xs text-slate-500">Only staff can finalize this stage schedule.</p></div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Selected date" required>
          <Input type="date" value={form.preferred_date} min={availability.today || window.start} max={window.end} onChange={set("preferred_date")} required />
        </Field>
        <Field label="Start time" required>
          <Input type="time" value={form.selected_start} onChange={set("selected_start")} required />
        </Field>
        <Field label="End time" required>
          <Input type="time" value={form.selected_end} min={form.selected_start} onChange={set("selected_end")} required />
        </Field>
        <Field label="Defense type" required>
          <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={["Title Defense", "Proposal Defense", "Final Defense", "Public Final Defense"]} />
        </Field>
        <Field label="Mode" required>
          <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
        </Field>
        <Field label="Venue / meeting link">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" value={form.venue} onChange={set("venue")} placeholder="GS Conference Room / Zoom link" />
          </div>
        </Field>
      </div>
      <Field label="Scheduling constraints">
        <Textarea value={form.constraints} onChange={set("constraints")} placeholder="e.g. external panel only available afternoons" />
      </Field>
      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3 text-sm text-slate-700">
        <input type="checkbox" checked={form.override_conflicts} onChange={(e) => setForm((current) => ({ ...current, override_conflicts: e.target.checked }))} className="mt-0.5 h-4 w-4 rounded border-slate-400" />
        <span><strong>Lead-time override:</strong> finalize despite lead-time warnings. Booked panelists, same-student overlaps, and unavailable panel windows cannot be overridden.</span>
      </label>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <button type="submit" disabled={submitting || !form.preferred_date || !panelComplete || (!readiness.ready && !form.override_requirements)} className="btn-primary w-full sm:w-auto">
        {submitting ? "Saving..." : isFailedStageRetry ? "Finalize reschedule" : "Set defense schedule"}
      </button>
      <WorkflowSubmitFeedback result={result} error={submitError} />
      {schedules.length > 0 && <ScheduleHistory schedules={schedules} />}
    </form>
  );
}

function AvailabilityWorkspace({
  availability,
  participants,
  filteredSlots,
  blockedSlots,
  visibleDates,
  possibleDates,
  window,
  setWindow,
  form,
  chooseSlot,
}) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Preferred date window</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The system searches for a {availability.duration_minutes || 120}-minute overlap.
            </p>
            {availability.lead_days > 0 && (
              <p className="mt-1 text-xs font-semibold text-brand-700">
                {availability.lead_days}-day lead time applied. Suggestions begin {shortDate(availability.earliest_schedule_date)}.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
            <Field label="From">
              <Input
                type="date"
                value={window.start}
                min={availability.earliest_schedule_date}
                onChange={(e) => setWindow((current) => ({ ...current, start: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={window.end}
                min={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, end: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </div>

      {participants.length > 0 && visibleDates.length > 0 && (
        <section aria-labelledby="availability-overlap-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="availability-overlap-heading" className="text-sm font-semibold text-ink">Availability overlap</p>
              <p className="text-xs text-slate-500">Darker green means more participants are free. Amber full-overlap cells are already booked and cannot be selected.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>0/{participants.length}</span><span className="h-4 w-5 rounded bg-slate-100 ring-1 ring-slate-200" /><span className="h-4 w-5 rounded bg-emerald-200" /><span className="h-4 w-5 rounded bg-emerald-600" /><span>{participants.length}/{participants.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[720px] w-full border-collapse text-center text-xs">
              <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Time</th>{visibleDates.map((day) => <th key={day} className="border-b border-slate-200 px-2 py-3 font-semibold text-slate-700">{shortDate(day)}</th>)}</tr></thead>
              <tbody>
                {Array.from({ length: 20 }, (_, index) => 8 * 60 + index * 30).map((minutes) => {
                  const start = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
                  return <tr key={start}>
                    <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-white px-2 py-2 text-left font-medium text-slate-500">{formatTime(start)}</th>
                    {visibleDates.map((day) => {
                      const count = participants.filter((participant) => {
                        const available = participant.slots.some((slot) => slot.date === day && slot.start <= start && slot.end > start);
                        const busy = [...(participant.profile_busy || []), ...(participant.google_busy || [])]
                          .some((block) => block.date === day && block.start <= start && block.end > start);
                        return available && !busy;
                      }).length;
                      const option = filteredSlots.find((slot) => slot.date === day && slot.start === start);
                      const blockedOption = blockedSlots.find((slot) => slot.date === day && slot.start === start);
                      const selected = form.preferred_date === day && form.selected_start === start;
                      const tone = blockedOption ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200" : count === participants.length ? "bg-emerald-600 text-white hover:bg-emerald-700" : count >= Math.ceil(participants.length * 0.66) ? "bg-emerald-300 text-emerald-950" : count ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-slate-400";
                      return <td key={day} className="border-t border-slate-200 p-1"><button type="button" disabled={!option} onClick={() => option && chooseSlot(option)} aria-label={`${shortDate(day)} ${start}: ${count} of ${participants.length} available${blockedOption ? ", already booked" : option ? ", selectable" : ""}`} title={blockedOption?.conflicts?.join(" ")} className={`min-h-8 w-full rounded-md px-1 py-1.5 font-bold transition-colors ${tone} ${option ? "cursor-pointer focus:ring-2 focus:ring-brand-500 focus:ring-offset-1" : "cursor-not-allowed"} ${selected ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}>{count}/{participants.length}</button></td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {participants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Panel availability</p>
              <p className="text-xs text-slate-500">Detailed source availability for each adviser and panelist.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {participants.length} participants
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  {participants.map((participant) => (
                    <th key={participant.faculty_id} className="min-w-44 border-b border-slate-200 px-3 py-3">
                      <p className="font-semibold text-ink">{participant.name}</p>
                      <p className="mt-0.5 text-xs font-normal text-slate-500">{participant.role} · {participant.college}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        participant.calendar_connected
                          ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {participant.calendar_connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {participant.calendar_status || (participant.calendar_connected ? "Google checked" : "Profile only")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDates.map((day) => {
                  const hasOverlap = possibleDates.has(day);
                  return (
                    <tr key={day} className={hasOverlap ? "bg-brand-50/55" : "bg-white"}>
                      <td className={`sticky left-0 z-10 border-r border-t border-slate-200 px-3 py-3 ${hasOverlap ? "bg-brand-50" : "bg-white"}`}>
                        <p className="font-semibold text-ink">{shortDate(day)}</p>
                        {hasOverlap && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">Overlap found</p>}
                      </td>
                      {participants.map((participant) => {
                        const slots = participant.slots.filter((slot) => slot.date === day);
                        const busy = [...(participant.profile_busy || []), ...(participant.google_busy || [])]
                          .filter((slot) => slot.date === day);
                        return (
                          <td key={participant.faculty_id} className="border-t border-slate-200 px-3 py-3 align-top">
                            {slots.length || busy.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {slots.map((slot) => (
                                  <span
                                    key={`${slot.start}-${slot.end}`}
                                    className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                  >
                                    {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                                {busy.map((slot) => (
                                  <span key={`busy-${slot.start}-${slot.end}`} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                                    Busy {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">Unavailable</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleDates.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">No availability was recorded inside this date window.</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Best shared options</p>
            <p className="text-xs text-slate-500">Select one to prepare the proposed schedule.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filteredSlots.length} conflict-free found
          </span>
        </div>
        {filteredSlots.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredSlots.slice(0, 8).map((slot, index) => {
              const selected =
                form.preferred_date === slot.date &&
                form.selected_start === slot.start &&
                form.selected_end === slot.end;
              return (
                <button
                  key={`${slot.date}-${slot.start}`}
                  type="button"
                  onClick={() => chooseSlot(slot)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {index === 0 ? "Earliest option - " : ""}{shortDate(slot.date)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> {timeRange(slot.start, slot.end)} - all {slot.matched_count} available
                    </span>
                  </span>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600 ring-2 ring-white" : "border-slate-300"}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            No conflict-free overlap appears in this window. Revise the dates, choose a different panel window, or collect updated availability from the adviser and panel.
          </div>
        )}
      </div>

      {form.preferred_date && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected proposed schedule</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-900">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" /> {shortDate(form.preferred_date)}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" /> {timeRange(form.selected_start, form.selected_end)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4" /> All participants available
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduleHistory({ schedules }) {
  return (
    <div className="border-t border-slate-200 pt-5">
      <HistoryDisclosure label="View schedule history" hideLabel="Hide schedule history" count={schedules.length}>
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <div key={schedule.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">{schedule.defense_type || "Defense"} · {shortDate(schedule.preferred_date)} {schedule.start_time ? `· ${timeRange(schedule.start_time, schedule.end_time)}` : ""}</p>
                <p className="mt-0.5 text-xs text-slate-500">{schedule.mode} · {schedule.venue || "Arrangement pending"} · Forms: {schedule.required_forms_status || "Not recorded"}</p>
                {schedule.display_conflict_reason && <p className="mt-1 text-xs font-semibold text-amber-700">Warning/override: {schedule.display_conflict_reason}</p>}
                {schedule.panelists?.length > 0 && <p className="mt-1 text-xs text-slate-500">Panel: {schedule.panelists.map((item) => item.name).join(", ")}</p>}
              </div>
              <StatusBadge value={schedule.display_status || schedule.status} />
            </div>
          ))}
        </div>
      </HistoryDisclosure>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practicum
// ---------------------------------------------------------------------------
function useDemoCaseReset(slug, refetch) {
  const [resettingId, setResettingId] = useState(null);
  const [resetMessage, setResetMessage] = useState("");
  const [resetError, setResetError] = useState("");

  async function resetCase(student) {
    const removedData = slug === "withdrawal"
      ? "structured withdrawal request, related tasks, and activity entries"
      : `${slug} records, uploaded request PDFs, related tasks, and activity entries`;
    const confirmed = window.confirm(
      `Reset the ${slug} demo case for ${student.name}?\n\nThis removes only this student's ${removedData}. Academic and research source data are kept.`
    );
    if (!confirmed) return;
    setResettingId(student.id);
    setResetMessage("");
    setResetError("");
    try {
      const result = await api.resetWorkflowDemo(slug, student.id);
      setResetMessage(result.message);
      await refetch();
    } catch (error) {
      setResetError(error.message || "Could not reset this demo case.");
    } finally {
      setResettingId(null);
    }
  }

  function clearResetFeedback() {
    setResetMessage("");
    setResetError("");
  }

  return { resettingId, resetMessage, resetError, resetCase, clearResetFeedback };
}

function DemoResetButton({ student, resettingId, onReset }) {
  const busy = resettingId === student.id;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onReset(student)}
      className="btn-ghost cursor-pointer px-3 py-2 text-red-600 hover:bg-red-50 hover:text-red-700"
    >
      <RotateCcw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
      {busy ? "Resetting…" : "Reset demo case"}
    </button>
  );
}

function DemoResetFeedback({ message, error }) {
  return (
    <>
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}
      {error && <ErrorNote message={error} />}
    </>
  );
}

function WorkflowSubmitFeedback({ result, error }) {
  return (
    <div aria-live="polite">
      {result?.message && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> {result.message}
        </div>
      )}
      {error && <ErrorNote message={error} />}
    </div>
  );
}

function WorkflowCaseModal({ id, title, subtitle, status, onClose, children, footer, size = "default" }) {
  const closeButtonRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const widthClass = size === "wide" ? "max-w-[96rem]" : "max-w-3xl";

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event) {
      const modal = closeButtonRef.current?.closest('[role="dialog"]');
      const dialogs = [...document.querySelectorAll('[role="dialog"]')];
      if (modal && dialogs[dialogs.length - 1] !== modal) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = modal ? [...modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')] : [];
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

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-description`}
        className={`flex max-h-[88vh] w-full ${widthClass} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <header className="flex shrink-0 items-start gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${id}-title`} className="font-display text-xl font-semibold text-ink">{title}</h2>
              {status && <StatusBadge value={status} dot={false} />}
            </div>
            <p id={`${id}-description`} className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:ring-2 focus:ring-brand-500"
            aria-label="Close case details"
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6"><div className="w-full">{children}</div></div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
          <button type="button" onClick={onClose} className="btn-ghost cursor-pointer px-4 py-2">Close details</button>
          <div className="flex flex-wrap justify-end gap-2">{footer}</div>
        </footer>
      </section>
    </div>
  );
}

const WORKFLOW_GUIDES = {
  "leave-of-absence": {
    purpose: "Reviews a student-filed Leave of Absence application without changing standing before an authorized decision.",
    submitter: "The student completes a structured request with semester dropdowns, an allowed reason, and remarks; no PDF is required.",
    reviewers: "Graduate School Staff verifies eligibility and routes exceptions; the Dean reviews cases requiring a decision.",
    stages: ["Student submission", "Staff policy review", "Dean review when required", "Standing update", "Student notice"],
    incomplete: "Staff can return the request with a specific message while preserving its structured fields and activity history.",
    final: "Approved means the authorized leave period is recorded and the monitoring profile shows the student On Leave.",
  },
  readmission: {
    purpose: "Reviews a student-filed request to return after an approved leave period.",
    submitter: "The student completes a structured return intention, prior LOA semester dropdowns, target return semester, and checklist.",
    reviewers: "Graduate School Staff checks return eligibility and missing requirements; the Dean reviews exceptions.",
    stages: ["Student submission", "Eligibility review", "Dean review when required", "Reactivation", "Student notice"],
    incomplete: "The case can be returned with a message naming the exact structured field or checklist item that must be corrected.",
    final: "Approved means the student is reactivated for the approved return semester and the monitoring profile is synchronized.",
  },
  awol: {
    purpose: "Automatically flags evidence-backed AWOL standing, reviews structured return declarations, and tracks valid no-subject residency.",
    submitter: "A returning AWOL student completes a structured written declaration; staff reviews alerts and may record policy-valid residency.",
    reviewers: "Graduate School Staff performs the policy review and routes return cases to the Dean.",
    stages: ["Automatic AWOL flag", "Structured return declaration", "Policy review", "Dean review", "Return or residency update"],
    incomplete: "Reviewers can message or return an AWOL case while its structured declaration and audit trail remain visible.",
    final: "A decided return updates the student standing; residency remains a separate active, no-subject enrollment record.",
  },
  withdrawal: {
    purpose: "Withdraws a student from one enrolled subject before classes or during the first week, without changing program standing or unrelated classes.",
    submitter: "The student chooses an eligible enrolled subject and states the reason for withdrawing. No PDF upload is required.",
    reviewers: "Graduate School Staff forwards the request; the Dean approves or denies; an approval returns to GS Staff for Excel export and Registrar handoff.",
    stages: ["Student submission", "GS Staff forwarding", "Dean approval or denial", "Excel list export", "Registrar handoff", "Penalty-free subject removal"],
    incomplete: "A Dean denial closes this subject request and leaves every enrollment unchanged. Messages and action comments remain in the case history.",
    final: "Completed means the selected subject was removed with no grade or academic penalty; the student's other subjects and program standing remain active.",
  },
  practicum: {
    purpose: "Tracks the practicum MOA, placement, required hours, certificates, completion review, and Dean report for programs that require practicum.",
    submitter: "The student submits the MOA first, then separately submits certificates and completion evidence.",
    reviewers: "Graduate School Staff records and forwards submissions; the Academic Coordinator reviews the MOA, hours, and certificates; the Dean reviews the status report.",
    stages: ["MOA submitted", "Eligibility and MOA review", "Practicum in progress", "Completion review", "Report sent to Dean"],
    incomplete: "Missing or unclear evidence is returned with a message. Insufficient or unaccepted hours remain incomplete and may require another placement.",
    final: "Completed means required hours and documents were accepted; Dean Reviewed closes the monitoring report.",
  },
  graduation: {
    purpose: "Prepares a Graduate School recommendation and endorsed candidate list; it does not replace the official university graduation process.",
    submitter: "Students may request readiness review, while GS Staff compiles the review window and candidate list.",
    reviewers: "The Academic Coordinator checks coursework, the Research Coordinator validates completion evidence, and the Dean approves the endorsement list.",
    stages: ["Candidate review", "Requirements checks", "Batch preparation", "Dean endorsement", "Endorsement export"],
    incomplete: "Unusual case: if GS Staff finds incorrect details in the student PDF, staff returns Step 1 with a visible message and can require a replacement document. The prior PDF remains in history and cannot be reused.",
    final: "Endorsed means the Dean-approved list was exported for the external graduation process.",
  },
};

function WorkflowSupportModal({ slug, mode, logs, policyQuestions, onClose }) {
  const guide = WORKFLOW_GUIDES[slug];
  const title = mode === "activity" ? "Recent workflow activity" : `How ${guide ? slug : "this workflow"} works`;
  return (
    <WorkflowCaseModal
      id={`${slug}-${mode}`}
      title={title}
      subtitle={mode === "activity" ? "A timestamped audit trail of recent actions and handoffs" : "A concise guide for students and reviewers"}
      onClose={onClose}
    >
      {mode === "activity" ? (
        <WorkflowActivityList logs={logs} collapsible={false} />
      ) : guide ? (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Detail label="Purpose" value={guide.purpose} />
            <Detail label="Who submits" value={guide.submitter} />
            <Detail label="Who reviews" value={guide.reviewers} />
            <Detail label="When something is incomplete" value={guide.incomplete} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Main stages</p>
            <ol className="mt-2 grid gap-2 sm:grid-cols-2">
              {guide.stages.map((stage, index) => <li key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs text-brand-700">{index + 1}</span>{stage}</li>)}
            </ol>
          </div>
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900"><span className="font-semibold">What completion means: </span>{guide.final}</div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Admin note · confirm with Sir De Paula / GS office before production</p>
            <ul className="mt-2 space-y-1.5 text-sm text-amber-800">{policyQuestions.map((question) => <li key={question}>• {question}</li>)}</ul>
          </div>
        </div>
      ) : null}
    </WorkflowCaseModal>
  );
}

function WorkflowActivityList({ logs, collapsible = true }) {
  if (!logs.length) return <EmptyState title="No activity yet" hint="New submissions, messages, and decisions will appear here." />;
  const activity = (
    <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
      {logs.map((log) => (
        <li key={log.id} className="relative rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <span className="absolute -left-[27px] top-4 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{log.result}</p>
            <time className="text-xs text-slate-400">{formatDateTime(log.created_at)}</time>
          </div>
          <p className="mt-1 text-xs text-slate-500">{log.actor_role}{log.student_name ? ` · ${log.student_name}` : ""}{log.request_id ? ` · Request #${log.request_id}` : ""}{log.action_type ? ` · ${log.action_type}` : ""}</p>
          {(log.previous_status || log.new_status) && <p className="mt-2 text-xs font-semibold text-slate-600">{log.previous_status || "—"} <span className="mx-1 text-slate-300">→</span> {log.new_status || "—"}</p>}
          {log.notes && <p className="mt-2 text-xs leading-relaxed text-slate-500">{log.notes}</p>}
        </li>
      ))}
    </ol>
  );
  if (!collapsible) return activity;
  return (
    <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={logs.length}>
      {activity}
    </HistoryDisclosure>
  );
}

function WorkflowMessageModal({ slug, row, context, replyTo = null, onClose, onSaved }) {
  const { user } = useAuth();
  const student = row.student || row.endorsement?.student;
  const remarksOnly = ["practicum", "graduation"].includes(slug);
  const [form, setForm] = useState({
    action_type: replyTo ? "response" : "return",
    recipient_role: replyTo?.sender_role || "Student",
    visibility: replyTo?.visibility || "student_visible",
    template: remarksOnly ? "Remarks" : replyTo ? "Other / Custom comment" : context?.message_templates?.[0] || "Missing required document",
    comment: "",
    reply_to_message_id: replyTo?.id || null,
    require_document_resubmission: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const commentRequired = remarksOnly || Boolean(replyTo) || form.action_type === "return" || form.template === "Other / Custom comment";
  const canRequireGraduationDocument = (
    !replyTo
    && user?.role === "staff"
    && slug === "graduation"
    && form.action_type === "return"
    && form.recipient_role === "Student"
  );
  const returningToStudent = !replyTo && form.action_type === "return" && form.recipient_role === "Student";
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api.sendWorkflowMessage(slug, { student_id: student.id, ...form });
      await onSaved(result.message);
      onClose();
    } catch (err) {
      setError(err.message || "Could not save the workflow message.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkflowCaseModal
      id={`${slug}-message-${student.id}`}
      title={replyTo ? "Reply in case discussion" : "Message / return for clarification"}
      subtitle={`${student.name} · ${student.student_number}`}
      onClose={onClose}
      size={["practicum", "graduation"].includes(slug) ? "wide" : "default"}
      footer={<button type="submit" form={`${slug}-message-form-${student.id}`} disabled={busy} className={`${returningToStudent ? "btn cursor-pointer bg-red-600 px-4 py-2 text-white hover:bg-red-700" : "btn-primary cursor-pointer px-4 py-2"}`}><Send className="h-4 w-4" /> {busy ? "Saving…" : returningToStudent ? "Return to student" : "Send message"}</button>}
    >
      <form id={`${slug}-message-form-${student.id}`} onSubmit={save} className="space-y-4">
        <ErrorNote message={error} />
        {replyTo && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-950">Replying to {replyTo.sender_name || replyTo.sender_role}{replyTo.sender_name && replyTo.sender_role ? ` (${replyTo.sender_role})` : ""} → {replyTo.recipient_role}</p>{replyTo.comment && <p className="mt-2 text-sm text-emerald-800">{replyTo.comment}</p>}</div>}
        {!replyTo && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Action">
            <select value={form.action_type} onChange={(event) => setForm((current) => ({ ...current, action_type: event.target.value, require_document_resubmission: false }))} className="field-input cursor-pointer">
              <option value="return">Return for clarification</option>
              <option value="note">Send note to current reviewer</option>
            </select>
          </Field>
          <Field label="Recipient / next stage">
            <Select value={form.recipient_role} onChange={(event) => setForm((current) => ({ ...current, recipient_role: event.target.value, visibility: event.target.value === "Student" ? "student_visible" : "internal", require_document_resubmission: event.target.value === "Student" ? current.require_document_resubmission : false }))} placeholder="" options={context?.message_recipients || ["Student", "Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean"]} />
          </Field>
        </div>
        <Field label="Visibility">
          <select value={form.visibility} onChange={update("visibility")} disabled={form.recipient_role === "Student"} className="field-input cursor-pointer disabled:cursor-not-allowed disabled:bg-slate-100">
            <option value="student_visible">Visible to student</option>
            <option value="internal">Internal reviewers only</option>
          </select>
        </Field>
        {!remarksOnly && <Field label="Message template">
          <Select value={form.template} onChange={update("template")} placeholder="" options={context?.message_templates || []} />
        </Field>}
        </>}
        {canRequireGraduationDocument && (
          <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${form.require_document_resubmission ? "border-red-300 bg-red-50" : "border-slate-200 bg-white hover:border-red-200 hover:bg-red-50/40"}`}>
            <input
              type="checkbox"
              checked={form.require_document_resubmission}
              onChange={(event) => setForm((current) => ({ ...current, require_document_resubmission: event.target.checked }))}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">Have student resubmit document</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-600">When checked, Graduation Step 1 is reset. The existing PDF stays in file history, but the student must upload a new PDF before resubmitting.</span>
            </span>
          </label>
        )}
        <Field label={replyTo ? "Reply" : remarksOnly ? "Remarks" : form.action_type === "return" || form.template === "Other / Custom comment" ? "Comment / reason" : "Optional details"} required={commentRequired}>
          <Textarea value={form.comment} onChange={update("comment")} required={commentRequired} placeholder={remarksOnly ? "Type your remarks or message." : "Add the exact file, record, or detail that needs attention."} />
        </Field>
        <p className="text-xs leading-relaxed text-slate-500">{replyTo ? "Your reply is added chronologically to this case discussion and routed to the original sender." : "Returning the case moves it back to the selected recipient's stage and requires a reason. Use the case action button for normal forward approval; a note keeps the current stage unchanged."}</p>
      </form>
    </WorkflowCaseModal>
  );
}

function CaseMessageHistory({ messages = [], onReply = null }) {
  const { user } = useAuth();
  const currentRoleLabel = WORKFLOW_ROLE_LABELS[user?.role] || user?.role_label || "";
  return (
    <WorkflowDiscussion
      messages={messages}
      onReply={onReply}
      canReply={(message) => message.sender_role !== currentRoleLabel}
    />
  );
}

function WorkflowFileHistory({ files = [] }) {
  if (!files.length) return <EmptyState title="No uploaded files for this request" />;
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-400"><FileCheck className="h-4 w-4" /> Submitted file history</p>
      <ul className="mt-3 space-y-2">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
              <p className="text-xs text-slate-500">Uploaded by {file.uploaded_by || "Uploader not recorded"} ({file.uploaded_by_role || "role not recorded"}) · {formatDateTime(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p>
            </div>
            {file.file_exists !== false ? <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5">
              <Eye className="h-3.5 w-3.5" /> View file
            </a> : <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">File unavailable</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WorkflowTransitionModal({ slug, student, action, busy, onClose, onConfirm }) {
  const [comment, setComment] = useState(action.reason || "");
  const [error, setError] = useState("");
  const requiresReason = Boolean(action.requireReason);
  const requiresComment = requiresReason || Boolean(action.requireComment);
  const showsTransitionComment = requiresComment || ["practicum", "withdrawal", "graduation"].includes(slug);

  async function confirm(event) {
    event.preventDefault();
    const cleanComment = comment.trim();
    if (requiresComment && !cleanComment) {
      setError(action.commentRequiredError || (requiresReason ? "Enter the exact reason before moving this request." : "Enter the required follow-through details before moving this request."));
      return;
    }
    setError("");
    const payload = {
      ...action.payload,
      ...(cleanComment ? { workflow_comment: cleanComment } : {}),
      ...(requiresReason ? {
        return_reason: cleanComment,
        staff_remarks: cleanComment,
      } : {}),
    };
    const saved = await onConfirm(payload);
    if (saved) onClose();
  }

  return (
    <WorkflowCaseModal
      id={`${slug}-confirm-transition-${student.id}`}
      title={`Confirm: ${action.label}`}
      subtitle={`${student.name} · ${student.student_number} · ${slug}`}
      onClose={onClose}
      size={["practicum", "graduation"].includes(slug) ? "wide" : "default"}
      footer={<button type="submit" form={`${slug}-confirm-transition-form`} disabled={busy} className={action.destructive ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}>{busy ? "Saving…" : action.label}</button>}
    >
      <form id={`${slug}-confirm-transition-form`} onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow movement</p>
          <p className="mt-2 text-sm font-semibold text-ink">{action.fromStatus || "Current stage"} <span className="mx-1 text-slate-300">→</span> {action.toStatus || action.label}</p>
          <p className="mt-1 text-xs text-slate-500">This action is recorded against your signed-in account and preserves the submitted fields and files.</p>
        </div>
        {showsTransitionComment && (
          <Field label={action.commentLabel || (requiresReason ? "Message / reason" : "Comment sent with this action")} required={requiresComment}>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required={requiresComment}
              placeholder={action.commentPlaceholder || (requiresReason ? "Tell the student what to correct or upload next." : "Add instructions or context for the next reviewer. Leave blank if there is nothing to add.")}
            />
          </Field>
        )}
      </form>
    </WorkflowCaseModal>
  );
}

function defaultGraduationBatchForm(rows = []) {
  const existingName = rows.find((row) => row.endorsement?.batch_name)?.endorsement?.batch_name || "";
  const match = existingName.match(/^Batch(?:\s+No\.)?\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    return { batch_no: match[1], batch_month: match[2], batch_year: match[3] };
  }
  const now = new Date();
  return {
    batch_no: "1",
    batch_month: GRADUATION_BATCH_MONTHS[now.getMonth()],
    batch_year: String(now.getFullYear()),
  };
}

function graduationBatchName(form) {
  return `Batch ${form.batch_no || "1"} ${form.batch_month || GRADUATION_BATCH_MONTHS[new Date().getMonth()]} ${form.batch_year || new Date().getFullYear()}`;
}

const GRADUATION_STAGE_ACTIONS = {
  create_batch: {
    id: "create_batch",
    label: "Create batch",
    movement: "GS Staff creates the batch before forwarding",
    nextOwner: "Graduate School Staff",
    batchRequired: true,
    commentLabel: "Optional batch note",
  },
  compile_to_ac: {
    id: "compile_to_ac",
    label: "Forward to Academic Coordinator",
    movement: "GS Staff → Academic Coordinator",
    nextOwner: "Academic Coordinator",
    commentLabel: "Optional note to Academic Coordinator",
  },
  check_coursework: {
    id: "check_coursework",
    label: "Check coursework completion",
    movement: "Academic Coordinator → Research Coordinator or GS Staff",
    nextOwner: "Research Coordinator / Graduate School Staff",
    commentLabel: "Optional coursework review note",
  },
  validate_research: {
    id: "validate_research",
    label: "Validate research completion requirements",
    movement: "Research Coordinator → GS Staff",
    nextOwner: "Graduate School Staff",
    commentLabel: "Optional research validation note",
  },
  mark_not_eligible: {
    id: "mark_not_eligible",
    label: "List missing requirements and mark not eligible",
    movement: "GS Staff → Student",
    nextOwner: "Student",
    requiresComment: true,
    commentLabel: "Student-facing missing requirements message",
  },
  prepare_endorsement: {
    id: "prepare_endorsement",
    label: "Prepare endorsement list",
    movement: "GS Staff preparation",
    nextOwner: "Graduate School Staff",
    commentLabel: "Optional endorsement preparation note",
  },
  send_to_dean: {
    id: "send_to_dean",
    label: "Send endorsement list to Dean",
    movement: "GS Staff → Dean",
    nextOwner: "Dean",
    commentLabel: "Optional note to Dean",
  },
  approve: {
    id: "approve",
    label: "Approve endorsement list",
    movement: "Dean approval",
    nextOwner: "Dean / Registrar export",
    commentLabel: "Optional Dean comment",
  },
  return: {
    id: "return",
    label: "Return endorsement list for revision",
    movement: "Dean → Graduate School Staff",
    nextOwner: "Graduate School Staff",
    requiresComment: true,
    commentLabel: "Required revision reason",
  },
};

function graduationStageActionForRow(row, accountRole) {
  const status = row.endorsement?.endorsement_status || "Not Prepared";
  if (accountRole === "staff" && row.has_submitted_documents && ["Not Prepared", "For Review", "Not Eligible", "Returned for Clarification"].includes(status) && !row.endorsement?.batch_name) return GRADUATION_STAGE_ACTIONS.create_batch;
  if (accountRole === "staff" && ["Not Prepared", "For Review", "Not Eligible", "Returned for Clarification"].includes(status) && row.endorsement?.batch_name) return GRADUATION_STAGE_ACTIONS.compile_to_ac;
  if (accountRole === "academic_coordinator" && status === "Coursework Review") return GRADUATION_STAGE_ACTIONS.check_coursework;
  if (accountRole === "research_coordinator" && status === "Research Review") return GRADUATION_STAGE_ACTIONS.validate_research;
  if (accountRole === "staff" && ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status)) return GRADUATION_STAGE_ACTIONS.mark_not_eligible;
  if (accountRole === "staff" && status === "Eligibility Confirmed") return GRADUATION_STAGE_ACTIONS.prepare_endorsement;
  if (accountRole === "staff" && ["Endorsement Prepared", "Returned for Revision"].includes(status)) return GRADUATION_STAGE_ACTIONS.send_to_dean;
  if (accountRole === "dean" && status === "Ready for Dean Review") return GRADUATION_STAGE_ACTIONS.approve;
  return null;
}

function graduationStageSelection(rows, accountRole) {
  const rowActions = rows.map((row) => ({ row, action: graduationStageActionForRow(row, accountRole) }));
  const actionIds = [...new Set(rowActions.filter((item) => item.action).map((item) => item.action.id))];
  if (actionIds.length !== 1) {
    return { action: null, processableRows: [], skippedRows: rows, mixed: actionIds.length > 1 };
  }
  const action = GRADUATION_STAGE_ACTIONS[actionIds[0]];
  return {
    action,
    processableRows: rowActions.filter((item) => item.action?.id === action.id).map((item) => item.row),
    skippedRows: rowActions.filter((item) => item.action?.id !== action.id).map((item) => item.row),
    mixed: false,
  };
}

function graduationBatchActionLabel(action) {
  if (!action) return "No action due";
  return action.label;
}

function graduationSelectedActionLabel(action) {
  if (!action) return "Review selected candidates";
  return action.label;
}

const GRADUATION_UNBATCHED_LABEL = "Unbatched candidates";
const GRADUATION_STATUS_PRIORITY = [
  "Not Prepared",
  "For Review",
  "Coursework Review",
  "Coursework Incomplete",
  "Research Review",
  "Research Incomplete",
  "Practicum Incomplete",
  "Eligibility Confirmed",
  "Endorsement Prepared",
  "Ready for Dean Review",
  "Returned for Revision",
  "Dean Approved",
  "Not Eligible",
  "Returned for Clarification",
];

const GRADUATION_STAGE_AFTER_COMPILE = [
  "Coursework Review", "Coursework Incomplete", "Research Review", "Research Incomplete",
  "Practicum Incomplete", "Eligibility Confirmed", "Endorsement Prepared",
  "Ready for Dean Review", "Returned for Revision", "Dean Approved", "Not Eligible",
];
const GRADUATION_STAGE_AFTER_RESEARCH = [
  "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review",
  "Returned for Revision", "Dean Approved",
];
const GRADUATION_STAGE_AFTER_DEAN_HANDOFF = ["Ready for Dean Review", "Dean Approved"];
const GRADUATION_STAGE_AFTER_DEAN_REVIEW = ["Dean Approved"];

const GRADUATION_BATCH_STAGES = [
  {
    label: "Student submits graduation application",
    detail: "The signed application / review-window PDF is saved before the candidate can be selected.",
    completeStatuses: GRADUATION_STATUS_PRIORITY.filter((status) => status !== "Not Prepared"),
  },
  {
    label: "GS Staff creates graduation batch",
    detail: "Application-submitted candidates are grouped by the selected cohort.",
    completeStatuses: GRADUATION_STATUS_PRIORITY.filter((status) => status !== "Not Prepared"),
  },
  {
    label: "GS Staff forwards batch for coursework review",
    detail: "The created batch is sent to the Academic Coordinator.",
    currentStatuses: ["For Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_COMPILE,
    attentionStatuses: ["Returned for Clarification"],
  },
  {
    label: "Academic Coordinator reviews coursework",
    detail: "Completed curriculum requirements are revalidated for every candidate.",
    currentStatuses: ["Coursework Review"],
    completeStatuses: [
      "Research Review", "Research Incomplete", "Practicum Incomplete", "Eligibility Confirmed",
      "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved",
    ],
    attentionStatuses: ["Coursework Incomplete", "Not Eligible"],
  },
  {
    label: "Research Coordinator validates research and practicum",
    detail: "Research, post-defense evidence, and any required practicum completion are revalidated.",
    currentStatuses: ["Research Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_RESEARCH,
    attentionStatuses: ["Research Incomplete", "Practicum Incomplete", "Not Eligible"],
  },
  {
    label: "GS Staff prepares and forwards endorsement",
    detail: "Validated candidates are prepared as an endorsement list and sent to the Dean.",
    currentStatuses: ["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision"],
    completeStatuses: GRADUATION_STAGE_AFTER_DEAN_HANDOFF,
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
  {
    label: "Dean reviews graduation batch",
    detail: "The Dean approves the endorsement list or returns it to GS Staff for revision.",
    currentStatuses: ["Ready for Dean Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_DEAN_REVIEW,
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
  {
    label: "Export Dean-approved list",
    detail: "The approved candidates are ready for the recorded external Registrar export.",
    currentStatuses: ["Dean Approved"],
    completeStatuses: [],
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
];

function graduationRowStatus(row) {
  return row.endorsement?.endorsement_status || "Not Prepared";
}

function graduationRowBatchLabel(row, fallback = GRADUATION_UNBATCHED_LABEL) {
  return row.endorsement?.batch_name || fallback;
}

function orderedGraduationStatuses(rows) {
  const statuses = uniqueValues(rows.map(graduationRowStatus));
  return statuses.sort((left, right) => {
    const leftIndex = GRADUATION_STATUS_PRIORITY.indexOf(left);
    const rightIndex = GRADUATION_STATUS_PRIORITY.indexOf(right);
    const safeLeft = leftIndex === -1 ? GRADUATION_STATUS_PRIORITY.length : leftIndex;
    const safeRight = rightIndex === -1 ? GRADUATION_STATUS_PRIORITY.length : rightIndex;
    if (safeLeft !== safeRight) return safeLeft - safeRight;
    return left.localeCompare(right);
  });
}

function graduationBoardStatusForRows(rows) {
  return orderedGraduationStatuses(rows)[0] || "Not Prepared";
}

function graduationLatestDate(rows) {
  return rows.reduce((latest, row) => {
    const value = row.last_activity_at || row.endorsement?.updated_at || row.endorsement?.created_at;
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) && timestamp > latest.timestamp ? { value, timestamp } : latest;
  }, { value: "", timestamp: 0 }).value;
}

function graduationStatusCounts(rows, valueFor) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = valueFor(row) || "Pending";
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function graduationStatusSummary(rows, valueFor) {
  const counts = graduationStatusCounts(rows, valueFor);
  if (!counts.length) return "No records";
  return counts.map((item) => `${item.value}: ${item.count}`).join(" / ");
}

function graduationBatchGroups(rows, selectedIds = new Set()) {
  const groups = new Map();
  rows.forEach((row) => {
    const label = graduationRowBatchLabel(row);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  });
  return [...groups.entries()].map(([label, groupRows]) => {
    const sortedRows = sortSelectedWorkflowRows(
      [...groupRows],
      selectedIds,
      (row) => row.student.name,
      (row) => row.student.id,
    );
    const selectedCount = sortedRows.filter((row) => selectedIds.has(row.student.id)).length;
    const statuses = orderedGraduationStatuses(sortedRows);
    return {
      id: label,
      label,
      rows: sortedRows,
      selectedCount,
      statuses,
      boardStatus: graduationBoardStatusForRows(sortedRows),
      updatedAt: graduationLatestDate(sortedRows),
      nextOwners: uniqueValues(sortedRows.map((row) => row.next_action_owner || "Awaiting review")),
      courseworkSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.coursework_status),
      researchSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.research_status),
      practicumSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.practicum_status),
      eligibilitySummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.status),
    };
  }).sort((left, right) => {
    const leftSelected = left.selectedCount > 0;
    const rightSelected = right.selectedCount > 0;
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return left.label.localeCompare(right.label);
    const leftUnbatched = left.label === GRADUATION_UNBATCHED_LABEL;
    const rightUnbatched = right.label === GRADUATION_UNBATCHED_LABEL;
    if (leftUnbatched !== rightUnbatched) return leftUnbatched ? -1 : 1;
    return left.label.localeCompare(right.label);
  });
}

function graduationBatchSelectionState(group, selectedIds) {
  const selectedCount = group.rows.filter((row) => selectedIds.has(row.student.id)).length;
  return {
    selectedCount,
    allSelected: selectedCount > 0 && selectedCount === group.rows.length,
    partiallySelected: selectedCount > 0 && selectedCount < group.rows.length,
  };
}

function graduationBatchStageState(stage, group) {
  const statuses = group.rows.map(graduationRowStatus);
  const hasAttention = statuses.some((status) => stage.attentionStatuses?.includes(status));
  const allComplete = statuses.length > 0 && statuses.every((status) => stage.completeStatuses?.includes(status));
  const hasCurrent = statuses.some((status) => stage.currentStatuses?.includes(status));
  const hasComplete = statuses.some((status) => stage.completeStatuses?.includes(status));
  if (hasAttention) return "Needs action";
  if (allComplete) return "Complete";
  if (hasCurrent) return "Current";
  if (hasComplete) return "Mixed";
  return "Pending";
}

function graduationBatchStageChecks(group) {
  return GRADUATION_BATCH_STAGES.map((stage, index) => ({
    ...stage,
    number: index + 1,
    state: graduationBatchStageState(stage, group),
  }));
}

function graduationBatchCurrentStage(group) {
  const stages = graduationBatchStageChecks(group);
  return stages.find((stage) => ["Needs action", "Current", "Mixed", "Pending"].includes(stage.state)) || stages[stages.length - 1];
}

function GraduationBatchStageCheck({ group, compact = false, onViewStage }) {
  const stages = graduationBatchStageChecks(group);
  const currentStage = graduationBatchCurrentStage(group);
  const completed = stages.filter((stage) => stage.state === "Complete").length;
  const progress = Math.round((completed / stages.length) * 100);
  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stage check</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">Step {currentStage.number}: {currentStage.label}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge value={`${completed}/${stages.length}`} dot={false} />
            {onViewStage && <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-none rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Graduation stage check for {group.label}</p>
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
  );
}

function GraduationBatchStageModal({ group, onClose }) {
  const currentStage = graduationBatchCurrentStage(group);
  const modalId = `graduation-stage-${String(group.id).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  return (
    <WorkflowCaseModal
      id={modalId}
      title={`Graduation stage check for ${group.label}`}
      subtitle={`${group.rows.length} candidate${group.rows.length === 1 ? "" : "s"} · Step ${currentStage.number}: ${currentStage.label}`}
      onClose={onClose}
      size="wide"
    >
      <GraduationBatchStageCheck group={group} />
    </WorkflowCaseModal>
  );
}

function graduationRequirementTone(item) {
  if (item?.passed === true || item?.complete === true || item?.status === "Passed") return "complete";
  return "missing";
}

function graduationRequirementClasses(tone) {
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

function graduationRequirementDetailLines(item) {
  const actual = item.actual_value ?? item.actual ?? item.status ?? "Pending";
  const required = item.required_value ?? item.required;
  return [
    String(actual),
    required != null ? `Required: ${String(required)}` : "",
    item.note || "",
  ].filter(Boolean);
}

function graduationFallbackChecklist(row) {
  const eligibility = row.eligibility || {};
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

function GraduationRequirementBoxes({ row }) {
  const eligibility = row.eligibility || {};
  const items = [
    "Coursework completed",
    "Thesis / research completed",
    eligibility.practicum_status === "Not Required" ? "Practicum not required" : "Practicum completed",
    "Eligible for graduation",
  ];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Completed graduation requirements">
      {items.map((label) => (
        <div key={label} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-3.5 w-3.5" /></span>
          <p className="text-xs font-semibold">{label}</p>
        </div>
      ))}
      </div>
  );
}

function researchStageDetailLine(stage) {
  return `Requirements ${stage.requirements_complete}/${stage.requirements_total}; panel ${stage.panel?.assigned_count ?? 0}/${stage.panel?.required_count ?? 0}; schedule ${stage.schedule?.status || "Not scheduled"}; defense ${stage.defense?.status || "Not recorded"}`;
}

function GraduationResearchRequirementsView({ row }) {
  const progress = row.eligibility?.research_progress || {};
  const stages = progress.stages || [];
  const completion = progress.completion_evidence;
  if (!stages.length && !completion) {
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        No submitted research requirement details are available for this student yet.
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Research requirements submitted</p>
      <div className="mt-2 grid gap-2 lg:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.gate} className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{stage.name}</p>
              <StatusBadge value={stage.complete ? "Complete" : "Incomplete"} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{researchStageDetailLine(stage)}</p>
          </div>
        ))}
        {completion && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Completion Evidence</p>
              <StatusBadge value={completion.status || (completion.complete ? "Complete" : "Incomplete")} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">Requirements {completion.requirements_complete ?? 0}/{completion.requirements_total ?? 0}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GraduationBatchModal({ rows, accountRole, reviewWindows, defaultReviewWindow, onClose, onSaved }) {
  const selection = graduationStageSelection(rows, accountRole);
  const stageAction = selection.action;
  const defaultBatch = defaultGraduationBatchForm(rows);
  const activeReviewWindow = defaultReviewWindow || reviewWindows[0] || "";
  const selectedReviewWindow = activeReviewWindow;
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    comment: "",
    review_window: selectedReviewWindow,
    ...defaultBatch,
  });
  const [deanActionId, setDeanActionId] = useState("approve");
  const action = accountRole === "dean" && stageAction?.id === "approve"
    ? GRADUATION_STAGE_ACTIONS[deanActionId]
    : stageAction;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const batchName = graduationBatchName(form);
  const showBatchFields = action?.batchRequired || (action?.id === "send_to_dean" && selection.processableRows.some((row) => !row.endorsement?.batch_name));
  const requiresComment = Boolean(action?.requiresComment);
  const selectedGroups = graduationBatchGroups(selection.processableRows.length ? selection.processableRows : rows);
  const modalActionLabel = action
    ? showBatchFields
      ? graduationBatchActionLabel(action)
      : graduationSelectedActionLabel(action)
    : "Review selected candidates";

  async function confirm(event) {
    event.preventDefault();
    if (!action) {
      setError(selection.mixed ? "Select candidates from one review stage at a time." : "No group action is currently due for this selection.");
      return;
    }
    if (requiresComment && !form.comment.trim()) {
      setError("Enter the required message before applying this action.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { batch_no, batch_month, batch_year, ...baseForm } = form;
      const payload = {
        ...baseForm,
        stage_action: action.id,
        action: action.id,
        ...(showBatchFields ? { batch_no, batch_month, batch_year, batch_name: batchName } : {}),
      };
      const result = await api.graduationBatchAction({ student_ids: selection.processableRows.map((row) => row.student.id), ...payload });
      await onSaved(result);
      onClose();
    } catch (err) {
      setError(err.message || "Could not apply the graduation group action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkflowCaseModal
      id="graduation-batch-action"
      title={modalActionLabel}
      subtitle={action ? `${action.movement}` : "Selection needs one review stage"}
      onClose={onClose}
      size="wide"
      footer={<button type="submit" form="graduation-batch-form" disabled={busy || !action} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> {busy ? "Applying..." : action ? modalActionLabel : "No action available"}</button>}
    >
      <form id="graduation-batch-form" onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        {accountRole === "dean" && stageAction?.id === "approve" && (
          <Field label="Dean decision" required>
            <Select
              value={deanActionId}
              onChange={(event) => {
                setDeanActionId(event.target.value);
                setForm((current) => ({ ...current, comment: "" }));
              }}
              options={[
                { value: "approve", label: "Approve endorsement list" },
                { value: "return", label: "Return endorsement list for revision" },
              ]}
              placeholder=""
            />
          </Field>
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected action</p>
          {action ? (
            <>
              <p className="mt-2 text-sm font-semibold text-ink">{action.label}</p>
              <p className="mt-1 text-sm text-slate-600">{action.movement}</p>
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-red-700">{selection.mixed ? "Selected candidates are in different review stages." : "No selected candidate has a group action due for this role."}</p>
          )}
        </div>
        {showBatchFields && (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Batch No."><Input value={form.batch_no} onChange={update("batch_no")} inputMode="numeric" required /></Field>
              <Field label="Month"><select value={form.batch_month} onChange={update("batch_month")} className="field-input cursor-pointer">{GRADUATION_BATCH_MONTHS.map((month) => <option key={month}>{month}</option>)}</select></Field>
              <Field label="Year"><Input value={form.batch_year} onChange={update("batch_year")} inputMode="numeric" required /></Field>
              <Field label="Graduation school year" hint={`Only ${activeReviewWindow || "the active school year"} can be selected.`}><Select value={form.review_window} onChange={update("review_window")} options={reviewWindowOptions} placeholder="" required /></Field>
            </div>
            <p className="text-sm font-semibold text-brand-800">Batch label: {batchName}</p>
          </div>
        )}
        {action && <Field label={action.commentLabel || "Comment"} required={requiresComment}><Textarea value={form.comment} onChange={update("comment")} required={requiresComment} /></Field>}
        {!showBatchFields && selectedGroups.length > 0 && (
          <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={selectedGroups.length}>
            <div className="grid w-full grid-cols-1 gap-3">
              {selectedGroups.map((group) => <GraduationBatchStageCheck key={group.id} group={group} />)}
            </div>
          </HistoryDisclosure>
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Eligible candidates</p>
          <p className="mt-1 text-sm text-slate-600">{selection.processableRows.length} of {rows.length} selected candidate{rows.length === 1 ? " is" : "s are"} ready for this action.</p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
            {rows.map((row) => (
              <li key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3">
                <p className="font-semibold text-ink">{row.student.name}</p>
                <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
                <GraduationRequirementBoxes row={row} />
              </li>
            ))}
          </ul>
        </div>
      </form>
    </WorkflowCaseModal>
  );
}

const PRACTICUM_BOARD_COLUMNS = [
  { label: "Awaiting Submission", statuses: ["Not Submitted"] },
  { label: "Submitted", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", statuses: ["MOA Under Review"] },
  { label: "Documents Review", statuses: ["Documents Submitted", "Documents Under Review"] },
  { label: "In Progress", statuses: ["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"] },
  { label: "Completion Review", statuses: ["Completed"] },
  { label: "Completed", statuses: ["Report Sent to Dean", "Dean Reviewed"] },
  { label: "Returned", statuses: ["Returned for Clarification", "Not Accepted - New Organization Required"] },
];

const WITHDRAWAL_BOARD_COLUMNS = [
  { label: "Submitted", statuses: ["Submitted to GS Staff"] },
  { label: "Dean Review", statuses: ["Dean Review"] },
  { label: "Returned for Clarification", statuses: ["Returned", "Returned for Clarification"] },
  { label: "Subject Tagging", statuses: ["Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"] },
  { label: "Registrar Preparation", statuses: ["Subject Tagged - Registrar Preparation", "Exported - Ready to Send"] },
  { label: "Sent to Registrar", statuses: ["Sent to Registrar", "Withdrawn Confirmed"] },
  { label: "Rejected / Cancelled", statuses: ["Denied", "Cancelled"] },
];

const GRADUATION_BOARD_COLUMNS = [
  {
    label: "3 · Graduation Batch Created",
    description: "Application-submitted candidates are now grouped and ready for GS Staff to forward for coursework review.",
    statuses: ["For Review"],
    empty: "No newly created batches are waiting for GS Staff routing.",
  },
  {
    label: "4 · Academic Coordinator Coursework Review",
    description: "The Academic Coordinator verifies completed curriculum requirements for each candidate in the batch.",
    statuses: ["Coursework Review"],
    empty: "No batches are waiting for coursework review.",
  },
  {
    label: "5 · Research and Practicum Validation",
    description: "The Research Coordinator validates research, defense, completion evidence, and required practicum completion.",
    statuses: ["Research Review"],
    empty: "No batches are waiting for research and practicum validation.",
  },
  {
    label: "6 · Endorsement Preparation or Revision",
    description: "Validated batches return to GS Staff for endorsement preparation or Dean-requested revision.",
    statuses: ["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision"],
    empty: "No batches are waiting for endorsement preparation or revision.",
  },
  {
    label: "7 · Dean Review",
    description: "Prepared endorsement batches await the Dean's approval or return decision.",
    statuses: ["Ready for Dean Review"],
    empty: "No batches are waiting for Dean review.",
  },
  {
    label: "8 · Dean Approved and Ready for Export",
    description: "Only approved and currently eligible candidates are available for the external Registrar CSV export.",
    statuses: ["Dean Approved"],
    empty: "No Dean-approved graduation batches are ready for export.",
  },
  {
    label: "Exception Queue",
    description: "Candidates whose revalidation found missing requirements remain visible for correction and student notification.",
    statuses: ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete", "Not Eligible", "Returned for Clarification"],
    empty: "No graduation exceptions currently require correction.",
  },
];

function WorkflowBoard({ columns, rows, getStatus, renderCard, empty, isDraggable = () => false, getDragId = () => "" }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return (
    <div className="max-w-full overflow-x-auto pb-3">
      <div className="flex w-max snap-x gap-4">
        {columns.map((column) => {
          const items = rows.filter((row) => column.statuses.includes(getStatus(row)));
          return (
            <section key={column.label} className="w-[290px] shrink-0 snap-start rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <header className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-700">{column.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
              </header>
              <div className="space-y-3">{items.length ? items.map((item, index) => {
                const ready = isDraggable(item);
                const dragId = getDragId(item) || item.student?.id || item.id || index;
                return <div key={dragId} draggable={ready} onDragStart={(event) => { if (!ready) return; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", String(dragId)); }} className={ready ? "cursor-grab rounded-xl outline-none ring-2 ring-emerald-200 active:cursor-grabbing" : "rounded-xl"}>{renderCard(item)}</div>;
              }) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-6 text-center text-xs text-slate-400">No requests</p>}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ViewModeToggle({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" aria-label="Choose request overview layout">
      <button type="button" onClick={() => onChange("board")} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value === "board" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><Columns3 className="h-4 w-4" /> Board</button>
      <button type="button" onClick={() => onChange("table")} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${value === "table" ? "bg-brand-600 text-white" : "text-slate-500 hover:bg-slate-50"}`}><List className="h-4 w-4" /> Table</button>
    </div>
  );
}

function PracticumBoardCard({ row, onOpen, onMessage }) {
  const record = row.record;
  const ready = Boolean(row.has_submitted_documents);
  const latestMessage = row.messages?.[0];
  return (
    <article key={row.student.id} className={`rounded-xl border p-3 shadow-sm transition-colors ${ready ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{row.student.name}</p><p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p></div>{!ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span>{record?.practicum_site || "Site pending"}</span><span className="text-right">{record ? `${record.completed_hours}/${record.required_hours} hrs` : "No hours yet"}</span><span>{row.eligibility.status}</span><span className="text-right">Updated {formatDate(row.last_activity_at || record?.updated_at)}</span><span className="col-span-2">{record ? `Submitted ${formatDate(record.created_at)}` : "No practicum documents submitted"}</span></div>
      {row.messages?.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{row.messages.length} visible message{row.messages.length === 1 ? "" : "s"}</p><p className="mt-1 line-clamp-2 text-xs text-amber-900">{latestMessage?.comment || latestMessage?.template}</p></div>}
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {row.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button>{record && <button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button>}</div>
    </article>
  );
}

function WithdrawalBoardCard({ item, onOpen, onMessage }) {
  return (
    <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{item.student.name}</p><p className="text-xs text-slate-400">{item.student.student_number} · {item.student.program_code}</p></div>{item.unresolved_messages > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-700">Concern</span>}</div>
      <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-600">{item.reason || "No reason provided"}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><span>Submitted {formatDate(item.created_at)}</span><span className="text-right">Updated {formatDate(item.updated_at)}</span><span className="col-span-2 font-semibold text-slate-700">{item.subject?.course_code || "Subject pending"} · {item.effective_term || item.subject?.term_label || "Semester pending"}</span></div>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {item.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button><button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button></div>
    </article>
  );
}

function GraduationBatchStudentList({ rows, onOpenStudent, onMessageStudent, compact = false }) {
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.student.id} className={`rounded-lg px-3 py-2 ring-1 ${row.has_submitted_documents ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
              <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
            </div>
            <span className="flex flex-wrap items-center gap-1.5"><StatusBadge value={graduationRowStatus(row)} dot={false} />{!row.has_submitted_documents && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}</span>
          </div>
          <GraduationRequirementBoxes row={row} />
          {row.messages?.length > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800"><MessageSquare className="mr-1 inline h-3.5 w-3.5" /> {row.messages.length} discussion message{row.messages.length === 1 ? "" : "s"}</p>}
          {(onOpenStudent || onMessageStudent) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {onOpenStudent && <button type="button" onClick={() => onOpenStudent(row.student.id)} className="btn-ghost cursor-pointer px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" /> View</button>}
              {row.endorsement && onMessageStudent && <button type="button" onClick={() => onMessageStudent(row)} className="btn cursor-pointer border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-300 hover:bg-red-100"><MessageSquare className="h-3.5 w-3.5" /> Message / Return</button>}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function GraduationBatchRow({
  group,
  accountRole,
  selectedIds = new Set(),
  expanded = false,
  selectedTone = false,
  onToggleBatch,
  onToggleExpanded,
  onSelectBatch,
  onProcessBatch,
  onOpenStudent,
  onMessageStudent,
  onViewStage,
  onExportBatch,
  exporting = false,
}) {
  const selectionState = graduationBatchSelectionState(group, selectedIds);
  const stageSelection = graduationStageSelection(group.rows, accountRole);
  const actionLabel = graduationBatchActionLabel(stageSelection.action);
  const visibleRows = expanded ? group.rows : [];
  const hiddenCount = group.rows.length - Math.min(group.rows.length, 4);
  const selectionLabel = selectionState.partiallySelected ? `${selectionState.selectedCount}/${group.rows.length} selected` : selectionState.allSelected ? "Batch selected" : "Select batch";
  const currentStage = graduationBatchCurrentStage(group);
  const names = group.rows.map((row) => row.student.name).slice(0, 4).join(", ");
  const canExpandStudents = Boolean(onToggleExpanded && onOpenStudent && onMessageStudent);
  const applicationComplete = group.rows.length > 0 && group.rows.every((row) => row.has_submitted_documents);
  const canExport = accountRole === "dean" && group.boardStatus === "Dean Approved" && Boolean(onExportBatch);
  const alreadyExported = group.rows.every((row) => row.endorsement?.registrar_status === "Exported - Ready to Send");
  const messageCount = group.rows.reduce((total, row) => total + (row.messages?.length || 0), 0);
  return (
    <article className={`rounded-xl border px-3 py-1.5 transition-colors ${applicationComplete ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : selectedTone ? "border-brand-200 bg-brand-50/50" : "border-slate-200 bg-white"}`}>
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            {onToggleBatch && (
              <input
                type="checkbox"
                checked={selectionState.allSelected}
                aria-checked={selectionState.partiallySelected ? "mixed" : selectionState.allSelected}
                onChange={() => onToggleBatch(group)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                aria-label={`Select ${group.label}`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{group.label}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>{group.rows.length} candidate{group.rows.length === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>{selectionLabel}</span>
                <StatusBadge value={group.boardStatus} dot={false} />
                {!applicationComplete && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Application document issue</span>}
                {messageCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><MessageSquare className="mr-1 inline h-3 w-3" />{messageCount} message{messageCount === 1 ? "" : "s"}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 border-t border-slate-200/70 pt-2 text-xs text-slate-600">
          <p className="truncate"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
          <p className="mt-0.5 truncate"><span className="font-semibold text-slate-700">Next:</span> {group.nextOwners.join(", ")}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
          <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
          <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>
        </div>
        <div className="flex min-w-0 flex-wrap justify-start gap-1.5 border-t border-slate-200/70 pt-2">
          {canExpandStudents && <button type="button" onClick={() => onToggleExpanded(group.id)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>}
          {onSelectBatch && <button type="button" onClick={() => onSelectBatch(group)} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>}
          {canExport ? (
            <button type="button" disabled={exporting} onClick={() => onExportBatch(group)} className="btn min-w-0 cursor-pointer whitespace-normal bg-emerald-600 px-2.5 py-1 text-left text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4 shrink-0" /> {exporting ? "Exporting…" : alreadyExported ? "Export approved list again" : "Export approved list"}</button>
          ) : (
            <button type="button" disabled={!stageSelection.action} onClick={() => onProcessBatch(group)} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4 shrink-0" /> {actionLabel}</button>
          )}
        </div>
      </div>
      {canExpandStudents && expanded && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <GraduationBatchStudentList rows={visibleRows} onOpenStudent={onOpenStudent} onMessageStudent={onMessageStudent} compact />
        </div>
      )}
    </article>
  );
}

function GraduationBatchBoardSections({
  groups,
  accountRole,
  selectedIds,
  expandedBatchIds,
  onToggleBatch,
  onToggleExpanded,
  onProcessBatch,
  onOpenStudent,
  onMessageStudent,
  onViewStage,
  onExportBatch,
  exportingBatchId,
}) {
  return (
    <>
      {GRADUATION_BOARD_COLUMNS.map((column) => {
        const items = groups.filter((group) => column.statuses.includes(group.boardStatus));
        return (
          <section key={column.label} className="flex min-h-[520px] w-full flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:w-[380px] sm:shrink-0">
            <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-slate-800">{column.label}</h3>
                <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">{column.description}</p>
              </div>
              <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
            </header>
            <div className="flex-1 space-y-3">
              {items.length ? items.map((group) => (
                <GraduationBatchRow
                  key={group.id}
                  group={group}
                  accountRole={accountRole}
                  selectedIds={selectedIds}
                  expanded={expandedBatchIds.has(group.id)}
                  onToggleBatch={onToggleBatch}
                  onToggleExpanded={onToggleExpanded}
                  onProcessBatch={onProcessBatch}
                  onOpenStudent={onOpenStudent}
                  onMessageStudent={onMessageStudent}
                  onViewStage={onViewStage}
                  onExportBatch={onExportBatch}
                  exporting={exportingBatchId === group.id}
                />
              )) : <p className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-3 py-4 text-center text-xs text-slate-400">{column.empty}</p>}
            </div>
          </section>
        );
      })}
    </>
  );
}

function GraduationCandidateStageSection({
  stageNumber,
  title,
  description,
  empty,
  rows,
  accountRole,
  selectedIds,
  onToggleStudent,
  onSelectAll,
  onClearSelection,
  onCreateBatch,
  onOpenStudent,
  selectable = false,
}) {
  const canCreateBatch = selectable && accountRole === "staff";
  const selectedCount = rows.filter((row) => selectedIds.has(row.student.id)).length;
  const titleId = `graduation-candidate-stage-${stageNumber}`;
  return (
    <section className={`flex min-h-[520px] w-full flex-col rounded-xl border bg-white p-4 sm:w-[380px] sm:shrink-0 ${selectable ? "border-emerald-200" : "border-slate-200"}`} aria-labelledby={titleId}>
      <div className="space-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${selectable ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}`}>{stageNumber}</span>
          <div>
            <p id={titleId} className="font-display text-lg font-semibold text-ink">{title}</p>
            <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">{description}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={`${rows.length} student${rows.length === 1 ? "" : "s"}`} dot={false} />
          {canCreateBatch && rows.length > 0 && <button type="button" onClick={onSelectAll} className="btn-ghost cursor-pointer px-3 py-2">Select all visible</button>}
          {canCreateBatch && selectedCount > 0 && <button type="button" onClick={onClearSelection} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
          {canCreateBatch && <button type="button" disabled={!selectedCount} onClick={onCreateBatch} className="btn-primary cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4" /> Create graduation batch</button>}
        </div>
      </div>
      {rows.length ? <ul className="mt-4 flex-1 space-y-3">
        {rows.map((row) => {
          const selected = selectedIds.has(row.student.id);
          const completedCourses = row.eligibility?.completed_courses || [];
          const applicationFile = row.endorsement?.request_attachment;
          return (
            <li key={row.student.id} className={`rounded-xl border p-3 ${selectable ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/60"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2.5">
                  {canCreateBatch && <input type="checkbox" checked={selected} onChange={() => onToggleStudent(row.student.id)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${row.student.name} for batch creation`} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
                    <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
                  </div>
                </div>
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  <StatusBadge value={row.application_status} dot={false} />
                  {row.has_submitted_documents && applicationFile?.file_exists !== false && applicationFile?.url && (
                    <a
                      href={applicationFile.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
                      aria-label={`View submitted graduation application PDF for ${row.student.name}`}
                    >
                      <FileText className="h-3.5 w-3.5" /> View PDF <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                  {row.has_submitted_documents && applicationFile?.file_exists === false && (
                    <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">PDF unavailable</span>
                  )}
                </span>
              </div>
              <GraduationRequirementBoxes row={row} />
              {completedCourses.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">Completed-course cohort:</span>{" "}
                  {completedCourses.slice(0, 4).map((course) => course.code).join(", ")}
                  {completedCourses.length > 4 ? ` +${completedCourses.length - 4} more` : ""}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => onOpenStudent(row.student.id)} className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> View student</button>
              </div>
            </li>
          );
        })}
      </ul> : <p className="mt-4 flex flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-5 text-center text-xs text-slate-400">{empty}</p>}
    </section>
  );
}

function GraduationBatchOverviewSection({ groups, accountRole, onSelectBatch, onProcessBatch, onViewStage }) {
  if (!groups.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Created graduation batches</p>
          <p className="text-xs text-slate-500">Track each batch after GS Staff compiles the candidate list, with every student still visible inside.</p>
        </div>
        <StatusBadge value={`${groups.length} batch${groups.length === 1 ? "" : "es"}`} dot={false} />
      </div>
      <div className="space-y-2">
        {groups.map((group) => {
          const stageSelection = graduationStageSelection(group.rows, accountRole);
          const actionLabel = graduationBatchActionLabel(stageSelection.action);
          const currentStage = graduationBatchCurrentStage(group);
          const names = group.rows.map((row) => row.student.name).slice(0, 4).join(", ");
          const hiddenCount = group.rows.length - Math.min(group.rows.length, 4);
          const readyToDrag = group.rows.every((row) => row.has_submitted_documents);
          return (
            <div key={group.id} draggable={readyToDrag} className={`rounded-xl border px-3 py-2 ${readyToDrag ? "cursor-grab border-emerald-300 bg-emerald-50 active:cursor-grabbing" : "border-slate-200 bg-slate-50/60"}`}>
              <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(230px,0.95fr)] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{group.label}</p>
                  <p className="text-xs text-slate-500">{group.rows.length} candidate{group.rows.length === 1 ? "" : "s"} · Updated {formatDate(group.updatedAt)}</p>
                  {!readyToDrag && <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">Waiting for documents</span>}
                </div>
                <div className="min-w-0 text-xs text-slate-600">
                  <p className="truncate"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                  <p className="mt-0.5 truncate"><span className="font-semibold text-slate-700">Next:</span> {group.nextOwners.join(", ")}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                  <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                  <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>
                </div>
                <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                  <button type="button" onClick={() => onSelectBatch(group)} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>
                  <button type="button" disabled={!stageSelection.action} onClick={() => onProcessBatch(group)} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4 shrink-0" /> {actionLabel}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PracticumRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [pendingAction, setPendingAction] = useState(null);
  const reset = useDemoCaseReset("practicum", refetch);
  const rows = (context.roster || []).filter((row) => row.eligibility?.eligible === true);
  const [filters, setFilters] = useState({ query: "", program: "", status: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")), [rows]);
  const filteredRows = useMemo(() => sortWorkflowRows(rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.secondary || row.eligibility.status === filters.secondary)
      && dateMatches(row.last_activity_at || row.record?.updated_at || row.record?.created_at, filters.dateFrom, filters.dateTo);
  }), filters.sort, (row) => row.last_activity_at || row.record?.updated_at || row.record?.created_at, (row) => row.student.name), [rows, filters]);

  function actionFor(row) {
    const record = row.record;
    if (!record) return null;
    const base = { student_id: row.student.id };
    if (accountRole === "staff" && ["MOA Submitted", "MOA Received"].includes(record.status)) {
      return { label: "Forward to Academic Coordinator", payload: { ...base, status: "MOA Under Review", moa_status: "Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "MOA Under Review") {
      return { label: "Mark practicum in progress", payload: { ...base, status: "Practicum In Progress", moa_status: "Verified" } };
    }
    if (accountRole === "staff" && ["Hours Incomplete", "Documents Submitted"].includes(record.status)) {
      return { label: "Forward documents to Academic Coordinator", payload: { ...base, status: "Documents Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Documents Under Review" && row.hours_status !== "Complete") {
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" }, requireReason: true };
    }
    if (accountRole === "academic_coordinator" && ["Documents Under Review", "Practicum In Progress"].includes(record.status) && row.hours_status === "Complete") {
      return { label: "Verify completion", payload: { ...base, status: "Completed", document_status: "Verified" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Completed") {
      return { label: "Send status report to Dean", payload: { ...base, status: "Report Sent to Dean", document_status: "Verified" } };
    }
    return null;
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedAction = selectedRow ? actionFor(selectedRow) : null;

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Practicum student submissions" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · GS Staff forwards submissions; the Academic Coordinator reviews MOAs, certificates, and hours`} icon={Briefcase} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not eligible", "Needs verification"]} count={filteredRows.length} total={rows.length} />
      <div className="flex justify-end"><ViewModeToggle value={viewMode} onChange={setViewMode} /></div>
      {viewMode === "board" ? (
        <WorkflowBoard
          columns={PRACTICUM_BOARD_COLUMNS}
          rows={filteredRows}
          getStatus={(row) => row.record?.status || "Not Submitted"}
          isDraggable={(row) => Boolean(row.has_submitted_documents)}
          getDragId={(row) => row.student.id}
          empty="No recent practicum submissions match the filters."
          renderCard={(row) => <PracticumBoardCard key={row.student.id} row={row} onOpen={() => openCase(row.student.id)} onMessage={() => setMessageRow(row)} />}
        />
      ) : <WorkflowTable
        headers={["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]}
        empty="No practicum-program students found."
        rows={filteredRows}
        render={(row) => {
          return (
              <tr
                key={row.student.id}
                onClick={() => openCase(row.student.id)}
                className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
              >
                <StudentCell student={row.student} />
                <td className="px-3 py-3"><StatusBadge value={row.eligibility.status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.moa_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.documents_status} dot={false} /></td>
                <td className="px-3 py-3 text-sm text-slate-600">{row.record ? `${row.record.completed_hours}/${row.record.required_hours}` : "—"}<div className="mt-1"><StatusBadge value={row.hours_status} dot={false} /></div></td>
                <td className="px-3 py-3"><StatusBadge value={row.coordinator_review_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.dean_report_status} dot={false} /></td>
                <td className="px-3 py-3">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openCase(row.student.id); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> Open case</button>
                </td>
              </tr>
          );
        }}
      />}
      {selectedRow && (
        <WorkflowCaseModal
          id={`practicum-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Practicum case`}
          status={selectedRow.record?.status || "Not Submitted"}
          onClose={() => setSelectedStudentId(null)}
          size="wide"
          footer={(
            <>
              {accountRole === "staff" && selectedRow.record && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedRow.record && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedAction ? (
                <div><button type="button" disabled={submitting || refreshing} onClick={() => setPendingAction({ ...selectedAction, fromStatus: selectedRow.record.status, toStatus: selectedAction.payload.status })} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>{selectedAction.label === "Request additional certificates" && <p className="mt-1 text-xs font-semibold text-red-600">*Incomplete hours</p>}</div>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">{selectedRow.record ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "Awaiting student submission."}</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <PracticumCaseDetails row={selectedRow} />
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="practicum" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {pendingAction && selectedRow && <WorkflowTransitionModal slug="practicum" student={selectedRow.student} action={pendingAction} busy={submitting || refreshing} onClose={() => setPendingAction(null)} onConfirm={submit} />}
    </div>
  );
}

function PracticumCaseDetails({ row }) {
  const record = row.record;
  const timeline = (row.timeline || record?.timeline || []).map((step) => ({
    ...step,
    optional: ["Hours Incomplete", "Additional Certificates Requested"].includes(step.label),
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Detail label="Eligibility" value={row.eligibility.status} />
        <Detail label="MOA" value={row.moa_status} />
        <Detail label="Documents" value={row.documents_status} />
        <Detail label="Hours" value={record ? `${record.completed_hours}/${record.required_hours}` : "Not started"} />
        <Detail label="Supervisor" value={record?.supervisor_name || "Not provided"} />
        <Detail label="Completion" value={record?.completion_status || "Pending"} />
      </div>
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Automatic eligibility</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {row.eligibility.checklist.map((item) => (
                <div key={item.key} className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
                  <div><p className="text-sm font-semibold text-slate-700">{item.label}</p>{item.note && <p className="text-xs text-slate-400">{item.note}</p>}</div>
                  <p className="text-xs font-semibold text-slate-500">{String(item.actual_value ?? item.actual)}{item.required_value != null ? ` / ${item.required_value}` : ""}</p>
                  <StatusBadge value={item.status || (item.complete ? "Passed" : "Not met")} dot={false} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Student submission</p>
            <p className="mt-2 text-sm font-semibold text-ink">{record?.practicum_site || "No site submitted"}</p>
            <p className="mt-1 text-xs text-slate-500">Supervisor: {record?.supervisor_name || "Not provided"}</p>
            <p className="mt-1 text-xs text-slate-500">System-detected certificate submissions: {record?.certificate_count || 0}</p>
            {record?.remarks && <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Latest student submission remark</p><p className="mt-1 text-sm text-emerald-900">{record.remarks}</p></div>}
            <div className="mt-2 flex flex-wrap gap-2">{record?.moa_attachment?.file_exists && <a className="btn-ghost px-3 py-1.5" href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA <ArrowUpRight className="h-3.5 w-3.5" /></a>}{record?.completion_attachments?.map((file, index) => file.file_exists && <a key={file.id} className="btn-ghost px-3 py-1.5" href={file.url} target="_blank" rel="noreferrer">Certificate file {index + 1} <ArrowUpRight className="h-3.5 w-3.5" /></a>)}{(record?.moa_attachment?.file_exists === false || record?.certificate_attachment?.file_exists === false) && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">One or more saved files are unavailable</span>}</div>
          </div>
      </div>
      <WorkflowTimeline steps={timeline} title="Practicum workflow timeline" />
      <WorkflowFileHistory files={record?.attachments || []} />
    </div>
  );
}

function WithdrawalRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedCaseId, setSelectedCaseId] = useState(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [pendingAction, setPendingAction] = useState(null);
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [registrarBusy, setRegistrarBusy] = useState("");
  const [registrarError, setRegistrarError] = useState("");
  const [registrarReference, setRegistrarReference] = useState("");
  const [selectedRegistrarIds, setSelectedRegistrarIds] = useState(() => new Set());
  const [downloadedRegistrarIds, setDownloadedRegistrarIds] = useState(() => new Set());
  const autoOpenedRegistrarSignature = useRef("");
  const reset = useDemoCaseReset("withdrawal", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "", dateFrom: "", dateTo: "", sort: "newest" });
  const programs = useMemo(() => uniqueValues(rows.map((item) => item.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((item) => item.status)), [rows]);
  const filteredRows = useMemo(() => sortWorkflowRows(rows.filter((item) => {
    const haystack = `${item.student.name} ${item.student.student_number} ${item.student.program_code} ${item.reason || ""} ${item.effective_term || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || item.student.program_code === filters.program)
      && (!filters.status || item.status === filters.status)
      && (!filters.secondary || item.dean_decision === filters.secondary)
      && dateMatches(item.last_activity_at || item.updated_at || item.created_at, filters.dateFrom, filters.dateTo);
  }), filters.sort, (item) => item.last_activity_at || item.updated_at || item.created_at, (item) => item.student.name), [rows, filters]);
  function actionFor(item) {
    const base = { student_id: item.student_id };
    if (accountRole === "staff" && item.dean_decision === "Pending" && item.status === "Submitted to GS Staff") return { label: "Record & forward to Dean", payload: { ...base, workflow_action: "forward_to_dean" } };
    if (accountRole === "staff" && item.dean_decision === "Approved" && ["Approved - Awaiting Subject Tag", "Approved - Registrar Preparation"].includes(item.status)) return { label: "Tag student as withdrawn from subject", payload: { ...base, workflow_action: "tag_subject_withdrawn" } };
    return null;
  }
  const selectedCurrent = rows.find((item) => item.id === selectedCaseId) || null;
  const selectedItem = selectedCurrent || selectedSnapshot;
  const selectedAction = selectedCurrent ? actionFor(selectedCurrent) : null;
  const withdrawalSteps = withdrawalTimelineSteps(selectedCurrent?.status || (reset.resetMessage ? undefined : selectedItem?.status));
  const registrarRows = useMemo(
    () => rows.filter((item) => item.dean_decision === "Approved" && ["Subject Tagged - Registrar Preparation", "Exported - Ready to Send"].includes(item.status)),
    [rows],
  );
  const selectedRegistrarRows = useMemo(
    () => registrarRows.filter((item) => selectedRegistrarIds.has(item.id)),
    [registrarRows, selectedRegistrarIds],
  );
  const selectedRegistrarReady = selectedRegistrarRows.length > 0 && selectedRegistrarRows.every(
    (item) => item.registrar_status === "Exported - Ready to Send" || downloadedRegistrarIds.has(item.id),
  );

  useEffect(() => {
    if (selectedCurrent) setSelectedSnapshot(selectedCurrent);
  }, [selectedCurrent]);

  useEffect(() => {
    if (accountRole !== "staff" || !registrarRows.length) return;
    const signature = registrarRows.map((item) => item.id).sort((a, b) => a - b).join("-");
    if (autoOpenedRegistrarSignature.current === signature) return;
    autoOpenedRegistrarSignature.current = signature;
    setSelectedRegistrarIds(new Set(registrarRows.map((item) => item.id)));
    setRegistrarError("");
    setRegistrarOpen(true);
  }, [accountRole, registrarRows]);

  function openCase(item) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedCaseId(item.id);
    setSelectedSnapshot(item);
  }

  function closeCase() {
    setSelectedCaseId(null);
    setSelectedSnapshot(null);
  }

  function toggleRegistrarRow(applicationId) {
    setSelectedRegistrarIds((current) => {
      const next = new Set(current);
      if (next.has(applicationId)) next.delete(applicationId); else next.add(applicationId);
      return next;
    });
  }

  async function exportRegistrarWorkbook() {
    const applicationIds = selectedRegistrarRows.map((item) => item.id);
    if (!applicationIds.length) return;
    setRegistrarBusy("export");
    setRegistrarError("");
    try {
      const exported = await api.exportWithdrawalXlsx(applicationIds);
      setDownloadedRegistrarIds((current) => {
        const next = new Set(current);
        applicationIds.forEach((id) => next.add(id));
        return next;
      });
      setMessageNotice(`${exported.count} approved subject withdrawal${exported.count === 1 ? "" : "s"} exported as ${exported.filename}.`);
      await refetch();
    } catch (error) {
      setRegistrarError(error.message || "Could not export the approved-withdrawals workbook.");
    } finally {
      setRegistrarBusy("");
    }
  }

  async function forwardRegistrarWorkbook() {
    const applicationIds = selectedRegistrarRows.map((item) => item.id);
    if (!applicationIds.length) return;
    setRegistrarBusy("send");
    setRegistrarError("");
    try {
      const response = await api.forwardWithdrawalsToRegistrar(applicationIds, registrarReference);
      setMessageNotice(response.message);
      setRegistrarOpen(false);
      setSelectedRegistrarIds(new Set());
      setDownloadedRegistrarIds(new Set());
      setRegistrarReference("");
      await refetch();
    } catch (error) {
      setRegistrarError(error.message || "Could not record the Registrar handoff.");
    } finally {
      setRegistrarBusy("");
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Submitted subject withdrawal requests" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · Student request → GS Staff → Dean → GS Staff subject tag → Excel export → Registrar; approved withdrawals carry no academic grade or penalty`} icon={LogOut} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      {accountRole === "staff" && registrarRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-900">{registrarRows.length} tagged withdrawal{registrarRows.length === 1 ? "" : "s"} waiting for Registrar handoff</p>
            <p className="mt-0.5 text-xs text-emerald-800">Each selected subject already shows Withdrawn in Official Offered Subjects. Download the Excel workbook, then confirm the Registrar handoff.</p>
          </div>
          <button type="button" onClick={() => { setSelectedRegistrarIds(new Set(registrarRows.map((item) => item.id))); setRegistrarError(""); setRegistrarOpen(true); }} className="btn cursor-pointer bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
            <FileSpreadsheet className="h-4 w-4" /> Prepare Registrar handoff
          </button>
        </div>
      )}
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Dean decision" secondaryOptions={uniqueValues(rows.map((item) => item.dean_decision))} count={filteredRows.length} total={rows.length} />
      <div className="flex justify-end"><ViewModeToggle value={viewMode} onChange={setViewMode} /></div>
      {viewMode === "board" ? (
        <WorkflowBoard
          columns={WITHDRAWAL_BOARD_COLUMNS}
          rows={filteredRows}
          getStatus={(item) => item.status}
          empty="No recent withdrawal requests match the filters."
          renderCard={(item) => <WithdrawalBoardCard key={item.id} item={item} onOpen={() => openCase(item)} onMessage={() => setMessageRow(item)} />}
        />
      ) : <WorkflowTable headers={["Student", "Request date", "Subject / semester", "Reason", "Status", "Next owner", "Action"]} empty="No withdrawal requests match the selected filters." rows={filteredRows} render={(item) => {
        return (
          <tr
            key={item.id}
            onClick={() => openCase(item)}
            className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
          >
            <StudentCell student={item.student} />
            <td className="px-3 py-3 text-sm text-slate-600">{formatDate(item.created_at)}</td>
            <td className="px-3 py-3 text-sm text-slate-600"><span className="font-semibold text-ink">{item.subject?.course_code || "Subject pending"}</span><span className="block text-xs">{item.effective_term || item.subject?.term_label || "—"}</span></td>
            <td className="max-w-[240px] px-3 py-3 text-sm text-slate-600"><span className="line-clamp-2">{item.reason || "No reason provided"}</span></td>
            <td className="px-3 py-3"><StatusBadge value={item.status} dot={false} /></td>
            <td className="px-3 py-3 text-xs font-semibold text-slate-600">{item.next_action_owner || "—"}{item.unresolved_messages > 0 && <p className="mt-1 text-amber-700">{item.unresolved_messages} concern(s)</p>}</td>
            <td className="px-3 py-3"><button type="button" onClick={(event) => { event.stopPropagation(); openCase(item); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> Open case</button></td>
          </tr>
        );
      }} />}
      {selectedItem && (
        <WorkflowCaseModal
          id={`withdrawal-case-${selectedItem.id}`}
          title={selectedItem.student.name}
          subtitle={`${selectedItem.student.student_number} · ${selectedItem.student.program_code} · Subject withdrawal`}
          status={selectedCurrent?.status || (reset.resetMessage ? "Reset" : selectedItem.status)}
          onClose={closeCase}
          footer={(
            <>
              {accountRole === "staff" && selectedCurrent && <DemoResetButton student={selectedCurrent.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedCurrent && <button type="button" onClick={() => setMessageRow(selectedCurrent)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => setPendingAction({ ...selectedAction, fromStatus: selectedCurrent.status, toStatus: selectedAction.label })} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">{selectedCurrent ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "This demo case has been reset."}</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Detail label="Dean" value={selectedCurrent?.dean_decision || selectedItem.dean_decision} />
              <Detail label="Registrar handoff" value={selectedItem.registrar_status || "Pending"} />
              <Detail label="Selected subject" value={`${selectedItem.subject?.course_code || "Pending"} — ${selectedItem.subject?.course_title || "No subject attached"}`} />
              <Detail label="Official offered-subject status" value={["Subject Tagged - Registrar Preparation", "Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"].includes(selectedCurrent?.status || selectedItem.status) ? "Withdrawn" : "Awaiting GS Staff tag"} />
              <Detail label="Semester" value={selectedItem.effective_term || selectedItem.subject?.term_label || "Pending"} />
              <Detail label="Eligibility window" value={selectedItem.withdrawal_window?.status || "Not recorded"} />
              <Detail label="Academic record effect" value={selectedItem.academic_record_effect || "No academic record / no grade impact"} />
            </div>
            <WorkflowTimeline steps={withdrawalSteps} title="Withdrawal workflow timeline" />
            <CaseMessageHistory messages={selectedCurrent?.messages || selectedItem.messages} />
            <WorkflowActivityList logs={selectedCurrent?.history || selectedItem.history || []} />
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Request</p>
              <p className="mt-2 text-sm font-semibold text-ink">{selectedItem.subject?.course_code || "Subject pending"} — {selectedItem.subject?.course_title || "Selected subject"}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{selectedItem.effective_term || selectedItem.subject?.term_label || "Semester pending"}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{selectedItem.reason || "No reason provided"}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedItem.request_attachment?.file_exists && <a href={selectedItem.request_attachment.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5">Request form <ArrowUpRight className="h-3.5 w-3.5" /></a>}
                {selectedItem.request_attachment?.file_exists === false && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">The saved request form is unavailable</span>}
              </div>
            </div>
            <WorkflowFileHistory files={selectedCurrent?.attachments || selectedItem.attachments || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {registrarOpen && accountRole === "staff" && (
        <WorkflowCaseModal
          id="withdrawal-registrar-handoff"
          title="Approved subject withdrawals"
          subtitle={`${selectedRegistrarRows.length} selected · Excel list for Graduate School Staff to forward to the Registrar`}
          status={selectedRegistrarReady ? "Exported - Ready to Send" : "Pending Excel Export"}
          onClose={() => { if (!registrarBusy) setRegistrarOpen(false); }}
          size="wide"
          footer={(
            <>
              <button type="button" disabled={Boolean(registrarBusy)} onClick={() => setRegistrarOpen(false)} className="btn-ghost cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">Close</button>
              <button type="button" disabled={Boolean(registrarBusy) || !selectedRegistrarRows.length} onClick={exportRegistrarWorkbook} className="btn-ghost cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                <Download className="h-4 w-4" /> {registrarBusy === "export" ? "Exporting…" : "Download Excel list"}
              </button>
              <button type="button" disabled={Boolean(registrarBusy) || !selectedRegistrarReady} onClick={forwardRegistrarWorkbook} className="btn-primary cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50">
                <Send className="h-4 w-4" /> {registrarBusy === "send" ? "Forwarding…" : "Confirm forwarded to Registrar"}
              </button>
            </>
          )}
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-900">Registrar handoff sequence</p>
              <ol className="mt-2 grid gap-2 text-xs font-semibold text-emerald-800 sm:grid-cols-3">
                <li className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-emerald-200">Step 1: Select approved students</li>
                <li className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-emerald-200">Step 2: Download the Excel list</li>
                <li className="rounded-lg bg-white/80 px-3 py-2 ring-1 ring-emerald-200">Step 3: Forward it and confirm the handoff</li>
              </ol>
            </div>
            {registrarError && <div role="alert"><ErrorNote message={registrarError} /></div>}
            <label className="block">
              <span className="field-label">Registrar reference / delivery note</span>
              <Input value={registrarReference} onChange={(event) => setRegistrarReference(event.target.value)} placeholder="Optional: email subject, receiving office, or tracking reference" />
            </label>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-ink">Tagged withdrawn students</p>
                  <p className="text-xs text-slate-500">Every selected subject already shows Withdrawn in Official Offered Subjects, with no academic grade or penalty.</p>
                </div>
                <button type="button" onClick={() => setSelectedRegistrarIds(new Set(registrarRows.map((item) => item.id)))} className="btn-ghost cursor-pointer px-3 py-1.5">Select all</button>
              </div>
              <div className="max-h-[48vh] overflow-auto">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs font-bold uppercase tracking-wide text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Select</th>
                      <th className="px-4 py-3">Student</th>
                      <th className="px-4 py-3">Subject</th>
                      <th className="px-4 py-3">Semester / deadline</th>
                      <th className="px-4 py-3">Academic record</th>
                      <th className="px-4 py-3">Registrar status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrarRows.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 align-top transition-colors hover:bg-emerald-50/50">
                        <td className="px-4 py-3"><input type="checkbox" checked={selectedRegistrarIds.has(item.id)} onChange={() => toggleRegistrarRow(item.id)} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" aria-label={`Select ${item.student.name}`} /></td>
                        <td className="px-4 py-3"><p className="font-semibold text-ink">{item.student.name}</p><p className="text-xs text-slate-500">{item.student.student_number} · {item.student.program_code}</p></td>
                        <td className="px-4 py-3"><p className="font-semibold text-slate-700">{item.subject?.course_code || "Subject pending"}</p><p className="text-xs text-slate-500">{item.subject?.course_title || "No title"}</p></td>
                        <td className="px-4 py-3 text-xs text-slate-600"><p className="font-semibold">{item.effective_term || item.subject?.term_label || "Not recorded"}</p><p>Deadline: {item.withdrawal_window?.deadline || "Not recorded"}</p></td>
                        <td className="px-4 py-3 text-xs font-semibold text-emerald-700">No grade / no penalty</td>
                        <td className="px-4 py-3"><StatusBadge value={item.registrar_status || "Pending Excel Export"} dot={false} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {!selectedRegistrarReady && selectedRegistrarRows.length > 0 && <p className="text-xs font-semibold text-amber-700">Download the Excel list before confirming the Registrar handoff.</p>}
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="withdrawal" row={messageRow} context={context} onClose={() => setMessageRow(null)} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {pendingAction && selectedCurrent && <WorkflowTransitionModal slug="withdrawal" student={selectedCurrent.student} action={pendingAction} busy={submitting || refreshing} onClose={() => setPendingAction(null)} onConfirm={submit} />}
    </div>
  );
}

export function GraduationRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [expandedBatchIds, setExpandedBatchIds] = useState(() => new Set());
  const [stageGroup, setStageGroup] = useState(null);
  const [exportingBatchId, setExportingBatchId] = useState("");
  const [exportError, setExportError] = useState("");
  const reset = useDemoCaseReset("graduation", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", course: "", secondary: "", dateFrom: "", dateTo: "", sort: "newest" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map(graduationRowStatus)), [rows]);
  const completedCourses = useMemo(() => {
    const coursesByCode = new Map();
    rows.forEach((row) => {
      (row.eligibility?.completed_courses || []).forEach((course) => {
        if (course.code && !coursesByCode.has(course.code)) coursesByCode.set(course.code, course);
      });
    });
    return [...coursesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const courseText = (row.eligibility?.completed_courses || []).map((course) => `${course.code} ${course.title}`).join(" ");
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.student.program_name} ${row.endorsement?.batch_name || ""} ${courseText}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || graduationRowStatus(row) === filters.status)
      && (!filters.course || (row.eligibility?.completed_courses || []).some((course) => course.code === filters.course));
  }).sort((left, right) => left.student.name.localeCompare(right.student.name)), [rows, filters]);
  const visibleRows = useMemo(
    () => sortSelectedWorkflowRows(filteredRows, selectedIds, (row) => row.student.name, (row) => row.student.id),
    [filteredRows, selectedIds],
  );
  const awaitingApplicationRows = useMemo(
    () => visibleRows.filter((row) => row.eligibility?.eligible && !row.endorsement?.batch_name && !row.has_submitted_documents),
    [visibleRows],
  );
  const readyForBatchRows = useMemo(
    () => visibleRows.filter((row) => row.eligibility?.eligible && !row.endorsement?.batch_name && row.has_submitted_documents),
    [visibleRows],
  );
  const visibleBatchedRows = useMemo(
    () => visibleRows.filter((row) => Boolean(row.endorsement?.batch_name)),
    [visibleRows],
  );
  const selectedRows = useMemo(
    () => sortSelectedWorkflowRows(rows.filter((row) => selectedIds.has(row.student.id)), selectedIds, (row) => row.student.name, (row) => row.student.id),
    [rows, selectedIds],
  );
  const visibleBatchGroups = useMemo(
    () => graduationBatchGroups(visibleBatchedRows, selectedIds),
    [visibleBatchedRows, selectedIds],
  );
  function toggleReadyStudent(studentId) {
    const readyIds = new Set(readyForBatchRows.map((row) => row.student.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => readyIds.has(id)));
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }
  function createPreBatch() {
    const candidateIds = readyForBatchRows.filter((row) => selectedIds.has(row.student.id)).map((row) => row.student.id);
    if (!candidateIds.length) return;
    setSelectedIds(new Set(candidateIds));
    setBatchOpen(true);
  }
  function toggleBatchGroup(group) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = group.rows.every((row) => next.has(row.student.id));
      group.rows.forEach((row) => {
        if (allSelected) next.delete(row.student.id); else next.add(row.student.id);
      });
      return next;
    });
  }
  function processBatchGroup(group) {
    setSelectedIds(new Set(group.rows.map((row) => row.student.id)));
    setBatchOpen(true);
  }
  function toggleExpandedBatch(groupId) {
    setExpandedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
  }
  async function exportApprovedBatch(group) {
    setExportingBatchId(group.id);
    setExportError("");
    try {
      const endorsementIds = group.rows.map((row) => row.endorsement?.id).filter(Boolean);
      const exportResult = await api.exportGraduationCsv("", endorsementIds);
      setMessageNotice(`${group.label} exported as ${exportResult.filename}. The file is ready for the external Registrar process.`);
      await refetch();
    } catch (error) {
      setExportError(error.message || "Could not export the Dean-approved graduation list.");
    } finally {
      setExportingBatchId("");
    }
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedStageAction = selectedRow ? graduationStageActionForRow(selectedRow, accountRole) : null;
  const selectedEndorsement = selectedRow?.endorsement || null;
  const graduationSteps = selectedRow ? graduationTimelineSteps(selectedEndorsement?.endorsement_status, selectedRow.eligibility) : [];

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Graduation endorsement candidates" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · AC checks coursework, Research validates evidence, Staff prepares, and the Dean owns the endorsement export`} icon={GraduationCap} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      {exportError && <div role="alert"><ErrorNote message={exportError} /></div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} count={filteredRows.length} total={rows.length} showAdvanced={false} />
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="block max-w-xl">
          <span className="field-label">Completed course cohort</span>
          <select
            value={filters.course}
            onChange={(event) => setFilters((current) => ({ ...current, course: event.target.value }))}
            className="field-input"
          >
            <option value="">All completed courses</option>
            {completedCourses.map((course) => <option key={course.code} value={course.code}>{course.code} — {course.title}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">GS Staff can filter by program or completed course, choose “Select all visible” in Step 2, and create a cohort-specific graduation batch.</p>
      </div>
      <div className="max-w-full overflow-x-auto rounded-xl pb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500" role="region" aria-label="Graduation workflow Kanban board" tabIndex={0}>
        <div className="grid grid-cols-1 gap-4 sm:flex sm:w-max sm:items-start">
          <GraduationCandidateStageSection
            stageNumber={1}
            title="Academically Eligible — Awaiting Student Application"
            description="These students completed all required academic, research, and practicum stages. They are visible to staff, but cannot be selected for a graduation batch until they submit the signed application / review-window PDF in the student portal."
            empty="No academically eligible students are currently waiting for a graduation application."
            rows={awaitingApplicationRows}
            accountRole={accountRole}
            selectedIds={selectedIds}
            onToggleStudent={toggleReadyStudent}
            onSelectAll={() => {}}
            onClearSelection={() => setSelectedIds(new Set())}
            onCreateBatch={createPreBatch}
            onOpenStudent={openCase}
          />
          <GraduationCandidateStageSection
            stageNumber={2}
            title="Application Submitted — Ready for Batch Creation"
            description="The required student application / review-window PDF is on file. GS Staff may select individual students, all visible students, a program, or a completed-course cohort before creating the batch. Other staff accounts see this stage as read-only."
            empty="No submitted graduation applications are waiting for batch creation."
            rows={readyForBatchRows}
            accountRole={accountRole}
            selectedIds={selectedIds}
            selectable
            onToggleStudent={toggleReadyStudent}
            onSelectAll={() => setSelectedIds(new Set(readyForBatchRows.map((row) => row.student.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onCreateBatch={createPreBatch}
            onOpenStudent={openCase}
          />
          <GraduationBatchBoardSections
            groups={visibleBatchGroups}
            accountRole={accountRole}
            selectedIds={selectedIds}
            expandedBatchIds={expandedBatchIds}
            onToggleBatch={["staff", "academic_coordinator", "research_coordinator"].includes(accountRole) ? toggleBatchGroup : null}
            onToggleExpanded={toggleExpandedBatch}
            onProcessBatch={processBatchGroup}
            onOpenStudent={openCase}
            onMessageStudent={setMessageRow}
            onViewStage={setStageGroup}
            onExportBatch={accountRole === "dean" ? exportApprovedBatch : null}
            exportingBatchId={exportingBatchId}
          />
        </div>
      </div>
      {selectedRow && (
        <WorkflowCaseModal
          id={`graduation-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Graduation endorsement`}
          status={selectedEndorsement?.endorsement_status || selectedRow.eligibility.status}
          onClose={() => setSelectedStudentId(null)}
          size="wide"
          footer={(
            <>
              {accountRole === "staff" && selectedEndorsement && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedEndorsement && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn cursor-pointer border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:border-red-300 hover:bg-red-100"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedStageAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => { setSelectedIds(new Set([selectedRow.student.id])); setBatchOpen(true); }} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedStageAction.label}
                </button>
              ) : selectedEndorsement?.endorsement_status === "Dean Approved" ? (
                <span className="self-center rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Awaiting Dean export</span>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">No {WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <div className="grid gap-3 sm:grid-cols-2"><Detail label="Program" value={selectedRow.student.program_name} /><Detail label="Batch" value={selectedEndorsement?.batch_name || "No batch assigned"} /></div>
            {selectedEndorsement?.request_attachment?.file_exists !== false && selectedEndorsement?.request_attachment?.url && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">Student graduation application PDF</p>
                  <p className="truncate text-xs text-brand-700">{selectedEndorsement.request_attachment.name}</p>
                </div>
                <a href={selectedEndorsement.request_attachment.url} target="_blank" rel="noreferrer" className="btn-primary cursor-pointer px-3 py-2">
                  <Eye className="h-4 w-4" /> View submitted PDF <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {selectedEndorsement?.request_attachment?.file_exists === false && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">The submitted graduation application PDF is unavailable.</div>
            )}
            <GraduationRequirementBoxes row={selectedRow} />
            <WorkflowTimeline steps={graduationSteps} title="Graduation endorsement timeline" />
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
            <WorkflowFileHistory files={selectedEndorsement?.attachments || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="graduation" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {batchOpen && selectedRows.length > 0 && <GraduationBatchModal rows={selectedRows} accountRole={accountRole} reviewWindows={context.graduation_review_windows || []} defaultReviewWindow={context.graduation_default_review_window || ""} onClose={() => setBatchOpen(false)} onSaved={async (batchResult) => { setMessageNotice(batchResult.message); setSelectedIds(new Set()); await refetch(); }} />}
      {stageGroup && <GraduationBatchStageModal group={stageGroup} onClose={() => setStageGroup(null)} />}
    </div>
  );
}

function WorkflowTable({ headers, rows, render, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

function RosterFilters({ filters, setFilters, programs, statuses, secondaryLabel, secondaryOptions = [], count, total, showAdvanced = true }) {
  const active = Object.entries(filters).filter(([key, value]) => Boolean(value) && !(key === "sort" && value === "newest")).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => setFilters(Object.fromEntries(
    Object.keys(filters).map((key) => [key, key === "sort" ? "newest" : ""])
  ));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search list</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search name, ID, program…" aria-label="Search list" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter by workflow stage or status"><option value="">All stages / statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        {secondaryLabel && <select value={filters.secondary || ""} onChange={update("secondary")} className="field-input cursor-pointer" aria-label={`Filter by ${secondaryLabel}`}><option value="">All {secondaryLabel.toLowerCase()}</option>{secondaryOptions.map((option) => <option key={option}>{option}</option>)}</select>}
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated from</span><input type="date" value={filters.dateFrom || ""} onChange={update("dateFrom")} className="field-input" /></label>}
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Updated through</span><input type="date" value={filters.dateTo || ""} onChange={update("dateTo")} className="field-input" /></label>}
        {showAdvanced && <label><span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Sort</span><select value={filters.sort || "newest"} onChange={update("sort")} className="field-input cursor-pointer"><option value="newest">Newest updated</option><option value="oldest">Oldest updated</option><option value="student">Student name</option></select></label>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Showing {count} of {total} records</span>
        {active > 0 && <button type="button" onClick={clearFilters} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button>}
      </div>
    </div>
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function dateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

function sortWorkflowRows(rows, sort, dateFor, nameFor) {
  return [...rows].sort((left, right) => {
    if (sort === "student") return nameFor(left).localeCompare(nameFor(right));
    const leftDate = new Date(dateFor(left) || 0).getTime();
    const rightDate = new Date(dateFor(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

function sortSelectedWorkflowRows(rows, selectedIds, nameFor, idFor) {
  if (!selectedIds?.size) return rows;
  return [...rows].sort((left, right) => {
    const leftSelected = selectedIds.has(idFor(left));
    const rightSelected = selectedIds.has(idFor(right));
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return nameFor(left).localeCompare(nameFor(right));
    return 0;
  });
}

function StudentCell({ student }) {
  return <td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p></td>;
}

function Detail({ label, value }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value || "—"}</p></div>;
}

function PracticumForm({ context, studentId, submit, submitting }) {
  const selected = context.selected_student;
  const current = context.practicum_record;
  const [form, setForm] = useState({
    moa_status: "Uploaded",
    moa_uploaded: "true",
    practicum_site: "",
    required_hours: 200,
    completed_hours: 0,
    document_status: "Pending Review",
    status: "Under Review",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      moa_status: current?.moa_status || "Uploaded",
      moa_uploaded: current?.moa_uploaded ? "true" : "true",
      practicum_site: current?.practicum_site || "",
      required_hours: current?.required_hours || 200,
      completed_hours: current?.completed_hours || 0,
      document_status: current?.document_status || "Pending Review",
      status: current?.status || "Under Review",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (selected && !selected.program_has_practicum) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Practicum not required"
        hint={`${selected.program_code} is not marked as a practicum-required program.`}
      />
    );
  }

  const completeEnough = Number(form.completed_hours || 0) >= Number(form.required_hours || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process practicum submission" subtitle="Record MOA receipt, certificate review, hours, and Dean report status" icon={Briefcase} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{current.practicum_site || "Practicum site not set"}</p>
              <p className="text-xs text-slate-500">{current.completed_hours}/{current.required_hours} hours · {current.certificate_count} certificate(s)</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MOA status">
          <Select value={form.moa_status} onChange={set("moa_status")} placeholder="" options={["Uploaded", "Pending Review", "Verified", "Returned", "Missing"]} />
        </Field>
        <Field label="Practicum site / company" required>
          <Input value={form.practicum_site} onChange={set("practicum_site")} required />
        </Field>
        <Field label="Required hours" required>
          <Input type="number" min="1" value={form.required_hours} onChange={set("required_hours")} required />
        </Field>
        <Field label="Completed hours" required>
          <Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required />
        </Field>
        <Field label="Certificate/document status">
          <Select value={form.document_status} onChange={set("document_status")} placeholder="" options={["Missing", "Uploaded", "Pending Review", "Verified", "Returned"]} />
        </Field>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Certificates detected by system</p><p className="mt-1 text-lg font-semibold text-emerald-950">{current?.certificate_count || 0}</p></div>
        <Field label="Workflow status">
          <Select
            value={form.status}
            onChange={set("status")}
            placeholder=""
            options={["MOA Received", "Under Review", "Hours Incomplete", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} placeholder="Email, drive link, or staff note" />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Reviewer comments are added through the case discussion so the sender, recipient, date, and time remain visible.</p>
      {!completeEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Completed hours are below the requirement. Saving will keep this case incomplete and queue the student for additional certificates.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save practicum status</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Graduation Endorsement
// ---------------------------------------------------------------------------
function GraduationForm({ context, studentId, submit, submitting }) {
  const eligibility = context.graduation_eligibility || {};
  const current = context.graduation_endorsement;
  const reviewWindows = context.graduation_review_windows || [];
  const activeReviewWindow = context.graduation_default_review_window || reviewWindows[0] || "";
  const defaultReviewWindow = activeReviewWindow || current?.review_window || "";
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    review_window: defaultReviewWindow,
    endorsement_status: "For Review",
    dean_remarks: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      review_window: defaultReviewWindow,
      endorsement_status: current?.endorsement_status || (eligibility.eligible ? "Ready for Dean Review" : "For Review"),
      dean_remarks: current?.dean_remarks || "",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at, eligibility.eligible, defaultReviewWindow]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => ({ type: "Coursework", item })),
    ...(eligibility.missing_research_requirements || []).map((item) => ({ type: "Research", item })),
    ...(eligibility.missing_practicum_requirement ? [{ type: "Practicum", item: eligibility.missing_practicum_requirement }] : []),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review graduation endorsement" subtitle="Monitor endorsement readiness before the external graduation process" icon={GraduationCap} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MiniBox label="Coursework" value={eligibility.coursework_status || "Pending"} tone={eligibility.coursework_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Research" value={eligibility.research_status || "Pending"} tone={eligibility.research_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Practicum" value={eligibility.practicum_status || "Not Required"} tone={eligibility.practicum_status === "Not Required" || eligibility.practicum_status === "Dean Reviewed" ? "brand" : "amber"} />
        <MiniBox label="Eligible" value={eligibility.eligible ? "Yes" : "No"} tone={eligibility.eligible ? "brand" : "red"} />
      </div>
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Missing requirements</p>
          <ul className="space-y-1.5">
            {missing.slice(0, 10).map((row, index) => (
              <li key={`${row.type}-${index}`} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><span className="font-semibold">{row.type}:</span> {row.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Graduation school year" required>
          <Select value={form.review_window} onChange={set("review_window")} options={reviewWindowOptions} placeholder="" required />
        </Field>
        <Field label="Endorsement status">
          <Select
            value={form.endorsement_status}
            onChange={set("endorsement_status")}
            placeholder=""
            options={["For Review", "Ready for Dean Review", "Not Eligible", "Returned for Revision"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Dean remarks">
        <Textarea value={form.dean_remarks} onChange={set("dean_remarks")} />
      </Field>
      {!eligibility.eligible && form.endorsement_status === "Ready for Dean Review" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This candidate still has missing requirements. Saving will keep the backend status as Not Eligible and queue the listed owner.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save endorsement review</SubmitButton>
    </form>
  );
}

function shortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatDateTime(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

function timeRange(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

// ---------------------------------------------------------------------------
// AWOL & Residency
// ---------------------------------------------------------------------------
function AwolResidencyPanel({ context, meta, submit, submitting, refreshing, result, submitError, setStudentId, setStudentLabel, refetch, accountRole }) {
  const rows = context?.roster || [];
  const [viewMode, setViewMode] = useState("board");
  const [filters, setFilters] = useState({ query: "", status: "" });
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState({ id: null, label: "" });
  const [form, setForm] = useState({
    residency_reason: "",
    term_id: "",
    staff_notes: "",
  });
  const [review, setReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [messageRow, setMessageRow] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const statuses = uniqueValues(rows.map((item) => item.status));
  const filteredRows = rows.filter((item) => {
    const student = item.student || {};
    const haystack = `${student.name || ""} ${student.student_number || ""} ${student.program_code || ""} ${item.status || ""} ${item.policy_classification || ""} ${item.reason || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.status || item.status === filters.status);
  });
  const selectedTerm = form.term_id || String(meta?.terms?.find((item) => item.is_active_planning_term)?.id || "");

  useEffect(() => {
    if (!selectedRow) return;
    const current = rows.find((item) => item.kind === selectedRow.kind && item.id === selectedRow.id);
    if (current && current !== selectedRow) setSelectedRow(current);
  }, [rows, selectedRow?.kind, selectedRow?.id]);

  function chooseStudent(id, label) {
    setSelectedStudent({ id, label });
    setStudentId(id);
    setStudentLabel(label || "");
    setReview(null);
    setReviewNotice("");
  }

  async function runReview(reviewAction = "record_residency", row = selectedRow) {
    const studentId = row?.student_id || selectedStudent.id;
    if (!studentId) {
      setReviewError("Choose a student before running the policy review.");
      return;
    }
    setReviewing(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const response = await api.awolPolicyReview({
        student_id: studentId,
        workflow_action: reviewAction === "forward_return_to_dean" ? "return_from_awol" : reviewAction,
        residency_reason: form.residency_reason,
        application_reference: row?.return_intent ? "Structured portal return declaration" : "",
      });
      setReview(response.review);
    } catch (error) {
      setReviewError(error.message || "Could not run the AWOL/residency policy review.");
    } finally {
      setReviewing(false);
    }
  }

  async function saveNewAction(event) {
    event.preventDefault();
    if (!selectedStudent.id) return;
    const saved = await submit({
      student_id: selectedStudent.id,
      workflow_action: "record_residency",
      residency_reason: form.residency_reason,
      term_id: selectedTerm,
      staff_notes: form.staff_notes,
    });
    if (saved) {
      setSelectedStudent({ id: null, label: "" });
      setStudentId(null);
      setStudentLabel("");
      setReview(null);
      setForm((current) => ({ ...current, residency_reason: "", staff_notes: "" }));
    }
  }

  async function forwardReturn() {
    if (!selectedRow) return;
    const saved = await submit({
      student_id: selectedRow.student_id,
      case_id: selectedRow.id,
      workflow_action: "forward_return_to_dean",
      staff_notes: form.staff_notes,
    });
    if (saved) {
      setSelectedRow(null);
      setReview(null);
      setReviewNotice("");
    }
  }

  async function endResidency() {
    if (!selectedRow) return;
    const saved = await submit({
      student_id: selectedRow.student_id,
      residency_id: selectedRow.id,
      workflow_action: "end_residency",
      staff_notes: form.staff_notes,
    });
    if (saved) setSelectedRow(null);
  }

  return (
    <div className="space-y-5">
      {messageNotice && (
        <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          {messageNotice}
        </div>
      )}
      <Card className="p-6">
        <SectionTitle title="Automatic AWOL alerts and residency" subtitle="AWOL is created from source evidence; staff only review alerts, return requests, and valid residency enrollment" icon={UserX} />
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">AWOL cannot be declared manually</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">The system flags an imported AWOL standing or a full-semester withdrawal without approved LOA, then creates an Academic Coordinator work item. A missing pre-enrollment record by itself is not enough.</p>
        </div>
        <form onSubmit={saveNewAction} className="mt-5 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <p className="field-label">Student</p>
              <StudentPicker value={selectedStudent.id} selectedLabel={selectedStudent.label} meta={meta} onChange={chooseStudent} />
            </div>
            <Field label="Residency purpose" required><Select value={form.residency_reason} onChange={(event) => { setForm((current) => ({ ...current, residency_reason: event.target.value })); setReview(null); }} placeholder="Select handbook purpose" options={context?.residency_reasons || []} required /></Field>
          </div>
          <Field label="Semester" required><Select value={selectedTerm} onChange={(event) => setForm((current) => ({ ...current, term_id: event.target.value }))} placeholder="Select semester" options={(meta?.terms || []).map((term) => ({ value: String(term.id), label: term.label }))} required /></Field>
          <Field label="Staff verification notes" hint="Required when the residency policy result needs human review."><Textarea value={form.staff_notes} onChange={(event) => setForm((current) => ({ ...current, staff_notes: event.target.value }))} /></Field>
          {review && <PolicyReviewCard title="Residency policy review" description="Deterministic handbook checks using the recorded academic state; no RAG or automated decision." emptyText="" review={review} busy={reviewing} error={reviewError} notice={reviewNotice} onReview={() => runReview()} onApply={() => setReviewNotice(`Applied guidance: ${review.suggested_action}. The saved action will recalculate this policy result.`)} />}
          {!review && reviewError && <ErrorNote message={reviewError} />}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => runReview()} disabled={reviewing || !selectedStudent.id || !form.residency_reason} className="btn-ghost cursor-pointer"><ClipboardCheck className="h-4 w-4" /> {reviewing ? "Checking…" : "Run residency policy checker"}</button>
            <button type="submit" disabled={submitting || !selectedStudent.id || !review || !form.residency_reason} className="btn-primary cursor-pointer">{submitting ? "Saving…" : "Record residency"}</button>
          </div>
          <WorkflowSubmitFeedback result={result} error={submitError} />
        </form>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="AWOL, return, and residency cases" subtitle="Board and table views share the same policy-derived case status" icon={UserX} />
          <ViewModeToggle value={viewMode} onChange={setViewMode} />
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <label className="relative min-w-[220px] flex-1"><span className="sr-only">Search AWOL and residency cases</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} className="field-input pl-9" placeholder="Search student, program, status…" /></label>
          <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} className="field-input cursor-pointer sm:w-64" aria-label="Filter AWOL and residency cases by status"><option value="">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        </div>
        {viewMode === "board" ? (
          <WorkflowBoard columns={AWOL_BOARD_COLUMNS} rows={filteredRows} getStatus={(item) => item.status} empty="No AWOL or residency cases match the filters." renderCard={(item) => <AwolBoardCard key={`${item.kind}-${item.id}`} item={item} onOpen={() => { setSelectedRow(item); setReview(null); setReviewNotice(""); }} onMessage={item.kind === "awol" && item.request_id ? () => setMessageRow(item) : null} />} />
        ) : (
          <WorkflowTable headers={["Student", "Type", "Status", "Policy classification", "Semester / date", "Action"]} rows={filteredRows} empty="No AWOL or residency cases match the filters." render={(item) => <tr key={`${item.kind}-${item.id}`} className="border-b border-slate-100"><StudentCell student={item.student} /><td className="px-3 py-3 text-sm text-slate-600">{item.kind === "residency" ? "Residency" : "AWOL / Return"}</td><td className="px-3 py-3"><StatusBadge value={item.status} dot={false} /></td><td className="px-3 py-3 text-sm text-slate-600">{item.policy_classification || item.policy_status || "Not reviewed"}</td><td className="px-3 py-3 text-sm text-slate-600">{item.term_label || item.target_return_term || item.awol_effective_date || "—"}</td><td className="px-3 py-3"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSelectedRow(item); setReview(null); setReviewNotice(""); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> View</button>{item.kind === "awol" && item.request_id && <button type="button" onClick={() => setMessageRow(item)} className="btn-ghost cursor-pointer px-3 py-2"><MessageSquare className="h-4 w-4" /> Message</button>}</div></td></tr>} />
        )}
      </Card>

      {selectedRow && (
        <WorkflowCaseModal id={`awol-residency-${selectedRow.kind}-${selectedRow.id}`} title={selectedRow.student?.name || "Standing case"} subtitle={`${selectedRow.student?.student_number || ""} · ${selectedRow.student?.program_code || ""} · ${selectedRow.kind === "residency" ? "Residency" : "AWOL / Return"}`} status={selectedRow.status} onClose={() => { setSelectedRow(null); setReview(null); }} footer={<>{selectedRow.kind === "awol" && selectedRow.request_id && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}{selectedRow.kind === "awol" && ["Return Submitted", "Returned for Revision"].includes(selectedRow.status) ? <button type="button" disabled={submitting || !review} onClick={forwardReturn} className="btn-primary cursor-pointer">Forward to Dean</button> : selectedRow.kind === "residency" && selectedRow.record_status === "Active" ? <button type="button" disabled={submitting} onClick={endResidency} className="btn-primary cursor-pointer">Close residency</button> : null}</>}>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3"><Detail label="Status" value={selectedRow.status} /><Detail label="Policy classification" value={selectedRow.policy_classification || selectedRow.policy_status || "Not reviewed"} /><Detail label="Dean decision" value={selectedRow.dean_decision || "Not applicable"} /></div>
            {selectedRow.kind === "awol" && <div className="grid gap-3 sm:grid-cols-2"><Detail label="AWOL effective date" value={formatDate(selectedRow.awol_effective_date)} /><Detail label="Automatic detection source" value={selectedRow.detection_source || "Imported standing"} /><Detail label="Last enrolled semester" value={selectedRow.last_enrolled_term || "Not recorded"} /><Detail label="Target return semester" value={selectedRow.target_return_term || "Not submitted"} /><Detail label="Years in program" value={selectedRow.years_in_program ?? "Not calculated"} /><Detail label="Residence limits" value={selectedRow.normal_residence_years ? `${selectedRow.normal_residence_years} normal / ${selectedRow.absolute_residence_years} absolute` : "Not calculated"} /></div>}
            {selectedRow.kind === "residency" && <div className="grid gap-3 sm:grid-cols-2"><Detail label="Semester" value={selectedRow.term_label} /><Detail label="Purpose" value={selectedRow.reason} /></div>}
            {selectedRow.kind === "awol" && selectedRow.return_intent && <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Student's written intention</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedRow.return_intent}</p>{selectedRow.return_reason && <><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">Reason for return</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{selectedRow.return_reason}</p></>}</div>}
            {selectedRow.kind === "awol" && ["Return Submitted", "Returned for Revision"].includes(selectedRow.status) && <><Field label="Staff review notes"><Textarea value={form.staff_notes} onChange={(event) => setForm((current) => ({ ...current, staff_notes: event.target.value }))} /></Field>{review && <PolicyReviewCard title="Return-from-AWOL policy review" description="Deterministic checks for written intent and program-specific maximum residence before Dean routing." emptyText="" review={review} busy={reviewing} error={reviewError} notice={reviewNotice} onReview={() => runReview("forward_return_to_dean", selectedRow)} onApply={() => setReviewNotice(`Applied guidance: ${review.suggested_action}.`)} />}<button type="button" onClick={() => runReview("forward_return_to_dean", selectedRow)} disabled={reviewing} className="btn-ghost cursor-pointer"><ClipboardCheck className="h-4 w-4" /> {reviewing ? "Checking…" : "Run policy checker"}</button></>}
            {selectedRow.kind === "awol" && accountRole === "staff" && ["Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"].includes(selectedRow.status) && (
              <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <p className="text-sm font-semibold text-ink">Dean decision applied</p>
                <p className="text-xs text-slate-600">The approved standing outcome is already reflected. Enrollment remains a separate Academic Coordinator action.</p>
                <a href={selectedRow.registrar_report_url} className="btn-ghost w-fit cursor-pointer"><Download className="h-4 w-4" /> Export AWOL return report for Registrar</a>
              </div>
            )}
            {selectedRow.kind === "residency" && accountRole === "staff" && selectedRow.status === "Residency" && (
              <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/60 p-4">
                <p className="text-sm font-semibold text-ink">Residency active</p>
                <p className="text-xs text-slate-600">The term-enrollment and monitoring records were updated when staff recorded this residency.</p>
                <a href={selectedRow.registrar_report_url} className="btn-ghost w-fit cursor-pointer"><Download className="h-4 w-4" /> Export residency report for Registrar</a>
              </div>
            )}
            {selectedRow.kind === "awol" && <CaseMessageHistory messages={selectedRow.messages || []} />}
            {selectedRow.kind === "awol" && <WorkflowActivityList logs={selectedRow.history || []} />}
            <WorkflowSubmitFeedback result={result} error={submitError} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="awol" row={messageRow} context={context} onClose={() => setMessageRow(null)} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
    </div>
  );
}

function AwolBoardCard({ item, onOpen, onMessage }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 transition-colors hover:border-brand-300 hover:bg-brand-50/30">
      <div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold text-ink">{item.student?.name}</p><p className="text-xs text-slate-400">{item.student?.student_number} · {item.student?.program_code}</p></div><StatusBadge value={item.status} dot={false} /></div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-600">{item.policy_classification || item.policy_status || item.reason || "Policy review not yet recorded"}</p>
      <p className="mt-2 text-xs font-semibold text-brand-700">{item.kind === "residency" ? item.term_label : item.target_return_term || formatDate(item.awol_effective_date)}</p>
      {item.unresolved_messages > 0 && <p className="mt-2 text-xs font-semibold text-amber-700">{item.unresolved_messages} concern(s)</p>}
      <div className={`mt-3 grid gap-2 ${onMessage ? "grid-cols-2" : "grid-cols-1"}`}>
        <button type="button" onClick={onOpen} className="btn-ghost cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button>
        {onMessage && <button type="button" onClick={onMessage} className="btn-ghost cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Leave of Absence
// ---------------------------------------------------------------------------
function LeaveOfAbsenceForm({ context, studentId, submit, submitting, accountRole, embedded = false }) {
  const selectedRequest = context?.selected_request;
  const canForward = selectedRequest?.status === "Pending Review";
  const [policyReview, setPolicyReview] = useState(context?.loa_policy_review || null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10),
    effective_start: "",
    effective_end: "",
    reason_category: "",
    reason_remarks: "",
    eligibility_status: "Eligible",
    staff_notes: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setPolicyReview(context?.loa_policy_review || null);
  }, [context?.loa_policy_review]);

  useEffect(() => {
    if (!selectedRequest) return;
    setForm((current) => ({
      ...current,
      request_date: (selectedRequest.submitted_at || "").slice(0, 10) || current.request_date,
      effective_start: selectedRequest.effective_start || "",
      effective_end: selectedRequest.effective_end || "",
      reason_category: selectedRequest.reason_category || "",
      reason_remarks: selectedRequest.reason_remarks || "",
    }));
  }, [selectedRequest?.request_log_id]);

  async function runPolicyReview(applySuggestion = false) {
    if (!studentId) return;
    setReviewing(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const result = await api.loaPolicyReview({ student_id: studentId, ...form });
      setPolicyReview(result.review);
      if (applySuggestion && result.review) {
        setForm((current) => ({
          ...current,
          eligibility_status: result.review.recommendation || current.eligibility_status,
          staff_notes: mergeReviewSummary(current.staff_notes, result.review.summary),
        }));
        setReviewNotice("Suggestion applied to the eligibility review and staff notes.");
      }
    } catch (err) {
      setReviewError(err.message || "Could not run the LOA policy review.");
    } finally {
      setReviewing(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review leave application" subtitle="Run the fixed policy checks, record the review, and forward every decision to the Dean" icon={CalendarOff} />
      {!embedded && <RequestSummary request={selectedRequest} />}
      <LoaPolicyReviewCard
        review={policyReview}
        busy={reviewing}
        error={reviewError}
        notice={reviewNotice}
        onReview={() => runPolicyReview(false)}
        onApply={() => runPolicyReview(true)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Request date" required>
          <Input type="date" value={form.request_date} readOnly aria-readonly="true" className="bg-slate-50" required />
        </Field>
        <Field label="Effective start semester">
          <Input value={form.effective_start} readOnly aria-readonly="true" className="bg-slate-50" />
        </Field>
        <Field label="Effective end semester">
          <Input value={form.effective_end} readOnly aria-readonly="true" className="bg-slate-50" />
        </Field>
        <Field label="Reason category">
          <Input value={form.reason_category} readOnly aria-readonly="true" className="bg-slate-50" />
        </Field>
        <Field label="Eligibility status / check result">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>

      <Field label="Reason / remarks">
        <Textarea value={form.reason_remarks} readOnly aria-readonly="true" className="bg-slate-50" />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      {canForward ? (
        <SubmitButton submitting={submitting}>Forward to Dean</SubmitButton>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This request is <span className="font-semibold text-ink">{selectedRequest?.status || "not pending"}</span>. Staff can view its record; policy results remain advisory until the Dean decides.
        </div>
      )}
      {accountRole === "staff" && selectedRequest?.status === "Approved" && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
          <p className="text-sm font-semibold text-ink">Approved and applied</p>
          <p className="text-xs text-slate-600">The student standing changed to On Leave when the Dean approved the request.</p>
          <a href={`/api/standing-changes/leave-of-absence/${studentId}/registrar-report`} className="btn-ghost w-fit cursor-pointer">
            <Download className="h-4 w-4" /> Export LOA report for Registrar
          </a>
        </div>
      )}
    </form>
  );
}

function LoaPolicyReviewCard({ review, busy, error, notice, onReview, onApply }) {
  return (
    <PolicyReviewCard
      title="LOA policy review"
      description="Deterministic checklist using the approved LOA rules and the structured request fields. It does not use RAG and does not approve a case."
      emptyText="Run the review after selecting a submitted LOA request."
      review={review}
      busy={busy}
      error={error}
      notice={notice}
      onReview={onReview}
      onApply={onApply}
    />
  );
}

function PolicyReviewCard({ title, description, emptyText, review, busy, error, notice, onReview, onApply }) {
  const citations = review?.citations || [];
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-brand-100">
            <ClipboardCheck className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-xs text-slate-600">
              {description}
            </p>
          </div>
        </div>
        {review?.recommendation && <StatusBadge value={review.recommendation} dot={false} />}
      </div>
      {review ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-700">{review.summary}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(review.checks || []).map((check) => (
              <div key={check.label} className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{check.label}</p>
                  <StatusBadge value={check.status} dot={false} />
                </div>
                <p className="mt-1 text-xs text-slate-600">{check.detail}</p>
              </div>
            ))}
          </div>
          {citations.length > 0 && (
            <details className="rounded-xl bg-white px-3 py-2 ring-1 ring-black/5">
              <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-500">Policy sources</summary>
              <div className="mt-2 space-y-2">
                {citations.map((citation) => (
                  <div key={citation.id || citation.title} className="text-xs text-slate-600">
                    <p className="font-semibold text-slate-700">{citation.title} · {citation.source}</p>
                    <p className="mt-0.5">{citation.text}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-600">{emptyText}</p>
      )}
      {error && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {notice && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{notice}</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onReview} disabled={busy} className="btn-ghost">
          <ClipboardCheck className="h-4 w-4" /> {busy ? "Checking..." : "Run policy checker"}
        </button>
        <button type="button" onClick={onApply} disabled={busy || !review} className="btn-primary">
          Apply suggestion
        </button>
      </div>
    </div>
  );
}

function mergeReviewSummary(currentNotes, summary) {
  const existing = String(currentNotes || "").trim();
  const next = String(summary || "").trim();
  if (!next || existing.includes(next)) return existing;
  return existing ? `${existing}\n${next}` : next;
}

// ---------------------------------------------------------------------------
// Readmission
// ---------------------------------------------------------------------------
function ReadmissionForm({ context, studentId, submit, submitting, accountRole, embedded = false }) {
  const requirements = context.readmission_requirements || [];
  const selectedRequest = context?.selected_request;
  const canForward = selectedRequest?.status === "Pending Review";
  const [items, setItems] = useState(requirements);
  const [policyReview, setPolicyReview] = useState(context?.readmission_policy_review || null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewNotice, setReviewNotice] = useState("");
  const [form, setForm] = useState({
    target_return_term: "",
    previous_loa_period: "",
    previous_loa_start: "",
    previous_loa_end: "",
    return_intent: "",
    eligibility_status: "Eligible to Return",
    missing_requirements: "",
    staff_notes: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setItems((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  useEffect(() => setItems(context.readmission_requirements || []), [context.readmission_requirements]);
  useEffect(() => setPolicyReview(context?.readmission_policy_review || null), [context?.readmission_policy_review]);

  useEffect(() => {
    if (!selectedRequest) return;
    setForm((current) => ({
      ...current,
      target_return_term: selectedRequest.target_return_term || "",
      previous_loa_period: selectedRequest.previous_loa_period || "",
      previous_loa_start: selectedRequest.previous_loa_start || "",
      previous_loa_end: selectedRequest.previous_loa_end || "",
      return_intent: selectedRequest.return_intent || "",
    }));
  }, [selectedRequest?.request_log_id]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form, readmission_items: items });
  }

  async function runPolicyReview(applySuggestion = false) {
    if (!studentId) return;
    setReviewing(true);
    setReviewError("");
    setReviewNotice("");
    try {
      const result = await api.readmissionPolicyReview({ student_id: studentId, ...form, readmission_items: items });
      setPolicyReview(result.review);
      if (applySuggestion && result.review) {
        setForm((current) => ({
          ...current,
          eligibility_status: result.review.recommendation || current.eligibility_status,
          missing_requirements: (result.review.missing_requirements || []).join(", "),
          staff_notes: mergeReviewSummary(current.staff_notes, result.review.summary),
        }));
        setReviewNotice("Suggestion applied to eligibility, missing requirements, and staff notes.");
      }
    } catch (err) {
      setReviewError(err.message || "Could not run the readmission policy review.");
    } finally {
      setReviewing(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review readmission request" subtitle="Run the fixed return checks, record the review, and forward every decision to the Dean" icon={UserCheck} />
      {!embedded && <RequestSummary request={selectedRequest} />}
      <PolicyReviewCard
        title="Readmission policy review"
        description="Deterministic checklist using the approved readmission rules and structured request fields. It does not use RAG or make the decision."
        emptyText="Run the review after selecting a submitted readmission request."
        review={policyReview}
        busy={reviewing}
        error={reviewError}
        notice={reviewNotice}
        onReview={() => runPolicyReview(false)}
        onApply={() => runPolicyReview(true)}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Target return semester" required>
          <Input value={form.target_return_term} readOnly aria-readonly="true" className="bg-slate-50" required />
        </Field>
        <Field label="Previous LOA period">
          <Input value={form.previous_loa_period} readOnly aria-readonly="true" className="bg-slate-50" />
        </Field>
        <Field label="Eligibility to return status">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible to Return", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>
      <Field label="Student's return intention">
        <Textarea value={form.return_intent} readOnly aria-readonly="true" className="bg-slate-50" />
      </Field>
      <Field label="Eligibility to return checklist" hint="Unticked items are treated as missing requirements.">
        <CheckList items={requirements} selected={items} onToggle={toggle} />
      </Field>
      <Field label="Missing requirements / remarks">
        <Textarea value={form.missing_requirements} onChange={set("missing_requirements")} />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      {canForward ? (
        <SubmitButton submitting={submitting}>Complete review</SubmitButton>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This request is <span className="font-semibold text-ink">{selectedRequest?.status || "not pending"}</span>. Staff can view its record; policy results remain advisory until the Dean decides.
        </div>
      )}
      {accountRole === "staff" && selectedRequest?.status === "Approved" && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-4">
          <p className="text-sm font-semibold text-ink">Approved and applied</p>
          <p className="text-xs text-slate-600">Active standing was restored on Dean approval. Course enrollment remains a separate Academic Coordinator action.</p>
          <a href={`/api/standing-changes/readmission/${studentId}/registrar-report`} className="btn-ghost w-fit cursor-pointer">
            <Download className="h-4 w-4" /> Export readmission report for Registrar
          </a>
        </div>
      )}
    </form>
  );
}

function MiniBox({ label, value, tone }) {
  const tones = {
    brand: "text-brand-700 bg-brand-50",
    blue: "text-blue-700 bg-blue-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="font-display text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function workflowGuidance(slug) {
  const map = {
    "student-handoff":
      "Official source data arrives as a file. Upload the AC Student Monitoring sheet and the platform creates each student, their program, and their enrolled subjects automatically — no manual typing.",
    "leave-of-absence":
      "Leave of Absence is a stop/pause process. Staff verify the submitted application and forward it. The Dean alone approves, denies, or returns the request, and the student's status changes only after that decision.",
    readmission:
      "Readmission is a separate return/re-entry process after the approved leave period. A deterministic policy checker supports staff review, and every approval remains a Dean decision.",
    awol:
      "AWOL restricts registration after a student leaves without formal LOA. A return requires written intent routed through the Dean. The policy review applies the 5/7-year normal and 7/9-year absolute residence limits, while valid no-subject residency remains a separate active enrollment state.",
    "course-audit":
      "Run at the end of the semester. Pick a subject to see its enrolled students, then tick who completed it. Saving updates each student's course audit and missing count; a student who clears all subjects advances to Proposal Development.",
    "research-gate":
      "Reads the student's stored PDF evidence for the selected gate. Staff can evaluate existing files and adviser revisions, but cannot manually mark an absent document as received.",
    "panel-matching":
      "Reads the body text of all three uploaded concept papers, extracts significant keywords, then ranks faculty expertise with availability, college fit, and current panel load. Research titles and filenames are excluded.",
    "defense-scheduling":
      "Opens only after panel matching. The date spread compares adviser and panel availability, respects weekday work hours, and shows weekends only when faculty recorded an explicit override.",
    practicum:
      "Available only for programs marked with practicum requirements. Staff record MOA receipt, review certificates and hours, request additional certificates when hours are short, and route completed reports to the Dean.",
    withdrawal:
      "Withdrawal applies to one subject before classes or during the first week. GS Staff forwards the student request to the Dean; approval returns to GS Staff for an Excel Registrar handoff, and the subject is removed without a grade or academic penalty.",
    graduation:
      "This is the Graduate School monitoring and endorsement layer. It checks coursework, research completion evidence, practicum when required, and pending tasks before staff send the endorsement list for Dean review and export.",
  };
  return map[slug] || "";
}
