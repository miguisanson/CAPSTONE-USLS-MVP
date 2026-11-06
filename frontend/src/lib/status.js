// The one status -> tone map (UI-SPEC section 3a, idea X-01). Every status word in the app belongs to exactly one of
// the seven tones in lib/tone.js (the legend on every board explains them, I-358). Plain JavaScript on purpose: Node can import it (scripts/status.test.mjs).
//
// Rules: the client map wins; the server's `status_tone` (good / warn / bad / info / muted) is used only for a
// string that is not in the map; lookup is case-insensitive and trimmed ("active" = "Active"); an unknown string
// is "neutral" and logs one console.warn per value in development. Decision AD2: every "Returned..." status is
// attention (orange: a person must act), never danger (red). "Approved" (a decision, green) and "Passed" (a result, teal) differ on purpose.
export const STATUS_GROUPS = {
  // Green: a decision was made yes, or the record is healthy. Not the same as a finished result (done).
  success: ["On Track","Active","Confirmed","Scheduled","Appointed","Accepted","Ready","Implemented","Offered","Dean Approved",
    "Active planning","Approved","Endorsed","Return Approved","Extension Approved - Refresher Required","Eligible",
    "Eligible to Return"],
  // Teal: a result or a finish - passed, completed, graduated, verified, sent.
  // "Present" / "Provided" sit with "Pass" because the policy-check rows show them side by side (same kind, same look).
  done: ["Passed","Pass","Present","Provided","Complete","Completed","Graduated","Verified","Verified Complete","Verified by staff","Done","Cleared",
    "Compliant","Taken","Received","Record Updated","Withdrawn Confirmed","Re-enrollment Completed","Generated","Synced",
    "Published","Sent to Registrar","Entered","Answered","Revisions confirmed","Dean Reviewed",
    "Subject Tagged - Registrar Preparation","Acknowledged","Registrar Received"],
  // Amber: waiting for someone, or being reviewed.
  warning: ["At Risk of Delay","On Leave","Withdrawal In Progress","LOA","Deferred","Defense Deferred","Under deliberation",
    "Not entered","Pending Staff Action","Pending Review","MOA Under Review","Under Review","Dean Review","For Dean Review",
    "Ready for Dean Review","Pending Handoff","Needs Review","Pending","INC","Incomplete","Pending staff verification",
    "Pending panel matching","Pending confirmed schedule","Pending Subject Tag","Pending Excel Export","Sync pending",
    "Needs generation","Needs verification","Awaiting Implementation","Approved - Awaiting Subject Tag","Pending scheduling",
    "Revisions Submitted - Awaiting Confirmation","Staff Review","Awaiting Review","For Review","Absent without leave","Behind schedule"],
  // Orange: sent back, or something is missing - a person must act (AD2: never red).
  attention: ["Returned","Returned for Revision","Returned for Clarification","Returned to student","Needs Revision",
    "Revisions Required","Revisions Pending","Resubmission Required","Needs Re-confirmation","Return Due","Upload required",
    "Missing Requirements","Additional Certificates Requested","Hours Incomplete","Re-enrollment Required",
    "Requirements Pending","Needs Availability","Awaiting revisions","Waiting on you"],
  // Red: refused, failed, or gone wrong.
  danger: ["Delayed","AWOL","AWOL Declared","Denied","Return Denied","Declined","Not approved","Not Cleared","Not met","Fail",
    "Failed","Missing","Overdue","Not Enough Evidence","Blocked","Not Accepted - New Organization Required",
    "Re-defense Required","Expired"],
  // Blue: sent in or open, work is under way.
  info: ["Submitted","Submitted to GS Staff","Return Submitted","Submitted for review","Documents Submitted","Open",
    "MOA Submitted","MOA Received","Report Sent to Dean","Applied","Noted by AC","Uploaded","Invited","Rescheduled","Enrolled",
    "Current","Planned","Upcoming","Suggested","Practicum In Progress","Waiting for student submission","Requirements Verified",
    "Exported - Ready to Send","Approved - Follow-through","Approved - Registrar Preparation","Sent - Awaiting Receipt",
    "Leave Scheduled","Residency","Eligible to take","Revisions submitted","Waiting"],
  // Grey: closed, stopped, or not started.
  neutral: ["Not Yet Assessed","Withdrawn","Held","Ended","Closed","Archived","Not set","Waiting for student files",
    "Not taken","Not Taken","Not Started","Not Enrolled","Draft","Not Offered","No decision","Not Required","Not Eligible",
    "Not eligible","Not Ready","Cancelled","Residency Completed","Dropped"],
};

/** lower-cased status -> tone name. */
export const STATUS_TONE = Object.fromEntries(
  Object.entries(STATUS_GROUPS).flatMap(([tone, list]) => list.map((status) => [status.toLowerCase(), tone])),
);

/** Server status words that are jargon, shown in words (the tone still follows the original). */
const STATUS_LABEL = { "noted by ac": "Noted by Academic Coordinator" };
/** On a student's own pages the red words read as blame: say them plainly and in amber. */
const STUDENT_WORDS = { "awol declared": "Absent without leave", awol: "Absent without leave", delayed: "Behind schedule" };
export const forStudent = (status) => STUDENT_WORDS[String(status || "").trim().toLowerCase()] || status;

export const statusLabel = (status) => STATUS_LABEL[String(status || "").trim().toLowerCase()] || status;

/** The server's `status_tone` words -> tone names. */
export const SERVER_TONE = { good: "success", warn: "warning", bad: "danger", info: "info", muted: "neutral" };

const warned = new Set();
const isDev = () => typeof import.meta !== "undefined" && Boolean(import.meta.env && import.meta.env.DEV);

/**
 * The tone ("success" | "done" | "warning" | "attention" | "danger" | "info" | "neutral") for a status string.
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
