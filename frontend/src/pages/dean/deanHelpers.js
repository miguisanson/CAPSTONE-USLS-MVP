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
