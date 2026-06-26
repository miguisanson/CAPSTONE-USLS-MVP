import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CheckCircle2, Pencil, Plus, Save, X } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, ErrorNote, SectionTitle, Spinner, StatusBadge } from "../components/ui";
import { Field, Input, Select } from "../components/forms";

const BLANK_FORM = {
  label: "",
  start_date: "",
  end_date: "",
  planning_window_open: "",
  planning_window_close: "",
  status: "",
};

const STATUS_OPTIONS = ["upcoming", "active", "closed", "archived"];

export default function TermManagement() {
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);

  async function load() {
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

  useEffect(() => {
    load();
  }, []);

  const activeTerm = useMemo(() => terms.find((term) => term.is_active_planning_term), [terms]);

  function startAdd() {
    setEditing({ mode: "add" });
    setForm(BLANK_FORM);
    setMessage("");
    setError("");
  }

  function startEdit(term) {
    setEditing({ mode: "edit", id: term.id });
    setForm({
      label: term.label || "",
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      planning_window_open: term.planning_window_open || "",
      planning_window_close: term.planning_window_close || "",
      status: term.status || "",
    });
    setMessage("");
    setError("");
  }

  function setField(key) {
    return (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  }

  async function saveTerm(event) {
    event.preventDefault();
    setBusy("save");
    setError("");
    setMessage("");
    try {
      const res = editing?.mode === "edit"
        ? await api.updateTerm(editing.id, form)
        : await api.createTerm(form);
      setMessage(res.message || "Term saved.");
      setEditing(null);
      setForm(BLANK_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  async function setActive(term) {
    if (term.is_active_planning_term) return;
    const confirmed = !activeTerm || window.confirm(`Set ${term.label} as the active planning term?`);
    if (!confirmed) return;
    setBusy(`active-${term.id}`);
    setError("");
    setMessage("");
    try {
      const res = await api.setActiveTerm(term.id);
      setMessage(res.message || "Active planning term updated.");
      await load();
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
          <h1 className="font-display text-2xl font-semibold text-ink">Term Management</h1>
          <p className="mt-1 text-sm text-slate-500">
            Configure academic terms and choose the active planning term used by course demand planning.
          </p>
        </div>
        <button type="button" onClick={startAdd} className="btn-primary">
          <Plus className="h-4 w-4" /> Add term
        </button>
      </div>

      <ErrorNote message={error} />
      {message && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</div>}

      {editing && (
        <Card className="p-5">
          <SectionTitle
            title={editing.mode === "edit" ? "Edit term" : "Add term"}
            subtitle="Dates use the browser date picker format."
            icon={CalendarRange}
            action={
              <button type="button" onClick={() => setEditing(null)} className="btn-ghost px-3 py-2">
                <X className="h-4 w-4" /> Close
              </button>
            }
          />
          <form onSubmit={saveTerm} className="grid grid-cols-1 gap-4 lg:grid-cols-6">
            <Field label="Label" required>
              <Input value={form.label} onChange={setField("label")} required placeholder="AY 2026-2027 Term 1" />
            </Field>
            <Field label="Start date" required>
              <Input type="date" value={form.start_date} onChange={setField("start_date")} required />
            </Field>
            <Field label="End date" required>
              <Input type="date" value={form.end_date} onChange={setField("end_date")} required />
            </Field>
            <Field label="Planning opens">
              <Input type="date" value={form.planning_window_open} onChange={setField("planning_window_open")} />
            </Field>
            <Field label="Planning closes">
              <Input type="date" value={form.planning_window_close} onChange={setField("planning_window_close")} />
            </Field>
            <Field label="Stored status">
              <Select value={form.status} onChange={setField("status")} options={STATUS_OPTIONS} placeholder="No stored status" />
            </Field>
            <div className="lg:col-span-6">
              <button type="submit" disabled={busy === "save"} className="btn-primary">
                {busy === "save" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save className="h-4 w-4" />}
                {busy === "save" ? "Saving..." : "Save term"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <Spinner label="Loading terms..." />
      ) : terms.length === 0 ? (
        <EmptyState icon={CalendarRange} title="No academic terms yet" hint="Add the first term to start planning." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Term</th>
                  <th className="px-3 py-3">School year</th>
                  <th className="px-3 py-3">Semester</th>
                  <th className="px-3 py-3">Start / End</th>
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
                    <td className="px-3 py-3 text-slate-600">{term.school_year || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{term.semester || "-"}</td>
                    <td className="px-3 py-3 text-slate-600">{term.start_date} / {term.end_date}</td>
                    <td className="px-3 py-3 text-slate-600">{term.planning_window_open || "-"} / {term.planning_window_close || "-"}</td>
                    <td className="px-3 py-3"><StatusBadge value={planningWindowStatus(term)} dot={false} /></td>
                    <td className="px-3 py-3"><StatusBadge value={displayStatus(term.status)} dot={false} /></td>
                    <td className="px-3 py-3">
                      {term.is_active_planning_term ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-700">
                          <CheckCircle2 className="h-4 w-4" /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Inactive</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => startEdit(term)} className="btn-ghost px-3 py-2">
                          <Pencil className="h-4 w-4" /> Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => setActive(term)}
                          disabled={term.is_active_planning_term || busy === `active-${term.id}`}
                          className="btn-primary px-3 py-2"
                        >
                          {busy === `active-${term.id}` ? "Setting..." : "Set active"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Switching is blocked if the current active planning term already has submitted or approved offering plans.
        </p>
      </div>
    </div>
  );
}

function planningWindowStatus(term) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = term.planning_window_open ? new Date(term.planning_window_open) : null;
  const close = term.planning_window_close ? new Date(term.planning_window_close) : null;
  if (open && open > today) return "Upcoming";
  if (open && close && open <= today && close >= today) return "Open";
  if (close && close < today) return "Closed";
  return "Not set";
}

function displayStatus(status) {
  if (!status) return "Not set";
  return status.charAt(0).toUpperCase() + status.slice(1);
}
