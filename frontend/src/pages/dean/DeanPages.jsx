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
import { Card, EmptyState, PageHeader, SectionTitle, StatCard, StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import { DEAN_PROCESSES, DeanFeedback, DeanGate, processOfType, useDean } from "./DeanContext";
import { AgeBadge, CaseTable, casePath, daysSince, processLabel, useDeanFilters } from "./DeanShared";
import { DeanListFilters, DeanWorkflowBoard, WorkflowApprovalCard } from "./DeanParts";
import { deanItemDate } from "./deanHelpers";
import { LeaveCaseSummary, isLeaveCaseItem } from "./DeanLeaveParts";
import ProcessBoardPage from "../../components/ProcessBoardPage";
import { leaveCaseStatusBadge } from "../../components/leaveStatus.jsx";
import HistoryDisclosure from "../../components/HistoryDisclosure";

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

// ---------------------------------------------------------------- Dashboard
function AgingPanel({ pending }) {
  const buckets = [
    { label: "0-2 days", test: (days) => days <= 2, tone: "bg-brand-500" },
    { label: "3-7 days", test: (days) => days >= 3 && days <= 7, tone: "bg-blue-500" },
    { label: "8-14 days", test: (days) => days >= 8 && days <= 14, tone: "bg-amber-500" },
    { label: "15+ days", test: (days) => days >= 15, tone: "bg-red-500" },
  ].map((bucket) => ({ ...bucket, count: pending.filter((item) => {
    const days = daysSince(item.submitted_at || deanItemDate(item));
    return days !== null && bucket.test(days);
  }).length }));
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  return (
    <Card className="p-6">
      <SectionTitle title="How long items have waited" subtitle="Pending decisions grouped by age" icon={Clock} />
      <ul className="space-y-3">
        {buckets.map((bucket) => (
          <li key={bucket.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">{bucket.label}</span>
              <span className="font-bold text-ink">{bucket.count}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className={`h-full rounded-full ${bucket.tone}`} style={{ width: `${(bucket.count / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function DeanDashboard() {
  return (
    <DeanGate>
      <DeanDashboardBody />
    </DeanGate>
  );
}

function DeanDashboardBody() {
  const { counts, workflowPending, workflowRecent, pendingPlans, recentPlans } = useDean();
  const oldest = [...workflowPending, ...pendingPlans]
    .map((item) => daysSince(item.submitted_at || deanItemDate(item)))
    .filter((days) => days !== null)
    .sort((left, right) => right - left)[0];
  const queue = [...workflowPending]
    .sort((left, right) => new Date(left.submitted_at || 0) - new Date(right.submitted_at || 0))
    .slice(0, 8);
  const recent = [...workflowRecent].slice(0, 5);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Dean Dashboard"
        description="Decisions waiting on you, by process, and how long they have waited."
        icon={Gavel}
        actions={<Link to="/dean/approvals" className="btn-primary"><Inbox className="h-4 w-4" /> Open approvals queue</Link>}
      />
      <DeanFeedback />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Inbox} label="Decisions waiting" value={counts.pendingTotal} sub={oldest !== undefined ? `Oldest waiting ${oldest} day${oldest === 1 ? "" : "s"}` : "Nothing is waiting"} tone={counts.pendingTotal ? "amber" : "brand"} to="/dean/approvals" />
        {PROCESS_ORDER.slice(0, 3).map((key) => (
          <StatCard key={key} label={DEAN_PROCESSES[key].label} value={counts[PROCESS_COUNT_KEY[key]]} sub="waiting for your decision" tone="blue" to={`/dean/approvals/${key}`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {PROCESS_ORDER.slice(3).map((key) => (
          <StatCard key={key} label={DEAN_PROCESSES[key].label} value={counts[PROCESS_COUNT_KEY[key]]} sub="waiting for your decision" tone="blue" to={`/dean/approvals/${key}`} />
        ))}
        <StatCard icon={CheckCircle2} label="Recently decided" value={workflowRecent.length + recentPlans.length} sub="See Decision History" tone="slate" to="/dean/activity" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-8">
          <SectionTitle
            title="Waiting longest"
            subtitle="Oldest pending workflow decisions first"
            icon={Inbox}
            action={<Link to="/dean/approvals" className="text-xs font-semibold text-brand-700 hover:underline">View all</Link>}
          />
          <CaseTable items={queue} showProcess emptyTitle="No workflow decisions are waiting" emptyHint="New requests routed to the Dean will appear here." />
          {pendingPlans.length > 0 && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              {pendingPlans.length} course offering plan{pendingPlans.length === 1 ? " is" : "s are"} also waiting.{" "}
              <Link to="/dean/approvals/course-adjustments" className="underline">Review course adjustments</Link>
            </p>
          )}
        </Card>
        <div className="space-y-5 lg:col-span-4">
          <AgingPanel pending={[...workflowPending, ...pendingPlans]} />
          <Card className="p-6">
            <SectionTitle title="Recent decisions" icon={CheckCircle2} action={<Link to="/dean/activity" className="text-xs font-semibold text-brand-700 hover:underline">History</Link>} />
            {recent.length ? (
              <ul className="divide-y divide-slate-100">
                {recent.map((item) => (
                  <li key={`${item.type}-${item.id}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{item.title}</span>
                    <StatusBadge value={item.status} dot={false} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No decisions yet" />
            )}
          </Card>
        </div>
      </div>
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
              <p className="text-xs text-slate-500">{plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}</p>
            </div>
            <div className="flex items-center gap-2">
              <AgeBadge value={plan.submitted_at} />
              <Link to="/dean/approvals/course-adjustments" className="btn-ghost px-3 py-1.5 text-xs">Review</Link>
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
  const { workflowPending, pendingPlans, counts } = useDean();
  const { filters, setFilters, programs, statuses, apply, matches } = useDeanFilters([...workflowPending, ...pendingPlans]);
  const plans = pendingPlans.filter(matches);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Approvals Queue"
        description="Everything waiting on the Dean, grouped by process. Open a case to review the files, history and messages before you decide."
        icon={Inbox}
        badge={<StatusBadge value={`${counts.pendingTotal} waiting`} dot={false} />}
      />
      <DeanFeedback />
      <DeanListFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} />
      {PROCESS_ORDER.map((key) => {
        const items = key === "course-adjustments" ? [] : apply(workflowPending.filter((item) => DEAN_PROCESSES[key].types.includes(item.type)));
        const count = key === "course-adjustments" ? plans.length : items.length;
        return (
          <Card key={key} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-ink">
                {DEAN_PROCESSES[key].label} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{count}</span>
              </h2>
              <Link to={`/dean/approvals/${key}`} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                Open {DEAN_PROCESSES[key].label} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            {key === "course-adjustments" ? (
              <PlanRows plans={plans} />
            ) : (
              <CaseTable items={items} emptyTitle="Nothing waiting" emptyHint="No request of this kind needs a Dean decision right now." />
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ----------------------------------------------------------- Process pages
function PlanCards() {
  const { pendingPlans, recentPlans, note, setNote, busy, decidePlan } = useDean();
  return (
    <>
      {pendingPlans.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Inbox} title="No course offering plans waiting" hint="Plans the Academic Coordinator submits for approval appear here." />
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingPlans.map((plan) => {
            const offered = plan.offerings.filter((o) => o.status === "Offered" || o.status === "Suggested");
            return (
              <Card key={plan.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-ink">Course offerings · {plan.program_code}</h2>
                    <p className="text-sm text-slate-500">{plan.term_label} · {offered.length} subject(s) proposed · submitted {formatDate(plan.submitted_at)}</p>
                  </div>
                  <StatusBadge value={plan.status} dot={false} />
                </div>
                <div className="mt-3 overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-2">Subject</th>
                        <th className="px-3 py-2">Demand</th>
                        <th className="px-3 py-2">Sections</th>
                        <th className="px-3 py-2">Decision</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.offerings.map((o) => (
                        <tr key={o.id} className="border-b border-slate-50">
                          <td className="px-4 py-2"><span className="font-semibold text-ink">{o.code}</span><span className="ml-1 text-slate-500">{o.title}</span></td>
                          <td className="px-3 py-2 text-slate-600">{o.demand_count}</td>
                          <td className="px-3 py-2 text-slate-600">{o.section_count}</td>
                          <td className="px-3 py-2"><StatusBadge value={o.status} dot={false} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <input
                  value={note[plan.id] || ""}
                  onChange={(e) => setNote((n) => ({ ...n, [plan.id]: e.target.value }))}
                  placeholder="Optional note to the Graduate School…"
                  aria-label={`Optional decision note for ${plan.program_code} ${plan.term_label}`}
                  className="field-input mt-3"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" disabled={busy === plan.id} onClick={() => decidePlan(plan, "approve")} className="btn-primary">
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </button>
                  <button type="button" disabled={busy === plan.id} onClick={() => decidePlan(plan, "return")} className="btn-ghost">
                    <RotateCcw className="h-4 w-4" /> Return for revision
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {recentPlans.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Clock className="h-3.5 w-3.5" /> Recent decisions</p>
          <ul className="divide-y divide-slate-100">
            {recentPlans.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">
                  {p.program_code} · {p.term_label}
                  {p.approved_by && <span className="text-slate-400"> · by {p.approved_by}</span>}
                </span>
                <StatusBadge value={p.status} dot={false} />
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
        {leaveCase ? leaveCaseStatusBadge(leaveCase) : <StatusBadge value={item.status} dot={false} />}
      </div>
      {leaveCase?.status === "Denied" && <p className="mt-1 text-xs font-semibold text-red-700">Follow-up owner: {leaveCase.owner || "Graduate School staff"}</p>}
      {leaveCase && (
        <HistoryDisclosure className="mt-2" label="View details" hideLabel="Hide details">
          <LeaveCaseSummary item={item} />
        </HistoryDisclosure>
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
        badge={<StatusBadge value={`${counts[PROCESS_COUNT_KEY[process]]} waiting`} dot={false} />}
        actions={<Link to="/dean/approvals" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> All approvals</Link>}
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
          <Card className="p-5">
            <SectionTitle title="Waiting for your decision" subtitle="Open a case to review it and decide" icon={Inbox} />
            <CaseTable items={visiblePending} emptyTitle="Nothing to review in this section" emptyHint="Submitted items for this role will appear here." />
          </Card>
          {visibleRecent.length > 0 && (
            <Card className="p-5">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400"><Clock className="h-3.5 w-3.5" /> Recent workflow decisions</p>
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
        <PageHeader title="Case not found" description="This request is no longer in your approvals lists. It may already have been decided." icon={SearchX} actions={<Link to="/dean/approvals" className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Approvals queue</Link>} />
        <DeanFeedback />
        <Card className="p-6"><EmptyState icon={AlertTriangle} title="Nothing to show" hint="Go back to the approvals queue to see what is still waiting." /></Card>
      </div>
    );
  }
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={item.title}
        description={`${item.student?.name || ""} · ${item.student?.student_number || ""} · ${processLabel(item.type)}`}
        icon={Gavel}
        badge={<StatusBadge value={item.status} dot={false} />}
        actions={<Link to={backTo} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Back to list</Link>}
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
