import { LogOut, UserX } from "lucide-react";
import { Card, EditableText, HistoryPanel, InlineNotice } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus";
import { returnCommentOf } from "./LeaveCaseCards";
import { Fact } from "./shared";

// The student's view of one AWOL / residency or withdrawal case. It is the same card the
// student sees for a Leave of Absence or a Readmission (LeaveCaseCard): title and summary,
// status badge, who it is waiting for, why it was sent back, the facts, the timeline and the
// stage history. The words, the tone and the timeline come from the server
// (`data.standalone_cases`), exactly like the staff board and the Dean's board.

const RETURNED = ["Returned for Revision", "Returned for Clarification", "Returned"];
// Office-only facts and placeholders the student does not need (I-386).
const OFFICE_LABELS = new Set(["Type", "Detection source", "Policy classification", "Residence limits", "Years in the program", "Dean decision", "Dean decided", "Registrar list"]);
const plainWords = (text) => String(text || "").replace(/AWOL \(flagged by the system\)/i, "Absent without leave (AWOL)");
// The office's step names, in the words a student uses (I-393).
const STEP_WORDS = {
  "Dean decision": "The Dean decides",
  "Staff forwards it": "The Graduate School sends it to the Dean",
  "Subject tagged Withdrawn": "The subject is marked withdrawn",
  "Excel list exported": "The Graduate School prepares the Registrar list",
  "Emailed to the Registrar": "The Registrar is told",
};
const plainSteps = (steps) => (steps || []).map((step) => ({ ...step, label: STEP_WORDS[step.label] || step.label }));
const ICONS = { AWOL: UserX, RESIDENCY: UserX, WITHDRAWAL: LogOut };

// One stage event of the case as a history entry. The status change is shown only when the status really changed.
const eventEntry = (entry) => ({
  id: entry.id,
  title: entry.action || "Update",
  at: entry.created_at,
  from: entry.from_status && entry.to_status && entry.from_status !== entry.to_status ? entry.from_status : undefined,
  to: entry.from_status && entry.to_status && entry.from_status !== entry.to_status ? entry.to_status : undefined,
  note: entry.comment,
});

export function ProcessCaseCard({ item, current = true, onChanged }) {
  const Icon = ICONS[item.kind] || LogOut;
  const open = Boolean(item.owner) && item.timeline?.some((step) => step.state === "current");
  const returned = RETURNED.includes(item.status);
  const returnComment = returned ? returnCommentOf(item) : "";
  const messages = item.messages || [];
  const events = item.events || [];
  const rows = (item.summary_rows || []).filter((row) => !OFFICE_LABELS.has(row.label) && row.value !== "Not filed yet");
  const facts = rows.filter((row) => !row.full && row.value && row.value !== "None" && row.value !== "Not recorded");
  const texts = rows.filter((row) => row.full && row.value && row.value !== "None");
  return (
    <Card as="article" className={current ? "border-brand-200" : ""}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="card-title">{item.kind_label}</h3>
            {(item.card_lines || []).filter(Boolean).map((line, index) => (
              <p key={index} className={index === 0 ? "mt-0.5 text-sm text-slate-600" : "meta"}>{plainWords(line)}</p>
            ))}
          </div>
        </div>
        {leaveCaseStatusBadge({ ...item, status_label: plainWords(item.status_label) })}
      </div>

      {open && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          {returned
            ? "Waiting for: you. Correct your request and send it again."
            : item.owner === "Student" ? "Waiting for: you." : `Waiting for: ${item.owner}`}
        </p>
      )}

      {returned && returnComment && (
        <InlineNotice tone="warning" title="Why it was sent back" className="mt-3">
          <span className="whitespace-pre-line">{returnComment}</span>
        </InlineNotice>
      )}

      {facts.length > 0 && (
        <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((row) => (
            <Fact key={row.label} label={row.label}>{row.date ? formatDate(row.value) : row.value}</Fact>
          ))}
        </dl>
      )}
      {texts.map((row) => (
        <div key={row.label} className="mt-3">
          <p className="eyebrow">{row.label}</p>
          <div className="mt-0.5 text-sm text-slate-600">
            {row.edit ? <EditableText edit={row.edit} value={row.value} onSaved={onChanged} editLabel="Edit your message" /> : <p className="whitespace-pre-line">{row.value}</p>}
          </div>
        </div>
      ))}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <LeaveTimeline steps={plainSteps(item.timeline)} />
      </div>

      <div className="mt-4 space-y-2">
        {messages.length > 0 && (
          <HistoryPanel label="View messages" hideLabel="Hide messages" count={messages.length}>
            <WorkflowDiscussion messages={messages} embedded showHeader={false} title={`${item.kind_label} messages`} onEdited={onChanged} />
          </HistoryPanel>
        )}
        <HistoryPanel
          label="View stage history"
          hideLabel="Hide stage history"
          entries={events.map(eventEntry)}
          sort="given"
          emptyText="Nothing has happened on this request yet."
        />
      </div>
    </Card>
  );
}

/** The current case in full and every earlier one collapsed, like the Leave and Readmission pages. */
export function ProcessCaseList({ cases = [] }) {
  if (!cases.length) return null;
  const [current, ...earlier] = cases;
  return (
    <div className="space-y-3">
      <ProcessCaseCard item={current} />
      {earlier.length > 0 && (
        <HistoryPanel label="Earlier requests" hideLabel="Hide earlier requests" count={earlier.length}>
          <div className="space-y-3">
            {earlier.map((item) => <ProcessCaseCard key={item.id} item={item} current={false} />)}
          </div>
        </HistoryPanel>
      )}
    </div>
  );
}
