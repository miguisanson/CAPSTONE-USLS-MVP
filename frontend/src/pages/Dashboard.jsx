import { useState } from "react";
import { LayoutDashboard, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Button, InlineNotice, Spinner, StatusChip } from "../components/ui/index.js";
import RoleHome from "../components/RoleHome.jsx";
import { formatDate, relativeDays } from "../lib/format";
import { firstNameOf, officeActions, officeActivity, officeOf, officeStats, officeWaiting } from "../lib/staffHome.js";

// IM19 + AD7: the back-office home is action first - what waits on this office, what other offices hold, four key
// numbers, recent activity. The charts and the filter bar that used to fill this page are on Reports > Analytics
// (IM20). It serves the Graduate School office and the administrator (who also get the dashboard figures and the
// activity feed and the analytics) and, since I-066, the two coordinators too: the same
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

// UX-13: one line says when it is due, and says "Overdue" itself, so no status chip repeats it.
function dueText(item) {
  if (!item.dueAt) return undefined;
  return item.overdue ? `Overdue since ${formatDate(item.dueAt)}` : `Due ${formatDate(item.dueAt)} (${relativeDays(item.dueAt)})`;
}

// A chip only when it says something the section heading and the due line do not (not Pending / Overdue / Waiting).
const QUIET_STATUSES = new Set(["Pending", "Overdue", "Waiting", "Open"]);

function toRow(item) {
  return {
    key: item.key,
    title: item.title,
    detail: item.detail,
    meta: dueText(item),
    overdue: Boolean(item.overdue),
    chip: item.status && !QUIET_STATUSES.has(item.status) ? <StatusChip status={item.status} dot={false} size="sm" /> : null,
    to: item.target.to,
    linkLabel: item.target.label,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = user?.role;
  const office = officeOf(role);
  const isGraduateSchool = GS_ROLES.has(role);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState(null); // { tone, text } after "Run today's checks"
  const { data, loading, error, refetch } = useApi(
    () =>
      Promise.all([
        api.tasks({ owner: office, page_size: TASK_PAGE }),
        api.tasks({ page_size: TASK_PAGE }),
        api.dashboard({}), // a coordinator is answered with their own caseload (viewer.owner)
      ]).then(([own, all, dashboard]) => ({ own, all, dashboard })),
    [role]
  );

  // UX-38 (owner 2026-11-22): the date checks (automatic AWOL, leave dates, risk levels, onboarding reviews, reminders) run
  // by themselves on the first sign-in of each day; this runs them now, e.g. after an import, then reads the home again.
  async function runChecks() {
    setChecking(true);
    setNotice(null);
    try {
      const result = await api.maintenanceRefresh();
      setNotice({ tone: "success", text: result.message || "Today's checks ran." });
      refetch();
    } catch (err) {
      setNotice({ tone: "danger", text: err.message || "Today's checks could not run." });
    } finally {
      setChecking(false);
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

  const taskActions = officeActions(data.own.items, role);
  // I-388: the Research Coordinator's Ready students (the panel to match, the date to book) are their own move.
  const researchReady = data.dashboard?.research_ready;
  const readyItems = (researchReady?.items || []).map((entry) => ({
    key: `ready-${entry.student_id}`,
    title: entry.student_name,
    detail: [entry.stage, entry.reason].filter(Boolean).join(". "),
    tone: "neutral",
    status: "Ready",
    target: { to: entry.to || researchReady.view_all, label: "Open the Research Gate" },
  }));
  const actions = readyItems.length
    ? { ...taskActions, items: [...readyItems, ...taskActions.items], total: taskActions.total + researchReady.total } // keeps overdue and dueSoon for the tiles
    : taskActions;
  const waiting = officeWaiting(data.all.items, role);
  // F5-14: the Research Coordinator's "Waiting on others" lists the students waiting on a panel verdict (max 3), not tasks.
  const researchWaiting = data.dashboard?.research_waiting;
  const waitingItems = researchWaiting?.total
    ? researchWaiting.items.map((entry) => ({
        key: `research-${entry.student_id}`,
        title: entry.student_name,
        detail: [entry.stage, entry.reason].filter(Boolean).join(". "),
        tone: "neutral",
        status: "Waiting",
        target: { to: entry.to || researchWaiting.view_all, label: "Open the Research Gate" },
      }))
    : waiting.items;
  // the tasks API counts every open task; the page of 200 may hold fewer than the total
  const heldByOthers = Math.max((data.all.total ?? 0) - (data.own.total ?? 0), waiting.total);
  const stats = officeStats({ role, own: { ...actions, total: data.own.total ?? taskActions.total }, waiting: { total: heldByOthers }, kpis: data.dashboard?.kpis || null });
  // UX-24 (Phase 4): "Needs your action" is the first rows of the Work Queue's Mine tab (same tasks, same order).
  const queue = "/work-queue";
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
      notice={notice && <InlineNotice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</InlineNotice>}
      header={{
        // UX-11 (owner 2026-11-20): the role is in the top bar and the list says what needs you; no second line and no
        // Reports button (it is in the sidebar). UX-38: "Run today's checks" replaces "Refresh data" (it was never a reload).
        title: `Welcome, ${firstName}`,
        icon: LayoutDashboard,
        actions: isGraduateSchool && (
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            loading={checking}
            onClick={runChecks}
            title="Runs the daily date checks now: automatic AWOL, leave dates, risk levels, onboarding reviews and reminders"
          >
            Run today's checks
          </Button>
        ),
      }}
      actions={actions.items.map(toRow)}
      actionsEmpty={{ title: "Nothing is waiting on you", hint: `New tasks for the ${office} will appear here.` }}
      actionsAll={
        researchReady?.total > readyItems.length
          ? { to: researchReady.view_all, label: `View all ${researchReady.total} ready students` }
          : taskActions.total > 0 ? { to: queue, label: `View all ${taskActions.total}` } : undefined
      }
      waiting={{
        title: "Waiting on others",
        items: waitingItems.map(toRow),
        all: { to: researchWaiting?.total ? researchWaiting.view_all : "/work-queue?view=others", label: "View all" }, // UX-23
      }}
      stats={stats}
      activity={activity}
      activityAll={activity && isGraduateSchool ? { to: "/activity", label: "View all" } : undefined}
      activityEmpty={{ title: "No activity yet" }}
    />
  );
}
