# Stakeholder Meeting Preparation: Sir de Paula

Prepared by the Graduate School Lifecycle Monitoring capstone team.

Purpose: confirm the official source of enrollment and academic result data. The two attached
templates are proposals used to clarify what data can actually be obtained. They are not
proposed university formats and we are not asking anyone to adopt our exact columns.

---

## Output 1: Short meeting script

> Sir, after implementing Student Handoff using the Monitoring Sheet, we realized that it already
> covers the student information we need, so we are not asking for another student list.
>
> However, our Enrollment and Course Adjustment modules need information that is not in the sheet.
> The sheet shows completed units, but it does not show which subjects a student is currently
> enrolled in, or what happened to each enrollment, such as dropped, deferred, failed, or withdrawn.
>
> We prepared two sample templates only to make the required data concrete. Would something similar
> already be available from AIMS, from the Registrar, or from existing class lists? If not, what
> official report should our system use?
>
> We are also trying to confirm one more thing. When the Graduate School approves a leave of absence,
> a readmission, or a withdrawal, what does the Registrar send back so we know it was implemented?

Keep the spoken part to the above. Use the checklist below to capture answers.

---

## Output 2: Dataset confirmation checklist

### A. Existing Monitoring Sheet

Already covered and should not be duplicated:

- Student ID number
- Student name
- Program
- Academic Year entry
- Curriculum subjects
- Completed units
- Other student profile information already present in the sheet

Confirm with Sir de Paula:

- Does the Monitoring Sheet remain the official source for the items listed above?
- Is the Monitoring Sheet the official source for comprehensive examination completion, or does that
  come from another record?
- Who prepares the Monitoring Sheet, and how often is it updated?
- Is there any field in the sheet that we should not treat as official?

State clearly during the meeting: we are not requesting another student master list.

### B. Enrollment or class list dataset

Confirm whether an official export or report can provide:

- Academic Year
- Term or Semester
- Student ID
- Student Name
- Program
- Subject Code
- Subject Title
- Section
- Faculty
- Schedule
- Units
- Enrollment Status
- Status Effective Date
- Remarks

Enrollment Status should distinguish, where applicable:

- Enrolled
- In Progress
- Dropped
- Withdrawn
- Cancelled
- Completed

Questions to ask:

- Can AIMS export a class list?
- Can the Registrar provide an enrollment report?
- Can faculty class lists serve as an official source?
- Can an updated list be obtained after the course adjustment period?
- How often can the file be obtained?
- Does the file include students who enrolled late?
- Does it show students who dropped after initial enrollment?
- Does it preserve previous semester enrollment history?

### C. Grades or subject completion dataset

Confirm whether an official export or report can provide:

- Academic Year
- Term or Semester
- Student ID
- Student Name
- Program
- Subject Code
- Subject Title
- Units
- Official Grade
- Completion Status
- Deferred or Incomplete completion deadline
- Result Posting Date
- Remarks

Completion Status should distinguish:

- Passed
- Failed
- Deferred
- Incomplete
- Dropped
- Withdrawn
- In Progress
- No Grade Posted

Questions to ask:

- Where are deferred or incomplete grades officially recorded?
- How do we know whether a deferred subject was later completed?
- What happens if the student does not complete the deferred subject within the allowed period?
- How are failed subjects identified?
- Are dropped subjects included in the grade report, the enrollment report, or another report?
- When are official grades available?
- Are grade corrections included in later exports?
- Can the latest file update a previous result while preserving audit history?

### D. Source of truth

For each item, record whether the official source is the Monitoring Sheet, AIMS, a Registrar export,
a faculty class list, a Graduate School record, or another official document.

| Item | Confirmed official source | Notes |
|---|---|---|
| Student identity | | |
| Program | | |
| Current enrollment | | |
| Previous semester enrollment | | |
| Dropped subjects | | |
| Withdrawn subjects | | |
| Deferred or incomplete subjects | | |
| Failed subjects | | |
| Passed subjects | | |
| Official grades | | |
| Subject completion | | |
| Comprehensive examination completion | | |
| Research Gate eligibility inputs | | |
| Practicum eligibility inputs | | |
| Graduation eligibility inputs | | |

### E. File process

- Who prepares the file?
- Who receives it?
- When is it produced?
- Is it generated before the term, during the term break, after the adjustment period, or after
  grades are posted?
- Is there one file per program, per subject, per class, per semester, or per academic year?
- Is it Excel or CSV?
- Can the column structure remain consistent between releases?
- Can the system store multiple versions of the same dataset?
- Should a later file overwrite existing data or create an updated version?
- How should discrepancies be reported?
- Who confirms whether a discrepancy is resolved?
- How should the application record the source and the import date?

### F. Registrar feedback loop

The consultation described this as a two way exchange. Confirm:

- When the Graduate School approves a leave of absence, a readmission, an AWOL tagging, a residency
  case, or a withdrawal, what document does the Registrar expect to receive?
- What does the Registrar send back to confirm that the decision was implemented?
- Who is responsible for confirming implementation in our system?

---

## Attached files

- `GS_Data_Requirements_Templates.xlsx` with three sheets: Enrollment Class List, Grades Completion
  List, and Field Confirmation Checklist.
- `Enrollment_Class_List_Template.csv`
- `Grades_Completion_List_Template.csv`

The Field Confirmation Checklist sheet can be filled in directly during the meeting.
