import { useEffect, useState } from "react";
import { auditApi } from "../api/endpoints";
import { handleApiError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { LoadingBlock } from "../components/LoadingBlock";
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
      const response = await auditApi.list({
        userId: userId || undefined,
        actionType: actionType || undefined,
        entityType: entityType || undefined,
        entityId: entityId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: 50,
      });
      setData(response);
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

  if (loading) return <LoadingBlock text="Loading audit logs..." />;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800">Audit Trail (Append-only)</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-6">
          <input
            placeholder="Actor user ID"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            placeholder="Action type"
            value={actionType}
            onChange={(event) => setActionType(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            placeholder="Entity type"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
          <input
            placeholder="Entity ID"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-xs"
          />
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
        <button
          onClick={() => {
            setPage(1);
            void load();
          }}
          className="mt-2 rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
        >
          Apply Filters
        </button>
      </section>

      {error ? <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {!data?.items.length ? (
          <EmptyState message="No audit entries found." />
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="px-2 py-2">Timestamp</th>
                  <th className="px-2 py-2">Actor</th>
                  <th className="px-2 py-2">Action</th>
                  <th className="px-2 py-2">Entity</th>
                  <th className="px-2 py-2">Description</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((entry) => (
                  <tr key={String(entry.id)} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-xs text-slate-600">{formatDateTime(entry.createdAt)}</td>
                    <td className="px-2 py-2 text-xs text-slate-700">{entry.actor?.fullName ?? `User #${entry.actorUserId ?? "-"}`}</td>
                    <td className="px-2 py-2 text-xs text-slate-700">{entry.actionType}</td>
                    <td className="px-2 py-2 text-xs text-slate-600">
                      {entry.entityType} {entry.entityId ? `#${entry.entityId}` : ""}
                    </td>
                    <td className="px-2 py-2 text-xs text-slate-700">{entry.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {data ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))} | {data.total} total records
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                disabled={data.page <= 1}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((prev) => prev + 1)}
                disabled={data.page * data.pageSize >= data.total}
                className="rounded border border-slate-300 px-2 py-1 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
