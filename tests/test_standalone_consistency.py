"""The four standalone processes run on one board.

Leave of Absence, Readmission, AWOL & Residency and Withdrawal must show the same kind of
board (a stage list, cases with actions for the signed-in role, a guarded move) and differ
only in their stages and moves. These tests cover the shared vocabulary, one readable
refusal for an illegal move in every process, and that the drag route and the button route
are the same route.
"""

import os
import re
import tempfile
import unittest
from datetime import date, datetime, timedelta
from pathlib import Path

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    AcademicTerm,
    AwolCase,
    Course,
    Program,
    ResidencyEnrollment,
    Student,
    StudentRequestAttachment,
    SubjectEnrollment,
    UserAccount,
    WithdrawalApplication,
    app,
    db,
    generate_password_hash,
)
import leave_workflow  # noqa: E402
import standalone_process  # noqa: E402

SLUGS = ("leave-of-absence", "readmission", "awol", "withdrawal")
CHECKLIST = [
    "Structured return intention completed",
    "Updated study plan confirmed",
    "Program or adviser consultation completed",
    "No pending accountability confirmed",
]
FRONTEND = Path(__file__).resolve().parent.parent / "frontend" / "src"


class StandaloneConsistencyTests(unittest.TestCase):
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
            program = Program(code="STD", name="Standalone Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            course = Course(program_id=program.id, code="STD-501", title="Standalone Course", units=3, category="Major")
            db.session.add(course)
            db.session.flush()
            self.course_id = course.id
            today = date.today()
            specs = [
                ("Running Term", today - timedelta(days=3), today + timedelta(days=117)),
                ("Term One", today + timedelta(days=130), today + timedelta(days=250)),
                ("Term Two", today + timedelta(days=260), today + timedelta(days=380)),
            ]
            self.term_ids = {}
            for label, start, end in specs:
                term = AcademicTerm(label=label, start_date=start, end_date=end)
                db.session.add(term)
                db.session.flush()
                self.term_ids[label] = term.id
            self.students = {}
            for key in ("leave", "awol", "withdrawal"):
                student = Student(
                    student_number=f"GS-STD-{key}",
                    first_name=key.title(),
                    last_name="Student",
                    email=f"{key}.student@example.test",
                    program_id=program.id,
                    entry_year=today.year - 1,
                    academic_year_entry="25-26",
                    year_level="1",
                    current_stage="Coursework",
                    standing="Active",
                    enrollment_tag="Enrolled",
                )
                db.session.add(student)
                db.session.flush()
                self.students[key] = student.id
            self.staff_id = self._account("staff", "std-staff@example.test").id
            self.dean_id = self._account("dean", "std-dean@example.test").id
            self.ac_id = self._account("academic_coordinator", "std-ac@example.test").id
            account = self._account("student", "std-student@example.test")
            account.student_id = self.students["leave"]
            self.student_account_id = account.id
            db.session.commit()

    # ---- fixtures -------------------------------------------------------------
    def _account(self, role, email):
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

    def _client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def staff(self):
        return self._client(self.staff_id, "staff")

    def dean(self):
        return self._client(self.dean_id, "dean")

    def coordinator(self):
        return self._client(self.ac_id, "academic_coordinator")

    def student(self):
        return self._client(self.student_account_id, "student")

    def listing(self, slug, client=None):
        response = (client or self.staff()).get(f"/api/process-cases?slug={slug}")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def move(self, slug, ref, action, client=None, **body):
        return (client or self.staff()).post(f"/api/process-cases/{slug}/{ref}/transition", json={"action": action, **body})

    def make_awol_case(self, status="Return Submitted", **fields):
        with app.app_context():
            student = db.session.get(Student, self.students["awol"])
            student.standing, student.enrollment_tag, student.current_stage = "AWOL", "AWOL", "AWOL"
            case = AwolCase(
                student_id=student.id,
                status=status,
                dean_decision=fields.pop("dean_decision", "Not Submitted"),
                return_intent=fields.pop("return_intent", "I am ready to come back and finish."),
                target_return_term="Term One",
                return_requested_at=datetime.now(),
                awol_effective_date=date.today() - timedelta(days=200),
                **fields,
            )
            db.session.add(case)
            db.session.commit()
            return f"awol-{case.id}"

    def make_withdrawal(self, status="Submitted to GS Staff", dean_decision="Pending"):
        with app.app_context():
            enrollment = SubjectEnrollment(
                student_id=self.students["withdrawal"], course_id=self.course_id,
                term_id=self.term_ids["Running Term"], status="Enrolled", source_reference="consistency test",
            )
            db.session.add(enrollment)
            db.session.flush()
            request_file = StudentRequestAttachment(
                student_id=self.students["withdrawal"], request_type="withdrawal",
                original_name="request.pdf", stored_name="withdrawal-consistency.pdf",
            )
            db.session.add(request_file)
            db.session.flush()
            application = WithdrawalApplication(
                student_id=self.students["withdrawal"], subject_enrollment_id=enrollment.id,
                withdrawal_scope="Subject", reason="Work schedule clash.", effective_term="Running Term",
                status=status, dean_decision=dean_decision, request_attachment_id=request_file.id,
            )
            db.session.add(application)
            db.session.commit()
            return application.id

    def make_loa_submitted(self):
        response = self.student().post("/api/student-portal/requests/leave-of-absence", json={
            "effective_start": "Term One", "effective_end": "Term Two",
            "reason_category": "Medical / health", "reason_remarks": "Surgery and recovery.",
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        return self.listing("leave-of-absence")["cases"][0]["id"]

    def make_readmission_submitted(self):
        leave_id = self.make_loa_submitted()
        self.assertEqual(self.move("leave-of-absence", leave_id, "forward", eligibility_result="Eligible").status_code, 200)
        self.assertEqual(self.move("leave-of-absence", leave_id, "approve", client=self.dean()).status_code, 200)
        with app.app_context():
            from app import LeaveCase
            case = db.session.get(LeaveCase, leave_id)
            case.status = "On Leave"  # the leave has begun
            db.session.commit()
        body = {"target_return_term": "Term Two", "return_intent": "I am ready to return.", "readmission_items": CHECKLIST}
        response = self.student().post("/api/student-portal/requests/readmission", json=body)
        self.assertEqual(response.status_code, 200, response.get_json())
        return self.listing("readmission")["cases"][0]["id"]

    # ---- one stage list for every process --------------------------------------
    def test_each_process_exposes_a_stage_list_of_known_statuses(self):
        for slug in SLUGS:
            data = self.listing(slug)
            vocabulary = data["vocabulary"]
            columns = vocabulary["columns"][slug]
            self.assertGreaterEqual(len(columns), 4, slug)
            known = {item["key"] for item in vocabulary["statuses"]}
            for column in columns:
                self.assertTrue(column["key"] and column["label"] and column["statuses"], (slug, column))
                self.assertLessEqual(set(column["statuses"]), known, (slug, column["key"]))
            for move in vocabulary["transitions"]:
                self.assertLessEqual(set(move["from"]), known, (slug, move["action"]))
                self.assertTrue(move["label"], (slug, move["action"]))
                if not move["to"].startswith("*"):
                    self.assertIn(move["to"], known, (slug, move["action"]))
            for info in vocabulary["statuses"]:
                self.assertTrue({"key", "label", "tone", "owner"} <= set(info), (slug, info))

    def test_the_two_new_vocabularies_are_well_formed(self):
        for slug in standalone_process.PROCESS_SLUGS:
            known = {item["key"] for item in standalone_process.status_info(slug)}
            on_board = [s for column in standalone_process.BOARD_COLUMNS[slug] for s in column["statuses"]]
            self.assertEqual(len(on_board), len(set(on_board)), f"{slug}: a status is in two columns")
            self.assertEqual(set(on_board), known, f"{slug}: every status belongs to exactly one column")
            for move in standalone_process.TRANSITIONS[slug]:
                self.assertLessEqual(set(move["from"]), known, move["action"])
                self.assertTrue(move["roles"], move["action"])

    def test_every_case_has_the_same_shape_in_all_four_processes(self):
        self.make_loa_submitted()
        self.make_awol_case()
        self.make_withdrawal()
        required = {"id", "kind", "kind_label", "slug", "status", "status_label", "status_tone", "owner", "student",
                    "actions", "timeline", "unresolved_messages"}
        for slug in ("leave-of-absence", "awol", "withdrawal"):
            cases = self.listing(slug)["cases"]
            self.assertTrue(cases, slug)
            for case in cases:
                self.assertTrue(required <= set(case), (slug, required - set(case)))
                self.assertTrue(case["timeline"], slug)
        for slug, cases in (("awol", self.listing("awol")["cases"]), ("withdrawal", self.listing("withdrawal")["cases"])):
            for case in cases:
                self.assertTrue(case["card_lines"], slug)
                for action in case["actions"]:
                    self.assertTrue({"action", "label", "to", "targets", "needs_comment", "tone", "batch"} <= set(action))

    def test_the_detail_window_has_the_same_sections_for_every_process(self):
        self.make_loa_submitted()
        ref_awol = self.make_awol_case()
        ref_withdrawal = self.make_withdrawal()
        loa_id = self.listing("leave-of-absence")["cases"][0]["id"]
        sections = {"timeline", "earlier_cases", "events", "messages", "history", "files"}
        for slug, ref in (("leave-of-absence", loa_id), ("awol", ref_awol), ("withdrawal", ref_withdrawal)):
            response = self.staff().get(f"/api/process-cases/{slug}/{ref}")
            self.assertEqual(response.status_code, 200, response.get_json())
            case = response.get_json()["case"]
            self.assertTrue(sections <= set(case), (slug, sections - set(case)))
            self.assertIn("policy_review", case, slug)

    # ---- an illegal move is refused in words, in every process ------------------
    def assert_refused(self, response, *words):
        self.assertIn(response.status_code, (400, 403, 404, 409), response.get_json())
        message = response.get_json()["error"]
        self.assertGreater(len(message), 25, message)
        self.assertNotIn("Traceback", message)
        for word in words:
            self.assertIn(word, message)
        return message

    def test_leave_of_absence_refuses_an_illegal_move_with_a_reason(self):
        case_id = self.make_loa_submitted()
        self.assert_refused(self.move("leave-of-absence", case_id, "approve"))
        self.assert_refused(self.move("leave-of-absence", case_id, "forward", client=self.dean()))

    def test_readmission_refuses_an_illegal_move_with_a_reason(self):
        case_id = self.make_readmission_submitted()
        self.assert_refused(self.move("readmission", case_id, "approve"))
        self.assert_refused(self.move("readmission", case_id, "start_leave"))

    def test_awol_refuses_an_illegal_move_with_a_reason(self):
        ref = self.make_awol_case(status="AWOL Declared")
        message = self.assert_refused(self.move("awol", ref, "complete_reenrollment"))
        self.assertIn("AWOL", message)
        ref2 = self.make_awol_case(status="Return Submitted")
        self.assert_refused(self.move("awol", ref2, "approve"), "Dean")
        self.assert_refused(self.move("awol", ref2, "forward", client=self.dean()))
        self.assert_refused(self.move("awol", "awol-99999", "forward"))

    def test_withdrawal_refuses_an_illegal_move_with_a_reason(self):
        application_id = self.make_withdrawal()
        message = self.assert_refused(self.move("withdrawal", application_id, "tag"))
        self.assertIn("Submitted", message)
        self.assert_refused(self.move("withdrawal", application_id, "approve"), "Dean")
        self.assert_refused(self.move("withdrawal", application_id, "approve", client=self.dean()))
        self.assert_refused(self.move("withdrawal", application_id, "return", comment=""), "reason")
        self.assert_refused(self.move("withdrawal", application_id, "no_such_step"))

    def test_the_board_is_read_only_for_a_role_that_owns_no_step(self):
        ref = self.make_awol_case()
        for case in self.listing("awol", self.dean())["cases"]:
            self.assertEqual(case["actions"], [], "the Dean has no step on a return that is with staff")
        staff_case = self.listing("awol")["cases"][0]
        self.assertEqual([a["action"] for a in staff_case["actions"]], ["forward"])
        self.assertEqual(staff_case["id"], ref)

    def test_unknown_process_and_wrong_role_are_refused(self):
        self.assertEqual(self.staff().get("/api/process-cases?slug=practicum").status_code, 400)
        self.assertEqual(self.coordinator().get("/api/process-cases?slug=withdrawal").status_code, 403)
        self.assertEqual(self.student().get("/api/process-cases?slug=awol").status_code, 403)

    # ---- legal moves run the existing business logic -----------------------------
    def test_withdrawal_moves_through_the_same_steps_as_before(self):
        application_id = self.make_withdrawal()
        forward = self.move("withdrawal", application_id, "forward")
        self.assertEqual(forward.status_code, 200, forward.get_json())
        self.assertEqual(forward.get_json()["case"]["status"], "Dean Review")
        approve = self.move("withdrawal", application_id, "approve", client=self.dean())
        self.assertEqual(approve.status_code, 200, approve.get_json())
        self.assertEqual(approve.get_json()["case"]["status"], "Approved - Awaiting Subject Tag")
        tag = self.move("withdrawal", application_id, "tag")
        self.assertEqual(tag.status_code, 200, tag.get_json())
        case = tag.get_json()["case"]
        self.assertEqual(case["status"], "Subject Tagged - Registrar Preparation")
        self.assertEqual([a["action"] for a in case["actions"]], ["export"])
        exported = self.move("withdrawal", application_id, "export")
        self.assert_refused(exported, "Excel")
        with app.app_context():
            enrollment = SubjectEnrollment.query.filter_by(student_id=self.students["withdrawal"]).one()
            self.assertEqual(enrollment.status, "Withdrawn")
        detail = self.staff().get(f"/api/process-cases/withdrawal/{application_id}").get_json()["case"]
        self.assertGreaterEqual(len(detail["events"]), 3)

    def test_withdrawal_can_be_denied_with_a_reason_only(self):
        application_id = self.make_withdrawal(status="Dean Review")
        self.assert_refused(self.move("withdrawal", application_id, "deny", client=self.dean()), "reason")
        denied = self.move("withdrawal", application_id, "deny", client=self.dean(), comment="Past the window.")
        self.assertEqual(denied.status_code, 200, denied.get_json())
        self.assertEqual(denied.get_json()["case"]["status"], "Denied")

    def test_withdrawal_can_be_returned_to_the_student(self):
        application_id = self.make_withdrawal()
        returned = self.move("withdrawal", application_id, "return", comment="Upload the signed form.")
        self.assertEqual(returned.status_code, 200, returned.get_json())
        self.assertEqual(returned.get_json()["case"]["status"], "Returned for Clarification")
        self.assertEqual(returned.get_json()["case"]["owner"], "Student")

    def test_awol_return_goes_to_the_dean_and_the_dean_decides(self):
        ref = self.make_awol_case()
        forward = self.move("awol", ref, "forward")
        self.assertEqual(forward.status_code, 200, forward.get_json())
        self.assertEqual(forward.get_json()["case"]["status"], "Dean Review")
        approve = self.move("awol", ref, "approve", client=self.dean())
        self.assertEqual(approve.status_code, 200, approve.get_json())
        self.assertIn(approve.get_json()["case"]["status"], {"Return Approved", "Extension Approved - Refresher Required", "Re-enrollment Required"})

    def test_awol_reenrollment_is_completed_by_staff(self):
        ref = self.make_awol_case(status="Re-enrollment Required", dean_decision="Approved for Re-enrollment Review",
                                  full_reenrollment_required=True)
        done = self.move("awol", ref, "complete_reenrollment", client=self.coordinator())
        self.assertEqual(done.status_code, 200, done.get_json())
        self.assertEqual(done.get_json()["case"]["status"], "Re-enrollment Completed")

    def test_residency_can_be_closed_from_the_board(self):
        with app.app_context():
            item = ResidencyEnrollment(
                student_id=self.students["awol"], term_id=self.term_ids["Running Term"],
                reason="Comprehensive examination", policy_status="Eligible for Residency", status="Active",
            )
            db.session.add(item)
            db.session.commit()
            ref = f"residency-{item.id}"
        listed = [case for case in self.listing("awol")["cases"] if case["id"] == ref][0]
        self.assertEqual(listed["kind"], "RESIDENCY")
        self.assertEqual([a["action"] for a in listed["actions"]], ["end_residency"])
        closed = self.move("awol", ref, "end_residency")
        self.assertEqual(closed.status_code, 200, closed.get_json())
        self.assertEqual(closed.get_json()["case"]["status"], "Residency Completed")

    def test_batch_forward_lists_what_it_skipped(self):
        first = self.make_withdrawal()
        with app.app_context():
            other = Student.query.filter_by(student_number="GS-STD-awol").one()
            application = WithdrawalApplication(student_id=other.id, status="Dean Review", dean_decision="Pending")
            db.session.add(application)
            db.session.commit()
            second = application.id
        response = self.staff().post("/api/process-cases/withdrawal/batch", json={"case_ids": [first, second], "action": "forward"})
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual([row["case_id"] for row in body["updated"]], [str(first)])
        self.assertEqual([row["case_id"] for row in body["skipped"]], [str(second)])
        self.assertTrue(body["skipped"][0]["reason"])
        self.assertEqual(self.staff().post("/api/process-cases/withdrawal/batch", json={"case_ids": [first], "action": "export"}).status_code, 400)

    # ---- drag and buttons are one route ------------------------------------------
    def test_drag_and_buttons_share_one_route_on_the_screen(self):
        page = (FRONTEND / "components" / "ProcessBoardPage.jsx").read_text(encoding="utf-8")
        api_js = (FRONTEND / "api.js").read_text(encoding="utf-8")
        # One function sends a step to the server; drop, "Move to...", the case window buttons,
        # the confirm box and the batch bar all call it.
        self.assertEqual(len(re.findall(r"api\.processCaseTransition\(", page)), 1, "exactly one place sends a step")
        self.assertIn("submitTransition", page)
        self.assertIn("StageBoard", page)
        self.assertRegex(page, r"onMove=\{onMove\}")
        self.assertIn("processCaseTransition", api_js)
        for slug_file in ("pages/WorkflowPage.jsx", "pages/dean/DeanPages.jsx"):
            text = (FRONTEND / slug_file).read_text(encoding="utf-8")
            self.assertIn("ProcessBoardPage", text, slug_file)
        for old in ("LeaveCasesBoard", "WithdrawalRoster", "AwolResidencyPanel"):
            self.assertFalse((FRONTEND / "pages" / f"{old}.jsx").exists(), old)
            self.assertNotIn(f"function {old}", (FRONTEND / "pages" / "WorkflowPage.jsx").read_text(encoding="utf-8"), old)

    # ---- the same pieces on every page ---------------------------------------------
    def test_every_listing_carries_recent_activity_and_the_admin_questions(self):
        self.make_awol_case()
        self.make_withdrawal()
        for slug in SLUGS:
            data = self.listing(slug)
            self.assertIn("recent_activity", data, slug)
            self.assertIn("policy_questions", data, slug)
            self.assertIsInstance(data["policy_questions"], list)
        self.assertTrue(self.listing("awol")["residency_reasons"])

    def test_the_student_sees_their_case_in_the_same_shape_without_staff_only_parts(self):
        application_id = self.make_withdrawal()
        with app.app_context():
            account = db.session.get(UserAccount, self.student_account_id)
            account.student_id = self.students["withdrawal"]
            db.session.commit()
        self.assertEqual(self.move("withdrawal", application_id, "forward").status_code, 200)
        response = self.student().get("/api/student-portal/context")
        self.assertEqual(response.status_code, 200, response.get_json())
        cases = response.get_json()["standalone_cases"]["withdrawal"]
        self.assertEqual(len(cases), 1)
        case = cases[0]
        self.assertEqual(case["status"], "Dean Review")
        self.assertEqual(case["owner"], "Dean")
        self.assertTrue(case["timeline"])
        self.assertTrue(case["events"])
        self.assertEqual(case["actions"], [], "a student has no board step")
        self.assertNotIn("policy_review", case)
        self.assertNotIn("Staff notes", [row["label"] for row in case["summary_rows"]])

    def test_the_dean_uses_the_same_board_and_the_same_route(self):
        pages = (FRONTEND / "pages" / "dean" / "DeanPages.jsx").read_text(encoding="utf-8")
        nav = (FRONTEND / "components" / "portalNav.jsx").read_text(encoding="utf-8")
        for slug in SLUGS:
            self.assertIn(f'"{slug}"' if "-" in slug else slug, pages, slug)
            self.assertIn(f"/dean/approvals/{slug}", nav, slug)
        self.assertIn("<ProcessBoardPage", pages)
        # The Dean's steps arrive from the server as the card's actions, like staff's.
        withdrawal_id = self.make_withdrawal(status="Dean Review")
        case = [row for row in self.listing("withdrawal", self.dean())["cases"] if row["id"] == withdrawal_id][0]
        self.assertEqual({a["action"] for a in case["actions"]}, {"approve", "deny", "return"})
        self.assertEqual([a["action"] for a in self.listing("withdrawal")["cases"][0]["actions"]], ["return"])

    def test_the_student_pages_use_one_case_card(self):
        forms = (FRONTEND / "pages" / "student" / "RequestForms.jsx").read_text(encoding="utf-8")
        self.assertEqual(forms.count("<ProcessCaseList"), 2, "AWOL and Withdrawal both show the shared card")
        self.assertIn("LeaveCaseCard", forms, "Leave and Readmission keep theirs")
        card = (FRONTEND / "pages" / "student" / "ProcessCaseCard.jsx").read_text(encoding="utf-8")
        self.assertIn("LeaveTimeline", card)
        self.assertIn("leaveCaseStatusBadge", card)

    def test_the_leave_vocabulary_still_lists_its_columns(self):
        data = self.listing("leave-of-absence")
        self.assertEqual(
            [column["key"] for column in data["vocabulary"]["columns"]["leave-of-absence"]],
            [column["key"] for column in leave_workflow.BOARD_COLUMNS["leave-of-absence"]],
        )
        self.assertIn("recent_activity", data)


if __name__ == "__main__":
    unittest.main()
