"""Night 8 seed fixes (Fable review F-25, .planning/research/FULL-REVIEW-2026-11-03.md).

1. A research-stage student has a research adviser: the Reports "Records to fix" tab must not say "No adviser"
   for 34 students. The students the adviser-designation walkthrough (frontend/e2e/p63-faculty-pages.spec.js)
   applies for, and a handful of students still at the title stage, keep none so that the report has a small,
   realistic list and the walkthrough still has students to appoint.
2. A student whose graduation endorsement still waits for the Dean (or is returned) is not yet "Completed".
3. Two seeds of the same day give the same data (scripts/db_fingerprint.py), also with the new adviser step.
"""
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
sys.path.insert(0, str(ROOT / "tests"))

from app import (  # noqa: E402
    AdviserAppointment,
    Faculty,
    GraduationEndorsement,
    PanelAssignment,
    ResearchCase,
    Student,
    UserAccount,
    adviser_faculty_ids_for_student,
    adviser_max_advisees,
    app,
    build_demo_database,
    db,
)
from db_fingerprint import differing_tables, table_fingerprints  # noqa: E402
from test_seed_determinism import _seed  # noqa: E402  (what `npm run seed` does, in its own process and folder)

RESEARCH_OPEN = ("Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense")
PAST_TITLE_DEFENSE = ("Proposal Defense", "Data Collection", "Writing", "Final Defense")
# p63-faculty-pages.spec.js applies for an adviser as these four students (Gian Reyes, Daniel Bernardo, Rafael Pang,
# Marielle Navarro) and uploads Form 1 as Elena Mendoza: none of them may already have an adviser.
DEMO_STUDENTS_WITHOUT_ADVISER = {
    "2360053": "Gian Reyes",
    "2460055": "Daniel Bernardo",
    "2260063": "Rafael Pang",
    "2360061": "Marielle Navarro",
    "2260011": "Elena Mendoza",
}
GRADUATION_DECIDED = ("Dean Approved", "Sent to Registrar", "Registrar Received")


class Night8SeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()
            cls.staff_id = UserAccount.query.filter_by(role="staff").first().id

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(getattr(cls, "other_folder", ""), ignore_errors=True)
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def _without_adviser(self, stages):
        return [
            f"{s.student_number} {s.name} ({s.current_stage})"
            for s in Student.query.filter(Student.current_stage.in_(stages)).order_by(Student.student_number).all()
            if not adviser_faculty_ids_for_student(s)
        ]

    # ------------------------------------------------------------------ F-25: advisers
    def test_a_student_past_the_title_defense_nearly_always_has_an_adviser(self):
        with app.app_context():
            missing = self._without_adviser(PAST_TITLE_DEFENSE)
            self.assertLessEqual(len(missing), 6, f"{len(missing)} research students without an adviser: {missing}")

    def test_the_records_to_fix_report_has_a_small_adviser_list_not_none_and_not_dozens(self):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"
        payload = client.get("/api/reports/records-to-fix").get_json()
        self.assertGreaterEqual(payload["counts"]["adviser"], 3, "the report should still show a few records to fix")
        self.assertLessEqual(payload["counts"]["adviser"], 12, f"too many: {payload['counts']}")

    def test_students_the_adviser_walkthrough_appoints_still_have_no_adviser(self):
        with app.app_context():
            for number, name in DEMO_STUDENTS_WITHOUT_ADVISER.items():
                student = Student.query.filter_by(student_number=number).first()
                self.assertIsNotNone(student, f"{name} ({number}) is missing from the seed")
                self.assertEqual(name, student.name)
                self.assertEqual(set(), adviser_faculty_ids_for_student(student), f"{name} must stay without an adviser")
                self.assertFalse(AdviserAppointment.query.filter_by(student_id=student.id).count(), name)

    def test_an_adviser_is_an_accepted_appointment_and_the_research_case_names_the_same_person(self):
        with app.app_context():
            problems = []
            for student in Student.query.filter(Student.current_stage.in_(RESEARCH_OPEN)).all():
                ids = adviser_faculty_ids_for_student(student)
                if not ids or not AdviserAppointment.query.filter_by(student_id=student.id).count():
                    continue  # no adviser, or the three upcoming-defense demo students (2691201 to 2691203), whose adviser is the older assignment record
                live = AdviserAppointment.query.filter_by(student_id=student.id, status="Accepted", ended_at=None).all()
                if {row.faculty_id for row in live} != ids:
                    problems.append(f"{student.name}: appointments {sorted(row.faculty_id for row in live)} vs {sorted(ids)}")
                case = ResearchCase.query.filter_by(student_id=student.id).first()
                if case and case.adviser_name != student.adviser_name:
                    problems.append(f"{student.name}: case adviser {case.adviser_name!r} vs {student.adviser_name!r}")
                panel = {row.faculty_id for row in PanelAssignment.query.filter_by(student_id=student.id).all()}
                if panel & ids:
                    problems.append(f"{student.name}: the adviser sits on the panel")
            self.assertEqual([], problems)

    def test_the_advisers_stay_within_the_advisee_limit_and_the_walkthrough_adviser_keeps_a_seat(self):
        with app.app_context():
            limit = adviser_max_advisees()
            loads = {}
            for row in AdviserAppointment.query.filter_by(status="Accepted", ended_at=None).all():
                loads[row.faculty_id] = loads.get(row.faculty_id, 0) + 1
            self.assertTrue(loads)
            self.assertLessEqual(max(loads.values()), limit)
            # p63: the Dean appoints Dr. Angela Cruz for Daniel Bernardo and no "over the limit" warning may appear.
            cruz = Faculty.query.filter_by(name="Dr. Angela Cruz").first()
            self.assertLess(loads.get(cruz.id, 0), limit, "Dr. Angela Cruz has no free seat for the walkthrough")

    # ------------------------------------------------------------------ F-25: Completed vs the Dean's endorsement
    def test_hector_ong_and_isabel_flores_are_not_completed_while_their_endorsement_is_open(self):
        with app.app_context():
            for number in ("2360008", "2260007"):
                student = Student.query.filter_by(student_number=number).first()
                endorsement = GraduationEndorsement.query.filter_by(student_id=student.id).first()
                self.assertIsNotNone(endorsement, student.name)
                self.assertNotIn(endorsement.endorsement_status, GRADUATION_DECIDED, student.name)
                self.assertNotEqual("Completed", student.current_stage, f"{student.name}: {endorsement.endorsement_status}")

    def test_no_student_is_completed_while_a_graduation_endorsement_is_undecided(self):
        with app.app_context():
            bad = [
                f"{item.student.name}: {item.endorsement_status}"
                for item in GraduationEndorsement.query.all()
                if item.student.current_stage == "Completed" and item.endorsement_status not in GRADUATION_DECIDED
            ]
            self.assertEqual([], bad)

    # ------------------------------------------------------------------ R-001
    def test_a_second_seed_in_its_own_process_gives_the_same_data(self):
        # Two clean `npm run seed` processes: an in-process seed inside a long test run inherits settings earlier test
        # modules changed, which is not what a teammate's machine does (R-001).
        first, second = (Path(tempfile.mkdtemp(prefix=f"night8-seed-{n}-")) for n in (1, 2))
        _seed(first)
        _seed(second)
        differing = differing_tables(table_fingerprints(first / "demo.sqlite3"), table_fingerprints(second / "demo.sqlite3"))
        self.assertEqual([], differing, "two seeds produced different data in these tables")

if __name__ == "__main__":
    unittest.main()
