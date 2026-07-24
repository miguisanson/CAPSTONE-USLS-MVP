import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, ErrorNote, Spinner } from "../components/ui";
import { useConfirm } from "../components/confirm";
import { useState } from "react";

export default function TermSettings() {
  const confirm = useConfirm();
  const { data, loading, error, refetch } = useApi(() => api.adminTerms(), []);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");
  const [adding, setAdding] = useState(false);

  async function addNext() {
    setAdding(true); setNotice("");
    try {
      const res = await api.addNextTerm();
      setNotice(`Added ${res.term.label}.`);
      await refetch();
    } catch (err) { setNotice(err.message); } finally { setAdding(false); }
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
        <button type="button" onClick={addNext} disabled={adding} className="btn-primary shrink-0 cursor-pointer">
          {adding ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Plus className="h-4 w-4" />}
          Add next semester
        </button>
      </div>
    </Card>
    <ErrorNote message={error} />{notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}
    {loading ? <Spinner label="Loading academic semesters..." /> : <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Semester</th><th>Semester dates</th><th className="px-5 text-right">Actions</th></tr></thead><tbody>{(data?.items || []).map((term) => <tr key={term.id} className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-ink">{term.label}{term.is_active_planning_term && <span className="ml-2 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">Current</span>}</td><td className="text-slate-500">{term.start_date} — {term.end_date}</td><td className="px-5"><div className="flex justify-end gap-2"><button type="button" onClick={() => remove(term)} disabled={term.is_active_planning_term || saving === `delete-${term.id}`} className="btn-ghost cursor-pointer px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /> Remove</button></div></td></tr>)}</tbody></table></div></Card>}
  </div>;
}
