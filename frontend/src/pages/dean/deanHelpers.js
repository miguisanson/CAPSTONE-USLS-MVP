import { printDataTable } from "../../lib/print";

export const CLARIFICATION_TEMPLATES = [
  "Please upload the correct document.",
  "The submitted file is unreadable. Please re-upload a clearer copy.",
  "Please complete the missing required fields.",
  "The document needs the proper signature before approval.",
  "Please clarify the information entered in this section.",
  "Returned for revision. Please review the comments and resubmit.",
  "Forwarding this request for dean review.",
  "Sending this back to the previous stage for correction.",
  "Other / Custom comment",
];

export function deanItemDate(item) {
  return item.last_activity_at || item.submitted_at || item.record?.updated_at || "";
}

export function deanDateMatches(value, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true;
  const timestamp = new Date(value || 0).getTime();
  if (!Number.isFinite(timestamp) || timestamp <= 0) return false;
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;
  return (!from || timestamp >= from) && (!to || timestamp <= to);
}

export function sortDeanItems(items, sort) {
  return [...items].sort((left, right) => {
    if (sort === "student") return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    const leftDate = new Date(deanItemDate(left) || 0).getTime();
    const rightDate = new Date(deanItemDate(right) || 0).getTime();
    return sort === "oldest" ? leftDate - rightDate : rightDate - leftDate;
  });
}

export function graduationBatchLabel(item, fallback = "No batch assigned") {
  return item.batch_name || item.record?.batch_name || fallback;
}

export function groupGraduationItemsByBatch(items) {
  const groups = new Map();
  items.forEach((item) => {
    const label = graduationBatchLabel(item);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(item);
  });
  return [...groups.entries()].map(([label, rows]) => ({ label, rows }));
}

export function graduationBatchExportPayload(batch) {
  return {
    batchLabel: batch.label,
    reviewWindow: "",
    endorsementIds: batch.rows.map((item) => item.id),
    count: batch.rows.length,
    rows: batch.rows,
  };
}

export function printGraduationBatch(batch) {
  printDataTable({
    title: `Graduate Endorsement - ${batch.label}`,
    subtitle: "Dean-approved Graduate School endorsement list",
    columns: ["Student ID", "Student name", "Program", "Coursework", "Thesis / research", "Practicum", "Eligibility", "Endorsement status"],
    rows: batch.rows.map((item) => [
      item.student.student_number,
      item.student.name,
      item.student.program_code,
      "Completed",
      "Completed",
      item.eligibility?.practicum_status === "Not Required" ? "Not required" : "Completed",
      "Eligible for graduation",
      item.status,
    ]),
  });
}

export function graduationRegistrarStatus(item) {
  return item.record?.registrar_status || item.registrar_status || "";
}

export function graduationBatchReadyToSend(batch, exportedBatchLabels) {
  return exportedBatchLabels.has(batch.label) || batch.rows.every((item) => graduationRegistrarStatus(item) === "Exported - Ready to Send");
}

export function isReadyForDeanReview(item) {
  const workflowStatus = item.workflow_status || item.status;
  return (
    (item.type === "practicum" && workflowStatus === "Report Sent to Dean")
    || (item.type === "withdrawal" && workflowStatus === "Dean Review")
    || (item.type === "graduation" && item.status === "Ready for Dean Review")
  );
}

export const DEAN_GRADUATION_BATCH_STAGES = [
  {
    label: "Compile graduation list",
    detail: "GS Staff created the candidate batch.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Academic Coordinator checks course completion",
    detail: "Coursework completion was checked before Dean review.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Research Coordinator validates research requirements",
    detail: "Research completion evidence was validated before endorsement.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "GS Staff prepares endorsement list",
    detail: "The endorsement list was prepared or revised for Dean action.",
    completeStatuses: ["Ready for Dean Review", "Dean Approved", "Returned for Revision"],
  },
  {
    label: "Dean reviews endorsement list",
    detail: "Dean approves the batch or returns it for revision.",
    currentStatuses: ["Ready for Dean Review"],
    completeStatuses: ["Dean Approved"],
    attentionStatuses: ["Returned for Revision"],
  },
  {
    label: "Export endorsed list",
    detail: "Dean-approved candidates are available as a CSV download for manual email to the Registrar.",
    currentStatuses: ["Dean Approved"],
    completeStatuses: ["Dean Approved"],
    attentionStatuses: ["Returned for Revision"],
  },
];

export function deanGraduationStageState(stage, batch) {
  const statuses = batch.rows.map((item) => item.status);
  const hasAttention = statuses.some((status) => stage.attentionStatuses?.includes(status));
  const allComplete = statuses.length > 0 && statuses.every((status) => stage.completeStatuses?.includes(status));
  const hasCurrent = statuses.some((status) => stage.currentStatuses?.includes(status));
  if (hasAttention) return "Needs action";
  if (allComplete) return "Complete";
  if (hasCurrent) return "Current";
  return "Pending";
}

export function deanGraduationStageChecks(batch) {
  return DEAN_GRADUATION_BATCH_STAGES.map((stage, index) => ({
    ...stage,
    number: index + 1,
    state: deanGraduationStageState(stage, batch),
  }));
}

export function deanGraduationCurrentStage(batch) {
  const stages = deanGraduationStageChecks(batch);
  return stages.find((stage) => ["Needs action", "Current", "Pending"].includes(stage.state)) || stages[stages.length - 1];
}

export function deanGraduationBatchActionLabel(action) {
  return action === "return" ? "Return endorsement list for revision" : "Approve endorsement list";
}

export function deanGraduationRequirementTone(item) {
  if (item?.passed === true || item?.complete === true || item?.status === "Passed") return "complete";
  return "missing";
}

export function deanGraduationRequirementClasses(tone) {
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

export function deanGraduationRequirementDetailLines(item) {
  const actual = item.actual_value ?? item.actual ?? item.status ?? "Pending";
  const required = item.required_value ?? item.required;
  return [
    String(actual),
    required != null ? `Required: ${String(required)}` : "",
    item.note || "",
  ].filter(Boolean);
}

export function deanGraduationFallbackChecklist(item) {
  const eligibility = item.eligibility || {};
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

export function sortSelectedDeanItems(items, selectedIds) {
  if (!selectedIds?.size) return items;
  return [...items].sort((left, right) => {
    const leftSelected = selectedIds.has(left.student?.id);
    const rightSelected = selectedIds.has(right.student?.id);
    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
    if (leftSelected && rightSelected) return (left.student?.name || left.title || "").localeCompare(right.student?.name || right.title || "");
    return 0;
  });
}

export const DEAN_BOARD_COLUMNS = [
  "New / Submitted",
  "Pending Dean Review",
  "Returned for Revision",
  "Approved / Completed",
  "Rejected / Withdrawn",
];

export function deanBoardGroup(item) {
  const workflowStatus = item.workflow_status || item.status;
  if (["Report Sent to Dean", "Ready for Dean Review", "Dean Review"].includes(workflowStatus)) return "Pending Dean Review";
  if (["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(item.status)
    || ["Returned", "Returned for Clarification", "Returned for Revision", "Additional Certificates Requested"].includes(workflowStatus)) return "Returned for Revision";
  if (["Dean Approved", "Dean Reviewed", "Approved", "Withdrawn Confirmed"].includes(item.status)
    || ["Dean Approved", "Dean Reviewed", "Approved", "Withdrawn Confirmed"].includes(workflowStatus)) return "Approved / Completed";
  if (["Denied", "Rejected", "Cancelled"].includes(item.status) || ["Denied", "Rejected", "Cancelled"].includes(workflowStatus)) return "Rejected / Withdrawn";
  return "New / Submitted";
}
