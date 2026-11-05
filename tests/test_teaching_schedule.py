"""Teaching availability is separate from defenses; schedules remain human-approved."""
import unittest
from tests import test_academic_fixes as base
from app import app, db, FacultyWorkingHour, CurriculumOffering, CourseOfferingPlan, CourseOffering


class TeachingScheduleTests(unittest.TestCase):
    def setUp(self):
        self.f = base.AcademicFixTests()
        self.f.setUp()
        with app.app_context():
            self.faculty_account = self.f._account("faculty", "teaching@example.test")
            self.faculty_account.faculty_id = self.f.faculty_a_id
            db.session.commit()
            self.faculty_account_id = self.faculty_account.id
        self.faculty = self.f._client(self.faculty_account_id, "faculty")
        self.coordinator = self.f._client(self.f.academic_id, "academic_coordinator")
        self.term = self.f.term2_id

    def tearDown(self):
        self.f.tearDown()

    def windows(self):
        return [{"weekday": d, "start": "07:30", "end": "21:00", "kind": "available"} for d in [1, 4]]

    def url(self, term=None):
        return f"/api/faculty-portal/teaching-schedule?term_id={term or self.term}"

    def submit(self, **extra):
        return self.faculty.put(self.url(), json={"version": 0, "windows": self.windows(), "status": "Submitted", **extra})

    def offering(self):
        with app.app_context():
            row = CurriculumOffering.query.filter_by(course_id=self.f.course_ids[0], semester="2nd Semester").one()
            row.assigned_faculty_id = self.f.faculty_a_id
            db.session.commit()

    def draft(self):
        self.offering()
        self.assertEqual(self.submit().status_code, 200)
        response = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term, "action": "draft"})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["plan"]

    def test_faculty_get_starts_unknown_and_cannot_write_defense_hours(self):
        with app.app_context():
            before = FacultyWorkingHour.query.count()
        result = self.faculty.get(self.url())
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()["availability"]["status"], "Missing")
        self.assertEqual(self.submit().status_code, 200)
        with app.app_context():
            self.assertEqual(FacultyWorkingHour.query.count(), before)

    def test_submissions_are_term_scoped_versioned_and_support_copy_confirmation(self):
        self.assertEqual(self.submit().status_code, 200)
        value = self.faculty.get(self.url()).get_json()["availability"]
        self.assertEqual(value["windows"], self.windows())
        self.assertGreater(value["version"], 0)
        self.assertEqual(self.submit().status_code, 409)
        other = self.faculty.get(self.url(self.f.term1_id)).get_json()["availability"]
        self.assertEqual(other["status"], "Missing")
        copied = self.faculty.put(self.url(self.f.term1_id), json={"version": 0, "copy_from_term_id": self.term})
        self.assertEqual(copied.status_code, 200)
        self.assertEqual(copied.get_json()["availability"]["status"], "Draft")
        v = copied.get_json()["availability"]
        confirmed = self.faculty.put(self.url(self.f.term1_id), json={"version": v["version"], "windows": v["windows"], "status": "Submitted"})
        self.assertEqual(confirmed.status_code, 200)

    def test_invalid_preferred_window_and_reversed_range_are_rejected(self):
        for windows in ([{"weekday": 1, "start": "10:00", "end": "09:00", "kind": "available"}],
                        [{"weekday": 1, "start": "08:00", "end": "09:00", "kind": "preferred"}]):
            self.assertEqual(self.submit(windows=windows).status_code, 400)

    def test_only_faculty_self_submits_and_only_coordinator_manages(self):
        dean = self.f._client(self.f.dean_id, "dean")
        self.assertEqual(dean.put(self.url(), json={}).status_code, 403)
        self.assertEqual(self.faculty.post("/api/teaching-schedules", json={"term_id": self.term}).status_code, 403)
        self.assertEqual(dean.post("/api/teaching-schedules", json={"term_id": self.term}).status_code, 403)

    def test_admin_superuser_cannot_approve_on_behalf_of_academic_coordinator(self):
        plan = self.ready_plan()
        with app.app_context():
            admin = self.f._account("admin", "teaching-admin@example.test")
            db.session.commit()
            account_id = admin.id
        client = self.f._client(account_id, "admin")
        result = client.post(f'/api/teaching-schedules/{plan["id"]}', json={"version": plan["version"], "action": "approve"})
        self.assertEqual(result.status_code, 403, result.get_json())

    def test_draft_preselection_is_not_published(self):
        plan = self.draft()
        self.assertEqual(plan["status"], "Draft")
        selected = next(s for s in plan["sections"] if s["course_id"] == self.f.course_ids[0])
        self.assertTrue(selected["options"])
        self.assertTrue(selected["meetings"])
        self.assertEqual(self.faculty.get(self.url()).get_json()["published"], [])

    def test_missing_availability_blocks_approval_and_explains_why(self):
        self.offering()
        response = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term})
        self.assertEqual(response.status_code, 200)
        plan = response.get_json()["plan"]
        result = self.coordinator.post(f'/api/teaching-schedules/{plan["id"]}', json={"version": plan["version"], "action": "approve"})
        self.assertEqual(result.status_code, 409)
        self.assertIn("availability", str(result.get_json()).lower())

    def test_stale_edits_rejected_and_room_text_untouched(self):
        plan = self.draft()
        result = self.coordinator.post(f'/api/teaching-schedules/{plan["id"]}', json={"version": plan["version"] - 1, "action": "save"})
        self.assertEqual(result.status_code, 409)

    def test_student_cannot_see_other_student_schedule_or_drafts(self):
        student = self.f._client(self.f.student_account_id, "student")
        result = student.get(f"/api/student-portal/class-schedule?term_id={self.term}")
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.get_json()["sections"], [])

    def test_reads_do_not_create_schedule_or_availability_records(self):
        with app.app_context():
            before = db.session.execute(db.text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")).scalar()
        self.assertEqual(self.faculty.get(self.url()).status_code, 200)
        listing = self.coordinator.get(f"/api/teaching-schedules?term_id={self.term}")
        self.assertEqual(listing.status_code, 200)
        self.assertIsNone(listing.get_json()["plan"])
        with app.app_context():
            self.assertEqual(db.session.execute(db.text("SELECT COUNT(*) FROM sqlite_master WHERE type='table'")).scalar(), before)

    def ready_plan(self):
        with app.app_context():
            rows = CurriculumOffering.query.filter_by(semester="2nd Semester").all()
            for row in rows:
                if row.course_id not in self.f.course_ids[:2]:
                    db.session.delete(row)
                else:
                    row.assigned_faculty_id = self.f.faculty_a_id
            for cid in self.f.course_ids[:2]:
                self.f._enroll_row(self.f.student_id, cid, self.term)
            db.session.commit()
        self.assertEqual(self.submit().status_code, 200)
        response = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["plan"]

    def action(self, plan, action, **extra):
        return self.coordinator.post(f'/api/teaching-schedules/{plan["id"]}', json={"version": plan["version"], "action": action, **extra})

    def test_approval_and_publication_are_explicit_and_personal_views_are_scoped(self):
        plan = self.ready_plan()
        self.assertTrue(all(s["meetings"] for s in plan["sections"]))
        student = self.f._client(self.f.student_account_id, "student")
        self.assertEqual(student.get(f"/api/student-portal/class-schedule?term_id={self.term}").get_json()["sections"], [])
        result = self.action(plan, "publish")
        self.assertEqual(result.status_code, 409)
        result = self.action(plan, "approve")
        self.assertEqual(result.status_code, 200, result.get_json())
        approved = result.get_json()["plan"]
        self.assertEqual(approved["status"], "Approved")
        self.assertEqual(self.faculty.get(self.url()).get_json()["published"], [])
        result = self.action(approved, "publish")
        self.assertEqual(result.status_code, 200, result.get_json())
        published = result.get_json()["plan"]
        self.assertEqual(published["status"], "Published")
        self.assertFalse(any("free-text" in warning for warning in published["warnings"]), published["warnings"])
        self.assertEqual(len(self.faculty.get(self.url()).get_json()["published"]), 2)
        self.assertEqual(len(student.get(f"/api/student-portal/class-schedule?term_id={self.term}").get_json()["sections"]), 2)
        with app.app_context():
            other = self.f._student("GS-OTHER", "Other", "Active")
            account = self.f._account("student", "other@test.example", student_id=other.id)
            db.session.commit()
            account_id = account.id
        other_client = self.f._client(account_id, "student")
        self.assertEqual(other_client.get(f"/api/student-portal/class-schedule?term_id={self.term}&student_id={self.f.student_id}").get_json()["sections"], [])
        self.assertEqual(self.action(published, "save").status_code, 409)
        revision = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term}).get_json()["plan"]
        self.assertNotEqual(revision["id"], published["id"])
        self.assertEqual(revision["status"], "Draft")
        self.assertEqual(len(self.faculty.get(self.url()).get_json()["published"]), 2)

    def test_availability_change_after_approval_blocks_publication(self):
        plan = self.ready_plan()
        result = self.action(plan, "approve")
        self.assertEqual(result.status_code, 200, result.get_json())
        approved = result.get_json()["plan"]
        value = self.faculty.get(self.url()).get_json()["availability"]
        changed = self.submit(version=value["version"], windows=[{"weekday": 0, "start": "07:30", "end": "21:00", "kind": "available"}])
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(self.action(approved, "publish").status_code, 409)

    def test_tampered_candidate_and_shared_student_overlap_cannot_be_approved(self):
        plan = self.ready_plan()
        result = self.action(plan, "save", sections=[{"id": plan["sections"][0]["id"], "option_id": "invented"}])
        self.assertIn(result.status_code, (400, 409))
        current = self.coordinator.get(f"/api/teaching-schedules?term_id={self.term}").get_json()["plan"]
        option = current["sections"][0]["options"][0]["id"]
        result = self.action(current, "approve", sections=[{"id": s["id"], "option_id": option} for s in current["sections"]])
        self.assertEqual(result.status_code, 409)

    def test_client_cannot_submit_availability_for_another_faculty(self):
        self.assertIn(self.submit(faculty_id=self.f.faculty_b_id).status_code, (200, 400, 403))
        # Even if the extraneous ID is ignored, no other faculty record may be changed.
        with app.app_context():
            from app import TeachingAvailability
            self.assertIsNone(TeachingAvailability.query.filter_by(faculty_id=self.f.faculty_b_id, term_id=self.term).first())

    def test_later_defense_booking_cannot_overlap_published_student_class(self):
        from datetime import timedelta
        plan = self.ready_plan()
        approved_response = self.action(plan, "approve")
        self.assertEqual(approved_response.status_code, 200, approved_response.get_json())
        published_response = self.action(approved_response.get_json()["plan"], "publish")
        self.assertEqual(published_response.status_code, 200, published_response.get_json())
        published = published_response.get_json()["plan"]
        meeting = published["sections"][0]["meetings"][0]
        with app.app_context():
            start = db.session.get(base.AcademicTerm, self.term).start_date
            day = start + timedelta(days=(meeting["weekday"] - start.weekday()) % 7)
            conflicts = base.app_module.defense_schedule_conflicts(
                db.session.get(base.Student, self.f.student_id), [], day,
                base.app_module.parse_time(meeting["start"]), base.app_module.parse_time(meeting["end"]), "Unchanged venue")
            self.assertTrue(any("class" in message.lower() for message in conflicts), conflicts)

    def test_manual_choice_stays_pinned_during_later_recommendations(self):
        plan = self.ready_plan()
        first = plan["sections"][0]
        selected = first["options"][-1]["id"]
        response = self.action(plan, "save", sections=[{"id": first["id"], "option_id": selected}])
        self.assertEqual(response.status_code, 200, response.get_json())
        saved = response.get_json()["plan"]
        saved_first = next(s for s in saved["sections"] if s["id"] == first["id"])
        self.assertTrue(saved_first["pinned"])
        result = self.action(saved, "recommend")
        self.assertEqual(result.status_code, 200, result.get_json())
        refreshed = result.get_json()["plan"]
        self.assertEqual(next(s for s in refreshed["sections"] if s["id"] == first["id"])["option_id"], selected)
        result = self.action(refreshed, "save", sections=[{"id": first["id"], "pinned": False}])
        self.assertEqual(result.status_code, 200, result.get_json())
        self.assertFalse(next(s for s in result.get_json()["plan"]["sections"] if s["id"] == first["id"])["pinned"])

    def test_scheduled_offering_cannot_be_deleted_and_break_schedule_history(self):
        plan = self.ready_plan()
        with app.app_context():
            cid = self.f.course_ids[0]
            base.SubjectEnrollment.query.filter_by(course_id=cid, term_id=self.term).delete()
            offering = CurriculumOffering.query.filter_by(course_id=cid, semester="2nd Semester").one()
            offering_id = offering.id
            db.session.commit()
        result = self.coordinator.delete(f"/api/course-offerings/{offering_id}")
        self.assertEqual(result.status_code, 409, result.get_json())

    def test_free_text_update_cannot_bypass_published_timetable(self):
        plan = self.ready_plan()
        approved = self.action(plan, "approve").get_json()["plan"]
        result = self.action(approved, "publish")
        self.assertEqual(result.status_code, 200, result.get_json())
        with app.app_context():
            offering_id = CurriculumOffering.query.filter_by(course_id=self.f.course_ids[0], semester="2nd Semester").one().id
        result = self.coordinator.patch(f"/api/course-offerings/{offering_id}", json={"schedule": "Monday 1PM"})
        self.assertEqual(result.status_code, 409, result.get_json())

    def test_teacher_and_section_of_a_published_timetable_cannot_be_changed_from_offering_setup(self):
        # IM45 (F6-03): the guard covers the teacher and the section, not only the schedule
        plan = self.ready_plan()
        approved = self.action(plan, "approve").get_json()["plan"]
        self.assertEqual(self.action(approved, "publish").status_code, 200)
        with app.app_context():
            off = CurriculumOffering.query.filter_by(course_id=self.f.course_ids[0], semester="2nd Semester").one()
            offering_id, program_id, faculty_id, section = off.id, off.program_id, off.assigned_faculty_id, off.section
        url = f"/api/course-offerings/{offering_id}"
        other = self.f.faculty_b_id if faculty_id != self.f.faculty_b_id else self.f.faculty_a_id
        for body in ({"faculty_id": other}, {"section": "Q"}):
            result = self.coordinator.patch(url, json=body)
            self.assertEqual(result.status_code, 409, (body, result.get_json()))
        bulk = self.coordinator.patch("/api/course-offerings/bulk", json={
            "program_id": program_id, "term_id": self.term,
            "offerings": [{"id": offering_id, "faculty_id": other, "schedule": off.schedule or "", "section": section or ""}]})
        self.assertEqual(bulk.status_code, 409, bulk.get_json())
        same = self.coordinator.patch(url, json={"faculty_id": faculty_id, "section": section or ""})
        self.assertEqual(same.status_code, 200, same.get_json())

    def test_a_section_is_a_single_letter_a_to_z(self):
        with app.app_context():
            offering_id = CurriculumOffering.query.filter_by(course_id=self.f.course_ids[0], semester="2nd Semester").one().id
        url = f"/api/course-offerings/{offering_id}"
        for bad in ("AB", "1", "A-1", "ñ", "Sec A"):
            result = self.coordinator.patch(url, json={"section": bad})
            self.assertEqual(result.status_code, 400, (bad, result.get_json()))
            self.assertIn("A to Z", result.get_json()["error"])
        result = self.coordinator.patch(url, json={"section": " b "})
        self.assertEqual(result.status_code, 200, result.get_json())
        with app.app_context():
            self.assertEqual(db.session.get(CurriculumOffering, offering_id).section, "B")
        result = self.coordinator.patch(url, json={"section": ""})
        self.assertEqual(result.status_code, 200, result.get_json())
        with app.app_context():
            self.assertIsNone(db.session.get(CurriculumOffering, offering_id).section)

    def test_explicit_revision_rebuilds_changed_source_offerings(self):
        plan = self.ready_plan()
        with app.app_context():
            offering = CurriculumOffering.query.filter_by(course_id=self.f.course_ids[0], semester="2nd Semester").one()
            offering.assigned_faculty_id = self.f.faculty_b_id
            db.session.commit()
        result = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term, "action": "revise"})
        self.assertEqual(result.status_code, 200, result.get_json())
        revised = result.get_json()["plan"]
        self.assertNotEqual(revised["id"], plan["id"])
        self.assertEqual(next(s for s in revised["sections"] if s["course_id"] == self.f.course_ids[0])["faculty_id"], self.f.faculty_b_id)

    def test_offering_plan_publish_cannot_remove_scheduled_offering_history(self):
        self.ready_plan()
        with app.app_context():
            base.SubjectEnrollment.query.filter_by(term_id=self.term).delete()
            db.session.commit()
        self.f._approved_plan({self.f.course_ids[0]})
        result = self.f._plan_call("publish")
        self.assertEqual(result.status_code, 409, result.get_json())
        self.assertIn("schedule", str(result.get_json()).lower())

    def test_no_joint_timetable_explains_shared_constraints_even_when_each_class_has_an_option(self):
        self.ready_plan()
        current = self.faculty.get(self.url()).get_json()["availability"]
        limited = [{"weekday": day, "start": "07:30", "end": "09:00", "kind": "available"} for day in [1, 4]]
        self.assertEqual(self.submit(version=current["version"], windows=limited).status_code, 200)
        result = self.coordinator.post("/api/teaching-schedules", json={"term_id": self.term, "action": "revise"})
        self.assertEqual(result.status_code, 200)
        plan = result.get_json()["plan"]
        self.assertTrue(all(section["options"] for section in plan["sections"]))
        self.assertTrue(any("no combination" in error.lower() for error in plan["errors"]), plan["errors"])
        refreshed = self.coordinator.get(f"/api/teaching-schedules?term_id={self.term}").get_json()["plan"]
        self.assertTrue(any("no combination" in error.lower() for error in refreshed["errors"]))
        self.assertFalse(refreshed["search_limited"])
