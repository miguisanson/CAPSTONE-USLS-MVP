import { CalendarDays, Clock3, UserRoundCheck } from "lucide-react";
import { Card, DataTable, Field, InlineNotice, Input, SectionCard, StatusChip } from "../../components/ui/index.js";
import { availabilityLabel, isAvailabilityEntered } from "../../components/scheduling/dates";
import { formatTime, shortDate, timeRange } from "./shared";

// Half-hour rows from 8:00 AM to 5:30 PM, the same grid the overlap search uses.
const TIME_ROWS = Array.from({ length: 20 }, (_, index) => {
  const minutes = 8 * 60 + index * 30;
  return { id: `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}` };
});

const busyOf = (participant) => [...(participant.profile_busy || []), ...(participant.google_busy || [])];

export function AvailabilityWorkspace({
  availability,
  participants,
  filteredSlots,
  blockedSlots,
  visibleDates,
  possibleDates,
  window,
  setWindow,
  form,
  chooseSlot,
}) {
  // ---- the overlap heat grid: one column per day, one row per half hour ------------------
  const overlapColumns = [
    {
      key: "time",
      header: "Time",
      className: "!px-2 !py-1 whitespace-nowrap",
      cell: (row) => <span className="font-medium text-slate-500">{formatTime(row.id)}</span>,
    },
    ...visibleDates.map((day) => ({
      key: day,
      header: shortDate(day),
      align: "center",
      className: "!p-1",
      cell: (row) => {
        const start = row.id;
        const count = participants.filter((participant) => {
          const available = participant.slots.some((slot) => slot.date === day && slot.start <= start && slot.end > start);
          const busy = busyOf(participant).some((block) => block.date === day && block.start <= start && block.end > start);
          return available && !busy;
        }).length;
        const option = filteredSlots.find((slot) => slot.date === day && slot.start === start);
        const blockedOption = blockedSlots.find((slot) => slot.date === day && slot.start === start);
        const selected = form.preferred_date === day && form.selected_start === start;
        const tone = blockedOption
          ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
          : count === participants.length
            ? "bg-brand-600 text-white hover:bg-brand-700"
            : count >= Math.ceil(participants.length * 0.66)
              ? "bg-brand-200 text-brand-900"
              : count
                ? "bg-brand-50 text-brand-800"
                : "bg-slate-50 text-slate-500";
        return (
          <button
            type="button"
            disabled={!option}
            onClick={() => option && chooseSlot(option)}
            aria-label={`${shortDate(day)} ${start}: ${count} of ${participants.length} available${blockedOption ? ", already booked" : option ? ", selectable" : ""}`}
            title={blockedOption?.conflicts?.join(" ")}
            className={`min-h-8 w-full rounded-lg px-1 py-1.5 text-xs font-semibold transition-colors ${tone} ${option ? "cursor-pointer focus:ring-2 focus:ring-brand-500 focus:ring-offset-1" : "cursor-not-allowed"} ${selected ? "ring-2 ring-ink ring-offset-1" : ""}`}
          >
            {count}/{participants.length}
          </button>
        );
      },
    })),
  ];

  // ---- the per-person table: one column per participant, one row per day -------------------
  const dayRows = visibleDates.map((day) => ({ id: day }));
  const participantColumns = [
    {
      key: "date",
      header: "Date",
      className: "w-36",
      cell: (row) => (
        <div>
          <p className="font-semibold text-ink">{shortDate(row.id)}</p>
          {possibleDates.has(row.id) && <StatusChip className="mt-1" status="Ready" label="Overlap found" size="sm" dot={false} />}
        </div>
      ),
    },
    ...participants.map((participant) => ({
      key: `p-${participant.faculty_id}`,
      header: (
        <div className="min-w-40 normal-case tracking-normal">
          <p className="font-semibold text-ink">{participant.name}</p>
          <p className="meta mt-0.5 font-normal">{participant.role} · {participant.college}</p>
          <StatusChip
            className="mt-2"
            status={participant.calendar_connected || isAvailabilityEntered(participant) ? "Entered" : "Not entered"}
            label={availabilityLabel(participant)}
            size="sm"
          />
        </div>
      ),
      className: "align-top !whitespace-normal",
      cell: (row) => {
        const slots = participant.slots.filter((slot) => slot.date === row.id);
        const busy = busyOf(participant).filter((slot) => slot.date === row.id);
        if (!slots.length && !busy.length) {
          return <span className={`text-xs font-medium ${isAvailabilityEntered(participant) ? "text-slate-500" : "text-amber-800"}`}>{isAvailabilityEntered(participant) ? "Unavailable" : "Not entered"}</span>;
        }
        return (
          <div className="flex flex-wrap gap-1.5">
            {slots.map((slot) => (
              <span key={`${slot.start}-${slot.end}`} className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200">
                {timeRange(slot.start, slot.end)}
              </span>
            ))}
            {busy.map((slot) => (
              <span key={`busy-${slot.start}-${slot.end}`} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                Busy {timeRange(slot.start, slot.end)}
              </span>
            ))}
          </div>
        );
      },
    })),
  ];

  return (
    <>
      <Card pad="sm" className="bg-slate-50/70">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Preferred date window</p>
            <p className="meta mt-0.5">The system searches for a {availability.duration_minutes || 120}-minute overlap.</p>
            {availability.lead_days > 0 && (
              <p className="meta mt-1 font-semibold text-brand-700">
                {availability.lead_days}-day lead time applied. Suggestions begin {shortDate(availability.earliest_schedule_date)}.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:w-[360px]">
            <Field label="From">
              <Input
                type="date"
                value={window.start}
                min={availability.earliest_schedule_date}
                onChange={(e) => setWindow((current) => ({ ...current, start: e.target.value }))}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={window.end}
                min={window.start}
                onChange={(e) => setWindow((current) => ({ ...current, end: e.target.value }))}
              />
            </Field>
          </div>
        </div>
      </Card>

      {participants.length > 0 && visibleDates.length > 0 && (
        <SectionCard
          title="Availability overlap"
          subtitle="Darker green means more participants are free. Amber full-overlap cells are already booked and cannot be selected."
          action={
            <div className="meta hidden items-center gap-2 font-semibold sm:flex" aria-hidden="true">
              <span>0/{participants.length}</span>
              <span className="h-4 w-5 rounded bg-slate-100 ring-1 ring-slate-200" />
              <span className="h-4 w-5 rounded bg-brand-200" />
              <span className="h-4 w-5 rounded bg-brand-600" />
              <span>{participants.length}/{participants.length}</span>
            </div>
          }
        >
          <DataTable
            caption="Availability overlap by day and half hour"
            columns={overlapColumns}
            rows={TIME_ROWS}
            minWidth="md"
            dense
            stickyFirst
            pageSize={0}
          />
        </SectionCard>
      )}

      {participants.length > 0 && (
        <SectionCard
          title="Panel availability"
          subtitle="Detailed source availability for each adviser and panelist."
          action={
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <UserRoundCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {participants.length} participants
            </span>
          }
        >
          <DataTable
            caption="Availability of each participant by day"
            columns={participantColumns}
            rows={dayRows}
            minWidth="lg"
            stickyFirst
            pageSize={0}
            empty={{ title: "No availability was entered inside this date window." }}
          />
        </SectionCard>
      )}

      <SectionCard
        title="Best shared options"
        subtitle="Select one to prepare the proposed schedule."
        action={<span className="meta rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{filteredSlots.length} conflict-free found</span>}
      >
        {filteredSlots.length ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {filteredSlots.slice(0, 8).map((slot, index) => {
              const selected =
                form.preferred_date === slot.date &&
                form.selected_start === slot.start &&
                form.selected_end === slot.end;
              return (
                <button
                  key={`${slot.date}-${slot.start}`}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => chooseSlot(slot)}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CalendarDays className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {index === 0 ? "Earliest option - " : ""}{shortDate(slot.date)}
                    </span>
                    <span className="meta mt-0.5 flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {timeRange(slot.start, slot.end)} - all {slot.matched_count} who entered availability are free
                    </span>
                    {(slot.missing_availability || []).length > 0 && (
                      <span className="mt-0.5 block text-xs font-semibold text-amber-800">Not checked: {slot.missing_availability.join(", ")} (availability not entered)</span>
                    )}
                  </span>
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600 ring-2 ring-white" : "border-slate-300"}`} aria-hidden="true" />
                </button>
              );
            })}
          </div>
        ) : (
          <InlineNotice tone="warning">
            {(availability.missing_availability || []).length > 0
              ? `No overlap can be suggested yet: ${availability.missing_availability.join(", ")} ${availability.missing_availability.length === 1 ? "has" : "have"} not entered availability. Use "Ask for availability" above, or pick a time yourself and confirm the warning.`
              : "No conflict-free overlap appears in this window. Revise the dates, choose a different panel window, or ask the adviser and panel to enter more dates."}
          </InlineNotice>
        )}
      </SectionCard>

      {form.preferred_date && (
        <Card pad="sm" className="border-brand-200 bg-brand-50/70">
          <p className="eyebrow !text-brand-700">Selected proposed schedule</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-900">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" aria-hidden="true" /> {shortDate(form.preferred_date)}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" aria-hidden="true" /> {timeRange(form.selected_start, form.selected_end)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4" aria-hidden="true" /> Checked against the availability people entered
            </span>
          </div>
        </Card>
      )}
    </>
  );
}
