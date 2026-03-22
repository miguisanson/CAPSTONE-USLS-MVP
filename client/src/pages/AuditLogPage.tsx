import { useEffect, useMemo, useState } from "react";
import { auditApi } from "../api/endpoints";
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
import type { AuditLogItem, Paginated } from "../types/domain";
import { formatDateTime } from "../utils/format";

export const AuditLogPage = () => {
  const [data, setData] = useState<Paginated<AuditLogItem> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState("");
  const [actionType, setActionType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const load = async () => {
    try {
      setLoading(true);
      const res = await auditApi.list({
        userId: userId || undefined,
        actionType: actionType || undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 40,
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
  }, [page]);

  const recommendedActions = useMemo<RecommendedActionItem[]>(() => {
    const actions: RecommendedActionItem[] = [];
    const entries = data?.items ?? [];
    const denied = entries.filter((entry) => entry.actionType === "ACCESS_DENIED");
    if (denied.length > 0) {
      actions.push({
        id: "access-denied",
        title: "Review repeated access-denied events",
        description: `${denied.length} access-denied event(s) appear in current view. Validate role assignments and attempted routes.`,
        priority: "high",
        owner: "Admin",
      });
    }
    const configChanges = entries.filter((entry) => entry.actionType === "CONFIG_CHANGE");
    if (configChanges.length > 0) {
      actions.push({
        id: "config-change-review",
        title: "Validate recent configuration changes",
        description: `${configChanges.length} configuration change event(s) are present. Confirm change rationale and approval trail.`,
        priority: "medium",
      });
    }
    return actions;
  }, [data]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-5">
      <PageHeader title="Audit Log" subtitle="Append-only activity records for accountability, security, and compliance monitoring." />

      <Card>
        <CardBody className="p-4 md:p-5">
          <SectionTitle
            title="Audit Filters"
            subtitle="Filter by actor, action, entity, and date range"
            insight={
              <QuickInsights
                title="Audit Filters"
                summary="Filters refine append-only events by actor, action, and entity metadata."
                recommendation="Use narrow time windows for incident reconstruction and compliance checks."
              />
            }
          />
          <div className="grid gap-2 md:grid-cols-6">
            <input value={userId} onChange={(event) => setUserId(event.target.value)} placeholder="Actor user ID" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input value={actionType} onChange={(event) => setActionType(event.target.value)} placeholder="Action type" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="Entity type" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input value={entityId} onChange={(event) => setEntityId(event.target.value)} placeholder="Entity ID" className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
            <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="h-10 rounded-md border border-slate-300 px-3 text-sm" />
          </div>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPage(1);
                void load();
              }}
            >
              Apply Filters
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setUserId("");
                setActionType("");
                setEntityType("");
                setEntityId("");
                setFrom("");
                setTo("");
                setPage(1);
                setTimeout(() => void load(), 0);
              }}
            >
              Reset
            </Button>
          </div>
        </CardBody>
      </Card>

      {loading ? <LoadingBlock text="Loading audit logs..." /> : null}
      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      {!loading && !error ? (
        <Card>
          <CardBody className="p-0">
            {!data?.items.length ? (
              <div className="p-4">
                <EmptyState message="No audit entries for current filter scope." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="table-cell-head">Timestamp</th>
                      <th className="table-cell-head">Actor</th>
                      <th className="table-cell-head">Action</th>
                      <th className="table-cell-head">Entity</th>
                      <th className="table-cell-head">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                        <td className="table-cell text-xs">{formatDateTime(entry.createdAt)}</td>
                        <td className="table-cell text-xs">{entry.actor?.fullName ?? `User #${entry.actorUserId ?? "-"}`}</td>
                        <td className="table-cell">
                          <Badge tone={entry.actionType === "ACCESS_DENIED" ? "danger" : entry.actionType === "CONFIG_CHANGE" ? "warning" : "neutral"}>
                            {entry.actionType}
                          </Badge>
                        </td>
                        <td className="table-cell text-xs">
                          {entry.entityType} {entry.entityId ? `#${entry.entityId}` : ""}
                        </td>
                        <td className="table-cell text-xs">{entry.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      ) : null}

      {data ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">
              Page {data.page} of {pages} | {data.total} total records
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={data.page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
                Prev
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={data.page >= pages}
                onClick={() => setPage((prev) => Math.min(pages, prev + 1))}
              >
                Next
              </Button>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <RecommendedActions
        actions={recommendedActions}
        context="Page-level recommendations based on access-denied events, config changes, and current audit trail filters."
      />
    </div>
  );
};
