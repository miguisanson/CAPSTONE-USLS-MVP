"""Ethics clearance comes after the proposal defense (Research Protocol, Forms 5.1/5.2).

Panel matching for the proposal defense must therefore not wait for it; the
clearance is required before the final stage instead.
"""

import unittest

from tests.test_research_core import PROPOSAL, TITLE, ResearchCoreBase  # noqa: F401
from app import app, db, research_matching_profile, Student  # noqa: E402


class EthicsOrderTests(ResearchCoreBase):
    def test_proposal_panel_matching_does_not_wait_for_ethics_clearance(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            db.session.commit()
            profile = research_matching_profile(db.session.get(Student, self.student_id))
            self.assertEqual(profile["gate"], PROPOSAL)
            self.assertTrue(profile["ethics_ready"], profile.get("blocked_reason"))
            self.assertNotIn("ethics", (profile.get("blocked_reason") or "").lower())


if __name__ == "__main__":
    unittest.main()
