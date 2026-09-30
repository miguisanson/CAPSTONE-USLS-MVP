import { useState } from "react";
import { CalendarClock, CalendarDays, MailCheck, UserX, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, EmptyState, ErrorNote, InlineNotice, PageHeader, SectionTitle, Spinner, StatusBadge } from "../../components/ui";
import { Field, Textarea } from "../../components/forms";
import { formatDateTime } from "../../lib/format";
import { formatDay, formatTimeRange, useFaculty } from "./FacultyContext";

const MIN_REASON = 3;

function ScheduleLine({ schedule }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
      <CalendarClock className="h-4 w-4 text-brand-600" aria-hidden="true" />
      <span className="font-semibold text-ink">{formatDay(schedule.preferred_date)}</span>
      <span className="text-slate-600">{formatTimeRange(schedule.start_time, schedule.end_time)} (Philippine time)</span>
      <span className="text-slate-600">{schedule.venue || "Venue not set"}</span>
      <StatusBadge value={schedule.display_status || schedule.status} dot={false} />
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
      <ErrorNote message={localError || error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60" disabled={busy}>{busy ? "Sending..." : confirmLabel}</button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
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
    <li className="space-y-3 rounded-2xl border border-slate-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{student.name || "Student"}</p>
          <p className="text-xs text-slate-500">
            {[student.program_code, student.student_number].filter(Boolean).join(" · ") || "Program not set"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge value={invitation.defense_type} dot={false} />
          <StatusBadge value={invitation.status} dot={false} />
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Your role on the panel: <span className="font-semibold text-ink">{invitation.panel_role || "Not set"}</span>
      </p>
      {(invitation.other_members || []).length > 0 && (
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
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
      {schedule ? <ScheduleLine schedule={schedule} /> : <p className="text-xs text-slate-500">No date has been booked yet.</p>}
      {invitation.status === "Declined" && invitation.reason && (
        <p className="text-xs text-slate-500">Your reason: {invitation.reason}</p>
      )}
      {invitation.responded_at && invitation.status !== "Invited" && (
        <p className="text-xs text-slate-400">Answered {formatDateTime(invitation.responded_at)}</p>
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
          <ErrorNote message={error} />
          <div className="flex flex-wrap items-center gap-2">
            {invitation.status !== "Accepted" && (
              <button type="button" className="btn-primary" onClick={accept} disabled={busy}>
                {busy ? "Saving..." : "Accept"}
              </button>
            )}
            {invitation.status !== "Declined" && (
              <button type="button" className="btn-ghost" onClick={() => { setMode("decline"); setError(""); }} disabled={busy}>
                Decline
              </button>
            )}
            {activeSchedule && invitation.status !== "Declined" && (
              <button type="button" className="btn-ghost ml-auto px-3 py-1.5 text-xs text-red-600" onClick={() => { setMode("cannot-attend"); setError(""); }} disabled={busy}>
                <UserX className="h-4 w-4" /> I cannot attend this defense
              </button>
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
    <Card className="p-6">
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
      title="Panel invitations"
      description="Research defense panels you have been asked to join. Accept or decline, and tell the Graduate School early if you cannot attend a booked defense."
      icon={CalendarDays}
    />
  );

  if (loading && !data) {
    return (
      <div className="space-y-5">
        {header}
        <Card className="p-6"><Spinner label="Loading your invitations..." /></Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-5">
        {header}
        <ErrorNote message={error || "Could not load your invitations."} />
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
      <ErrorNote message={error} />
      {waiting.length > 0 && <InlineNotice tone="warn">{waiting.length} invitation{waiting.length === 1 ? " is" : "s are"} waiting for your answer.</InlineNotice>}
      {invitations.length === 0 ? (
        <Card className="p-6">
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
