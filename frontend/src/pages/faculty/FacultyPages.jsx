import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  BookOpenCheck,
  CalendarCheck2,
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
import { Button, Card, DataTable, InlineNotice, PageHeader, StatusChip } from "../../components/ui/index.js";
import RoleHome, { MAX_WAITING } from "../../components/RoleHome.jsx";
import { facultyActions, facultyStats, facultyUpcoming, facultyWaiting } from "../../lib/facultyHome.js";
import { firstNameOf } from "../../lib/staffHome.js";
import { formatDate } from "../../lib/format";
import FacultyResearchWorkspace from "../../components/FacultyResearchWorkspace";
import { formatDay, formatTimeRange, useFaculty } from "./FacultyContext";
import { FacultyAdviserPanel } from "./FacultyAdviserPanel";
import { FacultyClasses } from "./FacultyClasses";

function CalendarNotice() {
  const [searchParams] = useSearchParams();
  const calendarNotice = searchParams.get("calendar");
  if (!calendarNotice) return null;
  return (
    <InlineNotice tone={calendarNotice === "connected" ? "success" : "warning"}>
      {calendarNotice === "connected"
        ? "Google Calendar connected. Its busy periods are now used for defense scheduling."
        : calendarNotice === "cancelled"
          ? "Google Calendar connection was cancelled."
          : "Google Calendar could not be connected. Please try again."}
    </InlineNotice>
  );
}

// I-085: Google OAuth cannot be completed in a demo, so the home only points to the connection card, which lives
// on My Availability. A small line, never the biggest element on the page.
function CalendarLink({ calendar }) {
  return (
    <p className="meta flex flex-wrap items-center gap-x-2 gap-y-1">
      <CalendarCheck2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
      <span>Google Calendar {calendar?.connected ? "connected" : "not connected"}.</span>
      <Link to="/faculty-portal/availability" className="font-semibold text-brand-700 hover:underline">Calendar connection</Link>
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
        extra={<CalendarLink calendar={faculty?.calendar} />}
        activityTitle="Upcoming defenses"
        activity={upcoming}
        activityAll={{ to: "/faculty-portal/defenses", label: "View schedule" }}
        activityEmpty={{ title: "No defenses scheduled", hint: "Defenses appear here once the Research Coordinator schedules a panel you sit on." }}
      />
    </div>
  );
}

const nameCell = (name, sub) => (
  <>
    <p className="font-semibold text-ink">{name}</p>
    <p className="meta">{sub}</p>
  </>
);

export function FacultyAdviseesPage() {
  const { data } = useFaculty();
  const advisees = data.advisees || [];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My Advisees"
        description="Students you advise, their stage, and the research documents that need your signature."
        icon={Users}
        actions={<Button as={Link} variant="secondary" icon={FileSignature} to="/faculty-portal/signatures">Signatures</Button>}
      />
      <FacultyAdviserPanel portalAdvisees={advisees} />
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

const DEFENSE_COLUMNS = [
  {
    key: "student",
    header: "Student",
    cell: (panel) => nameCell(panel.student.name, panel.research_title || "Research title pending"),
    sortable: true, sortValue: (panel) => panel.student.name,
  },
  { key: "defense", header: "Defense", cell: (panel) => panel.defense.defense_type, sortable: true, sortValue: (panel) => panel.defense.defense_type },
  {
    key: "when",
    header: "Date / time",
    cell: (panel) => (
      <>
        {defenseTime(panel.defense)}
        <span className="meta block">Philippine time</span>
      </>
    ),
    sortable: true, sortValue: (panel) => `${panel.defense.preferred_date || ""} ${panel.defense.start_time || ""}`,
  },
  {
    key: "venue",
    header: "Mode / venue",
    cell: (panel) => (
      <>
        {panel.defense.mode || "-"}
        {panel.defense.venue ? <span className="meta block">{panel.defense.venue}</span> : null}
      </>
    ),
    sortable: true, sortValue: (panel) => panel.defense.mode,
  },
  { key: "role", header: "My role", cell: (panel) => <StatusChip status={panel.panel_role} dot={false} />, sortable: true, sortValue: (panel) => panel.panel_role },
  {
    key: "status",
    header: "Status",
    cell: (panel) => (
      <>
        <StatusChip status={panel.defense.display_status || panel.defense.status} dot={false} />
        {(panel.defense.attention || []).map((note) => (
          <p key={note} className="mt-1.5 flex max-w-[16rem] items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-900">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {note}
          </p>
        ))}
      </>
    ),
    sortable: true, sortValue: (panel) => panel.defense.display_status || panel.defense.status,
  },
  {
    key: "calendar",
    header: "Calendar",
    cell: (panel) =>
      panel.defense.ics_url ? (
        <a href={panel.defense.ics_url} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
          <Download className="h-3.5 w-3.5" aria-hidden="true" /> Add to calendar
        </a>
      ) : (
        <span className="meta">Not available</span>
      ),
  },
];

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
            <Button as={Link} variant="secondary" icon={CalendarDays} to="/faculty-portal/calendar">Open my calendar</Button>
            <Button as={Link} variant="secondary" icon={Clock3} to="/faculty-portal/availability">My availability</Button>
          </>
        }
      />
      <DataTable
        caption="Defenses scheduled for the panels you sit on"
        columns={DEFENSE_COLUMNS}
        rows={rows}
        rowKey={(panel) => `${panel.student.id}-${panel.gate}-${panel.panel_role}`}
        pageSize={0}
        minWidth="lg"
        empty={{ icon: CalendarClock, title: "No defenses scheduled", hint: "You will see a defense here once the Research Coordinator schedules one for a panel you sit on." }}
      />
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
      <Card>
        <FacultyClasses subjects={data.subjects || []} terms={data.terms || []} />
      </Card>
    </div>
  );
}
