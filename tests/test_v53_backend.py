"""v5.3 review fixes, backend side (FULL-REVIEW-2026-10-22.md: F-01..F-04, F-19, I-036).

One seeded demo database is built once for the whole module (seeding is slow) and
every test only reads it or leaves it as it found it. The DATABASE_URL points at a
temp SQLite file before ``app`` is imported, the way tests/test_section_j_backend.py does.
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
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    LOGIN_THROTTLE,
    ROLE_TRANSACTION_ACCESS,
    PracticumRecord,
    Student,
    StudentRequestAttachment,
    Task,
    UserAccount,
    app,
    db,
    resolve_secret_key,
    seed_database,
    task_dict,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEMO_PASSWORD = "DemoPass123!"
STAFF_EMAIL = "staff@usls.edu.ph"


class V53BackendTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            seed_database()
            cls.admin_id = UserAccount.query.filter_by(role="admin").first().id
            cls.academic_id = UserAccount.query.filter_by(role="academic_coordinator").first().id

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
        LOGIN_THROTTLE.reset()

    tearDown = setUp

    # ------------------------------------------------------------------ helpers
    @staticmethod
    def _login(email, password=DEMO_PASSWORD, ip="10.0.0.1", client=None):
        client = client or app.test_client()
        response = client.post(
            "/api/auth/login", json={"email": email, "password": password},
            environ_overrides={"REMOTE_ADDR": ip},
        )
        return client, response

    @staticmethod
    def _role_client(account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-055 (F-01)
    def test_demo_student_reset_needs_a_signed_in_session(self):
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            anonymous = app.test_client().post("/api/auth/demo-students/practicum-andrea/reset", json={})
            self.assertEqual(anonymous.status_code, 401, anonymous.get_json())
            client, response = self._login(STAFF_EMAIL)
            self.assertEqual(response.status_code, 200, response.get_json())
            signed_in = client.post("/api/auth/demo-students/practicum-andrea/reset", json={})
            self.assertEqual(signed_in.status_code, 200, signed_in.get_json())


if __name__ == "__main__":
    unittest.main()
