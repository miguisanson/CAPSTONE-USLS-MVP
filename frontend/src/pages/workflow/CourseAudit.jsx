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
  { key: "missing_count", header: "Missing", align: "right" },
  { key: "next", header: "Next subject", sortable: false, cell: (s) => <span>Take next: {s.next_codes.join(", ")}</span> },
  { key: "open", header: "", sortable: false, cell: (s) => <Link to={`/students/${s.id}`} className="font-semibold text-brand-700 underline">Open record</Link>, className: "whitespace-nowrap" },
];

// ---------------------------------------------------------------------------
// Course Audit: read-only end-of-term view (Ops Manual 4.3.8 / 4.18.4 step 3). The page card is drawn by WorkflowPage.
// ---------------------------------------------------------------------------
export function CourseAuditPanel() {
  const [subjects, setSubjects] = useState(null);
  const [courseId, setCourseId] = useState("");
  const [roster, setRoster] = useState(null);
  const [needs, setNeeds] = useState(null);
  const [programId, setProgramId] = useState("");
  const [termLabel, setTermLabel] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.courseAuditSubjects().then((subs) => setSubjects(subs.items || [])).catch((e) => setError(e.message));
  }, []);

  // F8-02: the students with missing subjects come from the real course audit, one program at a time.
  useEffect(() => {
    let live = true;
    setNeeds((old) => (old ? { ...old, items: null } : old));
    api.courseAuditMissing(programId).then((r) => {
      if (!live) return;
      setNeeds(r);
      setTermLabel(r.term_label || "");
      if (!programId) setProgramId(String(r.program_id || ""));
    }).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [programId]);

  // F8-03: the roster is for the active term, and only students in the class (not "Missing" rows) are counted.
  useEffect(() => {
    if (!courseId || termLabel === null) { setRoster(null); return; }
    let live = true;
    setRoster(null);
    api.courseAuditRoster(courseId, termLabel).then((r) => live && setRoster(r)).catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [courseId, termLabel]);

  const counts = useMemo(() => {
    const inClass = (roster?.students || []).filter((s) => s.status !== "Missing");
    const done = inClass.filter((s) => s.completed).length;
    return `${inClass.length} in the class · ${done} completed · ${inClass.length - done} not completed yet`;
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
        <SectionTitle title="Students with missing subjects" subtitle="From each student's course audit: subjects not taken yet or failed, in curriculum order. Subjects being taken now are not missing." icon={UserX} />
        <div className="mb-3 max-w-md">
          <Field label="Program">
            <Select
              value={programId}
              onChange={(e) => setProgramId(e.target.value)}
              aria-label="Program"
              options={(needs?.programs || []).map((p) => ({ value: p.id, label: `${p.code} - ${p.name}` }))}
            />
          </Field>
        </div>
        <DataTable caption="Students with missing subjects" columns={MISSING_COLUMNS} rows={needs?.items || []} rowKey="id" loading={!needs?.items} minWidth="md" pageSize={10} empty={{ title: "No student of this program has missing subjects" }} />
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
