// The one status -> tone map (UI-SPEC section 3a, idea X-01). Every status word in the app belongs to exactly one of
// the five tones in lib/tone.js. Plain JavaScript on purpose: Node can import it (scripts/status.test.mjs).
//
// Rules: the client map wins; the server's `status_tone` (good / warn / bad / info / muted) is used only for a
// string that is not in the map; lookup is case-insensitive and trimmed ("active" = "Active"); an unknown string
// is "neutral" and logs one console.warn per value in development. Decision AD2: every "Returned..." status is
// warning (a person must act), never danger.
export const STATUS_GROUPS = {
  success: ["On Track","Active","Confirmed","Scheduled","Appointed","Accepted","Answered","Entered","Ready",
    "Verified Complete","Dean Reviewed","Subject Tagged - Registrar Preparation","Implemented","Withdrawn Confirmed",
    "Cleared","Record Updated","Passed","Pass","Present","Eligible","Eligible to Return","Compliant","Open","Complete",
    "Completed","Verified","Verified by staff","Done","Generated","Synced","Published","Offered","Sent to Registrar",
    "Dean Approved","Active planning","Approved","Taken","Endorsed","Acknowledged","Return Approved",
    "Extension Approved - Refresher Required","Re-enrollment Completed","Revisions confirmed"],
  warning: ["At Risk of Delay","On Leave","Withdrawal In Progress","LOA","Needs Availability","Deferred","Defense Deferred",
    "Needs Re-confirmation","Revisions Pending","Under deliberation","Not entered","Revisions Required",
    "Pending Staff Action","Pending Review","MOA Under Review","Under Review","Dean Review","For Dean Review",
    "Ready for Dean Review","Pending Handoff","Needs Review","Needs Revision","Pending","INC","Incomplete",
    "Pending staff verification","Pending panel matching","Pending confirmed schedule","Pending Subject Tag",
    "Pending Excel Export","Sync pending","Needs generation","Needs verification","Requirements Pending",
    "Awaiting Implementation","Approved - Awaiting Subject Tag","Return Due","Re-enrollment Required",
    "Pending scheduling","Awaiting revisions","Revisions Submitted - Awaiting Confirmation",
    "Returned","Returned for Revision","Returned for Clarification","Returned to student"],
  danger: ["Delayed","AWOL","AWOL Declared","Denied","Return Denied","Declined","Not approved","Not Cleared","Not met","Fail",
    "Failed","Missing","Missing Requirements","Hours Incomplete","Additional Certificates Requested","Overdue",
    "Upload required","Not Enough Evidence",
    "Not Accepted - New Organization Required","Re-defense Required","Resubmission Required","Expired"],
  info: ["Submitted","Submitted to GS Staff","Staff Review","Return Submitted","Submitted for review","Documents Submitted",
    "Awaiting Review","For Review","MOA Submitted","MOA Received","Report Sent to Dean","Applied","Noted by AC","Uploaded",
    "Invited","Rescheduled","Enrolled","Current","Planned","Upcoming","Suggested","Practicum In Progress",
    "Waiting for student submission","Requirements Verified","Exported - Ready to Send","Approved - Follow-through",
    "Approved - Registrar Preparation","Sent - Awaiting Receipt","Leave Scheduled","Residency","Eligible to take",
    "Revisions submitted"],
  neutral: ["Not Yet Assessed","Withdrawn","Held","Ended","Closed","Archived","Not set","Waiting for student files",
    "Not taken","Not Taken","Not Started","Not Enrolled","Draft","Not Offered","No decision","Not Required","Not Eligible",
    "Not eligible","Not Ready","Cancelled","Residency Completed","Dropped"],
};

/** lower-cased status -> tone name. */
export const STATUS_TONE = Object.fromEntries(
  Object.entries(STATUS_GROUPS).flatMap(([tone, list]) => list.map((status) => [status.toLowerCase(), tone])),
);

/** The server's `status_tone` words -> tone names. */
export const SERVER_TONE = { good: "success", warn: "warning", bad: "danger", info: "info", muted: "neutral" };

const warned = new Set();
const isDev = () => typeof import.meta !== "undefined" && Boolean(import.meta.env && import.meta.env.DEV);

/**
 * The tone ("success" | "warning" | "danger" | "info" | "neutral") for a status string.
 * `serverTone` is the backend's hint and is only used when the string is not in the client map.
 */
export function statusTone(value, serverTone) {
  const key = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (key && STATUS_TONE[key]) return STATUS_TONE[key];
  const hint = typeof serverTone === "string" ? serverTone.trim().toLowerCase() : "";
  if (SERVER_TONE[hint]) return SERVER_TONE[hint];
  if (key && isDev() && !warned.has(key)) {
    warned.add(key);
    console.warn("[status] unmapped:", value);
  }
  return "neutral";
}
