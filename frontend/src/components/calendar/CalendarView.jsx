import { useMemo } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Flag, MapPin } from "lucide-react";
import { StatusBadge } from "../ui";

// A light month / week / agenda calendar (no calendar library). It only draws what it is given:
// defense events (date + time range), deadline markers (date only), an optional availability
// layer (faculty "My calendar") and optional Google busy blocks. All times are naive local
// Asia/Manila values, exactly as the API sends them, so nothing here converts time zones.

export const CALENDAR_VIEWS = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "agenda", label: "Agenda" },
];

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const HOUR_PX = 52;
const AGENDA_DAYS = 60;

// Colour by stage; colour is never the only signal (the label is always printed too).
export const DEFENSE_STYLES = {
  "Title Defense": { chip: "border-emerald-200 bg-emerald-50 text-emerald-900", bar: "border-emerald-300 bg-emerald-100 text-emerald-900", dot: "bg-emerald-500" },
  "Proposal Defense": { chip: "border-blue-200 bg-blue-50 text-blue-900", bar: "border-blue-300 bg-blue-100 text-blue-900", dot: "bg-blue-500" },
  "Final Defense": { chip: "border-violet-200 bg-violet-50 text-violet-900", bar: "border-violet-300 bg-violet-100 text-violet-900", dot: "bg-violet-500" },
  "Public Final Defense": { chip: "border-amber-200 bg-amber-50 text-amber-900", bar: "border-amber-300 bg-amber-100 text-amber-900", dot: "bg-amber-500" },
};
const FALLBACK_STYLE = { chip: "border-slate-200 bg-slate-50 text-slate-800", bar: "border-slate-300 bg-slate-100 text-slate-800", dot: "bg-slate-500" };

export function parseDay(value) {
  if (value instanceof Date) return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function isoDay(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date) {
  const offset = (date.getDay() + 6) % 7; // Monday first
  return addDays(date, -offset);
}

function startOfMonthGrid(date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1));
}

// The API range to fetch for what is on screen.
export function visibleRange(anchor, view) {
  if (view === "week") {
    const first = startOfWeek(anchor);
    return { start: isoDay(first), end: isoDay(addDays(first, 6)) };
  }
  if (view === "agenda") {
    const first = parseDay(anchor);
    return { start: isoDay(first), end: isoDay(addDays(first, AGENDA_DAYS)) };
  }
  const first = startOfMonthGrid(anchor);
  return { start: isoDay(first), end: isoDay(addDays(first, 41)) };
}

export function moveAnchor(anchor, view, direction) {
  if (view === "week") return addDays(anchor, 7 * direction);
  if (view === "agenda") return addDays(anchor, 14 * direction);
  return new Date(anchor.getFullYear(), anchor.getMonth() + direction, 1);
}

function toolbarTitle(anchor, view) {
  if (view === "week") {
    const first = startOfWeek(anchor);
    const last = addDays(first, 6);
    const fmt = { month: "short", day: "numeric" };
    return `${first.toLocaleDateString(undefined, fmt)} – ${last.toLocaleDateString(undefined, { ...fmt, year: "numeric" })}`;
  }
  if (view === "agenda") return `From ${anchor.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`;
  return anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

function timeOf(iso) {
  return String(iso || "").slice(11, 16);
}

function minutesOf(iso) {
  const [h, m] = timeOf(iso).split(":").map(Number);
  return h * 60 + (m || 0);
}

function hhmm(value) {
  const [h, m] = String(value || "0:0").split(":").map(Number);
  return h * 60 + (m || 0);
}

function shortStage(type) {
  return (type || "Defense").replace(" Defense", "");
}

function eventLabel(event) {
  return `${timeOf(event.start)} ${shortStage(event.defense_type)} · ${event.student_name || ""}`.trim();
}

function statusMark(event) {
  if (event.status === "Cancelled" || event.status === "Rescheduled") return "line-through opacity-60";
  return "";
}

function alertRing(event) {
  if (event.verdict_overdue) return "ring-2 ring-red-400";
  if (event.status === "Needs Re-confirmation" || (event.attention || []).length) return "ring-2 ring-amber-400";
  return "";
}

const URGENCY_CLASSES = {
  overdue: "border-red-300 bg-red-50 text-red-800",
  soon: "border-amber-300 bg-amber-50 text-amber-900",
  later: "border-slate-300 bg-white text-slate-700",
  done: "border-slate-200 bg-slate-50 text-slate-400 line-through",
};

function DeadlineChip({ item, onSelect, compact = false }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(item)}
      title={`${item.label}${item.student_name ? ` (${item.student_name})` : ""}${item.done ? " — done" : ""}`}
      className={`flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md border border-dashed px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight ${URGENCY_CLASSES[item.urgency] || URGENCY_CLASSES.later}`}
    >
      <Flag className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="truncate">{compact ? item.label.split(" (")[0] : `${item.label}${item.student_name ? ` · ${item.student_name}` : ""}`}</span>
    </button>
  );
}

function EventChip({ event, onSelect, selected }) {
  const style = DEFENSE_STYLES[event.defense_type] || FALLBACK_STYLE;
  return (
    <button
      type="button"
      onClick={() => onSelect?.(event)}
      title={`${event.title} · ${timeOf(event.start)}–${timeOf(event.end)}${event.venue ? ` · ${event.venue}` : ""} · ${event.status}`}
      className={`flex w-full min-w-0 cursor-pointer items-center gap-1 rounded-md border px-1.5 py-0.5 text-left text-[11px] font-semibold leading-tight transition-shadow hover:shadow-card ${style.chip} ${statusMark(event)} ${alertRing(event)} ${selected ? "outline outline-2 outline-brand-600" : ""}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} aria-hidden="true" />
      <span className="truncate">{eventLabel(event)}</span>
    </button>
  );
}

function byDay(items, key) {
  const map = new Map();
  for (const item of items || []) {
    const day = key(item);
    if (!map.has(day)) map.set(day, []);
    map.get(day).push(item);
  }
  return map;
}

// ---------------------------------------------------------------- month
function MonthView({ anchor, events, deadlines, onSelectEvent, onSelectDeadline, onPickDay, selectedId }) {
  const first = startOfMonthGrid(anchor);
  const today = isoDay(new Date());
  const eventsByDay = useMemo(() => byDay(events, (e) => String(e.start).slice(0, 10)), [events]);
  const deadlinesByDay = useMemo(() => byDay(deadlines, (d) => d.date), [deadlines]);
  const days = Array.from({ length: 42 }, (_, index) => addDays(first, index));
  return (
    <div className="overflow-x-auto">
      {/* Seven equal columns that shrink with the card (chips truncate); the 30rem floor only matters on a phone. */}
      <div className="min-w-[30rem]">
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))] border-b border-slate-200 text-center text-[11px] font-bold uppercase tracking-wide text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((name) => (
            <div key={name} className="py-2">{name}</div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(7,minmax(0,1fr))]">
          {days.map((day) => {
            const key = isoDay(day);
            const dayEvents = eventsByDay.get(key) || [];
            const dayDeadlines = deadlinesByDay.get(key) || [];
            const inMonth = day.getMonth() === anchor.getMonth();
            const shown = [...dayEvents.map((e) => ({ type: "event", item: e })), ...dayDeadlines.map((d) => ({ type: "deadline", item: d }))];
            return (
              <div
                key={key}
                className={`min-h-[7.5rem] space-y-1 border-b border-r border-slate-100 p-1.5 ${inMonth ? "bg-white" : "bg-slate-50/70"} ${day.getDay() === 0 || day.getDay() === 6 ? "bg-slate-50/50" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onPickDay?.(day)}
                  aria-label={`Open ${day.toDateString()} in week view`}
                  className={`grid h-6 min-w-[1.5rem] cursor-pointer place-items-center rounded-full px-1 text-xs font-bold ${key === today ? "bg-brand-600 text-white" : inMonth ? "text-slate-700 hover:bg-slate-100" : "text-slate-400 hover:bg-slate-100"}`}
                >
                  {day.getDate()}
                </button>
                {shown.slice(0, 3).map(({ type, item }) =>
                  type === "event" ? (
                    <EventChip key={item.id} event={item} onSelect={onSelectEvent} selected={selectedId === item.id} />
                  ) : (
                    <DeadlineChip key={item.id} item={item} onSelect={onSelectDeadline} compact />
                  ),
                )}
                {shown.length > 3 && (
                  <button type="button" onClick={() => onPickDay?.(day)} className="w-full cursor-pointer rounded px-1 text-left text-[11px] font-bold text-brand-700 hover:underline">
                    +{shown.length - 3} more
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- week
function layoutOverlaps(dayEvents) {
  const sorted = [...dayEvents].sort((a, b) => minutesOf(a.start) - minutesOf(b.start) || minutesOf(b.end) - minutesOf(a.end));
  const placed = [];
  let cluster = [];
  let clusterEnd = -1;
  const flush = () => {
    const columns = [];
    for (const entry of cluster) {
      let col = columns.findIndex((end) => end <= minutesOf(entry.event.start));
      if (col === -1) {
        col = columns.length;
        columns.push(0);
      }
      columns[col] = minutesOf(entry.event.end);
      entry.col = col;
    }
    cluster.forEach((entry) => {
      entry.cols = columns.length;
      placed.push(entry);
    });
    cluster = [];
  };
  for (const event of sorted) {
    if (cluster.length && minutesOf(event.start) >= clusterEnd) flush();
    cluster.push({ event });
    clusterEnd = Math.max(clusterEnd, minutesOf(event.end));
  }
  if (cluster.length) flush();
  return placed;
}

function topOf(minutes) {
  return ((minutes - DAY_START_HOUR * 60) / 60) * HOUR_PX;
}

function WeekView({ anchor, events, deadlines, availability, busy, onSelectEvent, onSelectDeadline, selectedId }) {
  const first = startOfWeek(anchor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));
  const today = isoDay(new Date());
  const eventsByDay = useMemo(() => byDay(events, (e) => String(e.start).slice(0, 10)), [events]);
  const deadlinesByDay = useMemo(() => byDay(deadlines, (d) => d.date), [deadlines]);
  const availabilityByDay = useMemo(() => new Map((availability || []).map((entry) => [entry.date, entry])), [availability]);
  const busyByDay = useMemo(() => byDay(busy, (b) => b.date), [busy]);
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, index) => DAY_START_HOUR + index);
  const gridHeight = hours.length * HOUR_PX;
  const hasAvailabilityLayer = Boolean(availability && availability.length);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[38rem]">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200">
          <div />
          {days.map((day) => {
            const key = isoDay(day);
            return (
              <div key={key} className="border-l border-slate-100 px-1.5 py-2 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{day.toLocaleDateString(undefined, { weekday: "short" })}</p>
                <p className={`mx-auto mt-0.5 grid h-7 min-w-[1.75rem] place-items-center rounded-full px-1 text-sm font-bold ${key === today ? "bg-brand-600 text-white" : "text-slate-700"}`}>{day.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))] border-b border-slate-200 bg-slate-50/60">
          <div className="px-1 py-1.5 text-right text-[10px] font-bold uppercase text-slate-400">Due</div>
          {days.map((day) => (
            <div key={isoDay(day)} className="min-h-[2rem] space-y-1 border-l border-slate-100 p-1">
              {(deadlinesByDay.get(isoDay(day)) || []).map((item) => (
                <DeadlineChip key={item.id} item={item} onSelect={onSelectDeadline} compact />
              ))}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]" style={{ height: gridHeight }}>
          <div className="relative">
            {hours.map((hour) => (
              <div key={hour} className="absolute right-1 -translate-y-2 text-[10px] font-semibold text-slate-400" style={{ top: (hour - DAY_START_HOUR) * HOUR_PX }}>
                {String(hour).padStart(2, "0")}:00
              </div>
            ))}
          </div>
          {days.map((day) => {
            const key = isoDay(day);
            const layer = availabilityByDay.get(key);
            const placed = layoutOverlaps(eventsByDay.get(key) || []);
            return (
              <div key={key} className="relative border-l border-slate-100" style={{ height: gridHeight }}>
                {hours.map((hour) => (
                  <div key={hour} className="absolute inset-x-0 border-t border-slate-100" style={{ top: (hour - DAY_START_HOUR) * HOUR_PX }} />
                ))}
                {hasAvailabilityLayer && layer && !layer.entered && (
                  <div
                    className="absolute inset-0 bg-[repeating-linear-gradient(135deg,rgba(148,163,184,0.15)_0,rgba(148,163,184,0.15)_6px,transparent_6px,transparent_12px)]"
                    title="Availability not entered"
                  />
                )}
                {layer?.windows?.map((window, index) => (
                  <div
                    key={`w${index}`}
                    className="absolute inset-x-0 bg-brand-50/80"
                    style={{ top: Math.max(0, topOf(hhmm(window.start))), height: Math.max(0, topOf(hhmm(window.end)) - Math.max(0, topOf(hhmm(window.start)))) }}
                    title={`Available ${window.start}–${window.end}`}
                  />
                ))}
                {layer?.blocked?.map((block, index) => (
                  <div
                    key={`b${index}`}
                    className="absolute inset-x-0 bg-red-100/70"
                    style={
                      block.all_day
                        ? { top: 0, height: gridHeight }
                        : { top: Math.max(0, topOf(hhmm(block.start))), height: Math.max(0, topOf(hhmm(block.end)) - Math.max(0, topOf(hhmm(block.start)))) }
                    }
                    title={`Not available${block.note ? `: ${block.note}` : ""}`}
                  >
                    {block.all_day && <span className="m-1 inline-block rounded bg-white/80 px-1 text-[10px] font-bold text-red-700">Not available{block.note ? ` · ${block.note}` : ""}</span>}
                  </div>
                ))}
                {(busyByDay.get(key) || []).map((block, index) => (
                  <div
                    key={`g${index}`}
                    className="absolute inset-x-1 rounded bg-slate-300/70 px-1 text-[10px] font-semibold text-slate-700"
                    style={{ top: Math.max(0, topOf(hhmm(block.start))), height: Math.max(14, topOf(hhmm(block.end)) - Math.max(0, topOf(hhmm(block.start)))) }}
                    title="Busy on Google Calendar"
                  >
                    Busy
                  </div>
                ))}
                {placed.map(({ event, col, cols }) => {
                  const style = DEFENSE_STYLES[event.defense_type] || FALLBACK_STYLE;
                  const top = Math.max(0, topOf(minutesOf(event.start)));
                  const height = Math.max(24, topOf(minutesOf(event.end)) - top);
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent?.(event)}
                      className={`absolute cursor-pointer overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] font-semibold leading-tight shadow-sm hover:shadow-card ${style.bar} ${statusMark(event)} ${alertRing(event)} ${selectedId === event.id ? "outline outline-2 outline-brand-600" : ""}`}
                      style={{ top, height, left: `calc(${(col / cols) * 100}% + 2px)`, width: `calc(${100 / cols}% - 4px)` }}
                      title={`${event.title} · ${timeOf(event.start)}–${timeOf(event.end)} · ${event.status}`}
                    >
                      <span className="block truncate">{timeOf(event.start)}–{timeOf(event.end)}</span>
                      <span className="block truncate">{shortStage(event.defense_type)} · {event.student_name}</span>
                      {height > 52 && event.venue && <span className="block truncate font-normal opacity-80">{event.venue}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- agenda
function AgendaView({ anchor, events, deadlines, onSelectEvent, onSelectDeadline, selectedId }) {
  const startKey = isoDay(anchor);
  const rows = useMemo(() => {
    const entries = [
      ...events.filter((e) => String(e.start).slice(0, 10) >= startKey).map((e) => ({ day: String(e.start).slice(0, 10), time: timeOf(e.start), type: "event", item: e })),
      ...deadlines.filter((d) => d.date >= startKey).map((d) => ({ day: d.date, time: "99:99", type: "deadline", item: d })),
    ];
    entries.sort((a, b) => (a.day + a.time).localeCompare(b.day + b.time));
    const groups = [];
    for (const entry of entries) {
      const last = groups[groups.length - 1];
      if (last && last.day === entry.day) last.entries.push(entry);
      else groups.push({ day: entry.day, entries: [entry] });
    }
    return groups;
  }, [events, deadlines, startKey]);
  if (!rows.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 text-center text-slate-500">
        <CalendarClock className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <p className="text-sm font-semibold">Nothing on the calendar in this period.</p>
      </div>
    );
  }
  return (
    <ol className="divide-y divide-slate-100">
      {rows.map((group) => (
        <li key={group.day} className="grid gap-2 py-3 sm:grid-cols-[9rem_1fr]">
          <p className="text-sm font-bold text-ink">
            {parseDay(group.day).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
            {group.day === isoDay(new Date()) && <span className="ml-2 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Today</span>}
          </p>
          <ul className="space-y-2">
            {group.entries.map(({ type, item }) =>
              type === "deadline" ? (
                <li key={item.id}><DeadlineChip item={item} onSelect={onSelectDeadline} /></li>
              ) : (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(item)}
                    className={`flex w-full cursor-pointer flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left hover:shadow-card ${(DEFENSE_STYLES[item.defense_type] || FALLBACK_STYLE).chip} ${alertRing(item)} ${selectedId === item.id ? "outline outline-2 outline-brand-600" : ""}`}
                  >
                    <span className={`min-w-0 ${statusMark(item)}`}>
                      <span className="block text-sm font-bold">{timeOf(item.start)}–{timeOf(item.end)} · {item.defense_type} · {item.student_name}</span>
                      <span className="flex flex-wrap items-center gap-x-3 text-xs opacity-80">
                        {item.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" aria-hidden="true" />{item.venue}</span>}
                        {item.my_role && <span>Your role: {item.my_role}</span>}
                        {(item.panel || []).length > 0 && <span>{item.panel.length} on the panel</span>}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      {item.verdict_overdue && <StatusBadge value="Verdict overdue" dot={false} className="!bg-red-50 !text-red-700 !ring-red-200" />}
                      <StatusBadge value={item.status} dot={false} />
                    </span>
                  </button>
                </li>
              ),
            )}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function CalendarLegend({ showAvailability = false, showBusy = false }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500" aria-label="Legend">
      {Object.entries(DEFENSE_STYLES).filter(([name]) => name !== "Public Final Defense").map(([name, style]) => (
        <li key={name} className="inline-flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />{name}</li>
      ))}
      <li className="inline-flex items-center gap-1.5"><Flag className="h-3 w-3" aria-hidden="true" />Deadline</li>
      <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-2 ring-amber-400" />Needs attention</li>
      <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm ring-2 ring-red-400" />Verdict overdue</li>
      {showAvailability && <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-brand-100" />Available</li>}
      {showAvailability && <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-red-100" />Not available</li>}
      {showBusy && <li className="inline-flex items-center gap-1.5"><span className="h-2.5 w-4 rounded-sm bg-slate-300" />Busy (Google)</li>}
    </ul>
  );
}

export default function CalendarView({
  events = [],
  deadlines = [],
  availability = null,
  busy = [],
  anchor,
  onAnchorChange,
  view,
  onViewChange,
  onSelectEvent,
  onSelectDeadline,
  selectedId = null,
  timezone = "Asia/Manila",
  loading = false,
  toolbarExtra = null,
}) {
  const go = (direction) => onAnchorChange(direction === 0 ? new Date() : moveAnchor(anchor, view, direction));
  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => go(0)}>Today</button>
          <button type="button" aria-label="Previous" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => go(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Next" className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => go(1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
          <h2 className="ml-1 font-display text-base font-semibold text-ink" aria-live="polite">{toolbarTitle(anchor, view)}</h2>
          {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" aria-label="Loading" />}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {toolbarExtra}
          <div role="group" aria-label="Calendar view" className="inline-flex overflow-hidden rounded-xl border border-slate-200">
            {CALENDAR_VIEWS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={view === option.id}
                onClick={() => onViewChange(option.id)}
                className={`cursor-pointer px-3 py-1.5 text-xs font-bold ${view === option.id ? "bg-brand-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="p-2 sm:p-3">
        {view === "month" && (
          <MonthView
            anchor={anchor}
            events={events}
            deadlines={deadlines}
            onSelectEvent={onSelectEvent}
            onSelectDeadline={onSelectDeadline}
            selectedId={selectedId}
            onPickDay={(day) => {
              onAnchorChange(day);
              onViewChange("week");
            }}
          />
        )}
        {view === "week" && (
          <WeekView
            anchor={anchor}
            events={events}
            deadlines={deadlines}
            availability={availability}
            busy={busy}
            onSelectEvent={onSelectEvent}
            onSelectDeadline={onSelectDeadline}
            selectedId={selectedId}
          />
        )}
        {view === "agenda" && (
          <AgendaView anchor={anchor} events={events} deadlines={deadlines} onSelectEvent={onSelectEvent} onSelectDeadline={onSelectDeadline} selectedId={selectedId} />
        )}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] font-semibold text-slate-400">
        All times are Philippine time ({timezone}).
      </p>
    </div>
  );
}
