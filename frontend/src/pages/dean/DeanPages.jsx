import { Link, Navigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Gavel,
  Inbox,
  RotateCcw,
  SearchX,
} from "lucide-react";
import { Button, Card, DataTable, DecisionPanel, EmptyState, PageHeader, SectionCard, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../auth";
import RoleHome from "../../components/RoleHome.jsx";
import { deanActions, deanActivity, deanStats, wordDays } from "../../lib/deanHome.js";
import { firstNameOf } from "../../lib/staffHome.js";
import { DEAN_PROCESSES, DeanFeedback, DeanGate, processOfType, useDean } from "./DeanContext";
import { AgeBadge, CaseTable, casePath, processLabel, useDeanFilters } from "./DeanShared";
import { DeanListFilters, WorkflowApprovalCard } from "./DeanParts";
import { DeanPracticumBoard } from "./DeanPracticumBoard";
import ProcessBoardPage from "../../components/ProcessBoardPage";
import AdviserAppointments from "../AdviserAppointments";
import { PAGE } from "../../lib/labels.js";

const PROCESS_ORDER = ["course-adjustments", "leave-of-absence", "readmission", "awol", "withdrawal", "practicum", "graduation"];
// The four standalone processes are one page template (the same board staff use).
const STANDALONE_PROCESSES = ["leave-of-absence", "readmission", "awol", "withdrawal"];
const PROCESS_COUNT_KEY = {
  "course-adjustments": "pendingPlans",
  "leave-of-absence": "pendingLeaveOfAbsence",
  readmission: "pendingReadmission",
  awol: "pendingAwol",
  withdrawal: "pendingWithdrawal",
  practicum: "pendingPracticum",
  graduation: "pendingGraduation",
};

// The number beside a section title.
function CountChip({ count }) {
  return <StatusChip label={String(count)} tone="muted" size="sm" dot={false} className="ml-1 align-middle" />;
}

const VIEW_ALL_LINK = "text-xs font-semibold text-brand-700 hover:underline";

// ---------------------------------------------------------------- Dashboard
// IM19: the Dean home is action first (RoleHome) - the decisions waiting on the Dean, oldest first; four key numbers;
// the recent decisions. The per-process breakdown and the full table are the Approvals Queue (lib/deanHome.js).
export function DeanDashboard() {
  return (
    <DeanGate>
      <DeanDashboardBody />
    </DeanGate>
  );
}

function waitText(row) {
  if (row.days === null) return undefined;
  return row.days === 0 ? "Filed today" : `Waiting ${wordDays(row.days)} · filed ${formatDate(row.filedAt)}`;
}

function DeanDashboardBody() {
  const { user } = useAuth();
  const { counts, workflowPending, workflowRecent, pendingPlans, recentPlans } = useDean();
  const now = new Date();
  const waiting = { pending: workflowPending, plans: pendingPlans, adviserCount: counts.pendingAdviser, now };
  const actions = deanActions(waiting);
  const stats = deanStats({ ...waiting, recent: workflowRecent, recentPlans });
  const activity = deanActivity({ recent: workflowRecent, recentPlans }).map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: entry.detail,
    time: formatDate(entry.at),
    to: entry.to,
  }));
  return (
    <div className="space-y-5">
      <DeanFeedback />
      <RoleHome
        header={{
          title: `Welcome, ${firstNameOf(user?.full_name) || "Dean"}`,
          description: "Dean · the decisions waiting on you",
          icon: Gavel,
          actions: <Button as={Link} to="/dean/approvals" icon={Inbox}>Open approvals queue</Button>,
        }}
        actions={actions.items.map((row) => ({
          key: row.key,
          title: row.title,
          detail: row.detail,
          meta: waitText(row),
          tone: row.tone,
          chip: row.status ? <StatusChip status={row.status} dot={false} size="sm" /> : undefined,
          to: row.target.to,
          linkLabel: row.target.label,
        }))}
        actionsSubtitle="Oldest first. Open a case to read the files and history, then decide."
        actionsEmpty={{ title: "Nothing is waiting for your decision", hint: "Requests routed to the Dean will appear here." }}
        actionsAll={actions.rows > actions.items.length ? { to: "/dean/approvals", label: `View all ${actions.total}` } : undefined}
        stats={stats}
        activityTitle="Recent decisions"
        activity={activity}
        activityAll={{ to: "/dean/activity", label: "View all" }}
        activityEmpty={{ title: "No decisions yet", hint: "Decisions you make will be listed here." }}
      />
    </div>
  );
}

// ------------------------------------------------------------ Approvals queue
function PlanRows({ plans }) {
  if (!plans.length) return <EmptyState icon={Inbox} title="No course offering plans waiting" />;
  return (
    <ul className="divide-y divide-slate-100">
      {plans.map((plan) => {
        const offered = plan.offerings.filter((offering) => offering.status === "Offered" || offering.status === "Suggested");
        return (
          <li key={plan.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">Course offerings · {plan.program_code}</p>
              <p className="meta">{plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <AgeBadge value={plan.submitted_at} />
              <Button as={Link} to="/dean/approvals/course-adjustments" variant="secondary" size="sm">Review</Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function DeanQueue() {
  return (
    <DeanGate>
      <DeanQueueBody />
    </DeanGate>
  );
}

function DeanQueueBody() {
  const { workflowPending, pendingPlans, counts, refetch } = useDean();
  const { filters, setFilters, programs, statuses, apply, matches } = useDeanFilters([...workflowPending, ...pendingPlans]);
  const plans = pendingPlans.filter(matches);
  // One entry per process, in order; the ones with something waiting get a section, the rest share one line.
  const entries = PROCESS_ORDER.map((key) => {
    const items = key === "course-adjustments" ? [] : apply(workflowPending.filter((item) => DEAN_PROCESSES[key].types.includes(item.type)));
    return { key, items, count: key === "course-adjustments" ? plans.length : items.length };
  });
  const sections = entries.filter((entry) => entry.count > 0);
  const emptyKeys = entries.filter((entry) => entry.count === 0).map((entry) => entry.key);
  const filtersActive = Object.entries(filters).some(([name, value]) => value && !(name === "sort" && value === "newest"));
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.approvalsQueue}
        description="Everything waiting on the Dean, grouped by process. Open a case to review the files, history and messages before you decide."
        icon={Inbox}
        badge={<StatusChip status={`${counts.pendingTotal} waiting`} tone="muted" dot={false} />}
      />
      <DeanFeedback />
      <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
      {sections.map(({ key, items, count }) => (
        <SectionCard
          key={key}
          title={<>{DEAN_PROCESSES[key].label} <CountChip count={count} /></>}
          action={
            <Link to={`/dean/approvals/${key}`} className={`inline-flex shrink-0 items-center gap-1 ${VIEW_ALL_LINK}`}>
              Open {DEAN_PROCESSES[key].label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          {key === "course-adjustments" ? <PlanRows plans={plans} /> : <CaseTable items={items} />}
        </SectionCard>
      ))}
      {/* Processes with nothing waiting are one line, not one box each (I-084); each name still opens its page. */}
      {sections.length === 0 && (
        <Card pad="lg">
          <EmptyState icon={Inbox} title="Nothing waiting" hint={filtersActive ? "No request matches these filters." : "No request needs a Dean decision right now."} />
        </Card>
      )}
      {sections.length > 0 && emptyKeys.length > 0 && (
        <p className="meta px-1">
          Nothing waiting in:{" "}
          {emptyKeys.map((key, index) => (
            <span key={key}>
              {index > 0 && ", "}
              <Link to={`/dean/approvals/${key}`} className="font-semibold text-brand-700 hover:underline">{DEAN_PROCESSES[key].label}</Link>
            </span>
          ))}
        </p>
      )}
      {/* Adviser designation belongs to the research flow (BPMN 7); the Dean decides it here with the other approvals. */}
      <SectionCard title={<>Adviser Designation <CountChip count={counts.pendingAdviser} /></>}>
        <AdviserAppointments role="dean" embedded onChanged={refetch} />
      </SectionCard>
    </div>
  );
}

// ----------------------------------------------------------- Process pages
// The subjects of one course offering plan.
const PLAN_COLUMNS = [
  {
    key: "subject",
    header: "Subject",
    sortValue: (o) => o.code,
    cell: (o) => <><span className="font-semibold text-ink">{o.code}</span><span className="ml-1 text-slate-500">{o.title}</span></>,
  },
  { key: "demand", header: "Demand", sortValue: (o) => o.demand_count, cell: (o) => o.demand_count },
  { key: "sections", header: "Sections", sortValue: (o) => o.section_count, cell: (o) => o.section_count },
  { key: "decision", header: "Decision", sortValue: (o) => o.status, cell: (o) => <StatusChip status={o.status} dot={false} /> },
];

// The words of the confirmation window for a plan decision: named after the button, says where the plan goes.
function planConfirm(plan, label, outcome, comment) {
  return {
    title: `Confirm: ${label}`,
    confirmLabel: label,
    message: [
      `Course offerings · ${plan.program_code} · ${plan.term_label}`,
      `Plan movement: Submitted → ${outcome}`,
      comment.trim() ? `Recorded note: ${comment.trim()}` : "No optional note was entered.",
    ].join("\n\n"),
  };
}

function PlanCards() {
  const { pendingPlans, recentPlans, note, setNote, busy, decidePlan } = useDean();
  return (
    <>
      {pendingPlans.length === 0 ? (
        <Card pad="lg">
          <EmptyState icon={Inbox} title="No course offering plans waiting" hint="Plans the Academic Coordinator submits for approval appear here." />
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingPlans.map((plan) => {
            const offered = plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested");
            const comment = note[plan.id] || "";
            return (
              <SectionCard
                key={plan.id}
                title={`Course offerings · ${plan.program_code}`}
                subtitle={`${plan.term_label} · ${offered.length} subject(s) proposed · submitted ${formatDate(plan.submitted_at)}`}
                action={<StatusChip status={plan.status} dot={false} />}
              >
                <DataTable
                  caption={`Subjects proposed for ${plan.program_code} ${plan.term_label}`}
                  columns={PLAN_COLUMNS}
                  rows={plan.offerings}
                  rowKey="id"
                  pageSize={0}
                  empty={{ icon: Inbox, title: "No subjects in this plan" }}
                />
                {/* The same decision panel as every other Dean decision: a return needs a note, both ask first. */}
                <DecisionPanel
                  variant="plain"
                  busy={busy === plan.id}
                  onDecide={(decision, text) => decidePlan(plan, decision, text)}
                  comment={comment}
                  onCommentChange={(value) => setNote((current) => ({ ...current, [plan.id]: value }))}
                  commentLabel="Note to the Academic Coordinator"
                  commentPlaceholder="Optional when approving. Say what to revise when returning. It is saved with your name, role, date and time."
                  commentRequiredMessage="Enter a comment explaining what to revise before returning the plan."
                  actions={[
                    { key: "approve", label: "Approve", tone: "approve", icon: CheckCircle2, confirm: planConfirm(plan, "Approve", "Approved", comment) },
                    { key: "return", label: "Return for revision", tone: "return", icon: RotateCcw, confirm: planConfirm(plan, "Return for revision", "Returned for revision", comment) },
                  ]}
                />
              </SectionCard>
            );
          })}
        </div>
      )}
      {recentPlans.length > 0 && (
        <Card>
          <p className="eyebrow mb-3 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Recent decisions</p>
          <ul className="divide-y divide-slate-100">
            {recentPlans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  {p.program_code} · {p.term_label}
                  {p.approved_by && <span className="text-slate-500"> · by {p.approved_by}</span>}
                </span>
                <StatusChip status={p.status} dot={false} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

const COURSE_ADJUSTMENTS_COPY = "Course offering plans submitted by the Academic Coordinator. Approve them or return them for revision.";

export function DeanProcessPage() {
  const { process } = useParams();
  if (process === "leave") return <Navigate to="/dean/approvals/leave-of-absence" replace />;
  if (!DEAN_PROCESSES[process]) return <Navigate to="/dean/approvals" replace />;
  return (
    <DeanGate>
      {STANDALONE_PROCESSES.includes(process) ? <DeanStandaloneBody slug={process} /> : process === "practicum" ? <DeanPracticumBoard /> : <DeanPlansBody />}
    </DeanGate>
  );
}

// The Dean's Leave of Absence, Readmission, AWOL & Residency and Withdrawal pages are the same
// board staff use (ProcessBoardPage): the server lists the Dean's steps (approve, return,
// deny) on the cards that are waiting for a decision, so dragging a card or using its buttons
// decides it through the same guarded call.
function DeanStandaloneBody({ slug }) {
  const { refetch, counts } = useDean();
  // The "N waiting" chip beside the title is on every Dean board (finding 10).
  const waiting = <StatusChip status={`${counts[PROCESS_COUNT_KEY[slug]]} waiting`} tone="muted" dot={false} />;
  return (
    <div className="space-y-5">
      <DeanFeedback />
      <ProcessBoardPage key={slug} slug={slug} onChanged={refetch} headerBadge={waiting} />
    </div>
  );
}

// Course Adjustments: the course offering plans the Academic Coordinator submitted. The plan card decides with the
// same DecisionPanel as every other Dean decision.
function DeanPlansBody() {
  const { counts } = useDean();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={DEAN_PROCESSES["course-adjustments"].label}
        description={COURSE_ADJUSTMENTS_COPY}
        icon={Gavel}
        badge={<StatusChip status={`${counts[PROCESS_COUNT_KEY["course-adjustments"]]} waiting`} tone="muted" dot={false} />}
        actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>All approvals</Button>}
      />
      <DeanFeedback />
      <PlanCards />
    </div>
  );
}

// -------------------------------------------------------------- Case detail
export function DeanCasePage() {
  return (
    <DeanGate>
      <DeanCaseBody />
    </DeanGate>
  );
}

function DeanCaseBody() {
  const { type, id } = useParams();
  const dean = useDean();
  const item = dean.findCase(type, id);
  const processKey = processOfType(type);
  const backTo = processKey ? `/dean/approvals/${processKey}` : "/dean/approvals";
  if (!item) {
    return (
      <div className="space-y-5 animate-fade-up">
        <PageHeader title="Case not found" description="This request is no longer in your approvals lists. It may already have been decided." icon={SearchX} actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>Approvals queue</Button>} />
        <DeanFeedback />
        <Card pad="lg"><EmptyState icon={AlertTriangle} title="Nothing to show" hint="Go back to the approvals queue to see what is still waiting." /></Card>
      </div>
    );
  }
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={item.title}
        description={`${item.student?.name || ""} · ${item.student?.student_number || ""} · ${processLabel(item.type)}`}
        icon={Gavel}
        badge={<StatusChip status={item.status} dot={false} />}
        actions={<Button as={Link} to={backTo} variant="secondary" icon={ArrowLeft}>Back to list</Button>}
      />
      <DeanFeedback />
      <WorkflowApprovalCard
        item={item}
        note={dean.note}
        setNote={dean.setNote}
        template={dean.template}
        setTemplate={dean.setTemplate}
        recipient={dean.recipient}
        setRecipient={dean.setRecipient}
        visibility={dean.visibility}
        setVisibility={dean.setVisibility}
        busy={dean.busy}
        onDecide={dean.requestWorkflowDecision}
        onMessage={dean.messageWorkflow}
      />
    </div>
  );
}
