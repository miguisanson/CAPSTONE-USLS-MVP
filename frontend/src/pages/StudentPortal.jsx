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
  FileUp,
  GraduationCap,
  Eye,
  ListTodo,
  Lock,
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

const RESEARCH_GATE_KEYS = new Set(["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"]);

const REQUEST_GROUPS = [
  {
    title: "Research & Defense",
    description: "Upload your milestone files, submit them for review, then request scheduling after a panel is assigned.",
    items: [
      { id: "research", label: "Research Submission", icon: FileCheck },
      {
        id: "schedule",
        label: "Defense Schedule",
        icon: CalendarCheck,
        lockedWhen: (data) => !data.research_case || !data.panel?.length,
        lockedReason: "Available after research staff opens your research case and completes panel matching.",
      },
    ],
  },
  {
    title: "Leave & Return",
    description: "Submit a leave application or request your return after an approved leave.",
    items: [
      { id: "loa", label: "Leave of Absence", icon: CalendarOff },
      {
        id: "readmission",
        label: "Readmission",
        icon: UserCheck,
        lockedWhen: (data) => data.student.standing !== "On Leave" && data.student.current_stage !== "LOA",
        lockedReason: "Available only after an approved Leave of Absence.",
      },
    ],
  },
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
                  <AdministrativeDocumentsPanel documentsByGate={data.documents_by_gate} onSaved={refetch} />
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
  const progressStages = stages
    .filter((stage) => stage !== "LOA")
    .map((stage) => (stage === "Completed" ? "Completion Evidence" : stage));
  const currentStage = student.current_stage === "Completed" ? "Completion Evidence" : student.current_stage;
  const displayIndex = progressStages.indexOf(currentStage);
  return (
    <Card className="p-6">
      <SectionTitle title="My Academic Status" subtitle="Your current stage, requirements, and next step" icon={ClipboardCheck} />
      {student.standing === "On Leave" && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          Your studies are currently paused because you are on Leave of Absence. Readmission becomes available while this status is active.
        </div>
      )}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {progressStages.map((stage, i) => {
          const done = displayIndex >= 0 && i < displayIndex;
          const current = i === displayIndex;
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
            <StatusBadge value={research_case?.current_gate_label || "Research not started"} dot={false} />
            {research_case?.status && <StatusBadge value={research_case.status} />}
          </div>
        </div>
      </div>
    </Card>
  );
}

function RequestCenter({ data, onSaved }) {
  const [active, setActive] = useState("research");
  const allRequests = REQUEST_GROUPS.flatMap((group) => group.items);
  const activeRequest = allRequests.find((r) => r.id === active) || allRequests[0];
  const ActiveIcon = activeRequest?.icon || Send;
  const activeLocked = activeRequest?.lockedWhen?.(data);

  return (
    <Card className="p-6">
      <SectionTitle title="Request Center" subtitle="Choose the request that matches your current status" icon={Send} />
      <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {REQUEST_GROUPS.map((group) => (
          <div key={group.title} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3">
            <p className="text-sm font-semibold text-ink">{group.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{group.description}</p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const locked = item.lockedWhen?.(data);
                const isActive = active === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={locked ? item.lockedReason : ""}
                    aria-disabled={locked ? "true" : "false"}
                    onClick={() => {
                      if (!locked) setActive(item.id);
                    }}
                    className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      locked
                        ? "cursor-not-allowed border border-slate-200 bg-white text-slate-400"
                        : isActive
                        ? "bg-brand-600 text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-brand-50 hover:text-brand-700"
                    }`}
                  >
                    <Icon className="h-4 w-4" /> {item.label}
                    {locked && <Lock className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ActiveIcon className="h-4 w-4 text-brand-700" /> {activeRequest?.label}
        </div>
        {activeLocked ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 text-slate-400" />
            <p>{activeRequest.lockedReason}</p>
          </div>
        ) : (
          <>
            {active === "research" && <ResearchRequestForm data={data} onSaved={onSaved} />}
            {active === "loa" && <LoaRequestForm studentId={data.student.id} onSaved={onSaved} />}
            {active === "readmission" && <ReadmissionRequestForm data={data} onSaved={onSaved} />}
            {active === "schedule" && <ScheduleRequestForm studentId={data.student.id} onSaved={onSaved} />}
          </>
        )}
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
  const milestones = data.research_milestones || [];
  const initialGate = data.research_case?.current_gate || milestones[0]?.value || "";
  const [gate, setGate] = useState(initialGate);
  const [form, setForm] = useState({ research_title: data.research_case?.title || "", submitted_package: "" });
  const { busy, error, message, submit } = useSubmitRequest("research-gate", onSaved);
  const milestone = milestones.find((item) => item.value === gate) || milestones[0];
  const uploadRequirements = milestone?.requirements.filter((item) => item.student_upload) || [];
  const managedRequirements = milestone?.requirements.filter((item) => !item.student_upload) || [];

  useEffect(() => {
    const currentGate = data.research_case?.current_gate || milestones[0]?.value || "";
    setGate(currentGate);
    setForm((current) => ({ ...current, research_title: data.research_case?.title || "" }));
  }, [data.student.id, data.research_case?.current_gate, data.research_case?.title, milestones]);

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
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Research milestone" required hint={milestone?.description}>
        <Select
          value={gate}
          onChange={(e) => setGate(e.target.value)}
          placeholder=""
          options={milestones.map((item) => ({ value: item.value, label: item.label }))}
        />
      </Field>
      <Field label="Research title">
        <Input value={form.research_title} onChange={set("research_title")} />
      </Field>
      <div>
        <p className="field-label">Files you upload</p>
        <p className="mb-2 text-xs text-slate-500">Only these items require action from you for this milestone.</p>
        <div className="space-y-2">
          {uploadRequirements.map((requirement) => (
            <ResearchEvidenceUpload
              key={requirement.item_name}
              gate={gate}
              requirement={requirement}
              onSaved={onSaved}
            />
          ))}
        </div>
      </div>
      {managedRequirements.length > 0 && (
        <div>
          <p className="field-label">Completed by staff or the system</p>
          <p className="mb-2 text-xs text-slate-500">These update automatically after review, panel matching, or scheduling.</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {managedRequirements.map((requirement) => (
              <div key={requirement.item_name} className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-3.5 py-3 last:border-b-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{requirement.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
                </div>
                <StatusBadge value={requirement.status_label} dot={false} />
              </div>
            ))}
          </div>
        </div>
      )}
      <Field label="Message to the Research Coordinator" hint="Optional context for this submission.">
        <Textarea value={form.submitted_package} onChange={set("submitted_package")} />
      </Field>
      <SubmitState
        busy={busy}
        error={error}
        message={message}
        disabled={!milestone?.student_uploads_ready}
        label={`Submit ${milestone?.short_label || "milestone"} for review`}
        disabledHint={!milestone?.student_uploads_ready ? "Upload all required files before submitting this milestone." : ""}
      />
    </form>
  );
}

function ResearchEvidenceUpload({ gate, requirement, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needed = requirement.required_file_count;
  const files = requirement.files || [];

  async function upload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.uploadResearchEvidence(gate, requirement.item_name, file);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not upload this evidence.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{requirement.label}</p>
          <p className="mt-0.5 text-xs text-slate-500">{requirement.description}</p>
          <p className="mt-1 text-xs font-medium text-slate-600">{files.length} of {needed} file{needed > 1 ? "s" : ""} uploaded</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge value={requirement.status_label} dot={false} />
          <label className="btn-ghost cursor-pointer">
          <FileUp className="h-4 w-4" /> {busy ? "Uploading..." : files.length >= needed ? "Add another" : "Upload PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {files.map((file) => (
            <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-slate-200">
              {file.name}<Eye className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function LoaRequestForm({ studentId, onSaved }) {
  const [form, setForm] = useState({
    attachment_id: null,
    effective_start: "",
    effective_end: "",
    reason_remarks: "",
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
      <RequestPdfUpload requestType="leave-of-absence" label="Completed LOA application PDF" onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} />
      <SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the completed LOA application before submitting." : ""} label="Submit LOA application" />
    </form>
  );
}

function ReadmissionRequestForm({ data, onSaved }) {
  const requirements = data.readmission_requirements || [];
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    attachment_id: null,
    target_return_term: "",
    previous_loa_period: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("readmission", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => setItems([]), [data.student.id]);

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
      <Field label="Requirements included in your application" hint="Select only the items actually included in the uploaded PDF.">
        <CheckList items={requirements} selected={items} onToggle={(item) => setItems((x) => (x.includes(item) ? x.filter((v) => v !== item) : [...x, item]))} />
      </Field>
      <RequestPdfUpload requestType="readmission" label="Completed readmission application PDF" onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} />
      <SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id || items.length !== requirements.length} disabledHint={!form.attachment_id ? "Upload the completed readmission application before submitting." : items.length !== requirements.length ? "Confirm all required items included in the application." : ""} label="Submit readmission request" />
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
      <SubmitState busy={busy} error={error} message={message} label="Submit schedule request" />
    </form>
  );
}

function RequestPdfUpload({ requestType, label, onUploaded }) {
  const [attachment, setAttachment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.uploadStudentRequestAttachment(requestType, file);
      setAttachment(result.attachment);
      onUploaded(result.attachment);
    } catch (err) {
      setError(err.message || "Could not upload the application.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Field label={label} hint="PDF only, up to 25 MB. The file is stored with your request.">
      <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
        <span className="flex min-w-0 items-center gap-2">
          <FileUp className="h-4 w-4 shrink-0 text-brand-700" />
          <span className="truncate">{attachment?.name || (busy ? "Uploading..." : "Choose PDF file")}</span>
        </span>
        <span className="shrink-0 rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
          Browse
        </span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => upload(e.target.files?.[0])}
        />
      </label>
      {attachment && <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Eye className="h-3.5 w-3.5" /> View uploaded application</a>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </Field>
  );
}

function SubmitState({ busy, error, message, label, disabled = false, disabledHint = "" }) {
  return (
    <div className="space-y-3">
      <ErrorNote message={error} />
      {message && (
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800">
          <CheckCircle2 className="h-5 w-5" /> {message}
        </div>
      )}
      <button type="submit" disabled={busy || disabled} className="btn-primary w-full sm:w-auto">
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
      {disabledHint && <p className="text-xs font-medium text-slate-500">{disabledHint}</p>}
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

function AdministrativeDocumentsPanel({ documentsByGate, onSaved }) {
  const entries = Object.entries(documentsByGate || {}).filter(([gate]) => !RESEARCH_GATE_KEYS.has(gate));
  if (!entries.length) return null;
  return (
    <Card className="p-6">
      <SectionTitle title="Administrative Documents" subtitle="Admission and general records outside your research submissions" icon={FileText} />
      <div className="space-y-4">
        {entries.map(([gate, docs]) => (
          <div key={gate}>
            <p className="mb-2 text-sm font-semibold text-slate-700">{gate}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {docs.map((doc) => (
                <div key={doc.id} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{doc.display_name || doc.item_name}</span>
                    <StatusBadge value={doc.status_label || doc.status} dot={false} />
                    {doc.status === "Missing" ? (
                      <MissingDocumentUpload doc={doc} onSaved={onSaved} />
                    ) : (
                      <DocumentViewButton doc={doc} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DocumentViewButton({ doc }) {
  const file = doc.files?.[0];
  const reference = file?.url || doc.evidence_reference || "";
  const canView = Boolean(reference);

  function viewReference() {
    if (!canView) return;
    if (file?.url || /^https?:\/\//i.test(reference)) {
      window.open(reference, "_blank", "noopener,noreferrer");
      return;
    }
    window.alert(`Document reference: ${reference}`);
  }

  return (
    <button
      type="button"
      onClick={viewReference}
      disabled={!canView}
      aria-label="View document"
      title={canView ? `View document: ${reference}` : "No document reference recorded yet"}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Eye className="h-3.5 w-3.5" />
    </button>
  );
}

function MissingDocumentUpload({ doc, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(file) {
    if (!file) return;
    setError("");
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    try {
      await api.submitStudentDocument(doc.id, file);
      onSaved();
    } catch (err) {
      setError(err.message || "Could not submit the document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="shrink-0">
      <label
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-brand-700 hover:bg-brand-50"
        title="Upload PDF"
        aria-label="Upload PDF"
      >
        <FileUp className="h-3.5 w-3.5" />
        <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => submit(e.target.files?.[0])} />
      </label>
      {error && <p className="mt-1 max-w-32 text-xs font-medium text-red-600">{error}</p>}
    </div>
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
