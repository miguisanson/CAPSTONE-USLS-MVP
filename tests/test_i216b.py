"""I-216 (Fable F-23, open part 1): a faculty member gets only their own .ics feed; token feeds keep working."""
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

from app import CalendarToken, Faculty, UserAccount, app, build_demo_database, db  # noqa: E402


class I216FacultyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()
            accounts = UserAccount.query.filter(UserAccount.role == "faculty", UserAccount.faculty_id.isnot(None)).limit(2).all()
            cls.a, cls.b = accounts[0].id, accounts[1].id
            cls.a_fac, cls.b_fac = accounts[0].faculty_id, accounts[1].faculty_id

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def _client(self, account_id=None, role=None):
        with app.app_context():
            account = db.session.get(UserAccount, account_id) if account_id else UserAccount.query.filter_by(role=role).first()
            account_id, role = account.id, account.role
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def test_faculty_gets_only_their_own_feed(self):
        client = self._client(self.a)
        self.assertEqual(client.get(f"/api/faculty/{self.a_fac}/calendar.ics").status_code, 200)
        self.assertIn(client.get(f"/api/faculty/{self.b_fac}/calendar.ics").status_code, (403, 404))

    def test_staff_keep_access_to_any_faculty_feed(self):
        client = self._client(role="staff")
        for fid in (self.a_fac, self.b_fac):
            self.assertEqual(client.get(f"/api/faculty/{fid}/calendar.ics").status_code, 200)

    def test_token_feed_still_works_for_its_owner_without_a_session(self):
        with app.app_context():
            db.session.add(CalendarToken(account_id=self.a, token="tok-i216-owner"))
            db.session.commit()
        response = app.test_client().get("/api/calendar/feed/tok-i216-owner.ics")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.mimetype, "text/calendar")


if __name__ == "__main__":
    unittest.main()
