import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BookOpenCheck, FileSpreadsheet, RefreshCw, AlertTriangle, Users, CheckCircle2, Plus, X, Save } from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

export default function CurriculumPlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProgramId = searchParams.get("program_id") || "";
  const [programId, setProgramId] = useState(selectedProgramId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [subject, setSubject] = useState({ code: "", title: "", units: 3, category: "Core", recommended_term: "Year 1" });

  function load(pid) {
    setLoading(true);
    setError("");
    api
      .curriculumPlanning(pid || undefined)
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load(selectedProgramId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramId]);

  async function createSubject(event) {
    event.preventDefault();
    if (!programId) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await api.createCurriculumSubject({ program_id: programId, ...subject });
      setMessage(res.message);
      setData(res.data);
      setSubject({ code: "", title: "", units: 3, category: "Core", recommended_term: "Year 1" });
      setShowSubjectForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-ink">Curriculum Planning</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review admitted and enrolled students, tag the curriculum basis, and generate required subject rows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={programId}
            onChange={(e) => setSearchParams({ program_id: e.target.value })}
            className="field-input cursor-pointer"
            aria-label="Program"
          >
            {(data?.programs || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} - {p.name}
              </option>
            ))}
          </select>
          <Link to={programId ? `/monitoring-sheet?program_id=${programId}` : "/monitoring-sheet"} className="btn-ghost">
            <FileSpreadsheet className="h-4 w-4" /> Monitoring Sheet
          </Link>
          <button type="button" onClick={() => setShowSubjectForm((current) => !current)} className="btn-primary">
            {showSubjectForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showSubjectForm ? "Close" : "Add subject"}
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner label="Loading curriculum planning..." />
      ) : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load curriculum planning" hint={error} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Metric icon={Users} label="Students" value={data.summary.students} tone="brand" />
            <Metric icon={CheckCircle2} label="Active" value={data.summary.active} tone="blue" />
            <Metric icon={AlertTriangle} label="Delayed / LOA" value={data.summary.delayed_or_loa} tone="amber" />
            <Metric icon={BookOpenCheck} label="Subjects" value={data.summary.subjects} tone="brand" />
            <Metric icon={RefreshCw} label="Audit coverage" value={`${data.summary.coverage_rate}%`} tone={data.summary.coverage_rate === 100 ? "brand" : "red"} />
          </div>

          {showSubjectForm && (
            <Card className="p-5">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-ink">Add curriculum subject</h2>
                <p className="mt-1 text-sm text-slate-500">The subject becomes part of {data.program.code} and is automatically added to every student course audit in this program.</p>
              </div>
              <form onSubmit={createSubject} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
                  <SubjectField label="Subject code" required>
                    <input required value={subject.code} onChange={(e) => setSubject((current) => ({ ...current, code: e.target.value.toUpperCase() }))} className="field-input" placeholder={`${data.program.code}-509`} />
                  </SubjectField>
                  <SubjectField label="Subject title" required className="xl:col-span-2">
                    <input required value={subject.title} onChange={(e) => setSubject((current) => ({ ...current, title: e.target.value }))} className="field-input" placeholder="Advanced Research Seminar" />
                  </SubjectField>
                  <SubjectField label="Units" required>
                    <input required type="number" min="0" max="12" value={subject.units} onChange={(e) => setSubject((current) => ({ ...current, units: e.target.value }))} className="field-input" />
                  </SubjectField>
                  <SubjectField label="Category" required>
                    <select value={subject.category} onChange={(e) => setSubject((current) => ({ ...current, category: e.target.value }))} className="field-input cursor-pointer">
                      {["Basic", "Core", "Major", "Cognate", "Comprehensive"].map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </SubjectField>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="w-full sm:max-w-xs">
                    <SubjectField label="Recommended term" required>
                      <select value={subject.recommended_term} onChange={(e) => setSubject((current) => ({ ...current, recommended_term: e.target.value }))} className="field-input cursor-pointer">
                        {["Year 1 Term 1", "Year 1 Term 2", "Year 2 Term 1", "Year 2 Term 2", "Year 3"].map((item) => <option key={item}>{item}</option>)}
                      </select>
                    </SubjectField>
                  </div>
                  <button type="submit" disabled={busy} className="btn-primary">
                    {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <Save className="h-4 w-4" />}
                    {busy ? "Adding..." : "Add subject"}
                  </button>
                </div>
              </form>
            </Card>
          )}

          {message && <p className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">{message}</p>}

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <Card className="p-5 lg:col-span-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-ink">Curriculum subjects</h2>
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700">
                  {data.categories.reduce((t, c) => t + c.courses.reduce((u, x) => u + (x.units || 0), 0), 0)} total units
                </span>
              </div>
              <div className="space-y-4">
                {data.categories.map((cat) => {
                  const catUnits = cat.courses.reduce((u, x) => u + (x.units || 0), 0);
                  return (
                    <div key={cat.name}>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{cat.name}</p>
                        <span className="text-xs font-semibold text-slate-500">{cat.courses.length} subj · {catUnits}u</span>
                      </div>
                      <ul className="space-y-1.5">
                        {cat.courses.map((course) => (
                          <li key={course.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                            <span className="min-w-0">
                              <span className="font-semibold text-ink">{course.code}</span>
                              <span className="ml-1 text-slate-500">{course.title}</span>
                            </span>
                            <span className="ml-2 shrink-0 text-xs font-semibold text-slate-400">{course.units}u</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="overflow-hidden lg:col-span-8">
              <div className="border-b border-slate-100 px-5 py-3">
                <h2 className="text-lg font-semibold text-ink">Student curriculum coverage</h2>
                <p className="text-sm text-slate-500">Coverage updates automatically when students or curriculum subjects are added.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                      <th className="px-5 py-3">Student</th>
                      <th className="px-3 py-3">Stage</th>
                      <th className="px-3 py-3">Rows</th>
                      <th className="px-3 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-50">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-ink">{student.name}</p>
                          <p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p>
                        </td>
                        <td className="px-3 py-3 text-slate-600">{student.current_stage}</td>
                        <td className="px-3 py-3 text-slate-600">
                          {student.curriculum_rows}/{student.required_subjects}
                        </td>
                        <td className="px-3 py-3">
                          <StatusBadge value={student.curriculum_status} dot={false} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone }) {
  const tones = {
    brand: "bg-brand-50 text-brand-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
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

function SubjectField({ label, required, children, className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="field-label">{label}{required && <span className="text-red-500"> *</span>}</span>
      {children}
    </label>
  );
}
