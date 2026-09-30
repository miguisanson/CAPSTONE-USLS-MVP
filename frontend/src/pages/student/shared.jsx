import { Component, useEffect, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  FileUp,
  Eye,
  MessageSquare,
  Send,
} from "lucide-react";
import { api } from "../../api";
import { Card, EmptyState, ErrorNote, SectionTitle, StatusBadge } from "../../components/ui";
import { Field } from "../../components/forms";
import { formatDate } from "../../lib/format";
import { parseDay } from "../../components/calendar/CalendarView";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";

export const RESEARCH_GATE_KEYS = new Set(["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"]);

export const STUDENT_REQUEST_VIEW_BY_SLUG = {
  "leave-of-absence": "loa",
  readmission: "readmission",
  awol: "awol",
  practicum: "practicum",
  withdrawal: "withdrawal",
  graduation: "graduation",
};

export const STUDENT_MESSAGE_SLUG_BY_VIEW = Object.fromEntries(
  Object.entries(STUDENT_REQUEST_VIEW_BY_SLUG).map(([slug, view]) => [view, slug]),
);

export class StudentPortalSectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.view !== this.props.view && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <EmptyState
            icon={AlertTriangle}
            title="This page could not load"
            hint="Please try another section or refresh the portal. The rest of your student portal is still available."
          />
        </Card>
      );
    }
    return this.props.children;
  }
}

export function StudentClarificationPanel({ slug, data, onSaved }) {
  const messages = (data.workflow_messages || [])
    .filter((item) => item.transaction_slug === slug)
    .sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
  const replyableRoles = new Set(["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean"]);
  const openReturns = messages.filter((item) => item.recipient_role === "Student" && item.status === "Open" && item.action_type === "return");
  const latestReturn = openReturns.at(-1) || null;
  const latestStaffMessage = messages.filter((item) => item.recipient_role === "Student" && replyableRoles.has(item.sender_role)).at(-1) || null;
  const replyTarget = latestReturn || latestStaffMessage;
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!messages.length) return null;

  async function respond() {
    if (!replyTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(slug, {
        action_type: "response",
        recipient_role: replyTarget.sender_role,
        template: "Remarks",
        comment,
        reply_to_message_id: replyTarget.id,
      });
      setNotice(result.message);
      setComment("");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your clarification response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Request discussion">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><MessageSquare className="h-4 w-4 text-brand-700" /> Request discussion</p>
          <p className="mt-1 text-xs text-slate-500">Messages and replies are shown chronologically. The newest post is highlighted in green.</p>
        </div>
        {latestReturn?.requires_document_resubmission && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">New PDF required</span>}
      </div>
      {latestReturn?.requires_document_resubmission && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Step 1 has been reopened. Upload a replacement graduation application PDF before resubmitting.</p>}
      <WorkflowDiscussion
        messages={messages}
        title="Request discussion"
        embedded
        showHeader={false}
        highlightLatest
      />
      {replyTarget && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="block text-xs font-semibold text-slate-700" htmlFor={`${slug}-clarification-response`}>Reply to {replyTarget.sender_name || replyTarget.sender_role}</label>
          <textarea id={`${slug}-clarification-response`} value={comment} onChange={(event) => setComment(event.target.value)} className="field-input mt-1 min-h-24 bg-white" placeholder="Explain what you updated or ask a follow-up question." />
          <ErrorNote message={error} />
          {notice && <p aria-live="polite" className="mt-2 text-sm font-semibold text-emerald-700">{notice}</p>}
          <button type="button" disabled={busy || !comment.trim()} onClick={respond} className="btn-primary mt-3 cursor-pointer"><Send className="h-4 w-4" /> {busy ? "Sending…" : "Send reply"}</button>
        </div>
      )}
    </section>
  );
}

export function useSubmitRequest(type, onSaved) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(payload) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.submitStudentRequest(type, payload);
      setMessage(res.message || "Submitted.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, message, submit };
}

export function StageCard({ number, title, state = "locked", helper = "", children }) {
  const styles = {
    active: "border-brand-300 bg-white",
    complete: "border-brand-200 bg-brand-50/40",
    pending: "border-amber-200 bg-amber-50/40",
    returned: "border-red-200 bg-red-50/40",
    rejected: "border-red-300 bg-red-50/70",
    locked: "border-slate-200 bg-slate-50/60",
  };
  const labels = { active: "Current stage", complete: "Completed", pending: "Pending review", returned: "Needs revision", rejected: "Rejected", locked: "Locked" };
  return (
    <section className={`rounded-2xl border p-4 ${styles[state] || styles.locked}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${state === "active" ? "bg-brand-600 text-white" : ["returned", "rejected"].includes(state) ? "bg-red-100 text-red-700" : state === "complete" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-500"}`}>{number}</span>
          <div><h3 className="text-sm font-semibold text-ink">{title}</h3>{helper && <p className="mt-1 text-xs leading-relaxed text-slate-500">{helper}</p>}</div>
        </div>
        <StatusBadge value={labels[state] || state} dot={false} />
      </div>
      {children && <div className="mt-4 border-t border-slate-200/80 pt-4">{children}</div>}
    </section>
  );
}

export function SavedWorkflowFiles({ files = [], empty = "No files submitted yet." }) {
  if (!files.length) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Already submitted</p>
      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{file.name}</p><p className="text-xs text-slate-400">Uploaded by {file.uploaded_by || "Uploader not recorded"} · {formatDate(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p></div>
            {file.file_exists !== false ? <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5"><Eye className="h-3.5 w-3.5" /> View file</a> : <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">File unavailable</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RequestPdfUpload({ requestType, label, onUploaded, initialAttachment = null }) {
  const [attachment, setAttachment] = useState(initialAttachment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setAttachment(initialAttachment), [initialAttachment?.id]);

  async function upload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.uploadStudentRequestAttachment(requestType, file);
      setAttachment(result.attachment);
      onUploaded(result.attachment);
    } catch (err) {
      setError(err.message || "Could not upload the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} hint="PDF only, up to 25 MB. The file is stored with your request.">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
        <span className="flex min-w-0 items-center gap-2">
          <FileUp className="h-4 w-4 shrink-0 text-brand-700" />
          <span className="truncate">{attachment?.name || (busy ? "Uploading..." : "Choose PDF file")}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          Browse
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </label>
      {attachment && attachment.file_exists !== false && <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Eye className="h-3.5 w-3.5" /> View uploaded application</a>}
      {attachment?.file_exists === false && <p className="mt-2 text-xs font-semibold text-red-600">The saved file is unavailable. Upload the PDF again before submitting.</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </Field>
  );
}

export function SubmitState({ busy, error, message, label, disabled = false, disabledHint = "" }) {
  return (
    <div className="space-y-3">
      <ErrorNote message={error} />
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      )}
      <button type="submit" disabled={busy || disabled} className="btn-primary w-full sm:w-auto">
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> {label}
          </>
        )}
      </button>
      {disabledHint && <p className="text-xs font-medium text-slate-500">{disabledHint}</p>}
    </div>
  );
}

// ---- dates and defense schedules (Philippine time, never converted) ----

// "Mon, Oct 5, 2026" from a YYYY-MM-DD (or naive datetime) string, read as a local date.
export function fmtDay(value, long = false) {
  if (!value) return "Not set";
  const day = parseDay(value);
  if (Number.isNaN(day.getTime())) return String(value);
  return day.toLocaleDateString(undefined, long
    ? { weekday: "long", month: "long", day: "numeric", year: "numeric" }
    : { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

// "in 3 days" / "tomorrow" / "today" / "2 days ago" from a whole number of days.
export function daysPhrase(days) {
  if (days === null || days === undefined) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${Math.abs(days)} days ago`;
}

export function timeRange(start, end) {
  if (!start) return "Time not set";
  return end ? `${start}-${end}` : start;
}

// Statuses in which a booking is alive: a new request must not be filed on top of it.
export const LIVE_SCHEDULE_STATUSES = ["Scheduled", "Confirmed", "Needs Re-confirmation"];
export function isLiveSchedule(schedule) {
  return Boolean(schedule?.is_active) || LIVE_SCHEDULE_STATUSES.includes(schedule?.status);
}

const SCHEDULE_STATUS_NOTE = {
  Held: "This defense took place.",
  Deferred: "Waiting for the Research Coordinator to set a new date.",
  "Needs Re-confirmation": "Your panel changed. The Research Coordinator will confirm the date again.",
  Rescheduled: "Replaced by a newer schedule.",
  Cancelled: "This booking was cancelled.",
};

// One card per defense schedule with the real facts (used on the dashboard and the Defense Schedule page).
export function StudentSchedulePanel({ schedules = [], title = "Schedule requests" }) {
  return (
    <Card className="p-6">
      <SectionTitle title={title} icon={CalendarClock} />
      {schedules.length ? (
        <ul className="space-y-3">
          {schedules.map((schedule) => {
            const status = schedule.display_status || schedule.status;
            const reason = schedule.display_conflict_reason || schedule.change_reason || schedule.conflict_reason;
            const note = SCHEDULE_STATUS_NOTE[schedule.status];
            const panel = schedule.panelists || [];
            return (
              <li key={schedule.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{schedule.defense_type || "Defense"}</p>
                    <p className="text-sm text-slate-700">{fmtDay(schedule.preferred_date)}</p>
                  </div>
                  <StatusBadge value={status} dot={false} />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {timeRange(schedule.start_time, schedule.end_time)} (Philippine time) - {schedule.mode || "Mode not set"} - {schedule.venue || "Venue or link not set yet"}
                </p>
                {panel.length > 0 && (
                  <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                    {panel.map((seat) => (
                      <li key={`${seat.faculty_id}-${seat.role}`}><span className="font-semibold text-ink">{seat.name}</span> - {seat.role}</li>
                    ))}
                  </ul>
                )}
                {note && <p className="mt-2 text-xs font-semibold text-slate-600">{note}</p>}
                {reason && <p className="mt-1 text-xs text-amber-800">{reason}</p>}
                {(schedule.attention || []).map((line) => <p key={line} className="mt-1 text-xs font-semibold text-amber-800">{line}</p>)}
                {schedule.ics_url && isLiveSchedule(schedule) && (
                  <a href={schedule.ics_url} download className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
                    <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add to calendar (.ics)
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No schedule requests" />
      )}
    </Card>
  );
}
