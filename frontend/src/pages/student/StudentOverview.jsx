import { LayoutDashboard, Route } from "lucide-react";
import { SectionCard, Stepper, StatusChip } from "../../components/ui/index.js";
import RoleHome from "../../components/RoleHome.jsx";
import { formatDate, relativeDays } from "../../lib/format";
import { pausedLine, stageSteps, stageWords } from "../../lib/stages.js";
import { forStudent } from "../../lib/status.js";
import { VIEW_LABELS, subjectsLeftText, studentActions, studentActivity, studentWaiting } from "../../lib/studentHome.js";
import { useStudentPortal } from "./StudentPortalContext";
import { STUDENT_REQUEST_PATHS } from "./requestMeta";
import { RESEARCH_GATE_KEYS } from "./shared";

// IM19: the student home is action first - what needs the student, four key numbers, recent activity, and the
// lifecycle Stepper. UX-06 (2026-11-20): the "Elsewhere in your portal" card is gone; the sidebar already lists those
// pages, and a page's own status lives on that page.

const PATH_LABELS = {
  "/student/messages": "Messages",
  "/student/progress": "My Progress",
  "/student/requests": "Request Center",
  "/student/documents": "Documents",
};

const pathOf = (target) => target?.to || STUDENT_REQUEST_PATHS[target?.view] || "/student/requests";
const labelOf = (target) => PATH_LABELS[target?.to] || VIEW_LABELS[target?.view] || "Open";

// UX-13: the due line says "Overdue" itself, so no Overdue / Pending chip repeats it.
const QUIET_STATUSES = new Set(["Pending", "Overdue", "Open", "In progress"]);
function dueText(item) {
  if (!item.dueAt) return undefined;
  if (item.kind === "reply") return `Asked ${formatDate(item.dueAt)}`;
  if (item.status === "Overdue") return `Overdue since ${formatDate(item.dueAt)}`;
  return `Due ${formatDate(item.dueAt)} (${relativeDays(item.dueAt)})`;
}

function toActionRow(item) {
  return {
    key: item.key,
    title: item.title,
    detail: item.detail,
    meta: dueText(item),
    overdue: item.status === "Overdue",
    chip: item.status && !QUIET_STATUSES.has(item.status) ? <StatusChip status={item.status} label={item.statusLabel} dot={false} size="sm" /> : null,
    to: pathOf(item.target),
    linkLabel: labelOf(item.target),
  };
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

function LifecycleSteps({ data }) {
  const { student } = data;
  const steps = stageSteps(student.current_stage, data.stages, { courseAudit: data.course_audit, comprehensivePassed: student.comprehensive_exam_status === "Passed" });
  const paused = pausedLine(steps, student.current_stage);
  if (!paused) return <Stepper steps={steps} />;
  // the line says it once; the steps keep what is done, without a second "Stopped" chip beside "Now"
  return (
    <>
      <p data-testid="lifecycle-paused" className="mb-3 text-sm font-semibold text-ink">{paused}</p>
      <Stepper steps={steps.filter((step) => step.state !== "stopped")} />
    </>
  );
}

export default function StudentOverview() {
  const { data } = useStudentPortal();
  const { student, course_audit: audit, research_case: researchCase } = data;
  const messages = data.workflow_messages || [];
  const unreadCount = messages.filter((message) => message.is_unread).length;
  const firstName = student.first_name || student.name.split(" ")[0];

  const ownActions = studentActions(data, { researchGates: RESEARCH_GATE_KEYS });
  const actions = ownActions.map(toActionRow);
  // UX-01: the figure counts the same rows the "Needs your action" list shows, so the two never disagree.
  const overdue = ownActions.filter((item) => item.status === "Overdue").length;
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
        badge: data.progress_status?.level ? <StatusChip status={forStudent(data.progress_status.level)} /> : null,
      }}
      actions={actions}
      waiting={{
        title: "Waiting on the Graduate School",
        items: waiting,
        all: { to: "/student/requests", label: "View all" },
      }}
      stats={[
        { key: "coursework", label: "Coursework", value: `${audit.completion_rate}%`, sub: `${audit.completed.length} completed. ${subjectsLeftText(audit.current.length, audit.missing_count)}`, to: "/student/progress" },
        {
          key: "research",
          label: "Research",
          // the stage in the figure (like the other three cards show a number); the status is a chip in the sub-line
          value: researchCase ? data.research_progress?.stage || researchCase.current_gate_label || "Not started" : "Not started",
          sub: researchCase?.status ? <StatusChip status={researchCase.status} dot={false} size="sm" className="max-w-full !whitespace-normal" /> : "Open the Research page to begin",
          tone: "info",
          to: "/student/research",
        },
        { key: "tasks", label: "Your open tasks", value: actions.length, sub: `${overdue} overdue`, tone: actions.length ? "warning" : "neutral" },
        { key: "messages", label: "Unread messages", value: unreadCount, sub: "Replies on your requests", tone: unreadCount ? "danger" : "neutral", to: "/student/messages" },
      ]}
      activity={activity}
      activityAll={{ to: "/student/activity", label: "View all" }}
      activityEmpty={{ title: "No activity yet" }}
      extra={
        <>
          <SectionCard as="section" title="Your lifecycle" subtitle={`You are at: ${stageWords(student.current_stage)}`} icon={Route}>
            <LifecycleSteps data={data} />
          </SectionCard>
        </>
      }
    />
  );
}
