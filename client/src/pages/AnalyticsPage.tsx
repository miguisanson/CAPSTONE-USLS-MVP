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
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { AnalyticsDashboard, PrescriptiveAnalyticsResponse } from "../types/domain";
import { readableEnum } from "../utils/format";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, LineElement, PointElement, Tooltip, Legend);

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

const COLORS = ["#006633", "#128a4a", "#2f855a", "#f59e0b", "#0f766e", "#2563eb", "#7c3aed", "#b42318", "#6b7280"];

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
        const res = await analyticsApi.descriptive();
        setData(res);
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

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    if (prescriptive?.priority_actions?.length) {
      prescriptive.priority_actions.slice(0, 4).forEach((action, index) => {
        actions.push({
          id: `prescriptive-${index}`,
          title: action.action,
          description: action.why,
          priority: action.confidence === "high" ? "high" : action.confidence === "med" ? "medium" : "low",
          owner: action.who,
          eta: action.timeframe,
        });
      });
      return actions;
    }

    if (!data) return actions;

    const slowStages = data.agingByStage.filter((item) => item.averageDays > 60);
    if (slowStages.length > 0) {
      actions.push({
        id: "slow-stages",
        title: "Address prolonged stage aging",
        description: `${slowStages.length} stage(s) exceed 60 average days. Review blockers and intervention patterns.`,
        priority: "high",
        owner: "Coordinators",
      });
    }
    const heavyQueues = data.pendingQueues.filter((item) => item.count > 5);
    if (heavyQueues.length > 0) {
      actions.push({
        id: "heavy-queues",
        title: "Rebalance heavy queues",
        description: `${heavyQueues.length} queue role(s) have high pending load. Reassign or escalate to avoid handoff delays.`,
        priority: "medium",
      });
    }
    if (data.schedulingCycleTimeDays > 10) {
      actions.push({
        id: "cycle-time",
        title: "Improve scheduling cycle time",
        description: `Average scheduling cycle time is ${data.schedulingCycleTimeDays} days. Review confirmation and availability bottlenecks.`,
        priority: "medium",
      });
    }
    return actions;
  }, [data, prescriptive]);

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
      const res = await analyticsApi.prescriptive({
        program: program || undefined,
        stage: stage || undefined,
        from: from || undefined,
        to: to || undefined,
      });
      setPrescriptive(res);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setPrescriptiveLoading(false);
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
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => void downloadCsv()}>
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <a
              href="/analytics/print"
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Printer className="h-3.5 w-3.5" />
              Printable Report
            </a>
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

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Prescriptive Generation Controls"
            subtitle="Advisory-only analytics recommendations"
            insight={
              <QuickInsights
                title="Prescriptive Controls"
                summary="Generate advisory recommendations using filtered descriptive signals."
                recommendation="Always review recommendations with policy context before action."
              />
            }
            actions={
              <Button size="sm" onClick={() => void generatePrescriptive()} disabled={prescriptiveLoading}>
                {prescriptiveLoading ? "Generating..." : "Generate Recommendations"}
              </Button>
            }
          />
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={program}
              onChange={(event) => setProgram(event.target.value)}
              placeholder="Program code/name"
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            />
            <select value={stage} onChange={(event) => setStage(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">All stages</option>
              {STAGES.map((item) => (
                <option key={item} value={item}>
                  {readableEnum(item)}
                </option>
              ))}
            </select>
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          </div>

          {prescriptive ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{prescriptive.summary}</p>
                <Badge tone={prescriptive.ai.status === "success" ? "success" : prescriptive.ai.status === "error" ? "warning" : "neutral"}>
                  AI {prescriptive.ai.status.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs text-slate-600">{prescriptive.disclaimer}</p>
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div className="rounded-md border border-slate-200 bg-white p-2">
                  <p className="text-xs font-semibold text-slate-700">Priority Actions</p>
                  <ul className="mt-1 space-y-1">
                    {prescriptive.priority_actions.map((item, index) => (
                      <li key={`${item.action}-${index}`} className="text-xs text-slate-700">
                        <span className="font-semibold">{item.action}</span>: {item.why}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-slate-200 bg-white p-2">
                  <p className="text-xs font-semibold text-slate-700">Top Cases</p>
                  <ul className="mt-1 space-y-1">
                    {prescriptive.top_cases.slice(0, 5).map((item) => (
                      <li key={item.student_ref} className="text-xs text-slate-700">
                        <span className="font-semibold">{item.student_ref}</span>: {item.recommended_next_action}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-slate-600">Generate recommendations to view advisory prescriptive output for this page.</p>
          )}
        </CardBody>
      </Card>

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level advisory summary synthesized from descriptive metrics and prescriptive outputs."
      />
    </div>
  );
};
