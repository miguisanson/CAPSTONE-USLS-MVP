# Sir Oli Revision Checklist (from the July 20 consultation)

Prioritized list of system revisions based on the consultation transcription. Each item records the
problem raised, the required revision, the data or policy still needed, the responsible module, a
priority, the current status, and whether stakeholder confirmation is still required.

Priority legend: P0 blocks the rest of the system, P1 required for a defensible workflow,
P2 presentation and polish.

The consultation stated plainly that items 1, 2 and 3 (Student Handoff, Enrollment, Course
Adjustment) are the critical break point, and that Research Gate, Practicum and Graduation all
depend on the quality of that data. This checklist is ordered accordingly.

---

## 1. Critical data and source of truth issues

### 1.1 The Monitoring Sheet does not contain enrolled subjects
- **Problem:** The sheet only marks completed units. It cannot show who is currently enrolled, who
  dropped, who deferred, or who failed. The consultation identified this as the point where the
  whole cycle breaks.
- **Required revision:** Obtain an official enrollment or class list dataset and treat it as the
  source for enrollment. Do not infer enrollment from completed units.
- **Data or policy needed:** Official enrollment or class list export with subject level status.
- **Responsible module:** Student Handoff, Enrollment, Course Adjustment.
- **Priority:** P0
- **Current status:** Not resolved. No enrollment source confirmed.
- **Stakeholder confirmation needed:** Yes. Confirm the official source and the release schedule.

### 1.2 Deferred subjects can conflict with the Monitoring Sheet
- **Problem:** The sheet marks a subject as completed or blank. The official record may show the
  subject as deferred or taken but not completed. The consultation described this as a likely and
  frequent conflict.
- **Required revision:** Record deferred and incomplete outcomes from an official result dataset,
  and show the conflict instead of silently trusting the sheet.
- **Data or policy needed:** Official grade or completion dataset that carries deferred and
  incomplete states, plus the deferment rule.
- **Responsible module:** Grades and Subject Completion, Course Adjustment.
- **Priority:** P0
- **Current status:** Not resolved.
- **Stakeholder confirmation needed:** Yes.

### 1.3 The deferment rule is unknown to the team
- **Problem:** When asked how long a student may complete a deferred subject before it converts to a
  failing mark, the team could not answer.
- **Required revision:** Obtain the official deferment policy and make the period configurable
  rather than hard coded.
- **Data or policy needed:** Written deferment or incomplete completion policy.
- **Responsible module:** Grades and Subject Completion.
- **Priority:** P0
- **Current status:** Unknown.
- **Stakeholder confirmation needed:** Yes.

### 1.4 Downstream features depend on unavailable data
- **Problem:** The consultation stated that Research Gate, Practicum and Graduation depend on
  completion data from items 1, 2 and 3.
- **Required revision:** Document each dependent feature, the exact field it needs, and what the
  system shows when that data is unavailable. Do not silently assume completion.
- **Data or policy needed:** Confirmed completion dataset.
- **Responsible module:** All downstream modules.
- **Priority:** P0
- **Current status:** Dependencies not mapped.
- **Stakeholder confirmation needed:** Yes, indirectly.

---

## 2. Student Handoff and import validation

### 2.1 Non ideal import cases were not thought through
- **Problem:** When asked what happens if the uploaded sheet is incomplete or inconsistent, the
  answers were vague. The term "conflict" was introduced without a definition.
- **Required revision:** Define the specific import exceptions: missing student, missing column,
  missing value, inconsistent value, and a student appearing without any subject. For each, define
  what the user sees, what is imported, and what is held back.
- **Data or policy needed:** None. Internal design decision.
- **Responsible module:** Student Handoff.
- **Priority:** P0
- **Current status:** Partially handled. Import reports duplicates and conflicts but the exception
  taxonomy is not defined.
- **Stakeholder confirmation needed:** No.

### 2.2 Re-uploading does not fix missing source data
- **Problem:** The consultation pointed out that asking the user to re-upload cannot resolve a
  problem that exists in the source file itself.
- **Required revision:** Separate two cases: a file formatting problem that a re-upload can fix, and
  a source data gap that must be reported to the office that produced the file.
- **Data or policy needed:** None.
- **Responsible module:** Student Handoff.
- **Priority:** P1
- **Current status:** Not implemented.
- **Stakeholder confirmation needed:** No.

### 2.3 New student detection logic was questioned
- **Problem:** The team said the same sheet contains both new and existing students, then could not
  explain how a newly admitted student would appear without any enrolled subject.
- **Required revision:** State the matching rule plainly: match on student number, update if
  present, create if absent, and flag any record that cannot be classified.
- **Data or policy needed:** Confirmation that the student number is the official identifier.
- **Responsible module:** Student Handoff.
- **Priority:** P1
- **Current status:** Matching by student number exists. The stated logic needs to be written down.
- **Stakeholder confirmation needed:** No.

---

## 3. Enrollment

### 3.1 The system has no enrollment data
- **Problem:** Enrollment happens in another system. The Monitoring Sheet does not carry it.
- **Required revision:** Import enrollment from an official dataset. Display it as read only.
- **Data or policy needed:** Enrollment or class list export.
- **Responsible module:** Enrollment.
- **Priority:** P0
- **Current status:** Not resolved.
- **Stakeholder confirmation needed:** Yes.

### 3.2 The application must not perform enrollment
- **Problem:** Students are admitted and enrolled in another system, not with the Graduate School.
- **Required revision:** Rename and rescope the module so it records and monitors official
  enrollment rather than appearing to perform it.
- **Data or policy needed:** None.
- **Responsible module:** Enrollment.
- **Priority:** P1
- **Current status:** Partially addressed. Wording and controls still imply the Graduate School
  enrolls the student.
- **Stakeholder confirmation needed:** No.

### 3.3 Previous semester enrollment must be retained
- **Problem:** Forecasting needs last semester actual enrollment.
- **Required revision:** Keep enrollment history per semester rather than only the current term.
- **Data or policy needed:** Whether the official export preserves history.
- **Responsible module:** Enrollment.
- **Priority:** P0
- **Current status:** Not implemented.
- **Stakeholder confirmation needed:** Yes.

---

## 4. Course adjustment and forecasting

### 4.1 Forecasting cannot run without drop, deferral and failure data
- **Problem:** The consultation walked through the dependency: to forecast next semester you need
  actual enrollment, who dropped, who deferred, who failed, and the grades from the most recent
  semester.
- **Required revision:** Make each input explicit in the module and block or clearly label the
  forecast when an input is missing.
- **Data or policy needed:** Enrollment dataset and completion dataset.
- **Responsible module:** Course Adjustment.
- **Priority:** P0
- **Current status:** Demand is computed from curriculum and completed units only.
- **Stakeholder confirmation needed:** Yes.

### 4.2 The dropping function does not belong to the Graduate School
- **Problem:** Students drop in another system. The consultation concluded that the platform should
  not have a function that performs the drop, and that the Graduate School will only learn about a
  drop afterwards.
- **Required revision:** Record the drop as information received from the official source. Remove
  any implication that the Graduate School approves or executes the drop.
- **Data or policy needed:** Which official report carries drops.
- **Responsible module:** Course Adjustment, Enrollment.
- **Priority:** P0
- **Current status:** Partially addressed. The deny option was removed and the action is now
  recorded rather than approved, but the source of drop information is still unconfirmed.
- **Stakeholder confirmation needed:** Yes.

### 4.3 Forecast timing must match the term break
- **Problem:** The consultation established that forecasting happens during the term break, before
  the next semester.
- **Required revision:** Tie the forecast to a configurable planning period rather than assuming
  dates.
- **Data or policy needed:** Official enrollment and adjustment period dates.
- **Responsible module:** Course Adjustment.
- **Priority:** P1
- **Current status:** Academic semesters are configurable. Period rules are not enforced.
- **Stakeholder confirmation needed:** Yes.

### 4.4 Teacher assignment belongs to course adjustment
- **Problem:** The consultation confirmed that when courses are projected for next semester, that is
  where the teacher is assigned.
- **Required revision:** Carry approved offerings into class scheduling with faculty assignment.
- **Data or policy needed:** Faculty availability and load rules.
- **Responsible module:** Course Adjustment, Scheduling.
- **Priority:** P1
- **Current status:** Offering approval exists. Faculty assignment is not completed.
- **Stakeholder confirmation needed:** Partly.

---

## 5. Grades and subject completion

### 5.1 Faculty should not re-encode grades in this platform
- **Problem:** The consultation asked why faculty would enter grades again when they already submit
  them through a university platform, and why the Graduate School would not obtain the data itself.
- **Required revision:** Remove faculty grade encoding as an official path. Obtain grades from the
  official source.
- **Data or policy needed:** Official grade dataset.
- **Responsible module:** Grades and Subject Completion, Faculty screen.
- **Priority:** P0
- **Current status:** Faculty grade encoding still exists in the faculty screen.
- **Stakeholder confirmation needed:** Yes, for the official source.

### 5.2 Students should not supply their own official grades
- **Problem:** Student supplied grades were raised as an option and are not an official source.
- **Required revision:** Remove student grade submission as an official path. A student may report a
  discrepancy only.
- **Data or policy needed:** None.
- **Responsible module:** Student portal.
- **Priority:** P1
- **Current status:** To be verified and removed where present.
- **Stakeholder confirmation needed:** No.

### 5.3 Grade availability timing is unknown
- **Problem:** Forecasting depends on when results are posted.
- **Required revision:** Capture the result posting date in the dataset and use it instead of
  assumed deadlines.
- **Data or policy needed:** When grades become officially available.
- **Responsible module:** Grades and Subject Completion.
- **Priority:** P1
- **Current status:** Not implemented.
- **Stakeholder confirmation needed:** Yes.

---

## 6. Leave of absence

### 6.1 Retrieval Augmented Generation is unnecessary for LOA
- **Problem:** The consultation questioned why a retrieval based AI component is used to read an
  uploaded letter when the required information follows simple rules. If the application is a
  structured form, the data is already structured and no extraction is required.
- **Required revision:** Replace the uploaded letter and the AI extraction with a structured LOA
  form, and implement the eligibility checks as ordinary rules.

  Revised process:
  1. Student completes a structured LOA form.
  2. System validates dates, prior leaves, allowed duration, and required fields using standard rules.
  3. Graduate School reviews.
  4. Dean approves or returns for revision.
  5. System generates an official document or report.
  6. Document is sent to the Registrar.
  7. Registrar implementation is later confirmed in the system.

  Do not use retrieval based AI simply to extract information that can be collected directly through
  form fields.
- **Data or policy needed:** Allowable reasons, maximum number of leaves, allowed duration.
- **Responsible module:** LOA.
- **Priority:** P0
- **Current status:** LOA currently accepts an uploaded PDF and uses the policy assistant.
- **Stakeholder confirmation needed:** Yes, for the rule values.

### 6.2 The LOA is filed with the Graduate School but implemented by the Registrar
- **Problem:** The consultation confirmed the approval happens in the Graduate School, but the real
  leave of absence is recorded by the Registrar.
- **Required revision:** Produce an official output the student or the Graduate School can bring to
  the Registrar, and record Registrar implementation afterwards.
- **Data or policy needed:** The document or report format the Registrar expects.
- **Responsible module:** LOA, Registrar communication.
- **Priority:** P0
- **Current status:** Not implemented. The team acknowledged the report system is incomplete.
- **Stakeholder confirmation needed:** Yes.

### 6.3 A student cannot withdraw a filed LOA application
- **Problem:** Asked whether a student can cancel a submitted LOA application, the answer was no,
  and it was agreed they should be able to.
- **Required revision:** Allow the student to withdraw a pending LOA application before a decision.
- **Data or policy needed:** None.
- **Responsible module:** LOA, Student portal.
- **Priority:** P1
- **Current status:** Not implemented.
- **Stakeholder confirmation needed:** No.

### 6.4 LOA form validation error during the demonstration
- **Problem:** A validation error occurred because the start and end semester were required but an
  end semester was not available.
- **Required revision:** Fix the required field handling and validate the effective period properly.
- **Data or policy needed:** None.
- **Responsible module:** LOA.
- **Priority:** P1
- **Current status:** Defect observed during the demonstration.
- **Stakeholder confirmation needed:** No.

### 6.5 A leave cannot start in a semester that already began
- **Problem:** The review noted that the effective period must be the next semester and that a leave
  cannot be filed for a semester already in progress.
- **Required revision:** Enforce this as a simple rule in the structured form.
- **Data or policy needed:** Confirmation of the rule.
- **Responsible module:** LOA.
- **Priority:** P1
- **Current status:** Not enforced.
- **Stakeholder confirmation needed:** Yes.

---

## 7. Readmission

### 7.1 Same process and same Registrar dependency as LOA
- **Problem:** The consultation confirmed readmission follows the same concept and process, is filed
  with the Graduate School, and is then communicated to the Registrar.
- **Required revision:** Apply the same structured form, rule based validation, official output, and
  Registrar confirmation step.
- **Data or policy needed:** Readmission rules and the Registrar output format.
- **Responsible module:** Readmission.
- **Priority:** P1
- **Current status:** Exists but without the official output and confirmation loop.
- **Stakeholder confirmation needed:** Yes.

### 7.2 Readmission does not automatically make a student eligible to enroll
- **Problem:** Asked whether a readmitted student is automatically eligible to enroll, the process
  was clarified as going through the Graduate School first, then being communicated to the Registrar.
- **Required revision:** Do not present readmission approval as enrollment eligibility. Show the
  Registrar step explicitly.
- **Data or policy needed:** Confirmation of the sequence.
- **Responsible module:** Readmission, Enrollment.
- **Priority:** P1
- **Current status:** Not represented.
- **Stakeholder confirmation needed:** Yes.

---

## 8. AWOL

### 8.1 Automatic AWOL tagging must be communicated to the Registrar
- **Problem:** Asked what the feature does, the answer was to tag the student AWOL automatically.
  The consultation noted AWOL has the same effect as a leave and must also be communicated.
- **Required revision:** Define the tagging basis, produce the Registrar notification, and record
  implementation confirmation.
- **Data or policy needed:** The official basis for declaring AWOL and the notification format.
- **Responsible module:** AWOL, Registrar communication.
- **Priority:** P1
- **Current status:** Tagging exists. Communication and confirmation do not.
- **Stakeholder confirmation needed:** Yes.

---

## 9. Residency

### 9.1 Residency also requires Registrar communication
- **Problem:** In residency the student cannot enroll but is not on leave. The consultation stated
  this must also be communicated to the Registrar.
- **Required revision:** Represent residency as a distinct standing with its own notification and
  confirmation.
- **Data or policy needed:** Residency rules and notification format.
- **Responsible module:** Residency.
- **Priority:** P1
- **Current status:** Residency exists but without the Registrar exchange.
- **Stakeholder confirmation needed:** Yes.

---

## 10. Withdrawal

### 10.1 Withdrawal is from the program, approved by the Dean
- **Problem:** The team initially described withdrawal as a belief rather than a fact. It was
  clarified as withdrawal from the program, approved by the Dean in the Graduate School.
- **Required revision:** State the scope clearly in the interface and remove any subject level
  withdrawal implication.
- **Data or policy needed:** None.
- **Responsible module:** Withdrawal.
- **Priority:** P1
- **Current status:** Needs wording and scope verification.
- **Stakeholder confirmation needed:** No.

### 10.2 Withdrawal must be communicated to the Registrar and confirmed back
- **Problem:** After the Dean decision, something must be produced for the Registrar, and the
  Registrar must confirm implementation.
- **Required revision:** Generate the official output and record the Registrar confirmation.
- **Data or policy needed:** Output format and confirmation method.
- **Responsible module:** Withdrawal, Registrar communication.
- **Priority:** P0
- **Current status:** Not implemented.
- **Stakeholder confirmation needed:** Yes.

---

## 11. Registrar communication

### 11.1 The exchange is two way and is required for record consistency
- **Problem:** The consultation stated that the Graduate School informs the Registrar of approved
  decisions, and the Registrar must report back that the decision was implemented. Without this the
  records will not stay consistent.
- **Required revision:** Build a reporting and confirmation layer covering LOA, readmission, AWOL,
  residency and withdrawal.
- **Data or policy needed:** Expected document formats and the confirmation channel.
- **Responsible module:** Registrar communication, reporting.
- **Priority:** P0
- **Current status:** The team acknowledged the report system is not completed.
- **Stakeholder confirmation needed:** Yes.

### 11.2 Separate internal features from Registrar dependent features
- **Problem:** The consultation distinguished features that are purely internal to the Graduate
  School, such as capstone, practicum and defenses, from those that depend on an external office.
- **Required revision:** Document this boundary and reflect it in the interface and the defense
  narration.
- **Data or policy needed:** None.
- **Responsible module:** All.
- **Priority:** P1
- **Current status:** Not documented.
- **Stakeholder confirmation needed:** No.

---

## 12. Research Gate

### 12.1 Eligibility depends on completion data whose source is unverified
- **Problem:** Research Gate checks completed subjects and comprehensive examination completion. The
  team could not confirm where the comprehensive examination result comes from beyond assuming it is
  in the Monitoring Sheet.
- **Required revision:** Identify the official source for comprehensive examination completion and
  for course completion, and show an unavailable state when missing.
- **Data or policy needed:** Confirmed source for comprehensive examination results.
- **Responsible module:** Research Gate.
- **Priority:** P0
- **Current status:** Source unverified. No improvements made since the previous review.
- **Stakeholder confirmation needed:** Yes.

---

## 13. Practicum

### 13.1 Pending revisions were acknowledged but not implemented
- **Problem:** The team stated the Kanban board behavior and related clarifications are still
  pending.
- **Required revision:** Complete the agreed practicum revisions, including the board behavior that
  was clarified during the session.
- **Data or policy needed:** Confirmed practicum responsibilities.
- **Responsible module:** Practicum.
- **Priority:** P1
- **Current status:** Not started.
- **Stakeholder confirmation needed:** Partly.

---

## 14. Graduation

### 14.1 Only fully completed students should appear as graduation candidates
- **Problem:** Students appeared as candidates even when not completed.
- **Required revision:** Show only students confirmed complete on all stages.
- **Data or policy needed:** Completion data.
- **Responsible module:** Graduation.
- **Priority:** P1
- **Current status:** Identified by the team, not yet implemented.
- **Stakeholder confirmation needed:** No.

### 14.2 The graduation screen is cluttered
- **Problem:** The page shows unbatched candidates and detailed counts that add noise.
- **Required revision:** Simplify to a clear completion summary and remove the clutter.
- **Data or policy needed:** None.
- **Responsible module:** Graduation.
- **Priority:** P2
- **Current status:** Identified by the team, not yet implemented.
- **Stakeholder confirmation needed:** No.

---

## 15. Defense scheduling

### 15.1 Google Calendar is not integrated and availability is sample data
- **Problem:** The availability shown comes from dummy data. Calendar integration is not in place.
- **Required revision:** Either complete the integration or clearly disclose that availability is
  sample data. Do not present sample availability as live calendar data.
- **Data or policy needed:** Access to the calendar source, if integration is pursued.
- **Responsible module:** Defense scheduling.
- **Priority:** P1
- **Current status:** Matching works using dummy availability. Integration not started.
- **Stakeholder confirmation needed:** No.

---

## 16. AI and retrieval based generation usage

### 16.1 Do not use retrieval based AI where simple rules suffice
- **Problem:** The LOA example showed retrieval based AI being used to read a letter when a
  structured form plus ordinary rules would be sufficient.
- **Required revision:** Restrict retrieval based AI to cases where unstructured content genuinely
  must be interpreted. Reduce the component elsewhere.
- **Data or policy needed:** The rule values that replace the extraction.
- **Responsible module:** LOA and any other module using the same pattern.
- **Priority:** P0
- **Current status:** Being corrected.
- **Stakeholder confirmation needed:** Yes, for rule values.

### 16.2 Review every other AI touch point for the same problem
- **Problem:** The same pattern may exist in other modules.
- **Required revision:** List every AI assisted feature, state what it interprets, and justify why a
  rule based approach is insufficient.
- **Data or policy needed:** None.
- **Responsible module:** All AI features.
- **Priority:** P1
- **Current status:** Not reviewed.
- **Stakeholder confirmation needed:** No.

---

## 17. Interface and workflow issues

### 17.1 Approval steps did not propagate correctly during the demonstration
- **Problem:** An approval appeared to complete automatically and the next stage did not update as
  expected during the walkthrough.
- **Required revision:** Verify each approval transition and ensure the next stage updates without a
  manual refresh.
- **Data or policy needed:** None.
- **Responsible module:** LOA and shared approval components.
- **Priority:** P1
- **Current status:** Defect observed.
- **Stakeholder confirmation needed:** No.

### 17.2 Report generation is missing across standing change workflows
- **Problem:** Every standing change requires an output for the Registrar and none is produced.
- **Required revision:** Add report generation to LOA, readmission, AWOL, residency and withdrawal.
- **Data or policy needed:** Expected formats.
- **Responsible module:** Reporting.
- **Priority:** P0
- **Current status:** Acknowledged as incomplete.
- **Stakeholder confirmation needed:** Yes.

---

## 18. Demo and defense preparation

### 18.1 Follow the logic of the discussion consistently
- **Problem:** The consultation repeatedly noted that answers did not follow the logic of the
  discussion and that explanations shifted mid conversation.
- **Required revision:** Agree on one explanation per feature covering why it exists, what starts
  it, who acts, what data supports it, what status it produces, and what happens next. Every member
  should give the same answer.
- **Data or policy needed:** None.
- **Responsible module:** Team preparation.
- **Priority:** P0
- **Current status:** Not prepared.
- **Stakeholder confirmation needed:** No.

### 18.2 Do not present unverified sources as confirmed
- **Problem:** Statements about where data comes from were made without confirmation.
- **Required revision:** State clearly which sources are confirmed and which are still pending.
- **Data or policy needed:** Outcome of this stakeholder meeting.
- **Responsible module:** Team preparation.
- **Priority:** P0
- **Current status:** Pending this meeting.
- **Stakeholder confirmation needed:** Yes.

### 18.3 Do not demonstrate known broken paths
- **Problem:** Defects appeared during the walkthrough.
- **Required revision:** Test every account and every scripted action before the defense. If a
  function is incomplete, state the limitation honestly rather than claiming it works.
- **Data or policy needed:** None.
- **Responsible module:** Team preparation.
- **Priority:** P1
- **Current status:** Not completed.
- **Stakeholder confirmation needed:** No.

---

## Summary of the highest priority items

1. Confirm the official enrollment or class list source.
2. Confirm the official grades and subject completion source, including deferred and incomplete.
3. Obtain the deferment policy.
4. Build the Registrar reporting and confirmation loop for LOA, readmission, AWOL, residency and
   withdrawal.
5. Replace the LOA letter and AI extraction with a structured form and ordinary rules.
6. Remove faculty and student grade encoding as official paths.
7. Map every downstream feature to the academic data it requires and define the unavailable state.
