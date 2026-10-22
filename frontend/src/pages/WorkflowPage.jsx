import { useEffect, useMemo, useState } from "react";
import {
  FileCheck,
  FileText,
  Users,
  Briefcase,
  GraduationCap,
  CheckCircle2,
  Info,
  ArrowUpRight,
  Eye,
  Download,
  MessageSquare,
  CheckSquare,
  BookOpenCheck,
} from "lucide-react";
import { api } from "../api";
import { SectionTitle, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { Field, Input, Textarea, Select } from "../components/forms";
import WorkflowTimeline, { graduationTimelineSteps } from "../components/WorkflowTimeline";
import HistoryDisclosure from "../components/HistoryDisclosure";
import ExportFollowUpModal from "../components/ExportFollowUpModal";
import StageBoard from "../components/StageBoard";
import { ViewToggle } from "./leave/LeaveFilters";
import { formatDate } from "../lib/format";
import { CaseMessageHistory, DemoResetButton, DemoResetFeedback, Detail, MiniBox, RosterFilters, SubmitButton, WORKFLOW_ROLE_LABELS, WorkflowActivityList, WorkflowCaseModal, WorkflowFileHistory, WorkflowMessageModal, WorkflowSubmitFeedback, uniqueValues, useDemoCaseReset } from "./workflow/shared";

const GRADUATION_BATCH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function WorkflowTransitionModal({ slug, student, action, busy, onClose, onConfirm }) {
  const [comment, setComment] = useState(action.reason || "");
  const [error, setError] = useState("");
  const requiresReason = Boolean(action.requireReason);
  const requiresComment = requiresReason || Boolean(action.requireComment);
  const showsTransitionComment = requiresComment || ["practicum", "withdrawal", "graduation"].includes(slug);

  async function confirm(event) {
    event.preventDefault();
    const cleanComment = comment.trim();
    if (requiresComment && !cleanComment) {
      setError(action.commentRequiredError || (requiresReason ? "Enter the exact reason before moving this request." : "Enter the required follow-through details before moving this request."));
      return;
    }
    setError("");
    const payload = {
      ...action.payload,
      ...(cleanComment ? { workflow_comment: cleanComment } : {}),
      ...(requiresReason ? {
        return_reason: cleanComment,
        staff_remarks: cleanComment,
      } : {}),
    };
    const saved = await onConfirm(payload);
    if (saved) onClose();
  }

  return (
    <WorkflowCaseModal
      id={`${slug}-confirm-transition-${student.id}`}
      title={`Confirm: ${action.label}`}
      subtitle={`${student.name} · ${student.student_number} · ${slug}`}
      onClose={onClose}
      size={["practicum", "graduation"].includes(slug) ? "wide" : "default"}
      footer={<button type="submit" form={`${slug}-confirm-transition-form`} disabled={busy} className={action.destructive ? "btn-ghost cursor-pointer px-4 py-2 text-red-600" : "btn-primary cursor-pointer px-4 py-2"}>{busy ? "Saving…" : action.label}</button>}
    >
      <form id={`${slug}-confirm-transition-form`} onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow movement</p>
          <p className="mt-2 text-sm font-semibold text-ink">{action.fromStatus || "Current stage"} <span className="mx-1 text-slate-300">→</span> {action.toStatus || action.label}</p>
          <p className="mt-1 text-xs text-slate-500">This action is recorded against your signed-in account and preserves the submitted fields and files.</p>
        </div>
        {showsTransitionComment && (
          <Field label={action.commentLabel || (requiresReason ? "Message / reason" : "Comment sent with this action")} required={requiresComment}>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              required={requiresComment}
              placeholder={action.commentPlaceholder || (requiresReason ? "Tell the student what to correct or upload next." : "Add instructions or context for the next reviewer. Leave blank if there is nothing to add.")}
            />
          </Field>
        )}
      </form>
    </WorkflowCaseModal>
  );
}

function defaultGraduationBatchForm(rows = []) {
  const existingName = rows.find((row) => row.endorsement?.batch_name)?.endorsement?.batch_name || "";
  const match = existingName.match(/^Batch(?:\s+No\.)?\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    return { batch_no: match[1], batch_month: match[2], batch_year: match[3] };
  }
  const now = new Date();
  return {
    batch_no: "1",
    batch_month: GRADUATION_BATCH_MONTHS[now.getMonth()],
    batch_year: String(now.getFullYear()),
  };
}

function graduationBatchName(form) {
  return `Batch ${form.batch_no || "1"} ${form.batch_month || GRADUATION_BATCH_MONTHS[new Date().getMonth()]} ${form.batch_year || new Date().getFullYear()}`;
}

const GRADUATION_STAGE_ACTIONS = {
  create_batch: {
    id: "create_batch",
    label: "Create batch",
    movement: "GS Staff creates the batch before forwarding",
    nextOwner: "Graduate School Staff",
    batchRequired: true,
    commentLabel: "Optional batch note",
  },
  compile_to_ac: {
    id: "compile_to_ac",
    label: "Forward to Academic Coordinator",
    movement: "GS Staff → Academic Coordinator",
    nextOwner: "Academic Coordinator",
    commentLabel: "Optional note to Academic Coordinator",
  },
  check_coursework: {
    id: "check_coursework",
    label: "Check coursework completion",
    movement: "Academic Coordinator → Research Coordinator or GS Staff",
    nextOwner: "Research Coordinator / Graduate School Staff",
    commentLabel: "Optional coursework review note",
  },
  validate_research: {
    id: "validate_research",
    label: "Validate research and practicum requirements",
    movement: "Research Coordinator → GS Staff",
    nextOwner: "Graduate School Staff",
    commentLabel: "Optional research and practicum validation note",
  },
  mark_not_eligible: {
    id: "mark_not_eligible",
    label: "List missing requirements and mark not eligible",
    movement: "GS Staff → Student",
    nextOwner: "Student",
    requiresComment: true,
    commentLabel: "Student-facing missing requirements message",
  },
  prepare_endorsement: {
    id: "prepare_endorsement",
    label: "Prepare endorsement list",
    movement: "GS Staff preparation",
    nextOwner: "Graduate School Staff",
    commentLabel: "Optional endorsement preparation note",
  },
  send_to_dean: {
    id: "send_to_dean",
    label: "Send endorsement list to Dean",
    movement: "GS Staff → Dean",
    nextOwner: "Dean",
    commentLabel: "Optional note to Dean",
  },
  approve: {
    id: "approve",
    label: "Approve endorsement list",
    movement: "Dean approval",
    nextOwner: "Dean / Registrar export",
    commentLabel: "Optional Dean comment",
  },
  return: {
    id: "return",
    label: "Return endorsement list for revision",
    movement: "Dean → Graduate School Staff",
    nextOwner: "Graduate School Staff",
    requiresComment: true,
    commentLabel: "Required revision reason",
  },
};

function graduationStageActionForRow(row, accountRole) {
  const status = row.endorsement?.endorsement_status || "Not Prepared";
  if (accountRole === "staff" && row.has_submitted_documents && ["Not Prepared", "For Review", "Not Eligible", "Returned for Clarification"].includes(status) && !row.endorsement?.batch_name) return GRADUATION_STAGE_ACTIONS.create_batch;
  if (accountRole === "staff" && ["Not Prepared", "For Review", "Not Eligible", "Returned for Clarification"].includes(status) && row.endorsement?.batch_name) return GRADUATION_STAGE_ACTIONS.compile_to_ac;
  if (accountRole === "academic_coordinator" && status === "Coursework Review") return GRADUATION_STAGE_ACTIONS.check_coursework;
  if (accountRole === "research_coordinator" && status === "Research Review") return GRADUATION_STAGE_ACTIONS.validate_research;
  if (accountRole === "staff" && ["Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status)) return GRADUATION_STAGE_ACTIONS.mark_not_eligible;
  if (accountRole === "staff" && status === "Eligibility Confirmed") return GRADUATION_STAGE_ACTIONS.prepare_endorsement;
  if (accountRole === "staff" && ["Endorsement Prepared", "Returned for Revision"].includes(status)) return GRADUATION_STAGE_ACTIONS.send_to_dean;
  if (accountRole === "dean" && status === "Ready for Dean Review") return GRADUATION_STAGE_ACTIONS.approve;
  return null;
}

function graduationStageSelection(rows, accountRole) {
  const rowActions = rows.map((row) => ({ row, action: graduationStageActionForRow(row, accountRole) }));
  const actionIds = [...new Set(rowActions.filter((item) => item.action).map((item) => item.action.id))];
  if (actionIds.length !== 1) {
    return { action: null, processableRows: [], skippedRows: rows, mixed: actionIds.length > 1 };
  }
  const action = GRADUATION_STAGE_ACTIONS[actionIds[0]];
  return {
    action,
    processableRows: rowActions.filter((item) => item.action?.id === action.id).map((item) => item.row),
    skippedRows: rowActions.filter((item) => item.action?.id !== action.id).map((item) => item.row),
    mixed: false,
  };
}

function graduationBatchActionLabel(action) {
  if (!action) return "No action due";
  return action.label;
}

function graduationSelectedActionLabel(action) {
  if (!action) return "Review selected candidates";
  return action.label;
}

const GRADUATION_UNBATCHED_LABEL = "Unbatched candidates";
const GRADUATION_STATUS_PRIORITY = [
  "Not Prepared",
  "For Review",
  "Coursework Review",
  "Coursework Incomplete",
  "Research Review",
  "Research Incomplete",
  "Practicum Incomplete",
  "Eligibility Confirmed",
  "Endorsement Prepared",
  "Ready for Dean Review",
  "Returned for Revision",
  "Dean Approved",
  "Not Eligible",
  "Returned for Clarification",
];

const GRADUATION_STAGE_AFTER_COMPILE = [
  "Coursework Review", "Coursework Incomplete", "Research Review", "Research Incomplete",
  "Practicum Incomplete", "Eligibility Confirmed", "Endorsement Prepared",
  "Ready for Dean Review", "Returned for Revision", "Dean Approved", "Not Eligible",
];
const GRADUATION_STAGE_AFTER_RESEARCH = [
  "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review",
  "Returned for Revision", "Dean Approved",
];
const GRADUATION_STAGE_AFTER_DEAN_HANDOFF = ["Ready for Dean Review", "Dean Approved"];
const GRADUATION_STAGE_AFTER_DEAN_REVIEW = ["Dean Approved"];

const GRADUATION_BATCH_STAGES = [
  {
    label: "Student submits graduation application",
    detail: "The signed application / review-window PDF is saved before the candidate can be selected.",
    completeStatuses: GRADUATION_STATUS_PRIORITY.filter((status) => status !== "Not Prepared"),
  },
  {
    label: "GS Staff creates graduation batch",
    detail: "Application-submitted candidates are grouped by the selected cohort.",
    completeStatuses: GRADUATION_STATUS_PRIORITY.filter((status) => status !== "Not Prepared"),
  },
  {
    label: "GS Staff forwards batch for coursework review",
    detail: "The created batch is sent to the Academic Coordinator.",
    currentStatuses: ["For Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_COMPILE,
    attentionStatuses: ["Returned for Clarification"],
  },
  {
    label: "Academic Coordinator reviews coursework",
    detail: "Completed curriculum requirements are revalidated for every candidate.",
    currentStatuses: ["Coursework Review"],
    completeStatuses: [
      "Research Review", "Research Incomplete", "Practicum Incomplete", "Eligibility Confirmed",
      "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved",
    ],
    attentionStatuses: ["Coursework Incomplete", "Not Eligible"],
  },
  {
    label: "Research Coordinator validates research and practicum",
    detail: "Research, post-defense evidence, and any required practicum completion are revalidated.",
    currentStatuses: ["Research Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_RESEARCH,
    attentionStatuses: ["Research Incomplete", "Practicum Incomplete", "Not Eligible"],
  },
  {
    label: "GS Staff prepares and forwards endorsement",
    detail: "Validated candidates are prepared as an endorsement list and sent to the Dean.",
    currentStatuses: ["Eligibility Confirmed", "Endorsement Prepared", "Returned for Revision"],
    completeStatuses: GRADUATION_STAGE_AFTER_DEAN_HANDOFF,
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
  {
    label: "Dean reviews graduation batch",
    detail: "The Dean approves the endorsement list or returns it to GS Staff for revision.",
    currentStatuses: ["Ready for Dean Review"],
    completeStatuses: GRADUATION_STAGE_AFTER_DEAN_REVIEW,
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
  {
    label: "Export Dean-approved list",
    detail: "The approved candidates are ready for CSV download and manual Registrar email.",
    currentStatuses: ["Dean Approved"],
    completeStatuses: [],
    attentionStatuses: ["Returned for Revision", "Not Eligible"],
  },
];

function graduationRowStatus(row) {
  return row.endorsement?.endorsement_status || "Not Prepared";
}

function graduationRowBatchLabel(row, fallback = GRADUATION_UNBATCHED_LABEL) {
  return row.endorsement?.batch_name || fallback;
}

function orderedGraduationStatuses(rows) {
  const statuses = uniqueValues(rows.map(graduationRowStatus));
  return statuses.sort((left, right) => {
    const leftIndex = GRADUATION_STATUS_PRIORITY.indexOf(left);
    const rightIndex = GRADUATION_STATUS_PRIORITY.indexOf(right);
    const safeLeft = leftIndex === -1 ? GRADUATION_STATUS_PRIORITY.length : leftIndex;
    const safeRight = rightIndex === -1 ? GRADUATION_STATUS_PRIORITY.length : rightIndex;
    if (safeLeft !== safeRight) return safeLeft - safeRight;
    return left.localeCompare(right);
  });
}

function graduationBoardStatusForRows(rows) {
  return orderedGraduationStatuses(rows)[0] || "Not Prepared";
}

function graduationLatestDate(rows) {
  return rows.reduce((latest, row) => {
    const value = row.last_activity_at || row.endorsement?.updated_at || row.endorsement?.created_at;
    const timestamp = new Date(value || 0).getTime();
    return Number.isFinite(timestamp) && timestamp > latest.timestamp ? { value, timestamp } : latest;
  }, { value: "", timestamp: 0 }).value;
}

function graduationStatusCounts(rows, valueFor) {
  const counts = new Map();
  rows.forEach((row) => {
    const value = valueFor(row) || "Pending";
    counts.set(value, (counts.get(value) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((left, right) => left.value.localeCompare(right.value));
}

function graduationStatusSummary(rows, valueFor) {
  const counts = graduationStatusCounts(rows, valueFor);
  if (!counts.length) return "No records";
  return counts.map((item) => `${item.value}: ${item.count}`).join(" / ");
}

function graduationBatchGroups(rows, selectedIds = new Set()) {
  const groups = new Map();
  rows.forEach((row) => {
    const label = graduationRowBatchLabel(row);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(row);
  });
  return [...groups.entries()].map(([label, groupRows]) => {
    const sortedRows = sortSelectedWorkflowRows(
      [...groupRows],
      selectedIds,
      (row) => row.student.name,
      (row) => row.student.id,
    );
    const selectedCount = sortedRows.filter((row) => selectedIds.has(row.student.id)).length;
    const statuses = orderedGraduationStatuses(sortedRows);
    return {
      id: label,
      label,
      rows: sortedRows,
      selectedCount,
      statuses,
      boardStatus: graduationBoardStatusForRows(sortedRows),
      updatedAt: graduationLatestDate(sortedRows),
      nextOwners: uniqueValues(sortedRows.map((row) => row.next_action_owner || "Awaiting review")),
      courseworkSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.coursework_status),
      researchSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.research_status),
      practicumSummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.practicum_status),
      eligibilitySummary: graduationStatusSummary(sortedRows, (row) => row.eligibility.status),
    };
  }).sort((left, right) => {
    const leftSelected = left.selectedCount > 0;
    const rightSelected = right.selectedCount > 0;
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return left.label.localeCompare(right.label);
    const leftUnbatched = left.label === GRADUATION_UNBATCHED_LABEL;
    const rightUnbatched = right.label === GRADUATION_UNBATCHED_LABEL;
    if (leftUnbatched !== rightUnbatched) return leftUnbatched ? -1 : 1;
    return left.label.localeCompare(right.label);
  });
}

function graduationBatchSelectionState(group, selectedIds) {
  const selectedCount = group.rows.filter((row) => selectedIds.has(row.student.id)).length;
  return {
    selectedCount,
    allSelected: selectedCount > 0 && selectedCount === group.rows.length,
    partiallySelected: selectedCount > 0 && selectedCount < group.rows.length,
  };
}

function graduationBatchStageState(stage, group) {
  const statuses = group.rows.map(graduationRowStatus);
  const hasAttention = statuses.some((status) => stage.attentionStatuses?.includes(status));
  const allComplete = statuses.length > 0 && statuses.every((status) => stage.completeStatuses?.includes(status));
  const hasCurrent = statuses.some((status) => stage.currentStatuses?.includes(status));
  const hasComplete = statuses.some((status) => stage.completeStatuses?.includes(status));
  if (hasAttention) return "Needs action";
  if (allComplete) return "Complete";
  if (hasCurrent) return "Current";
  if (hasComplete) return "Mixed";
  return "Pending";
}

function graduationBatchStageChecks(group) {
  return GRADUATION_BATCH_STAGES.map((stage, index) => ({
    ...stage,
    number: index + 1,
    state: graduationBatchStageState(stage, group),
  }));
}

function graduationBatchCurrentStage(group) {
  const stages = graduationBatchStageChecks(group);
  return stages.find((stage) => ["Needs action", "Current", "Mixed", "Pending"].includes(stage.state)) || stages[stages.length - 1];
}

function GraduationBatchStageCheck({ group, compact = false, onViewStage }) {
  const stages = graduationBatchStageChecks(group);
  const currentStage = graduationBatchCurrentStage(group);
  const completed = stages.filter((stage) => stage.state === "Complete").length;
  const progress = Math.round((completed / stages.length) * 100);
  if (compact) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Stage check</p>
            <p className="mt-1 truncate text-sm font-semibold text-ink">Step {currentStage.number}: {currentStage.label}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge value={`${completed}/${stages.length}`} dot={false} />
            {onViewStage && <button type="button" onClick={() => onViewStage(group)} className="btn-ghost cursor-pointer px-2 py-1.5" aria-label={`View graduation stage check for ${group.label}`}><Eye className="h-4 w-4" /></button>}
          </div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white ring-1 ring-slate-200">
          <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-none rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex w-full flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink">Graduation stage check for {group.label}</p>
          <p className="text-xs text-slate-500">Follow where this batch is in the graduation endorsement process.</p>
        </div>
        <StatusBadge value={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
      </div>
      <ol className="mt-3 grid w-full grid-cols-1 gap-2 2xl:grid-cols-2">
        {stages.map((stage) => (
          <li key={stage.label} className="flex w-full max-w-none gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stage.state === "Complete" ? "bg-brand-600 text-white" : stage.state === "Current" ? "bg-amber-100 text-amber-800" : stage.state === "Needs action" ? "bg-red-100 text-red-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{stage.number}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                <StatusBadge value={stage.state} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
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

function GraduationRequirementBoxes({ row }) {
  const eligibility = row.eligibility || {};
  const items = [
    "Coursework completed",
    "Thesis / research completed",
    eligibility.practicum_status === "Not Required" ? "Practicum not required" : "Practicum completed",
    "Eligible for graduation",
  ];
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2" aria-label="Completed graduation requirements">
      {items.map((label) => (
        <div key={label} className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-3.5 w-3.5" /></span>
          <p className="text-xs font-semibold">{label}</p>
        </div>
      ))}
      </div>
  );
}

function GraduationCompletedCourseworkView({ row, id }) {
  const completedCourses = row.eligibility?.completed_courses || [];
  const completedUnits = completedCourses.reduce((total, course) => total + Number(course.units || 0), 0);
  return (
    <section
      id={id}
      className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3"
      aria-label={`Completed coursework for ${row.student.name}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Coursework completed</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {completedCourses.length} completed subject{completedCourses.length === 1 ? "" : "s"}
            {completedUnits > 0 ? ` · ${completedUnits} units` : ""}
          </p>
        </div>
        <StatusBadge value={row.eligibility?.coursework_status || "Needs verification"} dot={false} />
      </div>
      {completedCourses.length > 0 ? (
        <ul className="mt-3 grid gap-2 md:grid-cols-2">
          {completedCourses.map((course) => (
            <li key={course.id || course.code} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{course.code}</p>
                {course.units != null && <span className="shrink-0 text-xs font-semibold text-slate-500">{course.units} units</span>}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{course.title}</p>
              {(course.category || course.term_label) && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {[course.category, course.term_label].filter(Boolean).join(" · ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-3 text-xs text-slate-500">
          No completed coursework records are available for this student.
        </p>
      )}
    </section>
  );
}

function researchStageDetailLine(stage) {
  return `Requirements ${stage.requirements_complete}/${stage.requirements_total}; panel ${stage.panel?.assigned_count ?? 0}/${stage.panel?.required_count ?? 0}; schedule ${stage.schedule?.status || "Not scheduled"}; defense ${stage.defense?.status || "Not recorded"}`;
}

function GraduationResearchRequirementsView({ row, id }) {
  const progress = row.eligibility?.research_progress || {};
  const stages = progress.stages || [];
  const completion = progress.completion_evidence;
  if (!stages.length && !completion) {
    return (
      <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500">
        No submitted research requirement details are available for this student yet.
      </div>
    );
  }
  return (
    <section id={id} className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3" aria-label={`Research completion details for ${row.student.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Research completion details</p>
          <p className="mt-0.5 text-xs text-slate-600">
            {progress.completed_stage_count ?? 0}/{progress.stage_count ?? stages.length} research stages complete
          </p>
        </div>
        <StatusBadge value={row.eligibility?.research_status || "Needs verification"} dot={false} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.gate} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{stage.name}</p>
              <StatusBadge value={stage.complete ? "Complete" : "Incomplete"} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{researchStageDetailLine(stage)}</p>
          </div>
        ))}
        {completion && (
          <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Completion Evidence</p>
              <StatusBadge value={completion.status || (completion.complete ? "Complete" : "Incomplete")} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">Requirements {completion.requirements_complete ?? 0}/{completion.requirements_total ?? 0}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function GraduationPracticumCompletionView({ row, id }) {
  const details = row.eligibility?.practicum_completion || {};
  if (!details.required) {
    return (
      <section id={id} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={`Practicum completion details for ${row.student.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Practicum completion details</p>
            <p className="mt-1 text-sm text-slate-700">This student’s program does not require practicum.</p>
          </div>
          <StatusBadge value="Not Required" dot={false} />
        </div>
      </section>
    );
  }
  if (!details.record_exists) {
    return (
      <section id={id} className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3" aria-label={`Practicum completion details for ${row.student.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-red-700">Practicum completion details</p>
            <p className="mt-1 text-sm text-red-800">No practicum record is on file for this required program.</p>
          </div>
          <StatusBadge value={details.status || "Missing"} dot={false} />
        </div>
      </section>
    );
  }
  const detailItems = [
    ["Hours completed", `${details.completed_hours || 0}/${details.required_hours || 0}`],
    ["Practicum site", details.practicum_site || "Not recorded"],
    ["Supervisor", details.supervisor_name || "Not recorded"],
    ["MOA", details.moa_status || "Pending"],
    ["Completion documents", details.document_status || "Pending"],
    ["Certificate files", String(details.certificate_count || 0)],
    ["Completion review", details.completion_status || "Pending"],
    ["Final verification", details.dean_reviewed_at ? "Dean Reviewed" : details.report_sent_at ? "Report Sent to Dean" : "Not sent"],
  ];
  return (
    <section id={id} className="mt-3 rounded-xl border border-brand-200 bg-brand-50/50 p-3" aria-label={`Practicum completion details for ${row.student.name}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Practicum completion details</p>
          <p className="mt-0.5 text-xs text-slate-600">Hours, placement, documents, and final review status</p>
        </div>
        <StatusBadge value={details.status || "Needs verification"} dot={false} />
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {detailItems.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function GraduationBatchModal({ rows, accountRole, reviewWindows, defaultReviewWindow, onClose, onSaved }) {
  const selection = graduationStageSelection(rows, accountRole);
  const stageAction = selection.action;
  const defaultBatch = defaultGraduationBatchForm(rows);
  const activeReviewWindow = defaultReviewWindow || reviewWindows[0] || "";
  const selectedReviewWindow = activeReviewWindow;
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    comment: "",
    review_window: selectedReviewWindow,
    ...defaultBatch,
  });
  const [deanActionId, setDeanActionId] = useState("approve");
  const action = accountRole === "dean" && stageAction?.id === "approve"
    ? GRADUATION_STAGE_ACTIONS[deanActionId]
    : stageAction;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expandedDetailKeys, setExpandedDetailKeys] = useState(() => new Set());
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const batchName = graduationBatchName(form);
  const showBatchFields = action?.batchRequired || (action?.id === "send_to_dean" && selection.processableRows.some((row) => !row.endorsement?.batch_name));
  const requiresComment = Boolean(action?.requiresComment);
  const selectedGroups = graduationBatchGroups(selection.processableRows.length ? selection.processableRows : rows);
  const modalActionLabel = action
    ? showBatchFields
      ? graduationBatchActionLabel(action)
      : graduationSelectedActionLabel(action)
    : "Review selected candidates";
  const showAllCompletionActions = (
    ["prepare_endorsement", "send_to_dean"].includes(action?.id)
    || stageAction?.id === "approve"
  );
  const showCourseworkActions = action?.id === "check_coursework" || showAllCompletionActions;
  const showResearchPracticumActions = action?.id === "validate_research" || showAllCompletionActions;

  function toggleDetail(studentId, detail) {
    const key = `${studentId}:${detail}`;
    setExpandedDetailKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function confirm(event) {
    event.preventDefault();
    if (!action) {
      setError(selection.mixed ? "Select candidates from one review stage at a time." : "No group action is currently due for this selection.");
      return;
    }
    if (requiresComment && !form.comment.trim()) {
      setError("Enter the required message before applying this action.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { batch_no, batch_month, batch_year, ...baseForm } = form;
      const payload = {
        ...baseForm,
        stage_action: action.id,
        action: action.id,
        ...(showBatchFields ? { batch_no, batch_month, batch_year, batch_name: batchName } : {}),
      };
      const result = await api.graduationBatchAction({ student_ids: selection.processableRows.map((row) => row.student.id), ...payload });
      await onSaved(result);
      onClose();
    } catch (err) {
      setError(err.message || "Could not apply the graduation group action.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkflowCaseModal
      id="graduation-batch-action"
      title={modalActionLabel}
      subtitle={action ? `${action.movement}` : "Selection needs one review stage"}
      onClose={onClose}
      size="wide"
      footer={<button type="submit" form="graduation-batch-form" disabled={busy || !action} className="btn-primary cursor-pointer px-4 py-2"><CheckSquare className="h-4 w-4" /> {busy ? "Applying..." : action ? modalActionLabel : "No action available"}</button>}
    >
      <form id="graduation-batch-form" onSubmit={confirm} className="space-y-4">
        <ErrorNote message={error} />
        {accountRole === "dean" && stageAction?.id === "approve" && (
          <Field label="Dean decision" required>
            <Select
              value={deanActionId}
              onChange={(event) => {
                setDeanActionId(event.target.value);
                setForm((current) => ({ ...current, comment: "" }));
              }}
              options={[
                { value: "approve", label: "Approve endorsement list" },
                { value: "return", label: "Return endorsement list for revision" },
              ]}
              placeholder=""
            />
          </Field>
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Selected action</p>
          {action ? (
            <>
              <p className="mt-2 text-sm font-semibold text-ink">{action.label}</p>
              <p className="mt-1 text-sm text-slate-600">{action.movement}</p>
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-red-700">{selection.mixed ? "Selected candidates are in different review stages." : "No selected candidate has a group action due for this role."}</p>
          )}
        </div>
        {showBatchFields && (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Batch No."><Input value={form.batch_no} onChange={update("batch_no")} inputMode="numeric" required /></Field>
              <Field label="Month"><select value={form.batch_month} onChange={update("batch_month")} className="field-input cursor-pointer">{GRADUATION_BATCH_MONTHS.map((month) => <option key={month}>{month}</option>)}</select></Field>
              <Field label="Year"><Input value={form.batch_year} onChange={update("batch_year")} inputMode="numeric" required /></Field>
              <Field label="Graduation school year" hint={`Only ${activeReviewWindow || "the active school year"} can be selected.`}><Select value={form.review_window} onChange={update("review_window")} options={reviewWindowOptions} placeholder="" required /></Field>
            </div>
            <p className="text-sm font-semibold text-brand-800">Batch label: {batchName}</p>
          </div>
        )}
        {action && <Field label={action.commentLabel || "Comment"} required={requiresComment}><Textarea value={form.comment} onChange={update("comment")} required={requiresComment} /></Field>}
        {!showBatchFields && selectedGroups.length > 0 && (
          <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={selectedGroups.length}>
            <div className="grid w-full grid-cols-1 gap-3">
              {selectedGroups.map((group) => <GraduationBatchStageCheck key={group.id} group={group} />)}
            </div>
          </HistoryDisclosure>
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Eligible candidates</p>
          <p className="mt-1 text-sm text-slate-600">{selection.processableRows.length} of {rows.length} selected candidate{rows.length === 1 ? " is" : "s are"} ready for this action.</p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
            {rows.map((row) => {
              const courseworkOpen = expandedDetailKeys.has(`${row.student.id}:coursework`);
              const researchOpen = expandedDetailKeys.has(`${row.student.id}:research`);
              const practicumOpen = expandedDetailKeys.has(`${row.student.id}:practicum`);
              const courseworkPanelId = `graduation-modal-coursework-${row.student.id}`;
              const researchPanelId = `graduation-modal-research-${row.student.id}`;
              const practicumPanelId = `graduation-modal-practicum-${row.student.id}`;
              return (
                <li key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{row.student.name}</p>
                      <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {showCourseworkActions && (
                        <button
                          type="button"
                          onClick={() => toggleDetail(row.student.id, "coursework")}
                          className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
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
                            className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
                            aria-expanded={researchOpen}
                            aria-controls={researchPanelId}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            {researchOpen ? "Hide research completion details" : "View research completion details"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDetail(row.student.id, "practicum")}
                            className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
                            aria-expanded={practicumOpen}
                            aria-controls={practicumPanelId}
                          >
                            <Briefcase className="h-3.5 w-3.5" />
                            {practicumOpen ? "Hide practicum completion details" : "View practicum completion details"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <GraduationRequirementBoxes row={row} />
                  {showCourseworkActions && courseworkOpen && <GraduationCompletedCourseworkView id={courseworkPanelId} row={row} />}
                  {showResearchPracticumActions && researchOpen && <GraduationResearchRequirementsView id={researchPanelId} row={row} />}
                  {showResearchPracticumActions && practicumOpen && <GraduationPracticumCompletionView id={practicumPanelId} row={row} />}
                </li>
              );
            })}
          </ul>
        </div>
      </form>
    </WorkflowCaseModal>
  );
}

const PRACTICUM_BOARD_COLUMNS = [
  { label: "Awaiting Submission", statuses: ["Not Submitted"] },
  { label: "Submitted", statuses: ["MOA Submitted", "MOA Received"] },
  { label: "Eligibility Review", statuses: ["MOA Under Review"] },
  { label: "Documents Review", statuses: ["Documents Submitted", "Documents Under Review"] },
  { label: "In Progress", statuses: ["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"] },
  { label: "Completion Review", statuses: ["Completed"] },
  { label: "Completed", statuses: ["Report Sent to Dean", "Dean Reviewed"] },
  { label: "Returned", statuses: ["Returned for Clarification", "Not Accepted - New Organization Required"] },
];

// The same columns for the shared StageBoard (each needs a key).
const PRACTICUM_STAGE_COLUMNS = PRACTICUM_BOARD_COLUMNS.map((column) => ({ ...column, key: column.label }));
const practicumBoardItemId = (row) => row.student.id;
const practicumBoardColumnKey = (row) =>
  PRACTICUM_STAGE_COLUMNS.find((column) => column.statuses.includes(row.record?.status || "Not Submitted"))?.key || "";

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

function practicumReadyForDeanReview(row) {
  return row.record?.status === "Report Sent to Dean";
}

function withdrawalReadyForDeanReview(item) {
  return item.status === "Dean Review";
}

function graduationReadyForDeanReview(group) {
  return group.boardStatus === "Ready for Dean Review";
}

function PracticumBoardCard({ row, onOpen, onMessage }) {
  const record = row.record;
  const readyForDean = practicumReadyForDeanReview(row);
  const ready = Boolean(row.has_submitted_documents) || readyForDean;
  const latestMessage = row.messages?.[0];
  return (
    <article key={row.student.id} className={`rounded-xl border p-3 shadow-sm transition-colors ${ready ? "border-emerald-300 bg-emerald-50 hover:border-emerald-500" : "border-slate-200 bg-white hover:border-slate-300"}`}>
      <div className="flex items-start justify-between gap-2"><div><p className="text-sm font-semibold text-ink">{row.student.name}</p><p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p></div>{readyForDean ? <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[11px] font-bold text-white">Ready for Dean review</span> : !ready && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Waiting for documents</span>}</div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600"><span>{record?.practicum_site || "Site pending"}</span><span className="text-right">{record ? `${record.completed_hours}/${record.required_hours} hrs` : "No hours yet"}</span><span>{row.eligibility.status}</span><span className="text-right">Updated {formatDate(row.last_activity_at || record?.updated_at)}</span><span className="col-span-2">{record ? `Submitted ${formatDate(record.created_at)}` : "No practicum documents submitted"}</span></div>
      {row.messages?.length > 0 && <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">{row.messages.length} visible message{row.messages.length === 1 ? "" : "s"}</p><p className="mt-1 line-clamp-2 text-xs text-amber-900">{latestMessage?.comment || latestMessage?.template}</p></div>}
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-brand-700">Next: {row.next_action_owner || "Awaiting review"}</p>
      <div className="mt-3 flex gap-2"><button type="button" onClick={onOpen} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><Eye className="h-3.5 w-3.5" /> View</button>{record && <button type="button" onClick={onMessage} className="btn-ghost flex-1 cursor-pointer px-2 py-1.5"><MessageSquare className="h-3.5 w-3.5" /> Message</button>}</div>
    </article>
  );
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

export function PracticumRoster({ context, submit, submitting, refreshing, result, submitError, clearSubmitFeedback, refetch, accountRole }) {
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [messageRow, setMessageRow] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [messageNotice, setMessageNotice] = useState("");
  const [viewMode, setViewMode] = useState("board");
  const [pendingAction, setPendingAction] = useState(null);
  const [moveRow, setMoveRow] = useState(null); // the card a drop or "Move to..." opened the confirm window for
  const reset = useDemoCaseReset("practicum", refetch);
  const rows = (context.roster || []).filter((row) => row.eligibility?.eligible === true);
  const [filters, setFilters] = useState({ query: "", program: "", status: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")), [rows]);
  const filteredRows = useMemo(() => sortWorkflowRows(rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.secondary || row.eligibility.status === filters.secondary)
      && dateMatches(row.last_activity_at || row.record?.updated_at || row.record?.created_at, filters.dateFrom, filters.dateTo);
  }), filters.sort, (row) => row.last_activity_at || row.record?.updated_at || row.record?.created_at, (row) => row.student.name), [rows, filters]);

  function actionFor(row) {
    const record = row.record;
    if (!record) return null;
    const base = { student_id: row.student.id };
    if (accountRole === "staff" && ["MOA Submitted", "MOA Received"].includes(record.status)) {
      return { label: "Forward to Academic Coordinator", payload: { ...base, status: "MOA Under Review", moa_status: "Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "MOA Under Review") {
      return { label: "Mark practicum in progress", payload: { ...base, status: "Practicum In Progress", moa_status: "Verified" } };
    }
    if (accountRole === "staff" && ["Hours Incomplete", "Documents Submitted"].includes(record.status)) {
      return { label: "Forward documents to Academic Coordinator", payload: { ...base, status: "Documents Under Review" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Documents Under Review" && row.hours_status !== "Complete") {
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" }, requireReason: true };
    }
    if (accountRole === "academic_coordinator" && ["Documents Under Review", "Practicum In Progress"].includes(record.status) && row.hours_status === "Complete") {
      return { label: "Verify completion", payload: { ...base, status: "Completed", document_status: "Verified" } };
    }
    if (accountRole === "academic_coordinator" && record.status === "Completed") {
      return { label: "Send status report to Dean", payload: { ...base, status: "Report Sent to Dean", document_status: "Verified" } };
    }
    return null;
  }
  const selectedRow = rows.find((row) => row.student.id === selectedStudentId) || null;
  const selectedAction = selectedRow ? actionFor(selectedRow) : null;

  // ---- the board: a move is the same step as the button in the case window ---------------
  // The step for a card is the one actionFor() gives; it can be moved only to the column that
  // step really leads to. A step that stays in the same column is done from the case window.
  function practicumMoveFor(row) {
    const action = actionFor(row);
    if (!action) return null;
    const from = practicumBoardColumnKey(row);
    const to = PRACTICUM_STAGE_COLUMNS.find((column) => column.statuses.includes(action.payload.status));
    return to && to.key !== from ? { action, to } : null;
  }
  function practicumLockReason(row) {
    if (!row.record) return "Waiting for: Student";
    const action = actionFor(row);
    if (action) return `Open the case to: ${action.label}`;
    return `Waiting for: ${row.next_action_owner || "the next reviewer"}`;
  }
  function practicumCheckMove(row, column) {
    const move = practicumMoveFor(row);
    if (move && move.to.key === column.key) return { allowed: true };
    if (move) return { allowed: false, reason: `From here you can: ${move.action.label}.` };
    return { allowed: false, reason: practicumLockReason(row) };
  }
  function movePracticumRow(row) {
    const move = practicumMoveFor(row);
    if (!move) throw new Error(practicumLockReason(row));
    setMoveRow(row);
    setPendingAction({ ...move.action, fromStatus: row.record.status, toStatus: move.action.payload.status });
    return undefined;
  }

  function openCase(studentId) {
    clearSubmitFeedback();
    reset.clearResetFeedback();
    setSelectedStudentId(studentId);
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Practicum student submissions" subtitle={`${WORKFLOW_ROLE_LABELS[accountRole]} view · Psychology and MSGC students only`} icon={Briefcase} />
      <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-brand-900">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden="true" />
        <div>
          <p className="text-sm font-bold">Program scope: Psychology and MSGC only</p>
          <p className="mt-1 text-xs leading-relaxed text-brand-800">
            {context.practicum_program_scope?.description || "This roster includes only Psychology programs and the Master of Science in Guidance and Counseling (MSGC)."} Students from every other program are excluded from the practicum roster and actions.
          </p>
        </div>
      </div>
      {messageNotice && <div aria-live="polite" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{messageNotice}</div>}
      <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not eligible", "Needs verification"]} count={filteredRows.length} total={rows.length} />
        </div>
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>
      {filteredRows.length > 0 && viewMode === "board" ? (
        <StageBoard
          ariaLabel="Practicum workflow board"
          columns={PRACTICUM_STAGE_COLUMNS}
          items={filteredRows}
          getItemId={practicumBoardItemId}
          getColumnKey={practicumBoardColumnKey}
          renderCard={(row) => <PracticumBoardCard key={row.student.id} row={row} onOpen={() => openCase(row.student.id)} onMessage={() => setMessageRow(row)} />}
          canDrag={(row) => Boolean(practicumMoveFor(row))}
          lockReason={practicumLockReason}
          checkMove={practicumCheckMove}
          onMove={movePracticumRow}
          emptyText="No requests here"
          columnClassName="w-[300px]"
        />
      ) : viewMode === "board" ? <EmptyState title="No recent practicum submissions match the filters." /> : <WorkflowTable
        headers={["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]}
        empty="No eligible Psychology or MSGC practicum students found."
        rows={filteredRows}
        render={(row) => {
          return (
              <tr
                key={row.student.id}
                onClick={() => openCase(row.student.id)}
                className="cursor-pointer border-b border-slate-100 align-top transition-colors hover:bg-brand-50/60"
              >
                <StudentCell student={row.student} />
                <td className="px-3 py-3"><StatusBadge value={row.eligibility.status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.moa_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.documents_status} dot={false} /></td>
                <td className="px-3 py-3 text-sm text-slate-600">{row.record ? `${row.record.completed_hours}/${row.record.required_hours}` : "—"}<div className="mt-1"><StatusBadge value={row.hours_status} dot={false} /></div></td>
                <td className="px-3 py-3"><StatusBadge value={row.coordinator_review_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.dean_report_status} dot={false} /></td>
                <td className="px-3 py-3">
                  <button type="button" onClick={(event) => { event.stopPropagation(); openCase(row.student.id); }} className="btn-ghost cursor-pointer px-3 py-2"><Eye className="h-4 w-4" /> Open case</button>
                </td>
              </tr>
          );
        }}
      />}
      {selectedRow && (
        <WorkflowCaseModal
          id={`practicum-case-${selectedRow.student.id}`}
          title={selectedRow.student.name}
          subtitle={`${selectedRow.student.student_number} · ${selectedRow.student.program_code} · Practicum case`}
          status={selectedRow.record?.status || "Not Submitted"}
          onClose={() => setSelectedStudentId(null)}
          size="wide"
          footer={(
            <>
              {accountRole === "staff" && selectedRow.record && <DemoResetButton student={selectedRow.student} resettingId={reset.resettingId} onReset={reset.resetCase} />}
              {selectedRow.record && <button type="button" onClick={() => setMessageRow(selectedRow)} className="btn-ghost cursor-pointer px-4 py-2"><MessageSquare className="h-4 w-4" /> Message / Return</button>}
              {selectedAction ? (
                <div><button type="button" disabled={submitting || refreshing} onClick={() => setPendingAction({ ...selectedAction, fromStatus: selectedRow.record.status, toStatus: selectedAction.payload.status })} className="btn-primary cursor-pointer px-4 py-2">
                  {submitting ? "Saving…" : refreshing ? "Updating…" : selectedAction.label}
                </button>{selectedAction.label === "Request additional certificates" && <p className="mt-1 text-xs font-semibold text-red-600">*Incomplete hours</p>}</div>
              ) : (
                <span className="self-center text-xs font-semibold text-slate-500">{selectedRow.record ? `No ${WORKFLOW_ROLE_LABELS[accountRole]} action is currently due.` : "Awaiting student submission."}</span>
              )}
            </>
          )}
        >
          <div className="space-y-4">
            <WorkflowSubmitFeedback result={result} error={submitError} />
            <DemoResetFeedback message={reset.resetMessage} error={reset.resetError} />
            <PracticumCaseDetails row={selectedRow} />
            <CaseMessageHistory messages={selectedRow.messages} onReply={(message) => { setReplyTo(message); setMessageRow(selectedRow); }} />
            <WorkflowActivityList logs={selectedRow.history || []} />
          </div>
        </WorkflowCaseModal>
      )}
      {messageRow && <WorkflowMessageModal slug="practicum" row={messageRow} context={context} replyTo={replyTo} onClose={() => { setMessageRow(null); setReplyTo(null); }} onSaved={async (message) => { setMessageNotice(message); await refetch(); }} />}
      {pendingAction && (moveRow || selectedRow) && <WorkflowTransitionModal slug="practicum" student={(moveRow || selectedRow).student} action={pendingAction} busy={submitting || refreshing} onClose={() => { setPendingAction(null); setMoveRow(null); }} onConfirm={submit} />}
    </div>
  );
}

function PracticumCaseDetails({ row }) {
  const record = row.record;
  const timeline = (row.timeline || record?.timeline || []).map((step) => ({
    ...step,
    optional: ["Hours Incomplete", "Additional Certificates Requested"].includes(step.label),
  }));
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Detail label="Eligibility" value={row.eligibility.status} />
        <Detail label="MOA" value={row.moa_status} />
        <Detail label="Documents" value={row.documents_status} />
        <Detail label="Hours" value={record ? `${record.completed_hours}/${record.required_hours}` : "Not started"} />
        <Detail label="Supervisor" value={record?.supervisor_name || "Not provided"} />
        <Detail label="Completion" value={record?.completion_status || "Pending"} />
      </div>
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Automatic eligibility</p>
            <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {row.eligibility.checklist.map((item) => (
                <div key={item.key} className="grid gap-1 border-b border-slate-100 px-3 py-2.5 last:border-0 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-3">
                  <div><p className="text-sm font-semibold text-slate-700">{item.label}</p>{item.note && <p className="text-xs text-slate-400">{item.note}</p>}</div>
                  <p className="text-xs font-semibold text-slate-500">{String(item.actual_value ?? item.actual)}{item.required_value != null ? ` / ${item.required_value}` : ""}</p>
                  <StatusBadge value={item.status || (item.complete ? "Passed" : "Not met")} dot={false} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Student submission</p>
            <p className="mt-2 text-sm font-semibold text-ink">{record?.practicum_site || "No site submitted"}</p>
            <p className="mt-1 text-xs text-slate-500">Supervisor: {record?.supervisor_name || "Not provided"}</p>
            <p className="mt-1 text-xs text-slate-500">System-detected certificate submissions: {record?.certificate_count || 0}</p>
            {record?.remarks && <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"><p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Latest student submission remark</p><p className="mt-1 text-sm text-emerald-900">{record.remarks}</p></div>}
            <div className="mt-2 flex flex-wrap gap-2">{record?.moa_attachment?.file_exists && <a className="btn-ghost px-3 py-1.5" href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA <ArrowUpRight className="h-3.5 w-3.5" /></a>}{record?.completion_attachments?.map((file, index) => file.file_exists && <a key={file.id} className="btn-ghost px-3 py-1.5" href={file.url} target="_blank" rel="noreferrer">Certificate file {index + 1} <ArrowUpRight className="h-3.5 w-3.5" /></a>)}{(record?.moa_attachment?.file_exists === false || record?.certificate_attachment?.file_exists === false) && <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">One or more saved files are unavailable</span>}</div>
          </div>
      </div>
      <WorkflowTimeline steps={timeline} title="Practicum workflow timeline" />
      <WorkflowFileHistory files={record?.attachments || []} />
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

function WorkflowTable({ headers, rows, render, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

function dateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

function sortWorkflowRows(rows, sort, dateFor, nameFor) {
  return [...rows].sort((left, right) => {
    if (sort === "student") return nameFor(left).localeCompare(nameFor(right));
    const leftDate = new Date(dateFor(left) || 0).getTime();
    const rightDate = new Date(dateFor(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

function sortSelectedWorkflowRows(rows, selectedIds, nameFor, idFor) {
  if (!selectedIds?.size) return rows;
  return [...rows].sort((left, right) => {
    const leftSelected = selectedIds.has(idFor(left));
    const rightSelected = selectedIds.has(idFor(right));
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return nameFor(left).localeCompare(nameFor(right));
    return 0;
  });
}

function StudentCell({ student }) {
  return <td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p></td>;
}

function PracticumForm({ context, studentId, submit, submitting }) {
  const selected = context.selected_student;
  const current = context.practicum_record;
  const [form, setForm] = useState({
    moa_status: "Uploaded",
    moa_uploaded: "true",
    practicum_site: "",
    required_hours: 200,
    completed_hours: 0,
    document_status: "Pending Review",
    status: "Under Review",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      moa_status: current?.moa_status || "Uploaded",
      moa_uploaded: current?.moa_uploaded ? "true" : "true",
      practicum_site: current?.practicum_site || "",
      required_hours: current?.required_hours || 200,
      completed_hours: current?.completed_hours || 0,
      document_status: current?.document_status || "Pending Review",
      status: current?.status || "Under Review",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (selected && !selected.program_has_practicum) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Practicum not required"
        hint={`${selected.program_code} is outside the Psychology and MSGC practicum scope.`}
      />
    );
  }

  const completeEnough = Number(form.completed_hours || 0) >= Number(form.required_hours || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process practicum submission" subtitle="Record MOA receipt, certificate review, hours, and Dean report status" icon={Briefcase} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{current.practicum_site || "Practicum site not set"}</p>
              <p className="text-xs text-slate-500">{current.completed_hours}/{current.required_hours} hours · {current.certificate_count} certificate(s)</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MOA status">
          <Select value={form.moa_status} onChange={set("moa_status")} placeholder="" options={["Uploaded", "Pending Review", "Verified", "Returned", "Missing"]} />
        </Field>
        <Field label="Practicum site / company" required>
          <Input value={form.practicum_site} onChange={set("practicum_site")} required />
        </Field>
        <Field label="Required hours" required>
          <Input type="number" min="1" value={form.required_hours} onChange={set("required_hours")} required />
        </Field>
        <Field label="Completed hours" required>
          <Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required />
        </Field>
        <Field label="Certificate/document status">
          <Select value={form.document_status} onChange={set("document_status")} placeholder="" options={["Missing", "Uploaded", "Pending Review", "Verified", "Returned"]} />
        </Field>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Certificates detected by system</p><p className="mt-1 text-lg font-semibold text-emerald-950">{current?.certificate_count || 0}</p></div>
        <Field label="Workflow status">
          <Select
            value={form.status}
            onChange={set("status")}
            placeholder=""
            options={["MOA Received", "Under Review", "Hours Incomplete", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} placeholder="Email, drive link, or staff note" />
        </Field>
      </div>
      <p className="text-xs text-slate-500">Reviewer comments are added through the case discussion so the sender, recipient, date, and time remain visible.</p>
      {!completeEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Completed hours are below the requirement. Saving will keep this case incomplete and queue the student for additional certificates.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save practicum status</SubmitButton>
    </form>
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
