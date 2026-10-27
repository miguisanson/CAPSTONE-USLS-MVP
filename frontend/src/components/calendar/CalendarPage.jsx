import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarDays, CalendarPlus, ExternalLink, Flag, Printer } from "lucide-react";
import { api } from "../../api";
import { Button, Card, Field, InlineNotice, Input, PageHeader, SectionTitle, Select, StatusChip, Textarea } from "../ui/index.js";
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
  const programs = (options.programs || []).map((item) => ({ value: String(item.id), label: `${item.code} · ${item.name}` }));
  const faculty = (options.faculty || []).map((item) => ({ value: String(item.id), label: item.name }));
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Field label="Program">
        <Select placeholder="All programs" options={programs} value={filters.program_id} onChange={set("program_id")} />
      </Field>
      <Field label="Stage">
        <Select placeholder="All stages" options={options.defense_types || []} value={filters.defense_type} onChange={set("defense_type")} />
      </Field>
      <Field label="Status">
        <Select placeholder="Booked and held" options={[...(options.statuses || []), { value: "all", label: "Everything" }]} value={filters.status} onChange={set("status")} />
      </Field>
      <Field label="Panelist or adviser">
        <Select placeholder="Anyone" options={faculty} value={filters.faculty_id} onChange={set("faculty_id")} />
      </Field>
      <Field label="Venue">
        <Input value={filters.venue} onChange={set("venue")} placeholder="Room or Zoom" list="calendar-venues" />
        <datalist id="calendar-venues">{(options.venues || []).map((item) => <option key={item} value={item} />)}</datalist>
      </Field>
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Field label="Student">
            <Input value={filters.q} onChange={set("q")} placeholder="Name or ID" />
          </Field>
        </div>
        {active && <Button variant="secondary" className="shrink-0" onClick={clear}>Clear</Button>}
      </div>
    </div>
  );
}

function Fact({ label, children }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
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
    return <Button variant="secondary" className="w-full justify-center" onClick={() => setOpen(true)}>I cannot attend this defense</Button>;
  }
  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
      <Field label="Why can you not attend?">
        <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="The Research Coordinator sees this and will reschedule or replace you." />
      </Field>
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy} disabled={reason.trim().length < 3} onClick={send}>{busy ? "Sending..." : "Send request"}</Button>
        <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

function DetailPanel({ selected, scope, onClose, onChanged }) {
  if (!selected) {
    return (
      <Card>
        <p className="text-sm font-semibold text-slate-600">Select a defense or a deadline to see the details.</p>
        <p className="meta mt-1">Flagged items (amber or red outline) need someone to act.</p>
      </Card>
    );
  }
  if (selected.kind !== "defense") {
    return (
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink"><Flag className="h-4 w-4 text-slate-500" aria-hidden="true" />Deadline</p>
          <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
        </div>
        <p className="text-sm font-semibold text-ink">{selected.label}</p>
        <dl className="grid grid-cols-2 gap-3">
          <Fact label="Due">{parseDay(selected.date).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Fact>
          <Fact label="State">{selected.done ? "Done" : selected.urgency === "overdue" ? "Overdue" : selected.urgency === "soon" ? "Due soon" : "Upcoming"}</Fact>
          {selected.student_name && <Fact label="Student">{selected.student_name}</Fact>}
          {selected.defense_type && <Fact label="Defense">{selected.defense_type}</Fact>}
        </dl>
        {scope === "staff" && selected.student_id && (
          <Button as={Link} to={`/workflow/defense-scheduling?student_id=${selected.student_id}`} variant="secondary" className="w-full justify-center">Open Defense Scheduling <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /></Button>
        )}
      </Card>
    );
  }
  return (
    <Card className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display text-base font-semibold text-ink">{selected.defense_type}</p>
          <p className="text-sm text-slate-500">{selected.student_name}{selected.student_number ? ` · ${selected.student_number}` : ""}</p>
        </div>
        <Button variant="secondary" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip status={selected.status} dot={false} />
        {selected.verdict_overdue && <StatusChip status="Verdict overdue" tone="bad" dot={false} />}
        {selected.has_verdict && <StatusChip status="Verdict recorded" tone="muted" dot={false} />}
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
        <p className="eyebrow mb-1.5">Panel</p>
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
        <Button as="a" href={selected.ics_url} variant="secondary" icon={CalendarPlus} className="w-full justify-center" download>
          Add to my calendar (.ics)
        </Button>
        {scope === "staff" && (
          <Button as={Link} to={`/workflow/defense-scheduling?student_id=${selected.student_id}`} className="w-full justify-center">
            Open in Defense Scheduling <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        )}
        {scope === "faculty" && ["Scheduled", "Needs Re-confirmation"].includes(selected.status) && (
          <CannotAttend event={selected} onDone={onChanged} />
        )}
      </div>
    </Card>
  );
}

// `embedded` drops the big page header (used as a tab inside Defense Scheduling).
export default function CalendarPage({ scope = "staff", title, description, embedded = false, connectionPanel = null }) {
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
      {embedded ? (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-3xl text-sm text-slate-600">{description}</p>
          <Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>
        </div>
      ) : (
        <PageHeader
          title={title}
          description={description}
          icon={CalendarDays}
          actions={<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Button>}
        />
      )}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      {!isFaculty && <Card><FilterBar filters={filters} options={payload?.filters || {}} onChange={setFilters} /></Card>}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="order-2 min-w-0 space-y-3 xl:order-1 xl:col-span-8">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-600">
            <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showDeadlines} onChange={(e) => setShowDeadlines(e.target.checked)} />Deadlines</label>
            {isFaculty && <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showAvailability} onChange={(e) => setShowAvailability(e.target.checked)} />My availability</label>}
            {isFaculty && <label className="inline-flex cursor-pointer items-center gap-2"><input type="checkbox" checked={showBusy} onChange={(e) => setShowBusy(e.target.checked)} />Google busy times</label>}
            {payload?.busy_status && <span className="font-normal text-slate-500">{payload.busy_status}</span>}
          </div>
          <CalendarLegend showAvailability={isFaculty && showAvailability} showBusy={isFaculty && showBusy} />
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
        <div className="contents xl:order-2 xl:col-span-4 xl:block">
          {isFaculty && connectionPanel && <div className="order-1 xl:mb-5">{connectionPanel}</div>}
          <div className="order-3 space-y-5">
          <DetailPanel selected={selected} scope={scope} onClose={() => setSelected(null)} onChanged={() => { setSelected(null); setReload((n) => n + 1); }} />
          {attention.length > 0 && (
            <Card>
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
            {!isFaculty && <CalendarFeedCard />}
          </div>
        </div>
      </div>
    </div>
  );
}
