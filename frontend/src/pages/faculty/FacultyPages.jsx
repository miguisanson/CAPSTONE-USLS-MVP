import { Link, useSearchParams } from "react-router-dom";
import {
  BookOpenCheck,
  CalendarCheck,
  CalendarCheck2,
  CalendarClock,
  Clock3,
  FileCheck,
  FileSignature,
  FileText,
  LayoutDashboard,
  Scale,
  Users,
} from "lucide-react";
import { Card, EmptyState, PageHeader, SectionTitle, StatCard, StatusBadge } from "../../components/ui";
import { formatDate } from "../../lib/format";
import FacultyResearchWorkspace from "../../components/FacultyResearchWorkspace";
import { useFaculty } from "./FacultyContext";
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
  const panels = data.panels || [];
  const advisees = data.advisees || [];
  const pendingSignatures = advisees.reduce((sum, row) => sum + (row.pending_count || 0), 0);
  const verdictsDue = panels.filter((panel) => panel.can_submit_verdict);
  const upcoming = panels
    .filter((panel) => panel.defense)
    .sort((left, right) => new Date(left.defense.preferred_date || 0) - new Date(right.defense.preferred_date || 0))
    .slice(0, 5);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={`Welcome, ${faculty?.name || "Faculty"}`}
        description={faculty?.specialization || "Your advisees, panel assignments and defense schedule."}
        icon={LayoutDashboard}
        badge={<StatusBadge value={faculty?.college || "College"} dot={false} />}
      />
      <CalendarNotice />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Users} label="Advisees" value={advisees.length} sub="students you advise" to="/faculty-portal/advisees" />
        <StatCard icon={FileSignature} label="Signatures needed" value={pendingSignatures} sub="advisee papers to review" tone={pendingSignatures ? "amber" : "slate"} to="/faculty-portal/signatures" />
        <StatCard icon={FileText} label="Panel assignments" value={panels.length} sub="committees you sit on" tone="blue" to="/faculty-portal/panels" />
        <StatCard icon={Scale} label="Verdicts due" value={verdictsDue.length} sub="as panel chair or lead" tone={verdictsDue.length ? "red" : "slate"} to="/faculty-portal/verdicts" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Card className="p-6">
            <SectionTitle
              title="Upcoming defenses"
              subtitle="Scheduled defenses for panels you sit on"
              icon={CalendarClock}
              action={<Link to="/faculty-portal/defenses" className="text-xs font-semibold text-brand-700 hover:underline">View schedule</Link>}
            />
            {upcoming.length ? (
              <ul className="space-y-2.5">
                {upcoming.map((panel) => (
                  <li key={`${panel.student.id}-${panel.gate}-${panel.panel_role}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{panel.student.name}</p>
                      <p className="text-xs text-slate-500">{panel.defense.defense_type} · {defenseTime(panel.defense)}{panel.defense.mode ? ` · ${panel.defense.mode}` : ""}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={panel.panel_role} dot={false} />
                      <StatusBadge value={panel.defense.display_status || panel.defense.status} dot={false} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={CalendarClock} title="No defenses scheduled" hint="Defenses appear here once the Research Coordinator schedules a panel you sit on." />
            )}
          </Card>
          <Card className="p-6">
            <SectionTitle title="What needs your action" icon={FileCheck} />
            {pendingSignatures || verdictsDue.length ? (
              <ul className="space-y-2.5">
                {pendingSignatures > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">{pendingSignatures} advisee document{pendingSignatures === 1 ? "" : "s"} waiting for your signature.</p>
                    <Link to="/faculty-portal/signatures" className="btn-primary px-3 py-1.5 text-xs">Review and sign</Link>
                  </li>
                )}
                {verdictsDue.length > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-900">{verdictsDue.length} defense verdict{verdictsDue.length === 1 ? "" : "s"} to submit.</p>
                    <Link to="/faculty-portal/verdicts" className="btn-primary px-3 py-1.5 text-xs">Submit verdicts</Link>
                  </li>
                )}
              </ul>
            ) : (
              <EmptyState icon={FileCheck} title="You are all caught up" hint="No signatures or verdicts are waiting on you." />
            )}
          </Card>
        </div>
        <div className="space-y-5 lg:col-span-4">
          <FacultyCalendarConnection calendar={faculty?.calendar} />
          <StatCard icon={Clock3} label="Availability windows" value={(data.availability || []).length} sub="upcoming profile windows" tone="slate" to="/faculty-portal/availability" />
        </div>
      </div>
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
        actions={<Link to="/faculty-portal/availability" className="btn-ghost"><Clock3 className="h-4 w-4" /> My availability</Link>}
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
                </tr>
              </thead>
              <tbody>
                {rows.map((panel) => (
                  <tr key={`${panel.student.id}-${panel.gate}-${panel.panel_role}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-3"><p className="font-semibold text-ink">{panel.student.name}</p><p className="text-xs text-slate-400">{panel.research_title || "Research title pending"}</p></td>
                    <td className="px-3 py-3 text-slate-600">{panel.defense.defense_type}</td>
                    <td className="px-3 py-3 text-slate-600">{defenseTime(panel.defense)}</td>
                    <td className="px-3 py-3 text-slate-600">{panel.defense.mode || "-"}{panel.defense.venue ? <span className="block text-xs text-slate-400">{panel.defense.venue}</span> : null}</td>
                    <td className="px-3 py-3"><StatusBadge value={panel.panel_role} dot={false} /></td>
                    <td className="px-3 py-3"><StatusBadge value={panel.defense.display_status || panel.defense.status} dot={false} /></td>
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
      <PageHeader title="Assigned Classes" description="Class rosters for your assigned subjects. Official grade data is read-only here." icon={BookOpenCheck} />
      <Card className="p-6">
        <FacultyClasses subjects={data.subjects || []} terms={data.terms || []} />
      </Card>
    </div>
  );
}

export function FacultyAvailabilityPage() {
  const { data } = useFaculty();
  const { faculty } = data;
  const availability = data.availability || [];
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="Availability & Calendar"
        description="The busy periods and availability windows staff use when scheduling your defenses."
        icon={CalendarCheck}
      />
      <CalendarNotice />
      <div className="grid gap-5 lg:grid-cols-12">
        <Card className="p-6 lg:col-span-8">
          <SectionTitle
            title={faculty?.calendar?.connected ? "My connected calendar" : "My availability"}
            subtitle={
              faculty?.calendar?.connected
                ? "Google Calendar busy periods that are excluded from defense scheduling"
                : "Upcoming profile windows used for defense scheduling"
            }
            icon={Clock3}
          />
          {faculty?.calendar?.connected ? (
            (faculty.calendar_events || []).length === 0 ? (
              <EmptyState
                icon={CalendarCheck2}
                title="No busy periods in the next five weeks"
                hint={faculty.calendar_event_status || "Your Google Calendar is connected and will be checked again when staff review defense dates."}
              />
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(faculty.calendar_events || []).map((event, i) => (
                  <div key={`${event.date}-${event.start}-${i}`} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
                    <CalendarClock className="h-4 w-4 text-amber-700" />
                    <span className="font-semibold text-ink">{formatDate(event.date)}</span>
                    <span className="ml-auto text-slate-600">{event.start} – {event.end}</span>
                  </div>
                ))}
              </div>
            )
          ) : availability.length === 0 ? (
            <EmptyState icon={Clock3} title="No availability recorded" hint="Connect Google Calendar or ask the Graduate School office to maintain profile availability." />
          ) : (
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {availability.map((slot, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <CalendarClock className="h-4 w-4 text-brand-600" />
                  <span className="font-semibold text-ink">{formatDate(slot.date)}</span>
                  <span className="ml-auto text-slate-500">{slot.start} – {slot.end}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
        <div className="lg:col-span-4">
          <FacultyCalendarConnection calendar={faculty?.calendar} />
        </div>
      </div>
    </div>
  );
}
