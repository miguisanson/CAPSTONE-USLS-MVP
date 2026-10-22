import {
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  Clock3,
  UserRoundCheck,
} from "lucide-react";
import { Field, Input } from "../../components/forms";
import { availabilityLabel, isAvailabilityEntered } from "../../components/scheduling/dates";
import { formatTime, shortDate, timeRange } from "./shared";

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
  return (
    <>
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Preferred date window</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The system searches for a {availability.duration_minutes || 120}-minute overlap.
            </p>
            {availability.lead_days > 0 && (
              <p className="mt-1 text-xs font-semibold text-brand-700">
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
      </div>

      {participants.length > 0 && visibleDates.length > 0 && (
        <section aria-labelledby="availability-overlap-heading" className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="availability-overlap-heading" className="text-sm font-semibold text-ink">Availability overlap</p>
              <p className="text-xs text-slate-500">Darker green means more participants are free. Amber full-overlap cells are already booked and cannot be selected.</p>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span>0/{participants.length}</span><span className="h-4 w-5 rounded bg-slate-100 ring-1 ring-slate-200" /><span className="h-4 w-5 rounded bg-emerald-200" /><span className="h-4 w-5 rounded bg-emerald-600" /><span>{participants.length}/{participants.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[720px] w-full border-collapse text-center text-xs">
              <thead><tr className="bg-slate-50"><th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-2 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">Time</th>{visibleDates.map((day) => <th key={day} className="border-b border-slate-200 px-2 py-3 font-semibold text-slate-700">{shortDate(day)}</th>)}</tr></thead>
              <tbody>
                {Array.from({ length: 20 }, (_, index) => 8 * 60 + index * 30).map((minutes) => {
                  const start = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
                  return <tr key={start}>
                    <th className="sticky left-0 z-10 border-r border-t border-slate-200 bg-white px-2 py-2 text-left font-medium text-slate-500">{formatTime(start)}</th>
                    {visibleDates.map((day) => {
                      const count = participants.filter((participant) => {
                        const available = participant.slots.some((slot) => slot.date === day && slot.start <= start && slot.end > start);
                        const busy = [...(participant.profile_busy || []), ...(participant.google_busy || [])]
                          .some((block) => block.date === day && block.start <= start && block.end > start);
                        return available && !busy;
                      }).length;
                      const option = filteredSlots.find((slot) => slot.date === day && slot.start === start);
                      const blockedOption = blockedSlots.find((slot) => slot.date === day && slot.start === start);
                      const selected = form.preferred_date === day && form.selected_start === start;
                      const tone = blockedOption ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200" : count === participants.length ? "bg-emerald-600 text-white hover:bg-emerald-700" : count >= Math.ceil(participants.length * 0.66) ? "bg-emerald-300 text-emerald-950" : count ? "bg-emerald-100 text-emerald-900" : "bg-slate-50 text-slate-400";
                      return <td key={day} className="border-t border-slate-200 p-1"><button type="button" disabled={!option} onClick={() => option && chooseSlot(option)} aria-label={`${shortDate(day)} ${start}: ${count} of ${participants.length} available${blockedOption ? ", already booked" : option ? ", selectable" : ""}`} title={blockedOption?.conflicts?.join(" ")} className={`min-h-8 w-full rounded-md px-1 py-1.5 font-bold transition-colors ${tone} ${option ? "cursor-pointer focus:ring-2 focus:ring-brand-500 focus:ring-offset-1" : "cursor-not-allowed"} ${selected ? "ring-2 ring-slate-900 ring-offset-1" : ""}`}>{count}/{participants.length}</button></td>;
                    })}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {participants.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-ink">Panel availability</p>
              <p className="text-xs text-slate-500">Detailed source availability for each adviser and panelist.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              <UserRoundCheck className="h-3.5 w-3.5" />
              {participants.length} participants
            </span>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-[760px] w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="sticky left-0 z-10 w-36 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Date
                  </th>
                  {participants.map((participant) => (
                    <th key={participant.faculty_id} className="min-w-44 border-b border-slate-200 px-3 py-3">
                      <p className="font-semibold text-ink">{participant.name}</p>
                      <p className="mt-0.5 text-xs font-normal text-slate-500">{participant.role} · {participant.college}</p>
                      <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        participant.calendar_connected || isAvailabilityEntered(participant)
                          ? "bg-green-50 text-green-700 ring-1 ring-green-100"
                          : "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
                      }`}>
                        {participant.calendar_connected || isAvailabilityEntered(participant) ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                        {availabilityLabel(participant)}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleDates.map((day) => {
                  const hasOverlap = possibleDates.has(day);
                  return (
                    <tr key={day} className={hasOverlap ? "bg-brand-50/55" : "bg-white"}>
                      <td className={`sticky left-0 z-10 border-r border-t border-slate-200 px-3 py-3 ${hasOverlap ? "bg-brand-50" : "bg-white"}`}>
                        <p className="font-semibold text-ink">{shortDate(day)}</p>
                        {hasOverlap && <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-brand-700">Overlap found</p>}
                      </td>
                      {participants.map((participant) => {
                        const slots = participant.slots.filter((slot) => slot.date === day);
                        const busy = [...(participant.profile_busy || []), ...(participant.google_busy || [])]
                          .filter((slot) => slot.date === day);
                        return (
                          <td key={participant.faculty_id} className="border-t border-slate-200 px-3 py-3 align-top">
                            {slots.length || busy.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {slots.map((slot) => (
                                  <span
                                    key={`${slot.start}-${slot.end}`}
                                    className="rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200"
                                  >
                                    {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                                {busy.map((slot) => (
                                  <span key={`busy-${slot.start}-${slot.end}`} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-100">
                                    Busy {timeRange(slot.start, slot.end)}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className={`text-xs font-medium ${isAvailabilityEntered(participant) ? "text-slate-400" : "text-amber-700"}`}>{isAvailabilityEntered(participant) ? "Unavailable" : "Not entered"}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visibleDates.length === 0 && (
              <div className="p-8 text-center text-sm text-slate-500">No availability was entered inside this date window.</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Best shared options</p>
            <p className="text-xs text-slate-500">Select one to prepare the proposed schedule.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {filteredSlots.length} conflict-free found
          </span>
        </div>
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
                  onClick={() => chooseSlot(slot)}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    selected
                      ? "border-brand-500 bg-brand-50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                  }`}
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${selected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                    <CalendarDays className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {index === 0 ? "Earliest option - " : ""}{shortDate(slot.date)}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                      <Clock3 className="h-3.5 w-3.5" /> {timeRange(slot.start, slot.end)} - all {slot.matched_count} who entered availability are free
                    </span>
                    {(slot.missing_availability || []).length > 0 && (
                      <span className="mt-0.5 block text-xs font-semibold text-amber-700">Not checked: {slot.missing_availability.join(", ")} (availability not entered)</span>
                    )}
                  </span>
                  <span className={`h-4 w-4 rounded-full border-2 ${selected ? "border-brand-600 bg-brand-600 ring-2 ring-white" : "border-slate-300"}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
            {(availability.missing_availability || []).length > 0
              ? `No overlap can be suggested yet: ${availability.missing_availability.join(", ")} ${availability.missing_availability.length === 1 ? "has" : "have"} not entered availability. Use "Ask for availability" above, or pick a time yourself and confirm the warning.`
              : "No conflict-free overlap appears in this window. Revise the dates, choose a different panel window, or ask the adviser and panel to enter more dates."}
          </div>
        )}
      </div>

      {form.preferred_date && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">Selected proposed schedule</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-brand-900">
            <span className="inline-flex items-center gap-2 font-semibold">
              <CalendarDays className="h-4 w-4" /> {shortDate(form.preferred_date)}
            </span>
            <span className="inline-flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4" /> {timeRange(form.selected_start, form.selected_end)}
            </span>
            <span className="inline-flex items-center gap-2">
              <UserRoundCheck className="h-4 w-4" /> Checked against the availability people entered
            </span>
          </div>
        </div>
      )}
    </>
  );
}
