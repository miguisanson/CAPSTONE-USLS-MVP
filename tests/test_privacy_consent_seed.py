"""GS-P-04: seeded demo accounts are pre-accepted; accounts made any other way see the notice at first sign-in.

The live demo, the demo-video recorder and the e2e walkthroughs sign in as seeded accounts and must not be
stopped by the notice. The acceptance time is the seed day (midnight), so two seeds give identical data.
"""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as app_module  # noqa: E402
from app import LOGIN_THROTTLE, UserAccount, app, build_demo_database, db, generate_password_hash, ph_today  # noqa: E402


class SeededAccountsAreAcceptedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()

    def test_every_seeded_account_has_accepted_the_current_notice_on_the_seed_day(self):
        with app.app_context():
            accounts = UserAccount.query.all()
            self.assertGreater(len(accounts), 10)
            for account in accounts:
                self.assertEqual(account.privacy_notice_version, app_module.PRIVACY_NOTICE_VERSION, account.email)
                self.assertEqual(account.privacy_consent_at.date(), ph_today(), account.email)
                self.assertEqual((account.privacy_consent_at.hour, account.privacy_consent_at.minute), (0, 0), account.email)

    def test_demo_logins_are_not_asked(self):
        for email in ("staff@usls.edu.ph", "dean@usls.edu.ph", "student@usls.edu.ph", "admin@usls.edu.ph"):
            LOGIN_THROTTLE.reset()
            login = app.test_client().post("/api/auth/login", json={"email": email, "password": app_module.SIM_STUDENT_PASSWORD})
            self.assertEqual(login.status_code, 200, (email, login.get_json()))
            self.assertFalse(login.get_json()["user"]["privacy_consent_required"], email)

    def test_an_account_made_after_the_seed_is_asked(self):
        with app.app_context():
            db.session.add(UserAccount(email="later@example.test", full_name="Later", role="staff",
                                       password_hash=generate_password_hash("Later-Pass-12345")))
            db.session.commit()
        self.addCleanup(self._remove_later_account)
        LOGIN_THROTTLE.reset()
        login = app.test_client().post("/api/auth/login", json={"email": "later@example.test", "password": "Later-Pass-12345"})
        self.assertTrue(login.get_json()["user"]["privacy_consent_required"])

    @staticmethod
    def _remove_later_account():
        with app.app_context():
            UserAccount.query.filter_by(email="later@example.test").delete()
            db.session.commit()


if __name__ == "__main__":
    unittest.main()
