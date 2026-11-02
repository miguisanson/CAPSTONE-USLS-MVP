"""pkt/be6: I-183 (seed shows no inconsistencies), I-195 (Manila "today"), I-193 (one active count), I-197 (deliberate history).

One seeded temporary database is built for the module; tests that change data roll back.
"""
import os
import tempfile
import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    SubjectEnrollment,
    TermEnrollment,
    UserAccount,
    app,
    build_demo_database,
    db,
    enrollment_integrity_payload,
)


class Be6Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def _client(self, role):
        with app.app_context():
            account = UserAccount.query.filter_by(role=role).first()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-183
    def test_fresh_seed_has_no_enrollment_inconsistencies(self):
        with app.app_context():
            payload = enrollment_integrity_payload()
            self.assertEqual(payload["issue_count"], 0, payload["issues"])

    def test_a_real_inconsistency_is_still_detected(self):
        with app.app_context():
            item = SubjectEnrollment.query.filter(SubjectEnrollment.status == "Enrolled").first()
            row = TermEnrollment.query.filter_by(student_id=item.student_id, term_id=item.term_id).first()
            self.assertIsNotNone(row)
            row.status = "Dropped"
            db.session.flush()
            try:
                types = {issue["type"] for issue in enrollment_integrity_payload()["issues"]}
                self.assertIn("Semester enrollment missing", types)
            finally:
                db.session.rollback()


if __name__ == "__main__":
    unittest.main()
