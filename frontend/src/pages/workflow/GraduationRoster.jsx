import { useMemo, useState } from "react";
import {
  FileCheck,
  FileText,
  Briefcase,
  GraduationCap,
  ArrowUpRight,
  Eye,
  Download,
  MessageSquare,
  CheckSquare,
  BookOpenCheck,
} from "lucide-react";
import { api } from "../../api";
import { formatDate } from "../../lib/format";
import { InlineNotice, SectionTitle } from "../../components/ui/index.js";
import { Button, DataTable, EmptyState, StatusChip } from "../../components/ui/index.js";
import WorkflowTimeline, { graduationTimelineSteps } from "../../components/WorkflowTimeline";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import StageBoard, { BoardSummary, boardSummaryLine } from "../../components/StageBoard";
import { BoardFilterRow, ViewToggle } from "../leave/LeaveFilters";
import { GraduationBatchModal } from "./GraduationBatchModal";
import { GraduationBatchStageCheck, GraduationCompletedCourseworkView, GraduationPracticumCompletionView, GraduationRequirementBoxes, GraduationResearchRequirementsView, graduationBatchActionLabel, graduationBatchCurrentStage, graduationBatchGroups, graduationRowStatus, graduationStageActionForRow, graduationStageSelection, sortSelectedWorkflowRows } from "./graduationShared";
import { CaseMessageHistory, DemoResetButton, DemoResetFeedback, Detail, RosterFilters, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, WorkflowSubmitFeedback, uniqueValues, useDemoCaseReset } from "./shared";

function graduationBatchSelectionState(group, selectedIds) {
  const selectedCount = group.rows.filter((row) => selectedIds.has(row.student.id)).length;
  return {
    selectedCount,
    allSelected: selectedCount > 0 && selectedCount === group.rows.length,
    partiallySelected: selectedCount > 0 && selectedCount < group.rows.length,
  };
}

// Which completion details a role may open for each student of a batch.
function graduationBatchDetailMode(group, accountRole) {
  if (accountRole === "academic_coordinator" && group.boardStatus === "Coursework Review") return "coursework";
  if (group.boardStatus === "Research Review") return "research-practicum";
  if (["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision", "Ready for Dean Review", "Dean Approved"].includes(group.boardStatus)) return "all-completion";
  return "";
}

// The students of one batch, with the buttons that open a student's case, the discussion, and the completion details.
function GraduationBatchStudentList({ rows, onOpenStudent, onMessageStudent, detailMode = "" }) {
  const [expandedDetailKeys, setExpandedDetailKeys] = useState(() => new Set());
  const showCourseworkAction = ["coursework", "all-completion"].includes(detailMode);
  const showResearchPracticumActions = ["research-practicum", "all-completion"].includes(detailMode);
  function toggleDetail(studentId, detail) {
    const key = `${studentId}:${detail}`;
    setExpandedDetailKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => {
        const courseworkOpen = expandedDetailKeys.has(`${row.student.id}:coursework`);
        const researchOpen = expandedDetailKeys.has(`${row.student.id}:research`);
        const practicumOpen = expandedDetailKeys.has(`${row.student.id}:practicum`);
        const courseworkPanelId = `graduation-card-coursework-${row.student.id}`;
        const researchPanelId = `graduation-card-research-${row.student.id}`;
        const practicumPanelId = `graduation-card-practicum-${row.student.id}`;
        return (
          <li key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
                <p className="meta">{row.student.student_number} · {row.student.program_code}</p>
              </div>
              <span className="flex flex-wrap items-center gap-1.5">
                <StatusChip status={graduationRowStatus(row)} dot={false} />
                {!row.has_submitted_documents && <StatusChip label="Waiting for documents" tone="neutral" size="sm" dot={false} />}
              </span>
            </div>
            <GraduationRequirementBoxes row={row} />
            {row.messages?.length > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800"><MessageSquare className="mr-1 inline h-3.5 w-3.5" /> {row.messages.length} discussion message{row.messages.length === 1 ? "" : "s"}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={Eye} onClick={() => onOpenStudent(row.student.id)}>View</Button>
              {showCourseworkAction && (
                <Button variant="secondary" size="sm" icon={BookOpenCheck} onClick={() => toggleDetail(row.student.id, "coursework")} aria-expanded={courseworkOpen} aria-controls={courseworkPanelId}>
                  {courseworkOpen ? "Hide coursework completed" : "View coursework completed"}
                </Button>
              )}
              {showResearchPracticumActions && (
                <>
                  <Button variant="secondary" size="sm" icon={FileCheck} onClick={() => toggleDetail(row.student.id, "research")} aria-expanded={researchOpen} aria-controls={researchPanelId}>
                    {researchOpen ? "Hide research completion details" : "View research completion details"}
                  </Button>
                  <Button variant="secondary" size="sm" icon={Briefcase} onClick={() => toggleDetail(row.student.id, "practicum")} aria-expanded={practicumOpen} aria-controls={practicumPanelId}>
                    {practicumOpen ? "Hide practicum completion details" : "View practicum completion details"}
                  </Button>
                </>
              )}
              {row.endorsement && <Button variant="danger" size="sm" icon={MessageSquare} onClick={() => onMessageStudent(row)}>Message / Return</Button>}
            </div>
            {showCourseworkAction && courseworkOpen && <GraduationCompletedCourseworkView id={courseworkPanelId} row={row} />}
            {showResearchPracticumActions && researchOpen && <GraduationResearchRequirementsView id={researchPanelId} row={row} />}
            {showResearchPracticumActions && practicumOpen && <GraduationPracticumCompletionView id={practicumPanelId} row={row} />}
          </li>
        );
      })}
    </ul>
  );
}

// "View details" on a batch card: the stage check and, below it, every student of the batch.
// The batch's step (and the Dean's Export) are buttons in this window, not on the card, like the process boards.
function GraduationBatchDetailsModal({ group, accountRole, onClose, onOpenStudent, onMessageStudent, onProcessBatch, onExportBatch, exporting = false }) {
  const currentStage = graduationBatchCurrentStage(group);
  const modalId = `graduation-stage-${String(group.id).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  const stageSelection = graduationStageSelection(group.rows, accountRole);
  const canExport = accountRole === "dean" && group.boardStatus === "Dean Approved" && Boolean(onExportBatch);
  const alreadyExported = group.rows.every((row) => row.endorsement?.registrar_status === "Exported - Ready to Send");
  return (
    <WorkflowCaseModal
      id={modalId}
      title={`Graduation stage check for ${group.label}`}
      subtitle={`${group.rows.length} candidate${group.rows.length === 1 ? "" : "s"} · Step ${currentStage.number}: ${currentStage.label}`}
      onClose={onClose}
      size="wide"
      footer={canExport ? (
        <Button icon={Download} loading={exporting} onClick={() => onExportBatch(group)}>
          {exporting ? "Exporting…" : alreadyExported ? "Export approved list again" : "Export approved list"}
        </Button>
      ) : stageSelection.action ? (
        <Button icon={CheckSquare} onClick={() => onProcessBatch(group)}>{graduationBatchActionLabel(stageSelection.action)}</Button>
      ) : (
        <span className="meta self-center font-semibold">No {WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.</span>
      )}
    >
      <div className="space-y-5">
        <GraduationBatchStageCheck group={group} />
        <div>
          <h3 className="section-title">Students in this batch</h3>
          <div className="mt-3">
            <GraduationBatchStudentList
              rows={group.rows}
              onOpenStudent={onOpenStudent}
              onMessageStudent={onMessageStudent}
              detailMode={graduationBatchDetailMode(group, accountRole)}
            />
          </div>
        </div>
      </div>
    </WorkflowCaseModal>
  );
}

// The Graduation staged board, the same shape as the process boards (Leave of Absence...): stage name, a count and one
// short line in each column header, default column width. Two candidate stages come first, then one column per batch step.
const GRADUATION_STAGE_COLUMNS = [
  {
    key: "stage-1",
    kind: "stage",
    selectable: false,
    label: "Academically eligible",
    description: "Waiting for the student's signed application.",
  },
  {
    key: "stage-2",
    kind: "stage",
    selectable: true,
    label: "Application submitted",
    description: "Staff can now create a graduation batch.",
  },
];

const GRADUATION_BOARD_COLUMNS = [
  {
    label: "Batch created",
    description: "Staff forward it for coursework review.",
    statuses: ["For Review"],
  },
  {
    label: "Coursework review",
    description: "The Academic Coordinator checks coursework.",
    statuses: ["Coursework Review"],
  },
  {
    label: "Research and practicum check",
    description: "The Research Coordinator checks the evidence.",
    statuses: ["Research Review"],
  },
  {
    label: "Endorsement prep or revision",
    description: "Staff prepare the list or revise it.",
    statuses: ["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision"],
  },
  {
    label: "Dean review",
    description: "The Dean approves or returns the list.",
    statuses: ["Ready for Dean Review"],
  },
  {
    label: "Approved, ready to export",
    description: "The Dean exports the approved list.",
    statuses: ["Dean Approved"],
  },
  {
    label: "Exceptions",
    description: "Missing requirements to correct.",
    statuses: ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete", "Not Eligible", "Returned for Clarification"],
  },
];

const GRADUATION_ALL_BOARD_COLUMNS = [
  ...GRADUATION_STAGE_COLUMNS,
  ...GRADUATION_BOARD_COLUMNS.map((column, index) => ({ ...column, key: `batch-${index + 3}`, kind: "batch" })),
];

// The batch status each step leads to, so a drop is only allowed on the column the step really moves to.
// Steps that keep the batch in the same column (prepare endorsement, mark not eligible) are left out.
const GRADUATION_STEP_DESTINATION_STATUS = {
  compile_to_ac: "Coursework Review",
  check_coursework: "Research Review",
  validate_research: "Eligibility Confirmed",
  send_to_dean: "Ready for Dean Review",
  approve: "Dean Approved",
};

function graduationReadyForDeanReview(group) {
  return group.boardStatus === "Ready for Dean Review";
}

function graduationBoardItemId(item) {
  return item.kind === "student" ? `student:${item.row.student.id}` : `batch:${item.group.id}`;
}

function graduationBoardColumnKey(item) {
  if (item.kind === "student") return item.stage;
  return GRADUATION_ALL_BOARD_COLUMNS.find((column) => column.kind === "batch" && column.statuses.includes(item.group.boardStatus))?.key || "";
}

function graduationBoardCanDrag(item, accountRole) {
  if (item.kind === "student") return item.stage === "stage-2" && accountRole === "staff";
  const selection = graduationStageSelection(item.group.rows, accountRole);
  return Boolean(selection.action) || (graduationReadyForDeanReview(item.group) && accountRole === "dean");
}

// The short reason a graduation card sits still (StageBoard's lockReason), same wording as the process boards.
function graduationBoardLockReason(item, accountRole) {
  if (item.kind === "student") {
    if (item.stage === "stage-1") return "Waiting for: Student (signed application)";
    return "Only Graduate School Staff create a graduation batch.";
  }
  const group = item.group;
  if (group.boardStatus === "Dean Approved") return accountRole === "dean" ? "Open View details to export the list." : "Waiting for: Dean (export)";
  const owners = (group.nextOwners || []).filter(Boolean);
  return owners.length ? `Waiting for: ${owners.join(", ")}` : "No step is open right now";
}

function graduationBoardCheckMove(item, toColumn, accountRole) {
  if (item.kind === "student") {
    if (item.stage === "stage-1") return { allowed: false, reason: "Waiting for the student to submit the signed graduation application in the student portal." };
    if (toColumn.kind === "batch" && toColumn.statuses.includes("For Review")) {
      return accountRole === "staff" ? { allowed: true } : { allowed: false, reason: "Only Graduate School Staff create a graduation batch." };
    }
    return { allowed: false, reason: "A submitted application moves to 'Batch created' when staff create the batch." };
  }
  const group = item.group;
  const selection = graduationStageSelection(group.rows, accountRole);
  if (!selection.action) {
    if (group.boardStatus === "Dean Approved") return { allowed: false, reason: "Export is a button in the batch View details window." };
    return { allowed: false, reason: `No step is due on this batch for your role; waiting for: ${group.nextOwners.join(", ")}.` };
  }
  const actionLabel = graduationBatchActionLabel(selection.action);
  const destinationStatus = GRADUATION_STEP_DESTINATION_STATUS[selection.action.id];
  const destination = destinationStatus ? GRADUATION_ALL_BOARD_COLUMNS.find((column) => column.kind === "batch" && column.statuses.includes(destinationStatus)) : null;
  if (!destination) return { allowed: false, reason: `This step does not move the batch to another column. Open View details to: ${actionLabel}.` };
  if (toColumn.key === destination.key) return { allowed: true };
  return { allowed: false, reason: `Move this batch one step at a time, to '${destination.label}': ${actionLabel}.` };
}

// One card, the same skeleton as the process boards' CaseCard: name, number line, 1-2 detail lines, "Next:", one status chip.
function GraduationCard({ selected = false, checkbox = null, title, subtitle, lines = [], next, chip, notes = null, children }) {
  return (
    <article className={`rounded-xl border bg-white p-3 shadow-sm transition-colors ${selected ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200 hover:border-slate-300"}`}>
      <div className="flex items-start gap-2.5">
        {checkbox}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          <p className="truncate text-xs text-slate-500">{subtitle}</p>
        </div>
      </div>
      {lines.map((line, index) => (
        <p key={index} className={index === 0 ? "mt-2.5 text-xs font-medium text-slate-700" : "mt-0.5 text-xs text-slate-500"}>{line}</p>
      ))}
      <p className="mt-2.5 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {next}</p>
      <div className="mt-2">{chip}</div>
      {notes}
      {children}
    </article>
  );
}

function GraduationNote({ icon: Icon = MessageSquare, children }) {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs font-medium text-amber-800">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

// The one button on a card, the same as the process boards' card: "View details", full width.
function ViewDetailsButton({ onClick, label }) {
  return (
    <Button variant="secondary" size="sm" icon={Eye} onClick={onClick} className="mt-3 w-full" aria-label={`View details for ${label}`}>
      View details
    </Button>
  );
}

function GraduationStudentCard({ row, stage, canSelect, selected, onToggleStudent, onOpenStudent }) {
  const applicationFile = row.endorsement?.request_attachment;
  const awaiting = stage === "stage-1";
  const lines = [awaiting ? "Requirements met. Signed application not in yet." : "Signed application is on file."];
  return (
    <GraduationCard
      selected={selected}
      checkbox={canSelect && (
        <input type="checkbox" checked={selected} onChange={() => onToggleStudent(row.student.id)} className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${row.student.name} for batch creation`} />
      )}
      title={row.student.name}
      subtitle={`${row.student.student_number} · ${row.student.program_code}`}
      lines={lines}
      next={row.next_action_owner || (awaiting ? "Student" : "Graduate School Staff")}
      chip={<StatusChip status={row.application_status} dot={false} />}
      notes={(
        <>
          {row.has_submitted_documents && applicationFile?.file_exists !== false && applicationFile?.url && (
            <a
              href={applicationFile.url}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label={`View submitted graduation application PDF for ${row.student.name}`}
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> View PDF <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            </a>
          )}
          {row.has_submitted_documents && applicationFile?.file_exists === false && <p className="mt-2 text-xs font-semibold text-red-700">PDF unavailable</p>}
          {row.messages?.length > 0 && <GraduationNote>{row.messages.length} discussion message{row.messages.length === 1 ? "" : "s"}</GraduationNote>}
        </>
      )}
    >
      <ViewDetailsButton onClick={() => onOpenStudent(row.student.id)} label={row.student.name} />
    </GraduationCard>
  );
}

function GraduationBatchCard({ group, selectedIds, onToggleBatch, onViewBatch }) {
  const selectionState = graduationBatchSelectionState(group, selectedIds);
  const currentStage = graduationBatchCurrentStage(group);
  const names = group.rows.map((row) => row.student.name).slice(0, 3).join(", ");
  const hiddenCount = group.rows.length - Math.min(group.rows.length, 3);
  const applicationComplete = group.rows.length > 0 && group.rows.every((row) => row.has_submitted_documents);
  const alreadyExported = group.rows.every((row) => row.endorsement?.registrar_status === "Exported - Ready to Send");
  const messageCount = group.rows.reduce((total, row) => total + (row.messages?.length || 0), 0);
  const programs = uniqueValues(group.rows.map((row) => row.student.program_code)).join(", ");
  return (
    <GraduationCard
      selected={selectionState.selectedCount > 0}
      checkbox={onToggleBatch && (
        <input
          type="checkbox"
          checked={selectionState.allSelected}
          aria-checked={selectionState.partiallySelected ? "mixed" : selectionState.allSelected}
          onChange={() => onToggleBatch(group)}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          aria-label={`Select ${group.label}`}
        />
      )}
      title={group.label}
      subtitle={`${group.rows.length} candidate${group.rows.length === 1 ? "" : "s"}${programs ? ` · ${programs}` : ""}`}
      lines={[`Students: ${names}${hiddenCount > 0 ? ` +${hiddenCount} more` : ""}`, `Step ${currentStage.number}: ${currentStage.label}`]}
      next={group.nextOwners.join(", ")}
      chip={<StatusChip status={group.boardStatus === "Dean Approved" && alreadyExported ? "Exported - Ready to Send" : group.boardStatus} dot={false} />}
      notes={(
        <>
          {!applicationComplete && <GraduationNote icon={FileText}>Some application documents are missing.</GraduationNote>}
          {messageCount > 0 && <GraduationNote>{messageCount} discussion message{messageCount === 1 ? "" : "s"}</GraduationNote>}
        </>
      )}
    >
      <ViewDetailsButton onClick={() => onViewBatch(group)} label={group.label} />
    </GraduationCard>
  );
}

// Appears when candidates are ticked, like the process boards' group-step bar.
function GraduationSelectionBar({ count, onCreateBatch, stepLabel, onStep, note, onClear }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50/60 p-3" role="group" aria-label="Apply a step to the selected candidates">
      <span className="mr-auto text-sm font-semibold text-ink" aria-live="polite">{count} candidate{count === 1 ? "" : "s"} selected</span>
      {note && <span className="meta">{note}</span>}
      {onCreateBatch && <Button icon={CheckSquare} onClick={onCreateBatch}>Create graduation batch</Button>}
      {onStep && <Button icon={CheckSquare} onClick={onStep}>{stepLabel}</Button>}
      <Button variant="secondary" onClick={onClear}>Clear selection</Button>
    </div>
  );
}

export function GraduationRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [view, setView] = useState("board");
  const [stageGroupId, setStageGroupId] = useState(null);
  const [exportingBatchId, setExportingBatchId] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState(null);
  const reset = useDemoCaseReset("graduation", refetch);
  const rows = context.roster || [];
  const canTickBatches = ["staff", "academic_coordinator", "research_coordinator"].includes(accountRole); // the Dean uses the step buttons
  // `secondary` is the completed-course filter (one more control in the shared toolbar).
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "", sort: "newest" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map(graduationRowStatus)), [rows]);
  const completedCourseOptions = useMemo(() => {
    const coursesByCode = new Map();
    rows.forEach((row) => {
      (row.eligibility?.completed_courses || []).forEach((course) => {
        if (course.code && !coursesByCode.has(course.code)) coursesByCode.set(course.code, course);
      });
    });
    return [...coursesByCode.values()]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((course) => ({ value: course.code, label: `${course.code} — ${course.title}` }));
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const courseText = (row.eligibility?.completed_courses || []).map((course) => `${course.code} ${course.title}`).join(" ");
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.student.program_name} ${row.endorsement?.batch_name || ""} ${courseText}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || graduationRowStatus(row) === filters.status)
      && (!filters.secondary || (row.eligibility?.completed_courses || []).some((course) => course.code === filters.secondary));
  }).sort((left, right) => left.student.name.localeCompare(right.student.name)), [rows, filters]);
  const visibleRows = useMemo(
    () => sortSelectedWorkflowRows(filteredRows, selectedIds, (row) => row.student.name, (row) => row.student.id),
    [filteredRows, selectedIds],
  );
  const awaitingApplicationRows = useMemo(
    () => visibleRows.filter((row) => row.eligibility?.eligible && !row.endorsement?.batch_name && !row.has_submitted_documents),
    [visibleRows],
  );
  const readyForBatchRows = useMemo(
    () => visibleRows.filter((row) => row.eligibility?.eligible && !row.endorsement?.batch_name && row.has_submitted_documents),
    [visibleRows],
  );
  const visibleBatchedRows = useMemo(
    () => visibleRows.filter((row) => Boolean(row.endorsement?.batch_name)),
    [visibleRows],
  );
  const selectedRows = useMemo(
    () => sortSelectedWorkflowRows(rows.filter((row) => selectedIds.has(row.student.id)), selectedIds, (row) => row.student.name, (row) => row.student.id),
    [rows, selectedIds],
  );
  const visibleBatchGroups = useMemo(
    () => graduationBatchGroups(visibleBatchedRows, selectedIds),
    [visibleBatchedRows, selectedIds],
  );
  const boardItems = useMemo(
    () => [
      ...awaitingApplicationRows.map((row) => ({ kind: "student", stage: "stage-1", row })),
      ...readyForBatchRows.map((row) => ({ kind: "student", stage: "stage-2", row })),
      ...visibleBatchGroups.map((group) => ({ kind: "batch", group })),
    ],
    [awaitingApplicationRows, readyForBatchRows, visibleBatchGroups],
  );
  // The line above the filters: how many cards sit in each column, over every candidate (the filters narrow the board only).
  const summaryLine = useMemo(() => {
    const totals = {};
    const bump = (key) => { if (key) totals[key] = (totals[key] || 0) + 1; };
    rows.forEach((row) => {
      if (row.eligibility?.eligible && !row.endorsement?.batch_name) bump(row.has_submitted_documents ? "stage-2" : "stage-1");
    });
    graduationBatchGroups(rows.filter((row) => Boolean(row.endorsement?.batch_name))).forEach((group) => bump(graduationBoardColumnKey({ kind: "batch", group })));
    return boardSummaryLine(GRADUATION_ALL_BOARD_COLUMNS, totals, "candidates");
  }, [rows]);
  // The table lists the same students as the board, one row each, with the batch under the stage.
  const columnLabelByKey = useMemo(() => Object.fromEntries(GRADUATION_ALL_BOARD_COLUMNS.map((column) => [column.key, column.label])), []);
  const tableRows = useMemo(
    () => [
      ...awaitingApplicationRows.map((row) => ({ row, stage: "stage-1", batch: "", status: row.application_status })),
      ...readyForBatchRows.map((row) => ({ row, stage: "stage-2", batch: "", status: row.application_status })),
      ...visibleBatchGroups.flatMap((group) => group.rows.map((row) => ({
        row,
        stage: graduationBoardColumnKey({ kind: "batch", group }),
        batch: group.label,
        status: graduationRowStatus(row),
      }))),
    ].map((item) => ({
      ...item,
      id: item.row.student.id,
      stageLabel: columnLabelByKey[item.stage] || "",
      waitingOn: item.row.next_action_owner || (item.stage === "stage-2" ? "Graduate School Staff" : "Student"),
      updatedAt: item.row.last_activity_at || item.row.endorsement?.updated_at || "",
    })),
    [awaitingApplicationRows, readyForBatchRows, visibleBatchGroups, columnLabelByKey],
  );

  // What the ticked candidates can do: students with a signed application create a batch; students already in a batch
  // share one step when the signed-in role has the same step due for all of them.
  const readyIds = useMemo(() => new Set(readyForBatchRows.map((row) => row.student.id)), [readyForBatchRows]);
  const tickedReady = readyForBatchRows.filter((row) => selectedIds.has(row.student.id));
  const tickedBatched = visibleBatchedRows.filter((row) => selectedIds.has(row.student.id));
  const tickedStep = tickedBatched.length ? graduationStageSelection(tickedBatched, accountRole) : null;

  function toggleInGroup(studentId, groupIds) {
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => groupIds.has(id)));
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
  }
  function toggleReadyStudent(studentId) {
    toggleInGroup(studentId, readyIds);
  }
  function toggleBatchedStudent(studentId) {
    toggleInGroup(studentId, new Set(visibleBatchedRows.map((row) => row.student.id)));
  }
  function createPreBatch() {
    const candidateIds = readyForBatchRows.filter((row) => selectedIds.has(row.student.id)).map((row) => row.student.id);
    if (!candidateIds.length) return;
    setSelectedIds(new Set(candidateIds));
    setBatchOpen(true);
  }
  function toggleBatchGroup(group) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const allSelected = group.rows.every((row) => next.has(row.student.id));
      group.rows.forEach((row) => {
        if (allSelected) next.delete(row.student.id); else next.add(row.student.id);
      });
      return next;
    });
  }
  function processBatchGroup(group) {
    setSelectedIds(new Set(group.rows.map((row) => row.student.id)));
    setBatchOpen(true);
  }
  function processTickedStep() {
    if (!tickedStep?.action) return;
    setSelectedIds(new Set(tickedStep.processableRows.map((row) => row.student.id)));
    setBatchOpen(true);
  }
  // A drop (or the "Move to..." menu) only opens the same confirmation dialog the card buttons open.
  // The dialog posts to the guarded endpoint and the server checks every rule again.
  function moveGraduationBoardItem(item) {
    if (item.kind === "student") {
      if (selectedIds.has(item.row.student.id)) createPreBatch();
      else {
        setSelectedIds(new Set([item.row.student.id]));
        setBatchOpen(true);
      }
    } else {
      processBatchGroup(item.group);
    }
    return { message: "Confirm the step in the dialog to finish moving it." };
  }
  function renderGraduationBoardCard(item) {
    if (item.kind === "student") {
      return (
        <GraduationStudentCard
          row={item.row}
          stage={item.stage}
          canSelect={item.stage === "stage-2" && accountRole === "staff"}
          selected={selectedIds.has(item.row.student.id)}
          onToggleStudent={toggleReadyStudent}
          onOpenStudent={openCase}
        />
      );
    }
    return (
      <GraduationBatchCard
        group={item.group}
        selectedIds={selectedIds}
        onToggleBatch={canTickBatches ? toggleBatchGroup : null}
        onViewBatch={(group) => setStageGroupId(group.id)}
      />
    );
  }
  function renderColumnFooter(column, columnItems) {
    if (column.key !== "stage-2" || accountRole !== "staff" || !columnItems.length) return null;
    const allOn = columnItems.every((item) => selectedIds.has(item.row.student.id));
    return (
      <button
        type="button"
        onClick={() => setSelectedIds(allOn ? new Set() : new Set(readyForBatchRows.map((row) => row.student.id)))}
        className="mt-3 cursor-pointer rounded-lg px-2 py-1.5 text-xs font-semibold text-brand-700 transition-colors duration-200 hover:bg-brand-50 focus:outline-none focus:ring-2 focus:ring-brand-500 max-sm:min-h-11"
      >
        {allOn ? "Clear selection in this column" : "Select all in this column"}
      </button>
    );
  }
  async function exportApprovedBatch(group) {
    setExportingBatchId(group.id);
    setExportError("");
    try {
      const endorsementIds = group.rows.map((row) => row.endorsement?.id).filter(Boolean);
      const exportResult = await api.exportGraduationCsv("", endorsementIds);
      setExportNotice({ filename: exportResult.filename, batchLabel: group.label });
      setMessageNotice(`${group.label} exported as ${exportResult.filename}. The Dean must email the file to the Registrar and wait for acknowledgement.`);
      await refetch();
    } catch (error) {
      setExportError(error.message || "Could not export the Dean-approved graduation list.");
    } finally {
      setExportingBatchId("");
    }
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedStageAction = selectedRow ? graduationStageActionForRow(selectedRow, accountRole) : null;
  const selectedEndorsement = selectedRow?.endorsement || null;
  const graduationSteps = selectedRow ? graduationTimelineSteps(selectedEndorsement?.endorsement_status, selectedRow.eligibility) : [];
  const stageGroup = stageGroupId ? visibleBatchGroups.find((group) => group.id === stageGroupId) || graduationBatchGroups(rows.filter((row) => row.endorsement?.batch_name === stageGroupId))[0] || null : null;

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }

  const tableColumns = [
    {
      key: "select",
      header: <span className="sr-only">Select</span>,
      width: "2.5rem",
      cell: ({ row, stage }) => {
        const selectable = stage === "stage-2" ? accountRole === "staff" : canTickBatches && Boolean(row.endorsement?.batch_name) && Boolean(graduationStageActionForRow(row, accountRole));
        if (!selectable) return <span aria-hidden="true" />;
        return (
          <input
            type="checkbox"
            checked={selectedIds.has(row.student.id)}
            onChange={() => (stage === "stage-2" ? toggleReadyStudent(row.student.id) : toggleBatchedStudent(row.student.id))}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            aria-label={stage === "stage-2" ? `Select ${row.student.name} for batch creation` : `Select ${row.student.name} for a group step`}
          />
        );
      },
    },
    {
      key: "student",
      header: "Student",
      sortable: true,
      sortValue: ({ row }) => row.student.name,
      cell: ({ row }) => (
        <>
          <p className="font-semibold text-ink">{row.student.name}</p>
          <p className="meta whitespace-nowrap">{row.student.student_number}</p>
        </>
      ),
    },
    { key: "program", header: "Program", sortable: true, sortValue: ({ row }) => row.student.program_code, cell: ({ row }) => row.student.program_code },
    {
      key: "stage",
      header: "Stage",
      sortable: true,
      sortValue: (item) => GRADUATION_ALL_BOARD_COLUMNS.findIndex((column) => column.key === item.stage),
      cell: (item) => (
        <>
          <p className="font-medium text-slate-700">{item.stageLabel}</p>
          {item.batch && <p className="meta">{item.batch}</p>}
        </>
      ),
    },
    { key: "status", header: "Status", sortable: true, sortValue: (item) => item.status, cell: (item) => <StatusChip status={item.status} dot={false} /> },
    { key: "waitingOn", header: "Waiting on", sortable: true, sortValue: (item) => item.waitingOn, cell: (item) => item.waitingOn },
    {
      key: "updated",
      header: "Updated",
      sortable: true,
      sortValue: (item) => (item.updatedAt ? new Date(item.updatedAt) : null),
      hideBelow: "sm",
      cell: (item) => (item.updatedAt ? formatDate(item.updatedAt) : "—"),
    },
    {
      key: "open",
      header: <span className="sr-only">Open</span>,
      cell: ({ row }) => (
        <Button variant="secondary" size="sm" icon={Eye} onClick={() => openCase(row.student.id)} aria-label={`View details for ${row.student.name}`}>View</Button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle title="Graduation endorsement candidates" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · AC checks coursework, Research validates evidence, Staff prepares, and the Dean owns the endorsement export`} icon={GraduationCap} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      {exportError && <InlineNotice tone="danger">{exportError}</InlineNotice>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <BoardSummary line={summaryLine} windowName="details window" />
      <BoardFilterRow toggle={<ViewToggle value={view} onChange={setView} />}>
        <RosterFilters
          filters={filters}
          setFilters={setFilters}
          programs={programs}
          statuses={statuses}
          secondaryLabel="completed courses"
          secondaryOptions={completedCourseOptions}
          count={filteredRows.length}
          total={rows.length}
          showAdvanced={false}
        />
      </BoardFilterRow>
      {selectedIds.size > 0 && (tickedReady.length > 0 || tickedBatched.length > 0) && (
        <GraduationSelectionBar
          count={tickedReady.length + tickedBatched.length}
          onCreateBatch={tickedReady.length > 0 && accountRole === "staff" ? createPreBatch : null}
          stepLabel={tickedStep?.action ? graduationBatchActionLabel(tickedStep.action) : ""}
          onStep={tickedStep?.action && tickedReady.length === 0 ? processTickedStep : null}
          note={tickedBatched.length > 0 && !tickedStep?.action ? "These candidates do not share a step that is due to you." : ""}
          onClear={() => setSelectedIds(new Set())}
        />
      )}
      {view === "board" ? (
        <StageBoard
          ariaLabel="Graduation workflow Kanban board"
          columns={GRADUATION_ALL_BOARD_COLUMNS}
          items={boardItems}
          getItemId={graduationBoardItemId}
          getColumnKey={graduationBoardColumnKey}
          renderCard={renderGraduationBoardCard}
          canDrag={(item) => graduationBoardCanDrag(item, accountRole)}
          lockReason={(item) => graduationBoardLockReason(item, accountRole)}
          showMoveMenu={(item) => !(item.kind === "student" && item.stage === "stage-1")}
          checkMove={(item, toColumn) => graduationBoardCheckMove(item, toColumn, accountRole)}
          onMove={moveGraduationBoardItem}
          renderColumnFooter={renderColumnFooter}
          emptyText="No candidates here"
        />
      ) : tableRows.length ? (
        <DataTable
          caption="Graduation candidates, one row per student"
          columns={tableColumns}
          rows={tableRows}
          rowKey={(item) => item.id}
          minWidth="lg"
        />
      ) : (
        <EmptyState title="No candidates match these filters" hint="Clear a filter to see more." />
      )}
      {stageGroup && (
        <GraduationBatchDetailsModal
          group={stageGroup}
          accountRole={accountRole}
          onClose={() => setStageGroupId(null)}
          onOpenStudent={openCase}
          onMessageStudent={setMessageRow}
          onProcessBatch={(group) => { setStageGroupId(null); processBatchGroup(group); }}
          onExportBatch={accountRole === "dean" ? (group) => { setStageGroupId(null); exportApprovedBatch(group); } : null}
          exporting={exportingBatchId === stageGroup.id}
        />
      )}
      {selectedRow && (
        <WorkflowCaseModal
          id={`graduation-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Graduation endorsement`}
          status={selectedEndorsement?.endorsement_status || selectedRow.eligibility.status}
          onClose={() => setSelectedStudentId(null)}
          size="wide"
          footer={(
            <>
              {accountRole === "staff" && selectedEndorsement && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedEndorsement && <Button variant="danger" icon={MessageSquare} onClick={() => setMessageRow(selectedRow)}>Message / Return</Button>}
              {selectedStageAction ? (
                <Button disabled={submitting || refreshing} onClick={() => { setSelectedIds(new Set([selectedRow.student.id])); setBatchOpen(true); }}>
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedStageAction.label}
                </Button>
              ) : selectedEndorsement?.endorsement_status === "Dean Approved" ? (
                <StatusChip status="Approved" label="Awaiting Dean export" dot={false} className="self-center" />
              ) : (
                <span className="meta self-center font-semibold">No {WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <div className="grid gap-3 sm:grid-cols-2"><Detail label="Program" value={selectedRow.student.program_name} /><Detail label="Batch" value={selectedEndorsement?.batch_name || "No batch assigned"} /></div>
            {selectedEndorsement?.request_attachment?.file_exists !== false && selectedEndorsement?.request_attachment?.url && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-900">Student graduation application PDF</p>
                  <p className="meta truncate text-brand-700">{selectedEndorsement.request_attachment.name}</p>
                </div>
                <a href={selectedEndorsement.request_attachment.url} target="_blank" rel="noreferrer" className="btn-primary cursor-pointer px-3 py-2">
                  <Eye className="h-4 w-4" /> View submitted PDF <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            )}
            {selectedEndorsement?.request_attachment?.file_exists === false && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">The submitted graduation application PDF is unavailable.</div>
            )}
            <GraduationRequirementBoxes row={selectedRow} />
            <WorkflowTimeline steps={graduationSteps} title="Graduation endorsement timeline" />
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
            <WorkflowFileHistory files={selectedEndorsement?.attachments || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="graduation" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {batchOpen && selectedRows.length > 0 && <GraduationBatchModal rows={selectedRows} accountRole={accountRole} reviewWindows={context.graduation_review_windows || []} defaultReviewWindow={context.graduation_default_review_window || ""} onClose={() => setBatchOpen(false)} onSaved={async (batchResult) => { setMessageNotice(batchResult.message); setSelectedIds(new Set()); await refetch(); }} />}
      {exportNotice && (
        <ExportFollowUpModal
          id="graduation-export-follow-up"
          title="Graduation CSV export complete"
          filename={exportNotice.filename}
          actorLabel="The Dean"
          fileLabel="endorsed graduation list"
          onClose={() => setExportNotice(null)}
        />
      )}
    </div>
  );
}
