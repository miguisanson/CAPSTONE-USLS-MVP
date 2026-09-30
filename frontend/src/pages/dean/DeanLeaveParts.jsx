import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import { formatDate } from "../../lib/format";

// Plain-language Dean view of one Leave of Absence / Readmission case.
// Everything here is read-only: the Dean's buttons and comment box stay in WorkflowApprovalCard.

export const LEAVE_TYPES = ["leave-of-absence", "readmission"];

export function isLeaveCaseItem(item) {
  return Boolean(item && LEAVE_TYPES.includes(item.type) && item.case);
}

// A case the Dean can decide on now (and so may be part of a group decision).
export function isLeaveDecisionDue(item) {
  return isLeaveCaseItem(item) && item.workflow_status === "Dean Review";
}

const CHECK_TONES = {
  Pass: "bg-brand-50 text-brand-700 ring-brand-200",
  Present: "bg-brand-50 text-brand-700 ring-brand-200",
  "Needs Review": "bg-amber-50 text-amber-800 ring-amber-200",
  Fail: "bg-red-50 text-red-700 ring-red-200",
};

export function PolicyCheckBadge({ status }) {
  const text = status === "Present" ? "Provided" : status || "Not checked";
  const tone = CHECK_TONES[status] || "bg-slate-100 text-slate-600 ring-slate-200";
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset ${tone}`}>{text}</span>;
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h3>
      {children}
    </section>
  );
}

function Tick({ on, yes, no }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${on ? "text-brand-700" : "text-slate-400"}`}>
      {on ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
      {on ? yes : no}
    </span>
  );
}

function LimitBar({ label, value, limit, detail }) {
  const used = Number(value) || 0;
  const max = Number(limit) || 0;
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const tone = max > 0 && used >= max ? "bg-red-500" : max > 0 && used / max >= 0.75 ? "bg-amber-500" : "bg-brand-500";
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm text-slate-600">{detail}</p>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${label}: ${used} of ${max}`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function isEarlyReturn(leaveCase) {
  return (leaveCase?.policy_review?.checks || []).some((check) => check.label === "Return semester after the leave" && check.status === "Needs Review");
}

export function LeaveCaseSummary({ item }) {
  const c = item.case;
  if (!c) return null;
  const period = c.period;
  const summary = c.student_summary;
  const review = c.policy_review;
  const checks = review?.checks || [];
  const comments = (c.events || []).filter((event) => event.comment && String(event.comment).trim());
  const earlier = c.earlier_cases || [];
  const early = isEarlyReturn(c);
  return (
    <div className="mt-4 space-y-4">
      {c.timeline?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <LeaveTimeline steps={c.timeline} />
        </div>
      )}

      {c.status === "Denied" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          This request was denied. Follow-up owner: {c.owner || "Graduate School staff"}. Staff follow up with the student.
        </p>
      )}

      {early && (
        <p role="note" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Early return. The student asks to come back before the approved leave ends. You decide whether the leave ends early.</span>
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What is being asked">
          <dl className="space-y-3">
            <Field label="Request">{c.kind_label} · Case #{c.id} · {leaveCaseStatusBadge(c)}</Field>
            {period && (
              <Field label="Leave period">
                {period.text || `${period.start_label || "—"} to ${period.end_label || "—"}`}
                {(period.start_date || period.end_date) && <span className="block text-xs text-slate-500">{formatDate(period.start_date)} to {formatDate(period.end_date)}</span>}
                {period.semesters ? <span className="block text-xs text-slate-500">{period.semesters} semester{period.semesters === 1 ? "" : "s"}</span> : null}
              </Field>
            )}
            {c.target_term && <Field label="Return semester">{c.target_term}</Field>}
            {c.linked_case && (
              <Field label="Leave being ended">
                {c.linked_case.kind_label}{c.linked_case.period_text ? ` · ${c.linked_case.period_text}` : ""}{c.linked_case.status_label ? ` · ${c.linked_case.status_label}` : ""}
              </Field>
            )}
            {c.reason_category && <Field label="Reason">{c.reason_category}</Field>}
            {c.reason_text && <Field label="Reason in the student's words">{c.reason_text}</Field>}
            {c.return_intent && <Field label="What the student intends to do">{c.return_intent}</Field>}
            {c.batch_name && <Field label="Group">{c.batch_name}</Field>}
          </dl>
        </Panel>

        <Panel title="Checklist">
          {c.checklist?.length ? (
            <ul className="space-y-2">
              {c.checklist.map((row, index) => (
                <li key={`${index}-${row.item}`} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-700">{row.item}</p>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <Tick on={Boolean(row.checked)} yes="Student ticked" no="Student did not tick" />
                    <Tick on={Boolean(row.confirmed)} yes="Staff verified" no="Staff not verified" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No checklist was needed for this request.</p>
          )}
          <dl className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            <Field label="Staff eligibility result">{c.eligibility_result || "Not recorded"}</Field>
            <Field label="Staff notes">{c.staff_notes && c.staff_notes.trim() ? c.staff_notes : "No notes from staff."}</Field>
          </dl>
        </Panel>
      </div>

      {review && (
        <Panel title="Policy check">
          {checks.length > 0 && (
            <ul className="space-y-2">
              {checks.map((check, index) => (
                <li key={`${index}-${check.label}`} className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-700">{check.label}</p>
                    {check.detail && <p className="mt-0.5 text-xs text-slate-500">{check.detail}</p>}
                  </div>
                  <PolicyCheckBadge status={check.status} />
                </li>
              ))}
            </ul>
          )}
          {review.summary && <p className="mt-3 text-sm text-slate-600">{review.summary}</p>}
          {review.suggested_dean_action && (
            <p className="mt-2 text-sm text-slate-700">
              <span className="font-semibold">Suggested: {review.suggested_dean_action}</span>
              <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Advice only - you decide</span>
            </p>
          )}
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {summary && (
          <Panel title="Student standing">
            <div className="space-y-3">
              <LimitBar
                label="Years in the program"
                value={summary.years_in_program}
                limit={summary.absolute_years}
                detail={`${summary.years_in_program} year${summary.years_in_program === 1 ? "" : "s"} so far · normal ${summary.normal_years} · most allowed ${summary.absolute_years}`}
              />
              <LimitBar
                label="Leave already approved"
                value={summary.approved_leave_semesters}
                limit={summary.max_leave_semesters}
                detail={`${summary.approved_leave_semesters} of ${summary.max_leave_semesters} semesters`}
              />
              {summary.program_level && <p className="text-xs text-slate-500">{summary.program_level} level</p>}
            </div>
          </Panel>
        )}
        <Panel title="Earlier cases of this student">
          {earlier.length ? (
            <ul className="space-y-2">
              {earlier.map((row) => (
                <li key={row.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {row.kind_label}{row.period_text ? ` · ${row.period_text}` : ""} · {row.status_label}
                  {row.decided_at ? <span className="block text-xs text-slate-500">Decided {formatDate(row.decided_at)}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No earlier leave or readmission cases.</p>
          )}
        </Panel>
      </div>

      {(comments.length > 0 || c.dean_remarks) && (
        <Panel title="Comments on earlier decisions">
          <ul className="space-y-2">
            {c.dean_remarks && <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="font-semibold">Dean: </span>{c.dean_remarks}</li>}
            {comments.map((event) => (
              <li key={event.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <span className="font-semibold">{event.actor_name || event.actor_role || "Staff"}</span>
                <span className="text-xs text-slate-500"> · {event.actor_role}{event.created_at ? ` · ${formatDate(event.created_at)}` : ""}</span>
                <p className="mt-0.5 whitespace-pre-wrap">{event.comment}</p>
              </li>
            ))}
          </ul>
        </Panel>
      )}

    </div>
  );
}
