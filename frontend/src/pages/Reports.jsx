// Reports (I-141, redesign of IM20): each tab answers one question, over the filters and the strip of six numbers in the
// shared frame (reports/ReportsFrame.jsx). Staff and the Academic Coordinator get the office views and the older
// reports the redesign keeps; the Research Coordinator gets the three views the research flow needs.
import { Link } from "react-router-dom";
import { AlertOctagon, BarChart3, ClipboardCheck, Clock, ListTodo, RefreshCw, Timer } from "lucide-react";
import { useAuth } from "../auth";
import { Button } from "../components/ui/index.js";
import { PAGE } from "../lib/labels.js";
import { homePath } from "../lib/homePaths.js";
import DailyChanges from "./reports/DailyChanges.jsx";
import ReportPanel from "./reports/ReportPanel.jsx";
import ReportsFrame from "./reports/ReportsFrame.jsx";
import { REPORTS } from "./reports/reportConfig.js";
import YearStartedView from "./reports/YearStartedView.jsx";
import { AttentionView, RecordsView, SpeedView, StagesView } from "./reports/StaffViews.jsx";

const ICONS = { overdue: ListTodo };

const NEW_TABS = {
  attention: { id: "attention", label: "Needs attention", icon: AlertOctagon, filters: ["cause"], render: (c) => <AttentionView {...c} /> },
  stages: { id: "stages", label: "Where students get stuck", icon: Clock, render: (c) => <StagesView {...c} /> },
  speed: { id: "speed", label: "Office speed", icon: Timer, render: (c) => <SpeedView {...c} /> },
  fix: { id: "fix", label: "Records to fix", icon: ClipboardCheck, filters: ["missing"], render: (c) => <RecordsView {...c} /> },
};

// An older report keeps its own table, filters and downloads; the frame's program filter applies to it too.
const olderTab = (report) => ({
  id: report.id,
  label: report.tab,
  icon: ICONS[report.id],
  filters: report.filters.map((spec) => spec.key),
  render: ({ params, setParam, clearFilters }) => <ReportPanel key={report.id} report={report} params={params} setParam={setParam} clearFilters={clearFilters} />,
});
// I-357: "By year started", "Graduation candidates" and "Defenses" were three tabs about the same students. They are one tab now:
// the three-state count per year on top, the three older views under it. The old addresses (?report=graduation) still open it.
const YEAR_REPORTS = ["cohorts", "graduation", "defenses"].map((id) => REPORTS.find((r) => r.id === id));
const YEAR_STARTED = {
  id: "cohorts",
  aliases: ["graduation", "defenses"],
  label: "By year started",
  icon: BarChart3,
  filters: [...new Set(YEAR_REPORTS.flatMap((report) => report.filters.map((spec) => spec.key)).concat("view"))],
  render: (c) => <YearStartedView {...c} />,
};
const DAILY = { id: "daily-changes", label: "Registrar changes", icon: RefreshCw, bare: true, render: () => <DailyChanges /> };

export function reportTabs(role) {
  if (role === "research_coordinator") return [NEW_TABS.attention, NEW_TABS.stages, NEW_TABS.fix];
  return [NEW_TABS.attention, NEW_TABS.stages, NEW_TABS.speed, NEW_TABS.fix, YEAR_STARTED, olderTab(REPORTS.find((r) => r.id === "overdue")), DAILY];
}

export default function Reports() {
  const { user } = useAuth();
  return (
    <ReportsFrame
      title={PAGE.reportsAnalytics}
      description="Which students need attention, where they get stuck, how fast offices work, where each year started stands and which records to fix. Filter, then download Excel or PDF."
      actions={<Button as={Link} to={homePath(user?.role)} variant="secondary">Back to dashboard</Button>}
      tabs={reportTabs(user?.role)}
    />
  );
}

