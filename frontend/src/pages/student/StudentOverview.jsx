import { Link } from "react-router-dom";
import { ArrowRight, Compass, LayoutDashboard, Route } from "lucide-react";
import { SectionCard, Stepper, StatusChip } from "../../components/ui/index.js";
import RoleHome from "../../components/RoleHome.jsx";
import { formatDate, relativeDays } from "../../lib/format";
import { stageSteps } from "../../lib/stages.js";
import { VIEW_LABELS, studentActions, studentActivity, studentTasks, studentWaiting } from "../../lib/studentHome.js";
import { useStudentPortal } from "./StudentPortalContext";
import { STUDENT_REQUEST_PATHS } from "./requestMeta";
import { leaveRequestStatus } from "./LeaveCaseCards";
import { RESEARCH_GATE_KEYS, fmtDay, isLiveSchedule } from "./shared";

// IM19: the student home is action first - what needs the student, four key numbers, recent activity, and the
// lifecycle Stepper. Everything else the old home spelled out (defense schedule, workflow status, leave and
// return cards, deadlines, notifications) is one line here and a link to the page that holds it.

const PATH_LABELS = {
  "/student/messages": "Messages",
  "/student/progress": "My Progress",
  "/student/requests": "Request Center",
  "/student/documents": "Documents",
};

const pathOf = (target) => target?.to || STUDENT_REQUEST_PATHS[target?.view] || "/student/requests";
const labelOf = (target) => PATH_LABELS[target?.to] || VIEW_LABELS[target?.view] || "Open";

function dueText(item) {
  if (!item.dueAt) return undefined;
  if (item.kind === "reply") return `Asked ${formatDate(item.dueAt)}`;
  return `Due ${formatDate(item.dueAt)} (${relativeDays(item.dueAt)})`;
}

function toActionRow(item) {
  return {
    key: item.key,
    title: item.title,
    detail: item.detail,
    meta: dueText(item),
    tone: item.tone,
    chip: item.status ? <StatusChip status={item.status} label={item.statusLabel} dot={false} size="sm" /> : null,
    to: pathOf(item.target),
    linkLabel: labelOf(item.target),
  };
}

// What the defense booking means for the student right now, in one line.
const SCHEDULE_STATE_TEXT = {
  Scheduled: (s) => `Your ${s.defense_type || "defense"} is booked for ${fmtDay(s.preferred_date)}.`,
  Confirmed: (s) => `Your ${s.defense_type || "defense"} is booked for ${fmtDay(s.preferred_date)}.`,
  "Needs Re-confirmation": () => "Your panel changed. Waiting for the Research Coordinator to confirm the date again.",
  Held: (s) => `Your ${s.defense_type || "defense"} took place on ${fmtDay(s.preferred_date)}.`,
  Deferred: () => "Your defense was deferred. Waiting for the Research Coordinator to set a new date.",
  Rescheduled: () => "Your defense was moved. The newer booking replaces this one.",
  Cancelled: () => "Your last booking was cancelled. You can request a new date.",
};

function defenseLine(data) {
  const schedules = data.schedules || [];
  const current = schedules.find(isLiveSchedule) || schedules[0] || null;
  if (!current) return "No defense is booked yet.";
  return (SCHEDULE_STATE_TEXT[current.status] || (() => `Status: ${current.status}.`))(current);
}

function adviserLine(data) {
  const name = data.student?.adviser_name || data.research_case?.adviser_name;
  return name ? `Your research adviser is ${name}.` : "No research adviser appointed yet. You can apply on the page.";
}

// Administrative and completion requests, one line: only the ones that have something to say.
function requestsLine(data) {
  const parts = [];
  if (data.student.program_has_practicum) {
    parts.push(`Practicum: ${data.practicum_record?.status || "Missing"}`);
  }
  if (data.withdrawal_application?.status) parts.push(`Withdrawal: ${data.withdrawal_application.status}`);
  const awol = data.residency_record?.status || data.awol_case?.status;
  if (awol) parts.push(`${data.student.enrollment_tag === "Residency" ? "Residency" : "AWOL / Return"}: ${awol}`);
  parts.push(`Graduation: ${data.graduation_endorsement?.endorsement_status || data.graduation_eligibility?.status || "Needs verification"}`);
  return parts.join(" · ");
}

function leaveLine(data) {
  if (!data.leave_overview) return "Open the page to file a leave of absence or a readmission request.";
  return `Leave of Absence: ${leaveRequestStatus(data, "loa")} · Readmission: ${leaveRequestStatus(data, "readmission")}`;
}

function PageLinks({ data }) {
  const rows = [
    { label: "Defense Schedule", to: STUDENT_REQUEST_PATHS.schedule, line: defenseLine(data) },
    { label: "Research Adviser", to: "/student/adviser", line: adviserLine(data) },
    { label: "Request Center", to: "/student/requests", line: requestsLine(data) },
    { label: "Leave of Absence", to: STUDENT_REQUEST_PATHS.loa, line: leaveLine(data) },
  ];
  return (
    <SectionCard as="section" title="Elsewhere in your portal" subtitle="One line each; open the page for the full detail" icon={Compass}>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li key={row.label} className="py-2.5 first:pt-0 last:pb-0">
            <Link
              to={row.to}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline max-sm:min-h-11"
            >
              {row.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <p className="meta break-words">{row.line}</p>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

function headerDescription(student) {
  return [
    student.program_name,
    student.student_number,
    student.academic_year_entry && `AY entry ${student.academic_year_entry}`,
    student.course_year_label,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function StudentOverview() {
  const { data } = useStudentPortal();
  const { student, course_audit: audit, research_case: researchCase } = data;
  const messages = data.workflow_messages || [];
  const unreadCount = messages.filter((message) => message.is_unread).length;
  const tasks = studentTasks(data); // only the student's own tasks; office-held ones are listed under 'waiting'
  const firstName = student.first_name || student.name.split(" ")[0];

  const actions = studentActions(data, { researchGates: RESEARCH_GATE_KEYS }).map(toActionRow);
  const waiting = studentWaiting(data).map(toActionRow);
  const activity = studentActivity(data).map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: entry.detail,
    time: formatDate(entry.at),
    unread: entry.unread,
    to: entry.target ? pathOf(entry.target) : undefined,
  }));

  return (
    <RoleHome
      header={{
        title: `Welcome, ${firstName}`,
        description: headerDescription(student),
        icon: LayoutDashboard,
        badge: data.progress_status?.level ? <StatusChip status={data.progress_status.level} /> : null,
      }}
      actions={actions}
      actionsSubtitle="What is waiting on you now, most pressing first"
      waiting={{
        title: "Waiting on the Graduate School",
        subtitle: "Offices are working on these. Nothing to do on your side unless they ask.",
        items: waiting,
        all: { to: "/student/requests", label: "View all" },
      }}
      stats={[
        { key: "coursework", label: "Coursework", value: `${audit.completion_rate}%`, sub: `${audit.completed.length} completed, ${audit.missing_count} missing`, to: "/student/progress" },
        {
          key: "research",
          label: "Research",
          // the stage in the figure (like the other three cards show a number); the status is a chip in the sub-line
          value: researchCase ? data.research_progress?.stage || researchCase.current_gate_label || "Not started" : "Not started",
          sub: researchCase?.status ? <StatusChip status={researchCase.status} dot={false} size="sm" /> : "Open the Research page to begin",
          tone: "info",
          to: "/student/research",
        },
        { key: "tasks", label: "Your open tasks", value: tasks.length, sub: `${tasks.filter((task) => task.overdue).length} overdue`, tone: tasks.length ? "warning" : "neutral" },
        { key: "messages", label: "Unread messages", value: unreadCount, sub: "Replies on your requests", tone: unreadCount ? "danger" : "neutral", to: "/student/messages" },
      ]}
      activity={activity}
      activityAll={{ to: "/student/activity", label: "View all" }}
      activityEmpty={{ title: "No activity yet", hint: "Submissions, decisions and replies will appear here." }}
      extra={
        <>
          <SectionCard as="section" title="Your lifecycle" subtitle={`You are at: ${student.current_stage}`} icon={Route}>
            <Stepper steps={stageSteps(student.current_stage, data.stages)} />
          </SectionCard>
          <PageLinks data={data} />
        </>
      }
    />
  );
}
