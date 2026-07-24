import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ListTodo, AlertTriangle, Search, Flag, CheckCircle2, ShieldCheck, RefreshCw } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { formatDate, relativeDays } from "../lib/format";
import { useAuth } from "../auth";

const OWNERS = ["Graduate School Staff", "GS Staff", "Academic Coordinator", "Research Coordinator", "Dean", "Student", "Panel Chair", "Adviser"];
const ACCOUNT_OWNER = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
};

export default function WorkQueue() {
  const { user } = useAuth();
  const [tab, setTab] = useState("tasks");
  const conflicts = useApi(() => api.monitoringConflicts({ status: "Open" }), []);
  const openConflicts = conflicts.data?.summary?.open_total ?? 0;

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Work Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Everything that needs attention in one place — pending tasks and open monitoring conflicts.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200">
        <TabButton active={tab === "tasks"} onClick={() => setTab("tasks")} icon={ListTodo}>Tasks</TabButton>
        <TabButton active={tab === "conflicts"} onClick={() => setTab("conflicts")} icon={Flag} badge={openConflicts}>Conflicts</TabButton>
      </div>

      {tab === "tasks" ? <TasksPanel user={user} /> : <ConflictsPanel state={conflicts} />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer ${
        active ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
      {badge > 0 && (
        <span className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-xs font-bold ${active ? "bg-brand-600 text-white" : "bg-amber-100 text-amber-700"}`}>{badge}</span>
      )}
    </button>
  );
}

function TasksPanel({ user }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [owner, setOwner] = useState(searchParams.get("owner") || (user?.role === "staff" ? "" : ACCOUNT_OWNER[user?.role] || ""));
  const [status, setStatus] = useState(searchParams.get("status") || "");
  const [query, setQuery] = useState("");
  const { data, loading, error } = useApi(() => api.tasks({ owner, status }), [owner, status]);
  const filtered = (data?.items || []).filter((task) => `${task.title} ${task.student_name || ""} ${task.owner_role}`.toLowerCase().includes(query.toLowerCase()));

  function updateFilter(next) {
    const merged = { owner, status, ...next };
    setOwner(merged.owner || "");
    setStatus(merged.status || "");
    const params = {};
    if (merged.owner) params.owner = merged.owner;
    if (merged.status) params.status = merged.status;
    setSearchParams(params, { replace: true });
  }

  return (
    <div className="space-y-5">
      <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-10" placeholder="Search task, student, or owner…" aria-label="Search work queue" /></div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={owner === ""} onClick={() => updateFilter({ owner: "" })}>All owners</FilterChip>
        {OWNERS.map((o) => (
          <FilterChip key={o} active={owner === o} onClick={() => updateFilter({ owner: o })}>{o}</FilterChip>
        ))}
        <FilterChip active={status === "Overdue"} onClick={() => updateFilter({ status: status === "Overdue" ? "" : "Overdue" })}>Overdue only</FilterChip>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <Spinner label="Loading tasks…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load tasks" hint={error} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={ListTodo} title="No tasks match the selected filters" hint="Clear a filter or broaden the search." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Task</th>
                  <th className="px-3 py-3">Owner</th>
                  <th className="px-3 py-3">Student</th>
                  <th className="px-3 py-3">Due</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.id} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-5 py-3 font-semibold text-ink">{task.title}</td>
                    <td className="px-3 py-3 text-slate-600">{task.owner_role}</td>
                    <td className="px-3 py-3">
                      {task.student_id && user?.role === "staff" ? (
                        <Link to={`/students/${task.student_id}`} className="font-semibold text-brand-700 hover:underline">{task.student_name}</Link>
                      ) : task.student_id ? (
                        <span className="font-semibold text-ink">{task.student_name}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">{formatDate(task.due_at)} <span className="text-slate-400">· {relativeDays(task.due_at)}</span></td>
                    <td className="px-3 py-3"><StatusBadge value={task.overdue ? "Overdue" : task.status} dot={false} /></td>
                    <td className="px-3 py-3">
                      {task.action_url ? (
                        <Link to={task.action_url} className="font-semibold text-brand-700 hover:underline">{task.action_label || "Open"}</Link>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ConflictsPanel({ state }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = state;
  const [resolvingId, setResolvingId] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const canResolve = user?.role === "staff" || user?.role === "academic_coordinator";

  const items = data?.items || [];
  const summary = data?.summary || { open_total: 0, auto_resolvable: 0, needs_action: 0 };

  async function resolve(item) {
    setBusy(true);
    setActionError("");
    try {
      await api.resolveMonitoringFlag(item.student_id, item.id, { resolution_note: note });
      setResolvingId(null);
      setNote("");
      await refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading conflicts…" />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load conflicts" hint={error} />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Open conflicts" value={summary.open_total} tone="slate" />
        <StatCard label="Auto-resolve on re-import" value={summary.auto_resolvable} tone="green" />
        <StatCard label="Need coordinator action" value={summary.needs_action} tone="amber" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">Source-correctable conflicts clear automatically after a corrected monitoring sheet is re-imported. The rest need coordinator review.</p>
        <button type="button" onClick={refetch} className="btn-ghost cursor-pointer px-3 py-2"><RefreshCw className="h-4 w-4" /> Refresh</button>
      </div>

      {items.length === 0 ? (
        <Card className="overflow-hidden"><EmptyState icon={CheckCircle2} title="No open conflicts" hint="Every flagged discrepancy has been resolved." /></Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{item.category}</span>
                    {item.auto_resolvable ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700"><ShieldCheck className="h-3 w-3" /> Auto-resolves on re-import</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700"><Flag className="h-3 w-3" /> Needs coordinator action</span>
                    )}
                    {item.system_generated && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">System</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-700">
                    {user?.role === "staff" ? (
                      <Link to={`/students/${item.student_id}`} className="text-brand-700 hover:underline">{item.student_name}</Link>
                    ) : (
                      <span>{item.student_name}</span>
                    )}
                    <span className="text-slate-400"> · {item.student_number} · {item.program_code}</span>
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-slate-500">On: {item.target_label || "Whole record"}</p>
                  <p className="mt-1 text-sm text-slate-600">{item.note}</p>
                  <p className="mt-1 text-xs text-slate-400">{item.source} · {item.created_by} · {formatDate(item.created_at)}</p>
                </div>
                {canResolve && resolvingId !== item.id && (
                  <button type="button" onClick={() => { setResolvingId(item.id); setNote(""); setActionError(""); }} className="btn-ghost cursor-pointer px-3 py-2 shrink-0"><CheckCircle2 className="h-4 w-4" /> Resolve</button>
                )}
              </div>
              {resolvingId === item.id && (
                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <label className="field-label" htmlFor={`resolve-${item.id}`}>How was this resolved?</label>
                  <textarea id={`resolve-${item.id}`} className="field-input min-h-24 resize-y" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Describe the corrected source, advising outcome, or verified resolution." />
                  {actionError && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-700">{actionError}</div>}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !note.trim()} onClick={() => resolve(item)} className="btn-primary cursor-pointer"><CheckCircle2 className="h-4 w-4" /> {busy ? "Saving…" : "Resolve conflict"}</button>
                    <button type="button" onClick={() => { setResolvingId(null); setNote(""); }} className="btn-ghost cursor-pointer">Cancel</button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }) {
  const tones = {
    slate: "text-ink",
    green: "text-green-700",
    amber: "text-amber-700",
  };
  return (
    <Card className="p-4">
      <p className={`text-3xl font-bold ${tones[tone] || "text-ink"}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </Card>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
        active ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
