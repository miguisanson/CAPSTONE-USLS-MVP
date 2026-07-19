import { useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness, Building2, CalendarCheck2, CalendarDays, ChevronLeft,
  ChevronRight, ExternalLink, Link2, Mail, Search, UsersRound, X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApi } from "../hooks";
import { Card, EmptyState, Spinner, StatusBadge } from "../components/ui";
import { initials } from "../lib/format";

export default function Faculty() {
  const { data, loading, error } = useApi(() => api.faculty(), []);
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [availability, setAvailability] = useState("All availability");
  const faculty = data?.items || [];
  const requestedId = Number(params.get("faculty")) || null;
  const [selectedId, setSelectedId] = useState(requestedId);

  useEffect(() => {
    if (requestedId) setSelectedId(requestedId);
  }, [requestedId]);

  useEffect(() => {
    if (!selectedId) return undefined;
    const closeOnEscape = (event) => event.key === "Escape" && closeFaculty();
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedId]);

  const departments = useMemo(() => [...new Set(faculty.map((item) => item.college))].sort(), [faculty]);
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return faculty.filter((item) => {
      const matchesText = !needle || [item.name, item.college, item.role, item.specialization, item.email, item.account?.email, ...(item.matching_keywords || [])]
        .some((value) => value?.toLowerCase().includes(needle));
      return matchesText
        && (department === "All departments" || item.college === department)
        && (availability === "All availability" || item.availability_status === availability);
    });
  }, [faculty, query, department, availability]);
  const selected = faculty.find((item) => item.id === selectedId) || null;

  function selectFaculty(id) {
    setSelectedId(id);
    const next = new URLSearchParams(params);
    next.set("faculty", String(id));
    setParams(next, { replace: true });
  }

  function closeFaculty() {
    setSelectedId(null);
    const next = new URLSearchParams(params);
    next.delete("faculty");
    setParams(next, { replace: true });
  }

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-display text-2xl font-semibold text-ink">Faculty Profiles</h1>
        <p className="mt-1 text-sm text-slate-500">Search the faculty directory, then open a profile to review expertise, login email, panel load, and weekly availability.</p>
      </header>

      <Card className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">Search faculty</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="field-input pl-10" placeholder="Search by name, department, or specialization…" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="field-input cursor-pointer" value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Filter by department">
              <option>All departments</option>
              {departments.map((item) => <option key={item}>{item}</option>)}
            </select>
            <select className="field-input cursor-pointer" value={availability} onChange={(event) => setAvailability(event.target.value)} aria-label="Filter by availability">
              <option>All availability</option>
              <option>Available</option>
              <option>Unavailable</option>
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {loading ? <Spinner label="Loading faculty profiles…" /> : error ? (
          <EmptyState icon={UsersRound} title="Could not load faculty" hint={error} />
        ) : !filtered.length ? (
          <EmptyState icon={Search} title="No faculty match your filters" hint="Try a broader search or change a filter." />
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <p className="text-sm text-slate-500">Showing <span className="font-semibold text-ink">{filtered.length}</span> of <span className="font-semibold text-ink">{faculty.length}</span> faculty</p>
              <p className="text-xs text-slate-400">Select a faculty member to open their profile</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Faculty</th>
                    <th className="px-3 py-3">Department</th>
                    <th className="px-3 py-3">Specialization</th>
                    <th className="px-3 py-3">Login email</th>
                    <th className="px-3 py-3">Account</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Panel load</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} onClick={() => selectFaculty(item.id)} className="cursor-pointer border-b border-slate-50 transition-colors hover:bg-brand-50/50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{initials(item.name)}</span>
                          <div className="min-w-0">
                            <button type="button" onClick={() => selectFaculty(item.id)} className="cursor-pointer truncate text-left font-semibold text-ink hover:text-brand-700 hover:underline focus-visible:ring-2 focus-visible:ring-brand-400">{item.name}</button>
                            <p className="text-xs text-slate-400">{item.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{item.college}</td>
                      <td className="max-w-sm px-3 py-3 text-slate-600"><p className="line-clamp-2">{item.specialization}</p></td>
                      <td className="px-3 py-3 text-slate-600">{item.account?.email || item.email}</td>
                      <td className="px-3 py-3"><StatusBadge value={item.account?.active ? "Active login" : "No account"} dot={false} /></td>
                      <td className="px-3 py-3"><StatusBadge value={item.active ? "Active" : "Inactive"} dot={false} /></td>
                      <td className="px-5 py-3 text-right"><span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">{item.panel_load}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {selected && <FacultyProfileModal faculty={selected} onClose={closeFaculty} />}
    </div>
  );
}

function FacultyProfileModal({ faculty, onClose }) {
  const calendar = faculty.calendar || {};
  const feedUrl = calendar.feed_url || `/api/faculty/${faculty.id}/calendar.ics`;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="faculty-profile-title" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <Card className="max-h-[94vh] w-full max-w-7xl overflow-hidden shadow-2xl">
        <div className="flex items-start gap-4 bg-gradient-to-r from-brand-800 to-brand-700 p-5 text-white sm:p-6">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/15 font-bold ring-1 ring-white/20">{initials(faculty.name)}</span>
          <div className="min-w-0 flex-1">
            <h2 id="faculty-profile-title" className="text-xl font-semibold">{faculty.name}</h2>
            <p className="mt-0.5 text-sm text-white/75">{faculty.role}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-white/85"><Building2 className="h-3.5 w-3.5" />{faculty.college}</p>
          </div>
          <div className="hidden flex-wrap items-center justify-end gap-2 sm:flex">
            <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-xs font-semibold text-emerald-50 ring-1 ring-emerald-300/30">{faculty.availability_status}</span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-1 ring-white/15">{faculty.panel_load} panel assignments</span>
          </div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg bg-white/10 transition-colors hover:bg-white/20 focus-visible:ring-2 focus-visible:ring-white" aria-label="Close faculty profile"><X className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[calc(94vh-104px)] space-y-6 overflow-y-auto p-4 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <ProfileSection icon={BriefcaseBusiness} title="Specialization">
              <p className="text-sm leading-relaxed text-slate-600">{faculty.specialization}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{(faculty.matching_keywords || []).slice(0, 8).map((keyword) => <span key={keyword} className="rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">{keyword}</span>)}</div>
              <p className="mt-2 text-xs text-slate-500">Used to explain recommendations in Panel Matching.</p>
            </ProfileSection>

            <div className="space-y-6">
              <ProfileSection icon={Mail} title="Contact">
                <a className="text-sm font-medium text-brand-700 hover:underline" href={`mailto:${faculty.email}`}>{faculty.email}</a>
                <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Faculty login</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{faculty.account?.email || faculty.email}</p>
                </div>
              </ProfileSection>
              <ProfileSection icon={UsersRound} title="Current assignments">
                {(faculty.current_assignments || []).length ? <div className="space-y-2">{faculty.current_assignments.slice(0, 3).map((assignment) => (
                  <div key={assignment.id} className="rounded-lg border border-slate-100 p-3"><div className="flex justify-between gap-2"><p className="text-sm font-semibold text-ink">{assignment.student_name}</p><span className="text-[11px] font-bold text-brand-700">{assignment.panel_role}</span></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{assignment.research_title}</p></div>
                ))}</div> : <p className="text-sm text-slate-500">No current panel assignments.</p>}
              </ProfileSection>
            </div>

            <ProfileSection icon={Link2} title="Calendar connection">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-ink">{calendar.provider || "Google Calendar"}</p><p className="mt-1 text-xs text-slate-500">{calendar.sync_status}</p></div><StatusBadge value={calendar.connected ? "Connected" : calendar.demo_mode ? "Mock active" : "Profile only"} dot={calendar.connected} /></div>
                <div className="mt-3 grid grid-cols-2 gap-2"><a className="btn-primary justify-center" href={calendar.connect_url} target="_blank" rel="noreferrer"><CalendarCheck2 className="h-4 w-4" />Connect</a><a className="btn-ghost justify-center" href={feedUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" />Export feed</a></div>
              </div>
            </ProfileSection>
          </div>

          <WeeklyCalendar faculty={faculty} />
        </div>
      </Card>
    </div>
  );
}

const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18;
const HOUR_HEIGHT = 52;

function WeeklyCalendar({ faculty }) {
  const events = useMemo(() => [
    ...(faculty.upcoming_availability || []).map((event) => ({ ...event, title: "Available for defense", status: "available" })),
    ...(faculty.calendar_events || []),
  ], [faculty]);
  const firstEventDate = events.length ? dateFromIso([...events].sort((a, b) => a.date.localeCompare(b.date))[0].date) : new Date();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(firstEventDate));

  useEffect(() => setWeekStart(startOfWeek(firstEventDate)), [faculty.id]);

  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const weekEnd = days[6];
  const visibleEvents = events.filter((event) => {
    const eventDate = dateFromIso(event.date);
    return eventDate >= days[0] && eventDate <= weekEnd;
  });

  return (
    <section>
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-brand-700" /><h3 className="font-semibold text-ink">Weekly availability & schedule</h3></div>
          <p className="mt-1 text-xs text-slate-500">Recurring working hours, available defense windows, and blocked commitments in one view.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} className="btn-ghost px-2" aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => setWeekStart(startOfWeek(new Date()))} className="btn-ghost px-3">Today</button>
          <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} className="btn-ghost px-2" aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-slate-700">{formatWeekRange(weekStart, weekEnd)}</p>
        <div className="flex flex-wrap gap-3 text-[11px] font-medium text-slate-500">
          <Legend color="border-emerald-300 bg-emerald-50" label="Working hours" />
          <Legend color="border-emerald-600 bg-emerald-500" label="Available slot" />
          <Legend color="border-blue-600 bg-blue-500" label="Blocked / busy" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <div className="min-w-[920px]">
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50">
            <div className="border-r border-slate-200" />
            {days.map((day) => <div key={day.toISOString()} className="border-r border-slate-200 px-2 py-2.5 text-center last:border-r-0"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{day.toLocaleDateString("en-US", { weekday: "short" })}</p><p className={`mt-0.5 text-sm font-semibold ${isToday(day) ? "text-brand-700" : "text-slate-700"}`}>{day.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p></div>)}
          </div>
          <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
            <div className="relative border-r border-slate-200" style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}>
              {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 }, (_, index) => <span key={index} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-slate-400" style={{ top: index * HOUR_HEIGHT }}>{formatHour(CALENDAR_START_HOUR + index)}</span>)}
            </div>
            {days.map((day, dayIndex) => {
              const workingDay = faculty.working_hours?.find((item) => item.weekday === dayIndex);
              const dayEvents = visibleEvents.filter((event) => sameDate(dateFromIso(event.date), day));
              return (
                <div key={day.toISOString()} className="relative border-r border-slate-200 last:border-r-0" style={{ height: (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT }}>
                  {Array.from({ length: CALENDAR_END_HOUR - CALENDAR_START_HOUR }, (_, index) => <div key={index} className="absolute inset-x-0 border-t border-slate-100" style={{ top: index * HOUR_HEIGHT }} />)}
                  {workingDay?.enabled && <CalendarBlock event={{ start: workingDay.start, end: workingDay.end, title: "Working hours", status: "working" }} />}
                  {dayEvents.map((event, index) => <CalendarBlock key={`${event.date}-${event.start}-${event.title}-${index}`} event={event} index={index} />)}
                  {!workingDay?.enabled && <p className="absolute inset-x-2 top-3 text-center text-[10px] font-semibold text-slate-300">Unavailable</p>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Defense Scheduling excludes blue busy blocks when comparing common panel availability.</p>
    </section>
  );
}

function CalendarBlock({ event, index = 0 }) {
  const start = minutesFromTime(event.start);
  const end = minutesFromTime(event.end);
  const visibleStart = Math.max(start, CALENDAR_START_HOUR * 60);
  const visibleEnd = Math.min(end, CALENDAR_END_HOUR * 60);
  if (visibleEnd <= visibleStart) return null;
  const top = ((visibleStart - CALENDAR_START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(22, ((visibleEnd - visibleStart) / 60) * HOUR_HEIGHT);
  const isWorking = event.status === "working";
  const isAvailable = event.status === "available";
  const color = isWorking ? "border-emerald-300 bg-emerald-50/70 text-emerald-800" : isAvailable ? "border-emerald-600 bg-emerald-500 text-white" : "border-blue-600 bg-blue-500 text-white";
  return (
    <div className={`absolute overflow-hidden rounded-md border px-1.5 py-1 text-[10px] shadow-sm ${isWorking ? "z-0" : "z-10"} ${color}`} style={{ top, height, left: isWorking ? 4 : 7 + (index % 2) * 4, right: isWorking ? 4 : 7 }} title={`${event.title}: ${event.start}–${event.end}`}>
      <p className="truncate font-bold">{event.title}</p>
      {height >= 36 && <p className={`truncate ${isWorking ? "text-emerald-700" : "text-white/85"}`}>{event.start}–{event.end}</p>}
    </div>
  );
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-sm border ${color}`} />{label}</span>;
}

function minutesFromTime(value) {
  const [hour, minute] = (value || "00:00").split(":").map(Number);
  return hour * 60 + minute;
}

function dateFromIso(value) {
  return new Date(`${value}T00:00:00`);
}

function startOfWeek(value) {
  const day = new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const offset = day.getDay() === 0 ? -6 : 1 - day.getDay();
  day.setDate(day.getDate() + offset);
  return day;
}

function addDays(value, amount) {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isToday(value) {
  return sameDate(value, new Date());
}

function formatHour(hour) {
  const normalized = hour % 12 || 12;
  return `${normalized} ${hour < 12 ? "AM" : "PM"}`;
}

function formatWeekRange(start, end) {
  const startLabel = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const endLabel = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  return `${startLabel} – ${endLabel}`;
}

function ProfileSection({ icon: Icon, title, children }) {
  return <section><div className="mb-2 flex items-center gap-2"><Icon className="h-4 w-4 text-brand-700" /><h3 className="text-sm font-semibold text-ink">{title}</h3></div>{children}</section>;
}
