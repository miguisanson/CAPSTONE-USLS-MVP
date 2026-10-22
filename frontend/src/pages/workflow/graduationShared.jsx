import { CheckCircle2, Eye } from "lucide-react";
import { StatusChip } from "../../components/ui/index.js";
import { uniqueValues } from "./shared";

export const GRADUATION_STAGE_ACTIONS = {
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

export function graduationStageActionForRow(row, accountRole) {
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

export function graduationStageSelection(rows, accountRole) {
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

export function graduationBatchActionLabel(action) {
  if (!action) return "No action due";
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

export function graduationRowStatus(row) {
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

export function graduationBatchGroups(rows, selectedIds = new Set()) {
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

export function graduationBatchCurrentStage(group) {
  const stages = graduationBatchStageChecks(group);
  return stages.find((stage) => ["Needs action", "Current", "Mixed", "Pending"].includes(stage.state)) || stages[stages.length - 1];
}

export function GraduationBatchStageCheck({ group, compact = false, onViewStage }) {
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
            <StatusChip status={`${completed}/${stages.length}`} dot={false} />
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
        <StatusChip status={`Step ${currentStage.number}: ${currentStage.state}`} dot={false} />
      </div>
      <ol className="mt-3 grid w-full grid-cols-1 gap-2 2xl:grid-cols-2">
        {stages.map((stage) => (
          <li key={stage.label} className="flex w-full max-w-none gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${stage.state === "Complete" ? "bg-brand-600 text-white" : stage.state === "Current" ? "bg-amber-100 text-amber-800" : stage.state === "Needs action" ? "bg-red-100 text-red-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}>{stage.number}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-800">{stage.label}</p>
                <StatusChip status={stage.state} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function GraduationRequirementBoxes({ row }) {
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

export function GraduationCompletedCourseworkView({ row, id }) {
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
        <StatusChip status={row.eligibility?.coursework_status || "Needs verification"} dot={false} />
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
                <p className="mt-1 text-2xs text-slate-500">
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

export function GraduationResearchRequirementsView({ row, id }) {
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
        <StatusChip status={row.eligibility?.research_status || "Needs verification"} dot={false} />
      </div>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">
        {stages.map((stage) => (
          <div key={stage.gate} className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">{stage.name}</p>
              <StatusChip status={stage.complete ? "Complete" : "Incomplete"} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">{researchStageDetailLine(stage)}</p>
          </div>
        ))}
        {completion && (
          <div className="rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink">Completion Evidence</p>
              <StatusChip status={completion.status || (completion.complete ? "Complete" : "Incomplete")} dot={false} />
            </div>
            <p className="mt-1 text-xs text-slate-600">Requirements {completion.requirements_complete ?? 0}/{completion.requirements_total ?? 0}</p>
          </div>
        )}
      </div>
    </section>
  );
}

export function GraduationPracticumCompletionView({ row, id }) {
  const details = row.eligibility?.practicum_completion || {};
  if (!details.required) {
    return (
      <section id={id} className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3" aria-label={`Practicum completion details for ${row.student.name}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Practicum completion details</p>
            <p className="mt-1 text-sm text-slate-700">This student’s program does not require practicum.</p>
          </div>
          <StatusChip status="Not Required" dot={false} />
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
          <StatusChip status={details.status || "Missing"} dot={false} />
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
        <StatusChip status={details.status || "Needs verification"} dot={false} />
      </div>
      <dl className="mt-3 grid gap-2 sm:grid-cols-2">
        {detailItems.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
            <dt className="text-2xs font-bold uppercase tracking-wide text-slate-500">{label}</dt>
            <dd className="mt-1 text-sm font-semibold text-slate-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function sortSelectedWorkflowRows(rows, selectedIds, nameFor, idFor) {
  if (!selectedIds?.size) return rows;
  return [...rows].sort((left, right) => {
    const leftSelected = selectedIds.has(idFor(left));
    const rightSelected = selectedIds.has(idFor(right));
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return nameFor(left).localeCompare(nameFor(right));
    return 0;
  });
}
