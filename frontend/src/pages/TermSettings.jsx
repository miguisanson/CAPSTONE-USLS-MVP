import { useState } from "react";
import { CalendarClock, Save } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, ErrorNote, Spinner } from "../components/ui";

export default function TermSettings() {
  const { data, loading, error } = useApi(() => api.adminTerms(), []);
  const [deadlines, setDeadlines] = useState({});
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState("");
  async function save(term) {
    setSaving(String(term.id)); setNotice("");
    try {
      await api.updateTerm(term.id, { grade_submission_deadline: deadlines[term.id] ?? term.grade_submission_deadline ?? "" });
      setNotice(`Grade deadline saved for ${term.label}.`);
    } catch (err) { setNotice(err.message); } finally { setSaving(""); }
  }
  return <div className="space-y-5 animate-fade-up">
    <Card className="p-6"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><CalendarClock className="h-6 w-6" /></span><div><h1 className="font-display text-2xl font-semibold text-ink">Academic terms</h1><p className="mt-1 text-sm text-slate-600">Set the grade submission deadline for each semester. Faculty reminders and five-day coordinator escalations use this date.</p></div></div></Card>
    <ErrorNote message={error} />{notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}
    {loading ? <Spinner label="Loading academic terms..." /> : <Card className="overflow-hidden p-0"><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Semester</th><th>Term dates</th><th>Grade deadline</th><th className="px-5 text-right">Action</th></tr></thead><tbody>{(data?.items || []).map((term) => <tr key={term.id} className="border-b border-slate-100"><td className="px-5 py-3 font-semibold text-ink">{term.label}{term.is_active_planning_term && <span className="ml-2 rounded-full bg-brand-50 px-2 py-1 text-xs text-brand-700">Current</span>}</td><td className="text-slate-500">{term.start_date} — {term.end_date}</td><td><input type="date" className="field-input max-w-48" value={deadlines[term.id] ?? term.grade_submission_deadline ?? ""} onChange={(e) => setDeadlines((current) => ({ ...current, [term.id]: e.target.value }))} /></td><td className="px-5 text-right"><button type="button" onClick={() => save(term)} disabled={saving === String(term.id)} className="btn-ghost cursor-pointer"><Save className="h-4 w-4" /> Save</button></td></tr>)}</tbody></table></div></Card>}
  </div>;
}
