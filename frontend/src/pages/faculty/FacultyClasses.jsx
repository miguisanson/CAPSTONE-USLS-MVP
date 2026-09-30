import { useEffect, useState } from "react";
import {
  ClipboardCheck,
  Printer,
  Lock,
} from "lucide-react";
import { api } from "../../api";
import { SectionTitle, StatusBadge, EmptyState } from "../../components/ui";
import { printDataTable } from "../../lib/print";

export function FacultyClasses({ subjects, terms }) {
  const activeTerm = terms.find((term) => term.is_active_planning_term) || terms[0];
  const [term, setTerm] = useState(activeTerm?.label || "");
  const [courseId, setCourseId] = useState(subjects[0]?.id || "");
  const [roster, setRoster] = useState(null);
  const [notice, setNotice] = useState("");

  useEffect(() => { if (!term && activeTerm) setTerm(activeTerm.label); }, [activeTerm, term]);
  useEffect(() => { if (!courseId && subjects.length) setCourseId(subjects[0].id); }, [courseId, subjects]);
  useEffect(() => {
    if (!courseId || !term) return;
    setNotice("");
    api.courseAuditRoster(courseId, term).then((res) => {
      setRoster(res);
    }).catch((err) => setNotice(err.message));
  }, [courseId, term]);

  function printRoster() {
    if (!roster) return;
    printDataTable({
      title: `${roster.course.code} - ${roster.course.title} Class Roster`,
      subtitle: term,
      columns: ["Student ID", "Student name", "Program", "Status", "Official grade", "Remarks"],
      rows: roster.students.map((student) => [student.student_number, student.name, student.program_code, student.status, student.grade_value || "No grade", student.remarks || ""]),
    });
  }

  return <div>
    <SectionTitle title="Assigned class rosters" subtitle="Review assigned subjects and students. Official grade data is read-only in the USLS portal." icon={ClipboardCheck} />
    <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
      <p>Grades and subject outcomes are encoded and maintained in their authorized source systems. The Monitoring Sheet is a synchronized, read-only view.</p>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label><span className="field-label">Semester</span><select className="field-input cursor-pointer" value={term} onChange={(e) => setTerm(e.target.value)}>{terms.map((item) => <option key={item.id} value={item.label}>{item.label}</option>)}</select></label>
      <label><span className="field-label">Subject</span><select className="field-input cursor-pointer" value={courseId} onChange={(e) => setCourseId(e.target.value)}>{subjects.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.title}</option>)}</select></label>
    </div>
    {roster?.students?.length ? <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-slate-400"><th className="py-2">Student</th><th>Status</th><th>Official grade</th><th>Remarks</th></tr></thead><tbody>{roster.students.map((student) => <tr key={student.student_id} className="border-b border-slate-100"><td className="py-3 pr-3"><p className="font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-500">{student.student_number}</p></td><td className="pr-3"><StatusBadge value={student.status} dot={false} /></td><td className="pr-3 font-semibold text-slate-700">{student.grade_value || "No grade"}</td><td className="text-slate-500">{student.remarks || "—"}</td></tr>)}</tbody></table><div className="mt-4"><button type="button" onClick={printRoster} className="btn-ghost cursor-pointer"><Printer className="h-4 w-4" /> Print roster</button></div></div> : <EmptyState icon={ClipboardCheck} title="No students in this class" hint="The Academic Coordinator must add students through Enrollment first." />}
    {notice && <p className="mt-3 text-sm font-semibold text-red-700" role="alert">{notice}</p>}
  </div>;
}
