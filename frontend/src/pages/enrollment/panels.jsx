// The smaller blocks of the Enrollment page: the student summary, the four subject counters, the notices that follow a
// confirm, and the enrollment history. Each is a plain view of what the page passes in.
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpenCheck, Table2, UserRound } from "lucide-react";
import {
  Button,
  Card,
  EmptyState,
  HistoryPanel,
  InlineNotice,
  SectionCard,
  Select,
  StatCard,
  StatusChip,
} from "../../components/ui/index.js";
import { toneOf } from "../../lib/tone";

export function StudentSummary({ data, selectedCount, dirty }) {
  const student = data.selected_student;
  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 font-semibold text-brand-700" aria-hidden="true">
            {student.first_name?.[0]}{student.last_name?.[0]}
          </span>
          <div className="min-w-0">
            <h2 className="section-title break-words">{student.name}</h2>
            <p className="text-sm text-slate-500">
              {student.student_number} · {student.program_code} · {data.term.label}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={student.enrollment_tag} dot={false} />
          <StatusChip status={student.standing} dot={false} />
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneOf("neutral").chip}`}>{selectedCount} selected</span>
          {dirty && (
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneOf("warning").chip}`}>Unsaved changes</span>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SubjectStatusSummary({ summary }) {
  if (!summary) return null;
  const items = [
    ["Completed", summary.completed || 0, "Already finished; cannot be added again.", "success"],
    ["Enrolled", summary.enrolled || 0, "Already active in the selected semester.", "info"],
    ["Not taken", summary.available || 0, "Can be added when offered.", "neutral"],
    [
      "Needs review",
      (summary.enrolled_other_term || 0) + (summary.requires_resolution || 0),
      "Active in another term or has an unresolved monitoring status.",
      "warning",
    ],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Monitoring sheet subject status summary">
      {items.map(([label, value, helper, tone]) => (
        <StatCard key={label} size="sm" label={label} value={value} sub={helper} tone={tone} />
      ))}
    </div>
  );
}

/** Blocking conflicts: nothing was saved. */
export function ConflictNotice({ preview }) {
  const blocking = preview.conflicts.filter((conflict) => conflict.severity === "blocking");
  return (
    <InlineNotice
      tone="danger"
      icon={AlertTriangle}
      title="Enrollment was not changed"
    >
      <p>
        The system found {preview.conflict_count} blocking conflict{preview.conflict_count === 1 ? "" : "s"}. Correct the source record, then confirm again.
      </p>
      <ul className="mt-3 space-y-2">
        {blocking.map((conflict) => (
          <li key={conflict.id} className="rounded-xl border border-red-200 bg-white p-3 text-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="eyebrow">Conflict line: {conflict.line}</p>
                <p className="mt-1 text-sm font-medium">{conflict.message}</p>
              </div>
              <StatusChip status={conflict.severity} dot={false} />
            </div>
            <p className="mt-2 text-xs font-semibold text-red-700">No partial enrollment was saved.</p>
          </li>
        ))}
      </ul>
    </InlineNotice>
  );
}

/** A business rule applies (add/change window, academic load): the coordinator decides each item. */
export function RuleFlagPanel({ review, decisions, setDecisions, busy, onCancel, onSave }) {
  const ready = review.flags.every((flag) => decisions[flag.id]);
  return (
    <Card className="border-amber-200 bg-amber-50/50" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="section-title">A business rule applies to this change</h2>
          <p className="mt-1 text-sm text-slate-600">Nothing was saved yet. Decide each item below, then save. An exception is recorded on the enrollment.</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {review.flags.map((flag) => (
          <div key={flag.id} className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="eyebrow">{flag.line}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{flag.message}</p>
            <Select
              className="mt-3"
              aria-label={`Decision for ${flag.line}`}
              placeholder="Choose what to do"
              options={flag.options}
              value={decisions[flag.id] || ""}
              onChange={(event) => setDecisions((current) => ({ ...current, [flag.id]: event.target.value }))}
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel, change the selection</Button>
        <Button onClick={onSave} disabled={!ready} loading={busy}>{busy ? "Saving…" : "Save with these decisions"}</Button>
      </div>
    </Card>
  );
}

/** What happened after a confirm or a recorded drop, with the two places to look at the result. */
export function SuccessPanel({ result }) {
  return (
    <InlineNotice tone="success" title={result.message}>
      {result.automatic_conflicts?.length > 0 && (
        <p>
          The system automatically resolved {result.automatic_conflicts.length} warning{result.automatic_conflicts.length === 1 ? "" : "s"} by keeping the authoritative enrollment record.
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button as={Link} to={result.links.monitoring} variant="secondary" size="sm" icon={Table2}>Monitoring sheet</Button>
        <Button as={Link} to={result.links.student_profile} variant="secondary" size="sm" icon={UserRound}>Student profile</Button>
      </div>
    </InlineNotice>
  );
}

/** The student's saved subject enrollments, newest first, behind one toggle. */
export function EnrollmentHistory({ rows }) {
  const visible = rows.filter((row) => row.status !== "Cancelled").slice(0, 8);
  const entries = visible.map((row) => ({
    id: row.id,
    title: `${row.course_code} · ${row.term_label}`,
    at: row.updated_at,
    to: row.status,
  }));
  return (
    <SectionCard title="Enrollment history" subtitle="Durable semester records for this student.">
      {entries.length ? (
        <HistoryPanel label="View enrollment history" hideLabel="Hide enrollment history" entries={entries} />
      ) : (
        <EmptyState
          size="sm"
          icon={BookOpenCheck}
          title="No semester enrollment has been saved yet."
          hint="Confirm an enrollment draft and its subjects will be listed here."
        />
      )}
    </SectionCard>
  );
}
