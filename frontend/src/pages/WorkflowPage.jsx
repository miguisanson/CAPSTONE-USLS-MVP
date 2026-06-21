import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import {
  UserPlus,
  CalendarOff,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  Users,
  CalendarCheck,
  Briefcase,
  GraduationCap,
  LogOut,
  CheckCircle2,
  Info,
  Sparkles,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  Table2,
  GitMerge,
  X,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserRoundCheck,
  Trash2,
  Eye,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, ErrorNote } from "../components/ui";
import { Field, Input, Textarea, Select, CheckList, RadioRow } from "../components/forms";
import StudentPicker from "../components/StudentPicker";
import { formatDate } from "../lib/format";

const ICONS = {
  "student-handoff": UserPlus,
  "leave-of-absence": CalendarOff,
  readmission: UserCheck,
  "course-audit": ClipboardCheck,
  "research-gate": FileCheck,
  "panel-matching": Users,
  "defense-scheduling": CalendarCheck,
  practicum: Briefcase,
  withdrawal: LogOut,
  graduation: GraduationCap,
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "leave-of-absence": true,
  readmission: true,
  "course-audit": false,
  "research-gate": true,
  "panel-matching": true,
  "defense-scheduling": true,
  practicum: false,
  withdrawal: false,
  graduation: false,
};

export default function WorkflowPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(() => {
    const value = searchParams.get("student_id") || window.localStorage.getItem("workflowStudentId");
    return value ? Number(value) : null;
  });
  const [studentLabel, setStudentLabel] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Keep the same student while staff move through research gate, panel
  // matching, and scheduling. The query string also makes the view shareable.
  useEffect(() => {
    setSpecialization("");
    setResult(null);
    setSubmitError("");
  }, [slug]);

  useEffect(() => {
    if (studentId) {
      window.localStorage.setItem("workflowStudentId", String(studentId));
      if (searchParams.get("student_id") !== String(studentId)) {
        const next = new URLSearchParams(searchParams);
        next.set("student_id", String(studentId));
        setSearchParams(next, { replace: true });
      }
    }
  }, [studentId, searchParams, setSearchParams]);

  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext(slug, { student_id: studentId, specialization }),
    [slug, studentId, specialization]
  );

  const tx = context?.transaction || meta?.transactions?.find((t) => t.slug === slug);
  const Icon = ICONS[slug] || FileCheck;
  const needsStudent = NEEDS_STUDENT[slug];

  useEffect(() => {
    if (!studentLabel && context?.selected_student?.search_label) {
      setStudentLabel(context.selected_student.search_label);
    }
  }, [context, studentLabel]);

  async function submit(payload) {
    setSubmitting(true);
    setSubmitError("");
    setResult(null);
    try {
      const res = await api.submitTransaction(slug, payload);
      setResult(res);
      refetch();
    } catch (err) {
      setSubmitError(err.message || "Could not save. Please review the form.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!tx) return <Spinner label="Loading workflow…" />;

  const formProps = {
    meta,
    context,
    studentId,
    specialization,
    setSpecialization,
    submit,
    submitting,
  };

  return (
    <div className="space-y-5 animate-fade-up">
      {/* Header */}
      <Card className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-600 text-white">
            <Icon className="h-6 w-6" />
          </span>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-semibold text-ink">{tx.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{tx.short}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Who uses it · </span>
                {tx.actor}
              </p>
              <p>
                <span className="font-bold uppercase tracking-wide text-slate-400">Data captured · </span>
                {tx.data}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {result && (
        <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800 animate-fade-up">
          <CheckCircle2 className="h-5 w-5" /> {result.message}
        </div>
      )}
      <ErrorNote message={submitError} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {needsStudent && (
            <Card className="p-6">
              <SectionTitle title="Choose a student" subtitle="Pick the record this action applies to" icon={Users} />
              <StudentPicker
                value={studentId}
                selectedLabel={studentLabel}
                meta={meta}
                onChange={(id, label) => {
                  setStudentId(id);
                  setStudentLabel(label || "");
                  setResult(null);
                  if (!id) {
                    window.localStorage.removeItem("workflowStudentId");
                    const next = new URLSearchParams(searchParams);
                    next.delete("student_id");
                    setSearchParams(next, { replace: true });
                  }
                }}
              />
            </Card>
          )}

          {needsStudent && !studentId ? (
            <Card className="p-6">
              <EmptyState icon={Info} title="Select a student to begin" hint="Search above to load this student's current monitoring data." />
            </Card>
          ) : loading ? (
            <Card className="p-6">
              <Spinner label="Loading workflow data…" />
            </Card>
          ) : error ? (
            <Card className="p-6">
              <EmptyState icon={AlertTriangle} title="Could not load workflow" hint={error} />
            </Card>
          ) : (
            <Card className="p-6">
              {slug === "student-handoff" && <HandoffPanel {...formProps} />}
              {slug === "course-audit" && <CourseAuditPanel meta={meta} />}
              {slug === "research-gate" && <ResearchGateForm {...formProps} />}
              {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
              {slug === "defense-scheduling" && <DefenseSchedulingForm {...formProps} />}
              {slug === "practicum" && <PracticumRoster {...formProps} />}
              {slug === "withdrawal" && <WithdrawalRoster {...formProps} />}
              {slug === "graduation" && <GraduationRoster {...formProps} />}
              {slug === "leave-of-absence" && <LeaveOfAbsenceForm {...formProps} />}
              {slug === "readmission" && <ReadmissionForm {...formProps} />}
            </Card>
          )}
        </div>

        {/* Side rail */}
        <div className="space-y-5">
          <Card className="p-6">
            <SectionTitle title="How this works" icon={Sparkles} />
            <p className="text-sm leading-relaxed text-slate-600">{workflowGuidance(slug)}</p>
          </Card>
          <Card className="p-6">
            <SectionTitle title="Recent in this workflow" icon={Info} />
            {context?.recent_logs?.length ? (
              <ul className="space-y-3">
                {context.recent_logs.map((log) => (
                  <li key={log.id} className="rounded-xl border border-slate-100 p-3">
                    <p className="text-sm font-semibold text-ink">{log.result}</p>
                    <p className="text-xs text-slate-500">
                      {log.student_name || log.source_reference || "Workflow"} · {formatDate(log.created_at)}
                    </p>
                    {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No recent actions" />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function SubmitButton({ submitting, children }) {
  return (
    <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
      {submitting ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…
        </>
      ) : (
        children
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — file upload (primary) with a manual fallback
// ---------------------------------------------------------------------------
function HandoffPanel(props) {
  return (
    <div className="space-y-6">
      <HandoffImport />
      <div className="border-t border-slate-200 pt-6">
        <HandoffForm {...props} />
      </div>
    </div>
  );
}

function HandoffImport({ context }) {
  const isAudit = context === "audit";
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [resetting, setResetting] = useState(false);

  async function resetUploaded() {
    if (!window.confirm("Remove all students/subjects that were brought in by sheet uploads? Seeded demo students are kept.")) return;
    setResetting(true);
    setError("");
    setResult(null);
    try {
      const res = await api.resetUploadedData();
      setResult({ ...res, sample: [] });
    } catch (e) {
      setError(e.message);
    } finally {
      setResetting(false);
    }
  }

  function pick(f) {
    if (!f) return;
    if (!/\.(xlsx|xlsm)$/i.test(f.name)) {
      setError("Please choose an Excel .xlsx file in the AC Student Monitoring format.");
      return;
    }
    setError("");
    setResult(null);
    setFile(f);
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.importHandoff(file);
      setResult(res);
      setFile(null);
    } catch (err) {
      setError(err.message || "Could not import the file.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title={isAudit ? "Update audits from monitoring sheet" : "Import from monitoring sheet"}
        subtitle={
          isAudit
            ? "Upload the latest AC Student Monitoring sheet — each student's completed subjects are updated from it"
            : "Upload the AC Student Monitoring Excel file — students, programs, and course audits are created automatically"
        }
        icon={FileSpreadsheet}
        action={
          <Link to="/monitoring-sheet" className="btn-ghost shrink-0">
            <Table2 className="h-4 w-4" /> Full sheet
          </Link>
        }
      />

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          pick(e.dataTransfer.files?.[0]);
        }}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-slate-50/60"
        }`}
      >
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-100 text-brand-700">
          <UploadCloud className="h-6 w-6" />
        </span>
        {file ? (
          <div className="flex items-center justify-center gap-2 text-sm">
            <FileSpreadsheet className="h-4 w-4 text-brand-600" />
            <span className="font-semibold text-ink">{file.name}</span>
            <button
              type="button"
              onClick={() => setFile(null)}
              className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-slate-600 cursor-pointer"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold text-ink">Drag &amp; drop your .xlsx here</p>
            <p className="text-xs text-slate-500">or</p>
          </>
        )}
        <label className="mt-3 inline-block">
          <input
            type="file"
            accept=".xlsx,.xlsm"
            className="hidden"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <span className="btn-ghost cursor-pointer">{file ? "Choose a different file" : "Browse files"}</span>
        </label>
        <p className="mt-3 text-xs text-slate-400">
          Expected format: AC Student Monitoring template — program in cell A1, one student per row.
        </p>
      </div>

      <ErrorNote message={error} />

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={runImport} disabled={!file || busy} className="btn-primary w-full sm:w-auto">
          {busy ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Importing…
            </>
          ) : (
            <>
              <UploadCloud className="h-4 w-4" /> {isAudit ? "Update audits" : "Import students"}
            </>
          )}
        </button>
        <button type="button" onClick={resetUploaded} disabled={resetting || busy} className="btn-ghost text-red-600">
          {resetting ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-200 border-t-red-500" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          Reset uploaded data
        </button>
      </div>
      <p className="text-xs text-slate-400">
        “Reset uploaded data” removes students/subjects added by sheet uploads so you can re-test the import. Seeded demo students are kept.
      </p>

      {result && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 animate-fade-up">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {result.message}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <ResultStat label="New" value={result.created} />
            <ResultStat label="Skipped" value={result.skipped ?? result.updated ?? 0} />
            <ResultStat label="Cell changes" value={result.subject_changes ?? 0} />
            <ResultStat label="Conflicts" value={result.conflict_count ?? 0} />
            <ResultStat label="Subjects" value={result.subjects} />
            <ResultStat label="Program" value={result.program} />
          </div>
          {result.program_id && (
            <div className="flex flex-wrap gap-2">
              <Link to={`/monitoring-sheet?program_id=${result.program_id}`} className="btn-primary">
                <Table2 className="h-4 w-4" /> Open Monitoring Sheet
              </Link>
              <Link to="/students" className="btn-ghost">
                <Users className="h-4 w-4" /> View Students
              </Link>
            </div>
          )}
          {result.duplicates?.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                Already in the system
              </p>
              <p className="mb-2 text-sm font-medium text-slate-600">
                These students were already added, so they were not imported again.
              </p>
              <ul className="space-y-2">
                {result.duplicates.slice(0, 8).map((d) => (
                  <li key={`${d.incoming_student_number}-${d.matched_student.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{d.incoming_name || d.matched_student.name} · {d.incoming_student_number}</p>
                    <p className="text-xs text-slate-500">
                      Student is in the system as {d.matched_student.name} · {d.matched_student.student_number}.
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
              {result.conflicts?.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
                    <AlertTriangle className="h-4 w-4" /> Conflicting duplicate data
                  </p>
                  <p className="mb-2 text-sm font-medium text-amber-800">
                    These students appear to already be in the system, but the uploaded sheet has conflicting data. Please verify before changing their records.
                  </p>
                  <ul className="space-y-2">
                {result.conflicts.slice(0, 5).map((c) => (
                  <li key={`${c.incoming_student_number}-${c.matched_student.id}`} className="rounded-lg bg-white px-3 py-2 text-sm">
                    <p className="font-semibold text-ink">{c.incoming_name || "Unnamed student"} · {c.incoming_student_number}</p>
                    <p className="text-xs text-slate-500">
                      Possible match: {c.matched_student.name} · {c.matched_student.student_number}. Verify first; existing profile values are kept unless overwrite is selected.
                    </p>
                  </li>
                ))}
              </ul>
              <Link to="/students" className="btn-ghost mt-3">
                <GitMerge className="h-4 w-4" /> Open duplicate review
              </Link>
            </div>
          )}
          {result.sample?.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {isAudit ? "Updated students (sample)" : "Imported students (sample)"}
              </p>
              <ul className="divide-y divide-slate-100">
                {result.sample.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-slate-400">
                        {s.student_number} · {s.program_code} · {s.stage} · {s.completed}/{s.total_subjects} subjects
                      </p>
                    </div>
                    <Link
                      to={`/students/${s.id}`}
                      className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
                    >
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white p-3 text-center ring-1 ring-slate-100">
      <p className="font-display text-xl font-semibold leading-none text-ink">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Student Handoff — manual entry (fallback)
// ---------------------------------------------------------------------------
function HandoffForm({ meta, context, submit, submitting }) {
  const onboarding = context.onboarding_requirements || [];
  const [received, setReceived] = useState(onboarding);
  const [form, setForm] = useState({
    program_id: "",
    term_id: "",
    admission_signal: "Admission Confirmed",
    first_name: "",
    last_name: "",
    student_number: "",
    email: "",
    entry_year: new Date().getFullYear(),
    additional_missing_items: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setReceived((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  function onSubmit(e) {
    e.preventDefault();
    submit({ ...form, onboarding_items: received });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Or add a student manually" subtitle="One-off entry — compares received onboarding items against requirements" icon={UserPlus} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="First name" required>
          <Input value={form.first_name} onChange={set("first_name")} required />
        </Field>
        <Field label="Last name" required>
          <Input value={form.last_name} onChange={set("last_name")} required />
        </Field>
        <Field label="Program" required>
          <Select
            value={form.program_id}
            onChange={set("program_id")}
            required
            options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </Field>
        <Field label="Entry term" required>
          <Select value={form.term_id} onChange={set("term_id")} required options={(meta?.terms || []).map((t) => ({ value: t.id, label: t.label }))} />
        </Field>
        <Field label="Admission / enrollment signal" required>
          <Select
            value={form.admission_signal}
            onChange={set("admission_signal")}
            placeholder=""
            options={["Admission Confirmed", "Enrollment Confirmed", "For Completion"]}
          />
        </Field>
        <Field label="Entry year">
          <Input type="number" value={form.entry_year} onChange={set("entry_year")} />
        </Field>
        <Field label="Student number" hint="Leave blank to auto-generate">
          <Input value={form.student_number} onChange={set("student_number")} placeholder="2026-0001" />
        </Field>
        <Field label="Email" hint="Leave blank to auto-generate">
          <Input type="email" value={form.email} onChange={set("email")} />
        </Field>
      </div>

      <Field label="Onboarding items received" hint="Tick what arrived from the institutional handoff. Unticked items are recorded as missing.">
        <CheckList items={onboarding} selected={received} onToggle={toggle} />
      </Field>

      <Field label="Other missing items" hint="Comma- or line-separated, optional">
        <Textarea value={form.additional_missing_items} onChange={set("additional_missing_items")} />
      </Field>
      <Field label="Source reference" hint="e.g. AIMS batch, email subject">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>

      <SubmitButton submitting={submitting}>Create monitoring record</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Course Audit — roster (by subject) or sheet upload
// ---------------------------------------------------------------------------
function CourseAuditPanel({ meta }) {
  return (
    <div className="space-y-6">
      <HandoffImport context="audit" />
      <div className="border-t border-slate-200 pt-6">
        <CourseAuditRoster meta={meta} />
      </div>
    </div>
  );
}

function CourseAuditRoster({ meta }) {
  const [programId, setProgramId] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [courseId, setCourseId] = useState("");
  const [term, setTerm] = useState("");
  const [roster, setRoster] = useState(null);
  const [checked, setChecked] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  // load subjects (optionally filtered by program)
  useEffect(() => {
    setSubjects([]);
    setCourseId("");
    setRoster(null);
    api
      .courseAuditSubjects(programId || undefined)
      .then((res) => setSubjects(res.items))
      .catch((e) => setError(e.message));
  }, [programId]);

  // load roster when a subject is chosen
  useEffect(() => {
    if (!courseId) {
      setRoster(null);
      return;
    }
    setLoading(true);
    setResult(null);
    api
      .courseAuditRoster(courseId)
      .then((res) => {
        setRoster(res);
        setChecked(Object.fromEntries(res.students.map((s) => [s.student_id, s.completed])));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [courseId]);

  const completedCount = roster ? Object.values(checked).filter(Boolean).length : 0;
  const allChecked = roster && roster.students.length > 0 && completedCount === roster.students.length;

  function toggle(id) {
    setChecked((c) => ({ ...c, [id]: !c[id] }));
  }
  function toggleAll() {
    if (!roster) return;
    const next = !allChecked;
    setChecked(Object.fromEntries(roster.students.map((s) => [s.student_id, next])));
  }

  async function save() {
    if (!roster) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.saveCourseAudit({ course_id: roster.course.id, term, completions: checked });
      setResult(res);
      // refresh roster to reflect new statuses
      const fresh = await api.courseAuditRoster(roster.course.id);
      setRoster(fresh);
      setChecked(Object.fromEntries(fresh.students.map((s) => [s.student_id, s.completed])));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionTitle
        title="End-of-term course audit"
        subtitle="Pick a subject, then tick the students who completed it this term"
        icon={ClipboardCheck}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Program">
          <Select
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
            placeholder="All programs"
            options={(meta?.programs || []).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))}
          />
        </Field>
        <Field label="Subject" required>
          <Select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            options={subjects.map((s) => ({ value: s.id, label: `${s.code} — ${s.title} (${s.completed}/${s.enrolled})` }))}
          />
        </Field>
        <Field label="Audit term" hint="Recorded on each updated subject">
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="AY 2025-2026 Term 1" />
        </Field>
      </div>

      <ErrorNote message={error} />

      {result && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5" /> {result.message}
        </div>
      )}

      {loading ? (
        <Spinner label="Loading class roster…" />
      ) : !courseId ? (
        <EmptyState icon={ClipboardCheck} title="Choose a subject to audit" hint="Pick a subject above to see its enrolled students." />
      ) : roster && roster.students.length > 0 ? (
        <>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
              <p className="text-sm font-semibold text-ink">
                {roster.course.code} — {roster.course.title}
              </p>
              <p className="text-xs text-slate-500">
                {completedCount} of {roster.students.length} marked completed
              </p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-3 py-2.5">Current</th>
                  <th className="px-3 py-2.5 text-center">
                    <label className="inline-flex cursor-pointer items-center gap-1.5">
                      <input type="checkbox" checked={allChecked} onChange={toggleAll} className="h-4 w-4 accent-brand-600 cursor-pointer" />
                      <span>Completed</span>
                    </label>
                  </th>
                </tr>
              </thead>
              <tbody>
                {roster.students.map((s) => (
                  <tr key={s.student_id} className="border-b border-slate-50 hover:bg-brand-50/40">
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-ink">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.student_number} · {s.program_code}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge value={s.status} dot={false} />
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <input
                        type="checkbox"
                        checked={!!checked[s.student_id]}
                        onChange={() => toggle(s.student_id)}
                        aria-label={`Mark ${s.name} completed`}
                        className="h-5 w-5 accent-brand-600 cursor-pointer"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={save} disabled={saving} className="btn-primary w-full sm:w-auto">
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Saving…
              </>
            ) : (
              "Save audit"
            )}
          </button>
        </>
      ) : (
        <EmptyState icon={ClipboardCheck} title="No students enrolled in this subject" />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Course Audit (legacy single-student form — retained but unused)
// ---------------------------------------------------------------------------
function CourseAuditForm({ context, studentId, submit, submitting }) {
  const audit = context.course_audit;
  const [form, setForm] = useState({ course_id: "", status: "Completed", term_label: "", evidence_reference: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (panel.length === 0) {
    return (
      <div className="py-6">
        <EmptyState icon={CalendarCheck} title="Panel matching is required" hint="The calendar stays empty until this student has an assigned panel. This prevents schedules from being created against the wrong or incomplete participant list." />
        <div className="mt-4 flex justify-center">
          <Link to={`/workflow/panel-matching?student_id=${studentId}`} className="btn-primary">
            Open Panel Matching <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Update course audit" subtitle="Map a subject's status against curriculum requirements" icon={ClipboardCheck} />
      {audit && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniBox label="Completed" value={audit.completed.length} tone="brand" />
          <MiniBox label="Current" value={audit.current.length} tone="blue" />
          <MiniBox label="Incomplete" value={audit.incomplete.length} tone="amber" />
          <MiniBox label="Missing" value={audit.missing.length} tone="red" />
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Subject" required>
          <Select
            value={form.course_id}
            onChange={set("course_id")}
            required
            options={(context.courses || []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))}
          />
        </Field>
        <Field label="Status" required>
          <Select value={form.status} onChange={set("status")} placeholder="" options={["Completed", "Current", "Missing", "Incomplete", "Dropped"]} />
        </Field>
        <Field label="AY / Term taken">
          <Input value={form.term_label} onChange={set("term_label")} placeholder="AY 2025-2026 Term 1" />
        </Field>
        <Field label="Evidence reference">
          <Input value={form.evidence_reference} onChange={set("evidence_reference")} placeholder="Monitoring sheet row / grade slip" />
        </Field>
      </div>
      <SubmitButton submitting={submitting}>Save audit update</SubmitButton>

      {context.offering_demand?.length > 0 && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Subject demand (offerings planning)</p>
          <ul className="space-y-1.5">
            {context.offering_demand.slice(0, 6).map((row) => (
              <li key={row.code} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">
                  <span className="font-semibold">{row.code}</span> · {row.title}
                </span>
                <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-slate-600 ring-1 ring-slate-200">{row.count} students</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// Research Gate
// ---------------------------------------------------------------------------
const GATES = ["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"];

function ResearchGateForm({ context, studentId, submit, submitting }) {
  const [gate, setGate] = useState(GATES[0]);
  const required = context.gate_requirements?.[gate] || [];
  const [form, setForm] = useState({ research_title: "", revision_required: "no" });
  const set = (key) => (e) => setForm((current) => ({ ...current, [key]: e.target.value }));
  const evidenceByItem = new Map(
    (context.documents_by_gate?.[gate] || []).map((doc) => [doc.item_name, doc])
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      research_title: context.research_case?.title || "",
    }));
  }, [studentId, context.research_case?.title]);

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: studentId,
      gate,
      revision_required: form.revision_required,
      research_title: form.research_title,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Check research readiness" subtitle="Evidence status comes from PDFs uploaded by the student" icon={FileCheck} />
      <Field label="Gate / milestone" required>
        <Select value={gate} onChange={(e) => setGate(e.target.value)} placeholder="" options={GATES} />
      </Field>
      <Field label="Research title" hint="Sets or updates the research case title">
        <Input value={form.research_title} onChange={set("research_title")} />
      </Field>
      <Field label="Student-uploaded evidence" hint="Read-only for staff. Missing evidence must be uploaded through the student portal.">
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {required.map((item) => {
            const doc = evidenceByItem.get(item);
            const needed = item === "Three concept papers" ? 3 : 1;
            const count = doc?.file_count || 0;
            const received = count >= needed;
            return (
              <div key={item} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{item}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{count} of {needed} required file{needed > 1 ? "s" : ""} uploaded</p>
                  </div>
                  <StatusBadge value={received ? "Submitted" : "Missing"} dot={false} />
                </div>
                {doc?.files?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.files.map((file) => (
                      <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-slate-200 hover:bg-brand-50">
                        {file.name}<ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Field>
      <Field label="Adviser flagged revisions?">
        <RadioRow value={form.revision_required} onChange={(v) => setForm((f) => ({ ...f, revision_required: v }))} options={[{ value: "no", label: "No revisions" }, { value: "yes", label: "Revisions required" }]} />
      </Field>
      <SubmitButton submitting={submitting}>Evaluate gate</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Panel Matching
// ---------------------------------------------------------------------------
function PanelMatchingForm({ context, studentId, specialization, setSpecialization, submit, submitting }) {
  const [text, setText] = useState(specialization);
  const roles = context.panel_roles || [];
  const profile = context.matching_profile || {};
  const recs = profile.ready ? context.panel_recommendations || [] : [];
  const visibleRecommendations = recs.slice(0, Math.max(4, roles.length || 0));

  useEffect(() => setText(""), [studentId]);

  function onSubmit(e) {
    e.preventDefault();
    if (!profile.ready) return;
    submit({ student_id: studentId, specialization: text });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Match a panel" subtitle="Analyzes the uploaded concept papers, extracts research keywords, then suggests the best-fit panelists" icon={Users} action={<Link to="/faculty" className="btn-ghost"><Users className="h-4 w-4" /> Faculty profiles</Link>} />
      <div className={`rounded-xl border px-4 py-3 ${profile.ready ? "border-brand-200 bg-brand-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${profile.ready ? "text-brand-800" : "text-amber-900"}`}>
              {profile.ready ? "Concept-paper retrieval ready" : "Three concept papers are required"}
            </p>
            <p className={`mt-1 text-xs ${profile.ready ? "text-brand-700" : "text-amber-800"}`}>
              {profile.concept_paper_count || 0} of 3 concept-paper PDFs uploaded. Source: {profile.source || "No research evidence yet"}.
            </p>
          </div>
          <StatusBadge value={profile.ready ? "Ready" : "Blocked"} dot={false} />
        </div>
        {profile.research_title && <p className="mt-3 text-sm font-medium text-slate-700">{profile.research_title}</p>}
        {profile.keywords?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {profile.keywords.map((keyword) => <span key={keyword} className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{keyword}</span>)}
          </div>
        )}
        {profile.concept_papers?.length > 0 && (
          <div className="mt-4 grid gap-2">
            {profile.concept_papers.slice(0, 3).map((paper) => (
              <div key={paper.id} className="rounded-lg bg-white p-3 text-xs ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={paper.url} target="_blank" rel="noreferrer" className="font-semibold text-ink hover:text-brand-700">{paper.name}</a>
                  <StatusBadge value={paper.extracted ? "Text extracted" : "Filename fallback"} dot={false} />
                </div>
                {paper.keywords?.length > 0 && (
                  <p className="mt-2 text-slate-500">Analyzed terms: {paper.keywords.slice(0, 5).join(", ")}</p>
                )}
                {paper.excerpt && <p className="mt-2 leading-relaxed text-slate-500">{paper.excerpt}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Additional specialization terms" hint={`${context.research_case_type || "Thesis"} panel needs ${roles.length} members: ${roles.join(", ")}`}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Optional terms to refine the paper-derived query" />
          </Field>
        </div>
        <button type="button" disabled={!profile.ready} onClick={() => setSpecialization(text)} className="btn-ghost mb-0.5">
          Preview matches
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Faculty</th>
              <th className="px-3 py-2.5">Specialization</th>
              <th className="px-3 py-2.5">Paper match</th>
              <th className="px-3 py-2.5 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {visibleRecommendations.map((r, i) => (
              <tr key={r.faculty_id} className={i < roles.length ? "bg-brand-50/40" : ""}>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-ink">{r.faculty_name}</p>
                  <p className="text-xs text-slate-400">{r.note}</p>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{r.specialization}</td>
                <td className="px-3 py-2.5 text-slate-600">{r.matched_keywords?.length ? r.matched_keywords.slice(0, 3).join(", ") : "Profile fit"}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{r.score}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">The first 4 rows are the strongest concept-paper specialization fits. Highlighted rows are assigned to the required panel roles.</p>
      <button type="submit" disabled={submitting || !profile.ready} className="btn-primary w-full sm:w-auto">
        {submitting ? "Saving..." : "Assign recommended panel"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Defense Scheduling
// ---------------------------------------------------------------------------
function DefenseSchedulingForm({ context, studentId, submit, submitting }) {
  const availability = context.availability || {};
  const participants = availability.participants || [];
  const possibleSlots = availability.possible_slots || [];
  const schedules = context.schedules || [];
  const [form, setForm] = useState({
    preferred_date: "",
    selected_start: "",
    selected_end: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
  });
  const [window, setWindow] = useState({ start: "", end: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const panel = context.assigned_panel || [];

  useEffect(() => {
    setWindow({
      start: availability.window_start || "",
      end: availability.window_end || "",
    });
    setForm((current) => ({
      ...current,
      preferred_date: "",
      selected_start: "",
      selected_end: "",
    }));
  }, [studentId, availability.window_start, availability.window_end]);

  const filteredSlots = useMemo(
    () =>
      possibleSlots.filter(
        (slot) =>
          (!window.start || slot.date >= window.start) &&
          (!window.end || slot.date <= window.end)
      ),
    [possibleSlots, window]
  );

  const visibleDates = useMemo(() => {
    const recordedDates = new Set();
    participants.forEach((participant) => {
      participant.slots.forEach((slot) => {
        recordedDates.add(slot.date);
      });
    });
    if (!window.start || !window.end) return [...recordedDates].sort().slice(0, 14);
    const dates = [];
    const cursor = new Date(`${window.start}T00:00:00`);
    const end = new Date(`${window.end}T00:00:00`);
    while (cursor <= end && dates.length < 14) {
      const isoDate = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const weekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      if (!weekend || recordedDates.has(isoDate)) dates.push(isoDate);
      cursor.setDate(cursor.getDate() + 1);
    }
    return dates;
  }, [participants, window]);

  const possibleDates = useMemo(
    () => new Set(filteredSlots.map((slot) => slot.date)),
    [filteredSlots]
  );

  function chooseSlot(slot) {
    setForm((current) => ({
      ...current,
      preferred_date: slot.date,
      selected_start: slot.start,
      selected_end: slot.end,
    }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle
        title="Coordinate the defense schedule"
        subtitle="Compare faculty availability in a date spread, then select a shared time"
        icon={CalendarCheck}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
        <span>Monday-Friday use faculty working hours, then Google Calendar busy times are removed for connected panelists.</span>
        <Link to="/faculty" className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-800">View faculty profiles <ArrowUpRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-xs text-blue-800">
        <FileCheck className="h-4 w-4" />
        <span className="font-semibold">Defense readiness:</span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-blue-100">Form 4 endorsement</span>
        <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-blue-100">Form 4.3 for public defense, when applicable</span>
      </div>
      <AvailabilityWorkspace
        availability={availability}
        participants={participants}
        filteredSlots={filteredSlots}
        visibleDates={visibleDates}
        possibleDates={possibleDates}
        window={window}
        setWindow={setWindow}
        form={form}
        chooseSlot={chooseSlot}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Selected date" required>
          <Input type="date" value={form.preferred_date} readOnly required />
        </Field>
        <Field label="Defense type" required>
          <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={["Title Defense", "Proposal Defense", "Final Defense", "Public Final Defense"]} />
        </Field>
        <Field label="Mode" required>
          <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
        </Field>
        <Field label="Venue / meeting link">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <Input className="pl-9" value={form.venue} onChange={set("venue")} placeholder="GS Conference Room / Zoom link" />
          </div>
        </Field>
      </div>
      <Field label="Scheduling constraints">
        <Textarea value={form.constraints} onChange={set("constraints")} placeholder="e.g. external panel only available afternoons" />
      </Field>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <button type="submit" disabled={submitting || !form.preferred_date} className="btn-primary w-full sm:w-auto">
        {submitting ? "Saving..." : schedules.length ? "Confirm revised schedule" : "Confirm proposed schedule"}
      </button>
      {schedules.length > 0 && <ScheduleHistory schedules={schedules} />}
    </form>
  );
}

function AvailabilityWorkspace({
  availability,
  participants,
  filteredSlots,
  visibleDates,
  possibleDates,
  window,
  setWindow,
  form,
  chooseSlot,
}) {
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Preferred date window</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The system searches for a {availability.duration_minutes || 120}-minute overlap.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
            <Field label="From">
              <Input
                type="date"
                value={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, start: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={window.end}
                min={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, end: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </div>

      {participants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Panel availability</p>
              <p className="text-xs text-slate-500">Green rows contain at least one complete overlap.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {participants.length} participants
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  {participants.map((participant) => (
                    <th key={participant.faculty_id} className="min-w-44 border-b border-slate-200 px-3 py-3">
                      <p className="font-semibold text-ink">{participant.name}</p>
                      <p className="mt-0.5 text-xs font-normal text-slate-500">{participant.role}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        participant.calendar_connected
                          ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                          : "bg-slate-100 text-slate-500"
                      }`}>
                        {participant.calendar_connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {participant.calendar_status || (participant.calendar_connected ? "Google checked" : "Profile only")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDates.map((day) => {
                  const hasOverlap = possibleDates.has(day);
                  return (
                    <tr key={day} className={hasOverlap ? "bg-brand-50/55" : "bg-white"}>
                      <td className={`sticky left-0 z-10 border-r border-t border-slate-200 px-3 py-3 ${hasOverlap ? "bg-brand-50" : "bg-white"}`}>
                        <p className="font-semibold text-ink">{shortDate(day)}</p>
                        {hasOverlap && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">Overlap found</p>}
                      </td>
                      {participants.map((participant) => {
                        const slots = participant.slots.filter((slot) => slot.date === day);
                        const busy = (participant.google_busy || []).filter((slot) => slot.date === day);
                        return (
                          <td key={participant.faculty_id} className="border-t border-slate-200 px-3 py-3 align-top">
                            {slots.length || busy.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {slots.map((slot) => (
                                  <span
                                    key={`${slot.start}-${slot.end}`}
                                    className={`rounded-lg px-2 py-1 text-xs font-medium ring-1 ${
                                      slot.blocked_by_google
                                        ? "bg-amber-50 text-amber-800 ring-amber-200"
                                        : "bg-white text-slate-700 ring-slate-200"
                                    }`}
                                  >
                                    {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                                {busy.map((slot) => (
                                  <span key={`busy-${slot.start}-${slot.end}`} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                                    Busy {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs font-medium text-slate-400">Unavailable</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleDates.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">No availability was recorded inside this date window.</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Best shared options</p>
            <p className="text-xs text-slate-500">Select one to prepare the proposed schedule.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filteredSlots.length} found
          </span>
        </div>
        {filteredSlots.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredSlots.slice(0, 8).map((slot, index) => {
              const selected =
                form.preferred_date === slot.date &&
                form.selected_start === slot.start &&
                form.selected_end === slot.end;
              return (
                <button
                  key={`${slot.date}-${slot.start}`}
                  type="button"
                  onClick={() => chooseSlot(slot)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {index === 0 ? "Earliest option - " : ""}{shortDate(slot.date)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> {timeRange(slot.start, slot.end)} - all {slot.matched_count} available
                    </span>
                  </span>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600 ring-2 ring-white" : "border-slate-300"}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            No complete overlap appears in this window. Revise the dates or collect updated availability from the adviser and panel.
          </div>
        )}
      </div>

      {form.preferred_date && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected proposed schedule</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-900">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" /> {shortDate(form.preferred_date)}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" /> {timeRange(form.selected_start, form.selected_end)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4" /> All participants available
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduleHistory({ schedules }) {
  return (
    <div className="border-t border-slate-200 pt-5">
      <div className="mb-3 flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-slate-500" />
        <p className="text-sm font-semibold text-ink">Scheduling and rescheduling history</p>
      </div>
      <div className="space-y-2">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">{shortDate(schedule.preferred_date)} - {schedule.mode}</p>
              <p className="mt-0.5 text-xs text-slate-500">{schedule.venue || "Arrangement pending"} - {schedule.notes}</p>
            </div>
            <StatusBadge value={schedule.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Practicum
// ---------------------------------------------------------------------------
function PracticumRoster({ context, submit, submitting }) {
  const [expanded, setExpanded] = useState(null);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.record?.status || "Not Submitted")), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.record?.practicum_site || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.record?.status || "Not Submitted") === filters.status)
      && (!filters.secondary || row.eligibility.status === filters.secondary);
  }), [rows, filters]);

  function actionFor(row) {
    const record = row.record;
    if (!record) return null;
    const base = { student_id: row.student.id };
    if (["MOA Submitted", "MOA Received"].includes(record.status)) {
      return { label: "Forward to Academic Coordinator", payload: { ...base, status: "MOA Under Review", moa_status: "Under Review" } };
    }
    if (record.status === "MOA Under Review") {
      return { label: "Mark practicum in progress", payload: { ...base, status: "Practicum In Progress", moa_status: "Verified" } };
    }
    if (["Hours Incomplete", "Documents Submitted"].includes(record.status) && row.hours_status !== "Complete") {
      return { label: "Request additional certificates", payload: { ...base, status: "Additional Certificates Requested" } };
    }
    if (["Documents Submitted", "Practicum In Progress", "Hours Incomplete"].includes(record.status) && row.hours_status === "Complete") {
      return { label: "Verify completion", payload: { ...base, status: "Completed", document_status: "Verified" } };
    }
    if (record.status === "Completed") {
      return { label: "Send status report to Dean", payload: { ...base, status: "Report Sent to Dean", document_status: "Verified" } };
    }
    return null;
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Practicum student submissions" subtitle="Eligibility is computed from progress data; student-entered MOA, documents, and hours are read-only here" icon={Briefcase} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible for Practicum", "Not Eligible"]} count={filteredRows.length} total={rows.length} />
      <WorkflowTable
        headers={["Student", "Eligibility", "MOA", "Documents", "Hours", "Coordinator", "Dean report", "Action"]}
        empty="No practicum-program students found."
        rows={filteredRows}
        render={(row) => {
          const action = actionFor(row);
          return (
            <>
              <tr key={row.student.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
                <StudentCell student={row.student} />
                <td className="px-3 py-3"><StatusBadge value={row.eligibility.status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.moa_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.documents_status} dot={false} /></td>
                <td className="px-3 py-3 text-sm text-slate-600">{row.record ? `${row.record.completed_hours}/${row.record.required_hours}` : "—"}<div className="mt-1"><StatusBadge value={row.hours_status} dot={false} /></div></td>
                <td className="px-3 py-3"><StatusBadge value={row.coordinator_review_status} dot={false} /></td>
                <td className="px-3 py-3"><StatusBadge value={row.dean_report_status} dot={false} /></td>
                <td className="px-3 py-3">
                  <div className="flex min-w-[180px] flex-col gap-2">
                    <button type="button" onClick={() => setExpanded(expanded === row.student.id ? null : row.student.id)} className="btn-ghost px-3 py-2"><Eye className="h-4 w-4" /> View details</button>
                    {action ? <button type="button" disabled={submitting} onClick={() => submit(action.payload)} className="btn-primary px-3 py-2">{action.label}</button> : <span className="text-xs text-slate-400">{row.record ? "No staff action due" : "Awaiting student submission"}</span>}
                  </div>
                </td>
              </tr>
              {expanded === row.student.id && <PracticumDetailRow row={row} colSpan={8} />}
            </>
          );
        }}
      />
    </div>
  );
}

function PracticumDetailRow({ row, colSpan }) {
  const record = row.record;
  return (
    <tr className="border-b border-brand-100 bg-brand-50/40">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Automatic eligibility</p>
            <ul className="mt-2 grid gap-1.5 text-xs text-slate-600 sm:grid-cols-2">
              {row.eligibility.checklist.map((item) => <li key={item.key} className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${item.complete ? "bg-brand-500" : "bg-red-400"}`} />{item.label}{item.required ? `: ${item.actual}/${item.required}` : ""}</li>)}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Student submission</p>
            <p className="mt-2 text-sm font-semibold text-ink">{record?.practicum_site || "No site submitted"}</p>
            <p className="mt-1 text-xs text-slate-500">Certificates: {record?.certificate_count || 0} · {record?.remarks || "No student remarks"}</p>
            <div className="mt-2 flex flex-wrap gap-2">{record?.moa_attachment && <a className="btn-ghost px-3 py-1.5" href={record.moa_attachment.url} target="_blank" rel="noreferrer">MOA <ArrowUpRight className="h-3.5 w-3.5" /></a>}{record?.certificate_attachment && <a className="btn-ghost px-3 py-1.5" href={record.certificate_attachment.url} target="_blank" rel="noreferrer">Documents <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Workflow timeline</p>
            <div className="mt-2 flex flex-wrap gap-1.5">{(record?.timeline || []).map((step) => <span key={step.label} className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${step.state === "current" ? "bg-brand-600 text-white" : step.state === "complete" ? "bg-brand-100 text-brand-700" : "bg-white text-slate-400 ring-1 ring-slate-200"}`}>{step.label}</span>)}</div>
          </div>
        </div>
      </td>
    </tr>
  );
}

function WithdrawalRoster({ context, submit, submitting }) {
  const [expanded, setExpanded] = useState(null);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((item) => item.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((item) => item.status)), [rows]);
  const filteredRows = useMemo(() => rows.filter((item) => {
    const haystack = `${item.student.name} ${item.student.student_number} ${item.student.program_code} ${item.reason || ""} ${item.effective_term || ""}`.toLowerCase();
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || item.student.program_code === filters.program)
      && (!filters.status || item.status === filters.status)
      && (!filters.secondary || item.dean_decision === filters.secondary);
  }), [rows, filters]);
  function actionFor(item) {
    const base = { student_id: item.student_id };
    if (item.dean_decision === "Pending") return { label: "Forward to Dean", payload: { ...base, dean_decision: "Pending" } };
    if (item.dean_decision === "Approved" && item.requirement_status !== "Complete") return { label: "Confirm form & proof", payload: { ...base, requirement_status: "Complete" } };
    if (item.dean_decision === "Approved" && item.fee_status !== "Cleared") return { label: "Record fee clearance", payload: { ...base, requirement_status: "Complete", fee_status: "Cleared" } };
    if (item.dean_decision === "Approved" && item.registrar_status !== "Record Updated") return { label: "Confirm Registrar update", payload: { ...base, requirement_status: "Complete", fee_status: "Cleared", registrar_status: "Record Updated" } };
    return null;
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Submitted withdrawal requests" subtitle="Withdrawal is the in-progress request; Withdrawn is applied only after requirements, fees, and Registrar update are confirmed" icon={LogOut} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Dean decision" secondaryOptions={uniqueValues(rows.map((item) => item.dean_decision))} count={filteredRows.length} total={rows.length} />
      <WorkflowTable headers={["Student", "Request date", "Effective term", "Reason", "Status", "Action"]} empty="No withdrawal requests match the selected filters." rows={filteredRows} render={(item) => {
        const action = actionFor(item);
        return <>
          <tr key={item.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
            <StudentCell student={item.student} />
            <td className="px-3 py-3 text-sm text-slate-600">{formatDate(item.created_at)}</td>
            <td className="px-3 py-3 text-sm text-slate-600">{item.effective_term || "—"}</td>
            <td className="max-w-[240px] px-3 py-3 text-sm text-slate-600"><span className="line-clamp-2">{item.reason || "No reason provided"}</span></td>
            <td className="px-3 py-3"><StatusBadge value={item.status} dot={false} /></td>
            <td className="px-3 py-3"><div className="flex min-w-[170px] flex-col gap-2"><button type="button" onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="btn-ghost px-3 py-2"><Eye className="h-4 w-4" /> View details</button>{action && <button type="button" disabled={submitting} onClick={() => submit(action.payload)} className="btn-primary px-3 py-2">{action.label}</button>}</div></td>
          </tr>
          {expanded === item.id && <tr className="border-b border-brand-100 bg-brand-50/40"><td colSpan={6} className="px-4 py-4"><div className="grid gap-3 text-sm sm:grid-cols-4"><Detail label="Dean" value={item.dean_decision} /><Detail label="Requirements" value={item.requirement_status} /><Detail label="Fee status" value={item.fee_status} /><Detail label="Registrar" value={item.registrar_status} /></div><div className="mt-3 flex flex-wrap gap-2">{item.request_attachment && <a href={item.request_attachment.url} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5">Request form <ArrowUpRight className="h-3.5 w-3.5" /></a>}{item.proof_attachment && <a href={item.proof_attachment.url} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-1.5">Proof <ArrowUpRight className="h-3.5 w-3.5" /></a>}</div></td></tr>}
        </>;
      }} />
    </div>
  );
}

function GraduationRoster({ context, submit, submitting }) {
  const [expanded, setExpanded] = useState(null);
  const rows = context.roster || [];
  const [filters, setFilters] = useState({ query: "", program: "", status: "", secondary: "" });
  const programs = useMemo(() => uniqueValues(rows.map((row) => row.student.program_code)), [rows]);
  const statuses = useMemo(() => uniqueValues(rows.map((row) => row.endorsement?.endorsement_status || "Not Prepared")), [rows]);
  const filteredRows = useMemo(() => rows.filter((row) => {
    const haystack = `${row.student.name} ${row.student.student_number} ${row.student.program_code} ${row.student.program_name}`.toLowerCase();
    const eligibility = row.eligibility.eligible ? "Eligible" : "Not Eligible";
    return (!filters.query || haystack.includes(filters.query.toLowerCase()))
      && (!filters.program || row.student.program_code === filters.program)
      && (!filters.status || (row.endorsement?.endorsement_status || "Not Prepared") === filters.status)
      && (!filters.secondary || eligibility === filters.secondary);
  }), [rows, filters]);
  function actionFor(row) {
    const status = row.endorsement?.endorsement_status;
    const base = { student_id: row.student.id, review_window: row.endorsement?.review_window || "AY 2026-2027 Graduation Review" };
    if (!row.eligibility.eligible) return { label: "Record eligibility review", payload: { ...base, endorsement_status: "For Review" } };
    if (!status || status === "Not Eligible") return { label: "Prepare endorsement list", payload: { ...base, endorsement_status: "For Review" } };
    if (["For Review", "Returned for Revision"].includes(status)) return { label: status === "Returned for Revision" ? "Resend revised list to Dean" : "Send endorsement list to Dean", payload: { ...base, endorsement_status: "Ready for Dean Review" } };
    return null;
  }
  return (
    <div className="space-y-4">
      <SectionTitle title="Graduation endorsement candidates" subtitle="Staff compiles and revises the list; only the Dean can export and hand the approved list to the Registrar" icon={GraduationCap} />
      <RosterFilters filters={filters} setFilters={setFilters} programs={programs} statuses={statuses} secondaryLabel="Eligibility" secondaryOptions={["Eligible", "Not Eligible"]} count={filteredRows.length} total={rows.length} />
      <WorkflowTable headers={["Student", "Coursework", "Missing coursework", "Research", "Missing research", "Eligibility", "Endorsement", "Action"]} empty="No graduation candidates match the selected filters." rows={filteredRows} render={(row) => {
        const endorsement = row.endorsement;
        const action = actionFor(row);
        return <>
          <tr key={row.student.id} className="border-b border-slate-100 align-top hover:bg-slate-50/70">
            <StudentCell student={row.student} />
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.coursework_status} dot={false} /></td>
            <td className="max-w-[220px] px-3 py-3 text-xs text-slate-500">{row.eligibility.missing_coursework?.slice(0, 2).join("; ") || "None"}</td>
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.research_status} dot={false} /></td>
            <td className="max-w-[220px] px-3 py-3 text-xs text-slate-500">{row.eligibility.missing_research_requirements?.slice(0, 2).join("; ") || "None"}</td>
            <td className="px-3 py-3"><StatusBadge value={row.eligibility.eligible ? "Eligible" : "Not Eligible"} dot={false} /></td>
            <td className="px-3 py-3"><StatusBadge value={endorsement?.endorsement_status || "Not Prepared"} dot={false} /></td>
            <td className="px-3 py-3"><div className="flex min-w-[175px] flex-col gap-2"><button type="button" onClick={() => setExpanded(expanded === row.student.id ? null : row.student.id)} className="btn-ghost px-3 py-2"><Eye className="h-4 w-4" /> Candidate details</button>{action && <button type="button" disabled={submitting} onClick={() => submit(action.payload)} className="btn-primary px-3 py-2">{action.label}</button>}{endorsement?.endorsement_status === "Dean Approved" && <span className="rounded-lg bg-brand-50 px-3 py-2 text-center text-xs font-semibold text-brand-700 ring-1 ring-brand-200">Awaiting Dean export</span>}</div></td>
          </tr>
          {expanded === row.student.id && <tr className="border-b border-brand-100 bg-brand-50/40"><td colSpan={8} className="px-4 py-4"><div className="grid gap-3 text-sm sm:grid-cols-4"><Detail label="Program" value={row.student.program_name} /><Detail label="Academic Coordinator" value={row.eligibility.coursework_status} /><Detail label="Research Coordinator" value={row.eligibility.research_status} /><Detail label="Dean remarks" value={endorsement?.dean_remarks || "None"} /></div></td></tr>}
        </>;
      }} />
    </div>
  );
}

function WorkflowTable({ headers, rows, render, empty }) {
  if (!rows.length) return <EmptyState title={empty} />;
  return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[980px] text-left"><thead><tr className="border-b border-slate-200 bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">{headers.map((header) => <th key={header} className="px-3 py-2.5">{header}</th>)}</tr></thead><tbody>{rows.map(render)}</tbody></table></div>;
}

function RosterFilters({ filters, setFilters, programs, statuses, secondaryLabel, secondaryOptions, count, total }) {
  const active = Object.values(filters).filter(Boolean).length;
  const update = (key) => (event) => setFilters((current) => ({ ...current, [key]: event.target.value }));
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="relative block">
          <span className="sr-only">Search list</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={filters.query} onChange={update("query")} className="field-input pl-10" placeholder="Search name, ID, program…" aria-label="Search list" />
        </label>
        <select value={filters.program} onChange={update("program")} className="field-input cursor-pointer" aria-label="Filter by program"><option value="">All programs</option>{programs.map((program) => <option key={program}>{program}</option>)}</select>
        <select value={filters.status} onChange={update("status")} className="field-input cursor-pointer" aria-label="Filter by workflow status"><option value="">All workflow statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
        <select value={filters.secondary} onChange={update("secondary")} className="field-input cursor-pointer" aria-label={`Filter by ${secondaryLabel}`}><option value="">All {secondaryLabel.toLowerCase()}</option>{secondaryOptions.map((option) => <option key={option}>{option}</option>)}</select>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Showing {count} of {total} records</span>
        {active > 0 && <button type="button" onClick={() => setFilters({ query: "", program: "", status: "", secondary: "" })} className="inline-flex cursor-pointer items-center gap-1.5 font-semibold text-brand-700 hover:text-brand-800"><SlidersHorizontal className="h-3.5 w-3.5" /> Clear {active} filter{active === 1 ? "" : "s"}</button>}
      </div>
    </div>
  );
}

function uniqueValues(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function StudentCell({ student }) {
  return <td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{student.name}</p><p className="text-xs text-slate-400">{student.student_number} · {student.program_code}</p></td>;
}

function Detail({ label, value }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 font-semibold text-slate-700">{value || "—"}</p></div>;
}

function PracticumForm({ context, studentId, submit, submitting }) {
  const selected = context.selected_student;
  const current = context.practicum_record;
  const [form, setForm] = useState({
    moa_status: "Uploaded",
    moa_uploaded: "true",
    practicum_site: "",
    required_hours: 200,
    completed_hours: 0,
    document_status: "Pending Review",
    certificate_count: 0,
    status: "Under Review",
    remarks: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      moa_status: current?.moa_status || "Uploaded",
      moa_uploaded: current?.moa_uploaded ? "true" : "true",
      practicum_site: current?.practicum_site || "",
      required_hours: current?.required_hours || 200,
      completed_hours: current?.completed_hours || 0,
      document_status: current?.document_status || "Pending Review",
      certificate_count: current?.certificate_count || 0,
      status: current?.status || "Under Review",
      remarks: current?.remarks || "",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  if (selected && !selected.program_has_practicum) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Practicum not required"
        hint={`${selected.program_code} is not marked as a practicum-required program.`}
      />
    );
  }

  const completeEnough = Number(form.completed_hours || 0) >= Number(form.required_hours || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process practicum submission" subtitle="Record MOA receipt, certificate review, hours, and Dean report status" icon={Briefcase} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">{current.practicum_site || "Practicum site not set"}</p>
              <p className="text-xs text-slate-500">{current.completed_hours}/{current.required_hours} hours · {current.certificate_count} certificate(s)</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="MOA status">
          <Select value={form.moa_status} onChange={set("moa_status")} placeholder="" options={["Uploaded", "Pending Review", "Verified", "Returned", "Missing"]} />
        </Field>
        <Field label="Practicum site / company" required>
          <Input value={form.practicum_site} onChange={set("practicum_site")} required />
        </Field>
        <Field label="Required hours" required>
          <Input type="number" min="1" value={form.required_hours} onChange={set("required_hours")} required />
        </Field>
        <Field label="Completed hours" required>
          <Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required />
        </Field>
        <Field label="Certificate/document status">
          <Select value={form.document_status} onChange={set("document_status")} placeholder="" options={["Missing", "Uploaded", "Pending Review", "Verified", "Returned"]} />
        </Field>
        <Field label="Number of certificates">
          <Input type="number" min="0" value={form.certificate_count} onChange={set("certificate_count")} />
        </Field>
        <Field label="Workflow status">
          <Select
            value={form.status}
            onChange={set("status")}
            placeholder=""
            options={["MOA Received", "Under Review", "Hours Incomplete", "Additional Certificates Requested", "Completed", "Report Sent to Dean", "Dean Reviewed"]}
          />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} placeholder="Email, drive link, or staff note" />
        </Field>
      </div>
      <Field label="Remarks">
        <Textarea value={form.remarks} onChange={set("remarks")} />
      </Field>
      {!completeEnough && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Completed hours are below the requirement. Saving will keep this case incomplete and queue the student for additional certificates.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save practicum status</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------
function WithdrawalForm({ context, studentId, submit, submitting }) {
  const current = context.withdrawal_application;
  const [form, setForm] = useState({
    reason: "",
    effective_term: "",
    fee_status: "Pending",
    requirement_status: "Pending",
    dean_decision: "Pending",
    staff_remarks: "",
    academic_coordinator_remarks: "",
    registrar_status: "Pending",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      reason: current?.reason || "",
      effective_term: current?.effective_term || "",
      fee_status: current?.fee_status || "Pending",
      requirement_status: current?.requirement_status || "Pending",
      dean_decision: current?.dean_decision || "Pending",
      staff_remarks: current?.staff_remarks || "",
      academic_coordinator_remarks: current?.academic_coordinator_remarks || "",
      registrar_status: current?.registrar_status || "Pending",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Process withdrawal application" subtitle="Record Dean decision, coordinator follow-through, requirements, fee status, and registrar confirmation" icon={LogOut} />
      {current && (
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-ink">Effective {current.effective_term || "term pending"}</p>
              <p className="text-xs text-slate-500">Dean: {current.dean_decision} · requirements: {current.requirement_status} · fees: {current.fee_status}</p>
            </div>
            <StatusBadge value={current.status} dot={false} />
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Effective term" required>
          <Input value={form.effective_term} onChange={set("effective_term")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Dean decision">
          <Select value={form.dean_decision} onChange={set("dean_decision")} placeholder="" options={["Pending", "Approved", "Denied", "Returned"]} />
        </Field>
        <Field label="Requirement status">
          <Select value={form.requirement_status} onChange={set("requirement_status")} placeholder="" options={["Pending", "Complete", "Incomplete"]} />
        </Field>
        <Field label="Fee status">
          <Select value={form.fee_status} onChange={set("fee_status")} placeholder="" options={["Pending", "Cleared", "Not Cleared"]} />
        </Field>
        <Field label="Registrar confirmation/status">
          <Select value={form.registrar_status} onChange={set("registrar_status")} placeholder="" options={["Pending", "Confirmed", "Not Cleared", "Record Updated"]} />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Reason for withdrawal">
        <Textarea value={form.reason} onChange={set("reason")} />
      </Field>
      <Field label="Academic Coordinator remarks">
        <Textarea value={form.academic_coordinator_remarks} onChange={set("academic_coordinator_remarks")} />
      </Field>
      <Field label="Staff remarks">
        <Textarea value={form.staff_remarks} onChange={set("staff_remarks")} />
      </Field>
      <SubmitButton submitting={submitting}>Save withdrawal action</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Graduation Endorsement
// ---------------------------------------------------------------------------
function GraduationForm({ context, studentId, submit, submitting }) {
  const eligibility = context.graduation_eligibility || {};
  const current = context.graduation_endorsement;
  const [form, setForm] = useState({
    review_window: "AY 2026-2027 Graduation Review",
    endorsement_status: "For Review",
    dean_remarks: "",
    registrar_status: "Pending",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    setForm({
      review_window: current?.review_window || "AY 2026-2027 Graduation Review",
      endorsement_status: current?.endorsement_status || (eligibility.eligible ? "Ready for Dean Review" : "For Review"),
      dean_remarks: current?.dean_remarks || "",
      registrar_status: current?.registrar_status || "Pending",
      source_reference: "",
    });
  }, [studentId, current?.id, current?.updated_at, eligibility.eligible]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => ({ type: "Coursework", item })),
    ...(eligibility.missing_research_requirements || []).map((item) => ({ type: "Research", item })),
    ...(eligibility.missing_practicum_requirement ? [{ type: "Practicum", item: eligibility.missing_practicum_requirement }] : []),
  ];

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Review graduation endorsement" subtitle="Monitor endorsement readiness before the official Registrar process" icon={GraduationCap} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <MiniBox label="Coursework" value={eligibility.coursework_status || "Pending"} tone={eligibility.coursework_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Research" value={eligibility.research_status || "Pending"} tone={eligibility.research_status === "Complete" ? "brand" : "amber"} />
        <MiniBox label="Practicum" value={eligibility.practicum_status || "Not Required"} tone={eligibility.practicum_status === "Not Required" || eligibility.practicum_status === "Dean Reviewed" ? "brand" : "amber"} />
        <MiniBox label="Eligible" value={eligibility.eligible ? "Yes" : "No"} tone={eligibility.eligible ? "brand" : "red"} />
      </div>
      {missing.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-900">Missing requirements</p>
          <ul className="space-y-1.5">
            {missing.slice(0, 10).map((row, index) => (
              <li key={`${row.type}-${index}`} className="flex items-start gap-2 text-sm text-amber-800">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span><span className="font-semibold">{row.type}:</span> {row.item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Review window / term" required>
          <Input value={form.review_window} onChange={set("review_window")} required />
        </Field>
        <Field label="Endorsement status">
          <Select
            value={form.endorsement_status}
            onChange={set("endorsement_status")}
            placeholder=""
            options={["For Review", "Ready for Dean Review", "Not Eligible", "Returned for Revision", "Sent to Registrar"]}
          />
        </Field>
        <Field label="Registrar handoff/status">
          <Select value={form.registrar_status} onChange={set("registrar_status")} placeholder="" options={["Pending", "Sent", "Received"]} />
        </Field>
        <Field label="Source reference">
          <Input value={form.source_reference} onChange={set("source_reference")} />
        </Field>
      </div>
      <Field label="Dean remarks">
        <Textarea value={form.dean_remarks} onChange={set("dean_remarks")} />
      </Field>
      {!eligibility.eligible && form.endorsement_status === "Ready for Dean Review" && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          This candidate still has missing requirements. Saving will keep the backend status as Not Eligible and queue the listed owner.
        </div>
      )}
      <SubmitButton submitting={submitting}>Save endorsement review</SubmitButton>
    </form>
  );
}

function shortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function timeRange(start, end) {
  const format = (value) => {
    if (!value) return "";
    const [hour, minute] = value.split(":").map(Number);
    return new Intl.DateTimeFormat("en-PH", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      timeZone: "UTC",
    }).format(new Date(Date.UTC(2026, 0, 1, hour, minute)));
  };
  return `${format(start)}-${format(end)}`;
}

// ---------------------------------------------------------------------------
// Leave of Absence
// ---------------------------------------------------------------------------
function LeaveOfAbsenceForm({ studentId, submit, submitting }) {
  const [form, setForm] = useState({
    request_date: new Date().toISOString().slice(0, 10),
    application_reference: "",
    effective_start: "",
    effective_end: "",
    reason_remarks: "",
    prior_loa_count: 0,
    eligibility_status: "Eligible",
    dean_action: "Approve",
    staff_notes: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Record leave of absence" subtitle="Records the request, Dean decision, status pause, and notice trail" icon={CalendarOff} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Application attachment / file reference">
          <Input value={form.application_reference} onChange={set("application_reference")} placeholder="Email subject, uploaded PDF, or drive link" />
        </Field>
        <Field label="Request date" required>
          <Input type="date" value={form.request_date} onChange={set("request_date")} required />
        </Field>
        <Field label="Effective start term/date">
          <Input value={form.effective_start} onChange={set("effective_start")} placeholder="AY 2026-2027 Term 1 or YYYY-MM-DD" />
        </Field>
        <Field label="Effective end term/date">
          <Input value={form.effective_end} onChange={set("effective_end")} placeholder="AY 2026-2027 Term 2 or YYYY-MM-DD" />
        </Field>
        <Field label="Prior LOA count">
          <Input type="number" min="0" value={form.prior_loa_count} onChange={set("prior_loa_count")} />
        </Field>
        <Field label="Eligibility status / check result">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>

      <Field label="Dean decision">
        <RadioRow
          value={form.dean_action}
          onChange={(v) => setForm((f) => ({ ...f, dean_action: v }))}
          options={["Approve", "Deny", "Return for Revision"]}
        />
      </Field>
      <Field label="Reason / remarks">
        <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      <Field label="Source / reference number">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Record LOA Decision</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Readmission
// ---------------------------------------------------------------------------
function ReadmissionForm({ context, studentId, submit, submitting }) {
  const requirements = context.readmission_requirements || [];
  const [items, setItems] = useState(requirements);
  const [form, setForm] = useState({
    application_reference: "",
    target_return_term: "",
    previous_loa_period: "",
    eligibility_status: "Eligible to Return",
    missing_requirements: "",
    dean_action: "Approve",
    staff_notes: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setItems((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  useEffect(() => setItems(context.readmission_requirements || []), [context.readmission_requirements]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form, readmission_items: items });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Record readmission" subtitle="Checks return eligibility, records the Dean decision, and reactivates approved students" icon={UserCheck} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Application attachment / file reference">
          <Input value={form.application_reference} onChange={set("application_reference")} placeholder="Email subject, uploaded PDF, or drive link" />
        </Field>
        <Field label="Target return term" required>
          <Input value={form.target_return_term} onChange={set("target_return_term")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Previous LOA period">
          <Input value={form.previous_loa_period} onChange={set("previous_loa_period")} placeholder="AY 2025-2026 Term 2 to AY 2026-2027 Term 1" />
        </Field>
        <Field label="Eligibility to return status">
          <Select
            value={form.eligibility_status}
            onChange={set("eligibility_status")}
            placeholder=""
            options={["Eligible to Return", "Needs Review", "Not Eligible", "Pending Requirements"]}
          />
        </Field>
      </div>
      <Field label="Eligibility to return checklist" hint="Unticked items are treated as missing requirements.">
        <CheckList items={requirements} selected={items} onToggle={toggle} />
      </Field>
      <Field label="Missing requirements / remarks">
        <Textarea value={form.missing_requirements} onChange={set("missing_requirements")} />
      </Field>
      <Field label="Dean decision">
        <RadioRow
          value={form.dean_action}
          onChange={(v) => setForm((f) => ({ ...f, dean_action: v }))}
          options={["Approve", "Deny", "Return for Revision"]}
        />
      </Field>
      <Field label="Staff notes">
        <Textarea value={form.staff_notes} onChange={set("staff_notes")} />
      </Field>
      <Field label="Source / reference number">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Record Readmission Decision</SubmitButton>
    </form>
  );
}

function MiniBox({ label, value, tone }) {
  const tones = {
    brand: "text-brand-700 bg-brand-50",
    blue: "text-blue-700 bg-blue-50",
    amber: "text-amber-700 bg-amber-50",
    red: "text-red-700 bg-red-50",
  };
  return (
    <div className={`rounded-xl p-3 ${tones[tone]}`}>
      <p className="font-display text-xl font-semibold leading-none">{value}</p>
      <p className="mt-1 text-xs font-semibold">{label}</p>
    </div>
  );
}

function workflowGuidance(slug) {
  const map = {
    "student-handoff":
      "The registrar's data arrives as a file. Upload the AC Student Monitoring sheet and the platform creates each student, their program, and their enrolled subjects automatically — no manual typing.",
    "leave-of-absence":
      "Leave of Absence is a stop/pause process. Staff record the uploaded application, check prior LOA eligibility, forward the request to the Dean, record the decision, update the student's status only when approved, and send the notice.",
    readmission:
      "Readmission is a separate return/re-entry process after the approved leave period. Staff record the request, check eligibility for the target term, route the Dean decision, reactivate approved students, and send the notice.",
    "course-audit":
      "Run at the end of the term. Pick a subject to see its enrolled students, then tick who completed it. Saving updates each student's course audit and missing count; a student who clears all subjects advances to Proposal Development.",
    "research-gate":
      "Reads the student's stored PDF evidence for the selected gate. Staff can evaluate existing files and adviser revisions, but cannot manually mark an absent document as received.",
    "panel-matching":
      "Retrieves keywords from the student's research title and three uploaded concept papers, then ranks faculty expertise with availability, college fit, and current panel load.",
    "defense-scheduling":
      "Opens only after panel matching. The date spread compares adviser and panel availability, respects weekday work hours, and shows weekends only when faculty recorded an explicit override.",
    practicum:
      "Available only for programs marked with practicum requirements. Staff record MOA receipt, review certificates and hours, request additional certificates when hours are short, and route completed reports to the Dean.",
    withdrawal:
      "Withdrawal is a lifecycle-exit process. A Dean denial keeps the student Active. An approval moves through coordinator follow-through, student requirements, fee/registrar confirmation, and only then marks the student Withdrawn.",
    graduation:
      "This is the Graduate School monitoring and endorsement layer. It checks coursework, research completion evidence, practicum when required, and pending tasks before staff send the endorsement list for Dean review and Registrar handoff.",
  };
  return map[slug] || "";
}
