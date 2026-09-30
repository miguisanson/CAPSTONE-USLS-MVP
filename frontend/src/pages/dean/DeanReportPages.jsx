import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, ClipboardCheck, Clock } from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatCard, StatusBadge } from "../../components/ui";
import { OnboardingGatePanel, CourseworkReportPanel } from "../../components/ProcessGates";
import { formatDate } from "../../lib/format";
import Assistant from "../Assistant";
import { DEAN_PROCESSES, DeanGate, processOfType, useDean } from "./DeanContext";
import { casePath, daysSince } from "./DeanShared";
import { deanBoardGroup, deanItemDate } from "./deanHelpers";

// ------------------------------------------------ Admission & coursework reports
// Gates the Dean owns that are not per-student cases: the admission onboarding
// report (BPMN 1) and the coursework status report (BPMN 4).
export function DeanGateReportsPage() {
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Admission & Coursework Reports"
        description="Reports sent to the Dean for a decision: the admission onboarding report and the coursework status report."
        icon={ClipboardCheck}
      />
      <OnboardingGatePanel role="dean" />
      <CourseworkReportPanel role="dean" />
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

export function DeanAnalyticsPage() {
  return (
    <DeanGate>
      <DeanAnalyticsBody />
    </DeanGate>
  );
}

function DeanAnalyticsBody() {
  const { workflowPending, workflowOverview, pendingPlans, recentPlans, counts } = useDean();
  const processKeys = Object.keys(DEAN_PROCESSES).filter((key) => key !== "course-adjustments");
  const rows = processKeys.map((key) => {
    const types = DEAN_PROCESSES[key].types;
    const all = workflowOverview.filter((item) => types.includes(item.type));
    const pending = workflowPending.filter((item) => types.includes(item.type));
    const ages = pending.map((item) => daysSince(item.submitted_at || deanItemDate(item))).filter((days) => days !== null);
    return {
      key,
      label: DEAN_PROCESSES[key].label,
      waiting: pending.length,
      approved: all.filter((item) => deanBoardGroup(item) === "Approved / Completed").length,
      returned: all.filter((item) => deanBoardGroup(item) === "Returned for Revision").length,
      rejected: all.filter((item) => deanBoardGroup(item) === "Rejected / Withdrawn").length,
      avgAge: ages.length ? Math.round(ages.reduce((sum, days) => sum + days, 0) / ages.length) : null,
    };
  });
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
  const decided = rows.reduce((sum, row) => sum + row.approved + row.returned + row.rejected, 0);
  const approvedTotal = rows.reduce((sum, row) => sum + row.approved, 0);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Reports & Analytics"
        description="Where Dean decisions stand across every process. Figures are computed live from the approvals records."
        icon={BarChart3}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Clock} label="Waiting now" value={counts.pendingTotal} sub="across all processes" tone={counts.pendingTotal ? "amber" : "brand"} to="/dean/approvals" />
        <StatCard icon={BarChart3} label="Decided (recent)" value={decided + recentPlans.length} sub="workflow and course plans" tone="blue" to="/dean/activity" />
        <StatCard icon={BarChart3} label="Approval share" value={decided ? `${Math.round((approvedTotal / decided) * 100)}%` : "-"} sub="of recent workflow decisions" tone="brand" />
        <StatCard icon={Clock} label="Course plans waiting" value={counts.pendingPlans} tone="slate" to="/dean/approvals/course-adjustments" />
      </div>
      <Card className="p-6">
        <SectionTitle title="Decisions by process" subtitle="Current pending load and recent outcomes" icon={BarChart3} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                <th className="px-3 py-2">Process</th>
                <th className="px-3 py-2">Waiting</th>
                <th className="px-3 py-2">Approved / completed</th>
                <th className="px-3 py-2">Returned</th>
                <th className="px-3 py-2">Denied</th>
                <th className="px-3 py-2">Average wait</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-3 font-semibold text-ink"><Link to={`/dean/approvals/${row.key}`} className="hover:text-brand-700 hover:underline">{row.label}</Link></td>
                  <td className="px-3 py-3">
                    <p className="font-semibold text-ink">{row.waiting}</p>
                    <Bar value={row.waiting} max={maxWaiting} tone="bg-amber-500" />
                  </td>
                  <td className="px-3 py-3 text-slate-600">{row.approved}</td>
                  <td className="px-3 py-3 text-slate-600">{row.returned}</td>
                  <td className="px-3 py-3 text-slate-600">{row.rejected}</td>
                  <td className="px-3 py-3 text-slate-500">{row.avgAge === null ? "-" : `${row.avgAge} day${row.avgAge === 1 ? "" : "s"}`}</td>
                </tr>
              ))}
              <tr>
                <td className="px-3 py-3 font-semibold text-ink"><Link to="/dean/approvals/course-adjustments" className="hover:text-brand-700 hover:underline">Course Adjustments</Link></td>
                <td className="px-3 py-3">
                  <p className="font-semibold text-ink">{counts.pendingPlans}</p>
                  <Bar value={counts.pendingPlans} max={maxWaiting} tone="bg-amber-500" />
                </td>
                <td className="px-3 py-3 text-slate-600" colSpan={4}>{recentPlans.filter((plan) => ["Approved", "Published"].includes(plan.status)).length} recent plan(s) approved, {recentPlans.filter((plan) => plan.status === "Returned").length} returned</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-6">
        <SectionTitle title="Pending load by program" subtitle="Where the waiting requests come from" icon={BarChart3} />
        {byProgram.length ? (
          <ul className="space-y-3">
            {byProgram.map(([program, count]) => (
              <li key={program}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-slate-600">{program}</span><span className="font-bold text-ink">{count}</span></div>
                <Bar value={count} max={byProgram[0][1]} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nothing is waiting" hint="Pending requests will be broken down by program here." />
        )}
      </Card>
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
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Decision History"
        description="Recent decisions recorded against the Dean account, newest first. Each entry keeps its full stage history on the case page."
        icon={Activity}
      />
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <label htmlFor="dean-history-filter" className="text-xs font-semibold text-slate-600">Process</label>
          <select id="dean-history-filter" value={filter} onChange={(event) => setFilter(event.target.value)} className="field-input w-auto min-w-52 cursor-pointer">
            <option value="">All processes</option>
            {Object.entries(DEAN_PROCESSES).map(([key, value]) => <option key={key} value={key}>{value.label}</option>)}
          </select>
          <span className="ml-auto text-xs text-slate-400">{visible.length} entr{visible.length === 1 ? "y" : "ies"}</span>
        </div>
        {visible.length ? (
          <ul className="divide-y divide-slate-100">
            {visible.map((entry) => (
              <li key={entry.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  {entry.href ? <Link to={entry.href} className="text-sm font-semibold text-ink hover:text-brand-700 hover:underline">{entry.title}</Link> : <p className="text-sm font-semibold text-ink">{entry.title}</p>}
                  <p className="text-xs text-slate-500">{entry.process ? DEAN_PROCESSES[entry.process].label : "Workflow"} · {entry.subtitle}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{formatDate(entry.date)}</span>
                  <StatusBadge value={entry.status} dot={false} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Activity} title="No decisions recorded yet" hint="Approvals, returns and denials will be listed here." />
        )}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Policy assistant
// The assistant page is shared with the staff view. Dean access to the assistant
// endpoints is being opened by a separate change; until then this page shows the
// endpoint's own "cannot access" message inside the chat.
export function DeanAssistantPage() {
  return <Assistant />;
}
