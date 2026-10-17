import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileCheck2, Send, UserRoundCheck } from "lucide-react";
import { api } from "../api";
import { useApi } from "../hooks";
import { Button, Card, DecisionPanel, EmptyState, Field, InlineNotice, Input, PageHeader, Spinner, Stepper, StatusChip, Textarea } from "../components/ui/index.js";
import { toneOf } from "../lib/tone";
import { useConfirm } from "../components/confirm";
import { formatDay } from "./faculty/FacultyContext";
import AdviserRecordCard from "./AdviserRecordCard";

const PROTOCOL =
  "Form 3 → Academic Coordinator notes → Research Coordinator sends to the Dean → Dean, Associate Dean or Research Coordinator approves (Form 3.1) → adviser accepts → student sends Forms 3.2 and 3.3 within 5 days.";

const RECORD_ROLES = ["staff", "research_coordinator", "admin"];
const IN_PROGRESS = ["Applied", "Noted by AC", "Under deliberation", "Appointed"];
const KIND_LABEL = { Initial: "New", Change: "Change of adviser", Recorded: "Recorded" };
// The chip's colour comes from this hint (the words "New", "Change of adviser", "Recorded" are not statuses).
const KIND_TONE = { Initial: "good", Change: "info", Recorded: "muted" };

const needsAction = (row) => (row.actions || []).length > 0;
const awaitingContract = (row) =>
  row.status === "Accepted" && row.contract && !["Received", "Not applicable"].includes(row.contract.status);

const TABS = [
  { key: "mine", label: "Needs my action", match: needsAction, empty: ["Nothing is waiting on you", "Applications that need your note, forwarding, decision or receipt show up here."] },
  { key: "progress", label: "In progress", match: (row) => IN_PROGRESS.includes(row.status) && !needsAction(row), empty: ["No applications in progress", "Applications waiting on someone else show up here."] },
  { key: "contract", label: "Accepted - contract", match: awaitingContract, empty: ["No contracts outstanding", "Accepted advisers whose Forms 3.2 and 3.3 are still to come show up here."] },
  { key: "all", label: "All", match: () => true, empty: ["No adviser appointments yet", "Applications from students and recorded appointments are listed here."] },
];

// Compact progress tracker: done steps get a tick, the current step is marked.
function StepsTracker({ steps }) {
  if (!steps?.length) return null;
  const list = steps.map((step) => ({ key: step.key, label: step.label, state: step.done ? "complete" : step.current ? "current" : "upcoming" }));
  return <Stepper steps={list} compact title="Progress" />;
}

function AdviseeMeter({ advisees, max }) {
  const used = advisees || 0;
  const limit = max || 5;
  const full = used >= limit;
  return (
    <div className="mt-1.5">
      <p className={`text-xs font-semibold ${full ? "text-red-700" : "text-slate-500"}`}>
        {used} of {limit} advisees{full ? " - at the limit" : ""}
      </p>
      <div className="mt-1 flex w-28 gap-1" role="img" aria-label={`${used} of ${limit} advisee places used`}>
        {Array.from({ length: Math.min(limit, 10) }, (_, index) => (
          <span key={index} className={`h-1.5 flex-1 rounded-full ${index < used ? (full ? "bg-red-500" : "bg-brand-500") : "bg-slate-200"}`} />
        ))}
      </div>
    </div>
  );
}

function NoteLine({ label, who, at, children }) {
  if (!children) return null;
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <p className="eyebrow">
        {label}
        {who ? ` - ${who}` : ""}
        {at ? ` · ${formatDay(at)}` : ""}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-slate-700">{children}</p>
    </div>
  );
}

function ContractLine({ contract, status }) {
  if (!contract || contract.status === "Not applicable") return null;
  if (!["Accepted", "Appointed"].includes(status)) return null;
  const overdue = contract.status === "Overdue";
  const left = contract.days_left;
  const leftText = contract.status === "Received" || typeof left !== "number" ? "" : left < 0 ? ` (${Math.abs(left)} day${left === -1 ? "" : "s"} late)` : ` (${left} day${left === 1 ? "" : "s"} left)`;
  const text = {
    Pending: "Forms 3.2 and 3.3: not sent yet",
    Submitted: "Forms 3.2 and 3.3: sent by the student, waiting for receipt",
    Received: `Forms 3.2 and 3.3: received${contract.received_at ? ` on ${formatDay(contract.received_at)}` : ""}`,
    Overdue: "Forms 3.2 and 3.3: overdue",
  }[contract.status] || `Forms 3.2 and 3.3: ${contract.status}`;
  return (
    <p className={`text-sm font-semibold ${overdue ? "text-red-700" : contract.status === "Received" ? "text-brand-700" : "text-slate-600"}`}>
      {text}
      {contract.status !== "Received" && contract.due_on ? ` - due ${formatDay(contract.due_on)}${leftText}` : ""}
    </p>
  );
}

// Which agreement a change-of-adviser request is still waiting for.
function missingAgreements(row) {
  if (row.kind !== "Change" || row.status !== "Applied") return [];
  const list = [];
  const current = row.current_adviser_name || "The current adviser";
  if (row.current_adviser_consent === "Declined") {
    list.push(`${current} did not consent to the change${row.current_adviser_consent_reason ? `: ${row.current_adviser_consent_reason}` : "."}`);
  } else if (row.current_adviser_consent !== "Consented") {
    list.push(`Waiting for ${current} (current adviser) to consent.`);
  }
  if (row.adviser_response === "Declined") {
    list.push(`${row.faculty_name} declined to be the new adviser${row.adviser_response_reason ? `: ${row.adviser_response_reason}` : "."}`);
  } else if (row.adviser_response !== "Accepted") {
    list.push(`Waiting for ${row.faculty_name} (new adviser) to accept.`);
  }
  return list;
}

function NoteForm({ busy, onCancel, onSubmit }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(note.trim());
      }}
      className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3"
    >
      <Field label="Note for the Research Coordinator (optional)">
        <Textarea value={note} rows={2} maxLength={500} onChange={(event) => setNote(event.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" icon={ClipboardCheck} disabled={busy}>Note this application</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

// One inline panel for the Dean: appoint (optional note, Associate Dean name, sixth-advisee exception) or return (reason).
// The DecisionPanel holds the comment, its rules and the confirmation; the Associate Dean field and the exception box are its children.
function DecisionForm({ row, mode, forceException, busy, onCancel, onSubmit }) {
  const [associate, setAssociate] = useState("");
  const [exception, setException] = useState(false);
  const appoint = mode === "appoint";
  const atLimit = (row.advisees || 0) >= (row.max_advisees || 5) || forceException;
  const needsException = appoint && atLimit;
  const who = `${row.student_name} and ${row.faculty_name}`;
  const tickRule = "Tick the Dean's exception to appoint another advisee.";
  const action = appoint
    ? {
        key: "appoint",
        label: "Appoint adviser",
        tone: "approve",
        icon: UserRoundCheck,
        requireComment: atLimit,
        disabled: atLimit && !exception,
        hint: atLimit && !exception ? tickRule : undefined,
        confirm: {
          title: "Appoint this adviser?",
          message: `${row.faculty_name} is appointed research adviser of ${row.student_name}. Form 3.1 is issued and the adviser is asked to accept.`,
          confirmLabel: "Appoint adviser",
        },
      }
    : {
        key: "return",
        label: "Return application",
        tone: "return",
        requireComment: true,
        confirm: {
          title: "Return this application?",
          message: `${who}: the application is not approved and the student sees your reason. They may nominate again.`,
          confirmLabel: "Return application",
          tone: "danger",
        },
      };
  return (
    <div className={`rounded-xl border p-3 ${appoint ? "border-brand-200 bg-brand-50/40" : "border-slate-200 bg-slate-50/60"}`}>
      <DecisionPanel
        variant="plain"
        busy={busy}
        actions={[action]}
        commentLabel={appoint ? (atLimit ? "Note for the exception" : "Dean's note (optional)") : "Reason for returning"}
        commentRows={2}
        maxLength={600}
        minCommentLength={3}
        commentRequiredMessage={appoint ? "A Dean's exception needs a short note." : "Give the reason this application is not approved. The student will see it."}
        validate={() => (needsException && !exception ? tickRule : "")}
        onCancel={onCancel}
        onDecide={(_key, note) => onSubmit({ note, associate_dean: associate.trim(), cap_exception: needsException && exception })}
      >
        {appoint && (
          <Field label="Associate Dean name (optional)" hint="Fill in only if an Associate Dean is approving on the Dean's behalf.">
            <Input value={associate} maxLength={160} onChange={(event) => setAssociate(event.target.value)} />
          </Field>
        )}
        {needsException && (
          <label className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${toneOf("warning").notice}`}>
            <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer accent-brand-600" checked={exception} onChange={(event) => setException(event.target.checked)} />
            <span>Dean's exception: appoint a sixth advisee. {row.faculty_name} already has {row.advisees} of {row.max_advisees}.</span>
          </label>
        )}
      </DecisionPanel>
    </div>
  );
}

function AppointmentCard({ row, onDone }) {
  const confirm = useConfirm();
  const [mode, setMode] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [forceException, setForceException] = useState(false);
  const actions = row.actions || [];
  const missing = useMemo(() => missingAgreements(row), [row]);
  const who = `${row.student_name} and ${row.faculty_name}`;

  // `inline`: the caller is a DecisionPanel, which shows the failure itself and keeps the typed comment.
  async function run(call, inline = false) {
    setBusy(true);
    setError("");
    try {
      await call();
      setMode(null);
      onDone();
    } catch (e) {
      if (/exception/i.test(e.message || "")) setForceException(true);
      if (inline) throw e;
      setError(e.message || "That did not work. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function forward() {
    const ok = await confirm({
      title: "Send to the Dean?",
      message: `${row.student_name}'s application to have ${row.faculty_name} as research adviser goes to the Dean for deliberation.`,
      confirmLabel: "Send to the Dean",
    });
    if (ok) run(() => api.forwardAdviserApplication(row.id));
  }

  // The DecisionPanel has already asked "Appoint this adviser?" / "Return this application?".
  function decide(decision, fields) {
    const appoint = decision === "appoint";
    const payload = { decision, note: fields.note };
    if (appoint && fields.associate_dean) payload.associate_dean = fields.associate_dean;
    if (appoint && fields.cap_exception) payload.cap_exception = true;
    return run(() => api.decideAdviserAppointment(row.id, payload), true);
  }

  const toggle = (key) => { setMode((current) => (current === key ? null : key)); setError(""); };

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="card-title">{row.student_name}</p>
          <p className="meta">
            {[row.student_number, row.program_code, row.research_type].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={KIND_LABEL[row.kind] || row.kind} tone={KIND_TONE[row.kind] || "muted"} dot={false} />
          <StatusChip status={row.status} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-100 p-3">
        <p className="eyebrow">{row.kind === "Change" ? "New adviser" : "Nominated adviser"}</p>
        <p className="text-sm font-semibold text-ink">{row.faculty_name}{row.faculty_college ? <span className="font-normal text-slate-500"> · {row.faculty_college}</span> : null}</p>
        <AdviseeMeter advisees={row.advisees} max={row.max_advisees} />
        {row.kind === "Change" && row.current_adviser_name && <p className="mt-1.5 text-xs text-slate-500">Replaces {row.current_adviser_name}.</p>}
      </div>

      <StepsTracker steps={row.steps} />

      <div className="grid gap-2 sm:grid-cols-2">
        <NoteLine label={row.kind === "Change" ? "Reason for the change" : "Student's note"} at={row.applied_at}>
          {row.kind === "Change" ? row.reason || row.student_note : row.student_note}
        </NoteLine>
        <NoteLine label="Academic Coordinator note" who={row.ac_noted_by} at={row.ac_noted_at}>{row.ac_note}</NoteLine>
        <NoteLine label="Dean's decision" who={row.decided_by} at={row.decided_at}>
          {row.decision_note || (row.decided_at && ["Appointed", "Accepted", "Declined", "Not approved"].includes(row.status) ? "No note." : "")}
        </NoteLine>
        {row.associate_dean_name && <NoteLine label="Approved for the Dean by">{row.associate_dean_name}</NoteLine>}
        {row.cap_exception && <NoteLine label="Dean's exception">Appointed beyond the {row.max_advisees}-advisee limit.</NoteLine>}
      </div>

      {(row.warnings || []).map((warning) => (
        <InlineNotice key={warning} tone="warning" icon={AlertTriangle}>{warning}</InlineNotice>
      ))}

      <ContractLine contract={row.contract} status={row.status} />
      {actions.length === 0 && missing.length > 0 && (
        <ul className="space-y-1 text-sm font-medium text-slate-600">
          {missing.map((line) => <li key={line} className="flex items-start gap-2"><span aria-hidden="true">•</span>{line}</li>)}
        </ul>
      )}
      {row.adviser_response === "Declined" && row.kind !== "Change" && (
        <p className="text-sm font-medium text-red-700">Adviser declined{row.adviser_response_reason ? `: ${row.adviser_response_reason}` : "."}</p>
      )}

      {actions.length > 0 && (
        <div className="space-y-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap gap-2">
            {actions.includes("note") && <Button icon={ClipboardCheck} disabled={busy} onClick={() => toggle("note")}>Note application</Button>}
            {actions.includes("forward") && <Button icon={Send} disabled={busy} onClick={forward}>Send to the Dean</Button>}
            {actions.includes("appoint") && <Button icon={UserRoundCheck} disabled={busy} onClick={() => toggle("appoint")}>Appoint adviser</Button>}
            {actions.includes("return") && <Button variant="secondary" disabled={busy} onClick={() => toggle("return")}>Return application</Button>}
            {actions.includes("contract-received") && (
              <Button icon={FileCheck2} disabled={busy} onClick={() => run(() => api.receiveAdviserContract(row.id))}>
                Forms 3.2 and 3.3 received
              </Button>
            )}
          </div>
          {mode === "note" && <NoteForm busy={busy} onCancel={() => setMode(null)} onSubmit={(note) => run(() => api.noteAdviserApplication(row.id, note))} />}
          {(mode === "appoint" || mode === "return") && (
            <DecisionForm key={mode} row={row} mode={mode} forceException={forceException} busy={busy} onCancel={() => setMode(null)} onSubmit={(fields) => decide(mode, fields)} />
          )}
        </div>
      )}
      {error && <InlineNotice tone="danger">{error}</InlineNotice>}
    </Card>
  );
}

// `embedded` drops the page header so the list can sit inside Research Gate (staff, coordinators)
// or the Dean's Approvals Queue; `onChanged` lets a host refresh its own counts after an action.
export default function AdviserAppointments({ role, embedded = false, onChanged }) {
  const [tab, setTab] = useState("mine");
  const open = useApi(() => api.adviserAppointments({ scope: "open" }), []);
  const all = useApi(() => (tab === "all" ? api.adviserAppointments({ scope: "all" }) : Promise.resolve(null)), [tab === "all"]);
  const canRecord = RECORD_ROLES.includes(role);
  const current = TABS.find((item) => item.key === tab);
  const source = tab === "all" ? all : open;
  const rows = useMemo(() => (source.data?.appointments || []).filter(current.match), [source.data, current]);
  const tabCount = (item) => (item.key === "all" ? null : (open.data?.appointments || []).filter(item.match).length);

  const refetch = () => {
    open.refetch();
    if (tab === "all") all.refetch();
    if (onChanged) onChanged();
  };

  return (
    <div className="page-stack animate-fade-up">
      {embedded ? (
        <p className="text-sm text-slate-600">{PROTOCOL}</p>
      ) : (
        <PageHeader title="Research adviser appointments" description={PROTOCOL} icon={UserRoundCheck} />
      )}

      {canRecord && <AdviserRecordCard onRecorded={refetch} />}

      <div role="tablist" aria-label="Appointment lists" className="flex flex-wrap gap-2">
        {TABS.map((item) => {
          const count = tabCount(item);
          const active = tab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(item.key)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 cursor-pointer max-sm:min-h-11 ${active ? "bg-brand-600 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {item.label}
              {count ? <span className={`ml-2 rounded-full px-1.5 py-0.5 text-2xs ${active ? "bg-white/25" : "bg-slate-100 text-slate-600"}`}>{count}</span> : null}
            </button>
          );
        })}
      </div>

      {source.error && <InlineNotice tone="danger">{source.error}</InlineNotice>}
      {source.loading && !source.data ? (
        <Card pad="lg"><Spinner label="Loading appointments..." /></Card>
      ) : rows.length === 0 ? (
        !source.error && <Card pad="lg"><EmptyState icon={CheckCircle2} title={current.empty[0]} hint={current.empty[1]} /></Card>
      ) : (
        <div role="tabpanel" className="space-y-4">
          {tab === "all" && <InlineNotice>{rows.length} appointment{rows.length === 1 ? "" : "s"}, newest first.</InlineNotice>}
          {rows.map((row) => <AppointmentCard key={row.id} row={row} onDone={refetch} />)}
        </div>
      )}
    </div>
  );
}
