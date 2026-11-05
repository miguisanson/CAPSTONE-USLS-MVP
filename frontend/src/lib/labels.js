// One name per page (I-077, I-078; review findings F-23, F-24). The sidebar link, the breadcrumb and the page's own
// title (its main heading) all use the string from this table, so a page can never be called two things.
// Title Case everywhere. A page that has several readers (staff, dean, student) keeps ONE name for the same job.
// Plain JavaScript on purpose (no JSX): Node tests can import it.

/** The first part of every breadcrumb: "<Portal name> > <Page name>". */
export const PORTAL_NAMES = Object.freeze({
  student: "Student Portal",
  dean: "Dean Portal",
  faculty: "Faculty Portal",
  staff: "Graduate School Staff Portal",
  academic_coordinator: "Academic Coordinator Portal",
  research_coordinator: "Research Coordinator Portal",
  admin: "Administrator Portal",
});

/** Every page name used by a sidebar link, a breadcrumb or a page title. */
export const PAGE = Object.freeze({
  // shared by every role
  dashboard: "Dashboard",
  assistant: "Policy Assistant",
  businessRules: "Business Rules",
  activityLog: "Activity Log",
  reportsAnalytics: "Reports & Analytics",
  defenseSchedule: "Defense Schedule",
  enrollment: "Enrollment",
  practicum: "Practicum",
  graduationEndorsement: "Graduation Endorsement",
  // the processes (the same name for the student, the staff and the Dean)
  leaveOfAbsence: "Leave of Absence",
  readmission: "Readmission",
  awolResidency: "AWOL & Residency",
  subjectWithdrawal: "Subject Withdrawal",
  courseAdjustments: "Course Adjustments",
  // graduate school staff, coordinators, administrator
  academicSemesters: "Academic Semesters",
  students: "Students",
  faculty: "Faculty",
  monitoringSheet: "Monitoring Sheet",
  enrollmentClassList: "Enrollment Class List",
  studentHandoff: "Student Handoff",
  defenseScheduling: "Defense Scheduling",
  courseAudit: "Course Audit",
  researchGate: "Research Gate",
  panelMatching: "Panel Matching",
  workQueue: "Work Queue",
  policyDocuments: "Policy Documents",
  form1Endorsements: "Form 1 Endorsements",
  // student portal
  myProgress: "My Progress",
  researchProgress: "Research Progress",
  researchAdviser: "Research Adviser",
  researchCalendar: "Research Calendar",
  requestCenter: "Request Center",
  returnFromAwol: "Return from AWOL",
  messages: "Messages",
  documents: "Documents",
  myProfile: "My Profile",
  // dean portal
  approvalsQueue: "Approvals Queue",
  practicumReports: "Practicum Reports",
  gateReports: "Admission & Coursework Reports",
  // faculty portal
  myAdvisees: "My Advisees",
  signatures: "Signatures & Endorsements",
  panelAssignments: "Panel Assignments & Papers",
  panelInvitations: "Panel Invitations",
  myCalendar: "My Calendar",
  myAvailability: "My Availability",
  verdicts: "Verdicts",
  assignedClasses: "Assigned Classes",
});

/** A numbered step of the staff lifecycle: the sidebar shows "3 · Enrollment"; the page and breadcrumb say "Enrollment". */
export const stepLabel = (number, name) => `${number} · ${name}`;
export const withoutStep = (label) => String(label || "").replace(/^\d+\s*·\s*/, "").trim();

/** App path -> the page's name, for every page a task or a link can open. */
export const PAGE_BY_PATH = Object.freeze({
  "/workflow/awol": PAGE.awolResidency,
  "/workflow/readmission": PAGE.readmission,
  "/workflow/leave-of-absence": PAGE.leaveOfAbsence,
  "/workflow/withdrawal": PAGE.subjectWithdrawal,
  "/workflow/practicum": PAGE.practicum,
  "/workflow/graduation": PAGE.graduationEndorsement,
  "/workflow/research-gate": PAGE.researchGate,
  "/workflow/panel-matching": PAGE.panelMatching,
  "/workflow/defense-scheduling": PAGE.defenseScheduling,
  "/workflow/student-handoff": PAGE.studentHandoff,
  "/course-adjustments": PAGE.courseAdjustments,
  "/work-queue": PAGE.workQueue,
});

/** "Open <page name>" for a button that leads to an app path; the page name always comes from this file (I-116).
 *  `fallback` is used for a path this file does not know. */
export function openPageLabel(path, fallback = "Open") {
  const clean = String(path || "").split(/[?#]/)[0];
  const name = PAGE_BY_PATH[clean] || (clean.startsWith("/students/") ? "Student Record" : "");
  return name ? `Open ${name}` : fallback;
}

/** The extra last part of a breadcrumb on a record page that is not in the sidebar. */
export const RECORD_LABELS = Object.freeze({
  "/students": "Student Record",
  "/dean/case": "Case",
});
