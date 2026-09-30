import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CalendarDays, CalendarPlus, Flag, MapPin, UserCheck, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, ErrorNote, PageHeader, SectionTitle, Spinner, StatusBadge } from "../../components/ui";
import CalendarView, { CalendarLegend } from "../../components/calendar/CalendarView";
import CalendarFeedCard from "../../components/calendar/CalendarFeedCard";
import { daysPhrase, fmtDay } from "./shared";

const timeOf = (value) => (value ? String(value).slice(11, 16) : "");

const URGENCY = {
  overdue: { text: "Overdue", tone: "text-red-700", badge: "Overdue" },
  soon: { text: "Due soon", tone: "text-amber-700", badge: "Due soon" },
  later: { text: "Upcoming", tone: "text-slate-600", badge: "Upcoming" },
};
const URGENCY_ORDER = { overdue: 0, soon: 1, later: 2 };

function daysUntil(dateValue) {
  const target = new Date(`${String(dateValue).slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function AdviserLine({ adviser }) {
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
      <UserCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />
      <span>Research adviser:</span>
      {adviser ? (
        <span className="font-semibold text-ink">{adviser}</span>
      ) : (
        <span className="font-semibold text-ink">No adviser appointed yet</span>
      )}
      <Link to="/student/adviser" className="text-xs font-semibold text-brand-700 hover:underline">
        {adviser ? "Adviser page" : "Apply for an adviser"}
      </Link>
    </p>
  );
}

function NextDefenseCard({ event }) {
  if (!event) {
    return (
      <Card className="p-6">
        <SectionTitle title="Your next defense" icon={CalendarDays} />
        <EmptyState
          icon={CalendarDays}
          title="No defense is booked yet"
          hint="When the Research Coordinator books your defense, the date, time and panel appear here."
        />
        <div className="mt-2 text-center">
          <Link to="/student/defense-schedule" className="btn-primary">Request a defense schedule</Link>
        </div>
      </Card>
    );
  }
  const attention = event.attention || [];
  const panel = event.panel || [];
  return (
    <Card className="border-brand-200 bg-brand-50/40 p-6">
      <SectionTitle title="Your next defense" icon={CalendarDays} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-brand-700">{event.defense_type}</p>
          <p className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">{fmtDay(event.date, true)}</p>
          <p className="mt-1 text-lg font-semibold text-slate-700">
            {timeOf(event.start)}-{timeOf(event.end)} <span className="text-xs font-semibold text-slate-500">Philippine time</span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <StatusBadge value={event.status} dot={false} />
          <p className="rounded-xl bg-white px-3 py-1.5 text-sm font-bold text-brand-800 ring-1 ring-brand-200">
            {event.countdown_days === 0 ? "Today" : event.countdown_days === 1 ? "Tomorrow" : daysPhrase(event.countdown_days).replace(/^in /, "In ")}
          </p>
        </div>
      </div>
      {attention.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          {attention.map((note) => (
            <li key={note} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{note}</li>
          ))}
        </ul>
      )}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Where</dt>
          <dd className="mt-0.5 flex items-start gap-1.5 text-sm font-semibold text-ink">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 break-words">{event.venue || "Venue or link not set yet"}{event.mode ? ` (${event.mode})` : ""}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Adviser</dt>
          <dd className="mt-0.5 text-sm font-semibold text-ink">{event.adviser || "No adviser appointed yet"}</dd>
        </div>
      </dl>
      <div className="mt-4">
        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400"><Users className="h-3.5 w-3.5" aria-hidden="true" /> Panel</p>
        {panel.length ? (
          <ul className="grid gap-1 sm:grid-cols-2">
            {panel.map((seat) => (
              <li key={`${seat.faculty_id}-${seat.role}`} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-slate-100">
                <span className="min-w-0 truncate font-semibold text-ink">{seat.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{seat.role}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No panel recorded yet.</p>
        )}
      </div>
      {event.change_reason && <p className="mt-3 text-xs text-slate-600">Last change: {event.change_reason}</p>}
      {event.ics_url && (
        <a href={event.ics_url} download className="btn-primary mt-4 w-full justify-center sm:w-auto">
          <CalendarPlus className="h-4 w-4" aria-hidden="true" /> Add to calendar (.ics)
        </a>
      )}
    </Card>
  );
}

function DeadlineList({ deadlines }) {
  const rows = useMemo(
    () => [...deadlines]
      .filter((item) => !item.done)
      .sort((a, b) => (URGENCY_ORDER[a.urgency] ?? 3) - (URGENCY_ORDER[b.urgency] ?? 3) || String(a.date).localeCompare(String(b.date))),
    [deadlines],
  );
  return (
    <Card className="p-6">
      <SectionTitle title="Next deadlines" subtitle="Dates you should not miss, earliest concern first" icon={Flag} />
      {rows.length ? (
        <ul className="space-y-2.5">
          {rows.map((item) => {
            const style = URGENCY[item.urgency] || URGENCY.later;
            return (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{item.label}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{fmtDay(item.date)} - {daysPhrase(daysUntil(item.date))}</p>
                </div>
                <span className={`text-xs font-bold ${style.tone}`}>{style.text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <EmptyState title="No deadlines right now" hint="Due dates such as sending your manuscript to the panel appear here once a defense is booked." />
      )}
    </Card>
  );
}

function SelectedCard({ selected, onClose }) {
  if (!selected) {
    return <p className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-sm text-slate-500">Select a defense or a deadline in the calendar to see its details.</p>;
  }
  const isDefense = selected.kind === "defense";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{isDefense ? selected.defense_type : selected.label}</p>
        <button type="button" className="text-xs font-semibold text-slate-500 hover:text-slate-700" onClick={onClose}>Close</button>
      </div>
      {isDefense ? (
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>{fmtDay(selected.date)}, {timeOf(selected.start)}-{timeOf(selected.end)} (Philippine time)</p>
          <p>{selected.venue || "Venue or link not set yet"}{selected.mode ? ` (${selected.mode})` : ""}</p>
          <p className="flex flex-wrap items-center gap-2">Status: <StatusBadge value={selected.status} dot={false} /></p>
          {(selected.panel || []).length > 0 && (
            <p className="text-xs text-slate-500">Panel: {selected.panel.map((seat) => `${seat.name} (${seat.role})`).join(", ")}</p>
          )}
          {(selected.attention || []).map((note) => <p key={note} className="text-xs font-semibold text-amber-800">{note}</p>)}
          {selected.ics_url && (
            <a href={selected.ics_url} download className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline">
              <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" /> Add to calendar (.ics)
            </a>
          )}
        </div>
      ) : (
        <div className="mt-2 space-y-1 text-sm text-slate-600">
          <p>Due {fmtDay(selected.date)} - {daysPhrase(daysUntil(selected.date))}</p>
          <p className="text-xs font-semibold">{(URGENCY[selected.urgency] || { text: "Done" }).text}</p>
        </div>
      )}
    </div>
  );
}

export default function StudentCalendarPage() {
  const { data, loading, error } = useApi(() => api.studentResearchCalendar(), []);
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState("agenda");
  const [selected, setSelected] = useState(null);

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My research calendar"
        description="Your defense date, the deadlines that lead to it, and a link to put them in your own calendar. All times are Philippine time."
        icon={CalendarDays}
      />
      <ErrorNote message={error} />
      {loading && !data && <Card className="p-6"><Spinner label="Loading your calendar..." /></Card>}
      {data && (
        <>
          <AdviserLine adviser={data.adviser} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="lg:col-span-7"><NextDefenseCard event={data.next_defense} /></div>
            <div className="lg:col-span-5"><DeadlineList deadlines={data.deadlines || []} /></div>
          </div>
          <div className="flex items-start gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand-800" role="status">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>If your defense is moved, a notice with the old and the new time arrives in the bell at the top of the page.</p>
          </div>
          <Card className="space-y-3 p-4 sm:p-5">
            <SectionTitle title="Calendar" subtitle="Your defenses and deadlines" icon={CalendarDays} />
            <CalendarLegend />
            <CalendarView
              events={data.events || []}
              deadlines={data.deadlines || []}
              anchor={anchor}
              onAnchorChange={setAnchor}
              view={view}
              onViewChange={setView}
              onSelectEvent={setSelected}
              onSelectDeadline={setSelected}
              selectedId={selected?.id || null}
              timezone={data.timezone || "Asia/Manila"}
            />
            <SelectedCard selected={selected} onClose={() => setSelected(null)} />
          </Card>
          <CalendarFeedCard />
        </>
      )}
    </div>
  );
}
