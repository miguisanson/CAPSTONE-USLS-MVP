import { useMemo, useState } from "react";
import { ClipboardList, Eye, Gavel } from "lucide-react";
import { api } from "../../api";
import StageBoard, { BoardNotice, useBoardNotice } from "../../components/StageBoard";
import { useApi } from "../../hooks";
import { useAuth } from "../../auth";
import { Button, Card, DataTable, InlineNotice, SectionTitle, StatusChip } from "../../components/ui/index.js";
import LeaveFilters, { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { EMPTY_FILTERS } from "../leave/leaveHelpers";
import { CaseCardFacts, CaseCardShell, NextOwner, PanelStamp, RequirementBoxes, StageColumnHeader } from "../../components/process";
import { formatClock, formatDate } from "../../lib/format";
import RecordForPanelDialog from "./RecordForPanelDialog";

// The Research Gate as a board (I-205, I-362): three numbered columns, one card per student. A student sits in the column of the
// stage they are at; the stage moves by itself when its requirements are complete, so the board is read-only (no dragging).
// Staff and the Research Coordinator can record, correct and confirm for the panel from a card (I-361).
// Merge v6.4 (M5): the columns share the page width and scroll inside a fixed height (Natalie), so every card is there
// and the student record below stays close; the count beside each stage is the unfiltered total.
const STATE_LABEL = { ready: "Ready", blocked: "Blocked", waiting: "Waiting", done: "Done" };
const STATE_HELP = {
  ready: "Documents are in; the next step is the Research Coordinator's.",
  blocked: "The student has to act first.",
  waiting: "Someone else has to review, sign or record a verdict.",
  done: "The stage is complete.",
};
const COLUMNS = [
  { key: "1", label: "Title Defense", description: "Form 1 is endorsed, the panel is matched and the title is defended." },
  { key: "2", label: "Proposal Defense", description: "The proposal is prepared, signed by the adviser and defended." },
  { key: "3", label: "Final Defense", description: "Final defense requirements and panel decision, then completion evidence." },
];
const STATUS_OPTIONS = Object.entries(STATE_LABEL).map(([value, label]) => ({ value, label }));

function defenseFact(row) {
  const defense = row.next_defense;
  if (row.verdict) return `${defense?.defense_type || row.stage} verdict: ${row.verdict.label || row.verdict.result}`;
  if (defense) return `${defense.defense_type}: ${formatDate(defense.date)}${defense.start_time ? `, ${formatClock(defense.start_time)}` : ""}`;
  return "No defense booked yet";
}

function GateCard({ row, canAct, onOpen, onAct }) {
  const ready = row.state === "ready";
  return (
    <CaseCardShell ready={ready}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">{row.student.name}</p>
          <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
        </div>
        <span title={STATE_HELP[row.state]}><StatusChip status={STATE_LABEL[row.state]} size="sm" dot={false} /></span>
      </div>
      <CaseCardFacts
        facts={[
          row.adviser_name ? `Adviser: ${row.adviser_name}` : "No adviser yet",
          { text: row.research_title || "Title not submitted yet", wide: true },
          { text: defenseFact(row), wide: true },
          { text: row.missing.length ? `Missing: ${row.missing.join("; ")}` : "Nothing missing", wide: true },
        ]}
      />
      <PanelStamp verdict={row.verdict} />
      <RequirementBoxes items={row.requirements} ariaLabel={`Requirements of ${row.student.name} for ${row.stage}`} />
      <NextOwner owner={row.waiting_on || "No one, this stage is complete"} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpen(row.student)} className="flex-1" aria-label={`Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`}>View</Button>
        {canAct && row.can_record_verdict && <Button size="sm" icon={Gavel} onClick={() => onAct("record", row)} className="flex-1" aria-label={`Record the verdict for the panel for ${row.student.name}`}>Record for the panel</Button>}
        {canAct && row.can_confirm_revisions && <Button size="sm" icon={Gavel} onClick={() => onAct("confirm", row)} className="flex-1" aria-label={`Confirm the revisions for the panel for ${row.student.name}`}>Confirm revisions</Button>}
        {canAct && row.can_correct_verdict && <Button variant="secondary" size="sm" onClick={() => onAct("correct", row)} className="flex-1" aria-label={`Correct the verdict for the panel for ${row.student.name}`}>Correct verdict</Button>}
      </div>
    </CaseCardShell>
  );
}

export default function ResearchGateOverview({ onOpen, selectedId }) {
  const { user } = useAuth();
  const canAct = ["staff", "research_coordinator", "admin"].includes(user?.role);
  const { data, loading, error, refetch } = useApi(() => api.researchGateOverview(), []);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState("board");
  const [dialog, setDialog] = useState(null); // { mode, row }
  const boardNotice = useBoardNotice();
  const allRows = data?.items || [];
  const programs = useMemo(() => [...new Set(allRows.map((row) => row.student.program_code))].sort(), [allRows]);
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({ ...option, label: `${option.label} (${data?.counts?.[option.value] ?? 0})` })),
    [data],
  );
  const rows = useMemo(() => allRows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.research_title || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || row.state === filters.status);
  }), [allRows, filters]);

  const totalOf = (key) => allRows.filter((row) => String(row.column) === key).length;
  const shownOf = (key) => rows.filter((row) => String(row.column) === key).length;

  const tableColumns = [
    {
      key: "name",
      header: "Student",
      sortValue: (row) => row.student.name,
      cell: (row) => (
        <button
          type="button"
          onClick={() => onOpen(row.student)}
          aria-label={`Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`}
          className={`cursor-pointer text-left font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${row.student.id === selectedId ? "text-brand-800" : "text-ink"}`}
        >
          {row.student.name}
          <span className="meta block font-normal">{row.student.program_code} · {row.student.student_number}</span>
        </button>
      ),
    },
    { key: "stage", header: "Stage", hideBelow: "sm" },
    { key: "state", header: "Status", sortValue: (row) => STATE_LABEL[row.state], cell: (row) => <span title={STATE_HELP[row.state]}><StatusChip status={STATE_LABEL[row.state]} dot={false} /></span> },
    { key: "waiting_on", header: "Waiting on", hideBelow: "md", cell: (row) => row.waiting_on || "—" },
    { key: "reason", header: "Why", hideBelow: "md", cell: (row) => <span className="text-sm text-slate-700">{row.reason}</span> },
  ];

  function done(message) {
    setDialog(null);
    boardNotice.show("success", message);
    refetch();
  }

  const summary = COLUMNS.map((column) => `${totalOf(column.key)} in ${column.label}`).join(", ");

  return (
    <Card pad="lg" id="research-gate-overview" className="min-w-0 overflow-hidden">
      <SectionTitle
        title="Who is at the Research Gate"
        subtitle={canAct
          ? "Every active student with research records, in the column of the stage they are at. Graduate School staff and the Research Coordinator can record the panel's verdict from a card if the panel chair cannot."
          : "Every active student with research records, in the column of the stage they are at."}
        icon={ClipboardList}
      />
      {error && !data ? (
        <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>
      ) : (
        <div className="mt-3 space-y-3">
          {data && <p className="meta" data-testid="research-gate-summary">{allRows.length} students: {summary}.</p>}
          <BoardFilterRow toggle={<ViewToggle value={view} onChange={setView} />}>
            <LeaveFilters filters={filters} setFilters={setFilters} programs={programs} statusOptions={statusOptions} kindOptions={[]} count={rows.length} total={allRows.length} noun="students" />
          </BoardFilterRow>
          {view === "board" ? (
            <StageBoard
              ariaLabel="Research Gate board"
              phoneAriaLabel="Research Gate students by stage"
              columns={COLUMNS}
              items={loading && !data ? [] : rows}
              getItemId={(row) => row.student.id}
              getColumnKey={(row) => String(row.column)}
              renderCard={(row) => <GateCard key={row.student.id} row={row} canAct={canAct} onOpen={onOpen} onAct={(mode, target) => setDialog({ mode, row: target })} />}
              renderColumnHeader={(column) => <StageColumnHeader column={column} count={shownOf(column.key)} total={totalOf(column.key)} number={Number(column.key)} />}
              columnClassName=""
              columnBodyClassName="max-h-[26rem] overflow-y-auto overscroll-contain pr-1 max-sm:max-h-72"
              fitColumns
              emptyText="No students at this stage"
              readOnly
              boardNotice={boardNotice}
            />
          ) : (
            <>
              <BoardNotice notice={boardNotice.notice} onDismiss={boardNotice.dismiss} />
              <DataTable
                caption="Students at each Research Gate stage, with their status and what they are waiting for"
                columns={tableColumns}
                rows={rows}
                rowKey={(row) => row.student.id}
                minWidth="md"
                pageSize={10}
                loading={loading && !data}
                empty={{ icon: ClipboardList, title: "No students match", hint: "Change the filters above." }}
              />
            </>
          )}
        </div>
      )}
      {dialog && <RecordForPanelDialog mode={dialog.mode} row={dialog.row} onClose={() => setDialog(null)} onDone={done} />}
    </Card>
  );
}
