"""Seed quality: the demo data must not contradict the app's own rules.

Senior review 2026-10-22 (.planning/research/FULL-REVIEW-2026-10-22.md) F-06, F-07, F-08, F-16, F-40,
F-41 = issues I-060, I-061, I-062, I-070, I-094, I-095. One seeded temporary database is built for the
whole module (the way tests/test_v53_backend.py builds its own); every test only reads it.
"""
import os
import tempfile
import unittest
from collections import Counter
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import (  # noqa: E402
    AcademicTerm,
    AdviserAppointment,
    AdviserAssignment,
    Course,
    DefenseVerdict,
    Faculty,
    PanelAssignment,
    Program,
    Student,
    SubjectEnrollment,
    Task,
    TransactionLog,
    UserAccount,
    adviser_max_advisees,
    app,
    compute_course_audit,
    comprehensive_exam_eligibility,
    db,
    build_demo_database,
    student_adviser_faculty,
)

DEAN_QUEUE_TYPES = ("leave-of-absence", "readmission", "awol-return", "withdrawal", "practicum", "graduation")
RESEARCH_STAGES = ("Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense", "Completed")


class SeedQualityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()
            cls.dean_id = UserAccount.query.filter_by(role="dean").first().id
            cls.today = date.today()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def _client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-060 (F-06)
    def test_no_faculty_advises_more_students_than_the_limit(self):
        with app.app_context():
            limit = adviser_max_advisees()
            over = []
            for faculty in Faculty.query.all():
                accepted = AdviserAppointment.query.filter(
                    AdviserAppointment.faculty_id == faculty.id,
                    AdviserAppointment.status == "Accepted",
                    AdviserAppointment.ended_at.is_(None),
                ).count()
                legacy = AdviserAssignment.query.filter_by(faculty_id=faculty.id, status="Active").count()
                if max(accepted, legacy) > limit:
                    over.append(f"{faculty.name}: {accepted} appointments / {legacy} assignments (limit {limit})")
            self.assertEqual([], over)

    def test_an_adviser_never_sits_on_the_advisees_panel(self):
        with app.app_context():
            clashes = []
            for student in Student.query.all():
                adviser_ids = {faculty.id for faculty in student_adviser_faculty(student)}
                panel_ids = {row.faculty_id for row in PanelAssignment.query.filter_by(student_id=student.id).all()}
                for faculty_id in adviser_ids & panel_ids:
                    clashes.append(f"{student.name} ({student.student_number}): {db.session.get(Faculty, faculty_id).name}")
            self.assertEqual([], clashes)

    # ------------------------------------------------------------------ I-062 (F-08)
    def test_the_dean_has_a_case_waiting_in_every_queue_and_some_decided_ones(self):
        dean = self._client(self.dean_id, "dean")
        payload = dean.get("/api/approvals").get_json()
        waiting = Counter(item["type"] for item in payload["workflow_pending"])
        missing = [queue for queue in DEAN_QUEUE_TYPES if not waiting[queue]]
        self.assertEqual([], missing, f"no case waiting for the Dean in: {missing}")
        self.assertGreaterEqual(len(payload["pending"]), 1, "no course offering plan waits for the Dean")
        decided = len(payload["workflow_recent"]) + len(payload["recent"])
        self.assertGreaterEqual(decided, 3, "the Dean should also have a few decided cases in the past weeks")

    # ------------------------------------------------------------------ I-061 (F-07)
    def test_a_student_in_research_has_finished_coursework_and_passed_the_comprehensive(self):
        with app.app_context():
            bad = []
            for student in Student.query.filter(Student.current_stage.in_(RESEARCH_STAGES)).all():
                audit = compute_course_audit(student)
                if audit["completed_units"] <= 0 or audit["completed_units"] < audit["total_units"]:
                    bad.append(f"{student.name} {student.student_number} {student.current_stage}: "
                               f"{audit['completed_units']}/{audit['total_units']} units")
                if (student.comprehensive_exam_status or "").lower() != "passed":
                    bad.append(f"{student.name} {student.student_number}: compre {student.comprehensive_exam_status}")
            self.assertEqual([], bad)

    def test_no_category_shows_more_units_than_the_requirement(self):
        with app.app_context():
            bad = []
            for student in Student.query.all():
                for row in comprehensive_exam_eligibility(student)["categories"]:
                    if row["completed"] > row["required"]:
                        bad.append(f"{student.name} {row['category']}: {row['completed']} of {row['required']} units")
            self.assertEqual([], bad[:10])

    def test_subjects_have_real_titles_and_terms_and_programs_real_colleges(self):
        with app.app_context():
            same_as_code = [c.code for c in Course.query.all() if (c.title or "").strip().upper() == c.code.upper()]
            self.assertEqual([], same_as_code[:10], "subject titles that only repeat the code")
            other_prefix = [c.code for c in Course.query.all() if (c.title or "").upper().startswith("MAGC")]
            self.assertEqual([], other_prefix)
            for program in Program.query.all():
                terms = {c.recommended_term for c in Course.query.filter_by(program_id=program.id).all()}
                self.assertGreater(len(terms), 1, f"{program.code}: every subject has the same suggested term {terms}")
            self.assertEqual([], [p.code for p in Program.query.all() if p.college in (None, "", "Imported")])

    # ------------------------------------------------------------------ I-070 (F-16)
    def test_seeded_events_are_spread_over_the_previous_weeks(self):
        with app.app_context():
            def weeks(values):
                return {value.isocalendar()[:2] for value in values if value}

            logged = [row.created_at for row in TransactionLog.query.all()]
            appointments = [row.applied_at for row in AdviserAppointment.query.all()]
            verdicts = [row.submitted_at for row in DefenseVerdict.query.all()]
            due = [row.due_at.date() if isinstance(row.due_at, datetime) else row.due_at for row in Task.query.all()]
            self.assertGreaterEqual(len(weeks(logged)), 4, "activity log happens in fewer than 4 weeks")
            self.assertGreaterEqual(len(weeks(appointments)), 4, "adviser appointments happen in fewer than 4 weeks")
            self.assertGreaterEqual(len({d for d in due}), 3, "tasks are all due on the same day")
            self.assertGreater(len({v.strftime("%H:%M:%S") for v in verdicts if v}), 1, "all verdicts at the same clock time")
            oldest = self.today - timedelta(weeks=12, days=1)
            for label, values in (("activity", logged), ("appointments", appointments)):
                self.assertTrue(all(oldest <= value.date() <= self.today for value in values if value), label)

    # ------------------------------------------------------------------ I-094 (F-40)
    def test_default_student_has_nothing_to_withdraw_and_the_withdrawal_demo_students_have_subjects(self):
        """Miguel Yu (student@usls.edu.ph) is at Final Defense with all coursework completed, so policy
        leaves him no current subject to withdraw (and the withdrawal window is the first two weeks of
        a semester: the registrar calendar, not demo data). The withdrawal demo belongs to the dedicated
        accounts, which must keep subjects enrolled in the active term."""
        with app.app_context():
            default = UserAccount.query.filter_by(email="student@usls.edu.ph").one().student
            self.assertEqual("Final Defense", default.current_stage)
            self.assertEqual(0, SubjectEnrollment.query.filter(
                SubjectEnrollment.student_id == default.id,
                SubjectEnrollment.status.in_(("Enrolled", "Current")),
            ).count())
            for number in ("GS-2026-WD-01", "GS-2026-WD-02"):
                student = Student.query.filter_by(student_number=number).one()
                self.assertGreaterEqual(SubjectEnrollment.query.filter(
                    SubjectEnrollment.student_id == student.id,
                    SubjectEnrollment.status == "Enrolled",
                ).count(), 1, number)

    # ------------------------------------------------------------------ I-095 (F-41)
    def test_terms_cover_only_the_current_year_plus_or_minus_two(self):
        with app.app_context():
            current_start = self.today.year if self.today.month >= 8 else self.today.year - 1
            years = sorted({int(term.label.split()[1].split("-")[0]) for term in AcademicTerm.query.all()})
            self.assertEqual(list(range(current_start - 2, current_start + 3)), years)
            self.assertEqual(10, AcademicTerm.query.count())


if __name__ == "__main__":
    unittest.main()
