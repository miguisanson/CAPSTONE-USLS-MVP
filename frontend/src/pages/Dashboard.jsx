import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, LayoutDashboard, PieChart, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Button, InlineNotice, Spinner, StatusChip } from "../components/ui/index.js";
import RoleHome from "../components/RoleHome.jsx";
import { formatDate, relativeDays } from "../lib/format";
import { canOpen, firstNameOf, officeActions, officeActivity, officeOf, officeStats, officeWaiting } from "../lib/staffHome.js";

// IM19 + AD7: the back-office home is action first - what waits on this office, what other offices hold, four key
// numbers, recent activity. The charts and the filter bar that used to fill this page are on Reports > Analytics
// (IM20). It serves the Graduate School office and the administrator (who also get the dashboard figures and the
// activity feed, the analytics and the "Refresh data" button) and, since I-066, the two coordinators too: the same
// layout with the figures of their own caseload (the dashboard API answers them with that), their own tasks and the
// recent activity of their own students - and no link to a page their role cannot open (the drill-down, the activity
// log and the analytics are the Graduate School's).

const ROLE_NAMES = {
  staff: "Graduate School Staff",
  admin: "Administrator",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
};
const GS_ROLES = new Set(["staff", "admin"]);
const TASK_PAGE = 200; // the most the tasks API returns in one page

function dueText(item) {
  if (!item.dueAt) return undefined;
  return `${item.overdue ? "Overdue, was due" : "Due"} ${formatDate(item.dueAt)} (${relativeDays(item.dueAt)})`;
}

function toRow(item) {
  return {
    key: item.key,
    title: item.title,
    detail: item.detail,
    meta: dueText(item),
    tone: item.tone,
    chip: <StatusChip status={item.status} dot={false} size="sm" />,
    to: item.target.to,
    linkLabel: item.target.label,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const office = officeOf(role);
  const isGraduateSchool = GS_ROLES.has(role);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text } after "Refresh data"
  const { data, loading, error, refetch } = useApi(
    () =>
      Promise.all([
        api.tasks({ owner: office, page_size: TASK_PAGE }),
        api.tasks({ page_size: TASK_PAGE }),
        api.dashboard({}), // a coordinator is answered with their own caseload (viewer.owner)
      ]).then(([own, all, dashboard]) => ({ own, all, dashboard })),
    [role]
  );

  // I-071: the date-driven sweeps no longer run when a page is viewed. This runs them on request, then reads the home again.
  async function refreshData() {
    setRefreshing(true);
    setNotice(null);
    try {
      const result = await api.maintenanceRefresh();
      setNotice({ tone: "success", text: result.message || "Data refreshed." });
      refetch();
    } catch (err) {
      setNotice({ tone: "danger", text: err.message || "Could not refresh the data." });
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !data) return <Spinner label="Loading your home…" />;
  if (error) {
    return (
      <InlineNotice tone="danger" title="Could not load your home">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>{error}</span>
          <Button variant="secondary" size="sm" onClick={refetch}>Try again</Button>
        </div>
      </InlineNotice>
    );
  }

  const actions = officeActions(data.own.items, role);
  const waiting = officeWaiting(data.all.items, role);
  // the tasks API counts every open task; the page of 200 may hold fewer than the total
  const heldByOthers = Math.max((data.all.total ?? 0) - (data.own.total ?? 0), waiting.total);
  const stats = officeStats({ role, own: { ...actions, total: data.own.total ?? actions.total }, waiting: { total: heldByOthers }, kpis: data.dashboard?.kpis || null });
  const queue = `/work-queue?owner=${encodeURIComponent(office)}`;
  const activity = data.dashboard
    ? officeActivity(data.dashboard.recent_logs, undefined, role).map((entry) => ({
        key: entry.key,
        title: entry.title,
        detail: entry.detail,
        time: formatDate(entry.at),
        to: entry.to,
      }))
    : null;
  const firstName = firstNameOf(user?.full_name) || ROLE_NAMES[role];

  return (
    <RoleHome
      header={{
        title: `Welcome, ${firstName}`,
        description: `${ROLE_NAMES[role] || office} · what needs you today`,
        icon: LayoutDashboard,
        actions: (
          <>
            {isGraduateSchool && (
              <Button variant="secondary" icon={RefreshCw} loading={refreshing} onClick={refreshData}>
                Refresh data
              </Button>
            )}
            {isGraduateSchool && (
              <Button as={Link} to="/reports?workflow_type=analytics" variant="secondary" icon={PieChart}>
                Analytics
              </Button>
            )}
            {canOpen("/reports", role) && (
              <Button as={Link} to="/reports" variant="secondary" icon={FileText}>
                Reports
              </Button>
            )}
          </>
        ),
      }}
      actions={actions.items.map(toRow)}
      actionsSubtitle="Your office's open tasks, most urgent first"
      actionsEmpty={{ title: "Nothing is waiting on you", hint: `New tasks for the ${office} will appear here.` }}
      actionsAll={actions.total > actions.items.length ? { to: queue, label: `View all ${actions.total}` } : undefined}
      waiting={{
        title: "Waiting on others",
        subtitle: "Another office or the student holds these. Nothing to do here until they act.",
        items: waiting.items.map(toRow),
        all: { to: "/work-queue", label: "View all" },
      }}
      stats={stats}
      activity={activity}
      activityAll={activity && isGraduateSchool ? { to: "/activity", label: "View all" } : undefined}
      activityEmpty={{ title: "No activity yet", hint: "Complete a workflow to populate this feed." }}
      notice={
        notice && (
          <InlineNotice tone={notice.tone} onDismiss={() => setNotice(null)}>
            {notice.text}
          </InlineNotice>
        )
      }
    />
  );
}
