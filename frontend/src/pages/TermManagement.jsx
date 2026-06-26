import { useEffect, useState } from "react";
import { CalendarCheck, CheckCircle2, Pencil, Plus, X } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "../components/ui";

const EMPTY_FORM = {
  label: "",
  start_date: "",
  end_date: "",
  planning_window_open: "",
  planning_window_close: "",
  status: "upcoming",
};

export default function TermManagement() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    loadTerms();
  }, []);

  async function loadTerms() {
    setLoading(true);
    setError("");
    try {
      const res = await api.terms();
      setTerms(res.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function openEdit(term) {
    setEditing(term);
    setForm({
      label: term.label || "",
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      planning_window_open: term.planning_window_open || "",
      planning_window_close: term.planning_window_close || "",
      status: term.status || "upcoming",
    });
    setFormOpen(true);
    setMessage("");
    setError("");
  }

  function setField(field) {
    return (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
  }

  async function saveTerm(event) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setMessage("");
    try {
      if (editing) {
        await api.updateTerm(editing.id, form);
        setMessage("Term updated.");
      } else {
        await api.createTerm(form);
        setMessage("Term added.");
      }
      setFormOpen(false);
      await loadTerms();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setActive(term) {
    if (term.is_active_planning_term) return;
    if (!window.confirm(`Set ${term.label} as the active planning term?`)) return;
    setBusy(`active-${term.id}`);
    setError("");
    setMessage("");
    try {
      await api.setActiveTerm(term.id);
      setMessage(`${term.label} is now the active planning term.`);
      await loadTerms();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
              <CalendarCheck className="h-6 w-6" />
            </span>
            <div>
              <h1 className="font-display text-2xl font-semibold text-ink">Term management</h1>
              <p className="mt-1 text-sm text-slate-600">
                Maintain academic terms and choose the active planning term used by demand and planning pages.
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
                <p><span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>GS Staff</p>
                <p><span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>Term dates, planning window, active planning term.</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={openAdd} className="btn-primary shrink-0">
            <Plus className="h-4 w-4" /> Add term
          </button>
        </div>
      </Card>

      <ErrorNote message={error} />
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}

      {formOpen && (
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-ink">{editing ? "Edit term" : "Add term"}</h2>
            <button type="button" onClick={() => setFormOpen(false)} className="btn-ghost px-3 py-2">
              <X className="h-4 w-4" /> Cancel
            </button>
          </div>
          <form onSubmit={saveTerm} className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <Field label="Term label">
              <input value={form.label} onChange={setField("label")} className="field-input" placeholder="AY 2026-2027 Term 1" required />
            </Field>
            <Field label="Start date">
              <input type="date" value={form.start_date} onChange={setField("start_date")} className="field-input" required />
            </Field>
            <Field label="End date">
              <input type="date" value={form.end_date} onChange={setField("end_date")} className="field-input" required />
            </Field>
            <Field label="Planning opens">
              <input type="date" value={form.planning_window_open} onChange={setField("planning_window_open")} className="field-input" />
            </Field>
            <Field label="Planning closes">
              <input type="date" value={form.planning_window_close} onChange={setField("planning_window_close")} className="field-input" />
            </Field>
            <Field label="Stored status">
              <select value={form.status} onChange={setField("status")} className="field-input cursor-pointer">
                <option value="upcoming">Upcoming</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <div className="flex items-end lg:col-span-3">
              <button type="submit" disabled={busy === "save"} className="btn-primary">
                {busy === "save" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CheckCircle2 className="h-4 w-4" />}
                Save term
              </button>
            </div>
          </form>
        </Card>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-6"><Spinner label="Loading terms..." /></div>
        ) : terms.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Term</th>
                  <th className="px-3 py-3">Dates</th>
                  <th className="px-3 py-3">Planning window</th>
                  <th className="px-3 py-3">Window status</th>
                  <th className="px-3 py-3">Stored status</th>
                  <th className="px-3 py-3">Active</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id} className="border-b border-slate-50">
                    <td className="px-5 py-3 font-semibold text-ink">{term.label}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(term.start_date)} - {formatDate(term.end_date)}</td>
                    <td className="px-3 py-3 text-slate-600">{formatDate(term.planning_window_open)} - {formatDate(term.planning_window_close)}</td>
                    <td className="px-3 py-3"><StatusBadge value={planningStatus(term)} dot /></td>
                    <td className="px-3 py-3"><StatusBadge value={term.status || "Not set"} dot={false} /></td>
                    <td className="px-3 py-3">
                      {term.is_active_planning_term ? <StatusBadge value="Active planning" /> : <span className="text-xs text-slate-400">No</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openEdit(term)} className="btn-ghost px-3 py-2">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button type="button" onClick={() => setActive(term)} disabled={term.is_active_planning_term || busy === `active-${term.id}`} className="btn-primary">
                          {busy === `active-${term.id}` ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <CheckCircle2 className="h-4 w-4" />}
                          Set active
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={CalendarCheck} title="No academic terms yet" hint="Add the first term to use centralized planning defaults." />
        )}
      </Card>
    </div>
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

function formatDate(value) {
  return value || "Not set";
}

function planningStatus(term) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = term.planning_window_open ? new Date(`${term.planning_window_open}T00:00:00`) : null;
  const close = term.planning_window_close ? new Date(`${term.planning_window_close}T00:00:00`) : null;
  if (open && open > today) return "Upcoming";
  if (open && close && open <= today && close >= today) return "Open";
  if (close && close < today) return "Closed";
  return "Not set";
}
