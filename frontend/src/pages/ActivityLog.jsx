import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Search, SlidersHorizontal } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/ui";
import HistoryDisclosure from "../components/HistoryDisclosure";
import { formatDate } from "../lib/format";

const SLUG_LABEL = {
  "student-handoff": "Student Handoff",
  enrollment: "Enrollment",
  "curriculum-planning": "Curriculum Planning",
  "course-adjustments": "Course Adjustments",
  "loa-decision": "LOA / Readmission",
  "leave-of-absence": "Leave of Absence",
  readmission: "Readmission",
  "course-audit": "Course Audit",
  "research-gate": "Research Gate",
  "panel-matching": "Panel Matching",
  "defense-scheduling": "Defense Scheduling",
  practicum: "Practicum",
  withdrawal: "Withdrawal Requests",
  graduation: "Graduation Endorsement",
};

function workflowLabel(slug) {
  if (slug === ["loa", "decision"].join("-")) return "Standing Decision";
  return SLUG_LABEL[slug] || slug;
}

export default function ActivityLog() {
  const { data, loading, error } = useApi(() => api.activity(), []);
  const [filters, setFilters] = useState({ query: "", workflow: "", owner: "" });
  const items = data?.items || [];
  const workflows = useMemo(() => [...new Set(items.map((item) => item.transaction_slug).filter(Boolean))].sort(), [items]);
  const owners = useMemo(() => [...new Set(items.map((item) => item.next_owner).filter(Boolean))].sort(), [items]);
  const filtered = useMemo(() => items.filter((log) => {
    const text = `${log.result || ""} ${log.student_name || ""} ${log.actor_role || ""} ${log.notes || ""}`.toLowerCase();
    return (!filters.query || text.includes(filters.query.toLowerCase()))
      && (!filters.workflow || log.transaction_slug === filters.workflow)
      && (!filters.owner || log.next_owner === filters.owner);
  }), [items, filters]);

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          An append-style trail of recorded transactions — the audit basis for accountability and monitoring.
        </p>
      </div>

      <Card className="p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="relative block"><span className="sr-only">Search activity</span><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} className="field-input pl-10" placeholder="Search activity or student…" aria-label="Search activity" /></label>
          <select value={filters.workflow} onChange={(event) => setFilters((current) => ({ ...current, workflow: event.target.value }))} className="field-input cursor-pointer" aria-label="Filter activity by workflow"><option value="">All workflows</option>{workflows.map((workflow) => <option key={workflow} value={workflow}>{workflowLabel(workflow)}</option>)}</select>
          <select value={filters.owner} onChange={(event) => setFilters((current) => ({ ...current, owner: event.target.value }))} className="field-input cursor-pointer" aria-label="Filter activity by next owner"><option value="">All next owners</option>{owners.map((owner) => <option key={owner}>{owner}</option>)}</select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>Showing {filtered.length} of {items.length} activities</span>{Object.values(filters).some(Boolean) && <button type="button" onClick={() => setFilters({ query: "", workflow: "", owner: "" })} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear filters</button>}</div>
      </Card>

      <Card className="p-6">
        {loading ? (
          <Spinner label="Loading activity…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load activity" hint={error} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Activity} title="No activity matches the selected filters" hint="Clear a filter or use a broader search." />
        ) : (
          <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={filtered.length}>
            <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
              {filtered.map((log) => (
                <li key={log.id} className="relative">
                  <span className="absolute -left-[31px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-brand-500" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {workflowLabel(log.transaction_slug)}
                    </span>
                    <span className="text-xs text-slate-400">{formatDate(log.created_at, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-ink">{log.result}</p>
                  <p className="text-xs text-slate-500">
                    {log.actor_role}
                    {log.student_id && (
                      <>
                        {" · "}
                        <Link to={`/students/${log.student_id}`} className="font-semibold text-brand-700 hover:underline">
                          {log.student_name}
                        </Link>
                      </>
                    )}
                    {!log.student_id && log.source_reference && <>{" · "}{log.source_reference}</>}
                    {" · next owner: "}
                    {log.next_owner || "—"}
                  </p>
                  {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
                </li>
              ))}
            </ol>
          </HistoryDisclosure>
        )}
      </Card>
    </div>
  );
}
