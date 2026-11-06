import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, BookOpenCheck, ClipboardCheck, Table2, UserX } from "lucide-react";
import { api } from "../../api";
import { Button, DataTable, EmptyState, Field, InlineNotice, SectionTitle, Select, StatusChip } from "../../components/ui/index.js";

const ROSTER_COLUMNS = [
  { key: "name", header: "Student", cell: (s) => <Link to={`/students/${s.student_id}`} className="font-semibold text-brand-700 hover:underline">{s.name}</Link> },
  { key: "program_code", header: "Program" },
  { key: "status", header: "Status", cell: (s) => <StatusChip status={s.status} />, className: "whitespace-nowrap" },
];

const MISSING_COLUMNS = [
  { key: "name", header: "Student", cell: (s) => <span className="font-semibold">{s.name}</span> },
  { key: "count", header: "Missing", align: "right" },
  { key: "next", header: "Next subject", cell: (s) => <span>Take next: {s.next}</span> },
  { key: "open", header: "", sortable: false, cell: (s) => <Link to={`/students/${s.id}`} className="font-semibold text-brand-700 underline">Open record</Link>, className: "whitespace-nowrap" },
];

// Invert the demand list (subject -> affected students) into one row per student, subjects in code order.
function missingByStudent(demand = []) {
  const byId = new Map();
  for (const row of demand) {
    for (const st of row.affected_students || []) {
      const entry = byId.get(st.id) || { id: st.id, name: st.name, subjects: [] };
      entry.subjects.push(row.course.code);
      byId.set(st.id, entry);
    }
  }
  return [...byId.values()]
    .map((e) => { const subjects = e.subjects.sort(); return { ...e, subjects, count: subjects.length, next: subjects.slice(0, 2).join(", ") }; })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Course Audit: read-only end-of-term view (Ops Manual 4.3.8 / 4.18.4 step 3). The page card is drawn by WorkflowPage.
// ---------------------------------------------------------------------------
export function CourseAuditPanel() {
  const [subjects, setSubjects] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [roster, setRoster] = useState(null);
  const [needs, setNeeds] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.courseAuditSubjects(), api.courseAdjustments()])
      .then(([subs, adj]) => { setSubjects(subs.items || []); setNeeds(missingByStudent(adj.demand)); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!courseId) { setRoster(null); return; }
    let live = true;
    setRoster(null);
    api.courseAuditRoster(courseId).then((r) => live && setRoster(r)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [courseId]);

  const counts = useMemo(() => {
    const all = roster?.students || [];
    const done = all.filter((s) => s.completed).length;
    return `${all.length} enrolled · ${done} completed · ${all.length - done} not yet completed`;
  }, [roster]);

  if (error) return <EmptyState icon={AlertTriangle} title="Could not load the course audit" hint={error} />;

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle title="Subject roster" subtitle="Who completed the chosen subject at the end of the term." icon={ClipboardCheck} />
        <div className="max-w-md">
          <Field label="Subject">
            <Select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              aria-label="Subject"
              placeholder="Choose a subject"
              options={(subjects || []).map((c) => ({ value: c.id, label: `${c.code} - ${c.title}` }))}
            />
          </Field>
        </div>
        {courseId && (
          <div className="mt-3">
            <p className="meta mb-2" aria-live="polite">{roster ? counts : "Loading roster..."}</p>
            <DataTable caption="Subject roster" columns={ROSTER_COLUMNS} rows={roster?.students || []} rowKey="student_id" loading={!roster} minWidth="md" pageSize={0} empty={{ title: "No students on this subject" }} />
          </div>
        )}
      </section>

      <section>
        <SectionTitle title="Students with missing subjects" subtitle="Subjects each student still has to take, in code order." icon={UserX} />
        <DataTable caption="Students with missing subjects" columns={MISSING_COLUMNS} rows={needs || []} rowKey="id" loading={!needs} minWidth="md" pageSize={10} empty={{ title: "No student has missing subjects" }} />
        <p className="meta mt-2">Decide which subjects are offered on <Link to="/course-adjustments?view=adjustments" className="font-semibold text-brand-700 underline">Course Adjustments</Link>.</p>
      </section>

      <InlineNotice tone="info" title="Records are read-only">
        Completion comes from the AIMS export. To correct a record, ask the Registrar to fix it in AIMS, then import the new export.
      </InlineNotice>
      <div className="flex flex-wrap gap-2">
        <Button as={Link} to="/monitoring-sheet" variant="secondary" icon={Table2}>Open Monitoring Sheet</Button>
        <Button as={Link} to="/enrollment" variant="secondary" icon={BookOpenCheck}>Open Enrollment</Button>
      </div>
    </div>
  );
}
