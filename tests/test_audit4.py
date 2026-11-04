"""Audit round 4 fixes (process audit 2026-11-04): one test class per row."""

import os
import tempfile
import unittest
from unittest.mock import patch
from datetime import date, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm, Course, Faculty, GraduationEndorsement, Program, ResidencyEnrollment, Student, TermEnrollment, UserAccount, app, db,
    generate_password_hash, run_maintenance_sweeps,
)


class Audit4Base(unittest.TestCase):
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
            program = Program(code="A4", name="Audit Three Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A4-501", title="Audit Course", units=3, category="Major")
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
            for number, first in (("A4-1", "Ana"), ("A4-2", "Ben")):
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
                    email=f"a4-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
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


class PracticumClosedStandingTests(Audit4Base):
    """I-290: an AWOL / On Leave student is refused at submit, with the reason, not left in a dead end."""

    def make_practicum_student(self, standing, tag):
        from app import PracticumRecord
        with app.app_context():
            program = db.session.get(Program, self.program_id)
            program.has_practicum = True
            program.code = "MSGC"
            program.name = "Master of Science in Guidance and Counseling"
            student = db.session.get(Student, self.student_id)
            student.standing, student.enrollment_tag = standing, tag
            db.session.add(PracticumRecord(student_id=student.id, status="Practicum In Progress", required_hours=200, moa_uploaded=True))
            db.session.commit()

    def test_awol_student_is_refused_with_reason(self):
        self.make_practicum_student("AWOL", "AWOL")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("AWOL", response.get_json()["error"])
        self.assertIn("practicum", response.get_json()["error"])

    def test_on_leave_student_is_refused(self):
        self.make_practicum_student("On Leave", "LOA")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("On Leave", response.get_json()["error"])

    def test_active_student_is_not_blocked_by_standing(self):
        self.make_practicum_student("Active", "Enrolled")
        response = self.client("student").post("/api/student-portal/requests/practicum", json={"remarks": "x"})
        self.assertNotEqual(response.status_code, 409, response.get_json())
        self.assertNotIn("not an active student", str(response.get_json()))
