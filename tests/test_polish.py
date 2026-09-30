"""Final polish packet (v5.1 run, 2026-10-01).

Covers the backend parts of the polish list: the header chip data, workflow
wording, the Operations Manual draft in the policy library, the removed
read-only monitoring stubs, the drop rule on every path, and business-rule
metadata that stays current. Frontend-only items have no test runner and are
described in the commit message instead.
"""
import os
import tempfile
import unittest
from datetime import date, timedelta
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as appmod  # noqa: E402
from app import (  # noqa: E402
    AcademicTerm,
    BusinessRule,
    BusinessRuleRevision,
    Course,
    CourseRecord,
    CurriculumOffering,
    Faculty,
    MonitoringEdit,
    PolicyDocument,
    Program,
    Student,
    SubjectEnrollment,
    TransactionLog,
    UserAccount,
    app,
    db,
    generate_password_hash,
)

REPO_ROOT = Path(__file__).resolve().parents[1]
DRAFT_WARNING = "Draft — pending Graduate School validation"
_TEST_ROOT = tempfile.mkdtemp(prefix="polish-tests-")


def tearDownModule():
    try:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        os.unlink(_DB_FILE.name)
    except (FileNotFoundError, PermissionError):
        pass


def academic_year_label(today: date) -> str:
    start = today.year if today.month >= 6 else today.year - 1
    return f"{start}-{start + 1}"


class PolishBase(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        self.today = date.today()
        self.ay = academic_year_label(self.today)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="PLS", name="Master of Polish Studies", college="Graduate School")
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            self.course_ids = []
            for index in range(1, 4):
                course = Course(program_id=program.id, code=f"PLS-50{index}", title=f"Polish Course {index}", units=3, category="Major")
                db.session.add(course)
                db.session.flush()
                self.course_ids.append(course.id)
            term = AcademicTerm(
                label=f"AY {self.ay} 1st Semester", start_date=self.today - timedelta(days=10),
                end_date=self.today + timedelta(days=100), is_active_planning_term=True,
            )
            db.session.add(term)
            db.session.flush()
            self.term_id = term.id
            for course_id in self.course_ids:
                db.session.add(CurriculumOffering(
                    program_id=program.id, academic_year=self.ay, semester="1st Semester",
                    course_id=course_id, added_by="Test",
                ))
            db.session.add(Faculty(
                name="Dr. Polish Named", college="Graduate School", role="Faculty",
                specialization="Testing", email="polish-faculty@example.test", active=True,
            ))
            student = Student(
                student_number="GS-PLS-0001", first_name="Pola", last_name="Student",
                email="pola@example.test", program_id=program.id, entry_year=int(self.ay[:4]),
                academic_year_entry="", year_level="1", current_stage="Coursework", standing="Active",
            )
            db.session.add(student)
            db.session.flush()
            self.student_id = student.id
            self.accounts = {}
            for role in ("staff", "academic_coordinator", "admin", "dean"):
                self.accounts[role] = self._account(role, f"{role}-pls@example.test").id
            self.student_account_id = self._account(
                "student", "pola-pls@example.test", student_id=student.id,
                full_name="Pola Student · Research Gate, Panel Matching, Defense Scheduling Demo",
            ).id
            db.session.commit()
            appmod.ensure_business_rules()

    def _account(self, role, email, student_id=None, full_name=None):
        account = UserAccount(
            email=email, full_name=full_name or f"Test {role}", password_hash=generate_password_hash("pw"),
            role=role, student_id=student_id, active=True,
        )
        db.session.add(account)
        db.session.flush()
        return account

    def client(self, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.student_account_id if role == "student" else self.accounts[role]
            session["role"] = role
        return client


# =========================================================================== 2 header chip
class HeaderChipTests(PolishBase):
    def test_a_student_is_shown_by_name_and_program_not_by_the_demo_persona(self):
        response = self.client("student").get("/api/auth/me")
        self.assertEqual(response.status_code, 200)
        user = response.get_json()["user"]
        self.assertEqual(user["role"], "student")
        self.assertEqual(user["full_name"], "Pola Student")
        self.assertEqual(user["program"], "PLS")
        self.assertEqual(user["program_name"], "Master of Polish Studies")
        self.assertNotIn("Demo", user["full_name"])

    def test_staff_accounts_keep_their_own_name_and_have_no_program(self):
        user = self.client("staff").get("/api/auth/me").get_json()["user"]
        self.assertEqual(user["full_name"], "Test staff")
        self.assertFalse(user.get("program"))


# =========================================================================== wording
class WorkflowWordingTests(unittest.TestCase):
    def test_leave_of_absence_does_not_say_the_record_is_paused(self):
        short = appmod.TRANSACTION_BY_SLUG["leave-of-absence"]["short"].lower()
        self.assertNotIn("pause", short)
        self.assertIn("residen", short)  # leave counts toward maximum residence (handbook)

    def test_no_workflow_description_says_anything_is_paused(self):
        for item in appmod.TRANSACTIONS:
            for field in ("short", "data"):
                self.assertNotIn("pause", item[field].lower(), (item["slug"], field))


# =========================================================================== 3 operations manual
class OperationsManualLibraryTests(PolishBase):
    def setUp(self):
        super().setUp()
        self.upload_root = Path(tempfile.mkdtemp(dir=_TEST_ROOT)) / "policy_documents"
        patches = [
            patch.object(appmod, "POLICY_DOCUMENT_UPLOAD_ROOT", self.upload_root),
            patch.object(appmod, "RAG_INDEX_DIR", Path(_TEST_ROOT) / "rag-index"),
            patch.object(appmod, "RAG_DOCUMENT_PATHS", []),
            patch.object(appmod, "_RAG_EMBED_COOLDOWN_UNTIL", 0.0, create=True),
            patch.dict(os.environ, {
                "GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": "", "RAG_DOCUMENT_DIRS": "",
                "RAG_BACKGROUND_EMBED": "0",
            }),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        appmod._reset_rag_indexes()
        self.addCleanup(appmod._reset_rag_indexes)

    def test_the_draft_manual_is_seeded_once_as_a_draft_operations_manual(self):
        with app.app_context():
            self.assertEqual(appmod.ensure_operations_manual_policy_document(), 1)
            self.assertEqual(appmod.ensure_operations_manual_policy_document(), 0)  # idempotent
            documents = PolicyDocument.query.all()
            self.assertEqual(len(documents), 1)
            document = documents[0]
            self.assertEqual(document.category, "Operations Manual")
            self.assertEqual(document.status, "draft")
            self.assertEqual(document.validation_note, "Prepared by the capstone group for Graduate School validation")
            self.assertIn("Operations Manual", document.title)
            self.assertTrue((self.upload_root / document.stored_name).is_file())

    def test_an_answer_from_the_manual_carries_the_draft_label(self):
        with app.app_context():
            appmod.ensure_operations_manual_policy_document()
        response = self.client("staff").post("/api/assistant", json={
            "question": "Who validates the Graduate School Operations Manual before it is official?",
        })
        self.assertEqual(response.status_code, 200, response.get_json())
        payload = response.get_json()
        self.assertIn(DRAFT_WARNING, payload["answer"])
        self.assertEqual(payload["citations"][0]["status"], "draft")
        self.assertIn("Operations Manual", payload["citations"][0]["title"])

    def test_nothing_is_seeded_when_there_is_no_account_to_own_it(self):
        with app.app_context():
            UserAccount.query.delete()
            db.session.commit()
            self.assertEqual(appmod.ensure_operations_manual_policy_document(), 0)
            self.assertEqual(PolicyDocument.query.count(), 0)


# =========================================================================== 7 student LOA form
class StudentLoaSemesterOptionsTests(PolishBase):
    def test_the_running_semester_is_offered_with_its_filing_check(self):
        with app.app_context():
            appmod_student = db.session.get(Student, self.student_id)
            options = appmod.leave_student_overview(appmod_student)["loa_semester_options"]
            running = [item for item in options if item["label"] == f"AY {self.ay} 1st Semester"]
            self.assertEqual(len(running), 1, options)
            self.assertEqual(running[0]["state"], "Running")
            self.assertEqual(running[0]["filing_status"], "Pass")  # 100 days left, filed in the first half

    def test_the_running_semester_is_flagged_inside_the_two_week_blackout(self):
        with app.app_context():
            term = db.session.get(AcademicTerm, self.term_id)
            term.end_date = self.today + timedelta(days=5)
            db.session.commit()
            options = appmod.leave_student_overview(db.session.get(Student, self.student_id))["loa_semester_options"]
            running = next(item for item in options if item["label"] == term.label)
            self.assertEqual(running["filing_status"], "Fail")
            self.assertIn("14 days", running["filing_detail"])


# =========================================================================== 4 removed stubs
class RemovedMonitoringStubTests(PolishBase):
    def test_the_old_read_only_monitoring_routes_are_gone(self):
        staff = self.client("staff")
        for path, payload in (
            ("/api/monitoring/subject-status", {"student_id": self.student_id, "status": "Taken"}),
            ("/api/monitoring/compre-exam", {"student_id": self.student_id, "status": "Passed"}),
            (f"/api/students/{self.student_id}/remove", {"reason": "test"}),
        ):
            response = staff.post(path, json=payload)
            self.assertIn(response.status_code, (404, 405), (path, response.status_code))  # no POST handler any more

    def test_the_portal_crud_that_replaced_them_still_works(self):
        staff = self.client("staff")
        response = staff.post(f"/api/monitoring/students/{self.student_id}/subjects", json={
            "course_id": self.course_ids[0], "status": "Enrolled",
        })
        self.assertEqual(response.status_code, 201, response.get_json())


# =========================================================================== 5 drop rule
class DropRuleEverywhereTests(PolishBase):
    # ---- Monitoring Sheet (portal entry) --------------------------------
    def _enrolled_row(self):
        response = self.client("staff").post(f"/api/monitoring/students/{self.student_id}/subjects", json={
            "course_id": self.course_ids[0], "status": "Enrolled",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["subject"]["record_id"]

    def _patch(self, record_id, **fields):
        return self.client("staff").patch(
            f"/api/monitoring/students/{self.student_id}/subjects/{record_id}", json=fields,
        )

    def test_a_manual_drop_needs_absences_above_the_register_value_or_a_documented_exception(self):
        record_id = self._enrolled_row()
        none = self._patch(record_id, status="Dropped", reason="Student stopped coming")
        self.assertEqual(none.status_code, 400, none.get_json())
        self.assertIn("20%", none.get_json()["error"])
        self.assertIn("Handbook", none.get_json()["error"])

        low = self._patch(record_id, status="Dropped", reason="x", unexcused_absence_percent=15)
        self.assertEqual(low.status_code, 400, low.get_json())
        at_limit = self._patch(record_id, status="Dropped", reason="x", unexcused_absence_percent=20)
        self.assertEqual(at_limit.status_code, 400, "exactly 20% is not 'more than 20%'")
        with app.app_context():
            self.assertEqual(db.session.get(CourseRecord, record_id).status, "Enrolled")

    def test_a_manual_drop_with_enough_absences_is_recorded_with_its_evidence(self):
        record_id = self._enrolled_row()
        ok = self._patch(record_id, status="Dropped", reason="Dropped by the professor", unexcused_absence_percent=25)
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            record = db.session.get(CourseRecord, record_id)
            self.assertEqual(record.status, "Dropped")
            self.assertEqual(record.source, "Manual entry")
            edit = MonitoringEdit.query.filter_by(student_id=self.student_id, field="status").order_by(MonitoringEdit.id.desc()).first()
            self.assertIn("25%", edit.reason)
            self.assertIn("20%", edit.reason)
            log = TransactionLog.query.filter_by(student_id=self.student_id).order_by(TransactionLog.id.desc()).first()
            self.assertIn("25%", log.notes)

    def test_a_manual_drop_can_use_a_documented_exception_with_a_reason(self):
        record_id = self._enrolled_row()
        short = self._patch(record_id, status="Dropped", reason="x", drop_exception_reason="n/a")
        self.assertEqual(short.status_code, 400, "an exception needs a real reason")
        ok = self._patch(record_id, status="Dropped", reason="Approved by Associate Dean",
                         drop_exception_reason="Subject dissolved by the college before the second week")
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            edit = MonitoringEdit.query.filter_by(student_id=self.student_id, field="status").order_by(MonitoringEdit.id.desc()).first()
            self.assertIn("exception", edit.reason.lower())
            self.assertIn("Subject dissolved", edit.reason)

    def test_adding_a_subject_row_as_dropped_needs_the_same_evidence(self):
        staff = self.client("staff")
        url = f"/api/monitoring/students/{self.student_id}/subjects"
        bad = staff.post(url, json={"course_id": self.course_ids[1], "status": "Dropped"})
        self.assertEqual(bad.status_code, 400, bad.get_json())
        ok = staff.post(url, json={"course_id": self.course_ids[1], "status": "Dropped", "unexcused_absence_percent": 30})
        self.assertEqual(ok.status_code, 201, ok.get_json())

    def test_other_status_changes_are_not_affected(self):
        record_id = self._enrolled_row()
        ok = self._patch(record_id, status="Completed", reason="Finished")
        self.assertEqual(ok.status_code, 200, ok.get_json())

    # ---- Class-list import ------------------------------------------------
    def _csv(self, rows, extra_header=""):
        header = "Academic Year,Term,Student ID,Subject Code,Faculty,Enrollment Status,Status Effective Date" + extra_header
        return ("\n".join([header] + rows) + "\n").encode("utf-8")

    def _import(self, body, preview=False):
        slug = "class-list-preview" if preview else "class-list-import"
        return self.client("academic_coordinator").post(
            f"/api/enrollment/{slug}",
            data={"term_id": str(self.term_id), "file": (BytesIO(body), "list.csv")},
            content_type="multipart/form-data",
        )

    def _row(self, code, tail=""):
        return f"{self.ay},1st Semester,GS-PLS-0001,{code},Dr. Polish Named,Dropped,{self.today.isoformat()}{tail}"

    def test_a_class_list_drop_without_evidence_is_refused_in_preview_and_import(self):
        body = self._csv([self._row("PLS-501")])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 1, preview)
        self.assertIn("20%", preview["rows"][0]["message"])
        self.assertIn("Handbook", preview["rows"][0]["message"])
        imported = self._import(body).get_json()
        self.assertEqual(imported["dropped"], 0, imported)
        self.assertEqual(imported.get("drop_evidence_count"), 1, imported)
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(status="Dropped").count(), 0)

    def test_a_class_list_drop_at_or_below_the_limit_is_refused(self):
        body = self._csv([self._row("PLS-501", ",20"), self._row("PLS-502", ",5")], ",Unexcused Absence Percent")
        imported = self._import(body).get_json()
        self.assertEqual(imported["dropped"], 0, imported)
        self.assertEqual(imported["drop_evidence_count"], 2)

    def test_a_class_list_drop_with_enough_absences_is_recorded_with_the_percentage(self):
        body = self._csv([self._row("PLS-501", ",35")], ",Unexcused Absence Percent")
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 0, preview)
        imported = self._import(body).get_json()
        self.assertEqual(imported["dropped"], 1, imported)
        with app.app_context():
            row = SubjectEnrollment.query.filter_by(status="Dropped").one()
            self.assertIn("35%", row.status_note)
            record = CourseRecord.query.filter_by(student_id=self.student_id, course_id=self.course_ids[0]).one()
            self.assertIn("35%", record.remarks)
            log = TransactionLog.query.filter_by(student_id=self.student_id).order_by(TransactionLog.id.desc()).first()
            self.assertIn("35%", log.notes)

    def test_a_class_list_drop_can_carry_a_documented_exception(self):
        body = self._csv(
            [self._row("PLS-501", ",,Subject dissolved by the college"), self._row("PLS-502", ",,no")],
            ",Unexcused Absence Percent,Drop Exception Reason",
        )
        imported = self._import(body).get_json()
        self.assertEqual(imported["dropped"], 1, imported)
        self.assertEqual(imported["drop_evidence_count"], 1, imported)
        with app.app_context():
            row = SubjectEnrollment.query.filter_by(status="Dropped").one()
            self.assertIn("exception", row.status_note.lower())
            self.assertIn("Subject dissolved", row.status_note)


# =========================================================================== 6 business rules
class BusinessRuleMetadataSyncTests(PolishBase):
    def test_stale_metadata_is_refreshed_but_a_person_s_value_and_history_stay(self):
        from business_rules_catalog import BUSINESS_RULE_CATALOG
        catalog = {entry["key"]: entry for entry in BUSINESS_RULE_CATALOG}
        with app.app_context():
            w = BusinessRule.query.filter_by(key="loa.second_half_marks_w").one()
            w.enforced = False
            w.not_enforced_reason = "old reason"
            w.title = "Old title"
            w.description = "Old description"
            w.source_page = "999"
            w.unit = "old"
            edited = BusinessRule.query.filter_by(key="withdrawal.window_days").one()
            staff = UserAccount.query.filter_by(role="staff").first()
            edited.value = "21"
            edited.updated_by_user_id = staff.id
            edited.title = "Stale title"
            edited.enforced = False
            edited.source_page = "custom page chosen by staff"
            db.session.add(BusinessRuleRevision(
                rule_id=edited.id, old_value="14", new_value="21", reason="Dean decision", changed_by_user_id=staff.id,
            ))
            db.session.commit()

            self.assertEqual(appmod.ensure_business_rules(), 0)

            w = BusinessRule.query.filter_by(key="loa.second_half_marks_w").one()
            entry = catalog["loa.second_half_marks_w"]
            self.assertEqual(w.title, entry["title"])
            self.assertEqual(w.description, entry["description"])
            self.assertEqual(w.source_page, entry["source_page"])
            self.assertEqual(w.unit, entry["unit"])
            self.assertEqual(bool(w.enforced), entry["enforced"])
            self.assertIsNone(w.not_enforced_reason)

            edited = BusinessRule.query.filter_by(key="withdrawal.window_days").one()
            self.assertEqual(edited.value, "21", "a person's value is never touched")
            self.assertEqual(edited.updated_by_user_id, staff.id)
            self.assertEqual(edited.title, catalog["withdrawal.window_days"]["title"])
            self.assertTrue(edited.enforced)
            self.assertEqual(edited.source_page, "custom page chosen by staff", "a person-edited source stays")
            self.assertEqual(BusinessRuleRevision.query.filter_by(rule_id=edited.id).count(), 1)

    def test_the_form_7_thresholds_are_listed_as_enforced(self):
        with app.app_context():
            for key in ("defense.thesis_major_revision_score", "defense.dissertation_major_revision_score"):
                rule = BusinessRule.query.filter_by(key=key).one()
                self.assertTrue(rule.enforced, key)
                self.assertFalse(rule.not_enforced_reason, key)

    def test_the_verdict_form_reads_its_thresholds_from_the_register(self):
        with app.app_context():
            self.assertEqual(appmod.final_defense_passing_score("Thesis"), 85)
            self.assertEqual(appmod.final_defense_passing_score("Dissertation"), 90)
            rule = BusinessRule.query.filter_by(key="defense.thesis_major_revision_score").one()
            rule.value = "80"
            db.session.commit()
            appmod.clear_business_rule_cache()
            self.assertEqual(appmod.final_defense_passing_score("Thesis"), 80)
            self.assertEqual(appmod.final_defense_passing_score("Dissertation"), 90)


if __name__ == "__main__":
    unittest.main()
