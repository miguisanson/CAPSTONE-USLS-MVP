import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Briefcase, CheckCircle2, Eye, HelpCircle, History, MessageSquare, RotateCcw } from "lucide-react";
import { Button, DataTable, DecisionPanel, EmptyState, Modal, PageHeader, StatusChip } from "../../components/ui/index.js";
import PolicyRules from "../../components/PolicyRules";
import StageBoard from "../../components/StageBoard";
import LeaveFilters, { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { EMPTY_FILTERS, matchesFilters, plural } from "../leave/leaveHelpers";
import { WorkflowSupportModal } from "../workflow/shared";
import { formatDate } from "../../lib/format";
import { PAGE } from "../../lib/labels.js";
import { DeanFeedback, useDean } from "./DeanContext";
import { casePath } from "./DeanShared";
import { deanItemDate } from "./deanHelpers";

// The Dean's Practicum Reports board (I-122, IM24). It is the same board the other Dean pages use: the same header
// (title, one line, "N waiting", "How this works", "View recent activity"), the same "Rules applied" panel, the same
// toolbar (search, program, status, Board/Table) and the same StageBoard with real drag and drop, "Move to..." and a
// lock with its reason on a card that cannot move.
//
// The Dean sees three stages of a practicum report (the server lists only these, /api/approvals `workflow_overview`).
// A move is the same decision as the buttons on the case page: it opens one window named after the button, and the
// server checks it again (api.decideWorkflowApproval via useDean().requestWorkflowDecision).

const DESCRIPTION = "Practicum completion reports sent to the Dean for final review.";

const COLUMNS = [
  { key: "waiting", label: "With the Dean", description: "Reports the Academic Coordinator sent to you.", statuses: ["Report Sent to Dean"] },
  { key: "returned", label: "Returned", description: "Sent back to the Academic Coordinator.", statuses: ["Additional Certificates Requested"] },
  { key: "reviewed", label: "Reviewed", description: "Marked reviewed by the Dean.", statuses: ["Dean Reviewed"] },
];

// What a drop on a column means for a report that waits for the Dean: the API word and the button's words.
const DECISION_FOR_COLUMN = {
  reviewed: { decision: "review", label: "Mark reviewed", tone: "approve", icon: CheckCircle2, target: "Approved / reviewed" },
  returned: { decision: "return", label: "Return for revision", tone: "return", icon: RotateCcw, target: "Returned for revision" },
};

const getItemId = (item) => item.id;
const getColumnKey = (item) => COLUMNS.find((column) => column.statuses.includes(item.status))?.key || "waiting";
const isWaiting = (item) => item.status === "Report Sent to Dean";

// The same words as every board: "Waiting for: <owner>", or that nothing more is to do.
function lockReason(item) {
  if (getColumnKey(item) === "reviewed") return "Finished - nothing more to do";
  return `Waiting for: ${item.next_action_owner || "Academic Coordinator"}`;
}

function checkMove(item, column) {
  if (isWaiting(item) && DECISION_FOR_COLUMN[column.key]) return { allowed: true };
  return { allowed: false, reason: lockReason(item) };
}

function hoursText(item) {
  const record = item.record;
  return record ? `${record.completed_hours}/${record.required_hours} hrs` : "No hours recorded";
}

function PracticumCard({ item }) {
  const latestMessage = item.messages?.[0];
  const updated = item.last_activity_at || item.submitted_at;
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-slate-300">
      <p className="truncate text-sm font-semibold text-ink">{item.student.name}</p>
      <p className="meta truncate">{item.student.student_number} · {item.student.program_code}</p>
      <StatusChip className="mt-2" status={item.status} size="sm" dot={false} />
      <p className="mt-2.5 text-xs font-medium text-slate-700">{item.record?.practicum_site || "Site not recorded"}</p>
      <p className="meta mt-0.5">{hoursText(item)}</p>
      {updated && <p className="meta mt-0.5">Updated {formatDate(updated)}</p>}
      {item.messages?.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
          <p className="eyebrow !text-amber-800">
            <MessageSquare className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
            {plural(item.messages.length, "visible message")}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-amber-900">{latestMessage?.comment || latestMessage?.template}</p>
        </div>
      )}
      <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">
        {item.next_action_owner ? `Next: ${item.next_action_owner}` : "No further step"}
      </p>
      <Button
        as={Link}
        to={casePath(item)}
        variant="secondary"
        size="sm"
        icon={Eye}
        className="mt-3 w-full"
        aria-label={`View details for ${item.student.name}`}
      >
        View details
      </Button>
    </article>
  );
}

function PracticumTable({ items }) {
  const columns = [
    {
      key: "student",
      header: "Student",
      sortValue: (item) => item.student.name,
      cell: (item) => (
        <>
          <p className="font-semibold text-ink">{item.student.name}</p>
          <p className="meta">{item.student.student_number} · {item.student.program_code}</p>
        </>
      ),
    },
    {
      key: "about",
      header: "What it is about",
      sortValue: (item) => item.record?.practicum_site || "",
      cell: (item) => (
        <>
          <p>{item.record?.practicum_site || "Site not recorded"}</p>
          <p className="meta">{hoursText(item)}</p>
        </>
      ),
    },
    { key: "status", header: "Status", sortValue: (item) => item.status, cell: (item) => <StatusChip status={item.status} dot={false} /> },
    { key: "owner", header: "Next", sortValue: (item) => item.next_action_owner || "", cell: (item) => item.next_action_owner || "-" },
    { key: "updated", header: "Updated", sortValue: (item) => deanItemDate(item), cell: (item) => formatDate(deanItemDate(item)) },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      align: "right",
      cell: (item) => (
        <Button as={Link} to={casePath(item)} variant="secondary" size="sm" icon={Eye} aria-label={`View details for ${item.student.name}`}>
          View details
        </Button>
      ),
    },
  ];
  return <DataTable caption="Practicum reports" columns={columns} rows={items} rowKey={(item) => item.id} minWidth="md" pageSize={0} />;
}

// One window for a decision made by dragging or "Move to...": named after the button, with the one button.
function DecisionWindow({ item, choice, onClose }) {
  const { busy, requestWorkflowDecision } = useDean();
  async function decide(_key, comment) {
    await requestWorkflowDecision(item, choice.decision, comment);
    onClose();
  }
  return (
    <Modal
      size="md"
      icon={choice.icon}
      title={`Confirm: ${choice.label}`}
      subtitle={`${item.student.name} · ${item.student.student_number} · Practicum`}
      onClose={onClose}
      dismissible={busy !== `${item.type}-${item.id}`}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="eyebrow">Workflow movement</p>
          <p className="mt-2 text-sm font-semibold text-ink">
            {item.status} <span className="mx-1 text-slate-400">→</span> {choice.target}
          </p>
          <p className="meta mt-1">{item.subtitle}</p>
          <p className="meta mt-1">This action is recorded against your signed-in account.</p>
        </div>
        <DecisionPanel
          variant="plain"
          subject="Dean decision"
          busy={busy === `${item.type}-${item.id}`}
          onDecide={decide}
          onCancel={onClose}
          commentLabel="Review comment"
          commentHint={choice.decision === "return" ? "Required to return the report for revision." : "Optional. It is saved with your name, role, date and time."}
          commentRequiredMessage="Choose a reason or enter a comment before returning or denying the request."
          actions={[{ key: choice.decision, label: choice.label, tone: choice.tone, icon: choice.icon }]}
        />
      </div>
    </Modal>
  );
}

export function DeanPracticumBoard() {
  const { workflowOverview, counts } = useDean();
  const [view, setView] = useState("board");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [support, setSupport] = useState(""); // "guide" | "activity"
  const [decision, setDecision] = useState(null); // { item, choice }

  const items = useMemo(
    () => workflowOverview
      .filter((item) => item.type === "practicum")
      .sort((left, right) => new Date(deanItemDate(right) || 0).getTime() - new Date(deanItemDate(left) || 0).getTime()),
    [workflowOverview],
  );
  const filtered = useMemo(() => items.filter((item) => matchesFilters(item, filters)), [items, filters]);
  const programs = useMemo(() => [...new Set(items.map((item) => item.student?.program_code).filter(Boolean))].sort(), [items]);
  const statusOptions = useMemo(() => [...new Set(items.map((item) => item.status))].map((value) => ({ value, label: value })), [items]);
  const totals = useMemo(() => {
    const result = {};
    items.forEach((item) => {
      const key = getColumnKey(item);
      result[key] = (result[key] || 0) + 1;
    });
    return result;
  }, [items]);
  const summaryLine = useMemo(() => {
    const parts = COLUMNS.filter((column) => (totals[column.key] || 0) > 0).map((column) => `${totals[column.key]} ${column.label}`);
    return parts.length ? parts.join(", ") : "No reports yet";
  }, [totals]);
  // The recent activity of every report on the board, newest first (the case history the server sends with each one).
  const logs = useMemo(
    () => items
      .flatMap((item) => item.history || [])
      .sort((left, right) => new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime())
      .slice(0, 40),
    [items],
  );

  async function onMove(item, column) {
    const choice = DECISION_FOR_COLUMN[column.key];
    if (!choice || !isWaiting(item)) throw new Error(lockReason(item));
    setDecision({ item, choice });
    return undefined;
  }

  const renderColumnHeader = (column, columnItems) => {
    const total = totals[column.key] || 0;
    const filteredOut = columnItems.length !== total;
    return (
      <header className="mb-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="section-title">{column.label}</h3>
          <span
            className="micro rounded-full bg-white px-2 py-0.5 font-semibold ring-1 ring-slate-200"
            aria-label={filteredOut ? `${columnItems.length} shown of ${total}` : plural(total, "report")}
          >
            {filteredOut ? `${columnItems.length} of ${total}` : total}
          </span>
        </div>
        {column.description && <p className="meta mt-1 leading-relaxed">{column.description}</p>}
      </header>
    );
  };

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.practicumReports}
        description={DESCRIPTION}
        icon={Briefcase}
        badge={<StatusChip status={`${counts.pendingPracticum} waiting`} tone="muted" dot={false} />}
        actions={
          <>
            <Button variant="secondary" icon={HelpCircle} onClick={() => setSupport("guide")}>How this works</Button>
            <Button variant="secondary" icon={History} onClick={() => setSupport("activity")}>View recent activity</Button>
          </>
        }
      />
      <DeanFeedback />

      <PolicyRules process="practicum" />

      <div className="min-w-0">
        <p className="text-base font-semibold text-ink" aria-live="polite">{summaryLine}</p>
        <p className="mt-1 max-w-3xl text-sm text-slate-500">
          Dragging a card to another column does the same as the buttons on its case page. On a keyboard or phone, use
          &quot;Move to...&quot; on the card.
        </p>
      </div>

      <BoardFilterRow toggle={<ViewToggle value={view} onChange={setView} />}>
        <LeaveFilters
          filters={filters}
          setFilters={setFilters}
          programs={programs}
          statusOptions={statusOptions}
          kindOptions={[]}
          count={filtered.length}
          total={items.length}
          noun="reports"
        />
      </BoardFilterRow>

      {items.length === 0 ? (
        <EmptyState title="No practicum reports yet" hint="Reports appear here once the Academic Coordinator sends one to the Dean." />
      ) : filtered.length === 0 ? (
        <EmptyState title="No reports match these filters" hint="Clear a filter to see more." />
      ) : view === "board" ? (
        <StageBoard
          ariaLabel="Practicum workflow board"
          columns={COLUMNS}
          items={filtered}
          getItemId={getItemId}
          getColumnKey={getColumnKey}
          renderCard={(item) => <PracticumCard item={item} />}
          canDrag={isWaiting}
          lockReason={lockReason}
          checkMove={checkMove}
          onMove={onMove}
          renderColumnHeader={renderColumnHeader}
          emptyText="No reports here"
        />
      ) : (
        <PracticumTable items={filtered} />
      )}

      {decision && <DecisionWindow item={decision.item} choice={decision.choice} onClose={() => setDecision(null)} />}
      {support && (
        <WorkflowSupportModal
          slug="practicum"
          mode={support}
          logs={logs}
          summary="Practicum completion reports the Academic Coordinator sends to the Dean."
          actor="Graduate School Staff, Academic Coordinator, Dean"
          data="The practicum MOA, hours and certificates, and the status report sent to the Dean"
          onClose={() => setSupport("")}
        />
      )}
    </div>
  );
}
