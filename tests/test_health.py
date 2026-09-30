"""Sign-in, demo-mode, access-control and startup checks (DEFENSE_REVISIONS F2).

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

from app import (  # noqa: E402
    API_ROLE_REGISTRY,
    LOGIN_THROTTLE,
    REQUEST_UPLOAD_ROOT,
    UPLOAD_ROOT,
    Course,
    DocumentCheck,
    Program,
    ResearchEvidenceFile,
    Student,
    StudentRequestAttachment,
    UserAccount,
    WorkflowMessage,
    app,
    db,
    demo_mode_enabled,
    generate_password_hash,
    resolve_secret_key,
    run_startup_tasks,
    should_run_startup_tasks,
)

DEMO_PASSWORD = "DemoPass123!"
REPO_ROOT = Path(__file__).resolve().parents[1]

# Anonymous callers may reach ONLY these API routes (method, rule). Everything
# else under /api/ must answer 401 or 403 without a session.
PUBLIC_API_ROUTES = {
    ("GET", "/api/health"),
    ("GET", "/api/auth/me"),
    ("GET", "/api/auth/config"),
    ("POST", "/api/auth/login"),
    ("POST", "/api/auth/logout"),
}
# Demo conveniences: public while DEMO_MODE is on, 404 while it is off.
DEMO_API_ROUTES = {
    ("GET", "/api/auth/demo-students"),
    ("GET", "/api/auth/demo-accounts"),
    ("POST", "/api/auth/demo-students/<demo_key>/reset"),
}


def _sample_path(rule: str) -> str:
    return re.sub(r"<[^>]+>", "1", rule)


def _api_routes():
    for rule in app.url_map.iter_rules():
        if not rule.rule.startswith("/api/"):
            continue
        for method in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            yield method, rule


def _call(client, method, path):
    if method == "GET":
        return client.get(path)
    return client.open(path, method=method, json={})


class HealthTestBase(unittest.TestCase):
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
        self.created_files = []
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="HLT", name="Health Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            db.session.add(Course(program_id=program.id, code="HLT-501", title="Course", units=3, category="Major"))
            self.student_a = self._student(program, "GS-HLT-A", "Alice", "Alpha")
            self.student_b = self._student(program, "GS-HLT-B", "Bruno", "Bravo")
            student_a_id, student_b_id = self.student_a.id, self.student_b.id
            self.accounts = {}
            for key, email, role, student in [
                ("staff", "staff@usls.edu.ph", "staff", None),
                ("admin", "admin@usls.edu.ph", "admin", None),
                ("dean", "dean@usls.edu.ph", "dean", None),
                ("faculty", "faculty@usls.edu.ph", "faculty", None),
                ("student_a", "alice@usls.edu.ph", "student", self.student_a),
                ("student_b", "bruno@usls.edu.ph", "student", self.student_b),
            ]:
                account = UserAccount(
                    email=email,
                    full_name=f"Test {key}",
                    password_hash=generate_password_hash(DEMO_PASSWORD),
                    role=role,
                    student_id=student.id if student else None,
                    active=True,
                )
                db.session.add(account)
                db.session.flush()
                self.accounts[key] = account.id
            db.session.commit()
            self.student_a_id, self.student_b_id = student_a_id, student_b_id

    def tearDown(self):
        LOGIN_THROTTLE.reset()
        for path in self.created_files:
            path.unlink(missing_ok=True)

    @staticmethod
    def _student(program, number, first, last):
        student = Student(
            student_number=number,
            first_name=first,
            last_name=last,
            email=f"{first.lower()}@example.test",
            program_id=program.id,
            entry_year=2025,
            academic_year_entry="25-26",
            year_level="1",
            current_stage="Coursework",
            standing="Active",
        )
        db.session.add(student)
        db.session.flush()
        return student

    def login(self, email, password=DEMO_PASSWORD, client=None, **extra):
        client = client or app.test_client()
        response = client.post("/api/auth/login", json={"email": email, "password": password, **extra})
        return client, response

    def signed_in(self, key):
        email = {
            "staff": "staff@usls.edu.ph", "admin": "admin@usls.edu.ph", "dean": "dean@usls.edu.ph",
            "faculty": "faculty@usls.edu.ph", "student_a": "alice@usls.edu.ph", "student_b": "bruno@usls.edu.ph",
        }[key]
        client, response = self.login(email)
        self.assertEqual(response.status_code, 200, response.get_json())
        return client


class DemoModeTests(HealthTestBase):
    def test_demo_mode_defaults_to_on_and_reads_the_environment(self):
        with patch.dict(os.environ, clear=False):
            os.environ.pop("DEMO_MODE", None)
            self.assertTrue(demo_mode_enabled())
        for off in ("0", "false", "no", "off", "OFF"):
            with patch.dict(os.environ, {"DEMO_MODE": off}):
                self.assertFalse(demo_mode_enabled(), off)
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            self.assertTrue(demo_mode_enabled())

    def test_demo_mode_off_hides_every_demo_endpoint_and_leaks_no_password(self):
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            client = app.test_client()
            config = client.get("/api/auth/config")
            self.assertEqual(config.status_code, 200)
            self.assertIs(config.get_json()["demo_mode"], False)
            self.assertNotIn(DEMO_PASSWORD, config.get_data(as_text=True))
            for method, path in [
                ("GET", "/api/auth/demo-students"),
                ("GET", "/api/auth/demo-accounts"),
                ("POST", "/api/auth/demo-students/withdrawal-elena/reset"),
            ]:
                response = _call(client, method, path)
                self.assertEqual(response.status_code, 404, (method, path))
                self.assertNotIn(DEMO_PASSWORD, response.get_data(as_text=True))
            # A signed-in staff member does not get the demo reset either.
            staff = self.signed_in("staff")
            response = staff.post("/api/transactions/withdrawal/demo-reset", json={"student_id": self.student_a_id})
            self.assertEqual(response.status_code, 404)
            response = staff.post("/api/auth/demo-students/withdrawal-elena/reset", json={})
            self.assertEqual(response.status_code, 404)

    def test_demo_mode_on_lists_demo_accounts_for_an_explicit_panel(self):
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            client = app.test_client()
            self.assertIs(client.get("/api/auth/config").get_json()["demo_mode"], True)
            response = client.get("/api/auth/demo-accounts")
            self.assertEqual(response.status_code, 200)
            items = response.get_json()["items"]
            emails = {item["email"] for item in items}
            self.assertIn("staff@usls.edu.ph", emails)
            self.assertIn("dean@usls.edu.ph", emails)
            for item in items:
                self.assertEqual(set(item), {"role", "label", "detail", "email", "password"})
            self.assertEqual(client.get("/api/auth/demo-students").status_code, 200)

    def test_demo_accounts_never_advertise_an_account_whose_password_changed(self):
        with app.app_context():
            account = db.session.get(UserAccount, self.accounts["staff"])
            account.password_hash = generate_password_hash("a-real-secret-1")
            db.session.commit()
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            emails = {item["email"] for item in app.test_client().get("/api/auth/demo-accounts").get_json()["items"]}
        self.assertNotIn("staff@usls.edu.ph", emails)
        self.assertIn("dean@usls.edu.ph", emails)

    def test_demo_reset_requires_no_session_only_while_demo_mode_is_on(self):
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            response = app.test_client().post("/api/auth/demo-students/not-a-demo-key/reset", json={})
            self.assertEqual(response.status_code, 404)
            self.assertIn("Demo student not found", response.get_json()["error"])
        # The workflow reset button is a staff tool even in demo mode.
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            anonymous = app.test_client().post("/api/transactions/withdrawal/demo-reset", json={"student_id": 1})
            self.assertEqual(anonymous.status_code, 401)
            student = self.signed_in("student_a").post("/api/transactions/withdrawal/demo-reset", json={"student_id": 1})
            self.assertEqual(student.status_code, 403)

    def test_login_page_source_carries_no_password_or_prefilled_credentials(self):
        login_source = (REPO_ROOT / "frontend" / "src" / "pages" / "Login.jsx").read_text(encoding="utf-8")
        for path in (REPO_ROOT / "frontend" / "src").rglob("*.jsx"):
            self.assertNotIn(DEMO_PASSWORD, path.read_text(encoding="utf-8"), str(path))
        self.assertNotIn("@usls.edu.ph", login_source)
        self.assertNotIn('role: "student"', login_source)

    def test_new_account_messages_omit_the_default_password_when_demo_mode_is_off(self):
        from app import demo_password_hint

        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            self.assertEqual(demo_password_hint(), DEMO_PASSWORD)
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            self.assertEqual(demo_password_hint(), "")

    def test_demo_mode_off_skips_the_demo_baseline_repair_on_login(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="GS-HLT-A").one()
            student.student_number = "GS-2026-WD-01"  # a whitelisted demo persona
            db.session.commit()
        with patch("app.ensure_workflow_demo_student_baseline") as baseline:
            with patch.dict(os.environ, {"DEMO_MODE": "0"}):
                _, response = self.login("alice@usls.edu.ph")
            self.assertEqual(response.status_code, 200, response.get_json())
            baseline.assert_not_called()


class LoginHardeningTests(HealthTestBase):
    def test_every_failure_gets_the_same_generic_answer(self):
        with app.app_context():
            inactive = UserAccount(
                email="gone@usls.edu.ph", full_name="Gone", password_hash=generate_password_hash(DEMO_PASSWORD),
                role="staff", active=False,
            )
            db.session.add(inactive)
            db.session.commit()
        answers = set()
        for email, password in [
            ("nobody@usls.edu.ph", DEMO_PASSWORD),      # unknown user
            ("staff@usls.edu.ph", "wrong-password"),    # wrong password
            ("gone@usls.edu.ph", DEMO_PASSWORD),        # deactivated account
        ]:
            _, response = self.login(email, password)
            self.assertEqual(response.status_code, 401, (email, response.get_json()))
            answers.add(response.get_data(as_text=True))
        self.assertEqual(len(answers), 1, answers)
        message = answers.pop().lower()
        for hint in ("not found", "no such", "unknown", "does not exist", "wrong password", "inactive", "role", "account type"):
            self.assertNotIn(hint, message)

    def test_repeated_failures_lock_the_account_out_even_for_the_right_password(self):
        for _ in range(5):
            _, response = self.login("staff@usls.edu.ph", "wrong-password")
            self.assertEqual(response.status_code, 401)
        _, locked = self.login("staff@usls.edu.ph", DEMO_PASSWORD)
        self.assertEqual(locked.status_code, 429, locked.get_json())
        self.assertTrue(locked.headers.get("Retry-After"))
        # An unknown email is throttled the same way, so lockout is no oracle.
        for _ in range(5):
            self.login("nobody@usls.edu.ph", "wrong-password")
        _, locked_unknown = self.login("nobody@usls.edu.ph", "wrong-password")
        self.assertEqual(locked_unknown.status_code, 429)
        # A different account is unaffected.
        _, other = self.login("dean@usls.edu.ph")
        self.assertEqual(other.status_code, 200)

    def test_lockout_expires_and_success_clears_the_counter(self):
        clock = {"now": 1000.0}
        with patch.object(LOGIN_THROTTLE, "clock", lambda: clock["now"]):
            for _ in range(5):
                self.login("staff@usls.edu.ph", "wrong-password")
            self.assertEqual(self.login("staff@usls.edu.ph")[1].status_code, 429)
            clock["now"] += LOGIN_THROTTLE.lockout_seconds + 1
            self.assertEqual(self.login("staff@usls.edu.ph")[1].status_code, 200)
            # four failures, then a success, then four more: still not locked out.
            for _ in range(4):
                self.login("dean@usls.edu.ph", "wrong-password")
            self.assertEqual(self.login("dean@usls.edu.ph")[1].status_code, 200)
            for _ in range(4):
                self.login("dean@usls.edu.ph", "wrong-password")
            self.assertEqual(self.login("dean@usls.edu.ph")[1].status_code, 200)

    def test_role_comes_from_the_server_not_from_the_login_form(self):
        # No role field is needed at all.
        client, response = self.login("staff@usls.edu.ph")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["user"]["role"], "staff")
        # Asking for another role does not change what the server says.
        for asked in ("dean", "admin", "faculty", "student"):
            client, response = self.login("staff@usls.edu.ph", role=asked)
            self.assertEqual(response.status_code, 200, (asked, response.get_json()))
            self.assertEqual(response.get_json()["user"]["role"], "staff", asked)
            self.assertEqual(client.get("/api/auth/me").get_json()["user"]["role"], "staff")
            # ...and the dean-only area stays closed.
            self.assertEqual(client.post("/api/approvals/1/decide", json={}).status_code, 403)
        # A student who claims to be staff still gets the student session.
        client, response = self.login("alice@usls.edu.ph", role="staff")
        self.assertEqual(response.get_json()["user"]["role"], "student")
        self.assertEqual(client.get("/api/students").status_code, 403)

    def test_session_cookie_flags(self):
        self.assertTrue(app.config["SESSION_COOKIE_HTTPONLY"])
        self.assertEqual(app.config["SESSION_COOKIE_SAMESITE"], "Lax")
        _, response = self.login("staff@usls.edu.ph")
        cookie = response.headers.get("Set-Cookie", "")
        self.assertIn("HttpOnly", cookie)
        self.assertIn("SameSite=Lax", cookie)

    def test_logout_clears_the_session_and_kills_a_replayed_cookie(self):
        client, response = self.login("staff@usls.edu.ph")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(client.get("/api/meta").status_code, 200)
        stolen = client.get_cookie("session").value  # what an attacker copying the cookie holds
        self.assertEqual(client.post("/api/auth/logout", json={}).status_code, 200)
        self.assertIsNone(client.get("/api/auth/me").get_json()["user"])
        self.assertEqual(client.get("/api/meta").status_code, 401)
        replay = app.test_client()
        replay.set_cookie("session", stolen)
        self.assertIsNone(replay.get("/api/auth/me").get_json()["user"])
        self.assertEqual(replay.get("/api/meta").status_code, 401)

    def test_login_response_headers_are_not_cacheable(self):
        _, response = self.login("staff@usls.edu.ph")
        self.assertIn("no-store", response.headers.get("Cache-Control", ""))

    def test_secret_key_is_never_the_public_default_outside_demo_mode(self):
        self.assertEqual(resolve_secret_key({"SECRET_KEY": "from-env"}), "from-env")
        self.assertEqual(resolve_secret_key({"DEMO_MODE": "1"}), "demo-only-secret")
        first = resolve_secret_key({"DEMO_MODE": "0"})
        second = resolve_secret_key({"DEMO_MODE": "0"})
        self.assertNotEqual(first, "demo-only-secret")
        self.assertGreaterEqual(len(first), 32)
        self.assertNotEqual(first, second)


class AccessControlSweepTests(HealthTestBase):
    def _assert_anonymous_sweep(self):
        client = app.test_client()
        checked = 0
        for method, rule in _api_routes():
            key = (method, rule.rule)
            if key in PUBLIC_API_ROUTES or key in DEMO_API_ROUTES:
                continue
            response = _call(client, method, _sample_path(rule.rule))
            self.assertIn(response.status_code, (401, 403), f"{method} {rule.rule} answered {response.status_code} to an anonymous caller")
            checked += 1
        self.assertGreater(checked, 100)

    def test_anonymous_client_is_refused_on_every_api_route_with_demo_mode_on(self):
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            self._assert_anonymous_sweep()

    def test_anonymous_client_is_refused_on_every_api_route_with_demo_mode_off(self):
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            self._assert_anonymous_sweep()
            client = app.test_client()
            for method, rule in _api_routes():
                if (method, rule.rule) in DEMO_API_ROUTES:
                    self.assertEqual(_call(client, method, _sample_path(rule.rule)).status_code, 404, rule.rule)

    def test_the_allow_lists_name_real_routes(self):
        existing = {(method, rule.rule) for method, rule in _api_routes()}
        self.assertEqual((PUBLIC_API_ROUTES | DEMO_API_ROUTES) - existing, set())

    def test_no_other_public_routes_exist_outside_the_spa(self):
        # Every non-API route must be the SPA shell; nothing else may serve data.
        others = sorted(
            rule.rule for rule in app.url_map.iter_rules()
            if not rule.rule.startswith("/api/") and rule.endpoint != "static"
        )
        self.assertEqual(others, ["/", "/<path:path>"])

    def test_other_roles_are_refused_on_every_route_declared_for_different_roles(self):
        # Uses the roles each endpoint was registered with (require_api_login).
        sessions = {role: self.signed_in(key) for role, key in [("student", "student_a"), ("faculty", "faculty"), ("dean", "dean")]}
        checked = 0
        for method, rule in _api_routes():
            allowed = API_ROLE_REGISTRY.get(rule.endpoint)
            if not allowed:
                continue
            for role, client in sessions.items():
                if role in allowed:
                    continue
                response = _call(client, method, _sample_path(rule.rule))
                self.assertEqual(response.status_code, 403, f"{role} on {method} {rule.rule} (allowed: {sorted(allowed)}) got {response.status_code}")
                checked += 1
        self.assertGreater(checked, 300)


class StudentIsolationTests(HealthTestBase):
    def setUp(self):
        super().setUp()
        with app.app_context():
            student_b = Student.query.filter_by(student_number="GS-HLT-B").one()
            student_a = Student.query.filter_by(student_number="GS-HLT-A").one()
            doc = DocumentCheck(student_id=student_b.id, gate="Form 1 - Title Defense", item_name="Three concept papers", status="Submitted")
            db.session.add(doc)
            db.session.flush()
            research_file = f"health-b-evidence-{student_b.id}.pdf"
            request_file = f"health-b-request-{student_b.id}.pdf"
            for root, name in ((UPLOAD_ROOT, research_file), (REQUEST_UPLOAD_ROOT, request_file)):
                root.mkdir(parents=True, exist_ok=True)
                (root / name).write_bytes(b"%PDF-1.4 student b private file")
                self.created_files.append(root / name)
            evidence = ResearchEvidenceFile(
                student_id=student_b.id, document_check_id=doc.id,
                original_name="b-private.pdf", stored_name=research_file,
            )
            attachment = StudentRequestAttachment(
                student_id=student_b.id, request_type="withdrawal",
                original_name="b-withdrawal.pdf", stored_name=request_file,
            )
            message = WorkflowMessage(
                transaction_slug="withdrawal", student_id=student_b.id, sender_role="Graduate School Staff",
                sender_name="Staff", recipient_role="Student", template="Private note for Bruno",
                comment="Only Bruno should read this.",
            )
            db.session.add_all([evidence, attachment, message])
            db.session.commit()
            self.b_id = student_b.id
            self.a_id = student_a.id
            self.b_evidence_id = evidence.id
            self.b_attachment_id = attachment.id
            self.b_doc_id = doc.id
            self.b_message_id = message.id

    def test_a_student_sees_only_their_own_record(self):
        alice = self.signed_in("student_a")
        for url in ("/api/student-portal/context", f"/api/student-portal/context?student_id={self.b_id}"):
            response = alice.get(url)
            self.assertEqual(response.status_code, 200, url)
            body = response.get_data(as_text=True)
            self.assertEqual(response.get_json()["student"]["id"], self.a_id)
            for private in ("Bruno", "Bravo", "GS-HLT-B", "bruno@", "Only Bruno should read this", "b-private.pdf", "b-withdrawal.pdf"):
                self.assertNotIn(private, body, url)
        # ...and the owner does see the data, so the checks above are meaningful.
        bruno = self.signed_in("student_b")
        self.assertIn("Bruno", bruno.get("/api/student-portal/context").get_data(as_text=True))

    def test_a_student_cannot_open_another_students_files(self):
        alice, bruno = self.signed_in("student_a"), self.signed_in("student_b")
        for url in (f"/api/research-evidence/{self.b_evidence_id}/file", f"/api/student-request-attachments/{self.b_attachment_id}/file"):
            self.assertEqual(alice.get(url).status_code, 403, url)
            with bruno.get(url) as owner_response:  # closes the streamed file handle
                self.assertEqual(owner_response.status_code, 200, url)
        staff = self.signed_in("staff")
        with staff.get(f"/api/student-request-attachments/{self.b_attachment_id}/file") as staff_response:
            self.assertEqual(staff_response.status_code, 200)

    def test_a_student_cannot_change_or_delete_another_students_submissions(self):
        alice = self.signed_in("student_a")
        self.assertIn(alice.delete(f"/api/student-portal/research-evidence/{self.b_evidence_id}").status_code, (403, 404))
        self.assertEqual(alice.post(f"/api/student-portal/documents/{self.b_doc_id}/upload").status_code, 404)
        self.assertEqual(alice.post(f"/api/research-evidence/{self.b_evidence_id}/concept-paper-compliance", json={}).status_code, 403)
        self.assertEqual(alice.get(f"/api/research-gate/template?student_id={self.b_id}&gate=Form 1 - Title Defense&item_name=Three concept papers").status_code, 403)
        with app.app_context():
            self.assertIsNotNone(db.session.get(ResearchEvidenceFile, self.b_evidence_id))

    def test_a_student_cannot_read_or_mark_another_students_messages(self):
        alice = self.signed_in("student_a")
        response = alice.post("/api/student-portal/messages/read", json={"message_ids": [self.b_message_id]})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["updated"], 0)
        with app.app_context():
            self.assertIsNone(db.session.get(WorkflowMessage, self.b_message_id).read_at)

    def test_a_student_cannot_write_on_behalf_of_another_student(self):
        alice = self.signed_in("student_a")
        response = alice.post("/api/transactions/withdrawal/messages", json={"student_id": self.b_id, "comment": "hello"})
        with app.app_context():
            self.assertEqual(WorkflowMessage.query.filter_by(student_id=self.b_id, sender_role="student").count(), 0)
            if response.status_code < 400:
                self.assertGreaterEqual(WorkflowMessage.query.filter_by(student_id=self.a_id).count(), 1)

    def test_staff_only_student_data_is_closed_to_students(self):
        alice = self.signed_in("student_a")
        for url in (
            f"/api/students/{self.b_id}", "/api/students", f"/api/students/{self.b_id}/flags",
            f"/api/transactions/withdrawal/context?student_id={self.b_id}", "/api/tasks", "/api/activity",
        ):
            self.assertEqual(alice.get(url).status_code, 403, url)


class StartupTests(HealthTestBase):
    def test_startup_tasks_skip_under_a_test_runner_a_seed_run_or_the_skip_switch(self):
        self.assertFalse(should_run_startup_tasks(argv=["app.py"], environ={}, main_name="unittest.__main__"))
        self.assertFalse(should_run_startup_tasks(argv=["pytest"], environ={}, main_name="pytest.__main__"))
        self.assertFalse(should_run_startup_tasks(argv=["app.py", "--seed"], environ={}, main_name="__main__"))
        self.assertFalse(should_run_startup_tasks(argv=["app.py"], environ={"USLS_SKIP_STARTUP_TASKS": "1"}, main_name="__main__"))
        self.assertTrue(should_run_startup_tasks(argv=["app.py"], environ={}, main_name="__main__"))
        self.assertTrue(should_run_startup_tasks(argv=["flask", "run"], environ={}, main_name="flask.__main__"))
        self.assertTrue(should_run_startup_tasks(argv=["gunicorn", "app:app"], environ={}, main_name=None))

    def test_importing_the_app_under_tests_did_not_seed_anything(self):
        # setUp rebuilt the tables, so only the rows setUp made exist.
        with app.app_context():
            self.assertEqual(Student.query.count(), 2)

    def test_startup_tasks_are_idempotent_and_create_the_demo_accounts(self):
        # Startup also registers the draft Operations Manual in the policy library; keep that
        # copy (and the search index) in a scratch folder so no other test module sees it.
        scratch = Path(tempfile.mkdtemp(prefix="health-policy-"))
        with patch("app.POLICY_DOCUMENT_UPLOAD_ROOT", scratch / "policy_documents"), patch("app.RAG_INDEX_DIR", scratch / "rag-index"):
            with app.app_context():
                run_startup_tasks(seed_count=0)
                first = UserAccount.query.count()
                self.assertIsNotNone(UserAccount.query.filter_by(email="staff@usls.edu.ph").first())
                run_startup_tasks(seed_count=0)
                self.assertEqual(UserAccount.query.count(), first)
                self.assertEqual(Student.query.filter_by(student_number="GS-HLT-A").count(), 1)
                from app import PolicyDocument
                self.assertEqual(PolicyDocument.query.filter_by(category="Operations Manual", status="draft").count(), 1)


if __name__ == "__main__":
    unittest.main()
