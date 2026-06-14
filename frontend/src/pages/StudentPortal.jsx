import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarOff,
  CheckCircle2,
  ClipboardCheck,
  FileCheck,
  FileText,
  GraduationCap,
  ListTodo,
  LogOut,
  Mail,
  Send,
  UserCheck,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, ProgressBar, SectionTitle, Spinner, StatusBadge } from "../components/ui";
import { CheckList, Field, Input, Select, Textarea } from "../components/forms";
import { formatDate, initials, relativeDays } from "../lib/format";

const GATES = ["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"];

const REQUESTS = [
  { id: "research", label: "Research Gate", icon: FileCheck },
  { id: "loa", label: "Leave of Absence", icon: CalendarOff },
  { id: "readmission", label: "Readmission", icon: UserCheck },
  { id: "schedule", label: "Defense Schedule", icon: CalendarCheck },
];

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.studentPortalContext(), []);

  const student = data?.student;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:px-8">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-semibold text-ink sm:text-base">USLS Graduate School</p>
            <p className="text-xs font-semibold uppercase text-brand-700">Student Portal</p>
          </div>
          <span className="ml-auto hidden rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 sm:inline-flex">
            {user?.full_name || "Student"}
          </span>
          <button
            type="button"
            onClick={logout}
            className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
        <div className="space-y-5 animate-fade-up">
          <Card className="p-5">
            <h1 className="font-display text-2xl font-semibold text-ink">My Graduate School Portal</h1>
            <p className="mt-1 text-sm text-slate-500">
              Track your progress, submit requests, and see which office owns the next step.
            </p>
          </Card>

          {loading ? (
            <Card className="p-6">
              <Spinner label="Loading student portal..." />
            </Card>
          ) : error ? (
            <Card className="p-6">
              <EmptyState title="Could not load student portal" hint={error} />
            </Card>
          ) : student ? (
            <>
              <StudentHero data={data} />
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                <div className="space-y-5 lg:col-span-8">
                  <ProgressPanel data={data} />
                  <RequestCenter data={data} onSaved={refetch} />
                  <DocumentsPanel documentsByGate={data.documents_by_gate} />
                  <ActivityPanel logs={data.logs} />
                </div>
                <div className="space-y-5 lg:col-span-4">
                  <TasksPanel tasks={data.tasks} />
                  <SchedulePanel schedules={data.schedules} />
                  <RecommendationsPanel recommendations={data.recommendations} />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function StudentHero({ data }) {
  const { student, course_audit, research_case } = data;
  return (
    <Card className="p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-xl font-bold text-brand-700">
            {initials(student.name)}
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-ink">{student.name}</h2>
            <p className="text-sm text-slate-500">
              {student.student_number} - {student.program_name}
            </p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" /> {student.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
          <MiniStat label="Stage" value={student.current_stage} />
          <MiniStat label="Standing" value={student.standing} badge />
          <MiniStat label="Coursework" value={`${course_audit.completion_rate}%`} />
          <MiniStat label="Research" value={research_case?.status || "Not started"} badge />
        </div>
      </div>
    </Card>
  );
}

function MiniStat({ label, value, badge }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <div className="mt-1 min-h-6">
        {badge ? <StatusBadge value={value} dot={false} /> : <p className="text-sm font-semibold text-ink">{value}</p>}
      </div>
    </div>
  );
}

function ProgressPanel({ data }) {
  const { stages, stage_index, student, course_audit, research_case } = data;
  return (
    <Card className="p-6">
      <SectionTitle title="My Progress" subtitle="Current lifecycle position and readiness signals" icon={ClipboardCheck} />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {stages.map((stage, i) => {
          const done = i < stage_index;
          const current = i === stage_index;
          return (
            <span
              key={stage}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                current ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-400"
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${current || done ? "bg-current" : "bg-slate-300"}`} />
              {stage}
            </span>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-slate-700">Coursework completion</span>
            <span className="font-bold text-brand-700">{course_audit.completion_rate}%</span>
          </div>
          <ProgressBar value={course_audit.completion_rate} />
          <p className="mt-2 text-xs text-slate-500">
            {course_audit.completed.length} completed, {course_audit.current.length} current, {course_audit.missing_count} missing.
          </p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
          <p className="text-sm font-semibold text-ink">{research_case?.title || "No research case opened yet"}</p>
          <p className="mt-1 text-xs text-slate-500">
            Adviser: {student.adviser_name || research_case?.adviser_name || "Not assigned"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge value={research_case?.current_gate || "Research not started"} dot={false} />
            {research_case?.status && <StatusBadge value={research_case.status} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

function RequestCenter({ data, onSaved }) {
  const [active, setActive] = useState("research");
  const ActiveIcon = REQUESTS.find((r) => r.id === active)?.icon || Send;

  return (
    <Card className="p-6">
      <SectionTitle title="Request Center" subtitle="Submit applications to the staff queue for review" icon={Send} />
      <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {REQUESTS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
              active === id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-brand-50 hover:text-brand-700"
            }`}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ActiveIcon className="h-4 w-4 text-brand-700" /> {REQUESTS.find((r) => r.id === active)?.label}
        </div>
        {active === "research" && <ResearchRequestForm data={data} onSaved={onSaved} />}
        {active === "loa" && <LoaRequestForm studentId={data.student.id} onSaved={onSaved} />}
        {active === "readmission" && <ReadmissionRequestForm data={data} onSaved={onSaved} />}
        {active === "schedule" && <ScheduleRequestForm studentId={data.student.id} onSaved={onSaved} />}
      </div>
    </Card>
  );
}

function useSubmitRequest(type, onSaved) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function submit(payload) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const res = await api.submitStudentRequest(type, payload);
      setMessage(res.message || "Submitted.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not submit the request.");
    } finally {
      setBusy(false);
    }
  }

  return { busy, error, message, submit };
}

function ResearchRequestForm({ data, onSaved }) {
  const [gate, setGate] = useState(GATES[0]);
  const required = data.gate_requirements?.[gate] || [];
  const [selected, setSelected] = useState(required);
  const [form, setForm] = useState({ research_title: "", submitted_package: "", source_reference: "" });
  const { busy, error, message, submit } = useSubmitRequest("research-gate", onSaved);

  useEffect(() => setSelected(required), [gate, required]);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: data.student.id,
      gate,
      research_title: form.research_title,
      submitted_package: form.submitted_package,
      source_reference: form.source_reference,
      submitted_items: selected.map((item) => `${gate}||${item}`),
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Gate / milestone" required>
        <Select value={gate} onChange={(e) => setGate(e.target.value)} placeholder="" options={GATES} />
      </Field>
      <Field label="Research title">
        <Input value={form.research_title} onChange={set("research_title")} />
      </Field>
      <Field label="Requirements included">
        <CheckList items={required} selected={selected} onToggle={(item) => setSelected((x) => (x.includes(item) ? x.filter((v) => v !== item) : [...x, item]))} />
      </Field>
      <Field label="Submission notes or package reference">
        <Textarea value={form.submitted_package} onChange={set("submitted_package")} />
      </Field>
      <Field label="File/link reference">
        <Input value={form.source_reference} onChange={set("source_reference")} placeholder="Drive link, email subject, or filename" />
      </Field>
      <SubmitState busy={busy} error={error} message={message} label="Submit research application" />
    </form>
  );
}

function LoaRequestForm({ studentId, onSaved }) {
  const [form, setForm] = useState({
    application_reference: "",
    effective_start: "",
    effective_end: "",
    reason_remarks: "",
    source_reference: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("leave-of-absence", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Effective start" required>
          <Input value={form.effective_start} onChange={set("effective_start")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Effective end" required>
          <Input value={form.effective_end} onChange={set("effective_end")} required placeholder="AY 2026-2027 Term 2" />
        </Field>
      </div>
      <Field label="Reason / remarks" required>
        <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} required />
      </Field>
      <Field label="Attachment or file reference">
        <Input value={form.application_reference} onChange={set("application_reference")} placeholder="Drive link, email subject, or filename" />
      </Field>
      <Field label="Other reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitState busy={busy} error={error} message={message} label="Submit LOA application" />
    </form>
  );
}

function ReadmissionRequestForm({ data, onSaved }) {
  const requirements = data.readmission_requirements || [];
  const [items, setItems] = useState(requirements);
  const [form, setForm] = useState({
    application_reference: "",
    target_return_term: "",
    previous_loa_period: "",
    source_reference: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("readmission", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => setItems(requirements), [requirements]);

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form, readmission_items: items });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Target return term" required>
          <Input value={form.target_return_term} onChange={set("target_return_term")} required placeholder="AY 2026-2027 Term 1" />
        </Field>
        <Field label="Previous LOA period">
          <Input value={form.previous_loa_period} onChange={set("previous_loa_period")} placeholder="AY 2025-2026 Term 2 to AY 2026-2027 Term 1" />
        </Field>
      </div>
      <Field label="Requirements included">
        <CheckList items={requirements} selected={items} onToggle={(item) => setItems((x) => (x.includes(item) ? x.filter((v) => v !== item) : [...x, item]))} />
      </Field>
      <Field label="Attachment or file reference">
        <Input value={form.application_reference} onChange={set("application_reference")} />
      </Field>
      <Field label="Other reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitState busy={busy} error={error} message={message} label="Submit readmission request" />
    </form>
  );
}

function ScheduleRequestForm({ studentId, onSaved }) {
  const [form, setForm] = useState({
    preferred_date: "",
    defense_type: "Proposal Defense",
    mode: "On-site",
    venue: "",
    constraints: "",
    source_reference: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("defense-scheduling", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Preferred date" required>
          <Input type="date" value={form.preferred_date} onChange={set("preferred_date")} required />
        </Field>
        <Field label="Defense type" required>
          <Select value={form.defense_type} onChange={set("defense_type")} placeholder="" options={["Title Defense", "Proposal Defense", "Final Defense", "Public Final Defense"]} />
        </Field>
        <Field label="Mode">
          <Select value={form.mode} onChange={set("mode")} placeholder="" options={["On-site", "Online", "Hybrid"]} />
        </Field>
        <Field label="Venue / meeting link">
          <Input value={form.venue} onChange={set("venue")} />
        </Field>
      </div>
      <Field label="Scheduling constraints">
        <Textarea value={form.constraints} onChange={set("constraints")} />
      </Field>
      <Field label="Other reference">
        <Input value={form.source_reference} onChange={set("source_reference")} />
      </Field>
      <SubmitState busy={busy} error={error} message={message} label="Submit schedule request" />
    </form>
  );
}

function SubmitState({ busy, error, message, label }) {
  return (
    <div className="space-y-3">
      <ErrorNote message={error} />
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      )}
      <button type="submit" disabled={busy} className="btn-primary w-full sm:w-auto">
        {busy ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Submitting...
          </>
        ) : (
          <>
            <Send className="h-4 w-4" /> {label}
          </>
        )}
      </button>
    </div>
  );
}

function TasksPanel({ tasks }) {
  return (
    <Card className="p-6">
      <SectionTitle title="My Tasks" subtitle="Items waiting on you or your case" icon={ListTodo} />
      {tasks.length ? (
        <ul className="space-y-2.5">
          {tasks.map((task) => (
            <li key={task.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{task.title}</p>
                <StatusBadge value={task.overdue ? "Overdue" : task.status} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Next owner: {task.owner_role} - due {formatDate(task.due_at)} ({relativeDays(task.due_at)})
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No open tasks" hint="There are no pending items for this student record." />
      )}
    </Card>
  );
}

function DocumentsPanel({ documentsByGate }) {
  const entries = Object.entries(documentsByGate || {});
  return (
    <Card className="p-6">
      <SectionTitle title="Documents & Requirements" subtitle="Submitted and missing checklist items by milestone" icon={FileText} />
      {entries.length ? (
        <div className="space-y-4">
          {entries.map(([gate, docs]) => (
            <div key={gate}>
              <p className="mb-2 text-sm font-semibold text-slate-700">{gate}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                    <span className="truncate text-sm text-slate-600">{doc.item_name}</span>
                    <StatusBadge value={doc.status} dot={false} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No document checks yet" hint="Your requirements will appear here after a staff review." />
      )}
    </Card>
  );
}

function SchedulePanel({ schedules }) {
  return (
    <Card className="p-6">
      <SectionTitle title="Schedule Requests" icon={CalendarClock} />
      {schedules.length ? (
        <ul className="space-y-2.5">
          {schedules.map((schedule) => (
            <li key={schedule.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{formatDate(schedule.preferred_date)}</p>
                <StatusBadge value={schedule.status} dot={false} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {schedule.mode} - {schedule.venue || "Venue/link pending"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="No schedule requests" />
      )}
    </Card>
  );
}

function RecommendationsPanel({ recommendations }) {
  return (
    <Card className="p-6">
      <SectionTitle title="Next Step" icon={ArrowRight} />
      {recommendations.length ? (
        <ul className="space-y-2.5">
          {recommendations.slice(0, 3).map((rec, i) => (
            <li key={i} className="rounded-xl border border-slate-100 p-3">
              <p className="text-sm font-semibold text-ink">{rec.recommendation}</p>
              <p className="mt-1 text-xs text-slate-500">Owner: {rec.owner}</p>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="On track" hint="No immediate follow-up is flagged." />
      )}
    </Card>
  );
}

function ActivityPanel({ logs }) {
  const visibleLogs = useMemo(() => logs || [], [logs]);
  return (
    <Card className="p-6">
      <SectionTitle title="Activity History" subtitle="Submissions, decisions, and next owners" icon={Activity} />
      {visibleLogs.length ? (
        <ol className="relative space-y-4 border-l-2 border-slate-100 pl-5">
          {visibleLogs.map((log) => (
            <li key={log.id} className="relative">
              <span className="absolute -left-[27px] top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand-500" />
              <p className="text-sm font-semibold text-ink">{log.result}</p>
              <p className="text-xs text-slate-500">
                {log.actor_role} - next: {log.next_owner || "Pending"} - {formatDate(log.created_at)}
              </p>
              {log.notes && <p className="mt-1 text-xs leading-relaxed text-slate-400">{log.notes}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <EmptyState title="No activity yet" />
      )}
    </Card>
  );
}
