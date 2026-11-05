"""I-209 / I-212 (server): a private demo password, and no password change for shared demo logins.

I-209: the repo is public, so the default shared demo password is public. ``DEMO_PASSWORD`` replaces
it for every seeded demo account. I-212: seeded demo accounts are shared by testers, so one tester
changing a password must not lock the others out; the server says so with ``demo_account`` and a 403.
"""
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
PUBLIC_DEFAULT = "DemoPass123!"
PRIVATE = "Tester-Private-Pass-77"

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import LOGIN_THROTTLE, Faculty, UserAccount, app, db, generate_password_hash  # noqa: E402

_SEED_PROBE = r"""
import json, os
import app as m
out = {}
with m.app.app_context():
    m.db.drop_all(); m.db.create_all()
    m.ensure_demo_accounts()
    m.db.session.commit()
    c = m.app.test_client()
    for tag, pw in (("public", "DemoPass123!"), ("private", os.environ.get("DEMO_PASSWORD") or "DemoPass123!")):
        out[tag] = {e: c.post("/api/auth/login", json={"email": e, "password": pw}).status_code
                    for e in ("admin@usls.edu.ph", "staff@usls.edu.ph", "dean@usls.edu.ph")}
        m.LOGIN_THROTTLE.reset()
print("PROBE" + json.dumps(out))
"""


class PrivateDemoPasswordSeedTests(unittest.TestCase):
    def _probe(self, extra_env):
        with tempfile.TemporaryDirectory() as folder:
            env = dict(os.environ)
            env.update({
                "DATABASE_URL": f"sqlite:///{Path(folder, 'd.sqlite3').as_posix()}",
                "USLS_UPLOAD_DIR": str(Path(folder, "up")),
                "USLS_SKIP_STARTUP_TASKS": "1", "RAG_PREWARM": "0",
                "GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": "",
                # the probe checks the seeded accounts in its own database; with the sandbox on (no TESTING flag in a
                # subprocess) the login would read the shared demo_sandboxes/ template of another database instead
                "DEMO_SANDBOX": "0",
            })
            env.update(extra_env)
            run = subprocess.run([sys.executable, "-c", _SEED_PROBE], cwd=ROOT, env=env,
                                 capture_output=True, text=True, timeout=300)
            self.assertEqual(run.returncode, 0, run.stderr[-3000:])
            if extra_env["DEMO_PASSWORD"]:  # the seed must never echo the private password
                self.assertNotIn(extra_env["DEMO_PASSWORD"], run.stdout + run.stderr)
            line = [ln for ln in run.stdout.splitlines() if ln.startswith("PROBE")][0]
            return json.loads(line[5:])

    def test_private_password_replaces_the_public_default_for_every_seeded_account(self):
        result = self._probe({"DEMO_PASSWORD": PRIVATE})
        for email, status in result["public"].items():
            self.assertEqual(status, 401, f"{email} still accepts the public default")
        for email, status in result["private"].items():
            self.assertEqual(status, 200, email)

    def test_unset_keeps_the_default_so_local_demos_and_tests_work(self):
        result = self._probe({"DEMO_PASSWORD": ""})
        self.assertEqual(set(result["public"].values()), {200})


class DemoAccountFlagTests(unittest.TestCase):
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
        with app.app_context():
            db.drop_all()
            db.create_all()
            for email, role in (("admin@usls.edu.ph", "admin"), ("real.person@usls.edu.ph", "staff")):
                db.session.add(UserAccount(email=email, full_name=role, role=role, active=True,
                                           password_hash=generate_password_hash(PUBLIC_DEFAULT)))
            db.session.commit()

    def _client(self, email):
        client = app.test_client()
        self.assertEqual(client.post("/api/auth/login", json={"email": email, "password": PUBLIC_DEFAULT}).status_code, 200)
        return client

    def test_me_flags_seeded_demo_accounts_only(self):
        self.assertIs(self._client("admin@usls.edu.ph").get("/api/auth/me").get_json()["user"]["demo_account"], True)
        self.assertIs(self._client("real.person@usls.edu.ph").get("/api/auth/me").get_json()["user"]["demo_account"], False)

    def test_me_does_not_flag_when_demo_mode_is_off(self):
        client = self._client("admin@usls.edu.ph")
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            self.assertIs(client.get("/api/auth/me").get_json()["user"]["demo_account"], False)

    def test_demo_account_cannot_change_its_password(self):
        client = self._client("admin@usls.edu.ph")
        response = client.post("/api/auth/change-password",
                               json={"current_password": PUBLIC_DEFAULT, "new_password": "A-brand-new-pass-9"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"],
                         "Demo accounts are shared by testers; their password cannot be changed.")
        with app.app_context():
            from werkzeug.security import check_password_hash
            account = UserAccount.query.filter_by(email="admin@usls.edu.ph").first()
            self.assertTrue(check_password_hash(account.password_hash, PUBLIC_DEFAULT))

    def test_other_accounts_can_still_change_theirs(self):
        client = self._client("real.person@usls.edu.ph")
        response = client.post("/api/auth/change-password",
                               json={"current_password": PUBLIC_DEFAULT, "new_password": "A-brand-new-pass-9"})
        self.assertEqual(response.status_code, 200, response.get_json())


class NoPasswordInPayloadTests(unittest.TestCase):
    def test_shared_password_hint_is_empty_when_accounts_are_hidden(self):
        with patch.dict(os.environ, {"DEMO_SHOW_ACCOUNTS": "0"}):
            self.assertEqual(app_module.demo_password_hint(), "")
        with patch.dict(os.environ, {"DEMO_SHOW_ACCOUNTS": "1"}):
            self.assertEqual(app_module.demo_password_hint(), app_module.SIM_STUDENT_PASSWORD)


if __name__ == "__main__":
    unittest.main()
