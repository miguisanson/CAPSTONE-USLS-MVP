import { useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, UserCheck, UserRoundCog, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, ErrorNote, InlineNotice, SectionTitle, Spinner, StatusBadge } from "../../components/ui";
import { Field, Textarea } from "../../components/forms";
import { formatDay, useFaculty } from "./FacultyContext";

const MIN_REASON = 3;
const DANGER_BTN =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60";

// Segmented "n of max" meter. Turns amber when the limit is reached.
function AdviseeMeter({ meter }) {
  const max = meter?.max || 5;
  const active = meter?.active || 0;
  const pending = meter?.pending || 0;
  const full = active >= max;
  return (
    <Card className="p-6">
      <SectionTitle title="Advisees" subtitle="You can advise at most " icon={Users} />
      <div className="-mt-3 space-y-2">
        <p className={`text-sm font-semibold ${full ? "text-amber-800" : "text-ink"}`}>
          {active} of {max} advisees{pending > 0 ? ` · ${pending} pending` : ""}
        </p>
        <div className="flex gap-1.5" role="img" aria-label={`${active} of ${max} advisee places used${pending ? `, ${pending} pending` : ""}`}>
          {Array.from({ length: max }, (_, index) => {
            const tone = index < active ? (full ? "bg-amber-500" : "bg-brand-500") : index < active + pending ? "bg-blue-300" : "bg-slate-100";
            return <span key={index} className={`h-2.5 flex-1 rounded-full ${tone}`} />;
          })}
        </div>
        {full ? (
          <p className="text-xs font-semibold text-amber-800">You are at the limit. The Dean can appoint a sixth adviser only as a recorded exception.</p>
        ) : (
          <p className="text-xs text-slate-500">{max - active} place{max - active === 1 ? "" : "s"} left.</p>
        )}
      </div>
    </Card>
  );
}

function ReasonBox({ label, confirmLabel, busy, onCancel, onSubmit }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = (event) => {
    event.preventDefault();
    if (reason.trim().length < MIN_REASON) {
      setError("Please give a short reason (at least 3 characters).");
      return;
    }
    setError("");
    onSubmit(reason.trim());
  };
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-red-100 bg-red-50/40 p-3">
      <Field label={label} required>
        <Textarea value={reason} rows={2} maxLength={500} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <ErrorNote message={error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={DANGER_BTN} disabled={busy}>{busy ? "Sending..." : confirmLabel}</button>
        <button type="button" className="btn-ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
    </form>
  );
}

// One request card with a positive button and a negative button that asks for a reason.
function RequestCard({ children, yesLabel, noLabel, reasonLabel, noConfirmLabel, onYes, onNo }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      setAsking(false);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="space-y-3 rounded-2xl border border-slate-100 p-4">
      {children}
      {asking ? (
        <ReasonBox label={reasonLabel} confirmLabel={noConfirmLabel} busy={busy} onCancel={() => { setAsking(false); setError(""); }} onSubmit={(reason) => run(() => onNo(reason))} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" disabled={busy} onClick={() => run(onYes)}>{busy ? "Saving..." : yesLabel}</button>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => { setAsking(true); setError(""); }}>{noLabel}</button>
        </div>
      )}
      <ErrorNote message={error} />
    </li>
  );
}

function StudentLine({ item }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{item.student_name}</p>
        <p className="text-xs text-slate-500">{[item.program_code, item.student_number].filter(Boolean).join(" · ") || "Program not set"}</p>
      </div>
      <StatusBadge value={item.kind === "Change" ? "Change of adviser" : "New appointment"} dot={false} />
    </div>
  );
}

function Detail({ label, children }) {
  if (!children) return null;
  return <p className="text-sm text-slate-600"><span className="font-semibold text-ink">{label}:</span> {children}</p>;
}

function contractBadge(contract) {
  const status = contract?.status || "Not applicable";
  return status;
}

export function FacultyAdviserPanel() {
  const { refetch: refetchPortal } = useFaculty();
  const { data, loading, error, refetch } = useApi(() => api.facultyAdviserRequests(), []);

  const done = async () => {
    refetch();
    await refetchPortal();
  };

  if (loading && !data) return <Card className="p-6"><Spinner label="Loading adviser requests..." /></Card>;
  if (!data) return <ErrorNote message={error || "Could not load your adviser requests."} />;

  const inbox = data.inbox || [];
  const consents = data.consents || [];
  const advisees = data.advisees || [];

  return (
    <div className="space-y-5">
      <ErrorNote message={error} />
      <AdviseeMeter meter={data.meter} />

      {inbox.length > 0 && (
        <Card className="p-6">
          <SectionTitle title="Research adviser requests" subtitle="A student asks you to be their research adviser. Please accept or decline." icon={UserCheck} />
          <ul className="space-y-3">
            {inbox.map((item) => (
              <RequestCard
                key={item.id}
                yesLabel="Accept"
                noLabel="Decline"
                reasonLabel="Why are you declining?"
                noConfirmLabel="Confirm decline"
                onYes={async () => { await api.respondAdviserRequest(item.id, { response: "accept" }); await done(); }}
                onNo={async (reason) => { await api.respondAdviserRequest(item.id, { response: "decline", reason }); await done(); }}
              >
                <StudentLine item={item} />
                {item.kind === "Change" && <Detail label="Current adviser">{item.current_adviser_name}</Detail>}
                {item.kind === "Change" && <Detail label="Student's reason">{item.reason}</Detail>}
                <Detail label="Dean's note">{item.decision_note}</Detail>
                <Detail label="Form 3.1 issued">{item.form31_issued_on ? formatDay(item.form31_issued_on) : ""}</Detail>
                {item.warnings?.length > 0 && (
                  <InlineNotice tone="warn">{item.warnings.join(" ")}</InlineNotice>
                )}
              </RequestCard>
            ))}
          </ul>
        </Card>
      )}

      {consents.length > 0 && (
        <Card className="p-6">
          <SectionTitle title="Change of adviser: your agreement needed" subtitle="One of your advisees asks to move to a new adviser." icon={UserRoundCog} />
          <ul className="space-y-3">
            {consents.map((item) => (
              <RequestCard
                key={item.id}
                yesLabel="Agree to release"
                noLabel="Do not agree"
                reasonLabel="Why do you not agree?"
                noConfirmLabel="Confirm: do not agree"
                onYes={async () => { await api.consentAdviserChange(item.id, { consent: "yes" }); await done(); }}
                onNo={async (reason) => { await api.consentAdviserChange(item.id, { consent: "no", reason }); await done(); }}
              >
                <StudentLine item={item} />
                <Detail label="New adviser">{item.faculty_name}</Detail>
                <Detail label="Student's reason">{item.reason}</Detail>
              </RequestCard>
            ))}
          </ul>
        </Card>
      )}

      {inbox.length === 0 && consents.length === 0 && (
        <InlineNotice>No adviser requests are waiting for you.</InlineNotice>
      )}

      <Card className="p-6">
        <SectionTitle
          title="Your advisees"
          subtitle="Forms 3.2 and 3.3 (adviser contract) are due 5 days after Form 3.1."
          icon={Handshake}
          action={<Link to="/faculty-portal/signatures" className="text-xs font-semibold text-brand-700 hover:underline">Signatures</Link>}
        />
        {advisees.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-bold uppercase tracking-wide text-slate-400">
                  <th className="px-3 py-2">Student</th>
                  <th className="px-3 py-2">Program</th>
                  <th className="px-3 py-2">Stage</th>
                  <th className="px-3 py-2">Appointed</th>
                  <th className="px-3 py-2">Contract (Forms 3.2 / 3.3)</th>
                </tr>
              </thead>
              <tbody>
                {advisees.map((row) => {
                  const overdue = row.contract?.status === "Overdue";
                  return (
                    <tr key={row.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-3"><p className="font-semibold text-ink">{row.student_name}</p><p className="text-xs text-slate-400">{row.student_number}</p></td>
                      <td className="px-3 py-3 text-slate-600">{row.program_code}</td>
                      <td className="px-3 py-3 text-slate-600">{row.stage || "Not set"}</td>
                      <td className="px-3 py-3 text-slate-600">{row.appointed_on ? formatDay(row.appointed_on) : "Not set"}</td>
                      <td className="px-3 py-3">
                        <StatusBadge value={contractBadge(row.contract)} dot={false} className={overdue ? "!bg-red-50 !text-red-700 !ring-red-200" : ""} />
                        {row.contract?.due_on && row.contract.status !== "Received" && row.contract.status !== "Not applicable" && (
                          <span className={`mt-1 block text-xs ${overdue ? "font-semibold text-red-700" : "text-slate-500"}`}>
                            {overdue ? "Overdue since" : "Due"} {formatDay(row.contract.due_on)}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No appointed advisees yet. Students appear here once you accept their request.</p>
        )}
      </Card>
    </div>
  );
}
