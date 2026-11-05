"""Final polish loop, packet P-C (Fable review 2026-11-05, IM42): backend logic fixes.

The fixtures (a small empty database, accounts, a withdrawal, an AWOL case...) come from
``tests/test_standalone_consistency.py``; only the helpers are borrowed, not its tests.
"""
import re
import unittest
from datetime import date, datetime, timedelta

from tests import test_standalone_consistency as base  # noqa: E402  (sets DATABASE_URL before app is imported)
import leave_workflow as lw  # noqa: E402
import standalone_process as sp  # noqa: E402
from app import (  # noqa: E402
    GraduationEndorsement,
    LeaveCase,
    SubjectEnrollment,
    WithdrawalApplication,
    app,
    db,
)

_BORROWED = (
    "setUp", "tearDownClass", "_account", "_client", "staff", "dean", "coordinator", "student", "listing", "move",
    "make_awol_case", "make_withdrawal", "make_loa_submitted", "make_readmission_submitted",
)


class FinalLoopTests(unittest.TestCase):
    pass


for _name in _BORROWED:
    setattr(FinalLoopTests, _name, base.StandaloneConsistencyTests.__dict__[_name])


def _test(function):
    setattr(FinalLoopTests, function.__name__, function)
    return function


# F5-07: nobody waits on a finished request that has no move left
@_test
def test_finished_denied_statuses_have_no_owner(self):
    self.assertEqual(lw.STATUS_BY_KEY["Denied"]["owner"], "")
    self.assertEqual(lw.STATUS_BY_KEY["Expired"]["owner"], "")
    self.assertEqual(sp.status_by_key(sp.SLUG_AWOL)["Return Denied"]["owner"], "")
    self.assertEqual(sp.status_by_key(sp.SLUG_WITHDRAWAL)["Denied"]["owner"], "")
    self.assertIn("tell the student", lw.STATUS_BY_KEY["Denied"]["description"])
    self.assertIn("explain", sp.status_by_key(sp.SLUG_AWOL)["Return Denied"]["description"])


# F5-01: no pronouns for people in backend strings
@_test
def test_status_and_move_texts_have_no_pronouns_for_people(self):
    texts = [item["description"] for item in lw.STATUS_INFO]
    for slug in sp.STATUS_INFO_BY_SLUG:
        texts += [item["description"] for item in sp.status_info(slug)]
        texts += [item["confirm"] for item in sp.TRANSITIONS[slug]]
    texts += [item["confirm"] for item in lw.TRANSITIONS]
    for text in texts:
        self.assertIsNone(re.search(r"\b(they|them|their|he|she|his|her)\b", text, re.I), text)


# F5-06: Withdrawal ends with Sent to the Registrar, then Acknowledged
def _step(case, label):
    return next(step for step in case["timeline"] if step["label"] == label)["state"]


@_test
def test_withdrawal_sent_to_registrar_is_a_staff_move_and_completes_the_timeline_step(self):
    application_id = self.make_withdrawal(status="Exported - Ready to Send", dean_decision="Approved")
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        application.registrar_status = "Exported - Ready to Send"
        db.session.commit()
    detail = self.staff().get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
    self.assertEqual([a["action"] for a in detail["actions"]], ["send"])
    self.assertNotEqual(_step(detail, "Emailed to the Registrar"), "complete", "exporting is not sending")
    sent = self.move("withdrawal", application_id, "send")
    self.assertEqual(sent.status_code, 200, sent.get_json())
    case = sent.get_json()["case"]
    self.assertEqual(case["status"], "Sent to Registrar")
    self.assertEqual(_step(case, "Emailed to the Registrar"), "complete")
    self.assertEqual([a["action"] for a in case["actions"]], ["acknowledge"])
    done = self.move("withdrawal", application_id, "acknowledge")
    self.assertEqual(done.status_code, 200, done.get_json())
    self.assertEqual(done.get_json()["case"]["status"], "Withdrawn Confirmed")
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        self.assertEqual(application.registrar_status, "Acknowledged")
        self.assertIsNotNone(application.registrar_sent_at)
        self.assertIsNotNone(application.registrar_confirmed_at)


@_test
def test_withdrawal_send_is_refused_before_the_export_and_for_the_dean(self):
    application_id = self.make_withdrawal(status="Dean Review")
    self.assertEqual(self.move("withdrawal", application_id, "send").status_code, 409)
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        application.status, application.dean_decision = "Exported - Ready to Send", "Approved"
        db.session.commit()
    self.assertEqual(self.move("withdrawal", application_id, "send", client=self.dean()).status_code, 409)


@_test
def test_a_restart_does_not_undo_a_sent_withdrawal(self):
    from app import normalize_withdrawal_workflow_states
    application_id = self.make_withdrawal(status="Sent to Registrar", dean_decision="Approved")
    with app.app_context():
        normalize_withdrawal_workflow_states()
        db.session.commit()
        self.assertEqual(db.session.get(WithdrawalApplication, application_id).status, "Sent to Registrar")


# I-324: Graduation gets the same two moves
def _approved_exported_endorsement(self):
    with app.app_context():
        endorsement = GraduationEndorsement(
            student_id=self.students["withdrawal"], review_window="AY 2026-2027", batch_name="Batch 1 July 2026",
            endorsement_status="Dean Approved", registrar_status="Exported - Ready to Send",
            dean_decision_at=datetime.now(),
        )
        db.session.add(endorsement)
        db.session.commit()
        return endorsement.id


@_test
def test_graduation_export_is_followed_by_sent_and_received(self):
    endorsement_id = _approved_exported_endorsement(self)
    student_id = self.students["withdrawal"]
    url = "/api/transactions/graduation"
    sent = self.staff().post(url, json={"student_id": student_id, "endorsement_status": "Sent to Registrar"})
    self.assertEqual(sent.status_code, 200, sent.get_json())
    with app.app_context():
        endorsement = db.session.get(GraduationEndorsement, endorsement_id)
        self.assertEqual(endorsement.endorsement_status, "Sent to Registrar")
        self.assertEqual(endorsement.registrar_status, "Sent to Registrar")
    again = self.staff().post(url, json={"student_id": student_id, "endorsement_status": "Sent to Registrar"})
    self.assertEqual(again.status_code, 400, "sending twice is refused")
    received = self.staff().post(url, json={"student_id": student_id, "endorsement_status": "Registrar Received"})
    self.assertEqual(received.status_code, 200, received.get_json())
    with app.app_context():
        endorsement = db.session.get(GraduationEndorsement, endorsement_id)
        self.assertEqual(endorsement.endorsement_status, "Registrar Received")
        self.assertEqual(endorsement.registrar_status, "Acknowledged")
        self.assertIsNotNone(endorsement.registrar_received_at)


@_test
def test_graduation_send_needs_an_exported_list(self):
    with app.app_context():
        db.session.add(GraduationEndorsement(
            student_id=self.students["withdrawal"], review_window="AY 2026-2027", endorsement_status="Dean Approved",
            registrar_status="Pending"))
        db.session.commit()
    response = self.staff().post("/api/transactions/graduation", json={
        "student_id": self.students["withdrawal"], "endorsement_status": "Sent to Registrar"})
    self.assertEqual(response.status_code, 400)
    self.assertIn("export", response.get_json()["error"].lower())


# I-306: the Dean's approval tags the subject at once
@_test
def test_the_deans_approval_tags_the_subject_withdrawn_without_a_staff_step(self):
    application_id = self.make_withdrawal()
    self.assertEqual(self.move("withdrawal", application_id, "forward").status_code, 200)
    approve = self.move("withdrawal", application_id, "approve", client=self.dean())
    self.assertEqual(approve.status_code, 200, approve.get_json())
    case = approve.get_json()["case"]
    self.assertEqual(case["status"], "Subject Tagged - Registrar Preparation")
    staff_view = self.staff().get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
    self.assertEqual([a["action"] for a in staff_view["actions"]], ["export"])
    self.assertNotIn("tag", [item["action"] for item in sp.TRANSITIONS[sp.SLUG_WITHDRAWAL] if "Dean Review" in item["from"]])
    with app.app_context():
        enrollment = SubjectEnrollment.query.filter_by(student_id=self.students["withdrawal"]).one()
        self.assertEqual(enrollment.status, "Withdrawn")
        application = db.session.get(WithdrawalApplication, application_id)
        self.assertEqual(application.registrar_status, "Pending Excel Export")


# I-167: the closed-window texts send the student to a Leave of Absence, never to an all-subjects withdrawal
@_test
def test_closed_window_messages_point_to_a_leave_of_absence_only(self):
    import app as app_module
    sentence = ("After the second week a single subject cannot be withdrawn. To leave the semester, "
                "file a Leave of Absence (full fees apply, Handbook p.51).")
    with app.app_context():
        enrollment = SubjectEnrollment(
            student_id=self.students["withdrawal"], course_id=self.course_id,
            term_id=self.term_ids["Running Term"], status="Enrolled")
        term = db.session.get(app_module.AcademicTerm, self.term_ids["Running Term"])
        term.start_date = date.today() - timedelta(days=40)
        db.session.add(enrollment)
        db.session.flush()
        window = app_module.subject_withdrawal_window(enrollment)
        self.assertFalse(window["eligible"])
        texts = [app_module.withdrawal_window_closed_message(window), window["fee_consequence"],
                 app_module.withdrawal_policy_statement()]
        policy = next(item["text"] for item in app_module.POLICY_SNIPPETS if item["id"] == "withdrawal")
        texts.append(policy)
        db.session.rollback()
    for text in texts:
        self.assertIn(sentence, text)
        self.assertNotIn("all subjects", text)
        self.assertNotIn("withdraw all", text)


# I-278: a returned withdrawal that is sent again keeps its first submission date
@_test
def test_a_resent_withdrawal_is_judged_from_its_first_submission_date(self):
    import app as app_module
    student_id = self.students["withdrawal"]
    application_id = self.make_withdrawal(status="Returned for Clarification")
    with app.app_context():
        term = db.session.get(app_module.AcademicTerm, self.term_ids["Running Term"])
        term.start_date, term.end_date = date.today() - timedelta(days=30), date.today() + timedelta(days=90)
        application = db.session.get(WithdrawalApplication, application_id)
        first = datetime.now() - timedelta(days=25)  # day 5 of classes: inside the first week
        application.created_at = first
        enrollment_id = application.subject_enrollment_id
        account = base.UserAccount(
            email="wd.student@example.test", full_name="Withdrawal Student", role="student", active=True,
            password_hash=base.generate_password_hash("test-password"), student_id=student_id)
        db.session.add(account)
        db.session.commit()
        account_id = account.id
    client = self._client(account_id, "student")
    response = client.post("/api/student-portal/requests/withdrawal", json={
        "subject_enrollment_id": enrollment_id, "reason": "Corrected: work schedule clash."})
    self.assertEqual(response.status_code, 200, response.get_json())
    self.assertIn("10%", response.get_json()["message"], "the first-week fee still applies")
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        self.assertEqual(application.status, "Submitted to GS Staff")
        self.assertEqual(application.effective_date, first.date())
    # A brand-new request filed on the same day is judged from today and is refused.
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        application.status = "Withdrawn Confirmed"
        db.session.commit()
    fresh = client.post("/api/student-portal/requests/withdrawal", json={
        "subject_enrollment_id": enrollment_id, "reason": "Another try."})
    self.assertEqual(fresh.status_code, 409, fresh.get_json())


# I-297: the Dean cannot approve a readmission before staff confirmed clearance and interview;
# IM45 (F6-02): staff cannot forward it until both are ticked
@_test
def test_staff_cannot_forward_a_readmission_without_the_office_checks(self):
    case_id = self.make_readmission_submitted()
    for items in ([], base.CHECKLIST[:1]):
        forward = self.move("readmission", case_id, "forward", eligibility_result="Eligible", readmission_items=items)
        self.assertEqual(forward.status_code, 409, forward.get_json())
        self.assertIn("Tick ", forward.get_json()["error"])
    with app.app_context():
        self.assertNotEqual(db.session.get(LeaveCase, case_id).status, "Dean Review")


@_test
def test_the_dean_cannot_approve_a_readmission_without_the_staff_checks(self):
    # An old record forwarded before IM45 may still carry unticked checks.
    case_id = self.make_readmission_submitted()
    forward = self.move("readmission", case_id, "forward", eligibility_result="Eligible", readmission_items=base.CHECKLIST)
    self.assertEqual(forward.status_code, 200, forward.get_json())
    with app.app_context():
        db.session.get(LeaveCase, case_id).staff_checks_json = "{}"
        db.session.commit()
    refused = self.move("readmission", case_id, "approve", client=self.dean())
    self.assertEqual(refused.status_code, 409, refused.get_json())
    message = refused.get_json()["error"]
    self.assertIn("Business Office", message)
    self.assertIn("interview", message)
    self.assertIn("Graduate School staff", message)
    self.assertNotIn("Return it to staff", message)
    with app.app_context():
        self.assertEqual(db.session.get(LeaveCase, case_id).status, "Dean Review")


@_test
def test_the_dean_can_approve_a_readmission_once_staff_confirmed_the_checks(self):
    case_id = self.make_readmission_submitted()
    forward = self.move("readmission", case_id, "forward", eligibility_result="Eligible", readmission_items=base.CHECKLIST)
    self.assertEqual(forward.status_code, 200, forward.get_json())
    approved = self.move("readmission", case_id, "approve", client=self.dean())
    self.assertEqual(approved.status_code, 200, approved.get_json())


# I-302: the two-week no-grant check runs again when the Dean approves
def _loa_in_dean_review_with_term_ending_in(self, days):
    import app as app_module
    case_id = self.make_loa_submitted()
    self.assertEqual(self.move("leave-of-absence", case_id, "forward", eligibility_result="Eligible").status_code, 200)
    with app.app_context():
        case = db.session.get(LeaveCase, case_id)
        term = db.session.get(app_module.AcademicTerm, self.term_ids["Running Term"])
        term.end_date = date.today() + timedelta(days=days)
        case.start_term_id, case.start_label = term.id, term.label
        db.session.commit()
    return case_id


@_test
def test_the_dean_cannot_approve_a_leave_filed_in_the_last_two_weeks_of_the_semester(self):
    from unittest import mock
    case_id = _loa_in_dean_review_with_term_ending_in(self, 5)
    with mock.patch("app.demo_skip_date_waits", return_value=False):
        refused = self.move("leave-of-absence", case_id, "approve", client=self.dean())
    self.assertEqual(refused.status_code, 409, refused.get_json())
    self.assertIn("No leave of absence is granted within", refused.get_json()["error"])
    self.assertIn("p.", refused.get_json()["error"])
    self.assertIn("Deny it or return it for a later semester", refused.get_json()["error"])  # IM45 (F6-05)
    with app.app_context():
        self.assertEqual(db.session.get(LeaveCase, case_id).status, "Dean Review")


@_test
def test_the_demo_skip_date_waits_switch_lets_that_approval_through(self):
    from unittest import mock
    case_id = _loa_in_dean_review_with_term_ending_in(self, 5)
    with mock.patch("app.demo_skip_date_waits", return_value=True):
        approved = self.move("leave-of-absence", case_id, "approve", client=self.dean())
    self.assertEqual(approved.status_code, 200, approved.get_json())


# IM45 (F6-04): the Dean is told what to do, not sent to a staff page
@_test
def test_the_dean_approving_a_withdrawal_for_a_subject_already_dropped_is_told_what_to_do(self):
    application_id = self.make_withdrawal(status="Dean Review")
    with app.app_context():
        application = db.session.get(WithdrawalApplication, application_id)
        application.subject_enrollment.status = "Dropped"
        db.session.commit()
    refused = self.move("withdrawal", application_id, "approve", client=self.dean())
    self.assertEqual(refused.status_code, 409, refused.get_json())
    message = refused.get_json()["error"]
    self.assertIn("already Dropped", message)
    self.assertIn("Deny the request and tell the student", message)
    self.assertNotIn("handoff list", message)


class FinalLoopSeedTests(unittest.TestCase):
    """Checks that need the full demo database (built once, about a minute)."""

    @classmethod
    def setUpClass(cls):
        from app import build_demo_database
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            build_demo_database()

    def client_for(self, email, role):
        with app.app_context():
            account_id = base.UserAccount.query.filter_by(email=email).one().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    # IM45 (F6-07): a seeded "Passed" comprehensive exam has a history row, so the page does not say "no result recorded"
    def test_every_seeded_passed_comprehensive_exam_has_a_result_row(self):
        from app import ComprehensiveExamResult, Student
        with app.app_context():
            passed = [s.id for s in Student.query.filter_by(comprehensive_exam_status="Passed").all()]
            recorded = {row.student_id: row for row in ComprehensiveExamResult.query.all()}
            self.assertTrue(passed)
            self.assertEqual([i for i in passed if i not in recorded], [])
            sample = recorded[passed[0]]
            self.assertEqual(sample.result, "Passed")
            self.assertTrue(sample.source and sample.reason and sample.recorded_by)

    # F5-13: every seeded leave case has a reason category
    def test_every_seeded_leave_case_has_a_reason_category(self):
        with app.app_context():
            missing = [
                (case.id, case.student.name, case.kind, case.source)
                for case in LeaveCase.query.all() if not (case.reason_category or "").strip()
                and case.kind in {"LOA", "LOA_EXTENSION"}
            ]
            self.assertEqual(missing, [])

    # F5-14: the Research Coordinator home counts Blocked and Ready students and lists the verdict waits
    def test_research_coordinator_home_counts_gate_students_and_lists_panel_waits(self):
        research = self.client_for("research@usls.edu.ph", "research_coordinator")
        rows = research.get("/api/research-gate/overview").get_json()["items"]
        open_ids = {row["student"]["id"] for row in rows if row["state"] in {"ready", "blocked"}}
        verdict_waits = [row for row in rows if row["state"] == "waiting" and row["waiting_on"] == "Panel chair or Graduate School staff"]
        home = research.get("/api/dashboard").get_json()
        self.assertTrue(open_ids, "the demo data has Ready or Blocked research students")
        self.assertGreaterEqual(home["kpis"]["total_students"], len(open_ids))
        waiting = home["research_waiting"]
        self.assertEqual(waiting["total"], len(verdict_waits))
        self.assertLessEqual(len(waiting["items"]), 3)
        self.assertEqual(waiting["view_all"], "/workflow/research-gate")
        for item in waiting["items"]:
            self.assertEqual(item["to"], "/workflow/research-gate")
        staff = self.client_for("staff@usls.edu.ph", "staff").get("/api/dashboard").get_json()
        self.assertIsNone(staff["research_waiting"])

    def test_research_coordinator_home_shows_at_most_three_panel_waits_and_a_link(self):
        from unittest import mock
        research = self.client_for("research@usls.edu.ph", "research_coordinator")
        with app.app_context():
            students = base.Student.query.order_by(base.Student.id).limit(5).all()
            rows = [
                {"student": {"id": student.id, "name": student.name}, "stage": "Proposal Defense", "state": "waiting",
                 "waiting_on": "Panel chair or Graduate School staff", "reason": "Defense is scheduled; the verdict is not recorded."}
                for student in students
            ]
        with mock.patch("app.research_gate_overview_rows", return_value=rows):
            waiting = research.get("/api/dashboard").get_json()["research_waiting"]
        self.assertEqual(waiting["total"], 5)
        self.assertEqual(len(waiting["items"]), 3)
        self.assertEqual(waiting["view_all"], "/workflow/research-gate")
