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
    AcademicTerm, AwolCase, LeaveCase, Course, Faculty, PanelAssignment, Program, Student, UserAccount,
    Notification, app, db, generate_password_hash, notify_workflow_owner,
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


class WorkflowNoticeLinkTests(Audit2Base):
    """I-336: the bell notice opens a page the recipient's role can open."""

    def link_for(self, slug, owner_label, role):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            notify_workflow_owner(slug, student, "Test step", owner_label, f"t:{slug}:{role}")
            row = Notification.query.filter_by(account_id=self.accounts[role], kind="workflow_waiting").first()
            return row.link

    def test_dean_notice_opens_dean_page(self):
        self.assertEqual(self.link_for("readmission", "Dean", "dean"), "/dean/approvals/readmission")
        self.assertEqual(self.link_for("awol-return", "Dean", "dean"), "/dean/approvals/awol")

    def test_academic_coordinator_notice_for_readmission_opens_work_queue(self):
        self.assertEqual(self.link_for("readmission", "Academic Coordinator", "academic_coordinator"), "/work-queue")
        self.assertEqual(self.link_for("practicum", "Academic Coordinator", "academic_coordinator"), "/workflow/practicum")

    def test_staff_notice_keeps_workflow_page(self):
        self.assertEqual(self.link_for("withdrawal", "Graduate School Staff", "staff"), "/workflow/withdrawal")


class DailySweepTests(Audit2Base):
    """I-270: date-driven leave moves run by themselves, once a day, on the first signed-in API request."""

    def tearDown(self):
        app.config.pop("FORCE_DAILY_SWEEP", None)

    def make_scheduled_leave(self):
        with app.app_context():
            term = AcademicTerm.query.filter_by(label="Running Term").one()
            case = LeaveCase(student_id=self.student_id, kind="LOA", status="Leave Scheduled",
                             start_term_id=term.id, end_term_id=term.id, start_label=term.label, end_label=term.label)
            db.session.add(case)
            db.session.commit()
            return case.id

    def status(self, case_id):
        with app.app_context():
            return db.session.get(LeaveCase, case_id).status

    def test_first_signed_in_request_of_the_day_starts_due_leaves_once(self):
        import app as app_module
        app.config["FORCE_DAILY_SWEEP"] = True
        app_module._DAILY_SWEEP_STATE["day"] = None
        case_id = self.make_scheduled_leave()
        client = self.client("staff")
        self.assertEqual(self.status(case_id), "Leave Scheduled")  # nothing ran yet
        self.assertEqual(app.test_client().get("/api/health").status_code, 200)
        self.assertEqual(self.status(case_id), "Leave Scheduled")  # public/anonymous calls do not run it
        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        self.assertEqual(self.status(case_id), "On Leave")
        # same day: a second leave made due later is left for the next day (once per day)
        second = self.make_scheduled_leave()
        client.get("/api/auth/me")
        self.assertEqual(self.status(second), "Leave Scheduled")

    def test_sweep_is_off_while_testing_unless_forced(self):
        import app as app_module
        app_module._DAILY_SWEEP_STATE["day"] = None
        case_id = self.make_scheduled_leave()
        self.client("staff").get("/api/auth/me")
        self.assertEqual(self.status(case_id), "Leave Scheduled")


if __name__ == "__main__":
    unittest.main()
