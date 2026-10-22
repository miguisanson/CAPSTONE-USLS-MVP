import { useEffect, useRef, useState } from "react";
import {
  FileCheck,
  CheckCircle2,
  X,
  RotateCcw,
  Eye,
  Search,
  SlidersHorizontal,
  Send,
} from "lucide-react";
import { api } from "../../api";
import { StatusBadge, EmptyState, ErrorNote } from "../../components/ui";
import { Field, Textarea, Select } from "../../components/forms";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import { useAuth } from "../../auth";

export const WORKFLOW_ROLE_LABELS = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  dean: "Dean",
  admin: "Administrator",
};

export function SubmitButton({ submitting, children }) {
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
// Practicum
// ---------------------------------------------------------------------------
export function useDemoCaseReset(slug, refetch) {
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

// The reset endpoint only exists in demo mode (it answers 404 otherwise), so the button is
// shown only when /api/auth/config says demo mode is on. The answer is asked for once.
let demoModeRequest = null;
function useDemoModeEnabled() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let active = true;
    demoModeRequest = demoModeRequest || api.authConfig().then((result) => Boolean(result?.demo_mode)).catch(() => false);
    demoModeRequest.then((value) => { if (active) setEnabled(value); });
    return () => { active = false; };
  }, []);
  return enabled;
}

export function DemoResetButton({ student, resettingId, onReset }) {
  const demoMode = useDemoModeEnabled();
  if (!demoMode) return null;
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

export function DemoResetFeedback({ message, error }) {
  return (
    <>
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}
      {error && <ErrorNote message={error} />}
    </>
  );
}

export function WorkflowSubmitFeedback({ result, error }) {
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

export function WorkflowCaseModal({ id, title, subtitle, status, onClose, children, footer, size = "default" }) {
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
    final: "Endorsed means the Dean-approved list was exported. The Dean emails the CSV and waits for Registrar acknowledgement outside the portal.",
  },
};

export function WorkflowSupportModal({ slug, mode, logs, policyQuestions, onClose }) {
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

export function WorkflowActivityList({ logs, collapsible = true }) {
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

export function WorkflowMessageModal({ slug, row, context, replyTo = null, onClose, onSaved }) {
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

export function CaseMessageHistory({ messages = [], onReply = null }) {
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

export function WorkflowFileHistory({ files = [] }) {
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

export function RosterFilters({ filters, setFilters, programs, statuses, secondaryLabel, secondaryOptions = [], count, total, showAdvanced = true }) {
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

export function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function Detail({ label, value }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value || "—"}</p></div>;
}

export function shortDate(value) {
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

export function formatTime(value) {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
}

export function timeRange(start, end) {
  return `${formatTime(start)}-${formatTime(end)}`;
}

// ---------------------------------------------------------------------------
// AWOL & Residency
// ---------------------------------------------------------------------------
export function MiniBox({ label, value, tone }) {
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
