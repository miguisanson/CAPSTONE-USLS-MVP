import { createContext, useContext, useMemo } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  BookOpenCheck,
  BookPlus,
  Briefcase,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarOff,
  ClipboardCheck,
  FileCheck,
  FileSignature,
  FileText,
  FileUp,
  GraduationCap,
  History,
  Inbox,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MailCheck,
  Scale,
  Send,
  SlidersHorizontal,
  UserCheck,
  UserRound,
  UserRoundCheck,
  Users,
  UserX,
} from "lucide-react";
import { PAGE } from "../lib/labels.js";

// Navigation for the role portals (student, dean, faculty). Staff, admin and
// the coordinators keep their own groups in Layout.jsx. Every role renders in
// the same Layout shell; roles differ only in WHICH items they see.
//
// Item fields: to, label, icon, end, matches (extra path prefixes that keep the
// item highlighted, e.g. detail pages), badge (key into the portal counts) and
// hideWhen (key into the portal flags; the item is hidden when the flag is true).

export const STUDENT_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/student", label: PAGE.dashboard, icon: LayoutDashboard, end: true },
      { to: "/student/progress", label: PAGE.myProgress, icon: ListChecks },
    ],
  },
  {
    label: "Academics",
    items: [
      { to: "/student/enrollment", label: PAGE.enrollment, icon: BookPlus },
      { to: "/student/practicum", label: PAGE.practicum, icon: Briefcase, hideWhen: "noPracticum" },
      { to: "/student/graduation", label: PAGE.graduationEndorsement, icon: GraduationCap },
    ],
  },
  {
    // Adviser, defense schedule and calendar are steps of the research flow, not processes of their own.
    label: "Research",
    items: [
      { to: "/student/research", label: PAGE.researchProgress, icon: FileCheck },
      { to: "/student/adviser", label: PAGE.researchAdviser, icon: UserRoundCheck },
      { to: "/student/defense-schedule", label: PAGE.defenseSchedule, icon: CalendarCheck },
      { to: "/student/calendar", label: PAGE.researchCalendar, icon: CalendarDays },
    ],
  },
  {
    label: "Requests",
    items: [
      { to: "/student/requests", label: PAGE.requestCenter, icon: Send, end: true },
      { to: "/student/requests/leave-of-absence", label: PAGE.leaveOfAbsence, icon: CalendarOff },
      { to: "/student/requests/readmission", label: PAGE.readmission, icon: UserCheck },
      { to: "/student/requests/awol-return", label: PAGE.returnFromAwol, icon: UserX },
      { to: "/student/requests/withdrawal", label: PAGE.subjectWithdrawal, icon: LogOut },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/student/messages", label: PAGE.messages, icon: Mail, badge: "unreadMessages" },
      { to: "/student/documents", label: PAGE.documents, icon: FileUp },
      { to: "/student/activity", label: PAGE.activityLog, icon: History },
      { to: "/student/assistant", label: PAGE.assistant, icon: Bot },
      { to: "/student/profile", label: PAGE.myProfile, icon: UserRound },
    ],
  },
];

export const DEAN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dean", label: PAGE.dashboard, icon: LayoutDashboard, end: true }],
  },
  {
    label: "Approvals",
    items: [
      // The queue also holds the adviser-designation decisions (research flow) as one more process group.
      { to: "/dean/approvals", label: PAGE.approvalsQueue, icon: Inbox, end: true, matches: ["/dean/case"], badge: "pendingTotal" },
      { to: "/dean/approvals/course-adjustments", label: PAGE.courseAdjustments, icon: SlidersHorizontal, badge: "pendingPlans" },
      { to: "/dean/approvals/leave-of-absence", label: PAGE.leaveOfAbsence, icon: CalendarOff, badge: "pendingLeaveOfAbsence" },
      { to: "/dean/approvals/readmission", label: PAGE.readmission, icon: UserCheck, badge: "pendingReadmission" },
      { to: "/dean/approvals/awol", label: PAGE.awolResidency, icon: UserX, badge: "pendingAwol" },
      { to: "/dean/approvals/withdrawal", label: PAGE.subjectWithdrawal, icon: LogOut, badge: "pendingWithdrawal" },
      { to: "/dean/approvals/practicum", label: PAGE.practicumReports, icon: Briefcase, badge: "pendingPracticum" },
      { to: "/dean/approvals/graduation", label: PAGE.graduationEndorsement, icon: GraduationCap, badge: "pendingGraduation" },
      { to: "/dean/gate-reports", label: PAGE.gateReports, icon: ClipboardCheck },
    ],
  },
  {
    label: "Monitoring & Support",
    items: [
      { to: "/dean/analytics", label: PAGE.reportsAnalytics, icon: BarChart3 },
      { to: "/dean/activity", label: PAGE.activityLog, icon: Activity },
      { to: "/dean/assistant", label: PAGE.assistant, icon: Bot },
      { to: "/dean/business-rules", label: PAGE.businessRules, icon: Scale },
    ],
  },
];

export const FACULTY_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/faculty-portal", label: PAGE.dashboard, icon: LayoutDashboard, end: true }],
  },
  {
    label: "Advising & Research",
    items: [
      { to: "/faculty-portal/advisees", label: PAGE.myAdvisees, icon: Users, badge: "pendingAdviserRequests" },
      { to: "/faculty-portal/signatures", label: PAGE.signatures, icon: FileSignature, badge: "pendingSignatures" },
      { to: "/faculty-portal/panels", label: PAGE.panelAssignments, icon: FileText },
      { to: "/faculty-portal/invitations", label: PAGE.panelInvitations, icon: MailCheck, badge: "pendingInvitations" },
      { to: "/faculty-portal/defenses", label: PAGE.defenseSchedule, icon: CalendarClock },
      { to: "/faculty-portal/calendar", label: PAGE.myCalendar, icon: CalendarDays },
      { to: "/faculty-portal/availability", label: PAGE.myAvailability, icon: CalendarCheck },
      { to: "/faculty-portal/verdicts", label: PAGE.verdicts, icon: Scale, badge: "pendingVerdicts" },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: "/faculty-portal/classes", label: PAGE.assignedClasses, icon: BookOpenCheck },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/faculty-portal/assistant", label: PAGE.assistant, icon: Bot },
      { to: "/faculty-portal/business-rules", label: PAGE.businessRules, icon: BookOpenCheck },
    ],
  },
];

export const PORTAL_NAV = {
  student: STUDENT_NAV_GROUPS,
  dean: DEAN_NAV_GROUPS,
  faculty: FACULTY_NAV_GROUPS,
};

export const PORTAL_FOOTERS = {
  student: "Your record updates as staff act on your requests. Nothing here changes official grades or enrollment.",
  dean: "Every decision is recorded against your account with the date and time.",
  faculty: "You see only the advisees and panels assigned to you.",
};

// Counts and flags a role portal publishes so the sidebar can show
// "what needs my action" badges and hide items that do not apply.
const PortalNavContext = createContext({ counts: {}, flags: {} });

export function PortalNavProvider({ counts, flags, children }) {
  const value = useMemo(() => ({ counts: counts || {}, flags: flags || {} }), [counts, flags]);
  return <PortalNavContext.Provider value={value}>{children}</PortalNavContext.Provider>;
}

export function usePortalNav() {
  return useContext(PortalNavContext);
}

// Finds the nav item (and its group) for a path: an exact/nested match on `to`,
// or a `matches` prefix. Longest match wins so /dean/approvals/withdrawal beats
// /dean/approvals.
export function findNavItem(groups, pathname) {
  let best = null;
  for (const group of groups || []) {
    for (const item of group.items) {
      const prefixes = [item.to, ...(item.matches || [])];
      for (const prefix of prefixes) {
        const hit = pathname === prefix || (!item.end || prefix !== item.to ? pathname.startsWith(`${prefix}/`) : false);
        if (hit && (!best || prefix.length > best.length)) best = { group, item, length: prefix.length };
      }
    }
  }
  return best;
}
