import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  RotateCcw,
  AlertTriangle,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Eye,
  MessageSquare,
  X,
  CheckSquare,
} from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, Spinner, EmptyState, StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../../components/WorkflowTimeline";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import { GraduationRoster } from "../WorkflowPage";
import { leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import { LeaveCaseSummary, isLeaveCaseItem } from "./DeanLeaveParts";
import {
  CLARIFICATION_TEMPLATES,
  graduationBatchLabel,
  isReadyForDeanReview,
  deanGraduationStageChecks,
  deanGraduationCurrentStage,
  deanGraduationBatchActionLabel,
  DEAN_BOARD_COLUMNS,
  deanBoardGroup,
} from "./deanHelpers";

export function DeanGraduationRequirementBoxes({ item }) {
  const eligibility = item.eligibility || {};
  const items = ["Coursework completed", "Thesis / research completed", eligibility.practicum_status === "Not Required" ? "Practicum not required" : "Practicum completed", "Eligible for graduation"];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((label) => <div key={label} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-3.5 w-3.5" /></span><p className="text-xs font-semibold">{label}</p></div>)}
      </div>
  );
}

export function DeanGraduationBatchStudentList({ rows }) {
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

export function DeanGraduationWorkspace() {
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

export function DeanDialog({ id, title, subtitle, onClose, children, footer = null, size = "default" }) {
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

export function DeanGraduationStageModal({ batch, onClose }) {
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

export function DeanDecisionModal({ pending, busy, onClose, onConfirm }) {
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

export function DeanGraduationBatchModal({ rows, onClose, onSaved }) {
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

export function DeanListFilters({ filters, setFilters, programs, statuses, showAdvanced = true }) {
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

export function WorkflowApprovalCard({ item, note, setNote, template, setTemplate, recipient, setRecipient, visibility, setVisibility, busy, onDecide, onMessage }) {
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
  const leaveCase = isLeaveCaseItem(item) ? item.case : null;
  const requestWord = leaveCase ? "Case" : "Request";
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{item.title}</h2>
          <p className="text-sm text-slate-500">{item.subtitle} · submitted {formatDate(item.submitted_at)}</p>
          {batchName && <p className="mt-1 text-xs font-semibold text-brand-700">{batchName}</p>}
        </div>
        {leaveCase ? leaveCaseStatusBadge(leaveCase) : <StatusBadge value={item.status} dot={false} />}
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
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stage history · {requestWord} #{leaveCase?.id || item.request_id || item.id}</p>
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
      {leaveCase && canDecide && <label className="mt-3 block"><span className="mb-1 block text-xs font-semibold text-slate-600">Your comment <span className="font-normal text-slate-400">(required to deny or return for revision)</span></span><textarea value={note[key] || ""} onChange={(event) => setNote((current) => ({ ...current, [key]: event.target.value }))} className="field-input min-h-24" placeholder="Write your reason. It is saved with your name, role, date and time." /></label>}
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
            {leaveCase ? "Read only. This request is not waiting for a Dean decision." : "No Dean decision is due at this stage."}
          </span>
        )}
      </div>
    </Card>
  );
}

export function DeanWorkflowBoard({ rows, onOpen, selectedIds, onToggle }) {
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
