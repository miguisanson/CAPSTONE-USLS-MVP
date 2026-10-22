// Reports (owner decision IM20): five real reports, each filterable and downloadable as Excel and PDF, the Registrar's
// daily list, and a short Analytics section. One tab per report; the address says which one is open and how it is
// filtered (?report=overdue&office=Dean), so a filtered report can be shared and the browser's Back button works.
// Everything the old page had beyond these (eleven report tabs, eight analytics tabs, a tile row) is gone.
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, Briefcase, CalendarCheck, GraduationCap, ListTodo, RefreshCw, Users } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Button, PageHeader } from "../components/ui/index.js";
import { PAGE } from "../lib/labels.js";
import { homePath } from "../lib/homePaths.js";
import AnalyticsSection from "./reports/AnalyticsSection.jsx";
import DailyChanges from "./reports/DailyChanges.jsx";
import ReportFilters from "./reports/ReportFilters.jsx";
import ReportPanel from "./reports/ReportPanel.jsx";
import { ANALYTICS_FILTERS, ANALYTICS_ROLES, ANALYTICS_TAB, DAILY_TAB, FILTER_KEYS, REPORTS, RISK_CHOICES } from "./reports/reportConfig.js";

const TAB_ICONS = {
  "at-risk": Users,
  cohorts: BarChart3,
  overdue: ListTodo,
  defenses: CalendarCheck,
  graduation: GraduationCap,
  "daily-changes": RefreshCw,
  analytics: Briefcase,
};

export default function Reports() {
  const { user } = useAuth();
  const canSeeCharts = ANALYTICS_ROLES.has(user?.role);
  const [params, setParams] = useSearchParams();

  const tabs = useMemo(
    () => [...REPORTS, DAILY_TAB, ...(canSeeCharts ? [ANALYTICS_TAB] : [])],
    [canSeeCharts],
  );
  // The old address (?workflow_type=analytics, still linked from the home) opens Analytics.
  const wanted = params.get("report") || (params.get("workflow_type") === "analytics" ? "analytics" : REPORTS[0].id);
  const active = tabs.find((tab) => tab.id === wanted) || REPORTS[0];
  const report = REPORTS.find((item) => item.id === active.id);

  function setParam(key, value) {
    const next = new URLSearchParams(params);
    next.delete("workflow_type");
    next.set("report", active.id);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  function clearFilters() {
    const next = new URLSearchParams();
    next.set("report", active.id);
    setParams(next, { replace: true });
  }

  // Program, stage and term mean the same on every report, so they stay when the tab changes; a filter the next report
  // does not have is dropped (a hidden filter would narrow the rows with no way to see why).
  function chooseTab(tab) {
    const target = REPORTS.find((item) => item.id === tab.id);
    const keep = new Set((target ? target.filters : tab.id === ANALYTICS_TAB.id ? ANALYTICS_FILTERS : []).map((spec) => spec.key));
    const next = new URLSearchParams();
    next.set("report", tab.id);
    for (const key of FILTER_KEYS) if (keep.has(key) && params.get(key)) next.set(key, params.get(key));
    setParams(next, { replace: false });
  }

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.reportsAnalytics}
        description="Who is late, where each cohort stands, what is waiting, defenses and graduation. Filter, sort, and download Excel or PDF."
        actions={<Button as={Link} to={homePath(user?.role)} variant="secondary">Back to dashboard</Button>}
      />

      <div role="tablist" aria-label="Reports" className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const selected = tab.id === active.id;
          const Icon = TAB_ICONS[tab.id];
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => chooseTab(tab)}
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors max-sm:min-h-11 ${selected ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" /> {tab.tab}
            </button>
          );
        })}
      </div>

      {report ? (
        <ReportPanel key={report.id} report={report} params={params} setParam={setParam} clearFilters={clearFilters} />
      ) : active.id === DAILY_TAB.id ? (
        <DailyChanges />
      ) : (
        <AnalyticsPanel params={params} setParam={setParam} clearFilters={clearFilters} />
      )}
    </div>
  );
}

// Analytics: the same program / stage / risk filters over the four charts.
function AnalyticsPanel({ params, setParam, clearFilters }) {
  const { data: meta } = useApi(() => api.meta(), []);
  const options = { programs: meta?.programs || [], stages: meta?.stages || [], risks: RISK_CHOICES };
  const filters = { program_id: params.get("program_id") || "", stage: params.get("stage") || "", risk: params.get("risk") || "" };
  return (
    <div className="page-stack">
      <ReportFilters specs={ANALYTICS_FILTERS} options={options} params={params} onChange={setParam} onClear={clearFilters} />
      <AnalyticsSection filters={filters} />
    </div>
  );
}
