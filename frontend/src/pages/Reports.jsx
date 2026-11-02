// Reports (I-141, redesign of IM20): each tab answers one question, over the filters and the strip of six numbers in the
// shared frame (reports/ReportsFrame.jsx). Staff and the Academic Coordinator get the office views and the older
// reports the redesign keeps; the Research Coordinator gets the three views the research flow needs.
import { Link } from "react-router-dom";
import { AlertOctagon, BarChart3, CalendarCheck, ClipboardCheck, Clock, GraduationCap, ListTodo, RefreshCw, Timer } from "lucide-react";
import { useAuth } from "../auth";
import { Button } from "../components/ui/index.js";
import { PAGE } from "../lib/labels.js";
import { homePath } from "../lib/homePaths.js";
import DailyChanges from "./reports/DailyChanges.jsx";
import ReportPanel from "./reports/ReportPanel.jsx";
import ReportsFrame from "./reports/ReportsFrame.jsx";
import { REPORTS } from "./reports/reportConfig.js";
import { AttentionView, RecordsView, SpeedView, StagesView } from "./reports/StaffViews.jsx";

const ICONS = { cohorts: BarChart3, overdue: ListTodo, defenses: CalendarCheck, graduation: GraduationCap };

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
const DAILY = { id: "daily-changes", label: "Registrar changes", icon: RefreshCw, bare: true, render: () => <DailyChanges /> };

export function reportTabs(role) {
  if (role === "research_coordinator") return [NEW_TABS.attention, NEW_TABS.stages, NEW_TABS.fix];
  return [NEW_TABS.attention, NEW_TABS.stages, NEW_TABS.speed, NEW_TABS.fix, ...REPORTS.map(olderTab), DAILY];
}

export default function Reports() {
  const { user } = useAuth();
  return (
    <ReportsFrame
      title={PAGE.reportsAnalytics}
      description="Which students need attention, where they get stuck, how fast offices work and which records to fix. Filter, then download Excel or PDF."
      actions={<Button as={Link} to={homePath(user?.role)} variant="secondary">Back to dashboard</Button>}
      tabs={reportTabs(user?.role)}
    />
  );
}

