import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  Clock3,
  Download,
  FileSignature,
  FileText,
  LayoutDashboard,
  Scale,
  Users,
} from "lucide-react";
import { Card, EmptyState, PageHeader, StatusBadge } from "../../components/ui";
import { StatusChip } from "../../components/ui/index.js";
import RoleHome, { MAX_WAITING } from "../../components/RoleHome.jsx";
import { facultyActions, facultyStats, facultyUpcoming, facultyWaiting } from "../../lib/facultyHome.js";
import { firstNameOf } from "../../lib/staffHome.js";
import { formatDate } from "../../lib/format";
import FacultyResearchWorkspace from "../../components/FacultyResearchWorkspace";
import { formatDay, formatTimeRange, useFaculty } from "./FacultyContext";
import { FacultyAdviserPanel } from "./FacultyAdviserPanel";
import { FacultyCalendarConnection } from "./FacultyCalendar";
import { FacultyClasses } from "./FacultyClasses";

function CalendarNotice() {
  const [searchParams] = useSearchParams();
  const calendarNotice = searchParams.get("calendar");
  if (!calendarNotice) return null;
  return (
    <p
      className={`rounded-xl border px-4 py-3 text-sm font-semibold ${
        calendarNotice === "connected"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
      role="status"
    >
      {calendarNotice === "connected"
        ? "Google Calendar connected. Its busy periods are now used for defense scheduling."
        : calendarNotice === "cancelled"
          ? "Google Calendar connection was cancelled."
          : "Google Calendar could not be connected. Please try again."}
    </p>
  );
}

function defenseTime(defense) {
  return `${formatDate(defense.preferred_date)}${defense.start_time ? ` · ${defense.start_time}` : ""}`;
}

export function FacultyDashboard() {
  const { data } = useFaculty();
  const { faculty } = data;
  const actions = facultyActions(data);
  const waiting = facultyWaiting(data);
  const stats = facultyStats(data);
  const upcoming = facultyUpcoming(data).map((entry) => ({
    key: entry.key,
    title: entry.title,
    detail: entry.detail,
    time: `${formatDay(entry.date)} · ${formatTimeRange(entry.start, entry.end)}`,
    to: entry.to,
  }));
  const toRow = (row) => ({
    key: row.key,
    title: row.title,
    detail: row.detail,
    tone: row.tone,
    to: row.target.to,
    linkLabel: row.target.label,
  });
  return (
    <div className="space-y-5">
      <CalendarNotice />
      <RoleHome
        header={{
          title: `Welcome, ${firstNameOf(faculty?.name) || "Faculty"}`,
          description: faculty?.specialization || "Your advisees, panel assignments and defense schedule.",
          icon: LayoutDashboard,
          badge: <StatusChip label={faculty?.college || "College"} tone="muted" dot={false} />,
        }}
        actions={actions.items.map(toRow)}
        actionsSubtitle="Invitations, signatures, verdicts and requests that wait for you"
        actionsEmpty={{ title: "Nothing is waiting on you", hint: "No signatures, verdicts, invitations or adviser requests need you right now." }}
        waiting={{
          title: "Waiting on others",
          subtitle: "The student or the Research Coordinator holds these. Nothing to do until they act.",
          items: waiting.items.map(toRow),
          all: waiting.total > MAX_WAITING ? { to: "/faculty-portal/advisees", label: "View all" } : undefined,
        }}
        stats={stats}
        extra={<FacultyCalendarConnection calendar={faculty?.calendar} />}
        activityTitle="Upcoming defenses"
        activity={upcoming}
        activityAll={{ to: "/faculty-portal/defenses", label: "View schedule" }}
        activityEmpty={{ title: "No defenses scheduled", hint: "Defenses appear here once the Research Coordinator schedules a panel you sit on." }}
      />
    </div>
  );
}

export function FacultyAdviseesPage() {
  const { data } = useFaculty();
  const advisees = data.advisees || [];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My Advisees"
        description="Students you advise, their stage, and the research documents that need your signature."
        icon={Users}
        actions={<Link to="/faculty-portal/signatures" className="btn-ghost"><FileSignature className="h-4 w-4" /> Signatures</Link>}
      />
      <FacultyAdviserPanel />
      <Card className="p-6">
        {advisees.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Documents</th>
                  <th className="px-3 py-2">Needs signature</th>
                </tr>
              </thead>
              <tbody>
                {advisees.map((row) => (
                  <tr key={row.student.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-3"><p className="font-semibold text-ink">{row.student.name}</p><p className="text-xs text-slate-400">{row.student.student_number}</p></td>
                    <td className="px-3 py-3 text-slate-600">{row.student.program_code}</td>
                    <td className="px-3 py-3"><StatusBadge value={row.student.current_stage} dot={false} /></td>
                    <td className="px-3 py-3 text-slate-600">{row.documents.length}</td>
                    <td className="px-3 py-3">{row.pending_count ? <StatusBadge value={`${row.pending_count} pending`} dot={false} /> : <span className="text-xs text-slate-400">None</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={Users} title="No advisees yet" hint="Students appear here once they are assigned to you as their adviser." />
        )}
      </Card>
    </div>
  );
}

export function FacultySignaturesPage() {
  const { data, refetch } = useFaculty();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Signatures & Endorsements"
        description="Review and sign the exact manuscript version uploaded by your assigned advisees."
        icon={FileSignature}
      />
      <FacultyResearchWorkspace advisees={data.advisees || []} panels={data.panels || []} refetch={refetch} view="signatures" />
    </div>
  );
}

export function FacultyPanelsPage() {
  const { data, refetch } = useFaculty();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Panel Assignments & Papers"
        description="Students whose committee you sit on, with the papers for the assigned stage. Access is limited to your assigned panels."
        icon={FileText}
      />
      <FacultyResearchWorkspace advisees={data.advisees || []} panels={data.panels || []} refetch={refetch} view="papers" />
    </div>
  );
}

export function FacultyDefensesPage() {
  const { data } = useFaculty();
  const rows = (data.panels || [])
    .filter((panel) => panel.defense)
    .sort((left, right) => new Date(left.defense.preferred_date || 0) - new Date(right.defense.preferred_date || 0));
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Defense Schedule"
        description="Defenses scheduled for the panels you sit on. Keep your availability current so staff can confirm dates."
        icon={CalendarClock}
        actions={
          <>
            <Link to="/faculty-portal/calendar" className="btn-ghost"><CalendarDays className="h-4 w-4" /> Open my calendar</Link>
            <Link to="/faculty-portal/availability" className="btn-ghost"><Clock3 className="h-4 w-4" /> My availability</Link>
          </>
        }
      />
      <Card className="p-6">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Defense</th>
                  <th className="px-3 py-2">Date / time</th>
                  <th className="px-3 py-2">Mode / venue</th>
                  <th className="px-3 py-2">My role</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Calendar</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((panel) => (
                  <tr key={`${panel.student.id}-${panel.gate}-${panel.panel_role}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-3"><p className="font-semibold text-ink">{panel.student.name}</p><p className="text-xs text-slate-400">{panel.research_title || "Research title pending"}</p></td>
                    <td className="px-3 py-3 text-slate-600">{panel.defense.defense_type}</td>
                    <td className="px-3 py-3 text-slate-600">{defenseTime(panel.defense)}<span className="block text-xs text-slate-400">Philippine time</span></td>
                    <td className="px-3 py-3 text-slate-600">{panel.defense.mode || "-"}{panel.defense.venue ? <span className="block text-xs text-slate-400">{panel.defense.venue}</span> : null}</td>
                    <td className="px-3 py-3"><StatusBadge value={panel.panel_role} dot={false} /></td>
                    <td className="px-3 py-3">
                      <StatusBadge value={panel.defense.display_status || panel.defense.status} dot={false} />
                      {(panel.defense.attention || []).map((note) => (
                        <p key={note} className="mt-1.5 flex max-w-[16rem] items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {note}
                        </p>
                      ))}
                    </td>
                    <td className="px-3 py-3">
                      {panel.defense.ics_url ? (
                        <a href={panel.defense.ics_url} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
                          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Add to calendar
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon={CalendarClock} title="No defenses scheduled" hint="You will see a defense here once the Research Coordinator schedules one for a panel you sit on." />
        )}
      </Card>
    </div>
  );
}

export function FacultyVerdictsPage() {
  const { data, refetch } = useFaculty();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Verdicts"
        description="The panel chair or panel lead submits the final verdict for a scheduled defense. Graduate School staff have read-only access."
        icon={Scale}
      />
      <FacultyResearchWorkspace advisees={data.advisees || []} panels={data.panels || []} refetch={refetch} view="verdicts" />
    </div>
  );
}

export function FacultyClassesPage() {
  const { data } = useFaculty();
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader title="Assigned Classes" description="Class rosters for your assigned subjects." icon={BookOpenCheck} />
      <Card className="p-6">
        <FacultyClasses subjects={data.subjects || []} terms={data.terms || []} />
      </Card>
    </div>
  );
}
