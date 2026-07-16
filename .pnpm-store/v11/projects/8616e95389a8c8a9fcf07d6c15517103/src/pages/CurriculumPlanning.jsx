import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, Download, FileSpreadsheet, Send, Upload } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

const COLUMNS = ["Draft Study Plan", "Needs Curriculum Version", "Ready for Review", "Student Choices Submitted", "Course Ready"];

export default function CurriculumPlanning() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importKind, setImportKind] = useState("students");
  const [versionId, setVersionId] = useState("");
  const [rationale, setRationale] = useState("");

  async function load(pid = programId, tid = termId) {
    setLoading(true); setError("");
    try {
      const res = await api.semesterPlanning({ program_id: pid || undefined, term_id: tid || undefined });
      setData(res); setProgramId(String(res.program.id)); setTermId(String(res.term.id));
      setSelected((current) => current ? res.students.find((item) => item.student.id === current.student.id) || null : null);
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  }

  useEffect(() => { load("", ""); }, []);

  async function uploadCurriculum(file) {
    if (!file) return;
    setBusy("curriculum"); setError("");
    try { const res = await api.importCurriculumVersion(file); setMessage(res.message); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function previewEnrollment(file) {
    if (!file) return;
    setBusy("preview"); setError("");
    try { setPreview(await api.previewSemesterEnrollment(file, importKind)); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function applyImport() {
    if (!preview) return;
    setBusy("apply"); setError("");
    try {
      const res = await api.applySemesterEnrollment({ rows: preview.rows, kind: preview.kind, filename: preview.filename });
      setMessage(res.message); setPreview(null); await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function studentAction(action) {
    if (!selected) return;
    setBusy(action); setError("");
    try {
      const res = await api.semesterStudentAction(selected.student.id, { case_id: data.id, action, version_id: versionId || undefined, rationale });
      setMessage(res.message); await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function caseAction(action) {
    setBusy(action); setError("");
    try { const res = await api.semesterCaseAction(data.id, { action }); setMessage(res.message); await load(); }
    catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  async function toggleTaken(subject, taken, selectedTermId) {
    setBusy(`subject-${subject.course_id}`); setError("");
    try {
      const res = await api.saveSemesterCompletion({ student_id: selected.student.id, course_id: subject.course_id, term_id: Number(selectedTermId), taken });
      setMessage(res.message); await load();
    } catch (err) { setError(err.message); } finally { setBusy(""); }
  }

  const grouped = useMemo(() => Object.fromEntries(COLUMNS.map((column) => [column, (data?.students || []).filter((item) => item.status === column)])), [data]);

  if (loading && !data) return <Spinner label="Loading semester planning…" />;
  if (!data) return <EmptyState title="Could not load semester planning" hint={error} />;
  return (
    <div className="space-y-5 animate-fade-up">
      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white"><BookOpenCheck className="h-6 w-6" /></span><div><h1 className="font-display text-2xl font-semibold text-ink">Semester planning</h1><p className="mt-1 text-sm text-slate-600">One linked case for study plans, course readiness, offerings, completion tracking, and the Dean’s final acknowledgment.</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><StatusBadge value={data.status} dot={false} />{user?.role === "academic_coordinator" && <><a className="btn-ghost" href={`/api/semester-planning/case/${data.id}/planning-scope.csv`}><Download className="h-4 w-4" />Download Registrar planning scope</a><button type="button" className="btn-ghost" onClick={() => caseAction("record_scope_sent")}><CheckCircle2 className="h-4 w-4" />Record scope sent</button></>}</div>
        </div>
      </Card>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}
      {message && <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</p>}

      <Card className="p-4"><div className="grid gap-3 md:grid-cols-2"><Field label="Program"><select className="field-input" value={programId} onChange={(event) => { setProgramId(event.target.value); load(event.target.value, termId); }}>{data.programs.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}</select></Field><Field label="Source academic semester"><select className="field-input" value={termId} onChange={(event) => { setTermId(event.target.value); load(programId, event.target.value); }}>{data.terms.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></Field></div></Card>

      {user?.role === "staff" && <Card className="p-5"><div className="flex items-start gap-3"><FileSpreadsheet className="mt-0.5 h-5 w-5 text-brand-700" /><div className="flex-1"><h2 className="font-semibold text-ink">Registrar and curriculum imports</h2><p className="mt-1 text-sm text-slate-500">Preview Registrar changes before replacing the program-semester roster. Unknown students automatically receive provisional onboarding cases.</p><div className="mt-4 flex flex-wrap items-end gap-3"><Field label="Registrar file type"><select className="field-input min-w-52" value={importKind} onChange={(event) => setImportKind(event.target.value)}><option value="students">Enrolled student list</option><option value="subjects">Student-subject enrollment status</option></select></Field><UploadButton label={busy === "preview" ? "Reading…" : "Preview Registrar Excel"} onFile={previewEnrollment} disabled={!!busy} /><UploadButton label={busy === "curriculum" ? "Importing…" : "Import curriculum versions"} onFile={uploadCurriculum} disabled={!!busy} /></div></div></div></Card>}

      {preview && <Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-ink">Import comparison</h2><p className="mt-1 text-sm text-slate-500">{preview.filename} · {preview.summary.rows} rows · {preview.summary.new_students} new · {preview.summary.changed_students} changed</p></div><button type="button" className="btn-primary" onClick={applyImport} disabled={busy === "apply"}><Upload className="h-4 w-4" />{busy === "apply" ? "Applying…" : "Overwrite this case"}</button></div><div className="mt-4 max-h-64 overflow-auto rounded-xl border border-slate-200"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-400"><th className="px-3 py-2">Student</th><th className="px-3 py-2">Program</th><th className="px-3 py-2">Term</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Subject</th></tr></thead><tbody>{preview.rows.slice(0, 100).map((row, index) => <tr key={`${row.student_number}-${row.subject_code || index}`} className="border-t border-slate-100"><td className="px-3 py-2"><p className="font-semibold">{row.first_name} {row.last_name}</p><p className="text-xs text-slate-500">{row.student_number}</p></td><td className="px-3 py-2">{row.program_code}</td><td className="px-3 py-2">{row.term}</td><td className="px-3 py-2">{row.enrollment_status}</td><td className="px-3 py-2">{row.subject_code || "—"}</td></tr>)}</tbody></table></div></Card>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Students" value={data.summary.students} /><Metric label="Course ready" value={data.summary.confirmed} /><Metric label="Needs version" value={data.summary.needs_version} /><Metric label="Blocked by onboarding" value={data.summary.blocked_onboarding} /></div>

      <Card className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-ink">Academic Coordinator student Kanban</h2><p className="text-sm text-slate-500">Cards are grouped by review status; open a card to review curriculum, recommendations, and completion history.</p></div>{user?.role === "academic_coordinator" && <button type="button" className="btn-primary" onClick={() => caseAction("send_readiness")} disabled={data.summary.students === 0 || data.summary.confirmed !== data.summary.students || !!busy}><Send className="h-4 w-4" />Send course readiness</button>}</div><div className="grid gap-3 xl:grid-cols-5">{COLUMNS.map((column) => <section key={column} className="min-h-44 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><div className="mb-3 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">{column}</h3><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{grouped[column]?.length || 0}</span></div><div className="space-y-2">{(grouped[column] || []).map((item) => <button key={item.student.id} type="button" onClick={() => { setSelected(item); setVersionId(item.curriculum?.id ? String(item.curriculum.id) : ""); setRationale(item.curriculum_rationale || ""); }} className="w-full cursor-pointer rounded-xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:border-brand-300"><p className="font-semibold text-ink">{item.student.name}</p><p className="mt-0.5 text-xs text-slate-500">{item.student.student_number}</p><div className="mt-2 flex flex-wrap gap-1"><StatusBadge value={item.onboarding_complete ? "Onboarded" : "Onboarding"} dot={false} /><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{item.recommendations.length} subjects</span></div></button>)}</div></section>)}</div></Card>

      {user?.role === "staff" && data.status === "Proposal Prepared" && <Card className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold text-ink">Update proposal with demand summary</h2><p className="text-sm text-slate-500">The Research Coordinator’s proposal remains the same record.</p></div><button type="button" className="btn-primary" onClick={() => caseAction("send_demand_summary")}><Send className="h-4 w-4" />Send demand summary to AC</button></Card>}
      {user?.role === "academic_coordinator" && data.status === "Coursework Monitoring" && <Card className="flex flex-wrap items-center justify-between gap-3 p-5"><div><h2 className="font-semibold text-ink">Coursework report</h2><p className="text-sm text-slate-500">After all Taken/Not Taken checks are recorded, send the on-screen report for Dean acknowledgment.</p></div><button type="button" className="btn-primary" onClick={() => caseAction("send_coursework_report")}><Send className="h-4 w-4" />Send report to Dean</button></Card>}

      {selected && <PlanDrawer item={selected} versions={data.versions} terms={data.terms} role={user?.role} versionId={versionId} setVersionId={setVersionId} rationale={rationale} setRationale={setRationale} busy={busy} onClose={() => setSelected(null)} onAction={studentAction} onTaken={toggleTaken} />}
    </div>
  );
}

function PlanDrawer({ item, versions, terms, role, versionId, setVersionId, rationale, setRationale, busy, onClose, onAction, onTaken }) {
  return <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/35" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-3"><div><h2 className="font-display text-xl font-semibold text-ink">{item.student.name}</h2><p className="text-sm text-slate-500">{item.student.student_number} · {item.student.program_code}</p></div><button type="button" className="btn-ghost" onClick={onClose}>Close</button></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Review status" value={item.status} small /><Metric label="Curriculum" value={item.curriculum?.name || "Not assigned"} small /><Metric label="Upcoming term" value={item.target_term?.label || "Not configured"} small /></div>{role === "academic_coordinator" && !item.curriculum && <Card className="mt-5 p-4"><Field label="Curriculum version"><select className="field-input" value={versionId} onChange={(event) => setVersionId(event.target.value)}><option value="">Select version</option>{versions.map((version) => <option key={version.id} value={version.id}>{version.name}</option>)}</select></Field>{versions.length > 1 && <Field label="Assignment rationale"><textarea className="field-input mt-3" value={rationale} onChange={(event) => setRationale(event.target.value)} /></Field>}<button type="button" className="btn-primary mt-3" disabled={!versionId || busy === "assign_curriculum"} onClick={() => onAction("assign_curriculum")}>Assign curriculum</button></Card>}<section className="mt-6"><h3 className="font-semibold text-ink">Recommended subjects</h3><p className="text-sm text-slate-500">Visible to the student immediately as a draft.</p><div className="mt-3 space-y-2">{item.recommendations.length ? item.recommendations.map((course) => <div key={course.id} className="rounded-xl border border-slate-200 p-3"><div className="flex justify-between gap-3"><div><p className="font-semibold text-ink">{course.code} — {course.title}</p><p className="text-xs text-slate-500">{course.units} units · {course.source}</p></div><StatusBadge value={course.source} dot={false} /></div></div>) : <EmptyState title="No draft subjects" hint="Assign a curriculum version to generate the study plan." />}</div></section>{role === "academic_coordinator" && item.curriculum && <button type="button" className="btn-primary mt-5" disabled={!item.onboarding_complete || busy === "confirm_plan"} onClick={() => onAction("confirm_plan")}><CheckCircle2 className="h-4 w-4" />{item.onboarding_complete ? "Confirm course readiness" : "Finish onboarding first"}</button>} {role === "academic_coordinator" && item.subjects.length > 0 && <section className="mt-8"><h3 className="font-semibold text-ink">Manual subject completion</h3><p className="text-sm text-slate-500">Canvas review is manual. Mark Taken only when the subject was successfully completed, then select its AY and semester.</p><div className="mt-3 space-y-2">{item.subjects.map((subject) => <CompletionRow key={subject.course_id} subject={subject} terms={terms} busy={busy} onTaken={onTaken} />)}</div></section>}</aside></div>;
}

function CompletionRow({ subject, terms, busy, onTaken }) { const initial = terms.find((term) => term.label === subject.taken_term)?.id || terms[0]?.id || ""; const [termId, setTermId] = useState(String(initial)); return <div className="grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-[1fr_210px_auto] sm:items-center"><div><p className="font-semibold text-ink">{subject.code} — {subject.title}</p><p className="text-xs text-slate-500">{subject.category} · {subject.units} units</p></div><select className="field-input" value={termId} onChange={(event) => setTermId(event.target.value)}>{terms.map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}</select><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5 accent-brand-600" checked={subject.taken} disabled={busy === `subject-${subject.course_id}`} onChange={(event) => onTaken(subject, event.target.checked, termId)} />Taken</label></div>; }
function UploadButton({ label, onFile, disabled }) { return <label className={`btn-ghost ${disabled ? "pointer-events-none opacity-50" : "cursor-pointer"}`}><Upload className="h-4 w-4" />{label}<input type="file" accept=".xlsx,.xlsm" className="sr-only" onChange={(event) => { onFile(event.target.files?.[0]); event.target.value = ""; }} /></label>; }
function Field({ label, children }) { return <label className="block"><span className="field-label">{label}</span>{children}</label>; }
function Metric({ label, value, small = false }) { return <div className={`rounded-xl border border-slate-200 bg-white ${small ? "p-3" : "p-4"}`}><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><p className={`${small ? "mt-1 text-sm" : "mt-2 text-xl"} font-semibold text-ink`}>{value}</p></div>; }
