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
import { analyticsApi } from "../api/endpoints";
import { api, handleApiError } from "../api/client";
import { LoadingBlock } from "../components/LoadingBlock";
import { EmptyState } from "../components/EmptyState";
import type { AnalyticsDashboard } from "../types/domain";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

export const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await analyticsApi.dashboard();
        setData(response);
        setError(null);
      } catch (err) {
        setError(handleApiError(err));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const stageChartData = useMemo(
    () => ({
      labels: data?.stageCounts.map((item) => item.stage.replace(/_/g, " ")) ?? [],
      datasets: [
        {
          label: "Students",
          data: data?.stageCounts.map((item) => item.count) ?? [],
          backgroundColor: "#008f46",
          borderRadius: 6,
        },
      ],
    }),
    [data]
  );

  const queueChartData = useMemo(
    () => ({
      labels: data?.pendingQueues.map((item) => item.role.replace(/_/g, " ")) ?? [],
      datasets: [
        {
          data: data?.pendingQueues.map((item) => item.count) ?? [],
          backgroundColor: ["#008f46", "#026f38", "#0f766e", "#2563eb", "#f59e0b", "#ef4444"],
        },
      ],
    }),
    [data]
  );

  const downloadCsv = async () => {
    try {
      const response = await api.get("/api/analytics/report.csv", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "analytics-report.csv");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading analytics dashboard..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Analytics & Reporting</h2>
          <div className="flex gap-2">
            <button
              onClick={() => void downloadCsv()}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Export CSV
            </button>
            <a
              href="/analytics/print"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100"
            >
              Printable Report
            </a>
          </div>
        </div>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      {!data ? (
        <EmptyState message="No analytics data available." />
      ) : (
        <>
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Counts Per Stage</h3>
              <Bar data={stageChartData} />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Pending Queue Distribution</h3>
              <div className="mx-auto max-w-sm">
                <Doughnut data={queueChartData} />
              </div>
            </section>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Aging / Time in Stage</h3>
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Stage</th>
                    <th className="px-2 py-2">Average Days</th>
                  </tr>
                </thead>
                <tbody>
                  {data.agingByStage.map((item) => (
                    <tr key={item.stage} className="border-t border-slate-100">
                      <td className="px-2 py-2">{item.stage.replace(/_/g, " ")}</td>
                      <td className="px-2 py-2">{item.averageDays}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Workload Indicators</h3>
              <p className="mb-2 text-xs text-slate-500">
                Scheduling cycle time: <strong>{data.schedulingCycleTimeDays}</strong> days | LOA count:{" "}
                <strong>{data.loaVisibilityCount}</strong>
              </p>
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Owner</th>
                    <th className="px-2 py-2">Task Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.workloadIndicators.map((item) => (
                    <tr key={item.owner} className="border-t border-slate-100">
                      <td className="px-2 py-2">{item.owner}</td>
                      <td className="px-2 py-2">{item.taskCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
};
