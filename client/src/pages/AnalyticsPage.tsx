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
import type { AnalyticsDashboard, PrescriptiveAnalyticsResponse } from "../types/domain";

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
];

export const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [prescriptive, setPrescriptive] = useState<PrescriptiveAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptiveLoading, setPrescriptiveLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [program, setProgram] = useState("");
  const [stage, setStage] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await analyticsApi.descriptive();
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

  const generatePrescriptive = async () => {
    try {
      setPrescriptiveLoading(true);
      const response = await analyticsApi.prescriptive({
        program: program || undefined,
        stage: stage || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setPrescriptive(response);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setPrescriptiveLoading(false);
    }
  };

  if (loading) return <LoadingBlock text="Loading analytics dashboard..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Descriptive Analytics</h2>
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
              <div className="overflow-x-auto">
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
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Workload Indicators</h3>
              <p className="mb-2 text-xs text-slate-500">
                Scheduling cycle time: <strong>{data.schedulingCycleTimeDays}</strong> days | LOA count:{" "}
                <strong>{data.loaVisibilityCount}</strong>
              </p>
              <div className="overflow-x-auto">
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
              </div>
            </section>
          </div>
        </>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Prescriptive Decision Support</h3>
            <p className="text-xs text-slate-500">Rule-based recommendations are always available. AI is advisory-only.</p>
          </div>
          <button
            onClick={() => void generatePrescriptive()}
            disabled={prescriptiveLoading}
            className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)] disabled:opacity-60"
          >
            {prescriptiveLoading ? "Generating..." : "Generate Recommendations"}
          </button>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <input
            value={program}
            onChange={(event) => setProgram(event.target.value)}
            placeholder="Program code/name"
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <select
            value={stage}
            onChange={(event) => setStage(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          >
            <option value="">All stages</option>
            {STAGES.map((item) => (
              <option key={item} value={item}>
                {item.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
        </div>

        {!prescriptive ? (
          <p className="mt-3 text-xs text-slate-500">Generate prescriptive recommendations to view prioritized actions.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-800">{prescriptive.summary}</p>
              <p className="mt-1 text-xs text-slate-600">{prescriptive.disclaimer}</p>
              <p className="mt-1 text-xs text-slate-600">
                AI status: <strong>{prescriptive.ai.status.toUpperCase()}</strong> - {prescriptive.ai.message}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Priority Actions</p>
                <div className="space-y-2">
                  {prescriptive.priority_actions.map((item, index) => (
                    <div key={`${item.action}-${index}`} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">{item.action}</p>
                      <p className="text-xs text-slate-600">{item.why}</p>
                      <p className="text-[11px] text-slate-500">
                        Owner: {item.who} | Timeframe: {item.timeframe} | Confidence: {item.confidence}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1 text-xs font-semibold text-slate-600">Top Cases (De-identified)</p>
                <div className="space-y-2">
                  {prescriptive.top_cases.map((item) => (
                    <div key={item.student_ref} className="rounded-lg border border-slate-200 px-3 py-2">
                      <p className="text-sm font-medium text-slate-800">
                        {item.student_ref} | score {item.priority_score}
                      </p>
                      <p className="text-xs text-slate-600">{item.reason}</p>
                      <p className="text-xs text-[var(--gs-dark)]">{item.recommended_next_action}</p>
                      <p className="text-[11px] text-slate-500">
                        Owner: {item.owner_role} | Confidence: {item.confidence}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
