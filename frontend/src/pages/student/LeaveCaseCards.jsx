import { useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarOff,
  CheckCircle2,
  Info,
  Lock,
  Square,
  CheckSquare,
  UserCheck,
  XCircle,
  FileText,
} from "lucide-react";
import { api } from "../../api";
import { Card, ErrorNote, SectionTitle, StatusBadge } from "../../components/ui";
import { useConfirm } from "../../components/confirm";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { LeaveStatusBadge, LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus";
import { formatDate, formatDateTime } from "../../lib/format";
import { STUDENT_REQUEST_PATHS } from "./requestMeta";

// Everything the student sees about Leave of Absence, leave extension and readmission cases.
// The words, the tone and the next owner of each case come from the server
// (`data.leave_overview`); this file only lays them out.

export const LOA_KINDS = ["LOA", "LOA_EXTENSION"];
export const READMISSION_KINDS = ["READMISSION"];
// A request that somebody is still working on.
export const OPEN_LEAVE_STATUSES = ["Submitted", "Staff Review", "Dean Review", "Returned"];
// An approved leave that is about to start, running, or ending.
export const ACTIVE_LEAVE_STATUSES = ["Leave Scheduled", "On Leave", "Return Due"];

export function isOnLeaveOrAwol(student) {
  if (!student) return { onLeave: false, awol: false };
  const onLeave = student.standing === "On Leave" || student.enrollment_tag === "LOA" || student.current_stage === "LOA";
  const awol = student.standing === "AWOL" || student.enrollment_tag === "AWOL";
  return { onLeave, awol };
}

export function pluralize(count, word) {
  return `${count} ${word}${Number(count) === 1 ? "" : "s"}`;
}

/**
 * Splits the student's cases of the given kinds into the ones to show in full
 * (open requests, running leave, or a just-denied request) and the earlier ones.
 */
export function splitLeaveCases(overview, kinds) {
  const cases = (overview?.cases || []).filter((item) => kinds.includes(item.kind));
  const shown = cases.filter((item) => OPEN_LEAVE_STATUSES.includes(item.status) || ACTIVE_LEAVE_STATUSES.includes(item.status));
  let earlier = cases.filter((item) => !shown.includes(item));
  if (!shown.length && earlier[0]?.status === "Denied") {
    shown.push(earlier[0]);
    earlier = earlier.slice(1);
  }
  return { shown, earlier, all: cases };
}

// Short status words for the Request Center and the Overview.
export function leaveRequestStatus(data, slug) {
  const overview = data.leave_overview;
  const kinds = slug === "readmission" ? READMISSION_KINDS : LOA_KINDS;
  if (!overview) return "";
  const latest = (overview.cases || []).find((item) => kinds.includes(item.kind));
  if (slug !== "readmission" && isOnLeaveOrAwol(data.student).onLeave) return "On leave";
  return latest?.status_label || "Not submitted";
}

const BANNER_STYLES = {
  bad: { box: "border-red-300 bg-red-50 text-red-900", icon: AlertTriangle, iconClass: "text-red-600" },
  warn: { box: "border-amber-300 bg-amber-50 text-amber-900", icon: AlertTriangle, iconClass: "text-amber-600" },
  info: { box: "border-blue-200 bg-blue-50 text-blue-900", icon: Info, iconClass: "text-blue-600" },
  good: { box: "border-brand-200 bg-brand-50 text-brand-900", icon: CheckCircle2, iconClass: "text-brand-600" },
  muted: { box: "border-slate-200 bg-slate-50 text-slate-800", icon: Info, iconClass: "text-slate-500" },
};

/** The notice at the top of the leave pages: AWOL, leave ending, on leave, leave scheduled. */
export function LeaveBanner({ banner, linkTo = "", linkLabel = "", className = "" }) {
  if (!banner) return null;
  const style = BANNER_STYLES[banner.tone] || BANNER_STYLES.info;
  const Icon = style.icon;
  return (
    <div role={banner.tone === "bad" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${style.box} ${className}`}>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClass}`} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{banner.title}</p>
        {banner.text && <p className="mt-0.5 text-sm">{banner.text}</p>}
        {linkTo && (
          <Link to={linkTo} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold underline">
            {linkLabel || "Open"} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}

function Fact({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

// The comment staff or the Dean wrote when they sent the request back.
export function returnCommentOf(item) {
  const returned = (item.messages || []).find((message) => message.action_type === "return" && message.sender_role !== "Student");
  return returned?.comment || item.dean_remarks || "";
}

function daysLine(item) {
  if (item.kind === "READMISSION") return null;
  if (item.overdue_days > 0) {
    return { tone: "bad", text: `The leave ended ${pluralize(item.overdue_days, "day")} ago.` };
  }
  if (item.days_until_end === null || item.days_until_end === undefined) return null;
  if (item.days_until_end < 0) return null;
  if (item.days_until_end === 0) return { tone: "warn", text: "The leave ends today." };
  return { tone: item.days_until_end <= 30 ? "warn" : "info", text: `${pluralize(item.days_until_end, "day")} left until the leave ends.` };
}

const DAYS_TONE = { bad: "text-red-700", warn: "text-amber-800", info: "text-slate-600" };

function HistoryList({ history }) {
  if (!history.length) return <p className="text-sm text-slate-500">Nothing has happened on this request yet.</p>;
  return (
    <ol className="space-y-2">
      {history.map((entry, index) => (
        <li key={entry.id ?? `${entry.created_at}-${index}`} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{entry.result || "Update"}</p>
            <p className="text-[11px] text-slate-400">{formatDateTime(entry.created_at)}</p>
          </div>
          {entry.previous_status && entry.new_status && entry.previous_status !== entry.new_status && (
            <p className="mt-0.5 text-xs text-slate-500">{entry.previous_status} → {entry.new_status}</p>
          )}
          {entry.notes && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{entry.notes}</p>}
        </li>
      ))}
    </ol>
  );
}

/**
 * One Leave of Absence, leave extension or readmission request.
 * `current` cards are the ones being worked on now; earlier cards also get their messages.
 */
export function LeaveCaseCard({ item, current = true, onChanged }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const isReadmission = item.kind === "READMISSION";
  const open = OPEN_LEAVE_STATUSES.includes(item.status);
  const canWithdraw = ["Submitted", "Staff Review", "Dean Review", "Returned"].includes(item.status);
  const canCancel = item.status === "Leave Scheduled" && item.kind === "LOA";
  const history = item.history || [];
  const messages = item.messages || [];
  const checklist = item.checklist || [];
  const days = daysLine(item);
  const returned = item.status === "Returned";
  const returnComment = returned ? returnCommentOf(item) : "";
  const deanComment = item.dean_remarks && item.dean_remarks !== returnComment ? item.dean_remarks : "";
  const staffMessage = messages.find(
    (message) => message.sender_role !== "Student" && message.action_type !== "notice" && message.action_type !== "return" && message.comment,
  );
  const periodText = item.period?.text;
  const semesters = item.period?.semesters;
  const summary = isReadmission
    ? (item.target_term ? `Return in ${item.target_term}` : "Return semester not recorded")
    : `${periodText || "Period not recorded"}${semesters ? ` (${pluralize(semesters, "semester")})` : ""}`;
  const Icon = isReadmission ? UserCheck : CalendarOff;

  async function run(action) {
    const isCancel = action === "cancel";
    const accepted = await confirm(
      isCancel
        ? {
            title: "Cancel this leave?",
            message: "Your leave has not started yet. If you cancel it, your record stays as it is now. You can file a new request later.",
            confirmLabel: "Cancel this leave",
            cancelLabel: "Keep my leave",
            tone: "danger",
          }
        : {
            title: `Withdraw this ${item.kind_label.toLowerCase()} request?`,
            message: "This stops the review. Your record does not change, and you can file a new request later.",
            confirmLabel: "Withdraw request",
            cancelLabel: "Keep my request",
            tone: "danger",
          },
    );
    if (!accepted) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.studentLeaveCaseAction(item.id, action);
      setNotice(result?.message || (isCancel ? "Your leave was cancelled." : "Your request was withdrawn."));
      if (onChanged) await onChanged();
    } catch (err) {
      setError(err.message || "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${current ? "border-brand-200 bg-white" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{item.kind_label}</h3>
            <p className="mt-0.5 text-sm text-slate-600">{summary}</p>
          </div>
        </div>
        {leaveCaseStatusBadge(item)}
      </div>

      {open && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          {returned ? "Waiting for: you. Correct your request and send it again." : `Waiting for: ${item.owner || "Graduate School Staff"}`}
        </p>
      )}
      {days && <p className={`mt-2 text-sm font-semibold ${DAYS_TONE[days.tone] || DAYS_TONE.info}`}>{days.text}</p>}
      {item.closed_reason && !open && <p className="mt-2 text-sm text-slate-600">{item.closed_reason}</p>}

      {returned && returnComment && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Why it was sent back</p>
          <p className="mt-1 whitespace-pre-line text-sm font-medium">{returnComment}</p>
        </div>
      )}
      {deanComment && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Comment from the Dean</p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{deanComment}</p>
        </div>
      )}
      {staffMessage && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Latest message from {staffMessage.sender_name || staffMessage.sender_role}
          </p>
          <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{staffMessage.comment}</p>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Filed">{item.submitted_at ? formatDate(item.submitted_at) : null}</Fact>
        <Fact label="Sent to the Dean">{item.forwarded_at ? formatDate(item.forwarded_at) : null}</Fact>
        <Fact label="Decision">{item.decided_at ? formatDate(item.decided_at) : null}</Fact>
        {isReadmission ? (
          <Fact label="Return semester">{item.target_term}</Fact>
        ) : (
          <>
            <Fact label="Leave starts">{item.period?.start_date ? `${item.period.start_label ? `${item.period.start_label}, ` : ""}${formatDate(item.period.start_date)}` : item.period?.start_label}</Fact>
            <Fact label="Leave ends">{item.period?.end_date ? `${item.period.end_label ? `${item.period.end_label}, ` : ""}${formatDate(item.period.end_date)}` : item.period?.end_label}</Fact>
          </>
        )}
        <Fact label="Leave began">{item.started_at ? formatDate(item.started_at) : null}</Fact>
        <Fact label="Closed">{item.closed_at ? formatDate(item.closed_at) : null}</Fact>
      </dl>

      {isReadmission && (item.linked_case || periodText) && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Leave you are ending: </span>
          {item.linked_case
            ? `${item.linked_case.kind_label}${item.linked_case.period_text ? `, ${item.linked_case.period_text}` : ""} (${item.linked_case.status_label})`
            : periodText}
        </p>
      )}
      {!isReadmission && item.kind === "LOA_EXTENSION" && item.linked_case && (
        <p className="mt-3 text-sm text-slate-600">
          <span className="font-semibold text-slate-700">Leave being extended: </span>
          {item.linked_case.period_text || item.linked_case.kind_label}
        </p>
      )}

      {!isReadmission && (item.reason_category || item.reason_text) && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Your reason</p>
          {item.reason_category && <p className="mt-0.5 text-sm font-semibold text-ink">{item.reason_category}</p>}
          {item.reason_text && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{item.reason_text}</p>}
        </div>
      )}
      {isReadmission && item.return_intent && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">What you told us</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{item.return_intent}</p>
        </div>
      )}

      {isReadmission && checklist.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Return checklist</p>
          <ul className="mt-1.5 space-y-1">
            {checklist.map((entry) => (
              <li key={entry.item} className="flex items-start gap-2 text-sm text-slate-700">
                {entry.checked ? (
                  <CheckSquare className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
                ) : (
                  <Square className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  {entry.item}
                  <span className="sr-only">{entry.checked ? " (you ticked this)" : " (not ticked)"}</span>
                </span>
                {entry.confirmed && <LeaveStatusBadge label="Staff confirmed" tone="good" />}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <LeaveTimeline steps={item.timeline || []} />
      </div>

      {(canWithdraw || canCancel) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {canWithdraw && (
            <button type="button" onClick={() => run("withdraw")} disabled={busy} className="btn-ghost cursor-pointer text-red-700 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> {busy ? "Working…" : "Withdraw request"}
            </button>
          )}
          {canCancel && (
            <button type="button" onClick={() => run("cancel")} disabled={busy} className="btn-ghost cursor-pointer text-red-700 hover:bg-red-50">
              <XCircle className="h-4 w-4" /> {busy ? "Working…" : "Cancel this leave"}
            </button>
          )}
        </div>
      )}
      {notice && <p aria-live="polite" className="mt-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-semibold text-brand-800">{notice}</p>}
      <div className="mt-3"><ErrorNote message={error} /></div>

      <div className="mt-4 space-y-2">
        {!current && messages.length > 0 && (
          <HistoryDisclosure label="View messages" hideLabel="Hide messages" count={messages.length}>
            <WorkflowDiscussion messages={messages} embedded showHeader={false} title={`${item.kind_label} messages`} />
          </HistoryDisclosure>
        )}
        <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={history.length}>
          <HistoryList history={history} />
        </HistoryDisclosure>
      </div>
    </article>
  );
}

/** Earlier requests that are over (denied, withdrawn, cancelled, closed), collapsed. */
export function EarlierCases({ cases, onChanged }) {
  if (!cases.length) return null;
  return (
    <HistoryDisclosure label="Earlier requests" hideLabel="Hide earlier requests" count={cases.length}>
      <div className="space-y-3">
        {cases.map((item) => (
          <LeaveCaseCard key={item.id} item={item} current={false} onChanged={onChanged} />
        ))}
      </div>
    </HistoryDisclosure>
  );
}

/** Why the student cannot file right now, in plain words. */
export function LeaveReasonNote({ children }) {
  if (!children) return null;
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <p>{children}</p>
    </div>
  );
}

function leaveRowDetail(item, overview, slug) {
  if (!item) {
    return slug === "readmission" ? "No readmission request yet." : "No leave request yet.";
  }
  if (OPEN_LEAVE_STATUSES.includes(item.status)) {
    return item.status === "Returned" ? "Waiting for: you. Open the request to correct it." : `Waiting for: ${item.owner || "Graduate School Staff"}`;
  }
  const days = daysLine(item);
  if (ACTIVE_LEAVE_STATUSES.includes(item.status)) {
    return `${item.period?.text || "Leave"}${days ? `. ${days.text}` : ""}`;
  }
  if (slug === "readmission") return item.target_term ? `Return semester: ${item.target_term}` : "";
  return item.period?.text || "";
}

/** Leave of Absence and Readmission status rows for the Overview, in the look of the Workflow Status panel. */
export function LeaveStatusPanel({ data }) {
  const overview = data.leave_overview;
  if (!overview) return null;
  const { onLeave } = isOnLeaveOrAwol(data.student);
  const latestLoa = (overview.cases || []).find((item) => LOA_KINDS.includes(item.kind));
  const latestReadmission = (overview.cases || []).find((item) => READMISSION_KINDS.includes(item.kind));
  const rows = [
    {
      key: "loa",
      label: "Leave of Absence",
      icon: CalendarOff,
      item: latestLoa,
      status: onLeave ? "On leave" : latestLoa?.status_label || "Not submitted",
      detail: leaveRowDetail(latestLoa, overview, "loa"),
      to: STUDENT_REQUEST_PATHS.loa,
    },
    {
      key: "readmission",
      label: "Readmission",
      icon: UserCheck,
      item: latestReadmission,
      status: latestReadmission?.status_label || "Not submitted",
      detail: leaveRowDetail(latestReadmission, overview, "readmission"),
      to: STUDENT_REQUEST_PATHS.readmission,
    },
  ];
  return (
    <Card className="p-6">
      <SectionTitle title="Leave and return" subtitle="Where your leave of absence and readmission requests stand" icon={FileText} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" /> {row.label}
                </span>
                {row.item && !(row.key === "loa" && onLeave) ? leaveCaseStatusBadge(row.item) : <StatusBadge value={row.status} dot={false} />}
              </div>
              <p className="text-xs leading-relaxed text-slate-500">{row.detail}</p>
              <Link to={row.to} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Open request <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
