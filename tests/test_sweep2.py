"""pkt/sweep2: persona sweep 2 findings I-201 (faculty directory for the Research Coordinator), I-203/I-204 (student's own next step and standing).

One seeded temporary database is built for the module; tests only read.
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

from app import Faculty, UserAccount, app, build_demo_database, db  # noqa: E402


class Sweep2Tests(unittest.TestCase):
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

    def _client(self, role, email=None):
        with app.app_context():
            query = UserAccount.query.filter_by(role=role)
            account = query.filter_by(email=email).first() if email else query.first()
            account_id = account.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # ------------------------------------------------------------------ I-201
    def test_research_coordinator_reads_the_faculty_directory_but_cannot_change_it(self):
        client = self._client("research_coordinator")
        directory = client.get("/api/faculty")
        self.assertEqual(directory.status_code, 200, directory.get_json())
        items = directory.get_json()["items"]
        self.assertTrue(items)
        detail = client.get(f"/api/faculty/{items[0]['id']}")
        self.assertEqual(detail.status_code, 200, detail.get_json())
        with app.app_context():
            faculty_id = Faculty.query.first().id
        self.assertEqual(client.patch(f"/api/faculty/{faculty_id}", json={"specialization": "x"}).status_code, 403)
        self.assertEqual(client.post("/api/faculty", json={"full_name": "x"}).status_code, 403)
        self.assertEqual(client.post(f"/api/faculty/{faculty_id}/cv-rag", json={"question": "What experience?"}).status_code, 403)

    # ------------------------------------------------------------------ I-203
    def _student_says(self, email, question):
        client = self._client("student", email)
        response = client.post("/api/student-portal/assistant", json={"question": question})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["answer"]

    def test_awol_student_next_step_is_her_own_return_not_a_staff_task(self):
        answer = self._student_says("awol.maya@usls.edu.ph", "What is my next step?")
        self.assertIn("Return from AWOL", answer)
        self.assertNotIn("Review automatic AWOL policy alert", answer)
        self.assertNotIn("Graduate School Staff", answer)

    def test_on_leave_student_next_step_is_her_own_readmission_not_a_staff_task(self):
        answer = self._student_says("readmission.therese@usls.edu.ph", "What is my next step?")
        self.assertIn("readmission", answer.lower())
        self.assertNotIn("Graduate School Staff", answer)

    # ------------------------------------------------------------------ I-204
    def _context(self, email):
        response = self._client("student", email).get("/api/student-portal/context")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def test_awol_student_sees_her_real_standing_and_master_limits(self):
        data = self._context("awol.maya@usls.edu.ph")
        standing = data["leave_overview"]["standing"]
        text = standing["text"]
        self.assertIn("still a USLS graduate student", text)
        self.assertIn("AWOL since", text)
        self.assertIn("master's", text.lower())
        self.assertNotIn("octorate", text)
        self.assertEqual(standing["kind"], "awol")
        self.assertRegex(standing["deadline"], r"^\d{4}-\d{2}-\d{2}$")
        self.assertIn("7 academic years", text)
        rows = {row["label"]: row["value"] for row in data["standalone_cases"]["awol"][0]["summary_rows"]}
        self.assertNotEqual(rows["Years in the program"], "Not calculated")
        self.assertNotEqual(rows["Residence limits"], "Not calculated")
        self.assertIn("7", rows["Residence limits"])

    def test_on_leave_student_sees_when_the_leave_ends_and_her_limit(self):
        standing = self._context("readmission.therese@usls.edu.ph")["leave_overview"]["standing"]
        self.assertEqual(standing["kind"], "leave")
        self.assertIn("still a USLS graduate student", standing["text"])
        self.assertIn("leave of absence", standing["text"])
        self.assertIn("master's", standing["text"].lower())

    def test_assistant_answers_am_i_still_a_student_from_the_record(self):
        answer = self._student_says("awol.maya@usls.edu.ph", "Am I still a student? How long do I have to come back?")
        self.assertIn("still a USLS graduate student", answer)
        self.assertNotIn("Not covered", answer)
        self.assertIn("AWOL since", answer)

    def test_an_active_student_has_no_standing_card(self):
        client = self._client("student", "student@usls.edu.ph")
        self.assertIsNone(client.get("/api/student-portal/context").get_json()["leave_overview"]["standing"])

    # ------------------------------------------------------------------ I-205 / I-158 (AD12)
    def test_research_gate_overview_lists_every_student_at_a_gate_with_state_and_reason(self):
        payload = self._client("research_coordinator").get("/api/research-gate/overview")
        self.assertEqual(payload.status_code, 200, payload.get_json())
        body = payload.get_json()
        rows = body["items"]
        self.assertGreater(len(rows), 10)
        states = {"ready", "blocked", "waiting", "done"}
        for row in rows:
            self.assertIn(row["state"], states, row)
            self.assertTrue(row["reason"], row)
            self.assertTrue(row["stage"], row)
            self.assertTrue(row["student"]["name"], row)
            if row["state"] in {"blocked", "waiting"}:
                self.assertTrue(row["waiting_on"], row)
        self.assertEqual(sum(body["counts"].values()), len(rows))
        self.assertEqual({row["waiting_on"] for row in rows if row["state"] == "blocked"} - {"Student"}, set())
        self.assertIn("blocked", {row["state"] for row in rows}, "the seed has students who still owe uploads")
        self.assertEqual(len({row["student"]["id"] for row in rows}), len(rows))

    def test_research_gate_overview_agrees_with_the_per_student_record(self):
        client = self._client("staff")
        row = next(item for item in client.get("/api/research-gate/overview").get_json()["items"] if item["state"] == "blocked")
        context = client.get(f"/api/transactions/research-gate/context?student_id={row['student']['id']}").get_json()
        progress = context["research_progress"]
        self.assertEqual(progress["stage"], row["stage"])
        pending = [item for item in progress["milestone"]["requirements"] if item["status"] != "Complete"]
        self.assertTrue(pending)

    def test_research_gate_overview_is_for_staff_and_coordinators_only(self):
        self.assertEqual(self._client("student", "student@usls.edu.ph").get("/api/research-gate/overview").status_code, 403)
        self.assertEqual(self._client("academic_coordinator").get("/api/research-gate/overview").status_code, 200)
        self.assertEqual(self._client("staff").get("/api/research-gate/overview").status_code, 200)


if __name__ == "__main__":
    unittest.main()
