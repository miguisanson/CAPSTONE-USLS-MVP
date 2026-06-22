import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, FileCheck2, Send, Settings2, Users, Check } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

const STEPS = ["Draft", "Submitted", "Approved", "Published"];

export default function CourseAdjustments() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const selectedTermId = searchParams.get("term_id") || "";
  const [programId, setProgramId] = useState(selectedProgramId);
  const [termId, setTermId] = useState(selectedTermId);
  const [termLabel, setTermLabel] = useState("Current Term");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [sel, setSel] = useState({}); // course_id -> {offer, sections}

  function load(pid, tid) {
    setLoading(true);
    setError("");
    api
      .courseAdjustments({ program_id: pid || undefined, term_id: tid || undefined })
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
        setTermId(res.term ? String(res.term.id) : "");
        if (res.latest_plan?.term_label) setTermLabel(res.latest_plan.term_label);
        // seed editable selections from demand suggestions
        const next = {};
        res.demand.forEach((row) => {
          next[row.course.id] = { offer: row.demand_count > 0, sections: row.suggested_sections };
        });
        setSel(next);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId, selectedTermId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId, selectedTermId]);

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    setSearchParams(params, { replace: true });
  }

  const status = data?.latest_plan?.status || null;
  const stepIndex = status ? STEPS.indexOf(status) : -1;

  async function planAction(action) {
    if (!programId) return;
    setBusy(action);
    setError("");
    setMessage("");
    try {
      const payload = { program_id: programId, term_label: termLabel, action };
      if (action === "draft") {
        payload.selections = (data?.demand || []).map((row) => ({
          course_id: row.course.id,
          offer: !!sel[row.course.id]?.offer,
          section_count: Number(sel[row.course.id]?.sections) || row.suggested_sections,
        }));
      }
      const res = await api.saveCourseAdjustmentPlan(payload);
      setMessage(res.message);
      setData(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const offeredCount = useMemo(
    () => Object.values(sel).filter((s) => s.offer).length,
    [sel]
  );

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Course Adjustments</h1>
          <p className="mt-1 text-sm text-slate-500">
            Done before the term. The system shows subject demand and faculty availability as suggestions — the
            Academic Coordinator chooses what to offer, the Dean approves, then it's published.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programId}
            onChange={(e) => updateFilters({ program_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(data?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
          <select
            value={termId}
            onChange={(e) => updateFilters({ term_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Demand source term"
          >
            {(data?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
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

      <Card className="border-l-4 border-l-amber-500 bg-amber-50/50 p-4">
        <p className="font-semibold text-amber-900">Course Adjustments = decide what to offer next term</p>
        <p className="mt-1 text-sm text-amber-800">Use student demand, section counts, and faculty availability to create a term offering plan for approval. The curriculum is an input, not the decision made here.</p>
      </Card>

      {loading ? (
        <Spinner label="Loading course adjustments..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load course adjustments" hint={error} />
      ) : (
        <>
          {/* Stepper + current next-action */}
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {STEPS.map((step, i) => {
                const done = stepIndex > i;
                const current = stepIndex === i;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                        current ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
                      }`}
                    >
                      {done ? <Check className="h-3.5 w-3.5" /> : <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${current ? "bg-white/20" : "bg-white"}`}>{i + 1}</span>}
                      {step}
                    </span>
                    {i < STEPS.length - 1 && <span className="text-slate-300">→</span>}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 rounded-xl bg-slate-50/70 p-4 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-sm text-slate-600">
                {status === null && "No plan yet. Choose the subjects to offer below, then save the draft."}
                {status === "Draft" && "Draft saved. Review the offer list, then submit it for the Dean's approval."}
                {status === "Returned" && "The Dean returned this for revision. Adjust the offer list and re-submit."}
                {status === "Submitted" && "Submitted — waiting for the Dean to approve it from their own account. You can't approve your own plan."}
                {status === "Approved" && "Approved by the Dean. Publish to finalise the offerings for the term."}
                {status === "Published" && "Published. These are the final offerings for the term."}
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton busy={busy === "draft"} onClick={() => planAction("draft")} icon={Settings2}
                  disabled={!(status === null || status === "Draft" || status === "Returned")}
                  primary={status === null || status === "Draft" || status === "Returned"}>
                  {status === "Draft" || status === "Returned" ? "Update draft" : "Save draft"} ({offeredCount} offered)
                </ActionButton>
                <ActionButton busy={busy === "submit"} onClick={() => planAction("submit")} icon={Send}
                  disabled={!(status === "Draft" || status === "Returned")} primary={status === "Draft" || status === "Returned"}>
                  Submit for approval
                </ActionButton>
                <ActionButton busy={busy === "publish"} onClick={() => planAction("publish")} icon={CheckCircle2}
                  disabled={status !== "Approved"} primary={status === "Approved"}>
                  Publish
                </ActionButton>
              </div>
            </div>
            {message && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
            {data.latest_plan && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{data.latest_plan.program_code} · {data.latest_plan.term_label} · {data.latest_plan.offerings.length} offering row(s)</span>
                <StatusBadge value={data.latest_plan.status} dot={false} />
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Metric icon={ClipboardList} label="Demand subjects" value={data.summary.demand_subjects} tone="brand" />
            <Metric icon={Users} label="Total demand (enrolled)" value={data.summary.total_demand} tone="blue" />
            <Metric icon={AlertTriangle} label="High priority" value={data.summary.high_priority} tone="amber" />
            <Metric icon={Settings2} label="Selected to offer" value={offeredCount} tone="brand" />
          </div>

          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-3">
              <h2 className="text-lg font-semibold text-ink">Choose subjects to offer</h2>
              <p className="text-sm text-slate-500">
                Demand comes from each enrolled student's <span className="font-semibold">next recommended subjects</span> in {data.term?.label || "the selected term"}. Tick what
                to offer and set sections — these feed the draft. (Suggestions assist; the choice is yours.)
              </p>
            </div>
            {data.demand.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No next-subject demand found" hint="Enrolled students in this term have no next recommended subjects." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Offer?</th>
                      <th className="px-3 py-3">Subject</th>
                      <th className="px-3 py-3">Demand</th>
                      <th className="px-3 py-3">Sections</th>
                      <th className="px-3 py-3">Faculty avail.</th>
                      <th className="px-3 py-3">Suggestion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.demand.map((row) => {
                      const s = sel[row.course.id] || { offer: false, sections: row.suggested_sections };
                      return (
                        <tr key={row.course.id} className="border-b border-slate-50">
                          <td className="px-5 py-3">
                            <input
                              type="checkbox"
                              checked={!!s.offer}
                              onChange={() => setSel((p) => ({ ...p, [row.course.id]: { ...s, offer: !s.offer } }))}
                              className="h-5 w-5 accent-brand-600 cursor-pointer"
                              aria-label={`Offer ${row.course.code}`}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-ink">{row.course.code}</p>
                            <p className="text-xs text-slate-500">{row.course.title}</p>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-700">{row.demand_count}</td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              value={s.sections}
                              onChange={(e) => setSel((p) => ({ ...p, [row.course.id]: { ...s, sections: e.target.value } }))}
                              className="field-input w-16 px-2 py-1"
                              aria-label={`Sections for ${row.course.code}`}
                            />
                          </td>
                          <td className="px-3 py-3 text-slate-600">{row.availability_count}</td>
                          <td className="px-3 py-3">
                            <StatusBadge value={row.priority} dot={false} />
                            <p className="mt-1 text-xs text-slate-500">{row.recommendation}</p>
                          </td>
                        </tr>
                      );
                    })}
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

function ActionButton({ busy, onClick, icon: Icon, children, primary = false, disabled = false }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled} className={primary ? "btn-primary" : "btn-ghost"}>
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
