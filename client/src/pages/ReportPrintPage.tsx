import { useEffect, useState } from "react";
import { analyticsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import type { AnalyticsDashboard } from "../types/domain";

export const ReportPrintPage = () => {
  const [data, setData] = useState<AnalyticsDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await analyticsApi.dashboard();
        setData(response);
      } catch (err) {
        setError(handleApiError(err));
      }
    };
    void load();
  }, []);

  if (error) return <div className="p-6 text-sm text-rose-700">{error}</div>;
  if (!data) return <div className="p-6 text-sm text-slate-600">Loading printable report...</div>;

  return (
    <div className="min-h-screen bg-white p-6 text-slate-800 print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <h1 className="text-lg font-semibold text-[var(--gs-dark)]">Printable Analytics Report</h1>
          <button onClick={() => window.print()} className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white">
            Print / Save as PDF
          </button>
        </div>

        <h2 className="text-xl font-semibold text-[var(--gs-dark)]">Graduate Lifecycle Monitoring Report</h2>
        <p className="mt-1 text-xs text-slate-500">Generated at {new Date().toLocaleString()}</p>

        <section className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 text-sm font-semibold">Counts Per Stage</h3>
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2">Stage</th>
                <th className="px-2 py-2">Count</th>
              </tr>
            </thead>
            <tbody>
              {data.stageCounts.map((item) => (
                <tr key={item.stage} className="border-t border-slate-100">
                  <td className="px-2 py-2">{item.stage.replace(/_/g, " ")}</td>
                  <td className="px-2 py-2">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 rounded-lg border border-slate-200 p-4">
          <h3 className="mb-2 text-sm font-semibold">Queue + Cycle Summary</h3>
          <p className="text-sm">Scheduling cycle time: {data.schedulingCycleTimeDays} days</p>
          <p className="text-sm">LOA visibility count: {data.loaVisibilityCount}</p>
          <table className="mt-3 min-w-full text-sm">
            <thead className="text-left text-xs text-slate-500">
              <tr>
                <th className="px-2 py-2">Queue Role</th>
                <th className="px-2 py-2">Pending Items</th>
              </tr>
            </thead>
            <tbody>
              {data.pendingQueues.map((item) => (
                <tr key={item.role} className="border-t border-slate-100">
                  <td className="px-2 py-2">{item.role.replace(/_/g, " ")}</td>
                  <td className="px-2 py-2">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
};
