"""Rebuild the requested scenarios in the USLS GS Portal walkthrough.

The supplied DOCX remains the visual template.  Scenarios 1-4 are expanded,
Scenario 5 keeps its detailed source flow with screen-accurate naming and
captions, Scenarios 6-12 remain unchanged, and the old combined Scenario 13 is
replaced by four separate standing-change scenarios.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.shared import Inches, Pt
from docx.table import Table
from docx.text.paragraph import Paragraph


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "Documents" / "USLS GS Portal Demo Walkthrough.docx"
DEFAULT_OUTPUT = (
    ROOT / "Documents" / "USLS GS Portal Demo Walkthrough - Revised.docx"
)
DEFAULT_SCREENSHOTS = ROOT / "outputs" / "walkthrough_screenshots"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument(
        "--screenshots",
        type=Path,
        default=DEFAULT_SCREENSHOTS,
    )
    return parser.parse_args()


def paragraph_with_text(document: Document, text: str) -> Paragraph:
    for paragraph in document.paragraphs:
        if paragraph.text.strip() == text:
            return paragraph
    raise ValueError(f"Paragraph not found: {text}")


def paragraph_starting_with(document: Document, text: str) -> Paragraph:
    for paragraph in document.paragraphs:
        if paragraph.text.strip().startswith(text):
            return paragraph
    raise ValueError(f"Paragraph not found: {text}...")


def paragraph_with_drawing(document: Document) -> Paragraph:
    for paragraph in document.paragraphs:
        if paragraph._p.xpath(".//w:drawing"):
            return paragraph
    raise ValueError("No screenshot paragraph found in the source document.")


def remove_body_range(start: Paragraph, end: Paragraph) -> None:
    current = start._p
    end_element = end._p
    body = current.getparent()
    while current is not None and current != end_element:
        next_element = current.getnext()
        body.remove(current)
        current = next_element


def copy_paragraph_properties(
    source: Paragraph,
    destination: Paragraph,
) -> None:
    destination_pr = destination._p.pPr
    if destination_pr is not None:
        destination._p.remove(destination_pr)
    if source._p.pPr is not None:
        destination._p.insert(0, deepcopy(source._p.pPr))


def add_formatted_run(
    paragraph: Paragraph,
    text: str,
    source_run,
) -> None:
    run = paragraph.add_run(text)
    if source_run is not None and source_run._r.rPr is not None:
        run._r.insert(0, deepcopy(source_run._r.rPr))


def replace_paragraph_text(paragraph: Paragraph, text: str) -> None:
    if paragraph.runs:
        paragraph.runs[0].text = text
        for run in paragraph.runs[1:]:
            run._element.getparent().remove(run._element)
    else:
        paragraph.add_run(text)


def replace_cell_text(cell, value: str) -> None:
    paragraphs = cell.paragraphs
    first_paragraph = paragraphs[0]
    for extra_paragraph in paragraphs[1:]:
        extra_paragraph._element.getparent().remove(extra_paragraph._element)

    runs = first_paragraph.runs
    if runs:
        runs[0].text = str(value)
        for extra_run in runs[1:]:
            extra_run._element.getparent().remove(extra_run._element)
    else:
        first_paragraph.add_run(str(value))


def fill_table(table: Table, rows: list[list[str]]) -> None:
    if not rows:
        raise ValueError("A table requires at least one row.")
    column_count = len(rows[0])
    if any(len(row) != column_count for row in rows):
        raise ValueError("All table rows must have the same number of cells.")
    if len(table.columns) != column_count:
        raise ValueError(
            f"Template has {len(table.columns)} columns, "
            f"but data has {column_count}."
        )

    header_template = deepcopy(table.rows[0]._tr)
    data_template = deepcopy(table.rows[1]._tr)
    for row in list(table.rows):
        table._tbl.remove(row._tr)

    for index, values in enumerate(rows):
        table._tbl.append(
            deepcopy(header_template if index == 0 else data_template)
        )
        for cell, value in zip(table.rows[-1].cells, values):
            replace_cell_text(cell, value)


class Builder:
    def __init__(
        self,
        document: Document,
        marker: Paragraph,
        templates: dict[str, Paragraph],
        table_template: Table,
    ) -> None:
        self.document = document
        self.marker = marker._p
        self.templates = templates
        self.table_template = table_template

    def _insert_paragraph(self, paragraph: Paragraph) -> Paragraph:
        self.marker.addprevious(paragraph._p)
        return paragraph

    def paragraph(
        self,
        kind: str,
        parts: list[tuple[str, int]] | str,
    ) -> Paragraph:
        template = self.templates[kind]
        paragraph = self.document.add_paragraph()
        copy_paragraph_properties(template, paragraph)
        if isinstance(parts, str):
            parts = [(parts, 0)]
        for text, run_index in parts:
            source_run = (
                template.runs[min(run_index, len(template.runs) - 1)]
                if template.runs
                else None
            )
            add_formatted_run(paragraph, text, source_run)
        return self._insert_paragraph(paragraph)

    def heading(
        self,
        text: str,
        *,
        page_break_before: bool = False,
    ) -> None:
        paragraph = self.paragraph("heading", text)
        if page_break_before:
            paragraph.paragraph_format.page_break_before = True

    def label(self, text: str) -> None:
        self.paragraph("label", text)

    def body(self, text: str) -> None:
        self.paragraph("body", text)

    def subheading(self, text: str) -> None:
        self.paragraph("subheading", text)

    def step(self, number: int, text: str) -> None:
        self.paragraph(
            "step",
            [(f"Step {number}.  ", 0), (text, 1)],
        )

    def note(self, text: str) -> None:
        self.paragraph("note", [("Note:  ", 0), (text, 1)])

    def caption(self, text: str) -> None:
        self.paragraph("caption", text)

    def table(self, rows: list[list[str]]) -> None:
        table_element = deepcopy(self.table_template._tbl)
        table = Table(table_element, self.document._body)
        fill_table(table, rows)
        self.marker.addprevious(table_element)

    def picture(self, path: Path) -> None:
        if not path.exists():
            raise FileNotFoundError(path)
        paragraph = self.document.add_paragraph()
        copy_paragraph_properties(self.templates["picture"], paragraph)
        paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
        paragraph.paragraph_format.space_before = Pt(3)
        paragraph.paragraph_format.space_after = Pt(1)
        paragraph.paragraph_format.keep_with_next = True
        paragraph.add_run().add_picture(str(path), width=Inches(6.25))
        self._insert_paragraph(paragraph)


def add_picture_with_caption(
    builder: Builder,
    screenshots: Path,
    filename: str,
    caption: str,
) -> None:
    builder.picture(screenshots / filename)
    builder.caption(f"Screenshot — {caption}")


def build_scenarios_1_to_4(
    builder: Builder,
    screenshots: Path,
) -> None:
    builder.heading(
        "Scenario 1 — Student Handoff, Monitoring Sheet, Students"
    )
    builder.label("Story:")
    builder.body(
        "Graduate School Staff receive the Academic Coordinator's official "
        "monitoring workbook, import it through Student Handoff, reconcile the "
        "result, and verify the same source-backed record in Monitoring Sheet "
        "and Students."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            ["Graduate School Staff", "staff@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            [
                "Monitoring workbook",
                r"Documents\Monitoring_Sheets\MAED_Monitoring_Sheet.xlsx",
            ],
            ["Program", "MAED — Master of Arts in Education"],
            [
                "Verification record",
                "Sofia Reyes — GS-2026-HO-01",
            ],
        ]
    )
    builder.subheading("Part A — Import and reconcile in Student Handoff")
    builder.step(
        1,
        "Sign in as Graduate School Staff and confirm that the left sidebar "
        "shows 1 · Student Handoff under Lifecycle Workflows.",
    )
    builder.step(
        2,
        "Open Student Handoff. Confirm the page title, the Import from "
        "monitoring sheet panel, and the guidance that the official source is "
        "an AC Student Monitoring Excel workbook.",
    )
    builder.step(
        3,
        "Click Browse files and choose the MAED monitoring workbook. The upload "
        "accepts .xlsx or .xlsm in the expected monitoring-sheet format.",
    )
    builder.step(
        4,
        "Verify the selected filename before clicking Import students. Do not "
        "continue if the program or workbook version is not the intended source.",
    )
    builder.step(
        5,
        "Click Import students. Wait for the result panel, then review the added, "
        "updated, skipped, validation, and conflict counts.",
    )
    builder.step(
        6,
        "Open each validation or conflict item. Confirm whether the issue is a "
        "source correction, an identity match, or a duplicate that requires "
        "verified handling.",
    )
    builder.step(
        7,
        "Review Upload history. Confirm the workbook name, import time, counts, "
        "stored version, and the ability to reopen the reconciliation details.",
    )
    builder.step(
        8,
        "If a source value is wrong, correct the authorized workbook and "
        "re-import it. Keep the prior upload as the audit trail; do not rewrite "
        "the imported value directly in the portal.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "student_handoff.png",
        "Student Handoff with the monitoring-workbook importer and source guidance.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "student_handoff_history_populated.png",
        "Student Handoff with the preserved upload-history count and log controls.",
    )

    builder.subheading("Part B — Verify the synchronized Monitoring Sheet")
    builder.step(
        9,
        "Open Monitoring Sheet from Records, select MAED, and select the "
        "semester represented by the imported workbook.",
    )
    builder.step(
        10,
        "Use Progress, Risk, Enrollment, and Sort filters to narrow the grid. "
        "Confirm that the legend distinguishes completed, taken, enrolled, "
        "failed, dropped, and not-taken subjects.",
    )
    builder.step(
        11,
        "Read the synchronization notice and the read-only notice. Enrollment, "
        "approved standing changes, and verified imports update this screen; "
        "the grid itself is not an editing form.",
    )
    builder.step(
        12,
        "Locate Sofia Reyes or another imported record and compare the program, "
        "entry year, year level, enrollment tag, risk, and curriculum statuses "
        "against the source workbook.",
    )
    builder.step(
        13,
        "Use Flag issue only when a discrepancy must be recorded for follow-up. "
        "Add a precise note and keep the source value unchanged until verified.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "monitoring_sheet.png",
        "Monitoring Sheet with program/semester filters, synchronization notice, legend, and read-only curriculum grid.",
    )

    builder.subheading("Part C — Verify the full record in Students")
    builder.step(
        14,
        "Open Students. Use the search box to find Sofia Reyes by student number "
        "GS-2026-HO-01 so the identity match is unambiguous.",
    )
    builder.step(
        15,
        "Review the filtered directory row: student, program, lifecycle stage, "
        "enrollment, standing, risk, comprehensive-exam state, and adviser.",
    )
    builder.step(
        16,
        "Open Sofia's record. Confirm the profile header, program, standing, "
        "enrollment state, progress indicators, curriculum audit, and source "
        "references.",
    )
    builder.step(
        17,
        "Scroll through workflow status, research evidence, activity timeline, "
        "recommended actions, open tasks, panel, and defense schedule. Verify "
        "that no separate shadow record was created by the import.",
    )
    builder.step(
        18,
        "Return to Student Handoff if a mismatch remains, resolve it from the "
        "official source, and repeat the Monitoring Sheet and Students checks.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "students_filtered.png",
        "Students filtered to the Student Handoff demo identity by official student number.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "student_record_detail.png",
        "Students full lifecycle record for Sofia Reyes.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "student_record_activity.png",
        "Students record at the Activity timeline and downstream lifecycle checkpoints.",
    )
    builder.note(
        "Student Handoff is the source-ingestion screen; Monitoring Sheet is the "
        "read-only curriculum view; Students is the complete lifecycle record."
    )

    builder.heading(
        "Scenario 2 — Faculty Profiles, Course Adjustments",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Before enrollment opens, the Academic Coordinator reviews faculty "
        "profiles, examines live subject demand, prepares an offering draft, "
        "routes it for approval, publishes it, and completes the official "
        "faculty, section, and schedule setup."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            ["Academic Coordinator", "academic@usls.edu.ph"],
            ["Dean", "dean@usls.edu.ph"],
            ["Password", "DemoPass123! for both accounts"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Program", "MAED — Master of Arts in Education"],
            ["Planning semester", "AY 2026–2027, 1st Semester"],
            [
                "Faculty",
                "Select a profile whose expertise and availability fit the subject",
            ],
        ]
    )
    builder.subheading("Part A — Review Faculty Profiles")
    builder.step(
        1,
        "Sign in as Academic Coordinator and open Faculty Profiles from Records.",
    )
    builder.step(
        2,
        "Search by faculty name, department, or specialization. Use the "
        "department and availability filters to narrow the list.",
    )
    builder.step(
        3,
        "Compare specialization, login email, account status, availability, and "
        "current panel load in the directory before opening a profile.",
    )
    builder.step(
        4,
        "Open the selected faculty profile. Review specialization keywords, "
        "preferred teaching subjects, contact/login identity, current teaching "
        "and panel assignments, and load limits.",
    )
    builder.step(
        5,
        "Review weekly availability and the calendar-connection status. Treat "
        "profile suggestions as decision support, not an automatic assignment.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "faculty_records.png",
        "Faculty Profiles directory with expertise, account, availability, and workload columns.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "faculty_profile_detail.png",
        "Faculty Profiles detail dialog with specialization, preferred subjects, assignments, and calendar information.",
    )

    builder.subheading("Part B — Build the demand-backed offering draft")
    builder.step(
        6,
        "Open 2 · Course Adjustments and keep the Demand & adjustments tab active.",
    )
    builder.step(
        7,
        "Select MAED and the planning semester. Confirm the plan status shown by "
        "the Draft → Submitted → Approved → Published governance strip.",
    )
    builder.step(
        8,
        "Review Students reviewed, Subjects with need, and Student-subject needs. "
        "These totals are recalculated from the current student records.",
    )
    builder.step(
        9,
        "Read the Subject-needs report. Compare Students needing with Not taken, "
        "then read the named Affected students behind each total.",
    )
    builder.step(
        10,
        "For each proposed subject, review demand, affected students, existing "
        "completion/enrollment evidence, and the delay impact if it is withheld.",
    )
    builder.step(
        11,
        "Mark the selected subject as offered, set the required section count, "
        "choose the faculty after reviewing Faculty Profiles, and add planning notes.",
    )
    builder.step(
        12,
        "Click Save draft. Reopen the plan if necessary and verify that the "
        "subject, section count, faculty choice, and notes were preserved.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_demand.png",
        "Course Adjustments on Demand & adjustments with the governed plan stages.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_impact.png",
        "Course Adjustments Subject-needs report with named affected students.",
    )

    builder.subheading("Part C — Approve, publish, and complete setup")
    builder.step(
        13,
        "Click Submit for approval. Confirm that the draft becomes read-only "
        "while the Dean decision is pending.",
    )
    builder.step(
        14,
        "Sign in as Dean, open the submitted course-adjustment item, review the "
        "evidence and notes, then approve it or return it for revision.",
    )
    builder.step(
        15,
        "Return as Academic Coordinator. If returned, revise and resubmit. If "
        "approved, click Publish so the plan becomes the official offering list.",
    )
    builder.step(
        16,
        "Switch to Offering setup in Course Adjustments. Confirm or complete the "
        "faculty, section, and schedule for every published subject.",
    )
    builder.step(
        17,
        "Click Save and reopen the same program/semester. Verify that only the "
        "published official offerings are available to Enrollment.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_offerings.png",
        "Course Adjustments Offering setup for published faculty, section, and schedule details.",
    )
    builder.note(
        "Faculty matching is advisory. The Academic Coordinator owns the "
        "assignment, the Dean records the approval, and publication controls "
        "what Enrollment can use."
    )

    builder.heading(
        "Scenario 3 — Enrollment, Enrollment Class List, Monitoring Sheet, Students",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "After Course Adjustments publishes the official offerings, Graduate "
        "School Staff enroll a batch from a Registrar class list or enroll one "
        "late student. Both paths synchronize Enrollment Class List, Monitoring "
        "Sheet, Students, and the Student Portal."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            ["Graduate School Staff", "staff@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            [
                "Program / semester",
                "Use the published program and semester from Scenario 2",
            ],
            [
                "Class-list template",
                r"Documents\Stakeholder_Meeting_Prep\Enrollment_Class_List_Template.csv",
            ],
            [
                "Single-student example",
                "Clarissa Dela Cruz — GS-2026-ENR-01",
            ],
        ]
    )
    builder.subheading("Part A — Preview and confirm a class-list import")
    builder.step(
        1,
        "Open 3 · Enrollment and confirm the selected Program and Academic semester.",
    )
    builder.step(
        2,
        "Confirm that the subject list contains only official published offerings "
        "from Course Adjustments.",
    )
    builder.step(
        3,
        "Click Upload class list and select the CSV or XLSX. Student ID and "
        "Subject Code must match portal records; Faculty may be included.",
    )
    builder.step(
        4,
        "In Preview class list, review Rows detected, Ready, Already enrolled, "
        "and Needs review before any record is changed.",
    )
    builder.step(
        5,
        "Read every row result. Resolve unknown students, mismatched programs, "
        "subjects that are not offered, completed subjects, invalid faculty, "
        "and faculty conflicts in the source file.",
    )
    builder.step(
        6,
        "Choose another file after corrections and repeat the preview until the "
        "intended rows are Ready.",
    )
    builder.step(
        7,
        "Click Confirm import. Valid rows are enrolled; rows that still need "
        "review are skipped and remain visible in the result.",
    )
    builder.step(
        8,
        "Record or retain the source reference so the enrollment can be traced "
        "to the Registrar class list.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "enrollment.png",
        "Enrollment with program, semester, student, and synchronization guidance.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "enrollment_class_list_preview.png",
        "Enrollment Preview class list dialog with row-level validation before confirmation.",
    )

    builder.subheading("Part B — Enroll or update one student")
    builder.step(
        9,
        "Return to Enrollment and use Filter the student picker to find Clarissa "
        "Dela Cruz, then select her record.",
    )
    builder.step(
        10,
        "Review the student summary and subject-status totals before selecting "
        "a subject.",
    )
    builder.step(
        11,
        "In Official offered subjects, add only subjects marked Not taken. "
        "Completed or already-enrolled subjects remain locked.",
    )
    builder.step(
        12,
        "Review the conflict check and the draft summary. Remove any subject that "
        "conflicts with the official status or offering.",
    )
    builder.step(
        13,
        "Enter the enrollment source/reference and click Confirm enrollment.",
    )
    builder.step(
        14,
        "For an authorized mid-term status change, click the Enrolled badge, "
        "choose Dropped or Withdrawn, and enter the required effective date and note.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "enrollment_offered_subjects.png",
        "Enrollment Official offered subjects with locked statuses and selectable Not taken subjects.",
    )

    builder.subheading("Part C — Verify all synchronized output screens")
    builder.step(
        15,
        "Open Enrollment Class List, select the same program and semester, and "
        "choose All class lists or one subject.",
    )
    builder.step(
        16,
        "Verify the read-only roster, faculty and section details, student count, "
        "and status. Use Export CSV for the Registrar handoff if required.",
    )
    builder.step(
        17,
        "Open Monitoring Sheet and confirm the same enrolled, dropped, or "
        "withdrawn subject state in the curriculum grid.",
    )
    builder.step(
        18,
        "Open Students and the student's full record. Confirm the enrollment "
        "entry and activity log, then verify the same result in the Student Portal.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "enrollment_class_list.png",
        "Enrollment Class List with synchronized read-only rosters and CSV export.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "monitoring_sheet.png",
        "Monitoring Sheet showing the enrollment-synchronized curriculum state.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "student_record_detail.png",
        "Students full record used to verify the same enrollment outcome and audit trail.",
    )
    builder.note(
        "Enrollment Class List is an output screen. Additions and status changes "
        "must be made in Enrollment or through a confirmed class-list import."
    )

    builder.heading(
        "Scenario 4 — Course Adjustments",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "The Academic Coordinator needs evidence for the next offering decision. "
        "Course Adjustments calculates remaining subject needs and identifies "
        "the students who may be delayed if each subject is not offered."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            ["Academic Coordinator", "academic@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Program", "MAED — Master of Arts in Education"],
            ["Planning semester", "AY 2026–2027, 1st Semester"],
        ]
    )
    builder.subheading("Part A — Read the subject-needs evidence")
    builder.step(
        1,
        "Open Course Adjustments and select Demand & adjustments.",
    )
    builder.step(
        2,
        "Choose MAED and the planning semester. Confirm that the plan and the "
        "demand report refer to the same filters.",
    )
    builder.step(
        3,
        "Read Students reviewed, Subjects with need, and Student-subject needs "
        "to understand the scope of the calculation.",
    )
    builder.step(
        4,
        "In Subject-needs report, compare Students needing with Not taken. "
        "Completed, taken, and current-subject evidence is excluded.",
    )
    builder.step(
        5,
        "Read Affected students. Verify names and student numbers behind the "
        "count instead of making a decision from the total alone.",
    )
    builder.step(
        6,
        "Open the full Students record for a named learner and confirm the "
        "remaining curriculum requirement that caused the need.",
    )
    builder.step(
        7,
        "Return to Course Adjustments and compare high-count subjects with "
        "single-student subjects whose withholding would still cause delay.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_demand.png",
        "Course Adjustments filters, demand summary, and governed offering plan.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_impact.png",
        "Course Adjustments Subject-needs report with counts and named affected students.",
    )

    builder.subheading("Part B — Carry the evidence into the offering plan")
    builder.step(
        8,
        "Mark only the evidence-supported subjects as offered and set the "
        "section count that the affected population requires.",
    )
    builder.step(
        9,
        "Review Faculty Profiles before selecting faculty, then add the planning "
        "reason or constraint in the draft notes.",
    )
    builder.step(
        10,
        "Save the draft and confirm the proposed offering does not replace or "
        "silently alter any student's curriculum status.",
    )
    builder.step(
        11,
        "Follow the Submit for approval → Dean decision → Publish sequence from "
        "Scenario 2.",
    )
    builder.step(
        12,
        "After enrollment activity changes, reopen Course Adjustments and rerun "
        "the same filters to show that the needs are recalculated from current records.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "course_adjustments_offerings.png",
        "Course Adjustments Offering setup after an evidence-backed plan is approved and published.",
    )
    builder.note(
        "The Subject-needs report is deterministic decision support. It does "
        "not automatically offer a subject, assign faculty, or publish the plan."
    )


def caption_scenario_5(
    document: Document,
    templates: dict[str, Paragraph],
) -> None:
    scenario_5 = paragraph_starting_with(document, "Scenario 5 —")
    scenario_6 = paragraph_starting_with(document, "Scenario 6 —")
    replace_paragraph_text(
        scenario_5,
        "Scenario 5 — Subject Withdrawal, Withdrawal Requests, Enrollment",
    )

    captions = [
        "Subject Withdrawal student form with the eligible enrolled subject and penalty-free deadline.",
        "Subject Withdrawal submitted stage and the next GS Staff handoff.",
        "Withdrawal Requests staff queue with the submitted case ready for review.",
        "Withdrawal Requests staff detail before forwarding to the Dean.",
        "Withdrawal Requests Dean review card with the recorded decision controls.",
        "Withdrawal Requests approved decision and return to GS Staff processing.",
        "Withdrawal Requests staff completion workspace and Registrar export step.",
        "Enrollment synchronized subject status after approved withdrawal.",
        "Subject Withdrawal denial-path student request.",
        "Withdrawal Requests denial-path staff review.",
        "Withdrawal Requests denial-path Dean decision.",
        "Subject Withdrawal student status after denial.",
        "Enrollment showing the subject remains enrolled after denial.",
        "Subject Withdrawal completed end-state and preserved activity trail.",
    ]
    pictures: list[Paragraph] = []
    element = scenario_5._p.getnext()
    while element is not None and element != scenario_6._p:
        if element.tag == qn("w:p") and element.xpath(".//w:drawing"):
            pictures.append(Paragraph(element, document._body))
        element = element.getnext()

    for index, picture in enumerate(pictures):
        next_element = picture._p.getnext()
        if next_element is not None and next_element.tag == qn("w:p"):
            next_paragraph = Paragraph(next_element, document._body)
            if next_paragraph.text.strip().startswith("Screenshot —"):
                continue
        caption = document.add_paragraph()
        copy_paragraph_properties(templates["caption"], caption)
        text = (
            captions[index]
            if index < len(captions)
            else f"Scenario 5 workflow checkpoint {index + 1}."
        )
        add_formatted_run(
            caption,
            f"Screenshot — {text}",
            templates["caption"].runs[0]
            if templates["caption"].runs
            else None,
        )
        picture._p.addnext(caption._p)


def scenario_accounts(
    builder: Builder,
    *,
    student: str,
) -> None:
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            ["Student demo", student],
            ["Graduate School Staff", "staff@usls.edu.ph"],
            ["Dean", "dean@usls.edu.ph"],
            ["Password", "DemoPass123! for every account"],
        ]
    )


def build_scenarios_13_to_16(
    builder: Builder,
    screenshots: Path,
) -> None:
    builder.heading(
        "Scenario 13 — Leave of Absence, LOA / Readmission / AWOL",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Daniel Fernandez files a structured two-semester Leave of Absence. "
        "Graduate School Staff run the fixed policy checks and route the case; "
        "the Dean records the decision, and only an approval changes the "
        "student to On Leave / LOA."
    )
    scenario_accounts(
        builder,
        student="Daniel Fernandez — loa.daniel@usls.edu.ph",
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Leave starts", "AY 2026–2027 1st Semester"],
            ["Leave ends", "AY 2026–2027 2nd Semester"],
            ["Reason", "Employment / professional obligation"],
        ]
    )
    builder.subheading("Part A — Student submits in Leave of Absence")
    builder.step(
        1,
        "On the sign-in page, reset Daniel Fernandez's Leave of Absence demo so "
        "the purpose-built account returns to its starting state.",
    )
    builder.step(
        2,
        "Sign in as Daniel and open Leave of Absence from Standalone Processes.",
    )
    builder.step(
        3,
        "Review Current stage and open View stage history. Confirm that the four "
        "stages are Student application, GS Staff review, Dean decision, and result.",
    )
    builder.step(
        4,
        "Choose the Leave starts and Leave ends semesters. The request must begin "
        "in an upcoming semester and may cover one or two consecutive semesters.",
    )
    builder.step(
        5,
        "Choose an allowed Reason category and enter complete Circumstances / "
        "remarks. No PDF or RAG extraction is required for this structured form.",
    )
    builder.step(
        6,
        "Click Submit LOA application and read the confirmation.",
    )
    builder.step(
        7,
        "Reopen Leave of Absence and verify that the request is locked as "
        "submitted, the stage advances to staff review, and withdrawal remains "
        "available only before the Dean decides.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "loa_student_form.png",
        "Leave of Absence structured student application.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "loa_student_form_stage_history.png",
        "Leave of Absence stage history before submission.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "loa_student_submitted.png",
        "Leave of Absence after the student submission advances to GS Staff.",
    )

    builder.subheading("Part B — Staff reviews in Leave of Absence")
    builder.step(
        8,
        "Sign in as Graduate School Staff and open Leave of Absence.",
    )
    builder.step(
        9,
        "Search Daniel Fernandez in Submitted requests and confirm that the card "
        "is in For Review with GS Staff as the next owner.",
    )
    builder.step(
        10,
        "Click Review. Compare the request summary, start/end semesters, reason "
        "category, remarks, prior approved leaves, and minimum residency.",
    )
    builder.step(
        11,
        "Click Run policy checker. Read each deterministic check and the "
        "recommendation; it supports staff review and does not approve the case.",
    )
    builder.step(
        12,
        "Set Eligibility status / check result, add staff notes, and use Apply "
        "suggestion only after verifying that it matches the recorded evidence.",
    )
    builder.step(
        13,
        "Click Forward to Dean. Confirm that the request leaves the staff-review "
        "column and the next owner becomes Dean.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "loa_staff_requests.png",
        "Leave of Absence Submitted requests filtered to Daniel Fernandez.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "loa_staff_policy_review.png",
        "Leave of Absence staff review with the fixed policy checker and Dean-routing action.",
    )

    builder.subheading("Part C — Dean decides in LOA / Readmission / AWOL")
    builder.step(
        14,
        "Sign in as Dean and open LOA / Readmission / AWOL.",
    )
    builder.step(
        15,
        "Search Daniel and review the Leave of Absence request, period, staff "
        "notes, case discussion, and logs.",
    )
    builder.step(
        16,
        "Choose Approve, Deny, or Return for revision. Add the required review "
        "comment when returning the case, then confirm the recorded action.",
    )
    builder.step(
        17,
        "If approved, verify that the student standing becomes On Leave and the "
        "enrollment tag becomes LOA. If denied or returned, verify that standing "
        "does not change.",
    )
    builder.step(
        18,
        "As Graduate School Staff, reopen the approved case and export the LOA "
        "report for the Registrar when required.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "dean_loa_approvals.png",
        "LOA / Readmission / AWOL filtered to Daniel's Leave of Absence decision card.",
    )
    builder.note(
        "The policy checker is advisory. The Dean decision is the only action "
        "that can apply the On Leave / LOA standing change."
    )

    builder.heading(
        "Scenario 14 — Readmission, LOA / Readmission / AWOL",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Therese Lacson is on an approved Leave of Absence and files a separate "
        "Readmission request. Staff verify the future return semester, previous "
        "leave, written intention, and checklist before the Dean decides."
    )
    scenario_accounts(
        builder,
        student="Therese Lacson — readmission.therese@usls.edu.ph",
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Target return", "AY 2026–2027 1st Semester"],
            ["Previous LOA", "AY 2025–2026 1st to 2nd Semester"],
            [
                "Checklist",
                "Mark all four structured readmission requirements",
            ],
        ]
    )
    builder.subheading("Part A — Student submits in Readmission")
    builder.step(
        1,
        "Reset Therese Lacson's Readmission demo from the sign-in page.",
    )
    builder.step(
        2,
        "Sign in as Therese and open Readmission from Standalone Processes.",
    )
    builder.step(
        3,
        "Confirm that the student is On Leave and that Readmission is a separate "
        "return process, not an extension of the LOA form.",
    )
    builder.step(
        4,
        "Choose the Target return semester and the Previous LOA start and end semesters.",
    )
    builder.step(
        5,
        "Enter the intention and readiness to resume studies.",
    )
    builder.step(
        6,
        "Mark Structured return intention completed, Updated study plan "
        "confirmed, Program or adviser consultation completed, and No pending "
        "accountability confirmed.",
    )
    builder.step(
        7,
        "Click Submit readmission request and verify that the next owner becomes "
        "Graduate School Staff.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "readmission_student_form.png",
        "Readmission structured return-semester, prior-LOA, intention, and checklist form.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "readmission_student_submitted.png",
        "Readmission after the student request is submitted for staff review.",
    )

    builder.subheading("Part B — Staff reviews in Readmission")
    builder.step(
        8,
        "Sign in as Graduate School Staff and open Readmission.",
    )
    builder.step(
        9,
        "Search Therese in Submitted requests and open Review.",
    )
    builder.step(
        10,
        "Compare the request summary, Target return semester, Previous LOA "
        "period, Student's return intention, and Eligibility to return checklist.",
    )
    builder.step(
        11,
        "Run the Readmission policy review and read every fixed check. Record "
        "Eligible to Return, Needs Review, Not Eligible, or Pending Requirements.",
    )
    builder.step(
        12,
        "Enter missing requirements and staff notes when applicable. Eligible "
        "and Needs Review cases still require a Dean decision.",
    )
    builder.step(
        13,
        "Click Complete review and confirm that the case is routed to the Dean.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "readmission_staff_requests.png",
        "Readmission Submitted requests filtered to Therese Lacson.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "readmission_staff_policy_review.png",
        "Readmission staff review with policy result, checklist, notes, and Dean routing.",
    )

    builder.subheading("Part C — Dean decides in LOA / Readmission / AWOL")
    builder.step(
        14,
        "Sign in as Dean, open LOA / Readmission / AWOL, and search Therese.",
    )
    builder.step(
        15,
        "Review the return semester, staff eligibility result, missing "
        "requirements, discussion, and logs.",
    )
    builder.step(
        16,
        "Approve, Deny, or Return for revision and confirm the recorded decision.",
    )
    builder.step(
        17,
        "On approval, verify Active standing and Not Enrolled status. Enrollment "
        "remains a separate Academic Coordinator action; export the Readmission "
        "report for the Registrar when required.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "dean_readmission_approvals.png",
        "LOA / Readmission / AWOL filtered to Therese's Readmission decision card.",
    )
    builder.note(
        "Readmission restores eligibility to return; it does not automatically "
        "enroll the student in subjects."
    )

    builder.heading(
        "Scenario 15 — AWOL & Residency, Return from AWOL, LOA / Readmission / AWOL",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Maya Torres is automatically marked AWOL from explicit source evidence. "
        "She submits a structured Return from AWOL declaration; staff apply the "
        "program-specific residence limits and route the case; the Dean records "
        "the return decision."
    )
    scenario_accounts(
        builder,
        student="Maya Torres — awol.maya@usls.edu.ph",
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Target return", "AY 2026–2027 1st Semester"],
            ["Last enrolled", "AY 2025–2026 2nd Semester"],
            [
                "Source",
                "Automatically flagged AWOL standing; no manual declaration",
            ],
        ]
    )
    builder.subheading("Part A — Verify the automatic AWOL case")
    builder.step(
        1,
        "Reset Maya Torres's AWOL demo so the official standing returns to AWOL "
        "Declared with an automatic source.",
    )
    builder.step(
        2,
        "Sign in as Graduate School Staff and open AWOL & Residency.",
    )
    builder.step(
        3,
        "Read the warning that AWOL cannot be declared manually. The system "
        "creates it from an imported AWOL standing or a full-semester withdrawal "
        "without approved LOA; a missing pre-enrollment record alone is insufficient.",
    )
    builder.step(
        4,
        "Search Maya in AWOL, return, and residency cases. Open the case and "
        "verify status, detection source, effective date, and last enrolled semester.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "awol_residency_staff.png",
        "AWOL & Residency with the automatic-AWOL rule and combined case board.",
    )

    builder.subheading("Part B — Student submits in Return from AWOL")
    builder.step(
        5,
        "Sign in as Maya and open Return from AWOL.",
    )
    builder.step(
        6,
        "Confirm the Current AWOL return case and policy classification.",
    )
    builder.step(
        7,
        "Choose the Target return semester and Last enrolled semester.",
    )
    builder.step(
        8,
        "Enter the written intention to resume enrollment and the reason for return.",
    )
    builder.step(
        9,
        "Click Submit return declaration.",
    )
    builder.step(
        10,
        "Reopen Return from AWOL and verify Return Submitted, the saved structured "
        "declaration, and GS Staff as the next owner.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "return_from_awol_student_form.png",
        "Return from AWOL with the automatic case and structured written declaration.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "return_from_awol_student_submitted.png",
        "Return from AWOL after submission to Graduate School Staff.",
    )

    builder.subheading("Part C — Staff reviews in AWOL & Residency")
    builder.step(
        11,
        "Sign in as Graduate School Staff, open AWOL & Residency, and search Maya.",
    )
    builder.step(
        12,
        "Open View and compare the return intention, reason, target return "
        "semester, last enrollment, years in program, and automatic source.",
    )
    builder.step(
        13,
        "Run the Return-from-AWOL policy checker. Review the master's 5-year "
        "normal / 7-year absolute and doctoral 7-year normal / 9-year absolute limits.",
    )
    builder.step(
        14,
        "Read whether the case is within normal residence, needs a graded "
        "6-unit refresher during an extension, or requires full re-enrollment review.",
    )
    builder.step(
        15,
        "Add staff notes and click Forward to Dean.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "awol_staff_cases.png",
        "AWOL & Residency filtered to Maya's submitted return case.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "awol_staff_policy_review.png",
        "AWOL & Residency return-case detail with written intent and fixed residence-limit review.",
    )

    builder.subheading("Part D — Dean decides in LOA / Readmission / AWOL")
    builder.step(
        16,
        "Sign in as Dean, open LOA / Readmission / AWOL, and search Maya.",
    )
    builder.step(
        17,
        "Review the policy classification, years in program, residence limits, "
        "staff notes, discussion, and logs.",
    )
    builder.step(
        18,
        "Choose Approve, Deny, or Return for revision and confirm the decision.",
    )
    builder.step(
        19,
        "Verify the applied result: Active / Not Enrolled within the permitted "
        "period, extension with refresher requirement, or re-enrollment review.",
    )
    builder.step(
        20,
        "As Graduate School Staff, export the AWOL return report for the Registrar. "
        "Course enrollment remains a separate action.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "dean_awol_return_approvals.png",
        "LOA / Readmission / AWOL filtered to Maya's Return from AWOL decision card.",
    )
    builder.note(
        "AWOL is a policy-derived standing. Return from AWOL is the student's "
        "request and Dean decision flow; it is not the Residency workflow."
    )

    builder.heading(
        "Scenario 16 — AWOL & Residency, Monitoring Sheet, Students",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Nicolas Valdez remains academically active without subject enrollment "
        "while completing an allowed research-stage activity. Graduate School "
        "Staff use the separate Residency policy checker, record the semester, "
        "and verify the synchronized Residency status."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role", "Account"],
            [
                "Residency demo student",
                "Nicolas Valdez — residency.nicolas@usls.edu.ph",
            ],
            ["Graduate School Staff", "staff@usls.edu.ph"],
            ["Academic Coordinator", "academic@usls.edu.ph"],
            ["Password", "DemoPass123! for every account"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / instruction"],
            ["Student", "Nicolas Valdez — GS-2026-RES-01"],
            ["Semester", "Current active planning semester"],
            [
                "Purpose",
                "Choose a handbook-supported research/completion purpose",
            ],
        ]
    )
    builder.subheading("Part A — Run the Residency policy check")
    builder.step(
        1,
        "Reset Nicolas Valdez's Residency demo from the sign-in page.",
    )
    builder.step(
        2,
        "Sign in as Graduate School Staff or Academic Coordinator and open "
        "AWOL & Residency.",
    )
    builder.step(
        3,
        "Keep Residency separate from AWOL. Confirm the student is Active and "
        "Not Enrolled, not AWOL, On Leave, Withdrawn, or Completed.",
    )
    builder.step(
        4,
        "In Automatic AWOL alerts and residency, search Valdez and select Nicolas.",
    )
    builder.step(
        5,
        "Choose the Semester and a handbook-supported Residency purpose for "
        "comprehensive examination, practicum, thesis/dissertation, or publication work.",
    )
    builder.step(
        6,
        "Add Staff verification notes when the evidence needs human confirmation.",
    )
    builder.step(
        7,
        "Click Run residency policy checker.",
    )
    builder.step(
        8,
        "Read every deterministic check and the recommendation. Confirm that "
        "Residency does not replace LOA, AWOL, withdrawal, or completed standing.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "residency_policy_review.png",
        "AWOL & Residency with Nicolas selected and the Residency policy review displayed.",
    )

    builder.subheading("Part B — Record and verify Residency")
    builder.step(
        9,
        "Click Record residency only after the checker and evidence support the action.",
    )
    builder.step(
        10,
        "Read the success result. Confirm that term enrollment and monitoring "
        "were updated together.",
    )
    builder.step(
        11,
        "In AWOL, return, and residency cases, search Nicolas and verify the "
        "Residency card, semester, purpose, and policy status.",
    )
    builder.step(
        12,
        "Open View. Confirm the active Residency status and the Registrar report control.",
    )
    builder.step(
        13,
        "Open Monitoring Sheet and verify the Residency enrollment tag for the "
        "selected semester.",
    )
    builder.step(
        14,
        "Open Students, search Valdez, and verify Residency in the directory row.",
    )
    builder.step(
        15,
        "Open Nicolas's full record and confirm Active standing, Residency "
        "enrollment, the term record, and the activity entry.",
    )
    builder.step(
        16,
        "Export the Residency report for the Registrar when required.",
    )
    builder.step(
        17,
        "When the period ends, reopen the Residency case and click Close "
        "residency. Verify the student returns to the appropriate active enrollment state.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "residency_recorded.png",
        "AWOL & Residency immediately after the Residency record is saved.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "residency_case_detail.png",
        "AWOL & Residency detail for Nicolas's active Residency, including the Registrar export and Close residency action.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "residency_students_sync.png",
        "Students filtered to Nicolas after the Residency synchronization.",
    )
    add_picture_with_caption(
        builder,
        screenshots,
        "residency_student_record.png",
        "Students full record showing the synchronized Residency state and audit trail.",
    )
    builder.note(
        "Residency is a valid active no-subject enrollment state for approved "
        "academic work. A student with remaining course units who will stop "
        "studying should use the appropriate Leave of Absence process."
    )


def set_core_properties(document: Document) -> None:
    document.core_properties.title = (
        "USLS Graduate School Lifecycle Portal — Demonstration Walkthrough & Demo Kit"
    )
    document.core_properties.subject = (
        "Expanded Scenarios 1–5 and separate Leave of Absence, Readmission, "
        "AWOL return, and Residency scenarios."
    )
    document.core_properties.comments = (
        "Rebuilt from the supplied walkthrough with live, screen-accurate "
        "portal screenshots and separate standing-change scenarios."
    )


def main() -> None:
    args = parse_args()
    source = args.source.resolve()
    output = args.output.resolve()
    screenshots = args.screenshots.resolve()
    if source == output:
        raise ValueError("The output must not overwrite the source document.")
    if not source.exists():
        raise FileNotFoundError(source)
    output.parent.mkdir(parents=True, exist_ok=True)

    document = Document(source)
    for stale_prefix in (
        "Assigned-scenario coverage",
        "The matrix below confirms where each requested screen or workflow is demonstrated.",
    ):
        try:
            stale = paragraph_starting_with(document, stale_prefix)
        except ValueError:
            continue
        stale._element.getparent().remove(stale._element)

    templates = {
        "heading": paragraph_starting_with(document, "Scenario 1 —"),
        "label": paragraph_with_text(document, "Story:"),
        "body": paragraph_starting_with(
            document,
            "At the start of the term break",
        ),
        "step": paragraph_starting_with(document, "Step 1."),
        "note": paragraph_starting_with(document, "Note:"),
        "caption": paragraph_starting_with(document, "Screenshot —"),
        "subheading": paragraph_with_text(
            document,
            "Path A — Upload a class list",
        ),
        "picture": paragraph_with_drawing(document),
    }
    table_template = document.tables[2]

    scenario_1 = paragraph_starting_with(document, "Scenario 1 —")
    scenario_5 = paragraph_starting_with(document, "Scenario 5 —")
    remove_body_range(scenario_1, scenario_5)
    build_scenarios_1_to_4(
        Builder(document, scenario_5, templates, table_template),
        screenshots,
    )

    caption_scenario_5(document, templates)

    scenario_13 = paragraph_starting_with(document, "Scenario 13 —")
    limitations = paragraph_starting_with(document, "7.")
    remove_body_range(scenario_13, limitations)
    build_scenarios_13_to_16(
        Builder(document, limitations, templates, table_template),
        screenshots,
    )

    for paragraph in document.paragraphs:
        if paragraph.text.strip().startswith(
            "Process standing changes:"
        ):
            replace_paragraph_text(
                paragraph,
                "Process standing changes as separate workflows: subject "
                "withdrawal, leave of absence, readmission, return from AWOL, "
                "and residency.",
            )
            break

    set_core_properties(document)
    document.save(output)
    print(output)


if __name__ == "__main__":
    main()
