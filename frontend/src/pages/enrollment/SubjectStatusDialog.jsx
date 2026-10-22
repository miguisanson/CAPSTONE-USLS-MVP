// "Record dropped subject": the Academic Coordinator records that an enrolled subject was dropped (handbook: unexcused
// absences above the limit). The dialog is the library Modal; the fields are library Fields. Validation happens when
// Save is pressed (UX research s3: validate on submit, error summary at the top with a link to each field, answers
// stay in the fields), not by greying the button out.
import { useRef, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import { Button, Field, InlineNotice, Input, Modal, Select, StatusChip, Textarea } from "../../components/ui/index.js";
import PolicyRules from "../../components/PolicyRules";

const FIELD_ORDER = ["status", "effectiveDate", "absence", "note"];

/** The messages say what is wrong and how to fix it. Returns { field: message } (empty when the form is complete). */
export function validateDrop(edit) {
  const errors = {};
  if (!edit.status) errors.status = "Choose Dropped as the new status.";
  if (!edit.effectiveDate) errors.effectiveDate = "Enter the date the drop takes effect.";
  const absence = edit.unexcusedAbsencePercent;
  if (absence === "" || Number.isNaN(Number(absence))) {
    errors.absence = "Enter the student's unexcused absences as a percentage of the class hours, for example 25.";
  } else if (Number(absence) < 0 || Number(absence) > 100) {
    errors.absence = "Enter a percentage between 0 and 100.";
  }
  if (!edit.note.trim()) errors.note = "Add a coordinator note that explains this status change.";
  return errors;
}

export default function SubjectStatusDialog({ edit, setEdit, error, busy, onClose, onSave }) {
  const [errors, setErrors] = useState({});
  const summaryRef = useRef(null);
  const fieldRefs = { status: useRef(null), effectiveDate: useRef(null), absence: useRef(null), note: useRef(null) };
  const messages = FIELD_ORDER.filter((key) => errors[key]);

  function submit() {
    const found = validateDrop(edit);
    setErrors(found);
    if (Object.keys(found).length) {
      // wait for the summary to render, then move the focus to it so a screen reader reads it first
      window.setTimeout(() => summaryRef.current?.focus(), 0);
      return;
    }
    onSave();
  }

  const set = (key) => (event) => setEdit((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal
      title="Record dropped subject"
      subtitle={`${edit.studentName} · ${edit.courseCode} · ${edit.termLabel}`}
      icon={ClipboardCheck}
      size="md"
      closeLabel="Close status dialog"
      dismissible={!busy}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} loading={busy}>
            {busy ? "Saving..." : `Save ${edit.status || "status"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {messages.length > 0 && (
          <div ref={summaryRef} tabIndex={-1} className="rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300">
            <InlineNotice tone="danger" title="There is a problem">
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {messages.map((key) => (
                  <li key={key}>
                    <a
                      href={`#${key}`}
                      className="font-semibold underline"
                      onClick={(event) => {
                        event.preventDefault();
                        fieldRefs[key].current?.focus();
                      }}
                    >
                      {errors[key]}
                    </a>
                  </li>
                ))}
              </ul>
            </InlineNotice>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{edit.courseTitle}</p>
            <p className="meta mt-0.5">Current status</p>
          </div>
          <StatusChip status="Enrolled" dot={false} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New status" required error={errors.status}>
            <Select
              ref={fieldRefs.status}
              placeholder="Choose status"
              options={["Dropped"]}
              value={edit.status}
              onChange={set("status")}
            />
          </Field>
          <Field label="Effective date" required error={errors.effectiveDate}>
            <Input ref={fieldRefs.effectiveDate} type="date" value={edit.effectiveDate} onChange={set("effectiveDate")} />
          </Field>
        </div>

        <PolicyRules process="dropping" title="When a subject can be dropped" defaultOpen />

        <Field
          label="Unexcused absences (% of class hours)"
          required
          hint="A subject is dropped by the professor only when unexcused absences are more than the limit shown above. To leave a subject earlier, the student files a Subject Withdrawal."
          error={errors.absence}
        >
          <Input
            ref={fieldRefs.absence}
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={edit.unexcusedAbsencePercent}
            onChange={set("unexcusedAbsencePercent")}
            placeholder="e.g. 25"
          />
        </Field>

        <Field label="Coordinator note" required error={errors.note}>
          <Textarea
            ref={fieldRefs.note}
            rows={4}
            value={edit.note}
            onChange={set("note")}
            className="resize-y"
            placeholder="Briefly explain this status change."
            maxLength={2000}
          />
        </Field>

        {error && <InlineNotice tone="danger">{error}</InlineNotice>}
        <p className="meta">
          Dropping is recorded here by the Academic Coordinator. A withdrawal, allowed until the end of the second week of classes, must be initiated by the student in the Withdrawal workflow.
        </p>
      </div>
    </Modal>
  );
}
