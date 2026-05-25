import {
  AlertTriangle,
  CalendarClock,
  CheckSquare,
  Clock3,
  TrendingUp,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import { Link } from "react-router-dom";
import { alertsApi, homeApi, schedulingApi, studentsApi, tasksApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Card, CardBody } from "../components/ui/Card";
import { KpiCard } from "../components/ui/KpiCard";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { AlertItem, DashboardSummary, ScheduleRequestItem, StudentListItem, TaskItem } from "../types/domain";
import { dueInLabel, formatDate, formatDateTime, readableEnum } from "../utils/format";
import { alertStatusTone, stageTone, taskStatusTone } from "../utils/presentation";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const STAGES = [
  "ADMISSION",
  "COURSEWORK",
  "PROPOSAL_DEVELOPMENT",
  "PROPOSAL_DEFENSE",
  "DATA_COLLECTION",
  "DISSERTATION_WRITING",
  "ORAL_DEFENSE",
  "LOA",
  "COMPLETED",
] as const;

const CHART_COLORS = ["#006633", "#16a34a", "#15803d", "#2b8a3e", "#4c9f70", "#f59e0b", "#2563eb", "#b42318", "#6b7280"];

export const DashboardPage = () => {
  const { user } = useAuth();
  const isStudent = (user?.roles ?? []).includes("STUDENT");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [myTasks, setMyTasks] = useState<TaskItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [scheduleRequests, setScheduleRequests] = useState<ScheduleRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [summaryRes, taskRes, alertsRes, schedulingRes] = await Promise.all([
          homeApi.dashboard(),
          tasksApi.myQueue({ pageSize: 12 }),
          alertsApi.list({ status: "OPEN", pageSize: 12 }),
          schedulingApi.list({ pageSize: 40 }),
        ]);

        setSummary(summaryRes);
        setMyTasks(taskRes.items);
        setAlerts(alertsRes.items);
        setScheduleRequests(schedulingRes.items);

        if (isStudent) {
          const me = await studentsApi.me();
          setStudents([
            {
              id: me.id,
              studentNumber: me.studentNumber,
              firstName: me.firstName,
              lastName: me.lastName,
              email: me.email,
              currentStage: me.currentStage,
              riskFlag: me.riskFlag,
              program: me.program,
              adviser: me.adviser,
              researchCoordinator: me.researchCoordinator,
            },
          ]);
        } else {
          const studentsRes = await studentsApi.list({ pageSize: 200 });
          setStudents(studentsRes.items);
        }

        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [isStudent]);

  const priorityTasks = useMemo(
    () =>
      [...myTasks]
        .filter((task) => task.status !== "COMPLETED")
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 6),
    [myTasks]
  );

  const stageDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    STAGES.forEach((stage) => counts.set(stage, 0));
    students.forEach((student) => counts.set(student.currentStage, (counts.get(student.currentStage) ?? 0) + 1));
    return STAGES.map((stage) => ({ stage, count: counts.get(stage) ?? 0 }));
  }, [students]);

  const programDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach((student) => {
      const key = student.program.code;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].map(([program, count]) => ({ program, count }));
  }, [students]);

  const atRiskStudents = useMemo(() => students.filter((item) => item.riskFlag).slice(0, 6), [students]);

  const upcomingDefenses = useMemo(() => {
    const rows = scheduleRequests
      .map((request) => {
        const latestEvent = request.scheduleEvents.find((event) => event.eventStatus === "CONFIRMED" || event.eventStatus === "RESCHEDULED");
        return {
          requestId: request.id,
          studentId: request.studentId,
          studentName: request.student ? `${request.student.firstName} ${request.student.lastName}` : `Student #${request.studentId}`,
          status: request.status,
          scheduledAt: latestEvent?.scheduledAt ?? null,
          notes: latestEvent?.notes ?? request.reason ?? "",
        };
      })
      .filter((item) => item.scheduledAt)
      .sort((a, b) => Number(new Date(a.scheduledAt!)) - Number(new Date(b.scheduledAt!)));

    return rows.slice(0, 8);
  }, [scheduleRequests]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    if (!summary) return [];
    const actions: RecommendedActionItem[] = [];
    if (summary.overdueTasks > 0) {
      actions.push({
        id: "overdue-tasks",
        title: "Resolve overdue queue items",
        description: `${summary.overdueTasks} task(s) are overdue and may block stage progression. Prioritize overdue cases and assign committed completion dates.`,
        priority: "high",
        owner: "Current task owners",
        eta: "48 hours",
      });
    }
    if (summary.openAlerts > 0) {
      actions.push({
        id: "open-alerts",
        title: "Close high-risk monitoring alerts",
        description: `${summary.openAlerts} open alerts require intervention logs and closure evidence. Resolve critical prolonged-stage and unresolved-handoff cases first.`,
        priority: "high",
        owner: "Staff / Coordinators",
        eta: "3 business days",
      });
    }
    if (atRiskStudents.length > 0) {
      actions.push({
        id: "at-risk-cases",
        title: "Review at-risk student cases",
        description: `${atRiskStudents.length} student profile(s) are flagged at-risk. Verify milestones, adviser follow-up, and pending decisions for each case.`,
        priority: "medium",
        owner: "Advisers + Coordinators",
      });
    }
    const defensesWithinWeek = upcomingDefenses.filter((row) => {
      if (!row.scheduledAt) return false;
      const diff = Math.floor((new Date(row.scheduledAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return diff >= 0 && diff <= 7;
    });
    if (defensesWithinWeek.length > 0) {
      actions.push({
        id: "defense-readiness",
        title: "Prepare upcoming defense schedules",
        description: `${defensesWithinWeek.length} defense event(s) are within 7 days. Validate room allocation, panel readiness, and complete document submissions.`,
        priority: "medium",
        owner: "Scheduling coordinators",
      });
    }
    return actions;
  }, [summary, atRiskStudents, upcomingDefenses]);

  if (loading) {
    return <LoadingBlock text="Loading dashboard data..." />;
  }

  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>;
  }

  if (!summary) {
    return <EmptyState message="Dashboard summary is unavailable." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Dashboard"
        subtitle={`Operational overview for ${user?.fullName ?? "current user"} across graduate student lifecycle workflows.`}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Students in Scope"
          value={summary.studentsInScope}
          helper="Active records under current role scope"
          icon={<Users className="h-5 w-5" />}
          tone="primary"
          actions={
            <QuickInsights
              title="Students in Scope"
              summary="Count of student records you can currently monitor based on role and assignment rules."
              recommendation="Track stage distribution and risk flags to identify bottlenecks."
            />
          }
        />
        <KpiCard
          label="My Open Tasks"
          value={summary.myOpenTasks}
          helper="Pending, in-progress, or overdue"
          icon={<CheckSquare className="h-5 w-5" />}
          actions={
            <QuickInsights
              title="My Open Tasks"
              summary="Current unresolved queue items assigned directly to you or routed to your role."
              recommendation="Prioritize overdue and high-priority tasks to prevent stage delays."
            />
          }
        />
        <KpiCard
          label="Overdue Tasks"
          value={summary.overdueTasks}
          helper="Requires immediate follow-through"
          icon={<Clock3 className="h-5 w-5" />}
          tone={summary.overdueTasks > 0 ? "danger" : "success"}
          actions={
            <QuickInsights
              title="Overdue Tasks"
              summary="Tasks beyond due date increase risk of unresolved handoffs and delayed milestones."
              recommendation="Escalate overdue tasks beyond threshold and document interventions."
            />
          }
        />
        <KpiCard
          label="Open Alerts"
          value={summary.openAlerts}
          helper="Monitoring signals pending closure"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone={summary.openAlerts > 0 ? "warning" : "success"}
          actions={
            <QuickInsights
              title="Open Monitoring Alerts"
              summary="Open and acknowledged alerts generated by monitoring rules for prolonged stage, unresolved handoff, delayed scheduling, and inactivity."
              recommendation="Log interventions and closure evidence for each unresolved alert."
            />
          }
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Students by Lifecycle Stage"
              subtitle="Distribution of records across graduate lifecycle stages"
              insight={
                <QuickInsights
                  title="Lifecycle Stage Distribution"
                  summary="Each bar shows how many students are currently in a given stage from admission to completion."
                  points={[
                    "Concentration in one stage can signal workflow bottlenecks.",
                    "LOA and prolonged data collection require closer case review.",
                  ]}
                  recommendation="Investigate stages with high volume and high average aging first."
                />
              }
            />
            {stageDistribution.every((item) => item.count === 0) ? (
              <EmptyState message="No stage data to display." />
            ) : (
              <Bar
                data={{
                  labels: stageDistribution.map((item) => readableEnum(item.stage)),
                  datasets: [
                    {
                      label: "Students",
                      data: stageDistribution.map((item) => item.count),
                      borderRadius: 6,
                      backgroundColor: CHART_COLORS,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                  },
                }}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Students by Program"
              subtitle="Program-level visibility for operational planning"
              insight={
                <QuickInsights
                  title="Program Distribution"
                  summary="Shows active student counts by graduate program in your current monitoring scope."
                  recommendation="Use this to balance adviser workload and defense scheduling resources."
                />
              }
            />
            {programDistribution.length === 0 ? (
              <EmptyState message="No program distribution data." />
            ) : (
              <div className="mx-auto max-w-sm">
                <Doughnut
                  data={{
                    labels: programDistribution.map((item) => item.program),
                    datasets: [
                      {
                        data: programDistribution.map((item) => item.count),
                        backgroundColor: CHART_COLORS,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    plugins: {
                      legend: { position: "bottom" },
                    },
                  }}
                />
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Priority Task Snapshot"
              subtitle="Top unresolved tasks in your queue"
              actions={
                <Link to="/tasks" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Open Task Queue
                </Link>
              }
              insight={
                <QuickInsights
                  title="Priority Tasks"
                  summary="Tasks are ranked by combined urgency, stage criticality, and overdue risk signals."
                  recommendation="Handle high-score tasks first, then clear medium-priority backlog."
                />
              }
            />
            {priorityTasks.length === 0 ? (
              <EmptyState message="No active tasks in your queue." />
            ) : (
              <div className="space-y-2">
                {priorityTasks.map((task) => (
                  <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={taskStatusTone(task.status)}>{readableEnum(task.status)}</Badge>
                        <Badge tone="info">Score {task.priorityScore}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      {task.student ? `${task.student.firstName} ${task.student.lastName}` : "General workflow task"} | {dueInLabel(task.dueAt)}
                    </p>
                    {task.recommendedAction ? <p className="mt-1 text-xs text-[var(--gs-primary)]">{task.recommendedAction}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="At-Risk Student Cases"
              subtitle="Students currently flagged for intervention"
              actions={
                <Link to="/students" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  View Students
                </Link>
              }
              insight={
                <QuickInsights
                  title="At-Risk Cases"
                  summary="Risk flags indicate students needing closer monitoring due to prolonged stage time, inactivity, or repeated blockers."
                  recommendation="Open each profile and confirm intervention actions are recorded."
                />
              }
            />
            {atRiskStudents.length === 0 ? (
              <EmptyState message="No at-risk students in current scope." />
            ) : (
              <div className="space-y-2">
                {atRiskStudents.map((student) => (
                  <Link
                    key={student.id}
                    to={`/students/${student.id}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 transition hover:bg-rose-100"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-xs text-slate-600">
                        {student.program.code} | {readableEnum(student.currentStage)}
                      </p>
                    </div>
                    <Badge tone={stageTone(student.currentStage)}>At Risk</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Upcoming Defense Schedules"
              subtitle="Confirmed or rescheduled events with set dates"
              actions={
                <Link to="/scheduling" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Open Scheduling
                </Link>
              }
              insight={
                <QuickInsights
                  title="Defense Schedule Overview"
                  summary="Shows nearest defense events from scheduling requests with confirmed or rescheduled outcomes."
                  recommendation="Verify participant availability and required documents one week ahead."
                />
              }
            />
            {upcomingDefenses.length === 0 ? (
              <EmptyState message="No upcoming defense schedules." />
            ) : (
              <div className="space-y-2">
                {upcomingDefenses.map((item) => (
                  <article key={`${item.requestId}-${item.scheduledAt}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{item.studentName}</p>
                      <Badge tone={item.status === "CONFIRMED" ? "success" : "warning"}>{readableEnum(item.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{formatDateTime(item.scheduledAt)}</p>
                    {item.notes ? <p className="mt-1 text-xs text-slate-600">{item.notes}</p> : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Open Alert Snapshot"
              subtitle="Most recent open monitoring alerts"
              actions={
                <Link to="/alerts" className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                  Open Alerts
                </Link>
              }
              insight={
                <QuickInsights
                  title="Alert Snapshot"
                  summary="Displays open alerts requiring immediate intervention logging and closure workflow."
                  recommendation="Prioritize high-severity and aging alerts for intervention closure."
                />
              }
            />
            {alerts.length === 0 ? (
              <EmptyState message="No open alerts." />
            ) : (
              <div className="space-y-2">
                {alerts.slice(0, 6).map((alert) => (
                  <article key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{readableEnum(alert.alertType)}</p>
                      <Badge tone={alertStatusTone(alert.status)}>{readableEnum(alert.status)}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">{alert.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {alert.student ? `${alert.student.firstName} ${alert.student.lastName}` : `Student #${alert.studentId}`} | Triggered {formatDate(alert.triggeredAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level summary synthesized from queue metrics, monitoring alerts, risk flags, and defense scheduling timelines."
      />

      {!isStudent ? (
        <Card className="border-[var(--gs-primary)]/20 bg-[var(--gs-primary-soft)]/30">
          <CardBody className="flex items-start gap-2.5">
            <TrendingUp className="mt-0.5 h-4 w-4 text-[var(--gs-primary)]" />
            <p className="text-xs text-slate-700">
              Quick Insights explain the selected section only. Recommended Actions summarize the full dashboard and remain advisory only.
            </p>
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
};
