"""pkt/night11: review findings on tonight's merged packets (held defenses, research evidence removal,
graduation endorsement stage sync and decision lookup).

Reuses the research-core fixtures (one seeded temporary database per test).
"""
import os
import unittest
from datetime import date, timedelta

from tests.test_research_core import (  # noqa: F401
    PROPOSAL, TITLE, ResearchCoreBase, ScheduleRequest, app, db,
)


class HeldDefenseRequestTests(ResearchCoreBase):
    NAMES = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def at_proposal_with_verdict(self, result):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL)
            self.panel(self.student_id, PROPOSAL, self.NAMES)
            schedule = self.schedule(self.student_id, "Proposal Defense", names=self.NAMES)
            db.session.commit()
            schedule_id = schedule.id
        response = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": result, "remarks": "see notes"})
        self.assertEqual(response.status_code, 200, response.get_json())

    def request_date(self):
        future = (date.today() + timedelta(days=40)).isoformat()
        return self.student().post("/api/student-portal/requests/defense-scheduling", json={"preferred_date": future})

    # ---- review item 1: a defense that was held is not requested again ----
    def test_no_new_schedule_request_once_the_defense_was_held_with_revisions(self):
        self.at_proposal_with_verdict("Passed with minor revisions")
        refused = self.request_date()
        self.assertEqual(refused.status_code, 409, refused.get_json())
        self.assertIn("already took place", refused.get_json()["error"])
        with app.app_context():
            from app import Task
            self.assertEqual(Task.query.filter(Task.student_id == self.student_id, Task.title.like("Review student%schedule request")).count(), 0)

    def test_a_failed_defense_does_not_trip_the_held_refusal(self):
        self.at_proposal_with_verdict("Failed")
        response = self.request_date()
        self.assertNotIn("already took place", (response.get_json() or {}).get("error", ""))


if __name__ == "__main__":
    unittest.main()
