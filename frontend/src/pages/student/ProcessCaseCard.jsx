import { LogOut, UserX } from "lucide-react";
import { formatDate, formatDateTime } from "../../lib/format";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import WorkflowDiscussion from "../../components/WorkflowDiscussion";
import { LeaveTimeline, leaveCaseStatusBadge } from "../../components/leaveStatus";
import { returnCommentOf } from "./LeaveCaseCards";

// The student's view of one AWOL / residency or withdrawal case. It is the same card the
// student sees for a Leave of Absence or a Readmission (LeaveCaseCard): title and summary,
// status badge, who it is waiting for, why it was sent back, the facts, the timeline and the
// stage history. The words, the tone and the timeline come from the server
// (`data.standalone_cases`), exactly like the staff board and the Dean's board.

const RETURNED = ["Returned for Revision", "Returned for Clarification", "Returned"];
const ICONS = { AWOL: UserX, RESIDENCY: UserX, WITHDRAWAL: LogOut };

function Fact({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function StageHistory({ events }) {
  if (!events.length) return <p className="text-sm text-slate-500">Nothing has happened on this request yet.</p>;
  return (
    <ol className="space-y-2">
      {events.map((entry) => (
        <li key={entry.id} className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{entry.action || "Update"}</p>
            <p className="text-[11px] text-slate-400">{formatDateTime(entry.created_at)}</p>
          </div>
          {entry.from_status && entry.to_status && entry.from_status !== entry.to_status && (
            <p className="mt-0.5 text-xs text-slate-500">{entry.from_status} → {entry.to_status}</p>
          )}
          {entry.comment && <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-slate-600">{entry.comment}</p>}
        </li>
      ))}
    </ol>
  );
}

export function ProcessCaseCard({ item, current = true }) {
  const Icon = ICONS[item.kind] || LogOut;
  const open = Boolean(item.owner) && item.timeline?.some((step) => step.state === "current");
  const returned = RETURNED.includes(item.status);
  const returnComment = returned ? returnCommentOf(item) : "";
  const messages = item.messages || [];
  const events = item.events || [];
  const rows = (item.summary_rows || []).filter((row) => row.label !== "Type");
  const facts = rows.filter((row) => !row.full && row.value && row.value !== "None" && row.value !== "Not recorded");
  const texts = rows.filter((row) => row.full && row.value && row.value !== "None");
  return (
    <article className={`rounded-2xl border p-4 sm:p-5 ${current ? "border-brand-200 bg-white" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink">{item.kind_label}</h3>
            {(item.card_lines || []).filter(Boolean).map((line, index) => (
              <p key={index} className={index === 0 ? "mt-0.5 text-sm text-slate-600" : "text-xs text-slate-500"}>{line}</p>
            ))}
          </div>
        </div>
        {leaveCaseStatusBadge(item)}
      </div>

      {open && (
        <p className="mt-3 text-sm font-semibold text-slate-700">
          {returned
            ? "Waiting for: you. Correct your request and send it again."
            : item.owner === "Student" ? "Waiting for: you." : `Waiting for: ${item.owner}`}
        </p>
      )}

      {returned && returnComment && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
          <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Why it was sent back</p>
          <p className="mt-1 whitespace-pre-line text-sm font-medium">{returnComment}</p>
        </div>
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
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{row.label}</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{row.value}</p>
        </div>
      ))}

      <div className="mt-4 border-t border-slate-100 pt-4">
        <LeaveTimeline steps={item.timeline || []} />
      </div>

      <div className="mt-4 space-y-2">
        {messages.length > 0 && (
          <HistoryDisclosure label="View messages" hideLabel="Hide messages" count={messages.length}>
            <WorkflowDiscussion messages={messages} embedded showHeader={false} title={`${item.kind_label} messages`} />
          </HistoryDisclosure>
        )}
        <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={events.length}>
          <StageHistory events={events} />
        </HistoryDisclosure>
      </div>
    </article>
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
        <HistoryDisclosure label="Earlier requests" hideLabel="Hide earlier requests" count={earlier.length}>
          <div className="space-y-3">
            {earlier.map((item) => <ProcessCaseCard key={item.id} item={item} current={false} />)}
          </div>
        </HistoryDisclosure>
      )}
    </div>
  );
}
