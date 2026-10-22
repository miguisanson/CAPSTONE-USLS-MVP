import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, Eye, FileCheck, Info, RotateCcw, Send, SlidersHorizontal, XCircle } from "lucide-react";
import { api } from "../../api";
import { Button, Card, EmptyState, Field, HistoryList, HistoryPanel, InlineNotice, Input, Modal, SearchInput, Select, StatCard, StatusChip, Textarea } from "../../components/ui/index.js";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { formatDateTime } from "../../lib/format";
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
    <Button type="submit" loading={submitting} className="w-full sm:w-auto">
      {submitting ? "Saving…" : children}
    </Button>
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
    <Button
      variant="secondary"
      icon={RotateCcw}
      loading={busy}
      onClick={() => onReset(student)}
      className="text-red-700 hover:bg-red-50 hover:text-red-800"
    >
      {busy ? "Resetting…" : "Reset demo case"}
    </Button>
  );
}

export function DemoResetFeedback({ message, error }) {
  return (
    <>
      {message && <InlineNotice tone="success">{message}</InlineNotice>}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    </>
  );
}

export function WorkflowSubmitFeedback({ result, error }) {
  return (
    <div aria-live="polite" className="space-y-3">
      {result?.message && <InlineNotice tone="success" icon={CheckCircle2}>{result.message}</InlineNotice>}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    </div>
  );
}

// The case dialog every workflow page opens: a Modal (lg), or xl for the wide batch and comparison views. "Close details"
// stays at the left of the footer; the caller's buttons follow on the right.
export function WorkflowCaseModal({ title, subtitle, status, onClose, children, footer, size = "default" }) {
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      badge={status ? <StatusChip status={status} dot={false} /> : null}
      size={size === "wide" ? "xl" : "lg"}
      onClose={onClose}
      closeLabel="Close case details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} className="sm:mr-auto">Close details</Button>
          {footer}
        </>
      }
    >
      {children}
    </Modal>
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

export function WorkflowSupportModal({ slug, mode, logs, policyQuestions = [], summary = "", actor = "", data = "", onClose }) {
  const guide = WORKFLOW_GUIDES[slug];
  const title = mode === "activity" ? "Recent workflow activity" : `How ${guide ? slug : "this workflow"} works`;
  return (
    <WorkflowCaseModal
      title={title}
      subtitle={mode === "activity" ? "A timestamped audit trail of recent actions and handoffs" : "A concise guide for students and reviewers"}
      onClose={onClose}
    >
      {mode === "activity" ? (
        <WorkflowActivityList logs={logs} collapsible={false} />
      ) : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {guide ? (
              <>
                <Detail label="Purpose" value={guide.purpose} />
                <Detail label="Who submits" value={guide.submitter} />
                <Detail label="Who reviews" value={guide.reviewers} />
                <Detail label="When something is incomplete" value={guide.incomplete} />
              </>
            ) : (
              <div className="sm:col-span-2"><Detail label="Purpose" value={summary} /></div>
            )}
            <Detail label="Used by" value={actor} />
            <Detail label="What it records" value={data} />
          </div>
          {guide && (
            <>
              <div>
                <p className="eyebrow">Main stages</p>
                <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                  {guide.stages.map((stage, index) => (
                    <li key={stage} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm font-semibold text-slate-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs text-brand-700">{index + 1}</span>
                      {stage}
                    </li>
                  ))}
                </ol>
              </div>
              <InlineNotice tone="success" title="What completion means">{guide.final}</InlineNotice>
            </>
          )}
          {policyQuestions.length > 0 && (
            <InlineNotice tone="warning" title="Admin note · confirm with Sir De Paula / GS office before production">
              <ul className="mt-1 space-y-1.5">{policyQuestions.map((question) => <li key={question}>• {question}</li>)}</ul>
            </InlineNotice>
          )}
        </div>
      )}
    </WorkflowCaseModal>
  );
}

// The workflow audit trail: HistoryPanel entries (newest first), behind a "View logs" toggle unless `collapsible` is off.
export function WorkflowActivityList({ logs, collapsible = true }) {
  if (!logs.length) return <EmptyState title="No activity yet" hint="New submissions, messages, and decisions will appear here." />;
  const entries = logs.map((log) => ({
    id: log.id,
    title: log.result,
    at: log.created_at,
    actor: [log.actor_role, log.student_name, log.request_id ? `Request #${log.request_id}` : "", log.action_type].filter(Boolean).join(" · "),
    from: log.previous_status,
    to: log.new_status,
    note: log.notes,
  }));
  if (!collapsible) return <HistoryList entries={entries} />;
  return <HistoryPanel entries={entries} label="View logs" hideLabel="Hide logs" count={logs.length} />;
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
      title={replyTo ? "Reply in case discussion" : "Message / return for clarification"}
      subtitle={`${student.name} · ${student.student_number}`}
      onClose={onClose}
      size={["practicum", "graduation"].includes(slug) ? "wide" : "default"}
      footer={<Button type="submit" form={`${slug}-message-form-${student.id}`} variant={returningToStudent ? "danger" : "primary"} icon={Send} loading={busy}>{busy ? "Saving…" : returningToStudent ? "Return to student" : "Send message"}</Button>}
    >
      <form id={`${slug}-message-form-${student.id}`} onSubmit={save} className="space-y-4">
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        {replyTo && (
          <InlineNotice tone="success" title={`Replying to ${replyTo.sender_name || replyTo.sender_role}${replyTo.sender_name && replyTo.sender_role ? ` (${replyTo.sender_role})` : ""} → ${replyTo.recipient_role}`}>
            {replyTo.comment}
          </InlineNotice>
        )}
        {!replyTo && <>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Action">
            <Select
              value={form.action_type}
              onChange={(event) => setForm((current) => ({ ...current, action_type: event.target.value, require_document_resubmission: false }))}
              placeholder=""
              options={[{ value: "return", label: "Return for clarification" }, { value: "note", label: "Send note to current reviewer" }]}
            />
          </Field>
          <Field label="Recipient / next stage">
            <Select value={form.recipient_role} onChange={(event) => setForm((current) => ({ ...current, recipient_role: event.target.value, visibility: event.target.value === "Student" ? "student_visible" : "internal", require_document_resubmission: event.target.value === "Student" ? current.require_document_resubmission : false }))} placeholder="" options={context?.message_recipients || ["Student", "Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean"]} />
          </Field>
        </div>
        <Field label="Visibility">
          <Select
            value={form.visibility}
            onChange={update("visibility")}
            disabled={form.recipient_role === "Student"}
            className="disabled:cursor-not-allowed disabled:bg-slate-100"
            placeholder=""
            options={[{ value: "student_visible", label: "Visible to student" }, { value: "internal", label: "Internal reviewers only" }]}
          />
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
              <span className="meta mt-1 block leading-relaxed text-slate-600">When checked, Graduation Step 1 is reset. The existing PDF stays in file history, but the student must upload a new PDF before resubmitting.</span>
            </span>
          </label>
        )}
        <Field label={replyTo ? "Reply" : remarksOnly ? "Remarks" : form.action_type === "return" || form.template === "Other / Custom comment" ? "Comment / reason" : "Optional details"} required={commentRequired}>
          <Textarea value={form.comment} onChange={update("comment")} required={commentRequired} placeholder={remarksOnly ? "Type your remarks or message." : "Add the exact file, record, or detail that needs attention."} />
        </Field>
        <p className="meta leading-relaxed">{replyTo ? "Your reply is added chronologically to this case discussion and routed to the original sender." : "Returning the case moves it back to the selected recipient's stage and requires a reason. Use the case action button for normal forward approval; a note keeps the current stage unchanged."}</p>
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
    <Card pad="sm">
      <p className="eyebrow flex items-center gap-2"><FileCheck className="h-4 w-4" /> Submitted file history</p>
      <ul className="mt-3 space-y-2">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
              <p className="meta">Uploaded by {file.uploaded_by || "Uploader not recorded"} ({file.uploaded_by_role || "role not recorded"}) · {formatDateTime(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p>
            </div>
            {file.file_exists !== false ? (
              <Button as="a" href={file.url} target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={Eye}>View file</Button>
            ) : (
              <StatusChip tone="danger" status="File unavailable" dot={false} size="sm" />
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function RosterFilters({ filters, setFilters, programs, statuses, secondaryLabel, secondaryOptions = [], count, total, showAdvanced = true }) {
  const active = Object.entries(filters).filter(([key, value]) => Boolean(value) && !(key === "sort" && value === "newest")).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  const clearFilters = () => setFilters(Object.fromEntries(
    Object.keys(filters).map((key) => [key, key === "sort" ? "newest" : ""])
  ));
  return (
    <Card pad="sm" className="bg-slate-50/70">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SearchInput
          value={filters.query}
          onChange={(text) => setFilters((current) => ({ ...current, query: text }))}
          placeholder="Search students"
          label="Search list"
        />
        <Select value={filters.program} onChange={update("program")} aria-label="Filter by program" placeholder="All programs" options={programs} />
        <Select value={filters.status} onChange={update("status")} aria-label="Filter by workflow stage or status" placeholder="All stages / statuses" options={statuses} />
        {secondaryLabel && (
          <Select value={filters.secondary || ""} onChange={update("secondary")} aria-label={`Filter by ${secondaryLabel}`} placeholder={`All ${secondaryLabel.toLowerCase()}`} options={secondaryOptions} />
        )}
        {showAdvanced && <Field label="Updated from"><Input type="date" value={filters.dateFrom || ""} onChange={update("dateFrom")} /></Field>}
        {showAdvanced && <Field label="Updated through"><Input type="date" value={filters.dateTo || ""} onChange={update("dateTo")} /></Field>}
        {showAdvanced && (
          <Field label="Sort">
            <Select
              value={filters.sort || "newest"}
              onChange={update("sort")}
              placeholder=""
              options={[{ value: "newest", label: "Newest updated" }, { value: "oldest", label: "Oldest updated" }, { value: "student", label: "Student name" }]}
            />
          </Field>
        )}
      </div>
      <div className="meta mt-2 flex flex-wrap items-center justify-between gap-2">
        <span>Showing {count} of {total} records</span>
        {active > 0 && (
          <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={clearFilters}>
            Clear {active} filter{active === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </Card>
  );
}

export function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

export function Detail({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 font-semibold text-slate-700">{value || "—"}</p>
    </div>
  );
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

// A small figure tile. New code uses StatCard size="sm" directly; the Practicum and Graduation rosters still call this
// (their packet replaces it). The tone name is the old one (brand / blue / amber / red); the icon makes the tone visible.
const MINI_TONES = {
  brand: { tone: "success", icon: CheckCircle2 },
  blue: { tone: "info", icon: Info },
  amber: { tone: "warning", icon: Clock },
  red: { tone: "danger", icon: XCircle },
};
export function MiniBox({ label, value, tone }) {
  const mapped = MINI_TONES[tone] || { tone: "neutral", icon: AlertTriangle };
  return <StatCard size="sm" label={label} value={value} tone={mapped.tone} icon={mapped.icon} />;
}
