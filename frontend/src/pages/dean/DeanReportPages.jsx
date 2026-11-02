import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, BarChart3, ClipboardCheck, Clock, GraduationCap, Timer } from "lucide-react";
import { DataTable, Field, PageHeader, Select, StatusChip } from "../../components/ui/index.js";
import ReportsFrame from "../reports/ReportsFrame.jsx";
import { OutcomesView, PipelineView, SpeedView as DeanSpeedView, WaitingView } from "../reports/DeanViews.jsx";
import { OnboardingGatePanel, CourseworkReportPanel } from "../../components/ProcessGates";
import { formatDate } from "../../lib/format";
import Assistant from "../Assistant";
import { DEAN_PROCESSES, DeanGate, processOfType, useDean } from "./DeanContext";
import { casePath } from "./DeanShared";
import { PAGE } from "../../lib/labels.js";

// ------------------------------------------------ Admission & coursework reports
// Gates the Dean owns that are not per-student cases: the admission onboarding
// report (BPMN 1) and the coursework status report (BPMN 4).
// The shared report panels speak to the person who opens them: for the Dean an empty list reads "No ... reports have
// been sent to you yet." (I-084, I-111), so this page just renders them and each asks the server once.
export function DeanGateReportsPage() {
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={PAGE.gateReports}
        description="Reports sent to the Dean for a decision: the admission onboarding report and the coursework status report."
        icon={ClipboardCheck}
      />
      <OnboardingGatePanel role="dean" />
      <CourseworkReportPanel role="dean" />
    </div>
  );
}

// ------------------------------------------------------------ Reports & analytics
// The Dean's four questions (I-141, F4) in the frame the staff Reports page shares. The server counts every number, so the
// figures here are the Dean home's (I-074).
const DEAN_TABS = [
  { id: "waiting", label: "Waiting for my decision", icon: Clock, render: (c) => <WaitingView {...c} /> },
  { id: "speed", label: "How fast decisions are made", icon: Timer, render: (c) => <DeanSpeedView {...c} /> },
  { id: "outcomes", label: "Outcomes", icon: BarChart3, render: (c) => <OutcomesView {...c} /> },
  { id: "graduation", label: "Graduation pipeline", icon: GraduationCap, render: (c) => <PipelineView {...c} /> },
];

export function DeanAnalyticsPage() {
  return (
    <ReportsFrame
      title={PAGE.reportsAnalytics}
      description="What waits for the Dean's decision, how fast decisions are made, what was decided and where graduation candidates stand."
      icon={BarChart3}
      tabs={DEAN_TABS}
      label="Dean reports"
    />
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
        title={PAGE.activityLog}
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
