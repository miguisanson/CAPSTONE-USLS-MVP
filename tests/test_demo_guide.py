"""Demo Guide state endpoint (owner request 2026-11-04, .planning/demo-guide/DESIGN.md).

The guide follows the live record, not the presenter's clicks, so a panelist's "do it differently"
cannot break it: GET /api/demo/guide-state tells the guide where a demo case really is.
"""

import os
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import (  # noqa: E402
    AcademicTerm,
    Course,
    Program,
    Student,
    UserAccount,
    app,
    db,
    generate_password_hash,
)

URL = "/api/demo/guide-state"


class DemoGuideStateTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="DGP", name="Demo Guide Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            db.session.add(Course(program_id=program.id, code="DGP-501", title="Guide Course", units=3, category="Major"))
            students = []
            for number, first in (("DG-1", "Gina"), ("DG-2", "Omar")):
                student = Student(
                    student_number=number, first_name=first, last_name="Guide", email=f"{first.lower()}@example.test",
                    program_id=program.id, entry_year=date.today().year - 1, academic_year_entry="25-26",
                    year_level="1", current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                )
                db.session.add(student)
                students.append(student)
            db.session.flush()
            self.student_id, self.other_id = students[0].id, students[1].id
            self.accounts = {}
            for role in ("staff", "dean"):
                self.accounts[role] = self._account(role, f"dg-{role}@example.test").id
            self.accounts["student"] = self._account("student", "dg-student@example.test", students[0].id).id
            today = date.today()
            for label, start, end in (
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
            ):
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            db.session.commit()

    def _account(self, role, email, student_id=None):
        account = UserAccount(email=email, full_name=f"Test {role}", password_hash=generate_password_hash("x-pass"),
                              role=role, student_id=student_id, active=True)
        db.session.add(account)
        db.session.flush()
        return account

    def client(self, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client

    def state(self, role, **params):
        return self.client(role).get(URL, query_string=params)

    def test_demo_mode_off_hides_the_guide(self):
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            self.assertEqual(self.state("staff", process="leave-of-absence").status_code, 404)

    def test_signed_out_is_refused(self):
        self.assertEqual(app.test_client().get(URL, query_string={"process": "leave-of-absence"}).status_code, 401)

    def test_unknown_process_is_refused(self):
        self.assertEqual(self.state("staff", process="nonsense").status_code, 400)

    def test_the_state_follows_the_case_whatever_the_presenter_typed(self):
        before = self.state("staff", process="leave-of-absence", student_id=self.student_id)
        self.assertEqual(before.status_code, 200, before.get_json())
        body = before.get_json()
        self.assertEqual(body["role"], "staff")
        self.assertEqual(body["student"]["id"], self.student_id)
        self.assertIsNone(body["case"])
        self.assertIn("skip_date_waits", body)
        filed = self.client("student").post("/api/student-portal/requests/leave-of-absence", json={
            "effective_start": "Term One", "effective_end": "Term Two",
            "reason_category": "Medical / health", "reason_remarks": "Any text the panel asks for.",
        })
        self.assertEqual(filed.status_code, 200, filed.get_json())
        after = self.state("dean", process="leave-of-absence", student_id=self.student_id).get_json()
        self.assertEqual(after["role"], "dean")
        self.assertEqual(after["case"]["status"], "Submitted")
        self.assertTrue(after["case"]["status_label"])
        self.assertIn(self.student_id, [row["student_id"] for row in after["candidates"]])

    def test_a_student_only_ever_sees_their_own_record(self):
        body = self.state("student", process="leave-of-absence", student_id=self.other_id).get_json()
        self.assertEqual(body["student"]["id"], self.student_id)
        self.assertEqual(body["candidates"], [])

    def test_the_monitoring_sheet_reports_the_record_not_a_case(self):
        body = self.state("staff", process="monitoring", student_id=self.student_id).get_json()
        self.assertEqual(body["case"]["status"], "record")
        self.assertIn("subject_count", body["case"])


if __name__ == "__main__":
    unittest.main()
