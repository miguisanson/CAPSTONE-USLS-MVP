import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CalendarOff,
  FileCheck,
  GraduationCap,
  LogOut,
  Lock,
  Send,
  UserCheck,
  UserX,
} from "lucide-react";
import { Button, Card, InlineNotice, PageHeader, StatusChip } from "../../components/ui/index.js";
import { useStudentPortal } from "./StudentPortalContext";
import { STUDENT_MESSAGE_SLUG_BY_VIEW, StudentClarificationPanel, StudentSchedulePanel, isLiveSchedule } from "./shared";
import { BOOKABLE_DEFENSES, ResearchRequestForm, ScheduleRequestForm } from "./ResearchForms";
import PolicyRules from "../../components/PolicyRules";
import AdviserPanelCard from "./AdviserPanelCard";

// Which business-rules process each request page applies (shown as "Rules applied").
const STUDENT_RULE_PROCESS_BY_VIEW = {
  research: "research",
  loa: "loa",
  readmission: "readmission",
  awol: "awol_residency",
  withdrawal: "withdrawal",
  practicum: "practicum",
  graduation: "graduation",
  schedule: "defense",
};
import { AwolReturnRequestForm, LoaRequestForm, ReadmissionRequestForm, WithdrawalRequestForm } from "./RequestForms";
import { GraduationRequestForm, PracticumRequestForm } from "./CompletionForms";
import { NOT_SUBMITTED, REQUEST_GROUPS, STUDENT_REQUEST_PATHS, findRequestItem, lockedReasonFor, requestStateLabel } from "./requestMeta";
import { leaveRequestStatus } from "./LeaveCaseCards";
import { PAGE } from "../../lib/labels.js";

const REQUEST_PAGES = {
  research: {
    title: PAGE.researchProgress,
    description: "Upload your milestone files, submit them for review, and follow your title, proposal and final defense requirements.",
    icon: FileCheck,
    render: (data, onSaved) => <ResearchRequestForm data={data} onSaved={onSaved} />,
  },
  schedule: {
    title: PAGE.defenseSchedule,
    description: "Request a defense date once your panel is matched. The Research Coordinator confirms a time shared by your adviser and panel.",
    icon: CalendarCheck,
    render: (data, onSaved) => <ScheduleRequestForm data={data} onSaved={onSaved} />,
  },
  loa: {
    title: PAGE.leaveOfAbsence,
    description: "Ask for a leave of absence, or for more time on a leave you are already on. Graduate School staff check your request, then the Dean decides.",
    icon: CalendarOff,
    render: (data, onSaved) => <LoaRequestForm data={data} semesters={data.future_semesters || []} onSaved={onSaved} />,
  },
  readmission: {
    title: PAGE.readmission,
    description: "Ask to come back to your studies when your leave of absence is ending. Staff check your request, then the Dean decides.",
    icon: UserCheck,
    render: (data, onSaved) => <ReadmissionRequestForm data={data} onSaved={onSaved} />,
  },
  awol: {
    title: PAGE.returnFromAwol,
    description: "Submit a written intention to resume enrollment when your record is marked AWOL.",
    icon: UserX,
    render: (data, onSaved) => <AwolReturnRequestForm data={data} onSaved={onSaved} />,
  },
  withdrawal: {
    title: PAGE.subjectWithdrawal,
    description: "Withdraw from one enrolled subject until the end of the second week of classes (fees apply). It never changes your program standing.",
    icon: LogOut,
    render: (data, onSaved) => <WithdrawalRequestForm data={data} onSaved={onSaved} />,
  },
  practicum: {
    title: PAGE.practicum,
    description: "Submit your MOA and completion evidence for the practicum requirement (Psychology and MSGC programs).",
    icon: Briefcase,
    render: (data, onSaved) => <PracticumRequestForm data={data} onSaved={onSaved} />,
  },
  graduation: {
    title: PAGE.graduationEndorsement,
    description: "Apply for the Graduate School graduation endorsement once coursework, research and any practicum are complete.",
    icon: GraduationCap,
    render: (data, onSaved) => <GraduationRequestForm data={data} onSaved={onSaved} />,
  },
};

// The state of the defense the student is working toward. A booked defense wins; else the latest booking for the stage the
// student is at (deferred, held, cancelled...); a stage with nothing booked yet says "Not submitted", so the title chip never
// shows an earlier defense as "Finished" while the form below asks for the next one (I-086).
function scheduleStatus(data) {
  const schedules = data.schedules || [];
  const stateOf = (schedule) => schedule.display_status || schedule.status;
  const live = schedules.find(isLiveSchedule);
  if (live) return stateOf(live);
  const stage = data.research_progress?.stage;
  const forStage = schedules.find((schedule) => schedule.defense_type === stage);
  if (forStage) return stateOf(forStage);
  if (BOOKABLE_DEFENSES.includes(stage)) return NOT_SUBMITTED;
  return schedules[0] ? stateOf(schedules[0]) : NOT_SUBMITTED;
}

// Human-readable current status of each request, shown in the Request Center.
function requestStatus(id, data) {
  const latestLog = (slug) => (data.logs || []).find((item) => item.transaction_slug === slug);
  switch (id) {
    case "research":
      return data.research_progress?.status || data.research_case?.status || "Not started";
    case "schedule":
      return scheduleStatus(data);
    case "loa":
      return data.leave_overview
        ? leaveRequestStatus(data, "loa")
        : data.student.standing === "On Leave" ? "On Leave" : latestLog("leave-of-absence")?.new_status || NOT_SUBMITTED;
    case "readmission":
      return data.leave_overview
        ? leaveRequestStatus(data, "readmission")
        : latestLog("readmission")?.new_status || NOT_SUBMITTED;
    case "awol":
      return data.awol_case?.status || NOT_SUBMITTED;
    case "withdrawal":
      return data.withdrawal_application?.status || NOT_SUBMITTED;
    case "practicum":
      return data.practicum_record?.status || NOT_SUBMITTED;
    case "graduation":
      return data.graduation_endorsement?.endorsement_status || NOT_SUBMITTED;
    default:
      return "";
  }
}

export function StudentRequestPage({ id, aside = null }) {
  const { data, refetch } = useStudentPortal();
  const page = REQUEST_PAGES[id];
  const item = findRequestItem(id);
  const locked = item?.lockedWhen?.(data);
  const messageSlug = STUDENT_MESSAGE_SLUG_BY_VIEW[id];
  const Icon = page.icon;
  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={page.title}
        description={page.description}
        icon={Icon}
        badge={<StatusChip status={requestStateLabel(requestStatus(id, data))} dot={false} />}
        actions={
          <Button as={Link} to="/student/requests" variant="secondary" icon={ArrowLeft}>
            All requests
          </Button>
        }
      />
      {aside}
      <Card pad="lg">
        {messageSlug && <StudentClarificationPanel slug={messageSlug} data={data} onSaved={refetch} />}
        {STUDENT_RULE_PROCESS_BY_VIEW[id] && <PolicyRules process={STUDENT_RULE_PROCESS_BY_VIEW[id]} className="mb-4" />}
        {locked ? (
          <InlineNotice tone="neutral" icon={Lock}>{lockedReasonFor(item, data)}</InlineNotice>
        ) : (
          page.render(data, refetch)
        )}
      </Card>
    </div>
  );
}

export function StudentResearchPage() {
  const { data } = useStudentPortal();
  return <StudentRequestPage id="research" aside={<AdviserPanelCard data={data} />} />;
}

export function StudentDefensePage() {
  const { data } = useStudentPortal();
  return (
    <StudentRequestPage
      id="schedule"
      aside={
        <>
          <AdviserPanelCard data={data} showSpecialization={false} showScheduleLink={false} />
          <StudentSchedulePanel schedules={data.schedules || []} />
        </>
      }
    />
  );
}

export function StudentRequestCenter() {
  const { data } = useStudentPortal();
  return (
    <div className="page-stack animate-fade-up">
      <PageHeader
        title={PAGE.requestCenter}
        description="Every request you can file, with its current status. Choose the one that matches your situation."
        icon={Send}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {REQUEST_GROUPS.map((group) => (
          <Card key={group.title}>
            <h2 className="card-title">{group.title}</h2>
            <p className="meta mt-1 leading-relaxed">{group.description}</p>
            <ul className="mt-4 space-y-2">
              {group.items.map((item) => {
                const Icon = item.icon;
                const locked = item.lockedWhen?.(data);
                return (
                  <li key={item.id}>
                    <Link
                      to={STUDENT_REQUEST_PATHS[item.id]}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${locked ? "border-slate-200 bg-slate-50/70 text-slate-500 hover:bg-slate-100" : "border-slate-200 bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50/40"}`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${locked ? "bg-slate-100 text-slate-400" : "bg-brand-50 text-brand-700"}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold">{item.label}</span>
                        <span className="meta block">{locked ? lockedReasonFor(item, data) : requestStateLabel(requestStatus(item.id, data))}</span>
                      </span>
                      {locked ? <Lock className="h-4 w-4 shrink-0 text-slate-400" aria-label="Locked" /> : <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
