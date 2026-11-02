import { useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  SlidersHorizontal,
  ArrowUpRight,
  Eye,
  MessageSquare,
} from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, DecisionPanel, EmptyState, HistoryPanel, SearchInput, SkeletonBoard, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../../components/WorkflowTimeline";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { GraduationRoster } from "../WorkflowPage";
import { leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import { LeaveCaseSummary, isLeaveCaseItem } from "./DeanLeaveParts";
import { CLARIFICATION_TEMPLATES, graduationBatchLabel } from "./deanHelpers";

export function DeanGraduationWorkspace({ batchesOnly = false }) {
  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext("graduation"),
    [],
  );
  const [result, setResult] = useState(null);
  const [submitError, setSubmitError] = useState("");

  if (loading && !context) return <SkeletonBoard columns={4} label="Loading board" />;
  if (error && !context) return <Card pad="lg"><EmptyState icon={AlertTriangle} title="Could not load graduation workflow" hint={error} /></Card>;

  return (
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
      batchesOnly={batchesOnly}
    />
  );
}

// The wording of the Dean's approving button for each kind of case. The confirmation window uses the same
// words, so the window is named after the button the Dean clicked (I-008).
export function deanApproveLabel(item) {
  const standingChange = ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  if (item.type === "practicum") return "Mark reviewed";
  return standingChange || item.type === "withdrawal" ? "Approve" : "Approve and prepare for export";
}

export function DeanListFilters({ filters, setFilters, programs, statuses, showAdvanced = true }) {
  const active = Object.entries(filters).filter(([key, value]) => {
    if (!showAdvanced && ["dateFrom", "dateTo", "sort"].includes(key)) return false;
    return Boolean(value) && !(key === "sort" && value === "newest");
  }).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <Card pad="sm" className="mb-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.query}
          onChange={(query) => setFilters((current) => ({ ...current, query }))}
          placeholder="Search student, ID, or item…"
          label="Search Dean review lists"
        />
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter Dean list by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter Dean list by stage or status"><option value="">All stages / statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        {showAdvanced && <label><span className="eyebrow mb-1 block">Updated from</span><input type="date" value={filters.dateFrom} onChange={update("dateFrom")} className="field-input" /></label>}
        {showAdvanced && <label><span className="eyebrow mb-1 block">Updated through</span><input type="date" value={filters.dateTo} onChange={update("dateTo")} className="field-input" /></label>}
        {showAdvanced && <label><span className="eyebrow mb-1 block">Sort</span><select value={filters.sort} onChange={update("sort")} className="field-input cursor-pointer"><option value="newest">Newest updated</option><option value="oldest">Oldest updated</option><option value="student">Student name</option></select></label>}
      </div>
      {active > 0 && <div className="mt-2 flex justify-end"><button type="button" onClick={() => setFilters({ query: "", program: "", status: "", dateFrom: "", dateTo: "", sort: "newest" })} className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button></div>}
    </Card>
  );
}

// One case card: summary, timeline, files, discussion, history, then the Dean's decision (DecisionPanel).
// `onDecide(item, decision, comment)` is called after the Dean has confirmed; `decision` is the API word
// (approve / review / deny / return). The panel blocks return and deny without a comment, and asks first.
export function WorkflowApprovalCard({ item, note, setNote, template, setTemplate, recipient, setRecipient, visibility, setVisibility, busy, onDecide, onMessage }) {
  const key = `${item.type}-${item.id}`;
  const isBusy = busy === key;
  const standingChange = ["leave-of-absence", "readmission", "awol-return"].includes(item.type);
  const decisionOnly = ["practicum", "withdrawal", "graduation"].includes(item.type);
  const approveLabel = deanApproveLabel(item);
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
  const leaveCase = isLeaveCaseItem(item) ? item.case : null;
  const requestWord = leaveCase ? "Case" : "Request";
  const comment = note[key] || "";

  // The confirmation window is named after the button ("Confirm: Mark reviewed") and says where the case moves.
  const confirmFor = (title, target) => ({
    title: `Confirm: ${title}`,
    confirmLabel: title,
    message: [
      `${item.student?.name} · ${item.student?.student_number} · ${item.type}`,
      `Workflow movement: ${item.workflow_status || item.status} → ${target}`,
      comment.trim() ? `Recorded comment: ${comment.trim()}` : "No optional comment was entered. A student-visible status notice will still be recorded.",
    ].join("\n\n"),
  });
  const actions = canDecide
    ? [
        { key: item.type === "practicum" ? "review" : "approve", label: approveLabel, tone: "approve", icon: CheckCircle2, confirm: confirmFor(approveLabel, "Approved / reviewed") },
        ...(item.type === "withdrawal" || standingChange
          ? [{ key: "deny", label: "Deny", tone: "reject", icon: AlertTriangle, confirm: confirmFor("Deny request", "Denied") }]
          : []),
        ...(item.type !== "withdrawal"
          ? [{ key: "return", label: returnLabel, tone: "return", icon: RotateCcw, confirm: confirmFor(returnLabel, "Returned for revision") }]
          : []),
      ]
    : [];
  const history = (item.history || []).map((entry) => ({
    id: entry.id,
    title: entry.result,
    at: entry.created_at,
    actor: entry.actor_user_id ? `User #${entry.actor_user_id}` : "",
    actorRole: [entry.actor_role, entry.action_type].filter(Boolean).join(" · "),
    from: entry.previous_status,
    to: entry.new_status,
    note: entry.notes,
  }));

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="section-title">{item.title}</h2>
          <p className="text-sm text-slate-500">{item.subtitle} · submitted {formatDate(item.submitted_at)}</p>
          {batchName && <p className="meta mt-1 font-semibold text-brand-700">{batchName}</p>}
        </div>
        {leaveCase ? leaveCaseStatusBadge(leaveCase) : <StatusChip status={item.status} dot={false} />}
      </div>
      {leaveCase ? <LeaveCaseSummary item={item} /> : (
        <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-sm leading-relaxed text-slate-600">
          {item.details}
        </p>
      )}
      {timeline && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <WorkflowTimeline steps={timeline} title={timelineTitle} />
      </div>}
      {files.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="eyebrow">Submitted files</p>
          <ul className="mt-2 space-y-2">
            {files.map((file) => (
              <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-semibold text-ink">{file.name}</p>
                  <p className="meta">Uploaded by {file.uploaded_by || "Uploader not recorded"} ({file.uploaded_by_role || "role not recorded"}) · {formatDate(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p>
                </div>
                {file.file_exists !== false
                  ? <Button as="a" href={file.url} target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={Eye}>View <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></Button>
                  : <StatusChip label="File unavailable" tone="bad" dot={false} />}
              </li>
            ))}
          </ul>
        </div>
      )}
      {item.messages?.length > 0 && (
        <div className="mt-4">
          <WorkflowDiscussion messages={item.messages} title="Case discussion / saved messages" />
        </div>
      )}
      {history.length > 0 && (
        <HistoryPanel
          className="mt-4"
          label="View logs"
          hideLabel="Hide logs"
          title={`Stage history · ${requestWord} #${leaveCase?.id || item.request_id || item.id}`}
          entries={history}
        />
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
      <DecisionPanel
        variant="plain"
        className="mt-3"
        actions={actions}
        busy={isBusy}
        onDecide={(decision, text) => onDecide(item, decision, text)}
        withComment={decisionOnly || (standingChange && canDecide)}
        comment={comment}
        onCommentChange={(value) => setNote((current) => ({ ...current, [key]: value }))}
        commentLabel={decisionOnly ? "Review comment" : "Your comment"}
        commentPlaceholder={decisionOnly ? "Add a review comment. It will be saved with your name, role, date, and time." : "Write your reason. It is saved with your name, role, date and time."}
        commentRows={4}
        commentRequiredMessage="Choose a reason or enter a comment before returning or denying the request."
        extra={
          <>
            {!standingChange && !decisionOnly && (
              <Button variant="secondary" icon={MessageSquare} disabled={busy === `message-${key}`} onClick={() => onMessage(item)}>
                Add comment
              </Button>
            )}
            {!canDecide && (
              <span className="meta self-center font-semibold">
                {leaveCase ? "Read only. This request is not waiting for a Dean decision." : "No Dean decision is due at this stage."}
              </span>
            )}
          </>
        }
      />
    </Card>
  );
}
