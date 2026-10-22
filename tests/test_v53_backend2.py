"""v5.3 review fixes, backend side, part 2 (FULL-REVIEW-2026-10-22.md: F-05, F-12, F-17, F-18, F-39, I-047).

One demo database is built once for the whole module (building is slow). Tests that dirty it go back to the
copy taken right after the build (``restore_database``), so no test depends on the order the others ran in.
"""
import os
import shutil
import sqlite3
import tempfile
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch

from sqlalchemy import event

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
_BASELINE = _DB_FILE.name + ".baseline"
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm,
    AdviserAppointment,
    AdviserAssignment,
    AwolCase,
    LOGIN_THROTTLE,
    LeaveCase,
    MonitoringSheetUpload,
    OnboardingReview,
    Student,
    TermEnrollment,
    TransactionLog,
    UserAccount,
    WithdrawalApplication,
    app,
    build_demo_database,
    db,
    student_priority,
)

REGISTRAR_CHANGE_SLUGS = (
    "enrollment", "withdrawal", "course-adjustments", "leave-of-absence", "readmission", "awol", "graduation",
)
PASSWORD = "DemoPass123!"
STAFF_EMAIL = "staff@usls.edu.ph"
DEAN_EMAIL = "dean@usls.edu.ph"


def dump_database() -> dict:
    """Every row of every table exactly as stored (no normalising: a changed timestamp counts)."""
    connection = sqlite3.connect(f"file:{_DB_FILE.name}?mode=ro", uri=True)
    try:
        tables = [
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        ]
        return {
            table: sorted(repr(row) for row in connection.execute(f'SELECT * FROM "{table}"'))
            for table in tables
        }
    finally:
        connection.close()


def changed_tables(before: dict, after: dict) -> list:
    lines = []
    for table in sorted(set(before) | set(after)):
        if before.get(table) != after.get(table):
            lines.append(f"{table}: {len(before.get(table, []))} -> {len(after.get(table, []))} rows")
    return lines


def sign_in(email: str):
    client = app.test_client()
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, (email, response.status_code, response.get_data(as_text=True)[:300])
    return client


def account_for_student_number(student_number: str) -> UserAccount:
    student = Student.query.filter_by(student_number=student_number).first()
    return UserAccount.query.filter_by(student_id=student.id, role="student").order_by(UserAccount.id).first()


class V53Backend2Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.create_all()
            build_demo_database()
            db.session.commit()
            db.session.remove()
            db.engine.dispose()
        shutil.copyfile(_DB_FILE.name, _BASELINE)

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
            os.unlink(_BASELINE)
        except (FileNotFoundError, PermissionError):
            pass

    def setUp(self):
        LOGIN_THROTTLE.reset()
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        shutil.copyfile(_BASELINE, _DB_FILE.name)

    # ------------------------------------------------------------------ helpers
    def notifications(self, client, **params):
        response = client.get("/api/notifications", query_string={"limit": 200, **params})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        return response.get_json()

    def student_client_for(self, student_number: str):
        with app.app_context():
            email = account_for_student_number(student_number).email
        return sign_in(email)

    # ------------------------------------------------------------------ I-059 (F-05)
    def test_dean_approving_a_leave_of_absence_notifies_the_student_and_the_next_owner(self):
        student_client = self.student_client_for("2360074")  # Lorenzo Reyes: LOA with the Dean
        staff = sign_in(STAFF_EMAIL)
        staff_before = {item["id"] for item in self.notifications(staff)["items"]}
        before = self.notifications(student_client)
        with app.app_context():
            case = LeaveCase.query.filter_by(student_id=Student.query.filter_by(student_number="2360074").first().id).first()
            case_id = case.id
        dean = sign_in(DEAN_EMAIL)
        response = dean.post(f"/api/approvals/workflow/leave-of-absence/{case_id}/decide", json={"decision": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        after = self.notifications(student_client)
        known = {item["id"] for item in before["items"]}
        fresh = [item for item in after["items"] if item["id"] not in known]
        self.assertEqual(len(fresh), 1, fresh)
        self.assertIsNone(fresh[0]["read_at"])
        self.assertIn("approved", (fresh[0]["title"] + " " + (fresh[0]["body"] or "")).lower())
        self.assertEqual(after["unread_count"], before["unread_count"] + 1)
        # the next owner (Graduate School Staff, who tags the leave for the Registrar) hears of it too
        staff_new = [item for item in self.notifications(staff)["items"] if item["id"] not in staff_before]
        self.assertTrue(any("Lorenzo" in (item["title"] + (item["body"] or "")) for item in staff_new), staff_new)

    def test_dean_decision_on_a_practicum_report_notifies_the_student(self):
        student_client = self.student_client_for("2360101")  # Isabel Mendoza: practicum report with the Dean
        known = {item["id"] for item in self.notifications(student_client)["items"]}
        with app.app_context():
            from app import PracticumRecord
            record_id = PracticumRecord.query.filter_by(
                student_id=Student.query.filter_by(student_number="2360101").first().id).first().id
        dean = sign_in(DEAN_EMAIL)
        response = dean.post(f"/api/approvals/workflow/practicum/{record_id}/decide", json={"decision": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        fresh = [item for item in self.notifications(student_client)["items"] if item["id"] not in known]
        self.assertEqual(len(fresh), 1, fresh)
        self.assertIn("practicum", (fresh[0]["title"] + " " + (fresh[0]["body"] or "")).lower())

    def test_dean_decision_on_the_standalone_board_notifies_the_student_exactly_once(self):
        student_client = self.student_client_for("2360087")  # Hazel Flores: subject withdrawal with the Dean
        known = {item["id"] for item in self.notifications(student_client)["items"]}
        with app.app_context():
            application_id = WithdrawalApplication.query.filter_by(
                student_id=Student.query.filter_by(student_number="2360087").first().id).first().id
        dean = sign_in(DEAN_EMAIL)
        response = dean.post(f"/api/process-cases/withdrawal/{application_id}/transition", json={"action": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        fresh = [item for item in self.notifications(student_client)["items"] if item["id"] not in known]
        self.assertEqual(len(fresh), 1, fresh)
        self.assertIn("withdrawal", (fresh[0]["title"] + " " + (fresh[0]["body"] or "")).lower())

    def test_staff_moving_a_standalone_case_notifies_the_student_and_the_dean(self):
        # Hazel Flores's withdrawal is with the Dean; send it back to staff first by using the Dean's own queue
        # is not possible, so use the AWOL return: staff forward is the first step for a fresh return.
        student_client = self.student_client_for("2360087")
        dean = sign_in(DEAN_EMAIL)
        dean_known = {item["id"] for item in self.notifications(dean)["items"]}
        known = {item["id"] for item in self.notifications(student_client)["items"]}
        with app.app_context():
            application = WithdrawalApplication.query.filter_by(
                student_id=Student.query.filter_by(student_number="2360087").first().id).first()
            application.status, application.dean_decision = "Submitted to GS Staff", "Pending"
            application_id = application.id
            db.session.commit()
        staff = sign_in(STAFF_EMAIL)
        response = staff.post(f"/api/process-cases/withdrawal/{application_id}/transition", json={"action": "forward"})
        self.assertEqual(response.status_code, 200, response.get_json())
        fresh = [item for item in self.notifications(student_client)["items"] if item["id"] not in known]
        self.assertEqual(len(fresh), 1, fresh)
        dean_fresh = [item for item in self.notifications(dean)["items"] if item["id"] not in dean_known]
        self.assertTrue(any("Hazel" in (item["title"] + (item["body"] or "")) for item in dean_fresh), dean_fresh)

    def test_graduation_batch_approval_notifies_the_student(self):
        student_client = self.student_client_for("2360008")  # Hector Ong: endorsement ready for the Dean
        known = {item["id"] for item in self.notifications(student_client)["items"]}
        with app.app_context():
            student_id = Student.query.filter_by(student_number="2360008").first().id
        dean = sign_in(DEAN_EMAIL)
        response = dean.post("/api/graduation/batch-actions", json={"student_ids": [student_id], "action": "approve"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(response.get_json()["updated"]), 1, response.get_json())
        fresh = [item for item in self.notifications(student_client)["items"] if item["id"] not in known]
        self.assertEqual(len(fresh), 1, fresh)
        self.assertIn("graduation", (fresh[0]["title"] + " " + (fresh[0]["body"] or "")).lower())


if __name__ == "__main__":
    unittest.main()
