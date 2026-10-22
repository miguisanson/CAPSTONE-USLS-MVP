import { CheckCircle2, Circle, Download, FileCheck, FileSpreadsheet, Eye, GraduationCap, History, ListChecks, ShieldCheck, Users } from "lucide-react";
import { formatDate, formatDateTime } from "../../lib/format";
import { ProgressBar } from "../../components/ui";
import { Button, HistoryPanel, StatusChip } from "../../components/ui/index.js";
import { Block } from "./leaveUi";
import { plural, whenDates, whenText } from "./leaveHelpers";

function Row({ label, children, full = false }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-ink">{children}</dd>
    </div>
  );
}

// AWOL and Withdrawal send their own rows (`summary_rows`); the layout is the same as Leave's.
function SummaryRows({ item }) {
  return (
    <Block title="The request">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Student">
          {item.student.name}
          <span className="block text-xs text-slate-500">
            {item.student.student_number} · {item.student.program_name || item.student.program_code}
          </span>
        </Row>
        {item.summary_rows.map((row) => (
          <Row key={row.label} label={row.label} full={Boolean(row.full)}>
            {row.date ? formatDate(row.value) : row.value || "-"}
          </Row>
        ))}
      </dl>
    </Block>
  );
}

export function CaseSummary({ item }) {
  if (item.summary_rows) return <SummaryRows item={item} />;
  const readmission = item.kind === "READMISSION";
  const linked = item.linked_case;
  const before = [item.prior_stage, item.prior_enrollment_tag].filter(Boolean).join(" / ");
  return (
    <Block title="The request">
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Row label="Student">
          {item.student.name}
          <span className="block text-xs text-slate-500">
            {item.student.student_number} · {item.student.program_name || item.student.program_code}
          </span>
        </Row>
        <Row label="Type">{item.kind_label}</Row>
        {readmission ? (
          <Row label="Returning in">{item.target_term || "Not chosen yet"}</Row>
        ) : (
          <Row label="Leave period">
            {whenText(item)}
            {whenDates(item) && <span className="block text-xs text-slate-500">{whenDates(item)}</span>}
          </Row>
        )}
        <Row label="Reason">{item.reason_category || "-"}</Row>
        {item.reason_text && <Row label="What the student wrote" full>{item.reason_text}</Row>}
        {item.return_intent && <Row label="Intention after the leave" full>{item.return_intent}</Row>}
        {linked && (
          <Row label="Linked leave" full>
            {linked.kind_label}: {linked.period_text || "period not set"} ({linked.status_label})
          </Row>
        )}
        <Row label="Stage and tag before leaving">{before || "-"}</Row>
        <Row label="Eligibility result">
          {item.eligibility_result ? <StatusChip status={item.eligibility_result} dot={false} /> : "Not set yet"}
        </Row>
        <Row label="Filed">{formatDate(item.submitted_at)}</Row>
        <Row label="Sent to the Dean">{formatDate(item.forwarded_at)}</Row>
        <Row label="Dean decided">{formatDate(item.decided_at)}</Row>
        {item.batch_name && <Row label="Batch">{item.batch_name}</Row>}
        <Row label="Staff notes" full>{item.staff_notes || "None"}</Row>
        <Row label="Dean remarks" full>{item.dean_remarks || "None"}</Row>
      </dl>
    </Block>
  );
}

export function PolicyCheck({ detail }) {
  const review = detail.policy_review;
  const snapshot = detail.policy_snapshot;
  if (!review) return null;
  return (
    <Block title="Policy check" icon={ShieldCheck} hint="Advice for staff - the Dean decides.">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={review.recommendation} dot={false} />
        {review.suggested_dean_action && (
          <span className="meta">Suggested for the Dean: {review.suggested_dean_action}</span>
        )}
      </div>
      {review.summary && <p className="mt-2 text-sm text-slate-700">{review.summary}</p>}
      <ul className="mt-3 space-y-2">
        {(review.checks || []).map((check, index) => (
          <li key={`${index}-${check.label}`} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{check.label}</p>
              {check.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{check.detail}</p>}
            </div>
            <StatusChip status={check.status} dot={false} />
          </li>
        ))}
      </ul>
      {snapshot?.checked_at && (
        <p className="mt-3 text-xs text-slate-500">
          The Dean sees the check as it was when the request was sent on {formatDateTime(snapshot.checked_at)}.
        </p>
      )}
    </Block>
  );
}

export function StudentSummary({ detail }) {
  const summary = detail.student_summary;
  if (!summary) return null;
  const years = Number(summary.years_in_program) || 0;
  const absolute = Number(summary.absolute_years) || 0;
  const leave = Number(summary.approved_leave_semesters) || 0;
  const leaveMax = Number(summary.max_leave_semesters) || 0;
  return (
    <Block title="The student so far" icon={GraduationCap}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-ink">
            {plural(years, "year")} in the program
          </p>
          <p className="text-xs text-slate-500">
            Normal length {summary.normal_years} years. The most allowed is {summary.absolute_years} years.
          </p>
          <ProgressBar className="mt-2" value={absolute ? (years / absolute) * 100 : 0} />
        </div>
        {leaveMax > 0 && (
          <div>
            <p className="text-sm font-semibold text-ink">
              {leave} of {leaveMax} leave semesters already approved
            </p>
            <p className="text-xs text-slate-500">Earlier leaves count toward the total limit.</p>
            <ProgressBar className="mt-2" value={leaveMax ? (leave / leaveMax) * 100 : 0} />
          </div>
        )}
      </div>
    </Block>
  );
}

export function EarlierCases({ detail }) {
  const rows = detail.earlier_cases || [];
  return (
    <Block title="Earlier requests by this student" icon={Users}>
      {!rows.length ? (
        <p className="text-sm text-slate-500">No earlier requests in this process.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-semibold text-ink">{row.kind_label}</span>
                {row.period_text && <span className="text-slate-600"> · {row.period_text}</span>}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {row.status_label}
                {row.decided_at && <span>decided {formatDate(row.decided_at)}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

export function ChecklistView({ detail }) {
  const rows = detail.checklist || [];
  if (!rows.length) return null;
  return (
    <Block title="Return checklist" icon={ListChecks}>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.item} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-3 py-2.5 text-sm">
            {row.confirmed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden="true" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p className="font-medium text-ink">{row.item}</p>
              <p className="text-xs text-slate-500">
                {row.checked ? "The student ticked this." : "The student has not ticked this."}{" "}
                {row.confirmed ? "Verified by staff." : "Not verified by staff yet."}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

// The same "what happens after the Dean decides" block in all four processes.
export function FollowUpBlock({ detail }) {
  const followUp = detail.follow_up;
  if (!followUp) return null;
  return (
    <Block title={followUp.title || "Registrar follow-up"} icon={FileSpreadsheet}>
      <p className="text-sm text-slate-600">{followUp.text}</p>
      {detail.registrar?.status && detail.registrar.status !== "Not Ready" && (
        <p className="mt-2 text-xs font-semibold text-slate-600">Registrar list: {detail.registrar.status}</p>
      )}
      {(followUp.links || []).length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {followUp.links.map((link) => (
            <Button key={link.url} as="a" href={link.url} variant="secondary" size="sm" icon={Download}>
              {link.label}
            </Button>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Nothing to send yet. The link appears after the Dean approves.</p>
      )}
    </Block>
  );
}

export function FileList({ files = [] }) {
  return (
    <Block title="Files" icon={FileCheck}>
      {!files.length ? (
        <p className="text-sm text-slate-500">No files were uploaded for this request.</p>
      ) : (
        <ul className="space-y-2">
          {files.map((file) => (
            <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
                <p className="text-xs text-slate-500">
                  Uploaded by {file.uploaded_by || "someone"} ({file.uploaded_by_role || "role not recorded"}) · {formatDateTime(file.uploaded_at)}
                </p>
              </div>
              {file.file_exists !== false ? (
                <Button as="a" href={file.url} target="_blank" rel="noreferrer" variant="secondary" size="sm" icon={Eye}>
                  View file
                </Button>
              ) : (
                <StatusChip tone="danger" label="File unavailable" dot={false} />
              )}
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function eventWord(event, vocabulary) {
  const match = (vocabulary?.transitions || []).find((row) => row.action === event.action);
  if (match) return match.label;
  if (event.action === "submit") return "Filed by the student";
  return String(event.action || "Update").replace(/_/g, " ").replace(/^./, (letter) => letter.toUpperCase());
}

export function CaseHistory({ detail, vocabulary }) {
  const events = (detail.events || []).map((event) => ({
    id: event.id,
    title: eventWord(event, vocabulary),
    at: event.created_at,
    actor: event.actor_name || "Someone",
    actorRole: event.actor_role,
    from: event.from_status,
    to: event.to_status,
    note: event.comment,
  }));
  const logs = (detail.history || []).map((log) => ({
    id: log.id,
    title: log.result,
    at: log.created_at,
    actor: log.actor_role,
    from: log.previous_status,
    to: log.new_status,
    note: log.notes,
  }));
  return (
    <Block title="History" icon={History}>
      <div className="space-y-3">
        <HistoryPanel
          label="Who did what"
          hideLabel="Hide who did what"
          entries={events}
          emptyText="No steps recorded yet"
        />
        <HistoryPanel
          label="Activity log"
          hideLabel="Hide activity log"
          entries={logs}
          emptyText="No activity yet. Filings, messages and decisions will appear here."
        />
      </div>
    </Block>
  );
}
