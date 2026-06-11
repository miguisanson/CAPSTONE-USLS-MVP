import { Link } from "react-router-dom";
import { Activity, AlertTriangle } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, StatusBadge, EmptyState } from "../components/ui";
import { formatDate } from "../lib/format";

const SLUG_LABEL = {
  "student-handoff": "Student Handoff",
  "leave-of-absence": "Leave of Absence",
  readmission: "Readmission",
  "course-audit": "Course Audit",
  "research-gate": "Research Gate",
  "panel-matching": "Panel Matching",
  "defense-scheduling": "Defense Scheduling",
};

function workflowLabel(slug) {
  if (slug === ["loa", "decision"].join("-")) return "Standing Decision";
  return SLUG_LABEL[slug] || slug;
}

export default function ActivityLog() {
  const { data, loading, error } = useApi(() => api.activity(), []);

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Activity Log</h1>
        <p className="mt-1 text-sm text-slate-500">
          An append-style trail of recorded transactions — the audit basis for accountability and monitoring.
        </p>
      </div>

      <Card className="p-6">
        {loading ? (
          <Spinner label="Loading activity…" />
        ) : error ? (
          <EmptyState icon={AlertTriangle} title="Could not load activity" hint={error} />
        ) : data.items.length === 0 ? (
          <EmptyState icon={Activity} title="No recorded activity yet" hint="Complete a workflow to populate this feed." />
        ) : (
          <ol className="relative space-y-5 border-l-2 border-slate-100 pl-6">
            {data.items.map((log) => (
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
                  {" · next owner: "}
                  {log.next_owner || "—"}
                </p>
                {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
