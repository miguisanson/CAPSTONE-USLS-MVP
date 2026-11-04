"""Audit round 3, research rows (I-312 ... I-325). Reuses the research-core fixtures (one seeded temporary database per test)."""
import unittest
from datetime import timedelta
from unittest.mock import patch

from tests.test_research_core import (  # noqa: F401
    PROPOSAL, TITLE, ResearchCoreBase, app, db, future_weekday,
)
from app import DefenseVerdict, Form1Endorsement, Student, ph_today  # noqa: E402


class StudentDefenseDateLeadTimeTests(ResearchCoreBase):
    """I-312: the student is told the earliest defense date and cannot ask for an earlier one."""

    FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def setUp(self):
        super().setUp()
        patcher = patch("app.faculty_calendar_blocks", return_value=[], create=True)
        patcher.start()
        self.addCleanup(patcher.stop)
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, self.FOUR)
            db.session.commit()

    def ask(self, day):
        return self.student().post("/api/student-portal/requests/defense-scheduling", json={"preferred_date": day.isoformat()})

    def test_context_names_the_earliest_date(self):
        earliest = self.student().get("/api/student-portal/context").get_json()["defense_earliest"]
        with app.app_context():
            self.assertEqual(earliest["date"], (ph_today() + timedelta(days=earliest["days"])).isoformat())
        self.assertGreaterEqual(earliest["days"], 14)
        self.assertEqual(earliest["defense_type"], "Proposal Defense")

    def test_a_date_before_the_lead_time_is_refused_with_the_earliest_date(self):
        earliest = self.student().get("/api/student-portal/context").get_json()["defense_earliest"]
        response = self.ask(ph_today() + timedelta(days=1))
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn(earliest["date"], response.get_json()["error"])

    def test_the_earliest_date_itself_and_later_are_accepted(self):
        earliest = self.student().get("/api/student-portal/context").get_json()["defense_earliest"]
        from datetime import date
        response = self.ask(date.fromisoformat(earliest["date"]))
        self.assertEqual(response.status_code, 200, response.get_json())


if __name__ == "__main__":
    unittest.main()
