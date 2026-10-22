import { useEffect, useState } from "react";
import { ClipboardCheck, Lock, Printer } from "lucide-react";
import { api } from "../../api";
import { Button, DataTable, Field, InlineNotice, SectionTitle, Select, StatusChip } from "../../components/ui/index.js";
import { printDataTable } from "../../lib/print";

const ROSTER_COLUMNS = [
  {
    key: "student",
    header: "Student",
    cell: (student) => (
      <>
        <p className="font-semibold text-ink">{student.name}</p>
        <p className="meta">{student.student_number}</p>
      </>
    ),
  },
  { key: "status", header: "Status", cell: (student) => <StatusChip status={student.status} dot={false} /> },
  { key: "remarks", header: "Remarks", cell: (student) => <span className="text-slate-500">{student.remarks || "—"}</span> },
];

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
      columns: ["Student ID", "Student name", "Program", "Status", "Remarks"],
      rows: roster.students.map((student) => [student.student_number, student.name, student.program_code, student.status, student.remarks || ""]),
    });
  }

  const termOptions = terms.map((item) => ({ value: item.label, label: item.label }));
  const subjectOptions = subjects.map((item) => ({ value: item.id, label: `${item.code} — ${item.title}` }));
  const students = roster?.students || [];

  return (
    <div>
      <SectionTitle title="Assigned class rosters" subtitle="Review assigned subjects and students." icon={ClipboardCheck} />
      <div className="space-y-4">
        <InlineNotice tone="neutral" icon={Lock}>
          <span className="font-normal">
            Grades and subject outcomes are encoded and maintained in their authorized source systems. The Monitoring Sheet is a synchronized, read-only view.
          </span>
        </InlineNotice>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Semester">
            <Select placeholder="" options={termOptions} value={term} onChange={(e) => setTerm(e.target.value)} />
          </Field>
          <Field label="Subject">
            <Select placeholder="" options={subjectOptions} value={courseId} onChange={(e) => setCourseId(e.target.value)} />
          </Field>
        </div>
        <DataTable
          caption="Students in the selected class"
          columns={ROSTER_COLUMNS}
          rows={students}
          rowKey="student_id"
          pageSize={0}
          minWidth="md"
          empty={{ icon: ClipboardCheck, title: "No students in this class", hint: "The Academic Coordinator must add students through Enrollment first." }}
        />
        {students.length > 0 && (
          <div>
            <Button variant="secondary" icon={Printer} onClick={printRoster}>Print roster</Button>
          </div>
        )}
        {notice && <InlineNotice tone="danger">{notice}</InlineNotice>}
      </div>
    </div>
  );
}
