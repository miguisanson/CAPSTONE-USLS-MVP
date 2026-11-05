"""GS-P-04 / GS-F-45: every account accepts the data privacy notice once before using the platform.

The notice is the Graduate School's Data Privacy Notice (GS-P-04, Operations Manual 4.23). The server
reports ``privacy_consent_required`` on the signed-in user until the account accepts the current notice
version, stores when and which version was accepted, and writes the acceptance to the transaction log.
"""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

import app as app_module  # noqa: E402
from app import LOGIN_THROTTLE, TransactionLog, UserAccount, app, db, generate_password_hash  # noqa: E402

PASSWORD = "Consent-Test-Pass-1"


class PrivacyConsentTests(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        LOGIN_THROTTLE.reset()
        with app.app_context():
            db.drop_all()
            db.create_all()
            account = UserAccount(email="consent-staff@example.test", full_name="Consent Staff",
                                  password_hash=generate_password_hash(PASSWORD), role="staff")
            db.session.add(account)
            db.session.commit()
            self.account_id = account.id
        self.client = app.test_client()
        login = self.client.post("/api/auth/login", json={"email": "consent-staff@example.test", "password": PASSWORD})
        self.assertEqual(login.status_code, 200, login.get_json())
        self.login_user = login.get_json()["user"]

    def test_new_account_must_accept_the_notice(self):
        self.assertTrue(self.login_user["privacy_consent_required"])
        me = self.client.get("/api/auth/me").get_json()["user"]
        self.assertTrue(me["privacy_consent_required"])
        self.assertEqual(me["privacy_notice_version"], app_module.PRIVACY_NOTICE_VERSION)
        self.assertIn("GS-P-04", app_module.PRIVACY_NOTICE_VERSION)

    def test_accepting_records_time_version_and_log(self):
        response = self.client.post("/api/auth/privacy-consent", json={"accept": True})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertFalse(response.get_json()["user"]["privacy_consent_required"])
        self.assertFalse(self.client.get("/api/auth/me").get_json()["user"]["privacy_consent_required"])
        with app.app_context():
            account = db.session.get(UserAccount, self.account_id)
            self.assertIsNotNone(account.privacy_consent_at)
            self.assertEqual(account.privacy_notice_version, app_module.PRIVACY_NOTICE_VERSION)
            log = TransactionLog.query.filter_by(actor_user_id=self.account_id, transaction_slug="privacy-consent").one()
            self.assertIn("GS-P-04", log.source_reference or "")

    def test_accept_must_be_true(self):
        for body in ({}, {"accept": False}, {"accept": "yes"}):
            response = self.client.post("/api/auth/privacy-consent", json=body)
            self.assertEqual(response.status_code, 400, (body, response.get_json()))
        self.assertTrue(self.client.get("/api/auth/me").get_json()["user"]["privacy_consent_required"])

    def test_signed_out_cannot_accept(self):
        self.client.post("/api/auth/logout")
        self.assertEqual(self.client.post("/api/auth/privacy-consent", json={"accept": True}).status_code, 401)

    def test_an_older_notice_version_asks_again(self):
        self.client.post("/api/auth/privacy-consent", json={"accept": True})
        with app.app_context():
            account = db.session.get(UserAccount, self.account_id)
            account.privacy_notice_version = "GS-P-04 rev -1"
            db.session.commit()
        self.assertTrue(self.client.get("/api/auth/me").get_json()["user"]["privacy_consent_required"])


if __name__ == "__main__":
    unittest.main()
