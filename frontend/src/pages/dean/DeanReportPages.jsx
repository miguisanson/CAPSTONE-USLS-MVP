import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, ClipboardCheck, Clock, FileSpreadsheet, GraduationCap, RefreshCw } from "lucide-react";
import { Button, DataTable, EmptyState, Field, PageHeader, SectionCard, Select, Spinner, StatCard, StatusChip } from "../../components/ui/index.js";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { OnboardingGatePanel, CourseworkReportPanel } from "../../components/ProcessGates";
import { formatDate } from "../../lib/format";
import Assistant from "../Assistant";
import { DEAN_PROCESSES, DeanGate, processOfType, useDean } from "./DeanContext";
import { casePath, daysSince } from "./DeanShared";
import { deanDecidedThisWeek, deanDecisions, deanItemDate } from "./deanHelpers";

// ------------------------------------------------ Admission & coursework reports
// Gates the Dean owns that are not per-student cases: the admission onboarding
// report (BPMN 1) and the coursework status report (BPMN 4).
// The shared report panels explain an empty list to the staff who fill it ("Generate one to send to the Dean"). The
// Dean is the one who receives the reports, so while a list is empty the Dean sees a card in the Dean's own words
// (I-084); as soon as there is a report the shared panel takes over.
function useHasReports(load) {
  const { data, error, refetch } = useApi(() => load().then((res) => ({ count: (res.items || []).length })), []);
  // `ready` keeps the shared panel (and its staff wording) from showing for a moment before this answer arrives.
  return { ready: data !== null || Boolean(error), empty: !error && data?.count === 0, refetch };
}

export function DeanGateReportsPage() {
  const onboarding = useHasReports(api.onboardingReviews);
  const coursework = useHasReports(api.courseworkReports);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Admission & Coursework Reports"
        description="Reports sent to the Dean for a decision: the admission onboarding report and the coursework status report."
        icon={ClipboardCheck}
      />
      {!onboarding.ready ? (
        <Spinner label="Loading onboarding reports..." />
      ) : onboarding.empty ? (
        <SectionCard
          title="Onboarding report & Dean approval"
          icon={GraduationCap}
          action={<Button variant="secondary" icon={RefreshCw} onClick={onboarding.refetch}>Refresh</Button>}
        >
          <EmptyState icon={FileSpreadsheet} title="No onboarding reports have been sent to you yet." hint="When Graduate School staff report an import batch, it appears here for your approval." />
        </SectionCard>
      ) : (
        <OnboardingGatePanel role="dean" />
      )}
      {!coursework.ready ? (
        <Spinner label="Loading coursework reports..." />
      ) : coursework.empty ? (
        <SectionCard title="Coursework status report to the Dean" icon={FileSpreadsheet}>
          <EmptyState icon={FileSpreadsheet} title="No coursework reports have been sent to you yet." hint="When Graduate School staff send a coursework status report, it appears here for your review." />
        </SectionCard>
      ) : (
        <CourseworkReportPanel role="dean" />
      )}
    </div>
  );
}

// ------------------------------------------------------------ Reports & analytics
function Bar({ value, max, tone = "bg-brand-500" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
    </div>
  );
}

// The "Decisions by process" columns. The Waiting cell carries a bar scaled to the busiest process.
const PROCESS_COLUMNS = (maxWaiting) => [
  { key: "label", header: "Process", cell: (row) => row.label },
  {
    key: "waiting",
    header: "Waiting",
    cell: (row) => (
      <>
        <p className="font-semibold text-ink">{row.waiting}</p>
        <Bar value={row.waiting} max={maxWaiting} tone="bg-amber-500" />
      </>
    ),
  },
  { key: "approved", header: "Approved / completed", cell: (row) => row.approved },
  { key: "returned", header: "Returned", cell: (row) => row.returned },
  { key: "rejected", header: "Denied", cell: (row) => row.rejected },
  { key: "avgAge", header: "Average wait", cell: (row) => (row.avgAge === null ? null : `${row.avgAge} day${row.avgAge === 1 ? "" : "s"}`) },
];

export function DeanAnalyticsPage() {
  return (
    <DeanGate>
      <DeanAnalyticsBody />
    </DeanGate>
  );
}

function DeanAnalyticsBody() {
  const { workflowPending, workflowOverview, workflowRecent, pendingPlans, recentPlans, counts } = useDean();
  const decisions = useMemo(
    () => deanDecisions({ recent: workflowRecent, overview: workflowOverview, recentPlans }),
    [workflowRecent, workflowOverview, recentPlans],
  );
  const processKeys = Object.keys(DEAN_PROCESSES).filter((key) => key !== "course-adjustments");
  const outcomeCount = (process, outcome) => decisions.filter((entry) => entry.process === process && entry.outcome === outcome).length;
  const rows = processKeys.map((key) => {
    const types = DEAN_PROCESSES[key].types;
    const pending = workflowPending.filter((item) => types.includes(item.type));
    const ages = pending.map((item) => daysSince(item.submitted_at || deanItemDate(item))).filter((days) => days !== null);
    return {
      key,
      label: DEAN_PROCESSES[key].label,
      waiting: pending.length,
      approved: outcomeCount(key, "approved"),
      returned: outcomeCount(key, "returned"),
      rejected: outcomeCount(key, "denied"),
      avgAge: ages.length ? Math.round(ages.reduce((sum, days) => sum + days, 0) / ages.length) : null,
    };
  });
  // Course adjustments are plans, not workflow cases: their outcomes are approved (or published) and returned.
  const tableRows = [
    ...rows,
    {
      key: "course-adjustments",
      label: DEAN_PROCESSES["course-adjustments"].label,
      waiting: counts.pendingPlans,
      approved: outcomeCount("course-adjustments", "approved"),
      returned: outcomeCount("course-adjustments", "returned"),
      rejected: null,
      avgAge: null,
    },
  ];
  const maxWaiting = Math.max(1, counts.pendingPlans, ...rows.map((row) => row.waiting));
  const byProgram = useMemo(() => {
    const tally = new Map();
    workflowPending.forEach((item) => {
      const program = item.student?.program_code || "Unassigned";
      tally.set(program, (tally.get(program) || 0) + 1);
    });
    pendingPlans.forEach((plan) => tally.set(plan.program_code, (tally.get(plan.program_code) || 0) + 1));
    return [...tally.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8);
  }, [workflowPending, pendingPlans]);
  // Same figure as the Dean home: decisions made in the last seven days. The share is over the workflow decisions in the table.
  const decidedThisWeek = deanDecidedThisWeek({ recent: workflowRecent, recentPlans });
  const workflowDecisions = decisions.filter((entry) => entry.process !== "course-adjustments");
  const decided = workflowDecisions.length;
  const approvedTotal = workflowDecisions.filter((entry) => entry.outcome === "approved").length;
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Reports & Analytics"
        description="Where Dean decisions stand across every process. Figures are computed live from the approvals records."
        icon={BarChart3}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} label="Waiting now" value={counts.pendingTotal} sub="across all processes" tone={counts.pendingTotal ? "warning" : "success"} to="/dean/approvals" />
        <StatCard icon={BarChart3} label="Decided this week" value={decidedThisWeek} sub="See Decision History" tone="info" to="/dean/activity" />
        <StatCard icon={BarChart3} label="Approval share" value={decided ? `${Math.round((approvedTotal / decided) * 100)}%` : "-"} sub="of recent workflow decisions" tone="success" />
        <StatCard icon={Clock} label="Course plans waiting" value={counts.pendingPlans} tone="neutral" to="/dean/approvals/course-adjustments" />
      </div>
      <SectionCard pad="lg" title="Decisions by process" subtitle="Current pending load and recent outcomes" icon={BarChart3}>
        <DataTable
          caption="Dean decisions by process: waiting now and recent outcomes"
          columns={PROCESS_COLUMNS(maxWaiting)}
          rows={tableRows}
          rowKey="key"
          rowHref={(row) => `/dean/approvals/${row.key}`}
          pageSize={0}
        />
      </SectionCard>
      <SectionCard pad="lg" title="Pending load by program" subtitle="Where the waiting requests come from" icon={BarChart3}>
        {byProgram.length ? (
          <ul className="space-y-3">
            {byProgram.map(([program, count]) => (
              <li key={program}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{program}</span><span className="font-semibold text-ink">{count}</span></div>
                <Bar value={count} max={byProgram[0][1]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing is waiting" hint="Pending requests will be broken down by program here." />
        )}
      </SectionCard>
    </div>
  );
}

// ---------------------------------------------------------------- Decision history
export function DeanHistoryPage() {
  return (
    <DeanGate>
      <DeanHistoryBody />
    </DeanGate>
  );
}

// One row per decision: the case link (when the case is still on the Dean's lists), its process, the date and the status.
const HISTORY_COLUMNS = [
  {
    key: "title",
    header: "Decision",
    cell: (entry) => (
      <>
        {entry.href ? (
          <Link to={entry.href} className="font-semibold text-ink hover:text-brand-700 hover:underline">{entry.title}</Link>
        ) : (
          <p className="font-semibold text-ink">{entry.title}</p>
        )}
        <p className="meta">{entry.process ? DEAN_PROCESSES[entry.process].label : "Workflow"} · {entry.subtitle}</p>
        {/* below sm the Date and Status columns are hidden: the same two facts sit under the title instead */}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
          <span className="meta">{formatDate(entry.date)}</span>
          <StatusChip status={entry.status} dot={false} />
        </div>
      </>
    ),
  },
  { key: "date", header: "Date", hideBelow: "sm", className: "whitespace-nowrap", cell: (entry) => formatDate(entry.date) },
  { key: "status", header: "Status", hideBelow: "sm", cell: (entry) => <StatusChip status={entry.status} dot={false} /> },
];

function DeanHistoryBody() {
  const { workflowRecent, recentPlans, findCase } = useDean();
  const [filter, setFilter] = useState("");
  const entries = useMemo(() => {
    const items = workflowRecent.map((item) => ({
      key: `${item.type}-${item.id}`,
      process: processOfType(item.type),
      title: item.title,
      subtitle: item.subtitle || item.student?.name || "",
      status: item.status,
      date: item.last_activity_at || item.submitted_at,
      href: findCase(item.type, item.id) ? casePath(item) : null,
    }));
    const plans = recentPlans.map((plan) => ({
      key: `plan-${plan.id}`,
      process: "course-adjustments",
      title: `Course offerings · ${plan.program_code}`,
      subtitle: `${plan.term_label}${plan.approved_by ? ` · by ${plan.approved_by}` : ""}`,
      status: plan.status,
      date: plan.updated_at || plan.approved_at || plan.submitted_at,
      href: null,
    }));
    return [...items, ...plans].sort((left, right) => new Date(right.date || 0) - new Date(left.date || 0));
  }, [workflowRecent, recentPlans, findCase]);
  const visible = filter ? entries.filter((entry) => entry.process === filter) : entries;
  const processOptions = Object.entries(DEAN_PROCESSES).map(([key, value]) => ({ value: key, label: value.label }));
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Decision History"
        description="Recent decisions recorded against the Dean account, newest first. Each entry keeps its full stage history on the case page."
        icon={Activity}
      />
      <DataTable
        caption="Recent decisions recorded against the Dean account, newest first"
        columns={HISTORY_COLUMNS}
        rows={visible}
        rowKey="key"
        pageSize={25}
        empty={{ icon: Activity, title: "No decisions recorded yet", hint: "Approvals, returns and denials will be listed here." }}
        toolbar={
          <>
            <div className="w-full sm:w-64">
              <Field label="Process">
                <Select value={filter} onChange={(event) => setFilter(event.target.value)} options={processOptions} placeholder="All processes" />
              </Field>
            </div>
            <span className="meta self-end pb-3 sm:ml-auto">{visible.length} entr{visible.length === 1 ? "y" : "ies"}</span>
          </>
        }
      />
    </div>
  );
}

// ------------------------------------------------------------------ Policy assistant
// The assistant page is shared with the staff view; the Dean gets policy answers only.
export function DeanAssistantPage() {
  return <Assistant policyOnly />;
}
