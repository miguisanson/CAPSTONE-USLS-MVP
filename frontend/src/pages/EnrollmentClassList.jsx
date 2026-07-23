import { useEffect, useState } from "react";
import { AlertTriangle, Download, Lock, UsersRound } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";

export default function EnrollmentClassList() {
  const { data: meta } = useApi(() => api.meta(), []);
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api.monitoringClassList({
      program_id: programId || undefined,
      term_id: termId || undefined,
      course_id: courseId || undefined,
    })
      .then((result) => {
        setData(result);
        setProgramId(String(result.program?.id || ""));
        setTermId(String(result.selected_term?.id || ""));
        setCourseId(String(result.selected_course_id || ""));
      })
      .catch((requestError) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, [programId, termId, courseId]);

  function exportCsv() {
    if (!data) return;
    const lines = [["Student", "IDNO", "Program", "Status", "Enrolled at", "Source"].join(",")];
    (data.students || []).forEach((student) => {
      lines.push([
        `"${displayStudentName(student)}"`, student.student_number, student.program_code,
        student.status, student.enrolled_at || "", `"${student.source_reference || ""}"`,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `class-list-${data.selected_offering?.course_code || data.program?.code || "enrollment"}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Enrollment record</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink">Enrollment Class List</h1>
        <p className="mt-1 text-sm text-slate-500">A separate, read-only class roster synchronized automatically with confirmed Enrollment records.</p>
      </div>

      <Card className="p-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select value={programId} onChange={(event) => { setProgramId(event.target.value); setCourseId(""); }} className="field-input cursor-pointer" aria-label="Program">
            {(meta?.programs || []).map((program) => <option key={program.id} value={program.id}>{program.code} — {program.name}</option>)}
          </select>
          <select value={termId} onChange={(event) => { setTermId(event.target.value); setCourseId(""); }} className="field-input cursor-pointer" aria-label="Semester">
            {(data?.terms || meta?.terms || []).map((term) => <option key={term.id} value={term.id}>{term.label}{term.relative_label ? ` (${term.relative_label})` : ""}</option>)}
          </select>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="field-input cursor-pointer" aria-label="Offered class">
            {(data?.offerings || []).length
              ? data.offerings.map((offering) => <option key={offering.course_id} value={offering.course_id}>{offering.course_code} — {offering.course_title}</option>)
              : <option value="">No offered classes</option>}
          </select>
          <button type="button" onClick={exportCsv} className="btn-ghost" disabled={!data}><Download className="h-4 w-4" /> Export CSV</button>
        </div>
      </Card>

      <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <p><span className="font-semibold text-ink">Read-only roster.</span> Confirm or change enrollment in the Enrollment workspace; this list updates automatically.</p>
      </div>

      {loading ? <Spinner label="Loading enrollment class list…" />
        : error ? <EmptyState icon={AlertTriangle} title="Could not load the class list" hint={error} />
          : <ClassListPanel data={data} />}
    </div>
  );
}

function ClassListPanel({ data }) {
  if (!data?.offerings?.length) {
    return <EmptyState icon={UsersRound} title="No classes offered this semester" hint="Add a subject under Course Adjustments → Offering setup, then enroll students to build its class list." />;
  }
  const offering = data.selected_offering;
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Enrollment-synchronized class list</p>
            <h2 className="mt-1 font-display text-lg font-semibold text-ink">{offering?.course_code} — {offering?.course_title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {[offering?.faculty_name || "Faculty not assigned", offering?.schedule || "Schedule not set", offering?.section ? `Section ${offering.section}` : "Section not set"].join(" · ")}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700">{data.summary?.students_in_selected_class || 0} listed</span>
            <span className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 font-semibold text-brand-700">{data.summary?.active_students || 0} active</span>
          </div>
        </div>
      </div>
      {!data.students?.length ? (
        <EmptyState icon={UsersRound} title="No students enrolled in this class" hint="Students appear here automatically after Enrollment or an imported class list is confirmed." />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-200 bg-white text-left text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 sm:px-5">Student</th>
                <th className="px-4 py-3">IDNO</th>
                <th className="px-4 py-3">Program</th>
                <th className="px-4 py-3">Enrollment status</th>
                <th className="px-4 py-3">Enrolled</th>
                <th className="px-4 py-3">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.students.map((student) => (
                <tr key={student.subject_enrollment_id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-ink sm:px-5">{displayStudentName(student)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{student.student_number}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{student.program_code}</td>
                  <td className="whitespace-nowrap px-4 py-3"><StatusBadge value={student.status} /></td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(student.enrolled_at)}</td>
                  <td className="max-w-xs px-4 py-3 text-slate-600">{student.source_reference || "Enrollment workspace"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
}

function displayStudentName(student) {
  if (student.last_name || student.first_name) {
    return `${student.last_name || ""}, ${student.first_name || ""}`.replace(/^, /, "").trim();
  }
  return student.name || "Unnamed student";
}
