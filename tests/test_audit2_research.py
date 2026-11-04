"""Audit round 2, research rows (I-282 schedule request prefill, I-289 verdict and revision notices).

Reuses the research-core fixtures (one seeded temporary database per test)."""
import unittest
from unittest.mock import patch

from tests.test_research_core import (  # noqa: F401
    PROPOSAL, TITLE, ResearchCoreBase, app, db, future_weekday,
)
from app import Notification  # noqa: E402


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


class VerdictNoticeTests(ResearchCoreBase):
    """I-289: a verdict, submitted revisions and confirmed revisions each tell the people who must act next."""

    NAMES = ["Chair Person", "Content Person", "Method Person", "External Person"]

    def verdict_recorded(self, result="Passed with minor revisions"):
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
        return response.get_json()["verdict"]["id"]

    def notices(self, account_id, kind=None):
        with app.app_context():
            query = Notification.query.filter_by(account_id=account_id)
            return [n for n in query.all() if kind is None or n.kind == kind]

    def test_chair_verdict_notifies_the_student_and_the_adviser(self):
        self.verdict_recorded()
        self.assertTrue(self.notices(self.student_account_id, "defense_verdict"))
        self.assertTrue(self.notices(self.faculty_account_ids["Adviser Person"], "defense_verdict"))

    def test_submitted_revisions_notify_the_adviser_and_confirmation_notifies_the_student(self):
        verdict_id = self.verdict_recorded()
        adviser = self.faculty_account_ids["Adviser Person"]
        self.assertFalse(self.notices(adviser, "defense_revisions_submitted"))
        sent = self.student().post(f"/api/student-portal/defense-verdicts/{verdict_id}/revisions", json={"note": "Chapter 2 rewritten"})
        self.assertEqual(sent.status_code, 200, sent.get_json())
        self.assertTrue(self.notices(adviser, "defense_revisions_submitted"))
        self.assertFalse(self.notices(self.student_account_id, "defense_revisions_confirmed"))
        done = self.faculty_client("Adviser Person").post(
            f"/api/faculty-portal/defense-verdicts/{verdict_id}/confirm-revisions", json={"note": "Checked"})
        self.assertEqual(done.status_code, 200, done.get_json())
        self.assertTrue(self.notices(self.student_account_id, "defense_revisions_confirmed"))


if __name__ == "__main__":
    unittest.main()
