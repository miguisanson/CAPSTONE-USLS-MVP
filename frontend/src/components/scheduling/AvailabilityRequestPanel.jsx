import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Send } from "lucide-react";
import { api } from "../../api";
import { ErrorNote, StatusBadge } from "../ui";
import { Field, Input, Textarea } from "../forms";
import { addDays, isoDay, parseDay } from "../calendar/CalendarView";
import { availabilityLabel, isAvailabilityEntered, longDate } from "./dates";

// Invitation state shown next to a panelist (Invited / Accepted / Declined + the reason).
export function InvitationChip({ invitation }) {
  if (!invitation) return null;
  return (
    <div className="mt-2 space-y-1">
      <StatusBadge value={invitation.status === "Invited" ? "Invited" : invitation.status} dot={false} />
      {invitation.status === "Declined" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
          Declined{invitation.reason ? `: ${invitation.reason}` : ""}. Replace this panelist or ask them to accept.
        </p>
      )}
    </div>
  );
}

// "Availability of the panel": who has entered availability, ask the ones who have not, and see who answered.
export default function AvailabilityRequestPanel({ context, studentId, refetch }) {
  const availability = context.availability || {};
  const participants = availability.participants || [];
  const requests = context.availability_requests || [];
  const earliest = availability.earliest_schedule_date || availability.today || isoDay(new Date());
  const [windowStart, setWindowStart] = useState(earliest);
  const [windowEnd, setWindowEnd] = useState(isoDay(addDays(parseDay(earliest), 28)));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    setWindowStart(earliest);
    setWindowEnd(isoDay(addDays(parseDay(earliest), 28)));
    setDone("");
    setError("");
  }, [studentId, earliest]);

  if (!participants.length) return null;
  const missing = participants.filter((item) => !isAvailabilityEntered(item));

  async function send() {
    setBusy(true);
    setError("");
    setDone("");
    try {
      const body = await api.requestPanelAvailability({
        student_id: studentId, window_start: windowStart, window_end: windowEnd, message,
      });
      setDone(`Asked ${body.requests?.length || 0} people to enter their availability.`);
      setMessage("");
      await refetch?.();
    } catch (err) {
      setError(err.message || "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="panel-availability-request" className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p id="panel-availability-request" className="text-sm font-semibold text-ink">Availability of the panel</p>
          <p className="text-xs text-slate-500">Nobody is assumed to be free. People who have not entered availability are not checked.</p>
        </div>
        {missing.length > 0 && <StatusBadge value={`${missing.length} not entered`} dot={false} className="!bg-amber-50 !text-amber-800 !ring-amber-200" />}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {participants.map((participant) => {
          const entered = isAvailabilityEntered(participant);
          const request = requests.find((item) => item.faculty_id === participant.faculty_id && item.status === "Open");
          return (
            <li key={participant.faculty_id} className={`rounded-xl border px-3 py-2 ${entered ? "border-slate-200" : "border-amber-200 bg-amber-50/60"}`}>
              <p className="text-sm font-semibold text-ink">{participant.name} <span className="text-xs font-normal text-slate-500">· {participant.role}</span></p>
              <p className={`mt-0.5 flex items-center gap-1.5 text-xs font-semibold ${entered ? "text-emerald-700" : "text-amber-800"}`}>
                {entered && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {availabilityLabel(participant)}
              </p>
              {request && <p className="mt-1 text-xs text-slate-500">Asked on {longDate(request.created_at?.slice(0, 10))}; waiting for an answer.</p>}
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 rounded-xl bg-slate-50 p-3">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500"><BellRing className="h-3.5 w-3.5" aria-hidden="true" />Ask the adviser and the panel for their available dates</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dates needed from"><Input type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></Field>
          <Field label="Until"><Input type="date" value={windowEnd} min={windowStart} onChange={(e) => setWindowEnd(e.target.value)} /></Field>
        </div>
        <Field label="Message (optional)"><Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please enter your dates for the proposal defense." /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary px-4 py-2 text-sm" disabled={busy || !windowStart || !windowEnd} onClick={send}>
            <Send className="h-4 w-4" aria-hidden="true" />{busy ? "Sending..." : "Ask for availability"}
          </button>
          {done && <span className="text-xs font-semibold text-emerald-700" role="status">{done}</span>}
        </div>
        <ErrorNote message={error} />
      </div>
      {requests.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">Who answered</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-xs">
              <thead><tr className="text-slate-400"><th className="py-1 pr-3 font-bold">Faculty</th><th className="py-1 pr-3 font-bold">Window</th><th className="py-1 pr-3 font-bold">Status</th><th className="py-1 font-bold">Answered</th></tr></thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="py-1.5 pr-3 font-semibold text-ink">{item.faculty_name}</td>
                    <td className="py-1.5 pr-3 text-slate-600">{longDate(item.window_start)} – {longDate(item.window_end)}</td>
                    <td className="py-1.5 pr-3"><StatusBadge value={item.status} dot={false} /></td>
                    <td className="py-1.5 text-slate-600">{item.answered_at ? longDate(item.answered_at.slice(0, 10)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
