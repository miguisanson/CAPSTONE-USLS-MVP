"""Private demo sandbox per visitor (owner 2026-11-05, contract .planning/demo-sandbox/CONTRACT.md).

On the shared demo site every visitor used ONE database, so two people (or one account on two machines) running a
Demo Guide changed the same records and the same "Skip date waits" switch. With DEMO_MODE and DEMO_SANDBOX on, each
browser gets its own copy of the demo database (cookie `usls_sandbox`); POST /api/demo/sandbox/reset gives it a
fresh copy, which is how a Demo Guide starts from the top every time.
"""

import os
import re
import shutil
import tempfile
import time
import unittest
from datetime import date
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import Program, Student, UserAccount, app, db, generate_password_hash  # noqa: E402

COOKIE = "usls_sandbox"
ID_RE = re.compile(r"^[0-9a-f]{32}$")


class DemoSandboxTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            app_module.dispose_demo_sandboxes()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        self.box_dir = tempfile.mkdtemp(prefix="sandbox-test-")
        self.env = patch.dict(os.environ, {"DEMO_MODE": "1", "DEMO_SANDBOX": "1", "DEMO_SANDBOX_DIR": self.box_dir})
        self.env.start()
        app_module.dispose_demo_sandboxes()
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="SBX", name="Sandbox Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            db.session.add(Student(
                student_number="2690001", first_name="Sandy", last_name="Original", email="sandy@example.test",
                program_id=program.id, entry_year=date.today().year - 1, academic_year_entry="25-26",
                year_level="1", current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
            ))
            staff = UserAccount(email="staff@example.test", full_name="Sam Staff", role="staff",
                                password_hash=generate_password_hash("x"), privacy_consent_at=app_module.now_utc(),
                                privacy_notice_version=app_module.PRIVACY_NOTICE_VERSION)
            db.session.add(staff)
            db.session.commit()
            self.staff_id = staff.id
        app_module.refresh_demo_sandbox_template()

    def tearDown(self):
        app_module.dispose_demo_sandboxes()
        self.env.stop()
        app_module.DEMO_RUNTIME["skip_date_waits"] = None
        shutil.rmtree(self.box_dir, ignore_errors=True)

    # -- helpers
    def visitor(self):
        client = app.test_client()
        response = client.get("/api/auth/config")
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        cookie = client.get_cookie(COOKIE)
        self.assertIsNotNone(cookie, "every visitor gets a sandbox cookie")
        self.assertRegex(cookie.value, ID_RE)
        return client, cookie.value

    def last_name_in(self, sandbox_id):
        with app.test_request_context("/api/auth/config", headers={"Cookie": f"{COOKIE}={sandbox_id}"}):
            app.preprocess_request()
            name = Student.query.filter_by(student_number="2690001").one().last_name
            db.session.remove()
            return name

    def rename_in(self, sandbox_id, last_name):
        with app.test_request_context("/api/auth/config", headers={"Cookie": f"{COOKIE}={sandbox_id}"}):
            app.preprocess_request()
            Student.query.filter_by(student_number="2690001").one().last_name = last_name
            db.session.commit()
            db.session.remove()

    def main_last_name(self):
        with app.app_context():
            return Student.query.filter_by(student_number="2690001").one().last_name

    # -- tests
    def test_two_visitors_get_their_own_copy_and_never_see_each_others_writes(self):
        _a, box_a = self.visitor()
        _b, box_b = self.visitor()
        self.assertNotEqual(box_a, box_b)
        self.rename_in(box_a, "ChangedByA")
        self.assertEqual(self.last_name_in(box_a), "ChangedByA")
        self.assertEqual(self.last_name_in(box_b), "Original")
        self.assertEqual(self.main_last_name(), "Original", "the shared demo database is never written by a visitor")

    def test_the_same_browser_keeps_its_sandbox_across_requests_and_sign_ins(self):
        client, box = self.visitor()
        with client.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"
        client.get("/api/auth/me")
        client.post("/api/auth/logout")
        self.assertEqual(client.get_cookie(COOKIE).value, box)

    def test_reset_gives_this_visitor_a_fresh_copy_only(self):
        client_a, box_a = self.visitor()
        _b, box_b = self.visitor()
        self.rename_in(box_a, "ChangedByA")
        self.rename_in(box_b, "ChangedByB")
        response = client_a.post("/api/demo/sandbox/reset")
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(response.get_json(), {"ok": True, "sandbox": True})
        new_box = client_a.get_cookie(COOKIE).value
        self.assertEqual(self.last_name_in(new_box), "Original")
        self.assertEqual(self.last_name_in(box_b), "ChangedByB", "a reset never touches another visitor")

    def test_a_forged_cookie_gets_a_new_sandbox_and_no_file_outside_the_folder(self):
        client = app.test_client()
        client.set_cookie(COOKIE, "../../etc/passwd")
        client.get("/api/auth/config")
        value = client.get_cookie(COOKIE).value
        self.assertRegex(value, ID_RE)
        for name in os.listdir(self.box_dir):
            self.assertTrue(name.endswith(".sqlite3"), name)

    def test_off_without_demo_mode_or_with_demo_sandbox_0(self):
        for env in ({"DEMO_SANDBOX": "0"}, {"DEMO_MODE": "0"}):
            with self.subTest(env=env), patch.dict(os.environ, env):
                client = app.test_client()
                client.get("/api/auth/config")
                self.assertIsNone(client.get_cookie(COOKIE))
                if env.get("DEMO_MODE") != "0":
                    response = client.post("/api/demo/sandbox/reset")
                    self.assertEqual(response.get_json(), {"ok": True, "sandbox": False})

    def test_the_skip_date_waits_switch_belongs_to_one_visitor(self):
        client_a, box_a = self.visitor()
        _b, box_b = self.visitor()
        with client_a.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"
        response = client_a.post("/api/auth/demo-settings", json={"skip_date_waits": False})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertFalse(response.get_json()["skip_date_waits"])
        with app.test_request_context("/", headers={"Cookie": f"{COOKIE}={box_b}"}):
            app.preprocess_request()
            self.assertTrue(app_module.demo_skip_date_waits(), "visitor B keeps the default")
        with app.test_request_context("/", headers={"Cookie": f"{COOKIE}={box_a}"}):
            app.preprocess_request()
            self.assertFalse(app_module.demo_skip_date_waits())

    def test_idle_sandboxes_are_removed(self):
        _a, box_a = self.visitor()
        app_module.dispose_demo_sandboxes()  # release the file so it can be aged and removed
        old = time.time() - 3 * 24 * 3600
        path = os.path.join(self.box_dir, f"{box_a}.sqlite3")
        self.assertTrue(os.path.exists(path))
        os.utime(path, (old, old))
        app_module.remove_idle_demo_sandboxes()
        self.assertFalse(os.path.exists(path))


    def test_health_checks_never_make_a_sandbox(self):
        client = app.test_client()
        for _ in range(3):
            client.get("/api/health")
        self.assertIsNone(client.get_cookie(COOKIE))
        self.assertEqual([n for n in os.listdir(self.box_dir) if n != "_template.sqlite3"], [])

    def test_a_new_seed_drops_every_old_sandbox(self):
        """After a reseed (possibly a new schema) no visitor may keep a copy with the old tables."""
        _a, box_a = self.visitor()
        app_module.dispose_demo_sandboxes()
        app_module.refresh_demo_sandbox_template(drop_existing=True)
        self.assertFalse(os.path.exists(os.path.join(self.box_dir, f"{box_a}.sqlite3")))
        self.assertTrue(os.path.exists(os.path.join(self.box_dir, "_template.sqlite3")))

    def test_the_number_of_sandboxes_is_capped(self):
        with patch.dict(os.environ, {"DEMO_SANDBOX_MAX": "2"}):
            boxes = [self.visitor()[1] for _ in range(4)]
        left = sorted(n[:-8] for n in os.listdir(self.box_dir) if n != "_template.sqlite3" and n.endswith(".sqlite3"))
        self.assertLessEqual(len(left), 2)
        self.assertIn(boxes[-1], left, "the newest visitor keeps a sandbox")


if __name__ == "__main__":
    unittest.main()
