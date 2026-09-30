import { useEffect, useMemo, useState } from "react";
import {
  BookOpenCheck,
} from "lucide-react";
import { api } from "../../api";
import { Card, EmptyState, ErrorNote, SectionTitle, StatusBadge } from "../../components/ui";

export function MyCoursesPanel({ data, onSaved }) {
  const subjects = data.curriculum_subjects || [];
  const [selected, setSelected] = useState(() => new Set(subjects.filter((item) => item.is_enrolled).map((item) => item.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => subjects.reduce((groups, subject) => {
    const category = subject.category || "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(subject);
    return groups;
  }, {}), [subjects]);

  useEffect(() => {
    setSelected(new Set(subjects.filter((item) => item.is_enrolled).map((item) => item.id)));
  }, [data.student.id, subjects.filter((item) => item.is_enrolled).map((item) => item.id).join(",")]);

  function toggle(subject) {
    if (subject.is_enrolled || subject.status === "Completed" || !subject.is_offered) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(subject.id)) next.delete(subject.id); else next.add(subject.id);
      return next;
    });
    setMessage("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.saveStudentEnrollment([...selected], data.current_term?.id);
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not save your current subjects.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <SectionTitle title="My suggested curriculum" subtitle="Add published subjects you are taking this semester. Subjects already on your enrollment record stay locked." icon={BookOpenCheck} />
      <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-ink">{data.current_term?.label || "Current semester"}</p>
        <p className="mt-1 text-xs">Current and completed subjects stay locked as part of your academic record. You may select additional subjects only when they are offered this semester.</p>
      </div>
      {subjects.length ? <div className="space-y-5">
        {Object.entries(grouped).map(([category, rows]) => (
          <section key={category}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-ink">{category}</h3><span className="text-xs text-slate-500">{rows.length} subject{rows.length === 1 ? "" : "s"}</span></div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {rows.map((subject) => {
                const checked = selected.has(subject.id);
                const disabled = subject.is_enrolled || subject.status === "Completed" || !subject.is_offered;
                return <label key={subject.id} className={`flex items-start gap-3 border-b border-slate-100 p-3 last:border-b-0 ${disabled ? "cursor-not-allowed bg-slate-50/70" : "cursor-pointer transition-colors hover:bg-brand-50/40"}`}>
                  <input type="checkbox" checked={subject.status === "Completed" || checked} onChange={() => toggle(subject)} disabled={disabled} className="mt-1 h-4 w-4 accent-brand-600" aria-label={`Currently enrolled in ${subject.code}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{subject.code} · {subject.title}</span><span className="mt-0.5 block text-xs text-slate-500">{subject.units} units · {subject.recommended_term || "No suggested semester"}</span></span>
                  <span className="flex flex-wrap justify-end gap-1.5"><StatusBadge value={subject.status === "Missing" ? "Not taken" : subject.status} dot={false} /><StatusBadge value={subject.is_offered ? "Offered" : "Not offered"} dot={false} /></span>
                </label>;
              })}
            </div>
          </section>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="btn-primary cursor-pointer">{busy ? "Saving…" : "Save current subjects"}</button>
          <p className="text-xs text-slate-500">{selected.size} subject{selected.size === 1 ? "" : "s"} checked for this semester.</p>
        </div>
        {message && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div> : <EmptyState icon={BookOpenCheck} title="No curriculum is available" hint="Ask the Academic Coordinator to confirm your curriculum version." />}
    </Card>
  );
}
