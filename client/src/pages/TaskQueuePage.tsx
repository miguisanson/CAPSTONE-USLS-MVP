import { useEffect, useState } from "react";
import { tasksApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { useAuth } from "../app/AuthContext";
import type { Paginated, TaskDecision, TaskItem } from "../types/domain";
import { formatDate, readableEnum } from "../utils/format";
import { canViewTeamQueue } from "../utils/roles";

const DECISIONS: TaskDecision[] = ["APPROVE", "REVISE", "RETURN"];

export const TaskQueuePage = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"my" | "team">("my");
  const [data, setData] = useState<Paginated<TaskItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<Record<number, { decision: TaskDecision; rationale: string }>>({});

  const fetchQueue = async () => {
    try {
      setLoading(true);
      const response =
        tab === "team" ? await tasksApi.teamQueue({ pageSize: 30 }) : await tasksApi.myQueue({ pageSize: 30 });
      setData(response);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchQueue();
  }, [tab]);

  const onDecision = async (taskId: number) => {
    const payload = decisionState[taskId] ?? { decision: "APPROVE" as TaskDecision, rationale: "" };
    try {
      await tasksApi.decide(taskId, payload);
      await fetchQueue();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Workflow Task Queue</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setTab("my")}
            className={`rounded-md px-3 py-1.5 text-sm ${
              tab === "my"
                ? "bg-[var(--gs-primary)] text-white"
                : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            My Tasks
          </button>
          {canViewTeamQueue(user?.roles ?? []) ? (
            <button
              onClick={() => setTab("team")}
              className={`rounded-md px-3 py-1.5 text-sm ${
                tab === "team"
                  ? "bg-[var(--gs-primary)] text-white"
                  : "border border-slate-300 text-slate-700 hover:bg-slate-100"
              }`}
            >
              Team Queue
            </button>
          ) : null}
        </div>
      </section>

      {loading ? <LoadingBlock text="Loading task queue..." /> : null}
      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          {data?.items?.length ? (
            <div className="space-y-3">
              {data.items.map((task) => (
                <div key={task.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{task.title}</p>
                      <p className="text-xs text-slate-500">
                        Status: {readableEnum(task.status)} | Due: {formatDate(task.dueAt)} | Next owner:{" "}
                        {task.nextActionOwnerRole ? readableEnum(task.nextActionOwnerRole) : "-"}
                      </p>
                      {task.student ? (
                        <p className="text-xs text-slate-500">
                          Student: {task.student.firstName} {task.student.lastName}
                        </p>
                      ) : null}
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-1 text-xs text-slate-600">
                      Priority {task.priorityScore}
                    </div>
                  </div>
                  {task.recommendedAction ? (
                    <p className="mt-2 text-xs text-[var(--gs-dark)]">{task.recommendedAction}</p>
                  ) : null}
                  {task.escalationPrompt ? <p className="mt-1 text-xs text-rose-700">{task.escalationPrompt}</p> : null}

                  {task.status !== "COMPLETED" ? (
                    <div className="mt-3 grid gap-2 md:grid-cols-[140px_1fr_auto]">
                      <select
                        value={decisionState[task.id]?.decision ?? "APPROVE"}
                        onChange={(event) =>
                          setDecisionState((prev) => ({
                            ...prev,
                            [task.id]: {
                              decision: event.target.value as TaskDecision,
                              rationale: prev[task.id]?.rationale ?? "",
                            },
                          }))
                        }
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        {DECISIONS.map((decision) => (
                          <option key={decision} value={decision}>
                            {readableEnum(decision)}
                          </option>
                        ))}
                      </select>
                      <input
                        placeholder="Rationale / notes"
                        value={decisionState[task.id]?.rationale ?? ""}
                        onChange={(event) =>
                          setDecisionState((prev) => ({
                            ...prev,
                            [task.id]: {
                              decision: prev[task.id]?.decision ?? "APPROVE",
                              rationale: event.target.value,
                            },
                          }))
                        }
                        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() => void onDecision(task.id)}
                        className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)]"
                      >
                        Submit Decision
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No tasks found in this queue." />
          )}
        </section>
      ) : null}
    </div>
  );
};

