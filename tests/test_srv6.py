"""pkt/srv6: I-403 one at-risk count, I-404 plain words in reports and the class list, I-064 next_step on the Research Gate rows."""
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

from app import UserAccount, app, build_demo_database, db  # noqa: E402


class Srv6Tests(unittest.TestCase):
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

    def client(self, role):
        with app.app_context():
            account_id = UserAccount.query.filter_by(role=role).first().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def test_home_at_risk_count_is_the_reports_behind_count(self):
        staff = self.client("staff")
        kpis = staff.get("/api/dashboard").get_json()["kpis"]
        tiles = {t["key"]: t for t in staff.get("/api/reports/summary").get_json()["tiles"]}
        self.assertEqual(tiles["behind"]["count"], kpis["at_risk"])
        listed = staff.get("/api/students?risk=At Risk of Delay/Delayed&standing=Active&page_size=5").get_json()["total"]
        self.assertEqual(listed, kpis["at_risk"])

    def test_class_list_has_no_seeded_wording(self):
        text = self.client("staff").get("/api/monitoring/class-list").get_data(as_text=True)
        self.assertNotIn("Seeded current", text)

    def test_graduation_missing_uses_plain_words(self):
        rows = self.client("staff").get("/api/reports/graduation").get_json()["rows"]
        self.assertTrue(rows)
        for row in rows:
            self.assertNotIn("workflow", row["missing"].lower(), row["student"])
            self.assertNotIn("record on file", row["missing"], row["student"])
        with app.app_context():
            from app import Student, program_allows_practicum
            no_practicum = {s.name for s in Student.query.all() if not program_allows_practicum(s.program)}
        for row in rows:
            if row["student"] in no_practicum:
                self.assertNotIn("Practicum", row["missing"], row["student"])
        self.assertTrue(any("not passed yet" in r["missing"] for r in rows))

    def test_research_gate_rows_say_the_next_step(self):
        items = self.client("research_coordinator").get("/api/research-gate/overview").get_json()["items"]
        steps = {row["next_step"] for row in items}
        self.assertTrue(steps <= {"panel", "schedule", None}, steps)
        for row in items:
            if "panel has not been matched" in row["reason"]:
                self.assertEqual("panel", row["next_step"])
            if "defense has not been scheduled" in row["reason"]:
                self.assertEqual("schedule", row["next_step"])
        # the demo seed has no student waiting for a panel match, only for a defense date
        self.assertIn("schedule", steps)


if __name__ == "__main__":
    unittest.main()
