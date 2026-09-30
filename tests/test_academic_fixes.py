"""Academic-side logic fixes (audit EN-01..EN-06, CO-01..CO-03, AW-04, HO-01, HO-02).

Enrollment guard, class-list import, offering-plan state machine, subject
withdrawal, demand definition, residency years and first-login passwords.
"""

import os
import tempfile
import unittest
from datetime import date, datetime, timedelta
from io import BytesIO
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    AcademicTerm,
    Course,
    CourseOffering,
    CourseOfferingPlan,
    CourseRecord,
    CurriculumOffering,
    Faculty,
    Program,
    Student,
    SubjectEnrollment,
    Task,
    TermEnrollment,
    TransactionLog,
    UserAccount,
    WithdrawalApplication,
    app,
    check_password_hash,
    course_demand_rows,
    db,
    generate_password_hash,
    import_ac_monitoring,
    residence_limits,
    student_current_course_year,
    subject_needs_report_payload,
)


def academic_year_label(today: date) -> str:
    start = today.year if today.month >= 6 else today.year - 1
    return f"{start}-{start + 1}"


class AcademicFixTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def setUp(self):
        app.config.update(TESTING=True)
        today = date.today()
        self.ay = academic_year_label(today)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = Program(code="ACD", name="Academic Fix Program", college="Graduate School", has_practicum=False)
            db.session.add(program)
            db.session.flush()
            self.program_id = program.id
            self.courses = []
            for index in range(1, 7):
                course = Course(
                    program_id=program.id, code=f"ACD-50{index}", title=f"Academic Course {index}",
                    units=3, category="Major",
                )
                db.session.add(course)
                self.courses.append(course)
            db.session.flush()
            self.course_ids = [course.id for course in self.courses]
            # Semester 1 runs now (started 3 days ago); semester 2 is next.
            self.term1 = AcademicTerm(
                label=f"AY {self.ay} 1st Semester", start_date=today - timedelta(days=3),
                end_date=today + timedelta(days=100), is_active_planning_term=True,
            )
            self.term2 = AcademicTerm(
                label=f"AY {self.ay} 2nd Semester", start_date=today + timedelta(days=120),
                end_date=today + timedelta(days=230),
            )
            db.session.add_all([self.term1, self.term2])
            db.session.flush()
            self.term1_id, self.term2_id = self.term1.id, self.term2.id
            for term_label in ("1st Semester", "2nd Semester"):
                for course in self.courses:
                    db.session.add(CurriculumOffering(
                        program_id=program.id, academic_year=self.ay, semester=term_label,
                        course_id=course.id, added_by="Test",
                    ))
            self.faculty_a = Faculty(
                name="Dr. Dean Approved", college="Graduate School", role="Faculty",
                specialization="Testing", email="approved@example.test", active=True,
            )
            self.faculty_b = Faculty(
                name="Dr. File Named", college="Graduate School", role="Faculty",
                specialization="Testing", email="named@example.test", active=True,
            )
            db.session.add_all([self.faculty_a, self.faculty_b])
            db.session.flush()
            self.faculty_a_id, self.faculty_b_id = self.faculty_a.id, self.faculty_b.id
            self.student = self._student("GS-ACD-0001", "Ana", "Active")
            self.staff_id = self._account("staff", "staff-acd@example.test").id
            self.academic_id = self._account("academic_coordinator", "ac-acd@example.test").id
            self.dean_id = self._account("dean", "dean-acd@example.test").id
            self.student_id = self.student.id
            self.student_account_id = self._account(
                "student", "ana-acd@example.test", student_id=self.student.id
            ).id
            db.session.commit()

    # ---- fixtures ----------------------------------------------------------
    def _account(self, role, email, student_id=None):
        account = UserAccount(
            email=email, full_name=f"Test {role}", password_hash=generate_password_hash("test-password"),
            role=role, student_id=student_id, active=True,
        )
        db.session.add(account)
        db.session.flush()
        return account

    def _student(self, number, first, standing, tag="Not Enrolled", stage="Coursework", entry_year=None):
        student = Student(
            student_number=number, first_name=first, last_name="Tester",
            email=f"{number.lower()}@example.test", program_id=self.program_id,
            entry_year=entry_year or int(self.ay[:4]), academic_year_entry="",
            year_level="1", current_stage=stage, standing=standing, enrollment_tag=tag,
        )
        db.session.add(student)
        db.session.flush()
        return student

    def _client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def _enroll_row(self, student_id, course_id, term_id, status="Enrolled"):
        row = SubjectEnrollment(student_id=student_id, course_id=course_id, term_id=term_id, status=status)
        db.session.add(row)
        course = db.session.get(Course, course_id)
        term = db.session.get(AcademicTerm, term_id)
        record = CourseRecord.query.filter_by(student_id=student_id, course_id=course_id).first()
        if not record:
            record = CourseRecord(student_id=student_id, course_id=course_id)
            db.session.add(record)
        record.status = status
        record.term_label = term.label
        db.session.flush()
        return row

    def _student_enroll(self, course_ids, term_id=None):
        return self._client(self.student_account_id, "student").post(
            "/api/student-portal/enrollment",
            json={"term_id": term_id or self.term1_id, "course_ids": course_ids},
        )

    def _set_student(self, **fields):
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            for key, value in fields.items():
                setattr(student, key, value)
            db.session.commit()

    # ======================================================================
    # EN-01  one shared enrollment guard
    # ======================================================================
    def test_guard_names_every_blocking_standing(self):
        from app import student_enrollment_block_reason
        with app.app_context():
            term = db.session.get(AcademicTerm, self.term1_id)
            student = db.session.get(Student, self.student_id)
            self.assertIsNone(student_enrollment_block_reason(student, term))
            for standing, tag in [
                ("AWOL", "AWOL"), ("On Leave", "LOA"), ("On Leave", "Not Enrolled"),
                ("Withdrawn", "Withdrawn"), ("Graduated", "Completed"), ("Active", "Withdrawn"),
            ]:
                student.standing, student.enrollment_tag = standing, tag
                reason = student_enrollment_block_reason(student, term)
                self.assertTrue(reason, f"{standing}/{tag} must be blocked")
            student.standing, student.enrollment_tag = "Active", "Not Enrolled"
            self.assertIsNone(student_enrollment_block_reason(student, term))

    def test_student_self_enrollment_is_blocked_for_awol_and_on_leave(self):
        for standing, tag in (("AWOL", "AWOL"), ("On Leave", "LOA"), ("Withdrawn", "Withdrawn")):
            self._set_student(standing=standing, enrollment_tag=tag)
            response = self._student_enroll([self.course_ids[0]])
            self.assertEqual(response.status_code, 409, (standing, response.get_json()))
            with app.app_context():
                self.assertEqual(SubjectEnrollment.query.filter_by(student_id=self.student_id).count(), 0)

    def test_staff_enrollment_uses_the_same_guard_even_when_only_standing_says_on_leave(self):
        self._set_student(standing="On Leave", enrollment_tag="Not Enrolled")
        academic = self._client(self.academic_id, "academic_coordinator")
        preview = academic.post("/api/enrollment/preview", json={
            "student_id": self.student_id, "term_id": self.term1_id, "course_ids": [self.course_ids[0]],
        })
        self.assertEqual(preview.status_code, 200, preview.get_json())
        self.assertTrue(preview.get_json()["has_blocking_conflicts"])
        save = academic.post("/api/enrollment", json={
            "student_id": self.student_id, "term_id": self.term1_id,
            "course_ids": [self.course_ids[0]], "confirmed": True,
        })
        self.assertEqual(save.status_code, 409, save.get_json())

    def test_student_cannot_silently_reenroll_a_subject_dropped_in_the_same_term(self):
        with app.app_context():
            row = self._enroll_row(self.student_id, self.course_ids[0], self.term1_id, status="Dropped")
            row.cancelled_at = datetime.utcnow()
            db.session.commit()
        response = self._student_enroll([self.course_ids[0]])
        self.assertEqual(response.status_code, 409, response.get_json())
        with app.app_context():
            row = SubjectEnrollment.query.filter_by(
                student_id=self.student_id, course_id=self.course_ids[0], term_id=self.term1_id
            ).one()
            self.assertEqual(row.status, "Dropped")

    def test_student_cannot_have_the_same_subject_active_in_two_semesters(self):
        with app.app_context():
            self._enroll_row(self.student_id, self.course_ids[0], self.term1_id)
            db.session.commit()
        response = self._student_enroll([self.course_ids[0]], term_id=self.term2_id)
        self.assertEqual(response.status_code, 409, response.get_json())
        with app.app_context():
            self.assertFalse(SubjectEnrollment.query.filter_by(
                student_id=self.student_id, term_id=self.term2_id).count())

    def test_student_overload_is_flagged_from_the_register_not_a_hard_coded_number(self):
        # five 3-unit subjects = 15 units, above the 12-unit full-time load
        response = self._student_enroll(self.course_ids[:5])
        self.assertEqual(response.status_code, 409, response.get_json())
        self.assertIn("12", response.get_json()["error"])
        self.assertIn("Academic Coordinator", response.get_json()["error"])
        with app.app_context():
            from app import BusinessRule, clear_business_rule_cache
            rule = BusinessRule.query.filter_by(key="enrollment.full_time_units").first()
            if rule is None:
                from app import ensure_business_rules
                ensure_business_rules()
                rule = BusinessRule.query.filter_by(key="enrollment.full_time_units").one()
            rule.value = "18"
            db.session.commit()
            clear_business_rule_cache()
        ok = self._student_enroll(self.course_ids[:5])
        self.assertEqual(ok.status_code, 200, ok.get_json())

    def test_student_enrolling_normally_still_works_and_tags_enrolled(self):
        response = self._student_enroll(self.course_ids[:2])
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(Student, self.student_id).enrollment_tag, "Enrolled")

    # ======================================================================
    # EN-02  class-list import
    # ======================================================================
    def _csv(self, rows, header=None):
        header = header or (
            "Academic Year,Term,Student ID,Subject Code,Faculty,Enrollment Status,Status Effective Date"
        )
        return ("\n".join([header] + rows) + "\n").encode("utf-8")

    def _import(self, body, term_id=None, preview=False):
        slug = "class-list-preview" if preview else "class-list-import"
        return self._client(self.academic_id, "academic_coordinator").post(
            f"/api/enrollment/{slug}",
            data={"term_id": str(term_id or self.term1_id), "file": (BytesIO(body), "list.csv")},
            content_type="multipart/form-data",
        )

    def _today_str(self, offset=0):
        return (date.today() + timedelta(days=offset)).isoformat()

    def test_class_list_dropped_row_is_recorded_as_dropped_not_enrolled(self):
        body = self._csv([
            f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}",
            f"{self.ay},1st Semester,GS-ACD-0001,ACD-502,Dr. File Named,Dropped,{self._today_str(1)}",
        ])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 0, preview)
        imported = self._import(body)
        self.assertEqual(imported.status_code, 200, imported.get_json())
        with app.app_context():
            rows = {
                item.course.code: item
                for item in SubjectEnrollment.query.filter_by(student_id=self.student_id).all()
            }
            self.assertEqual(rows["ACD-501"].status, "Enrolled")
            self.assertEqual(rows["ACD-502"].status, "Dropped")
            self.assertEqual(rows["ACD-502"].cancelled_at.date(), date.today() + timedelta(days=1))
            record = CourseRecord.query.filter_by(student_id=self.student_id, course_id=self.course_ids[1]).one()
            self.assertEqual(record.status, "Dropped")

    def test_class_list_does_not_reactivate_a_subject_recorded_dropped_this_term(self):
        with app.app_context():
            self._enroll_row(self.student_id, self.course_ids[0], self.term1_id, status="Dropped")
            db.session.commit()
        body = self._csv([f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}"])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 1, preview)
        self._import(body)
        with app.app_context():
            row = SubjectEnrollment.query.filter_by(student_id=self.student_id, course_id=self.course_ids[0]).one()
            self.assertEqual(row.status, "Dropped")

    def test_class_list_file_term_must_match_the_selected_term(self):
        body = self._csv([f"2019-2020,1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,2019-08-05"])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 1, preview)
        self.assertIn("2019-2020", preview["rows"][0]["message"])
        imported = self._import(body).get_json()
        self.assertEqual(imported["tagged"], 0, imported)
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter_by(student_id=self.student_id).count(), 0)
        wrong_semester = self._csv([
            f"{self.ay},2nd Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}"
        ])
        self.assertEqual(self._import(wrong_semester, preview=True).get_json()["error_count"], 1)

    def test_class_list_effective_date_outside_the_term_is_an_error(self):
        body = self._csv([f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,1999-01-01"])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 1, preview)

    def test_class_list_refuses_on_leave_and_awol_students(self):
        with app.app_context():
            on_leave = self._student("GS-ACD-0002", "Leo", "On Leave", tag="LOA", stage="LOA")
            awol = self._student("GS-ACD-0003", "Wally", "AWOL", tag="AWOL", stage="AWOL")
            on_leave_id, awol_id = on_leave.id, awol.id
            db.session.commit()
        body = self._csv([
            f"{self.ay},1st Semester,GS-ACD-0002,ACD-501,Dr. File Named,Enrolled,{self._today_str()}",
            f"{self.ay},1st Semester,GS-ACD-0003,ACD-501,Dr. File Named,Enrolled,{self._today_str()}",
        ])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 2, preview)
        self.assertEqual(preview["ready_count"], 0)
        self._import(body)
        with app.app_context():
            self.assertEqual(SubjectEnrollment.query.filter(
                SubjectEnrollment.student_id.in_([on_leave_id, awol_id])).count(), 0)
            self.assertEqual(db.session.get(Student, on_leave_id).enrollment_tag, "LOA")

    def test_class_list_updates_the_enrollment_tag_and_term_row(self):
        body = self._csv([f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}"])
        imported = self._import(body)
        self.assertEqual(imported.status_code, 200, imported.get_json())
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            self.assertEqual(student.enrollment_tag, "Enrolled")
            term_row = TermEnrollment.query.filter_by(student_id=self.student_id, term_id=self.term1_id).one()
            self.assertIn(term_row.status, {"Enrolled", "Confirmed", "Active"})
            ledger = SubjectEnrollment.query.filter_by(student_id=self.student_id).one()
            self.assertIn("list.csv", ledger.source_reference)  # the class list stays traceable

    def test_class_list_never_overwrites_the_dean_approved_faculty(self):
        with app.app_context():
            offering = CurriculumOffering.query.filter_by(
                program_id=self.program_id, academic_year=self.ay, semester="1st Semester",
                course_id=self.course_ids[0],
            ).one()
            offering.assigned_faculty_id = self.faculty_a_id
            db.session.commit()
        body = self._csv([f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}"])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["rows"][0]["status"], "warning", preview)
        self.assertIn("Dr. Dean Approved", preview["rows"][0]["message"])
        imported = self._import(body).get_json()
        self.assertEqual(imported["faculty_assignments"], 0)
        self.assertEqual(imported["faculty_mismatch_count"], 1, imported)
        with app.app_context():
            offering = CurriculumOffering.query.filter_by(
                program_id=self.program_id, academic_year=self.ay, semester="1st Semester",
                course_id=self.course_ids[0],
            ).one()
            self.assertEqual(offering.assigned_faculty_id, self.faculty_a_id)

    def test_class_list_fills_faculty_only_where_the_offering_has_none(self):
        body = self._csv([f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,Dr. File Named,Enrolled,{self._today_str()}"])
        imported = self._import(body).get_json()
        self.assertEqual(imported["faculty_assignments"], 1, imported)
        with app.app_context():
            offering = CurriculumOffering.query.filter_by(
                program_id=self.program_id, academic_year=self.ay, semester="1st Semester",
                course_id=self.course_ids[0],
            ).one()
            self.assertEqual(offering.assigned_faculty_id, self.faculty_b_id)

    def test_shipped_template_placeholder_faculty_does_not_reject_every_row(self):
        body = self._csv([
            f"{self.ay},1st Semester,GS-ACD-0001,ACD-501,To be confirmed,Enrolled,{self._today_str()}"
        ])
        preview = self._import(body, preview=True).get_json()
        self.assertEqual(preview["error_count"], 0, preview)
        imported = self._import(body).get_json()
        self.assertEqual(imported["tagged"], 1, imported)
        self.assertEqual(imported["faculty_assignments"], 0)

    def test_class_list_without_the_new_columns_still_enrolls(self):
        body = self._csv(["GS-ACD-0001,ACD-501,Dr. File Named"], header="Student ID,Subject Code,Faculty")
        imported = self._import(body).get_json()
        self.assertEqual(imported["tagged"], 1, imported)

    # ======================================================================
    # CO-01 / CO-02 / CO-03  offering plan
    # ======================================================================
    def _plan_call(self, action, **extra):
        return self._client(self.academic_id, "academic_coordinator").post(
            "/api/course-adjustments/plan",
            json={"program_id": self.program_id, "term_id": self.term2_id, "action": action, **extra},
        )

    def _approved_plan(self, offered_course_ids):
        selections = [
            {"course_id": cid, "offer": cid in offered_course_ids, "section_count": 1} for cid in self.course_ids
        ]
        self.assertEqual(self._plan_call("draft", selections=selections).status_code, 200)
        self.assertEqual(self._plan_call("submit").status_code, 200)
        with app.app_context():
            plan_id = CourseOfferingPlan.query.filter_by(program_id=self.program_id).one().id
        approved = self._client(self.dean_id, "dean").post(
            f"/api/approvals/{plan_id}/decide", json={"decision": "approve", "note": "ok"}
        )
        self.assertEqual(approved.status_code, 200, approved.get_json())
        return plan_id

    def test_publishing_never_deletes_an_offering_that_has_enrolled_students(self):
        with app.app_context():
            self._enroll_row(self.student_id, self.course_ids[5], self.term2_id)
            db.session.commit()
        self._approved_plan(set(self.course_ids[:2]))  # the plan drops ACD-506
        published = self._plan_call("publish")
        self.assertEqual(published.status_code, 409, published.get_json())
        self.assertIn("ACD-506", published.get_json()["error"])
        with app.app_context():
            still_offered = CurriculumOffering.query.filter_by(
                program_id=self.program_id, academic_year=self.ay, semester="2nd Semester",
                course_id=self.course_ids[5],
            ).first()
            self.assertIsNotNone(still_offered)
            self.assertEqual(CourseOfferingPlan.query.one().status, "Approved")

    def test_publishing_still_removes_unenrolled_offerings_not_in_the_plan(self):
        self._approved_plan(set(self.course_ids[:2]))
        published = self._plan_call("publish")
        self.assertEqual(published.status_code, 200, published.get_json())
        with app.app_context():
            codes = {
                item.course.code for item in CurriculumOffering.query.filter_by(
                    program_id=self.program_id, academic_year=self.ay, semester="2nd Semester").all()
            }
            self.assertEqual(codes, {"ACD-501", "ACD-502"})

    def test_draft_action_cannot_reset_an_approved_or_published_plan(self):
        self._approved_plan(set(self.course_ids[:2]))
        with app.app_context():
            before = CourseOffering.query.count()
        again = self._plan_call("draft", selections=[{"course_id": self.course_ids[0], "offer": True}])
        self.assertEqual(again.status_code, 409, again.get_json())
        with app.app_context():
            plan = CourseOfferingPlan.query.one()
            self.assertEqual(plan.status, "Approved")
            self.assertEqual(CourseOffering.query.count(), before)
        self.assertEqual(self._plan_call("publish").status_code, 200)
        again = self._plan_call("draft", selections=[{"course_id": self.course_ids[0], "offer": True}])
        self.assertEqual(again.status_code, 409, again.get_json())
        with app.app_context():
            self.assertEqual(CourseOfferingPlan.query.one().status, "Published")
            self.assertEqual(CourseOffering.query.count(), before)

    def test_reopen_is_refused_while_the_dean_is_deciding_but_works_after_approval(self):
        selections = [{"course_id": cid, "offer": True, "section_count": 1} for cid in self.course_ids[:2]]
        self._plan_call("draft", selections=selections)
        self._plan_call("submit")
        refused = self._plan_call("reopen")
        self.assertEqual(refused.status_code, 409, refused.get_json())
        with app.app_context():
            self.assertEqual(CourseOfferingPlan.query.one().status, "Submitted")
            plan_id = CourseOfferingPlan.query.one().id
        self._client(self.dean_id, "dean").post(f"/api/approvals/{plan_id}/decide", json={"decision": "approve"})
        reopened = self._plan_call("reopen")
        self.assertEqual(reopened.status_code, 200, reopened.get_json())
        with app.app_context():
            self.assertEqual(CourseOfferingPlan.query.one().status, "Draft")
            self.assertGreater(CourseOffering.query.count(), 0)

    def test_dean_approval_hands_the_plan_to_the_role_that_can_publish(self):
        self._approved_plan(set(self.course_ids[:2]))
        with app.app_context():
            log = (
                TransactionLog.query.filter_by(transaction_slug="course-adjustments")
                .filter(TransactionLog.result.like("Offering plan approved%"))
                .order_by(TransactionLog.id.desc()).first()
            )
            self.assertEqual(log.next_owner, "Academic Coordinator")
        tasks = self._client(self.academic_id, "academic_coordinator").get(
            "/api/tasks?owner=Academic%20Coordinator"
        ).get_json()["items"]
        publish_tasks = [item for item in tasks if "publish" in item["title"].lower()]
        self.assertEqual(len(publish_tasks), 1, tasks)
        self.assertEqual(publish_tasks[0]["owner_role"], "Academic Coordinator")
        staff_tasks = self._client(self.staff_id, "staff").get("/api/tasks?owner=Graduate%20School%20Staff").get_json()["items"]
        self.assertFalse([item for item in staff_tasks if "publish" in item["title"].lower()])
        # once published the task disappears
        self.assertEqual(self._plan_call("publish").status_code, 200)
        tasks = self._client(self.academic_id, "academic_coordinator").get(
            "/api/tasks?owner=Academic%20Coordinator"
        ).get_json()["items"]
        self.assertFalse([item for item in tasks if "publish" in item["title"].lower()])

    def test_legacy_offering_endpoints_no_longer_change_the_official_list(self):
        client = self._client(self.academic_id, "academic_coordinator")
        with app.app_context():
            before = CurriculumOffering.query.count()
            offering_id = CurriculumOffering.query.first().id
        added = client.post("/api/curriculum-planning/offerings", json={
            "program_id": self.program_id, "term_id": self.term1_id, "course_ids": self.course_ids[:1],
        })
        deleted = client.delete(f"/api/curriculum-planning/offerings/{offering_id}")
        generated = client.post("/api/curriculum-planning/generate", json={"program_id": self.program_id})
        for response in (added, deleted, generated):
            self.assertEqual(response.status_code, 410, response.get_json())
        with app.app_context():
            self.assertEqual(CurriculumOffering.query.count(), before)

    def test_plan_reference_term_is_the_semester_before_not_a_later_one(self):
        with app.app_context():
            later = AcademicTerm(
                label=f"AY {int(self.ay[:4]) + 5}-{int(self.ay[:4]) + 6} 1st Semester",
                start_date=date.today() + timedelta(days=2000), end_date=date.today() + timedelta(days=2100),
            )
            db.session.add(later)
            db.session.commit()
        self._plan_call("draft", selections=[{"course_id": self.course_ids[0], "offer": True}])
        with app.app_context():
            plan = CourseOfferingPlan.query.one()
            self.assertEqual(plan.reference_term_id, self.term1_id)

    def test_dean_must_give_a_comment_when_returning_a_plan(self):
        self._plan_call("draft", selections=[{"course_id": self.course_ids[0], "offer": True}])
        self._plan_call("submit")
        with app.app_context():
            plan_id = CourseOfferingPlan.query.one().id
        dean = self._client(self.dean_id, "dean")
        self.assertEqual(dean.post(f"/api/approvals/{plan_id}/decide", json={"decision": "return"}).status_code, 400)
        ok = dean.post(f"/api/approvals/{plan_id}/decide", json={"decision": "return", "note": "Add ACD-502"})
        self.assertEqual(ok.status_code, 200, ok.get_json())

    # ======================================================================
    # EN-04  subject withdrawal never rewrites standing
    # ======================================================================
    def test_approved_subject_withdrawal_leaves_standing_untouched(self):
        with app.app_context():
            enrollment = self._enroll_row(self.student_id, self.course_ids[0], self.term1_id)
            student = db.session.get(Student, self.student_id)
            student.standing, student.enrollment_tag, student.current_stage = "On Leave", "LOA", "LOA"
            application = WithdrawalApplication(
                student_id=self.student_id, subject_enrollment_id=enrollment.id, status="Dean Review",
            ) if "subject_enrollment_id" in WithdrawalApplication.__table__.columns else None
            if application is None:
                self.skipTest("withdrawal model has no subject link")
            db.session.add(application)
            db.session.commit()
            application_id = application.id
            from app import apply_approved_subject_withdrawal
            apply_approved_subject_withdrawal(db.session.get(WithdrawalApplication, application_id))
            db.session.commit()
            student = db.session.get(Student, self.student_id)
            self.assertEqual(student.standing, "On Leave")
            self.assertEqual(student.current_stage, "LOA")
            self.assertEqual(db.session.get(SubjectEnrollment, enrollment.id).status, "Withdrawn")

    # ======================================================================
    # EN-03  dropping a subject
    # ======================================================================
    def _drop(self, enrollment_id, effective_date):
        return self._client(self.academic_id, "academic_coordinator").patch("/api/enrollment/subject-status", json={
            "subject_enrollment_id": enrollment_id, "status": "Dropped", "note": "Exceeded absences",
            "effective_date": effective_date, "unexcused_absence_percent": 35,
        })

    def test_drop_effective_date_must_fall_inside_the_semester(self):
        with app.app_context():
            enrollment_id = self._enroll_row(self.student_id, self.course_ids[0], self.term1_id).id
            db.session.commit()
        for bad in ("1999-01-01", (date.today() + timedelta(days=400)).isoformat()):
            response = self._drop(enrollment_id, bad)
            self.assertEqual(response.status_code, 400, response.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(SubjectEnrollment, enrollment_id).status, "Enrolled")
        ok = self._drop(enrollment_id, date.today().isoformat())
        self.assertEqual(ok.status_code, 200, ok.get_json())

    def test_dropping_a_subject_closes_a_pending_withdrawal_request_for_it(self):
        with app.app_context():
            enrollment = self._enroll_row(self.student_id, self.course_ids[0], self.term1_id)
            db.session.flush()
            application = WithdrawalApplication(
                student_id=self.student_id, subject_enrollment_id=enrollment.id, status="Dean Review",
                dean_decision="Pending",
            )
            db.session.add(application)
            db.session.commit()
            enrollment_id, application_id = enrollment.id, application.id
        self.assertEqual(self._drop(enrollment_id, date.today().isoformat()).status_code, 200)
        with app.app_context():
            application = db.session.get(WithdrawalApplication, application_id)
            self.assertNotEqual(application.status, "Dean Review")
            self.assertNotEqual(application.dean_decision, "Pending")
            self.assertIn("Dropped", application.staff_remarks)

    # ======================================================================
    # EN-06  one demand definition
    # ======================================================================
    def test_demand_and_subject_needs_count_everyone_who_needs_next_term_subjects(self):
        with app.app_context():
            enrolled = self._student("GS-ACD-0010", "Eve", "Active", tag="Enrolled")
            readmitted = self._student("GS-ACD-0011", "Rita", "Active", tag="Not Enrolled")
            resident = self._student("GS-ACD-0012", "Reese", "Active", tag="Residency")
            on_leave = self._student("GS-ACD-0013", "Lou", "On Leave", tag="LOA", stage="LOA")
            awol = self._student("GS-ACD-0014", "Al", "AWOL", tag="AWOL", stage="AWOL")
            withdrawn = self._student("GS-ACD-0015", "Wil", "Withdrawn", tag="Withdrawn", stage="Withdrawn")
            graduated = self._student("GS-ACD-0016", "Grace", "Active", tag="Completed", stage="Completed")
            db.session.commit()
            expected = {enrolled.id, readmitted.id, resident.id, self.student_id}
            excluded = {on_leave.id, awol.id, withdrawn.id, graduated.id}
            program = db.session.get(Program, self.program_id)
            term = db.session.get(AcademicTerm, self.term2_id)
            demand = course_demand_rows(program, term)
            demand_ids = {
                student["id"] for row in demand for student in row["affected_students"]
            }
            self.assertTrue(expected <= demand_ids, (expected, demand_ids))
            self.assertFalse(excluded & demand_ids)
            needs = subject_needs_report_payload(program, term)
            need_ids = {student["id"] for row in needs["rows"] for student in row["students"]}
            self.assertTrue(expected <= need_ids, (expected, need_ids))
            self.assertFalse(excluded & need_ids)
            self.assertEqual(needs["summary"]["students_reviewed"], len(expected))
            from app import students_expected_for_planning
            self.assertEqual({s.id for s in students_expected_for_planning(program, term)}, expected)

    # ======================================================================
    # AW-04  one residency-years function
    # ======================================================================
    def test_years_in_program_counts_academic_years_and_includes_leave(self):
        from app import years_in_program
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.entry_year = 2020
            student.standing = "On Leave"  # leave time is never subtracted
            # AY 2026-27 is the seventh academic year of someone who entered in 2020-21
            self.assertEqual(years_in_program(student, as_of=date(2026, 10, 1)), 7)
            self.assertEqual(years_in_program(student, as_of=date(2027, 1, 1)), 7)
            self.assertEqual(years_in_program(student, as_of=date(2027, 5, 31)), 7)
            self.assertEqual(years_in_program(student, as_of=date(2027, 6, 1)), 8)
            self.assertEqual(years_in_program(student, as_of=date(2020, 9, 1)), 1)

    def test_every_residency_figure_comes_from_the_one_function(self):
        from app import years_in_program
        with app.app_context():
            student = db.session.get(Student, self.student_id)
            student.entry_year = 2020
            db.session.flush()
            expected = years_in_program(student)
            self.assertEqual(residence_limits(student)["years_in_program"], expected)
            term = db.session.get(AcademicTerm, self.term1_id)
            term.label = "AY 2026-2027 1st Semester"
            self.assertEqual(student_current_course_year(student, term), years_in_program(student, term=term))
            with patch("app.date") as mocked:
                mocked.today.return_value = date(2026, 12, 31)
                mocked.side_effect = lambda *a, **k: date(*a, **k)
                self.assertEqual(years_in_program(student), 7)
                mocked.today.return_value = date(2027, 1, 2)
                self.assertEqual(years_in_program(student), 7)  # no flip on 1 January
                self.assertEqual(residence_limits(student)["years_in_program"], 7)

    # ======================================================================
    # HO-01 / HO-02  import respects standing; no shared password
    # ======================================================================
    def _parsed(self, rows):
        return {
            "program_code": "ACD",
            "subjects": ["ACD-501"],
            "subject_categories": {"ACD-501": "Major"},
            "subject_titles": {"ACD-501": "Academic Course 1"},
            "issues": [],
            "rows": [
                {
                    "row": index, "idno": idno, "last_name": last, "first_name": first, "course": "ACD",
                    "year": "", "ay_entry": ay, "subjects": {"ACD-501": False}, "milestones": {},
                    "comprehensive_exam_passed": False, "note": note,
                }
                for index, (idno, first, last, ay, note) in enumerate(rows, start=5)
            ],
        }

    def test_import_takes_standing_from_the_note_column_with_provenance(self):
        with app.app_context():
            result = import_ac_monitoring(self._parsed([
                ("GS-IMP-1", "Lea", "Leave", "22-23", "LOA since 1st sem"),
                ("GS-IMP-2", "Aw", "Ol", "22-23", "AWOL"),
                ("GS-IMP-3", "Wid", "Raw", "22-23", "Withdrew from the program"),
                ("GS-IMP-4", "Ann", "Normal", "22-23", ""),
            ]))
            db.session.commit()
            by_number = {item.student_number: item for item in Student.query.filter(
                Student.student_number.like("GS-IMP-%")).all()}
            self.assertEqual((by_number["GS-IMP-1"].standing, by_number["GS-IMP-1"].enrollment_tag), ("On Leave", "LOA"))
            self.assertEqual((by_number["GS-IMP-2"].standing, by_number["GS-IMP-2"].enrollment_tag), ("AWOL", "AWOL"))
            self.assertEqual(by_number["GS-IMP-3"].standing, "Withdrawn")
            self.assertEqual(by_number["GS-IMP-4"].standing, "Active")
            self.assertEqual(by_number["GS-IMP-1"].current_stage, "LOA")
            # no "Confirmed" enrollment for someone who is on leave
            self.assertFalse(TermEnrollment.query.filter_by(student_id=by_number["GS-IMP-1"].id).count())
            log = TransactionLog.query.filter_by(student_id=by_number["GS-IMP-1"].id).filter(
                TransactionLog.notes.like("%NOTE%")).first()
            self.assertIsNotNone(log, "standing taken from the sheet must be logged with its source text")
            self.assertEqual(len(result["standing_from_note"]), 3)
            # those students are blocked by the shared guard
            from app import student_enrollment_block_reason
            self.assertTrue(student_enrollment_block_reason(by_number["GS-IMP-1"], self.term1))

    def test_import_does_not_change_the_stage_or_standing_of_an_existing_non_active_student(self):
        with app.app_context():
            student = self._student("GS-IMP-9", "Existing", "On Leave", tag="LOA", stage="LOA", entry_year=2022)
            student.academic_year_entry = "22-23"
            student.last_name = "Leave"
            db.session.commit()
            import_ac_monitoring(self._parsed([("GS-IMP-9", "Existing", "Leave", "22-23", "")]))
            db.session.commit()
            refreshed = Student.query.filter_by(student_number="GS-IMP-9").one()
            self.assertEqual((refreshed.standing, refreshed.enrollment_tag, refreshed.current_stage), ("On Leave", "LOA", "LOA"))

    def test_imported_accounts_get_random_passwords_when_demo_mode_is_off(self):
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            with app.app_context():
                result = import_ac_monitoring(self._parsed([
                    ("GS-PW-1", "Pat", "One", "25-26", ""),
                    ("GS-PW-2", "Pam", "Two", "25-26", ""),
                ]))
                db.session.commit()
                accounts = result["accounts"]
                self.assertEqual(len(accounts), 2)
                passwords = [item["password"] for item in accounts]
                self.assertTrue(all(len(value) >= 10 for value in passwords), passwords)
                self.assertEqual(len(set(passwords)), 2)
                self.assertNotIn("DemoPass123!", passwords)
                for item in accounts:
                    account = UserAccount.query.filter_by(email=item["email"]).one()
                    self.assertTrue(check_password_hash(account.password_hash, item["password"]))
                    self.assertFalse(check_password_hash(account.password_hash, "DemoPass123!"))
                    self.assertTrue(account.must_change_password)
                self.assertNotIn("DemoPass123!", result["message"])

    def test_imported_accounts_keep_the_demo_password_in_demo_mode(self):
        with patch.dict(os.environ, {"DEMO_MODE": "1"}):
            with app.app_context():
                result = import_ac_monitoring(self._parsed([("GS-PW-3", "Pia", "Three", "25-26", "")]))
                db.session.commit()
                account = UserAccount.query.filter_by(email=result["accounts"][0]["email"]).one()
                self.assertTrue(check_password_hash(account.password_hash, "DemoPass123!"))
                self.assertFalse(account.must_change_password)

    def test_first_login_must_change_the_password_before_anything_else(self):
        with app.app_context():
            account = UserAccount.query.get(self.student_account_id)
            account.password_hash = generate_password_hash("Initial-Pass-1")
            account.must_change_password = True
            db.session.commit()
        client = app.test_client()
        login = client.post("/api/auth/login", json={"email": "ana-acd@example.test", "password": "Initial-Pass-1"})
        self.assertEqual(login.status_code, 200, login.get_json())
        self.assertTrue(login.get_json()["user"]["must_change_password"])
        blocked = client.get("/api/student-portal/context")
        self.assertEqual(blocked.status_code, 403, blocked.get_json())
        self.assertTrue(blocked.get_json().get("must_change_password"))
        self.assertEqual(client.get("/api/auth/me").status_code, 200)
        weak = client.post("/api/auth/change-password", json={"current_password": "Initial-Pass-1", "new_password": "short"})
        self.assertEqual(weak.status_code, 400, weak.get_json())
        same = client.post("/api/auth/change-password", json={"current_password": "Initial-Pass-1", "new_password": "Initial-Pass-1"})
        self.assertEqual(same.status_code, 400, same.get_json())
        wrong = client.post("/api/auth/change-password", json={"current_password": "nope-nope", "new_password": "A-brand-new-pass-9"})
        self.assertEqual(wrong.status_code, 400, wrong.get_json())
        changed = client.post("/api/auth/change-password", json={"current_password": "Initial-Pass-1", "new_password": "A-brand-new-pass-9"})
        self.assertEqual(changed.status_code, 200, changed.get_json())
        self.assertFalse(changed.get_json()["user"]["must_change_password"])
        self.assertNotEqual(client.get("/api/student-portal/context").status_code, 403)
        again = app.test_client().post("/api/auth/login", json={"email": "ana-acd@example.test", "password": "A-brand-new-pass-9"})
        self.assertEqual(again.status_code, 200)

    def test_manual_student_creation_shows_the_generated_password_once(self):
        with patch.dict(os.environ, {"DEMO_MODE": "0"}):
            client = self._client(self.academic_id, "academic_coordinator")
            response = client.post("/api/monitoring/students", json={
                "student_number": "GS-PW-9", "first_name": "Nia", "last_name": "Nine",
                "academic_year_entry": "25-26", "program_id": self.program_id,
            })
            self.assertEqual(response.status_code, 201, response.get_json())
            account = response.get_json()["account"]
            self.assertNotEqual(account["password"], "DemoPass123!")
            self.assertGreaterEqual(len(account["password"]), 10)
            self.assertTrue(account.get("must_change_password"))
            with app.app_context():
                stored = UserAccount.query.filter_by(email=account["email"]).one()
                self.assertTrue(check_password_hash(stored.password_hash, account["password"]))


if __name__ == "__main__":
    unittest.main()
