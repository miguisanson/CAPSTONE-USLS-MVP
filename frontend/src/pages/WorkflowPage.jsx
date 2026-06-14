import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  UserPlus,
  CalendarOff,
  UserCheck,
  ClipboardCheck,
  FileCheck,
  Users,
  CalendarCheck,
  CheckCircle2,
  Info,
  Sparkles,
  AlertTriangle,
  UploadCloud,
  FileSpreadsheet,
  X,
  ArrowUpRight,
  CalendarDays,
  Clock3,
  MapPin,
  RotateCcw,
  UserRoundCheck,
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
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "leave-of-absence": true,
  readmission: true,
  "course-audit": true,
  "research-gate": true,
  "panel-matching": true,
  "defense-scheduling": true,
};

export default function WorkflowPage() {
  const { slug } = useParams();
  const { data: meta } = useApi(() => api.meta(), []);
  const [studentId, setStudentId] = useState(null);
  const [studentLabel, setStudentLabel] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // reset selection when switching workflow
  useEffect(() => {
    setStudentId(null);
    setStudentLabel("");
    setSpecialization("");
    setResult(null);
    setSubmitError("");
  }, [slug]);

  const { data: context, loading, error, refetch } = useApi(
    () => api.transactionContext(slug, { student_id: studentId, specialization }),
    [slug, studentId, specialization]
  );

  const tx = context?.transaction || meta?.transactions?.find((t) => t.slug === slug);
  const Icon = ICONS[slug] || FileCheck;
  const needsStudent = NEEDS_STUDENT[slug];

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
              {slug === "course-audit" && <CourseAuditForm {...formProps} />}
              {slug === "research-gate" && <ResearchGateForm {...formProps} />}
              {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
              {slug === "defense-scheduling" && <DefenseSchedulingForm {...formProps} />}
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
                      {log.student_name || "—"} · {formatDate(log.created_at)}
                    </p>
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
  const [mode, setMode] = useState("upload");
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-slate-100 p-1">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
            mode === "upload" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Upload sheet
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer ${
            mode === "manual" ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Add manually
        </button>
      </div>
      {mode === "upload" ? <HandoffImport /> : <HandoffForm {...props} />}
    </div>
  );
}

function HandoffImport() {
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

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
        title="Import from monitoring sheet"
        subtitle="Upload the AC Student Monitoring Excel file — students, programs, and course audits are created automatically"
        icon={FileSpreadsheet}
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

      <button type="button" onClick={runImport} disabled={!file || busy} className="btn-primary w-full sm:w-auto">
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Importing…
          </>
        ) : (
          <>
            <UploadCloud className="h-4 w-4" /> Import students
          </>
        )}
      </button>

      {result && (
        <div className="space-y-3 rounded-2xl border border-brand-200 bg-brand-50/50 p-5 animate-fade-up">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand-800">
            <CheckCircle2 className="h-5 w-5" /> {result.message}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ResultStat label="New" value={result.created} />
            <ResultStat label="Updated" value={result.updated} />
            <ResultStat label="Subjects" value={result.subjects} />
            <ResultStat label="Program" value={result.program} />
          </div>
          {result.sample?.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Imported students (sample)</p>
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
      <SectionTitle title="Create monitoring record" subtitle="Compares received onboarding items against requirements" icon={UserPlus} />
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
// Course Audit
// ---------------------------------------------------------------------------
function CourseAuditForm({ context, studentId, submit, submitting }) {
  const audit = context.course_audit;
  const [form, setForm] = useState({ course_id: "", status: "Completed", term_label: "", evidence_reference: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
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
  const [received, setReceived] = useState(required);
  const [form, setForm] = useState({ research_title: "", revision_required: "no", submitted_package: "", source_reference: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // when gate changes, default to all items received
  useEffect(() => {
    setReceived(context.gate_requirements?.[gate] || []);
  }, [gate, context.gate_requirements]);

  const toggle = (item) => setReceived((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: studentId,
      gate,
      submitted_items: received.map((item) => `${gate}||${item}`),
      revision_required: form.revision_required,
      submitted_package: form.submitted_package,
      research_title: form.research_title,
      source_reference: form.source_reference,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Check research readiness" subtitle="Compares submitted evidence against the gate requirements" icon={FileCheck} />
      <Field label="Gate / milestone" required>
        <Select value={gate} onChange={(e) => setGate(e.target.value)} placeholder="" options={GATES} />
      </Field>
      <Field label="Research title" hint="Optional — sets or updates the research case title">
        <Input value={form.research_title} onChange={set("research_title")} />
      </Field>
      <Field label="Evidence received for this gate" hint="Tick what was submitted. Unticked items are flagged missing and routed back to the student.">
        <CheckList items={required} selected={received} onToggle={toggle} />
      </Field>
      <Field label="Submission notes / package text" hint="Free text — the system also auto-detects mentioned items here">
        <Textarea value={form.submitted_package} onChange={set("submitted_package")} />
      </Field>
      <Field label="Adviser flagged revisions?">
        <RadioRow value={form.revision_required} onChange={(v) => setForm((f) => ({ ...f, revision_required: v }))} options={[{ value: "no", label: "No revisions" }, { value: "yes", label: "Revisions required" }]} />
      </Field>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
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
  const recs = context.panel_recommendations || [];
  const roles = context.panel_roles || [];

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, specialization: text });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Match a panel" subtitle="Scores faculty by specialization, availability, college, and workload" icon={Users} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Specialization needed" hint={`${context.research_case_type || "Thesis"} panel needs ${roles.length} members: ${roles.join(", ")}`}>
            <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. analytics and information systems" />
          </Field>
        </div>
        <button type="button" onClick={() => setSpecialization(text)} className="btn-ghost mb-0.5">
          Preview matches
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2.5">Faculty</th>
              <th className="px-3 py-2.5">Specialization</th>
              <th className="px-3 py-2.5 text-right">Score</th>
            </tr>
          </thead>
          <tbody>
            {recs.slice(0, roles.length || 5).map((r, i) => (
              <tr key={r.faculty_id} className={i < roles.length ? "bg-brand-50/40" : ""}>
                <td className="px-4 py-2.5">
                  <p className="font-semibold text-ink">{r.faculty_name}</p>
                  <p className="text-xs text-slate-400">{r.note}</p>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{r.specialization}</td>
                <td className="px-3 py-2.5 text-right">
                  <span className="rounded-lg bg-brand-100 px-2 py-1 text-xs font-bold text-brand-700">{r.score}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">Highlighted rows are the recommended assignment for each required panel role.</p>
      <SubmitButton submitting={submitting}>Assign recommended panel</SubmitButton>
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
    const dates = new Set();
    participants.forEach((participant) => {
      participant.slots.forEach((slot) => {
        if (
          (!window.start || slot.date >= window.start) &&
          (!window.end || slot.date <= window.end)
        ) {
          dates.add(slot.date);
        }
      });
    });
    return [...dates].sort().slice(0, 12);
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
        subtitle="Compare database availability, select a shared time, and send the proposed schedule"
        icon={CalendarCheck}
      />
      {panel.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          No panel is assigned yet. Run Panel Matching first — scheduling needs an assigned panel to check availability.
        </div>
      )}
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
                        return (
                          <td key={participant.faculty_id} className="border-t border-slate-200 px-3 py-3 align-top">
                            {slots.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {slots.map((slot) => (
                                  <span key={`${slot.start}-${slot.end}`} className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                                    {timeRange(slot.start, slot.end)}
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
            <StatusBadge status={schedule.status} />
          </div>
        ))}
      </div>
    </div>
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
      "Records a new student from an admission or enrollment signal and compares received onboarding items against the required checklist. Missing items create a GS Staff follow-up task automatically.",
    "leave-of-absence":
      "Leave of Absence is a stop/pause process. Staff record the uploaded application, check prior LOA eligibility, forward the request to the Dean, record the decision, update the student's status only when approved, and send the notice.",
    readmission:
      "Readmission is a separate return/re-entry process after the approved leave period. Staff record the request, check eligibility for the target term, route the Dean decision, reactivate approved students, and send the notice.",
    "course-audit":
      "Marks a subject completed, current, missing, incomplete, or dropped, then recomputes the student's completion rate and missing count. Clearing all subjects advances the student to Proposal Development.",
    "research-gate":
      "Compares the submitted evidence package against the protocol requirements for the selected gate (Form 1, Form 4, Final Defense, or Completion). Missing or revised items route back to the right owner.",
    "panel-matching":
      "Scores active faculty using specialization match, same-college fit, available dates, and current panel load, then assigns the top candidates to each required panel role.",
    "defense-scheduling":
      "Collects adviser and panel availability from the database, highlights overlapping time windows, and lets the Research Coordinator propose a shared slot. Revised preferred dates repeat the coordination loop.",
  };
  return map[slug] || "";
}
