import { CalendarClock, Check, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, ErrorNote, Spinner } from "../components/ui";
import { useConfirm } from "../components/confirm";
import { useState } from "react";

const EMPTY_FORM = { label: "", start_date: "", end_date: "", planning_window_open: "", planning_window_close: "" };
const DATE_FIELDS = ["start_date", "end_date", "planning_window_open", "planning_window_close"];

function DateFields({ form, onChange }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
    <label className="block"><span className="field-label">Start date</span><input type="date" className="field-input" value={form.start_date} onChange={(e) => onChange("start_date", e.target.value)} /></label>
    <label className="block"><span className="field-label">End date</span><input type="date" className="field-input" value={form.end_date} onChange={(e) => onChange("end_date", e.target.value)} /></label>
    <label className="block"><span className="field-label">Planning opens (optional)</span><input type="date" className="field-input" value={form.planning_window_open} onChange={(e) => onChange("planning_window_open", e.target.value)} /></label>
    <label className="block"><span className="field-label">Planning closes (optional)</span><input type="date" className="field-input" value={form.planning_window_close} onChange={(e) => onChange("planning_window_close", e.target.value)} /></label>
  </div>;
}

export default function TermSettings() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.adminTerms(), []);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  async function addNext() {
    setAdding(true); setNotice("");
    try {
      const res = await api.addNextTerm();
      setNotice(`Added ${res.term.label}.`);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setAdding(false); }
  }

  async function createSemester(event) {
    event.preventDefault();
    if (!form.label.trim() || !form.start_date || !form.end_date) {
      setNotice("Enter the semester name, start date, and end date.");
      return;
    }
    setSaving("create"); setNotice("");
    try {
      const res = await api.createTerm({
        label: form.label.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        planning_window_open: form.planning_window_open || null,
        planning_window_close: form.planning_window_close || null,
      });
      setNotice(res.message || `Added ${form.label.trim()}.`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setSaving(""); }
  }

  function startEdit(term) {
    setEditingId(term.id);
    setEditForm({
      label: term.label,
      start_date: term.start_date || "",
      end_date: term.end_date || "",
      planning_window_open: term.planning_window_open || "",
      planning_window_close: term.planning_window_close || "",
    });
    setNotice("");
  }

  async function saveEdit(term) {
    const payload = {};
    DATE_FIELDS.forEach((field) => {
      const before = term[field] || "";
      if (editForm[field] !== before) payload[field] = editForm[field] || null;
    });
    if (!Object.keys(payload).length) {
      setEditingId(null);
      setNotice("No dates were changed.");
      return;
    }
    setSaving(`edit-${term.id}`); setNotice("");
    try {
      const res = await api.updateTerm(term.id, payload);
      setNotice(res.message || `Updated ${term.label}.`);
      setEditingId(null);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setSaving(""); }
  }

  async function setCurrent(term) {
    const ok = await confirm({
      title: "Set as the current semester?",
      message: `${term.label}\n\nEnrollment, course adjustments, and planning will use this semester from now on.`,
      confirmLabel: "Set as current",
    });
    if (!ok) return;
    setSaving(`active-${term.id}`); setNotice("");
    try {
      const res = await api.setActiveTerm(term.id);
      setNotice(res.message || `${term.label} is now the current semester.`);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setSaving(""); }
  }

  async function remove(term) {
    const ok = await confirm({
      title: "Remove this academic semester?",
      message:
        `${term.label}\n\nOnly an unused, non-current semester can be removed. ` +
        "If student, enrollment, residency, or course-adjustment records exist, the system will keep it as history.",
      confirmLabel: "Remove semester",
      tone: "danger",
    });
    if (!ok) return;
    setSaving(`delete-${term.id}`); setNotice("");
    try {
      const res = await api.deleteTerm(term.id, { confirmed_label: term.label });
      setNotice(res.message);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setSaving(""); }
  }

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const setEditField = (field, value) => setEditForm((current) => ({ ...current, [field]: value }));

  return <div className="space-y-5 animate-fade-up">
    <Card className="p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><CalendarClock className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Academic semesters</h1>
            <p className="mt-1 text-sm text-slate-600">Maintain the list of academic semesters and mark the current planning term. Enrollment, course adjustments, and reporting use these semesters.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setShowForm((open) => !open)} className="btn-ghost cursor-pointer">
            <Plus className="h-4 w-4" /> Add semester
          </button>
          <button type="button" onClick={addNext} disabled={adding} className="btn-primary cursor-pointer">
            {adding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Plus className="h-4 w-4" />}
            Add next semester
          </button>
        </div>
      </div>
      {showForm && <form onSubmit={createSemester} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
        <label className="block"><span className="field-label">Semester name</span><input type="text" className="field-input" placeholder="AY 2026-2027 1st Semester" value={form.label} onChange={(e) => setField("label", e.target.value)} /></label>
        <DateFields form={form} onChange={setField} />
        <p className="text-xs text-slate-500">Semester dates cannot overlap another semester. The planning window is the period when study plans can be prepared for this semester.</p>
        <div className="flex gap-2">
          <button type="submit" disabled={saving === "create"} className="btn-primary cursor-pointer">{saving === "create" ? "Saving..." : "Save semester"}</button>
          <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }} className="btn-ghost cursor-pointer">Cancel</button>
        </div>
      </form>}
    </Card>
    <ErrorNote message={error} />{notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}
    {loading ? <Spinner label="Loading academic semesters..." /> : <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Semester</th><th>Semester dates</th><th className="px-5 text-right">Actions</th></tr></thead><tbody>{(data?.items || []).map((term) => editingId === term.id
      ? <tr key={term.id} className="border-b border-slate-100 bg-slate-50/60"><td colSpan={3} className="px-5 py-4">
          <p className="mb-3 font-semibold text-ink">Edit dates: {term.label}</p>
          <DateFields form={editForm} onChange={setEditField} />
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => saveEdit(term)} disabled={saving === `edit-${term.id}`} className="btn-primary cursor-pointer px-3 py-2"><Check className="h-4 w-4" /> {saving === `edit-${term.id}` ? "Saving..." : "Save dates"}</button>
            <button type="button" onClick={() => setEditingId(null)} className="btn-ghost cursor-pointer px-3 py-2"><X className="h-4 w-4" /> Cancel</button>
          </div>
        </td></tr>
      : <tr key={term.id} className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-ink">{term.label}{term.is_active_planning_term && <span className="ml-2 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">Current</span>}</td><td className="text-slate-500">{term.start_date} — {term.end_date}{(term.planning_window_open || term.planning_window_close) && <span className="mt-0.5 block text-xs text-slate-400">Planning: {term.planning_window_open || "?"} — {term.planning_window_close || "?"}</span>}</td><td className="px-5"><div className="flex flex-wrap justify-end gap-2">
        {!term.is_active_planning_term && <button type="button" onClick={() => setCurrent(term)} disabled={saving === `active-${term.id}`} className="btn-ghost cursor-pointer px-3 py-2"><Star className="h-4 w-4" /> Set as current</button>}
        <button type="button" onClick={() => startEdit(term)} className="btn-ghost cursor-pointer px-3 py-2"><Pencil className="h-4 w-4" /> Edit dates</button>
        <button type="button" onClick={() => remove(term)} disabled={term.is_active_planning_term || saving === `delete-${term.id}`} className="btn-ghost cursor-pointer px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /> Remove</button></div></td></tr>)}</tbody></table></div></Card>}
  </div>;
}
