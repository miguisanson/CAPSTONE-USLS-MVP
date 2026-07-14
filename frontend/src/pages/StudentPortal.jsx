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
} from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { useApi } from "../hooks";
import { Card, EmptyState, ErrorNote, ProgressBar, SectionTitle, Spinner, StatusBadge } from "../components/ui";
import { CheckList, Field, Input, Select, Textarea } from "../components/forms";
import { formatDate, initials, relativeDays } from "../lib/format";
import RoleSidebar from "../components/RoleSidebar";
import WorkflowTimeline, { graduationTimelineSteps, withdrawalTimelineSteps } from "../components/WorkflowTimeline";

const RESEARCH_GATE_KEYS = new Set(["Form 1 - Title Defense", "Form 4 - Proposal Defense Readiness", "Final Defense", "Completion Evidence"]);

const STUDENT_REQUEST_VIEW_BY_SLUG = {
  awol: "awol",
  practicum: "practicum",
  withdrawal: "withdrawal",
  graduation: "graduation",
};

const STUDENT_NAV = [
  { id: "overview", label: "Dashboard / Overview", icon: LayoutDashboard },
  { id: "lifecycle", label: "Lifecycle Status", icon: Activity },
  { id: "courses", label: "My Courses", icon: ClipboardCheck },
  { id: "research", label: "Research Submission", icon: FileCheck },
  { id: "schedule", label: "Defense Schedule", icon: CalendarCheck },
  { id: "loa", label: "Leave of Absence", icon: CalendarOff },
  { id: "readmission", label: "Readmission", icon: UserCheck },
  { id: "awol", label: "Return from AWOL", icon: UserX },
  { id: "practicum", label: "Practicum", icon: Briefcase },
  { id: "withdrawal", label: "Withdrawal Request", icon: LogOut },
  { id: "graduation", label: "Graduation Status", icon: GraduationCap },
  { id: "inbox", label: "Inbox / Messages", icon: Mail },
  { id: "documents", label: "Documents / Submissions", icon: FileUp },
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
      {
        id: "awol",
        label: "Return from AWOL",
        icon: UserX,
        lockedWhen: (data) => data.student.enrollment_tag !== "AWOL" && data.student.standing !== "AWOL",
        lockedReason: "Available only while your student record is marked AWOL.",
      },
      { id: "withdrawal", label: "Withdrawal", icon: LogOut },
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
      <RoleSidebar roleLabel="Student Portal" items={STUDENT_NAV} active={view} onChange={setView} />
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
                {["research", "schedule", "loa", "readmission", "awol", "practicum", "withdrawal", "graduation"].includes(view) && <RequestCenter data={data} onSaved={refetch} focusedRequest={view} />}
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
        : data.awol_case?.policy_classification || "Submit written intent to enroll when ready to return.",
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
  const courses = data.course_records || [];
  const requests = data.course_drop_requests || [];
  const currentCourses = courses.filter((course) => ["Enrolled", "Current", "Incomplete"].includes(course.status) && !course.drop_request);
  const droppable = currentCourses;
  const [activeCourseId, setActiveCourseId] = useState(currentCourses[0]?.course_id || "");
  const [form, setForm] = useState({ reason: "", term_label: "", attachment_id: null });
  const { busy, error, message, submit } = useSubmitRequest("course-drop", onSaved);
  const activeCourse = courses.find((course) => String(course.course_id) === String(activeCourseId));
  const selectedTerm = activeCourse?.term_label || data.current_term?.label || "Current semester";
  const courseStatusLabel = (status) => status === "Missing" ? "Not taken" : status;

  useEffect(() => {
    setActiveCourseId((current) => {
      if (currentCourses.some((course) => String(course.course_id) === String(current))) return current;
      return currentCourses[0]?.course_id || "";
    });
  }, [data.student.id, currentCourses[0]?.course_id]);

  function onSubmit(event) {
    event.preventDefault();
    if (!activeCourse) return;
    submit({
      course_id: activeCourse.course_id,
      term_label: selectedTerm,
      reason: form.reason,
      attachment_id: form.attachment_id,
    });
  }

  return (
    <div className="space-y-5">
      <Card className="p-6">
        <SectionTitle title="My Courses" subtitle="Your current coursework status, grades, and pending drop requests" icon={ClipboardCheck} />
        {courses.length ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5">Subject</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Grade</th>
                  <th className="px-3 py-2.5">Semester</th>
                  <th className="px-3 py-2.5">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((course) => (
                  <tr key={course.id} className="border-b border-slate-50">
                    <td className="px-4 py-2.5"><p className="font-semibold text-ink">{course.code}</p><p className="text-xs text-slate-500">{course.title}</p>{course.drop_request && <p className="mt-1 text-xs font-semibold text-amber-700">Drop request pending</p>}</td>
                    <td className="px-3 py-2.5"><StatusBadge value={courseStatusLabel(course.status)} dot={false} /></td>
                    <td className="px-3 py-2.5"><p className="font-semibold text-ink">{course.grade_value || "No grade"}</p><p className="text-xs text-slate-400">{course.grade_status}</p></td>
                    <td className="px-3 py-2.5 text-slate-600">{course.term_label || "Not recorded"}</td>
                    <td className="px-3 py-2.5 text-slate-600">{course.remarks || (course.incomplete_deadline ? `Incomplete due ${formatDate(course.incomplete_deadline)}` : "—")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={ClipboardCheck} title="No course records yet" hint="Your coursework list appears after Graduate School staff or the Academic Coordinator imports or syncs your curriculum." />
        )}
      </Card>

      <Card className="p-6">
        <SectionTitle title="Drop Subject Request" subtitle="Submitting a request does not change your record until the Academic Coordinator approves it" icon={LogOut} />
        {requests.length > 0 && (
          <div className="mb-4 grid gap-2 md:grid-cols-2">
            {requests.slice(0, 4).map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold text-ink">{request.course_code}</p><StatusBadge value={request.status} dot={false} /></div>
                <p className="mt-1 text-xs text-slate-500">{request.term_label || "No semester recorded"} · {formatDate(request.created_at)}</p>
                {request.reviewer_remarks && <p className="mt-2 text-xs text-slate-600">{request.reviewer_remarks}</p>}
              </div>
            ))}
          </div>
        )}
        {currentCourses.length ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <Field label="Subject to drop" required>
              <Select value={activeCourseId} onChange={(event) => setActiveCourseId(event.target.value)} options={droppable.map((course) => ({ value: course.course_id, label: `${course.code} — ${course.title}` }))} required />
            </Field>
            <Field label="Semester">
              <div className="field-input bg-slate-50 text-slate-600">{selectedTerm}</div>
            </Field>
            <Field label="Reason for dropping" required>
              <Textarea value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} required />
            </Field>
            <RequestPdfUpload requestType="course-drop" label="Optional drop form/supporting PDF" onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} />
            <SubmitState busy={busy} error={error} message={message} disabled={!form.reason.trim()} disabledHint={!form.reason.trim() ? "Enter your reason before submitting." : ""} label="Submit drop request" />
          </form>
        ) : (
          <EmptyState icon={LogOut} title="No currently enrolled subjects" hint="Only enrolled or current subjects can be requested for dropping." />
        )}
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
        {["practicum", "withdrawal", "graduation"].includes(active) && <StudentClarificationPanel slug={active} data={data} onSaved={onSaved} />}
        {activeLocked ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 text-slate-400" />
            <p>{activeRequest.lockedReason}</p>
          </div>
        ) : (
          <>
            {active === "research" && <ResearchRequestForm data={data} onSaved={onSaved} />}
            {active === "loa" && <LoaRequestForm studentId={data.student.id} semesters={data.upcoming_semesters || []} onSaved={onSaved} />}
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
  const messages = (data.workflow_messages || []).filter((item) => item.transaction_slug === slug && item.recipient_role === "Student" && item.status === "Open" && item.action_type === "return");
  const latest = messages[0];
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  if (!latest) return null;

  async function respond() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api.sendWorkflowMessage(slug, {
        action_type: "response",
        recipient_role: latest.sender_role,
        template: "Please clarify request details",
        comment,
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
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-start gap-3"><MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" /><div><p className="text-sm font-semibold text-amber-950">Clarification requested</p><p className="mt-1 text-sm text-amber-800">{latest.template}{latest.comment ? ` · ${latest.comment}` : ""}</p><p className="mt-1 text-xs text-amber-700">From {latest.sender_role} · {formatDate(latest.created_at)}</p></div></div>
      <label className="mt-3 block text-xs font-semibold text-amber-900" htmlFor={`${slug}-clarification-response`}>Your response</label>
      <textarea id={`${slug}-clarification-response`} value={comment} onChange={(event) => setComment(event.target.value)} className="field-input mt-1 min-h-24" placeholder="Explain what you updated or ask a follow-up question." />
      <ErrorNote message={error} />
      {notice && <p aria-live="polite" className="mt-2 text-sm font-semibold text-brand-700">{notice}</p>}
      <button type="button" disabled={busy || !comment.trim()} onClick={respond} className="btn-primary mt-3 cursor-pointer"><Send className="h-4 w-4" /> {busy ? "Sending…" : "Send clarification response"}</button>
    </div>
  );
}

function StudentInbox({ data, onSaved, onOpenRequest }) {
  const [drafts, setDrafts] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const activeWorkflows = [
    data.practicum_record && "practicum",
    data.withdrawal_application && "withdrawal",
    data.graduation_endorsement && "graduation",
  ].filter(Boolean);
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [composeWorkflow, setComposeWorkflow] = useState(activeWorkflows[0] || "");
  const [composeRecipient, setComposeRecipient] = useState("Graduate School Staff");
  const [question, setQuestion] = useState("");
  const [questionBusy, setQuestionBusy] = useState(false);
  const allMessages = [...(data.workflow_messages || [])].sort(
    (a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)
  );
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

  function messageKey(message, index) {
    return message.id || `${message.transaction_slug || "message"}-${index}`;
  }

  function canReply(message) {
    return message.recipient_role === "Student" && message.status === "Open" && message.action_type === "return";
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
        template: "Please clarify request details",
        comment,
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
        template: "Other / Custom comment",
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
                <ol className="mt-4 space-y-3 border-l-2 border-slate-100 pl-4">
                  {thread.items.map((message, index) => {
                    const key = messageKey(message, index);
                    const replyAllowed = canReply(message);
                    return (
                      <li key={key} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-700">{message.template || "Message"}</p>
                          <StatusBadge value={message.status || "Message"} dot={false} />
                        </div>
                        {message.comment && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{message.comment}</p>}
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          {message.sender_name || message.sender_role || "Staff"} ({message.sender_role || "Staff"}) to {message.recipient_role || "Student"} · {formatDate(message.created_at)}
                        </p>
                        {replyAllowed && (
                          <div className="mt-3 border-t border-slate-200 pt-3">
                            <label className="text-xs font-semibold text-slate-600" htmlFor={`student-inbox-reply-${key}`}>Your reply</label>
                            <textarea id={`student-inbox-reply-${key}`} value={drafts[key] || ""} onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))} className="field-input mt-1 min-h-24" placeholder="Explain what you updated or ask a follow-up question." />
                            <button type="button" disabled={busyId === key || !(drafts[key] || "").trim()} onClick={() => sendReply(message, key)} className="btn-primary mt-3 cursor-pointer">
                              <Send className="h-4 w-4" /> {busyId === key ? "Sending..." : "Send reply"}
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
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
    const confirmed = window.confirm(`Remove "${file.name}"? This will clear the current Panel Matching result for this stage.`);
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

function LoaRequestForm({ studentId, semesters = [], onSaved }) {
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
        <Field label="Leave starts (semester)" required>
          <Select value={form.effective_start} onChange={set("effective_start")} placeholder="Select semester" options={semesters} required />
        </Field>
        <Field label="Leave ends (semester)" required>
          <Select value={form.effective_end} onChange={set("effective_end")} placeholder="Select semester" options={semesters} required />
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
  const semesters = data.upcoming_semesters || [];
  const [form, setForm] = useState({
    attachment_id: null,
    target_return_term: "",
    previous_loa_period: "",
  });
  const { busy, error, message, submit } = useSubmitRequest("readmission", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  function onSubmit(e) {
    e.preventDefault();
    // All standard return requirements are taken as included with the uploaded application.
    submit({ student_id: data.student.id, ...form, readmission_items: requirements });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Return semester" required>
          <Select value={form.target_return_term} onChange={set("target_return_term")} placeholder="Select semester" options={semesters} required />
        </Field>
        <Field label="Semester you went on leave">
          <Select value={form.previous_loa_period} onChange={set("previous_loa_period")} placeholder="Select semester" options={semesters} />
        </Field>
      </div>
      {requirements.length > 0 && (
        <div>
          <p className="field-label">Your application should include</p>
          <div className="mt-2 space-y-1.5">
            {requirements.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-slate-600"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> {item}</div>
            ))}
          </div>
        </div>
      )}
      <RequestPdfUpload requestType="readmission" label="Completed readmission application PDF" onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} />
      <SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the completed readmission application before submitting." : ""} label="Submit readmission request" />
    </form>
  );
}

function AwolReturnRequestForm({ data, onSaved }) {
  const existing = data.awol_case;
  const semesters = data.upcoming_semesters || [];
  const [form, setForm] = useState({ attachment_id: null, target_return_term: "", last_enrolled_term: existing?.last_enrolled_term || "" });
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
          {existing.intent_attachment && <SavedWorkflowFiles files={[existing.intent_attachment]} />}
        </div>
      )}
      {(student.standing === "AWOL" || student.enrollment_tag === "AWOL") && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          Your record is currently AWOL and registration privileges are restricted. Use Return from AWOL to submit your written intention to enroll for Dean endorsement.
        </div>
      )}
      {student.enrollment_tag === "Residency" && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
          You are enrolled in residency without subjects for an approved academic purpose. Check the workflow status for the recorded semester and purpose.
        </div>
      )}
      {locked ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Your written intent has already been routed for review. Watch the Inbox for the Dean's decision or a revision request.</div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
            The handbook requires a written intention to enroll addressed to the University Registrar through the Graduate School Dean. Approval may include a refresher-course or full re-enrollment requirement when maximum residence is exceeded.
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Intended return semester" required><Select value={form.target_return_term} onChange={(event) => setForm((current) => ({ ...current, target_return_term: event.target.value }))} placeholder="Select semester" options={semesters} required /></Field>
            <Field label="Last enrolled semester"><Input value={form.last_enrolled_term} onChange={(event) => setForm((current) => ({ ...current, last_enrolled_term: event.target.value }))} placeholder="AY 2025-2026 2nd Semester" /></Field>
          </div>
          <RequestPdfUpload requestType="awol-return" label="Written intent to enroll PDF" initialAttachment={existing?.intent_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} />
          <SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id || !form.target_return_term} disabledHint={!form.attachment_id ? "Upload the written intent PDF before submitting." : !form.target_return_term ? "Choose your intended return semester." : ""} label={existing?.status === "Returned for Revision" ? "Resubmit return intent" : "Submit return intent"} />
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
  const [form, setForm] = useState({
    attachment_id: existing?.request_attachment?.id || null,
    proof_attachment_id: existing?.proof_attachment?.id || null,
    reason: existing?.reason || "",
    effective_term: existing?.effective_term || "",
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
  const reviewPending = ["Submitted to GS Staff", "Dean Review"].includes(status);
  const reviewComplete = existing?.dean_decision === "Approved";
  const followThroughPending = ["Approved - Follow-through", "Coordinator Follow-through Complete"].includes(status);
  const followThroughComplete = [
    "Requirements Pending", "Requirements Submitted", "Requirements Verified",
    "Withdrawn Confirmed",
  ].includes(status);
  const requirementsEditable = reviewComplete && status === "Requirements Pending";
  const requirementsPending = status === "Requirements Submitted";
  const finalPending = ["Requirements Verified"].includes(status);
  const finalComplete = status === "Withdrawn Confirmed";
  const withdrawalSteps = withdrawalTimelineSteps(status);

  useEffect(() => {
    setForm({
      attachment_id: existing?.request_attachment?.id || null,
      proof_attachment_id: existing?.proof_attachment?.id || null,
      reason: existing?.reason || "",
      effective_term: existing?.effective_term || "",
    });
  }, [data.student.id, existing?.id, existing?.updated_at]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current withdrawal stage</p><p className="mt-1 text-xs text-slate-500">Only the requirements due now can be edited. Earlier submissions remain available below.</p></div><StatusBadge value={status} dot={false} /></div></div>
      <StageCard number={1} title="Withdrawal Application" state={applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={applicationEditable ? "What you need to submit now: effective semester, reason, and the signed withdrawal request PDF." : "Your application details and original file are saved and read-only."}>
        {applicationEditable ? <div className="space-y-4"><Field label="Effective semester" required><Input value={form.effective_term} onChange={set("effective_term")} required placeholder="AY 2026-2027 1st Semester" /></Field><Field label="Reason for withdrawal" required><Textarea value={form.reason} onChange={set("reason")} required /></Field><RequestPdfUpload requestType="withdrawal" label="Withdrawal request/form PDF" initialAttachment={existing?.request_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the withdrawal request/form PDF before submitting." : ""} label={returned ? "Resubmit withdrawal request" : "Submit withdrawal request"} /></div> : <div className="space-y-3"><p className="text-sm text-slate-600">Effective {existing?.effective_term || "semester pending"} · submitted {formatDate(existing?.created_at)}</p><p className="text-sm text-slate-600">{existing?.reason || "No reason recorded."}</p>{existing?.request_attachment && <SavedWorkflowFiles files={[existing.request_attachment]} />}</div>}
      </StageCard>
      <StageCard number={2} title="Staff Intake / Dean Review" state={denied ? "rejected" : returned ? "returned" : reviewPending ? "pending" : reviewComplete ? "complete" : "locked"} helper={denied ? "The Dean denied this request. Your lifecycle standing remains active." : returned ? "Review the comments, update Step 1, and resubmit." : reviewPending ? "Graduate School staff and the Dean are reviewing the saved application." : reviewComplete ? "The Dean approved the request for follow-through." : "Available after the application is submitted."} />
      <StageCard number={3} title="Approved Request Follow-through" state={followThroughPending ? "pending" : followThroughComplete ? "complete" : "locked"} helper={followThroughPending ? "The Academic Coordinator and Graduate School staff are recording the approved request and preparing the requirements notice." : followThroughComplete ? "Follow-through is complete and the student requirements stage has opened." : "Available after Dean approval."} />
      <StageCard number={4} title="Withdrawal Requirements" state={requirementsEditable ? "active" : requirementsPending ? "pending" : followThroughComplete ? "complete" : "locked"} helper={requirementsEditable ? "What you need to submit now: the completed withdrawal form, clearance, and supporting proof in one PDF." : requirementsPending ? "Your completed form and proof are saved and waiting for staff verification." : followThroughComplete ? "Submitted requirements remain saved while GS Staff completes verification." : "Available after approved-request follow-through."}>
        {requirementsEditable ? <div className="space-y-4"><RequestPdfUpload requestType="withdrawal" label="Completed withdrawal form and proof PDF" initialAttachment={existing?.proof_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, proof_attachment_id: attachment?.id || null }))} /><SubmitState busy={busy} error={error} message={message} disabled={!form.proof_attachment_id} disabledHint={!form.proof_attachment_id ? "Upload the completed form and proof first." : ""} label={existing?.proof_attachment ? "Resubmit withdrawal requirements" : "Submit withdrawal requirements"} /></div> : existing?.proof_attachment ? <SavedWorkflowFiles files={[existing.proof_attachment]} /> : null}
      </StageCard>
      <StageCard number={5} title="Final GS Staff Confirmation" state={finalComplete ? "complete" : finalPending ? "pending" : "locked"} helper={finalComplete ? "Graduate School staff confirmed the withdrawal and the workflow is complete." : finalPending ? "Graduate School staff are completing the final record and status checks." : "Available after the submitted requirements are verified."} />
      {existing?.attachments?.length > 2 && <SavedWorkflowFiles files={existing.attachments} />}
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
    certificate_count: existing?.certificate_count || 0,
    remarks: existing?.remarks || "",
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
      certificate_count: existing?.certificate_count || 0,
      remarks: existing?.remarks || "",
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
        {moaEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Practicum site / company" required><Input value={form.practicum_site} onChange={set("practicum_site")} required /></Field><Field label="Supervisor name"><Input value={form.supervisor_name} onChange={set("supervisor_name")} /></Field></div><RequestPdfUpload requestType="practicum" label="Practicum MOA PDF" initialAttachment={existing?.moa_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><Field label="Remarks"><Textarea value={form.remarks} onChange={set("remarks")} /></Field><SubmitState busy={busy} error={error} message={message} disabled={!form.attachment_id} disabledHint={!form.attachment_id ? "Upload the practicum MOA before submitting." : ""} label={returned ? "Resubmit MOA stage" : "Submit MOA stage"} /></div> : <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase text-slate-400">Practicum site</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.practicum_site || "Not provided"}</p></div><div><p className="text-xs font-bold uppercase text-slate-400">Supervisor</p><p className="mt-1 text-sm font-semibold text-ink">{existing?.supervisor_name || "Not provided"}</p></div></div>{existing?.moa_attachment && <SavedWorkflowFiles files={[existing.moa_attachment]} />}</div>}
      </StageCard>

      <StageCard number={3} title="Practicum Document Submission" state={completionEditable ? (returned ? "returned" : "active") : documentsPending ? "pending" : completionPreviouslySubmitted ? "complete" : "locked"} helper={completionEditable ? (additionalCompletionPdfRequired ? "What you need to submit now: upload a new PDF for the requested additional certificates. Earlier uploaded PDFs stay in the file history." : "What you need to submit now: completed hours and one PDF containing the required completion documents.") : documentsPending ? "Your completion documents are saved and under review." : newOrganizationRequired || moaPending ? "A replacement or pending MOA must be approved before completion documents can be submitted again." : "Available after the MOA is approved and the practicum is marked in progress."}>
        {completionEditable ? <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Field label="Required hours"><Input type="number" value={form.required_hours} readOnly aria-readonly="true" /></Field><Field label="Completed hours" required><Input type="number" min="0" value={form.completed_hours} onChange={set("completed_hours")} required /></Field><Field label="Number of certificates"><Input type="number" min="0" value={form.certificate_count} onChange={set("certificate_count")} /></Field></div><RequestPdfUpload requestType="practicum" label={additionalCompletionPdfRequired ? "New additional certificates / hours proof PDF" : "Completion certificates / forms / hours proof PDF"} initialAttachment={additionalCompletionPdfRequired ? null : existing?.certificate_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, certificate_attachment_id: attachment?.id || null }))} />{additionalCompletionPdfRequired && existing?.certificate_attachment && <SavedWorkflowFiles files={[existing.certificate_attachment]} empty="No previous practicum files submitted yet." />}<Field label="Remarks for the reviewer"><Textarea value={form.remarks} onChange={set("remarks")} /></Field><SubmitState busy={busy} error={error} message={message} disabled={!form.certificate_attachment_id} disabledHint={!form.certificate_attachment_id ? "Upload the requested additional PDF before submitting." : ""} label={returned ? "Resubmit completion stage" : "Submit completion stage"} /></div> : existing?.certificate_attachment ? <div className="space-y-3"><p className="text-sm text-slate-600">{existing.completed_hours}/{existing.required_hours} hours · {existing.certificate_count} certificate(s)</p><SavedWorkflowFiles files={[existing.certificate_attachment]} /></div> : null}
      </StageCard>

      <StageCard number={4} title="Review / Approval" state={reviewComplete ? "complete" : documentsPending ? "pending" : "locked"} helper={documentsPending ? "Graduate School staff and the Academic Coordinator are checking the submitted hours and documents." : reviewComplete ? "The completion evidence was accepted." : "Available after Step 3 is submitted."} />
      <StageCard number={5} title="Completion / Final Verification" state={status === "Dean Reviewed" ? "complete" : ["Completed", "Report Sent to Dean"].includes(status) ? "pending" : "locked"} helper={status === "Dean Reviewed" ? "Final practicum monitoring review is complete." : status === "Report Sent to Dean" ? "The status report is awaiting Dean review." : "Available after the completion review is approved."} />

      {existing?.attachments?.length > 1 && <SavedWorkflowFiles files={existing.attachments} empty="No practicum files submitted yet." />}
    </form>
  );
}

function GraduationRequestForm({ data, onSaved }) {
  const existing = data.graduation_endorsement;
  const [form, setForm] = useState({
    attachment_id: existing?.request_attachment?.id || null,
    review_window: existing?.review_window || "AY 2026-2027 Graduation Review",
  });
  const { busy, error, message, submit } = useSubmitRequest("graduation", onSaved);
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const eligibility = data.graduation_eligibility || {};
  const status = existing?.endorsement_status || "Not Submitted";
  const applicationEditable = !existing || ["Not Eligible", "Returned for Clarification"].includes(status);
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

  useEffect(() => setForm({ attachment_id: existing?.request_attachment?.id || null, review_window: existing?.review_window || "AY 2026-2027 Graduation Review" }), [data.student.id, existing?.id, existing?.updated_at]);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold text-ink">Current graduation stage</p><p className="mt-1 text-xs text-slate-500">Your application stays visible while each reviewing office completes its part.</p></div><StatusBadge value={status} dot={false} /></div></div>
      <StageCard number={1} title="Application / Review Window" state={applicationEditable ? (returned ? "returned" : "active") : "complete"} helper={applicationEditable ? "What you need to submit now: the review window and any supporting graduation PDF." : "Your submitted application is saved and read-only during review."}>
        {applicationEditable ? <div className="space-y-4"><Field label="Review window / semester" required><Input value={form.review_window} onChange={set("review_window")} required /></Field><RequestPdfUpload requestType="graduation" label="Optional graduation endorsement / supporting PDF" initialAttachment={existing?.request_attachment} onUploaded={(attachment) => setForm((current) => ({ ...current, attachment_id: attachment?.id || null }))} /><SubmitState busy={busy} error={error} message={message} label={returned || status === "Not Eligible" ? "Resubmit graduation application" : "Submit graduation application"} /></div> : <div className="space-y-3"><p className="text-sm font-semibold text-ink">{existing?.review_window}</p><SavedWorkflowFiles files={existing?.attachments || []} /></div>}
      </StageCard>
      <StageCard number={2} title="Staff and Coursework Review" state={["For Review", "Coursework Review"].includes(status) ? "pending" : ["Research Review", "Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved", "Sent to Registrar"].includes(status) ? "complete" : "locked"} helper={["For Review", "Coursework Review"].includes(status) ? "Graduate School staff and the Academic Coordinator are reviewing your coursework record." : "This stage opens after the application is submitted."} />
      <StageCard number={3} title="Requirements Validation" state={["Research Review", "Coursework Incomplete", "Research Incomplete", "Practicum Incomplete"].includes(status) ? "pending" : ["Eligibility Confirmed", "Endorsement Prepared", "Ready for Dean Review", "Returned for Revision", "Dean Approved", "Sent to Registrar"].includes(status) ? "complete" : status === "Not Eligible" ? "returned" : "locked"} helper={status === "Not Eligible" ? "Resolve the listed missing requirements before resubmitting your application." : "Coursework, research, practicum, and completion records are checked here."}>
        <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-ink">Monitoring eligibility recommendation</p><StatusBadge value={eligibility.status || (eligibility.eligible ? "Eligible" : "Needs verification")} dot={false} /></div>{missing.length ? <ul className="mt-2 space-y-1 text-xs text-slate-500">{missing.slice(0, 8).map((item) => <li key={item}>• {item}</li>)}</ul> : <p className="mt-2 text-xs text-slate-500">No missing requirements are currently flagged by the monitoring layer.</p>}</div>
      </StageCard>
      <StageCard number={4} title="Dean Endorsement" state={status === "Returned for Revision" ? "returned" : status === "Ready for Dean Review" ? "pending" : ["Dean Approved", "Sent to Registrar"].includes(status) ? "complete" : "locked"} helper={status === "Returned for Revision" ? "The endorsement list was returned to staff for correction. Your own submission remains saved." : status === "Ready for Dean Review" ? "The prepared endorsement is awaiting Dean action." : "Available after eligibility is confirmed and staff prepares the endorsement."} />
      <StageCard number={5} title="Endorsement Export" state={status === "Sent to Registrar" ? "complete" : status === "Dean Approved" ? "pending" : "locked"} helper={status === "Sent to Registrar" ? "The Dean-approved endorsed list has been exported for the external graduation process." : status === "Dean Approved" ? "The Dean-approved list is ready for export." : "Available after Dean approval."} />
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
