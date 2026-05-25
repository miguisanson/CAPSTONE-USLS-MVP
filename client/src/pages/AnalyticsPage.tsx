import { Bar, Doughnut, Line } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Download, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "../api/endpoints";
import { api, handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { AnalyticsDashboard, PrescriptiveAnalyticsResponse } from "../types/domain";
import { buildAnalyticsRecommendedActions } from "../utils/analyticsRecommendations";
import { readableEnum } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend);

const COLORS = ["#006633", "#128a4a", "#2f855a", "#f59e0b", "#0f766e", "#2563eb", "#7c3aed", "#b42318", "#6b7280"];

export const AnalyticsPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [prescriptive, setPrescriptive] = useState<PrescriptiveAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [descriptive, advisory] = await Promise.all([
          analyticsApi.descriptive(),
          analyticsApi.prescriptive().catch(() => null),
        ]);
        setData(descriptive);
        setPrescriptive(advisory);
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
      labels: data?.stageCounts.map((item) => readableEnum(item.stage)) ?? [],
      datasets: [
        {
          label: "Students",
          data: data?.stageCounts.map((item) => item.count) ?? [],
          borderRadius: 6,
          backgroundColor: COLORS,
        },
      ],
    }),
    [data]
  );

  const queueChartData = useMemo(
    () => ({
      labels: data?.pendingQueues.map((item) => readableEnum(item.role)) ?? [],
      datasets: [
        {
          data: data?.pendingQueues.map((item) => item.count) ?? [],
          backgroundColor: COLORS,
        },
      ],
    }),
    [data]
  );

  const agingLineData = useMemo(
    () => ({
      labels: data?.agingByStage.map((item) => readableEnum(item.stage)) ?? [],
      datasets: [
        {
          label: "Average Days",
          data: data?.agingByStage.map((item) => item.averageDays) ?? [],
          borderColor: "#006633",
          backgroundColor: "rgba(0, 102, 51, 0.2)",
          tension: 0.3,
          fill: true,
        },
      ],
    }),
    [data]
  );

  const recommendedActions = useMemo(() => buildAnalyticsRecommendedActions(data, prescriptive), [data, prescriptive]);

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

  if (loading) {
    return <LoadingBlock text="Loading analytics..." />;
  }

  if (!data) {
    return <EmptyState message="No analytics data available." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Analytics"
        subtitle="Descriptive metrics and advisory decision support for graduate lifecycle operations."
        help={{
          title: "Analytics and Decision Support",
          summary: "This module summarizes stage distribution, queue load, time-in-stage, workload indicators, and rule-based advisory recommendations.",
          recommendation: "Treat recommendations as decision support; final academic or administrative decisions still belong to authorized roles.",
        }}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void downloadCsv()}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.open(`/analytics/print?ts=${Date.now()}`, "_blank", "noopener,noreferrer")}
            >
              <Printer className="h-3.5 w-3.5" />
              Printable Report
            </Button>
          </>
        }
      />

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Students by Lifecycle Stage"
              subtitle="Descriptive stage distribution"
              insight={
                <QuickInsights
                  title="Stage Distribution Chart"
                  summary="Counts how many students are currently in each lifecycle stage."
                  recommendation="Use this with aging data to spot possible bottleneck stages."
                />
              }
            />
            <Bar data={stageChartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Pending Queue Distribution"
              subtitle="Current pending workload by owner role"
              insight={
                <QuickInsights
                  title="Queue Distribution Chart"
                  summary="Shows pending workflow counts grouped by next owner role."
                  recommendation="High queue concentration suggests routing or staffing interventions."
                />
              }
            />
            <div className="mx-auto max-w-sm">
              <Doughnut data={queueChartData} />
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Average Time in Stage"
              subtitle="Aging trend by lifecycle stage"
              insight={
                <QuickInsights
                  title="Aging Trend"
                  summary="Tracks average days in stage for students currently in each lifecycle segment."
                  recommendation="Prioritize stages with high aging and high task backlog."
                />
              }
            />
            <Line data={agingLineData} />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Workload Indicators"
              subtitle="Task load by owner"
              insight={
                <QuickInsights
                  title="Workload Indicators"
                  summary="Shows current active task counts per owner for operational balancing."
                  recommendation="Rebalance assignments when one owner consistently exceeds team average."
                />
              }
            />
            <div className="mb-2 text-xs text-slate-600">
              Scheduling cycle time: <span className="font-semibold">{data.schedulingCycleTimeDays}</span> days | LOA visibility:{" "}
              <span className="font-semibold">{data.loaVisibilityCount}</span>
            </div>
            <div className="space-y-1.5">
              {data.workloadIndicators.slice(0, 10).map((item) => (
                <div key={item.owner} className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs">
                  <span>{item.owner}</span>
                  <Badge tone={item.taskCount > 4 ? "warning" : "neutral"}>{item.taskCount}</Badge>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </section>
      <RecommendedActions
        actions={recommendedActions}
        context={
          prescriptive
            ? `Final page-level summary auto-generated on page load using descriptive metrics and advisory signals (AI ${prescriptive.ai.status}).`
            : "Final page-level summary auto-generated on page load using descriptive metrics."
        }
      />
    </div>
  );
};
