import { Field, Input, Select, Textarea } from "../ui/index.js";

// The one set of verdict fields (F5-09): result, follow-up, remarks, title pick and Form 7 score, with one label set and
// one set of hints. Faculty Verdicts, the staff "Record for the panel" window and the Research Gate fallback all use it.
// `values` uses the API field names (provisional_follow_up, remarks, selected_title, evaluation_score); `onChange(patch)`
// gets the changed fields. The caller owns the state, the reason field, the buttons and the validation.
export const PROVISIONAL = "Provisional pass - revisions or re-defense";
const FOLLOW_UPS = [{ value: "revisions", label: "Revisions for panel approval" }, { value: "re-defense", label: "Re-defense" }];

// I-248: the student's three concept-paper titles. With titles, the panel picks one or sets a new title (free text only then).
export const NEW_TITLE = "A new title set by the panel";

export function VerdictFields({ options = [], result, values = {}, onChange, resultPlaceholder = null, showRemarks = true, showTitle = false, showScore = false, conceptTitles = [] }) {
  const pickList = conceptTitles.length > 0;
  const typedTitle = values.selected_title || "";
  const picked = !pickList ? "" : values.title_choice || (conceptTitles.includes(typedTitle) ? typedTitle : typedTitle ? NEW_TITLE : "");
  const chosen = options.find((option) => option.value === result);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Verdict result" required hint={chosen?.summary}>
        <Select placeholder={resultPlaceholder} options={options} value={result} onChange={(event) => onChange({ result: event.target.value, provisional_follow_up: "" })} />
      </Field>
      {result === PROVISIONAL && (
        <Field label="Required follow-up" required>
          <Select placeholder="Choose revisions or re-defense" options={FOLLOW_UPS} value={values.provisional_follow_up || ""} onChange={(event) => onChange({ provisional_follow_up: event.target.value })} />
        </Field>
      )}
      {showRemarks && (
        <Field label="Remarks or conditions">
          <Textarea rows={3} value={values.remarks || ""} onChange={(event) => onChange({ remarks: event.target.value })} placeholder="Optional conditions, revisions, or notes" />
        </Field>
      )}
      {showTitle && result === "Passed" && (
        <div className="sm:col-span-2">
          <Field label="Title selected by the panel (from the three submitted)">
            {pickList ? (
              <Select
                placeholder="Choose the title"
                options={[...conceptTitles.map((title) => ({ value: title, label: title })), { value: NEW_TITLE, label: NEW_TITLE }]}
                value={picked}
                onChange={(event) => onChange({ title_choice: event.target.value, selected_title: event.target.value === NEW_TITLE ? "" : event.target.value })}
              />
            ) : (
              <Input value={typedTitle} maxLength={220} onChange={(event) => onChange({ selected_title: event.target.value })} placeholder="Saved as the title of the study" />
            )}
          </Field>
          {pickList && picked === NEW_TITLE && (
            <div className="mt-3">
              <Field label="New title set by the panel" required>
                <Input value={typedTitle} maxLength={220} onChange={(event) => onChange({ selected_title: event.target.value })} placeholder="Saved as the title of the study" />
              </Field>
            </div>
          )}
        </div>
      )}
      {showScore && (
        <Field label="Evaluation score (Form 7)" hint="A pass needs the passing score for the paper type.">
          <Input type="number" min="0" max="100" step="0.01" value={values.evaluation_score || ""} onChange={(event) => onChange({ evaluation_score: event.target.value })} />
        </Field>
      )}
    </div>
  );
}
