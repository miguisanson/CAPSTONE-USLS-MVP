import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
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
import { AgeBadge, casePath, processLabel, useDeanFilters } from "./DeanShared";
import { deanItemDate } from "./deanHelpers";
import { DeanListFilters, WorkflowApprovalCard } from "./DeanParts";
import { DeanPracticumBoard } from "./DeanPracticumBoard";
import ProcessBoardPage from "../../components/ProcessBoardPage";
import AdviserAppointments from "../AdviserAppointments";
import { PAGE } from "../../lib/labels.js";
import { useRecordTitle } from "../../components/recordTitle.jsx";

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
          // UX-11 (owner 2026-11-20): no second line and no button to a page the sidebar already lists.
          title: `Welcome, ${firstNameOf(user?.full_name) || "Dean"}`,
          icon: Gavel,
        }}
        actions={actions.items.map((row) => ({
          key: row.key,
          title: row.title,
          detail: row.detail,
          meta: waitText(row),
          // UX-13: every row here waits on the Dean, so a "Dean Review" chip says nothing the heading does not
          to: row.target.to,
          linkLabel: row.target.label,
        }))}
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
export function DeanQueue() {
  return (
    <DeanGate>
      <DeanQueueBody />
    </DeanGate>
  );
}

// UX-25 (Phase 4): the Approvals Queue is one table - every case and course offering plan waiting on the Dean, oldest
// wait first - with a chip per process (and its count) to narrow it; ?process=<slug> opens it narrowed. The Dean's
// sidebar and the per-process boards stay as they are (owner 2026-11-21).
// IM50: the Student column names the student, so the request leaves out its " · <name>" ending.
const withoutName = (title, name) => {
  const text = String(title || "");
  return name && text.endsWith(` · ${name}`) ? text.slice(0, -(name.length + 3)) : text;
};
const waitedSince = (row) => {
  const t = row.since ? new Date(row.since).getTime() : NaN;
  return Number.isFinite(t) && t > 0 ? t : Infinity; // no date: last
};
const QUEUE_COLUMNS = [
  {
    key: "student",
    header: "Student",
    sortValue: (row) => row.student,
    cell: (row) => (
      <>
        <span className="block font-semibold text-ink">{row.student}</span>
        {row.studentMeta && <span className="meta inline-block font-normal">{row.studentMeta}</span>}
      </>
    ),
  },
  {
    key: "request",
    header: "Request",
    sortValue: (row) => row.request,
    cell: (row) => (
      <>
        <p className="font-medium text-slate-700">{row.request}</p>
        {row.detail && <p className="meta">{row.detail}</p>}
      </>
    ),
  },
  { key: "process", header: "Process", sortValue: (row) => row.process },
  { key: "status", header: "Status", sortValue: (row) => row.status, cell: (row) => <StatusChip status={row.status} dot={false} /> },
  {
    key: "waiting",
    header: "Waiting",
    sortValue: (row) => -waitedSince(row),
    cell: (row) => (
      <div className="space-y-1">
        <AgeBadge value={row.since} />
        <p className="meta">{formatDate(row.since)}</p>
      </div>
    ),
  },
  {
    key: "open",
    header: <span className="sr-only">Review</span>,
    align: "right",
    cell: (row) => (
      <Button as={Link} to={row.to} variant="secondary" size="sm" aria-label={`Review ${row.request}`}>
        Review
      </Button>
    ),
  },
];

function DeanQueueBody() {
  const { workflowPending, pendingPlans, refetch, counts } = useDean();
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, programs, statuses, matches } = useDeanFilters([...workflowPending, ...pendingPlans]);
  const asked = searchParams.get("process") || "";
  const process = DEAN_PROCESSES[asked] ? asked : "";
  const rows = [
    ...workflowPending.filter(matches).map((item) => ({
      key: `${item.type}-${item.id}`,
      processKey: processOfType(item.type),
      student: item.student?.name || item.title,
      studentMeta: [item.student?.student_number, item.student?.program_code].filter(Boolean).join(" · "),
      request: withoutName(item.title, item.student?.name),
      detail: item.subtitle,
      process: processLabel(item.type),
      status: item.workflow_status || item.status,
      since: item.submitted_at || deanItemDate(item),
      to: casePath(item),
    })),
    ...pendingPlans.filter(matches).map((plan) => ({
      key: `plan-${plan.id}`,
      processKey: "course-adjustments",
      student: `Course offerings · ${plan.program_code}`,
      studentMeta: "",
      request: `${plan.term_label} offering plan`,
      detail: `${plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested").length} subject(s) proposed`,
      process: DEAN_PROCESSES["course-adjustments"].label,
      status: plan.status,
      since: plan.submitted_at,
      to: "/dean/approvals/course-adjustments",
    })),
  ].sort((a, b) => waitedSince(a) - waitedSince(b));
  const shown = process ? rows.filter((row) => row.processKey === process) : rows;
  const chips = PROCESS_ORDER.map((key) => ({ key, label: DEAN_PROCESSES[key].label, count: rows.filter((row) => row.processKey === key).length })).filter((chip) => chip.count > 0 || chip.key === process);
  const choose = (key) => setSearchParams(key ? { process: key } : {}, { replace: true });
  const filtersActive = Object.entries(filters).some(([name, value]) => value && name !== "sort");
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.approvalsQueue}
        icon={Inbox}
        badge={<StatusChip status={`${counts.pendingTotal} waiting`} tone="muted" dot={false} />}
      />
      <DeanFeedback />
      {/* UX-25: the table's headers sort, and it opens oldest wait first, so no Sort menu here */}
      <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} showSort={false} />
      <Card pad="md" data-testid="dean-queue">
        <div role="group" aria-label="Process" className="mb-3 flex flex-wrap gap-2">
          {[{ key: "", label: "All", count: rows.length }, ...chips].map((chip) => (
            <button
              key={chip.key || "all"}
              type="button"
              aria-pressed={process === chip.key}
              onClick={() => choose(chip.key)}
              className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3 text-sm font-semibold transition ${
                process === chip.key ? "border-brand-600 bg-brand-50 text-brand-800" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
              }`}
            >
              {chip.label}
              <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-700">{chip.count}</span>
            </button>
          ))}
        </div>
        <DataTable
          caption="Everything waiting on the Dean, oldest first"
          columns={QUEUE_COLUMNS}
          rows={shown}
          rowKey="key"
          rowHref={(row) => row.to}
          pageSize={25}
          empty={{ icon: Inbox, title: "Nothing waiting", hint: filtersActive ? "No request matches these filters." : "No request needs a Dean decision right now." }}
        />
      </Card>
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
  { key: "faculty", header: "Faculty", sortValue: (o) => o.assigned_faculty_name || "Unassigned", cell: (o) => o.assigned_faculty_name || "Unassigned" },
  {
    key: "impact",
    header: "Delayed if withheld",
    sortValue: (o) => o.delayed_count || 0,
    cell: (o) => o.delayed_count == null ? "Unavailable" : o.delayed_count > 0
      ? `${o.delayed_count} potentially delayed if withheld`
      : "—",
  },
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
                data-demo={`course-plan-${plan.program_code}`}
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
                  stackOnPhone
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
        forms="course-adjustments"
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
  useRecordTitle(item ? `${item.student?.name || item.title} · ${processLabel(item.type)}` : "");
  if (!item) {
    return (
      <div className="space-y-5 animate-fade-up">
        <PageHeader title="Case not found" description="It may already have been decided." icon={SearchX} actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>Approvals queue</Button>} />
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
        forms={processOfType(item.type)}
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
