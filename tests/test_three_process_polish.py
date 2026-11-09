"""Practicum, graduation and withdrawal polish (owner request 2026-11-08).

None of these tests changes a process rule. They check what the screens are told: a practicum step says what
changed, a graduation group step that changed nothing says so, every export is counted and shown, and a
withdrawal that went to the Registrar can have its "sent" and "acknowledged" dates recorded without moving the case.

One seeded demo database is built for the whole module; each test puts back what it changed.
"""
import os
import tempfile
import unittest

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import (  # noqa: E402
    GraduationEndorsement,
    PracticumRecord,
    Student,
    TransactionLog,
    UserAccount,
    WithdrawalApplication,
    add_log,
    app,
    build_demo_database,
    db,
    generate_password_hash,
    graduation_endorsement_dict,
    now_utc,
)

TAGGED = "Subject Tagged - Registrar Preparation"
EXPORTED = "Exported - Ready to Send"


class ThreeProcessPolishTests(unittest.TestCase):
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

    # ---- helpers ------------------------------------------------------------------------------
    def client_for(self, email, role):
        with app.app_context():
            account_id = UserAccount.query.filter_by(email=email).one().id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff(self):
        return self.client_for("staff@usls.edu.ph", "staff")

    def academic(self):
        return self.client_for("academic@usls.edu.ph", "academic_coordinator")

    def dean(self):
        return self.client_for("dean@usls.edu.ph", "dean")

    # ---- item 7: a practicum step says what changed ----------------------------------------------
    def test_a_practicum_step_answers_with_what_changed_and_who_is_next(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="2360101").one()
            record = PracticumRecord.query.filter_by(student_id=student.id).one()
            before = (record.status, record.moa_status)
            record.status = "MOA Submitted"
            db.session.commit()
            student_id, student_name = student.id, student.name

        def restore():
            with app.app_context():
                row = PracticumRecord.query.filter_by(student_id=student_id).one()
                row.status, row.moa_status = before
                db.session.commit()
        self.addCleanup(restore)

        response = self.staff().post("/api/transactions/practicum", json={"student_id": student_id, "status": "MOA Under Review"})
        self.assertEqual(response.status_code, 200, response.get_json())
        message = response.get_json()["message"]
        self.assertIn(student_name, message)
        self.assertIn("MOA Submitted", message)
        self.assertIn("MOA Under Review", message)
        self.assertIn("Academic Coordinator", message)
        self.assertNotIn("monitoring indicators", message)

    def test_other_workflows_keep_their_saved_message(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="2260007").one()
            student_id = student.id
        response = self.staff().post("/api/transactions/graduation", json={"student_id": student_id, "endorsement_status": "Not A Step"})
        self.assertEqual(response.status_code, 400)  # a refused step still answers with its own error
        self.assertNotIn("moved from", response.get_json().get("message", ""))

    # ---- item 6: a group step that changed nothing says so ----------------------------------------
    def test_a_graduation_group_step_that_changes_nothing_says_nothing_changed(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="2260007").one()
            student_id = student.id
        # The academic coordinator can only check candidates that wait in "Coursework Review"; this one does not.
        response = self.academic().post("/api/graduation/batch-actions", json={
            "student_ids": [student_id], "stage_action": "check_coursework",
            "batch_no": "1", "batch_month": "November", "batch_year": "2026",
        })
        body = response.get_json()
        self.assertEqual(response.status_code, 200, body)
        self.assertEqual(body["updated"], [])
        self.assertEqual(len(body["skipped"]), 1)
        self.assertTrue(body["message"].startswith("Nothing was changed"), body["message"])
        self.assertIn(body["skipped"][0]["reason"], body["message"])
        self.assertEqual(body["batch_name"], "", "a batch name was echoed although nothing was applied")

    def test_a_graduation_group_step_names_who_was_skipped_when_some_changed(self):
        with app.app_context():
            ids = [row.student_id for row in GraduationEndorsement.query.all()][:3]
        response = self.academic().post("/api/graduation/batch-actions", json={"student_ids": ids, "stage_action": "check_coursework"})
        body = response.get_json()
        self.assertEqual(response.status_code, 200, body)
        if body["updated"] and body["skipped"]:
            self.assertIn("skipped", body["message"].lower())
            self.assertIn(body["skipped"][0]["student_name"], body["message"])

    # ---- item 10: every export is counted ---------------------------------------------------------
    def test_a_graduation_endorsement_shows_how_many_times_its_list_was_exported(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="2260007").one()  # graduation-eligible in the demo data
            row = GraduationEndorsement.query.filter_by(student_id=student.id).order_by(GraduationEndorsement.id.desc()).first()
            if row is None:
                row = GraduationEndorsement(student_id=student.id, batch_name="Batch 1 November 2026", review_window="Current review window")
                db.session.add(row)
            before = (row.endorsement_status, row.registrar_status, row.dean_decision_at)
            row.endorsement_status, row.registrar_status, row.dean_decision_at = "Dean Approved", "Pending Handoff", now_utc()
            db.session.commit()
            exported_id = row.id

        def restore():
            with app.app_context():
                saved = db.session.get(GraduationEndorsement, exported_id)
                saved.endorsement_status, saved.registrar_status, saved.dean_decision_at = before
                db.session.commit()
        self.addCleanup(restore)

        self.assertEqual(self.dean().post("/api/graduation/endorsed.csv", json={"endorsement_ids": [exported_id]}).status_code, 200)
        with app.app_context():
            first = graduation_endorsement_dict(db.session.get(GraduationEndorsement, exported_id))
        self.assertEqual(first["export_count"], 1)
        self.assertEqual(self.dean().post("/api/graduation/endorsed.csv", json={"endorsement_ids": [exported_id]}).status_code, 200)
        with app.app_context():
            second = graduation_endorsement_dict(db.session.get(GraduationEndorsement, exported_id))
        self.assertEqual(second["export_count"], 2)
        self.assertTrue(second["last_exported_at"])
        self.assertIn("Dean", second["last_exported_by"])

    def test_a_graduation_endorsement_never_exported_says_zero(self):
        with app.app_context():
            row = GraduationEndorsement.query.filter(GraduationEndorsement.endorsement_status != "Dean Approved").first()
            payload = graduation_endorsement_dict(row)
        self.assertEqual(payload["export_count"], 0)
        self.assertIsNone(payload["last_exported_at"])

    def _tag_a_withdrawal(self):
        """Put one seeded, Dean-approved withdrawal at the tagged step and put it back afterwards."""
        with app.app_context():
            application = WithdrawalApplication.query.filter(WithdrawalApplication.dean_decision == "Approved").first()
            self.assertIsNotNone(application, "the demo data has no Dean-approved withdrawal")
            before = (
                application.status, application.registrar_status, application.registrar_report_generated_at,
                application.registrar_sent_at, application.registrar_confirmed_at,
                application.subject_enrollment.status if application.subject_enrollment else None,
            )
            application.status, application.registrar_status = TAGGED, "Pending Excel Export"
            application.registrar_report_generated_at = application.registrar_sent_at = application.registrar_confirmed_at = None
            if application.subject_enrollment:
                application.subject_enrollment.status = "Withdrawn"
            db.session.commit()
            application_id = application.id

        def restore():
            with app.app_context():
                row = db.session.get(WithdrawalApplication, application_id)
                (row.status, row.registrar_status, row.registrar_report_generated_at,
                 row.registrar_sent_at, row.registrar_confirmed_at, enrollment_status) = before
                if row.subject_enrollment and enrollment_status:
                    row.subject_enrollment.status = enrollment_status
                db.session.commit()
        self.addCleanup(restore)
        return application_id

    def test_a_withdrawal_shows_how_many_times_its_excel_list_was_exported(self):
        application_id = self._tag_a_withdrawal()
        staff = self.staff()
        # the seed may already list this withdrawal in an earlier downloaded list (its export history)
        before = staff.get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]["registrar"]["export_count"]
        for _ in range(2):
            self.assertEqual(staff.post("/api/withdrawal/approved.xlsx", json={"application_ids": [application_id]}).status_code, 200)
        registrar = staff.get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]["registrar"]
        self.assertEqual(registrar["export_count"], before + 2)
        self.assertTrue(registrar["exports"][0]["at"])
        self.assertTrue(registrar["exports"][0]["by"])

    def test_staff_screens_call_an_exported_withdrawal_ready_to_send_like_the_student_page(self):
        application_id = self._tag_a_withdrawal()
        staff = self.staff()
        self.assertEqual(staff.post("/api/withdrawal/approved.xlsx", json={"application_ids": [application_id]}).status_code, 200)
        case = staff.get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
        self.assertEqual(case["status"], EXPORTED)  # the stored value is unchanged
        self.assertEqual(case["status_label"], EXPORTED)
        board = staff.get("/api/process-cases?slug=withdrawal").get_json()
        labels = []

        def collect(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key in ("label", "status_label") and isinstance(value, str):
                        labels.append(value)
                    collect(value)
            elif isinstance(node, list):
                for value in node:
                    collect(value)
        collect(board)
        self.assertIn(EXPORTED, labels)
        self.assertFalse([label for label in labels if "email the Registrar" in label or "email to the Registrar" in label], labels)

    # ---- item 9: the Registrar hand-off dates, recorded without moving the case ---------------------
    def test_staff_can_record_sent_then_acknowledged_without_changing_the_withdrawal_status(self):
        application_id = self._tag_a_withdrawal()
        staff = self.staff()
        url = f"/api/withdrawal/{application_id}/registrar-followup"
        self.assertEqual(staff.post("/api/withdrawal/approved.xlsx", json={"application_ids": [application_id]}).status_code, 200)

        early = staff.post(url, json={"step": "acknowledged"})
        self.assertEqual(early.status_code, 409, early.get_json())  # it must be sent first

        sent = staff.post(url, json={"step": "sent", "note": "Emailed to the Registrar on the 9th."})
        self.assertEqual(sent.status_code, 200, sent.get_json())
        again = staff.post(url, json={"step": "sent"})
        self.assertEqual(again.status_code, 409, again.get_json())
        acknowledged = staff.post(url, json={"step": "acknowledged"})
        self.assertEqual(acknowledged.status_code, 200, acknowledged.get_json())

        case = staff.get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
        self.assertEqual(case["status"], EXPORTED, "recording the hand-off must not move the case")
        self.assertTrue(case["registrar"]["sent_at"])
        self.assertTrue(case["registrar"]["acknowledged_at"])
        self.assertEqual(case["registrar"]["status"], "Acknowledged")

    def test_only_staff_can_record_the_registrar_hand_off_and_only_after_the_export(self):
        application_id = self._tag_a_withdrawal()
        url = f"/api/withdrawal/{application_id}/registrar-followup"
        self.assertEqual(self.dean().post(url, json={"step": "sent"}).status_code, 403)
        before_export = self.staff().post(url, json={"step": "sent"})
        self.assertEqual(before_export.status_code, 409, before_export.get_json())
        self.assertEqual(self.staff().post(url, json={"step": "nonsense"}).status_code, 400)

    # ---- item 13: the student's own progress history ----------------------------------------------
    def _student_client(self, number):
        with app.app_context():
            student = Student.query.filter_by(student_number=number).one()
            account = UserAccount.query.filter_by(student_id=student.id, role="student").first()
            if not account:
                account = UserAccount(
                    email=f"{number.lower()}@polish.test", full_name=student.name, role="student", active=True,
                    password_hash=generate_password_hash("test-password"), student_id=student.id)
                db.session.add(account)
                db.session.commit()
            account_id, student_id = account.id, student.id
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = "student"
        return client, student_id

    def test_the_student_sees_the_progress_history_of_practicum_graduation_and_withdrawal_without_internal_rows(self):
        client, student_id = self._student_client("2360101")
        with app.app_context():
            visible = add_log("practicum", student_id, "Graduate School Staff", "Test", "POLISH visible step", "Student",
                              "internal note that must not be sent", previous_status="MOA Submitted", new_status="MOA Under Review",
                              visibility="student_visible")
            hidden = add_log("practicum", student_id, "Graduate School Staff", "Test", "POLISH internal step", "Academic Coordinator",
                             "internal only", visibility="internal")
            other = add_log("graduation", student_id, "Graduate School Staff", "Test", "POLISH graduation step", "Student",
                            "x", visibility="student_visible")
            db.session.commit()
            ids = (visible.id, hidden.id, other.id)

        def remove():
            with app.app_context():
                TransactionLog.query.filter(TransactionLog.id.in_(ids)).delete(synchronize_session=False)
                db.session.commit()
        self.addCleanup(remove)

        body = client.get("/api/student-portal/context").get_json()
        history = body["process_history"]
        self.assertEqual(set(history), {"practicum", "graduation", "withdrawal"})
        practicum = [row["title"] for row in history["practicum"]]
        self.assertIn("POLISH visible step", practicum)
        self.assertNotIn("POLISH internal step", practicum)
        self.assertNotIn("POLISH graduation step", practicum)
        self.assertIn("POLISH graduation step", [row["title"] for row in history["graduation"]])
        row = next(item for item in history["practicum"] if item["title"] == "POLISH visible step")
        self.assertEqual((row["from_status"], row["to_status"]), ("MOA Submitted", "MOA Under Review"))
        self.assertNotIn("notes", row)
        self.assertNotIn("internal note that must not be sent", str(history))


if __name__ == "__main__":
    unittest.main()
