import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  UserPlus,
  CalendarOff,
  ClipboardCheck,
  FileCheck,
  Users,
  CalendarCheck,
  CheckCircle2,
  Info,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, SectionTitle, Spinner, StatusBadge, EmptyState, Pill, ErrorNote } from "../components/ui";
import { Field, Input, Textarea, Select, CheckList, RadioRow } from "../components/forms";
import StudentPicker from "../components/StudentPicker";
import { formatDate } from "../lib/format";

const ICONS = {
  "student-handoff": UserPlus,
  "loa-decision": CalendarOff,
  "course-audit": ClipboardCheck,
  "research-gate": FileCheck,
  "panel-matching": Users,
  "defense-scheduling": CalendarCheck,
};

const NEEDS_STUDENT = {
  "student-handoff": false,
  "loa-decision": true,
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
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold text-ink">{tx.title}</h1>
              <Pill tone={tx.priority}>{tx.priority}</Pill>
            </div>
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
              {slug === "student-handoff" && <HandoffForm {...formProps} />}
              {slug === "course-audit" && <CourseAuditForm {...formProps} />}
              {slug === "research-gate" && <ResearchGateForm {...formProps} />}
              {slug === "panel-matching" && <PanelMatchingForm {...formProps} />}
              {slug === "defense-scheduling" && <DefenseSchedulingForm {...formProps} />}
              {slug === "loa-decision" && <LoaDecisionForm {...formProps} />}
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
// Student Handoff
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
  const [form, setForm] = useState({
    preferred_date: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const panel = context.assigned_panel || [];

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Schedule a defense" subtitle="Confirms only when assigned panel availability matches the date" icon={CalendarCheck} />
      {panel.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          No panel is assigned yet. Run Panel Matching first — scheduling needs an assigned panel to check availability.
        </div>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Preferred date" required>
          <Input type="date" value={form.preferred_date} onChange={set("preferred_date")} required />
        </Field>
        <Field label="Defense type" required>
          <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={["Title Defense", "Proposal Defense", "Final Defense", "Public Final Defense"]} />
        </Field>
        <Field label="Mode" required>
          <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
        </Field>
        <Field label="Venue / meeting link">
          <Input value={form.venue} onChange={set("venue")} placeholder="GS Conference Room / Zoom link" />
        </Field>
      </div>
      <Field label="Scheduling constraints">
        <Textarea value={form.constraints} onChange={set("constraints")} placeholder="e.g. external panel only available afternoons" />
      </Field>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Check & record schedule</SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// LOA / Readmission
// ---------------------------------------------------------------------------
function LoaDecisionForm({ context, studentId, submit, submitting }) {
  const [requestType, setRequestType] = useState("LOA");
  const readmission = context.readmission_requirements || [];
  const [items, setItems] = useState(readmission);
  const [form, setForm] = useState({
    dean_action: "Approve",
    completed_terms: 1,
    loa_terms_used: 0,
    requested_terms: 1,
    reason_document: "yes",
    effective_start: "",
    effective_end: "",
    notes: "",
    source_reference: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggle = (item) => setItems((r) => (r.includes(item) ? r.filter((x) => x !== item) : [...r, item]));

  useEffect(() => setItems(context.readmission_requirements || []), [context.readmission_requirements]);

  function onSubmit(e) {
    e.preventDefault();
    const payload = { student_id: studentId, request_type: requestType, ...form };
    if (requestType === "Readmission") payload.readmission_items = items;
    submit(payload);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <SectionTitle title="Route LOA / Readmission" subtitle="Checks residency rules or return evidence before recording the decision" icon={CalendarOff} />
      <Field label="Request type">
        <RadioRow value={requestType} onChange={setRequestType} options={["LOA", "Readmission"]} />
      </Field>

      {requestType === "LOA" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Completed terms" hint="Residency requires ≥ 1">
            <Input type="number" min="0" value={form.completed_terms} onChange={set("completed_terms")} />
          </Field>
          <Field label="LOA terms already used">
            <Input type="number" min="0" value={form.loa_terms_used} onChange={set("loa_terms_used")} />
          </Field>
          <Field label="Requested LOA terms">
            <Input type="number" min="1" value={form.requested_terms} onChange={set("requested_terms")} />
          </Field>
          <Field label="Reason document attached?">
            <RadioRow value={form.reason_document} onChange={(v) => setForm((f) => ({ ...f, reason_document: v }))} options={[{ value: "yes", label: "Yes" }, { value: "no", label: "No" }]} />
          </Field>
          <Field label="Effective start">
            <Input type="date" value={form.effective_start} onChange={set("effective_start")} />
          </Field>
          <Field label="Effective end">
            <Input type="date" value={form.effective_end} onChange={set("effective_end")} />
          </Field>
        </div>
      ) : (
        <Field label="Return evidence received" hint="Unticked items are flagged missing and routed back to the student.">
          <CheckList items={readmission} selected={items} onToggle={toggle} />
        </Field>
      )}

      <Field label="Dean decision">
        <RadioRow value={form.dean_action} onChange={(v) => setForm((f) => ({ ...f, dean_action: v }))} options={["Approve", "Deny", "Return"]} />
      </Field>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={set("notes")} />
      </Field>
      <Field label="Source reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitButton submitting={submitting}>Record decision</SubmitButton>
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
    "loa-decision":
      "For LOA, the system checks residency (a completed term), the four-term LOA limit, and the reason document before routing the Dean's decision. For readmission, it checks return evidence completeness.",
    "course-audit":
      "Marks a subject completed, current, missing, incomplete, or dropped, then recomputes the student's completion rate and missing count. Clearing all subjects advances the student to Proposal Development.",
    "research-gate":
      "Compares the submitted evidence package against the protocol requirements for the selected gate (Form 1, Form 4, Final Defense, or Completion). Missing or revised items route back to the right owner.",
    "panel-matching":
      "Scores active faculty using specialization match, same-college fit, available dates, and current panel load, then assigns the top candidates to each required panel role.",
    "defense-scheduling":
      "Checks lead-time rules and whether the assigned panel has availability on the chosen date. It confirms only when both pass; otherwise it logs a 'needs availability' follow-up.",
  };
  return map[slug] || "";
}
