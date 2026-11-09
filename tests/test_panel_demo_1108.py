"""Panel demo readiness for Withdrawal, Practicum and Graduation (owner 2026-11-08).

- A Demo Guide for one of these workflows resets only its own demo student, never another guide's case or work done
  by hand, and the visitor's demo data gets a new id so the boards do not show reset cards as "Moved here · new".
- The seed has history rows for the lists it shows as already exported, one Dean-approved graduation batch that
  really exports, and a record waiting at the start of every step of the three workflows.
"""

import json
import os
import shutil
import tempfile
import unittest
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    DEMO_STUDENT_NUMBERS,
    EXPORTABLE_GRADUATION_STUDENTS,
    STAGE_READY_GRADUATION,
    STAGE_READY_PRACTICUM,
    STAGE_READY_WITHDRAWAL,
    GraduationEndorsement,
    LeaveExportLog,
    PracticumRecord,
    Student,
    UserAccount,
    WithdrawalApplication,
    app,
    build_demo_database,
    db,
    graduation_eligibility,
)

COOKIE = "usls_sandbox"


class PanelDemoSeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def signed_in(self, email):
        client = app.test_client()
        with app.app_context():
            account = UserAccount.query.filter_by(email=email).one()
            account_id, role = account.id, account.role
        with client.session_transaction() as session:
            session["account_id"], session["role"] = account_id, role
        return client

    # -- export history (Part A item 7)
    def test_every_exported_withdrawal_is_in_a_downloaded_list(self):
        with app.app_context():
            exported = {
                item.id for item in WithdrawalApplication.query.filter(
                    WithdrawalApplication.dean_decision == "Approved",
                    WithdrawalApplication.status.in_(("Exported - Ready to Send", "Sent to Registrar", "Withdrawn Confirmed")),
                )
            }
            self.assertTrue(exported, "the seed has exported withdrawals")
            listed = set()
            for row in LeaveExportLog.query.filter_by(slug="withdrawal"):
                listed |= set(json.loads(row.case_ids_json))
                self.assertTrue(row.file_name.endswith(".xlsx"))
                self.assertIn("Graduate School Staff", row.exported_by_name)
            self.assertEqual(listed, exported)
        response = self.signed_in("staff@usls.edu.ph").get("/api/leave-cases/export-log?slug=withdrawal")
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        items = response.get_json()["items"]
        self.assertTrue(items and all(item["details"] for item in items), "each row names the students")

    # -- graduation export (Part A item 8)
    def test_past_graduation_batches_are_history_and_one_batch_is_ready_to_export(self):
        with app.app_context():
            waiting = GraduationEndorsement.query.filter_by(endorsement_status="Dean Approved", registrar_status="Pending").all()
            names = {row.student.student_number for row in waiting}
            self.assertEqual(names, {number for number, _, _ in EXPORTABLE_GRADUATION_STUDENTS})
            self.assertEqual(len({row.batch_name for row in waiting}), 1, "one batch")
            for row in waiting:
                self.assertTrue(graduation_eligibility(row.student)["eligible"], row.student.name)
            history = LeaveExportLog.query.filter_by(slug="graduation").all()
            self.assertTrue(history, "the past batches have export history rows")
            ids = [row.id for row in waiting]
        dean = self.signed_in("dean@usls.edu.ph")
        response = dean.post("/api/graduation/endorsed.csv", json={"endorsement_ids": ids})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertEqual(response.headers["X-Exported-Count"], str(len(ids)))
        self.assertNotIn("X-Left-Out", response.headers)
        log = dean.get("/api/leave-cases/export-log?slug=graduation").get_json()["items"]
        self.assertEqual(log[0]["case_count"], len(ids))
        self.assertTrue(log[0]["details"].startswith("Batch "), log[0])

    # -- stage-ready records (Part B)
    def test_a_record_waits_at_every_step(self):
        with app.app_context():
            practicum = {row.status: row for row in PracticumRecord.query.all()}
            for _number, _first, _last, status, hours, _ in STAGE_READY_PRACTICUM:
                self.assertIn(status, practicum, status)
                if hours is None:
                    self.assertIsNone(practicum[status].completed_hours, "staff enter these hours")
            self.assertIn("Report Sent to Dean", practicum)
            withdrawal = {row.status for row in WithdrawalApplication.query.all()}
            for status in ("Submitted to GS Staff", "Dean Review", *(status for status, _ in STAGE_READY_WITHDRAWAL)):
                self.assertIn(status, withdrawal, status)
            tagged = WithdrawalApplication.query.filter_by(status="Subject Tagged - Registrar Preparation").first()
            self.assertEqual(tagged.subject_enrollment.status, "Withdrawn")
            graduation = {}
            for row in GraduationEndorsement.query.all():
                graduation.setdefault(row.endorsement_status, []).append(row)
            for number, _, _, status in STAGE_READY_GRADUATION:
                row = next(item for item in graduation[status] if item.student.student_number == number)
                self.assertTrue(graduation_eligibility(row.student)["eligible"], row.student.name)
                self.assertIsNotNone(row.request_attachment_id)
                self.assertEqual(row.batch_name is None, status == "For Review", "Application submitted has no batch yet")
            self.assertIn("Ready for Dean Review", graduation)
            # the students a presenter signs in as for the student steps have a portal account
            # every stage-ready practicum student is on the board (it lists eligible students only) and can sign in
            for number, _first, _last, status, _hours, _ in STAGE_READY_PRACTICUM:
                student = Student.query.filter_by(student_number=number).one()
                self.assertEqual(practicum[status].student_id, student.id, status)
                self.assertTrue(app_module.practicum_eligibility(student)["eligible"], student.name)
                self.assertIsNotNone(UserAccount.query.filter_by(student_id=student.id, role="student", active=True).first())

    def test_seeded_students_stay_eligible_on_their_own_portal(self):
        """The student page re-derives the research stage on load; the seeded students keep their verified baseline."""
        for number, *_ in (STAGE_READY_PRACTICUM[2], STAGE_READY_GRADUATION[0]):
            with app.app_context():
                email = UserAccount.query.join(Student).filter(Student.student_number == number).one().email
            context = self.signed_in(email).get("/api/student-portal/context").get_json()
            self.assertTrue(context["practicum_eligibility"]["eligible"] or number in {row[0] for row in STAGE_READY_GRADUATION}, number)
            if number in {row[0] for row in STAGE_READY_GRADUATION}:
                self.assertTrue(context["graduation_eligibility"]["eligible"], number)

    def test_seeded_cases_name_who_acts_next(self):
        staff = self.signed_in("staff@usls.edu.ph")
        roster = staff.get("/api/transactions/graduation/context").get_json()["roster"]
        owners = {row["student"]["student_number"]: row["next_action_owner"] for row in roster}
        expected = {"Coursework Review": "Academic Coordinator", "Research Review": "Research Coordinator",
                    "Eligibility Confirmed": "Graduate School Staff", "For Review": "Graduate School Staff"}
        for number, _, _, status in STAGE_READY_GRADUATION:
            self.assertEqual(owners[number], expected[status], status)
        practicum = staff.get("/api/transactions/practicum/context").get_json()["roster"]
        owners = {row["student"]["student_number"]: row["next_action_owner"] for row in practicum}
        current = {row["student"]["student_number"]: (row.get("record") or {}).get("status") for row in practicum}
        for number, _first, _last, status, _hours, _ in STAGE_READY_PRACTICUM:
            if current[number] != status:
                continue  # another test in this class moved it on
            self.assertEqual(owners[number], app_module.STAGE_READY_PRACTICUM_OWNER[status][0], status)

    # -- owner 2026-11-08: graduation opens only after the Dean approves the practicum completion
    def student_client(self, number):
        with app.app_context():
            email = UserAccount.query.join(Student).filter(Student.student_number == number, UserAccount.role == "student").first().email
        return self.signed_in(email)

    def test_graduation_is_locked_until_the_dean_approves_the_practicum(self):
        martin = STAGE_READY_PRACTICUM[-1][0]  # practicum Completed: hours verified, report not yet with the Dean
        client = self.student_client(martin)
        gate = client.get("/api/student-portal/context").get_json()["graduation_eligibility"]["practicum_gate"]
        self.assertTrue(gate["required"])
        self.assertFalse(gate["dean_approved"])
        self.assertIn("Dean approves your practicum completion", gate["message"])
        refused = client.post("/api/student-portal/requests/graduation", json={"attachment_id": 1})
        self.assertGreaterEqual(refused.status_code, 400, refused.get_json())

        # the Academic Coordinator sends the report, the Dean marks it reviewed: the lock opens
        with app.app_context():
            student_id = Student.query.filter_by(student_number=martin).one().id
            record_id = PracticumRecord.query.filter_by(student_id=student_id).one().id
        academic = self.signed_in("academic@usls.edu.ph")
        sent = academic.post("/api/transactions/practicum", json={"student_id": student_id, "status": "Report Sent to Dean", "document_status": "Verified"})
        self.assertEqual(sent.status_code, 200, sent.get_json())
        gate = client.get("/api/student-portal/context").get_json()["graduation_eligibility"]["practicum_gate"]
        self.assertFalse(gate["dean_approved"], "sent to the Dean is not yet approved")
        self.assertIn("with the Dean", gate["message"])
        reviewed = self.signed_in("dean@usls.edu.ph").post(f"/api/approvals/workflow/practicum/{record_id}/decide", json={"decision": "review"})
        self.assertEqual(reviewed.status_code, 200, reviewed.get_json())
        eligibility = client.get("/api/student-portal/context").get_json()["graduation_eligibility"]
        self.assertTrue(eligibility["practicum_gate"]["dean_approved"])
        self.assertEqual(eligibility["missing_practicum_requirement"], "")
        self.assertTrue(eligibility["eligible"], "with the Dean's approval this student meets every requirement")

    def test_a_program_without_a_practicum_is_never_locked(self):
        gate = self.student_client(STAGE_READY_GRADUATION[0][0]).get("/api/student-portal/context").get_json()["graduation_eligibility"]["practicum_gate"]
        self.assertFalse(gate["required"])
        self.assertTrue(gate["dean_approved"])

    # -- owner 2026-11-08: "Acknowledged by Registrar" is recorded by hand by staff or the Dean, after the export
    def test_staff_or_dean_record_the_registrar_acknowledgement_by_hand(self):
        with app.app_context():
            exported = GraduationEndorsement.query.filter_by(endorsement_status="Dean Approved", registrar_status="Exported - Ready to Send").order_by(GraduationEndorsement.id).all()
            self.assertGreaterEqual(len(exported), 2, "the seed has exported past batches")
            first, second = exported[0].id, exported[1].id
            waiting = GraduationEndorsement.query.filter_by(endorsement_status="Ready for Dean Review").first().id  # not approved, not exported
        url = "/api/graduation/registrar-acknowledged"
        self.assertEqual(self.signed_in("academic@usls.edu.ph").post(url, json={"endorsement_ids": [first]}).status_code, 403)
        refused = self.signed_in("staff@usls.edu.ph").post(url, json={"endorsement_ids": [waiting]})
        self.assertEqual(refused.status_code, 409, "a list that was never exported cannot be acknowledged")
        self.assertTrue(refused.get_json()["error"].startswith("Nothing was changed."))
        done = self.signed_in("staff@usls.edu.ph").post(url, json={"endorsement_ids": [first]})
        self.assertEqual(done.status_code, 200, done.get_json())
        self.assertEqual(self.signed_in("dean@usls.edu.ph").post(url, json={"endorsement_ids": [second]}).status_code, 200)
        with app.app_context():
            row = db.session.get(GraduationEndorsement, first)
            self.assertEqual(row.registrar_status, "Acknowledged by Registrar")
            self.assertIsNotNone(row.registrar_received_at)
            self.assertEqual(app_module.graduation_display_status(row), "Acknowledged by Registrar")
        again = self.signed_in("staff@usls.edu.ph").post(url, json={"endorsement_ids": [first]})
        self.assertEqual(again.status_code, 409, "already acknowledged: nothing to change")
        # a later download of the same list keeps the acknowledgement
        self.signed_in("dean@usls.edu.ph").post("/api/graduation/endorsed.csv", json={"endorsement_ids": [first]})
        with app.app_context():
            self.assertEqual(db.session.get(GraduationEndorsement, first).registrar_status, "Acknowledged by Registrar")

    def test_seeded_past_batches_show_their_export_and_application(self):
        roster = self.signed_in("staff@usls.edu.ph").get("/api/transactions/graduation/context").get_json()["roster"]
        past = [row["endorsement"] for row in roster if (row.get("endorsement") or {}).get("dean_remarks") == "Seeded history."
                and row["endorsement"]["registrar_status"] in {"Exported - Ready to Send", "Acknowledged by Registrar"}]
        self.assertTrue(past)
        for endorsement in past:
            self.assertGreaterEqual(endorsement["export_count"], 1, endorsement["batch_name"])
            self.assertTrue(endorsement["request_attachment"], f"{endorsement['batch_name']} has its application on file")

    def test_every_seeded_batch_has_its_application(self):
        with app.app_context():
            missing = [row.batch_name for row in GraduationEndorsement.query.filter(GraduationEndorsement.batch_name.isnot(None))
                       if not row.request_attachment_id]
        self.assertEqual(missing, [], "a batch without the signed application shows 'Application document issue'")

    # -- stakeholder UAT (Section C): staff and the Academic Coordinator review earlier leaves, read-only
    def test_student_record_lists_earlier_leaves_for_staff_and_the_academic_coordinator(self):
        with app.app_context():
            case = app_module.LeaveCase.query.order_by(app_module.LeaveCase.id).first()
            student_id = case.student_id
            expected = app_module.LeaveCase.query.filter_by(student_id=student_id).count()
        for email in ("staff@usls.edu.ph", "academic@usls.edu.ph"):
            body = self.signed_in(email).get(f"/api/students/{student_id}").get_json()
            history = body["leave_history"]
            self.assertEqual(len(history["cases"]), expected, email)
            self.assertIn("kind_label", history["cases"][0])
            self.assertEqual(history["max_leave_semesters"], 4)
        self.assertEqual(self.signed_in("academic@usls.edu.ph").get("/api/leave-cases").status_code, 403,
                         "viewing the history gives no access to the leave process itself")

    def test_batch_names_are_never_shared(self):
        with app.app_context():
            batches = {}
            for row in GraduationEndorsement.query.filter(GraduationEndorsement.batch_name.isnot(None)):
                batches.setdefault(row.batch_name, set()).add(row.endorsement_status)
            for name, statuses in batches.items():
                self.assertEqual(len(statuses), 1, f"{name} holds candidates at different steps: {statuses}")


class GuideScopedResetTests(unittest.TestCase):
    """POST /api/demo/sandbox/reset with a guide's process resets only that guide's demo student."""

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            if not Student.query.first():
                build_demo_database()

    def setUp(self):
        self.box_dir = tempfile.mkdtemp(prefix="sandbox-test-")
        self.env = patch.dict(os.environ, {"DEMO_MODE": "1", "DEMO_SANDBOX": "1", "DEMO_SANDBOX_DIR": self.box_dir})
        self.env.start()
        app_module.dispose_demo_sandboxes()
        app_module.refresh_demo_sandbox_template()

    def tearDown(self):
        app_module.dispose_demo_sandboxes()
        self.env.stop()
        shutil.rmtree(self.box_dir, ignore_errors=True)

    def in_box(self, sandbox_id, work):
        with app.test_request_context("/api/auth/config", headers={"Cookie": f"{COOKIE}={sandbox_id}"}):
            app.preprocess_request()
            try:
                return work()
            finally:
                db.session.remove()

    def test_graduation_guide_reset_keeps_practicum_and_hand_work(self):
        client = app.test_client()
        client.get("/api/auth/config")
        box = client.get_cookie(COOKIE).value
        carlo_number = DEMO_STUDENT_NUMBERS["GRAD-02"]

        def hand_work():
            carlo = Student.query.filter_by(student_number=carlo_number).one()
            db.session.add(GraduationEndorsement(student_id=carlo.id, endorsement_status="For Review", registrar_status="Pending"))
            moa = PracticumRecord.query.filter_by(status="MOA Submitted").one()
            moa.status = "MOA Under Review"  # a presenter forwarded it by hand
            db.session.commit()
            return moa.id

        moa_id = self.in_box(box, hand_work)
        with client.session_transaction() as session:
            staff = self.in_box(box, lambda: UserAccount.query.filter_by(email="staff@usls.edu.ph").one().id)
            session["account_id"], session["role"] = staff, "staff"
        before = client.get("/api/auth/me").get_json()["user"]["data_id"]

        response = client.post("/api/demo/sandbox/reset", json={"process": "graduation", "student_number": carlo_number})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        new_box = client.get_cookie(COOKIE).value
        self.assertNotEqual(new_box, box, "the demo data has a new id")
        self.assertNotEqual(client.get("/api/auth/me").get_json()["user"]["data_id"], before)

        def check():
            carlo = Student.query.filter_by(student_number=carlo_number).one()
            self.assertIsNone(GraduationEndorsement.query.filter_by(student_id=carlo.id).first(), "the guide's own case is reset")
            self.assertEqual(db.session.get(PracticumRecord, moa_id).status, "MOA Under Review", "other work is kept")
            self.assertTrue(GraduationEndorsement.query.filter_by(endorsement_status="Ready for Dean Review").first())

        self.in_box(new_box, check)

    def test_panel_reset_restores_the_three_workflows_and_nothing_else(self):
        client = app.test_client()
        client.get("/api/auth/config")
        box = client.get_cookie(COOKIE).value

        def hand_work():
            moa = PracticumRecord.query.filter_by(status="MOA Submitted").one()
            moa.status = "MOA Under Review"
            waiting = WithdrawalApplication.query.filter_by(status="Approved - Awaiting Subject Tag").one()
            app_module.apply_approved_subject_withdrawal(waiting)
            waiting.status = "Subject Tagged - Registrar Preparation"
            leave = app_module.LeaveCase.query.order_by(app_module.LeaveCase.id).first()
            leave.reason_text = "Changed by hand in another module."
            db.session.add(LeaveExportLog(slug="withdrawal", file_name="by-hand.xlsx", case_ids_json="[]", case_count=0))
            db.session.commit()
            return moa.id, waiting.id, waiting.subject_enrollment_id, leave.id

        moa_id, waiting_id, subject_id, leave_id = self.in_box(box, hand_work)
        response = client.post("/api/demo/sandbox/reset", json={"process": "panel-workflows"})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        new_box = client.get_cookie(COOKIE).value
        self.assertNotEqual(new_box, box)

        def check():
            self.assertEqual(db.session.get(PracticumRecord, moa_id).status, "MOA Submitted")
            self.assertEqual(db.session.get(WithdrawalApplication, waiting_id).status, "Approved - Awaiting Subject Tag")
            self.assertEqual(db.session.get(app_module.SubjectEnrollment, subject_id).status, "Enrolled", "the subject tag is undone")
            self.assertIsNone(LeaveExportLog.query.filter_by(file_name="by-hand.xlsx").first())
            self.assertEqual(db.session.get(app_module.LeaveCase, leave_id).reason_text, "Changed by hand in another module.")

        self.in_box(new_box, check)

    def test_unknown_student_is_refused_and_nothing_changes(self):
        client = app.test_client()
        client.get("/api/auth/config")
        box = client.get_cookie(COOKIE).value
        response = client.post("/api/demo/sandbox/reset", json={"process": "practicum", "student_number": "2360101"})
        self.assertEqual(response.status_code, 404)
        self.assertEqual(client.get_cookie(COOKIE).value, box)
        self.assertEqual(
            self.in_box(box, lambda: PracticumRecord.query.filter_by(status="Report Sent to Dean").count()), 1,
            "a student who is not a guide's demo student is never reset",
        )


if __name__ == "__main__":
    unittest.main()
