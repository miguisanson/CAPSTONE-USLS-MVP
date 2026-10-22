import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, SlidersHorizontal } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, PageHeader, SearchInput, Select, Spinner } from "../components/ui/index.js";
import { PAGE } from "../lib/labels.js";
import { formatDate } from "../lib/format";

const SLUG_LABEL = {
  "student-handoff": PAGE.studentHandoff,
  enrollment: PAGE.enrollment,
  "curriculum-planning": "Curriculum Planning",
  "course-adjustments": PAGE.courseAdjustments,
  "loa-decision": "LOA / Readmission",
  "leave-of-absence": PAGE.leaveOfAbsence,
  readmission: PAGE.readmission,
  "course-audit": "Course Audit",
  "research-gate": PAGE.researchGate,
  "panel-matching": PAGE.panelMatching,
  "defense-scheduling": PAGE.defenseScheduling,
  practicum: PAGE.practicum,
  withdrawal: PAGE.subjectWithdrawal,
  graduation: PAGE.graduationEndorsement,
  "aims-discrepancy": "AIMS discrepancy",
  "academic-semesters": PAGE.academicSemesters,
};

function workflowLabel(slug) {
  if (slug === "loa-decision") return "Standing Decision";
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

  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (key) => (value) => setFilters((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.activityLog}
        description="An append-style trail of recorded transactions — the audit basis for accountability and monitoring."
      />

      <Card pad="sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchInput
            value={filters.query}
            onChange={setFilter("query")}
            placeholder="Search activity or student…"
            label="Search activity"
          />
          <Select
            aria-label="Filter activity by workflow"
            placeholder="All workflows"
            value={filters.workflow}
            onChange={(event) => setFilter("workflow")(event.target.value)}
            options={workflows.map((workflow) => ({ value: workflow, label: workflowLabel(workflow) }))}
          />
          <Select
            aria-label="Filter activity by next owner"
            placeholder="All next owners"
            value={filters.owner}
            onChange={(event) => setFilter("owner")(event.target.value)}
            options={owners}
          />
        </div>
        <div className="meta mt-2 flex flex-wrap items-center justify-between gap-2">
          <span>Showing {filtered.length} of {items.length} activities</span>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setFilters({ query: "", workflow: "", owner: "" })}
              className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800 max-sm:min-h-11"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Clear filters
            </button>
          )}
        </div>
      </Card>

      <Card pad="lg">
        {loading ? (
          <Spinner label="Loading activity…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load activity" hint={error} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Activity} title="No activity matches the selected filters" hint="Clear a filter or use a broader search." />
        ) : (
          <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
            {filtered.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[31px] top-1 grid h-4 w-4 place-items-center rounded-full border-2 border-white bg-brand-500" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-slate-600">
                    {workflowLabel(log.transaction_slug)}
                  </span>
                  <span className="meta">{formatDate(log.created_at, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">{log.result}</p>
                <p className="meta">
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
                {log.notes && <p className="meta mt-1 leading-relaxed">{log.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
