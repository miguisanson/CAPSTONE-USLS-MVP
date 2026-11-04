import { useState } from "react";
import { FileCheck, Briefcase, CheckSquare, BookOpenCheck } from "lucide-react";
import { api } from "../../api";
import { Field, Input, Select } from "../../components/ui/index.js";
import StepDialog from "../../components/StepDialog";
import HistoryDisclosure from "../../components/HistoryDisclosure";
import { GRADUATION_STAGE_ACTIONS, GraduationBatchStageCheck, GraduationCompletedCourseworkView, GraduationPracticumCompletionView, GraduationRequirementBoxes, GraduationResearchRequirementsView, graduationBatchActionLabel, graduationBatchGroups, graduationStageSelection } from "./graduationShared";

const GRADUATION_BATCH_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function defaultGraduationBatchForm(rows = [], allRows = rows) {
  const existingName = rows.find((row) => row.endorsement?.batch_name)?.endorsement?.batch_name || "";
  const match = existingName.match(/^Batch(?:\s+No\.)?\s+(\d+)\s+([A-Za-z]+)\s+(\d{4})$/);
  if (match) {
    return { batch_no: match[1], batch_month: match[2], batch_year: match[3] };
  }
  const now = new Date();
  return {
    // one more than the highest batch number on the board (1 when there is no batch yet)
    batch_no: String(1 + Math.max(0, ...allRows.map((row) => Number(/^Batch(?:\s+No\.)?\s+(\d+)/.exec(row.endorsement?.batch_name || "")?.[1]) || 0))),
    batch_month: GRADUATION_BATCH_MONTHS[now.getMonth()],
    batch_year: String(now.getFullYear()),
  };
}

function graduationBatchName(form) {
  return `Batch ${form.batch_no || "1"} ${form.batch_month || GRADUATION_BATCH_MONTHS[new Date().getMonth()]} ${form.batch_year || new Date().getFullYear()}`;
}

const completedCourses = (row) => row.eligibility?.completed_courses || [];

function graduationSelectedActionLabel(action) {
  if (!action) return "Review selected candidates";
  return action.label;
}

export function GraduationBatchModal({ rows, allRows, accountRole, reviewWindows, defaultReviewWindow, onClose, onSaved }) {
  const selection = graduationStageSelection(rows, accountRole);
  const stageAction = selection.action;
  const defaultBatch = defaultGraduationBatchForm(rows, allRows);
  const activeReviewWindow = defaultReviewWindow || reviewWindows[0] || "";
  const selectedReviewWindow = activeReviewWindow;
  const reviewWindowOptions = reviewWindows.map((schoolYear) => ({
    value: schoolYear,
    label: schoolYear === activeReviewWindow ? `${schoolYear} — Current school year` : `${schoolYear} — Not currently open`,
    disabled: schoolYear !== activeReviewWindow,
  }));
  const [form, setForm] = useState({
    review_window: selectedReviewWindow,
    ...defaultBatch,
  });
  const action = stageAction;
  const deanDecides = accountRole === "dean" && stageAction?.id === "approve"; // approve or return, chosen by the button
  const [expandedDetailKeys, setExpandedDetailKeys] = useState(() => new Set());
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const batchName = graduationBatchName(form);
  const showBatchFields = action?.batchRequired || (action?.id === "send_to_dean" && selection.processableRows.some((row) => !row.endorsement?.batch_name));
  const selectedGroups = graduationBatchGroups(selection.processableRows.length ? selection.processableRows : rows);
  const modalActionLabel = action
    ? showBatchFields
      ? graduationBatchActionLabel(action)
      : graduationSelectedActionLabel(action)
    : "Review selected candidates";
  const showAllCompletionActions = (
    ["prepare_endorsement", "send_to_dean"].includes(action?.id)
    || stageAction?.id === "approve"
  );
  const showCourseworkActions = action?.id === "check_coursework" || showAllCompletionActions;
  const showResearchPracticumActions = action?.id === "validate_research" || showAllCompletionActions;

  function toggleDetail(studentId, detail) {
    const key = `${studentId}:${detail}`;
    setExpandedDetailKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  // Batch number and year used to be native `required`; now the dialog says what is missing.
  function problemWith() {
    if (!showBatchFields) return "";
    if (!String(form.batch_no).trim() || !String(form.batch_year).trim()) return "Enter the batch number and the year.";
    return "";
  }

  // `key` is the button pressed: the step itself, or approve / return for the Dean.
  async function confirm(key, comment) {
    const chosen = deanDecides ? GRADUATION_STAGE_ACTIONS[key] : action;
    const { batch_no, batch_month, batch_year, ...baseForm } = form;
    const payload = {
      ...baseForm,
      comment,
      stage_action: chosen.id,
      action: chosen.id,
      ...(showBatchFields ? { batch_no, batch_month, batch_year, batch_name: batchName } : {}),
    };
    try {
      const result = await api.graduationBatchAction({ student_ids: selection.processableRows.map((row) => row.student.id), ...payload });
      await onSaved(result);
      onClose();
    } catch (err) {
      throw new Error(err.message || "Could not apply the graduation group action.");
    }
  }

  const actions = !action
    ? []
    : deanDecides
      ? [
          { key: "approve", label: GRADUATION_STAGE_ACTIONS.approve.label, tone: "approve", icon: CheckSquare },
          { key: "return", label: GRADUATION_STAGE_ACTIONS.return.label, tone: "return", requireComment: true },
        ]
      : [{ key: action.id, label: modalActionLabel, tone: action.requiresComment ? "return" : "approve", icon: CheckSquare, requireComment: Boolean(action.requiresComment) }];

  return (
    <StepDialog
      title={deanDecides ? "Dean decision" : modalActionLabel}
      subtitle={action ? `${action.movement}` : "Selection needs one review stage"}
      size="xl"
      actions={actions}
      onConfirm={confirm}
      onCancel={onClose}
      validate={problemWith}
      withReason={Boolean(action)}
      reasonLabel={deanDecides ? "Dean comment" : action?.commentLabel || "Comment"}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="eyebrow">Selected action</p>
          {action ? (
            <>
              <p className="mt-2 text-sm font-semibold text-ink">{action.label}</p>
              <p className="mt-1 text-sm text-slate-600">{action.movement}</p>
            </>
          ) : (
            <p className="mt-2 text-sm font-semibold text-red-700">{selection.mixed ? "Selected candidates are in different review stages." : "No selected candidate has a group action due for this role."}</p>
          )}
        </div>
        {showBatchFields && (
          <div className="space-y-3 rounded-xl border border-brand-100 bg-brand-50/40 p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Batch No."><Input value={form.batch_no} onChange={update("batch_no")} inputMode="numeric" /></Field>
              <Field label="Month"><select value={form.batch_month} onChange={update("batch_month")} className="field-input cursor-pointer">{GRADUATION_BATCH_MONTHS.map((month) => <option key={month}>{month}</option>)}</select></Field>
              <Field label="Year"><Input value={form.batch_year} onChange={update("batch_year")} inputMode="numeric" /></Field>
              {activeReviewWindow ? (
                <Field label="Graduation school year" hint="Only the current school year can be used."><p aria-label="Graduation school year" className="rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-ink">{activeReviewWindow}</p></Field>
              ) : (
                <Field label="Graduation school year"><Select value={form.review_window} onChange={update("review_window")} options={reviewWindowOptions} placeholder="" /></Field>
              )}
            </div>
            <p className="text-sm font-semibold text-brand-800">Batch label: {batchName}</p>
          </div>
        )}
        {!showBatchFields && selectedGroups.length > 0 && (
          <HistoryDisclosure label="View stage history" hideLabel="Hide stage history" count={selectedGroups.length}>
            <div className="grid w-full grid-cols-1 gap-3">
              {selectedGroups.map((group) => <GraduationBatchStageCheck key={group.id} group={group} />)}
            </div>
          </HistoryDisclosure>
        )}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-ink">Eligible candidates</p>
          <p className="mt-1 text-sm text-slate-600">{selection.processableRows.length} of {rows.length} selected candidate{rows.length === 1 ? " is" : "s are"} ready for this action.</p>
          <ul className="mt-3 grid gap-3 xl:grid-cols-2">
            {rows.map((row) => {
              const courseworkOpen = expandedDetailKeys.has(`${row.student.id}:coursework`);
              const researchOpen = expandedDetailKeys.has(`${row.student.id}:research`);
              const practicumOpen = expandedDetailKeys.has(`${row.student.id}:practicum`);
              const courseworkPanelId = `graduation-modal-coursework-${row.student.id}`;
              const researchPanelId = `graduation-modal-research-${row.student.id}`;
              const practicumPanelId = `graduation-modal-practicum-${row.student.id}`;
              return (
                <li key={row.student.id} className="rounded-xl border border-slate-200 bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-ink">{row.student.name}</p>
                      <p className="text-xs text-slate-500">{row.student.student_number} · {row.student.program_code}</p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {showCourseworkActions && (
                        <button
                          type="button"
                          onClick={() => toggleDetail(row.student.id, "coursework")}
                          className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
                          aria-expanded={courseworkOpen}
                          aria-controls={courseworkPanelId}
                        >
                          <BookOpenCheck className="h-3.5 w-3.5" />
                          {courseworkOpen ? "Hide coursework completed" : "View coursework completed"}
                        </button>
                      )}
                      {showResearchPracticumActions && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleDetail(row.student.id, "research")}
                            className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
                            aria-expanded={researchOpen}
                            aria-controls={researchPanelId}
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            {researchOpen ? "Hide research completion details" : "View research completion details"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDetail(row.student.id, "practicum")}
                            className="btn-ghost cursor-pointer px-2.5 py-1.5 text-xs transition-colors"
                            aria-expanded={practicumOpen}
                            aria-controls={practicumPanelId}
                          >
                            <Briefcase className="h-3.5 w-3.5" />
                            {practicumOpen ? "Hide practicum completion details" : "View practicum completion details"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <GraduationRequirementBoxes row={row} />
                  {completedCourses(row).length > 0 && (
                    <p className="meta mt-2">
                      <span className="font-semibold text-slate-700">Completed subjects:</span>{" "}
                      {completedCourses(row).slice(0, 4).map((course) => course.code).join(", ")}
                      {completedCourses(row).length > 4 ? ` +${completedCourses(row).length - 4} more` : ""}
                    </p>
                  )}
                  {showCourseworkActions && courseworkOpen && <GraduationCompletedCourseworkView id={courseworkPanelId} row={row} />}
                  {showResearchPracticumActions && researchOpen && <GraduationResearchRequirementsView id={researchPanelId} row={row} />}
                  {showResearchPracticumActions && practicumOpen && <GraduationPracticumCompletionView id={practicumPanelId} row={row} />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </StepDialog>
  );
}
