import { useEffect, useState } from "react";
import { BellRing, CheckCircle2, Send } from "lucide-react";
import { api } from "../../api";
import { Button, Card, DataTable, Field, InlineNotice, Input, StatusChip, Textarea } from "../ui/index.js";
import { addDays, isoDay, parseDay } from "../calendar/CalendarView";
import { availabilityLabel, isAvailabilityEntered, longDate } from "./dates";

// Invitation state shown next to a panelist (Invited / Accepted / Declined + the reason).
export function InvitationChip({ invitation }) {
  if (!invitation) return null;
  return (
    <div className="mt-2 space-y-1">
      <StatusChip status={invitation.status === "Invited" ? "Invited" : invitation.status} dot={false} />
      {invitation.status === "Declined" && (
        <InlineNotice tone="warning" className="!px-3 !py-2 text-xs">
          Declined{invitation.reason ? `: ${invitation.reason}` : ""}. Replace this panelist or ask them to accept.
        </InlineNotice>
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
    <Card as="section" pad="sm" aria-labelledby="panel-availability-request" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p id="panel-availability-request" className="text-sm font-semibold text-ink">Availability of the panel</p>
          <p className="meta">Nobody is assumed to be free. People who have not entered availability are not checked.</p>
        </div>
        {missing.length > 0 && <StatusChip status={`${missing.length} not entered`} tone="warning" dot={false} />}
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {participants.map((participant) => {
          const entered = isAvailabilityEntered(participant);
          const request = requests.find((item) => item.faculty_id === participant.faculty_id && item.status === "Open");
          return (
            <li key={participant.faculty_id} className={`rounded-xl border px-3 py-2 ${entered ? "border-slate-200" : "border-amber-200 bg-amber-50/60"}`}>
              <p className="text-sm font-semibold text-ink">{participant.name} <span className="meta font-normal">· {participant.role}</span></p>
              <p className={`meta mt-0.5 flex items-center gap-1.5 font-semibold ${entered ? "text-brand-700" : "text-amber-800"}`}>
                {entered && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                {availabilityLabel(participant)}
              </p>
              {request && <p className="meta mt-1">Asked on {longDate(request.created_at?.slice(0, 10))}; waiting for an answer.</p>}
            </li>
          );
        })}
      </ul>
      <div className="space-y-3 rounded-xl bg-slate-50 p-3">
        <p className="eyebrow flex items-center gap-2"><BellRing className="h-3.5 w-3.5" aria-hidden="true" />Ask the adviser and the panel for their available dates</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Dates needed from"><Input type="date" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></Field>
          <Field label="Until"><Input type="date" value={windowEnd} min={windowStart} onChange={(e) => setWindowEnd(e.target.value)} /></Field>
        </div>
        <Field label="Message (optional)"><Textarea rows={2} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="e.g. Please enter your dates for the proposal defense." /></Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button icon={Send} loading={busy} disabled={!windowStart || !windowEnd} onClick={send}>
            {busy ? "Sending..." : "Ask for availability"}
          </Button>
          {done && <span className="meta font-semibold text-brand-700" role="status">{done}</span>}
        </div>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
      </div>
      {requests.length > 0 && (
        <div>
          <p className="eyebrow mb-1.5">Who answered</p>
          <DataTable
            caption="Availability requests and who answered them"
            columns={ANSWER_COLUMNS}
            rows={requests}
            pageSize={0}
            dense
          />
        </div>
      )}
    </Card>
  );
}

const ANSWER_COLUMNS = [
  { key: "faculty_name", header: "Faculty", cell: (item) => <span className="font-semibold text-ink">{item.faculty_name}</span> },
  { key: "window", header: "Window", cell: (item) => `${longDate(item.window_start)} – ${longDate(item.window_end)}` },
  { key: "status", header: "Status", cell: (item) => <StatusChip status={item.status} dot={false} size="sm" /> },
  { key: "answered_at", header: "Answered", cell: (item) => (item.answered_at ? longDate(item.answered_at.slice(0, 10)) : "—") },
];
