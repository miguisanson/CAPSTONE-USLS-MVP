import { useEffect, useId, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { api } from "../../api";
import { useApi } from "../../hooks";
import { Button, Field, InlineNotice, Modal, Select, StatusChip, Textarea } from "../../components/ui/index.js";
import StudentPicker from "../../components/StudentPicker";

// The stage decides the purpose (the server's awol_policy_review checks the same pairs); other stages leave it to staff.
const PURPOSE_BY_STAGE = {
  "Comprehensive Exam": "Comprehensive examination",
  Writing: "Awaiting research publication",
  "Final Defense": "Awaiting research publication",
};

/**
 * "Record residency": the one thing on the AWOL & Residency page that starts a case from
 * staff's side (AWOL itself is flagged by the system and cannot be declared by hand).
 * The policy checker has to be run first, exactly as before; saving goes through the same
 * workflow call, so the residency then shows on the board like any other case.
 */
export default function ResidencyDialog({ reasons, onClose, onSaved }) {
  const formId = useId();
  const blockedId = useId();
  const { data: meta } = useApi(() => api.meta(), []);
  const [student, setStudent] = useState({ id: null, label: "" });
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("");
    const [notes, setNotes] = useState("");
  const [review, setReview] = useState(null);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeTerm = String(meta?.terms?.find((item) => item.is_active_planning_term)?.id || "");
  const activeTermLabel = meta?.terms?.find((item) => item.is_active_planning_term)?.label || "";
  const selectedTerm = activeTerm;
  const stagePurpose = PURPOSE_BY_STAGE[stage] || "";
  // The handbook has no staff override (I-012): residency is recorded only when the checker clears the case.
  const blockedReason = review && review.recommendation !== "Eligible for Residency"
    ? "The policy checker says this case needs human review, so residency cannot be recorded. Fix the flagged record or use leave of absence instead."
    : "";

  async function runCheck(studentId = student.id, purpose = reason) {
    if (!studentId || !purpose) {
      setError("Choose a student and a residency purpose first.");
      return;
    }
    setChecking(true);
    setError("");
    try {
      const response = await api.awolPolicyReview({
        student_id: studentId,
        workflow_action: "record_residency",
        residency_reason: purpose,
      });
      setReview(response.review);
    } catch (err) {
      setError(err.message || "Could not run the residency policy check.");
    } finally {
      setChecking(false);
    }
  }

  // Choosing a student fills the purpose from the stage and runs the check at once; with no answer from the stage, staff pick it.
  useEffect(() => {
    if (!student.id) return undefined;
    let live = true;
    setStage("");
    setReason("");
    setReview(null);
    api.student(student.id).then((data) => {
      if (!live) return;
      const next = PURPOSE_BY_STAGE[data?.student?.current_stage] || "";
      setStage(data?.student?.current_stage || "");
      if (!next) return;
      setReason(next);
      runCheck(student.id, next);
    }).catch(() => {});
    return () => { live = false; };
  }, [student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(event) {
    event.preventDefault();
    if (saving) return;
    if (!review) {
      setError("Run the policy checker before recording residency.");
      return;
    }
    if (blockedReason) {
      setError(blockedReason);
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
    <Modal
      size="lg"
      title="Record residency"
      subtitle="A no-subject semester for a student with work left (handbook conditions apply)"
      onClose={onClose}
      dismissible={!saving}
      closeLabel="Close without saving"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="secondary" icon={ClipboardCheck} loading={checking} onClick={() => runCheck()} disabled={checking || saving || !student.id || !reason}>
            {checking ? "Checking…" : "Check again"}
          </Button>
          <Button
            type="submit"
            form={formId}
            loading={saving}
            disabled={saving || !review || Boolean(blockedReason)}
            title={blockedReason || undefined}
            aria-describedby={blockedReason ? blockedId : undefined}
          >
            {saving ? "Saving…" : "Record residency"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={save} className="space-y-4">
        <InlineNotice tone="warning" title="AWOL cannot be declared manually">
          <span className="block text-xs font-normal leading-relaxed">
            The system flags an imported AWOL standing or a full-semester withdrawal without approved LOA. Staff only review those
            alerts, return requests, and valid residency enrollment.
          </span>
        </InlineNotice>
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
                if (!id) { setReason(""); setStage(""); }
              }}
            />
          </div>
          {stagePurpose ? (
            <div>
              <p className="field-label">Residency purpose</p>
              <p data-testid="residency-purpose" className="text-sm text-ink">{stagePurpose}</p>
              <p className="meta mt-0.5">From the student's stage: {stage}.</p>
            </div>
          ) : (
            <Field label="Residency purpose" required hint={student.id ? "The stage does not decide this one." : undefined}>
              {/* The dialog's first focus goes here, not to the student search: that box opens its result list the moment it is focused and the list would cover the form. */}
              <Select
                data-autofocus=""
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value);
                  setReview(null);
                  if (event.target.value && student.id) runCheck(student.id, event.target.value);
                }}
                placeholder="Select handbook purpose"
                options={reasons}
                required
              />
            </Field>
          )}
        </div>
        <div>
          <p className="field-label">Semester</p>
          <p data-testid="residency-semester" className="text-sm text-ink">{activeTermLabel || "No active semester"}</p>
          <p className="meta mt-0.5">The active semester; past semesters cannot be recorded.</p>
        </div>
        <Field label="Staff notes" hint="Optional. Kept with the residency record.">
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {review && (
          <section className="rounded-xl border border-brand-100 bg-brand-50/60 p-4" aria-label="Residency policy result">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={review.recommendation} dot={false} />
              <span className="meta">Suggested: {review.suggested_action}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">{review.summary}</p>
            <ul className="mt-3 space-y-2">
              {(review.checks || []).map((check) => (
                <li key={check.label} className="flex flex-wrap items-start justify-between gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-black/5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{check.label}</p>
                    <p className="meta mt-0.5">{check.detail}</p>
                  </div>
                  <StatusChip status={check.status} dot={false} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {blockedReason && <InlineNotice tone="danger" id={blockedId}>{blockedReason}</InlineNotice>}
        {error && error !== blockedReason && <InlineNotice tone="danger">{error}</InlineNotice>}
      </form>
    </Modal>
  );
}
