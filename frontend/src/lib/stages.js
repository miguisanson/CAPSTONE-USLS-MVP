// The student lifecycle as Stepper steps (UI-SPEC section 4, Stepper row; idea X-02). Plain JavaScript on purpose:
// Node can import it (scripts/stages.test.mjs).
//
// The stage list is the API's `meta.stages` (app.py STAGES, in this order). The first 8 are the normal path;
// the last 5 are off the path. `stageSteps` builds steps from data the app already has - no new data:
//   - a stage on the path: the earlier steps are `complete`, that one is `current`, the later ones `upcoming`;
//   - an off-track stage (LOA, AWOL, Withdrawal In Progress, Withdrawn): the path steps stay `upcoming` (the
//     student's last on-path stage is not in the stage list) and one extra `stopped` step carries the stage's name,
//     which the Stepper draws as a chip;
//   - "Completed": every step is `complete`, plus a final `complete` step named "Completed".
// A stage that is not in the list (or no stage) marks nothing.

/** app.py STAGES. Used only when the caller has no `meta.stages` yet. */
export const DEFAULT_STAGES = Object.freeze([
  "Admission",
  "Coursework",
  "Comprehensive Exam",
  "Proposal Development",
  "Proposal Defense",
  "Data Collection",
  "Writing",
  "Final Defense",
  "LOA",
  "AWOL",
  "Withdrawal In Progress",
  "Withdrawn",
  "Completed",
]);

/** The stages that are not steps on the normal path. */
export const OFF_TRACK_STAGES = Object.freeze(["LOA", "AWOL", "Withdrawal In Progress", "Withdrawn", "Completed"]);

const OFF_TRACK = new Set(OFF_TRACK_STAGES);

/** True for a stage that is off the normal path (LOA, AWOL, Withdrawal In Progress, Withdrawn, Completed). */
export function isOffTrack(stage) {
  return OFF_TRACK.has(stage);
}

/** The stages that are steps on the path, in order. */
export function lifecycleStages(stages = DEFAULT_STAGES) {
  return (Array.isArray(stages) && stages.length ? stages : DEFAULT_STAGES).filter((s) => !OFF_TRACK.has(s));
}

/**
 * Stepper steps for a student's current stage.
 * @param stage   `student.current_stage`
 * @param stages  `meta.stages` from the API (optional)
 * @returns       [{ key, label, state }] - state is complete | current | upcoming | stopped
 */
export function stageSteps(stage, stages = DEFAULT_STAGES) {
  const path = lifecycleStages(stages);
  const at = path.indexOf(stage);
  const steps = path.map((label, i) => ({
    key: label,
    label,
    state: stage === "Completed" ? "complete" : at < 0 ? "upcoming" : i < at ? "complete" : i === at ? "current" : "upcoming",
  }));
  if (stage === "Completed") steps.push({ key: stage, label: stage, state: "complete" });
  else if (isOffTrack(stage)) steps.push({ key: stage, label: stage, state: "stopped" });
  return steps;
}
