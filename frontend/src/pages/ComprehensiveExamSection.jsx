import { useState } from "react";
import { GraduationCap, CheckCircle2 } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../auth";
import { Button, Field, HistoryPanel, InlineNotice, Input, Modal, SectionCard, Select, StatusChip, Textarea } from "../components/ui/index.js";
import ProvenanceBadge from "../components/monitoring/ProvenanceBadge";
import { formatDate } from "../lib/format";

const RESULTS = ["Passed", "Failed"];
const today = () => new Date().toLocaleDateString("en-CA");

function RecordDialog({ student, onClose, onDone }) {
  const [result, setResult] = useState("");
  const [examDate, setExamDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = result && examDate && reason.trim();

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api.recordComprehensiveExam(student.id, { result, exam_date: examDate, reason: reason.trim() });
      onDone();
    } catch (err) {
      setError(err.message || "Could not save the result.");
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Record the comprehensive exam result"
      subtitle={`${student.name} · ${student.student_number}`}
      icon={GraduationCap}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button icon={CheckCircle2} disabled={!ready || busy} onClick={save}>{busy ? "Saving…" : "Save result"}</Button>
        </>
      }
    >
      <div className="space-y-4">
        <InlineNotice tone="info">
          This is saved as a manual entry with your name, the time and your reason. A Passed result opens the research steps for this student.
        </InlineNotice>
        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <Field label="Result" required>
          <Select value={result} onChange={(e) => setResult(e.target.value)} options={RESULTS} placeholder="Choose a result" />
        </Field>
        <Field label="Date of the exam" required hint="Not a future date.">
          <Input type="date" value={examDate} max={today()} onChange={(e) => setExamDate(e.target.value)} />
        </Field>
        <Field label="Where does the result come from?" required hint="For example: the result sheet from the exam committee. It is saved in the history.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

// The comprehensive exam on the staff student page (I-335; Handbook p.56 RES-04, p.77 GRD-04).
export default function ComprehensiveExamSection({ student, exam, onChanged }) {
  const { user } = useAuth();
  const canRecord = ["staff", "admin"].includes(user?.role);
  const [open, setOpen] = useState(false);
  const current = exam.current;
  const entries = exam.history.map((row) => ({
    id: row.id,
    title: `${row.result} · exam on ${formatDate(row.exam_date)}`,
    at: row.recorded_at,
    actor: row.recorded_by,
    note: row.reason,
  }));
  return (
    <SectionCard
      title="Comprehensive exam"
      subtitle="The result decides whether the research steps open"
      icon={GraduationCap}
      action={canRecord ? <Button variant="secondary" onClick={() => setOpen(true)}>Record result</Button> : undefined}
    >
      <div className="flex flex-wrap items-center gap-2" data-testid="comprehensive-exam-current">
        <StatusChip status={exam.status} />
        {current ? (
          <>
            <ProvenanceBadge source={current.source} by={current.recorded_by} at={current.recorded_at} reason={current.reason} />
            <span className="meta">Exam on {formatDate(current.exam_date)}</span>
          </>
        ) : (
          <span className="meta">{exam.status === "Not Taken" ? "No result recorded yet." : "Set by a monitoring sheet import."}</span>
        )}
      </div>
      {entries.length > 0 && <HistoryPanel entries={entries} label="View exam history" hideLabel="Hide exam history" count={entries.length} />}
      {open && <RecordDialog student={student} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onChanged(); }} />}
    </SectionCard>
  );
}
