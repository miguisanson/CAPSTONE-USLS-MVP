"""I-216 (Fable F-16/F-17/F-23): course rosters are limited for faculty, CSV exports are formula-safe,
and unexpected errors do not leak their text."""
import io
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    Course, CourseRecord, CurriculumOffering, Faculty, Program, Student, UserAccount, app, db, generate_password_hash,
)

APP_SOURCE = Path(app_module.__file__).read_text(encoding="utf-8")


class RosterScopeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="RS", name="Roster Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            c1 = Course(program_id=program.id, code="RS-101", title="Taught", units=3, category="Major")
            c2 = Course(program_id=program.id, code="RS-102", title="Untaught", units=3, category="Major")
            db.session.add_all([c1, c2])
            faculty = {n: Faculty(name=f"Dr {n}", college="GS", role="Faculty", specialization="x", email=f"{n}@rs.test")
                       for n in ("Teach", "Advise", "Other")}
            db.session.add_all(faculty.values())
            db.session.flush()
            students = []
            for number, adviser in (("RS-1", "Dr Advise"), ("RS-2", None)):
                st = Student(student_number=number, first_name=number, last_name="Student", email=f"{number}@x.test",
                             program_id=program.id, entry_year=2025, academic_year_entry="25-26", year_level="1",
                             current_stage="Coursework", standing="Active", adviser_name=adviser)
                db.session.add(st)
                db.session.flush()
                students.append(st)
                for course in (c1, c2):
                    db.session.add(CourseRecord(student_id=st.id, course_id=course.id, status="Enrolled", term_label="T1"))
            db.session.add(CurriculumOffering(program_id=program.id, academic_year="25-26", semester="1",
                                              course_id=c1.id, assigned_faculty_id=faculty["Teach"].id))
            for role, email, fac in (("staff", "staff@rs.test", None), ("faculty", "teach@acct.test", "Teach"),
                                     ("faculty", "advise@acct.test", "Advise"), ("faculty", "other@acct.test", "Other")):
                db.session.add(UserAccount(email=email, full_name=email, role=role, active=True,
                                           faculty_id=faculty[fac].id if fac else None,
                                           password_hash=generate_password_hash("x")))
            db.session.commit()
            cls.c1, cls.c2 = c1.id, c2.id

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()

    def roster(self, email, course_id):
        client = app.test_client()
        with app.app_context():
            account = UserAccount.query.filter_by(email=email).first()
            with client.session_transaction() as session:
                session["account_id"] = account.id
                session["role"] = account.role
        return client.get(f"/api/course-audit/roster?course_id={course_id}")

    def test_staff_sees_every_roster(self):
        for course in (self.c1, self.c2):
            self.assertEqual(len(self.roster("staff@rs.test", course).get_json()["students"]), 2)

    def test_teacher_sees_the_whole_roster_of_the_course_they_teach_only(self):
        self.assertEqual(len(self.roster("teach@acct.test", self.c1).get_json()["students"]), 2)
        self.assertEqual(self.roster("teach@acct.test", self.c2).status_code, 403)

    def test_adviser_sees_only_their_advisees_in_a_course_they_do_not_teach(self):
        for course in (self.c1, self.c2):
            students = self.roster("advise@acct.test", course).get_json()["students"]
            self.assertEqual([s["student_number"] for s in students], ["RS-1"])

    def test_unrelated_faculty_is_refused(self):
        for course in (self.c1, self.c2):
            self.assertEqual(self.roster("other@acct.test", course).status_code, 403)


class CsvFormulaTests(unittest.TestCase):
    def test_csv_writer_keeps_formula_text_as_text(self):
        stream = io.StringIO()
        writer = app_module.safe_csv_writer(stream)
        writer.writerow(["=SUM(A1)", "+1", "-2x", "@cmd", "plain", 5, None])
        self.assertEqual(stream.getvalue().strip(), "'=SUM(A1),'+1,'-2x,'@cmd,plain,5,")

    def test_every_csv_export_uses_the_safe_writer(self):
        self.assertEqual(len(re.findall(r"\bcsv\.writer\(", APP_SOURCE)), 1, "only safe_csv_writer may call csv.writer")


class UnexpectedErrorTests(unittest.TestCase):
    """The staff 'Reset demo case' handler stands for the ~12 `except Exception` handlers."""

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="UE", name="Err Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            cls.key, config = next(iter(app_module.WORKFLOW_DEMO_STUDENTS.items()))
            db.session.add(Student(
                student_number=config["student_number"], first_name="D", last_name="Demo", email="d@x.test",
                program_id=program.id, entry_year=2025, academic_year_entry="25-26", year_level="1",
                current_stage="Coursework", standing="Active"))
            db.session.add(UserAccount(email="staff@ue.test", full_name="s", role="staff", active=True,
                                       password_hash=generate_password_hash("x")))
            db.session.commit()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()

    def reset(self, error):
        client = app.test_client()
        with app.app_context():
            account_id = UserAccount.query.filter_by(email="staff@ue.test").first().id
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = "staff"
        with patch.object(app_module, "reset_workflow_demo_case", side_effect=error):
            return client.post(f"/api/auth/demo-students/{self.key}/reset")

    def test_unexpected_exception_text_is_hidden_and_logged(self):
        with self.assertLogs(app.logger, level="ERROR"):
            response = self.reset(RuntimeError("secret C:/internal/path.py failed"))
        self.assertGreaterEqual(response.status_code, 400)
        self.assertNotIn("secret", response.get_data(as_text=True))
        self.assertIn("error", response.get_json())

    def test_deliberate_validation_message_is_kept(self):
        response = self.reset(ValueError("Pick a date in the future."))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.get_json()["error"], "Pick a date in the future.")


if __name__ == "__main__":
    unittest.main()
