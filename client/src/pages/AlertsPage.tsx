import { useEffect, useState } from "react";
import { alertsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import type { AlertItem, Paginated } from "../types/domain";
import { formatDateTime, readableEnum } from "../utils/format";

export const AlertsPage = () => {
  const [data, setData] = useState<Paginated<AlertItem> | null>(null);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionTaken, setActionTaken] = useState("");
  const [evidence, setEvidence] = useState("");
  const [closureEvidence, setClosureEvidence] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const result = await alertsApi.list({
        status: status || undefined,
        pageSize: 40,
      });
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
  }, [status]);

  const runMonitoring = async () => {
    try {
      await alertsApi.runMonitoring();
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const addIntervention = async (alertId: number) => {
    if (!actionTaken.trim()) return;
    try {
      await alertsApi.addIntervention(alertId, {
        actionTaken,
        evidenceNote: evidence || undefined,
      });
      setActionTaken("");
      setEvidence("");
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const closeIntervention = async (interventionId: number) => {
    if (!closureEvidence.trim()) return;
    try {
      await alertsApi.closeIntervention(interventionId, closureEvidence);
      setClosureEvidence("");
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <LoadingBlock text="Loading alerts and interventions..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-800">Monitoring Alerts & Interventions</h2>
          <button
            onClick={() => void runMonitoring()}
            className="rounded-md bg-[var(--gs-primary)] px-3 py-1.5 text-sm text-white hover:bg-[var(--gs-dark)]"
          >
            Run Monitoring Cycle
          </button>
        </div>
        <div className="mt-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            <option value="OPEN">Open</option>
            <option value="ACKNOWLEDGED">Acknowledged</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!data?.items.length ? (
          <EmptyState message="No alerts in current filter." />
        ) : (
          <div className="space-y-3">
            {data.items.map((alert) => (
              <div key={alert.id} className="rounded-xl border border-slate-100 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      {readableEnum(alert.alertType)} - {alert.student ? `${alert.student.firstName} ${alert.student.lastName}` : `Student #${alert.studentId}`}
                    </p>
                    <p className="text-xs text-slate-500">
                      Severity: {alert.severity} | Status: {readableEnum(alert.status)} | Triggered: {formatDateTime(alert.triggeredAt)}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">Threshold: {alert.thresholdDays ?? "-"} days</div>
                </div>
                <p className="mt-1 text-sm text-slate-700">{alert.message}</p>

                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-600">Interventions</p>
                    {alert.interventions.length === 0 ? (
                      <p className="mt-1 text-xs text-slate-500">No interventions logged.</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs">
                        {alert.interventions.map((intervention) => (
                          <li key={intervention.id} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                            {intervention.actionTaken} ({intervention.status})
                            {intervention.status !== "CLOSED" ? (
                              <button
                                onClick={() => void closeIntervention(intervention.id)}
                                className="ml-2 rounded border border-slate-300 px-1 py-0.5 text-[10px]"
                              >
                                Close
                              </button>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2">
                    <p className="text-xs font-semibold text-slate-600">Log Intervention</p>
                    <input
                      value={actionTaken}
                      onChange={(event) => setActionTaken(event.target.value)}
                      placeholder="Action taken"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={evidence}
                      onChange={(event) => setEvidence(event.target.value)}
                      placeholder="Evidence note"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <input
                      value={closureEvidence}
                      onChange={(event) => setClosureEvidence(event.target.value)}
                      placeholder="Closure evidence (for close action)"
                      className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                    <button
                      onClick={() => void addIntervention(alert.id)}
                      className="mt-2 rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100"
                    >
                      Add Intervention
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

