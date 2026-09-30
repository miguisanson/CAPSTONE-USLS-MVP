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
  Users,
} from "lucide-react";
import { Card, PageHeader, SectionTitle, StatusBadge } from "../../components/ui";
import { useStudentPortal } from "./StudentPortalContext";
import { STUDENT_MESSAGE_SLUG_BY_VIEW, StudentClarificationPanel, StudentSchedulePanel, isLiveSchedule } from "./shared";
import { ResearchRequestForm, ScheduleRequestForm } from "./ResearchForms";
import PolicyRules from "../../components/PolicyRules";

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
import { REQUEST_GROUPS, STUDENT_REQUEST_PATHS, findRequestItem, lockedReasonFor } from "./requestMeta";
import { leaveRequestStatus } from "./LeaveCaseCards";

const REQUEST_PAGES = {
  research: {
    title: "Research",
    description: "Upload your milestone files, submit them for review, and follow your title, proposal and final defense requirements.",
    icon: FileCheck,
    render: (data, onSaved) => <ResearchRequestForm data={data} onSaved={onSaved} />,
  },
  schedule: {
    title: "Defense Schedule",
    description: "Request a defense date once your panel is matched. The Research Coordinator confirms a time shared by your adviser and panel.",
    icon: CalendarCheck,
    render: (data, onSaved) => <ScheduleRequestForm data={data} onSaved={onSaved} />,
  },
  loa: {
    title: "Leave of Absence",
    description: "Ask for a leave of absence, or for more time on a leave you are already on. Graduate School staff check your request, then the Dean decides.",
    icon: CalendarOff,
    render: (data, onSaved) => <LoaRequestForm data={data} semesters={data.future_semesters || []} onSaved={onSaved} />,
  },
  readmission: {
    title: "Readmission",
    description: "Ask to come back to your studies when your leave of absence is ending. Staff check your request, then the Dean decides.",
    icon: UserCheck,
    render: (data, onSaved) => <ReadmissionRequestForm data={data} onSaved={onSaved} />,
  },
  awol: {
    title: "Return from AWOL",
    description: "Submit a written intention to resume enrollment when your record is marked AWOL.",
    icon: UserX,
    render: (data, onSaved) => <AwolReturnRequestForm data={data} onSaved={onSaved} />,
  },
  withdrawal: {
    title: "Subject Withdrawal",
    description: "Withdraw from one enrolled subject until the end of the second week of classes (fees apply). It never changes your program standing.",
    icon: LogOut,
    render: (data, onSaved) => <WithdrawalRequestForm data={data} onSaved={onSaved} />,
  },
  practicum: {
    title: "Practicum",
    description: "Submit your MOA and completion evidence for the practicum requirement (Psychology and MSGC programs).",
    icon: Briefcase,
    render: (data, onSaved) => <PracticumRequestForm data={data} onSaved={onSaved} />,
  },
  graduation: {
    title: "Graduation Endorsement",
    description: "Apply for the Graduate School graduation endorsement once coursework, research and any practicum are complete.",
    icon: GraduationCap,
    render: (data, onSaved) => <GraduationRequestForm data={data} onSaved={onSaved} />,
  },
};

// Human-readable current status of each request, shown in the Request Center.
function requestStatus(id, data) {
  const latestLog = (slug) => (data.logs || []).find((item) => item.transaction_slug === slug);
  switch (id) {
    case "research":
      return data.research_progress?.status || data.research_case?.status || "Not started";
    case "schedule":
      {
      const current = (data.schedules || []).find(isLiveSchedule) || data.schedules?.[0];
      return current?.display_status || current?.status || "No request";
    }
    case "loa":
      return data.leave_overview
        ? leaveRequestStatus(data, "loa")
        : data.student.standing === "On Leave" ? "On Leave" : latestLog("leave-of-absence")?.new_status || "Not submitted";
    case "readmission":
      return data.leave_overview
        ? leaveRequestStatus(data, "readmission")
        : latestLog("readmission")?.new_status || "Not submitted";
    case "awol":
      return data.awol_case?.status || "No request";
    case "withdrawal":
      return data.withdrawal_application?.status || "No request";
    case "practicum":
      return data.practicum_record?.status || "Not submitted";
    case "graduation":
      return data.graduation_endorsement?.endorsement_status || "Not submitted";
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
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={page.title}
        description={page.description}
        icon={Icon}
        badge={<StatusBadge value={requestStatus(id, data)} dot={false} />}
        actions={
          <Link to="/student/requests" className="btn-ghost">
            <ArrowLeft className="h-4 w-4" /> All requests
          </Link>
        }
      />
      {aside}
      <Card className="p-4 sm:p-6">
        {messageSlug && <StudentClarificationPanel slug={messageSlug} data={data} onSaved={refetch} />}
        {STUDENT_RULE_PROCESS_BY_VIEW[id] && <PolicyRules process={STUDENT_RULE_PROCESS_BY_VIEW[id]} className="mb-4" defaultOpen={id === "withdrawal"} />}
        {locked ? (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <p>{lockedReasonFor(item, data)}</p>
          </div>
        ) : (
          page.render(data, refetch)
        )}
      </Card>
    </div>
  );
}

function AdviserPanelCard({ data }) {
  const panel = data.panel || [];
  return (
    <Card className="p-6">
      <SectionTitle
        title="Adviser and panel"
        subtitle="Assigned after Panel Matching; scheduling opens once a panel is in place"
        icon={Users}
        action={<Link to="/student/defense-schedule" className="btn-ghost px-3 py-1.5 text-xs">Defense schedule <ArrowRight className="h-3.5 w-3.5" /></Link>}
      />
      <p className="mb-3 text-sm text-slate-600">Adviser: <span className="font-semibold text-ink">{data.student.adviser_name || data.research_case?.adviser_name || "Not assigned"}</span></p>
      {panel.length ? (
        <ul className="grid gap-2 sm:grid-cols-2">
          {panel.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{member.faculty_name}</p>
                <p className="truncate text-xs text-slate-500">{member.specialization || member.college}</p>
              </div>
              <StatusBadge value={member.panel_role} dot={false} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">No panel has been matched yet. The Research Coordinator does this after your title-defense package is endorsed.</p>
      )}
    </Card>
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
        <div className="grid gap-5 lg:grid-cols-2">
          <AdviserPanelCard data={data} />
          <StudentSchedulePanel schedules={data.schedules || []} />
        </div>
      }
    />
  );
}

export function StudentRequestCenter() {
  const { data } = useStudentPortal();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Request Center"
        description="Every request you can file, with its current status. Choose the one that matches your situation."
        icon={Send}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {REQUEST_GROUPS.map((group) => (
          <Card key={group.title} className="p-5">
            <h2 className="text-base font-semibold text-ink">{group.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{group.description}</p>
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
                        <span className="block truncate text-xs text-slate-500">{locked ? lockedReasonFor(item, data) : requestStatus(item.id, data)}</span>
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
