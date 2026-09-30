import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CalendarPlus, ExternalLink, Flag, Printer } from "lucide-react";
import { api } from "../../api";
import { Card, ErrorNote, PageHeader, SectionTitle, StatusBadge } from "../ui";
import CalendarView, { CalendarLegend, isoDay, parseDay, visibleRange } from "./CalendarView";
import CalendarFeedCard from "./CalendarFeedCard";

// One calendar page for every role that reads the shared /api/calendar feed:
//   scope "staff"   -> Graduate School staff, Research / Academic Coordinator (filters, deadline overlay)
//   scope "dean"    -> Dean (same data, read only)
//   scope "faculty" -> "My calendar" (defenses by role, advisee deadlines, availability, Google busy)
// Students use their own "research calendar" page built on the same CalendarView.

const EMPTY_FILTERS = { program_id: "", defense_type: "", status: "", faculty_id: "", venue: "", q: "" };

function FilterBar({ filters, options, onChange }) {
  const set = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  const clear = () => onChange(EMPTY_FILTERS);
  const active = Object.values(filters).some(Boolean);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="block text-xs font-bold text-slate-500">
        Program
        <select className="field-input mt-1" value={filters.program_id} onChange={set("program_id")}>
          <option value="">All programs</option>
          {(options.programs || []).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-500">
        Stage
        <select className="field-input mt-1" value={filters.defense_type} onChange={set("defense_type")}>
          <option value="">All stages</option>
          {(options.defense_types || []).map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-500">
        Status
        <select className="field-input mt-1" value={filters.status} onChange={set("status")}>
          <option value="">Booked and held</option>
          {(options.statuses || []).map((item) => <option key={item} value={item}>{item}</option>)}
          <option value="all">Everything</option>
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-500">
        Panelist or adviser
        <select className="field-input mt-1" value={filters.faculty_id} onChange={set("faculty_id")}>
          <option value="">Anyone</option>
          {(options.faculty || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label className="block text-xs font-bold text-slate-500">
        Venue
        <input className="field-input mt-1" value={filters.venue} onChange={set("venue")} placeholder="Room or Zoom" list="calendar-venues" />
        <datalist id="calendar-venues">{(options.venues || []).map((item) => <option key={item} value={item} />)}</datalist>
      </label>
      <label className="block text-xs font-bold text-slate-500">
        Student
        <div className="mt-1 flex gap-2">
          <input className="field-input" value={filters.q} onChange={set("q")} placeholder="Name or ID" />
          {active && <button type="button" className="btn-ghost shrink-0 px-3 text-xs" onClick={clear}>Clear</button>}
        </div>
      </label>
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink">{children}</dd>
    </div>
  );
}

function CannotAttend({ event, onDone }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send() {
    setBusy(true);
    setError("");
    try {
      await api.cannotAttendDefense(event.schedule_id, { reason });
      setOpen(false);
      setReason("");
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (!open) {
    return <button type="button" className="btn-ghost w-full justify-center text-xs" onClick={() => setOpen(true)}>I cannot attend this defense</button>;
  }
  return (
    <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <label className="block text-xs font-bold text-amber-900" htmlFor="cannot-attend-reason">Why can you not attend?</label>
      <textarea id="cannot-attend-reason" className="field-input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The Research Coordinator sees this and will reschedule or replace you." />
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <button type="button" className="btn-primary px-3 py-1.5 text-xs" disabled={busy || reason.trim().length < 3} onClick={send}>{busy ? "Sending..." : "Send request"}</button>
        <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

function DetailPanel({ selected, scope, onClose, onChanged }) {
  if (!selected) {
    return (
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-600">Select a defense or a deadline to see the details.</p>
        <p className="mt-1 text-xs text-slate-400">Flagged items (amber or red outline) need someone to act.</p>
      </Card>
    );
  }
  if (selected.kind !== "defense") {
    return (
      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-ink"><Flag className="h-4 w-4 text-slate-500" aria-hidden="true" />Deadline</p>
          <button type="button" className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose}>Close</button>
        </div>
        <p className="text-sm font-semibold text-ink">{selected.label}</p>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Due">{parseDay(selected.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Fact>
          <Fact label="State">{selected.done ? "Done" : selected.urgency === "overdue" ? "Overdue" : selected.urgency === "soon" ? "Due soon" : "Upcoming"}</Fact>
          {selected.student_name && <Fact label="Student">{selected.student_name}</Fact>}
          {selected.defense_type && <Fact label="Defense">{selected.defense_type}</Fact>}
        </dl>
        {scope === "staff" && selected.student_id && (
          <Link to={`/workflow/defense-scheduling?student_id=${selected.student_id}`} className="btn-ghost w-full justify-center text-xs">Open Defense Scheduling <ExternalLink className="h-3.5 w-3.5" /></Link>
        )}
      </Card>
    );
  }
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink">{selected.defense_type}</p>
          <p className="text-sm text-slate-500">{selected.student_name}{selected.student_number ? ` · ${selected.student_number}` : ""}</p>
        </div>
        <button type="button" className="text-xs font-semibold text-slate-400 hover:text-slate-600" onClick={onClose}>Close</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge value={selected.status} dot={false} />
        {selected.verdict_overdue && <StatusBadge value="Verdict overdue" dot={false} className="!bg-red-50 !text-red-700 !ring-red-200" />}
        {selected.has_verdict && <StatusBadge value="Verdict recorded" dot={false} className="!bg-slate-100 !text-slate-700 !ring-slate-200" />}
      </div>
      {(selected.attention || []).length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          {selected.attention.map((note) => <li key={note} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{note}</li>)}
        </ul>
      )}
      <dl className="grid grid-cols-2 gap-3">
        <Fact label="Date">{parseDay(selected.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</Fact>
        <Fact label="Time">{selected.start.slice(11, 16)}–{selected.end.slice(11, 16)}</Fact>
        <Fact label="Venue">{selected.venue || "Not set"}</Fact>
        <Fact label="Mode">{selected.mode || "—"}</Fact>
        <Fact label="Program">{selected.program_code || "—"}</Fact>
        <Fact label="Adviser">{selected.adviser || "Not appointed"}</Fact>
        {selected.my_role && <Fact label="Your role">{selected.my_role}</Fact>}
        {selected.change_reason && <Fact label="Last change">{selected.change_reason}</Fact>}
      </dl>
      <div>
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">Panel</p>
        <ul className="space-y-1">
          {(selected.panel || []).map((seat) => (
            <li key={`${seat.faculty_id}-${seat.role}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="font-semibold text-ink">{seat.name}</span>
              <span className="text-xs text-slate-500">{seat.role}</span>
            </li>
          ))}
          {!(selected.panel || []).length && <li className="text-sm text-slate-500">No panel recorded.</li>}
        </ul>
      </div>
      <div className="space-y-2">
        <a href={selected.ics_url} className="btn-ghost w-full justify-center text-xs" download>
          <CalendarPlus className="h-4 w-4" aria-hidden="true" />Add to my calendar (.ics)
        </a>
        {scope === "staff" && (
          <Link to={`/workflow/defense-scheduling?student_id=${selected.student_id}`} className="btn-primary w-full justify-center text-xs">
            Open in Defense Scheduling <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
        {scope === "faculty" && ["Scheduled", "Needs Re-confirmation"].includes(selected.status) && (
          <CannotAttend event={selected} onDone={onChanged} />
        )}
      </div>
    </Card>
  );
}

export default function CalendarPage({ scope = "staff", title, description }) {
  const isFaculty = scope === "faculty";
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState(isFaculty ? "week" : "month");
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [showDeadlines, setShowDeadlines] = useState(true);
  const [showAvailability, setShowAvailability] = useState(isFaculty);
  const [showBusy, setShowBusy] = useState(isFaculty);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [reload, setReload] = useState(0);

  const range = useMemo(() => visibleRange(anchor, view), [anchor, view]);
  const layers = [showDeadlines && "deadlines", isFaculty && showAvailability && "availability", isFaculty && showBusy && "busy"].filter(Boolean).join(",");
  const query = JSON.stringify({ ...range, ...filters, layers, reload });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.calendar({ ...range, ...filters, layers })
      .then((data) => active && setPayload(data))
      .catch((err) => active && setError(err.message || "Could not load the calendar."))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const events = payload?.events || [];
  const deadlines = payload?.deadlines || [];
  const attention = events.filter((event) => event.verdict_overdue || (event.attention || []).length || event.status === "Needs Re-confirmation");
  const selectedId = selected?.id || null;

  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title={title}
        description={description}
        icon={CalendarDays}
        actions={<button type="button" className="btn-ghost text-xs" onClick={() => window.print()}><Printer className="h-4 w-4" />Print</button>}
      />
      <ErrorNote message={error} />
      {!isFaculty && <Card className="p-4"><FilterBar filters={filters} options={payload?.filters || {}} onChange={setFilters} /></Card>}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
        <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showDeadlines} onChange={(e) => setShowDeadlines(e.target.checked)} />Deadlines</label>
        {isFaculty && <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showAvailability} onChange={(e) => setShowAvailability(e.target.checked)} />My availability</label>}
        {isFaculty && <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showBusy} onChange={(e) => setShowBusy(e.target.checked)} />Google busy times</label>}
        {payload?.busy_status && <span className="text-slate-400">{payload.busy_status}</span>}
      </div>
      <CalendarLegend showAvailability={isFaculty && showAvailability} showBusy={isFaculty && showBusy} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-8">
          <CalendarView
            events={events}
            deadlines={deadlines}
            availability={isFaculty && showAvailability ? payload?.availability : null}
            busy={isFaculty && showBusy ? payload?.busy : []}
            anchor={anchor}
            onAnchorChange={setAnchor}
            view={view}
            onViewChange={setView}
            onSelectEvent={setSelected}
            onSelectDeadline={(item) => setSelected({ ...item, kind: item.kind })}
            selectedId={selectedId}
            timezone={payload?.timezone || "Asia/Manila"}
            loading={loading}
          />
        </div>
        <div className="space-y-5 xl:col-span-4">
          <DetailPanel selected={selected} scope={scope} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); setReload((n) => n + 1); }} />
          {attention.length > 0 && (
            <Card className="p-5">
              <SectionTitle title="Needs attention" subtitle="In the period on screen" icon={AlertTriangle} />
              <ul className="space-y-2">
                {attention.map((event) => (
                  <li key={event.id}>
                    <button type="button" onClick={() => setSelected(event)} className="w-full cursor-pointer rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100">
                      <span className="block text-sm font-semibold text-amber-950">{event.defense_type} · {event.student_name}</span>
                      <span className="block text-xs text-amber-900">
                        {event.date}{event.verdict_overdue ? " · verdict overdue" : ""}{(event.attention || [])[0] ? ` · ${event.attention[0]}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <CalendarFeedCard />
        </div>
      </div>
    </div>
  );
}
