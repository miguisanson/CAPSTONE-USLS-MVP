"""IM43: staff record the comprehensive exam result (I-335) and the Dean's readmission approval
produces the Advise Slip (I-304). Handbook p.56 (RES-04), p.77 (GRD-04), p.45 (returnees, item 4)."""
import os
import tempfile
import unittest
from datetime import date, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import (  # noqa: E402
    LeaveCase, LeaveCaseEvent, Program, Student, TransactionLog, UserAccount,
    app, db, generate_password_hash, now_utc, require_research_prerequisite,
)


class Im43Tests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        try:
            os.unlink(_DB_FILE.name)
        except OSError:
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="IMP", name="Im43 Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            student = Student(student_number="GS-43-1", first_name="Ana", last_name="Reyes", email="ana43@example.test",
                              program_id=program.id, entry_year=2024, academic_year_entry="24-25", year_level="1",
                              current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
                              comprehensive_exam_status="Not Taken")
            db.session.add(student)
            db.session.flush()
            self.student_id = student.id
            self.ids = {}
            for role in ("staff", "dean", "faculty", "academic_coordinator", "admin"):
                self.ids[role] = self._account(role).id
            sa = self._account("student")
            sa.student_id = student.id
            self.ids["student"] = sa.id
            other = Student(student_number="GS-43-2", first_name="Ben", last_name="Cruz", email="ben43@example.test",
                            program_id=program.id, entry_year=2024, academic_year_entry="24-25", year_level="1",
                            current_stage="Coursework", standing="Active", enrollment_tag="Enrolled")
            db.session.add(other)
            db.session.flush()
            oa = self._account("student", "other")
            oa.student_id = other.id
            self.ids["other"] = oa.id
            db.session.commit()

    def _account(self, role, tag=""):
        account = UserAccount(email=f"{role}{tag}43@example.test", full_name=f"Test {role.title()}{tag}",
                              password_hash=generate_password_hash("x"), role=role, active=True)
        db.session.add(account)
        db.session.flush()
        return account

    def client(self, key):
        c = app.test_client()
        with c.session_transaction() as s:
            s["account_id"] = self.ids[key]
            s["role"] = key if key != "other" else "student"
        return c

    def record(self, key="staff", **body):
        body.setdefault("result", "Passed")
        body.setdefault("exam_date", (date.today() - timedelta(days=3)).isoformat())
        body.setdefault("reason", "Result sheet from the Graduate School office")
        return self.client(key).post(f"/api/students/{self.student_id}/comprehensive-exam", json=body)

    # ---- I-335 -------------------------------------------------------------------------
    def test_staff_records_passed_status_provenance_audit_and_research_unlocks(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            with self.assertRaises(ValueError):
                require_research_prerequisite(student)
        response = self.record()
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            self.assertEqual(student.comprehensive_exam_status, "Passed")
            self.assertEqual(TransactionLog.query.filter_by(student_id=self.student_id, transaction_slug="comprehensive-exam").count(), 1)
        detail = self.client("staff").get(f"/api/students/{self.student_id}").get_json()
        exam = detail["comprehensive_exam"]
        self.assertEqual(exam["current"]["result"], "Passed")
        self.assertEqual(exam["current"]["source"], "Manual entry")
        self.assertEqual(exam["current"]["recorded_by"], "Test Staff")
        self.assertTrue(exam["current"]["recorded_at"])
        self.assertEqual(exam["current"]["reason"], "Result sheet from the Graduate School office")
        self.assertEqual(len(exam["history"]), 1)

    def test_failed_result_keeps_research_locked_and_history_grows(self):
        self.assertEqual(self.record(result="Failed").status_code, 200)
        with app.app_context():
            self.assertEqual(db.session.get(Student, self.student_id).comprehensive_exam_status, "Failed")
        self.assertEqual(self.record(result="Passed").status_code, 200)
        detail = self.client("staff").get(f"/api/students/{self.student_id}").get_json()
        self.assertEqual([r["result"] for r in detail["comprehensive_exam"]["history"]], ["Passed", "Failed"])

    def test_student_faculty_and_coordinator_cannot_record(self):
        for key in ("student", "faculty", "academic_coordinator", "dean"):
            self.assertEqual(self.record(key).status_code, 403, key)
        with app.app_context():
            self.assertEqual(db.session.get(Student, self.student_id).comprehensive_exam_status, "Not Taken")

    def test_admin_may_record(self):
        self.assertEqual(self.record("admin").status_code, 200)

    def test_future_date_bad_result_and_missing_reason_are_refused(self):
        future = (date.today() + timedelta(days=1)).isoformat()
        self.assertEqual(self.record(exam_date=future).status_code, 400)
        self.assertEqual(self.record(result="Maybe").status_code, 400)
        self.assertEqual(self.record(reason="").status_code, 400)
        self.assertEqual(self.record(exam_date="").status_code, 400)
        with app.app_context():
            self.assertEqual(db.session.get(Student, self.student_id).comprehensive_exam_status, "Not Taken")

    # ---- I-304 -------------------------------------------------------------------------
    def make_case(self, status="Dean Review"):
        with app.app_context():
            case = LeaveCase(student_id=self.student_id, kind="READMISSION", status=status, target_label="Term One",
                             submitted_at=now_utc())
            if status == "Approved":
                case.decided_at = now_utc()
                case.dean_remarks = "Enroll the two missing subjects first."
            db.session.add(case)
            db.session.flush()
            if status == "Approved":
                db.session.add(LeaveCaseEvent(case_id=case.id, from_status="Dean Review", to_status="Approved", action="approve",
                                              actor_user_id=self.ids["dean"], actor_role="Dean", actor_name="Test Dean"))
            db.session.commit()
            return case.id

    def test_advise_slip_is_refused_until_the_dean_approves(self):
        case_id = self.make_case("Dean Review")
        self.assertEqual(self.client("staff").get(f"/api/leave-cases/{case_id}/advise-slip").status_code, 404)
        self.assertEqual(self.client("other").get(f"/api/leave-cases/{case_id}/advise-slip").status_code, 403)
        detail = self.client("staff").get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertFalse(detail.get("advise_slip_url"))

    def test_advise_slip_after_approval_has_the_fields_and_is_scoped(self):
        case_id = self.make_case("Approved")
        for key in ("staff", "dean", "student"):
            response = self.client(key).get(f"/api/leave-cases/{case_id}/advise-slip")
            self.assertEqual(response.status_code, 200, key)
            self.assertIn("text/html", response.content_type)
            html = response.get_data(as_text=True)
            for text in ("Advise Slip", "Graduate School", "Ana Reyes", "GS-43-1", "Im43 Program", "Term One",
                         "Test Dean", "Enroll the two missing subjects first."):
                self.assertIn(text, html, f"{key}: {text}")
        self.assertEqual(self.client("other").get(f"/api/leave-cases/{case_id}/advise-slip").status_code, 403)
        self.assertEqual(self.client("faculty").get(f"/api/leave-cases/{case_id}/advise-slip").status_code, 403)
        detail = self.client("staff").get(f"/api/leave-cases/{case_id}").get_json()["case"]
        self.assertEqual(detail["advise_slip_url"], f"/api/leave-cases/{case_id}/advise-slip")

    def test_advise_slip_is_only_for_readmission_cases(self):
        with app.app_context():
            case = LeaveCase(student_id=self.student_id, kind="LOA", status="Approved")
            db.session.add(case)
            db.session.commit()
            case_id = case.id
        self.assertEqual(self.client("staff").get(f"/api/leave-cases/{case_id}/advise-slip").status_code, 404)


if __name__ == "__main__":
    unittest.main()
