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


# ---------------------------------------------------------------------------
# 4. Panel invitations
# ---------------------------------------------------------------------------
class PanelInvitationTests(CalendarDataBase):
    def invitations(self, name):
        response = self.faculty_client(name).get("/api/faculty-portal/panel-invitations")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()["invitations"]

    def test_every_panel_seat_shows_up_as_an_invitation_for_that_faculty_member(self):
        self.ready_for_title()
        mine = self.invitations("Chair Person")
        self.assertEqual(len(mine), 1)
        self.assertEqual((mine[0]["status"], mine[0]["panel_role"], mine[0]["defense_type"]), ("Invited", "Panel Chair", "Title Defense"))
        self.assertEqual(mine[0]["student"]["name"], "Research Student")
        self.assertEqual(self.invitations("Spare Person"), [])

    def test_a_faculty_member_can_accept(self):
        self.ready_for_title()
        invitation = self.invitations("Content Person")[0]
        response = self.faculty_client("Content Person").post(
            f"/api/faculty-portal/panel-invitations/{invitation['id']}/respond", json={"response": "accept"})
        self.assertEqual(response.status_code, 200, response.get_json())
        self.assertEqual(self.invitations("Content Person")[0]["status"], "Accepted")
        staff = self.staff().get(f"/api/panel-invitations?student_id={self.student_id}").get_json()
        self.assertEqual({row["faculty_name"]: row["status"] for row in staff["invitations"]}["Content Person"], "Accepted")

    def test_declining_needs_a_reason_and_raises_a_replacement_request(self):
        self.ready_for_title()
        invitation = self.invitations("Method Person")[0]
        url = f"/api/faculty-portal/panel-invitations/{invitation['id']}/respond"
        self.assertEqual(self.faculty_client("Method Person").post(url, json={"response": "decline"}).status_code, 400)
        declined = self.faculty_client("Method Person").post(url, json={"response": "decline", "reason": "On research leave that month"})
        self.assertEqual(declined.status_code, 200, declined.get_json())
        with app.app_context():
            tasks = Task.query.filter(Task.student_id == self.student_id, Task.title.like("Replace declined panelist%"), Task.status == "Pending").all()
            self.assertEqual(len(tasks), 1)
            self.assertEqual(tasks[0].owner_role, "Research Coordinator")
        listing = self.research().get("/api/notifications").get_json()
        self.assertTrue(any(item["kind"] == "panel_declined" for item in listing["items"]), listing)
        # a declined seat is a hard conflict when booking
        body = self.check().get_json()
        self.assertTrue(any("declined" in item and "Method Person" in item for item in body["hard"]), body)
        # replacing the member clears the request and the conflict
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Content Person", "Spare Person"]]
        changed = self.staff().post("/api/transactions/defense-scheduling", json={
            "student_id": self.student_id, "panel_faculty_ids": ids, "reassign_only": True, "panel_change_reason": "Method Person declined",
        })
        self.assertEqual(changed.status_code, 200, changed.get_json())
        with app.app_context():
            self.assertEqual(Task.query.filter(Task.student_id == self.student_id, Task.title.like("Replace declined panelist%"), Task.status == "Pending").count(), 0)
        self.assertEqual(self.check().get_json()["hard"], [])
        self.assertEqual(self.invitations("Spare Person")[0]["status"], "Invited")

    def test_the_new_panelist_is_told_about_the_invitation(self):
        self.ready_for_title()
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Content Person", "Spare Person"]]
        self.staff().post("/api/transactions/defense-scheduling", json={
            "student_id": self.student_id, "panel_faculty_ids": ids, "reassign_only": True, "panel_change_reason": "Rebalancing",
        })
        listing = self.faculty_client("Spare Person").get("/api/notifications").get_json()
        self.assertTrue(any(item["kind"] == "panel_invited" for item in listing["items"]), listing)

    def test_other_faculty_cannot_answer_an_invitation(self):
        self.ready_for_title()
        invitation = self.invitations("Method Person")[0]
        response = self.faculty_client("Spare Person").post(
            f"/api/faculty-portal/panel-invitations/{invitation['id']}/respond", json={"response": "accept"})
        self.assertEqual(response.status_code, 404)

    def test_cannot_attend_on_a_confirmed_defense_asks_for_a_reschedule(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        schedule_id = self.book_proposal(day)
        url = f"/api/faculty-portal/defense-schedules/{schedule_id}/cannot-attend"
        self.assertEqual(self.faculty_client("Content Person").post(url, json={}).status_code, 400)
        self.assertEqual(self.faculty_client("Spare Person").post(url, json={"reason": "x reason"}).status_code, 404)
        response = self.faculty_client("Content Person").post(url, json={"reason": "Flight booked for that week"})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(Task.query.filter(Task.student_id == self.student_id, Task.title.like("Reschedule Proposal Defense%"), Task.status == "Pending").count(), 1)
        event = [e for e in self.calendar(self.staff(), **self.window(day))["events"] if e["schedule_id"] == schedule_id][0]
        self.assertTrue(any("Content Person" in note and "cannot attend" in note for note in event["attention"]), event)
        listing = self.staff().get("/api/notifications").get_json()
        self.assertTrue(any(item["kind"] == "cannot_attend" for item in listing["items"]), listing)

    def test_the_adviser_can_also_say_they_cannot_attend(self):
        self.ready_for_proposal()
        schedule_id = self.book_proposal()
        response = self.faculty_client("Adviser Person").post(
            f"/api/faculty-portal/defense-schedules/{schedule_id}/cannot-attend", json={"reason": "Clinic duty that morning"})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(Task.query.filter(Task.student_id == self.student_id, Task.title.like("Reschedule Proposal Defense%"), Task.status == "Pending").count(), 1)

    def test_a_reschedule_clears_the_reschedule_request(self):
        self.ready_for_proposal()
        schedule_id = self.book_proposal()
        self.faculty_client("Content Person").post(
            f"/api/faculty-portal/defense-schedules/{schedule_id}/cannot-attend", json={"reason": "Flight booked"})
        new_day = future_weekday(28)
        # the panelist who cannot attend is replaced, then the defense is moved
        ids = [self.faculty_ids[n] for n in ["Chair Person", "Spare Person", "Method Person", "External Person"]]
        self.staff().post("/api/transactions/defense-scheduling", json={
            "student_id": self.student_id, "panel_faculty_ids": ids, "reassign_only": True, "panel_change_reason": "Content Person cannot attend",
        })
        ok = self.staff().post(f"/api/defense-schedules/{schedule_id}/reschedule", json={
            "preferred_date": new_day.isoformat(), "selected_start": "13:00", "selected_end": "15:00", "mode": "Online",
            "venue": "Zoom room B", "reason": "Panelist replaced", "requested_by": "Panel member",
        })
        self.assertEqual(ok.status_code, 200, ok.get_json())
        with app.app_context():
            self.assertEqual(Task.query.filter(Task.student_id == self.student_id, Task.title.like("Reschedule Proposal Defense%"), Task.status == "Pending").count(), 0)


# ---------------------------------------------------------------------------
# 5. Notifications and reminders
# ---------------------------------------------------------------------------
class NotificationTests(CalendarDataBase):
    def feed(self, client):
        response = client.get("/api/notifications")
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def test_the_bell_needs_a_sign_in_and_starts_empty(self):
        self.assertEqual(app.test_client().get("/api/notifications").status_code, 401)
        body = self.feed(self.student())
        self.assertEqual(body["items"], [])
        self.assertEqual(body["unread_count"], 0)

    def test_booking_a_defense_tells_the_student_the_adviser_and_the_panel(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        self.book_proposal(day)
        for client in (self.student(), self.faculty_client("Chair Person"), self.faculty_client("Adviser Person"), self.faculty_client("External Person")):
            items = self.feed(client)["items"]
            self.assertTrue(any(item["kind"] == "defense_scheduled" and day.isoformat() in item["body"] for item in items), items)
        self.assertEqual(self.feed(self.faculty_client("Spare Person"))["items"], [])
        self.assertEqual(self.feed(self.other_student())["items"], [])

    def test_a_reschedule_notice_carries_the_old_and_the_new_time_and_the_reason(self):
        self.ready_for_proposal()
        old_day, new_day = future_weekday(21), future_weekday(28)
        schedule_id = self.book_proposal(old_day)
        ok = self.staff().post(f"/api/defense-schedules/{schedule_id}/reschedule", json={
            "preferred_date": new_day.isoformat(), "selected_start": "13:00", "selected_end": "15:00", "mode": "Online",
            "venue": "Zoom room B", "reason": "The room is under repair", "requested_by": "GS Office",
        })
        self.assertEqual(ok.status_code, 200, ok.get_json())
        items = self.feed(self.student())["items"]
        notice = next(item for item in items if item["kind"] == "defense_rescheduled")
        self.assertIn(old_day.isoformat(), notice["body"])
        self.assertIn("09:00", notice["body"])
        self.assertIn(new_day.isoformat(), notice["body"])
        self.assertIn("13:00", notice["body"])
        self.assertIn("The room is under repair", notice["body"])
        chair = next(item for item in self.feed(self.faculty_client("Chair Person"))["items"] if item["kind"] == "defense_rescheduled")
        self.assertIn(new_day.isoformat(), chair["body"])

    def test_a_cancellation_notice_reaches_the_student(self):
        self.ready_for_proposal()
        schedule_id = self.book_proposal()
        self.staff().post(f"/api/defense-schedules/{schedule_id}/cancel", json={"reason": "Panel unavailable", "requested_by": "Panel chair"})
        items = self.feed(self.student())["items"]
        self.assertTrue(any(item["kind"] == "defense_cancelled" and "Panel unavailable" in item["body"] for item in items), items)

    def test_defense_reminders_are_generated_at_14_7_2_and_1_days_and_only_once(self):
        self.ready_for_proposal()
        day = future_weekday(28)
        self.book_proposal(day)
        with app.app_context():
            counts = []
            for offset in (20, 14, 14, 10, 7, 2, 1, 1, 0):
                app_module.generate_reminders(today=day - timedelta(days=offset))
                db.session.commit()
                counts.append(app_module.Notification.query.filter_by(kind="defense_reminder").count())
            # 5 people (student, adviser, chair, content, method, external = 6) per reminder day
            per_day = 6
            self.assertEqual(counts, [0, per_day, per_day, per_day, 2 * per_day, 3 * per_day, 4 * per_day, 4 * per_day, 4 * per_day])
            reminder = app_module.Notification.query.filter_by(kind="defense_reminder").order_by(app_module.Notification.id).first()
            self.assertIn("14", reminder.title)
        body = self.feed(self.student())
        self.assertTrue(any(item["kind"] == "defense_reminder" for item in body["items"]))

    def test_opening_the_bell_generates_reminders_for_a_defense_tomorrow_without_duplicates(self):
        self.ready_for_proposal()
        with app.app_context():
            tomorrow = date.today() + timedelta(days=1)
            self.schedule(self.student_id, "Proposal Defense", day=tomorrow, names=FOUR)
            db.session.commit()
        first = self.feed(self.student())
        second = self.feed(self.student())
        reminders = [item for item in second["items"] if item["kind"] == "defense_reminder"]
        self.assertEqual(len(reminders), 1)
        self.assertEqual(len(first["items"]), len(second["items"]))

    def test_a_panelist_with_no_availability_is_reminded(self):
        self.ready_for_title(["Chair Person", "Content Person", "Unentered Person"])
        body = self.feed(self.faculty_client("Unentered Person"))
        self.assertTrue(any(item["kind"] == "availability_missing" for item in body["items"]), body)
        self.assertEqual(len([i for i in self.feed(self.faculty_client("Unentered Person"))["items"] if i["kind"] == "availability_missing"]), 1)
        self.assertFalse(any(item["kind"] == "availability_missing" for item in self.feed(self.faculty_client("Chair Person"))["items"]))

    def test_an_adviser_is_reminded_when_a_signature_has_waited_three_days(self):
        with app.app_context():
            files = self.add_file(self.student_id, PROPOSAL, "Proposal manuscript")
            files[0].uploaded_at = datetime.now() - timedelta(days=5)
            db.session.commit()
        body = self.feed(self.faculty_client("Adviser Person"))
        self.assertTrue(any(item["kind"] == "signature_waiting" for item in body["items"]), body)
        self.assertEqual(len([i for i in self.feed(self.faculty_client("Adviser Person"))["items"] if i["kind"] == "signature_waiting"]), 1)

    def test_the_chair_is_told_when_a_verdict_is_due(self):
        self.ready_for_proposal()
        with app.app_context():
            self.schedule(self.student_id, "Proposal Defense", day=date.today() - timedelta(days=1), names=FOUR)
            db.session.commit()
        items = self.feed(self.faculty_client("Chair Person"))["items"]
        self.assertTrue(any(item["kind"] == "verdict_due" for item in items), items)
        self.assertFalse(any(item["kind"] == "verdict_due" for item in self.feed(self.faculty_client("Content Person"))["items"]))

    def test_reading_marks_a_notification_and_the_count_follows(self):
        self.ready_for_proposal()
        self.book_proposal()
        body = self.feed(self.student())
        self.assertGreaterEqual(body["unread_count"], 1)
        first_id = body["items"][0]["id"]
        self.assertEqual(self.student().post(f"/api/notifications/{first_id}/read", json={}).status_code, 200)
        self.assertEqual(self.feed(self.student())["unread_count"], body["unread_count"] - 1)
        self.assertEqual(self.other_student().post(f"/api/notifications/{first_id}/read", json={}).status_code, 404)
        self.assertEqual(self.student().post("/api/notifications/read-all", json={}).status_code, 200)
        self.assertEqual(self.feed(self.student())["unread_count"], 0)

    def test_the_adviser_steps_notify_the_next_owner(self):
        with app.app_context():
            student = Student(
                student_number="GS-NT-0001", first_name="Notify", last_name="Student", email="notify@example.test",
                program_id=self.program_id, entry_year=2025, academic_year_entry="25-26", year_level="2",
                current_stage="Proposal Development", standing="Active", comprehensive_exam_status="Passed",
            )
            db.session.add(student)
            db.session.flush()
            account_id = self._account("student", "notify-login@example.test", student_id=student.id).id
            db.session.commit()
        client = self.client(account_id, "student")
        client.post("/api/student-portal/adviser/apply", json={"faculty_id": self.faculty_ids["Chair Person"]})
        self.assertTrue(any(item["kind"] == "adviser_application" for item in self.feed(self.academic())["items"]))


# ---------------------------------------------------------------------------
# 6. Private calendar feed
# ---------------------------------------------------------------------------
class PrivateFeedTests(CalendarDataBase):
    def create_feed(self, client):
        response = client.post("/api/calendar-feed", json={})
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_a_person_can_create_a_private_link_that_works_without_a_session(self):
        self.ready_for_proposal()
        day = future_weekday(21)
        self.book_proposal(day)
        self.assertIsNone(self.student().get("/api/calendar-feed").get_json()["feed"])
        created = self.create_feed(self.student())
        url = created["feed"]["url"]
        self.assertTrue(url.startswith("/api/calendar/feed/") and url.endswith(".ics"))
        anonymous = app.test_client().get(url)
        self.assertEqual(anonymous.status_code, 200)
        self.assertIn("text/calendar", anonymous.headers["Content-Type"])
        body = anonymous.get_data(as_text=True)
        self.assertIn("BEGIN:VCALENDAR", body)
        self.assertIn(f"DTSTART;TZID=Asia/Manila:{day.strftime('%Y%m%d')}T090000", body)
        self.assertIn("SUMMARY:Proposal Defense", body)
        self.assertIn("SUMMARY:Due: ", body)  # deadlines ride in the same feed
        self.assertEqual(self.student().get("/api/calendar-feed").get_json()["feed"]["url"], url)

    def test_each_feed_holds_only_that_persons_calendar(self):
        self.ready_for_proposal()
        self.book_proposal()
        other = app.test_client().get(self.create_feed(self.other_student())["feed"]["url"]).get_data(as_text=True)
        self.assertNotIn("Proposal Defense", other)
        chair = app.test_client().get(self.create_feed(self.faculty_client("Chair Person"))["feed"]["url"]).get_data(as_text=True)
        self.assertIn("Proposal Defense", chair)
        spare = app.test_client().get(self.create_feed(self.faculty_client("Spare Person"))["feed"]["url"]).get_data(as_text=True)
        self.assertNotIn("Proposal Defense", spare)
        staff = app.test_client().get(self.create_feed(self.staff())["feed"]["url"]).get_data(as_text=True)
        self.assertIn("Proposal Defense", staff)

    def test_regenerating_replaces_the_old_link_and_revoking_switches_it_off(self):
        client = self.student()
        first = self.create_feed(client)["feed"]["url"]
        second = self.create_feed(client)["feed"]["url"]
        self.assertNotEqual(first, second)
        self.assertEqual(app.test_client().get(first).status_code, 404)
        self.assertEqual(app.test_client().get(second).status_code, 200)
        self.assertEqual(client.delete("/api/calendar-feed").status_code, 200)
        self.assertEqual(app.test_client().get(second).status_code, 404)
        self.assertIsNone(client.get("/api/calendar-feed").get_json()["feed"])

    def test_unknown_tokens_and_disabled_accounts_get_nothing(self):
        self.assertEqual(app.test_client().get("/api/calendar/feed/not-a-real-token.ics").status_code, 404)
        url = self.create_feed(self.student())["feed"]["url"]
        with app.app_context():
            account = db.session.get(UserAccount, self.student_account_id)
            account.active = False
            db.session.commit()
        self.assertEqual(app.test_client().get(url).status_code, 404)

    def test_the_feed_needs_a_sign_in_to_manage(self):
        self.assertEqual(app.test_client().post("/api/calendar-feed", json={}).status_code, 401)
        self.assertEqual(app.test_client().get("/api/calendar-feed").status_code, 401)

    def test_the_old_faculty_availability_feed_still_needs_a_session(self):
        self.assertEqual(app.test_client().get(f"/api/faculty/{self.faculty_ids['Chair Person']}/calendar.ics").status_code, 401)


# ---------------------------------------------------------------------------
# Existing data and demo data
# ---------------------------------------------------------------------------
class ExistingDataTests(CalendarBase):
    def test_the_old_automatic_default_hours_no_longer_count_as_entered(self):
        """Faculty created before this change all got Monday-Friday 8-17 automatically."""
        with app.app_context():
            faculty = Faculty(name="Old Default Person", college="GS", role="Faculty", specialization="x",
                              email="old.default@example.test", active=True)
            db.session.add(faculty)
            db.session.flush()
            for weekday in range(5):
                db.session.add(app_module.FacultyWorkingHour(
                    faculty_id=faculty.id, weekday=weekday, start_time=time(8, 0), end_time=time(17, 0), enabled=True))
            entered = Faculty(name="Entered Person", college="GS", role="Faculty", specialization="x",
                              email="entered.person@example.test", active=True, availability_updated_at=datetime.now())
            db.session.add(entered)
            db.session.flush()
            for weekday in range(5):
                db.session.add(app_module.FacultyWorkingHour(
                    faculty_id=entered.id, weekday=weekday, start_time=time(8, 0), end_time=time(17, 0), enabled=True))
            db.session.commit()
            self.assertTrue(app_module.faculty_availability_entered(faculty))  # before the migration
            flagged = app_module.label_system_default_working_hours()
            db.session.expire_all()
            self.assertGreaterEqual(flagged, 1)  # the fixture faculty look exactly like the old defaults too
            self.assertFalse(app_module.faculty_availability_entered(db.session.get(Faculty, faculty.id)))
            self.assertTrue(app_module.faculty_availability_entered(db.session.get(Faculty, entered.id)))
            self.assertEqual(app_module.label_system_default_working_hours(), 0)

    def test_the_demo_panel_gets_labelled_demo_hours_and_nobody_else_does(self):
        with app.app_context():
            demo = Faculty(name="Dr. Liwayway Bautista", college="GS", role="Faculty", specialization="Learning analytics",
                           email="liwayway.demo@example.test", active=True)
            other = Faculty(name="Dr. Somebody Else", college="GS", role="Faculty", specialization="Other",
                            email="somebody.else@example.test", active=True)
            db.session.add_all([demo, other])
            db.session.commit()
            app_module.ensure_panel_matching_demo_data()
            db.session.commit()
            db.session.expire_all()
            rows = app_module.FacultyWorkingHour.query.filter_by(faculty_id=demo.id).all()
            self.assertEqual(len(rows), 5)
            self.assertEqual({row.source for row in rows}, {"demo seed"})
            self.assertEqual(app_module.FacultyWorkingHour.query.filter_by(faculty_id=other.id).count(), 0)
            app_module.ensure_panel_matching_demo_data()
            db.session.commit()
            self.assertEqual(app_module.FacultyWorkingHour.query.filter_by(faculty_id=demo.id).count(), 5)
            self.assertFalse(app_module.faculty_availability_entered(db.session.get(Faculty, other.id)))

    def test_the_google_consent_text_no_longer_promises_to_write_events(self):
        body = self.faculty_client("Chair Person").get("/api/faculty-portal/google-calendar/authorization").get_json()
        text_body = " ".join(body.get("permissions", []))
        self.assertNotIn("Create, update, or remove", text_body)
        self.assertIn("Read-only", text_body)

    def test_the_staff_scheduling_context_lists_invitations_and_availability_requests(self):
        self.ready_for_title()
        self.staff().post("/api/availability-requests", json={
            "student_id": self.student_id, "window_start": future_weekday(14).isoformat(), "window_end": future_weekday(28).isoformat(),
        })
        context = self.staff().get(f"/api/transactions/defense-scheduling/context?student_id={self.student_id}").get_json()
        self.assertTrue(context["availability_requests"])
        self.assertEqual(len(context["panel_invitations"]), 3)
        self.assertTrue(all(item["availability_entered"] in (True, False) for item in context["faculty_directory"]))


if __name__ == "__main__":
    unittest.main()
