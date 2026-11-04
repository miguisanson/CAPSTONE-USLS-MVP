"""Audit round 2 fixes (process audit 2026-11-04): one test class per row, rows I-341 ... I-339."""

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
    AcademicTerm, AwolCase, Course, Faculty, PanelAssignment, Program, Student, UserAccount,
    app, db, generate_password_hash,
)


class Audit2Base(unittest.TestCase):
    ROLES = ("staff", "dean", "academic_coordinator", "research_coordinator", "student", "faculty")

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
            program = Program(code="A2", name="Audit Two Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="A2-501", title="Audit Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            for label, start, end in (
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
                ("Term Three", today + timedelta(days=370), today + timedelta(days=490)),
            ):
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            students = []
            for number, first in (("A2-1", "Ana"), ("A2-2", "Ben")):
                student = Student(
                    student_number=number, first_name=first, last_name="Audit", email=f"{first.lower()}@example.test",
                    program_id=program.id, entry_year=today.year - 1, academic_year_entry="25-26", year_level="1",
                    current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                )
                db.session.add(student)
                students.append(student)
            db.session.flush()
            self.student_id, self.other_id = students[0].id, students[1].id
            self.faculty = Faculty(name="Fay Faculty", college="Graduate School", role="Professor",
                                   specialization="Testing", email="fay@example.test")
            db.session.add(self.faculty)
            db.session.flush()
            self.faculty_id = self.faculty.id
            self.accounts = {}
            for role in self.ROLES:
                account = UserAccount(
                    email=f"a2-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
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


class GuideStatePrivacyTests(Audit2Base):
    """I-341: a faculty member sees only the cases of students they advise or sit on the panel of."""

    def test_faculty_sees_only_own_students_in_guide_state(self):
        with app.app_context():
            for sid in (self.student_id, self.other_id):
                db.session.add(AwolCase(student_id=sid, status="AWOL Declared"))
            db.session.add(PanelAssignment(student_id=self.student_id, faculty_id=self.faculty_id, panel_role="Member"))
            db.session.commit()
        faculty = self.client("faculty")
        data = faculty.get("/api/demo/guide-state?process=awol").get_json()
        self.assertEqual([c["student_id"] for c in data["candidates"]], [self.student_id])
        own = faculty.get(f"/api/demo/guide-state?process=awol&student_id={self.student_id}").get_json()
        self.assertIsNotNone(own["case"])
        other = faculty.get(f"/api/demo/guide-state?process=awol&student_id={self.other_id}").get_json()
        self.assertIsNone(other["student"])
        self.assertIsNone(other["case"])
        # staff still see every candidate
        staff = self.client("staff").get("/api/demo/guide-state?process=awol").get_json()
        self.assertEqual(len(staff["candidates"]), 2)


if __name__ == "__main__":
    unittest.main()
