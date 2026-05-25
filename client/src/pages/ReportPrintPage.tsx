import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { Button } from "../components/ui/Button";
import type { AnalyticsDashboard, PrescriptiveAnalyticsResponse } from "../types/domain";
import { buildAnalyticsRecommendedActions } from "../utils/analyticsRecommendations";
import { readableEnum } from "../utils/format";

export const ReportPrintPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [prescriptive, setPrescriptive] = useState<PrescriptiveAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [descriptive, advisory] = await Promise.all([
          analyticsApi.descriptive(),
          analyticsApi.prescriptive().catch(() => null),
        ]);
        setData(descriptive);
        setPrescriptive(advisory);
      } catch (err) {
        setError(handleApiError(err));
      }
    };
    void load();
  }, []);

  const recommended = useMemo(() => buildAnalyticsRecommendedActions(data, prescriptive), [data, prescriptive]);

  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-slate-600">Loading printable analytics report...</div>;

  return (
    <div className="min-h-screen bg-white p-4 text-slate-900 md:p-8 print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-base font-semibold text-[var(--gs-primary)]">Printable Analytics Report</p>
          <Button size="md" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </Button>
        </div>

        <section className="rounded-xl border border-slate-300 p-5">
          <div className="border-b border-slate-300 pb-3">
            <p className="text-xl font-semibold">University of St. La Salle Graduate School</p>
            <p className="text-sm text-slate-600">Graduate Student Lifecycle Monitoring and Analytics Report</p>
            <p className="mt-1 text-xs text-slate-500">Generated: {new Date().toLocaleString()}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-slate-300 px-3 py-2">
              <p className="text-xs text-slate-500">Total Stage Records</p>
              <p className="text-2xl font-semibold">{data.stageCounts.reduce((acc, item) => acc + item.count, 0)}</p>
            </div>
            <div className="rounded-md border border-slate-300 px-3 py-2">
              <p className="text-xs text-slate-500">Queue Roles</p>
              <p className="text-2xl font-semibold">{data.pendingQueues.length}</p>
            </div>
            <div className="rounded-md border border-slate-300 px-3 py-2">
              <p className="text-xs text-slate-500">Scheduling Cycle</p>
              <p className="text-2xl font-semibold">{data.schedulingCycleTimeDays}d</p>
            </div>
            <div className="rounded-md border border-slate-300 px-3 py-2">
              <p className="text-xs text-slate-500">LOA Visibility</p>
              <p className="text-2xl font-semibold">{data.loaVisibilityCount}</p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold">Counts Per Stage</p>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1.5 text-left">Stage</th>
                    <th className="py-1.5 text-right">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stageCounts.map((item) => (
                    <tr key={item.stage} className="border-b border-slate-100">
                      <td className="py-1.5">{readableEnum(item.stage)}</td>
                      <td className="py-1.5 text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <p className="text-sm font-semibold">Pending Queue Distribution</p>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-300">
                    <th className="py-1.5 text-left">Queue Role</th>
                    <th className="py-1.5 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendingQueues.map((item) => (
                    <tr key={item.role} className="border-b border-slate-100">
                      <td className="py-1.5">{readableEnum(item.role)}</td>
                      <td className="py-1.5 text-right">{item.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold">Average Time in Stage</p>
            <table className="mt-2 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-300">
                  <th className="py-1.5 text-left">Stage</th>
                  <th className="py-1.5 text-right">Average Days</th>
                </tr>
              </thead>
              <tbody>
                {data.agingByStage.map((item) => (
                  <tr key={item.stage} className="border-b border-slate-100">
                    <td className="py-1.5">{readableEnum(item.stage)}</td>
                    <td className="py-1.5 text-right">{item.averageDays}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 rounded-md border border-slate-300 bg-slate-50 p-3">
            <p className="text-sm font-semibold">Recommended Actions</p>
            {recommended.length === 0 ? (
              <p className="mt-1 text-sm">No high-risk actions are currently required. Continue routine monitoring.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {recommended.map((item) => (
                  <li key={item.id} className="rounded border border-slate-300 bg-white px-3 py-2">
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5">{item.description}</p>
                    {item.owner || item.eta ? (
                      <p className="mt-0.5 text-xs text-slate-600">
                        {item.owner ? `Owner: ${item.owner}` : ""} {item.owner && item.eta ? "| " : ""}
                        {item.eta ? `Target: ${item.eta}` : ""}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-500">
              Advisory only. Final interventions must follow authorized graduate school policy and reviewer validation.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
