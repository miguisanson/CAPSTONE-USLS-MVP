import { useState } from "react";
import { CalendarClock, CalendarDays, MailCheck, UserX, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, EmptyState, Field, InlineNotice, PageHeader, SectionTitle, Spinner, StatusChip, Textarea } from "../../components/ui/index.js";
import { formatDateTime } from "../../lib/format";
import { formatDay, formatTimeRange, useFaculty } from "./FacultyContext";

const MIN_REASON = 3;

// An error line from a message string; nothing when there is no message.
function ErrorLine({ message }) {
  return message ? <InlineNotice tone="danger">{message}</InlineNotice> : null;
}

function ScheduleLine({ schedule }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden="true" />
      <span className="font-semibold text-ink">{formatDay(schedule.preferred_date)}</span>
      <span className="text-slate-600">{formatTimeRange(schedule.start_time, schedule.end_time)} (Philippine time)</span>
      <span className="text-slate-600">{schedule.venue || "Venue not set"}</span>
      <StatusChip status={schedule.display_status || schedule.status} dot={false} />
    </div>
  );
}

// Inline "reason" box used for declining an invitation and for "cannot attend".
function ReasonForm({ label, confirmLabel, busy, error, onCancel, onSubmit }) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setLocalError("Please give a short reason (at least 3 characters).");
      return;
    }
    setLocalError("");
    onSubmit(reason.trim());
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-3">
      <Field label={label} required>
        <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} maxLength={500} />
      </Field>
      <ErrorLine message={localError || error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={busy}>{busy ? "Sending..." : confirmLabel}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
      </div>
    </form>
  );
}

function InvitationCard({ invitation, onChanged }) {
  const [mode, setMode] = useState(null); // null | "decline" | "cannot-attend"
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const schedule = invitation.schedule;
  const activeSchedule = schedule && schedule.is_active ? schedule : null;
  const student = invitation.student || {};

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setMode(null);
      await onChanged();
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const accept = () => run(() => api.respondPanelInvitation(invitation.id, { response: "accept" }));
  const decline = (reason) => run(() => api.respondPanelInvitation(invitation.id, { response: "decline", reason }));
  const cannotAttend = (reason) => run(() => api.cannotAttendDefense(activeSchedule.id, { reason }));

  return (
    <li className="space-y-3 rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{student.name || "Student"}</p>
          <p className="meta">
            {[student.program_code, student.student_number].filter(Boolean).join(" · ") || "Program not set"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={invitation.defense_type} dot={false} />
          <StatusChip status={invitation.status} dot={false} />
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Your role on the panel: <span className="font-semibold text-ink">{invitation.panel_role || "Not set"}</span>
      </p>
      {(invitation.other_members || []).length > 0 && (
        <div>
          <p className="eyebrow mb-1 flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" aria-hidden="true" /> Other panel members
          </p>
          <ul className="flex flex-wrap gap-2">
            {invitation.other_members.map((member, index) => (
              <li key={`${member.name}-${index}`} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                <span className="font-semibold">{member.name}</span> · {member.role}
              </li>
            ))}
          </ul>
        </div>
      )}
      {schedule ? <ScheduleLine schedule={schedule} /> : <p className="meta">No date has been booked yet.</p>}
      {invitation.status === "Declined" && invitation.reason && (
        <p className="meta">Your reason: {invitation.reason}</p>
      )}
      {invitation.responded_at && invitation.status !== "Invited" && (
        <p className="meta">Answered {formatDateTime(invitation.responded_at)}</p>
      )}

      {mode === "decline" ? (
        <ReasonForm
          label="Why are you declining?"
          confirmLabel="Confirm decline"
          busy={busy}
          error={error}
          onCancel={() => { setMode(null); setError(""); }}
          onSubmit={decline}
        />
      ) : mode === "cannot-attend" ? (
        <ReasonForm
          label="Why can you not attend this defense?"
          confirmLabel="Tell the Graduate School"
          busy={busy}
          error={error}
          onCancel={() => { setMode(null); setError(""); }}
          onSubmit={cannotAttend}
        />
      ) : (
        <>
          <ErrorLine message={error} />
          <div className="flex flex-wrap items-center gap-2">
            {invitation.status !== "Accepted" && (
              <Button onClick={accept} disabled={busy}>
                {busy ? "Saving..." : "Accept"}
              </Button>
            )}
            {invitation.status !== "Declined" && (
              <Button variant="secondary" onClick={() => { setMode("decline"); setError(""); }} disabled={busy}>
                Decline
              </Button>
            )}
            {activeSchedule && invitation.status !== "Declined" && (
              <Button variant="secondary" size="sm" icon={UserX} className="ml-auto text-red-600" onClick={() => { setMode("cannot-attend"); setError(""); }} disabled={busy}>
                I cannot attend this defense
              </Button>
            )}
          </div>
        </>
      )}
    </li>
  );
}

function Group({ title, hint, items, onChanged }) {
  if (!items.length) return null;
  return (
    <Card>
      <SectionTitle title={`${title} (${items.length})`} subtitle={hint} icon={MailCheck} />
      <ul className="space-y-3">
        {items.map((invitation) => (
          <InvitationCard key={invitation.id} invitation={invitation} onChanged={onChanged} />
        ))}
      </ul>
    </Card>
  );
}

export default function FacultyInvitationsPage() {
  const { refetch: refetchPortal } = useFaculty();
  const { data, loading, error, refetch } = useApi(() => api.facultyPanelInvitations(), []);

  const onChanged = async () => {
    refetch();
    await refetchPortal();
  };

  const header = (
    <PageHeader
      title="Panel Invitations"
      description="Research defense panels you have been asked to join. Accept or decline, and tell the Graduate School early if you cannot attend a booked defense."
      icon={CalendarDays}
    />
  );

  if (loading && !data) {
    return (
      <div className="space-y-5">
        {header}
        <Card><Spinner label="Loading your invitations..." /></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorLine message={error || "Could not load your invitations."} />
      </div>
    );
  }

  const invitations = data.invitations || [];
  const waiting = invitations.filter((item) => item.status === "Invited");
  const accepted = invitations.filter((item) => item.status === "Accepted");
  const declined = invitations.filter((item) => item.status === "Declined");

  return (
    <div className="space-y-5 animate-fade-up">
      {header}
      <ErrorLine message={error} />
      {waiting.length > 0 && <InlineNotice tone="warning">{waiting.length} invitation{waiting.length === 1 ? " is" : "s are"} waiting for your answer.</InlineNotice>}
      {invitations.length === 0 ? (
        <Card>
          <EmptyState icon={MailCheck} title="No panel invitations" hint="When the Research Coordinator puts you on a defense panel, the invitation shows up here." />
        </Card>
      ) : (
        <>
          <Group title="Waiting for your answer" items={waiting} onChanged={onChanged} />
          <Group title="Accepted" items={accepted} onChanged={onChanged} />
          <Group title="Declined" hint="The Research Coordinator has been asked to find a replacement." items={declined} onChanged={onChanged} />
        </>
      )}
    </div>
  );
}
