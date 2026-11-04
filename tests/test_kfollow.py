"""Server follow-ups for the polish packets: newest message on board cards, AWOL residence figures,
the enrollment period (one helper, enforced), and the "By year started" student list."""

import os
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm, AwolCase, Course, Program, Student, SubjectEnrollment, UserAccount,
    WithdrawalApplication, WorkflowMessage, app, db, generate_password_hash,
    latest_message_brief, workflow_case_meta,
)


class KFollowBase(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except FileNotFoundError:
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="KF", name="Follow Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            course = Course(program_id=program.id, code="KF-501", title="Follow Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            term = AcademicTerm(label="Running Term", start_date=today - timedelta(days=3), end_date=today + timedelta(days=117))
            db.session.add(term)
            db.session.flush()
            self.term_id = term.id
            student = Student(
                student_number="GS-KF-1", first_name="Kay", last_name="Follow", email="kf1@example.test",
                program_id=program.id, entry_year=today.year - 1, academic_year_entry="25-26", year_level="1",
                current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
            )
            db.session.add(student)
            db.session.flush()
            self.student_id = student.id
            self.accounts = {}
            for role in ("staff", "dean", "academic_coordinator", "student"):
                account = UserAccount(
                    email=f"kf-{role}@example.test", full_name=f"Test {role}", role=role, active=True,
                    password_hash=generate_password_hash("test-password"),
                    student_id=student.id if role == "student" else None,
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

    def message(self, slug, comment, status="Open", visibility="student_visible", age_minutes=0, request_id=None):
        with app.app_context():
            db.session.add(WorkflowMessage(
                transaction_slug=slug, student_id=self.student_id, workflow_request_id=request_id,
                sender_role="Staff", sender_name="Staff Person", recipient_role="Student",
                visibility=visibility, template="Note", comment=comment, status=status,
                created_at=datetime.utcnow() - timedelta(minutes=age_minutes),
            ))
            db.session.commit()

    def make_awol(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.standing = student.enrollment_tag = student.current_stage = "AWOL"
            case = AwolCase(student_id=student.id, status="Return Submitted", dean_decision="Not Submitted",
                            return_intent="Ready.", target_return_term="Running Term",
                            return_requested_at=datetime.now(), awol_effective_date=date.today() - timedelta(days=200))
            db.session.add(case)
            db.session.commit()


class LatestMessageTests(KFollowBase):
    def test_helper_prefers_newest_open_then_newest(self):
        self.message("awol", "old open", age_minutes=30)
        self.message("awol", "new resolved", status="Resolved", age_minutes=1)
        with app.app_context():
            query = WorkflowMessage.query.filter_by(transaction_slug="awol")
            brief = latest_message_brief(query)
            self.assertEqual(brief["comment"], "old open")
            self.assertEqual(set(brief), {"comment", "sender_role", "sender_name", "created_at"})
            WorkflowMessage.query.filter_by(comment="old open").update({"status": "Resolved"})
            self.assertEqual(latest_message_brief(query)["comment"], "new resolved")
            self.assertIsNone(latest_message_brief(WorkflowMessage.query.filter_by(transaction_slug="none")))

    def test_helper_hides_internal_messages_from_a_student(self):
        self.message("awol", "staff only", visibility="internal", age_minutes=1)
        self.message("awol", "for the student", age_minutes=10)
        with app.app_context():
            query = WorkflowMessage.query.filter_by(transaction_slug="awol")
            self.assertEqual(latest_message_brief(query, student_visible_only=True)["comment"], "for the student")
            self.assertEqual(latest_message_brief(query)["comment"], "staff only")

    def test_awol_board_card_carries_latest_message(self):
        self.make_awol()
        self.message("awol", "Please bring the clearance form.")
        rows = self.client("staff").get("/api/process-cases?slug=awol").get_json()["cases"]
        self.assertEqual(rows[0]["latest_message"]["comment"], "Please bring the clearance form.")
        self.assertEqual(rows[0]["latest_message"]["sender_name"], "Staff Person")

    def test_card_without_messages_has_none(self):
        self.make_awol()
        rows = self.client("staff").get("/api/process-cases?slug=awol").get_json()["cases"]
        self.assertIsNone(rows[0]["latest_message"])

    def test_withdrawal_board_card_carries_latest_message(self):
        with app.app_context():
            enrollment = SubjectEnrollment(student_id=self.student_id, course_id=self.course_id, term_id=self.term_id,
                                           status="Enrolled", source_reference="kf")
            db.session.add(enrollment)
            db.session.flush()
            application = WithdrawalApplication(student_id=self.student_id, subject_enrollment_id=enrollment.id,
                                                withdrawal_scope="Subject", reason="Clash.", effective_term="Running Term",
                                                status="Submitted to GS Staff", dean_decision="Pending")
            db.session.add(application)
            db.session.commit()
            application_id = application.id
        self.message("withdrawal", "Registrar asked a question.", request_id=application_id)
        rows = self.client("staff").get("/api/process-cases?slug=withdrawal").get_json()["cases"]
        self.assertEqual(rows[0]["latest_message"]["comment"], "Registrar asked a question.")

    def test_roster_meta_carries_latest_message(self):
        self.message("graduation", "Form 1 is missing a signature.")
        with app.app_context():
            meta = workflow_case_meta("graduation", self.student_id)
            self.assertEqual(meta["latest_message"]["comment"], "Form 1 is missing a signature.")

    def test_leave_board_card_carries_latest_message(self):
        response = self.client("student").post("/api/student-portal/requests/leave-of-absence", json={
            "effective_start": "Running Term", "effective_end": "Running Term",
            "reason_category": "Medical / health", "reason_remarks": "Surgery."})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.message("leave-of-absence", "Send the medical certificate.")
        rows = self.client("staff").get("/api/process-cases?slug=leave-of-absence").get_json()["cases"]
        self.assertEqual(rows[0]["latest_message"]["comment"], "Send the medical certificate.")


class AwolResidenceTests(KFollowBase):
    def test_awol_rows_carry_residence_figures(self):
        self.make_awol()
        rows = self.client("staff").get("/api/process-cases?slug=awol").get_json()["cases"]
        residence = rows[0]["residence"]
        self.assertEqual(set(residence), {"years_in_program", "normal_years", "absolute_years"})
        self.assertGreaterEqual(residence["absolute_years"], residence["normal_years"])
        self.assertIsInstance(residence["years_in_program"], int)

    def test_withdrawal_rows_have_no_residence(self):
        rows = self.client("staff").get("/api/process-cases?slug=withdrawal").get_json()["cases"]
        self.assertTrue(all("residence" not in row for row in rows))


if __name__ == "__main__":
    unittest.main()
