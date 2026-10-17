// Gallery block for packet P1f: DecisionPanel and HistoryPanel (and the rebuilt HistoryDisclosure). Rendered by
// UiGallery.jsx; asserted by e2e/ui-gallery-p1f.spec.js through the data-gallery / data-case attributes.
// Every handler here only writes a line into its own log element (data-calls / data-last): the gallery changes no data.
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, RotateCcw, UserRoundCheck } from "lucide-react";
import { DecisionPanel, HistoryPanel } from "../components/ui/index.js";
import HistoryDisclosure from "../components/HistoryDisclosure.jsx";

function Group({ title, children }) {
  return (
    <div className="space-y-3">
      <h3 className="card-title">{title}</h3>
      {children}
    </div>
  );
}

/** A counter that a panel's onDecide writes to. `data-case` is the log element the spec reads. */
function useLog() {
  const [log, setLog] = useState({ calls: 0, last: "", cancelled: 0 });
  return {
    log,
    record: (key, comment) => setLog((l) => ({ ...l, calls: l.calls + 1, last: `${key}|${comment ?? ""}` })),
    cancel: () => setLog((l) => ({ ...l, cancelled: l.cancelled + 1 })),
  };
}

function Log({ name, state }) {
  return (
    <p className="meta mt-2" data-case={name} data-calls={state.calls} data-last={state.last} data-cancelled={state.cancelled}>
      decisions: {state.calls} · last: {state.last || "none"}
    </p>
  );
}

const MAIN_ACTIONS = [
  { key: "approve", label: "Approve", tone: "approve", icon: CheckCircle2 },
  { key: "return", label: "Return for revision", tone: "return", icon: RotateCcw },
  { key: "reject", label: "Deny request", tone: "reject", confirm: { message: "The student is told and cannot send this request again." } },
];

function MainPanel() {
  const { log, record } = useLog();
  return (
    <div>
      <DecisionPanel
        data-case="decision-main"
        title="Dean decision"
        subject="Maria Santos · Leave of Absence · 2026-0412"
        actions={MAIN_ACTIONS}
        onDecide={record}
      />
      <Log name="decision-main-log" state={log} />
    </div>
  );
}

function PlainPanel() {
  const { log, record, cancel } = useLog();
  return (
    <div>
      <div className="rounded-xl border border-slate-200 p-4">
        <DecisionPanel
          data-case="decision-plain"
          variant="plain"
          withComment={false}
          subject="Form 1 · Academic Coordinator endorsement"
          actions={[
            { key: "endorse", label: "Endorse and sign Form 1", tone: "approve" },
            { key: "reject", label: "Deny request", tone: "reject", disabled: true, hint: "Sign the form first." },
          ]}
          onDecide={record}
          onCancel={cancel}
        />
      </div>
      <Log name="decision-plain-log" state={log} />
    </div>
  );
}

function ValidatePanel() {
  const { log, record } = useLog();
  const [exception, setException] = useState(false);
  return (
    <div>
      <DecisionPanel
        data-case="decision-validate"
        title="Adviser appointment"
        subject="Prof. Reyes already has 5 of 5 advisees"
        commentLabel="Reason for returning"
        commentHint="Needed to return the application; optional to appoint."
        commentRequiredMessage="Give the reason this application is not approved. The student will see it."
        minCommentLength={3}
        actions={[
          { key: "appoint", label: "Appoint adviser", tone: "approve", icon: UserRoundCheck, requireComment: false, confirm: false },
          { key: "return", label: "Return application", tone: "return", confirm: false },
        ]}
        validate={(key) => (key === "appoint" && !exception ? "Tick the Dean's exception to appoint another advisee." : "")}
        onDecide={record}
      >
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          <input type="checkbox" className="mt-0.5 h-4 w-4 cursor-pointer" checked={exception} onChange={(event) => setException(event.target.checked)} />
          <span>Dean&apos;s exception: appoint a sixth advisee.</span>
        </label>
      </DecisionPanel>
      <Log name="decision-validate-log" state={log} />
    </div>
  );
}

function ThrowsPanel() {
  return (
    <DecisionPanel
      data-case="decision-throws"
      title="A handler that fails"
      actions={[{ key: "approve", label: "Approve", tone: "approve" }]}
      onDecide={async () => {
        throw new Error("The server refused that step.");
      }}
    />
  );
}

const ENTRIES = [
  { id: 2, title: "Sent to the Dean", at: "2026-08-05T06:30:00Z", actor: "Ana Cruz", actorRole: "GS Staff", from: "Submitted", to: "Dean Review", note: "Checklist complete.\nForwarded for decision." },
  { id: 1, title: "Filed by the student", at: "2026-08-03T01:15:00Z", actor: "Maria Santos", actorRole: "Student", to: "Submitted" },
  {
    id: 3,
    title: "Returned for revision",
    at: "2026-08-07T09:45:00Z",
    actor: "Dean Reyes",
    actorRole: "Dean",
    from: "Dean Review",
    to: "Returned",
    note: "The title page does not match the approved proposal title. Correct it and resubmit with the signed routing slip and the updated coursework record, including the units already credited.",
  },
];

const MANY = Array.from({ length: 8 }, (_, k) => ({
  id: k + 1,
  title: `Step ${k + 1}`,
  at: `2026-07-${String(10 + k).padStart(2, "0")}T08:00:00Z`,
  actor: "Registrar Office",
}));

export default function UiGalleryP1f() {
  const [params] = useSearchParams();
  // A danger notice is role="alert", which the shared sweep counts as an error banner on any page, so the one
  // deliberate sample mounts only on /__ui?decision-error=1 (the spec opens that URL).
  const showError = params.get("decision-error") === "1";
  return (
    <section data-gallery="p1f" className="card space-y-6 p-4 sm:p-5">
      <h2 className="section-title">Decision panel and history panel (P1f)</h2>

      <Group title="DecisionPanel: approve, return, reject (card). Return and reject need a comment; reject asks first.">
        <MainPanel />
      </Group>

      <Group title="DecisionPanel: plain variant, no comment box, a disabled action with its reason, Cancel">
        <PlainPanel />
      </Group>

      <Group title="DecisionPanel: extra control, validate(), minimum comment length">
        <ValidatePanel />
      </Group>

      <Group title="DecisionPanel: busy, long labels, failing handler, caller error">
        <DecisionPanel
          data-case="decision-busy"
          variant="plain"
          title="Saving the decision"
          busy
          actions={[
            { key: "approve", label: "Approve", tone: "approve" },
            { key: "return", label: "Return for revision", tone: "return" },
          ]}
          onDecide={() => {}}
        />
        <DecisionPanel
          data-case="decision-long"
          title="Approval of the dissertation proposal defense schedule, panel composition and venue for the second semester"
          subject="Maria Elena Santos-Villanueva · Doctor of Philosophy in Educational Leadership and Management"
          actions={[
            { key: "approve", label: "Approve the schedule and send the notice to the whole panel", tone: "approve" },
            { key: "return", label: "Return the schedule to the research coordinator for revision", tone: "return" },
          ]}
          onDecide={() => {}}
        />
        <ThrowsPanel />
        {showError && (
          <DecisionPanel
            data-case="decision-error"
            variant="plain"
            title="Caller error"
            error="P1f danger sample: could not save the decision. Check your connection and try again."
            actions={[{ key: "approve", label: "Approve", tone: "approve" }]}
            onDecide={() => {}}
          />
        )}
      </Group>

      <Group title="HistoryPanel: newest first (sent oldest-first, out of order), open, with count and status chips">
        <HistoryPanel data-case="history-main" entries={ENTRIES} defaultOpen />
      </Group>

      <Group title="HistoryPanel: closed, empty, limited with a title">
        <HistoryPanel data-case="history-collapsed" entries={ENTRIES.slice(0, 2)} />
        <HistoryPanel data-case="history-empty" entries={[]} defaultOpen label="View activity" hideLabel="Hide activity" />
        <HistoryPanel data-case="history-limit" entries={MANY} title="Stage history" defaultOpen limit={3} />
      </Group>

      <Group title="HistoryDisclosure (rebuilt on HistoryPanel): same props, free children">
        <div data-case="history-legacy">
          <HistoryDisclosure count={4}>
            <p className="text-sm text-slate-600">Free-form children go here.</p>
          </HistoryDisclosure>
        </div>
      </Group>
    </section>
  );
}
