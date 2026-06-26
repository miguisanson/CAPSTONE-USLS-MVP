import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ListTodo, AlertTriangle, Search } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { formatDate, relativeDays } from "../lib/format";
import { useAuth } from "../auth";

const OWNERS = ["Graduate School Staff", "GS Staff", "Academic Coordinator", "Research Coordinator", "Dean", "Registrar", "Student", "Panel Chair", "Adviser"];
const ACCOUNT_OWNER = {
  staff: "Graduate School Staff",
  academic_coordinator: "Academic Coordinator",
  research_coordinator: "Research Coordinator",
  registrar: "Registrar",
};

export default function WorkQueue() {
  const { user } = useAuth();
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
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Work Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pending and overdue tasks across the lifecycle — each one shows who owns the next action.
        </p>
      </div>

      <div className="relative max-w-xl"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-10" placeholder="Search task, student, or owner…" aria-label="Search work queue" /></div>

      <div className="flex flex-wrap gap-2">
        <FilterChip active={owner === ""} onClick={() => updateFilter({ owner: "" })}>
          All owners
        </FilterChip>
        {OWNERS.map((o) => (
          <FilterChip key={o} active={owner === o} onClick={() => updateFilter({ owner: o })}>
            {o}
          </FilterChip>
        ))}
        <FilterChip active={status === "Overdue"} onClick={() => updateFilter({ status: status === "Overdue" ? "" : "Overdue" })}>
          Overdue only
        </FilterChip>
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
                        <Link to={`/students/${task.student_id}`} className="font-semibold text-brand-700 hover:underline">
                          {task.student_name}
                        </Link>
                      ) : task.student_id ? (
                        <span className="font-semibold text-ink">{task.student_name}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-slate-500">
                      {formatDate(task.due_at)} <span className="text-slate-400">· {relativeDays(task.due_at)}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge value={task.overdue ? "Overdue" : task.status} dot={false} />
                    </td>
                    <td className="px-3 py-3">
                      {task.action_url ? (
                        <Link to={task.action_url} className="font-semibold text-brand-700 hover:underline">
                          {task.action_label || "Open"}
                        </Link>
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
