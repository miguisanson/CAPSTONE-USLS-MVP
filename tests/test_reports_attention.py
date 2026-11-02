"""B3 (I-141, AD10): S1 students who need attention, S2 where students get stuck, S8 records to fix.

GET /api/reports/attention, /api/reports/stages, /api/reports/records-to-fix. Expected counts are worked out from the
rows built here; the stage clock is set by the test (days in the current stage), never read back from the endpoint.
"""
import io
import unittest
from datetime import timedelta

from tests import reports_support  # noqa: F401  (sets the environment before app is imported)
from tests.reports_support import TODAY, ReportsV2Base, db, make_student, set_stage_clock

from openpyxl import load_workbook  # noqa: E402

from app import (  # noqa: E402
    AdviserAppointment, Faculty, Program, ResearchCase, Task,
)


def _overdue_task(student, title, owner, days=5):
    db.session.add(Task(student_id=student.id, title=title, owner_role=owner, due_at=TODAY - timedelta(days=days), status="Pending", priority=10))


class AttentionBase(ReportsV2Base):
    """Active students and how long each has been in its stage:
    b1 Coursework 130 days (yellow), b2 Proposal Development 250 days (red) with two overdue tasks,
    b3 Coursework 10 days with an overdue task for the Academic Coordinator, b4 Coursework 40 days (fine),
    b5 AWOL (standing), b7 Coursework 125 days (yellow); b6 is Completed 300 days ago (never listed)."""

    @classmethod
    def build(cls):
        program = Program(code="PA", name="Program Alpha", college="Graduate School", has_practicum=False)
        other = Program(code="PB", name="Program Beta", college="Graduate School", has_practicum=False)
        db.session.add_all([program, other])
        db.session.flush()
        cls.program_id, cls.other_id = program.id, other.id
        s = {
            "b1": make_student(program, "B-1"),
            "b2": make_student(program, "B-2", stage="Proposal Development"),
            "b3": make_student(other, "B-3"),
            "b4": make_student(program, "B-4"),
            "b5": make_student(program, "B-5", standing="AWOL"),
            "b6": make_student(program, "B-6", stage="Completed"),
            "b7": make_student(other, "B-7"),
        }
        cls.ids = {name: student.id for name, student in s.items()}
        for name, days in (("b1", 130), ("b2", 250), ("b3", 10), ("b4", 40), ("b5", 10), ("b6", 300), ("b7", 125)):
            set_stage_clock(s[name], days)
        _overdue_task(s["b2"], "Send chapter 1", "Research Coordinator", 4)
        _overdue_task(s["b2"], "Send chapter 2", "Research Coordinator", 9)
        _overdue_task(s["b3"], "Submit study plan", "Academic Coordinator", 6)


class AttentionTests(AttentionBase):
    def ids_of(self, *names):
        return sorted(self.ids[name] for name in names)

    def test_lists_exactly_the_students_who_need_attention(self):
        payload = self.get("/api/reports/attention")
        self.assertEqual(sorted(r["student_id"] for r in payload["rows"]), self.ids_of("b1", "b2", "b3", "b5", "b7"))
        self.assertEqual(payload["count"], 5)
        self.assertEqual(payload["levels"], {"At Risk of Delay": 3, "Delayed": 2})

    def test_counts_per_cause(self):
        payload = self.get("/api/reports/attention")
        counts = {c["key"]: c["count"] for c in payload["causes"]}
        self.assertEqual(counts, {"stalled": 3, "overdue_tasks": 2, "awol": 1})
        self.assertTrue(all(c["label"] for c in payload["causes"]))
        self.assertEqual([c["key"] for c in payload["causes"]][0], "stalled")  # biggest first

    def test_each_row_says_why_how_long_and_who_is_next(self):
        rows = {r["student_id"]: r for r in self.get("/api/reports/attention")["rows"]}
        b2 = rows[self.ids["b2"]]
        self.assertEqual((b2["level"], b2["stage"], b2["days_in_stage"]), ("Delayed", "Proposal Development", 250))
        self.assertEqual(sorted(b2["causes"]), ["overdue_tasks", "stalled"])
        self.assertTrue(any("250 days" in reason for reason in b2["reasons"]))
        b3 = rows[self.ids["b3"]]
        self.assertEqual((b3["causes"], b3["owner"]), (["overdue_tasks"], "Academic Coordinator"))
        self.assertEqual(rows[self.ids["b5"]]["causes"], ["awol"])

    def test_most_urgent_first(self):
        levels = [r["level"] for r in self.get("/api/reports/attention")["rows"]]
        self.assertEqual(levels, sorted(levels, key=lambda level: level != "Delayed"))

    def test_a_cause_filter_lists_the_students_behind_that_bar(self):
        rows = self.get("/api/reports/attention", cause="stalled")["rows"]
        self.assertEqual(sorted(r["student_id"] for r in rows), self.ids_of("b1", "b2", "b7"))
        self.assertEqual(self.get("/api/reports/attention", cause="stalled")["count"], 3)

    def test_program_filter(self):
        payload = self.get("/api/reports/attention", program_id=self.other_id)
        self.assertEqual(sorted(r["student_id"] for r in payload["rows"]), self.ids_of("b3", "b7"))


class ExportTests(AttentionBase):
    """Excel and PDF carry exactly the rows on the screen (same helper as the five IM20 reports)."""

    def sheet_rows(self, path, **params):
        response = self.client().get(path, query_string={**params, "format": "xlsx"})
        self.assertEqual(response.status_code, 200, response.data[:200])
        sheet = load_workbook(io.BytesIO(response.data)).active
        return sheet.max_row - 3  # title, filter note and header row come first

    def test_excel_rows_equal_the_screen_rows(self):
        for path, key in (("/api/reports/attention", "rows"), ("/api/reports/stages", "students")):
            self.assertEqual(self.sheet_rows(path), len(self.get(path)[key]), path)
        self.assertEqual(self.sheet_rows("/api/reports/attention", cause="overdue_tasks"), 2)
        self.assertEqual(self.sheet_rows("/api/reports/summary/active", term="T-None"), len(self.get("/api/reports/summary/active", term="T-None")["rows"]))

    def test_pdf_is_a_pdf(self):
        response = self.client().get("/api/reports/attention", query_string={"format": "pdf"})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data.startswith(b"%PDF"))

    def test_an_unknown_format_is_refused(self):
        self.assertEqual(self.client().get("/api/reports/attention", query_string={"format": "doc"}).status_code, 400)


class StagesTests(AttentionBase):
    def test_per_stage_median_and_zones(self):
        payload = self.get("/api/reports/stages")
        self.assertEqual(payload["thresholds"], {"warn": 120, "high": 210})
        rows = {r["stage"]: r for r in payload["rows"]}
        coursework = rows["Coursework"]
        # b1 130, b3 10, b4 40, b7 125: median of 10, 40, 125, 130 is 82.5; nearest-rank p90 is the largest, 130
        self.assertEqual(
            (coursework["students"], coursework["median_days"], coursework["p90_days"], coursework["longest_days"]),
            (4, 82.5, 130.0, 130),
        )
        self.assertEqual((coursework["green"], coursework["yellow"], coursework["red"]), (2, 2, 0))
        development = rows["Proposal Development"]
        self.assertEqual((development["students"], development["median_days"], development["red"]), (1, 250.0, 1))

    def test_stages_come_in_lifecycle_order_and_skip_finished_ones(self):
        stages = [r["stage"] for r in self.get("/api/reports/stages")["rows"]]
        self.assertEqual(stages[:2], ["Admission", "Coursework"])
        self.assertNotIn("Completed", stages)
        empty = next(r for r in self.get("/api/reports/stages")["rows"] if r["stage"] == "Writing")
        self.assertEqual((empty["students"], empty["median_days"]), (0, None))

    def test_the_student_list_adds_up_to_the_bars(self):
        payload = self.get("/api/reports/stages")
        self.assertEqual(len(payload["students"]), sum(r["students"] for r in payload["rows"]))
        self.assertEqual(payload["count"], len(payload["students"]))
        red = self.get("/api/reports/stages", stage="Proposal Development", zone="red")["students"]
        self.assertEqual([r["student_id"] for r in red], [self.ids["b2"]])
        yellow = self.get("/api/reports/stages", stage="Coursework", zone="yellow")["students"]
        self.assertEqual(sorted(r["student_id"] for r in yellow), sorted((self.ids["b1"], self.ids["b7"])))
        self.assertEqual({r["zone"] for r in yellow}, {"yellow"})

    def test_program_filter(self):
        rows = {r["stage"]: r for r in self.get("/api/reports/stages", program_id=self.other_id)["rows"]}
        self.assertEqual((rows["Coursework"]["students"], rows["Coursework"]["median_days"]), (2, 67.5))


class RecordsToFixTests(ReportsV2Base):
    """r1 has a research case and an accepted adviser; r2 lacks the case; r3 lacks the adviser; r4 lacks both;
    r5 is still in Coursework and r6 Completed (neither is a research-stage student)."""

    @classmethod
    def build(cls):
        program = Program(code="PA", name="Program Alpha", college="Graduate School", has_practicum=False)
        db.session.add(program)
        faculty = Faculty(name="Dr. Adviser", college="GS", role="Faculty", specialization="Methods", email="adv@v2.test")
        db.session.add(faculty)
        db.session.flush()
        cls.program_id = program.id
        s = {
            "r1": make_student(program, "R-1", stage="Proposal Development"),
            "r2": make_student(program, "R-2", stage="Proposal Defense"),
            "r3": make_student(program, "R-3", stage="Writing"),
            "r4": make_student(program, "R-4", stage="Data Collection"),
            "r5": make_student(program, "R-5"),
            "r6": make_student(program, "R-6", stage="Completed"),
        }
        cls.ids = {name: student.id for name, student in s.items()}
        for name in ("r1", "r3"):
            db.session.add(ResearchCase(student_id=s[name].id, case_type="Thesis", title=f"Paper {name}", current_gate="Proposal", status="Open"))
        for name in ("r1", "r2"):
            db.session.add(AdviserAppointment(
                student_id=s[name].id, faculty_id=faculty.id, kind="Recorded", status="Accepted", adviser_response="Accepted",
            ))

    def test_lists_research_stage_students_with_a_missing_record(self):
        payload = self.get("/api/reports/records-to-fix")
        rows = {r["student_id"]: r for r in payload["rows"]}
        self.assertEqual(sorted(rows), sorted(self.ids[n] for n in ("r2", "r3", "r4")))
        self.assertEqual(payload["count"], 3)
        self.assertEqual(payload["counts"], {"research_case": 2, "adviser": 2, "both": 1})
        self.assertEqual(rows[self.ids["r2"]]["missing"], ["research_case"])
        self.assertEqual(rows[self.ids["r3"]]["missing"], ["adviser"])
        self.assertEqual(rows[self.ids["r4"]]["missing"], ["research_case", "adviser"])
        self.assertIn("research", rows[self.ids["r2"]]["detail"].lower())

    def test_a_missing_filter_lists_one_bar(self):
        rows = self.get("/api/reports/records-to-fix", missing="adviser")["rows"]
        self.assertEqual(sorted(r["student_id"] for r in rows), sorted(self.ids[n] for n in ("r3", "r4")))

    def test_excel_rows_equal_the_screen_rows(self):
        response = self.client().get("/api/reports/records-to-fix", query_string={"format": "xlsx"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(load_workbook(io.BytesIO(response.data)).active.max_row - 3, 3)

    def test_who_may_open_the_three_lists(self):
        for path in ("/api/reports/attention", "/api/reports/stages", "/api/reports/records-to-fix"):
            for role in ("staff", "academic_coordinator", "research_coordinator"):
                self.assertEqual(self.client(role).get(path).status_code, 200, (path, role))
            self.assertEqual(self.client("student").get(path).status_code, 403, path)


if __name__ == "__main__":
    unittest.main()
