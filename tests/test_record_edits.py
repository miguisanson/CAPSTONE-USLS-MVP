"""Edit anything, with history (owner request 2026-11-04).

One table (RecordEdit), one endpoint (PATCH/GET /api/edits/<entity>/<id>) and one whitelist
(EDITABLE) cover chat messages, remarks and notes, student request fields and the panel's
verdict remarks. These tests cover who may edit what, until when, the reused validation,
the history row, and that a refused edit leaves no row.
"""

import os
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    DefenseVerdict,
    Faculty,
    GraduationEndorsement,
    LeaveCase,
    LeaveCaseEvent,
    Program,
    RecordEdit,
    ResearchCase,
    ScheduleRequest,
    Student,
    UserAccount,
    WithdrawalApplication,
    WorkflowMessage,
    app,
    db,
    generate_password_hash,
)


class RecordEditTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except FileNotFoundError:
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="EDT", name="Edit Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.student_id = self._student(program.id, "GS-EDT-1", "Eda", "Tester").id
            other = self._student(program.id, "GS-EDT-2", "Otto", "Other")
            self.other_student_id = other.id
            self.staff_id = self._account("staff", "edt-staff@example.test").id
            self.staff2_id = self._account("staff", "edt-staff2@example.test").id
            self.dean_id = self._account("dean", "edt-dean@example.test").id
            student_account = self._account("student", "edt-student@example.test")
            student_account.student_id = self.student_id
            self.student_account_id = student_account.id
            other_account = self._account("student", "edt-other@example.test")
            other_account.student_id = other.id
            self.other_account_id = other_account.id
            today = date.today()
            for label, start, end in [
                ("Running Term", today - timedelta(days=20), today + timedelta(days=100)),
                ("Term One", today + timedelta(days=110), today + timedelta(days=230)),
                ("Term Two", today + timedelta(days=240), today + timedelta(days=360)),
                ("Term Three", today + timedelta(days=370), today + timedelta(days=490)),
                ("Term Four", today + timedelta(days=500), today + timedelta(days=620)),
            ]:
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=end))
            db.session.commit()

    # ---- fixtures -------------------------------------------------------------
    def _student(self, program_id, number, first, last):
        student = Student(
            student_number=number, first_name=first, last_name=last, email=f"{number.lower()}@example.test",
            program_id=program_id, entry_year=date.today().year - 1, academic_year_entry="25-26",
            year_level="1", current_stage="Coursework", standing="Active", enrollment_tag="Enrolled",
        )
        db.session.add(student)
        db.session.flush()
        return student

    def _account(self, role, email):
        account = UserAccount(
            email=email, full_name=f"Test {role.title()}", password_hash=generate_password_hash("test-password"),
            role=role, active=True,
        )
        db.session.add(account)
        db.session.flush()
        return account

    def client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def student_client(self):
        return self.client(self.student_account_id, "student")

    def other_client(self):
        return self.client(self.other_account_id, "student")

    def staff_client(self):
        return self.client(self.staff_id, "staff")

    def staff2_client(self):
        return self.client(self.staff2_id, "staff")

    def dean_client(self):
        return self.client(self.dean_id, "dean")

    def patch(self, client, entity, row_id, field, value, reason=None):
        body = {"field": field, "value": value}
        if reason is not None:
            body["reason"] = reason
        return client.patch(f"/api/edits/{entity}/{row_id}", json=body)

    def edit_rows(self):
        with app.app_context():
            return RecordEdit.query.count()

    def file_loa(self, **extra):
        body = {"effective_start": "Term One", "effective_end": "Term Two",
                "reason_category": "Medical / health", "reason_remarks": "Surgry and recovery.", **extra}
        response = self.student_client().post("/api/student-portal/requests/leave-of-absence", json=body)
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            return LeaveCase.query.order_by(LeaveCase.id.desc()).first().id

    def message(self, sender_id, role, created_ago_minutes=1, comment="Pleese send the form."):
        with app.app_context():
            row = WorkflowMessage(
                transaction_slug="leave-of-absence", student_id=self.student_id, sender_user_id=sender_id,
                sender_role=role, sender_name=f"Test {role}", recipient_role="Graduate School Staff",
                template="Remarks", comment=comment, action_type="note",
                created_at=app_module.now_utc() - timedelta(minutes=created_ago_minutes),
            )
            db.session.add(row)
            db.session.commit()
            return row.id

    # ---- 1. endpoint + whitelist -----------------------------------------------------
    def test_unknown_entity_or_field_is_refused_and_leaves_no_row(self):
        msg = self.message(self.student_account_id, "Student")
        client = self.student_client()
        self.assertEqual(self.patch(client, "nothing", 1, "comment", "x").status_code, 400)
        self.assertEqual(self.patch(client, "workflow_message", msg, "sender_name", "x").status_code, 400)
        self.assertEqual(self.patch(client, "workflow_message", 9999, "comment", "x").status_code, 404)
        self.assertEqual(self.edit_rows(), 0)

    def test_signed_out_is_refused(self):
        self.assertEqual(app.test_client().patch("/api/edits/workflow_message/1", json={}).status_code, 401)
        self.assertEqual(app.test_client().get("/api/edits/workflow_message/1").status_code, 401)

    # ---- 2. chat messages -------------------------------------------------------------
    def test_author_fixes_own_message_within_fifteen_minutes_without_a_reason(self):
        msg = self.message(self.student_account_id, "Student")
        response = self.patch(self.student_client(), "workflow_message", msg, "comment", "Please send the form.")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(WorkflowMessage, msg).comment, "Please send the form.")
            row = RecordEdit.query.one()
            self.assertEqual((row.entity, row.entity_id, row.field), ("workflow_message", msg, "comment"))
            self.assertEqual((row.old_value, row.new_value), ("Pleese send the form.", "Please send the form."))
            self.assertEqual((row.actor_role, row.actor_user_id), ("student", self.student_account_id))

    def test_after_fifteen_minutes_a_reason_is_needed(self):
        msg = self.message(self.student_account_id, "Student", created_ago_minutes=30)
        client = self.student_client()
        refused = self.patch(client, "workflow_message", msg, "comment", "Please send the form.")
        self.assertEqual(refused.status_code, 400)
        self.assertIn("reason", refused.get_json()["error"].lower())
        self.assertEqual(self.edit_rows(), 0)
        ok = self.patch(client, "workflow_message", msg, "comment", "Please send the form.", reason="Typo")
        self.assertEqual(ok.status_code, 200, ok.get_json())

    def test_only_the_author_edits_a_message_and_it_cannot_be_blanked(self):
        msg = self.message(self.student_account_id, "Student")
        self.assertEqual(self.patch(self.staff_client(), "workflow_message", msg, "comment", "Changed", "x").status_code, 403)
        self.assertEqual(self.patch(self.other_client(), "workflow_message", msg, "comment", "Changed", "x").status_code, 403)
        self.assertEqual(self.patch(self.student_client(), "workflow_message", msg, "comment", "   ", "x").status_code, 400)
        self.assertEqual(self.edit_rows(), 0)

    def test_thread_shows_edited_marks_and_history_lists_newest_first(self):
        msg = self.message(self.staff_id, "staff")
        staff = self.staff_client()
        self.assertEqual(self.patch(staff, "workflow_message", msg, "comment", "One", "first fix").status_code, 200)
        self.assertEqual(self.patch(staff, "workflow_message", msg, "comment", "Two", "second fix").status_code, 200)
        history = staff.get(f"/api/edits/workflow_message/{msg}").get_json()["items"]
        self.assertEqual([h["new_value"] for h in history], ["Two", "One"])
        self.assertEqual(history[0]["old_value"], "One")
        self.assertEqual(history[0]["reason"], "second fix")
        self.assertEqual(history[0]["actor_role"], "staff")
        with app.app_context():
            item = app_module.workflow_message_dict(db.session.get(WorkflowMessage, msg))
        self.assertEqual(item["comment"], "Two")
        self.assertEqual(item["edit_count"], 2)
        self.assertTrue(item["edited_at"])

    def test_history_is_private_to_the_students_own_record(self):
        msg = self.message(self.staff_id, "staff")
        self.assertEqual(self.patch(self.staff_client(), "workflow_message", msg, "comment", "Fixed", "typo").status_code, 200)
        self.assertEqual(self.student_client().get(f"/api/edits/workflow_message/{msg}").status_code, 200)
        self.assertEqual(self.other_client().get(f"/api/edits/workflow_message/{msg}").status_code, 403)

    def test_leave_case_event_comment_is_editable_by_its_actor(self):
        case_id = self.file_loa()
        with app.app_context():
            event = LeaveCaseEvent(case_id=case_id, from_status="Submitted", to_status="Dean Review", action="forward",
                                   actor_user_id=self.staff_id, actor_role="staff", actor_name="Test Staff",
                                   comment="Forwarded wiht notes")
            db.session.add(event)
            db.session.commit()
            event_id = event.id
        self.assertEqual(self.patch(self.staff2_client(), "leave_case_event", event_id, "comment", "x", "r").status_code, 403)
        ok = self.patch(self.staff_client(), "leave_case_event", event_id, "comment", "Forwarded with notes", "typo")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(LeaveCaseEvent, event_id).comment, "Forwarded with notes")

    # ---- 3. decision remarks and notes ---------------------------------------------------
    def test_dean_remarks_are_edited_by_the_dean_only_with_a_reason(self):
        case_id = self.file_loa()
        with app.app_context():
            db.session.get(LeaveCase, case_id).dean_remarks = "Aproved."
            db.session.commit()
        self.assertEqual(self.patch(self.staff_client(), "leave_case", case_id, "dean_remarks", "Approved.", "typo").status_code, 403)
        self.assertEqual(self.patch(self.dean_client(), "leave_case", case_id, "dean_remarks", "Approved.").status_code, 400)
        ok = self.patch(self.dean_client(), "leave_case", case_id, "dean_remarks", "Approved.", "typo")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            case = db.session.get(LeaveCase, case_id)
            self.assertEqual(case.dean_remarks, "Approved.")
            payload = app_module.leave_case_dict(case, role="dean")
        self.assertEqual(payload["dean_remarks"], "Approved.")
        self.assertEqual(payload["edits"]["dean_remarks"]["count"], 1)

    def test_staff_notes_are_edited_by_graduate_school_staff(self):
        case_id = self.file_loa()
        with app.app_context():
            db.session.get(LeaveCase, case_id).staff_notes = "Cheked"
            db.session.commit()
        self.assertEqual(self.patch(self.dean_client(), "leave_case", case_id, "staff_notes", "Checked", "typo").status_code, 403)
        self.assertEqual(self.patch(self.student_client(), "leave_case", case_id, "staff_notes", "Checked", "typo").status_code, 403)
        self.assertEqual(self.patch(self.staff_client(), "leave_case", case_id, "staff_notes", "Checked", "typo").status_code, 200)

    def test_awol_and_withdrawal_dean_remarks_have_their_own_field(self):
        with app.app_context():
            awol = AwolCase(student_id=self.student_id, status="Return Submitted", dean_remarks="Aproved")
            application = WithdrawalApplication(student_id=self.student_id, reason="Work", status="Dean Review",
                                                dean_remarks="Aproved")
            db.session.add_all([awol, application])
            db.session.commit()
            awol_id, application_id = awol.id, application.id
        dean = self.dean_client()
        self.assertEqual(self.patch(dean, "awol_case", awol_id, "dean_remarks", "Approved", "typo").status_code, 200)
        self.assertEqual(self.patch(dean, "withdrawal_application", application_id, "dean_remarks", "Approved", "typo").status_code, 200)
        self.assertEqual(self.patch(self.staff_client(), "awol_case", awol_id, "dean_remarks", "x", "typo").status_code, 403)
        with app.app_context():
            self.assertEqual(db.session.get(AwolCase, awol_id).dean_remarks, "Approved")
            self.assertEqual(db.session.get(WithdrawalApplication, application_id).dean_remarks, "Approved")

    def test_graduation_dean_remarks_and_withdrawal_staff_remarks(self):
        with app.app_context():
            grad = GraduationEndorsement(student_id=self.student_id, dean_remarks="Gud")
            application = WithdrawalApplication(student_id=self.student_id, reason="Work", staff_remarks="Cheked")
            db.session.add_all([grad, application])
            db.session.commit()
            grad_id, application_id = grad.id, application.id
        self.assertEqual(self.patch(self.dean_client(), "graduation_endorsement", grad_id, "dean_remarks", "Good", "typo").status_code, 200)
        self.assertEqual(self.patch(self.staff_client(), "withdrawal_application", application_id, "staff_remarks", "Checked", "typo").status_code, 200)

    # ---- 4. student request fields ------------------------------------------------------
    def test_student_fixes_own_request_text_until_staff_act(self):
        case_id = self.file_loa()
        student = self.student_client()
        ok = self.patch(student, "leave_case", case_id, "reason_text", "Surgery and recovery.", "typo")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(LeaveCase, case_id).reason_text, "Surgery and recovery.")
        # another student cannot, a blank value cannot, and the value rules of filing still apply
        self.assertEqual(self.patch(self.other_client(), "leave_case", case_id, "reason_text", "x", "r").status_code, 403)
        self.assertEqual(self.patch(student, "leave_case", case_id, "reason_text", " ", "r").status_code, 400)
        bad = self.patch(student, "leave_case", case_id, "reason_category", "Because I feel like it", "r")
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.edit_rows(), 1)

    def test_after_staff_act_the_student_and_staff_can_both_still_edit_with_a_reason(self):
        case_id = self.file_loa()
        with app.app_context():
            db.session.get(LeaveCase, case_id).status = "Dean Review"
            db.session.commit()
        later = self.patch(self.student_client(), "leave_case", case_id, "reason_text", "Student fix", "typo")
        self.assertEqual(later.status_code, 200, later.get_json())
        self.assertEqual(self.patch(self.staff_client(), "leave_case", case_id, "reason_text", "New text").status_code, 400)
        ok = self.patch(self.staff_client(), "leave_case", case_id, "reason_text", "New text", "Student asked by phone")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        history = self.staff_client().get(f"/api/edits/leave_case/{case_id}").get_json()["items"]
        self.assertEqual(history[0]["actor_role"], "staff")

    def test_semester_edits_reuse_the_filing_rules(self):
        case_id = self.file_loa()
        student = self.student_client()
        self.assertEqual(self.patch(student, "leave_case", case_id, "end_term", "No Such Term", "r").status_code, 400)
        # Term One .. Term Four would be four semesters; the LOA rule allows two at a time.
        self.assertEqual(self.patch(student, "leave_case", case_id, "end_term", "Term Four", "r").status_code, 400)
        ok = self.patch(student, "leave_case", case_id, "end_term", "Term One", "One semester is enough")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            case = db.session.get(LeaveCase, case_id)
            self.assertEqual(case.end_term.label, "Term One")
            self.assertEqual(case.end_label, "Term One")

    def test_withdrawal_reason_is_editable_by_the_student_while_new(self):
        with app.app_context():
            application = WithdrawalApplication(student_id=self.student_id, reason="Wrok", status="Submitted to GS Staff")
            db.session.add(application)
            db.session.commit()
            application_id = application.id
        self.assertEqual(self.patch(self.student_client(), "withdrawal_application", application_id, "reason", "Work", "typo").status_code, 200)
        with app.app_context():
            db.session.get(WithdrawalApplication, application_id).status = "Dean Review"
            db.session.commit()
        self.assertEqual(self.patch(self.student_client(), "withdrawal_application", application_id, "reason", "Work again", "typo").status_code, 200)

    # ---- 5. verdict remarks ---------------------------------------------------------------
    def _verdict(self, faculty_account_id_holder):
        with app.app_context():
            faculty = Faculty(name="Fay Chair", college="Graduate School", role="Faculty", specialization="Tests", email="fay@example.test")
            db.session.add(faculty)
            db.session.flush()
            account = self._account("faculty", "edt-faculty@example.test")
            account.faculty_id = faculty.id
            schedule = ScheduleRequest(student_id=self.student_id, preferred_date=date.today(), defense_type="Title Defense",
                                       mode="Online", venue="Room", status="Confirmed")
            db.session.add(schedule)
            db.session.flush()
            verdict = DefenseVerdict(student_id=self.student_id, schedule_request_id=schedule.id, panel_assignment_id=1,
                                     faculty_id=faculty.id, gate="Title Defense", defense_type="Title Defense",
                                     chair_name="Fay Chair", result="Passed", remarks="Gud work", defense_date=date.today())
            db.session.add(verdict)
            db.session.commit()
            faculty_account_id_holder.extend([verdict.id, account.id])

    def test_verdict_remarks_editable_by_the_chair_even_after_later_steps(self):
        ids = []
        self._verdict(ids)
        verdict_id, account_id = ids
        chair = self.client(account_id, "faculty")
        self.assertEqual(self.patch(self.staff_client(), "defense_verdict", verdict_id, "remarks", "Good work", "typo").status_code, 403)
        ok = self.patch(chair, "defense_verdict", verdict_id, "remarks", "Good work", "typo")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            verdict = db.session.get(DefenseVerdict, verdict_id)
            self.assertEqual(verdict.remarks, "Good work")
        with app.app_context():
            db.session.add(ResearchCase(student_id=self.student_id, case_type="Thesis", title="Wrng title",
                                        current_gate="Title Defense", status="Open"))
            verdict = db.session.get(DefenseVerdict, verdict_id)
            verdict.selected_title = "Wrng title"
            db.session.commit()
        title = self.patch(chair, "defense_verdict", verdict_id, "selected_title", "Wrong title fixed", "typo")
        self.assertEqual(title.status_code, 200, title.get_json())
        with app.app_context():
            self.assertEqual(ResearchCase.query.filter_by(student_id=self.student_id).one().title, "Wrong title fixed")
            db.session.get(DefenseVerdict, verdict_id).revision_status = app_module.REVISION_SUBMITTED
            db.session.commit()
        later = self.patch(chair, "defense_verdict", verdict_id, "remarks", "Again", "typo")
        self.assertEqual(later.status_code, 200, later.get_json())


if __name__ == "__main__":
    unittest.main()
