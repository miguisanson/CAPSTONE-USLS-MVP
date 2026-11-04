"""Audit round 3 fixes (process audit 2026-11-04): one test class per row."""

import os
import tempfile
import unittest
from datetime import date, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm, Course, Faculty, Program, Student, UserAccount, app, db, generate_password_hash,
)


class Audit3Base(unittest.TestCase):
    ROLES = ("staff", "admin", "dean", "academic_coordinator", "research_coordinator", "student", "faculty")

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
            program = Program(code="A3", name="Audit Three Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A3-501", title="Audit Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            for label, start, end in (
                ("Past Term", today - timedelta(days=200), today - timedelta(days=60)),
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
            ):
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            students = []
            for number, first in (("A3-1", "Ana"), ("A3-2", "Ben")):
                student = Student(
                    student_number=number, first_name=first, last_name="Audit", email=f"{first.lower()}@example.test",
                    program_id=program.id, entry_year=today.year - 1, academic_year_entry="25-26", year_level="1",
                    current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                )
                db.session.add(student)
                students.append(student)
            db.session.flush()
            self.student_id, self.other_id = students[0].id, students[1].id
            faculty = Faculty(name="Fay Faculty", college="Graduate School", role="Professor",
                              specialization="Testing", email="fay@example.test")
            db.session.add(faculty)
            db.session.flush()
            self.faculty_id = faculty.id
            self.accounts = {}
            for role in self.ROLES:
                account = UserAccount(
                    email=f"a3-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
                    password_hash=generate_password_hash("test-password"),
                    student_id=self.student_id if role == "student" else None,
                    faculty_id=self.faculty_id if role == "faculty" else None,
                )
                db.session.add(account)
                db.session.flush()
                self.accounts[role] = account.id
            db.session.commit()

    def client(self, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client


class DemoSettingsNeedSignInTests(Audit3Base):
    """I-342 / I-351: only a signed-in staff, admin or dean account may flip the global date-wait switch."""

    def setUp(self):
        super().setUp()
        self.addCleanup(lambda: self.client("staff").post("/api/auth/demo-settings", json={"skip_date_waits": None}))

    def test_anonymous_is_refused_and_nothing_changes(self):
        before = app.test_client().get("/api/auth/config").get_json()["skip_date_waits"]
        response = app.test_client().post("/api/auth/demo-settings", json={"skip_date_waits": not before})
        self.assertEqual(response.status_code, 401)
        self.assertIn("Sign in", response.get_json()["error"])
        self.assertEqual(app.test_client().get("/api/auth/config").get_json()["skip_date_waits"], before)

    def test_student_and_faculty_are_refused(self):
        for role in ("student", "faculty"):
            response = self.client(role).post("/api/auth/demo-settings", json={"skip_date_waits": False})
            self.assertEqual(response.status_code, 403, role)

    def test_staff_admin_and_dean_can_flip_it(self):
        for role in ("staff", "admin", "dean"):
            for wanted in (False, True):
                response = self.client(role).post("/api/auth/demo-settings", json={"skip_date_waits": wanted})
                self.assertEqual(response.status_code, 200, (role, response.get_json()))
                self.assertIs(response.get_json()["skip_date_waits"], wanted)


if __name__ == "__main__":
    unittest.main()
