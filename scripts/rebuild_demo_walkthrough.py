"""Rebuild the assigned scenarios in the USLS demo walkthrough.

The original DOCX is treated as the visual template. Scenarios 1-4 and 8 are
replaced with verified content and current screenshots; Scenarios 5-7 and the
rest of the document remain untouched.
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Inches, Pt
from docx.table import Table
from docx.text.paragraph import Paragraph
from docx.oxml.ns import qn


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "Documents" / "USLS_GS_Portal_Demo_Walkthrough.docx"
DEFAULT_OUTPUT = (
    ROOT / "Documents" / "USLS_GS_Portal_Demo_Walkthrough_Updated.docx"
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


def paragraph_with_text(doc: Document, text: str) -> Paragraph:
    for paragraph in doc.paragraphs:
        if paragraph.text.strip() == text:
            return paragraph
    raise ValueError(f"Paragraph not found: {text}")


def paragraph_starting_with(doc: Document, text: str) -> Paragraph:
    for paragraph in doc.paragraphs:
        if paragraph.text.strip().startswith(text):
            return paragraph
    raise ValueError(f"Paragraph not found: {text}...")


def paragraph_with_drawing(doc: Document) -> Paragraph:
    for paragraph in doc.paragraphs:
        if paragraph._p.xpath(".//w:drawing"):
            return paragraph
    raise ValueError("No screenshot paragraph found in source document.")


def remove_body_range(start: Paragraph, end: Paragraph) -> None:
    current = start._p
    end_element = end._p
    body = current.getparent()
    while current is not None and current != end_element:
        next_element = current.getnext()
        body.remove(current)
        current = next_element


def copy_paragraph_properties(source: Paragraph, destination: Paragraph) -> None:
    destination_pr = destination._p.pPr
    if destination_pr is not None:
        destination._p.remove(destination_pr)
    if source._p.pPr is not None:
        destination._p.insert(0, deepcopy(source._p.pPr))


def add_formatted_run(paragraph: Paragraph, text: str, source_run) -> None:
    run = paragraph.add_run(text)
    if source_run is not None and source_run._r.rPr is not None:
        run._r.insert(0, deepcopy(source_run._r.rPr))


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
            f"Template has {len(table.columns)} columns, data has {column_count}."
        )

    header_template = deepcopy(table.rows[0]._tr)
    data_template = deepcopy(table.rows[1]._tr)
    for row in list(table.rows):
        table._tbl.remove(row._tr)

    for index, values in enumerate(rows):
        table._tbl.append(
            deepcopy(header_template if index == 0 else data_template)
        )
        new_row = table.rows[-1]
        for cell, value in zip(new_row.cells, values):
            replace_cell_text(cell, value)


def update_demo_student_table(table: Table) -> None:
    fill_table(
        table,
        [
            ["Student", "Student No.", "Email", "Ready for"],
            [
                "Miguel Yu",
                "2260004",
                "student@usls.edu.ph",
                "Research, Panel, Defense",
            ],
            [
                "Sofia Reyes",
                "GS-2026-HO-01",
                "handoff.sofia@usls.edu.ph",
                "Complete student handoff",
            ],
            [
                "Anton Bautista",
                "GS-2026-HO-02",
                "anton.bautista@student.usls.edu.ph",
                "Handoff follow-up",
            ],
            [
                "Lianne Mercado",
                "GS-2026-CA-01",
                "adjustments.lianne@usls.edu.ph",
                "Course-demand example",
            ],
            [
                "Roberto Aquino",
                "GS-2026-CA-02",
                "roberto.aquino@student.usls.edu.ph",
                "Focused subject needs",
            ],
            [
                "Clarissa Dela Cruz",
                "GS-2026-ENR-01",
                "enrollment.clarissa@usls.edu.ph",
                "Single-student enrollment",
            ],
            [
                "Martin Gonzales",
                "GS-2026-ENR-02",
                "enrollment.martin@usls.edu.ph",
                "Offered-subject enrollment",
            ],
            [
                "Elena Navarro",
                "GS-2026-WD-01",
                "withdrawal.elena@usls.edu.ph",
                "Subject withdrawal (MAED-MAJ1)",
            ],
            [
                "Joshua Lim",
                "GS-2026-WD-02",
                "withdrawal.joshua@usls.edu.ph",
                "Subject withdrawal (MAED-MAJ2)",
            ],
            [
                "Andrea Villanueva",
                "GS-2026-PRAC-01",
                "practicum.andrea@usls.edu.ph",
                "Practicum",
            ],
            [
                "Bianca Santos",
                "GS-2026-GRAD-01",
                "graduation.bianca@usls.edu.ph",
                "Graduation application",
            ],
            [
                "Maureen Castillo",
                "GS-2026-LOA-01",
                "maureen.castillo@student.usls.edu.ph",
                "One-semester Leave of Absence",
            ],
            [
                "Daniel Fernandez",
                "GS-2026-LOA-02",
                "loa.daniel@usls.edu.ph",
                "Two-semester LOA policy check",
            ],
            [
                "Therese Lacson",
                "GS-2026-READ-01",
                "readmission.therese@usls.edu.ph",
                "Readmission after approved LOA",
            ],
            [
                "Gabriel Domingo",
                "GS-2026-READ-02",
                "readmission.gabriel@usls.edu.ph",
                "Readmission policy checks",
            ],
            [
                "Maya Torres",
                "GS-2026-AWOL-01",
                "awol.maya@usls.edu.ph",
                "Return from automatic AWOL",
            ],
            [
                "Nicolas Valdez",
                "GS-2026-RES-01",
                "residency.nicolas@usls.edu.ph",
                "Residency policy review",
            ],
        ],
    )


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

    def heading(self, text: str, *, page_break_before: bool = False) -> None:
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


def build_scenarios_1_to_4(builder: Builder, screenshots: Path) -> None:
    builder.subheading("Assigned-scenario coverage")
    builder.body(
        "The matrix below confirms where each requested screen or workflow is "
        "demonstrated. The detailed steps then follow the same sequence as the portal."
    )
    builder.table(
        [
            ["Scenario", "Screens / workflows covered"],
            [
                "1",
                "Student Handoff; Monitoring Sheet; Students directory and full student record",
            ],
            [
                "2",
                "Faculty Profiles; Course Adjustments — Demand & adjustments; Offering setup",
            ],
            [
                "3",
                "Enrollment; class-list import preview; Enrollment Class List; record synchronization",
            ],
            [
                "4",
                "Subject-needs report; affected students; delay impact",
            ],
            [
                "8",
                "Leave of Absence; Readmission; automatic AWOL; Return from AWOL; Residency",
            ],
        ]
    )

    builder.heading(
        "Scenario 1 — Import, reconcile, and verify the monitoring records"
    )
    builder.label("Story:")
    builder.body(
        "At the start of the term break, Graduate School Staff receive the Academic "
        "Coordinator monitoring workbook. Grace Fernandez imports it, checks the "
        "reconciliation result, and verifies that the Monitoring Sheet and Student "
        "Records show the same official source data."
    )
    builder.label("Log in as:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            ["Account type", "Graduate School Staff"],
            ["Email", "staff@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            [
                "Monitoring workbook",
                r"Documents\Monitoring_Sheets\MAED_Monitoring_Sheet.xlsx",
            ],
            [
                "Handoff demo records",
                "Sofia Reyes (complete) and Anton Bautista (follow-up)",
            ],
            [
                "Verification path",
                "Student Handoff → Monitoring Sheet → Students",
            ],
        ]
    )
    builder.label("Steps:")
    builder.step(1, "From the sidebar, open 1 · Student Handoff.")
    builder.step(
        2,
        "Click Browse files under Import from monitoring sheet, select the MAED "
        "workbook, then click Import students.",
    )
    builder.step(
        3,
        "Review the import summary and validation items. Existing students are "
        "updated, genuinely new students are added, and conflicting or incomplete "
        "source rows remain visible for reconciliation.",
    )
    builder.step(
        4,
        "Review Upload history. Each workbook version is preserved with its time, "
        "file name, counts, validation result, and conflict record.",
    )
    builder.step(
        5,
        "Open Monitoring Sheet. Choose MAED and the relevant semester, use the "
        "progress/risk/enrollment filters, and verify the read-only curriculum grid. "
        "Use Flag issue to record a discrepancy without overwriting the source.",
    )
    builder.step(
        6,
        "Open Students, search for Sofia Reyes or Anton Bautista, and open the full "
        "student record. Verify identity, program, standing, enrollment, coursework, "
        "tasks, activity, and source references.",
    )
    builder.step(
        7,
        "If an official value is wrong, correct it in the authorized source and "
        "re-import the workbook; do not manually rewrite the imported value here.",
    )
    builder.note(
        "The Monitoring Sheet is operationally read-only. Enrollment, approved "
        "standing changes, and verified imports update it automatically."
    )
    builder.picture(screenshots / "student_handoff.png")
    builder.caption(
        "Screenshot — Student Handoff showing the monitoring-sheet importer and upload-history panel."
    )
    builder.picture(screenshots / "monitoring_sheet.png")
    builder.caption(
        "Screenshot — The read-only Monitoring Sheet with program, semester, progress, risk, and enrollment filters."
    )
    builder.picture(screenshots / "student_records.png")
    builder.caption(
        "Screenshot — Student Records, where staff can search the directory and open a complete lifecycle record."
    )

    builder.heading(
        "Scenario 2 — Review faculty records and set up semester offerings",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Before enrollment opens, Academic Coordinator Dr. Ramon Alvarez reviews "
        "faculty profiles, studies live subject demand, decides what to offer, routes "
        "the plan for approval, publishes it, and completes each offering's faculty, "
        "schedule, and section."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            ["Coordinator", "academic@usls.edu.ph"],
            ["Approver", "dean@usls.edu.ph"],
            ["Password", "DemoPass123! for both accounts"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            ["Program", "MAED — Master of Arts in Education"],
            ["Planning semester", "AY 2026–2027, 1st Semester (Current)"],
            ["Subject", "Choose a MAED subject surfaced by the demand report"],
            ["Schedule", "Example: Saturday, 8:00–11:00"],
            ["Faculty", "Choose after reviewing the faculty profile and workload"],
        ]
    )
    builder.label("Steps:")
    builder.step(
        1,
        "Open Faculty. Search for a faculty member, open the profile, and review "
        "specialization, preferred teaching subjects, login email, current load, "
        "weekly availability, and calendar source.",
    )
    builder.step(
        2,
        "Open 2 · Course Adjustments and stay on Demand & adjustments. Select MAED "
        "and the planning semester.",
    )
    builder.step(
        3,
        "Review the automatically calculated subject needs and affected-student "
        "counts. These figures support the decision; they do not publish a subject "
        "or assign faculty automatically.",
    )
    builder.step(
        4,
        "Mark the chosen subjects as offered, set the section count and faculty "
        "choice, then click Save draft.",
    )
    builder.step(
        5,
        "Click Submit for approval. Sign in as the Dean to approve or return the "
        "plan, then return as the Academic Coordinator and click Publish after "
        "approval.",
    )
    builder.step(
        6,
        "Switch to Offering setup. Complete or confirm the assigned faculty, "
        "schedule, and section for each published subject, then click Save.",
    )
    builder.note(
        "Faculty suggestions and preferences are advisory. The Academic Coordinator "
        "owns the final assignment, and only published official offerings become "
        "available in Enrollment."
    )
    builder.picture(screenshots / "faculty_records.png")
    builder.caption(
        "Screenshot — Faculty Profiles, including searchable expertise, login, workload, preferred subjects, and availability."
    )
    builder.picture(screenshots / "course_adjustments_demand.png")
    builder.caption(
        "Screenshot — Course Adjustments on Demand & adjustments, showing the governed Draft → Submitted → Approved → Published flow."
    )
    builder.picture(screenshots / "course_adjustments_offerings.png")
    builder.caption(
        "Screenshot — Offering setup, where the published subject's faculty, schedule, and section are completed."
    )

    builder.heading(
        "Scenario 3 — Enroll students and verify the synchronized class list"
    )
    builder.label("Story:")
    builder.body(
        "After the offering plan is published, staff can enroll a batch from a "
        "Registrar class list or add one late student. Both paths use the same "
        "official offerings and synchronize the Enrollment Class List, Monitoring "
        "Sheet, Student Record, and Student Portal."
    )
    builder.label("Log in as:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            ["Account type", "Graduate School Staff"],
            ["Email", "staff@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Data to use:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            [
                "Program / semester",
                "Use the same published program and semester from Scenario 2",
            ],
            [
                "Class-list template",
                r"Documents\Stakeholder_Meeting_Prep\Enrollment_Class_List_Template.csv",
            ],
            [
                "Required matching fields",
                "Student ID and Subject Code; Faculty may be included",
            ],
            [
                "Single-student demo",
                "Clarissa Dela Cruz — GS-2026-ENR-01",
            ],
        ]
    )
    builder.subheading("Path A — Upload a class list")
    builder.step(
        1,
        "Open 3 · Enrollment and confirm the Program and Academic semester.",
    )
    builder.step(
        2,
        "Click Upload class list and choose a CSV or XLSX whose Student ID and "
        "Subject Code match the published offering. Adjust the supplied template "
        "to the semester being demonstrated.",
    )
    builder.step(
        3,
        "Review the preview. Check matched rows, unknown students, subjects that "
        "are not offered, already-completed subjects, invalid faculty, and faculty "
        "conflicts before changing any record.",
    )
    builder.step(
        4,
        "Click Confirm import. Matched rows are enrolled and the source reference "
        "is recorded.",
    )
    builder.step(
        5,
        "Open Enrollment Class List. Select the program, semester, and All class "
        "lists or a single subject. Verify the read-only roster and use Export CSV "
        "if a Registrar handoff is needed.",
    )
    builder.subheading("Path B — Search and enroll one student")
    builder.step(
        6,
        "Return to Enrollment, use Filter the student picker to find Clarissa Dela "
        "Cruz, and select her record.",
    )
    builder.step(
        7,
        "Select only official offered subjects that are marked Not taken, review "
        "the automatic conflict checks, enter the source/reference, and click "
        "Confirm enrollment.",
    )
    builder.step(
        8,
        "For a mid-term change, click an enrolled subject's status badge, choose "
        "Dropped or Withdrawn, and provide the required effective date and note.",
    )
    builder.step(
        9,
        "Re-open Enrollment Class List, Monitoring Sheet, and the student's full "
        "record to confirm that the same enrollment result appears on every screen.",
    )
    builder.note(
        "Enrollment Class List is a read-only output. All enrollment additions and "
        "status changes must be made in Enrollment or through a confirmed class-list import."
    )
    builder.picture(screenshots / "enrollment.png")
    builder.caption(
        "Screenshot — Enrollment showing a seeded program example with official offerings, student status checks, and a conflict-checked draft."
    )
    builder.picture(screenshots / "enrollment_class_list.png")
    builder.caption(
        "Screenshot — Enrollment Class List showing enrollment-synchronized, read-only class rosters and CSV export."
    )

    builder.heading(
        "Scenario 4 — See which subjects are needed and who will be affected"
    )
    builder.label("Story:")
    builder.body(
        "The Academic Coordinator needs evidence for the next offering decision. "
        "The Subject-needs report calculates remaining requirements from current "
        "student records and identifies each student who may be delayed if a subject "
        "is withheld."
    )
    builder.label("Log in as:")
    builder.table(
        [
            ["Field", "Value / Instruction"],
            ["Account type", "Academic Coordinator"],
            ["Email", "academic@usls.edu.ph"],
            ["Password", "DemoPass123!"],
        ]
    )
    builder.label("Steps:")
    builder.step(
        1,
        "Open 2 · Course Adjustments and select Demand & adjustments.",
    )
    builder.step(
        2,
        "Choose the Program and planning semester. Review Students reviewed, "
        "Subjects with need, and Student-subject needs.",
    )
    builder.step(
        3,
        "In the Subject-needs report, compare Students needing with Not taken. "
        "Completed, taken, and currently enrolled subjects are excluded.",
    )
    builder.step(
        4,
        "Read the Affected students column for the names, student numbers, and "
        "delay impact behind the count. A single student need is enough to surface "
        "a subject.",
    )
    builder.step(
        5,
        "Use the evidence to revise the offering draft, then follow the "
        "submit → Dean approval → publish sequence from Scenario 2.",
    )
    builder.note(
        "The report is recalculated from current records; it is decision support, "
        "not an automatic offering or faculty assignment."
    )
    builder.picture(screenshots / "course_adjustments_impact.png")
    builder.caption(
        "Screenshot — The Subject-needs report with counts and the named affected students behind each offering decision."
    )


def build_scenario_8(builder: Builder, screenshots: Path) -> None:
    builder.heading(
        "Scenario 8 — Standing changes: LOA, Readmission, AWOL return, and Residency",
        page_break_before=True,
    )
    builder.label("Story:")
    builder.body(
        "Standing changes are separate governed flows. Leave of Absence pauses an "
        "active student; Readmission restores a student after approved LOA; AWOL is "
        "created automatically from explicit source evidence; Return from AWOL "
        "requires written intent and a Dean decision; and Residency records valid "
        "academic work without subjects."
    )
    builder.label("Accounts used:")
    builder.table(
        [
            ["Role / demo record", "Account"],
            ["LOA student", "Daniel Fernandez — loa.daniel@usls.edu.ph"],
            [
                "Readmission student",
                "Therese Lacson — readmission.therese@usls.edu.ph",
            ],
            ["AWOL return student", "Maya Torres — awol.maya@usls.edu.ph"],
            [
                "Residency record",
                "Nicolas Valdez — residency.nicolas@usls.edu.ph",
            ],
            ["Graduate School Staff", "staff@usls.edu.ph"],
            ["Academic Coordinator", "academic@usls.edu.ph"],
            ["Dean / approver", "dean@usls.edu.ph"],
            ["Password", "DemoPass123! for every account"],
        ]
    )

    builder.subheading("Part A — Leave of Absence")
    builder.step(
        1,
        "As Daniel Fernandez, open Leave of Absence and enter the effective start "
        "semester, effective end semester, reason category, and remarks. Submit the "
        "structured application.",
    )
    builder.step(
        2,
        "As Graduate School Staff, open Leave of Absence, select the submitted "
        "request, run the deterministic policy checker, and review the requested "
        "period, reason, prior approved leaves, and minimum residency.",
    )
    builder.step(
        3,
        "Complete the staff review and forward the request to the Dean. A policy "
        "recommendation supports the review but does not approve the request.",
    )
    builder.step(
        4,
        "As the Dean, open LOA / Readmission / AWOL and approve, deny, or return "
        "the case. Approval changes the student to On Leave / LOA and enables the "
        "Registrar report.",
    )
    builder.picture(screenshots / "loa_student_form.png")
    builder.caption(
        "Screenshot — The student's structured Leave of Absence application and timeline."
    )
    builder.picture(screenshots / "loa_staff_review.png")
    builder.caption(
        "Screenshot — The staff Leave of Absence review workspace with policy checks and routed cases."
    )

    builder.subheading("Part B — Readmission after approved LOA")
    builder.step(
        5,
        "As Therese Lacson, open Readmission. Choose the return semester and "
        "previous LOA start/end, state the intention and readiness to resume, tick "
        "all four checklist items, and submit.",
    )
    builder.step(
        6,
        "As Graduate School Staff, open Readmission, run the fixed policy review, "
        "record eligibility and missing requirements, then complete the review. "
        "Eligible and Needs Review cases are still routed to the Dean.",
    )
    builder.step(
        7,
        "As the Dean, approve, deny, or return the request. Approval restores "
        "Active standing with Not Enrolled status; course enrollment remains a "
        "separate Academic Coordinator action. Export the Registrar report if needed.",
    )
    builder.picture(screenshots / "readmission_student_form.png")
    builder.caption(
        "Screenshot — Readmission with return-semester fields, prior LOA period, written intention, and required checklist."
    )
    builder.picture(screenshots / "readmission_staff_review.png")
    builder.caption(
        "Screenshot — The staff Readmission review, policy result, requirements, notes, and Dean-routing action."
    )

    builder.subheading("Part C — Automatic AWOL and Return from AWOL")
    builder.step(
        8,
        "Open AWOL & Residency as Staff or Academic Coordinator. Show that AWOL "
        "cannot be declared manually: the system creates the case only from an "
        "imported AWOL standing or a full-semester withdrawal without approved LOA.",
    )
    builder.step(
        9,
        "As Maya Torres, open Return from AWOL. Confirm the automatically flagged "
        "case, choose the intended return semester and last enrolled semester, enter "
        "the written intention and return reason, then submit the declaration.",
    )
    builder.step(
        10,
        "As Graduate School Staff, open the AWOL / Return case, run the return "
        "policy checker, review years in program and the master's 5/7-year or "
        "doctoral 7/9-year residence limits, then forward the declaration to the Dean.",
    )
    builder.step(
        11,
        "As the Dean, approve, deny, or return the declaration. Approval may restore "
        "Active / Not Enrolled, require a graded 6-unit refresher during the "
        "extension, or route full re-enrollment review when the absolute limit is exceeded.",
    )
    builder.picture(screenshots / "return_from_awol_student_form.png")
    builder.caption(
        "Screenshot — Return from AWOL showing the automatic source flag and the structured written declaration."
    )
    builder.picture(screenshots / "dean_standing_approvals.png")
    builder.caption(
        "Screenshot — The Dean's LOA / Readmission / AWOL approval queue; routed cases appear here for a recorded decision."
    )

    builder.subheading("Part D — Residency without subjects")
    builder.step(
        12,
        "As Graduate School Staff or Academic Coordinator, open AWOL & Residency, "
        "select Nicolas Valdez, choose the semester and a handbook-supported purpose, "
        "and run the residency policy checker.",
    )
    builder.step(
        13,
        "Confirm that the student is active, has no subject enrollment, and is "
        "continuing a permitted comprehensive-exam, practicum, thesis/dissertation, "
        "or publication activity. Add verification notes when human review is required.",
    )
    builder.step(
        14,
        "Click Record residency. Verify the active Residency tag in the monitoring "
        "and term-enrollment records, export the Registrar report if needed, and use "
        "Close residency when the period ends.",
    )
    builder.note(
        "Residency is not a substitute for LOA, AWOL, withdrawal, or completed "
        "standing. A student with remaining course units who will not enroll should "
        "use the appropriate LOA process."
    )
    builder.picture(screenshots / "awol_residency_staff.png")
    builder.caption(
        "Screenshot — AWOL & Residency showing automatic-AWOL rules and the separate residency policy checker."
    )


def set_core_properties(document: Document) -> None:
    document.core_properties.title = (
        "USLS Graduate School Lifecycle Portal — Demonstration Walkthrough & Demo Kit"
    )
    document.core_properties.subject = (
        "Verified Scenarios 1–4 and 8, including monitoring, records, enrollment, "
        "LOA, readmission, AWOL return, and residency."
    )
    document.core_properties.comments = (
        "Updated from the live USLS portal screens and verified workflow tests."
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
    templates = {
        "heading": paragraph_with_text(
            document,
            "Scenario 1 — Import and reconcile the monitoring sheet",
        ),
        "label": paragraph_with_text(document, "Story:"),
        "body": paragraph_starting_with(document, "At the start of the term break"),
        "step": paragraph_starting_with(document, "Step 1."),
        "note": paragraph_starting_with(document, "Note:"),
        "caption": paragraph_starting_with(document, "Screenshot —"),
        "subheading": paragraph_with_text(document, "Path A — Upload a class list"),
        "picture": paragraph_with_drawing(document),
    }
    table_template = document.tables[2]

    update_demo_student_table(document.tables[1])

    scenario_1 = paragraph_with_text(
        document,
        "Scenario 1 — Import and reconcile the monitoring sheet",
    )
    scenario_5 = paragraph_starting_with(document, "Scenario 5 —")
    remove_body_range(scenario_1, scenario_5)
    build_scenarios_1_to_4(
        Builder(document, scenario_5, templates, table_template),
        screenshots,
    )

    scenario_8 = paragraph_starting_with(document, "Scenario 8 —")
    limitations = paragraph_starting_with(document, "7.")
    remove_body_range(scenario_8, limitations)
    build_scenario_8(
        Builder(document, limitations, templates, table_template),
        screenshots,
    )

    set_core_properties(document)
    document.save(output)
    print(output)


if __name__ == "__main__":
    main()
