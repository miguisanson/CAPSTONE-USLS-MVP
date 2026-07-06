import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Circle,
  ClipboardList,
  Send,
  Settings2,
  Users,
} from "lucide-react";
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
  const [sel, setSel] = useState({});
  const [autosave, setAutosave] = useState("idle");
  const dirtyRef = useRef(false);

  function load(pid, tid) {
    setLoading(true);
    setError("");
    api
      .courseAdjustments({ program_id: pid || undefined, term_id: tid || undefined })
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
        setTermId(res.term ? String(res.term.id) : "");
        setTermLabel(res.latest_plan?.term_label || res.term?.label || "Current Term");
        setSel(seedSelections(res.demand));
        dirtyRef.current = false;
        setAutosave("idle");
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
  const canEdit = (status === null || status === "Draft" || status === "Returned") && data?.planning_window_open !== false;

  async function saveDraft(showMessage = true) {
    if (!programId) return;
    setBusy("draft");
    setError("");
    if (showMessage) setMessage("");
    try {
      const payload = {
        program_id: programId,
        term_label: termLabel,
        action: "draft",
        selections: (data?.demand || []).map((row) => ({
          course_id: row.course.id,
          offer: !!sel[row.course.id]?.offer,
          section_count: Number(sel[row.course.id]?.sections) || row.suggested_sections,
          notes: sel[row.course.id]?.notes || "",
        })),
      };
      const res = await api.saveCourseAdjustmentPlan(payload);
      setData(res.data);
      setSel(seedSelections(res.data.demand));
      dirtyRef.current = false;
      setAutosave("saved");
      if (showMessage) setMessage(res.message);
    } catch (err) {
      setError(err.message);
      setAutosave("idle");
    } finally {
      setBusy("");
    }
  }

  async function planAction(action) {
    if (!programId) return;
    if (action === "draft") {
      await saveDraft(true);
      return;
    }
    setBusy(action);
    setError("");
    setMessage("");
    try {
      if (action === "submit" && dirtyRef.current && canEdit) {
        await saveDraft(false);
      }
      const res = await api.saveCourseAdjustmentPlan({ program_id: programId, term_label: termLabel, action });
      setMessage(res.message);
      setData(res.data);
      setSel(seedSelections(res.data.demand));
      dirtyRef.current = false;
      setAutosave("idle");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  function markDirty() {
    dirtyRef.current = true;
    setAutosave("pending");
  }

  useEffect(() => {
    if (autosave !== "pending" || !canEdit) return undefined;
    const timer = window.setTimeout(async () => {
      setAutosave("saving");
      await saveDraft(false);
    }, 1500);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autosave, sel, canEdit]);

  function toggleOffer(row) {
    if (!canEdit) return;
    setSel((current) => {
      const existing = current[row.course.id] || defaultSelection(row);
      const offer = !existing.offer;
      return {
        ...current,
        [row.course.id]: { ...existing, offer, status: offer ? "Offered" : "Not Offered" },
      };
    });
    markDirty();
  }

  function updateSections(row, value) {
    if (!canEdit) return;
    setSel((current) => ({
      ...current,
      [row.course.id]: { ...(current[row.course.id] || defaultSelection(row)), sections: value },
    }));
    markDirty();
  }

  const offeredCount = useMemo(() => Object.values(sel).filter((s) => s.offer).length, [sel]);

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <ClipboardList className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">Course demand</h1>
            <p className="mt-1 text-sm text-slate-600">
              Review live subject demand, adjust sections, and choose which subjects to offer next semester.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>
                Academic Coordinator / GS Staff
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>
                Live demand, sections, faculty availability, offering status, Dean approval state.
              </p>
            </div>
          </div>
        </div>
      </Card>

      {loading ? (
        <Spinner label="Loading course adjustments..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load course adjustments" hint={error} />
      ) : (
        <>
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Program">
                <select value={programId} onChange={(e) => updateFilters({ program_id: e.target.value })} className="field-input cursor-pointer" aria-label="Program">
                  {(data?.programs || []).map((p) => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
                </select>
              </Field>
              <Field label="Academic year and term">
                <select value={termId} onChange={(e) => updateFilters({ term_id: e.target.value })} className="field-input cursor-pointer" aria-label="Academic year and term">
                  {(data?.terms || []).map((term) => <option key={term.id} value={term.id}>{formatTermLabel(term.label)}</option>)}
                </select>
              </Field>
            </div>
          </Card>

          <Card className="p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {STEPS.map((step, i) => {
                const done = stepIndex > i;
                const current = stepIndex === i;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${current ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"}`}>
                      {done ? <Check className="h-3.5 w-3.5" /> : <span className={`grid h-4 w-4 place-items-center rounded-full text-[10px] ${current ? "bg-white/20" : "bg-white"}`}>{i + 1}</span>}
                      {step}
                    </span>
                    {i < STEPS.length - 1 && <span className="text-slate-300">-</span>}
                  </div>
                );
              })}
            </div>
            <p className="mb-4 text-sm text-slate-600">{planStatusNote(data.latest_plan)}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50/70 p-4">
              <p className="text-sm text-slate-600">
                Demand numbers are live. Draft saves only offer decisions and sections.
              </p>
              <div className="flex flex-wrap gap-2">
                <ActionButton busy={busy === "draft"} onClick={() => planAction("draft")} icon={Settings2} disabled={!canEdit} primary={canEdit}>
                  {status === "Draft" || status === "Returned" ? "Update draft" : "Save draft"} ({offeredCount} offered)
                </ActionButton>
                <ActionButton busy={busy === "submit"} onClick={() => planAction("submit")} icon={Send} disabled={!canEdit} primary={canEdit}>
                  Submit for approval
                </ActionButton>
                <ActionButton busy={busy === "publish"} onClick={() => planAction("publish")} icon={CheckCircle2} disabled={status !== "Approved"} primary={status === "Approved"}>
                  Publish
                </ActionButton>
              </div>
            </div>
            {message && <p className="mt-3 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
            {autosave !== "idle" && <p className="mt-3 text-xs font-semibold text-slate-500">{autosave === "pending" ? "Draft changes pending..." : autosave === "saving" ? "Saving..." : "Saved"}</p>}
            {data.latest_plan && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{data.latest_plan.program_code} - {data.latest_plan.term_label} - {data.latest_plan.offerings.length} offering row(s)</span>
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
              <h2 className="text-lg font-semibold text-ink">Subject demand</h2>
              <p className="text-sm text-slate-500">
                Demand comes from each enrolled student's next recommended subjects in {data.term?.label || "the selected term"}.
              </p>
            </div>
            {data.demand.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No next-subject demand found" hint="Enrolled students in this term have no next recommended subjects." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Subject</th>
                      <th className="px-3 py-3">Demand</th>
                      <th className="px-3 py-3">Status</th>
                      <th className="px-3 py-3">Sections</th>
                      <th className="px-3 py-3">Faculty availability</th>
                      <th className="px-5 py-3 text-right">Offer?</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.demand.map((row) => {
                      const s = sel[row.course.id] || defaultSelection(row);
                      return (
                        <tr key={row.course.id} className="border-b border-slate-50">
                          <td className="px-5 py-3">
                            <p className="font-semibold text-ink">{row.course.code}</p>
                            <p className="text-xs text-slate-500">{row.course.title}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex min-w-40 items-center gap-3">
                              <span className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                                <span className={`block h-full rounded-full ${demandBarClass(row.demand_status)}`} style={{ width: `${demandWidth(row)}%` }} />
                              </span>
                              <span className="font-bold text-slate-700">{row.demand_count}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3"><OfferingStatusBadge status={s.status} /></td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              value={s.sections}
                              onChange={(e) => updateSections(row, e.target.value)}
                              disabled={!canEdit}
                              className="field-input w-20 px-2 py-1 disabled:cursor-not-allowed disabled:bg-slate-100"
                              aria-label={`Sections for ${row.course.code}`}
                            />
                          </td>
                          <td className="px-3 py-3 text-slate-600">{row.availability_count}</td>
                          <td className="px-5 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => toggleOffer(row)}
                              disabled={!canEdit}
                              className={`inline-grid h-9 w-9 place-items-center rounded-full border transition-colors ${s.offer ? "border-brand-200 bg-brand-50 text-brand-600" : "border-slate-200 bg-white text-slate-400"} disabled:cursor-not-allowed disabled:opacity-40`}
                              aria-label={`${s.offer ? "Hold" : "Offer"} ${row.course.code}`}
                            >
                              {s.offer ? <Check className="h-5 w-5" strokeWidth={3} /> : <Circle className="h-5 w-5" />}
                            </button>
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

function seedSelections(rows = []) {
  const next = {};
  rows.forEach((row) => {
    next[row.course.id] = defaultSelection(row);
  });
  return next;
}

function defaultSelection(row) {
  const status = row.offering_status || (row.demand_count > 0 ? "Suggested" : null);
  return {
    offer: status === "Offered" || status === "Suggested",
    sections: row.section_count ?? row.suggested_sections,
    status,
    notes: row.offering_notes || "",
  };
}

function planStatusNote(plan) {
  if (!plan || plan.status === "Draft") return "Draft saved. Review the demand list and submit when ready.";
  if (plan.status === "Submitted") return `Submitted to Dean on ${formatDate(plan.submitted_at)}. Awaiting decision.`;
  if (plan.status === "Returned") return `Returned by Dean on ${formatDate(plan.updated_at)}. Revise and resubmit.`;
  if (plan.status === "Approved") return `Approved by ${plan.approved_by || "Dean"} on ${formatDate(plan.approved_at)}.`;
  if (plan.status === "Published") return `Published on ${formatDate(plan.published_at)}.`;
  return "Review the demand list and submit when ready.";
}

function formatDate(value) {
  if (!value) return "not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function formatTermLabel(label) {
  if (!label) return "Academic year and term";
  const ay = label.match(/AY\s*\d{4}\s*-\s*\d{4}/i)?.[0]?.replace(/\s+/g, " ");
  const term = label.match(/Term\s*\d+/i)?.[0]?.replace(/\s+/g, " ");
  if (ay && term) return `${ay.toUpperCase()} ${term.replace(/^term/i, "Term")}`;
  return label;
}

function demandBarClass(status) {
  if (status === "high") return "bg-brand-500";
  if (status === "meets_minimum") return "bg-amber-500";
  if (status === "below_minimum") return "bg-slate-400";
  return "bg-red-200";
}

function demandWidth(row) {
  if (!row.demand_count) return 4;
  return Math.max(8, Math.min(100, (row.demand_count / 15) * 100));
}

function OfferingStatusBadge({ status }) {
  const label = status || "No decision";
  const styles = {
    Offered: "bg-brand-50 text-brand-700 ring-brand-200",
    "Not Offered": "bg-slate-100 text-slate-700 ring-slate-200",
    Suggested: "bg-amber-50 text-amber-700 ring-amber-200",
    "No decision": "bg-slate-100 text-slate-500 ring-slate-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${styles[label] || styles["No decision"]}`}>{label}</span>;
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

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
    </label>
  );
}
