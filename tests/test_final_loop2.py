"""Final polish loop, packet P-F (IM42): questions round 2 that are not research-side.

Research-side items (lead time, derived receipt date, one Form 4, Form 7 score, Turnitin) are in
``tests/test_research_core.py``. Fixtures are borrowed from ``tests/test_standalone_consistency.py``
(a small database, accounts, an AWOL case, a withdrawal) and ``tests/test_monitoring_crud.py``
(the Monitoring Sheet); only the helpers are borrowed, not their tests.
"""
import json
import unittest
from datetime import datetime

from tests import test_monitoring_crud as monitoring  # noqa: E402  (sets DATABASE_URL before app is imported)
from tests import test_standalone_consistency as base  # noqa: E402
import app as app_module  # noqa: E402
from business_rules_catalog import BUSINESS_RULE_CATALOG  # noqa: E402
from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    Course,
    GraduationEndorsement,
    Student,
    SubjectEnrollment,
    WithdrawalApplication,
    app,
    db,
    workflow_case_is_closed,
)

RETURNEE_ITEMS = [
    "Clearance from Business Office",
    "Interview (reason for delay, residency requirements)",
]


class FinalLoop2Tests(unittest.TestCase):
    pass


for _name in ("setUp", "tearDownClass", "_account", "_client", "staff", "dean", "coordinator", "student", "listing",
              "move", "make_awol_case", "make_withdrawal"):
    setattr(FinalLoop2Tests, _name, base.StandaloneConsistencyTests.__dict__[_name])


def _test(function):
    setattr(FinalLoop2Tests, function.__name__, function)
    return function


# I-273: Return from AWOL checks the same returnee items as readmission; IM45 (F6-02): staff cannot forward until both are ticked
@_test
def test_awol_forward_records_which_returnee_items_staff_confirmed(self):
    ref = self.make_awol_case()
    forward = self.move("awol", ref, "forward", confirmed_items=RETURNEE_ITEMS)
    self.assertEqual(forward.status_code, 200, forward.get_json())
    with app.app_context():
        case = db.session.get(AwolCase, int(ref.split("-")[1]))
        self.assertEqual(json.loads(case.staff_checks_json), {RETURNEE_ITEMS[0]: True, RETURNEE_ITEMS[1]: True})
    detail = self.staff().get(f"/api/process-cases/awol/{ref}").get_json()["case"]
    rows = {row["item"]: row["confirmed"] for row in detail["staff_checklist"]}
    self.assertEqual(rows, {RETURNEE_ITEMS[0]: True, RETURNEE_ITEMS[1]: True})


@_test
def test_staff_cannot_forward_an_awol_return_until_both_office_checks_are_ticked(self):
    ref = self.make_awol_case()
    for ticked in ([], RETURNEE_ITEMS[:1], RETURNEE_ITEMS[1:]):
        refused = self.move("awol", ref, "forward", confirmed_items=ticked)
        self.assertEqual(refused.status_code, 409, refused.get_json())
        self.assertIn("Tick ", refused.get_json()["error"])
    self.assertIn("the interview", self.move("awol", ref, "forward", confirmed_items=RETURNEE_ITEMS[:1]).get_json()["error"])
    self.assertIn("the Business Office clearance", self.move("awol", ref, "forward", confirmed_items=RETURNEE_ITEMS[1:]).get_json()["error"])
    with app.app_context():
        self.assertEqual(db.session.get(AwolCase, int(ref.split("-")[1])).status, "Return Submitted")


@_test
def test_the_dean_cannot_approve_an_awol_return_before_the_office_checks_are_confirmed(self):
    # An old record forwarded before IM45 may still carry an unticked check.
    ref = self.make_awol_case()
    self.assertEqual(self.move("awol", ref, "forward", confirmed_items=RETURNEE_ITEMS).status_code, 200)
    with app.app_context():
        case = db.session.get(AwolCase, int(ref.split("-")[1]))
        case.staff_checks_json = json.dumps({RETURNEE_ITEMS[0]: True, RETURNEE_ITEMS[1]: False})
        db.session.commit()
    refused = self.move("awol", ref, "approve", client=self.dean())
    self.assertEqual(refused.status_code, 409, refused.get_json())
    self.assertIn("the interview", refused.get_json()["error"])
    self.assertNotIn("Business Office", refused.get_json()["error"])
    self.assertIn("Graduate School staff", refused.get_json()["error"])
    self.assertNotIn("Return it to staff", refused.get_json()["error"])
    with app.app_context():
        self.assertEqual(db.session.get(AwolCase, int(ref.split("-")[1])).status, "Dean Review")


@_test
def test_the_dean_can_approve_an_awol_return_once_both_checks_are_confirmed(self):
    ref = self.make_awol_case()
    self.assertEqual(self.move("awol", ref, "forward", confirmed_items=RETURNEE_ITEMS).status_code, 200)
    approve = self.move("awol", ref, "approve", client=self.dean())
    self.assertEqual(approve.status_code, 200, approve.get_json())


@_test
def test_an_unknown_returnee_item_is_refused_at_the_awol_forward(self):
    ref = self.make_awol_case()
    refused = self.move("awol", ref, "forward", confirmed_items=["Free lunch"])
    self.assertEqual(refused.status_code, 409, refused.get_json())


# I-285: the sign-in label for the research demo student says where the student really is
@_test
def test_the_sign_in_label_for_the_research_demo_student_matches_the_seeded_state(self):
    from app import WORKFLOW_DEMO_STUDENTS
    miguel = WORKFLOW_DEMO_STUDENTS["research-miguel"]
    self.assertEqual(miguel["ready_label"], "At Final Defense - ready to request the date")


# IM45 (F6-01): a withdrawal / graduation list is closed once it is sent; the acknowledgement is optional
@_test
def test_a_withdrawal_is_closed_once_it_is_sent_to_the_registrar(self):
    student_id = self.students["withdrawal"]
    application_id = self.make_withdrawal(dean_decision="Approved")
    for status, closed in (("Exported - Ready to Send", False), ("Sent to Registrar", True),
                           ("Withdrawn Confirmed", True), ("Denied", True)):
        with app.app_context():
            db.session.get(WithdrawalApplication, application_id).status = status
            db.session.commit()
            self.assertEqual(workflow_case_is_closed("withdrawal", student_id), closed, status)


@_test
def test_a_graduation_endorsement_is_closed_once_it_is_sent_to_the_registrar(self):
    student_id = self.students["withdrawal"]
    for status, closed in (("Dean Approved", False), ("Sent to Registrar", True), ("Registrar Received", True)):
        with app.app_context():
            row = GraduationEndorsement(
                student_id=student_id, review_window="AY 2026-2027", endorsement_status=status,
                registrar_status="Exported - Ready to Send", dean_decision_at=datetime.now())
            db.session.add(row)
            db.session.commit()
            self.assertEqual(workflow_case_is_closed("graduation", student_id), closed, status)
            db.session.delete(row)
            db.session.commit()


@_test
def test_a_sent_withdrawal_is_not_open_work_in_the_queue(self):
    from app import queue_open_cases
    student_id = self.students["withdrawal"]
    application_id = self.make_withdrawal(status="Exported - Ready to Send", dean_decision="Approved")
    with app.app_context():
        db.session.get(WithdrawalApplication, application_id).registrar_status = "Exported - Ready to Send"
        db.session.commit()
    self.assertEqual(self.move("withdrawal", application_id, "send").status_code, 200)
    with app.app_context():
        rows = [row for row in queue_open_cases([student_id]) if row["slug"] == "withdrawal"]
        self.assertEqual(rows, [])


# Item 10: one message about leaving the semester
class RuleTextTests(unittest.TestCase):
    def descriptions(self, *keys):
        return " ".join(rule["description"] for rule in BUSINESS_RULE_CATALOG if not keys or rule["key"] in keys)

    def test_no_rule_text_offers_to_withdraw_all_subjects(self):
        text = self.descriptions().lower()
        self.assertNotIn("withdraw all subjects", text)
        self.assertNotIn("withdraw from all subjects", text)

    def test_the_withdrawal_rules_point_to_a_leave_of_absence(self):
        text = self.descriptions("withdrawal.window_days", "withdrawal.fee_percent_after_window")
        self.assertEqual(text.count("file a Leave of Absence"), 2, text)
        self.assertIn("(full fees apply, Handbook p.51)", text)


class MonitoringLoop2Tests(unittest.TestCase):
    pass


for _name in ("setUp", "tearDownClass", "_account", "_client", "_student_payload", "_create_student"):
    setattr(MonitoringLoop2Tests, _name, monitoring.MonitoringPortalCrudTests.__dict__[_name])


# I-277: the enrollment status is worked out, never picked
def test_a_new_student_with_no_subject_rows_is_not_enrolled_even_if_the_client_says_enrolled(self):
    body = self._create_student(enrollment_tag="Enrolled")
    self.assertEqual(body["student"]["enrollment_tag"], "Not Enrolled")
    with app.app_context():
        self.assertEqual(Student.query.filter_by(student_number="9000001").one().enrollment_tag, "Not Enrolled")


def test_a_new_student_is_enrolled_only_with_subject_rows_in_the_active_semester(self):
    original = app_module.sync_student_curriculum

    def with_subject_row(student):
        original(student)
        term = AcademicTerm.query.filter_by(is_active_planning_term=True).one()
        course = Course.query.filter_by(program_id=student.program_id).first()
        db.session.add(SubjectEnrollment(student_id=student.id, course_id=course.id, term_id=term.id,
                                         status="Enrolled", source_reference="test"))
        db.session.flush()

    app_module.sync_student_curriculum = with_subject_row
    try:
        body = self._create_student(enrollment_tag="Not Enrolled")
    finally:
        app_module.sync_student_curriculum = original
    self.assertEqual(body["student"]["enrollment_tag"], "Enrolled")


for _function in (test_a_new_student_with_no_subject_rows_is_not_enrolled_even_if_the_client_says_enrolled,
                  test_a_new_student_is_enrolled_only_with_subject_rows_in_the_active_semester):
    setattr(MonitoringLoop2Tests, _function.__name__, _function)


# I-170: one drop rule; the free-text "documented exception" is gone
def test_a_drop_needs_unexcused_absences_above_the_limit_and_no_free_text_exception_counts(self):
    import inspect
    from app import drop_evidence
    self.assertEqual(list(inspect.signature(drop_evidence).parameters), ["percent_value"])
    self.assertIsNotNone(drop_evidence(25)[0])
    self.assertIsNotNone(drop_evidence(15)[1])
    self.assertIsNotNone(drop_evidence(20)[1])
    self.assertIsNotNone(drop_evidence("")[1])
    self.assertNotIn("exception", drop_evidence("")[1].lower())


def test_the_monitoring_sheet_refuses_a_drop_that_offers_only_a_documented_exception(self):
    body = self._create_student()
    with app.app_context():
        course_id = Course.query.filter_by(code="MPT-501").one().id
    url = f"/api/monitoring/students/{body['student']['id']}/subjects"
    row = {"course_id": course_id, "status": "Dropped", "reason": "Dropped by the professor",
           "drop_exception_reason": "Subject dissolved by the college before the second week"}
    refused = self._client("staff").post(url, json=row)
    self.assertEqual(refused.status_code, 400, refused.get_json())
    ok = self._client("staff").post(url, json={**row, "unexcused_absence_percent": 25})
    self.assertEqual(ok.status_code, 201, ok.get_json())


for _function in (test_a_drop_needs_unexcused_absences_above_the_limit_and_no_free_text_exception_counts,
                  test_the_monitoring_sheet_refuses_a_drop_that_offers_only_a_documented_exception):
    setattr(MonitoringLoop2Tests, _function.__name__, _function)


if __name__ == "__main__":
    unittest.main()
