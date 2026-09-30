"""Cross-cutting consistency fixes (audit .planning/audit/cross-cutting.md).

Uploads: ``app.py`` sends every generated/uploaded file (research evidence, student requests,
monitoring sheets, policy documents) to a fresh temp folder whenever it is imported under
unittest or pytest, so nothing is written into the real ``uploads/`` folder. To choose the folder
yourself, or for a script that seeds a temp database, set ``USLS_UPLOAD_DIR`` BEFORE importing
``app`` (one line, copy it above the ``from app import``):

    os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="usls-uploads-"))

The real-database guard is the existing pattern: create a temp SQLite file and set
``DATABASE_URL`` before importing ``app``.
"""
import os
import re
import tempfile
import unittest
from unittest.mock import patch
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="usls-uploads-"))

from app import (  # noqa: E402
    AcademicTerm,
    Course,
    Faculty,
    PracticumRecord,
    Program,
    Student,
    StudyPlanDraft,
    SubjectEnrollment,
    Task,
    UserAccount,
    TransactionLog,
    WithdrawalApplication,
    add_log,
    add_task,
    app,
    canonical_owner_role,
    close_tasks_of_finished_workflows,
    db,
    ensure_demo_accounts,
    ensure_faculty_account_schema,
    generate_password_hash,
    graduation_eligibility,
    normalize_owner_role_vocabulary,
    run_schema_upgrades,
    seed_database,
)
from sqlalchemy import inspect as sa_inspect, text  # noqa: E402
import app as app_module  # noqa: E402


def _account(role, email):
    account = UserAccount(
        email=email,
        full_name=f"Test {role.title()}",
        password_hash=generate_password_hash("test-password"),
        role=role,
        active=True,
    )
    db.session.add(account)
    db.session.flush()
    return account


class CrossCutBase(unittest.TestCase):
    """Small fixture: one program, one course, one student, one account per office."""

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()

    def setUp(self):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="XC", name="Crosscut Psychology Program", college="Graduate School", has_practicum=True)
            db.session.add(program)
            db.session.flush()
            course = Course(program_id=program.id, code="XC-501", title="Crosscut Course", units=3, category="Major")
            db.session.add(course)
            student = Student(
                student_number="GS-2026-XC",
                first_name="Cross",
                last_name="Cut",
                email="cross@example.test",
                program_id=program.id,
                entry_year=2025,
                academic_year_entry="25-26",
                year_level="1",
                current_stage="Coursework",
                standing="Active",
            )
            db.session.add(student)
            db.session.flush()
            self.staff_id = _account("staff", "staff@example.test").id
            self.academic_id = _account("academic_coordinator", "academic@example.test").id
            self.research_id = _account("research_coordinator", "research@example.test").id
            self.dean_id = _account("dean", "dean@example.test").id
            self.program_id = program.id
            self.course_id = course.id
            self.student_id = student.id
            db.session.commit()

    def client_for(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff(self):
        return self.client_for(self.staff_id, "staff")

    def academic(self):
        return self.client_for(self.academic_id, "academic_coordinator")

    def research(self):
        return self.client_for(self.research_id, "research_coordinator")

    def dean(self):
        return self.client_for(self.dean_id, "dean")


def open_tasks(student_id, *fragments):
    query = Task.query.filter(Task.student_id == student_id, Task.status.in_(["Pending", "Overdue"]))
    rows = query.all()
    if fragments:
        rows = [t for t in rows if any(f.lower() in t.title.lower() for f in fragments)]
    return rows


class WithdrawalLifecycleTests(CrossCutBase):
    """H01 (student can file again after an export) and H04 (tasks close with the step)."""

    def _student_login(self):
        account = _account("student", "student-xc@example.test")
        account.student_id = self.student_id
        db.session.commit()
        return self.client_for(account.id, "student")

    def _enrollment(self, code):
        term = AcademicTerm.query.filter_by(label="XC Window Term").first()
        if not term:
            term = AcademicTerm(label="XC Window Term", start_date=date.today() + timedelta(days=3),
                                end_date=date.today() + timedelta(days=123))
            db.session.add(term)
            db.session.flush()
        course = Course(program_id=self.program_id, code=code, title=f"Course {code}", units=3, category="Major")
        db.session.add(course)
        db.session.flush()
        enrollment = SubjectEnrollment(student_id=self.student_id, course_id=course.id, term_id=term.id, status="Enrolled")
        db.session.add(enrollment)
        db.session.commit()
        return enrollment.id

    def _run_first_withdrawal_to_export(self):
        student = self._student_login()
        first = self._enrollment("XC-601")
        self._second = self._enrollment("XC-602")
        response = student.post("/api/student-portal/requests/withdrawal",
                                json={"subject_enrollment_id": first, "reason": "Schedule conflict"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(len(open_tasks(self.student_id, "withdrawal")), 1)
        staff = self.staff()
        body = {"student_id": self.student_id}
        self.assertEqual(staff.post("/api/transactions/withdrawal", json={**body, "workflow_action": "forward_to_dean", "workflow_comment": "Forwarded."}).status_code, 200)
        application = WithdrawalApplication.query.filter_by(student_id=self.student_id).one()
        dean = self.dean().post(f"/api/approvals/workflow/withdrawal/{application.id}/decide", json={"decision": "approve"})
        self.assertEqual(dean.status_code, 200, dean.get_json())
        self._after_dean_open = open_tasks(self.student_id, "Review withdrawal request")
        tag = staff.post("/api/transactions/withdrawal", json={**body, "workflow_action": "tag_subject_withdrawn", "workflow_comment": "Tagged."})
        self.assertEqual(tag.status_code, 200, tag.get_json())
        export = staff.post("/api/withdrawal/approved.xlsx", json={"application_ids": [application.id]})
        self.assertEqual(export.status_code, 200)
        db.session.expire_all()
        self.assertEqual(WithdrawalApplication.query.get(application.id).status, "Exported - Ready to Send")
        return student

    def test_student_can_file_another_withdrawal_after_an_export(self):
        """H01: an exported withdrawal is finished, so a second one is allowed."""
        with app.app_context():
            student = self._run_first_withdrawal_to_export()
            again = student.post("/api/student-portal/requests/withdrawal",
                                 json={"subject_enrollment_id": self._second, "reason": "Second subject"})
            self.assertEqual(again.status_code, 200, again.get_json())

    def test_withdrawal_tasks_close_as_each_step_completes(self):
        """H04: no task of a finished withdrawal stays open."""
        with app.app_context():
            self._run_first_withdrawal_to_export()
            self.assertEqual(self._after_dean_open, [], "Dean review task must close when the Dean decides")
            self.assertEqual([t.title for t in open_tasks(self.student_id, "withdrawal")], [])

    def test_denied_withdrawal_leaves_no_open_task(self):
        with app.app_context():
            student = self._student_login()
            first = self._enrollment("XC-611")
            self.assertEqual(student.post("/api/student-portal/requests/withdrawal", json={"subject_enrollment_id": first, "reason": "Reason"}).status_code, 200)
            staff = self.staff()
            staff.post("/api/transactions/withdrawal", json={"student_id": self.student_id, "workflow_action": "forward_to_dean", "workflow_comment": "Forwarded."})
            application = WithdrawalApplication.query.filter_by(student_id=self.student_id).one()
            deny = self.dean().post(f"/api/approvals/workflow/withdrawal/{application.id}/decide", json={"decision": "deny", "note": "Not within the approved grounds."})
            self.assertEqual(deny.status_code, 200, deny.get_json())
            self.assertEqual([t.title for t in open_tasks(self.student_id, "withdrawal")], [])


def _minimal_row(table, **overrides):
    """Insert one row with placeholder values for every required column (SQLite does not check FKs)."""
    import sqlalchemy as sa

    values = {}
    for column in table.columns:
        if column.name in overrides:
            values[column.name] = overrides[column.name]
            continue
        if column.nullable or column.default is not None or column.server_default is not None or column.primary_key:
            continue
        kind = column.type
        if isinstance(kind, sa.Boolean):
            values[column.name] = False
        elif isinstance(kind, sa.Integer):
            values[column.name] = 1
        elif isinstance(kind, sa.DateTime):
            values[column.name] = datetime.now()
        elif isinstance(kind, sa.Date):
            values[column.name] = date.today()
        elif isinstance(kind, (sa.Float, sa.Numeric)):
            values[column.name] = 1
        else:
            values[column.name] = f"x-{table.name}-{column.name}"
    values.update({k: v for k, v in overrides.items() if k in table.columns})
    db.session.execute(table.insert().values(**values))


class StudyPlanReviewTests(CrossCutBase):
    """M07: the Academic Coordinator can approve a study plan or return it with a comment."""

    def _sent_plan(self):
        draft = StudyPlanDraft(student_id=self.student_id, term_label="XC Term", subject_codes="XC-501",
                               subject_count=1, remaining_count=0, status="Sent to Academic Coordinator")
        db.session.add(draft)
        db.session.commit()
        return draft.id

    def test_academic_coordinator_approves(self):
        with app.app_context():
            plan_id = self._sent_plan()
            response = self.academic().post(f"/api/enrollment/study-plans/{plan_id}/review",
                                            json={"decision": "approve", "remarks": "Looks right."})
            self.assertEqual(response.status_code, 200, response.get_json())
            self.assertEqual(response.get_json()["item"]["status"], "Reviewed")
            last = TransactionLog.query.filter_by(transaction_slug="enrollment").order_by(TransactionLog.id.desc()).first()
            self.assertEqual(last.next_owner, "None")  # finished: nobody is waiting

    def test_return_needs_a_comment_and_can_be_sent_again(self):
        with app.app_context():
            plan_id = self._sent_plan()
            ac = self.academic()
            blank = ac.post(f"/api/enrollment/study-plans/{plan_id}/review", json={"decision": "return", "remarks": " "})
            self.assertEqual(blank.status_code, 400)
            returned = ac.post(f"/api/enrollment/study-plans/{plan_id}/review",
                               json={"decision": "return", "remarks": "Add the practicum subject."})
            self.assertEqual(returned.status_code, 200, returned.get_json())
            item = returned.get_json()["item"]
            self.assertEqual(item["status"], "Returned for Revision")
            self.assertEqual(item["coordinator_remarks"], "Add the practicum subject.")
            again = self.staff().post(f"/api/enrollment/study-plans/{plan_id}/send")
            self.assertEqual(again.status_code, 200, again.get_json())
            self.assertEqual(again.get_json()["item"]["status"], "Sent to Academic Coordinator")

    def test_review_is_blocked_unless_the_plan_is_waiting_for_the_coordinator(self):
        with app.app_context():
            draft = StudyPlanDraft(student_id=self.student_id, status="Draft", subject_count=0, remaining_count=0)
            db.session.add(draft)
            db.session.commit()
            response = self.academic().post(f"/api/enrollment/study-plans/{draft.id}/review", json={"decision": "approve"})
            self.assertEqual(response.status_code, 409)
            self.assertEqual(self.staff().post(f"/api/enrollment/study-plans/{draft.id}/review", json={"decision": "approve"}).status_code, 403)


class AcademicTermTests(CrossCutBase):
    """L02: add a term, edit its dates, make it current; terms may never overlap."""

    def _create(self, client, label, start, end, **extra):
        return client.post("/api/admin/terms", json={"label": label, "start_date": start, "end_date": end, **extra})

    def test_add_edit_and_set_current_with_overlap_protection(self):
        with app.app_context():
            staff = self.staff()
            first = self._create(staff, "AY 2031-2032 1st Semester", "2031-08-01", "2031-12-15")
            self.assertEqual(first.status_code, 200, first.get_json())
            first_id = first.get_json()["term"]["id"]
            second = self._create(staff, "AY 2031-2032 2nd Semester", "2032-01-10", "2032-05-30",
                                  planning_window_open="2031-11-01", planning_window_close="2031-12-20")
            self.assertEqual(second.status_code, 200, second.get_json())
            second_id = second.get_json()["term"]["id"]

            overlap = self._create(staff, "AY 2030-2031 2nd Semester", "2031-12-01", "2032-01-20")
            self.assertEqual(overlap.status_code, 409)
            self.assertIn("overlap", overlap.get_json()["error"].lower())
            backwards = self._create(staff, "AY 2032-2033 1st Semester", "2032-12-01", "2032-08-01")
            self.assertEqual(backwards.status_code, 400)
            duplicate = self._create(staff, "AY 2031-2032 1st Semester", "2040-08-01", "2040-12-01")
            self.assertEqual(duplicate.status_code, 409)
            bad_label = self._create(staff, "First term", "2040-08-01", "2040-12-01")
            self.assertEqual(bad_label.status_code, 400)

            ok = staff.patch(f"/api/admin/terms/{first_id}", json={"end_date": "2031-12-20"})
            self.assertEqual(ok.status_code, 200, ok.get_json())
            self.assertEqual(ok.get_json()["term"]["end_date"], "2031-12-20")
            clash = staff.patch(f"/api/admin/terms/{first_id}", json={"end_date": "2032-02-01"})
            self.assertEqual(clash.status_code, 409)
            self.assertEqual(AcademicTerm.query.get(first_id).end_date, date(2031, 12, 20))  # unchanged

            current = staff.patch(f"/api/admin/terms/{second_id}/set-active")
            self.assertEqual(current.status_code, 200, current.get_json())
            self.assertEqual([t.id for t in AcademicTerm.query.filter_by(is_active_planning_term=True)], [second_id])

    def test_add_next_semester_never_overlaps(self):
        with app.app_context():
            db.session.add(AcademicTerm(label="AY 2033-2034 1st Semester", start_date=date(2033, 8, 1), end_date=date(2033, 12, 15)))
            db.session.commit()
            response = self.staff().post("/api/admin/terms/add-next")
            self.assertEqual(response.status_code, 200, response.get_json())
            term = response.get_json()["term"]
            self.assertEqual(term["label"], "AY 2033-2034 2nd Semester")
            self.assertGreater(term["start_date"], "2033-12-15")


class FacultyEditTests(CrossCutBase):
    """L02: staff can create and edit faculty in the portal; the login follows."""

    PAYLOAD = {"full_name": "Dr. Test Faculty", "department": "Education", "specialization": "Assessment",
               "email": "test.faculty@usls.edu.ph", "temporary_password": "DemoPass123!", "status": "Active",
               "eligible_roles": ["Faculty Adviser", "Panel Member"]}

    def test_create_then_edit_keeps_profile_and_login_in_step(self):
        with app.app_context():
            staff = self.staff()
            created = staff.post("/api/faculty", json=self.PAYLOAD)
            self.assertEqual(created.status_code, 201, created.get_json())
            faculty_id = created.get_json()["faculty"]["id"]
            edited = staff.patch(f"/api/faculty/{faculty_id}", json={
                "full_name": "Dr. Renamed Faculty", "email": "renamed.faculty@usls.edu.ph",
                "eligible_roles": ["Panel Chair"], "status": "Inactive", "new_password": "AnotherPass456!"})
            self.assertEqual(edited.status_code, 200, edited.get_json())
            faculty = Faculty.query.get(faculty_id)
            self.assertEqual(faculty.name, "Dr. Renamed Faculty")
            self.assertFalse(faculty.active)
            login = UserAccount.query.filter_by(faculty_id=faculty_id).one()
            self.assertEqual(login.email, "renamed.faculty@usls.edu.ph")
            self.assertFalse(login.active)
            from werkzeug.security import check_password_hash
            self.assertTrue(check_password_hash(login.password_hash, "AnotherPass456!"))

    def test_edit_rejects_a_taken_email_and_bad_input(self):
        with app.app_context():
            staff = self.staff()
            a = staff.post("/api/faculty", json=self.PAYLOAD).get_json()["faculty"]["id"]
            b = staff.post("/api/faculty", json={**self.PAYLOAD, "email": "second@usls.edu.ph", "full_name": "Dr. Second"}).get_json()["faculty"]["id"]
            self.assertEqual(staff.patch(f"/api/faculty/{b}", json={"email": self.PAYLOAD["email"]}).status_code, 409)
            self.assertEqual(staff.patch(f"/api/faculty/{b}", json={"email": "nope"}).status_code, 400)
            self.assertEqual(staff.patch(f"/api/faculty/{b}", json={"eligible_roles": ["Wizard"]}).status_code, 400)
            self.assertEqual(staff.patch(f"/api/faculty/{b}", json={"new_password": "short"}).status_code, 400)
            self.assertEqual(self.research().patch(f"/api/faculty/{a}", json={"full_name": "X"}).status_code, 403)


class JsonErrorTests(CrossCutBase):
    """L01: bad input answers 400/404 with a JSON message, never a 500 or an HTML page."""

    def assertJsonError(self, response, status):
        self.assertEqual(response.status_code, status, response.data[:200])
        self.assertTrue(response.is_json, response.data[:200])
        message = response.get_json().get("error", "")
        self.assertTrue(message)
        self.assertNotIn("browser (or proxy)", message)
        self.assertNotIn("<html", message.lower())
        self.assertNotRegex(message, r"^[0-9]{3} [A-Z]")  # not Werkzeug's "400 Bad Request: ..."

    def test_malformed_bodies_and_numbers_are_400(self):
        with app.app_context():
            anon = app.test_client()
            self.assertJsonError(anon.post("/api/auth/login", json=[1, 2]), 400)
            self.assertJsonError(anon.post("/api/auth/login", json={"email": "a@b.c", "password": 123}), 401)
            staff = self.staff()
            self.assertJsonError(staff.post("/api/students/merge", json={"target_id": "abc", "source_id": "x"}), 400)
            self.assertJsonError(staff.post("/api/students/merge", json=[1]), 400)
            answer = staff.post("/api/assistant", json={"question": 123})
            self.assertLess(answer.status_code, 500)
            self.assertJsonError(staff.get("/api/research-gate/template?student_id=abc"), 400)
            self.assertJsonError(staff.post("/api/enrollment/study-plans", json={"student_id": "abc"}), 400)

    def test_workflow_submit_reports_missing_field_and_unknown_student_plainly(self):
        with app.app_context():
            staff = self.staff()
            self.assertJsonError(staff.post("/api/transactions/withdrawal", json={}), 400)
            self.assertJsonError(staff.post("/api/transactions/withdrawal", json={"student_id": 999999}), 404)

    def test_unknown_routes_wrong_methods_and_server_faults_are_json(self):
        with app.app_context():
            staff = self.staff()
            self.assertJsonError(staff.get("/api/does-not-exist"), 404)
            self.assertJsonError(staff.get("/api/students/999999"), 404)
            self.assertJsonError(staff.delete("/api/dashboard"), 405)
            previous = app.config.get("PROPAGATE_EXCEPTIONS")
            app.config["PROPAGATE_EXCEPTIONS"] = False
            try:
                with patch.object(app_module, "dashboard_stats", side_effect=RuntimeError("secret internal detail")):
                    response = staff.get("/api/dashboard")
                self.assertJsonError(response, 500)
                self.assertNotIn("secret internal detail", response.get_data(as_text=True))
            finally:
                app.config["PROPAGATE_EXCEPTIONS"] = previous


class StudentMergeTests(CrossCutBase):
    """H05: merging two students must carry over every table that points at a student."""

    def test_merge_moves_every_student_linked_table_and_loses_nothing(self):
        with app.app_context():
            source = Student(student_number="GS-2026-DUP", first_name="Dup", last_name="Licate",
                             email="dup@example.test", program_id=self.program_id, entry_year=2025,
                             current_stage="Coursework", standing="Active")
            db.session.add(source)
            db.session.commit()
            source_id = source.id
            linked = [t for t in db.metadata.sorted_tables if "student_id" in t.c and t.name != "student"]
            self.assertGreaterEqual(len(linked), 26)
            for table in linked:
                _minimal_row(table, student_id=source_id)
            db.session.commit()

            response = self.staff().post("/api/students/merge", json={"target_id": self.student_id, "source_id": source_id})
            self.assertEqual(response.status_code, 200, response.get_json())

            db.session.expire_all()
            self.assertIsNone(db.session.get(Student, source_id))
            for table in linked:
                still_source = db.session.execute(
                    table.select().where(table.c.student_id == source_id)).fetchall()
                self.assertEqual(still_source, [], f"{table.name} still points at the deleted student")
                on_target = db.session.execute(
                    table.select().where(table.c.student_id == self.student_id)).fetchall()
                if table.name == "transaction_log":
                    self.assertGreaterEqual(len(on_target), 1)
                elif table.name == "user_account":
                    # the target already had none of these; the source login follows the student
                    self.assertGreaterEqual(len(on_target), 1)
                else:
                    self.assertGreaterEqual(len(on_target), 1, f"{table.name} row was lost in the merge")

    def test_merge_does_not_orphan_the_duplicates_login(self):
        with app.app_context():
            source = Student(student_number="GS-2026-DUP2", first_name="Dup", last_name="Two",
                             email="dup2@example.test", program_id=self.program_id, entry_year=2025,
                             current_stage="Coursework", standing="Active")
            db.session.add(source)
            db.session.flush()
            keep = _account("student", "keep@example.test")
            keep.student_id = self.student_id
            drop = _account("student", "drop@example.test")
            drop.student_id = source.id
            db.session.commit()
            keep_id, drop_id = keep.id, drop.id
            response = self.staff().post("/api/students/merge", json={"target_id": self.student_id, "source_id": source.id})
            self.assertEqual(response.status_code, 200, response.get_json())
            db.session.expire_all()
            kept, dropped = db.session.get(UserAccount, keep_id), db.session.get(UserAccount, drop_id)
            self.assertEqual(kept.student_id, self.student_id)
            self.assertTrue(kept.active)
            # The second login cannot point at a deleted student: it is switched off.
            self.assertIsNone(dropped.student_id)
            self.assertFalse(dropped.active)


class TaskClosingTests(CrossCutBase):
    """H04: a workflow step that completes also completes the task that asked for it."""

    def _titles(self, *fragments):
        return sorted(t.title for t in open_tasks(self.student_id, *fragments))

    def test_a_recorded_step_closes_the_acting_offices_earlier_tasks_only(self):
        with app.app_context():
            add_task(self.student_id, "Record and forward practicum MOA", "Graduate School Staff", 3)
            add_task(self.student_id, "Receive and review practicum MOA", "Academic Coordinator", 5)
            add_task(self.student_id, "Validate research completion evidence", "Research Coordinator", 5)
            db.session.commit()
            # Staff forwards the MOA: their task ends, the next office's task is new.
            add_task(self.student_id, "Review practicum certificates and hours", "Academic Coordinator", 5)
            add_log("practicum", self.student_id, "Graduate School Staff · Grace", "src",
                    "Practicum status updated: MOA Under Review", "Academic Coordinator", "", new_status="MOA Under Review")
            db.session.commit()
            self.assertEqual(self._titles("practicum"),
                             ["Receive and review practicum MOA", "Review practicum certificates and hours"])
            # Research-side work is not this workflow's and is left alone.
            self.assertEqual(self._titles("research"), ["Validate research completion evidence"])

    def test_sending_a_message_does_not_finish_the_senders_task(self):
        with app.app_context():
            add_task(self.student_id, "Record and forward withdrawal request", "Graduate School Staff", 3)
            db.session.commit()
            add_log("withdrawal", self.student_id, "Graduate School Staff · Grace", "Workflow message",
                    "Withdrawal Application message sent", "Student", "", visibility="internal")
            db.session.commit()
            self.assertEqual(len(self._titles("withdrawal")), 1)

    def test_student_resubmission_closes_the_students_revise_task(self):
        with app.app_context():
            add_task(self.student_id, "Revise structured return declaration from AWOL", "Student", 5)
            add_task(self.student_id, "Review structured return declaration from AWOL", "Graduate School Staff", 3)
            db.session.commit()
            add_log("awol", self.student_id, "Student", "Portal", "AWOL return declaration submitted", "Graduate School Staff", "")
            db.session.commit()
            self.assertEqual(self._titles("awol"), ["Review structured return declaration from AWOL"])

    def test_practicum_tasks_close_through_the_real_flow(self):
        with app.app_context():
            record = PracticumRecord(student_id=self.student_id, moa_uploaded=True, moa_status="Uploaded",
                                     practicum_site="Site", required_hours=100, completed_hours=100,
                                     status="MOA Submitted")
            db.session.add(record)
            add_task(self.student_id, "Record and forward practicum MOA", "GS Staff", 3)
            db.session.commit()
            staff, academic = self.staff(), self.academic()
            r = staff.post("/api/transactions/practicum", json={"student_id": self.student_id, "status": "MOA Under Review"})
            self.assertEqual(r.status_code, 200, r.get_json())
            self.assertEqual(self._titles("practicum"), ["Receive and review practicum MOA"])
            r = academic.post("/api/transactions/practicum", json={"student_id": self.student_id, "status": "Practicum In Progress"})
            self.assertEqual(r.status_code, 200, r.get_json())
            self.assertEqual(self._titles("practicum"), ["Complete practicum hours and prepare certificates"])


    def test_startup_cleanup_closes_tasks_of_workflows_that_already_finished(self):
        with app.app_context():
            db.session.add(WithdrawalApplication(student_id=self.student_id, status="Exported - Ready to Send",
                                                 dean_decision="Approved"))
            add_task(self.student_id, "Tag approved subject withdrawal and export the Registrar update", "Graduate School Staff", 3)
            add_task(self.student_id, "Check graduation coursework completion", "Academic Coordinator", 3)
            db.session.commit()
            self.assertEqual(close_tasks_of_finished_workflows(), 1)
            self.assertEqual(self._titles(), ["Check graduation coursework completion"])
            self.assertEqual(close_tasks_of_finished_workflows(), 0)


class OwnerVocabularyTests(CrossCutBase):
    """H03: one spelling for each owner role, on every screen."""

    def test_staff_owner_is_one_spelling_everywhere(self):
        with app.app_context():
            add_task(self.student_id, "Review student Leave of Absence application", "GS Staff", 3, 55)
            add_task(self.student_id, "Record and forward withdrawal request", "Graduate School Staff", 3, 60)
            add_task(self.student_id, "Check graduation coursework completion", "Academic Coordinator", 5, 45)
            db.session.commit()
            owners = {t.owner_role for t in Task.query.all()}
            self.assertEqual(owners, {"Graduate School Staff", "Academic Coordinator"})
            self.assertEqual(canonical_owner_role("GS Staff"), "Graduate School Staff")
            self.assertEqual(canonical_owner_role("Graduate School Staff · Grace"), "Graduate School Staff")
            add_log("withdrawal", self.student_id, "Student", "src", "Result", "GS Staff", "notes")
            db.session.commit()
            self.assertEqual(TransactionLog.query.one().next_owner, "Graduate School Staff")

    def test_migration_rewrites_legacy_rows_and_is_safe_to_repeat(self):
        with app.app_context():
            db.session.add(Task(student_id=self.student_id, title="Legacy", owner_role="GS Staff",
                                due_at=date.today(), status="Pending", priority=1))
            db.session.add(TransactionLog(transaction_slug="awol", student_id=self.student_id, actor_role="Student",
                                          result="x", next_owner="GS Staff"))
            db.session.commit()
            self.assertEqual(normalize_owner_role_vocabulary(), 2)
            self.assertEqual(normalize_owner_role_vocabulary(), 0)
            self.assertEqual(Task.query.one().owner_role, "Graduate School Staff")
            self.assertEqual(TransactionLog.query.one().next_owner, "Graduate School Staff")

    def test_every_screen_counts_the_same_staff_tasks(self):
        with app.app_context():
            # One legacy row (written before the migration) and two current rows.
            db.session.add(Task(student_id=self.student_id, title="Legacy", owner_role="GS Staff",
                                due_at=date.today(), status="Pending", priority=1))
            add_task(self.student_id, "Current A", "Graduate School Staff", 3)
            add_task(self.student_id, "Current B", "GS Staff", 3)
            db.session.commit()
            staff = self.staff()
            for owner in ("Graduate School Staff", "GS Staff"):
                listed = staff.get("/api/tasks", query_string={"owner": owner}).get_json()
                self.assertEqual(listed["total"], 3, owner)
            dash = staff.get("/api/dashboard").get_json()
            staff_rows = [r for r in dash["tasks_by_owner"] if r["owner"] in ("Graduate School Staff", "GS Staff")]
            self.assertEqual(staff_rows, [{"owner": "Graduate School Staff", "count": 3}])
            filtered = staff.get("/api/dashboard", query_string={"owner": "GS Staff"}).get_json()
            self.assertEqual(filtered["kpis"]["pending_tasks"], 3)
            drill = staff.get("/api/dashboard/drilldown", query_string={"type": "owner", "value": "Graduate School Staff"}).get_json()
            self.assertEqual(len(drill["rows"]), 3)
            analytics = staff.get("/api/reports/analytics").get_json()
            workload = next(r for r in analytics["owner_workload"]["rows"] if r["owner_role"] == "Graduate School Staff")
            self.assertEqual(workload["open_tasks"], 3)


class OldDatabaseStartupTests(unittest.TestCase):
    """M08: the start-up steps must not crash on a database from before the faculty-login commit."""

    def test_schema_upgrades_run_on_a_database_without_user_account_faculty_id(self):
        with app.app_context():
            db.drop_all()
            db.create_all()
            # Rebuild user_account the way it looked before faculty logins existed.
            ddl = db.session.execute(text("SELECT sql FROM sqlite_master WHERE name='user_account'")).scalar()
            kept = [line for line in ddl.splitlines() if "faculty_id" not in line]
            old_ddl = re.sub(r",\s*\)\s*$", chr(10) + ")", chr(10).join(kept))
            db.session.execute(text("DROP TABLE user_account"))
            db.session.execute(text(old_ddl))
            db.session.commit()
            self.assertNotIn("faculty_id", {c["name"] for c in sa_inspect(db.engine).get_columns("user_account")})
            run_schema_upgrades()
            self.assertIn("faculty_id", {c["name"] for c in sa_inspect(db.engine).get_columns("user_account")})


class SmallFixesTests(CrossCutBase):
    """L07 (long log text), L11 (faculty details), L09 (no database file tracked in git), uploads root."""

    def test_long_log_text_is_cut_to_the_column_size(self):
        with app.app_context():
            add_log("withdrawal", self.student_id, "Student", "f" * 300 + ".pdf", "R" * 400, "Graduate School Staff", "n")
            db.session.commit()
            row = TransactionLog.query.one()
            self.assertEqual(len(row.source_reference), 160)
            self.assertEqual(len(row.result), 160)

    def test_students_do_not_receive_faculty_contact_details(self):
        with app.app_context():
            db.session.add(Faculty(name="Dr. Private", college="Education", role="Faculty", specialization="X",
                                   email="private@usls.edu.ph", eligible_roles='["Faculty Adviser"]'))
            account = _account("student", "student-meta@example.test")
            account.student_id = self.student_id
            db.session.commit()
            student_view = self.client_for(account.id, "student").get("/api/meta").get_json()["faculty"]
            self.assertEqual(student_view, [{"id": student_view[0]["id"], "name": "Dr. Private", "college": "Education"}])
            staff_view = self.staff().get("/api/meta").get_json()["faculty"]
            self.assertEqual(staff_view[0]["email"], "private@usls.edu.ph")

    def test_no_database_file_is_tracked_and_gitignore_covers_backups(self):
        import subprocess
        from pathlib import Path
        root = Path(__file__).resolve().parents[1]
        try:
            tracked = subprocess.run(["git", "ls-files"], cwd=root, capture_output=True, text=True, check=True).stdout.splitlines()
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("git is not available")
        self.assertEqual([name for name in tracked if ".sqlite3" in name], [])
        ignored = subprocess.run(["git", "check-ignore", "usls_gs_demo.sqlite3.bak-20260806-0150"], cwd=root,
                                 capture_output=True, text=True)
        self.assertEqual(ignored.returncode, 0)

    def test_test_runs_write_uploads_to_a_temp_folder(self):
        from pathlib import Path
        real = (Path(app_module.__file__).resolve().parent / "uploads").resolve()
        for root in (app_module.UPLOAD_ROOT, app_module.REQUEST_UPLOAD_ROOT,
                     app_module.MONITORING_UPLOAD_ROOT, app_module.POLICY_DOCUMENT_UPLOAD_ROOT):
            self.assertNotIn(real, Path(root).resolve().parents)
            if root is app_module.POLICY_DOCUMENT_UPLOAD_ROOT and os.getenv("POLICY_DOCUMENT_UPLOAD_DIR"):
                continue  # policy uploads have their own override (set by the policy tests); still not the real folder
            self.assertEqual(Path(root).resolve().parent, Path(app_module.UPLOAD_ROOT).resolve().parent)


class QueueAndRiskTests(CrossCutBase):
    """M03 (risk is not stale) and M04 (queue aging ignores finished cases)."""

    def setUp(self):
        super().setUp()
        app_module._RISK_REFRESH_STATE.update(at=None, day=None)

    def test_overdue_task_moves_a_student_to_at_risk_without_a_restart(self):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.risk_level = "On Track"
            db.session.commit()
            staff = self.staff()
            self.assertEqual(staff.get("/api/dashboard").get_json()["kpis"]["at_risk"], 0)
            db.session.add(Task(student_id=self.student_id, title="Late thing", owner_role="Graduate School Staff",
                                due_at=date.today() - timedelta(days=9), status="Pending", priority=10))
            db.session.commit()
            app_module._RISK_REFRESH_STATE["at"] -= 10_000  # the refresh window has passed
            kpis = staff.get("/api/dashboard").get_json()["kpis"]
            self.assertEqual(kpis["at_risk"], 1)
            # The student page, the students list and the dashboard agree on the same student.
            detail = staff.get(f"/api/students/{self.student_id}").get_json()
            self.assertIn(detail["student"]["risk_level"], app_module.AT_RISK_LEVELS)
            listed = staff.get("/api/students?risk=At Risk of Delay,Delayed").get_json()
            self.assertEqual(listed["total"], 1)

    def test_queue_aging_does_not_count_finished_cases(self):
        with app.app_context():
            db.session.add(WithdrawalApplication(student_id=self.student_id, status="Exported - Ready to Send",
                                                 dean_decision="Approved"))
            add_log("withdrawal", self.student_id, "Graduate School Staff · Grace", "Approved subject withdrawals workbook",
                    "Approved subject withdrawal added to Registrar Excel list", "Graduate School Staff", "",
                    new_status="Exported - Ready to Send")
            open_student = Student(student_number="GS-2026-OPEN", first_name="Still", last_name="Open", email="o@example.test",
                                   program_id=self.program_id, entry_year=2025, current_stage="Coursework", standing="Active")
            db.session.add(open_student)
            db.session.flush()
            add_log("withdrawal", open_student.id, "Student", "Portal", "Withdrawal request submitted",
                    "Graduate School Staff", "", new_status="Submitted to GS Staff")
            add_log("enrollment", self.student_id, "Academic Coordinator · Ramon", "Study plan draft",
                    "Study plan reviewed by Academic Coordinator", "None", "", new_status="Reviewed")
            db.session.commit()
            rows = {r["process_area"]: r for r in self.staff().get("/api/reports/analytics").get_json()["queue_aging"]["rows"]}
            self.assertEqual(rows["Withdrawal"]["open_cases"], 1)  # only the student who is still waiting
            self.assertNotIn("Enrollment", rows)

    def test_research_coordinator_work_queue_needs_only_readable_data(self):
        with app.app_context():
            research = self.research()
            self.assertEqual(research.get("/api/tasks").status_code, 200)
            # The Conflicts tab is for staff and the Academic Coordinator only (the screen skips it).
            self.assertEqual(research.get("/api/monitoring/conflicts").status_code, 403)
            self.assertEqual(self.academic().get("/api/monitoring/conflicts").status_code, 200)


class SeededConsistencyTests(unittest.TestCase):
    """M01-M04: the dashboard, the students list and the reports give the same numbers.

    Uses the real demo seed (about a minute to build), once for the whole class.
    """

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            seed_database(60)
            ensure_demo_accounts()
            ensure_faculty_account_schema()
            run_schema_upgrades()
            db.session.commit()
            cls.staff_id = UserAccount.query.filter_by(role="staff", active=True).first().id
            cls.total_students = Student.query.count()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()

    def setUp(self):
        app_module._RISK_REFRESH_STATE.update(at=None, day=None)
        self.client = app.test_client()
        with self.client.session_transaction() as session:
            session["account_id"] = self.staff_id
            session["role"] = "staff"

    def get(self, url, **params):
        response = self.client.get(url, query_string=params)
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        return response.get_json()

    def test_stage_chart_students_list_and_reports_have_the_same_total(self):
        with app.app_context():
            dashboard = self.get("/api/dashboard")
            self.assertEqual(sum(row["count"] for row in dashboard["stage_distribution"]), self.total_students)
            self.assertEqual(dashboard["kpis"]["total_students"], self.total_students)
            self.assertEqual(self.get("/api/students", page_size=5)["total"], self.total_students)
            reports = self.get("/api/reports")
            self.assertEqual(reports["summary"]["total_students"], self.total_students)
            self.assertEqual(sum(row["count"] for row in reports["dashboard"]["stage_distribution"]), self.total_students)
            # Every stage the chart shows can be selected in the students list with the same count.
            for row in dashboard["stage_distribution"]:
                self.assertEqual(self.get("/api/students", stage=row["stage"], page_size=5)["total"], row["count"], row["stage"])
            self.assertEqual(db.session.query(Student).filter(Student.current_stage == "Research").count(), 0)

    def test_standing_filters_match_the_dashboard(self):
        with app.app_context():
            dashboard = self.get("/api/dashboard")["kpis"]
            for standing in app_module.STANDINGS:
                listed = self.get("/api/students", standing=standing, page_size=5)["total"]
                counted = self.get("/api/dashboard", standing=standing)["kpis"]["total_students"]
                self.assertEqual(listed, counted, standing)
            self.assertEqual(self.get("/api/students", standing="AWOL", page_size=5)["total"],
                             Student.query.filter_by(standing="AWOL").count())
            # "Completed" is a stage; the old standing spelling keeps working and means the same.
            self.assertEqual(self.get("/api/students", standing="Completed", page_size=5)["total"], dashboard["completed"])
            self.assertGreater(dashboard["completed"], 0)
            self.assertIn("standings", self.get("/api/meta"))

    def test_on_leave_has_one_meaning_everywhere(self):
        with app.app_context():
            expected = sum(1 for s in Student.query.all() if app_module.student_is_on_leave(s))
            self.assertGreater(expected, 0)
            self.assertEqual(self.get("/api/dashboard")["kpis"]["on_leave"], expected)
            self.assertEqual(self.get("/api/reports")["loa_readmission"]["count"], expected)
            self.assertEqual(self.get("/api/students", student_status="loa", page_size=5)["total"], expected)
            self.assertEqual(self.get("/api/students", standing="On Leave", page_size=5)["total"], expected)

    def test_at_risk_has_one_meaning_everywhere(self):
        with app.app_context():
            refreshed = Student.query.all()
            expected = sum(1 for s in refreshed if app_module.student_priority(s)["level"] in app_module.AT_RISK_LEVELS)
            self.assertEqual(self.get("/api/dashboard")["kpis"]["at_risk"], expected)
            self.assertEqual(self.get("/api/reports")["at_risk"]["count"], expected)
            self.assertEqual(self.get("/api/students", risk="At Risk of Delay,Delayed", page_size=5)["total"], expected)

    def test_report_counts_are_real_and_rows_are_paged(self):
        with app.app_context():
            reports = self.get("/api/reports", page_size=20)
            missing_expected = 0
            for student in Student.query.all():
                e = graduation_eligibility(student)
                if e["missing_coursework"] or e["missing_research_requirements"] or e["missing_practicum_requirement"]:
                    missing_expected += 1
            missing = reports["missing_requirements"]
            self.assertEqual(missing["count"], missing_expected)
            self.assertGreater(missing["count"], 20, "the seed must be big enough to need a second page")
            self.assertEqual(len(missing["rows"]), 20)
            self.assertEqual(missing["pages"], (missing_expected + 19) // 20)
            page2 = self.get("/api/reports", page_size=20, tab="missing_requirements", page=2)["missing_requirements"]
            self.assertEqual(page2["page"], 2)
            first_ids = {r["student"]["id"] for r in missing["rows"]}
            self.assertFalse(first_ids & {r["student"]["id"] for r in page2["rows"]})
            dashboard_kpis = reports["summary"]
            self.assertEqual(reports["open_overdue_tasks"]["count"], dashboard_kpis["pending_tasks"])
            self.assertEqual(reports["withdrawal_requests"]["count"], dashboard_kpis["withdrawal_requests"])
            self.assertEqual(reports["practicum_monitoring"]["count"], dashboard_kpis["practicum_records"])
            self.assertEqual(reports["graduation_candidates"]["count"], dashboard_kpis["graduation_candidates"])

    def test_work_queue_total_matches_the_dashboard(self):
        with app.app_context():
            listed = self.get("/api/tasks", page_size=10)
            self.assertEqual(listed["total"], self.get("/api/dashboard")["kpis"]["pending_tasks"])
            self.assertLessEqual(len(listed["items"]), 10)

    def test_decision_support_totals_are_not_cut_by_the_page_limit(self):
        with app.app_context():
            payload = self.get("/api/decision-support")
            self.assertEqual(payload["summary"]["total"], sum(row["count"] for row in payload["summary"]["by_owner"]))
            self.assertEqual(payload["summary"]["shown"], len(payload["items"]))
            owners = {row["owner"] for row in payload["summary"]["by_owner"]}
            self.assertNotIn("GS Staff", owners)


class FirstStartTests(unittest.TestCase):
    """H02: a brand-new database must leave every faculty login active."""

    def test_fresh_seed_leaves_every_faculty_login_active(self):
        with app.app_context():
            db.drop_all()
            db.create_all()
            seed_database(60)
            ensure_demo_accounts()
            ensure_faculty_account_schema()
            db.session.commit()
            faculty_total = Faculty.query.count()
            self.assertGreater(faculty_total, 0)
            active = UserAccount.query.filter_by(role="faculty", active=True).count()
            self.assertEqual(active, faculty_total)
            # Every faculty profile is linked to exactly one active login.
            for faculty in Faculty.query.all():
                logins = UserAccount.query.filter_by(role="faculty", faculty_id=faculty.id, active=True).count()
                self.assertEqual(logins, 1, faculty.name)


if __name__ == "__main__":
    unittest.main()
