"""v5.3 consistency, backend side (AD9 / I-130).

A case in Dean Review is locked for staff on every standalone board: the Dean owns that decision and
is the one who can return it. These tests read only the move table in ``standalone_process.py``.
"""
import unittest

import leave_workflow
import standalone_process as sp


class DeanReviewIsLockedForStaffTests(unittest.TestCase):
    def test_staff_have_no_move_on_a_withdrawal_in_dean_review(self):
        for role in ("staff", "academic_coordinator"):
            self.assertEqual(
                sp.transitions_from("withdrawal", "Dean Review", sp.KIND_WITHDRAWAL, role), [],
                f"{role} must see the lock 'Waiting for: Dean', not a move",
            )

    def test_the_dean_can_still_return_or_decide_a_withdrawal_in_dean_review(self):
        actions = {m["action"] for m in sp.transitions_from("withdrawal", "Dean Review", sp.KIND_WITHDRAWAL, "dean")}
        self.assertEqual(actions, {"approve", "deny", "return"})

    def test_staff_can_still_return_a_withdrawal_before_it_reaches_the_dean(self):
        actions = {m["action"] for m in sp.transitions_from("withdrawal", "Submitted to GS Staff", sp.KIND_WITHDRAWAL, "staff")}
        self.assertEqual(actions, {"forward", "return"})

    def test_no_standalone_process_lets_staff_move_a_case_the_dean_holds(self):
        for slug in sp.PROCESS_SLUGS:
            dean_statuses = [s["key"] for s in sp.status_info(slug) if s["owner"] == sp.DEAN]
            self.assertTrue(dean_statuses, slug)
            for status in dean_statuses:
                for kind in sp.KINDS_FOR_SLUG[slug]:
                    for role in ("staff", "academic_coordinator"):
                        self.assertEqual(sp.transitions_from(slug, status, kind, role), [], (slug, status, kind, role))

    def test_leave_of_absence_and_readmission_are_locked_the_same_way(self):
        for kind in (leave_workflow.KIND_LOA, leave_workflow.KIND_READMISSION):
            for role in ("staff", "academic_coordinator"):
                self.assertEqual(leave_workflow.transitions_from("Dean Review", kind, role), [], (kind, role))

    def test_the_refusal_for_staff_names_the_dean(self):
        reason = sp.refusal_reason("withdrawal", "Dean Review", "return", sp.KIND_WITHDRAWAL, "staff")
        self.assertIn("Dean", reason)


if __name__ == "__main__":
    unittest.main()
