import { useId, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { ErrorNote, StatusBadge } from "../../components/ui";
import { Field, Select, Textarea } from "../../components/forms";
import StudentPicker from "../../components/StudentPicker";
import ModalShell from "../leave/ModalShell";

/**
 * "Record residency": the one thing on the AWOL & Residency page that starts a case from
 * staff's side (AWOL itself is flagged by the system and cannot be declared by hand).
 * The policy checker has to be run first, exactly as before; saving goes through the same
 * workflow call, so the residency then shows on the board like any other case.
 */
export default function ResidencyDialog({ reasons, onClose, onSaved }) {
  const formId = useId();
  const { data: meta } = useApi(() => api.meta(), []);
  const [student, setStudent] = useState({ id: null, label: "" });
  const [reason, setReason] = useState("");
  const [termId, setTermId] = useState("");
  const [notes, setNotes] = useState("");
  const [review, setReview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeTerm = String(meta?.terms?.find((item) => item.is_active_planning_term)?.id || "");
  const selectedTerm = termId || activeTerm;

  async function runCheck() {
    if (!student.id || !reason) {
      setError("Choose a student and a residency purpose first.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const response = await api.awolPolicyReview({
        student_id: student.id,
        workflow_action: "record_residency",
        residency_reason: reason,
      });
      setReview(response.review);
    } catch (err) {
      setError(err.message || "Could not run the residency policy check.");
    } finally {
      setChecking(false);
    }
  }

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!review) {
      setError("Run the policy checker before recording residency.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await api.submitTransaction("awol", {
        student_id: student.id,
        workflow_action: "record_residency",
        residency_reason: reason,
        term_id: selectedTerm,
        staff_notes: notes,
      });
      await onSaved(result.message || "Residency recorded.");
    } catch (err) {
      setError(err.message || "Residency could not be recorded.");
      setSaving(false);
    }
  }

  return (
    <ModalShell
      id="record-residency"
      size="wide"
      title="Record residency"
      subtitle="A no-subject semester for a student with work left (handbook conditions apply)"
      onClose={() => !saving && onClose()}
      closeLabel="Close without saving"
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-ghost px-4 py-2">Cancel</button>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={runCheck} disabled={checking || saving} className="btn-ghost px-4 py-2">
              <ClipboardCheck className="h-4 w-4" /> {checking ? "Checking..." : "Run residency policy checker"}
            </button>
            <button type="submit" form={formId} disabled={saving || !review} className="btn-primary px-4 py-2">
              {saving ? "Saving..." : "Record residency"}
            </button>
          </div>
        </>
      }
    >
      <form id={formId} onSubmit={save} className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">AWOL cannot be declared manually</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800">
            The system flags an imported AWOL standing or a full-semester withdrawal without approved LOA. Staff only review those
            alerts, return requests, and valid residency enrollment.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="field-label">Student</p>
            <StudentPicker
              value={student.id}
              selectedLabel={student.label}
              meta={meta}
              onChange={(id, label) => {
                setStudent({ id, label: label || "" });
                setReview(null);
              }}
            />
          </div>
          <Field label="Residency purpose" required>
            <Select
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setReview(null);
              }}
              placeholder="Select handbook purpose"
              options={reasons}
              required
            />
          </Field>
        </div>
        <Field label="Semester" required>
          <Select
            value={selectedTerm}
            onChange={(event) => setTermId(event.target.value)}
            placeholder="Select semester"
            options={(meta?.terms || []).map((term) => ({ value: String(term.id), label: term.label }))}
            required
          />
        </Field>
        <Field label="Staff verification notes" hint="Required when the residency policy result needs human review.">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {review && (
          <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-4" aria-label="Residency policy result">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge value={review.recommendation} dot={false} />
              <span className="text-xs text-slate-500">Suggested: {review.suggested_action}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{review.summary}</p>
            <ul className="mt-3 space-y-2">
              {(review.checks || []).map((check) => (
                <li key={check.label} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{check.label}</p>
                    <p className="mt-0.5 text-xs text-slate-600">{check.detail}</p>
                  </div>
                  <StatusBadge value={check.status} dot={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
        <div aria-live="polite"><ErrorNote message={error} /></div>
      </form>
    </ModalShell>
  );
}
