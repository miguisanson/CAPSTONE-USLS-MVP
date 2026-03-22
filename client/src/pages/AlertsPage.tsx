import { Play } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { alertsApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card, CardBody } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { QuickInsights } from "../components/ui/QuickInsights";
import { RecommendedActions, type RecommendedActionItem } from "../components/ui/RecommendedActions";
import { SectionTitle } from "../components/ui/SectionTitle";
import type { AlertItem, AlertStatus, Paginated } from "../types/domain";
import { diffDaysFromNow, formatDateTime, readableEnum } from "../utils/format";
import { alertStatusTone } from "../utils/presentation";

export const AlertsPage = () => {
  const [data, setData] = useState<Paginated<AlertItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [interventions, setInterventions] = useState<Record<number, { actionTaken: string; evidenceNote: string }>>({});
  const [closureEvidence, setClosureEvidence] = useState<Record<number, string>>({});

  const load = async () => {
    try {
      setLoading(true);
      const res = await alertsApi.list({
        status: status || undefined,
        alertType: typeFilter || undefined,
        severity: severityFilter || undefined,
        pageSize: 60,
      });
      setData(res);
      setError(null);
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [severityFilter, status, typeFilter]);

  const filteredAlerts = useMemo(() => {
    return data?.items ?? [];
  }, [data]);

  const stats = useMemo(() => {
    const source = data?.items ?? [];
    return {
      total: source.length,
      open: source.filter((item) => item.status === "OPEN").length,
      acknowledged: source.filter((item) => item.status === "ACKNOWLEDGED").length,
      closed: source.filter((item) => item.status === "CLOSED").length,
    };
  }, [data]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    const openAlerts = filteredAlerts.filter((item) => item.status === "OPEN");
    if (openAlerts.length > 0) {
      actions.push({
        id: "open-alerts",
        title: "Log interventions for open alerts",
        description: `${openAlerts.length} alert(s) are open with no closure outcome yet. Record intervention actions and assign owners.`,
        priority: "high",
      });
    }
    const criticalAlerts = filteredAlerts.filter((item) => item.severity === "CRITICAL" && item.status !== "CLOSED");
    if (criticalAlerts.length > 0) {
      actions.push({
        id: "critical-alerts",
        title: "Prioritize critical alerts",
        description: `${criticalAlerts.length} critical alert(s) remain unresolved. Escalate to coordinators and track closure evidence.`,
        priority: "high",
      });
    }
    const aging = filteredAlerts.filter((item) => diffDaysFromNow(item.triggeredAt) > 10 && item.status !== "CLOSED");
    if (aging.length > 0) {
      actions.push({
        id: "aging-alerts",
        title: "Escalate aging alert cases",
        description: `${aging.length} alert(s) are older than 10 days. Validate intervention progress and move to closure.`,
        priority: "medium",
      });
    }
    return actions;
  }, [filteredAlerts]);

  const runMonitoring = async () => {
    try {
      await alertsApi.runMonitoring();
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const addIntervention = async (alertId: number) => {
    const payload = interventions[alertId];
    if (!payload?.actionTaken?.trim()) return;
    try {
      await alertsApi.addIntervention(alertId, {
        actionTaken: payload.actionTaken,
        evidenceNote: payload.evidenceNote || undefined,
      });
      setInterventions((prev) => ({ ...prev, [alertId]: { actionTaken: "", evidenceNote: "" } }));
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const closeIntervention = async (interventionId: number) => {
    const evidence = closureEvidence[interventionId]?.trim();
    if (!evidence) return;
    try {
      await alertsApi.closeIntervention(interventionId, evidence);
      setClosureEvidence((prev) => ({ ...prev, [interventionId]: "" }));
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const setAlertStatus = async (alertId: number, nextStatus: AlertStatus) => {
    try {
      await alertsApi.updateStatus(alertId, nextStatus);
      await load();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monitoring Alerts"
        subtitle="Alert monitoring cycle, interventions, and evidence-based closure workflows."
        actions={
          <Button size="sm" onClick={() => void runMonitoring()}>
            <Play className="h-3.5 w-3.5" />
            Run Monitoring Cycle
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Total Alerts</p>
            <p className="mt-1 text-3xl font-semibold text-slate-900">{stats.total}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Open</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-danger)]">{stats.open}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Acknowledged</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-warning)]">{stats.acknowledged}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Closed</p>
            <p className="mt-1 text-3xl font-semibold text-[var(--gs-success)]">{stats.closed}</p>
          </CardBody>
        </Card>
      </section>

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Alert Filters"
            subtitle="Filter by status, type, and severity"
            insight={
              <QuickInsights
                title="Alert Filters"
                summary="Filters narrow the alert list for targeted intervention handling."
                recommendation="Start with open + critical filters for escalation review."
              />
            }
          />
          <div className="grid gap-2 md:grid-cols-3">
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="CLOSED">Closed</option>
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm">
              <option value="">All alert types</option>
              <option value="PROLONGED_STAGE">Prolonged Stage</option>
              <option value="UNRESOLVED_HANDOFF">Unresolved Handoff</option>
              <option value="DELAYED_SCHEDULING">Delayed Scheduling</option>
              <option value="INACTIVITY">Inactivity</option>
            </select>
            <select
              value={severityFilter}
              onChange={(event) => setSeverityFilter(event.target.value)}
              className="h-10 rounded-md border border-slate-300 px-3 text-sm"
            >
              <option value="">All severities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
        </CardBody>
      </Card>

      {loading ? <LoadingBlock text="Loading monitoring alerts..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-4 md:p-5">
            <SectionTitle
              title="Alert Cases"
              subtitle="Alert details, interventions, and closure handling"
              insight={
                <QuickInsights
                  title="Alert Case Cards"
                  summary="Each card includes severity, age, interventions, and closure evidence paths."
                  recommendation="Record intervention updates as soon as action is performed."
                />
              }
            />
            {filteredAlerts.length === 0 ? (
              <EmptyState message="No alerts found for current filters." />
            ) : (
              <div className="space-y-3">
                {filteredAlerts.map((alert) => (
                  <article key={alert.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {alert.student ? `${alert.student.firstName} ${alert.student.lastName}` : `Student #${alert.studentId}`} |{" "}
                          {readableEnum(alert.alertType)}
                        </p>
                        <p className="text-[11px] text-slate-600">
                          Severity: {alert.severity} | Triggered: {formatDateTime(alert.triggeredAt)} | Age: {diffDaysFromNow(alert.triggeredAt)} day(s)
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={alertStatusTone(alert.status)}>{readableEnum(alert.status)}</Badge>
                        <Badge tone={alert.severity === "CRITICAL" || alert.severity === "HIGH" ? "danger" : "warning"}>{alert.severity}</Badge>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{alert.message}</p>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {alert.status === "OPEN" ? (
                        <Button size="sm" variant="outline" onClick={() => void setAlertStatus(alert.id, "ACKNOWLEDGED")}>
                          Mark Acknowledged
                        </Button>
                      ) : null}
                      {alert.status !== "CLOSED" ? (
                        <Button size="sm" variant="outline" onClick={() => void setAlertStatus(alert.id, "CLOSED")}>
                          Mark Closed
                        </Button>
                      ) : null}
                    </div>

                    <div className="mt-2 grid gap-2 lg:grid-cols-2">
                      <div className="rounded-md border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Interventions</p>
                        {alert.interventions.length === 0 ? (
                          <p className="mt-1 text-xs text-slate-500">No interventions logged yet.</p>
                        ) : (
                          <ul className="mt-1 space-y-1">
                            {alert.interventions.map((item) => (
                              <li key={item.id} className="rounded border border-slate-200 px-2 py-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1">
                                  <p className="text-xs font-semibold text-slate-800">{item.actionTaken}</p>
                                  <Badge tone={item.status === "CLOSED" ? "success" : "warning"}>{item.status}</Badge>
                                </div>
                                <p className="mt-0.5 text-[11px] text-slate-600">{item.evidenceNote ?? "No evidence note provided."}</p>
                                {item.status !== "CLOSED" ? (
                                  <div className="mt-1 flex gap-1.5">
                                    <input
                                      value={closureEvidence[item.id] ?? ""}
                                      onChange={(event) => setClosureEvidence((prev) => ({ ...prev, [item.id]: event.target.value }))}
                                      placeholder="Closure evidence"
                                      className="h-7 flex-1 rounded border border-slate-300 px-2 text-xs"
                                    />
                                    <Button size="sm" variant="outline" onClick={() => void closeIntervention(item.id)}>
                                      Close
                                    </Button>
                                  </div>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-md border border-slate-200 bg-white p-2.5">
                        <p className="text-xs font-semibold text-slate-700">Log Intervention</p>
                        <input
                          value={interventions[alert.id]?.actionTaken ?? ""}
                          onChange={(event) =>
                            setInterventions((prev) => ({
                              ...prev,
                              [alert.id]: {
                                actionTaken: event.target.value,
                                evidenceNote: prev[alert.id]?.evidenceNote ?? "",
                              },
                            }))
                          }
                          placeholder="Action taken"
                          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-xs"
                        />
                        <input
                          value={interventions[alert.id]?.evidenceNote ?? ""}
                          onChange={(event) =>
                            setInterventions((prev) => ({
                              ...prev,
                              [alert.id]: {
                                actionTaken: prev[alert.id]?.actionTaken ?? "",
                                evidenceNote: event.target.value,
                              },
                            }))
                          }
                          placeholder="Evidence note"
                          className="mt-1 h-8 w-full rounded border border-slate-300 px-2 text-xs"
                        />
                        <Button size="sm" variant="outline" className="mt-1.5" onClick={() => void addIntervention(alert.id)}>
                          Add Intervention
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on alert status, severity, and intervention aging indicators."
      />
    </div>
  );
};
