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
    enrollment_window, latest_message_brief, ph_today, workflow_case_meta,
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


class EnrollmentPeriodTests(KFollowBase):
    def set_window(self, open_offset, close_offset):
        with app.app_context():
            term = db.session.get(AcademicTerm, self.term_id)
            today = ph_today()
            term.planning_window_open = today + timedelta(days=open_offset) if open_offset is not None else None
            term.planning_window_close = today + timedelta(days=close_offset) if close_offset is not None else None
            term.is_active_planning_term = True
            db.session.commit()
            return term.planning_window_open, term.planning_window_close

    def test_helper_open_closed_and_not_yet(self):
        with app.app_context():
            term = db.session.get(AcademicTerm, self.term_id)
            self.assertTrue(enrollment_window(term)["is_open"])  # no dates: open
            self.assertTrue(enrollment_window(None)["is_open"])
        self.set_window(-5, 20)
        with app.app_context():
            window = enrollment_window(db.session.get(AcademicTerm, self.term_id))
            self.assertTrue(window["is_open"])
            self.assertEqual(window["message"], "")
        opened, closed = self.set_window(-30, -2)
        with app.app_context():
            window = enrollment_window(db.session.get(AcademicTerm, self.term_id))
            self.assertFalse(window["is_open"])
            self.assertEqual(window["state"], "closed")
            self.assertIn("Enrollment is closed", window["message"])
            self.assertIn(opened.strftime("%b %d, %Y").replace(" 0", " "), window["message"])
            self.assertIn(closed.strftime("%b %d, %Y").replace(" 0", " "), window["message"])
        self.set_window(5, 30)
        with app.app_context():
            window = enrollment_window(db.session.get(AcademicTerm, self.term_id))
            self.assertFalse(window["is_open"])
            self.assertEqual(window["state"], "not_yet")

    def test_course_adjustments_reports_a_real_enrollment_open(self):
        url = f"/api/course-adjustments?program_id={self.program_id}&term_id={self.term_id}"
        self.set_window(-5, 20)
        data = self.client("academic_coordinator").get(url).get_json()
        self.assertIs(data["enrollment_open"], True)
        self.set_window(-30, -2)
        data = self.client("academic_coordinator").get(url).get_json()
        self.assertIs(data["enrollment_open"], False)
        self.assertIs(data["planning_window_open"], False)
        self.assertIn("Enrollment is closed", data["enrollment_window"]["message"])

    def test_course_adjustment_save_refused_when_closed(self):
        opened, closed = self.set_window(-30, -2)
        for action in ("draft", "submit"):
            response = self.client("academic_coordinator").post("/api/course-adjustments/plan", json={
                "program_id": self.program_id, "term_id": self.term_id, "action": action})
            self.assertEqual(response.status_code, 409, response.get_json())
            self.assertIn("Enrollment is closed", response.get_json()["error"])
        self.set_window(-5, 20)
        response = self.client("academic_coordinator").post("/api/course-adjustments/plan", json={
            "program_id": self.program_id, "term_id": self.term_id, "action": "draft"})
        self.assertNotIn("Enrollment is closed", str(response.get_json()))

    def test_student_portal_enrollment_refused_when_closed(self):
        opened, closed = self.set_window(-30, -2)
        response = self.client("student").post("/api/student-portal/enrollment", json={"course_ids": [self.course_id]})
        self.assertEqual(response.status_code, 409, response.get_json())
        error = response.get_json()["error"]
        self.assertIn("Enrollment is closed", error)
        self.assertIn(closed.strftime("%b %d, %Y").replace(" 0", " "), error)
        self.set_window(-5, 20)
        response = self.client("student").post("/api/student-portal/enrollment", json={"course_ids": [self.course_id]})
        self.assertNotIn("Enrollment is closed", str(response.get_json()))

    def test_coordinator_enrollment_refused_when_closed(self):
        self.set_window(-30, -2)
        body = {"confirmed": True, "student_id": self.student_id, "term_id": self.term_id, "course_ids": [self.course_id]}
        response = self.client("academic_coordinator").post("/api/enrollment", json=body)
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("Enrollment is closed", response.get_json()["error"])
        self.set_window(-5, 20)
        response = self.client("academic_coordinator").post("/api/enrollment", json=body)
        self.assertNotIn("Enrollment is closed", str(response.get_json()))


class CohortStudentsTests(KFollowBase):
    def add_students(self):
        with app.app_context():
            other = Program(code="KG", name="Other Program", college="Graduate School", has_practicum=False)
            db.session.add(other)
            db.session.flush()
            self.other_program_id = other.id
            specs = [("A", "Coursework", "24-25", self.program_id), ("B", "Comprehensive Exam", "24-25", self.program_id),
                     ("C", "Writing", "24-25", self.program_id), ("D", "Completed", "24-25", self.program_id),
                     ("E", "AWOL", "24-25", self.program_id), ("F", "Coursework", "23-24", self.program_id),
                     ("G", "Coursework", "2024-2025", other.id)]
            for key, stage, entry, program_id in specs:
                db.session.add(Student(
                    student_number=f"GS-KF-{key}", first_name=key, last_name="Cohort", email=f"kf-{key}@example.test",
                    program_id=program_id, entry_year=2024, academic_year_entry=entry, year_level="1",
                    current_stage=stage, standing="Active", enrollment_tag="Enrolled"))
            db.session.commit()

    def rows(self, role="staff", **params):
        query = "&".join(f"{key}={value}" for key, value in params.items())
        response = self.client(role).get(f"/api/reports/cohorts/students?{query}")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["rows"]

    def test_each_state_lists_the_students_of_that_year(self):
        self.add_students()
        names = lambda state, **more: sorted(row["student"].split()[0] for row in self.rows(entry="24-25", state=state, **more))
        self.assertEqual(names("coursework"), ["A", "B", "G"])
        self.assertEqual(names("thesis"), ["C"])
        self.assertEqual(names("graduated"), ["D"])
        self.assertEqual(names("away"), ["E"])
        self.assertEqual(names("coursework", program_id=self.program_id), ["A", "B"])

    def test_row_shape_and_year_label(self):
        self.add_students()
        row = self.rows(entry="24-25", state="graduated")[0]
        self.assertEqual(set(row), {"student_id", "student", "student_number", "program", "stage", "detail"})
        self.assertEqual((row["program"], row["stage"], row["detail"]), ("KF", "Completed", "2024-2025"))

    def test_coordinator_has_the_same_scope_and_other_roles_are_refused(self):
        self.add_students()
        self.assertEqual(len(self.rows("academic_coordinator", entry="24-25", state="coursework")), 3)
        self.assertEqual(self.client("student").get("/api/reports/cohorts/students?entry=24-25&state=coursework").status_code, 403)

    def test_unknown_state_is_refused_and_downloads_work(self):
        self.add_students()
        self.assertEqual(self.client("staff").get("/api/reports/cohorts/students?entry=24-25&state=nope").status_code, 400)
        for fmt, mime in (("xlsx", "spreadsheetml"), ("pdf", "pdf")):
            response = self.client("staff").get(f"/api/reports/cohorts/students?entry=24-25&state=coursework&format={fmt}")
            self.assertEqual(response.status_code, 200)
            self.assertIn(mime, response.mimetype)


if __name__ == "__main__":
    unittest.main()
