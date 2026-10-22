import { useEffect, useMemo, useState } from "react";
import {
  FileCheck,
  FileText,
  Users,
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
import { SectionTitle, StatusBadge, ErrorNote } from "../../components/ui";
import { Field, Input, Textarea, Select } from "../../components/forms";
import WorkflowTimeline, { graduationTimelineSteps } from "../../components/WorkflowTimeline";
import ExportFollowUpModal from "../../components/ExportFollowUpModal";
import StageBoard from "../../components/StageBoard";
import { formatDate } from "../../lib/format";
import { GraduationBatchModal } from "./GraduationBatchModal";
import { GraduationBatchStageCheck, GraduationCompletedCourseworkView, GraduationPracticumCompletionView, GraduationRequirementBoxes, GraduationResearchRequirementsView, graduationBatchActionLabel, graduationBatchCurrentStage, graduationBatchGroups, graduationRowStatus, graduationStageActionForRow, graduationStageSelection, sortSelectedWorkflowRows } from "./graduationShared";
import { CaseMessageHistory, DemoResetButton, DemoResetFeedback, Detail, MiniBox, RosterFilters, SubmitButton, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, WorkflowSubmitFeedback, uniqueValues, useDemoCaseReset } from "./shared";

function graduationBatchSelectionState(group, selectedIds) {
  const selectedCount = group.rows.filter((row) => selectedIds.has(row.student.id)).length;
  return {
    selectedCount,
    allSelected: selectedCount > 0 && selectedCount === group.rows.length,
    partiallySelected: selectedCount > 0 && selectedCount < group.rows.length,
  };
}

function GraduationBatchStageModal({ group, onClose }) {
  const currentStage = graduationBatchCurrentStage(group);
  const modalId = `graduation-stage-${String(group.id).replace(/[^a-zA-Z0-9_-]+/g, "-")}`;
  return (
    <WorkflowCaseModal
      id={modalId}
      title={`Graduation stage check for ${group.label}`}
      subtitle={`${group.rows.length} candidate${group.rows.length === 1 ? "" : "s"} · Step ${currentStage.number}: ${currentStage.label}`}
      onClose={onClose}
      size="wide"
    >
      <GraduationBatchStageCheck group={group} />
    </WorkflowCaseModal>
  );
}

function graduationRequirementTone(item) {
  if (item?.passed === true || item?.complete === true || item?.status === "Passed") return "complete";
  return "missing";
}

function graduationRequirementClasses(tone) {
  return tone === "complete"
    ? {
      card: "border-emerald-200 bg-emerald-50 text-emerald-900",
      icon: "bg-emerald-600 text-white",
      text: "text-emerald-800",
      muted: "text-emerald-700",
    }
    : {
      card: "border-red-200 bg-red-50 text-red-900",
      icon: "bg-red-600 text-white",
      text: "text-red-800",
      muted: "text-red-700",
    };
}

function graduationRequirementDetailLines(item) {
  const actual = item.actual_value ?? item.actual ?? item.status ?? "Pending";
  const required = item.required_value ?? item.required;
  return [
    String(actual),
    required != null ? `Required: ${String(required)}` : "",
    item.note || "",
  ].filter(Boolean);
}

function graduationFallbackChecklist(row) {
  const eligibility = row.eligibility || {};
  return [
    {
      key: "coursework",
      label: "Coursework",
      actual_value: eligibility.coursework_status || "Pending",
      status: eligibility.coursework_status === "Complete" ? "Passed" : eligibility.coursework_status || "Not met",
      passed: eligibility.coursework_status === "Complete",
      note: eligibility.missing_coursework?.length ? `Missing: ${eligibility.missing_coursework.slice(0, 2).join(", ")}${eligibility.missing_coursework.length > 2 ? "..." : ""}` : "",
    },
    {
      key: "research",
      label: "Thesis / research",
      actual_value: eligibility.research_status || "Pending",
      status: eligibility.research_status === "Complete" ? "Passed" : eligibility.research_status || "Not met",
      passed: eligibility.research_status === "Complete",
      note: eligibility.missing_research_requirements?.length ? `Missing: ${eligibility.missing_research_requirements.slice(0, 2).join(", ")}${eligibility.missing_research_requirements.length > 2 ? "..." : ""}` : "",
    },
    {
      key: "practicum",
      label: "Practicum",
      actual_value: eligibility.practicum_status || "Pending",
      status: ["Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"].includes(eligibility.practicum_status) ? "Passed" : eligibility.practicum_status || "Not met",
      passed: ["Not Required", "Completed", "Report Sent to Dean", "Dean Reviewed"].includes(eligibility.practicum_status),
      note: eligibility.missing_practicum_requirement || "",
    },
  ];
}

const GRADUATION_BOARD_COLUMNS = [
  {
    label: "3 · Graduation Batch Created",
    description: "Application-submitted candidates are now grouped and ready for GS Staff to forward for coursework review.",
    statuses: ["For Review"],
    empty: "No newly created batches are waiting for GS Staff routing.",
  },
  {
    label: "4 · Academic Coordinator Coursework Review",
    description: "The Academic Coordinator verifies completed curriculum requirements for each candidate in the batch.",
    statuses: ["Coursework Review"],
    empty: "No batches are waiting for coursework review.",
  },
  {
    label: "5 · Research and Practicum Validation",
    description: "The Research Coordinator validates research, defense, completion evidence, and required practicum completion.",
    statuses: ["Research Review"],
    empty: "No batches are waiting for research and practicum validation.",
  },
  {
    label: "6 · Endorsement Preparation or Revision",
    description: "Validated batches return to GS Staff for endorsement preparation or Dean-requested revision.",
    statuses: ["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision"],
    empty: "No batches are waiting for endorsement preparation or revision.",
  },
  {
    label: "7 · Dean Review",
    description: "Prepared endorsement batches await the Dean's approval or return decision.",
    statuses: ["Ready for Dean Review"],
    empty: "No batches are waiting for Dean review.",
  },
  {
    label: "8 · Dean Approved and Ready for Export",
    description: "Only approved and currently eligible candidates are available for CSV export and manual Registrar email.",
    statuses: ["Dean Approved"],
    empty: "No Dean-approved graduation batches are ready for export.",
  },
  {
    label: "Exception Queue",
    description: "Candidates whose revalidation found missing requirements remain visible for correction and student notification.",
    statuses: ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete", "Not Eligible", "Returned for Clarification"],
    empty: "No graduation exceptions currently require correction.",
  },
];

function graduationReadyForDeanReview(group) {
  return group.boardStatus === "Ready for Dean Review";
}

function GraduationBatchStudentList({ rows, onOpenStudent, onMessageStudent, detailMode = "", compact = false }) {
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
        const readyToDrag = Boolean(row.has_submitted_documents);
        return (
          <li
            key={row.student.id}
            className={`rounded-lg px-3 py-2 ring-1 ${readyToDrag ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}
          >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
              <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
            </div>
            <span className="flex flex-wrap items-center gap-1.5"><StatusBadge value={graduationRowStatus(row)} dot={false} />{!row.has_submitted_documents && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}</span>
          </div>
          <GraduationRequirementBoxes row={row} />
          {row.messages?.length > 0 && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-800"><MessageSquare className="mr-1 inline h-3.5 w-3.5" /> {row.messages.length} discussion message{row.messages.length === 1 ? "" : "s"}</p>}
          {(onOpenStudent || onMessageStudent) && (
            <div className="mt-2 flex flex-wrap gap-2">
              {onOpenStudent && <button type="button" onClick={() => onOpenStudent(row.student.id)} className="btn-ghost cursor-pointer px-2 py-1 text-xs"><Eye className="h-3.5 w-3.5" /> View</button>}
              {showCourseworkAction && (
                <button
                  type="button"
                  onClick={() => toggleDetail(row.student.id, "coursework")}
                  className="btn-ghost cursor-pointer px-2 py-1 text-xs transition-colors"
                  aria-expanded={courseworkOpen}
                  aria-controls={courseworkPanelId}
                >
                  <BookOpenCheck className="h-3.5 w-3.5" />
                  {courseworkOpen ? "Hide coursework completed" : "View coursework completed"}
                </button>
              )}
              {showResearchPracticumActions && (
                <>
                  <button
                    type="button"
                    onClick={() => toggleDetail(row.student.id, "research")}
                    className="btn-ghost cursor-pointer px-2 py-1 text-xs transition-colors"
                    aria-expanded={researchOpen}
                    aria-controls={researchPanelId}
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    {researchOpen ? "Hide research completion details" : "View research completion details"}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDetail(row.student.id, "practicum")}
                    className="btn-ghost cursor-pointer px-2 py-1 text-xs transition-colors"
                    aria-expanded={practicumOpen}
                    aria-controls={practicumPanelId}
                  >
                    <Briefcase className="h-3.5 w-3.5" />
                    {practicumOpen ? "Hide practicum completion details" : "View practicum completion details"}
                  </button>
                </>
              )}
              {row.endorsement && onMessageStudent && <button type="button" onClick={() => onMessageStudent(row)} className="btn cursor-pointer border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700 hover:border-red-300 hover:bg-red-100"><MessageSquare className="h-3.5 w-3.5" /> Message / Return</button>}
            </div>
          )}
          {showCourseworkAction && courseworkOpen && <GraduationCompletedCourseworkView id={courseworkPanelId} row={row} />}
          {showResearchPracticumActions && researchOpen && <GraduationResearchRequirementsView id={researchPanelId} row={row} />}
          {showResearchPracticumActions && practicumOpen && <GraduationPracticumCompletionView id={practicumPanelId} row={row} />}
        </li>
        );
      })}
    </ul>
  );
}

function GraduationBatchRow({
  group,
  accountRole,
  selectedIds = new Set(),
  expanded = false,
  selectedTone = false,
  onToggleBatch,
  onToggleExpanded,
  onSelectBatch,
  onProcessBatch,
  onOpenStudent,
  onMessageStudent,
  onViewStage,
  onExportBatch,
  exporting = false,
}) {
  const selectionState = graduationBatchSelectionState(group, selectedIds);
  const stageSelection = graduationStageSelection(group.rows, accountRole);
  const actionLabel = graduationBatchActionLabel(stageSelection.action);
  const visibleRows = expanded ? group.rows : [];
  const hiddenCount = group.rows.length - Math.min(group.rows.length, 4);
  const selectionLabel = selectionState.partiallySelected ? `${selectionState.selectedCount}/${group.rows.length} selected` : selectionState.allSelected ? "Batch selected" : "Select batch";
  const currentStage = graduationBatchCurrentStage(group);
  const names = group.rows.map((row) => row.student.name).slice(0, 4).join(", ");
  const canExpandStudents = Boolean(onToggleExpanded && onOpenStudent && onMessageStudent);
  const applicationComplete = group.rows.length > 0 && group.rows.every((row) => row.has_submitted_documents);
  const readyForDean = graduationReadyForDeanReview(group);
  const readyToDrag = applicationComplete || readyForDean;
  const canExport = accountRole === "dean" && group.boardStatus === "Dean Approved" && Boolean(onExportBatch);
  const alreadyExported = group.rows.every((row) => row.endorsement?.registrar_status === "Exported - Ready to Send");
  const messageCount = group.rows.reduce((total, row) => total + (row.messages?.length || 0), 0);
  return (
    <article
      className={`rounded-xl border px-3 py-1.5 transition-colors ${readyToDrag ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : selectedTone ? "border-brand-200 bg-brand-50/50" : "border-slate-200 bg-white"}`}
    >
      <div className="space-y-3">
        <div className="min-w-0">
          <div className="flex min-w-0 items-start gap-2">
            {onToggleBatch && (
              <input
                type="checkbox"
                checked={selectionState.allSelected}
                aria-checked={selectionState.partiallySelected ? "mixed" : selectionState.allSelected}
                onChange={() => onToggleBatch(group)}
                className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                aria-label={`Select ${group.label}`}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{group.label}</p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                <span>{group.rows.length} candidate{group.rows.length === 1 ? "" : "s"}</span>
                <span>·</span>
                <span>{selectionLabel}</span>
                <StatusBadge value={group.boardStatus} dot={false} />
                {readyForDean && <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span>}
                {!applicationComplete && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Application document issue</span>}
                {messageCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800"><MessageSquare className="mr-1 inline h-3 w-3" />{messageCount} message{messageCount === 1 ? "" : "s"}</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 border-t border-slate-200/70 pt-2 text-xs text-slate-600">
          <p className="truncate"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
          <p className="mt-0.5 truncate"><span className="font-semibold text-slate-700">Next:</span> {group.nextOwners.join(", ")}</p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
          <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
          <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>
        </div>
        <div className="flex min-w-0 flex-wrap justify-start gap-1.5 border-t border-slate-200/70 pt-2">
          {canExpandStudents && <button type="button" onClick={() => onToggleExpanded(group.id)} className="btn-ghost cursor-pointer px-2.5 py-1"><Users className="h-4 w-4" /> {expanded ? "Hide students" : "View students"}</button>}
          {onSelectBatch && <button type="button" onClick={() => onSelectBatch(group)} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>}
          {canExport ? (
            <button type="button" disabled={exporting} onClick={() => onExportBatch(group)} className="btn min-w-0 cursor-pointer whitespace-normal bg-emerald-600 px-2.5 py-1 text-left text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4 shrink-0" /> {exporting ? "Exporting…" : alreadyExported ? "Export approved list again" : "Export approved list"}</button>
          ) : (
            <button type="button" disabled={!stageSelection.action} onClick={() => onProcessBatch(group)} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4 shrink-0" /> {actionLabel}</button>
          )}
        </div>
      </div>
      {canExpandStudents && expanded && (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <GraduationBatchStudentList
            rows={visibleRows}
            onOpenStudent={onOpenStudent}
            onMessageStudent={onMessageStudent}
            detailMode={
              accountRole === "academic_coordinator" && group.boardStatus === "Coursework Review"
                ? "coursework"
                : group.boardStatus === "Research Review"
                  ? "research-practicum"
                  : [
                    "Eligibility Confirmed",
                    "Endorsement Prepared",
                    "Returned for Revision",
                    "Ready for Dean Review",
                    "Dean Approved",
                  ].includes(group.boardStatus)
                    ? "all-completion"
                    : ""
            }
            compact
          />
        </div>
      )}
    </article>
  );
}

// The Graduation staged board. The two candidate stages and the eight batch columns are
// one StageBoard, so a card can be dragged (or moved with its "Move to..." menu). A move
// never changes data here: it opens the same confirmation dialog the card buttons open,
// which posts to the guarded endpoint, and the server checks every rule again.
const GRADUATION_STAGE_COLUMNS = [
  {
    key: "stage-1",
    kind: "stage",
    stageNumber: 1,
    selectable: false,
    label: "1 · Academically Eligible — Awaiting Student Application",
    title: "Academically Eligible — Awaiting Student Application",
    description: "These students completed all required academic, research, and practicum stages. They are visible to staff, but cannot be selected for a graduation batch until they submit the signed application / review-window PDF in the student portal.",
    empty: "No academically eligible students are currently waiting for a graduation application.",
  },
  {
    key: "stage-2",
    kind: "stage",
    stageNumber: 2,
    selectable: true,
    label: "2 · Application Submitted — Ready for Batch Creation",
    title: "Application Submitted — Ready for Batch Creation",
    description: "The required student application / review-window PDF is on file. GS Staff may select individual students, all visible students, a program, or a completed-course cohort before creating the batch. Other staff accounts see this stage as read-only.",
    empty: "No submitted graduation applications are waiting for batch creation.",
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
  if (group.boardStatus === "Dean Approved") return accountRole === "dean" ? "Use Export on the batch card." : "Waiting for: Dean (export)";
  const owners = (group.nextOwners || []).filter(Boolean);
  return owners.length ? `Waiting for: ${owners.join(", ")}` : "No step is open right now";
}

function graduationBoardCheckMove(item, toColumn, accountRole) {
  if (item.kind === "student") {
    if (item.stage === "stage-1") return { allowed: false, reason: "Waiting for the student to submit the signed graduation application in the student portal." };
    if (toColumn.kind === "batch" && toColumn.statuses.includes("For Review")) {
      return accountRole === "staff" ? { allowed: true } : { allowed: false, reason: "Only Graduate School Staff create a graduation batch." };
    }
    return { allowed: false, reason: "A submitted application moves to 'Graduation Batch Created' when staff create the batch." };
  }
  const group = item.group;
  const selection = graduationStageSelection(group.rows, accountRole);
  if (!selection.action) {
    if (group.boardStatus === "Dean Approved") return { allowed: false, reason: "Export is a button on the batch card." };
    return { allowed: false, reason: `No step is due on this batch for your role; waiting for: ${group.nextOwners.join(", ")}.` };
  }
  const actionLabel = graduationBatchActionLabel(selection.action);
  const destinationStatus = GRADUATION_STEP_DESTINATION_STATUS[selection.action.id];
  const destination = destinationStatus ? GRADUATION_ALL_BOARD_COLUMNS.find((column) => column.kind === "batch" && column.statuses.includes(destinationStatus)) : null;
  if (!destination) return { allowed: false, reason: `This step does not move the batch to another column. Use the button on the card: ${actionLabel}.` };
  if (toColumn.key === destination.key) return { allowed: true };
  return { allowed: false, reason: `Move this batch one step at a time, to '${destination.label}': ${actionLabel}.` };
}

function GraduationBoardColumnHeader({ column, items, accountRole, selectedIds, onSelectAll, onClearSelection, onCreateBatch }) {
  if (column.kind === "batch") {
    return (
      <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-800">{column.label}</h3>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-500">{column.description}</p>
        </div>
        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-500 ring-1 ring-slate-200">{items.length}</span>
      </header>
    );
  }
  const rows = items.map((item) => item.row);
  const canCreateBatch = column.selectable && accountRole === "staff";
  const selectedCount = rows.filter((row) => selectedIds.has(row.student.id)).length;
  const titleId = `graduation-candidate-stage-${column.stageNumber}`;
  return (
    <div className="mb-4 space-y-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${column.selectable ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"}`}>{column.stageNumber}</span>
        <div>
          <p id={titleId} className="font-display text-lg font-semibold text-ink">{column.title}</p>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-slate-600">{column.description}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={`${rows.length} student${rows.length === 1 ? "" : "s"}`} dot={false} />
        {canCreateBatch && rows.length > 0 && <button type="button" onClick={onSelectAll} className="btn-ghost cursor-pointer px-3 py-2">Select all visible</button>}
        {canCreateBatch && selectedCount > 0 && <button type="button" onClick={onClearSelection} className="btn-ghost cursor-pointer px-3 py-2">Clear selection</button>}
        {canCreateBatch && <button type="button" disabled={!selectedCount} onClick={onCreateBatch} className="btn-primary cursor-pointer px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4" /> Create graduation batch</button>}
      </div>
    </div>
  );
}

function GraduationStudentCard({ row, selectable, canSelect, selected, onToggleStudent, onOpenStudent }) {
  const completedCourses = row.eligibility?.completed_courses || [];
  const applicationFile = row.endorsement?.request_attachment;
  return (
    <div className={`rounded-xl border p-3 ${selectable ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50/60"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          {canSelect && <input type="checkbox" checked={selected} onChange={() => onToggleStudent(row.student.id)} className="mt-1 h-4 w-4 cursor-pointer rounded border-slate-300 text-brand-600 focus:ring-brand-500" aria-label={`Select ${row.student.name} for batch creation`} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{row.student.name}</p>
            <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
          </div>
        </div>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusBadge value={row.application_status} dot={false} />
          {row.has_submitted_documents && applicationFile?.file_exists !== false && applicationFile?.url && (
            <a
              href={applicationFile.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[11px] font-bold text-white transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2"
              aria-label={`View submitted graduation application PDF for ${row.student.name}`}
            >
              <FileText className="h-3.5 w-3.5" /> View PDF <ArrowUpRight className="h-3 w-3" />
            </a>
          )}
          {row.has_submitted_documents && applicationFile?.file_exists === false && (
            <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">PDF unavailable</span>
          )}
        </span>
      </div>
      <GraduationRequirementBoxes row={row} />
      {completedCourses.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold text-slate-700">Completed-course cohort:</span>{" "}
          {completedCourses.slice(0, 4).map((course) => course.code).join(", ")}
          {completedCourses.length > 4 ? ` +${completedCourses.length - 4} more` : ""}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={() => onOpenStudent(row.student.id)} className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs"><Eye className="h-3.5 w-3.5" /> View student</button>
      </div>
    </div>
  );
}

function GraduationBatchOverviewSection({ groups, accountRole, onSelectBatch, onProcessBatch, onViewStage }) {
  if (!groups.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-ink">Created graduation batches</p>
          <p className="text-xs text-slate-500">Track each batch after GS Staff compiles the candidate list, with every student still visible inside.</p>
        </div>
        <StatusBadge value={`${groups.length} batch${groups.length === 1 ? "" : "es"}`} dot={false} />
      </div>
      <div className="space-y-2">
        {groups.map((group) => {
          const stageSelection = graduationStageSelection(group.rows, accountRole);
          const actionLabel = graduationBatchActionLabel(stageSelection.action);
          const currentStage = graduationBatchCurrentStage(group);
          const names = group.rows.map((row) => row.student.name).slice(0, 4).join(", ");
          const hiddenCount = group.rows.length - Math.min(group.rows.length, 4);
          const readyForDean = graduationReadyForDeanReview(group);
          const readyToDrag = group.rows.every((row) => row.has_submitted_documents) || readyForDean;
          return (
            <div
              key={group.id}
              className={`rounded-xl border px-3 py-2 ${readyToDrag ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50/60"}`}
            >
              <div className="grid gap-1.5 lg:grid-cols-[minmax(230px,1.1fr)_minmax(240px,1.1fr)_minmax(210px,0.95fr)_minmax(230px,0.95fr)] lg:items-center">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{group.label}</p>
                  <p className="text-xs text-slate-500">{group.rows.length} candidate{group.rows.length === 1 ? "" : "s"} · Updated {formatDate(group.updatedAt)}</p>
                  {readyForDean && <span className="mt-1 inline-flex rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span>}
                  {!readyToDrag && <span className="mt-1 inline-flex rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">Waiting for documents</span>}
                </div>
                <div className="min-w-0 text-xs text-slate-600">
                  <p className="truncate"><span className="font-semibold text-slate-700">Students:</span> {names}{hiddenCount > 0 ? ` +${hiddenCount} more` : ""}</p>
                  <p className="mt-0.5 truncate"><span className="font-semibold text-slate-700">Next:</span> {group.nextOwners.join(", ")}</p>
                </div>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <p className="truncate text-xs font-semibold text-slate-700">{currentStage.label}</p>
                  <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
                  <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>
                </div>
                <div className="flex min-w-0 flex-wrap justify-start gap-1.5 lg:justify-end">
                  <button type="button" onClick={() => onSelectBatch(group)} className="btn-ghost cursor-pointer px-2.5 py-1">Select batch</button>
                  <button type="button" disabled={!stageSelection.action} onClick={() => onProcessBatch(group)} className="btn-primary min-w-0 cursor-pointer whitespace-normal px-2.5 py-1 text-left disabled:cursor-not-allowed disabled:opacity-50"><CheckSquare className="h-4 w-4 shrink-0" /> {actionLabel}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function GraduationRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [batchOpen, setBatchOpen] = useState(false);
  const [expandedBatchIds, setExpandedBatchIds] = useState(() => new Set());
  const [stageGroup, setStageGroup] = useState(null);
  const [exportingBatchId, setExportingBatchId] = useState("");
  const [exportError, setExportError] = useState("");
  const [exportNotice, setExportNotice] = useState(null);
  const reset = useDemoCaseReset("graduation", refetch);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", course: "", secondary: "", dateFrom: "", dateTo: "", sort: "newest" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map(graduationRowStatus)), [rows]);
  const completedCourses = useMemo(() => {
    const coursesByCode = new Map();
    rows.forEach((row) => {
      (row.eligibility?.completed_courses || []).forEach((course) => {
        if (course.code && !coursesByCode.has(course.code)) coursesByCode.set(course.code, course);
      });
    });
    return [...coursesByCode.values()].sort((left, right) => left.code.localeCompare(right.code));
  }, [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const courseText = (row.eligibility?.completed_courses || []).map((course) => `${course.code} ${course.title}`).join(" ");
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.student.program_name} ${row.endorsement?.batch_name || ""} ${courseText}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || graduationRowStatus(row) === filters.status)
      && (!filters.course || (row.eligibility?.completed_courses || []).some((course) => course.code === filters.course));
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
  function toggleReadyStudent(studentId) {
    const readyIds = new Set(readyForBatchRows.map((row) => row.student.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => readyIds.has(id)));
      if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
      return next;
    });
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
      const canSelect = item.stage === "stage-2" && accountRole === "staff";
      return (
        <GraduationStudentCard
          row={item.row}
          selectable={item.stage === "stage-2"}
          canSelect={canSelect}
          selected={selectedIds.has(item.row.student.id)}
          onToggleStudent={toggleReadyStudent}
          onOpenStudent={openCase}
        />
      );
    }
    return (
      <GraduationBatchRow
        group={item.group}
        accountRole={accountRole}
        selectedIds={selectedIds}
        expanded={expandedBatchIds.has(item.group.id)}
        onToggleBatch={["staff", "academic_coordinator", "research_coordinator"].includes(accountRole) ? toggleBatchGroup : null}
        onToggleExpanded={toggleExpandedBatch}
        onProcessBatch={processBatchGroup}
        onOpenStudent={openCase}
        onMessageStudent={setMessageRow}
        onViewStage={setStageGroup}
        onExportBatch={accountRole === "dean" ? exportApprovedBatch : null}
        exporting={exportingBatchId === item.group.id}
      />
    );
  }
  function toggleExpandedBatch(groupId) {
    setExpandedBatchIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId);
      return next;
    });
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

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Graduation endorsement candidates" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · AC checks coursework, Research validates evidence, Staff prepares, and the Dean owns the endorsement export`} icon={GraduationCap} />
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      {exportError && <div role="alert"><ErrorNote message={exportError} /></div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} count={filteredRows.length} total={rows.length} showAdvanced={false} />
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <label className="block max-w-xl">
          <span className="field-label">Completed course cohort</span>
          <select
            value={filters.course}
            onChange={(event) => setFilters((current) => ({ ...current, course: event.target.value }))}
            className="field-input"
          >
            <option value="">All completed courses</option>
            {completedCourses.map((course) => <option key={course.code} value={course.code}>{course.code} — {course.title}</option>)}
          </select>
        </label>
        <p className="mt-2 text-xs text-slate-500">GS Staff can filter by program or completed course, choose “Select all visible” in Step 2, and create a cohort-specific graduation batch.</p>
      </div>
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
        columnClassName="min-h-[520px] w-[380px]"
        renderColumnHeader={(column, columnItems) => (
          <GraduationBoardColumnHeader
            column={column}
            items={columnItems}
            accountRole={accountRole}
            selectedIds={selectedIds}
            onSelectAll={() => setSelectedIds(new Set(readyForBatchRows.map((row) => row.student.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onCreateBatch={createPreBatch}
          />
        )}
      />
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
              {selectedEndorsement && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn cursor-pointer border border-red-200 bg-red-50 px-4 py-2 text-red-700 hover:border-red-300 hover:bg-red-100"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedStageAction ? (
                <button type="button" disabled={submitting || refreshing} onClick={() => { setSelectedIds(new Set([selectedRow.student.id])); setBatchOpen(true); }} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedStageAction.label}
                </button>
              ) : selectedEndorsement?.endorsement_status === "Dean Approved" ? (
                <span className="self-center rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Awaiting Dean export</span>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">No {WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.</span>
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
                  <p className="truncate text-xs text-brand-700">{selectedEndorsement.request_attachment.name}</p>
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
      {stageGroup && <GraduationBatchStageModal group={stageGroup} onClose={() => setStageGroup(null)} />}
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

// ---------------------------------------------------------------------------
// Graduation Endorsement
// ---------------------------------------------------------------------------
function GraduationForm({ context, studentId, submit, submitting }) {
  const eligibility = context.graduation_eligibility || {};
  const current = context.graduation_endorsement;
  const reviewWindows = context.graduation_review_windows || [];
  const activeReviewWindow = context.graduation_default_review_window || reviewWindows[0] || "";
  const defaultReviewWindow = activeReviewWindow || current?.review_window || "";
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    review_window: defaultReviewWindow,
    endorsement_status: "For Review",
    dean_remarks: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      review_window: defaultReviewWindow,
      endorsement_status: current?.endorsement_status || (eligibility.eligible ? "Ready for Dean Review" : "For Review"),
      dean_remarks: current?.dean_remarks || "",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at, eligibility.eligible, defaultReviewWindow]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => ({ type: "Coursework", item })),
    ...(eligibility.missing_research_requirements || []).map((item) => ({ type: "Research", item })),
    ...(eligibility.missing_practicum_requirement ? [{ type: "Practicum", item: eligibility.missing_practicum_requirement }] : []),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review graduation endorsement" subtitle="Monitor endorsement readiness before the external graduation process" icon={GraduationCap} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MiniBox label="Coursework" value={eligibility.coursework_status || "Pending"} tone={eligibility.coursework_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Research" value={eligibility.research_status || "Pending"} tone={eligibility.research_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Practicum" value={eligibility.practicum_status || "Not Required"} tone={eligibility.practicum_status === "Not Required" || eligibility.practicum_status === "Dean Reviewed" ? "brand" : "amber"} />
        <MiniBox label="Eligible" value={eligibility.eligible ? "Yes" : "No"} tone={eligibility.eligible ? "brand" : "red"} />
      </div>
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Missing requirements</p>
          <ul className="space-y-1.5">
            {missing.slice(0, 10).map((row, index) => (
              <li key={`${row.type}-${index}`} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><span className="font-semibold">{row.type}:</span> {row.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Graduation school year" required>
          <Select value={form.review_window} onChange={set("review_window")} options={reviewWindowOptions} placeholder="" required />
        </Field>
        <Field label="Endorsement status">
          <Select
            value={form.endorsement_status}
            onChange={set("endorsement_status")}
            placeholder=""
            options={["For Review", "Ready for Dean Review", "Not Eligible", "Returned for Revision"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Dean remarks">
        <Textarea value={form.dean_remarks} onChange={set("dean_remarks")} />
      </Field>
      {!eligibility.eligible && form.endorsement_status === "Ready for Dean Review" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This candidate still has missing requirements. Saving will keep the backend status as Not Eligible and queue the listed owner.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save endorsement review</SubmitButton>
    </form>
  );
}
