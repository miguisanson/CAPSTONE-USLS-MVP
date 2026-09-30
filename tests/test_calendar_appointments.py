"""Calendar, availability, adviser appointment, invitations, reminders and the private feed.

Ground truth is the Graduate School research protocol (Designation of the Research Adviser,
the defense steps) and the audit `.planning/audit/research-workflows.md` (R01-R05, R17-R19,
R26-R27, R40 and "Requirements for a proper calendar and appointment experience").

The set-up (temp SQLite database, accounts, faculty, panels, schedules) is shared with
tests/test_research_core.py.
"""
import json
import unittest
from datetime import date, datetime, time, timedelta

from tests import test_research_core as rc
from tests.test_research_core import app, db, future_weekday

import app as app_module
from app import (
    Faculty,
    Form1Endorsement,
    PanelAssignment,
    ScheduleRequest,
    Student,
    Task,
    UserAccount,
)

TITLE = rc.TITLE
PROPOSAL = rc.PROPOSAL


class CalendarBase(rc.ResearchCoreBase):
    """Research-core fixture plus the extra people the calendar features need."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            self.dean_id = self._account("dean", "cal-dean@example.test").id
            # A faculty member who has entered nothing at all.
            self.unentered = self._faculty("Unentered Person", hours=False)
            db.session.commit()
            self.faculty_ids["Unentered Person"] = self.unentered.id
            self.faculty_account_ids["Unentered Person"] = UserAccount.query.filter_by(faculty_id=self.unentered.id).first().id

    def dean(self):
        return self.client(self.dean_id, "dean")

    def ready_for_title(self, names=None, endorsed_days_ago=40):
        with app.app_context():
            self.endorse(self.student_id)
            endorsement = Form1Endorsement.query.filter_by(student_id=self.student_id).one()
            endorsement.endorsed_at = datetime.now() - timedelta(days=endorsed_days_ago)
            self.fill_uploads(self.student_id, TITLE, status="Complete")
            self.panel(self.student_id, TITLE, names)
            db.session.commit()

    def book_title(self, **over):
        day = over.pop("day", future_weekday(21))
        payload = {
            "student_id": self.student_id, "preferred_date": day.isoformat(),
            "selected_start": "09:00", "selected_end": "11:00", "defense_type": "Title Defense",
            "mode": "Online", "venue": "Zoom room A",
        }
        payload.update(over)
        return self.staff().post("/api/transactions/defense-scheduling", json=payload)

    def check(self, **over):
        day = over.pop("day", future_weekday(21))
        payload = {
            "student_id": self.student_id, "preferred_date": day.isoformat(),
            "selected_start": "09:00", "selected_end": "11:00", "defense_type": "Title Defense",
            "venue": "Zoom room A",
        }
        payload.update(over)
        return self.staff().post("/api/defense-schedules/check", json=payload)


# ---------------------------------------------------------------------------
# 1. Availability
# ---------------------------------------------------------------------------
class AvailabilityEngineTests(CalendarBase):
    """R17/R18/R19: real availability, honoured on weekdays, nothing invented."""

    def test_a_faculty_member_with_nothing_entered_is_not_entered_and_never_free(self):
        response = self.faculty_client("Unentered Person").get("/api/faculty-portal/availability")
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertFalse(body["entered"])
        self.assertIsNone(body["updated_at"])
        self.assertFalse(any(day["enabled"] for day in body["working_hours"]))
        with app.app_context():
            state = app_module.faculty_day_availability(db.session.get(Faculty, self.faculty_ids["Unentered Person"]), future_weekday(10))
            self.assertFalse(state["entered"])
            self.assertEqual(state["windows"], [])

    def test_entering_weekly_hours_marks_availability_entered_and_stamps_the_update(self):
        client = self.faculty_client("Unentered Person")
        hours = [{"weekday": d, "start": "09:00", "end": "15:00", "enabled": d < 5} for d in range(7)]
        response = client.put("/api/faculty-portal/availability/working-hours", json={"hours": hours})
        self.assertEqual(response.status_code, 200, response.get_json())
        body = client.get("/api/faculty-portal/availability").get_json()
        self.assertTrue(body["entered"])
        self.assertIsNotNone(body["updated_at"])
        monday = next(day for day in body["working_hours"] if day["weekday"] == 0)
        self.assertEqual((monday["start"], monday["end"], monday["enabled"]), ("09:00", "15:00", True))
        with app.app_context():
            weekday = future_weekday(10)
            state = app_module.faculty_day_availability(db.session.get(Faculty, self.faculty_ids["Unentered Person"]), weekday)
            self.assertEqual(state["windows"], [(time(9, 0), time(15, 0))])
            saturday = weekday + timedelta(days=(5 - weekday.weekday()) % 7 or 7)
            self.assertEqual(app_module.faculty_day_availability(db.session.get(Faculty, self.faculty_ids["Unentered Person"]), saturday)["windows"], [])

    def test_weekly_hours_are_validated(self):
        client = self.faculty_client("Unentered Person")
        bad = [{"weekday": 0, "start": "15:00", "end": "09:00", "enabled": True}]
        response = client.put("/api/faculty-portal/availability/working-hours", json={"hours": bad})
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("after", response.get_json()["error"].lower())

    def test_a_dated_window_on_a_weekday_replaces_that_days_hours(self):
        """R18: a 09:00-10:00 window on a Wednesday used to be ignored and 08:00-17:00 offered."""
        day = future_weekday(14)
        while day.weekday() != 2:
            day += timedelta(days=1)
        client = self.faculty_client("Chair Person")
        response = client.post("/api/faculty-portal/availability/exceptions", json={
            "kind": "available", "start_date": day.isoformat(), "start": "09:00", "end": "10:00",
            "note": "Only free for one hour",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        with app.app_context():
            chair = db.session.get(Faculty, self.faculty_ids["Chair Person"])
            self.assertEqual(app_module.faculty_day_availability(chair, day)["windows"], [(time(9, 0), time(10, 0))])
            next_day = day + timedelta(days=1)
            self.assertEqual(app_module.faculty_day_availability(chair, next_day)["windows"], [(time(8, 0), time(17, 0))])

    def test_unavailable_dates_and_bulk_ranges_remove_the_day(self):
        start = future_weekday(14)
        end = start + timedelta(days=4)
        client = self.faculty_client("Chair Person")
        response = client.post("/api/faculty-portal/availability/exceptions", json={
            "kind": "unavailable", "start_date": start.isoformat(), "end_date": end.isoformat(), "note": "Conference",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        with app.app_context():
            chair = db.session.get(Faculty, self.faculty_ids["Chair Person"])
            day = start
            while day <= end:
                self.assertEqual(app_module.faculty_day_availability(chair, day)["windows"], [], day)
                day += timedelta(days=1)
            after = end + timedelta(days=1)
            while after.weekday() >= 5:
                after += timedelta(days=1)
            self.assertNotEqual(app_module.faculty_day_availability(chair, after)["windows"], [])

    def test_an_unavailable_part_of_a_day_is_cut_out_of_the_hours(self):
        day = future_weekday(14)
        client = self.faculty_client("Chair Person")
        client.post("/api/faculty-portal/availability/exceptions", json={
            "kind": "unavailable", "start_date": day.isoformat(), "start": "12:00", "end": "14:00", "note": "Class",
        })
        with app.app_context():
            chair = db.session.get(Faculty, self.faculty_ids["Chair Person"])
            self.assertEqual(
                app_module.faculty_day_availability(chair, day)["windows"],
                [(time(8, 0), time(12, 0)), (time(14, 0), time(17, 0))],
            )

    def test_exceptions_can_be_deleted_only_by_their_owner(self):
        day = future_weekday(14)
        client = self.faculty_client("Chair Person")
        created = client.post("/api/faculty-portal/availability/exceptions", json={
            "kind": "unavailable", "start_date": day.isoformat(), "note": "Leave",
        }).get_json()
        exception_id = created["exception"]["id"]
        other = self.faculty_client("Content Person").delete(f"/api/faculty-portal/availability/exceptions/{exception_id}")
        self.assertEqual(other.status_code, 404)
        own = client.delete(f"/api/faculty-portal/availability/exceptions/{exception_id}")
        self.assertEqual(own.status_code, 200)
        body = client.get("/api/faculty-portal/availability").get_json()
        self.assertEqual(body["exceptions"], [])

    def test_students_and_staff_cannot_use_the_faculty_editor(self):
        self.assertEqual(self.student().get("/api/faculty-portal/availability").status_code, 403)
        self.assertEqual(self.staff().put("/api/faculty-portal/availability/working-hours", json={"hours": []}).status_code, 403)

    def test_no_invented_busy_blocks_anywhere(self):
        """R19: 'Graduate class' / 'Department meeting' were generated from the faculty id."""
        with app.app_context():
            chair = db.session.get(Faculty, self.faculty_ids["Chair Person"])
            self.assertEqual(app_module.faculty_calendar_blocks(chair, date.today(), date.today() + timedelta(days=30)), [])
            profile = app_module.faculty_profile_dict(chair, include_calendar_events=True)
            self.assertEqual(profile["calendar_events"], [])
        body = self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()
        titles = {event.get("title") for event in body["faculty"]["calendar_events"]}
        self.assertFalse(titles & {"Graduate class", "Department meeting", "Student consultations", "Existing panel duty"})

    def test_creating_a_faculty_record_does_not_invent_working_hours(self):
        response = self.staff().post("/api/faculty", json={
            "full_name": "New Faculty Person", "department": "Graduate School", "status": "Active",
            "specialization": "Research", "email": "new.faculty.person@example.test",
            "eligible_roles": ["Faculty Adviser"], "temporary_password": "TempPass123!",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        faculty_id = response.get_json()["faculty"]["id"]
        with app.app_context():
            faculty = db.session.get(Faculty, faculty_id)
            self.assertFalse(app_module.faculty_day_availability(faculty, future_weekday(10))["entered"])
        self.assertEqual(response.get_json()["faculty"]["availability_status"], "Not entered")


class AvailabilityRequestTests(CalendarBase):
    """Staff ask the panel for availability and see who answered."""

    def test_staff_request_availability_and_see_who_answered(self):
        self.ready_for_title(["Chair Person", "Content Person", "Unentered Person"])
        window_start = future_weekday(14)
        window_end = window_start + timedelta(days=14)
        response = self.staff().post("/api/availability-requests", json={
            "student_id": self.student_id, "window_start": window_start.isoformat(),
            "window_end": window_end.isoformat(), "message": "Please enter your dates for the title defense.",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        listing = self.staff().get(f"/api/availability-requests?student_id={self.student_id}").get_json()
        names = {item["faculty_name"]: item for item in listing["requests"]}
        self.assertEqual(set(names), {"Chair Person", "Content Person", "Unentered Person", "Adviser Person"})
        self.assertTrue(all(item["status"] == "Open" for item in names.values()))
        self.assertFalse(names["Unentered Person"]["availability_entered"])
        # The faculty member sees the request and answers by entering availability.
        mine = self.faculty_client("Unentered Person").get("/api/faculty-portal/availability").get_json()
        self.assertEqual(len(mine["requests"]), 1)
        self.assertEqual(mine["requests"][0]["message"], "Please enter your dates for the title defense.")
        answered = self.faculty_client("Unentered Person").put("/api/faculty-portal/availability/working-hours", json={
            "hours": [{"weekday": d, "start": "09:00", "end": "16:00", "enabled": True} for d in range(5)],
        })
        self.assertEqual(answered.status_code, 200)
        # Another faculty member answers by confirming the hours already on record.
        keep = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/availability/requests/{names['Chair Person']['id']}/answer", json={},
        )
        self.assertEqual(keep.status_code, 200, keep.get_json())
        listing = self.staff().get(f"/api/availability-requests?student_id={self.student_id}").get_json()
        status = {item["faculty_name"]: item["status"] for item in listing["requests"]}
        self.assertEqual(status["Unentered Person"], "Answered")
        self.assertEqual(status["Chair Person"], "Answered")
        self.assertEqual(status["Content Person"], "Open")

    def test_only_scheduling_roles_can_request_availability(self):
        self.ready_for_title()
        denied = self.student().post("/api/availability-requests", json={"student_id": self.student_id})
        self.assertEqual(denied.status_code, 403)
        ok = self.research().post("/api/availability-requests", json={
            "student_id": self.student_id, "window_start": future_weekday(14).isoformat(),
            "window_end": future_weekday(28).isoformat(),
        })
        self.assertEqual(ok.status_code, 201, ok.get_json())

    def test_asking_twice_does_not_duplicate_open_requests(self):
        self.ready_for_title()
        body = {
            "student_id": self.student_id, "window_start": future_weekday(14).isoformat(),
            "window_end": future_weekday(28).isoformat(),
        }
        self.assertEqual(self.staff().post("/api/availability-requests", json=body).status_code, 201)
        self.assertEqual(self.staff().post("/api/availability-requests", json=body).status_code, 201)
        listing = self.staff().get(f"/api/availability-requests?student_id={self.student_id}").get_json()
        self.assertEqual(len([r for r in listing["requests"] if r["status"] == "Open"]), len(listing["requests"]))
        self.assertEqual(len(listing["requests"]), len({r["faculty_id"] for r in listing["requests"]}))


class ConflictWarningTests(CalendarBase):
    """Hard conflicts block; soft ones need a reason; 'not entered' is soft."""

    def test_a_clean_slot_has_no_warnings(self):
        self.ready_for_title()
        body = self.check().get_json()
        self.assertEqual(body["hard"], [], body)
        self.assertEqual(body["soft"], [], body)
        self.assertTrue(body["ok"])

    def test_past_slot_is_a_hard_conflict(self):
        self.ready_for_title()
        body = self.check(day=date.today() - timedelta(days=1)).get_json()
        self.assertTrue(any("past" in item.lower() for item in body["hard"]), body)
        self.assertFalse(body["ok"])

    def test_before_the_lead_time_is_soft(self):
        self.ready_for_title(endorsed_days_ago=2)
        body = self.check(day=future_weekday(3)).get_json()
        self.assertEqual(body["hard"], [], body)
        self.assertTrue(any("days after" in item for item in body["soft"]), body)

    def test_outside_a_panelists_entered_hours_is_hard(self):
        self.ready_for_title()
        body = self.check(selected_start="18:00", selected_end="19:30").get_json()
        self.assertTrue(any("not available" in item for item in body["hard"]), body)

    def test_a_panelist_who_marked_the_date_unavailable_is_hard(self):
        self.ready_for_title()
        day = future_weekday(21)
        self.faculty_client("Content Person").post("/api/faculty-portal/availability/exceptions", json={
            "kind": "unavailable", "start_date": day.isoformat(), "note": "Travel",
        })
        body = self.check(day=day).get_json()
        self.assertTrue(any("Content Person" in item and "not available" in item for item in body["hard"]), body)

    def test_a_panelist_with_nothing_entered_is_a_soft_warning_that_needs_a_reason(self):
        self.ready_for_title(["Chair Person", "Content Person", "Unentered Person"])
        body = self.check().get_json()
        self.assertEqual(body["hard"], [], body)
        self.assertTrue(any("Unentered Person" in item and "not entered" in item for item in body["soft"]), body)
        refused = self.book_title()
        self.assertEqual(refused.status_code, 400)
        self.assertIn("not entered", refused.get_json()["error"])
        no_reason = self.book_title(override_conflicts=True)
        self.assertEqual(no_reason.status_code, 400)
        self.assertIn("reason", no_reason.get_json()["error"].lower())
        accepted = self.book_title(override_conflicts=True, override_reason="Confirmed by phone with the panelist")
        self.assertEqual(accepted.status_code, 200, accepted.get_json())

    def test_a_double_booked_panelist_is_hard(self):
        self.ready_for_title()
        self.assertEqual(self.book_title().status_code, 200)
        with app.app_context():
            other = Student(
                student_number="GS-RC-0002", first_name="Second", last_name="Student", email="second@example.test",
                program_id=self.program_id, entry_year=2025, academic_year_entry="25-26", year_level="2",
                current_stage="Proposal Development", standing="Active", comprehensive_exam_status="Passed",
            )
            db.session.add(other)
            db.session.flush()
            self.panel(other.id, TITLE)
            rc_schedule = ScheduleRequest.query.filter_by(student_id=self.student_id).first()
            other_id = other.id
            db.session.commit()
            self.assertIsNotNone(rc_schedule)
        body = self.check(student_id=other_id, venue="Zoom room B").get_json()
        self.assertTrue(any("Panel conflict" in item for item in body["hard"]), body)

    def test_same_room_is_a_hard_conflict(self):
        self.ready_for_title()
        self.assertEqual(self.book_title().status_code, 200)
        with app.app_context():
            other = Student(
                student_number="GS-RC-0003", first_name="Third", last_name="Student", email="third@example.test",
                program_id=self.program_id, entry_year=2025, academic_year_entry="25-26", year_level="2",
                current_stage="Proposal Development", standing="Active", comprehensive_exam_status="Passed",
            )
            db.session.add(other)
            db.session.flush()
            self.panel(other.id, TITLE, ["Method Person", "External Person", "Spare Person"])
            other_id = other.id
            db.session.commit()
        body = self.check(student_id=other_id, venue="Zoom room A").get_json()
        self.assertTrue(any("Venue conflict" in item for item in body["hard"]), body)

    def test_check_is_limited_to_scheduling_roles(self):
        self.ready_for_title()
        self.assertEqual(self.student().post("/api/defense-schedules/check", json={"student_id": self.student_id}).status_code, 403)

    def test_the_scheduling_context_shows_who_has_entered_availability(self):
        self.ready_for_title(["Chair Person", "Content Person", "Unentered Person"])
        context = self.staff().get(f"/api/transactions/defense-scheduling/context?student_id={self.student_id}").get_json()
        participants = {item["name"]: item for item in context["availability"]["participants"]}
        self.assertFalse(participants["Unentered Person"]["availability_entered"])
        self.assertTrue(participants["Chair Person"]["availability_entered"])
        self.assertIn("Unentered Person", context["availability"]["missing_availability"])
        self.assertEqual(participants["Unentered Person"]["slots"], [])
        for participant in participants.values():
            self.assertEqual(participant["profile_busy"], [])



# ---------------------------------------------------------------------------
# 2. Adviser appointment (protocol: Designation of the Research Adviser)
# ---------------------------------------------------------------------------
class AdviserBase(CalendarBase):
    """A second student who has no adviser yet, with a login of their own."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            student = Student(
                student_number="GS-AD-0001", first_name="Newly", last_name="Advised", email="newly@example.test",
                program_id=self.program_id, entry_year=2025, academic_year_entry="25-26", year_level="2",
                current_stage="Proposal Development", standing="Active", comprehensive_exam_status="Passed",
            )
            db.session.add(student)
            db.session.flush()
            self.new_student_id = student.id
            self.new_student_account_id = self._account("student", "newly-login@example.test", student_id=student.id).id
            db.session.commit()

    def new_student(self):
        return self.client(self.new_student_account_id, "student")

    def apply(self, name="Chair Person", note="I would like to work with you.", client=None):
        return (client or self.new_student()).post(
            "/api/student-portal/adviser/apply", json={"faculty_id": self.faculty_ids[name], "note": note},
        )

    def appointment(self, appointment_id):
        with app.app_context():
            return db.session.get(app_module.AdviserAppointment, appointment_id)

    def walk_to_appointed(self, name="Chair Person", dean_body=None):
        applied = self.apply(name)
        self.assertEqual(applied.status_code, 201, applied.get_json())
        appointment_id = applied.get_json()["appointment"]["id"]
        noted = self.academic().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "Program-aligned."})
        self.assertEqual(noted.status_code, 200, noted.get_json())
        forwarded = self.research().post(f"/api/adviser-appointments/{appointment_id}/forward", json={})
        self.assertEqual(forwarded.status_code, 200, forwarded.get_json())
        decided = self.dean().post(
            f"/api/adviser-appointments/{appointment_id}/decision",
            json={"decision": "appoint", "note": "Approved by the Research Committee.", **(dean_body or {})},
        )
        self.assertEqual(decided.status_code, 200, decided.get_json())
        return appointment_id

    def walk_to_accepted(self, name="Chair Person"):
        appointment_id = self.walk_to_appointed(name)
        accepted = self.faculty_client(name).post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "accept"},
        )
        self.assertEqual(accepted.status_code, 200, accepted.get_json())
        return appointment_id


class AdviserAppointmentFlowTests(AdviserBase):
    def test_the_full_protocol_flow_ends_with_the_adviser_everywhere(self):
        """Form 3 -> AC notes -> RC forwards -> Dean appoints (Form 3.1) -> adviser accepts -> contract."""
        tracker = self.new_student().get("/api/student-portal/adviser").get_json()
        self.assertIsNone(tracker["current"])
        self.assertTrue(tracker["can_apply"])
        self.assertEqual(tracker["rules"]["max_advisees"], 5)
        self.assertEqual(tracker["rules"]["contract_days"], 5)

        applied = self.apply()
        self.assertEqual(applied.status_code, 201, applied.get_json())
        appointment_id = applied.get_json()["appointment"]["id"]
        self.assertEqual(applied.get_json()["appointment"]["status"], "Applied")
        with app.app_context():
            self.assertTrue(Task.query.filter_by(student_id=self.new_student_id, owner_role="Academic Coordinator", status="Pending").count())

        self.academic().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "Aligned with the program."})
        self.assertEqual(self.appointment(appointment_id).status, "Noted by AC")
        self.research().post(f"/api/adviser-appointments/{appointment_id}/forward", json={})
        self.assertEqual(self.appointment(appointment_id).status, "Under deliberation")
        decided = self.dean().post(f"/api/adviser-appointments/{appointment_id}/decision", json={
            "decision": "appoint", "note": "Approved", "associate_dean": "Dr. Associate Dean",
        })
        self.assertEqual(decided.status_code, 200, decided.get_json())
        row = self.appointment(appointment_id)
        self.assertEqual(row.status, "Appointed")
        self.assertEqual(row.form31_issued_on, date.today())
        self.assertEqual(row.contract_due_on, date.today() + timedelta(days=5))
        with app.app_context():
            # Not the adviser yet: the adviser has to accept Form 3.1 first.
            self.assertFalse(app_module.faculty_is_adviser_for_student(self.faculty_ids["Chair Person"], self.new_student_id))

        accepted = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "accept"},
        )
        self.assertEqual(accepted.status_code, 200, accepted.get_json())
        self.assertEqual(self.appointment(appointment_id).status, "Accepted")
        with app.app_context():
            student = db.session.get(Student, self.new_student_id)
            self.assertEqual(student.adviser_name, "Chair Person")
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Chair Person"], self.new_student_id))
            self.assertIn(self.faculty_ids["Chair Person"], app_module.student_adviser_faculty_ids(student))
            self.assertIn(self.faculty_ids["Chair Person"], app_module.student_advisers(student))
            with self.assertRaises(ValueError):
                app_module.validate_panel_selection(
                    student, TITLE, [self.faculty_ids["Chair Person"], self.faculty_ids["Content Person"], self.faculty_ids["Method Person"]],
                )

        # Forms 3.2 / 3.3 are emailed to the Research Coordinator within 5 days of Form 3.1.
        submitted = self.new_student().post(f"/api/student-portal/adviser/{appointment_id}/contract", json={"note": "Emailed today"})
        self.assertEqual(submitted.status_code, 200, submitted.get_json())
        received = self.research().post(f"/api/adviser-appointments/{appointment_id}/contract-received", json={})
        self.assertEqual(received.status_code, 200, received.get_json())
        row = self.appointment(appointment_id)
        self.assertIsNotNone(row.contract_submitted_at)
        self.assertIsNotNone(row.contract_received_at)
        tracker = self.new_student().get("/api/student-portal/adviser").get_json()
        self.assertEqual(tracker["current"]["faculty_name"], "Chair Person")
        self.assertEqual(tracker["current"]["contract"]["status"], "Received")

    def test_steps_must_happen_in_the_protocol_order_by_the_right_role(self):
        appointment_id = self.apply().get_json()["appointment"]["id"]
        # the Research Coordinator cannot forward before the Academic Coordinator has noted it
        self.assertEqual(self.research().post(f"/api/adviser-appointments/{appointment_id}/forward", json={}).status_code, 409)
        # the Dean cannot decide before it is under deliberation
        early = self.dean().post(f"/api/adviser-appointments/{appointment_id}/decision", json={"decision": "appoint"})
        self.assertEqual(early.status_code, 409)
        # the adviser cannot accept before Form 3.1 is issued
        self.assertEqual(self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "accept"}).status_code, 409)
        # wrong roles
        self.assertEqual(self.student().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "x"}).status_code, 403)
        self.assertEqual(self.staff().post(f"/api/adviser-appointments/{appointment_id}/decision", json={"decision": "appoint"}).status_code, 403)
        self.academic().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "ok"})
        self.assertEqual(self.academic().post(f"/api/adviser-appointments/{appointment_id}/forward", json={}).status_code, 403)

    def test_only_the_nominated_adviser_can_respond(self):
        appointment_id = self.walk_to_appointed()
        wrong = self.faculty_client("Content Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "accept"},
        )
        self.assertEqual(wrong.status_code, 404)

    def test_one_open_application_at_a_time_and_none_once_an_adviser_is_accepted(self):
        self.assertEqual(self.apply().status_code, 201)
        self.assertEqual(self.apply("Content Person").status_code, 409)

    def test_the_adviser_can_decline_and_the_student_can_nominate_someone_else(self):
        appointment_id = self.walk_to_appointed()
        no_reason = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "decline"},
        )
        self.assertEqual(no_reason.status_code, 400)
        declined = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond",
            json={"response": "decline", "reason": "Already at capacity with other duties"},
        )
        self.assertEqual(declined.status_code, 200, declined.get_json())
        self.assertEqual(self.appointment(appointment_id).status, "Declined")
        with app.app_context():
            self.assertFalse(app_module.faculty_is_adviser_for_student(self.faculty_ids["Chair Person"], self.new_student_id))
        self.assertEqual(self.apply("Content Person").status_code, 201)

    def test_the_dean_can_decline_to_appoint_with_a_reason(self):
        appointment_id = self.apply().get_json()["appointment"]["id"]
        self.academic().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "ok"})
        self.research().post(f"/api/adviser-appointments/{appointment_id}/forward", json={})
        no_reason = self.dean().post(f"/api/adviser-appointments/{appointment_id}/decision", json={"decision": "return"})
        self.assertEqual(no_reason.status_code, 400)
        returned = self.dean().post(
            f"/api/adviser-appointments/{appointment_id}/decision", json={"decision": "return", "note": "Choose a PhD holder"},
        )
        self.assertEqual(returned.status_code, 200, returned.get_json())
        self.assertEqual(self.appointment(appointment_id).status, "Not approved")
        self.assertEqual(self.apply("Content Person").status_code, 201)

    def test_the_student_can_withdraw_an_open_application(self):
        appointment_id = self.apply().get_json()["appointment"]["id"]
        self.assertEqual(self.new_student().post(f"/api/student-portal/adviser/{appointment_id}/withdraw", json={}).status_code, 200)
        self.assertEqual(self.appointment(appointment_id).status, "Withdrawn")

    def test_cap_of_five_advisees_blocks_the_appointment_unless_the_dean_records_an_exception(self):
        with app.app_context():
            for index in range(5):
                other = Student(
                    student_number=f"GS-CAP-{index}", first_name=f"Cap{index}", last_name="Student",
                    email=f"cap{index}@example.test", program_id=self.program_id, entry_year=2025,
                    academic_year_entry="25-26", year_level="2", current_stage="Proposal Development",
                    standing="Active", comprehensive_exam_status="Passed",
                )
                db.session.add(other)
                db.session.flush()
                db.session.add(app_module.AdviserAppointment(
                    student_id=other.id, faculty_id=self.faculty_ids["Spare Person"], kind="Recorded",
                    status="Accepted", adviser_response="Accepted", source="test",
                ))
            db.session.commit()
        meter = self.faculty_client("Spare Person").get("/api/faculty-portal/adviser-requests").get_json()["meter"]
        self.assertEqual((meter["active"], meter["max"]), (5, 5))
        appointment_id = self.apply("Spare Person").get_json()["appointment"]["id"]
        self.academic().post(f"/api/adviser-appointments/{appointment_id}/note", json={"note": "ok"})
        self.research().post(f"/api/adviser-appointments/{appointment_id}/forward", json={})
        blocked = self.dean().post(f"/api/adviser-appointments/{appointment_id}/decision", json={"decision": "appoint", "note": "Go"})
        self.assertEqual(blocked.status_code, 400)
        self.assertIn("5", blocked.get_json()["error"])
        allowed = self.dean().post(
            f"/api/adviser-appointments/{appointment_id}/decision",
            json={"decision": "appoint", "note": "Exceptional fit", "cap_exception": True},
        )
        self.assertEqual(allowed.status_code, 200, allowed.get_json())
        self.assertTrue(self.appointment(appointment_id).cap_exception)

    def test_the_candidate_list_shows_each_faculty_members_advisee_meter(self):
        body = self.new_student().get("/api/student-portal/adviser").get_json()
        chair = next(item for item in body["candidates"] if item["name"] == "Chair Person")
        self.assertEqual(chair["max_advisees"], 5)
        self.assertEqual(chair["advisees"], 0)
        self.assertTrue(chair["available"])

    def test_contract_forms_become_overdue_after_five_days(self):
        appointment_id = self.walk_to_accepted()
        with app.app_context():
            row = db.session.get(app_module.AdviserAppointment, appointment_id)
            row.form31_issued_on = date.today() - timedelta(days=8)
            row.contract_due_on = date.today() - timedelta(days=3)
            db.session.commit()
        tracker = self.new_student().get("/api/student-portal/adviser").get_json()
        self.assertEqual(tracker["current"]["contract"]["status"], "Overdue")

    def test_the_adviser_inbox_lists_requests_and_advisees(self):
        appointment_id = self.walk_to_appointed()
        body = self.faculty_client("Chair Person").get("/api/faculty-portal/adviser-requests").get_json()
        self.assertEqual([item["id"] for item in body["inbox"]], [appointment_id])
        self.assertEqual(body["inbox"][0]["student_name"], "Newly Advised")
        self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{appointment_id}/respond", json={"response": "accept"})
        body = self.faculty_client("Chair Person").get("/api/faculty-portal/adviser-requests").get_json()
        self.assertEqual(body["inbox"], [])
        self.assertEqual([item["student_name"] for item in body["advisees"]], ["Newly Advised"])
        self.assertEqual(body["meter"], {"active": 1, "max": 5, "pending": 0})

    def test_the_coordinator_queue_shows_the_applications_for_each_role(self):
        self.apply()
        for client in (self.academic(), self.research(), self.staff(), self.dean()):
            body = client.get("/api/adviser-appointments").get_json()
            self.assertEqual(len(body["appointments"]), 1)
        self.assertEqual(self.student().get("/api/adviser-appointments").status_code, 403)
        ac_view = self.academic().get("/api/adviser-appointments").get_json()["appointments"][0]
        self.assertEqual(ac_view["actions"], ["note"])
        rc_view = self.research().get("/api/adviser-appointments").get_json()["appointments"][0]
        self.assertEqual(rc_view["actions"], [])

    def test_eligibility_warnings_name_the_missing_phd_for_doctoral_students(self):
        with app.app_context():
            program = db.session.get(app_module.Program, self.program_id)
            program.name = "Doctor of Philosophy in Research"
            db.session.commit()
        appointment_id = self.apply().get_json()["appointment"]["id"]
        body = self.academic().get("/api/adviser-appointments").get_json()["appointments"][0]
        self.assertTrue(any("PhD" in item for item in body["warnings"]), body)


class AdviserChangeTests(AdviserBase):
    def walk_change_to_dean(self, reason="Research direction changed"):
        first = self.walk_to_accepted("Chair Person")
        changed = self.new_student().post("/api/student-portal/adviser/change", json={
            "faculty_id": self.faculty_ids["Content Person"], "reason": reason,
        })
        self.assertEqual(changed.status_code, 201, changed.get_json())
        change_id = changed.get_json()["appointment"]["id"]
        return first, change_id

    def test_a_change_needs_a_reason_and_both_advisers_to_agree(self):
        first, change_id = self.walk_change_to_dean()
        self.assertEqual(self.appointment(change_id).kind, "Change")
        # the Research Coordinator cannot forward until both advisers have signed Form 3.1.1
        self.assertEqual(self.research().post(f"/api/adviser-appointments/{change_id}/forward", json={}).status_code, 409)
        current = self.faculty_client("Chair Person").get("/api/faculty-portal/adviser-requests").get_json()
        self.assertEqual([item["id"] for item in current["consents"]], [change_id])
        self.assertEqual(self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/adviser-requests/{change_id}/consent", json={"consent": "yes"}).status_code, 200)
        self.assertEqual(self.research().post(f"/api/adviser-appointments/{change_id}/forward", json={}).status_code, 409)
        self.assertEqual(self.faculty_client("Content Person").post(
            f"/api/faculty-portal/adviser-requests/{change_id}/respond", json={"response": "accept"}).status_code, 200)
        self.assertEqual(self.research().post(f"/api/adviser-appointments/{change_id}/forward", json={}).status_code, 200)
        decided = self.dean().post(f"/api/adviser-appointments/{change_id}/decision", json={"decision": "appoint", "note": "Approved"})
        self.assertEqual(decided.status_code, 200, decided.get_json())
        new = self.appointment(change_id)
        old = self.appointment(first)
        self.assertEqual(new.status, "Accepted")
        self.assertEqual(old.status, "Ended")
        self.assertEqual(old.end_reason, "Research direction changed")
        with app.app_context():
            student = db.session.get(Student, self.new_student_id)
            self.assertEqual(student.adviser_name, "Content Person")
            self.assertFalse(app_module.faculty_is_adviser_for_student(self.faculty_ids["Chair Person"], self.new_student_id))
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Content Person"], self.new_student_id))
            self.assertEqual(app_module.AdviserAssignment.query.filter_by(student_id=self.new_student_id, status="Active").count(), 1)

    def test_a_change_without_a_reason_is_refused(self):
        self.walk_to_accepted("Chair Person")
        response = self.new_student().post("/api/student-portal/adviser/change", json={"faculty_id": self.faculty_ids["Content Person"]})
        self.assertEqual(response.status_code, 400)

    def test_only_one_change_is_allowed(self):
        first, change_id = self.walk_change_to_dean()
        self.faculty_client("Chair Person").post(f"/api/faculty-portal/adviser-requests/{change_id}/consent", json={"consent": "yes"})
        self.faculty_client("Content Person").post(f"/api/faculty-portal/adviser-requests/{change_id}/respond", json={"response": "accept"})
        self.research().post(f"/api/adviser-appointments/{change_id}/forward", json={})
        self.dean().post(f"/api/adviser-appointments/{change_id}/decision", json={"decision": "appoint", "note": "Approved"})
        again = self.new_student().post("/api/student-portal/adviser/change", json={
            "faculty_id": self.faculty_ids["Method Person"], "reason": "Another change",
        })
        self.assertEqual(again.status_code, 409)
        self.assertIn("once", again.get_json()["error"].lower())

    def test_no_change_after_the_proposal_defense(self):
        self.walk_to_accepted("Chair Person")
        with app.app_context():
            self.schedule(self.new_student_id, "Proposal Defense", status="Held")
            db.session.commit()
        response = self.new_student().post("/api/student-portal/adviser/change", json={
            "faculty_id": self.faculty_ids["Content Person"], "reason": "Late change",
        })
        self.assertEqual(response.status_code, 409)
        self.assertIn("proposal", response.get_json()["error"].lower())

    def test_a_change_needs_a_current_adviser(self):
        response = self.new_student().post("/api/student-portal/adviser/change", json={
            "faculty_id": self.faculty_ids["Content Person"], "reason": "x reason",
        })
        self.assertEqual(response.status_code, 409)


class AdviserMigrationTests(AdviserBase):
    def test_existing_advisers_are_migrated_safely_and_only_once(self):
        """The base student has a free-text adviser plus an AdviserAssignment and no appointment yet."""
        with app.app_context():
            self.assertEqual(app_module.AdviserAppointment.query.filter_by(student_id=self.student_id).count(), 0)
            # legacy data still works before the migration runs
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Adviser Person"], self.student_id))
            created = app_module.migrate_adviser_appointments()
            self.assertEqual(created, 1)
            rows = app_module.AdviserAppointment.query.filter_by(student_id=self.student_id).all()
            self.assertEqual([(r.status, r.kind, r.faculty_id) for r in rows], [("Accepted", "Recorded", self.faculty_ids["Adviser Person"])])
            self.assertIn("Migrated", rows[0].source)
            self.assertEqual(app_module.migrate_adviser_appointments(), 0)
            student = db.session.get(Student, self.student_id)
            self.assertEqual(student.adviser_name, "Adviser Person")
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Adviser Person"], self.student_id))
        tracker = self.student().get("/api/student-portal/adviser").get_json()
        self.assertEqual(tracker["current"]["faculty_name"], "Adviser Person")
        self.assertFalse(tracker["can_apply"])
        self.assertTrue(tracker["can_request_change"])

    def test_a_student_without_any_adviser_is_left_alone(self):
        with app.app_context():
            app_module.migrate_adviser_appointments()
            self.assertEqual(app_module.AdviserAppointment.query.filter_by(student_id=self.new_student_id).count(), 0)

    def test_the_research_coordinator_can_record_an_existing_appointment(self):
        response = self.research().post("/api/adviser-appointments/record", json={
            "student_id": self.new_student_id, "faculty_id": self.faculty_ids["Content Person"],
            "appointed_on": (date.today() - timedelta(days=30)).isoformat(), "note": "Form 3.1 on file",
        })
        self.assertEqual(response.status_code, 201, response.get_json())
        with app.app_context():
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Content Person"], self.new_student_id))
            self.assertEqual(db.session.get(Student, self.new_student_id).adviser_name, "Content Person")
        again = self.research().post("/api/adviser-appointments/record", json={
            "student_id": self.new_student_id, "faculty_id": self.faculty_ids["Method Person"],
        })
        self.assertEqual(again.status_code, 409)
        self.assertEqual(self.student().post("/api/adviser-appointments/record", json={}).status_code, 403)

    def test_editing_the_adviser_on_the_monitoring_sheet_records_an_appointment(self):
        with app.app_context():
            student = db.session.get(Student, self.new_student_id)
            app_module.record_adviser_from_name(student, "Content Person", "Test Staff")
            db.session.commit()
            self.assertTrue(app_module.faculty_is_adviser_for_student(self.faculty_ids["Content Person"], self.new_student_id))
            self.assertEqual(app_module.AdviserAppointment.query.filter_by(student_id=self.new_student_id, status="Accepted").count(), 1)


# ---------------------------------------------------------------------------
# 3. Calendar pages (one API for every role), deadlines, .ics
# ---------------------------------------------------------------------------
FOUR = ["Chair Person", "Content Person", "Method Person", "External Person"]


class CalendarDataBase(CalendarBase):
    def setUp(self):
        super().setUp()
        with app.app_context():
            other = Student(
                student_number="GS-CAL-0002", first_name="Other", last_name="Learner", email="other-learner@example.test",
                program_id=self.program_id, entry_year=2025, academic_year_entry="25-26", year_level="2",
                current_stage="Proposal Development", standing="Active", comprehensive_exam_status="Passed",
            )
            db.session.add(other)
            db.session.flush()
            self.other_student_id = other.id
            self.other_account_id = self._account("student", "other-learner-login@example.test", student_id=other.id).id
            db.session.commit()

    def other_student(self):
        return self.client(self.other_account_id, "student")

    def ready_for_proposal(self):
        with app.app_context():
            self.pass_gate(self.student_id, TITLE, "Title Defense")
            self.fill_uploads(self.student_id, PROPOSAL, status="Complete")
            self.panel(self.student_id, PROPOSAL, FOUR)
            db.session.commit()

    def book_proposal(self, day=None, **over):
        day = day or future_weekday(21)
        payload = {
            "student_id": self.student_id, "preferred_date": day.isoformat(), "selected_start": "09:00",
            "selected_end": "11:00", "defense_type": "Proposal Defense", "mode": "Online", "venue": "Zoom room A",
        }
        payload.update(over)
        response = self.staff().post("/api/transactions/defense-scheduling", json=payload)
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            return ScheduleRequest.query.filter_by(student_id=self.student_id, defense_type="Proposal Defense").order_by(ScheduleRequest.id.desc()).first().id

    def calendar(self, client, **params):
        query = "&".join(f"{key}={value}" for key, value in params.items())
        response = client.get(f"/api/calendar?{query}")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def window(self, day, before=10, after=40):
        return {"start": (day - timedelta(days=before)).isoformat(), "end": (day + timedelta(days=after)).isoformat()}


class CalendarEventTests(CalendarDataBase):
    def test_staff_calendar_lists_every_defense_with_the_facts_a_coordinator_needs(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        schedule_id = self.book_proposal(day)
        body = self.calendar(self.staff(), **self.window(day))
        self.assertEqual(body["timezone"], "Asia/Manila")
        events = [event for event in body["events"] if event["kind"] == "defense"]
        self.assertEqual([event["schedule_id"] for event in events], [schedule_id])
        event = events[0]
        self.assertEqual(event["defense_type"], "Proposal Defense")
        self.assertEqual(event["status"], "Scheduled")
        self.assertEqual(event["start"], f"{day.isoformat()}T09:00:00")
        self.assertEqual(event["end"], f"{day.isoformat()}T11:00:00")
        self.assertEqual(event["venue"], "Zoom room A")
        self.assertEqual(event["student_name"], "Research Student")
        self.assertEqual({seat["role"] for seat in event["panel"]}, {"Panel Chair", "Content Specialist", "Method Specialist", "External Panel"})
        self.assertIn("Adviser Person", event["adviser"])
        self.assertIn("programs", body["filters"])
        self.assertIn("statuses", body["filters"])

    def test_the_range_limits_what_is_returned(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        self.book_proposal(day)
        far = self.calendar(self.staff(), start=(day + timedelta(days=60)).isoformat(), end=(day + timedelta(days=90)).isoformat())
        self.assertEqual([e for e in far["events"] if e["kind"] == "defense"], [])

    def test_filters_narrow_the_calendar(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        self.book_proposal(day)
        window = self.window(day)
        hit = self.calendar(self.staff(), **window, defense_type="Proposal Defense", program_id=self.program_id,
                            faculty_id=self.faculty_ids["Chair Person"], venue="zoom")
        self.assertEqual(len([e for e in hit["events"] if e["kind"] == "defense"]), 1)
        for miss in ({"defense_type": "Final Defense"}, {"program_id": self.program_id + 99},
                     {"faculty_id": self.faculty_ids["Spare Person"]}, {"venue": "Room 12"}, {"q": "Nobody"}):
            body = self.calendar(self.staff(), **window, **miss)
            self.assertEqual([e for e in body["events"] if e["kind"] == "defense"], [], miss)

    def test_cancelled_and_replaced_bookings_are_hidden_unless_asked_for(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        schedule_id = self.book_proposal(day)
        self.staff().post(f"/api/defense-schedules/{schedule_id}/cancel", json={"reason": "Room unavailable", "requested_by": "GS Office"})
        window = self.window(day)
        self.assertEqual([e for e in self.calendar(self.staff(), **window)["events"] if e["kind"] == "defense"], [])
        shown = self.calendar(self.staff(), **window, status="Cancelled")
        self.assertEqual([e["status"] for e in shown["events"] if e["kind"] == "defense"], ["Cancelled"])
        everything = self.calendar(self.staff(), **window, status="all")
        self.assertEqual(len([e for e in everything["events"] if e["kind"] == "defense"]), 1)

    def test_each_role_sees_only_what_it_should(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        self.book_proposal(day)
        window = self.window(day)

        def defenses(client):
            return [e for e in self.calendar(client, **window)["events"] if e["kind"] == "defense"]

        self.assertEqual(len(defenses(self.student())), 1)
        self.assertEqual(defenses(self.other_student()), [])
        chair = defenses(self.faculty_client("Chair Person"))
        self.assertEqual([e["my_role"] for e in chair], ["Panel Chair"])
        adviser = defenses(self.faculty_client("Adviser Person"))
        self.assertEqual([e["my_role"] for e in adviser], ["Research Adviser"])
        self.assertEqual(defenses(self.faculty_client("Spare Person")), [])
        self.assertEqual(len(defenses(self.dean())), 1)
        self.assertEqual(len(defenses(self.academic())), 1)
        self.assertEqual(len(defenses(self.research())), 1)

    def test_a_finished_defense_with_no_verdict_is_flagged_overdue(self):
        self.ready_for_proposal()
        with app.app_context():
            self.schedule(self.student_id, "Proposal Defense", day=date.today() - timedelta(days=4), names=FOUR)
            db.session.commit()
        body = self.calendar(self.staff(), start=(date.today() - timedelta(days=10)).isoformat(), end=date.today().isoformat())
        events = [e for e in body["events"] if e["defense_type"] == "Proposal Defense"]
        self.assertEqual(len(events), 1)
        self.assertTrue(events[0]["verdict_overdue"])
        title = [e for e in body["events"] if e["defense_type"] == "Title Defense"]
        self.assertFalse(title[0]["verdict_overdue"])  # held, verdict recorded

    def test_the_faculty_availability_layer_shows_entered_hours_and_unavailable_dates(self):
        day = future_weekday(14)
        client = self.faculty_client("Chair Person")
        client.post("/api/faculty-portal/availability/exceptions", json={"kind": "unavailable", "start_date": day.isoformat(), "note": "Travel"})
        body = self.calendar(client, **self.window(day, 2, 2), layers="availability")
        layer = {entry["date"]: entry for entry in body["availability"]}
        self.assertEqual(layer[day.isoformat()]["windows"], [])
        self.assertEqual(layer[day.isoformat()]["blocked"][0]["note"], "Travel")
        other = day + timedelta(days=1)
        while other.weekday() >= 5:
            other += timedelta(days=1)
        self.assertEqual(layer[other.isoformat()]["windows"], [{"start": "08:00", "end": "17:00"}])
        unentered = self.calendar(self.faculty_client("Unentered Person"), **self.window(day, 2, 2), layers="availability")
        self.assertTrue(all(entry["entered"] is False for entry in unentered["availability"]))

    def test_the_calendar_needs_a_sign_in(self):
        self.assertEqual(app.test_client().get("/api/calendar").status_code, 401)


class DeadlineOverlayTests(CalendarDataBase):
    def deadlines(self, client, day, **extra):
        body = self.calendar(client, **self.window(day, 40, 60), layers="deadlines", **extra)
        return {item["kind"]: item for item in body["deadlines"]}

    def test_a_proposal_defense_brings_its_protocol_deadlines(self):
        self.ready_for_proposal()
        day = future_weekday(28)
        self.book_proposal(day)
        found = self.deadlines(self.staff(), day)
        self.assertEqual(found["manuscript_to_panel"]["date"], (day - timedelta(days=14)).isoformat())
        after = day + timedelta(days=1)
        while after.weekday() >= 5:
            after += timedelta(days=1)
        self.assertEqual(found["verdict_due"]["date"], after.isoformat())
        self.assertEqual(found["fee_receipt_due"]["date"], after.isoformat())
        self.assertEqual(found["manuscript_to_panel"]["student_name"], "Research Student")

    def test_a_title_defense_needs_form_1_fourteen_days_before(self):
        self.ready_for_title()
        day = future_weekday(28)
        self.assertEqual(self.book_title(day=day).status_code, 200)
        found = self.deadlines(self.staff(), day)
        self.assertEqual(found["form1_due"]["date"], (day - timedelta(days=14)).isoformat())
        self.assertTrue(found["form1_due"]["done"])  # the Academic Coordinator already endorsed it

    def test_the_ethics_window_opens_after_a_held_proposal_defense(self):
        self.ready_for_proposal()
        held_day = date.today() - timedelta(days=5)
        with app.app_context():
            self.schedule(self.student_id, "Proposal Defense", status="Held", day=held_day, names=FOUR)
            db.session.commit()
        body = self.calendar(self.staff(), start=held_day.isoformat(), end=(held_day + timedelta(days=45)).isoformat(), layers="deadlines")
        ethics = [d for d in body["deadlines"] if d["kind"] == "ethics_due"]
        self.assertEqual([d["date"] for d in ethics], [(held_day + timedelta(days=30)).isoformat()])

    def test_the_adviser_contract_due_date_is_a_deadline_for_the_student_and_the_adviser(self):
        with app.app_context():
            row = app_module.AdviserAppointment(
                student_id=self.student_id, faculty_id=self.faculty_ids["Chair Person"], kind="Recorded",
                status="Accepted", adviser_response="Accepted", form31_issued_on=date.today(),
                contract_due_on=date.today() + timedelta(days=5), source="test",
            )
            db.session.add(row)
            db.session.commit()
        window = {"start": date.today().isoformat(), "end": (date.today() + timedelta(days=10)).isoformat(), "layers": "deadlines"}
        for client in (self.student(), self.faculty_client("Chair Person"), self.staff()):
            kinds = [d["kind"] for d in self.calendar(client, **window)["deadlines"]]
            self.assertIn("adviser_contract_due", kinds)
        self.assertNotIn("adviser_contract_due", [d["kind"] for d in self.calendar(self.other_student(), **window)["deadlines"]])

    def test_students_only_get_their_own_deadlines(self):
        self.ready_for_proposal()
        day = future_weekday(28)
        self.book_proposal(day)
        mine = self.deadlines(self.student(), day)
        self.assertIn("manuscript_to_panel", mine)
        self.assertEqual(self.deadlines(self.other_student(), day), {})


class StudentResearchCalendarTests(CalendarDataBase):
    def test_the_student_sees_the_next_defense_with_a_countdown_and_the_next_deadlines(self):
        self.ready_for_proposal()
        day = future_weekday(28)
        schedule_id = self.book_proposal(day)
        body = self.student().get("/api/student-portal/research-calendar").get_json()
        self.assertEqual(body["timezone"], "Asia/Manila")
        self.assertEqual(body["next_defense"]["schedule_id"], schedule_id)
        self.assertEqual(body["next_defense"]["countdown_days"], (day - date.today()).days)
        self.assertEqual(body["next_defense"]["ics_url"], f"/api/defense-schedules/{schedule_id}/event.ics")
        self.assertTrue(body["next_defense"]["panel"])
        self.assertIn("manuscript_to_panel", [d["kind"] for d in body["deadlines"]])
        self.assertEqual(self.other_student().get("/api/student-portal/research-calendar").get_json()["next_defense"], None)

    def test_a_single_defense_can_be_added_to_any_calendar_app(self):
        self.ready_for_proposal()
        day = future_weekday(28)
        schedule_id = self.book_proposal(day)
        response = self.student().get(f"/api/defense-schedules/{schedule_id}/event.ics")
        self.assertEqual(response.status_code, 200)
        self.assertIn("text/calendar", response.headers["Content-Type"])
        text_body = response.get_data(as_text=True)
        self.assertIn("BEGIN:VCALENDAR", text_body)
        self.assertIn("TZID:Asia/Manila", text_body)
        self.assertIn(f"DTSTART;TZID=Asia/Manila:{day.strftime('%Y%m%d')}T090000", text_body)
        self.assertIn(f"DTEND;TZID=Asia/Manila:{day.strftime('%Y%m%d')}T110000", text_body)
        self.assertIn("SUMMARY:Proposal Defense", text_body)
        self.assertIn("LOCATION:Zoom room A", text_body)
        self.assertIn("BEGIN:VALARM", text_body)
        self.assertEqual(self.other_student().get(f"/api/defense-schedules/{schedule_id}/event.ics").status_code, 404)
        self.assertEqual(self.faculty_client("Chair Person").get(f"/api/defense-schedules/{schedule_id}/event.ics").status_code, 200)
        self.assertEqual(self.faculty_client("Spare Person").get(f"/api/defense-schedules/{schedule_id}/event.ics").status_code, 404)
        self.assertEqual(app.test_client().get(f"/api/defense-schedules/{schedule_id}/event.ics").status_code, 401)


class FacultyDashboardTests(CalendarDataBase):
    def test_upcoming_defenses_leave_out_finished_and_past_ones(self):
        self.ready_for_proposal()
        future = future_weekday(21)
        self.book_proposal(future)
        with app.app_context():
            # an older, finished title defense the same faculty member sat on
            old = ScheduleRequest.query.filter_by(student_id=self.student_id, defense_type="Title Defense").first()
            self.assertEqual(old.status, "Held")
        body = self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()
        upcoming = body["upcoming_defenses"]
        self.assertEqual([item["defense"]["defense_type"] for item in upcoming], ["Proposal Defense"])
        self.assertEqual(upcoming[0]["my_role"], "Panel Chair")
