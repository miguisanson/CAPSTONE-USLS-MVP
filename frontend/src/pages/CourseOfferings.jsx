import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpenCheck, Plus, Save, Trash2, CalendarClock, Eye, Lightbulb } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, ErrorNote, Spinner, StatusBadge } from "../components/ui";
import { useConfirm } from "../components/confirm";
import FacultyAssignmentProfile from "../components/FacultyAssignmentProfile";

// Course Offering Setup (Sir Eddie, 2026-07-21): the Academic Coordinator declares which
// subjects are offered for a program + semester, assigns faculty and schedule, and those
// offerings are what students get tagged/enrolled into on the Enrollment screen.
export default function CourseOfferings({ embedded = false }) {
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [addCourseId, setAddCourseId] = useState("");
  const [edits, setEdits] = useState({});
  const [selectedFaculty, setSelectedFaculty] = useState(null);

  const programId = searchParams.get("program_id") || "";
  const termId = searchParams.get("term_id") || "";

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await api.courseOfferings({ program_id: programId || undefined, term_id: termId || undefined });
      setData(res);
      setEdits({});
      const canonical = { program_id: String(res.program.id), term_id: String(res.term?.id || "") };
      if (canonical.program_id !== programId || canonical.term_id !== termId) {
        const params = new URLSearchParams(searchParams);
        params.set("view", "offerings");
        params.set("program_id", canonical.program_id);
        if (canonical.term_id) params.set("term_id", canonical.term_id); else params.delete("term_id");
        setSearchParams(params, { replace: true });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, termId]);

  const canManage = data?.permissions?.can_manage;

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    const values = { program_id: next.program_id ?? programId, term_id: next.term_id ?? termId };
    Object.entries(values).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    setSearchParams(params, { replace: true });
  }

  function editOf(offering) {
    return edits[offering.id] || { faculty_id: offering.faculty_id || "", schedule: offering.schedule || "", section: offering.section || "" };
  }
  function setEdit(id, key, value) {
    setEdits((cur) => ({ ...cur, [id]: { ...editOf({ id, ...data.offerings.find((o) => o.id === id) }), ...cur[id], [key]: value } }));
  }

  async function addOffering() {
    if (!addCourseId) return;
    setBusy("add"); setNotice(""); setError("");
    try {
      const res = await api.addCourseOffering({ program_id: data.program.id, term_id: data.term.id, course_id: Number(addCourseId) });
      setNotice(res.message);
      setAddCourseId("");
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function saveOffering(offering) {
    const e = editOf(offering);
    setBusy(`save-${offering.id}`); setNotice(""); setError("");
    try {
      const res = await api.updateCourseOffering(offering.id, { faculty_id: e.faculty_id || null, schedule: e.schedule, section: e.section });
      setNotice(res.message);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function removeOffering(offering) {
    const ok = await confirm({
      title: "Remove this offering?",
      message: `Stop offering ${offering.code} this semester? This is only allowed when no student is enrolled in it yet.`,
      confirmLabel: "Remove offering", tone: "danger",
    });
    if (!ok) return;
    setBusy(`del-${offering.id}`); setNotice(""); setError("");
    try {
      const res = await api.deleteCourseOffering(offering.id);
      setNotice(res.message);
      await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  if (loading && !data) return <Spinner label="Loading course offerings..." />;

  return (
    <div className={`space-y-5 ${embedded ? "" : "animate-fade-up"}`}>
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {!embedded && <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><BookOpenCheck className="h-6 w-6" /></span>}
          <div className="flex-1">
            <h2 className={`font-display font-semibold text-ink ${embedded ? "text-xl" : "text-2xl"}`}>Course Offering Setup</h2>
            <p className="mt-1 text-sm text-slate-600">
              Complete the official offering list, then choose the faculty, schedule, and section. Faculty suggestions are references only; the Academic Coordinator can change every assignment.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <select value={data?.program?.id || programId} onChange={(e) => updateFilters({ program_id: e.target.value })} className="field-input cursor-pointer" aria-label="Program">
                {(data?.programs || []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
              <select value={data?.term?.id || termId} onChange={(e) => updateFilters({ term_id: e.target.value })} className="field-input cursor-pointer" aria-label="Semester">
                {(data?.terms || []).map((t) => <option key={t.id} value={t.id}>{t.label}{t.relative_label ? ` (${t.relative_label})` : ""}</option>)}
              </select>
            </div>
          </div>
        </div>
      </Card>

      <ErrorNote message={error} />
      {notice && <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{notice}</div>}

      {canManage && (
        <Card className="p-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <p className="field-label">Add a subject to this semester's offerings</p>
              <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} className="field-input cursor-pointer">
                <option value="">Select a curriculum subject…</option>
                {(data?.available_subjects || []).map((c) => <option key={c.id} value={c.id}>{c.code} — {c.title}</option>)}
              </select>
            </div>
            <button type="button" onClick={addOffering} disabled={!addCourseId || busy === "add"} className="btn-primary cursor-pointer">
              {busy === "add" ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Plus className="h-4 w-4" />}
              Add offering
            </button>
          </div>
          {!(data?.available_subjects || []).length && <p className="mt-2 text-xs text-slate-400">All curriculum subjects for this program are already offered this semester.</p>}
        </Card>
      )}

      {(data?.offerings || []).length ? (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Subject</th>
                  <th className="px-3 py-3">Faculty</th>
                  <th className="px-3 py-3">Schedule</th>
                  <th className="px-3 py-3">Section</th>
                  <th className="px-3 py-3 text-center">Enrolled</th>
                  {canManage && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.offerings.map((o) => {
                  const e = editOf(o);
                  return (
                    <tr key={o.id} className="border-b border-slate-100">
                      <td className="px-5 py-3"><p className="font-semibold text-ink">{o.code}</p><p className="text-xs text-slate-500">{o.title} · {o.units}u</p></td>
                      <td className="px-3 py-3">
                        {canManage ? (
                          <div className="min-w-64">
                            <select value={e.faculty_id} onChange={(ev) => setEdit(o.id, "faculty_id", ev.target.value)} className="field-input cursor-pointer">
                              <option value="">Unassigned</option>
                              {(data.faculty || []).map((f) => <option key={f.id} value={f.id}>{f.name} · {f.specialization}</option>)}
                            </select>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                              {o.suggested_faculty_name && (
                                <button type="button" onClick={() => setEdit(o.id, "faculty_id", String(o.suggested_faculty_id))} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">
                                  <Lightbulb className="h-3.5 w-3.5" /> Suggested: {o.suggested_faculty_name}
                                </button>
                              )}
                              {e.faculty_id && (
                                <button type="button" onClick={() => setSelectedFaculty((data.faculty_profiles || []).find((faculty) => faculty.id === Number(e.faculty_id)) || null)} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-slate-600 hover:text-brand-700">
                                  <Eye className="h-3.5 w-3.5" /> View profile
                                </button>
                              )}
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">{o.suggestion_basis}</p>
                          </div>
                        ) : (o.faculty_name || <span className="text-slate-400">Unassigned</span>)}
                      </td>
                      <td className="px-3 py-3">
                        {canManage ? <input value={e.schedule} onChange={(ev) => setEdit(o.id, "schedule", ev.target.value)} placeholder="e.g. Sat 8:00-11:00" className="field-input max-w-48" /> : (o.schedule || <span className="text-slate-400">—</span>)}
                      </td>
                      <td className="px-3 py-3">
                        {canManage ? <input value={e.section} onChange={(ev) => setEdit(o.id, "section", ev.target.value)} placeholder="A" className="field-input max-w-20" /> : (o.section || <span className="text-slate-400">—</span>)}
                      </td>
                      <td className="px-3 py-3 text-center"><StatusBadge value={`${o.enrolled_count}`} dot={false} /></td>
                      {canManage && (
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => saveOffering(o)} disabled={busy === `save-${o.id}`} className="btn-ghost cursor-pointer px-3 py-2"><Save className="h-4 w-4" /> Save</button>
                            <button type="button" onClick={() => removeOffering(o)} disabled={busy === `del-${o.id}`} className="btn-ghost cursor-pointer px-3 py-2 text-red-600"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <EmptyState icon={CalendarClock} title="No subjects offered yet for this semester" hint={canManage ? "Add subjects above to build this semester's offering list." : "The Academic Coordinator has not set up offerings for this semester."} />
      )}
      {selectedFaculty && <FacultyAssignmentProfile faculty={selectedFaculty} onClose={() => setSelectedFaculty(null)} />}
    </div>
  );
}
