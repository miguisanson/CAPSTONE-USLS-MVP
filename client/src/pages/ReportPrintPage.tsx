import { Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { analyticsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import type { AnalyticsDashboard } from "../types/domain";
import { readableEnum } from "../utils/format";

export const ReportPrintPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await analyticsApi.descriptive();
        setData(res);
      } catch (err) {
        setError(handleApiError(err));
      }
    };
    void load();
  }, []);

  const recommended = useMemo(() => {
    if (!data) return [];
    const result: string[] = [];
    const highAging = data.agingByStage.filter((item) => item.averageDays > 60);
    if (highAging.length > 0) {
      result.push(`Prioritize intervention on ${highAging.length} stage(s) with average aging above 60 days.`);
    }
    const heavyQueues = data.pendingQueues.filter((item) => item.count > 5);
    if (heavyQueues.length > 0) {
      result.push(`Rebalance workloads for ${heavyQueues.length} queue role(s) with high pending counts.`);
    }
    if (data.schedulingCycleTimeDays > 10) {
      result.push(`Reduce scheduling cycle time from current ${data.schedulingCycleTimeDays} days.`);
    }
    if (result.length === 0) {
      result.push("Maintain routine monitoring cadence and continue weekly analytics review.");
    }
    return result;
  }, [data]);

  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-slate-600">Loading printable analytics report...</div>;

  return (
    <div className="min-h-screen bg-white p-4 text-slate-900 md:p-8 print:p-0">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <p className="text-base font-semibold text-[var(--gs-primary)]">Printable Analytics Report</p>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-md bg-[var(--gs-primary)] px-3 py-2 text-sm font-semibold text-white"
          >
            <Printer className="h-4 w-4" />
            Print / Save PDF
          </button>
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
            <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm">
              {recommended.map((item, index) => (
                <li key={`${item}-${index}`}>{item}</li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              Advisory only. Final interventions must follow authorized graduate school policy and reviewer validation.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
