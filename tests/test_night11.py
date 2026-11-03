"""pkt/night11: review findings on tonight's merged packets (held defenses, research evidence removal,
graduation endorsement stage sync and decision lookup).

Reuses the research-core fixtures (one seeded temporary database per test).
"""
import os
import unittest
from datetime import date, datetime, timedelta

from tests.test_research_core import (  # noqa: F401
    PROPOSAL, TITLE, DocumentCheck, ResearchCoreBase, ResearchEvidenceFile, ScheduleRequest, Student, TransactionLog, app, db,
)
from app import GraduationEndorsement, graduation_endorsement_undecided  # noqa: E402


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


class VerifiedEvidenceRemovalTests(ResearchCoreBase):
    def verified_file(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            evidence_id = (
                ResearchEvidenceFile.query.join(DocumentCheck)
                .filter(DocumentCheck.gate == PROPOSAL, DocumentCheck.item_name == "Proposal manuscript")
                .one().id
            )
            db.session.commit()
        return evidence_id

    def test_student_still_cannot_remove_a_verified_file(self):
        evidence_id = self.verified_file()
        response = self.student().delete(f"/api/student-portal/research-evidence/{evidence_id}")
        self.assertEqual(response.status_code, 409, response.get_json())

    def test_research_coordinator_and_staff_can_remove_a_verified_file_and_it_is_logged(self):
        for role_client in ("research", "staff"):
            with self.subTest(role=role_client):
                self.setUp()
                evidence_id = self.verified_file()
                response = getattr(self, role_client)().delete(f"/api/research-evidence/{evidence_id}")
                self.assertEqual(response.status_code, 200, response.get_json())
                with app.app_context():
                    check = DocumentCheck.query.filter_by(student_id=self.student_id, gate=PROPOSAL, item_name="Proposal manuscript").one()
                    self.assertEqual(len(check.evidence_files), 0)
                    self.assertNotEqual(check.status, "Complete")
                    log = TransactionLog.query.filter_by(student_id=self.student_id, transaction_slug="research-gate").order_by(TransactionLog.id.desc()).first()
                    self.assertIn("removed", log.result.lower())
                    self.assertNotEqual(log.actor_role, "Student")

    def test_other_roles_cannot_use_the_staff_removal_route(self):
        evidence_id = self.verified_file()
        self.assertEqual(self.student().delete(f"/api/research-evidence/{evidence_id}").status_code, 403)
        self.assertEqual(self.faculty_client("Chair Person").delete(f"/api/research-evidence/{evidence_id}").status_code, 403)


class LatestEndorsementTests(ResearchCoreBase):
    def endorsements(self, *rows):
        """rows: (status, days ago) oldest first."""
        with app.app_context():
            for status, days in rows:
                stamp = datetime.now() - timedelta(days=days)
                db.session.add(GraduationEndorsement(
                    student_id=self.student_id, endorsement_status=status, review_window="AY test", updated_at=stamp,
                ))
            db.session.commit()
            return graduation_endorsement_undecided(db.session.get(Student, self.student_id))

    def test_only_the_latest_endorsement_decides_whether_it_is_undecided(self):
        # seed_report_history leaves old "Returned for Revision" rows behind a later approval
        self.assertFalse(self.endorsements(("Returned for Revision", 60), ("Dean Approved", 5)))

    def test_a_new_open_endorsement_after_an_approval_is_undecided(self):
        self.assertTrue(self.endorsements(("Dean Approved", 60), ("Ready for Dean Review", 5)))


if __name__ == "__main__":
    unittest.main()
