import {
  Briefcase,
  CalendarCheck,
  CalendarOff,
  FileCheck,
  GraduationCap,
  LogOut,
  UserCheck,
  UserX,
} from "lucide-react";
import { PAGE } from "../../lib/labels.js";
import { defenseScheduleLocked } from "../../lib/studentHome.js";

export const REQUEST_GROUPS = [
  {
    title: "Research & Defense",
    description: "Upload your milestone files, submit them for review, then request scheduling after a panel is assigned.",
    items: [
      { id: "research", label: PAGE.researchProgress, icon: FileCheck },
      {
        id: "schedule",
        label: PAGE.defenseSchedule,
        icon: CalendarCheck,
        lockedWhen: defenseScheduleLocked,
        lockedReason: "Available after research staff opens your research case and completes panel matching.",
      },
    ],
  },
  {
    title: "Requests", // the sidebar's heading for these four pages (I-178)
    description: "Submit a standalone standing-change or subject-withdrawal request.",
    items: [
      { id: "loa", label: PAGE.leaveOfAbsence, icon: CalendarOff },
      {
        id: "readmission",
        label: PAGE.readmission,
        icon: UserCheck,
        lockedWhen: (data) => {
          const overview = data.leave_overview;
          if (!overview) return data.student.standing !== "On Leave" && data.student.current_stage !== "LOA";
          // Keep the page open once any readmission exists, so an approved or denied one can still be read.
          const hasReadmission = (overview.cases || []).some((item) => item.kind === "READMISSION");
          return !overview.can_file?.readmission?.allowed && !hasReadmission;
        },
        lockedReason: "Available only after an approved Leave of Absence.",
        lockedReasonFrom: (data) => data.leave_overview?.can_file?.readmission?.reason,
      },
      {
        id: "awol",
        label: PAGE.returnFromAwol,
        icon: UserX,
        lockedWhen: (data) => data.student.enrollment_tag !== "AWOL" && data.student.standing !== "AWOL",
        lockedReason: "Available only while your student record is marked AWOL.",
      },
      { id: "withdrawal", label: PAGE.subjectWithdrawal, icon: LogOut },
    ],
  },
  {
    title: "Completion",
    description: "Submit practicum evidence when required and request Graduate School graduation endorsement review.",
    items: [
      {
        id: "practicum",
        label: PAGE.practicum,
        icon: Briefcase,
        lockedWhen: (data) => !data.student.program_has_practicum,
        lockedReason: "Practicum is available only to Psychology and Master of Science in Guidance and Counseling (MSGC) students.",
      },
      {
        id: "graduation",
        label: PAGE.graduationEndorsement,
        icon: GraduationCap,
        // Owner 2026-11-08: for a program with a practicum, the application opens only after the Dean approves the
        // practicum completion. An application already on file stays visible.
        lockedWhen: (data) => {
          const gate = data.graduation_eligibility?.practicum_gate;
          return Boolean(gate?.required && !gate.dean_approved && !data.graduation_endorsement);
        },
        lockedReason: "The graduation application opens after the Dean approves your practicum completion.",
        lockedReasonFrom: (data) => data.graduation_eligibility?.practicum_gate?.message,
      },
    ],
  },
];

// Route for every request page (used by the Request Center, the Inbox
// "Open request" buttons and anywhere else that deep-links into a request).
export const STUDENT_REQUEST_PATHS = {
  research: "/student/research",
  schedule: "/student/defense-schedule",
  loa: "/student/requests/leave-of-absence",
  readmission: "/student/requests/readmission",
  awol: "/student/requests/awol-return",
  withdrawal: "/student/requests/withdrawal",
  practicum: "/student/practicum",
  graduation: "/student/graduation",
};

// The plain-words reason a request is locked: the server's own reason when it gave one.
export function lockedReasonFor(item, data) {
  return item.lockedReasonFrom?.(data) || item.lockedReason;
}

// One word for "nothing has been filed yet" on every student request page (the server says "Not Submitted" for a
// practicum or graduation record, and "No request" was written by hand elsewhere).
export const NOT_SUBMITTED = "Not submitted";
export function requestStateLabel(status) {
  return !status || /^(no request|not submitted)$/i.test(String(status).trim()) ? NOT_SUBMITTED : status;
}

export const REQUEST_ITEMS = REQUEST_GROUPS.flatMap((group) => group.items);
export function findRequestItem(id) {
  return REQUEST_ITEMS.find((item) => item.id === id) || null;
}
