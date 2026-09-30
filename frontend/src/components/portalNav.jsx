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
      { to: "/student", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/student/progress", label: "My Progress", icon: ListChecks },
    ],
  },
  {
    label: "Academics",
    items: [
      { to: "/student/enrollment", label: "Enrollment", icon: BookPlus },
      { to: "/student/research", label: "Research", icon: FileCheck },
      { to: "/student/adviser", label: "Research Adviser", icon: UserRoundCheck },
      { to: "/student/defense-schedule", label: "Defense Schedule", icon: CalendarCheck },
      { to: "/student/calendar", label: "Research Calendar", icon: CalendarDays },
      { to: "/student/practicum", label: "Practicum", icon: Briefcase, hideWhen: "noPracticum" },
      { to: "/student/graduation", label: "Graduation", icon: GraduationCap },
    ],
  },
  {
    label: "Requests",
    items: [
      { to: "/student/requests", label: "Request Center", icon: Send, end: true },
      { to: "/student/requests/leave-of-absence", label: "Leave of Absence", icon: CalendarOff },
      { to: "/student/requests/readmission", label: "Readmission", icon: UserCheck },
      { to: "/student/requests/awol-return", label: "Return from AWOL", icon: UserX },
      { to: "/student/requests/withdrawal", label: "Subject Withdrawal", icon: LogOut },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/student/messages", label: "Messages", icon: Mail, badge: "unreadMessages" },
      { to: "/student/documents", label: "Documents", icon: FileUp },
      { to: "/student/activity", label: "Activity History", icon: History },
      { to: "/student/assistant", label: "Policy Assistant", icon: Bot },
      { to: "/student/profile", label: "My Profile", icon: UserRound },
    ],
  },
];

export const DEAN_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/dean", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Approvals",
    items: [
      { to: "/dean/approvals", label: "Approvals Queue", icon: Inbox, end: true, matches: ["/dean/case"], badge: "pendingTotal" },
      { to: "/dean/approvals/course-adjustments", label: "Course Adjustments", icon: SlidersHorizontal, badge: "pendingPlans" },
      { to: "/dean/approvals/leave", label: "Leave / Readmission / AWOL", icon: CalendarOff, badge: "pendingLeave" },
      { to: "/dean/approvals/withdrawal", label: "Withdrawal Requests", icon: LogOut, badge: "pendingWithdrawal" },
      { to: "/dean/approvals/practicum", label: "Practicum Reports", icon: Briefcase, badge: "pendingPracticum" },
      { to: "/dean/approvals/graduation", label: "Graduation Endorsement", icon: GraduationCap, badge: "pendingGraduation" },
      { to: "/dean/adviser-appointments", label: "Adviser Appointments", icon: UserRoundCheck, badge: "pendingAdviser" },
      { to: "/dean/gate-reports", label: "Admission & Coursework Reports", icon: ClipboardCheck },
    ],
  },
  {
    label: "Monitoring & Support",
    items: [
      { to: "/dean/calendar", label: "Defense Calendar", icon: CalendarDays },
      { to: "/dean/analytics", label: "Reports & Analytics", icon: BarChart3 },
      { to: "/dean/activity", label: "Decision History", icon: Activity },
      { to: "/dean/assistant", label: "Policy Assistant", icon: Bot },
      { to: "/dean/business-rules", label: "Business Rules", icon: Scale },
    ],
  },
];

export const FACULTY_NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/faculty-portal", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Advising & Research",
    items: [
      { to: "/faculty-portal/advisees", label: "My Advisees", icon: Users, badge: "pendingAdviserRequests" },
      { to: "/faculty-portal/signatures", label: "Signatures & Endorsements", icon: FileSignature, badge: "pendingSignatures" },
      { to: "/faculty-portal/panels", label: "Panel Assignments & Papers", icon: FileText },
      { to: "/faculty-portal/invitations", label: "Panel Invitations", icon: MailCheck, badge: "pendingInvitations" },
      { to: "/faculty-portal/defenses", label: "Defense Schedule", icon: CalendarClock },
      { to: "/faculty-portal/verdicts", label: "Verdicts", icon: Scale, badge: "pendingVerdicts" },
    ],
  },
  {
    label: "Teaching",
    items: [
      { to: "/faculty-portal/classes", label: "Assigned Classes", icon: BookOpenCheck },
      { to: "/faculty-portal/calendar", label: "My Calendar", icon: CalendarDays },
      { to: "/faculty-portal/availability", label: "My Availability", icon: CalendarCheck },
    ],
  },
  {
    label: "Support",
    items: [
      { to: "/faculty-portal/assistant", label: "Policy Assistant", icon: Bot },
      { to: "/faculty-portal/business-rules", label: "Business Rules", icon: BookOpenCheck },
    ],
  },
];

export const PORTAL_NAV = {
  student: STUDENT_NAV_GROUPS,
  dean: DEAN_NAV_GROUPS,
  faculty: FACULTY_NAV_GROUPS,
};

export const PORTAL_ROLE_HOME = {
  student: "/student",
  dean: "/dean",
  faculty: "/faculty-portal",
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
