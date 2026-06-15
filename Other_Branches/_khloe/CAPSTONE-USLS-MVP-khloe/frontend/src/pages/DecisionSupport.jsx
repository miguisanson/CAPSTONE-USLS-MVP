import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Lightbulb, AlertTriangle, ArrowUpRight, ShieldAlert, Sparkles } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, Spinner, EmptyState } from "../components/ui";
import { SEVERITY } from "../lib/format";

const CODE_LABEL = {
  overdue: "Overdue task",
  schedule: "Scheduling",
  residency: "LOA / residency",
  risk: "Risk flag",
  evidence: "Missing evidence",
  coursework: "Coursework",
  stalled: "Stalled case",
};

export default function DecisionSupport() {
  const { data, loading, error } = useApi(() => api.decisionSupport(), []);
  const [severity, setSeverity] = useState("");
  const [owner, setOwner] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.items.filter((r) => (!severity || r.severity === severity) && (!owner || r.owner === owner));
  }, [data, severity, owner]);

  if (loading) return <Spinner label="Computing recommendations…" />;
  if (error) return <EmptyState icon={AlertTriangle} title="Could not load decision support" hint={error} />;

  const s = data.summary;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Decision Support</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rule-based recommendations computed from recorded transactions — what to do next, and who owns it. The system
          recommends; people decide.
        </p>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryTile icon={Lightbulb} label="Recommended actions" value={s.total} tone="brand" />
        <SummaryTile icon={ShieldAlert} label="Students flagged" value={s.students_flagged} tone="blue" />
        <SummaryTile icon={AlertTriangle} label="High priority" value={s.by_severity.high} tone="red" />
        <SummaryTile icon={Sparkles} label="Medium priority" value={s.by_severity.medium} tone="amber" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Priority</span>
        <Chip active={severity === ""} onClick={() => setSeverity("")}>All ({s.total})</Chip>
        {s.by_severity.map((b) => (
          <Chip key={b.severity} active={severity === b.severity} onClick={() => setSeverity(b.severity)}>
            {SEVERITY[b.severity]?.label || b.severity} ({b.count})
          </Chip>
        ))}
        <span className="ml-3 text-xs font-bold uppercase tracking-wider text-slate-400">Owner</span>
        <Chip active={owner === ""} onClick={() => setOwner("")}>All</Chip>
        {s.by_owner.map((o) => (
          <Chip key={o.owner} active={owner === o.owner} onClick={() => setOwner(o.owner)}>
            {o.owner} ({o.count})
          </Chip>
        ))}
      </div>

      <p className="text-xs text-slate-400">
        Sorted by priority score (0–100). Score weights the action's severity plus how overdue it is and how long the case
        has been inactive — so two “High” items can still be ranked against each other.
      </p>

      {/* Recommendation list */}
      {filtered.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Lightbulb} title="No matching recommendations" hint="Try clearing a filter." />
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r, i) => {
            const sev = SEVERITY[r.severity] || SEVERITY.low;
            return (
              <Card key={`${r.student_id}-${r.code}-${i}`} className="overflow-hidden">
                <div className="flex">
                  <span className={`w-1.5 shrink-0 ${sev.bar}`} aria-hidden />
                  <div className="flex flex-1 flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${sev.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                          {sev.label}
                        </span>
                        {typeof r.score === "number" && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white" title="Priority score (0–100)">
                            {r.score}
                          </span>
                        )}
                        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          {CODE_LABEL[r.code] || r.code}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-ink">{r.recommendation}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Why: {r.trigger}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Owner</p>
                        <p className="text-sm font-semibold text-brand-700">{r.owner}</p>
                      </div>
                      <Link
                        to={`/students/${r.student_id}`}
                        className="group flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 transition-colors hover:bg-brand-50 cursor-pointer"
                      >
                        <span>
                          <span className="block text-sm font-semibold text-ink">{r.student_name}</span>
                          <span className="block text-xs text-slate-400">{r.program_code} · {r.stage}</span>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600" />
                      </Link>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid h-11 w-11 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition-colors duration-200 cursor-pointer ${
        active ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}
