"""Public-site hardening before User Acceptance Testing at https://miguisanson.dev.

Seven small guards: hide the demo accounts panel on request, restrict the demo reset to staff,
limit Policy Assistant questions per account, cap upload size with a clean 413, treat empty env
values as unset, send basic security headers, and let SQLite handle several waitress threads.
Uses its own temporary SQLite database, created before ``app`` is imported.
"""
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    LOGIN_THROTTLE,
    WORKFLOW_DEMO_STUDENTS,
    Course,
    Program,
    Student,
    UserAccount,
    app,
    db,
    generate_password_hash,
)

PASSWORD = "DemoPass123!"
APP_SOURCE = Path(app_module.__file__).read_text(encoding="utf-8")


class HardeningBase(unittest.TestCase):
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
        LOGIN_THROTTLE.reset()
        if hasattr(app_module, "ASSISTANT_LIMITER"):
            app_module.ASSISTANT_LIMITER.reset()
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="HRD", name="Hardening Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            db.session.add(Course(program_id=program.id, code="HRD-501", title="Course", units=3, category="Major"))
            student = Student(
                student_number="GS-HRD-A", first_name="Alice", last_name="Alpha", email="a@example.test",
                program_id=program.id, entry_year=2025, academic_year_entry="25-26", year_level="1",
                current_stage="Coursework", standing="Active",
            )
            db.session.add(student)
            db.session.flush()
            for email, role, student_id in [
                ("staff@usls.edu.ph", "staff", None),
                ("admin@usls.edu.ph", "admin", None),
                ("faculty@usls.edu.ph", "faculty", None),
                ("alice@usls.edu.ph", "student", student.id),
            ]:
                db.session.add(UserAccount(
                    email=email, full_name=f"Test {role}", password_hash=generate_password_hash(PASSWORD),
                    role=role, student_id=student_id, active=True,
                ))
            db.session.commit()

    def tearDown(self):
        LOGIN_THROTTLE.reset()

    def signed_in(self, email):
        client = app.test_client()
        response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
        self.assertEqual(response.status_code, 200, response.get_json())
        return client


class DemoAccountsSwitchTests(HardeningBase):
    def test_item1_accounts_endpoints_answer_by_default_and_when_the_value_is_empty(self):
        for value in (None, ""):
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("DEMO_SHOW_ACCOUNTS", None)
                if value is not None:
                    os.environ["DEMO_SHOW_ACCOUNTS"] = value
                client = app.test_client()
                self.assertEqual(client.get("/api/auth/demo-accounts").status_code, 200, value)
                self.assertEqual(client.get("/api/auth/demo-students").status_code, 200, value)
                self.assertIs(client.get("/api/auth/config").get_json()["show_accounts"], True)

    def test_item1_switch_off_hides_accounts_but_keeps_demo_mode(self):
        with patch.dict(os.environ, {"DEMO_SHOW_ACCOUNTS": "0"}):
            client = app.test_client()
            for path in ("/api/auth/demo-accounts", "/api/auth/demo-students"):
                response = client.get(path)
                self.assertEqual(response.status_code, 404, path)
                self.assertNotIn(PASSWORD, response.get_data(as_text=True))
            config = client.get("/api/auth/config").get_json()
            self.assertIs(config["show_accounts"], False)
            self.assertIs(config["demo_mode"], True, "the staff Reset button still needs demo mode")


class DemoResetRoleTests(HardeningBase):
    RESET = f"/api/auth/demo-students/{next(iter(WORKFLOW_DEMO_STUDENTS))}/reset"

    def test_item2_students_and_faculty_get_403(self):
        for email in ("alice@usls.edu.ph", "faculty@usls.edu.ph"):
            response = self.signed_in(email).post(self.RESET, json={})
            self.assertEqual(response.status_code, 403, email)
            self.assertIn("staff", response.get_json()["error"].lower())

    def test_item2_staff_and_admin_still_pass_the_role_check(self):
        for email in ("staff@usls.edu.ph", "admin@usls.edu.ph"):
            response = self.signed_in(email).post(self.RESET, json={})
            self.assertNotIn(response.status_code, (401, 403), email)  # 404: demo student not seeded here


class AssistantLimitTests(HardeningBase):
    @staticmethod
    def fake_payload(*_args, **_kwargs):
        return {"answer": "ok", "mode": "test", "citations": [], "grounded": None, "recommendations": [], "student": None}

    def ask(self, client, path):
        with patch.object(app_module, "generate_answer", self.fake_payload), \
                patch.object(app_module, "generate_student_answer", self.fake_payload):
            return client.post(path, json={"question": "What is the residency limit?"})

    def test_item3_staff_over_the_hourly_limit_gets_429(self):
        with patch.dict(os.environ, {"ASSISTANT_MAX_PER_HOUR": "2"}):
            staff = self.signed_in("staff@usls.edu.ph")
            self.assertEqual(self.ask(staff, "/api/assistant").status_code, 200)
            self.assertEqual(self.ask(staff, "/api/assistant").status_code, 200)
            third = self.ask(staff, "/api/assistant")
            self.assertEqual(third.status_code, 429)
            self.assertEqual(
                third.get_json()["error"],
                "You have asked many questions in the last hour. Please try again later.",
            )

    def test_item3_student_portal_route_is_limited_per_account(self):
        with patch.dict(os.environ, {"ASSISTANT_MAX_PER_HOUR": "2"}):
            student = self.signed_in("alice@usls.edu.ph")
            self.assertEqual(self.ask(student, "/api/student-portal/assistant").status_code, 200)
            self.assertEqual(self.ask(student, "/api/assistant").status_code, 200)  # same account, same budget
            self.assertEqual(self.ask(student, "/api/student-portal/assistant").status_code, 429)
            # Another account is not affected.
            self.assertEqual(self.ask(self.signed_in("staff@usls.edu.ph"), "/api/assistant").status_code, 200)

    def test_item3_default_limit_is_30(self):
        with patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ASSISTANT_MAX_PER_HOUR", None)
            staff = self.signed_in("staff@usls.edu.ph")
            codes = [self.ask(staff, "/api/assistant").status_code for _ in range(31)]
        self.assertEqual(codes[:30], [200] * 30)
        self.assertEqual(codes[30], 429)


class UploadLimitTests(HardeningBase):
    def test_item4_default_limit_is_30_mb(self):
        self.assertEqual(app.config.get("MAX_CONTENT_LENGTH"), 30 * 1024 * 1024)

    def test_item4_oversize_body_gets_a_json_413(self):
        with patch.dict(app.config, {"MAX_CONTENT_LENGTH": 1000}):
            response = app.test_client().post("/api/auth/login", json={"email": "x" * 5000, "password": "y"})
        self.assertEqual(response.status_code, 413)
        self.assertTrue(response.is_json)
        self.assertIn("too large", response.get_json()["error"])


class EmptyEnvTests(HardeningBase):
    def test_item5_empty_values_mean_unset(self):
        with patch.dict(os.environ, {"X_TEST_INT": "", "X_TEST_FLOAT": "  "}):
            self.assertEqual(app_module.env_int("X_TEST_INT", 7), 7)
            self.assertEqual(app_module.env_float("X_TEST_FLOAT", 1.5), 1.5)
        with patch.dict(os.environ, {"X_TEST_INT": "9", "X_TEST_FLOAT": "2.5"}):
            self.assertEqual(app_module.env_int("X_TEST_INT", 7), 9)
            self.assertEqual(app_module.env_float("X_TEST_FLOAT", 1.5), 2.5)
        os.environ.pop("X_TEST_INT", None)
        self.assertEqual(app_module.env_int("X_TEST_INT", 7), 7)

    def test_item5_empty_login_setting_no_longer_crashes(self):
        with patch.dict(os.environ, {"LOGIN_MAX_FAILURES": "", "LOGIN_LOCKOUT_SECONDS": ""}):
            throttle = app_module.LoginThrottle()
        self.assertEqual(throttle.max_failures, 5)
        self.assertEqual(throttle.lockout_seconds, 30)

    def test_item5_no_raw_numeric_env_reads_remain(self):
        raw = re.findall(r"(?:int|float)\(\s*(?:os\.getenv|os\.environ\.get|environ\.get)\(", APP_SOURCE)
        self.assertEqual(raw, [], "use env_int / env_float so an empty value means unset")


class SecurityHeaderTests(HardeningBase):
    def test_item6_headers_on_api_and_spa_responses(self):
        client = app.test_client()
        for path in ("/api/health", "/api/does-not-exist"):
            headers = client.get(path).headers
            self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff", path)
            self.assertEqual(headers.get("X-Frame-Options"), "SAMEORIGIN", path)
            self.assertEqual(headers.get("Referrer-Policy"), "strict-origin-when-cross-origin", path)


class SqlitePragmaTests(HardeningBase):
    def test_item7_new_connections_use_wal_and_a_busy_timeout(self):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
            self.assertEqual(db.session.execute(app_module.text("PRAGMA journal_mode")).scalar().lower(), "wal")
            self.assertEqual(db.session.execute(app_module.text("PRAGMA busy_timeout")).scalar(), 5000)


class SeededLeaveTests(unittest.TestCase):
    """Item 8: the demo leave must still be a leave on the day the seed is built."""

    @classmethod
    def setUpClass(cls):
        with app.app_context():
            app_module.build_demo_database()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()

    def test_item8_therese_lacson_is_on_leave_not_return_due(self):
        from datetime import date, timedelta
        with app.app_context():
            student = Student.query.filter_by(student_number="2690901").one()
            case = app_module.LeaveCase.query.filter_by(
                student_id=student.id, kind=app_module.KIND_LOA, source="demo").one()
            due_days = int(app_module.rule_value("leave.return_due_days", 30) or 30)
            end = app_module.leave_end_date(case)
            self.assertEqual(case.status, "On Leave")
            self.assertGreater(end - timedelta(days=due_days), date.today(), "her leave would flip to Return Due")


if __name__ == "__main__":
    unittest.main()
