import { useMemo, useState } from "react";
import { Check, CheckCircle2, Circle, FileCheck, UserCheck, UserPlus } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Card, ErrorNote, InlineNotice, PageHeader, SectionTitle, Spinner, StatusBadge } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import { useConfirm } from "../../components/confirm";
import { daysPhrase, fmtDay } from "./shared";

// Small local hook: run one API action, show its error, refetch the page after success.
function useAction(refetch) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
      await refetch();
      return true;
    } catch (err) {
      setError(err.message || "Something went wrong.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}

function StepTracker({ steps = [] }) {
  return (
    <ol className="space-y-0" aria-label="Where your application stands">
      {steps.map((step, index) => {
        const state = step.done ? "done" : step.current ? "current" : "pending";
        return (
          <li key={step.key || index} className="relative flex gap-3 pb-4 last:pb-0" aria-current={state === "current" ? "step" : undefined}>
            {index < steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-0.5 bg-slate-200" aria-hidden="true" />}
            <span
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                state === "done" ? "bg-brand-600 text-white" : state === "current" ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400" : "bg-slate-100 text-slate-400"
              }`}
            >
              {state === "done" ? <Check className="h-4 w-4" strokeWidth={3} /> : <Circle className="h-3 w-3" />}
            </span>
            <div className={`min-w-0 rounded-lg px-2 py-0.5 ${state === "current" ? "bg-amber-50" : ""}`}>
              <p className={`text-sm font-semibold ${state === "pending" ? "text-slate-400" : "text-ink"}`}>
                {step.label}
                <span className="ml-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                  {state === "done" ? "Done" : state === "current" ? "Now" : "Later"}
                </span>
              </p>
              {step.at && <p className="text-xs text-slate-500">{fmtDay(step.at)}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function ContractBlock({ appointment, onChanged }) {
  const contract = appointment.contract || {};
  const { busy, error, run } = useAction(onChanged);
  const [note, setNote] = useState("");
  if (!contract.status || contract.status === "Not applicable") {
    return appointment.status === "Appointed" ? (
      <p className="text-sm text-slate-600">Your adviser has been appointed. Forms 3.2 and 3.3 open once your adviser accepts Form 3.1.</p>
    ) : null;
  }
  const canSend = ["Pending", "Overdue"].includes(contract.status);
  const days = contract.days_left;
  const dueText = contract.due_on
    ? `Due ${fmtDay(contract.due_on)}${typeof days === "number" ? ` (${days < 0 ? `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}` : days === 0 ? "due today" : `due in ${days} day${days === 1 ? "" : "s"}`})` : ""}`
    : "Due date not set";
  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink"><FileCheck className="h-4 w-4 text-brand-700" aria-hidden="true" />Forms 3.2 and 3.3 (research timetable and advising contract)</p>
        <StatusBadge value={contract.status} dot={false} />
      </div>
      {contract.status === "Received" ? (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          The Research Coordinator received your forms{contract.received_at ? ` on ${fmtDay(contract.received_at)}` : ""}.
        </p>
      ) : (
        <>
          <p className={`mt-2 text-sm font-semibold ${contract.status === "Overdue" ? "text-red-700" : "text-slate-600"}`}>{dueText}</p>
          {contract.status === "Submitted" && (
            <p className="mt-2 text-sm text-slate-600">You told us you sent the forms{contract.submitted_at ? ` on ${fmtDay(contract.submitted_at)}` : ""}. The Research Coordinator will confirm that they arrived.</p>
          )}
          {canSend && (
            <div className="mt-3 space-y-3">
              <Field label="Note for the Research Coordinator (optional)">
                <Textarea rows={2} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <ErrorNote message={error} />
              <button type="button" className="btn-primary" disabled={busy} onClick={() => run(() => api.submitAdviserContract(appointment.id, note))}>
                {busy ? "Saving..." : "I emailed Forms 3.2 and 3.3 to the Research Coordinator"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ChangeForm({ tracker, onChanged }) {
  const { busy, error, run } = useAction(onChanged);
  const [facultyId, setFacultyId] = useState("");
  const [reason, setReason] = useState("");
  const currentFacultyId = tracker.current?.faculty_id;
  const options = (tracker.candidates || [])
    .filter((person) => person.id !== currentFacultyId)
    .map((person) => ({ value: String(person.id), label: `${person.name} (${person.advisees} of ${person.max_advisees} advisees)${person.available ? "" : " - full"}` }));
  const valid = facultyId && reason.trim().length >= 5;
  async function submit(event) {
    event.preventDefault();
    const ok = await run(() => api.requestAdviserChange({ faculty_id: Number(facultyId), reason: reason.trim() }));
    if (ok) {
      setFacultyId("");
      setReason("");
    }
  }
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-slate-200 p-4">
      <p className="text-sm font-semibold text-ink">Request change of adviser (Form 3.1.1)</p>
      <p className="text-xs text-slate-500">
        A change is allowed once, and only before your proposal defense. Form 3.1.1 needs both your current and your new adviser to agree, then the Dean decides.
      </p>
      <Field label="New adviser" required>
        <Select value={facultyId} onChange={(e) => setFacultyId(e.target.value)} options={options} placeholder="Choose a faculty member" required />
      </Field>
      <Field label="Reason for the change" required hint="Give a clear, justifiable reason (at least 5 characters).">
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={600} required />
      </Field>
      <ErrorNote message={error} />
      <button type="submit" className="btn-primary" disabled={busy || !valid}>{busy ? "Sending..." : "Send change request"}</button>
    </form>
  );
}

function CurrentCard({ tracker, onChanged }) {
  const current = tracker.current;
  return (
    <Card className="space-y-4 p-6">
      <SectionTitle title="Your research adviser" icon={UserCheck} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold text-ink">{current.faculty_name}</p>
          {current.faculty_college && <p className="text-sm text-slate-500">{current.faculty_college}</p>}
          <p className="mt-1 text-sm text-slate-600">{current.form31_issued_on || current.adviser_responded_at
              ? `Appointed: ${fmtDay(current.form31_issued_on || String(current.adviser_responded_at).slice(0, 10))}`
              : "Appointed before the online appointment process (no date on file)"}</p>
        </div>
        <StatusBadge value={current.status} dot={false} />
      </div>
      <ContractBlock appointment={current} onChanged={onChanged} />
      {tracker.can_request_change ? (
        <ChangeForm tracker={tracker} onChanged={onChanged} />
      ) : (
        tracker.change_blocked_reason && <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{tracker.change_blocked_reason}</p>
      )}
    </Card>
  );
}

function OpenCard({ open, onChanged }) {
  const confirm = useConfirm();
  const { busy, error, run } = useAction(onChanged);
  const isChange = open.kind === "Change";
  async function withdraw() {
    const ok = await confirm({
      title: "Withdraw this application?",
      message: "The application stops here. You can apply again afterwards.",
      confirmLabel: "Withdraw application",
      tone: "danger",
    });
    if (ok) run(() => api.withdrawAdviserApplication(open.id));
  }
  return (
    <Card className="space-y-4 p-6">
      <SectionTitle title={isChange ? "Change of adviser in progress" : "Adviser application in progress"} icon={UserPlus} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{isChange ? "New adviser you nominated" : "Adviser you nominated"}</p>
          <p className="font-display text-lg font-semibold text-ink">{open.faculty_name}</p>
        </div>
        <StatusBadge value={open.status} dot={false} />
      </div>
      <StepTracker steps={open.steps || []} />
      {open.ac_note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="font-semibold">Academic Coordinator note:</span> {open.ac_note}</p>}
      {open.decision_note && <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700"><span className="font-semibold">Dean decision note:</span> {open.decision_note}</p>}
      {isChange && open.current_adviser_consent && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Your current adviser{open.current_adviser_name ? ` (${open.current_adviser_name})` : ""}:</span>{" "}
          {open.current_adviser_consent === "Consented" ? "agrees to the change" : open.current_adviser_consent === "Declined" ? "does not agree" : "still has to agree"}
          {open.current_adviser_consent_reason ? ` - ${open.current_adviser_consent_reason}` : ""}
        </p>
      )}
      {open.adviser_response && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
          <span className="font-semibold">Nominated adviser:</span> {open.adviser_response}{open.adviser_response_reason ? ` - ${open.adviser_response_reason}` : ""}
        </p>
      )}
      {(open.warnings || []).map((line) => <InlineNotice key={line} tone="warn">{line}</InlineNotice>)}
      <ErrorNote message={error} />
      <button type="button" className="btn-ghost" disabled={busy} onClick={withdraw}>{busy ? "Withdrawing..." : "Withdraw application"}</button>
    </Card>
  );
}

function ApplyForm({ tracker, onChanged }) {
  const { busy, error, run } = useAction(onChanged);
  const [facultyId, setFacultyId] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (tracker.candidates || []).filter((person) => !q || `${person.name} ${person.college || ""} ${person.specialization || ""}`.toLowerCase().includes(q));
  }, [tracker.candidates, search]);
  const chosen = (tracker.candidates || []).find((person) => String(person.id) === facultyId);
  async function submit(event) {
    event.preventDefault();
    await run(() => api.applyForAdviser({ faculty_id: Number(facultyId), note: note.trim() }));
  }
  return (
    <Card className="p-6">
      <SectionTitle title="Nominate your research adviser (Form 3)" subtitle="Choose the faculty member you want. The Academic Coordinator notes your application, then the Dean decides." icon={UserPlus} />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Find a faculty member">
          <input className="field-input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, college or specialization" />
        </Field>
        <fieldset>
          <legend className="field-label">Faculty members <span className="text-red-500">*</span></legend>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2">
            {candidates.map((person) => {
              const active = String(person.id) === facultyId;
              return (
                <label key={person.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${active ? "border-brand-300 bg-brand-50" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                  <input type="radio" name="adviser" className="mt-1" value={person.id} checked={active} onChange={() => setFacultyId(String(person.id))} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{person.name}</span>
                    <span className="block text-xs text-slate-500">{[person.college, person.specialization].filter(Boolean).join(" - ") || "Details not entered"}</span>
                    <span className={`mt-0.5 block text-xs font-semibold ${person.available ? "text-slate-600" : "text-amber-800"}`}>
                      {person.advisees} of {person.max_advisees} advisees{person.available ? "" : " - Full - the Dean must approve an exception"}
                    </span>
                  </span>
                </label>
              );
            })}
            {!candidates.length && <p className="px-2 py-3 text-sm text-slate-500">No faculty member matches your search.</p>}
          </div>
        </fieldset>
        {chosen && !chosen.available && (
          <InlineNotice tone="warn">{chosen.name} already has {chosen.advisees} of {chosen.max_advisees} advisees. You may still apply, but the Dean must approve an exception.</InlineNotice>
        )}
        <Field label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <ErrorNote message={error} />
        <button type="submit" className="btn-primary" disabled={busy || !facultyId}>{busy ? "Sending..." : "Send Form 3 application"}</button>
      </form>
    </Card>
  );
}

function HistoryList({ rows }) {
  if (!rows.length) return null;
  return (
    <Card className="p-6">
      <SectionTitle title="Earlier applications" />
      <ul className="space-y-2">
        {rows.map((row) => {
          const why = row.adviser_response_reason || row.decision_note || row.end_reason;
          return (
            <li key={row.id} className="rounded-xl border border-slate-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">{row.faculty_name} <span className="font-normal text-slate-500">({row.kind === "Change" ? "change of adviser" : "application"}, {fmtDay(row.applied_at)})</span></p>
                <StatusBadge value={row.status} dot={false} />
              </div>
              {why && <p className="mt-1 text-xs text-slate-600">{why}</p>}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function StudentAdviserPage() {
  const { data, loading, error, refetch } = useApi(() => api.studentAdviser(), []);
  const tracker = data;
  const earlier = useMemo(() => {
    const live = new Set([tracker?.current?.id, tracker?.open?.id].filter(Boolean));
    return (tracker?.history || []).filter((row) => !live.has(row.id));
  }, [tracker]);
  return (
    <div className="space-y-5 animate-fade-up">
      <PageHeader
        title="My research adviser"
        icon={UserCheck}
        description="You nominate an adviser on Form 3. The Academic Coordinator notes it, the Dean decides, and the adviser accepts. Then you email Forms 3.2 and 3.3 to the Research Coordinator within a few days."
      />
      {loading && !tracker && <Card className="p-6"><Spinner /></Card>}
      <ErrorNote message={error} />
      {tracker && (
        <>
          {tracker.current && <CurrentCard tracker={tracker} onChanged={refetch} />}
          {tracker.open && <OpenCard open={tracker.open} onChanged={refetch} />}
          {!tracker.current && !tracker.open && tracker.can_apply && <ApplyForm tracker={tracker} onChanged={refetch} />}
          {!tracker.current && !tracker.open && !tracker.can_apply && (
            <InlineNotice>You cannot apply for an adviser right now. Ask the Research Coordinator if you think this is a mistake.</InlineNotice>
          )}
          <HistoryList rows={earlier} />
        </>
      )}
    </div>
  );
}
