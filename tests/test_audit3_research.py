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


class Form1GateOnlyTests(ResearchCoreBase):
    """I-320: Form 1 is endorsed once, at the Form 1 gate; the queue lists only students still at that gate."""

    SIGNATURE = "data:image/png;base64,iVBORw0KGgo="

    def endorse_via_api(self):
        return self.academic().post(
            f"/api/research-gate/form1-endorsements/{self.student_id}", json={"signature_data": self.SIGNATURE})

    def queue_ids(self):
        rows = self.academic().get("/api/research-gate/form1-endorsements").get_json()["items"]
        return [row["student"]["id"] for row in rows]

    def test_a_student_at_the_form_1_gate_is_listed_and_can_be_endorsed_once(self):
        with app.app_context():
            self.fill_uploads(self.student_id, TITLE)
            db.session.commit()
        self.assertEqual(self.queue_ids(), [self.student_id])
        first = self.endorse_via_api()
        self.assertEqual(first.status_code, 200, first.get_json())
        again = self.endorse_via_api()
        self.assertEqual(again.status_code, 409, again.get_json())
        self.assertIn("already", again.get_json()["error"])

    def test_a_student_past_the_title_defense_is_not_listed_and_cannot_be_endorsed(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            db.session.commit()
            endorsed_at = Form1Endorsement.query.filter_by(student_id=self.student_id).one().endorsed_at
        self.assertEqual(self.queue_ids(), [])
        response = self.endorse_via_api()
        self.assertEqual(response.status_code, 409, response.get_json())
        with app.app_context():
            self.assertEqual(Form1Endorsement.query.filter_by(student_id=self.student_id).one().endorsed_at, endorsed_at)


if __name__ == "__main__":
    unittest.main()
