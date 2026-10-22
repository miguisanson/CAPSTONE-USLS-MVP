import { useState } from "react";
import { Link } from "react-router-dom";
import { Handshake, UserCheck, UserRoundCog, Users } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Card, DataTable, Field, InlineNotice, SectionTitle, Spinner, StatusChip, Textarea } from "../../components/ui/index.js";
import { formatDay, useFaculty } from "./FacultyContext";

const MIN_REASON = 3;

// An error line from a message string; nothing when there is no message.
function ErrorLine({ message }) {
  return message ? <InlineNotice tone="danger">{message}</InlineNotice> : null;
}

// Segmented "n of max" meter. Turns amber when the limit is reached.
function AdviseeMeter({ meter }) {
  const max = meter?.max || 5;
  const active = meter?.active || 0;
  const pending = meter?.pending || 0;
  const full = active >= max;
  return (
    <Card>
      <SectionTitle title="Advisees" subtitle={`You can advise at most ${max} students.`} icon={Users} />
      <div className="space-y-2">
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
          <p className="meta font-semibold text-amber-800">You are at the limit. The Dean can appoint a sixth adviser only as a recorded exception.</p>
        ) : (
          <p className="meta">{max - active} place{max - active === 1 ? "" : "s"} left.</p>
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
      <ErrorLine message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="danger" disabled={busy}>{busy ? "Sending..." : confirmLabel}</Button>
        <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>
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
    <li className="space-y-3 rounded-xl border border-slate-200 p-4">
      {children}
      {asking ? (
        <ReasonBox label={reasonLabel} confirmLabel={noConfirmLabel} busy={busy} onCancel={() => { setAsking(false); setError(""); }} onSubmit={(reason) => run(() => onNo(reason))} />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button disabled={busy} onClick={() => run(onYes)}>{busy ? "Saving..." : yesLabel}</Button>
          <Button variant="secondary" disabled={busy} onClick={() => { setAsking(true); setError(""); }}>{noLabel}</Button>
        </div>
      )}
      <ErrorLine message={error} />
    </li>
  );
}

function StudentLine({ item }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink">{item.student_name}</p>
        <p className="meta">{[item.program_code, item.student_number].filter(Boolean).join(" · ") || "Program not set"}</p>
      </div>
      <StatusChip status={item.kind === "Change" ? "Change of adviser" : "New appointment"} dot={false} />
    </div>
  );
}

function Detail({ label, children }) {
  if (!children) return null;
  return <p className="text-sm text-slate-600"><span className="font-semibold text-ink">{label}:</span> {children}</p>;
}

const contractStatus = (contract) => contract?.status || "Not applicable";

// I-079: ONE row per student. The portal context knows the documents and signatures, the adviser-requests API knows
// the appointment and its contract; they are joined on the student id. An appointment the portal context does not
// list yet still gets a row (no documents).
export function adviseeRows(appointments = [], portalAdvisees = []) {
  const byStudent = new Map(appointments.filter((a) => a.student_id != null).map((a) => [a.student_id, a]));
  const used = new Set();
  const rows = portalAdvisees.map((entry) => {
    const appointment = byStudent.get(entry.student.id);
    if (appointment) used.add(appointment);
    return {
      key: `student-${entry.student.id}`,
      name: entry.student.name,
      number: entry.student.student_number,
      program: entry.student.program_code,
      stage: entry.student.current_stage,
      contract: appointment?.contract,
      documents: (entry.documents || []).length,
      pending: entry.pending_count || 0,
    };
  });
  appointments.forEach((appointment) => {
    if (used.has(appointment)) return;
    rows.push({
      key: `appointment-${appointment.id}`,
      name: appointment.student_name,
      number: appointment.student_number,
      program: appointment.program_code,
      stage: appointment.stage,
      contract: appointment.contract,
      documents: 0,
      pending: 0,
    });
  });
  // who needs the adviser first: most signatures waiting, then by name
  return rows.sort((left, right) => right.pending - left.pending || String(left.name).localeCompare(String(right.name)));
}

const ADVISEE_COLUMNS = [
  {
    key: "student",
    header: "Student",
    cell: (row) => (
      <>
        <p className="font-semibold text-ink">{row.name}</p>
        <p className="meta">{row.number}</p>
      </>
    ),
    sortable: true,
    sortValue: (row) => row.name,
  },
  { key: "program", header: "Program", cell: (row) => row.program, sortable: true, sortValue: (row) => row.program },
  { key: "stage", header: "Stage", cell: (row) => row.stage || "Not set", sortable: true, sortValue: (row) => row.stage },
  {
    key: "contract",
    header: "Adviser contract",
    cell: (row) => {
      const status = contractStatus(row.contract);
      if (status === "Not applicable") return <span className="meta">Not applicable</span>;
      const overdue = status === "Overdue";
      const showDue = row.contract?.due_on && status !== "Received";
      return (
        <>
          <StatusChip status={status} dot={false} />
          {showDue && (
            <span className={`meta mt-1 block ${overdue ? "font-semibold text-red-700" : ""}`}>
              {overdue ? "Overdue since" : "Due"} {formatDay(row.contract.due_on)}
            </span>
          )}
        </>
      );
    },
    sortable: true,
    sortValue: (row) => contractStatus(row.contract),
  },
  { key: "documents", header: "Documents", cell: (row) => row.documents, align: "right", sortable: true, sortValue: (row) => row.documents },
  {
    key: "pending",
    header: "Needs signature",
    cell: (row) =>
      row.pending ? (
        <>
          <StatusChip status="Pending" label={`${row.pending} pending`} dot={false} />
          <Link to="/faculty-portal/signatures" aria-label={`Review and sign for ${row.name}`} className="meta mt-1 block font-semibold text-brand-700 hover:underline">
            Review and sign
          </Link>
        </>
      ) : (
        <span className="meta">None</span>
      ),
    sortable: true,
    sortValue: (row) => row.pending,
  },
];

function AdviseeTable({ rows }) {
  return (
    <Card>
      <SectionTitle title="Your advisees" subtitle="Forms 3.2 and 3.3 (adviser contract) are due 5 days after Form 3.1." icon={Handshake} />
      <DataTable
        caption="Your advisees, the state of their adviser contract and the research documents that need your signature"
        columns={ADVISEE_COLUMNS}
        rows={rows}
        rowKey="key"
        pageSize={0}
        minWidth="md"
        empty={{ icon: Users, title: "No appointed advisees yet", hint: "Students appear here once you accept their request." }}
      />
    </Card>
  );
}

export function FacultyAdviserPanel({ portalAdvisees = [] }) {
  const { refetch: refetchPortal } = useFaculty();
  const { data, loading, error, refetch } = useApi(() => api.facultyAdviserRequests(), []);

  const done = async () => {
    refetch();
    await refetchPortal();
  };

  if (loading && !data) return <Card><Spinner label="Loading adviser requests..." /></Card>;
  if (!data) {
    return (
      <div className="space-y-5">
        <ErrorLine message={error || "Could not load your adviser requests."} />
        <AdviseeTable rows={adviseeRows([], portalAdvisees)} />
      </div>
    );
  }

  const inbox = data.inbox || [];
  const consents = data.consents || [];

  return (
    <div className="space-y-5">
      <ErrorLine message={error} />
      <AdviseeMeter meter={data.meter} />

      {inbox.length > 0 && (
        <Card>
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
                  <InlineNotice tone="warning">{item.warnings.join(" ")}</InlineNotice>
                )}
              </RequestCard>
            ))}
          </ul>
        </Card>
      )}

      {consents.length > 0 && (
        <Card>
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

      <AdviseeTable rows={adviseeRows(data.advisees || [], portalAdvisees)} />
    </div>
  );
}
