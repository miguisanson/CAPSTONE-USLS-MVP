import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, FileCheck2, Send, Settings2, Users } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

export default function CourseAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const [programId, setProgramId] = useState(selectedProgramId);
  const [termLabel, setTermLabel] = useState("Current Term");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  function load(pid) {
    setLoading(true);
    setError("");
    api
      .courseAdjustments(pid || undefined)
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
        if (res.latest_plan?.term_label) setTermLabel(res.latest_plan.term_label);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  async function planAction(action) {
    if (!programId) return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const res = await api.saveCourseAdjustmentPlan({ program_id: programId, term_label: termLabel, action });
      setMessage(res.message);
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Course Adjustments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review subject demand, course sections, faculty availability, and offering-plan approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programId}
            onChange={(e) => setSearchParams({ program_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(data?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
          <input
            value={termLabel}
            onChange={(e) => setTermLabel(e.target.value)}
            className="field-input w-48"
            aria-label="Offering term"
            placeholder="AY 2025-2026 Term 1"
          />
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading course adjustments..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load course adjustments" hint={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={ClipboardList} label="Demand subjects" value={data.summary.demand_subjects} tone="brand" />
            <Metric icon={Users} label="Total demand" value={data.summary.total_demand} tone="blue" />
            <Metric icon={AlertTriangle} label="High priority" value={data.summary.high_priority} tone="amber" />
            <Metric icon={Settings2} label="Suggested sections" value={data.summary.suggested_sections} tone="brand" />
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">Offering plan</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Generate the draft from demand, send to Dean review, approve, then publish final offerings.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ActionButton busy={busy === "draft"} onClick={() => planAction("draft")} icon={Settings2}>
                  Generate draft
                </ActionButton>
                <ActionButton busy={busy === "review"} onClick={() => planAction("review")} icon={Send}>
                  Send to Dean
                </ActionButton>
                <ActionButton busy={busy === "approve"} onClick={() => planAction("approve")} icon={FileCheck2}>
                  Approve
                </ActionButton>
                <ActionButton busy={busy === "publish"} onClick={() => planAction("publish")} icon={CheckCircle2} primary>
                  Publish
                </ActionButton>
              </div>
            </div>
            {message && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
            {data.latest_plan && (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-ink">{data.latest_plan.program_code} · {data.latest_plan.term_label}</p>
                    <p className="text-xs text-slate-500">{data.latest_plan.offerings.length} offering row(s) in this plan</p>
                  </div>
                  <StatusBadge value={data.latest_plan.status} dot={false} />
                </div>
              </div>
            )}
          </Card>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-lg font-semibold text-ink">Subject demand</h2>
              <p className="text-sm text-slate-500">Missing and incomplete subjects from active students drive the suggested offerings.</p>
            </div>
            {data.demand.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No subject demand found" hint="Course audits are currently clear for active students in this program." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-3 py-3">Demand</th>
                      <th className="px-3 py-3">Sections</th>
                      <th className="px-3 py-3">Faculty availability</th>
                      <th className="px-3 py-3">Recommendation</th>
                      <th className="px-3 py-3">Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.demand.map((row) => (
                      <tr key={row.course.id} className="border-b border-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{row.course.code}</p>
                          <p className="text-xs text-slate-500">{row.course.title}</p>
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-700">{row.demand_count}</td>
                        <td className="px-3 py-3 text-slate-600">{row.suggested_sections}</td>
                        <td className="px-3 py-3 text-slate-600">{row.availability_count}</td>
                        <td className="px-3 py-3">
                          <StatusBadge value={row.priority} dot={false} />
                          <p className="mt-1 text-xs text-slate-500">{row.recommendation}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            {row.student_sample.map((student) => (
                              <p key={student.id} className="text-xs text-slate-500">
                                {student.name} · {student.student_number}
                              </p>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function ActionButton({ busy, onClick, icon: Icon, children, primary = false }) {
  return (
    <button type="button" onClick={onClick} disabled={busy} className={primary ? "btn-primary" : "btn-ghost"}>
      {busy ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      {children}
    </button>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <Card className="flex items-center gap-3 p-4">
      <span className={`grid h-10 w-10 place-items-center rounded-xl ${tones[tone] || tones.brand}`}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </Card>
  );
}
