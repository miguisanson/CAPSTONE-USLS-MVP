import { Component, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Briefcase,
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
  MessageSquare,
  Send,
  Trash2,
  UserCheck,
  LayoutDashboard,
  UserX,
  BookOpenCheck,
  Bot,
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, ProgressBar, SectionTitle, Spinner, StatusBadge } from "../components/ui";
import { useConfirm } from "../components/confirm";
import { CheckList, Field, Input, Select, Textarea } from "../components/forms";
import { formatDate, initials, relativeDays } from "../lib/format";
import RoleSidebar from "../components/RoleSidebar";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps, loaTimelineSteps } from "../components/WorkflowTimeline";
import WorkflowDiscussion from "../components/WorkflowDiscussion";
import HistoryDisclosure from "../components/HistoryDisclosure";

const RESEARCH_GATE_KEYS = new Set(["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"]);

const STUDENT_REQUEST_VIEW_BY_SLUG = {
  "leave-of-absence": "loa",
  readmission: "readmission",
  awol: "awol",
  practicum: "practicum",
  withdrawal: "withdrawal",
  graduation: "graduation",
};

const STUDENT_MESSAGE_SLUG_BY_VIEW = Object.fromEntries(
  Object.entries(STUDENT_REQUEST_VIEW_BY_SLUG).map(([slug, view]) => [view, slug]),
);

const STUDENT_NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
      { id: "lifecycle", label: "Lifecycle Status", icon: Activity },
    ],
  },
  {
    label: "Student Workflows",
    items: [
      { id: "courses", number: 3, label: "My Courses", icon: ClipboardCheck },
      { id: "research", number: 4, label: "Research Submission", icon: FileCheck },
      { id: "schedule", number: 6, label: "Defense Schedule", icon: CalendarCheck },
      { id: "practicum", number: 7, label: "Practicum", icon: Briefcase },
      { id: "graduation", number: 8, label: "Graduation Status", icon: GraduationCap },
    ],
  },
  {
    label: "Standalone Processes",
    items: [
      { id: "loa", label: "Leave of Absence", icon: CalendarOff },
      { id: "readmission", label: "Readmission", icon: UserCheck },
      { id: "awol", label: "Return from AWOL", icon: UserX },
      { id: "withdrawal", label: "Subject Withdrawal", icon: LogOut },
    ],
  },
  {
    label: "Support",
    items: [
      { id: "inbox", label: "Inbox / Messages", icon: Mail },
      { id: "documents", label: "Documents / Submissions", icon: FileUp },
      { id: "assistant", label: "Policy Assistant", icon: Bot },
    ],
  },
];

class StudentPortalSectionBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps) {
    if (prevProps.view !== this.props.view && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="p-6">
          <EmptyState
            icon={AlertTriangle}
            title="This page could not load"
            hint="Please try another section or refresh the portal. The rest of your student portal is still available."
          />
        </Card>
      );
    }
    return this.props.children;
  }
}

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
    description: "Submit a standalone standing-change or subject-withdrawal request.",
    items: [
      { id: "loa", label: "Leave of Absence", icon: CalendarOff },
      {
        id: "readmission",
        label: "Readmission",
        icon: UserCheck,
        lockedWhen: (data) => data.student.standing !== "On Leave" && data.student.current_stage !== "LOA",
        lockedReason: "Available only after an approved Leave of Absence.",
      },
      {
        id: "awol",
        label: "Return from AWOL",
        icon: UserX,
        lockedWhen: (data) => data.student.enrollment_tag !== "AWOL" && data.student.standing !== "AWOL",
        lockedReason: "Available only while your student record is marked AWOL.",
      },
      { id: "withdrawal", label: "Subject Withdrawal", icon: LogOut },
    ],
  },
  {
    title: "Completion",
    description: "Submit practicum evidence when required and request Graduate School graduation endorsement review.",
    items: [
      {
        id: "practicum",
        label: "Practicum",
        icon: Briefcase,
        lockedWhen: (data) => !data.student.program_has_practicum,
        lockedReason: "Available only for programs with practicum requirements.",
      },
      { id: "graduation", label: "Graduation Endorsement", icon: GraduationCap },
    ],
  },
];

export default function StudentPortal() {
  const { user, logout } = useAuth();
  const { data, loading, error, refetch } = useApi(() => api.studentPortalContext(), []);

  const student = data?.student;
  const [view, setView] = useState("overview");

  return (
    <div className="min-h-screen bg-canvas lg:flex">
      <RoleSidebar roleLabel="Student Portal" groups={STUDENT_NAV_GROUPS} active={view} onChange={setView} />
      <div className="min-w-0 flex-1">
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
              <StudentPortalSectionBoundary view={view}>
                {view === "overview" && <div className="grid grid-cols-1 gap-5 lg:grid-cols-12"><div className="space-y-5 lg:col-span-8"><ProgressPanel data={data} /><WorkflowStatusPanel data={data} /><ActivityPanel logs={data.logs} /></div><div className="space-y-5 lg:col-span-4"><TasksPanel tasks={data.tasks} /><SchedulePanel schedules={data.schedules} /><RecommendationsPanel recommendations={data.recommendations} /></div></div>}
                {view === "lifecycle" && <div className="space-y-5"><ProgressPanel data={data} /><WorkflowStatusPanel data={data} /></div>}
                {view === "courses" && <MyCoursesPanel data={data} onSaved={refetch} />}
                {view === "assistant" && <StudentPolicyAssistant />}
                {["research", "schedule", "loa", "readmission", "awol", "withdrawal", "practicum", "graduation"].includes(view) && <RequestCenter data={data} onSaved={refetch} focusedRequest={view} />}
                {view === "inbox" && <StudentInbox data={data} onSaved={refetch} onOpenRequest={setView} />}
                {view === "documents" && <div className="space-y-5"><AdministrativeDocumentsPanel documentsByGate={data.documents_by_gate} onSaved={refetch} /><ActivityPanel logs={data.logs} /></div>}
              </StudentPortalSectionBoundary>
            </>
          ) : null}
        </div>
      </main>
      </div>
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
            <p className="mt-1 text-xs font-semibold text-brand-700">AY Entry {student.academic_year_entry || "Not recorded"} · {student.course_year_label || "Course year unavailable"}</p>
            <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-500">
              <Mail className="h-4 w-4" /> {student.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-[520px]">
          <MiniStat label="Stage" value={student.current_stage} />
          <MiniStat label="Progress" value={data.progress_status?.level || "Not yet assessed"} badge />
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

function WorkflowStatusPanel({ data }) {
  const rows = [];
  if (data.student.program_has_practicum) {
    rows.push({
      label: "Practicum",
      icon: Briefcase,
      status: data.practicum_record?.status || "Missing",
      detail: data.practicum_record
        ? `${data.practicum_record.completed_hours}/${data.practicum_record.required_hours} hours · ${data.practicum_record.document_status}`
        : "No practicum MOA or certificates submitted yet.",
    });
  }
  rows.push({
    label: "Withdrawal",
    icon: LogOut,
    status: data.withdrawal_application?.status || "No request",
    detail: data.withdrawal_application
      ? `Dean: ${data.withdrawal_application.dean_decision} · requirements: ${data.withdrawal_application.requirement_status}`
      : "No withdrawal request is active.",
  });
  if (data.student.enrollment_tag === "AWOL" || data.student.enrollment_tag === "Residency" || data.awol_case || data.residency_record) {
    rows.push({
      label: data.student.enrollment_tag === "Residency" ? "Residency" : "AWOL / Return",
      icon: UserX,
      status: data.residency_record?.status || data.awol_case?.status || data.student.enrollment_tag,
      detail: data.residency_record
        ? `${data.residency_record.term_label} · ${data.residency_record.reason}`
        : data.awol_case?.policy_classification || "Submit the structured return declaration when ready to return.",
    });
  }
  rows.push({
    label: "Graduation Endorsement",
    icon: GraduationCap,
    status: data.graduation_endorsement?.endorsement_status || data.graduation_eligibility?.status || "Needs verification",
    detail: data.graduation_endorsement
      ? `Coursework: ${data.graduation_endorsement.coursework_status} · research: ${data.graduation_endorsement.research_status}`
      : data.graduation_eligibility?.next_action || "No graduation endorsement request submitted yet.",
  });

  return (
    <Card className="p-6">
      <SectionTitle title="Workflow Status" subtitle="Administrative and completion requests currently visible to you" icon={FileText} />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <div key={row.label} className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
                  <Icon className="h-4 w-4 text-brand-700" /> {row.label}
                </span>
                <StatusBadge value={row.status} dot={false} />
              </div>
              <p className="text-xs leading-relaxed text-slate-500">{row.detail}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function MyCoursesPanel({ data, onSaved }) {
  const subjects = data.curriculum_subjects || [];
  const [selected, setSelected] = useState(() => new Set(subjects.filter((item) => item.is_enrolled).map((item) => item.id)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => subjects.reduce((groups, subject) => {
    const category = subject.category || "Other";
    if (!groups[category]) groups[category] = [];
    groups[category].push(subject);
    return groups;
  }, {}), [subjects]);

  useEffect(() => {
    setSelected(new Set(subjects.filter((item) => item.is_enrolled).map((item) => item.id)));
  }, [data.student.id, subjects.filter((item) => item.is_enrolled).map((item) => item.id).join(",")]);

  function toggle(subject) {
    if (subject.is_enrolled || subject.status === "Completed" || !subject.is_offered) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(subject.id)) next.delete(subject.id); else next.add(subject.id);
      return next;
    });
    setMessage("");
  }

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api.saveStudentEnrollment([...selected], data.current_term?.id);
      setMessage(result.message);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not save your current subjects.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <SectionTitle title="My suggested curriculum" subtitle="Add published subjects you are taking this semester. Subjects already on your enrollment record stay locked." icon={BookOpenCheck} />
      <div className="mb-5 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-sm text-slate-700">
        <p className="font-semibold text-ink">{data.current_term?.label || "Current semester"}</p>
        <p className="mt-1 text-xs">Current and completed subjects stay locked as part of your academic record. You may select additional subjects only when they are offered this semester.</p>
      </div>
      {subjects.length ? <div className="space-y-5">
        {Object.entries(grouped).map(([category, rows]) => (
          <section key={category}>
            <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold text-ink">{category}</h3><span className="text-xs text-slate-500">{rows.length} subject{rows.length === 1 ? "" : "s"}</span></div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              {rows.map((subject) => {
                const checked = selected.has(subject.id);
                const disabled = subject.is_enrolled || subject.status === "Completed" || !subject.is_offered;
                return <label key={subject.id} className={`flex items-start gap-3 border-b border-slate-100 p-3 last:border-b-0 ${disabled ? "cursor-not-allowed bg-slate-50/70" : "cursor-pointer transition-colors hover:bg-brand-50/40"}`}>
                  <input type="checkbox" checked={subject.status === "Completed" || checked} onChange={() => toggle(subject)} disabled={disabled} className="mt-1 h-4 w-4 accent-brand-600" aria-label={`Currently enrolled in ${subject.code}`} />
                  <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-ink">{subject.code} · {subject.title}</span><span className="mt-0.5 block text-xs text-slate-500">{subject.units} units · {subject.recommended_term || "No suggested semester"}</span></span>
                  <span className="flex flex-wrap justify-end gap-1.5"><StatusBadge value={subject.status === "Missing" ? "Not taken" : subject.status} dot={false} /><StatusBadge value={subject.is_offered ? "Offered" : "Not offered"} dot={false} /></span>
                </label>;
              })}
            </div>
          </section>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={busy} className="btn-primary cursor-pointer">{busy ? "Saving…" : "Save current subjects"}</button>
          <p className="text-xs text-slate-500">{selected.size} subject{selected.size === 1 ? "" : "s"} checked for this semester.</p>
        </div>
        {message && <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-800">{message}</p>}
        {error && <ErrorNote>{error}</ErrorNote>}
      </div> : <EmptyState icon={BookOpenCheck} title="No curriculum is available" hint="Ask the Academic Coordinator to confirm your curriculum version." />}
    </Card>
  );
}


function StudentPolicyAssistant() {
  const maxQuestionLength = 1500;
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.studentAssistantSuggestions().then((response) => setSuggestions(response.items || [])).catch(() => setSuggestions([]));
  }, []);

  async function ask(event) {
    event?.preventDefault();
    const cleanQuestion = question.trim();
    if (!cleanQuestion) {
      setError("Enter a question before sending.");
      return;
    }
    if (cleanQuestion.length > maxQuestionLength) {
      setError(`Keep your question under ${maxQuestionLength.toLocaleString()} characters.`);
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(await api.studentAssistant(cleanQuestion));
    } catch (err) {
      setError(err.message || "The policy assistant could not answer right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-12">
      <Card className="p-6 lg:col-span-8">
        <SectionTitle title="Student Policy Assistant" subtitle="Ask about the Graduate School manual, student procedures, or your own academic record" icon={Bot} />
        <div className="mb-4 flex gap-3 rounded-xl border border-brand-100 bg-brand-50/50 p-4 text-xs leading-relaxed text-slate-600">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          <p><span className="font-semibold text-ink">Private and read-only.</span> The assistant can use approved handbook content and the academic record connected to your signed-in account. It cannot see other students or change grades, enrollment, requests, or official records.</p>
        </div>
        <form onSubmit={ask} className="space-y-3">
          <Field label="Your question">
            <Textarea
              value={question}
              maxLength={maxQuestionLength}
              aria-describedby="student-assistant-character-count"
              onChange={(event) => {
                setQuestion(event.target.value);
                if (error) setError("");
              }}
              placeholder="What should I do next based on my record?"
            />
            <p id="student-assistant-character-count" className="mt-1 text-right text-xs text-slate-400">{question.length.toLocaleString()} / {maxQuestionLength.toLocaleString()}</p>
          </Field>
          <button type="submit" disabled={busy || !question.trim()} className="btn-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"><Send className="h-4 w-4" />{busy ? "Checking…" : "Ask assistant"}</button>
        </form>
        {error && <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>}
        {result && (
          <div className="mt-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{result.answer}</p>
            {result.citations?.length > 0 && <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Manual references</p><ul className="mt-2 space-y-2">{result.citations.map((item) => <li key={item.id} className="text-xs text-slate-600"><span className="font-semibold text-ink">{item.title}</span> · {item.source}</li>)}</ul></div>}
          </div>
        )}
      </Card>
      <Card className="p-5 lg:col-span-4">
        <h3 className="text-sm font-semibold text-ink">Suggested questions</h3>
        <div className="mt-3 space-y-2">{suggestions.map((item) => <button key={item} type="button" disabled={busy} onClick={() => { setQuestion(item); setError(""); }} className="w-full cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60">{item}</button>)}</div>
      </Card>
    </div>
  );
}

function RequestCenter({ data, onSaved, focusedRequest }) {
  const [active, setActive] = useState(focusedRequest || "research");
  const allRequests = REQUEST_GROUPS.flatMap((group) => group.items);
  const activeRequest = allRequests.find((r) => r.id === active) || allRequests[0];
  const ActiveIcon = activeRequest?.icon || Send;
  const activeLocked = activeRequest?.lockedWhen?.(data);

  useEffect(() => {
    if (focusedRequest) setActive(focusedRequest);
  }, [focusedRequest]);

  return (
    <Card className="p-6">
      <SectionTitle title="Request Center" subtitle="Choose the request that matches your current status" icon={Send} />
      {!focusedRequest && <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
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
      </div>}
      <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <ActiveIcon className="h-4 w-4 text-brand-700" /> {activeRequest?.label}
        </div>
        {STUDENT_MESSAGE_SLUG_BY_VIEW[active] && <StudentClarificationPanel slug={STUDENT_MESSAGE_SLUG_BY_VIEW[active]} data={data} onSaved={onSaved} />}
        {activeLocked ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 text-slate-400" />
            <p>{activeRequest.lockedReason}</p>
          </div>
        ) : (
          <>
            {active === "research" && <ResearchRequestForm data={data} onSaved={onSaved} />}
            {active === "loa" && <LoaRequestForm data={data} semesters={data.future_semesters || []} onSaved={onSaved} />}
            {active === "readmission" && <ReadmissionRequestForm data={data} onSaved={onSaved} />}
            {active === "awol" && <AwolReturnRequestForm data={data} onSaved={onSaved} />}
            {active === "withdrawal" && <WithdrawalRequestForm data={data} onSaved={onSaved} />}
            {active === "practicum" && <PracticumRequestForm data={data} onSaved={onSaved} />}
            {active === "graduation" && <GraduationRequestForm data={data} onSaved={onSaved} />}
            {active === "schedule" && <ScheduleRequestForm studentId={data.student.id} onSaved={onSaved} />}
          </>
        )}
      </div>
    </Card>
  );
}

function StudentClarificationPanel({ slug, data, onSaved }) {
  const messages = (data.workflow_messages || [])
    .filter((item) => item.transaction_slug === slug)
    .sort((left, right) => new Date(left.created_at || 0) - new Date(right.created_at || 0));
  const replyableRoles = new Set(["Graduate School Staff", "Academic Coordinator", "Research Coordinator", "Dean"]);
  const openReturns = messages.filter((item) => item.recipient_role === "Student" && item.status === "Open" && item.action_type === "return");
  const latestReturn = openReturns.at(-1) || null;
  const latestStaffMessage = messages.filter((item) => item.recipient_role === "Student" && replyableRoles.has(item.sender_role)).at(-1) || null;
  const replyTarget = latestReturn || latestStaffMessage;
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!messages.length) return null;

  async function respond() {
    if (!replyTarget) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(slug, {
        action_type: "response",
        recipient_role: replyTarget.sender_role,
        template: "Remarks",
        comment,
        reply_to_message_id: replyTarget.id,
      });
      setNotice(result.message);
      setComment("");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your clarification response.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Request discussion">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><MessageSquare className="h-4 w-4 text-brand-700" /> Request discussion</p>
          <p className="mt-1 text-xs text-slate-500">Messages and replies are shown chronologically. The newest post is highlighted in green.</p>
        </div>
        {latestReturn?.requires_document_resubmission && <span className="rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-bold text-red-700 ring-1 ring-red-200">New PDF required</span>}
      </div>
      {latestReturn?.requires_document_resubmission && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Step 1 has been reopened. Upload a replacement graduation application PDF before resubmitting.</p>}
      <WorkflowDiscussion
        messages={messages}
        title="Request discussion"
        embedded
        showHeader={false}
        highlightLatest
      />
      {replyTarget && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <label className="block text-xs font-semibold text-slate-700" htmlFor={`${slug}-clarification-response`}>Reply to {replyTarget.sender_name || replyTarget.sender_role}</label>
          <textarea id={`${slug}-clarification-response`} value={comment} onChange={(event) => setComment(event.target.value)} className="field-input mt-1 min-h-24 bg-white" placeholder="Explain what you updated or ask a follow-up question." />
          <ErrorNote message={error} />
          {notice && <p aria-live="polite" className="mt-2 text-sm font-semibold text-emerald-700">{notice}</p>}
          <button type="button" disabled={busy || !comment.trim()} onClick={respond} className="btn-primary mt-3 cursor-pointer"><Send className="h-4 w-4" /> {busy ? "Sending…" : "Send reply"}</button>
        </div>
      )}
    </section>
  );
}

function StudentInbox({ data, onSaved, onOpenRequest }) {
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const allMessages = [...(data.workflow_messages || [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
  const supportedMessagingWorkflows = ["leave-of-absence", "readmission", "awol", "practicum", "withdrawal", "graduation"];
  const activeWorkflowSet = new Set([
    data.practicum_record && "practicum",
    data.withdrawal_application && "withdrawal",
    data.graduation_endorsement && "graduation",
    data.awol_case && "awol",
    ...(data.logs || []).map((item) => item.transaction_slug),
    ...allMessages.map((item) => item.transaction_slug),
  ].filter(Boolean));
  const activeWorkflows = supportedMessagingWorkflows.filter((slug) => activeWorkflowSet.has(slug));
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [composeWorkflow, setComposeWorkflow] = useState(activeWorkflows[0] || "");
  const [composeRecipient, setComposeRecipient] = useState("Graduate School Staff");
  const [question, setQuestion] = useState("");
  const [questionBusy, setQuestionBusy] = useState(false);
  const messages = workflowFilter === "all"
    ? allMessages
    : allMessages.filter((message) => message.transaction_slug === workflowFilter);
  const threads = useMemo(() => {
    const grouped = new Map();
    messages.forEach((message) => {
      const key = message.thread_key || `${message.transaction_slug}:${message.request_id || data.student.id}`;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(message);
    });
    return [...grouped.entries()]
      .map(([key, items]) => ({
        key,
        items,
        latestAt: items[items.length - 1]?.created_at,
        unread: items.filter((item) => item.is_unread).length,
      }))
      .sort((a, b) => new Date(b.latestAt || 0) - new Date(a.latestAt || 0));
  }, [messages, data.student.id]);
  const currentOwner = (data.logs || []).find((log) => log.transaction_slug === composeWorkflow)?.next_owner;
  const recipientOptions = [...new Set([
    "Graduate School Staff",
    currentOwner && currentOwner !== "Student" ? currentOwner : null,
  ].filter(Boolean))];

  useEffect(() => {
    if (!activeWorkflows.includes(composeWorkflow)) setComposeWorkflow(activeWorkflows[0] || "");
  }, [activeWorkflows.join("|"), composeWorkflow]);

  useEffect(() => {
    if (!recipientOptions.includes(composeRecipient)) setComposeRecipient(recipientOptions[0] || "Graduate School Staff");
  }, [composeWorkflow, currentOwner]);

  useEffect(() => {
    const unreadIds = messages.filter((message) => message.is_unread).map((message) => message.id);
    if (!unreadIds.length) return;
    let active = true;
    api.markWorkflowMessagesRead(unreadIds)
      .then(() => {
        if (active) onSaved();
      })
      .catch(() => {
        // Reading a thread must never block the Inbox itself.
      });
    return () => {
      active = false;
    };
  }, [messages.map((message) => `${message.id}:${message.is_unread}`).join("|")]);

  function requestLabel(slug) {
    const labels = {
      "leave-of-absence": "Leave of Absence",
      readmission: "Readmission",
      "course-audit": "Course Audit / Grades",
      awol: "AWOL / Residency",
      practicum: "Practicum",
      withdrawal: "Withdrawal",
      graduation: "Graduation",
    };
    return labels[slug] || slug || "Request";
  }

  function canReply(message) {
    return message.recipient_role === "Student" && message.sender_role !== "Student";
  }

  async function sendReply(message, key) {
    const comment = (drafts[key] || "").trim();
    if (!comment) return;
    setBusyId(key);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(message.transaction_slug, {
        action_type: "response",
        recipient_role: message.sender_role || "Graduate School Staff",
        template: "Remarks",
        comment,
        reply_to_message_id: message.id,
      });
      setDrafts((current) => ({ ...current, [key]: "" }));
      setNotice(result.message || "Reply sent.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your reply.");
    } finally {
      setBusyId(null);
    }
  }

  async function sendQuestion(event) {
    event.preventDefault();
    if (!composeWorkflow || !question.trim()) return;
    setQuestionBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(composeWorkflow, {
        action_type: "note",
        recipient_role: composeRecipient,
        template: "Remarks",
        comment: question.trim(),
      });
      setQuestion("");
      setNotice(result.message || "Question sent.");
      onSaved();
    } catch (err) {
      setError(err.message || "Could not send your question.");
    } finally {
      setQuestionBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <SectionTitle title="Inbox / Messages" subtitle="Clarifications and staff replies for your requests" icon={Mail} />
      <ErrorNote message={error} />
      {notice && <p aria-live="polite" className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{notice}</p>}
      {activeWorkflows.length > 0 && (
        <form onSubmit={sendQuestion} className="mb-5 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-start gap-3">
            <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Ask about an active request</p>
              <p className="mt-1 text-xs text-slate-500">Your question is saved in the request thread and routed to the current reviewer when available.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Field label="Workflow">
                  <Select value={composeWorkflow} onChange={(event) => setComposeWorkflow(event.target.value)} placeholder="" options={activeWorkflows.map((slug) => ({ value: slug, label: requestLabel(slug) }))} />
                </Field>
                <Field label="Recipient">
                  <Select value={composeRecipient} onChange={(event) => setComposeRecipient(event.target.value)} placeholder="" options={recipientOptions} />
                </Field>
              </div>
              <Field label="Question or clarification">
                <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Write your question about this request." />
              </Field>
              <button type="submit" disabled={questionBusy || !question.trim()} className="btn-primary mt-3 cursor-pointer">
                <Send className="h-4 w-4" /> {questionBusy ? "Sending..." : "Send question"}
              </button>
            </div>
          </div>
        </form>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-slate-600" htmlFor="student-inbox-workflow-filter">Filter messages</label>
        <select id="student-inbox-workflow-filter" value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} className="field-input w-auto min-w-44 cursor-pointer">
          <option value="all">All workflows</option>
          <option value="leave-of-absence">Leave of Absence</option>
          <option value="readmission">Readmission</option>
          <option value="course-audit">Course Audit / Grades</option>
          <option value="awol">AWOL / Residency</option>
          <option value="practicum">Practicum</option>
          <option value="withdrawal">Withdrawal</option>
          <option value="graduation">Graduation</option>
        </select>
      </div>
      {!threads.length ? (
        <EmptyState icon={Mail} title="No messages in this view" hint="Clarification requests, sent questions, and staff replies will appear here." />
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => {
            const first = thread.items[0];
            const latest = thread.items[thread.items.length - 1];
            const targetView = STUDENT_REQUEST_VIEW_BY_SLUG[first.transaction_slug];
            return (
              <section key={thread.key} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
                        <MessageSquare className="h-4 w-4 text-brand-700" />
                        {requestLabel(first.transaction_slug)} request #{first.request_id || "current"}
                      </span>
                      <StatusBadge value={`${thread.items.length} message${thread.items.length === 1 ? "" : "s"}`} dot={false} />
                      {thread.unread > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold text-white">{thread.unread} unread</span>}
                    </div>
                    <p className="mt-1 text-xs font-medium text-slate-500">Chronological request thread · current stage {latest.stage || latest.new_status || "not recorded"}</p>
                  </div>
                  {targetView && (
                    <button type="button" onClick={() => onOpenRequest(targetView)} className="btn-secondary shrink-0 cursor-pointer">
                      Open request <ArrowRight className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="mt-4">
                  <WorkflowDiscussion
                    messages={thread.items}
                    embedded
                    showHeader={false}
                    title={`${requestLabel(first.transaction_slug)} discussion`}
                    highlightLatest
                    renderMessageFooter={(message, key) => canReply(message) ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <label className="text-xs font-semibold text-slate-600" htmlFor={`student-inbox-reply-${key}`}>Reply to {message.sender_name || message.sender_role || "staff"}</label>
                        <textarea id={`student-inbox-reply-${key}`} value={drafts[key] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} className="field-input mt-1 min-h-24" placeholder="Explain what you updated or ask a follow-up question." />
                        <button type="button" disabled={busyId === key || !(drafts[key] || "").trim()} onClick={() => sendReply(message, key)} className="btn-primary mt-3 cursor-pointer">
                          <Send className="h-4 w-4" /> {busyId === key ? "Sending..." : "Send reply"}
                        </button>
                      </div>
                    ) : null}
                  />
                </div>
              </section>
            );
          })}
        </div>
      )}
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
  const progress = data.research_progress || {};
  const milestone = progress.milestone || {};
  const gate = progress.gate || milestone.value || "";
  // Treat the backend placeholder as empty, and never overwrite a title the student
  // has typed or that was auto-filled from Form 1. A data refresh after each upload
  // must not wipe it — otherwise submitting fails with "Enter the research title".
  const PENDING_TITLE = "Research title pending Form 1 submission";
  const savedTitle = data.research_case?.title && data.research_case.title !== PENDING_TITLE ? data.research_case.title : "";
  const [form, setForm] = useState({ research_title: savedTitle, submitted_package: "" });
  const { busy, error, message, submit } = useSubmitRequest("research-gate", onSaved);
  const [prefillNote, setPrefillNote] = useState("");
  const uploadRequirements = (milestone.requirements || []).filter((item) => item.student_upload);
  const managedRequirements = (milestone.requirements || []).filter((item) => !item.student_upload);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      research_title: current.research_title && current.research_title !== PENDING_TITLE ? current.research_title : savedTitle,
    }));
  }, [data.student.id, savedTitle]);

  function set(key) {
    return (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: data.student.id,
      research_title: form.research_title,
      submitted_package: form.submitted_package,
    });
  }

  async function handleEvidenceSaved(result, requirement) {
    if (requirement?.item_name === "Form 1 - Application for Title Defense" && result?.research_title) {
      setForm((current) => ({ ...current, research_title: result.research_title }));
      setPrefillNote(`Auto-filled from ${result.document?.evidence_reference || "the uploaded Form 1"}.`);
    }
    await onSaved();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-brand-200 bg-brand-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[11px] font-bold uppercase tracking-wide text-brand-600">Automatically detected stage</p><p className="mt-1 font-display text-xl font-semibold text-ink">{progress.stage || "Title Defense"}</p><p className="mt-1 text-xs text-slate-600">{milestone.description}</p></div><StatusBadge value={progress.status || "Pending"} dot={false} /></div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><div className="rounded-lg bg-white/80 px-3 py-2"><p className="text-[11px] font-bold uppercase text-slate-400">Research title</p><p className="mt-1 text-sm font-semibold text-ink">{data.research_case?.title || "Complete Form 1 to set the title"}</p></div><div className="rounded-lg bg-white/80 px-3 py-2"><p className="text-[11px] font-bold uppercase text-slate-400">Adviser</p><p className="mt-1 text-sm font-semibold text-ink">{data.student.adviser_name || "Not assigned"}</p></div></div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        {(progress.stages || []).map((stage, index) => <div key={stage.name} className={`rounded-lg border px-2.5 py-2 text-xs font-semibold ${index === progress.stage_index ? "border-brand-300 bg-brand-50 text-brand-700" : stage.complete ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-400"}`}>{stage.name}</div>)}
      </div>
      {progress.stage === "Title Defense" && (
        <Field label="Research title from uploaded Form 1" hint="This fills automatically after the Form 1 application PDF is uploaded below.">
          <Input value={form.research_title} onChange={set("research_title")} required placeholder="Upload Form 1 below to auto-fill" />
          {prefillNote && <p className="mt-1 text-xs font-medium text-brand-700">{prefillNote}</p>}
        </Field>
      )}
      <div>
        <p className="field-label">Files you upload</p>
        <p className="mb-2 text-xs text-slate-500">Only these items require action from you for this milestone.</p>
        <div className="space-y-2">
          {uploadRequirements.map((requirement) => (
            <ResearchEvidenceUpload
              key={requirement.item_name}
              gate={gate}
              requirement={requirement}
              panelLocked={Boolean(data.panel?.length)}
              onSaved={(result) => handleEvidenceSaved(result, requirement)}
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
        disabled={!milestone?.student_uploads_ready || (progress.stage === "Title Defense" && !form.research_title.trim())}
        label={`Submit ${milestone?.short_label || "milestone"} for review`}
        disabledHint={!milestone?.student_uploads_ready ? "Upload all required files before submitting this milestone." : progress.stage === "Title Defense" && !form.research_title.trim() ? "Upload Form 1 so the research title can be read automatically." : ""}
      />
    </form>
  );
}

function ResearchEvidenceUpload({ gate, requirement, panelLocked, onSaved }) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [checkingId, setCheckingId] = useState(null);
  const [error, setError] = useState("");
  const needed = requirement.required_file_count;
  const files = requirement.files || [];
  const titlePackageItem = requirement.item_name === "Form 1 - Application for Title Defense" || requirement.item_name === "Three concept papers";
  const titlePackageLocked = panelLocked && titlePackageItem;
  const replacesExistingUpload = requirement.item_name === "Ethics Clearance";

  async function upload(file) {
    if (titlePackageLocked) {
      setError("Title-defense uploads are locked because a panel has already been matched.");
      return;
    }
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await api.uploadResearchEvidence(gate, requirement.item_name, file);
      await onSaved(result);
    } catch (err) {
      setError(err.message || "Could not upload this evidence.");
    } finally {
      setBusy(false);
    }
  }

  async function removeResearchFile(file) {
    if (titlePackageLocked) return;
    const confirmed = await confirm({
      title: "Remove file?",
      message: `Remove "${file.name}"? This will clear the current Panel Matching result for this stage.`,
      confirmLabel: "Remove file",
      tone: "danger",
    });
    if (!confirmed) return;
    setRemovingId(file.id);
    setError("");
    try {
      await api.deleteResearchEvidence(file.id);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not remove this concept paper.");
    } finally {
      setRemovingId(null);
    }
  }

  async function checkConceptPaper(file) {
    setCheckingId(file.id);
    setError("");
    try {
      await api.evaluateConceptPaper(file.id);
      await onSaved();
    } catch (err) {
      setError(err.message || "Could not check concept paper compliance.");
    } finally {
      setCheckingId(null);
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
          <label className={`btn-ghost ${titlePackageLocked ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
          {titlePackageLocked ? <Lock className="h-4 w-4" /> : <FileUp className="h-4 w-4" />} {titlePackageLocked ? "Locked after panel match" : busy ? "Uploading..." : replacesExistingUpload && files.length ? "Replace PDF" : files.length >= needed ? "Add another" : "Upload PDF"}
          <input type="file" accept="application/pdf,.pdf" className="hidden" disabled={busy || titlePackageLocked} onChange={(e) => upload(e.target.files?.[0])} />
          </label>
        </div>
      </div>
      {files.length > 0 && (
        <div className="mt-2 space-y-2">
          {files.map((file) => (
            <div key={file.id} className="rounded-lg bg-slate-50 p-2 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
                  <a href={file.url} target="_blank" rel="noreferrer" className="inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50">
                    {file.name}<Eye className="h-3.5 w-3.5" />
                  </a>
                  {requirement.student_upload && (
                    <button type="button" onClick={() => removeResearchFile(file)} disabled={titlePackageLocked || removingId === file.id} className="inline-flex cursor-pointer items-center border-l border-slate-200 px-2 text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" aria-label={`Remove ${file.name}`} title={titlePackageLocked ? "Locked after panel matching" : "Remove upload"}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
                {file.compliance_status && (
                  <div className="flex items-center gap-2">
                    <StatusBadge value={file.compliance_status} dot={false} />
                    {Number.isFinite(file.compliance_score) && <span className="text-xs font-semibold text-slate-500">{file.compliance_score}%</span>}
                  </div>
                )}
                {requirement.item_name === "Three concept papers" && (
                  <button type="button" onClick={() => checkConceptPaper(file)} disabled={checkingId === file.id} className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs">
                    {checkingId === file.id ? "Checking..." : file.compliance_status ? "Recheck" : "Check compliance"}
                  </button>
                )}
              </div>
              {file.compliance && <ConceptPaperCompliance compliance={file.compliance} />}
            </div>
          ))}
        </div>
      )}
      {titlePackageItem && files.length > 0 && <p className={`mt-2 text-xs ${titlePackageLocked ? "font-semibold text-brand-700" : "text-slate-500"}`}>{titlePackageLocked ? "This title-defense package is read-only because a panel has already been matched." : "Removing Form 1 or any concept paper revokes the Academic Coordinator endorsement and clears Panel Matching. The complete title-defense package must be endorsed again."}</p>}
      {error && <p className="mt-2 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}

function ConceptPaperCompliance({ compliance }) {
  const checks = compliance.checks || [];
  const citations = compliance.citations || [];
  return (
    <details className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-slate-700">
        {compliance.summary || "View concept paper compliance check"}
      </summary>
      <div className="mt-2 space-y-2">
        {checks.length > 0 && (
          <div className="grid gap-1.5 sm:grid-cols-2">
            {checks.map((check) => (
              <div key={check.id} className="rounded-md border border-slate-100 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700">{check.label}</span>
                  <StatusBadge value={check.status} dot={false} />
                </div>
                {check.evidence && <p className="mt-1 text-slate-500">{check.evidence}</p>}
              </div>
            ))}
          </div>
        )}
        {citations.length > 0 && (
          <div>
            <p className="font-bold uppercase tracking-wide text-slate-400">Sources</p>
            <div className="mt-1 space-y-1">
              {citations.slice(0, 3).map((citation) => (
                <p key={citation.id} className="rounded-md bg-slate-50 px-2 py-1.5 text-slate-500">
                  <span className="font-semibold text-slate-700">{citation.source}</span>: {citation.text}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function LoaRequestForm({ data, semesters = [], onSaved }) {
  const studentId = data.student.id;
  const confirm = useConfirm();
  const onLeave = data.student.standing === "On Leave" || data.student.enrollment_tag === "LOA" || data.student.current_stage === "LOA";
  const latestLoaLog = (data.logs || []).find((item) => item.transaction_slug === "leave-of-absence");
  const [form, setForm] = useState({
    effective_start: "",
    effective_end: "",
    reason_category: "",
    reason_remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("leave-of-absence", onSaved);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState("");
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: studentId, ...form });
  }

  // The structured request is recorded in the workflow log. The student's
  // standing remains the source of truth for an approved leave.
  const status = onLeave
    ? "On Leave"
    : latestLoaLog?.new_status || (latestLoaLog?.result === "LOA application submitted" ? "Submitted" : "Not Submitted");
  const loaSteps = loaTimelineSteps(status);
  const applicationEditable = !onLeave && ["Not Submitted", "Denied", "Returned", "Returned for Revision", "Withdrawn"].includes(status);
  const canWithdraw = ["Submitted", "Dean Review"].includes(status);

  async function withdrawPendingApplication() {
    const accepted = await confirm({
      title: "Withdraw pending LOA application?",
      message: "This stops the current review before the Dean decides. It does not change your academic standing, and you may submit a new application.",
      confirmLabel: "Withdraw application",
      tone: "danger",
    });
    if (!accepted) return;
    setWithdrawing(true);
    setWithdrawError("");
    try {
      await api.withdrawStudentLoaRequest();
      await onSaved();
    } catch (err) {
      setWithdrawError(err.message || "Could not withdraw the application.");
    } finally {
      setWithdrawing(false);
    }
  }

  return (
    <div className="space-y-4">
      <WorkflowTimeline steps={loaSteps} title="Leave of Absence timeline" />

      <StageCard
        number={1}
        title="Leave of Absence Application"
        state={applicationEditable ? "active" : "complete"}
        helper={applicationEditable
          ? "Complete the structured fields below. No PDF upload or RAG document extraction is required."
          : onLeave ? "Your leave application is approved and your studies are paused." : "Your structured application is saved and awaiting the next reviewer."}
      >
        {applicationEditable ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Leave starts (semester)" required>
                <Select value={form.effective_start} onChange={(event) => setForm((current) => ({ ...current, effective_start: event.target.value, effective_end: current.effective_end || event.target.value }))} placeholder="Select semester" options={semesters} required />
              </Field>
              <Field label="Leave ends (semester)" required>
                <Select value={form.effective_end} onChange={set("effective_end")} placeholder="Select semester" options={semesters} required />
              </Field>
            </div>
            <Field label="Reason category" required>
              <Select value={form.reason_category} onChange={set("reason_category")} placeholder="Choose an allowed reason" options={data.loa_allowed_reasons || []} required />
            </Field>
            <Field label="Circumstances / remarks" required>
              <Textarea value={form.reason_remarks} onChange={set("reason_remarks")} required />
            </Field>
            <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800"><span className="font-semibold">Policy format:</span> one or two consecutive semesters, beginning in the upcoming semester or later. Staff run a deterministic checklist before forwarding the request to the Dean.</div>
            <SubmitState busy={busy} error={error} message={message} disabled={!form.effective_start || !form.effective_end || !form.reason_category || !form.reason_remarks.trim()} disabledHint="Complete all structured LOA fields before submitting." label="Submit LOA application" />
          </form>
        ) : null}
        {canWithdraw && (
          <div className="space-y-2">
            <button type="button" onClick={withdrawPendingApplication} disabled={withdrawing} className="btn-ghost cursor-pointer text-red-700 hover:bg-red-50">
              <LogOut className="h-4 w-4" /> {withdrawing ? "Withdrawing…" : "Withdraw pending application"}
            </button>
            <ErrorNote message={withdrawError} />
          </div>
        )}
      </StageCard>

      <StageCard
        number={2}
        title="Staff Intake and Dean Review"
        state={onLeave ? "complete" : "pending"}
        helper={onLeave
          ? "Graduate School staff checked eligibility, the Dean approved the leave, and your standing was updated."
          : "After you submit, Graduate School staff check your LOA eligibility and forward it to the Dean for a decision."}
      />

      <StageCard
        number={3}
        title="On Leave Status"
        state={onLeave ? "complete" : "locked"}
        helper={onLeave
          ? "Your status is On Leave. When your leave ends, open Readmission to return to active status."
          : "Your record changes to On Leave when the Dean approves the request."}
      />
    </div>
  );
}

function ReadmissionRequestForm({ data, onSaved }) {
  const requirements = data.readmission_requirements || [];
  const semesters = data.future_semesters || [];
  const allSemesters = data.semester_options || [];
  const [form, setForm] = useState({
    target_return_term: "",
    previous_loa_start: "",
    previous_loa_end: "",
    return_intent: "",
  });
  const [selectedItems, setSelectedItems] = useState([]);
  const { busy, error, message, submit } = useSubmitRequest("readmission", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form, readmission_items: selectedItems });
  }

  const toggleItem = (item) => setSelectedItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  const complete = Boolean(
    form.target_return_term
    && form.previous_loa_start
    && form.previous_loa_end
    && form.return_intent.trim()
    && requirements.every((item) => selectedItems.includes(item))
  );

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Return semester" required>
          <Select value={form.target_return_term} onChange={set("target_return_term")} placeholder="Select semester" options={semesters} required />
        </Field>
        <Field label="Previous LOA start" required>
          <Select value={form.previous_loa_start} onChange={(event) => setForm((current) => ({ ...current, previous_loa_start: event.target.value, previous_loa_end: current.previous_loa_end || event.target.value }))} placeholder="Select semester" options={allSemesters} required />
        </Field>
        <Field label="Previous LOA end" required>
          <Select value={form.previous_loa_end} onChange={set("previous_loa_end")} placeholder="Select semester" options={allSemesters} required />
        </Field>
      </div>
      <Field label="Intention and readiness to resume studies" required>
        <Textarea value={form.return_intent} onChange={set("return_intent")} placeholder="State that you intend to return and briefly explain your readiness to continue the program." required />
      </Field>
      {requirements.length > 0 && (
        <div>
          <p className="field-label">Readmission checklist</p>
          <div className="mt-2 space-y-1.5">
            {requirements.map((item) => (
              <label key={item} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <input type="checkbox" checked={selectedItems.includes(item)} onChange={() => toggleItem(item)} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
                {item}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800">This structured form is checked with fixed rules. It does not upload or analyze a letter with RAG.</div>
      <SubmitState busy={busy} error={error} message={message} disabled={!complete} disabledHint={!complete ? "Complete the semester fields, return intention, and every checklist item." : ""} label="Submit readmission request" />
    </form>
  );
}

function AwolReturnRequestForm({ data, onSaved }) {
  const existing = data.awol_case;
  const student = data.student;
  const semesters = data.upcoming_semesters || [];
  const allSemesters = data.semester_options || [];
  const [form, setForm] = useState({
    target_return_term: "",
    last_enrolled_term: existing?.last_enrolled_term || "",
    return_intent: existing?.return_intent || "",
    return_reason: existing?.return_reason || "",
  });
  const { busy, error, message, submit } = useSubmitRequest("awol-return", onSaved);
  const locked = existing && ["Dean Review", "Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"].includes(existing.status);

  function onSubmit(event) {
    event.preventDefault();
    submit({ student_id: data.student.id, ...form });
  }

  return (
    <div className="space-y-4">
      {existing && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">Current AWOL return case</p><p className="mt-1 text-xs text-slate-500">{existing.policy_classification || "Policy review pending"}</p></div><StatusBadge value={existing.status} dot={false} /></div>
          {existing.years_in_program !== null && existing.years_in_program !== undefined && <p className="mt-3 text-sm text-slate-600">Years in program: {existing.years_in_program} · normal limit {existing.normal_residence_years} · absolute limit {existing.absolute_residence_years}</p>}
          {existing.detection_source && <p className="mt-2 text-xs text-slate-500">Detected from: {existing.detection_source}</p>}
        </div>
      )}
      {(student.standing === "AWOL" || student.enrollment_tag === "AWOL") && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Your record was automatically flagged AWOL from an official standing or full-semester withdrawal without approved LOA. Registration privileges remain restricted until your return request is reviewed.
        </div>
      )}
      {student.enrollment_tag === "Residency" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          You are enrolled in residency without subjects for an approved academic purpose. Check the workflow status for the recorded semester and purpose.
        </div>
      )}
      {locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your structured return declaration has already been routed for review. Watch the Inbox for the Dean's decision or a revision request.</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            The handbook requires a written intention to enroll routed through the Graduate School Dean. Complete it here as structured fields; no PDF upload or RAG analysis is used.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intended return semester" required><Select value={form.target_return_term} onChange={(event) => setForm((current) => ({ ...current, target_return_term: event.target.value }))} placeholder="Select semester" options={semesters} required /></Field>
            <Field label="Last enrolled semester"><Select value={form.last_enrolled_term} onChange={(event) => setForm((current) => ({ ...current, last_enrolled_term: event.target.value }))} placeholder="Select semester" options={allSemesters} /></Field>
          </div>
          <Field label="Written intention to resume enrollment" required><Textarea value={form.return_intent} onChange={(event) => setForm((current) => ({ ...current, return_intent: event.target.value }))} placeholder="I intend to resume enrollment in the selected semester…" required /></Field>
          <Field label="Reason for returning and readiness to continue" required><Textarea value={form.return_reason} onChange={(event) => setForm((current) => ({ ...current, return_reason: event.target.value }))} required /></Field>
          <SubmitState busy={busy} error={error} message={message} disabled={!form.target_return_term || !form.return_intent.trim() || !form.return_reason.trim()} disabledHint={!form.target_return_term ? "Choose your intended return semester." : "Complete the written intention and return reason."} label={existing?.status === "Returned for Revision" ? "Resubmit return declaration" : "Submit return declaration"} />
        </form>
      )}
    </div>
  );
}

function StageCard({ number, title, state = "locked", helper = "", children }) {
  const styles = {
    active: "border-brand-300 bg-white",
    complete: "border-brand-200 bg-brand-50/40",
    pending: "border-amber-200 bg-amber-50/40",
    returned: "border-red-200 bg-red-50/40",
    rejected: "border-red-300 bg-red-50/70",
    locked: "border-slate-200 bg-slate-50/60",
  };
  const labels = { active: "Current stage", complete: "Completed", pending: "Pending review", returned: "Needs revision", rejected: "Rejected", locked: "Locked" };
  return (
    <section className={`rounded-2xl border p-4 ${styles[state] || styles.locked}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${state === "active" ? "bg-brand-600 text-white" : ["returned", "rejected"].includes(state) ? "bg-red-100 text-red-700" : state === "complete" ? "bg-brand-100 text-brand-700" : "bg-slate-200 text-slate-500"}`}>{number}</span>
          <div><h3 className="text-sm font-semibold text-ink">{title}</h3>{helper && <p className="mt-1 text-xs leading-relaxed text-slate-500">{helper}</p>}</div>
        </div>
        <StatusBadge value={labels[state] || state} dot={false} />
      </div>
      {children && <div className="mt-4 border-t border-slate-200/80 pt-4">{children}</div>}
    </section>
  );
}

function SavedWorkflowFiles({ files = [], empty = "No files submitted yet." }) {
  if (!files.length) return <p className="text-xs text-slate-500">{empty}</p>;
  return (
    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Already submitted</p>
      <ul className="space-y-2">
        {files.map((file) => (
          <li key={file.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-700">{file.name}</p><p className="text-xs text-slate-400">Uploaded by {file.uploaded_by || "Uploader not recorded"} · {formatDate(file.uploaded_at)}{file.stage ? ` · ${file.stage}` : ""}</p></div>
            {file.file_exists !== false ? <a href={file.url} target="_blank" rel="noreferrer" className="btn-ghost cursor-pointer px-3 py-1.5"><Eye className="h-3.5 w-3.5" /> View file</a> : <span className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700">File unavailable</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function WithdrawalRequestForm({ data, onSaved }) {
  const existing = data.withdrawal_application;
  const activeSubjects = (data.subject_enrollments || []).filter((item) => ["Enrolled", "Current"].includes(item.status));
  const eligibleSubjects = activeSubjects.filter((item) => item.withdrawal_eligible);
  const [form, setForm] = useState({
    reason: existing?.reason || "",
    subject_enrollment_id: existing?.subject_enrollment_id || eligibleSubjects[0]?.id || "",
  });
  const { busy, error, message, submit } = useSubmitRequest("withdrawal", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form });
  }

  const status = existing?.status || "Not Submitted";
  const returned = ["Returned", "Returned for Clarification"].includes(status) && existing?.dean_decision !== "Approved";
  const applicationEditable = !existing || returned;
  const denied = existing?.dean_decision === "Denied" || status === "Denied";
  const staffForwarded = !["Not Submitted", "Submitted to GS Staff", "Returned", "Returned for Clarification"].includes(status);
  const deanPending = status === "Dean Review";
  const deanApproved = existing?.dean_decision === "Approved";
  const subjectTagged = ["Subject Tagged - Registrar Preparation", "Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"].includes(status);
  const excelReady = ["Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed"].includes(status);
  const sentToRegistrar = ["Sent to Registrar", "Withdrawn Confirmed"].includes(status);
  const selectedSubject = activeSubjects.find((item) => String(item.id) === String(form.subject_enrollment_id));
  const withdrawalSteps = withdrawalTimelineSteps(status);

  useEffect(() => {
    setForm({
      reason: existing?.reason || "",
      subject_enrollment_id: existing?.subject_enrollment_id || eligibleSubjects[0]?.id || "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at, eligibleSubjects[0]?.id]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current subject withdrawal stage</p><p className="mt-1 text-xs text-slate-500">This process applies to one subject only and never changes your active program standing.</p></div><StatusBadge value={status} dot={false} /></div></div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
        <p className="font-semibold">Penalty-free withdrawal window</p>
        <p className="mt-1 text-xs leading-relaxed text-emerald-800">You may withdraw before classes begin or during the first seven calendar days of class. Once approved and forwarded, the subject carries no grade, academic penalty, or transcript mark.</p>
      </div>
      <StageCard number={1} title="Send Withdrawal Request" state={applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={applicationEditable ? "Choose one eligible enrolled subject and state the reason for withdrawing." : "Your selected subject and reason are saved and read-only."}>
        {applicationEditable ? (
          <div className="space-y-4">
            <Field label="Enrolled subject" required>
              <select className="field-input cursor-pointer" value={form.subject_enrollment_id} onChange={set("subject_enrollment_id")} required>
                <option value="">Choose an eligible enrolled subject</option>
                {activeSubjects.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.withdrawal_eligible}>
                    {item.course_code} — {item.course_title} · {item.term_label}
                    {item.withdrawal_eligible ? ` · ELIGIBLE UNTIL ${item.withdrawal_window?.deadline || "semester deadline"}` : " · WITHDRAWAL WINDOW CLOSED"}
                  </option>
                ))}
              </select>
              {selectedSubject?.withdrawal_window && (
                <div
                  role="status"
                  className={`mt-3 flex items-start gap-3 rounded-xl border px-4 py-4 ${
                    selectedSubject.withdrawal_eligible
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-red-300 bg-red-50 text-red-950"
                  }`}
                >
                  <CalendarClock className={`mt-0.5 h-5 w-5 shrink-0 ${selectedSubject.withdrawal_eligible ? "text-emerald-700" : "text-red-700"}`} aria-hidden="true" />
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider">
                      {selectedSubject.withdrawal_eligible ? "Penalty-free withdrawal deadline" : "Withdrawal availability"}
                    </p>
                    <p className="mt-1 text-lg font-extrabold leading-tight">
                      {selectedSubject.withdrawal_eligible
                        ? `Eligible until ${formatDate(selectedSubject.withdrawal_window.deadline)}`
                        : "Withdrawal window closed"}
                    </p>
                    <p className="mt-1 text-xs font-semibold opacity-80">
                      {selectedSubject.withdrawal_window.status}
                      {selectedSubject.withdrawal_window.term_start_date
                        ? ` · Classes begin ${formatDate(selectedSubject.withdrawal_window.term_start_date)}`
                        : ""}
                    </p>
                  </div>
                </div>
              )}
              {!eligibleSubjects.length && <p role="alert" className="mt-2 text-xs font-semibold text-amber-700">No active subject is currently inside the penalty-free withdrawal window. Contact Graduate School staff if the recorded semester dates are incorrect.</p>}
            </Field>
            <Field label="Reason for withdrawing from this subject" required>
              <Textarea value={form.reason} onChange={set("reason")} required />
            </Field>
            <SubmitState
              busy={busy}
              error={error}
              message={message}
              disabled={!form.subject_enrollment_id || !selectedSubject?.withdrawal_eligible}
              disabledHint={!eligibleSubjects.length ? "No subject is currently eligible for penalty-free withdrawal." : !form.subject_enrollment_id ? "Choose an eligible enrolled subject before submitting." : ""}
              label={returned ? "Resubmit subject withdrawal" : "Send withdrawal request"}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-ink">{existing?.subject?.course_code || "Subject pending"} — {existing?.subject?.course_title || "Selected subject"}</p>
            <p className="text-sm text-slate-600">{existing?.effective_term || existing?.subject?.term_label || "Semester pending"} · submitted {formatDate(existing?.created_at)}</p>
            <div className="flex items-start gap-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-950">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Eligibility recorded at submission</p>
                <p className="mt-1 text-base font-extrabold">Eligible until {formatDate(existing?.withdrawal_window?.deadline)}</p>
                <p className="mt-1 text-xs font-semibold text-emerald-800">{existing?.withdrawal_window?.status || "Penalty-free eligibility recorded"}</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">{existing?.reason || "No reason recorded."}</p>
          </div>
        )}
      </StageCard>
      <StageCard number={2} title="GS Staff Forwards Request to Dean" state={status === "Submitted to GS Staff" ? "pending" : staffForwarded || denied ? "complete" : returned ? "returned" : "locked"} helper={status === "Submitted to GS Staff" ? "Graduate School staff is recording your structured request and forwarding it to the Dean." : staffForwarded || denied ? "Graduate School staff forwarded the request to the Dean." : "Available after Step 1 is submitted."} />
      <StageCard number={3} title="Dean Reviews Request" state={denied ? "rejected" : deanPending ? "pending" : deanApproved ? "complete" : "locked"} helper={denied ? "The Dean denied this request. The subject remains enrolled and your record is unchanged." : deanPending ? "The Dean is reviewing the selected subject, request date, and eligibility window." : deanApproved ? "The Dean approved the request and returned it to Graduate School staff for subject tagging." : "Available after GS Staff forwards the request."} />
      <StageCard number={4} title="GS Staff Tags Subject as Withdrawn" state={subjectTagged ? "complete" : deanApproved ? "pending" : "locked"} helper={subjectTagged ? `${existing?.subject?.course_code || "The selected subject"} now shows Withdrawn in Official Offered Subjects, with no grade or academic penalty. Your other subjects and active program standing remain unchanged.` : deanApproved ? "Graduate School staff must tag you as Withdrawn from the selected subject before any Registrar Excel list can be prepared." : denied ? "This step does not open for a denied request." : "Available after Dean approval."} />
      <StageCard number={5} title="GS Staff Exports Approved Excel List" state={excelReady ? "complete" : subjectTagged ? "pending" : "locked"} helper={excelReady ? "Your tagged withdrawal was included in the Excel list for the Registrar." : subjectTagged ? "The official subject status is updated, so Graduate School staff can now prepare the Excel list." : "Available after GS Staff tags the selected subject as Withdrawn."} />
      <StageCard number={6} title="GS Staff Forwards List to Registrar" state={sentToRegistrar ? "complete" : excelReady ? "pending" : "locked"} helper={sentToRegistrar ? "Graduate School staff recorded the Registrar handoff." : excelReady ? "The Excel list is ready for Graduate School staff to forward to the Registrar." : "Available after the approved list is exported."} />
      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} />}
      <WorkflowTimeline steps={withdrawalSteps} title="Detailed withdrawal timeline" />
    </form>
  );
}

function PracticumRequestForm({ data, onSaved }) {
  const existing = data.practicum_record;
  const eligibility = data.practicum_eligibility || {};
  const status = existing?.status || "Not Submitted";
  const latestReturn = (data.workflow_messages || []).find((message) => message.transaction_slug === "practicum" && message.recipient_role === "Student" && message.action_type === "return" && message.status === "Open");
  const newOrganizationRequired = status === "Not Accepted - New Organization Required";
  const returned = status === "Returned for Clarification" || newOrganizationRequired;
  const completionStatuses = new Set(["Practicum In Progress", "Hours Incomplete", "Additional Certificates Requested"]);
  const returnedToCompletion = returned && !newOrganizationRequired && (["Practicum In Progress", "Hours Incomplete", "Documents Submitted", "Documents Under Review", "Additional Certificates Requested", "Completed"].includes(latestReturn?.previous_status) || Boolean(existing?.certificate_attachment));
  const eligibilityReady = eligibility.eligible || Boolean(existing);
  const moaEditable = eligibilityReady && (!existing || (returned && !returnedToCompletion));
  const completionEditable = completionStatuses.has(status) || returnedToCompletion;
  const moaPending = ["MOA Submitted", "MOA Received", "MOA Under Review"].includes(status);
  const documentsPending = ["Documents Submitted", "Documents Under Review"].includes(status);
  const reviewComplete = ["Completed", "Report Sent to Dean", "Dean Reviewed"].includes(status);
  const completionPreviouslySubmitted = Boolean(existing?.certificate_attachment) && !moaPending && !newOrganizationRequired;
  const additionalCompletionPdfRequired = ["Hours Incomplete", "Additional Certificates Requested"].includes(status);
  const [form, setForm] = useState({
    attachment_id: existing?.moa_attachment?.id || null,
    certificate_attachment_id: additionalCompletionPdfRequired ? null : existing?.certificate_attachment?.id || null,
    practicum_site: existing?.practicum_site || "",
    supervisor_name: existing?.supervisor_name || "",
    required_hours: existing?.required_hours || 200,
    completed_hours: existing?.completed_hours || 0,
    remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("practicum", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    setForm({
      attachment_id: existing?.moa_attachment?.id || null,
      certificate_attachment_id: additionalCompletionPdfRequired ? null : existing?.certificate_attachment?.id || null,
      practicum_site: existing?.practicum_site || "",
      supervisor_name: existing?.supervisor_name || "",
      required_hours: existing?.required_hours || 200,
      completed_hours: existing?.completed_hours || 0,
      remarks: "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at, additionalCompletionPdfRequired]);

  function onSubmit(e) {
    e.preventDefault();
    submit({
      student_id: data.student.id,
      ...form,
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current practicum stage</p><p className="mt-1 text-xs text-slate-500">Only the requirements due now can be edited. Completed submissions stay available below.</p></div><StatusBadge value={status} dot={false} /></div></div>

      <StageCard number={1} title="Eligibility Check / Pre-Practicum Requirements" state={eligibilityReady ? "complete" : "pending"} helper={existing ? "The eligibility gate was completed for this request. The values below continue to reflect the latest monitoring and research records." : "Automatically checked from your monitoring sheet and research milestones."}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
          <div><p className="text-sm font-semibold text-ink">Eligibility recommendation</p><p className="text-xs text-slate-500">Based on the encoded course audit and research milestone records.</p></div>
          <StatusBadge value={eligibility.eligible ? "Verified" : eligibility.status || "Needs verification"} dot={false} />
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {(eligibility.checklist || []).map((item) => {
            const actual = String(item.actual_value ?? item.actual ?? "No source data");
            const value = item.required_value != null ? `${actual} / ${item.required_value}` : actual;
            return (
              <div key={item.key} className="grid gap-2 border-b border-slate-100 px-3 py-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:gap-4">
                <div className="min-w-0"><p className="text-sm font-semibold text-slate-700">{item.label}</p><p className="truncate text-xs text-slate-400">Source: {item.source_field || "Not recorded"}</p></div>
                <p className="whitespace-nowrap text-sm font-bold text-slate-700">{value}</p>
                <StatusBadge value={item.passed === true ? "Verified" : item.passed === false ? "Not eligible" : "Needs verification"} dot={false} />
              </div>
            );
          })}
        </div>
      </StageCard>

      <StageCard number={2} title="MOA Submission" state={moaEditable ? (returned ? "returned" : "active") : moaPending ? "pending" : existing?.moa_attachment ? "complete" : "locked"} helper={!eligibilityReady ? "Available after the eligibility requirements in Step 1 are verified." : moaEditable ? "What you need to submit now: practicum site details and the signed MOA PDF." : moaPending ? "Your MOA is saved and waiting for staff / Academic Coordinator review." : "Completed MOA information is read-only while you continue to the next stage."}>
        {moaEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Practicum site / company" required><Input value={form.practicum_site} onChange={set("practicum_site")} required /></Field><Field label="Supervisor name"><Input value={form.supervisor_name} onChange={set("supervisor_name")} /></Field></div><RequestPdfUpload requestType="practicum" label="Practicum MOA PDF" initialAttachment={existing?.moa_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add a message for the staff reviewing this submission." /></Field><SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the practicum MOA before submitting." : ""} label={returned ? "Resubmit MOA stage" : "Submit MOA stage"} /></div> : <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-400">Practicum site</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.practicum_site || "Not provided"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Supervisor</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.supervisor_name || "Not provided"}</p></div></div>{existing?.moa_attachment && <SavedWorkflowFiles files={[existing.moa_attachment]} />}</div>}
      </StageCard>

      <StageCard number={3} title="Practicum Document Submission" state={completionEditable ? (returned ? "returned" : "active") : documentsPending ? "pending" : completionPreviouslySubmitted ? "complete" : "locked"} helper={completionEditable ? (additionalCompletionPdfRequired ? "What you need to submit now: upload a new PDF for the requested additional certificates. Earlier uploaded PDFs stay in the file history." : "What you need to submit now: completed hours and one PDF containing the required completion documents.") : documentsPending ? "Your completion documents are saved and under review." : newOrganizationRequired || moaPending ? "A replacement or pending MOA must be approved before completion documents can be submitted again." : "Available after the MOA is approved and the practicum is marked in progress."}>
        {completionEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Required hours"><Input type="number" value={form.required_hours} readOnly aria-readonly="true" /></Field><Field label="Completed hours" required><Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required /></Field></div><div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><p className="font-semibold">Certificates are counted automatically</p><p className="mt-1 text-xs text-emerald-700">The system currently detects {existing?.certificate_count || 0} submitted certificate file{existing?.certificate_count === 1 ? "" : "s"}. Uploading an additional file updates this count.</p></div><RequestPdfUpload requestType="practicum" label={additionalCompletionPdfRequired ? "New additional certificates / hours proof PDF" : "Completion certificates / forms / hours proof PDF"} initialAttachment={additionalCompletionPdfRequired ? null : existing?.certificate_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, certificate_attachment_id: attachment?.id || null }))} />{additionalCompletionPdfRequired && existing?.completion_attachments?.length > 0 && <SavedWorkflowFiles files={existing.completion_attachments} empty="No previous practicum files submitted yet." />}<Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add any context the reviewer should see with these files." /></Field><SubmitState busy={busy} error={error} message={message} disabled={!form.certificate_attachment_id} disabledHint={!form.certificate_attachment_id ? "Upload the requested additional PDF before submitting." : ""} label={returned ? "Resubmit completion stage" : "Submit completion stage"} /></div> : existing?.certificate_attachment ? <div className="space-y-3"><p className="text-sm text-slate-600">{existing.completed_hours}/{existing.required_hours} hours · {existing.certificate_count} submitted certificate file{existing.certificate_count === 1 ? "" : "s"}</p><SavedWorkflowFiles files={existing.completion_attachments?.length ? existing.completion_attachments : [existing.certificate_attachment]} /></div> : null}
      </StageCard>

      <StageCard number={4} title="Review / Approval" state={reviewComplete ? "complete" : documentsPending ? "pending" : "locked"} helper={documentsPending ? "Graduate School staff and the Academic Coordinator are checking the submitted hours and documents." : reviewComplete ? "The completion evidence was accepted." : "Available after Step 3 is submitted."} />
      <StageCard number={5} title="Completion / Final Verification" state={status === "Dean Reviewed" ? "complete" : ["Completed", "Report Sent to Dean"].includes(status) ? "pending" : "locked"} helper={status === "Dean Reviewed" ? "Final practicum monitoring review is complete." : status === "Report Sent to Dean" ? "The status report is awaiting Dean review." : "Available after the completion review is approved."} />

      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} empty="No practicum files submitted yet." />}
    </form>
  );
}

function GraduationRequestForm({ data, onSaved }) {
  const existing = data.graduation_endorsement;
  const reviewWindows = data.graduation_review_windows || [];
  const activeReviewWindow = data.graduation_default_review_window || reviewWindows[0] || "";
  const defaultReviewWindow = activeReviewWindow || existing?.review_window || "";
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    attachment_id: existing?.request_attachment?.id || null,
    review_window: defaultReviewWindow,
    remarks: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("graduation", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const eligibility = data.graduation_eligibility || {};
  const status = existing?.endorsement_status || "Not Submitted";
  const exported = existing?.registrar_status === "Exported - Ready to Send";
  const eligibilityReady = Boolean(eligibility.eligible);
  const applicationEditable = eligibilityReady && (!existing || ["Not Eligible", "Returned for Clarification"].includes(status));
  const returned = status === "Returned for Clarification";
  const missing = [
    ...(eligibility.missing_coursework || []).map((item) => `Coursework: ${item}`),
    ...(eligibility.missing_research_requirements || []).map((item) => `Research: ${item}`),
    ...(eligibility.missing_practicum_requirement ? [`Practicum: ${eligibility.missing_practicum_requirement}`] : []),
  ];

  function onSubmit(e) {
    e.preventDefault();
    submit({ student_id: data.student.id, ...form });
  }

  useEffect(() => setForm({ attachment_id: existing?.request_attachment?.id || null, review_window: defaultReviewWindow, remarks: "" }), [data.student.id, existing?.id, existing?.updated_at, defaultReviewWindow]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current graduation stage</p><p className="mt-1 text-xs text-slate-500">Your application stays visible while each reviewing office completes its part.</p></div><StatusBadge value={status} dot={false} /></div></div>
      <StageCard number={1} title="Application / Review Window" state={!eligibilityReady && !existing ? "locked" : applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={!eligibilityReady && !existing ? "This step opens only after coursework, research, completion documents, and any required practicum are complete." : applicationEditable ? "What you need to submit now: the review window and signed graduation application / review-window PDF." : "Your submitted application is saved and read-only during review."}>
        {applicationEditable ? <div className="space-y-4"><Field label="Graduation school year" hint={`Only ${activeReviewWindow || "the active school year"} is open. Other school years are shown in gray and cannot be selected.`} required><Select value={form.review_window} onChange={set("review_window")} options={reviewWindowOptions} placeholder="" required /></Field><RequestPdfUpload requestType="graduation" label="Signed graduation application / review-window PDF" initialAttachment={existing?.request_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} placeholder="Add a message to the staff reviewing your graduation submission." /></Field><SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the signed graduation application PDF before submitting Step 1." : ""} label={returned || status === "Not Eligible" ? "Resubmit graduation application" : "Submit graduation application"} /></div> : existing ? <div className="space-y-3"><p className="text-sm font-semibold text-ink">{existing.review_window}</p><SavedWorkflowFiles files={existing.attachments || []} /></div> : <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">Complete the requirements listed in Step 3 before submitting a graduation application.</p>}
      </StageCard>
      {applicationEditable && existing?.attachments?.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <SavedWorkflowFiles files={existing.attachments} empty="No prior graduation application files." />
        </div>
      )}
      <StageCard number={2} title="Staff and Coursework Review" state={["For Review", "Coursework Review"].includes(status) ? "pending" : ["Research Review", "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved"].includes(status) ? "complete" : "locked"} helper={["For Review", "Coursework Review"].includes(status) ? "Graduate School staff and the Academic Coordinator are reviewing your coursework record." : "This stage opens after the application is submitted."} />
      <StageCard number={3} title="Requirements Validation" state={["Research Review", "Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status) ? "pending" : ["Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved"].includes(status) ? "complete" : status === "Not Eligible" ? "returned" : "locked"} helper={status === "Not Eligible" ? "Resolve the listed missing requirements before resubmitting your application." : "Coursework, research, practicum, and completion records are checked here."}>
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">Monitoring eligibility recommendation</p><StatusBadge value={eligibility.status || (eligibility.eligible ? "Eligible" : "Needs verification")} dot={false} /></div>{missing.length ? <ul className="mt-2 space-y-1 text-xs text-slate-500">{missing.slice(0, 8).map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No missing requirements are currently flagged by the monitoring layer.</p>}</div>
      </StageCard>
      <StageCard number={4} title="Dean Endorsement" state={status === "Returned for Revision" ? "returned" : status === "Ready for Dean Review" ? "pending" : status === "Dean Approved" ? "complete" : "locked"} helper={status === "Returned for Revision" ? "The endorsement list was returned to staff for correction. Your own submission remains saved." : status === "Ready for Dean Review" ? "The prepared endorsement is awaiting Dean action." : "Available after eligibility is confirmed and staff prepares the endorsement."} />
      <StageCard number={5} title="Endorsement Export" state={exported ? "complete" : status === "Dean Approved" ? "pending" : "locked"} helper={exported ? "The Dean-approved endorsed list has been exported for the external Registrar process." : status === "Dean Approved" ? "The Dean-approved list is ready for export." : "Available after Dean approval."} />
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

function RequestPdfUpload({ requestType, label, onUploaded, initialAttachment = null }) {
  const [attachment, setAttachment] = useState(initialAttachment);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setAttachment(initialAttachment), [initialAttachment?.id]);

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
      {attachment && attachment.file_exists !== false && <a href={attachment.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700"><Eye className="h-3.5 w-3.5" /> View uploaded application</a>}
      {attachment?.file_exists === false && <p className="mt-2 text-xs font-semibold text-red-600">The saved file is unavailable. Upload the PDF again before submitting.</p>}
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
        <HistoryDisclosure label="View logs" hideLabel="Hide logs" count={visibleLogs.length}>
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
        </HistoryDisclosure>
      ) : (
        <EmptyState title="No activity yet" />
      )}
    </Card>
  );
}
