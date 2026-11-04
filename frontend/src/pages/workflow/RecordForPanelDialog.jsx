import { useState } from "react";
import { CalendarClock, CheckCircle2, Gavel } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, EditableText, Field, HistoryList, InlineNotice, Input, Modal, Select, StatusChip, Textarea } from "../../components/ui/index.js";
import { PanelStamp } from "../../components/process";
import { formatClock, formatDate } from "../../lib/format";

// Staff and the Research Coordinator act for the Panel Chair (I-361). One dialog, three jobs:
//   record   - the verdict of a defense that has happened (result, remarks, panel-selected title, Form 7 score)
//   correct  - a verdict entered wrongly, until the student or staff have built on it
//   confirm  - the revisions the student sent after the defense
// Every one needs a reason. The server stamps the verdict "Recorded by <you> for the panel"; the chair, the adviser and
// the student see the stamp, and every later change is in the history.
const TITLE_GATE = "Form 1 - Title Defense";

const JOBS = {
  record: { title: "Record the verdict for the panel", button: "Record for the panel", busy: "Recording…", reasonLabel: "Why are you recording this for the panel?", reasonHint: "For example: the panel chair is away and sent the result by email." },
  correct: { title: "Correct the verdict for the panel", button: "Correct for the panel", busy: "Saving…", reasonLabel: "Why is the verdict being corrected?", reasonHint: "The reason is saved in the history." },
  confirm: { title: "Confirm the revisions for the panel", button: "Confirm for the panel", busy: "Confirming…", reasonLabel: "Why are you confirming this for the panel?", reasonHint: "For example: the panel chair approved the revised paper by email." },
};

function historyEntries(verdict, edits) {
  const entries = [{ id: "recorded", title: verdict.recorded_for_panel_label || `Verdict recorded by ${verdict.chair_name}`, at: verdict.submitted_at, note: verdict.recorded_for_panel_reason || undefined }];
  if (verdict.corrected_at) entries.push({ id: "corrected", title: `Corrected from ${verdict.original_result} to ${verdict.result}`, at: verdict.corrected_at, actor: verdict.corrected_by, note: verdict.correction_reason });
  if (verdict.revisions_confirmed_at) entries.push({ id: "confirmed", title: "Revisions confirmed", at: verdict.revisions_confirmed_at, actor: verdict.revisions_confirmed_by });
  (edits || []).forEach((edit) => entries.push({
    id: `edit-${edit.id}`, title: `${edit.label} edited${edit.for_panel ? " for the panel" : ""}`, at: edit.created_at,
    actor: edit.actor_name, actorRole: edit.actor_role === "faculty" ? "Panel member" : undefined,
    note: `${edit.old_value || "(empty)"} → ${edit.new_value || "(empty)"}. Reason: ${edit.reason || "none given"}`,
  }));
  return entries;
}

export default function RecordForPanelDialog({ mode, row, onClose, onDone }) {
  const job = JOBS[mode];
  const defense = row.next_defense;
  const verdict = row.verdict;
  const options = (row.verdict_options || []).map((option) => ({ value: option.value, label: option.label }));
  const [result, setResult] = useState(mode === "correct" ? "" : options[0]?.value || "");
  const [remarks, setRemarks] = useState("");
  const [title, setTitle] = useState("");
  const [score, setScore] = useState("");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const history = useApi(() => (verdict ? api.editHistory("defense_verdict", verdict.id) : Promise.resolve({ items: [] })), [verdict?.id]);
  const chosen = (row.verdict_options || []).find((option) => option.value === result);
  const isTitle = defense?.defense_type === "Title Defense" || verdict?.gate === TITLE_GATE;
  const isFinal = defense?.defense_type === "Final Defense";
  const needsResult = mode !== "confirm";
  const canSave = !busy && reason.trim().length >= 5 && (!needsResult || result) && (mode !== "correct" || result !== verdict?.result);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = mode === "record"
        ? await api.recordVerdictForPanel(defense.id, { result, remarks, selected_title: title, evaluation_score: score, reason: reason.trim() })
        : mode === "correct"
          ? await api.correctVerdictForPanel(verdict.id, { result, remarks, selected_title: title, evaluation_score: score, reason: reason.trim() })
          : await api.confirmRevisionsForPanel(verdict.id, { note, reason: reason.trim() });
      onDone(response.message || "Saved.");
    } catch (err) {
      setError(err.message || "Could not save this.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title={job.title}
      subtitle={`${row.student.name} · ${row.student.program_code}`}
      icon={Gavel}
      size="md"
      onClose={onClose}
      dismissible={!busy}
      closeLabel="Close"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button icon={CheckCircle2} disabled={!canSave} onClick={save}>{busy ? job.busy : job.button}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {defense && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-brand-800">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            <span className="font-semibold">{defense.defense_type} · {formatDate(defense.date)} {formatClock(defense.start_time)}</span>
            {defense.panel_chair && <span className="text-slate-600">Panel chair: {defense.panel_chair}</span>}
          </p>
        )}
        <InlineNotice tone="info">
          This is saved as &quot;Recorded by you for the panel&quot;. The panel chair, the adviser and the student can see it, and the panel chair can still correct it.
        </InlineNotice>

        {verdict && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-emerald-900">
              Verdict: {verdict.label || verdict.result} {verdict.revision_status && <StatusChip status={verdict.revision_status} dot={false} size="sm" />}
            </p>
            <PanelStamp verdict={verdict} className="mt-1" />
            {verdict.remarks && <div className="mt-2 text-sm text-slate-700"><EditableText edit={verdict.edits?.remarks} value={verdict.remarks} onSaved={() => onDone("Saved. The change is in the history.")} /></div>}
            {verdict.selected_title && (
              <div className="mt-2 text-sm text-slate-700">
                <span className="text-xs font-semibold">Title selected by the panel:</span>
                <EditableText edit={verdict.edits?.selected_title} value={verdict.selected_title} onSaved={() => onDone("Saved. The change is in the history.")} />
              </div>
            )}
            {verdict.evaluation_score != null && <p className="mt-1 text-xs text-slate-600">Form 7 score: {verdict.evaluation_score}</p>}
          </div>
        )}

        {needsResult && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Verdict" required hint={chosen?.summary}>
              <Select placeholder={mode === "correct" ? "Choose the correct verdict" : null} options={options} value={result} onChange={(event) => setResult(event.target.value)} />
            </Field>
            <Field label="Remarks or conditions">
              <Textarea rows={3} value={remarks} onChange={(event) => setRemarks(event.target.value)} placeholder="Optional conditions, revisions, or notes" />
            </Field>
            {isTitle && result === "Passed" && (
              <div className="sm:col-span-2">
                <Field label="Title selected by the panel (from the three submitted)">
                  <Input value={title} maxLength={220} onChange={(event) => setTitle(event.target.value)} placeholder="Saved as the title of the study" />
                </Field>
              </div>
            )}
            {(isFinal || verdict?.gate === "Final Defense") && (
              <Field label="Evaluation score (Form 7)" hint="A pass needs the passing score for the paper type.">
                <Input type="number" min="0" max="100" step="0.01" value={score} onChange={(event) => setScore(event.target.value)} />
              </Field>
            )}
          </div>
        )}
        {mode === "confirm" && (
          <Field label="Note about the revisions (optional)">
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
        )}

        <Field label={job.reasonLabel} required hint={job.reasonHint}>
          <Textarea rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}

        {verdict && <HistoryList title="History of this verdict" entries={historyEntries(verdict, history.data?.items)} limit={5} />}
      </div>
    </Modal>
  );
}
