import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpenCheck,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  FileSpreadsheet,
  GraduationCap,
  LockKeyhole,
  Search,
  TriangleAlert,
  UnlockKeyhole,
  Users,
  X,
} from "lucide-react";
import { api } from "../api";
import { Card, EmptyState, ProgressBar, Spinner } from "../components/ui";

const REQUIRED_UNITS = { Basic: 6, Major: 9, Cognate: 6 };

export default function CurriculumPlanning() {
  const [searchParams, setSearchParams] = useSearchParams();
  const programParam = searchParams.get("program_id") || "";
  const termParam = searchParams.get("term_id") || "";
  const [programId, setProgramId] = useState(programParam);
  const [termId, setTermId] = useState(termParam);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [showCurriculum, setShowCurriculum] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");
    api.curriculumPlanning({ program_id: programParam || undefined, term_id: termParam || undefined })
      .then((res) => {
        setData(res);
        setProgramId(String(res.program.id));
        setTermId(res.term ? String(res.term.id) : "");
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    setSelectedStudentId(null);
  }, [programParam, termParam]);

  function updateFilters(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    setSearchParams(params, { replace: true });
  }

  const students = useMemo(() => (data?.students || []).filter((student) => {
    const text = `${student.name} ${student.student_number}`.toLowerCase();
    const matchesQuery = !query || text.includes(query.toLowerCase());
    const matchesStatus = !status
      || (status === "current" && student.current_subjects.length > 0)
      || (status === "next" && student.next_subjects.length > 0)
      || (status === "review" && (student.exceptions.length > 0 || student.current_subjects.length === 0))
      || (status === "compre" && student.compre_eligibility?.eligible);
    return matchesQuery && matchesStatus;
  }), [data, query, status]);

  const selected = data?.students?.find((student) => student.id === selectedStudentId) || null;
  const courseAdjustmentsUrl = `/course-adjustments?program_id=${programId}${termId ? `&term_id=${termId}` : ""}`;

  return (
    <div className="space-y-5 animate-fade-up">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-700">Semester study planning</p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Curriculum Planning</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            See every enrolled student, what they are taking this semester, and which subjects they need next.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:min-w-[620px] xl:grid-cols-3">
          <label>
            <span className="sr-only">Curriculum and program</span>
            <select value={programId} onChange={(event) => updateFilters({ program_id: event.target.value })} className="field-input cursor-pointer" aria-label="Curriculum and program">
              {(data?.programs || []).map((program) => <option key={program.id} value={program.id}>{program.code} - {program.name}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">School term</span>
            <select value={termId} onChange={(event) => updateFilters({ term_id: event.target.value })} className="field-input cursor-pointer" aria-label="School term">
              {(data?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}</option>)}
            </select>
          </label>
          <Link to={courseAdjustmentsUrl} className="btn-primary justify-center"><BookOpenCheck className="h-4 w-4" /> View next-term demand</Link>
        </div>
      </div>

      {loading ? <Spinner label="Loading enrolled students..." /> : error ? (
        <EmptyState icon={AlertTriangle} title="Could not load semester planning" hint={error} />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard icon={Users} label="Enrolled this semester" value={data.summary.total_enrolled} tone="brand" />
            <SummaryCard icon={FileSpreadsheet} label="With current subjects" value={data.summary.with_current_subjects} tone="blue" />
            <SummaryCard icon={ChevronRight} label="With next subjects" value={data.summary.with_next_subjects} tone="brand" />
            <SummaryCard icon={TriangleAlert} label="Needs review" value={data.summary.needs_review} tone="amber" />
          </div>

          <Card className="overflow-hidden">
            <button type="button" onClick={() => setShowCurriculum((value) => !value)} className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50">
              <div>
                <p className="font-semibold text-ink">Curriculum filter: {data.version.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">{data.summary.subjects} requirements define each student’s current and next subject sequence.</p>
              </div>
              <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${showCurriculum ? "rotate-180" : ""}`} />
            </button>
            {showCurriculum && <CurriculumReference categories={data.categories} />}
          </Card>

          <Card className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="font-semibold text-ink">Enrolled students</h2>
                <p className="text-sm text-slate-500">{data.term?.label} · showing {students.length} of {data.summary.total_enrolled}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-9" placeholder="Search student..." aria-label="Search enrolled students" />
                </div>
                <select value={status} onChange={(event) => setStatus(event.target.value)} className="field-input cursor-pointer" aria-label="Student planning status">
                  <option value="">All students</option>
                  <option value="current">Has current subjects</option>
                  <option value="next">Has next subjects</option>
                  <option value="compre">Compre eligible</option>
                  <option value="review">Needs review</option>
                </select>
              </div>
            </div>
          </Card>

          <div className={`grid grid-cols-1 gap-4 ${selected ? "xl:grid-cols-12" : ""}`}>
            <Card className={`overflow-hidden ${selected ? "xl:col-span-8" : ""}`}>
              {students.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1040px] text-sm">
                    <thead><tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400"><th className="px-5 py-3">Student</th><th className="px-3 py-3">Current subjects</th><th className="px-3 py-3">Next subjects needed</th><th className="px-3 py-3">Progress</th><th className="px-3 py-3"><span className="sr-only">Action</span></th></tr></thead>
                    <tbody>{students.map((student) => <StudentSemesterRow key={student.id} student={student} selected={student.id === selectedStudentId} onSelect={() => setSelectedStudentId(student.id)} />)}</tbody>
                  </table>
                </div>
              ) : <EmptyState icon={Search} title="No enrolled students match" hint="Try another term, curriculum, or student filter." />}
            </Card>
            {selected && <StudentSemesterDetail student={selected} term={data.term} onClose={() => setSelectedStudentId(null)} />}
          </div>

          <Card className="border-brand-200 bg-brand-50/40 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><p className="font-semibold text-brand-900">Next subjects become course demand</p><p className="mt-1 text-sm text-brand-800">Course Adjustments groups the “Next subjects needed” column across these enrolled students and counts demand per subject.</p></div>
              <Link to={courseAdjustmentsUrl} className="btn-primary shrink-0">Open Course Adjustments <ChevronRight className="h-4 w-4" /></Link>
            </div>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function StudentSemesterRow({ student, selected, onSelect }) {
  return (
    <tr className={`border-b border-slate-50 align-top transition-colors ${selected ? "bg-brand-50" : "hover:bg-slate-50"}`}>
      <td className="px-5 py-4"><p className="font-semibold text-ink">{student.name}</p><p className="mt-0.5 text-xs text-slate-400">{student.student_number} · {student.current_stage}</p></td>
      <td className="px-3 py-4"><SubjectChips subjects={student.current_subjects} empty="No current subjects recorded" tone="blue" /></td>
      <td className="px-3 py-4"><SubjectChips subjects={student.next_subjects} empty={student.completion_rate === 100 ? "Curriculum complete" : "No next group found"} tone="brand" /></td>
      <td className="px-3 py-4"><div className="w-32"><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-slate-700">{student.completed_units}/{student.total_units}u</span><span className="text-slate-400">{student.completion_rate}%</span></div><ProgressBar value={student.completion_rate} /></div></td>
      <td className="px-3 py-4 text-right"><button type="button" onClick={onSelect} className="inline-flex cursor-pointer items-center gap-1 whitespace-nowrap text-xs font-bold text-brand-700 hover:text-brand-900">View student <ChevronRight className="h-4 w-4" /></button></td>
    </tr>
  );
}

function StudentSemesterDetail({ student, term, onClose }) {
  return (
    <Card className="p-5 xl:col-span-4 xl:self-start">
      <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-brand-700">Semester plan</p><h2 className="mt-1 text-lg font-semibold text-ink">{student.name}</h2><p className="text-sm text-slate-500">{term?.label}</p></div><button type="button" onClick={onClose} className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-slate-400 hover:bg-slate-100" aria-label="Close student plan"><X className="h-4 w-4" /></button></div>
      <PlanSection title="Currently enrolled" subjects={student.current_subjects} empty="No current subjects were recorded for this student." />
      <PlanSection title="Recommended next subjects" subjects={student.next_subjects} empty="No remaining subject group was found." />
      <div className="mt-5 space-y-3">{["Basic", "Major", "Cognate"].map((category) => { const progress = student.category_progress.find((item) => item.category === category); return <RequirementProgress key={category} label={category} actual={progress?.completed_units || 0} required={REQUIRED_UNITS[category]} />; })}</div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <StateBox icon={GraduationCap} label="Compre exam" value={student.compre_eligibility.passed ? "Passed" : student.compre_eligibility.eligible ? "Eligible" : "Not eligible"} positive={student.compre_eligibility.passed} />
        <StateBox icon={student.research_access === "Unlocked" ? UnlockKeyhole : LockKeyhole} label="Research" value={student.research_access} positive={student.research_access === "Unlocked"} />
      </div>
      <Link to={`/students/${student.id}`} className="btn-ghost mt-5 w-full justify-center">Open full record <ChevronRight className="h-4 w-4" /></Link>
    </Card>
  );
}

function CurriculumReference({ categories }) {
  return <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/60 p-4 md:grid-cols-2 xl:grid-cols-4">{categories.map((category) => <div key={category.name} className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><div className="flex items-center justify-between"><p className="font-semibold text-ink">{category.name}</p><span className="text-xs font-bold text-slate-500">{category.courses.reduce((sum, course) => sum + course.units, 0)}u</span></div><p className="mt-2 text-xs leading-relaxed text-slate-500">{category.courses.map((course) => course.code).join(" · ") || "No subjects"}</p></div>)}</div>;
}

function SubjectChips({ subjects, empty, tone }) {
  if (!subjects.length) return <span className="text-xs text-slate-400">{empty}</span>;
  const color = tone === "blue" ? "bg-blue-50 text-blue-700 ring-blue-100" : "bg-brand-50 text-brand-700 ring-brand-100";
  return <div className="flex max-w-md flex-wrap gap-1.5">{subjects.map((subject) => <span key={subject.id} title={subject.title} className={`rounded-md px-2 py-1 text-xs font-semibold ring-1 ${color}`}>{subject.code}</span>)}</div>;
}

function PlanSection({ title, subjects, empty }) {
  return <div className="mt-5"><h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{title}</h3>{subjects.length ? <ul className="mt-2 space-y-2">{subjects.map((subject) => <li key={subject.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"><div><p className="text-sm font-semibold text-ink">{subject.code}</p><p className="text-xs text-slate-500">{subject.title}</p></div><span className="shrink-0 text-xs font-semibold text-slate-500">{subject.units}u</span></li>)}</ul> : <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500">{empty}</p>}</div>;
}

function RequirementProgress({ label, actual, required }) { const complete = actual >= required; return <div><div className="mb-1 flex justify-between text-sm"><span className="font-semibold text-slate-700">{label}</span><span className={complete ? "font-bold text-brand-700" : "text-slate-500"}>{actual}/{required}u {complete && <CircleCheck className="ml-1 inline h-3.5 w-3.5" />}</span></div><ProgressBar value={(actual / required) * 100} /></div>; }

function SummaryCard({ icon: Icon, label, value, tone }) { const colors = { brand: "bg-brand-50 text-brand-700", blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-800" }; return <Card className="flex items-center gap-3 p-4"><span className={`grid h-10 w-10 place-items-center rounded-xl ${colors[tone]}`}><Icon className="h-5 w-5" /></span><div><p className="font-display text-2xl font-semibold leading-none text-ink">{value}</p><p className="mt-1 text-xs text-slate-500">{label}</p></div></Card>; }

function StateBox({ icon: Icon, label, value, positive }) { return <div className={`rounded-xl p-3 ${positive ? "bg-brand-50 text-brand-800" : "bg-slate-100 text-slate-600"}`}><Icon className="h-4 w-4" /><p className="mt-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">{label}</p><p className="mt-0.5 text-sm font-bold">{value}</p></div>; }
