import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  FileCheck,
  LayoutDashboard,
  ListTodo,
  Mail,
  MessageSquare,
  UserCheck,
} from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatCard, StatusBadge } from "../../components/ui";
import { formatDate, relativeDays } from "../../lib/format";
import { useStudentPortal } from "./StudentPortalContext";
import { ActivityPanel, ProgressPanel, RecommendationsPanel, StudentHero, WorkflowStatusPanel } from "./Panels";
import { STUDENT_REQUEST_PATHS } from "./requestMeta";
import { STUDENT_REQUEST_VIEW_BY_SLUG, StudentSchedulePanel, fmtDay, isLiveSchedule } from "./shared";

const REQUEST_LABELS = {
  "leave-of-absence": "Leave of Absence",
  readmission: "Readmission",
  awol: "AWOL / Residency",
  practicum: "Practicum",
  withdrawal: "Withdrawal",
  graduation: "Graduation",
  "course-audit": "Course Audit",
};

// Dates the student should not miss: open tasks and the subject
// withdrawal window of each subject they are still enrolled in.
function collectDeadlines(data) {
  const rows = [];
  (data.tasks || []).forEach((task) => {
    if (task.due_at) rows.push({ key: `task-${task.id}`, label: task.title, date: task.due_at, meta: `Next owner: ${task.owner_role}`, overdue: task.overdue });
  });
  (data.subject_enrollments || []).forEach((item) => {
    if (item.withdrawal_eligible && item.withdrawal_window?.deadline) {
      rows.push({
        key: `withdraw-${item.id}`,
        label: `Subject withdrawal window closes: ${item.course_code}`,
        date: item.withdrawal_window.deadline,
        meta: item.term_label,
        overdue: false,
      });
    }
  });
  return rows.sort((left, right) => new Date(left.date) - new Date(right.date));
}

function NextActionCard({ data, unreadCount }) {
  const task = (data.tasks || [])[0];
  const recommendation = (data.recommendations || [])[0];
  return (
    <Card className="border-brand-200 bg-brand-50/40 p-6">
      <SectionTitle title="What needs your attention" subtitle="Your next required action, based on your record" icon={ArrowRight} />
      <ul className="space-y-3">
        {unreadCount > 0 && (
          <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-amber-900"><Mail className="h-4 w-4" /> You have {unreadCount} unread message{unreadCount === 1 ? "" : "s"} about your requests.</p>
            <Link to="/student/messages" className="btn-primary px-3 py-1.5 text-xs">Open messages</Link>
          </li>
        )}
        {recommendation && (
          <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-ink">{recommendation.recommendation}</p>
            <p className="mt-1 text-xs text-slate-500">Owner: {recommendation.owner}</p>
          </li>
        )}
        {task && (
          <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{task.title}</p>
              <p className="mt-1 text-xs text-slate-500">Next owner: {task.owner_role} · due {formatDate(task.due_at)} ({relativeDays(task.due_at)})</p>
            </div>
            <StatusBadge value={task.overdue ? "Overdue" : task.status} dot={false} />
          </li>
        )}
        {!unreadCount && !recommendation && !task && (
          <li><EmptyState icon={ClipboardCheck} title="You are on track" hint="Nothing is waiting on you right now." /></li>
        )}
      </ul>
    </Card>
  );
}

function DeadlinesPanel({ data }) {
  const rows = collectDeadlines(data);
  return (
    <Card className="p-6">
      <SectionTitle title="Deadlines & due dates" icon={CalendarClock} />
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li key={row.key} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{row.label}</p>
                <StatusBadge value={row.overdue ? "Overdue" : formatDate(row.date)} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{row.meta} · {relativeDays(row.date)}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No upcoming deadlines" hint="Due dates appear here when a task or withdrawal window applies to you." />
      )}
    </Card>
  );
}

function NotificationsPanel({ messages }) {
  const recent = [...messages]
    .filter((message) => message.recipient_role === "Student")
    .sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
    .slice(0, 4);
  return (
    <Card className="p-6">
      <SectionTitle
        title="Recent notifications"
        subtitle="Latest replies and clarification requests"
        icon={MessageSquare}
        action={<Link to="/student/messages" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>}
      />
      {recent.length ? (
        <ul className="space-y-2.5">
          {recent.map((message) => (
            <li key={message.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{REQUEST_LABELS[message.transaction_slug] || "Request"} · {message.sender_name || message.sender_role}</p>
                {message.is_unread && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">New</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-slate-500">{message.comment || message.template}</p>
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                <span>{formatDate(message.created_at)}</span>
                {STUDENT_REQUEST_VIEW_BY_SLUG[message.transaction_slug] && (
                  <Link to={STUDENT_REQUEST_PATHS[STUDENT_REQUEST_VIEW_BY_SLUG[message.transaction_slug]]} className="font-semibold text-brand-700 hover:underline">Open request</Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={Mail} title="No notifications" hint="Clarification requests and staff replies will appear here." />
      )}
    </Card>
  );
}

// What the defense booking means for the student right now, with only the buttons that make sense.
const SCHEDULE_STATE_TEXT = {
  Scheduled: (s) => `Your ${s.defense_type || "defense"} is booked for ${fmtDay(s.preferred_date)}.`,
  Confirmed: (s) => `Your ${s.defense_type || "defense"} is booked for ${fmtDay(s.preferred_date)}.`,
  "Needs Re-confirmation": () => "Your panel changed. Waiting for the Research Coordinator to confirm the date again.",
  Held: (s) => `Your ${s.defense_type || "defense"} took place on ${fmtDay(s.preferred_date)}.`,
  Deferred: () => "Your defense was deferred. Waiting for the Research Coordinator to set a new date.",
  Rescheduled: () => "Your defense was moved. The newer booking replaces this one.",
  Cancelled: () => "Your last booking was cancelled. You can request a new date.",
};

function DefenseScheduleCard({ data }) {
  const schedules = data.schedules || [];
  const live = schedules.find(isLiveSchedule) || null;
  const current = live || schedules[0] || null;
  const waitingForStaff = current && ["Deferred", "Needs Re-confirmation"].includes(current.status);
  const canRequest = !live && !waitingForStaff;
  const text = current ? (SCHEDULE_STATE_TEXT[current.status] || (() => `Status: ${current.status}.`))(current) : "No defense is booked yet.";
  return (
    <Card className="p-6">
      <SectionTitle title="Defense schedule" subtitle="Your next defense and where to manage it" icon={CalendarDays} />
      <p className="text-sm text-slate-700">{text}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link to="/student/calendar" className="btn-primary px-3 py-1.5 text-xs">My research calendar</Link>
        {canRequest && <Link to="/student/defense-schedule" className="btn-ghost px-3 py-1.5 text-xs">Request a defense schedule</Link>}
        {!canRequest && <Link to="/student/defense-schedule" className="btn-ghost px-3 py-1.5 text-xs">Defense schedule page</Link>}
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <UserCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
        Research adviser:
        {adviserName(data) ? (
          <>
            <span className="font-semibold text-ink">{adviserName(data)}</span>
            <Link to="/student/adviser" className="text-xs font-semibold text-brand-700 hover:underline">Adviser page</Link>
          </>
        ) : (
          <Link to="/student/adviser" className="font-semibold text-brand-700 hover:underline">No adviser appointed yet - apply</Link>
        )}
      </p>
    </Card>
  );
}

function adviserName(data) {
  return data.student?.adviser_name || data.research_case?.adviser_name || "";
}

export default function StudentOverview() {
  const { data } = useStudentPortal();
  const { student, course_audit: audit, research_case: researchCase } = data;
  const messages = data.workflow_messages || [];
  const unreadCount = messages.filter((message) => message.is_unread).length;
  const firstName = student.first_name || student.name.split(" ")[0];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={`Welcome, ${firstName}`}
        description="Where you stand in the graduate lifecycle, and what to do next."
        icon={LayoutDashboard}
      />
      <StudentHero data={data} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={ClipboardCheck} label="Coursework" value={`${audit.completion_rate}%`} sub={`${audit.completed.length} completed, ${audit.missing_count} missing`} to="/student/progress" />
        <StatCard icon={FileCheck} label="Research" value={researchCase?.status || "Not started"} sub={researchCase?.current_gate_label || "Open the Research page to begin"} tone="blue" to="/student/research" />
        <StatCard icon={ListTodo} label="Open tasks" value={(data.tasks || []).length} sub={`${(data.tasks || []).filter((task) => task.overdue).length} overdue`} tone="amber" />
        <StatCard icon={Mail} label="Unread messages" value={unreadCount} sub="Replies on your requests" tone={unreadCount ? "red" : "slate"} to="/student/messages" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <NextActionCard data={data} unreadCount={unreadCount} />
          <ProgressPanel data={data} />
          <WorkflowStatusPanel data={data} />
          <ActivityPanel logs={(data.logs || []).slice(0, 5)} />
        </div>
        <div className="space-y-5 lg:col-span-4">
          <DeadlinesPanel data={data} />
          <NotificationsPanel messages={messages} />
          <DefenseScheduleCard data={data} />
          <StudentSchedulePanel schedules={data.schedules || []} />
          <RecommendationsPanel recommendations={data.recommendations || []} />
        </div>
      </div>
    </div>
  );
}
