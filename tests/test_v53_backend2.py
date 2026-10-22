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

    # ------------------------------------------------------------------ I-071 (F-17)
    def _make_stale_risk(self) -> int:
        with app.app_context():
            student = Student.query.order_by(Student.id).first()
            wrong = "Delayed" if student_priority(student)["level"] != "Delayed" else "On Track"
            student.risk_level = wrong
            db.session.commit()
            return student.id

    def _make_stale_awol(self) -> int:
        """A student whose latest semester is Withdrawn with no leave: the sweep would open an AWOL case."""
        with app.app_context():
            for student in Student.query.filter(Student.enrollment_tag == "Enrolled").order_by(Student.id).all():
                term_row = (
                    TermEnrollment.query.filter_by(student_id=student.id).join(AcademicTerm)
                    .order_by(AcademicTerm.start_date.desc(), TermEnrollment.id.desc()).first()
                )
                if term_row is None or AwolCase.query.filter_by(student_id=student.id).first():
                    continue
                term_row.status = "Withdrawn"
                db.session.commit()
                return student.id
        self.fail("no student to make stale")

    def _get_changes_nothing(self, client, url, **kwargs):
        before = dump_database()
        response = client.get(url, **kwargs)
        self.assertEqual(response.status_code, 200, (url, response.get_data(as_text=True)[:300]))
        self.assertEqual(changed_tables(before, dump_database()), [], url)
        return response

    def test_dashboard_and_reports_gets_change_nothing_even_when_risk_and_awol_are_stale(self):
        self._make_stale_risk()
        self._make_stale_awol()
        staff = sign_in(STAFF_EMAIL)
        for url in ("/api/dashboard", "/api/dashboard/drilldown?type=risk&value=Delayed", "/api/reports",
                    "/api/reports/analytics", "/api/students"):
            self._get_changes_nothing(staff, url)

    def test_explicit_refresh_post_does_the_sweeps_the_gets_no_longer_do(self):
        student_id = self._make_stale_risk()
        awol_student_id = self._make_stale_awol()
        staff = sign_in(STAFF_EMAIL)
        response = staff.post("/api/maintenance/refresh", json={})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertTrue(response.get_json()["ok"])
        with app.app_context():
            student = db.session.get(Student, student_id)
            self.assertEqual(student.risk_level, student_priority(student)["level"])
            self.assertIsNotNone(AwolCase.query.filter_by(student_id=awol_student_id).first())
        # students cannot trigger it
        student_client = self.student_client_for("2360074")
        self.assertEqual(student_client.post("/api/maintenance/refresh", json={}).status_code, 403)

    def test_leave_board_get_changes_nothing_when_an_old_log_has_no_case_yet(self):
        staff = sign_in(STAFF_EMAIL)  # signing in first: today it also adopts old logs (I-072)
        with app.app_context():
            free = (
                Student.query.filter(~Student.id.in_(db.session.query(LeaveCase.student_id)))
                .order_by(Student.id).first()
            )
            db.session.add(TransactionLog(
                transaction_slug="leave-of-absence", student_id=free.id, actor_role="Student",
                source_reference="legacy", result="LOA application submitted", next_owner="Graduate School Staff",
                notes="old log row", new_status="Submitted",
            ))
            db.session.commit()
            student_id = free.id
        self._get_changes_nothing(staff, "/api/leave-cases?slug=leave-of-absence")
        self._get_changes_nothing(staff, "/api/leave-cases?slug=readmission")
        # the explicit refresh turns the old log into a case
        self.assertEqual(staff.post("/api/leave-cases/sync", json={}).status_code, 200)
        with app.app_context():
            self.assertIsNotNone(LeaveCase.query.filter_by(student_id=student_id).first())

    def test_onboarding_reviews_get_changes_nothing_and_the_upload_makes_the_review(self):
        with app.app_context():
            self.assertEqual(OnboardingReview.query.count(), 0)
            db.session.add(MonitoringSheetUpload(
                original_name="sheet.xlsx", stored_name="stale-upload-test.xlsx", program_code="MIT",
                row_count=1, subject_count=1, snapshot_json="{}", result_json="{}",
            ))
            db.session.commit()
        staff = sign_in(STAFF_EMAIL)
        self._get_changes_nothing(staff, "/api/onboarding/reviews")
        # the maintenance refresh is what builds the missing review rows
        self.assertEqual(staff.post("/api/maintenance/refresh", json={}).status_code, 200)
        with app.app_context():
            self.assertEqual(OnboardingReview.query.count(), 1)
        self._get_changes_nothing(staff, "/api/onboarding/reviews")

    def test_adviser_tracker_get_changes_nothing_for_a_student_with_an_old_adviser_record(self):
        with app.app_context():
            from app import Faculty
            student = (
                Student.query.filter(~Student.id.in_(db.session.query(AdviserAppointment.student_id)))
                .filter(Student.id.in_(db.session.query(UserAccount.student_id).filter(UserAccount.role == "student")))
                .order_by(Student.id).first()
            )
            self.assertIsNotNone(student)
            db.session.add(AdviserAssignment(student_id=student.id, faculty_id=Faculty.query.first().id, status="Active"))
            db.session.commit()
            email = UserAccount.query.filter_by(student_id=student.id, role="student").first().email
        client = sign_in(email)
        self._get_changes_nothing(client, "/api/student-portal/adviser")

    def test_notifications_get_changes_nothing_and_reminders_come_from_an_explicit_refresh(self):
        with app.app_context():
            from app import SLOT_HOLDING_DEFENSE_STATUSES, ScheduleRequest, schedule_panel_ids
            email = None
            for schedule in ScheduleRequest.query.filter(
                    ScheduleRequest.status.in_(SLOT_HOLDING_DEFENSE_STATUSES)).order_by(ScheduleRequest.id).all():
                for faculty_id in sorted(schedule_panel_ids(schedule)):
                    account = UserAccount.query.filter_by(faculty_id=faculty_id, role="faculty", active=True).first()
                    if account:
                        email = account.email
                        break
                if email:
                    schedule.preferred_date = date.today() + timedelta(days=1)  # a reminder is due today
                    break
            self.assertIsNotNone(email, "no booked defense has a panel member with an account")
            db.session.commit()
        client = sign_in(email)
        before = self._get_changes_nothing(client, "/api/notifications", query_string={"limit": 200}).get_json()
        response = client.post("/api/notifications/refresh", json={})
        self.assertEqual(response.status_code, 200, response.get_json())
        refreshed = response.get_json()
        self.assertGreater(len(refreshed["items"]), len(before["items"]))
        self.assertGreater(refreshed["unread_count"], before["unread_count"])
        # the next read shows the same list without writing anything
        again = self._get_changes_nothing(client, "/api/notifications").get_json()
        self.assertEqual([item["id"] for item in again["items"]], [item["id"] for item in refreshed["items"]])
        # marking read is a POST
        self.assertEqual(client.post(f"/api/notifications/{again['items'][0]['id']}/read", json={}).status_code, 200)

    # ------------------------------------------------------------------ I-072 (F-18)
    def test_signing_in_writes_no_data(self):
        # a leave that should have started by now, and a demo persona whose baseline would be repaired
        with app.app_context():
            case = LeaveCase.query.filter_by(kind="LOA", status="Leave Scheduled").first()
            if case is None:
                case = LeaveCase.query.filter_by(kind="LOA", status="Dean Review").first()
                case.status = "Leave Scheduled"
            case.start_term_id = AcademicTerm.query.order_by(AcademicTerm.start_date).first().id
            case.end_term_id = case.start_term_id
            db.session.commit()
            case_id = case.id
        for email in (STAFF_EMAIL, DEAN_EMAIL, "practicum.andrea@usls.edu.ph", "loa.daniel@usls.edu.ph"):
            LOGIN_THROTTLE.reset()
            before = dump_database()
            with patch.dict(os.environ, {"DEMO_MODE": "1"}):
                client = app.test_client()
                response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
            self.assertEqual(response.status_code, 200, (email, response.get_json()))
            self.assertEqual(changed_tables(before, dump_database()), [], email)
        with app.app_context():
            self.assertEqual(db.session.get(LeaveCase, case_id).status, "Leave Scheduled")

    # ------------------------------------------------------------------ I-066 (F-12)
    def test_each_coordinator_gets_a_dashboard_holding_only_their_own_work(self):
        labels = {"academic@usls.edu.ph": "Academic Coordinator", "research@usls.edu.ph": "Research Coordinator"}
        with app.app_context():
            from app import Task
            student_id = Student.query.order_by(Student.id).first().id
            for label in labels.values():  # the seed gives the Research Coordinator no open work, so plant one each
                db.session.add(Task(student_id=student_id, title=f"Own work of the {label}", owner_role=label,
                                    due_at=date.today() + timedelta(days=3), status="Pending", priority=99))
            db.session.commit()
        for email, label in labels.items():
            client = sign_in(email)
            response = client.get("/api/dashboard")
            self.assertEqual(response.status_code, 200, (email, response.get_json()))
            payload = response.get_json()
            tasks = payload["open_tasks"]
            self.assertIn(f"Own work of the {label}", [task["title"] for task in tasks], email)
            self.assertEqual({task["owner_role"] for task in tasks}, {label}, email)
            self.assertEqual([row["owner"] for row in payload["tasks_by_owner"]], [label], email)
            own = client.get("/api/tasks", query_string={"owner": label, "page_size": 200}).get_json()
            derived = [item for item in own["items"] if not item.get("student_id")]
            self.assertEqual(payload["kpis"]["pending_tasks"], own["total"] - len(derived), email)
            self.assertEqual(payload["viewer"], {"role": email.split("@")[0] + "_coordinator", "owner": label})

    def test_staff_dashboard_is_unchanged_by_the_coordinator_filter(self):
        staff = sign_in(STAFF_EMAIL).get("/api/dashboard").get_json()
        owners = {row["owner"] for row in staff["tasks_by_owner"]}
        self.assertGreater(len(owners), 1)

    # ------------------------------------------------------------------ I-093 (F-39)
    def test_student_directory_query_count_does_not_grow_with_the_page_size(self):
        staff = sign_in(STAFF_EMAIL)
        counts = {}
        for size in (10, 25):
            statements = []

            def count(conn, cursor, statement, parameters, context, executemany):
                statements.append(statement)

            with app.app_context():
                event.listen(db.engine, "before_cursor_execute", count)
            try:
                response = staff.get("/api/students", query_string={"page_size": size})
            finally:
                with app.app_context():
                    event.remove(db.engine, "before_cursor_execute", count)
            self.assertEqual(response.status_code, 200)
            self.assertEqual(len(response.get_json()["items"]), size)
            counts[size] = len(statements)
        self.assertLess(counts[25] - counts[10], 5, counts)

    def test_student_directory_rows_keep_their_comprehensive_exam_answer(self):
        staff = sign_in(STAFF_EMAIL)
        rows = staff.get("/api/students", query_string={"page_size": 25}).get_json()["items"]
        from app import comprehensive_exam_eligibility
        with app.app_context():
            for row in rows[:8]:
                expected = comprehensive_exam_eligibility(db.session.get(Student, row["id"]))
                self.assertEqual(row["compre_eligibility"], expected, row["id"])
        self.assertTrue(any(row["program_code"] for row in rows))
        # the "eligible for the comprehensive exam" filter keeps exactly the students the per-student rule keeps
        listed = staff.get("/api/students", query_string={"student_status": "compre-eligible", "page_size": 100}).get_json()
        with app.app_context():
            expected = {
                student.id for student in Student.query.all()
                if comprehensive_exam_eligibility(student)["eligible"]
            }
        self.assertLessEqual(len(expected), 100)
        self.assertEqual({row["id"] for row in listed["items"]}, expected)
        self.assertEqual(listed["total"], len(expected))


if __name__ == "__main__":
    unittest.main()
