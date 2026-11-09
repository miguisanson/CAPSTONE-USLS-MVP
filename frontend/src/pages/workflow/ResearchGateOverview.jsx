import { useMemo, useState } from "react";
import { ClipboardList, Eye, FolderOpen, Gavel } from "lucide-react";
import { api } from "../../api";
import StageBoard, { BoardNotice, useBoardNotice } from "../../components/StageBoard";
import { useApi } from "../../hooks";
import { useAuth } from "../../auth";
import { Button, Card, DataTable, InlineNotice, Modal, SectionTitle, Select, SkeletonBoard, StatusChip } from "../../components/ui/index.js";
import LeaveFilters, { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { EMPTY_FILTERS } from "../leave/leaveHelpers";
import { CaseCardFacts, CaseCardShell, NextOwner, PanelStamp, StageColumnHeader } from "../../components/process";
import { formatClock, formatDate } from "../../lib/format";
import ListExportButtons from "../../components/ListExportButtons";
import RecordForPanelDialog from "./RecordForPanelDialog";

// The Research Gate as a board (I-205, I-362): three numbered columns, one card per student. A student sits in the column of the
// stage that student is at; the stage moves by itself when its requirements are complete, so the board is read-only (no dragging).
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

// Stakeholder UAT (D10): the table shows every milestone of a student at once. A stage before the student's current one is
// done (the next stage opens only after a passing verdict); the current one shows its status; later ones are not started.
function milestoneState(row, stageNumber) {
  const at = Number(row.column);
  if (stageNumber < at) return "Done";
  if (stageNumber > at) return "Not started";
  return STATE_LABEL[row.state] === "Done" ? "Done" : "In progress";
}
const MILESTONE_TONE = { Done: "Completed", "In progress": "In Progress", "Not started": "Not Started" };

function defenseFact(row) {
  const defense = row.next_defense;
  if (row.verdict) return `${defense?.defense_type || row.stage} verdict: ${row.verdict.label || row.verdict.result}`;
  if (defense) return `${defense.defense_type}: ${formatDate(defense.date)}${defense.start_time ? `, ${formatClock(defense.start_time)}` : ""}`;
  return "No defense booked yet";
}

// GOV.UK task-list words (F5-03): the requirements are met in order, so the first one still open is the one being worked on
// and the ones after it cannot start yet.
function requirementStatuses(row) {
  let open = 0;
  return row.requirements.map((item) => {
    if (item.met) return { label: item.label, status: "Completed", tone: "done", why: "" };
    open += 1;
    if (open > 1) return { label: item.label, status: "Cannot start yet", tone: "neutral", why: "Starts after the step before it is complete." };
    return row.state === "waiting"
      ? { label: item.label, status: "In progress", tone: "info", why: row.reason }
      : { label: item.label, status: "Not started", tone: "attention", why: row.reason };
  });
}

function progressLine(row) {
  const total = row.requirements.length;
  const done = row.requirements.filter((item) => item.met).length;
  const more = row.missing.length - 2;
  const todo = row.missing.slice(0, 2).join(", ") + (more > 0 ? ` +${more} more` : "");
  return `${done} of ${total} done · ${row.missing.length ? `Still to do: ${todo}` : "Nothing left"}`;
}

// The adviser is appointed after the title is approved (Ops Manual 4.12), so Title Defense says nothing about it.
const adviserFact = (row) => (row.adviser_name ? `Adviser: ${row.adviser_name}` : String(row.column) === "1" ? "" : "No adviser yet");

function GateCard({ row, canAct, onView, onAct }) {
  const ready = row.state === "ready";
  return (
    <CaseCardShell ready={ready}>
      <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1.5">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-ink">{row.student.name}</p>
          <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code} · {row.stage}</p>
        </div>
        <span title={STATE_HELP[row.state]}><StatusChip status={STATE_LABEL[row.state]} size="sm" dot={false} /></span>
      </div>
      {(row.state === "blocked" || row.state === "waiting") && row.reason && (
        <p className="mt-2 truncate text-xs font-medium text-slate-700" title={row.reason} data-testid="gate-reason">{row.reason}</p>
      )}
      <CaseCardFacts
        facts={[
          { text: adviserFact(row), wide: true },
          { text: progressLine(row), wide: true, testId: "gate-progress" },
        ].filter((fact) => fact.text)}
      />
      <PanelStamp verdict={row.verdict} />
      <NextOwner owner={row.waiting_on || "No one, this stage is complete"} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => onView(row)} className="flex-1" aria-label={`Open the Research Gate record of ${row.student.name}, ${row.student.student_number}`}>View</Button>
        {canAct && row.can_record_verdict && <Button size="sm" icon={Gavel} onClick={() => onAct("record", row)} className="flex-1" aria-label={`Record the verdict for the panel for ${row.student.name}`}>Record for the panel</Button>}
        {canAct && row.can_confirm_revisions && <Button size="sm" icon={Gavel} onClick={() => onAct("confirm", row)} className="flex-1" aria-label={`Confirm the revisions for the panel for ${row.student.name}`}>Confirm revisions</Button>}
        {canAct && row.can_correct_verdict && <Button variant="secondary" size="sm" onClick={() => onAct("correct", row)} className="flex-1" aria-label={`Correct the verdict for the panel for ${row.student.name}`}>Correct verdict</Button>}
      </div>
    </CaseCardShell>
  );
}

// The View window: what the card leaves out - the title, the defense and one line per requirement with its status.
function GateView({ row, onClose, onOpenRecord }) {
  return (
    <Modal
      title={`${row.student.name} · ${row.stage}`}
      subtitle={`${row.student.student_number} · ${row.student.program_code}`}
      icon={ClipboardList}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          <Button icon={FolderOpen} onClick={() => onOpenRecord(row.student)}>Open the full record</Button>
        </>
      }
    >
      <ul className="space-y-1 text-sm text-slate-700">
        {adviserFact(row) && <li>{adviserFact(row)}</li>}
        <li>{row.research_title || "Title not submitted yet"}</li>
        <li>{defenseFact(row)}</li>
        <li className="font-semibold">{progressLine(row)}</li>
      </ul>
      <PanelStamp verdict={row.verdict} />
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label={`Requirements of ${row.student.name} for ${row.stage}`}>
        {requirementStatuses(row).map((item) => (
          <li key={item.label} data-requirement-status={item.status} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.label}</p>
              {item.why && <p className="meta">{item.why}</p>}
            </div>
            <StatusChip status={item.status} tone={item.tone} size="sm" dot={false} />
          </li>
        ))}
      </ul>
    </Modal>
  );
}

export default function ResearchGateOverview({ onOpen, selectedId }) {
  const { user } = useAuth();
  const canAct = ["staff", "research_coordinator", "admin"].includes(user?.role);
  const { data, loading, error, refetch } = useApi(() => api.researchGateOverview(), []);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [view, setView] = useState("board");
  const [entry, setEntry] = useState(""); // a cohort: the students admitted in one academic year
  const [dialog, setDialog] = useState(null); // { mode, row }
  const [viewing, setViewing] = useState(null);
  const boardNotice = useBoardNotice();
  const allRows = data?.items || [];
  const programs = useMemo(() => [...new Set(allRows.map((row) => row.student.program_code))].sort(), [allRows]);
  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((option) => ({ ...option, label: `${option.label} (${data?.counts?.[option.value] ?? 0})` })),
    [data],
  );
  const entryOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.student.academic_year_entry).filter(Boolean))]
      .sort((a, b) => String(b).localeCompare(String(a)))
      .map((year) => ({ value: year, label: `Admitted AY ${year}` })),
    [allRows],
  );
  const rows = useMemo(() => allRows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.research_title || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || row.state === filters.status)
      && (!entry || row.student.academic_year_entry === entry);
  }), [allRows, filters, entry]);

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
    { key: "entry", header: "Year admitted", hideBelow: "sm", sortValue: (row) => row.student.academic_year_entry || "", cell: (row) => row.student.academic_year_entry || "—" },
    ...COLUMNS.map((column) => ({
      key: `milestone-${column.key}`,
      header: column.label,
      sortValue: (row) => ["Not started", "In progress", "Done"].indexOf(milestoneState(row, Number(column.key))),
      cell: (row) => {
        const state = milestoneState(row, Number(column.key));
        return <StatusChip status={MILESTONE_TONE[state]} label={state} dot={false} />;
      },
    })),
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
          ? "Every active student with research records, in the column of the stage each is at. Graduate School staff and the Research Coordinator can record the panel's verdict from a card if the panel chair cannot."
          : "Every active student with research records, in the column of the stage each one is at."}
        icon={ClipboardList}
      />
      {error && !data ? (
        <InlineNotice tone="danger" className="mt-3">{error}</InlineNotice>
      ) : (
        <div className="mt-3 space-y-3">
          {data && <p className="meta" data-testid="research-gate-summary">{allRows.length} students: {summary}.</p>}
          <BoardFilterRow toggle={<ViewToggle value={view} onChange={setView} />}>
            <LeaveFilters filters={filters} setFilters={setFilters} programs={programs} statusOptions={statusOptions} kindOptions={[]} count={rows.length} total={data ? allRows.length : null} noun="students" />
            <div className="w-full sm:w-56">
              <Select aria-label="Year admitted" placeholder="All years admitted" value={entry} options={entryOptions} onChange={(e) => setEntry(e.target.value)} />
            </div>
          </BoardFilterRow>
          <ListExportButtons
            title="Research Gate"
            subtitle={`${rows.length} of ${allRows.length} students`}
            filename="research-gate"
            columns={["Student ID", "Student name", "Program", "Stage", "Status", "Waiting on", "Why"]}
            rows={rows.map((row) => [row.student.student_number, row.student.name, row.student.program_code, row.stage || "", STATE_LABEL[row.state] || "", row.waiting_on || "", row.reason || ""])}
          />
          {view === "board" ? (
            loading && !data ? <SkeletonBoard columns={COLUMNS.length} label="Loading the Research Gate board" /> : <StageBoard
              ariaLabel="Research Gate board"
              phoneAriaLabel="Research Gate students by stage"
              columns={COLUMNS}
              items={rows}
              getItemId={(row) => row.student.id}
              getColumnKey={(row) => String(row.column)}
              renderCard={(row) => <GateCard key={row.student.id} row={row} canAct={canAct} onView={setViewing} onAct={(mode, target) => setDialog({ mode, row: target })} />}
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
                caption="Students at each Research Gate stage, with the status and what each is waiting for"
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
      {viewing && <GateView row={viewing} onClose={() => setViewing(null)} onOpenRecord={(student) => { setViewing(null); onOpen(student); }} />}
      {dialog && <RecordForPanelDialog mode={dialog.mode} row={dialog.row} onClose={() => setDialog(null)} onDone={done} />}
    </Card>
  );
}
