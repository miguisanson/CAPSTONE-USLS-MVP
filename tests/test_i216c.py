"""I-216 (Fable F-23, open part 2): a password that
staff set or reset for a faculty login is temporary (forced change at next sign-in)."""
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

from app import Faculty, UserAccount, app, build_demo_database, db  # noqa: E402


class I216PasswordTests(unittest.TestCase):
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

    def _new_faculty(self, staff, email, password="Temp-Pass-12"):
        response = staff.post("/api/faculty", json={
            "full_name": "Pw Tester", "department": "GS", "specialization": "x", "email": email,
            "temporary_password": password, "eligible_roles": ["Faculty Adviser"],
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["faculty"]["id"]

    def test_staff_created_faculty_password_must_be_changed_then_is_not_required(self):
        staff = self._client(role="staff")
        self._new_faculty(staff, "pw-create@i216.test")
        client = app.test_client()
        login = client.post("/api/auth/login", json={"email": "pw-create@i216.test", "password": "Temp-Pass-12"})
        self.assertEqual(login.status_code, 200, login.get_json())
        self.assertTrue(login.get_json()["user"]["must_change_password"])
        changed = client.post("/api/auth/change-password", json={"current_password": "Temp-Pass-12", "new_password": "My-Own-Pass-34"})
        self.assertEqual(changed.status_code, 200, changed.get_json())
        self.assertFalse(changed.get_json()["user"]["must_change_password"])
        self.assertFalse(client.get("/api/auth/me").get_json()["user"]["must_change_password"])

    def test_staff_reset_of_faculty_password_forces_a_change_again(self):
        staff = self._client(role="staff")
        fid = self._new_faculty(staff, "pw-reset@i216.test")
        with app.app_context():
            account = UserAccount.query.filter_by(email="pw-reset@i216.test").one()
            account.must_change_password = False
            db.session.commit()
        reset = staff.patch(f"/api/faculty/{fid}", json={"new_password": "Reset-Pass-56"})
        self.assertEqual(reset.status_code, 200, reset.get_json())
        login = app.test_client().post("/api/auth/login", json={"email": "pw-reset@i216.test", "password": "Reset-Pass-56"})
        self.assertTrue(login.get_json()["user"]["must_change_password"])

    def test_seeded_demo_faculty_accounts_are_not_forced(self):
        with app.app_context():
            forced = UserAccount.query.filter(UserAccount.role == "faculty", UserAccount.email.notlike("%@i216.test")).filter_by(must_change_password=True).count()
        self.assertEqual(forced, 0)


if __name__ == "__main__":
    unittest.main()
