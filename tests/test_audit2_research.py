"""Audit round 2, research rows (I-282 schedule request prefill, I-289 verdict and revision notices).

Reuses the research-core fixtures (one seeded temporary database per test)."""
import unittest
from unittest.mock import patch

from tests.test_research_core import (  # noqa: F401
    PROPOSAL, TITLE, ResearchCoreBase, app, db, future_weekday,
)


class ScheduleRequestPrefillTests(ResearchCoreBase):
    """I-282: what the student asked for is stored and offered to staff, so the booking form is prefilled."""

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

    def context(self):
        response = self.staff().get(f"/api/transactions/defense-scheduling/context?student_id={self.student_id}")
        self.assertEqual(response.status_code, 200)
        return response.get_json()

    def test_student_request_reaches_the_staff_context_until_a_booking_is_made(self):
        self.assertIsNone(self.context()["student_request"])
        day = future_weekday(30)
        response = self.student().post("/api/student-portal/requests/defense-scheduling", json={
            "preferred_date": day.isoformat(), "mode": "Online", "venue": "Zoom room B", "constraints": "Not on Mondays",
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        request = self.context()["student_request"]
        self.assertEqual(
            (request["preferred_date"], request["mode"], request["venue"], request["constraints"], request["defense_type"]),
            (day.isoformat(), "Online", "Zoom room B", "Not on Mondays", "Proposal Defense"),
        )
        booked = self.staff().post("/api/transactions/defense-scheduling", json={
            "student_id": self.student_id, "preferred_date": future_weekday(31).isoformat(), "selected_start": "09:00",
            "selected_end": "11:00", "defense_type": "Proposal Defense", "mode": "Online", "venue": "Zoom room B",
        })
        self.assertEqual(booked.status_code, 200, booked.get_json())
        self.assertIsNone(self.context()["student_request"])


if __name__ == "__main__":
    unittest.main()
