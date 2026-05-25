import { Filter, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { tasksApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { useAuth } from "../app/AuthContext";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { Paginated, TaskDecision, TaskItem } from "../types/domain";
import { dueInLabel, readableEnum } from "../utils/format";
import { canSubmitTaskDecisions, canViewTeamQueue } from "../utils/roles";
import { taskStatusTone } from "../utils/presentation";

const DECISIONS: TaskDecision[] = ["APPROVE", "REVISE", "RETURN"];

export const TaskQueuePage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"my" | "team">("my");
  const [data, setData] = useState<Paginated<TaskItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [decisionDrafts, setDecisionDrafts] = useState<Record<number, { decision: TaskDecision; rationale: string }>>({});

  const canSeeTeam = canViewTeamQueue(user?.roles ?? []);
  const canDecide = canSubmitTaskDecisions(user?.roles ?? []);

  useEffect(() => {
    if (tab === "team" && !canSeeTeam) {
      setTab("my");
    }
  }, [canSeeTeam, tab]);

  const load = async () => {
    try {
      setLoading(true);
      const result = tab === "team" ? await tasksApi.teamQueue({ pageSize: 50, status: statusFilter || undefined }) : await tasksApi.myQueue({ pageSize: 50, status: statusFilter || undefined });
      setData(result);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [statusFilter, tab]);

  const filteredTasks = useMemo(() => {
    const source = data?.items ?? [];
    if (!search.trim()) return source;
    const query = search.toLowerCase();
    return source.filter((task) => {
      const studentName = task.student ? `${task.student.firstName} ${task.student.lastName}`.toLowerCase() : "";
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        studentName.includes(query) ||
        readableEnum(task.status).toLowerCase().includes(query)
      );
    });
  }, [data, search]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    const overdue = filteredTasks.filter((task) => task.status === "OVERDUE");
    if (overdue.length > 0) {
      actions.push({
        id: "overdue",
        title: "Escalate overdue queue items",
        description: `${overdue.length} task(s) are overdue. Confirm owner ETA and document intervention for unresolved handoffs.`,
        priority: "high",
        owner: "Queue managers",
      });
    }
    const highScore = filteredTasks.filter((task) => task.priorityScore >= 50 && task.status !== "COMPLETED");
    if (highScore.length > 0) {
      actions.push({
        id: "high-score",
        title: "Process high-priority tasks first",
        description: `${highScore.length} task(s) have high priority scores and should be addressed before lower-risk work.`,
        priority: "high",
      });
    }
    const reviseReturn = filteredTasks.filter((task) => {
      const note = task.recommendedAction?.toLowerCase() ?? "";
      return note.includes("reminder") || note.includes("immediate");
    });
    if (reviseReturn.length > 0) {
      actions.push({
        id: "routing-followup",
        title: "Audit routing and follow-up cadence",
        description: `${reviseReturn.length} task(s) indicate active follow-up recommendations. Validate decision routing ownership is correct.`,
        priority: "medium",
      });
    }
    return actions;
  }, [filteredTasks]);

  const queueSummary = useMemo(() => {
    const open = filteredTasks.filter((task) => task.status !== "COMPLETED").length;
    const overdue = filteredTasks.filter((task) => task.status === "OVERDUE").length;
    const inProgress = filteredTasks.filter((task) => task.status === "IN_PROGRESS").length;
    const completed = filteredTasks.filter((task) => task.status === "COMPLETED").length;
    return { open, overdue, inProgress, completed };
  }, [filteredTasks]);

  const submitDecision = async (taskId: number) => {
    const draft = decisionDrafts[taskId] ?? { decision: "APPROVE", rationale: "" };
    try {
      await tasksApi.decide(taskId, draft);
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader title="Task Queue" subtitle="Role-based workflow queue with decision submission and routing follow-through." />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Open Tasks</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{queueSummary.open}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Overdue</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-danger)]">{queueSummary.overdue}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">In Progress</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-warning)]">{queueSummary.inProgress}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Completed</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-success)]">{queueSummary.completed}</p>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Queue Controls"
            subtitle="Switch queue scope and apply task filters"
            insight={
              <QuickInsights
                title="Queue Controls"
                summary="Use queue scope and status filters to focus on tasks requiring immediate decisions."
                recommendation="Prioritize high-score and overdue tasks before low-risk pending items."
              />
            }
          />
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={tab === "my" ? "primary" : "outline"} onClick={() => setTab("my")}>
              My Tasks
            </Button>
            {canSeeTeam ? (
              <Button size="sm" variant={tab === "team" ? "primary" : "outline"} onClick={() => setTab("team")}>
                Team Queue
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tasks, student names, statuses"
                className="h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-sm"
              />
            </label>
            <label className="relative">
              <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-md border border-slate-300 pl-8 pr-3 text-sm"
              >
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="OVERDUE">Overdue</option>
                <option value="COMPLETED">Completed</option>
              </select>
            </label>
          </div>
        </CardBody>
      </Card>

      {loading ? <LoadingBlock text="Loading task queue..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title={tab === "my" ? "My Tasks" : "Team Queue"}
              subtitle="Workflow tasks with due-date, ownership, and decision actions"
              insight={
                <QuickInsights
                  title={tab === "my" ? "My Tasks Table" : "Team Queue Table"}
                  summary="Each row shows current task state, ownership, and routing hints for decision handling."
                  recommendation="Use decision submission with rationale to keep audit and routing continuity."
                />
              }
            />

            {filteredTasks.length === 0 ? (
              <EmptyState message="No tasks found for current filters." />
            ) : (
              <div className="space-y-2">
                {filteredTasks.map((task) => (
                  <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {task.student ? (
                            <>
                              <Link className="font-semibold text-[var(--gs-primary)] hover:underline" to={`/students/${task.student.id}`}>
                                {task.student.firstName} {task.student.lastName}
                              </Link>{" "}
                              | {task.student.program.code}
                            </>
                          ) : (
                            "General workflow task"
                          )}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Due: {dueInLabel(task.dueAt)} | Next owner: {task.nextActionOwnerRole ? readableEnum(task.nextActionOwnerRole) : "-"} | Score{" "}
                          {task.priorityScore}
                        </p>
                        {task.recommendedAction ? <p className="mt-1 text-xs text-[var(--gs-primary)]">{task.recommendedAction}</p> : null}
                      </div>
                      <Badge tone={taskStatusTone(task.status)}>{readableEnum(task.status)}</Badge>
                    </div>

                    {task.status !== "COMPLETED" && canDecide ? (
                      <div className="mt-2 grid gap-2 md:grid-cols-[150px_1fr_auto]">
                        <select
                          value={decisionDrafts[task.id]?.decision ?? "APPROVE"}
                          onChange={(event) =>
                            setDecisionDrafts((prev) => ({
                              ...prev,
                              [task.id]: { decision: event.target.value as TaskDecision, rationale: prev[task.id]?.rationale ?? "" },
                            }))
                          }
                          className="h-9 rounded-md border border-slate-300 px-2 text-sm"
                        >
                          {DECISIONS.map((decision) => (
                            <option key={decision} value={decision}>
                              {readableEnum(decision)}
                            </option>
                          ))}
                        </select>
                        <input
                          value={decisionDrafts[task.id]?.rationale ?? ""}
                          onChange={(event) =>
                            setDecisionDrafts((prev) => ({
                              ...prev,
                              [task.id]: { decision: prev[task.id]?.decision ?? "APPROVE", rationale: event.target.value },
                            }))
                          }
                          placeholder="Decision rationale and notes"
                          className="h-9 rounded-md border border-slate-300 px-3 text-sm"
                        />
                        <Button size="sm" onClick={() => void submitDecision(task.id)}>
                          Submit Decision
                        </Button>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on queue state, overdue risk, and priority score distribution."
      />
    </div>
  );
};
