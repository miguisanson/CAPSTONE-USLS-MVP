"""pkt/srv8: I-427 plain student Policy Assistant answers, I-418 year level, I-423 one defense count / availability word /
no overloaded suggestion / score order, plain server texts."""
import json
import os
import tempfile
import unittest
from datetime import timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as appmod  # noqa: E402
from app import (  # noqa: E402
    Student, UserAccount, app, build_demo_database, db, panel_matching_result, suggest_panel_roles,
)

QUESTION = "What happens if I stop coming to class?"
ELENA = "withdrawal.elena@usls.edu.ph"
MAYA = "awol.maya@usls.edu.ph"


class Srv8Tests(unittest.TestCase):
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

    def client_for(self, email):
        with app.app_context():
            account = UserAccount.query.filter_by(email=email).one()
            account_id, role = account.id, account.role
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def ask(self, email, question=QUESTION):
        return self.client_for(email).post("/api/assistant", json={"question": question}).get_json()

    def role_email(self, role):
        with app.app_context():
            return UserAccount.query.filter_by(role=role, active=True).first().email

    # ---- I-427
    def test_student_offline_answer_is_plain(self):
        data = self.ask(ELENA)
        self.assertEqual("student-document-rag-local", data["mode"])
        text = data["answer"]
        for bad in ("(Proposed)", "(Official)", "see 4.", "the platform treats", "Answer from", "Graduate School practice (being finalised)"):
            self.assertNotIn(bad, text)
        self.assertEqual(1, text.count("Sources:"), text)
        self.assertTrue(text.rstrip().split("\n")[-1].startswith("Sources: Operations Manual 4."), text)
        self.assertEqual(1, text.count("Operations Manual"), text)
        self.assertIn("What you can do: Open Return from AWOL", text)
        self.assertIn("Some of this is Graduate School practice that is still being finalised.", text)
        passages = [p for p in text.split("\n\n") if not p.startswith(("What you can do", "Some of this", "Sources"))]
        self.assertEqual(len(passages), len(set(passages)))

    def test_student_source_label_has_no_model_or_search_names(self):
        source = self.ask(ELENA)["source"]
        for key in ("label", "detail"):
            self.assertNotRegex(source.get(key) or "", r"(?i)gemini|keyword")
        self.assertIn("Handbook", source["detail"])

    def test_plain_function_handles_handbook_pages_and_repeats(self):
        from app import _student_plain_policy
        text = "Same rule.\nSource: Graduate School Handbook (p. 54)\n\nSame rule.\nSource: Graduate School Handbook (p. 55 and 56)"
        out, _ = _student_plain_policy(text, [], "can I take a leave?")
        self.assertEqual(1, out.count("Same rule."))
        self.assertIn("What you can do: Open Leave of Absence", out)
        self.assertTrue(out.endswith("Sources: Graduate School Handbook p. 54, p. 55"), out)

    def test_staff_answer_keeps_its_shape(self):
        data = self.ask("dean@usls.edu.ph")
        text = data["answer"] + json.dumps(data["citations"])
        self.assertIn("pending Graduate School validation", text)
        self.assertNotIn("Sources:", data["answer"])
        self.assertNotIn("What you can do", data["answer"])

    # ---- I-418
    def test_year_level_is_years_since_entry(self):
        from app import academic_year_start, student_brief
        with app.app_context():
            start = academic_year_start()
            for email, at_least in ((MAYA, 2), (ELENA, 1)):
                student = db.session.get(Student, UserAccount.query.filter_by(email=email).one().student_id)
                brief = student_brief(student)
                self.assertEqual(f"Year {start - student.entry_year + 1}", brief["course_year_label"], email)
                self.assertGreaterEqual(int(brief["year_level"]), at_least, email)
                self.assertEqual(f"Year {brief['year_level']}", student.year_level, email)

    # ---- I-423
    def test_defense_tile_counts_what_the_calendar_shows(self):
        from app import ph_today
        client = self.client_for(self.role_email("research_coordinator"))
        today = ph_today()
        end = today + timedelta(days=30)
        events = client.get(f"/api/calendar?start={today.isoformat()}&end={end.isoformat()}").get_json()["events"]
        shown = [e for e in events if e["status"] in ("Scheduled", "Confirmed")]
        self.assertEqual(len(shown), client.get("/api/dashboard").get_json()["kpis"]["confirmed_schedules"])

    def _matching_rows(self):
        with app.app_context():
            for student in Student.query.filter(Student.current_stage.in_(["Proposal Development", "Proposal Defense"])).limit(60).all():
                rows = panel_matching_result(student)["rows"]
                if rows:
                    yield rows

    def test_matching_uses_the_directory_availability_word(self):
        from app import faculty_dict
        checked = 0
        for rows in self._matching_rows():
            for row in rows:
                self.assertNotEqual("Limited availability", row["availability_status"])
                if row["availability_source"] == "profile_schedule" and faculty_dict(row["faculty"])["availability_status"] == "Available":
                    self.assertEqual("Available", row["availability_status"], row["faculty"].name)
                    checked += 1
            if checked:
                break
        self.assertGreater(checked, 0, "no student with a paper to match")

    def test_overloaded_faculty_is_not_suggested_when_another_fits(self):
        class F:  # only .id is read
            def __init__(self, i):
                self.id, self.name = i, f"F{i}"
        rows = [
            {"faculty": F(1), "score": 90, "method_affinity": 0, "flags": [{"type": "overload"}]},
            {"faculty": F(2), "score": 80, "method_affinity": 0, "flags": []},
            {"faculty": F(3), "score": 70, "method_affinity": 0, "flags": []},
        ]
        seats = suggest_panel_roles(rows, ["Panel Chair", "Content Specialist"])
        self.assertEqual({2, 3}, {s["faculty_id"] for s in seats})
        seats = suggest_panel_roles(rows[:2], ["Panel Chair", "Content Specialist"])
        self.assertEqual({1, 2}, {s["faculty_id"] for s in seats})  # nobody else fits: still suggested

    def test_ranking_follows_score_or_says_why(self):
        checked = 0
        for rows in self._matching_rows():
            for i, row in enumerate(rows):
                if any(later["score"] > row["score"] for later in rows[i + 1:]):
                    later = [r for r in rows[i + 1:] if r["score"] > row["score"]][0]
                    messages = {f["type"]: f["message"] for f in later["flags"]}
                    self.assertIn("no_overlap", messages)
                    self.assertIn("ranked after", messages["no_overlap"])
                    checked += 1
            if checked:
                break
        self.assertGreater(checked, 0, "no ranking where a higher score sits lower")

    # ---- texts
    def test_research_lock_and_fee_texts(self):
        from app import FEE_INFORMATION_ONLY, research_lock_status, withdrawal_policy_statement
        text = research_lock_status({"eligible": False, "missing_subjects": 5, "current_count": 2, "missing_count": 3})
        self.assertEqual("Locked - 5 subjects left: 2 this semester, 3 still to take, before research", text)
        for text in (withdrawal_policy_statement(), FEE_INFORMATION_ONLY):
            self.assertNotIn("term's total due", text)
            self.assertNotIn("settles the fees", text)
        self.assertIn("your total fees for this semester", withdrawal_policy_statement())
        self.assertIn("Pay or settle it at the Business Office.", FEE_INFORMATION_ONLY)


if __name__ == "__main__":
    unittest.main()
