import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { homeApi, tasksApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { StatCard } from "../components/StatCard";
import type { DashboardSummary, TaskItem } from "../types/domain";
import { formatDate, readableEnum } from "../utils/format";

export const DashboardPage = () => {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryRes, taskRes] = await Promise.all([
          homeApi.dashboard(),
          tasksApi.myQueue({ pageSize: 5 }),
        ]);
        setSummary(summaryRes);
        setTasks(taskRes.items ?? []);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  if (loading) return <LoadingBlock text="Loading dashboard..." />;
  if (error) return <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>;
  if (!summary) return <EmptyState message="No dashboard summary available." />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Students in Scope" value={summary.studentsInScope} emphasis="primary" />
        <StatCard label="My Open Tasks" value={summary.myOpenTasks} />
        <StatCard label="Overdue Tasks" value={summary.overdueTasks} emphasis="danger" />
        <StatCard label="Open Alerts" value={summary.openAlerts} emphasis={summary.openAlerts > 0 ? "danger" : "neutral"} />
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Priority Task Snapshot</h2>
          <Link className="text-xs font-medium text-[var(--gs-dark)] hover:underline" to="/tasks">
            Open Task Queue
          </Link>
        </div>
        {tasks.length === 0 ? (
          <EmptyState message="No tasks assigned in current queue." />
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">Task</th>
                  <th className="px-2 py-2">Student</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Due</th>
                  <th className="px-2 py-2">Priority</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((task) => (
                  <tr key={task.id} className="border-t border-slate-100">
                    <td className="px-2 py-2">
                      <p className="font-medium text-slate-800">{task.title}</p>
                      {task.recommendedAction ? (
                        <p className="text-xs text-slate-500">{task.recommendedAction}</p>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 text-slate-600">
                      {task.student ? `${task.student.firstName} ${task.student.lastName}` : "-"}
                    </td>
                    <td className="px-2 py-2 text-slate-700">{readableEnum(task.status)}</td>
                    <td className="px-2 py-2 text-slate-600">{formatDate(task.dueAt)}</td>
                    <td className="px-2 py-2 text-slate-800">{task.priorityScore}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

