import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
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
import { Button, Card, DataTable, EmptyState, HistoryPanel, Input, PageHeader, SectionCard, StatusChip } from "../../components/ui/index.js";
import { formatDate } from "../../lib/format";
import { useAuth } from "../../auth";
import RoleHome from "../../components/RoleHome.jsx";
import { deanActions, deanActivity, deanStats, wordDays } from "../../lib/deanHome.js";
import { firstNameOf } from "../../lib/staffHome.js";
import { DEAN_PROCESSES, DeanFeedback, DeanGate, processOfType, useDean } from "./DeanContext";
import { AgeBadge, CaseTable, casePath, processLabel, useDeanFilters } from "./DeanShared";
import { DeanListFilters, DeanWorkflowBoard, WorkflowApprovalCard } from "./DeanParts";
import { LeaveCaseSummary, isLeaveCaseItem } from "./DeanLeaveParts";
import ProcessBoardPage from "../../components/ProcessBoardPage";
import { leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import AdviserAppointments from "../AdviserAppointments";

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
        title="Approvals Queue"
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
                <Input
                  value={note[plan.id] || ""}
                  onChange={(e) => setNote((n) => ({ ...n, [plan.id]: e.target.value }))}
                  placeholder="Optional note to the Graduate School…"
                  aria-label={`Optional decision note for ${plan.program_code} ${plan.term_label}`}
                />
                <div className="flex flex-wrap gap-2">
                  <Button icon={CheckCircle2} disabled={busy === plan.id} onClick={() => decidePlan(plan, "approve")}>Approve</Button>
                  <Button variant="secondary" icon={RotateCcw} disabled={busy === plan.id} onClick={() => decidePlan(plan, "return")}>Return for revision</Button>
                </div>
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

const PROCESS_COPY = {
  "course-adjustments": "Course offering plans submitted by the Academic Coordinator. Approve them or return them for revision.",

  practicum: "Practicum completion reports sent to the Dean for final review.",
  graduation: "Graduation endorsement lists prepared by Graduate School staff.",
};

export function DeanProcessPage() {
  const { process } = useParams();
  if (process === "leave") return <Navigate to="/dean/approvals/leave-of-absence" replace />;
  if (!DEAN_PROCESSES[process]) return <Navigate to="/dean/approvals" replace />;
  return (
    <DeanGate>
      {STANDALONE_PROCESSES.includes(process) ? <DeanStandaloneBody slug={process} /> : <DeanProcessBody process={process} />}
    </DeanGate>
  );
}

// The Dean's Leave of Absence, Readmission, AWOL & Residency and Withdrawal pages are the same
// board staff use (ProcessBoardPage): the server lists the Dean's steps (approve, return,
// deny) on the cards that are waiting for a decision, so dragging a card or using its buttons
// decides it through the same guarded call.
function DeanStandaloneBody({ slug }) {
  const { refetch } = useDean();
  return (
    <div className="space-y-5">
      <DeanFeedback />
      <ProcessBoardPage key={slug} slug={slug} onChanged={refetch} />
    </div>
  );
}

// One line in a recent / overview list. Leave and readmission cases open into the same
// summary the Dean saw when deciding, read-only.
function DecidedRow({ item }) {
  const leaveCase = isLeaveCaseItem(item) ? item.case : null;
  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <Link to={casePath(item)} className="min-w-0 truncate text-slate-700 hover:text-brand-700 hover:underline">{item.title}</Link>
        {leaveCase ? leaveCaseStatusBadge(leaveCase) : <StatusChip status={item.status} dot={false} />}
      </div>
      {leaveCase?.status === "Denied" && <p className="meta mt-1 font-semibold text-red-700">Follow-up owner: {leaveCase.owner || "Graduate School staff"}</p>}
      {leaveCase && (
        <HistoryPanel className="mt-2" label="View details" hideLabel="Hide details">
          <LeaveCaseSummary item={item} />
        </HistoryPanel>
      )}
    </li>
  );
}

function DeanProcessBody({ process }) {
  const navigate = useNavigate();
  const { workflowPending, workflowRecent, workflowOverview, counts } = useDean();
  const types = DEAN_PROCESSES[process].types;
  const pending = workflowPending.filter((item) => types.includes(item.type));
  const overview = workflowOverview.filter((item) => types.includes(item.type));
  const recent = workflowRecent.filter((item) => types.includes(item.type));
  const { filters, setFilters, programs, statuses, apply } = useDeanFilters(process === "course-adjustments" ? [] : overview);
  const visiblePending = apply(pending);
  const boardRows = apply(overview);
  const visibleRecent = apply(recent);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={DEAN_PROCESSES[process].label}
        description={PROCESS_COPY[process]}
        icon={Gavel}
        badge={<StatusChip status={`${counts[PROCESS_COUNT_KEY[process]]} waiting`} tone="muted" dot={false} />}
        actions={<Button as={Link} to="/dean/approvals" variant="secondary" icon={ArrowLeft}>All approvals</Button>}
      />
      <DeanFeedback />
      {process === "course-adjustments" ? (
        <PlanCards />
      ) : (
        <>
          <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
          {boardRows.length > 0 && (
            <DeanWorkflowBoard rows={boardRows} onOpen={(item) => navigate(casePath(item))} selectedIds={new Set()} onToggle={() => {}} />
          )}
          <SectionCard title="Waiting for your decision" subtitle="Open a case to review it and decide" icon={Inbox}>
            <CaseTable items={visiblePending} emptyTitle="Nothing to review in this section" emptyHint="Submitted items for this role will appear here." />
          </SectionCard>
          {visibleRecent.length > 0 && (
            <Card>
              <p className="eyebrow mb-3 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Recent workflow decisions</p>
              <ul className="divide-y divide-slate-100">
                {visibleRecent.map((item) => <DecidedRow key={`${item.type}-${item.id}`} item={item} />)}
              </ul>
            </Card>
          )}
        </>
      )}
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
