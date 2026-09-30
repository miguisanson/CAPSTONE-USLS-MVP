"""Business-rules register: the workflows read their rules from one table that
cites the policy document each rule comes from (defense panel item S2/N1)."""

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

from app import (  # noqa: E402
    AcademicTerm,
    BusinessRule,
    BusinessRuleRevision,
    Course,
    CourseRecord,
    PolicyDocument,
    Program,
    Student,
    SubjectEnrollment,
    TransactionLog,
    UserAccount,
    WithdrawalApplication,
    app,
    comprehensive_exam_eligibility,
    db,
    defense_lead_days,
    ensure_business_rules,
    faculty_teaching_load_limit,
    generate_password_hash,
    loa_policy_review,
    panel_roles_for_student,
    require_research_prerequisite,
    practicum_eligibility_config,
    residence_limits,
    rule_citation,
    rule_value,
    rules_for_process,
    subject_withdrawal_window,
    withdrawal_application_dict,
)
from business_rules_catalog import BUSINESS_RULE_CATALOG, BUSINESS_RULE_PROCESSES  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parent.parent
HANDBOOK_P49 = "Graduate School Handbook 2022-2023, p. 49"
HANDBOOK_P52 = "Graduate School Handbook 2022-2023, p. 52"


class BusinessRulesTests(unittest.TestCase):
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
        self.created_files = []
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="BRU", name="Business Rules Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            courses = [
                Course(program_id=program.id, code=f"BRU-50{i}", title=f"Rule Course {i}", units=3, category="Major")
                for i in range(1, 8)
            ]
            db.session.add_all(courses)
            db.session.flush()
            self.course_ids = [course.id for course in courses]
            student = Student(
                student_number="GS-BRU-1",
                first_name="Rule",
                last_name="Student",
                email="rule-student@example.test",
                program_id=program.id,
                entry_year=date.today().year - 1,
                academic_year_entry="25-26",
                year_level="1",
                current_stage="Coursework",
                standing="Active",
            )
            db.session.add(student)
            db.session.flush()
            self.student_id = student.id
            self.staff_id = self._account("staff", "br-staff@example.test").id
            self.admin_id = self._account("admin", "br-admin@example.test").id
            self.dean_id = self._account("dean", "br-dean@example.test").id
            self.academic_id = self._account("academic_coordinator", "br-ac@example.test").id
            student_account = self._account("student", "br-student@example.test")
            student_account.student_id = student.id
            self.student_account_id = student_account.id
            db.session.commit()

    def tearDown(self):
        for path in self.created_files:
            path.unlink(missing_ok=True)

    # ---- fixtures ---------------------------------------------------------
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

    def _term(self, label, started_days_ago, length_days=120):
        start = date.today() - timedelta(days=started_days_ago)
        term = AcademicTerm(label=label, start_date=start, end_date=start + timedelta(days=length_days))
        db.session.add(term)
        db.session.flush()
        return term

    def _enroll(self, term, course_id=None, student_id=None, status="Enrolled"):
        item = SubjectEnrollment(
            student_id=student_id or self.student_id,
            course_id=course_id or self.course_ids[0],
            term_id=term.id,
            status=status,
            source_reference="Business rules fixture",
        )
        db.session.add(item)
        db.session.flush()
        return item

    def _seed(self):
        with app.app_context():
            ensure_business_rules()

    def _rule_id(self, key):
        with app.app_context():
            return BusinessRule.query.filter_by(key=key).one().id

    def _set_rule(self, key, value, reason="Test change"):
        response = self._client(self.staff_id, "staff").patch(
            f"/api/business-rules/{self._rule_id(key)}",
            json={"value": value, "reason": reason},
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        return response

    # ---- the register -----------------------------------------------------
    def test_seed_is_idempotent_and_never_overwrites_an_edited_value(self):
        with app.app_context():
            created = ensure_business_rules()
            self.assertEqual(created, len(BUSINESS_RULE_CATALOG))
            self.assertEqual(BusinessRule.query.count(), len(BUSINESS_RULE_CATALOG))
            self.assertEqual(ensure_business_rules(), 0)

            rule = BusinessRule.query.filter_by(key="withdrawal.window_days").one()
            rule.value = "21"
            db.session.commit()
            missing = BusinessRule.query.filter_by(key="loa.max_period_semesters").one()
            db.session.delete(missing)
            db.session.commit()

            self.assertEqual(ensure_business_rules(), 1)
            self.assertEqual(rule_value("withdrawal.window_days"), 21)
            self.assertEqual(BusinessRule.query.count(), len(BUSINESS_RULE_CATALOG))

    def test_every_rule_names_its_source_and_explains_when_it_is_not_enforced(self):
        self._seed()
        valid_processes = {key for key, _label in BUSINESS_RULE_PROCESSES}
        with app.app_context():
            for rule in BusinessRule.query.all():
                self.assertIn(rule.process, valid_processes, rule.key)
                self.assertIn(rule.value_type, {"int", "decimal", "text", "bool"}, rule.key)
                self.assertTrue(rule.title and rule.description, rule.key)
                self.assertTrue(rule.source_title, rule.key)
                if rule.source_title.startswith("Prototype rule"):
                    self.assertEqual(rule.status, "needs_review", rule.key)
                    self.assertIn("pending Graduate School validation", rule.source_title)
                else:
                    self.assertEqual(rule.status, "active", rule.key)
                    if rule.source_title.startswith("Graduate School Handbook"):
                        self.assertTrue(rule.source_page, f"{rule.key} needs a handbook page")
                if not rule.enforced:
                    self.assertTrue(rule.not_enforced_reason, rule.key)
            processes_in_use = {rule.process for rule in BusinessRule.query.all()}
            self.assertEqual(processes_in_use, valid_processes)

    def test_handbook_values_are_registered_with_their_pages(self):
        self._seed()
        expected = {
            "withdrawal.window_days": (14, "49"),
            "withdrawal.first_week_days": (7, "50-51"),
            "withdrawal.fee_percent_first_week": (10, "49, 51"),
            "withdrawal.fee_percent_second_week": (20, "49, 51"),
            "course_adjustment.add_subject_window_days": (7, "49"),
            "course_adjustment.change_subject_window_days": (7, "48-49"),
            "dropping.absence_limit_percent": (20, "52"),
            "loa.max_period_semesters": (2, "52"),
            "loa.max_total_semesters": (4, "52"),
            "loa.no_filing_days_before_term_end": (14, "53"),
            "residency.master_normal_years": (5, "54"),
            "residency.master_absolute_years": (7, "55"),
            "residency.doctorate_normal_years": (7, "55"),
            "residency.doctorate_absolute_years": (9, "55"),
            "residency.refresher_units": (6, "54-55"),
            "enrollment.part_time_min_units": (6, "48"),
            "enrollment.part_time_max_units": (9, "48"),
            "enrollment.full_time_units": (12, "48"),
            "defense.panel_size_thesis": (4, "60"),
            "defense.panel_size_dissertation": (5, "60"),
        }
        with app.app_context():
            for key, (value, page) in expected.items():
                rule = BusinessRule.query.filter_by(key=key).one()
                self.assertEqual(rule_value(key), value, key)
                self.assertEqual(rule.source_page, page, key)
                self.assertTrue(rule.source_title.startswith("Graduate School Handbook"), key)
            self.assertTrue(rule_value("residency.includes_loa"))
            self.assertEqual(rule_citation("withdrawal.window_days"), HANDBOOK_P49)
            self.assertIn("pp. 54-55", rule_citation("residency.refresher_units"))
            # Retention, INC and DRP grades are documented but deliberately not enforced.
            for key in ("dropping.retention_master_average", "dropping.retention_doctorate_average",
                        "enrollment.inc_completion_years", "dropping.drp_grade"):
                rule = BusinessRule.query.filter_by(key=key).one()
                self.assertFalse(rule.enforced, key)
                self.assertIn("outside the system's scope", rule.not_enforced_reason)
            # Unsourced prototype values are kept but flagged for validation.
            for key in ("faculty.teaching_load_limit_units", "practicum.required_hours"):
                rule = BusinessRule.query.filter_by(key=key).one()
                self.assertEqual(rule.status, "needs_review")
                self.assertIn("Prototype rule", rule.source_title)

    def test_rule_value_falls_back_to_the_catalog_when_the_register_is_empty(self):
        # Tests (and a freshly reset database) can have no rows yet.
        with app.app_context():
            self.assertEqual(BusinessRule.query.count(), 0)
            self.assertEqual(rule_value("withdrawal.window_days"), 14)
            self.assertEqual(rule_value("no.such.rule", 99), 99)
            self.assertEqual(rule_value("residency.includes_loa"), True)
            self.assertEqual(rule_value("dropping.retention_doctorate_average"), 1.75)

    # ---- API --------------------------------------------------------------
    def test_any_signed_in_user_can_read_rules_by_process(self):
        anonymous = app.test_client().get("/api/business-rules")
        self.assertEqual(anonymous.status_code, 401)
        response = self._client(self.student_account_id, "student").get("/api/business-rules?process=withdrawal")
        self.assertEqual(response.status_code, 200, response.get_json())
        items = response.get_json()["items"]
        self.assertTrue(items)
        self.assertTrue(all(item["process"] == "withdrawal" for item in items))
        window = next(item for item in items if item["key"] == "withdrawal.window_days")
        self.assertEqual(window["value"], 14)
        self.assertEqual(window["citation"], HANDBOOK_P49)
        self.assertTrue(window["enforced"])
        everything = self._client(self.dean_id, "dean").get("/api/business-rules")
        self.assertEqual(len(everything.get_json()["items"]), len(BUSINESS_RULE_CATALOG))
        self.assertEqual(
            [item["key"] for item in everything.get_json()["processes"]],
            [key for key, _label in BUSINESS_RULE_PROCESSES],
        )
        with app.app_context():
            self.assertEqual(len(rules_for_process("withdrawal")), len(items))

    def test_only_staff_and_admin_can_change_a_rule_and_must_give_a_reason(self):
        self._seed()
        rule_id = self._rule_id("withdrawal.window_days")
        url = f"/api/business-rules/{rule_id}"
        for account_id, role in (
            (self.dean_id, "dean"),
            (self.academic_id, "academic_coordinator"),
            (self.student_account_id, "student"),
        ):
            denied = self._client(account_id, role).patch(url, json={"value": 10, "reason": "Trying"})
            self.assertEqual(denied.status_code, 403, role)
        staff = self._client(self.staff_id, "staff")
        self.assertEqual(staff.patch(url, json={"value": 10}).status_code, 400)
        self.assertEqual(staff.patch(url, json={"value": 10, "reason": " "}).status_code, 400)
        self.assertEqual(staff.patch(url, json={"value": "abc", "reason": "Not a number"}).status_code, 400)
        self.assertEqual(staff.patch(url, json={"value": -3, "reason": "Negative"}).status_code, 400)
        self.assertEqual(staff.patch(url, json={"value": 14, "reason": "Same value"}).status_code, 400)
        with app.app_context():
            self.assertEqual(rule_value("withdrawal.window_days"), 14)
            self.assertEqual(BusinessRuleRevision.query.count(), 0)

    def test_changing_a_rule_writes_revision_activity_log_and_clears_needs_review(self):
        self._seed()
        rule_id = self._rule_id("faculty.teaching_load_limit_units")
        with app.app_context():
            self.assertEqual(db.session.get(BusinessRule, rule_id).status, "needs_review")
        response = self._client(self.admin_id, "admin").patch(
            f"/api/business-rules/{rule_id}",
            json={"value": 18, "reason": "Dean confirmed the load cap in the June memo."},
        )
        self.assertEqual(response.status_code, 200, response.get_json())
        item = response.get_json()["item"]
        self.assertEqual(item["value"], 18)
        self.assertEqual(item["status"], "active")
        self.assertEqual(item["history"][0]["old_value"], "24")
        self.assertEqual(item["history"][0]["new_value"], "18")
        with app.app_context():
            rule = db.session.get(BusinessRule, rule_id)
            self.assertEqual(rule.status, "active")
            self.assertEqual(rule.updated_by_user_id, self.admin_id)
            revision = BusinessRuleRevision.query.filter_by(rule_id=rule_id).one()
            self.assertEqual((revision.old_value, revision.new_value), ("24", "18"))
            self.assertIn("June memo", revision.reason)
            self.assertEqual(revision.changed_by_user_id, self.admin_id)
            log = TransactionLog.query.filter_by(transaction_slug="business-rules").one()
            self.assertIn("faculty.teaching_load_limit_units", log.notes)
            self.assertIn("24", log.notes)
            self.assertIn("18", log.notes)
            self.assertEqual(faculty_teaching_load_limit(), 18)
        # The audit entry shows in the activity feed staff already use.
        feed = self._client(self.staff_id, "staff").get("/api/activity").get_json()["items"]
        self.assertTrue(any(row["transaction_slug"] == "business-rules" for row in feed))

    def test_replacing_or_deleting_a_policy_document_flags_its_rules_for_review(self):
        self._seed()
        staff = self._client(self.staff_id, "staff")
        with patch("app._inspect_policy_document", return_value=(4, 7, "application/pdf")):
            created = staff.post(
                "/api/policy-documents",
                data={"title": "Handbook copy", "file": (BytesIO(b"%PDF-1.7 handbook"), "handbook-copy.pdf")},
                content_type="multipart/form-data",
            )
        self.assertEqual(created.status_code, 201, created.get_json())
        document_id = created.get_json()["item"]["id"]
        with app.app_context():
            self.created_files.append(
                Path(app.root_path) / "uploads" / "policy_documents" / db.session.get(PolicyDocument, document_id).stored_name
            )
            for key in ("withdrawal.window_days", "loa.max_period_semesters"):
                rule = BusinessRule.query.filter_by(key=key).one()
                rule.policy_document_id = document_id
            db.session.commit()
            self.assertEqual(BusinessRule.query.filter_by(status="active", policy_document_id=document_id).count(), 2)

        with patch("app._inspect_policy_document", return_value=(6, 10, "application/pdf")):
            replaced = staff.put(
                f"/api/policy-documents/{document_id}/file",
                data={"file": (BytesIO(b"%PDF-1.7 replacement"), "handbook-copy-v2.pdf")},
                content_type="multipart/form-data",
            )
        self.assertEqual(replaced.status_code, 200, replaced.get_json())
        with app.app_context():
            self.created_files.append(
                Path(app.root_path) / "uploads" / "policy_documents" / db.session.get(PolicyDocument, document_id).stored_name
            )
            flagged = BusinessRule.query.filter_by(policy_document_id=document_id).all()
            self.assertEqual({rule.key for rule in flagged}, {"withdrawal.window_days", "loa.max_period_semesters"})
            self.assertTrue(all(rule.status == "needs_review" for rule in flagged))
            # Someone confirms one rule again; it goes back to active.
            self.assertEqual(BusinessRule.query.filter_by(key="other.untouched").count(), 0)
            untouched = BusinessRule.query.filter(BusinessRule.policy_document_id.is_(None)).first()
            self.assertEqual(untouched.status, "active" if not untouched.source_title.startswith("Prototype") else "needs_review")

        removed = staff.delete(f"/api/policy-documents/{document_id}")
        self.assertEqual(removed.status_code, 200, removed.get_json())
        with app.app_context():
            rule = BusinessRule.query.filter_by(key="withdrawal.window_days").one()
            self.assertIsNone(rule.policy_document_id)
            self.assertEqual(rule.status, "needs_review")

    # ---- withdrawal -------------------------------------------------------
    def _student_withdrawal(self, started_days_ago):
        with app.app_context():
            term = self._term(f"Withdrawal Term {started_days_ago}", started_days_ago)
            enrollment = self._enroll(term)
            db.session.commit()
            enrollment_id = enrollment.id
        response = self._client(self.student_account_id, "student").post(
            "/api/student-portal/requests/withdrawal",
            json={"subject_enrollment_id": enrollment_id, "reason": "Schedule conflict with work"},
        )
        return response, enrollment_id

    def test_withdrawal_is_allowed_until_the_second_week_with_the_fee_shown(self):
        self._seed()
        response, enrollment_id = self._student_withdrawal(started_days_ago=10)
        self.assertEqual(response.status_code, 200, response.get_json())
        message = response.get_json()["message"]
        self.assertNotIn("penalty-free", message.lower())
        with app.app_context():
            application = WithdrawalApplication.query.filter_by(student_id=self.student_id).one()
            window = withdrawal_application_dict(application)["withdrawal_window"]
            self.assertTrue(window["eligible"])
            self.assertEqual(window["fee_tier"], "Second week")
            self.assertEqual(window["fee_percent"], 20)
            self.assertEqual(window["rule_source"], HANDBOOK_P49)
            self.assertIn("20%", window["fee_consequence"])
            self.assertIn("information", window["fee_consequence"].lower())
            self.assertNotIn("penalty-free", window["policy"].lower())
            self.assertNotIn("seven", window["policy"].lower())

    def test_first_week_withdrawal_shows_the_ten_percent_tier(self):
        self._seed()
        with app.app_context():
            term = self._term("Week One Term", 3)
            enrollment = self._enroll(term)
            db.session.commit()
            window = subject_withdrawal_window(enrollment)
            self.assertTrue(window["eligible"])
            self.assertEqual((window["fee_tier"], window["fee_percent"]), ("First week", 10))
            self.assertEqual(window["deadline"], (term.start_date + timedelta(days=13)).isoformat())
            last_day = subject_withdrawal_window(enrollment, term.start_date + timedelta(days=13))
            self.assertTrue(last_day["eligible"])
            first_late_day = subject_withdrawal_window(enrollment, term.start_date + timedelta(days=14))
            self.assertFalse(first_late_day["eligible"])
            self.assertEqual(first_late_day["fee_percent"], 100)
            self.assertEqual(first_late_day["fee_tier"], "After the second week")

    def test_late_withdrawal_names_the_rule_and_changing_the_register_changes_the_outcome(self):
        self._seed()
        response, enrollment_id = self._student_withdrawal(started_days_ago=15)
        self.assertEqual(response.status_code, 409, response.get_json())
        error = response.get_json()["error"]
        self.assertIn(HANDBOOK_P49, error)
        self.assertIn("second week", error)
        self.assertIn("Leave of Absence", error)
        self.assertNotIn("penalty-free", error.lower())
        self.assertNotIn("seven", error.lower())

        self._set_rule("withdrawal.window_days", 21, "Test: registrar extended the window")
        retry = self._client(self.student_account_id, "student").post(
            "/api/student-portal/requests/withdrawal",
            json={"subject_enrollment_id": enrollment_id, "reason": "Schedule conflict with work"},
        )
        self.assertEqual(retry.status_code, 200, retry.get_json())

    def test_no_penalty_free_or_seven_day_wording_is_left_in_the_product(self):
        offenders = []
        for relative in ("app.py", "scripts/rebuild_demo_walkthrough.py"):
            paths = [REPO_ROOT / relative]
            for path in paths:
                text = path.read_text(encoding="utf-8", errors="ignore").lower()
                for needle in ("penalty-free", "penalty free", "seven calendar days", "first seven"):
                    if needle in text:
                        offenders.append(f"{relative}: {needle}")
        for path in (REPO_ROOT / "frontend" / "src").rglob("*.jsx"):
            text = path.read_text(encoding="utf-8", errors="ignore").lower()
            for needle in ("penalty-free", "penalty free", "seven calendar days", "no grade / no penalty", "no grade, academic penalty"):
                if needle in text:
                    offenders.append(f"{path.relative_to(REPO_ROOT)}: {needle}")
        self.assertEqual(offenders, [])

    # ---- dropping ---------------------------------------------------------
    def _drop(self, **overrides):
        self._drop_count = getattr(self, "_drop_count", 0) + 1
        with app.app_context():
            term = self._term(f"Drop Term {self._drop_count}", 40)
            enrollment = self._enroll(term)
            db.session.add(CourseRecord(
                student_id=self.student_id, course_id=self.course_ids[0], status="Enrolled",
                term_label=term.label, grade_status="No Grade",
            ))
            db.session.commit()
            enrollment_id = enrollment.id
        payload = {
            "subject_enrollment_id": enrollment_id,
            "status": "Dropped",
            "effective_date": date.today().isoformat(),
            "note": "Professor reported the absences.",
            **overrides,
        }
        return self._client(self.academic_id, "academic_coordinator").patch("/api/enrollment/subject-status", json=payload)

    def test_a_drop_needs_unexcused_absences_above_the_limit_and_names_the_rule(self):
        self._seed()
        missing = self._drop()
        self.assertEqual(missing.status_code, 400, missing.get_json())
        self.assertIn("unexcused", missing.get_json()["error"].lower())
        self.assertIn(HANDBOOK_P52, missing.get_json()["error"])

        low = self._drop(unexcused_absence_percent=15)
        self.assertEqual(low.status_code, 409, low.get_json())
        self.assertIn("20%", low.get_json()["error"])
        self.assertIn(HANDBOOK_P52, low.get_json()["error"])
        self.assertIn("Withdrawal", low.get_json()["error"])
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(status="Dropped").count(), 0)

        # Exactly at the limit is still allowed absences: the rule says "more than 20%".
        at_limit = self._drop(unexcused_absence_percent=20)
        self.assertEqual(at_limit.status_code, 409, at_limit.get_json())

    def test_a_drop_above_the_limit_is_recorded_with_the_absence_percentage(self):
        self._seed()
        response = self._drop(unexcused_absence_percent=25)
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            enrollment = SubjectEnrollment.query.filter_by(status="Dropped").one()
            self.assertEqual(enrollment.status_note, "Professor reported the absences.")
            log = TransactionLog.query.filter(
                TransactionLog.transaction_slug == "enrollment",
                TransactionLog.result.like("%changed from Enrolled to Dropped"),
            ).one()
            self.assertIn("25%", log.notes)
            self.assertIn("20% limit", log.notes)
            self.assertIn(HANDBOOK_P52, log.notes)

    def test_changing_the_absence_limit_in_the_register_changes_what_a_drop_allows(self):
        self._seed()
        self._set_rule("dropping.absence_limit_percent", 10, "Test: stricter limit")
        response = self._drop(unexcused_absence_percent=15)
        self.assertEqual(response.status_code, 200, response.get_json())

    # ---- adding / changing a subject and load -------------------------------
    def _add_subject_preview(self, started_days_ago, extra_courses=1, existing=1):
        with app.app_context():
            term = self._term(f"Adjustment Term {started_days_ago}", started_days_ago)
            for index in range(existing):
                self._enroll(term, course_id=self.course_ids[index])
            db.session.commit()
            term_id = term.id
        requested = self.course_ids[: existing + extra_courses]
        client = self._client(self.academic_id, "academic_coordinator")
        response = client.post(
            "/api/enrollment/preview",
            json={"student_id": self.student_id, "term_id": term_id, "course_ids": requested},
        )
        return client, term_id, requested, response

    def test_adding_a_subject_after_the_first_week_is_flagged_with_the_rule(self):
        self._seed()
        client, term_id, requested, response = self._add_subject_preview(started_days_ago=20)
        self.assertEqual(response.status_code, 200, response.get_json())
        conflicts = [item for item in response.get_json()["conflicts"] if item["kind"] == "add_window_closed"]
        self.assertEqual(len(conflicts), 1)
        self.assertIn(HANDBOOK_P49, conflicts[0]["message"])
        self.assertIn("first week", conflicts[0]["message"])
        self.assertEqual(conflicts[0]["severity"], "warning")
        values = {option["value"] for option in conflicts[0]["options"]}
        self.assertEqual(values, {"exclude", "enroll_override"})

        # Saving without resolving the flag is refused ...
        save = client.post("/api/enrollment", json={
            "student_id": self.student_id, "term_id": term_id, "course_ids": requested, "confirmed": True,
        })
        self.assertEqual(save.status_code, 409, save.get_json())
        # ... and saving with a documented exception records it on the enrollment.
        every_conflict = {item["id"]: "enroll_override" for item in response.get_json()["conflicts"]}
        save = client.post("/api/enrollment", json={
            "student_id": self.student_id, "term_id": term_id, "course_ids": requested, "confirmed": True,
            "resolutions": every_conflict,
        })
        self.assertEqual(save.status_code, 200, save.get_json())
        with app.app_context():
            added = SubjectEnrollment.query.filter_by(term_id=term_id, course_id=requested[-1]).one()
            self.assertIn("Adding a subject after the first week", added.conflict_override or "")

    def test_adding_a_subject_in_the_first_week_or_a_first_registration_is_not_flagged(self):
        self._seed()
        _client, _term_id, _requested, response = self._add_subject_preview(started_days_ago=5)
        self.assertFalse([c for c in response.get_json()["conflicts"] if c["kind"] == "add_window_closed"])
        # A first registration (no subjects yet this term) is not an "addition".
        _client, _term_id, _requested, response = self._add_subject_preview(started_days_ago=40, existing=0)
        self.assertFalse([c for c in response.get_json()["conflicts"] if c["kind"] == "add_window_closed"])

    def test_changing_the_add_window_in_the_register_changes_the_preview(self):
        self._seed()
        self._set_rule("course_adjustment.add_subject_window_days", 30, "Test: longer add period")
        _client, _term_id, _requested, response = self._add_subject_preview(started_days_ago=20)
        self.assertFalse([c for c in response.get_json()["conflicts"] if c["kind"] == "add_window_closed"])

    def test_a_change_of_subject_uses_the_change_window_rule(self):
        self._seed()
        with app.app_context():
            term = self._term("Change Term", 12)
            self._enroll(term, course_id=self.course_ids[0])
            db.session.commit()
            term_id = term.id
        client = self._client(self.academic_id, "academic_coordinator")
        response = client.post("/api/enrollment/preview", json={
            "student_id": self.student_id, "term_id": term_id, "course_ids": [self.course_ids[1]],
        })
        conflicts = [item for item in response.get_json()["conflicts"] if item["kind"] == "change_window_closed"]
        self.assertEqual(len(conflicts), 1, response.get_json())
        self.assertIn("Graduate School Handbook 2022-2023, pp. 48-49", conflicts[0]["message"])

    def test_more_than_a_full_time_load_is_flagged_and_the_limit_comes_from_the_register(self):
        self._seed()
        # Five 3-unit subjects = 15 units, above the 12-unit full-time load.
        _client, _term_id, _requested, response = self._add_subject_preview(started_days_ago=-5, extra_courses=4, existing=1)
        payload = response.get_json()
        load = [item for item in payload["conflicts"] if item["kind"] == "over_load"]
        self.assertEqual(len(load), 1, payload)
        self.assertIn("15 units", load[0]["message"])
        self.assertIn("Graduate School Handbook 2022-2023, p. 48", load[0]["message"])
        self.assertEqual(payload["load"]["units"], 15)
        self.assertEqual(payload["load"]["full_time_units"], 12)

        self._set_rule("enrollment.full_time_units", 15, "Test: raised load")
        _client, _term_id, _requested, response = self._add_subject_preview(started_days_ago=-6, extra_courses=4, existing=1)
        self.assertFalse([c for c in response.get_json()["conflicts"] if c["kind"] == "over_load"])

    def test_a_student_cannot_add_a_subject_after_the_first_week_on_their_own(self):
        self._seed()
        from app import CurriculumOffering
        with app.app_context():
            term = self._term("AY 2026-2027 1st Semester", 20)
            self._enroll(term, course_id=self.course_ids[0])
            for course_id in self.course_ids[:2]:
                db.session.add(CurriculumOffering(
                    program_id=self.program_id, academic_year="2026-2027",
                    semester="1st Semester", course_id=course_id,
                ))
            db.session.commit()
            term_id = term.id
        client = self._client(self.student_account_id, "student")
        blocked = client.post("/api/student-portal/enrollment", json={
            "term_id": term_id, "course_ids": self.course_ids[:2],
        })
        self.assertEqual(blocked.status_code, 409, blocked.get_json())
        self.assertIn(HANDBOOK_P49, blocked.get_json()["error"])
        self._set_rule("course_adjustment.add_subject_window_days", 30, "Test: longer add period")
        allowed = client.post("/api/student-portal/enrollment", json={
            "term_id": term_id, "course_ids": self.course_ids[:2],
        })
        self.assertEqual(allowed.status_code, 200, allowed.get_json())

    def test_the_student_loa_request_enforces_period_total_and_filing_date(self):
        self._seed()
        terms = self._loa_terms()
        client = self._client(self.student_account_id, "student")
        body = {"reason_category": "Medical / health", "reason_remarks": "Surgery and recovery"}
        too_long = client.post("/api/student-portal/requests/leave-of-absence", json={
            **body, "effective_start": terms[0], "effective_end": terms[2],
        })
        self.assertEqual(too_long.status_code, 400, too_long.get_json())
        self.assertIn("Graduate School Handbook 2022-2023, p. 52", too_long.get_json()["error"])
        ok = client.post("/api/student-portal/requests/leave-of-absence", json={
            **body, "effective_start": terms[0], "effective_end": terms[1],
        })
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            running = self._term("Nearly Over Term", 100, length_days=110)
            db.session.commit()
            running_label = running.label
        late = self._client(self.student_account_id, "student").post("/api/student-portal/requests/leave-of-absence", json={
            **body, "effective_start": running_label, "effective_end": running_label,
        })
        self.assertIn(late.status_code, {400, 409}, late.get_json())
        self.assertTrue(
            "Graduate School Handbook 2022-2023, p. 53" in late.get_json()["error"]
            or "already in progress" in late.get_json()["error"]
        )

    # ---- leave of absence ---------------------------------------------------
    def _loa_terms(self):
        labels = []
        with app.app_context():
            base = date.today() + timedelta(days=30)
            for index in range(6):
                label = f"AY LOA Term {index + 1}"
                start = base + timedelta(days=index * 150)
                db.session.add(AcademicTerm(label=label, start_date=start, end_date=start + timedelta(days=120)))
                labels.append(label)
            db.session.commit()
        return labels

    def _loa_check(self, checks, label):
        return next(item for item in checks if item["label"] == label)

    def test_loa_period_and_total_come_from_the_register_and_agree_with_the_text(self):
        self._seed()
        terms = self._loa_terms()
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            base = {"reason_category": "Medical / health", "reason_remarks": "Surgery and recovery",
                    "application_reference": "Portal form"}
            two = loa_policy_review(student, {**base, "effective_start": terms[0], "effective_end": terms[1]})
            period = self._loa_check(two["checks"], "Effective period")
            self.assertEqual(period["status"], "Pass")
            self.assertIn("Graduate School Handbook 2022-2023, p. 52", period["detail"])
            three = loa_policy_review(student, {**base, "effective_start": terms[0], "effective_end": terms[2]})
            self.assertEqual(self._loa_check(three["checks"], "Effective period")["status"], "Fail")
            self.assertEqual(three["recommendation"], "Not Eligible")
            # The old "fewer than 4 prior LOAs" count check is gone.
            self.assertFalse([c for c in two["checks"] if c["label"] == "Prior approved leaves"])
            citation_text = " ".join(item["text"] for item in two["citations"]).lower()
            self.assertNotIn("clock is paused", citation_text)
            self.assertIn("not paused", citation_text)
            self.assertNotIn("4 semesters", citation_text)
            self.assertIn("one year", citation_text)
        self._set_rule("loa.max_period_semesters", 3, "Test: three-semester leave")
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            three = loa_policy_review(student, {**base, "effective_start": terms[0], "effective_end": terms[2]})
            self.assertEqual(self._loa_check(three["checks"], "Effective period")["status"], "Pass")

    def test_loa_renewal_cannot_pass_two_years_in_total(self):
        self._seed()
        terms = self._loa_terms()
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            from app import add_log
            add_log(
                "leave-of-absence", student.id, "Dean", "Test", "LOA approved by Dean", "Student",
                f"Requested semester period: {terms[0]} to {terms[1]}.",
            )
            add_log(
                "leave-of-absence", student.id, "Dean", "Test", "LOA approved by Dean", "Student",
                f"Requested semester period: {terms[2]} to {terms[3]}.",
            )
            db.session.commit()
            request = {"reason_category": "Medical / health", "reason_remarks": "Renewal",
                       "application_reference": "Portal form", "effective_start": terms[4], "effective_end": terms[4]}
            review = loa_policy_review(student, request)
            total = self._loa_check(review["checks"], "Total leave")
            self.assertEqual(total["status"], "Fail")
            self.assertIn("4 semesters", total["detail"])
            self.assertIn("Graduate School Handbook 2022-2023, p. 52", total["detail"])

    def test_loa_is_refused_within_two_weeks_before_the_last_day_of_classes(self):
        self._seed()
        with app.app_context():
            running = self._term("Running Term", 100, length_days=110)  # 10 days left
            next_term = self._term("Next Term", -20)
            student = db.session.get(Student, self.student_id)
            db.session.commit()
            review = loa_policy_review(student, {
                "reason_category": "Medical / health", "reason_remarks": "Illness",
                "application_reference": "Portal form",
                "effective_start": running.label, "effective_end": running.label,
            })
            blackout = self._loa_check(review["checks"], "Filing date")
            self.assertEqual(blackout["status"], "Fail")
            self.assertIn("Graduate School Handbook 2022-2023, p. 53", blackout["detail"])
            allowed = loa_policy_review(student, {
                "reason_category": "Medical / health", "reason_remarks": "Illness",
                "application_reference": "Portal form",
                "effective_start": next_term.label, "effective_end": next_term.label,
            })
            self.assertEqual(self._loa_check(allowed["checks"], "Filing date")["status"], "Pass")

    def test_loa_filed_in_the_second_half_of_a_semester_warns_that_courses_become_w(self):
        self._seed()
        with app.app_context():
            running = self._term("Second Half Term", 80, length_days=120)  # 40 days left, second half
            student = db.session.get(Student, self.student_id)
            db.session.commit()
            review = loa_policy_review(student, {
                "reason_category": "Medical / health", "reason_remarks": "Illness",
                "application_reference": "Portal form",
                "effective_start": running.label, "effective_end": running.label,
            })
            check = self._loa_check(review["checks"], "Filing date")
            self.assertEqual(check["status"], "Pass")
            self.assertIn("marked W", check["detail"])
            self.assertIn("no refund", check["detail"].lower())

    # ---- residency --------------------------------------------------------
    def test_maximum_residence_reads_the_register_and_never_pauses_for_leave(self):
        self._seed()
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            limits = residence_limits(student)
            self.assertEqual((limits["normal_years"], limits["absolute_years"]), (5, 7))
            self.assertTrue(limits["includes_loa"])
            self.assertEqual(limits["citation"], "Graduate School Handbook 2022-2023, p. 55")
            # Residency years are counted in academic years (entry academic year = year 1) by the
            # one shared function years_in_program; the exact number depends on the calendar, so
            # the test pins the rule: being on leave never changes it.
            before_leave = residence_limits(student)["years_in_program"]
            self.assertGreaterEqual(before_leave, 1)
            student.enrollment_tag = "LOA"
            student.standing = "On Leave"
            db.session.commit()
            self.assertEqual(residence_limits(student)["years_in_program"], before_leave)  # clock keeps running on leave
        self._set_rule("residency.master_normal_years", 6, "Test: extended normal residence")
        self._set_rule("residency.master_absolute_years", 8, "Test: extended absolute residence")
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            limits = residence_limits(student)
            self.assertEqual((limits["normal_years"], limits["absolute_years"]), (6, 8))
            program = db.session.get(Program, self.program_id)
            program.name = "Doctor of Philosophy in Rules"
            db.session.commit()
            limits = residence_limits(db.session.get(Student, self.student_id))
            self.assertEqual((limits["normal_years"], limits["absolute_years"]), (7, 9))

    def test_policy_snippets_no_longer_contradict_the_handbook(self):
        from app import POLICY_SNIPPETS
        loa = next(item for item in POLICY_SNIPPETS if item["id"] == "loa-residency")
        text = loa["text"].lower()
        self.assertNotIn("clock is paused", text)
        self.assertIn("not paused", text)
        self.assertNotIn("4 semesters", text)
        self.assertIn("one year", text)
        self.assertIn("another year", text)
        self.assertIn("includes time on leave", text)
        withdrawal = next(item for item in POLICY_SNIPPETS if item["id"] == "withdrawal")
        self.assertNotIn("monitoring stops", withdrawal["text"].lower())
        self.assertIn("second week", withdrawal["text"].lower())

    # ---- research, defense, practicum, faculty --------------------------------
    def test_defense_lead_days_and_panel_sizes_come_from_the_register(self):
        self._seed()
        with app.app_context():
            self.assertEqual(defense_lead_days("Title Defense"), 14)
            self.assertEqual(defense_lead_days("Proposal Defense"), 14)
            self.assertEqual(defense_lead_days("Final Defense"), 14)
            self.assertEqual(defense_lead_days("Public Final Defense"), 5)
            student = db.session.get(Student, self.student_id)
            self.assertEqual(len(panel_roles_for_student(student)), 4)  # thesis
        self._set_rule("defense.proposal_lead_days", 21, "Test: longer notice")
        self._set_rule("defense.panel_size_thesis", 3, "Test: smaller panel")
        with app.app_context():
            self.assertEqual(defense_lead_days("Proposal Defense"), 21)
            student = db.session.get(Student, self.student_id)
            self.assertEqual(len(panel_roles_for_student(student)), 3)
            program = db.session.get(Program, self.program_id)
            program.has_practicum = True
            db.session.commit()
            self.assertEqual(
                panel_roles_for_student(db.session.get(Student, self.student_id)),
                ["Panel Chair", "Content Specialist", "Method Specialist"],
            )

    def test_practicum_requirements_and_faculty_load_come_from_the_register(self):
        self._seed()
        with app.app_context():
            config = practicum_eligibility_config()
            self.assertEqual(config["total_units_required"], 21)
            self.assertEqual(config["unit_requirements"], {"Basic": 6, "Major": 9, "Cognate": 6})
            self.assertEqual(faculty_teaching_load_limit(), 24)
        self._set_rule("practicum.required_units_total", 24, "Test")
        self._set_rule("practicum.required_units_major", 12, "Test")
        self._set_rule("faculty.teaching_load_limit_units", 15, "Test")
        with app.app_context():
            config = practicum_eligibility_config()
            self.assertEqual(config["total_units_required"], 24)
            self.assertEqual(config["unit_requirements"]["Major"], 12)
            self.assertEqual(faculty_teaching_load_limit(), 15)

    def test_the_comprehensive_exam_gate_follows_the_register(self):
        self._seed()
        with app.app_context():
            for course_id in self.course_ids:
                db.session.add(CourseRecord(
                    student_id=self.student_id, course_id=course_id, status="Completed",
                    grade_value="1.50", grade_status="Passed",
                ))
            student = db.session.get(Student, self.student_id)
            student.comprehensive_exam_status = "Eligible"
            db.session.commit()
            gate = comprehensive_exam_eligibility(student)
            self.assertTrue(gate["eligible"], gate)
            self.assertFalse(gate["passed"])
            self.assertFalse(gate["research_allowed"])
            with self.assertRaises(ValueError) as raised:
                require_research_prerequisite(student)
            self.assertIn("Graduate School Handbook 2022-2023, p. 57", str(raised.exception))
        self._set_rule("research.comprehensive_exam_before_research", False, "Test: rule waived")
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            self.assertTrue(comprehensive_exam_eligibility(student)["research_allowed"])
            self.assertTrue(require_research_prerequisite(student)["eligible"])


if __name__ == "__main__":
    unittest.main()
