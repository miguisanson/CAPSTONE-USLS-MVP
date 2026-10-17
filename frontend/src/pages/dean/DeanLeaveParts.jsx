import { AlertTriangle, CheckCircle2, Circle } from "lucide-react";
import { InlineNotice, StatusChip } from "../../components/ui/index.js";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import { formatDate } from "../../lib/format";
import { toneOf } from "../../lib/tone";

// Plain-language Dean view of one Leave of Absence / Readmission case.
// Everything here is read-only: the Dean's buttons and comment box stay in WorkflowApprovalCard.

export const LEAVE_TYPES = ["leave-of-absence", "readmission"];

export function isLeaveCaseItem(item) {
  return Boolean(item && LEAVE_TYPES.includes(item.type) && item.case);
}

// One policy rule's result. The colour comes from the status map (Pass / Present green, Needs Review amber, Fail red);
// a rule with no result yet reads "Not checked" in grey. "Present" is shown as "Provided".
export function PolicyCheckBadge({ status }) {
  return <StatusChip status={status} label={status === "Present" ? "Provided" : status || "Not checked"} tone="muted" size="sm" dot={false} className="shrink-0" />;
}

// One fact of the request: a term and its value (read-only). The library Field is for form controls, so this stays a
// definition-list pair.
function Fact({ label, children }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{children}</dd>
    </div>
  );
}

function Panel({ title, children, className = "" }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 ${className}`}>
      <h3 className="eyebrow mb-2">{title}</h3>
      {children}
    </section>
  );
}

function Tick({ on, yes, no }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${on ? "text-brand-700" : "text-slate-500"}`}>
      {on ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
      {on ? yes : no}
    </span>
  );
}

function LimitBar({ label, value, limit, detail }) {
  const used = Number(value) || 0;
  const max = Number(limit) || 0;
  const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const tone = toneOf(max > 0 && used >= max ? "danger" : max > 0 && used / max >= 0.75 ? "warning" : "success").dot;
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
        <InlineNotice tone="danger" role="status">
          This request was denied. Follow-up owner: {c.owner || "Graduate School staff"}. Staff follow up with the student.
        </InlineNotice>
      )}

      {early && (
        <InlineNotice tone="warning" role="note" icon={AlertTriangle}>
          Early return. The student asks to come back before the approved leave ends. You decide whether the leave ends early.
        </InlineNotice>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="What is being asked">
          <dl className="space-y-3">
            <Fact label="Request">{c.kind_label} · Case #{c.id} · {leaveCaseStatusBadge(c)}</Fact>
            {period && (
              <Fact label="Leave period">
                {period.text || `${period.start_label || "—"} to ${period.end_label || "—"}`}
                {(period.start_date || period.end_date) && <span className="block text-xs text-slate-500">{formatDate(period.start_date)} to {formatDate(period.end_date)}</span>}
                {period.semesters ? <span className="block text-xs text-slate-500">{period.semesters} semester{period.semesters === 1 ? "" : "s"}</span> : null}
              </Fact>
            )}
            {c.target_term && <Fact label="Return semester">{c.target_term}</Fact>}
            {c.linked_case && (
              <Fact label="Leave being ended">
                {c.linked_case.kind_label}{c.linked_case.period_text ? ` · ${c.linked_case.period_text}` : ""}{c.linked_case.status_label ? ` · ${c.linked_case.status_label}` : ""}
              </Fact>
            )}
            {c.reason_category && <Fact label="Reason">{c.reason_category}</Fact>}
            {c.reason_text && <Fact label="Reason in the student's words">{c.reason_text}</Fact>}
            {c.return_intent && <Fact label="What the student intends to do">{c.return_intent}</Fact>}
            {c.batch_name && <Fact label="Group">{c.batch_name}</Fact>}
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
            <Fact label="Staff eligibility result">{c.eligibility_result || "Not recorded"}</Fact>
            <Fact label="Staff notes">{c.staff_notes && c.staff_notes.trim() ? c.staff_notes : "No notes from staff."}</Fact>
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
              <StatusChip label="Advice only - you decide" tone="muted" size="sm" dot={false} className="ml-2" />
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
