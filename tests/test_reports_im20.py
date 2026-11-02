"""Reports (owner decision IM20): five real reports, each filterable and exportable.

1. GET /api/reports/at-risk     students at risk / delayed, with the reason, since when and the next owner
2. GET /api/reports/cohorts     where each cohort (program x academic-year entry) is in the lifecycle
3. GET /api/reports/overdue     overdue tasks and pending requests by office, with waiting time (oldest first)
4. GET /api/reports/defenses    defenses held and upcoming, with the panel and the verdict
5. GET /api/reports/graduation  graduation candidates: eligibility, what is missing, batch status

Every one of them takes filters in the query string, and ``format=xlsx`` / ``format=pdf`` returns exactly the
filtered rows as a download. A GET writes nothing (same rule as tests/test_reads_do_not_write.py).

The expected values here are worked out from the rows this file creates (known dates, owners, verdicts), never
from the endpoint under test.
"""
import io
import json
import os
import sqlite3
import tempfile
import unittest
from datetime import date, datetime, timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="usls-uploads-"))
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""

from openpyxl import load_workbook  # noqa: E402

from app import (  # noqa: E402
    AcademicTerm,
    DefenseVerdict,
    Faculty,
    GraduationEndorsement,
    Program,
    ScheduleRequest,
    Student,
    Task,
    TransactionLog,
    UserAccount,
    app,
    db,
    generate_password_hash,
    now_utc,
)

TODAY = date.today()
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
REPORTS = ("at-risk", "cohorts", "overdue", "defenses", "graduation")


def _account(role, email):
    account = UserAccount(
        email=email, full_name=f"Test {role}", password_hash=generate_password_hash("test-password"),
        role=role, active=True,
    )
    db.session.add(account)
    db.session.flush()
    return account.id


def _student(program, number, first, last, entry, stage, risk):
    student = Student(
        student_number=number, first_name=first, last_name=last, email=f"{number.lower()}@example.test",
        program_id=program.id, entry_year=2000 + int(entry[:2]), academic_year_entry=entry, year_level="1",
        current_stage=stage, standing="Active", risk_level=risk,
    )
    db.session.add(student)
    db.session.flush()
    return student


def _task(student, title, owner, due, status="Pending"):
    db.session.add(Task(student_id=student.id, title=title, owner_role=owner, due_at=due, status=status, priority=10))


def _schedule(student, defense_type, day, status, panel=None):
    request = ScheduleRequest(
        student_id=student.id, preferred_date=day, start_time=datetime(2000, 1, 1, 9, 0).time(),
        end_time=datetime(2000, 1, 1, 10, 0).time(), defense_type=defense_type, mode="Face-to-face",
        venue="Room 1", status=status, panel_snapshot=json.dumps(panel or []),
    )
    db.session.add(request)
    db.session.flush()
    return request


class ReportsIm20Base(unittest.TestCase):
    """One small, fully known fixture, built once: reports only read it."""

    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.drop_all()
            db.create_all()
            ra = Program(code="RA", name="Reports Alpha", college="Graduate School", has_practicum=True)
            rb = Program(code="RB", name="Reports Beta", college="Graduate School", has_practicum=False)
            db.session.add_all([ra, rb])
            db.session.flush()
            cls.ra_id, cls.rb_id = ra.id, rb.id

            cls.s1 = _student(ra, "R-001", "Ana", "Alpha", "24-25", "Coursework", "Delayed")
            cls.s2 = _student(ra, "R-002", "Ben", "Bravo", "24-25", "Proposal Defense", "At Risk of Delay")
            cls.s3 = _student(rb, "R-003", "Cara", "Cruz", "25-26", "Coursework", "On Track")
            cls.s4 = _student(rb, "R-004", "Dan", "Dela", "24-25", "Final Defense", "At Risk of Delay")
            cls.s5 = _student(ra, "R-005", "Eve", "Eden", "25-26", "Coursework", "On Track")
            cls.s6 = _student(rb, "R-006", "Fay", "Fox", "24-25", "Completed", "On Track")
            # An entry written the long way ("2024-2025") is the same cohort as "24-25".
            cls.s7 = _student(ra, "R-007", "Gus", "Gray", "24-25", "Coursework", "On Track")
            cls.s7.academic_year_entry = "2024-2025"
            ids = {name: getattr(cls, name).id for name in ("s1", "s2", "s3", "s4", "s5", "s6", "s7")}
            cls.ids = ids

            # Tasks: s1 40 days overdue (Academic Coordinator), s2 10 days overdue (Research Coordinator);
            # s3 has one not yet due; s5 has an old task that is Done (never listed).
            _task(cls.s1, "Submit study plan", "Academic Coordinator", TODAY - timedelta(days=40))
            _task(cls.s2, "Confirm panel", "Research Coordinator", TODAY - timedelta(days=10))
            _task(cls.s3, "Upload MOA", "Student", TODAY + timedelta(days=5))
            _task(cls.s5, "Old filing", "Graduate School Staff", TODAY - timedelta(days=90), status="Done")

            # s4 has had no recorded update for 130 days: that is what is late, and since when.
            cls.s4_anchor = now_utc() - timedelta(days=130, hours=1)
            cls.s4.updated_at = cls.s4_anchor

            # A pending request: s3's withdrawal has waited with the Dean for 20 days. A closed one
            # (next owner "None") for s5 must not be listed.
            waiting = TransactionLog(
                transaction_slug="withdrawal", student_id=cls.s3.id, actor_role="Student", result="Withdrawal request submitted",
                next_owner="Dean", created_at=now_utc() - timedelta(days=20, hours=1),
            )
            closed = TransactionLog(
                transaction_slug="withdrawal", student_id=cls.s5.id, actor_role="Student", result="Withdrawal closed",
                next_owner="None", created_at=now_utc() - timedelta(days=50),
            )
            # An import event is a record of what happened, not a request anybody has to answer.
            imported = TransactionLog(
                transaction_slug="student-handoff", student_id=cls.s7.id, actor_role="Graduate School Staff",
                result="Standing imported from the monitoring sheet", next_owner="Academic Coordinator",
                created_at=now_utc() - timedelta(days=60),
            )
            db.session.add_all([waiting, closed, imported])
            cls.waiting_since = (waiting.created_at).date()

            # Terms: one covering 45..15 days ago, one covering 14 days ago .. 60 days ahead.
            db.session.add_all([
                AcademicTerm(label="T-Past", start_date=TODAY - timedelta(days=45), end_date=TODAY - timedelta(days=15)),
                AcademicTerm(label="T-Now", start_date=TODAY - timedelta(days=14), end_date=TODAY + timedelta(days=60)),
            ])

            # Defenses: d1 held with a verdict, d2 date passed with no verdict, d3 upcoming with a panel,
            # d4 cancelled (never listed).
            faculty = Faculty(name="Dr. Chair", college="GS", role="Faculty", specialization="Methods", email="chair@example.test")
            db.session.add(faculty)
            db.session.flush()
            d1 = _schedule(cls.s4, "Final Defense", TODAY - timedelta(days=30), "Held",
                           [{"faculty_id": faculty.id, "name": "Dr. Chair", "role": "Panel Chair"}])
            db.session.add(DefenseVerdict(
                student_id=cls.s4.id, schedule_request_id=d1.id, panel_assignment_id=1, faculty_id=faculty.id,
                gate="Final Defense", defense_type="Final Defense", chair_name="Dr. Chair", result="Passed",
                defense_date=d1.preferred_date,
            ))
            _schedule(cls.s2, "Proposal Defense", TODAY - timedelta(days=3), "Scheduled")
            _schedule(cls.s5, "Title Defense", TODAY + timedelta(days=14), "Scheduled",
                      [{"name": "Dr. Ada Lopez", "role": "Panel Chair"}, {"name": "Dr. Bo Reyes", "role": "Content Specialist"}])
            _schedule(cls.s3, "Title Defense", TODAY + timedelta(days=5), "Cancelled")

            # Graduation: s6 is in a Dean-approved batch; s4 (Final Defense) is a candidate with no batch yet.
            db.session.add(GraduationEndorsement(
                student_id=cls.s6.id, review_window="2025-2026", batch_name="Batch 1 May 2026",
                endorsement_status="Dean Approved",
            ))

            staff = _account("staff", "staff@reports.test")
            academic = _account("academic_coordinator", "academic@reports.test")
            dean = _account("dean", "dean@reports.test")
            research = _account("research_coordinator", "research@reports.test")
            student_account = _account("student", "student@reports.test")
            db.session.get(UserAccount, student_account).student_id = cls.s1.id
            cls.accounts = {"staff": staff, "academic_coordinator": academic, "dean": dean,
                            "research_coordinator": research, "student": student_account}
            db.session.commit()
            cls.ids = {name: getattr(cls, name).id for name in ids}
            cls.s4_since = cls.s4_anchor.date()

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        try:
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def client(self, role="staff"):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client

    def report(self, name, role="staff", **params):
        response = self.client(role).get(f"/api/reports/{name}", query_string=params)
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        return response.get_json()

    def export(self, name, fmt, role="staff", **params):
        response = self.client(role).get(f"/api/reports/{name}", query_string={**params, "format": fmt})
        self.assertEqual(response.status_code, 200, response.data[:300])
        return response

    @staticmethod
    def student_ids(payload):
        return sorted(row["student_id"] for row in payload["rows"])

    def expected_ids(self, *names):
        return sorted(self.ids[name] for name in names)


class AtRiskReportTests(ReportsIm20Base):
    def test_lists_exactly_the_students_marked_at_risk_or_delayed(self):
        payload = self.report("at-risk")
        self.assertEqual(self.student_ids(payload), self.expected_ids("s1", "s2", "s4"))
        self.assertEqual(payload["count"], 3)
        labels = [column["label"] for column in payload["columns"]]
        for wanted in ("Student", "Program", "Stage", "Risk", "What is late", "Since", "Days late", "Next owner"):
            self.assertIn(wanted, labels)

    def test_each_row_says_what_is_late_since_when_and_who_is_next(self):
        rows = {row["student_id"]: row for row in self.report("at-risk")["rows"]}
        overdue = rows[self.ids["s1"]]
        self.assertEqual(overdue["risk"], "Delayed")
        self.assertIn("overdue", overdue["reason"].lower())
        self.assertEqual(overdue["since"], (TODAY - timedelta(days=40)).isoformat())
        self.assertEqual(overdue["days_late"], 40)
        self.assertEqual(overdue["owner"], "Academic Coordinator")
        self.assertEqual(rows[self.ids["s2"]]["days_late"], 10)
        self.assertEqual(rows[self.ids["s2"]]["owner"], "Research Coordinator")
        stalled = rows[self.ids["s4"]]
        self.assertIn("130 days", stalled["reason"])
        self.assertEqual(stalled["since"], self.s4_since.isoformat())
        self.assertEqual(stalled["days_late"], (TODAY - self.s4_since).days)
        self.assertEqual(stalled["owner"], "Graduate School Staff")

    def test_longest_late_first(self):
        days = [row["days_late"] for row in self.report("at-risk")["rows"]]
        self.assertEqual(days, sorted(days, reverse=True))

    def test_filters_narrow_the_rows(self):
        self.assertEqual(self.student_ids(self.report("at-risk", program_id=self.ra_id)), self.expected_ids("s1", "s2"))
        self.assertEqual(self.student_ids(self.report("at-risk", stage="Final Defense")), self.expected_ids("s4"))
        self.assertEqual(self.student_ids(self.report("at-risk", risk="Delayed")), self.expected_ids("s1"))
        self.assertEqual(self.report("at-risk", program_id=self.rb_id, risk="Delayed")["rows"], [])

    def test_offers_the_options_for_its_filters(self):
        options = self.report("at-risk")["options"]
        self.assertEqual({item["code"] for item in options["programs"]}, {"RA", "RB"})
        self.assertIn("Final Defense", options["stages"])


class CohortReportTests(ReportsIm20Base):
    def rows_by_cohort(self, payload):
        labels = {column["key"]: column["label"] for column in payload["columns"]}
        result = {}
        for row in payload["rows"]:
            counts = {labels[key]: value for key, value in row.items() if key in labels and key not in ("program", "entry", "total")}
            result[(row["program"], row["entry"])] = (row["total"], {stage: n for stage, n in counts.items() if n})
        return result

    def test_counts_students_per_stage_for_every_program_and_entry(self):
        cohorts = self.rows_by_cohort(self.report("cohorts"))
        self.assertEqual(cohorts, {
            ("RA", "24-25"): (3, {"Coursework": 2, "Proposal Defense": 1}),  # s1, s7 (written 2024-2025), s2
            ("RA", "25-26"): (1, {"Coursework": 1}),  # s5
            ("RB", "24-25"): (2, {"Final Defense": 1, "Completed": 1}),  # s4, s6
            ("RB", "25-26"): (1, {"Coursework": 1}),  # s3
        })

    def test_the_cohort_totals_add_up_to_every_student(self):
        payload = self.report("cohorts")
        self.assertEqual(sum(row["total"] for row in payload["rows"]), 7)
        self.assertEqual(payload["count"], 4)

    def test_filters_narrow_the_cohorts(self):
        by_program = self.rows_by_cohort(self.report("cohorts", program_id=self.rb_id))
        self.assertEqual(set(by_program), {("RB", "24-25"), ("RB", "25-26")})
        by_entry = self.rows_by_cohort(self.report("cohorts", entry="25-26"))
        self.assertEqual(set(by_entry), {("RA", "25-26"), ("RB", "25-26")})
        by_stage = self.rows_by_cohort(self.report("cohorts", stage="Coursework"))
        self.assertEqual(by_stage[("RA", "24-25")], (2, {"Coursework": 2}))
        self.assertNotIn(("RB", "24-25"), by_stage)

    def test_entry_options_use_one_spelling(self):
        self.assertEqual(self.report("cohorts")["options"]["entries"], ["24-25", "25-26"])


class OverdueReportTests(ReportsIm20Base):
    def test_lists_overdue_tasks_and_pending_requests_oldest_first(self):
        payload = self.report("overdue")
        self.assertEqual([row["student_id"] for row in payload["rows"]],
                         [self.ids["s1"], self.ids["s3"], self.ids["s2"]])
        self.assertEqual([row["days_waiting"] for row in payload["rows"]], [40, 20, 10])

    def test_each_row_has_the_item_the_office_and_the_waiting_time(self):
        rows = {row["student_id"]: row for row in self.report("overdue")["rows"]}
        task = rows[self.ids["s1"]]
        self.assertEqual((task["kind"], task["item"], task["office"]), ("Overdue task", "Submit study plan", "Academic Coordinator"))
        self.assertEqual(task["since"], (TODAY - timedelta(days=40)).isoformat())
        request = rows[self.ids["s3"]]
        self.assertEqual((request["kind"], request["office"]), ("Pending request", "Dean"))
        self.assertIn("Withdrawal", request["item"])
        self.assertEqual(request["since"], self.waiting_since.isoformat())

    def test_a_monitoring_import_is_not_a_pending_request(self):
        self.assertNotIn(self.ids["s7"], self.student_ids(self.report("overdue")))

    def test_never_lists_a_task_not_yet_due_a_done_task_or_a_closed_request(self):
        ids = self.student_ids(self.report("overdue"))
        self.assertNotIn(self.ids["s5"], ids)
        titles = [row["item"] for row in self.report("overdue")["rows"]]
        self.assertNotIn("Upload MOA", titles)

    def test_filters_narrow_the_rows(self):
        self.assertEqual(self.student_ids(self.report("overdue", office="Dean")), self.expected_ids("s3"))
        self.assertEqual(self.student_ids(self.report("overdue", kind="Overdue task")), self.expected_ids("s1", "s2"))
        self.assertEqual(self.student_ids(self.report("overdue", program_id=self.ra_id)), self.expected_ids("s1", "s2"))
        self.assertEqual(self.student_ids(self.report("overdue", term="T-Past")), self.expected_ids("s1", "s3"))
        self.assertEqual(self.student_ids(self.report("overdue", term="T-Now")), self.expected_ids("s2"))
        self.assertEqual(self.student_ids(self.report("overdue", stage="Proposal Defense")), self.expected_ids("s2"))

    def test_offers_the_offices_it_found_and_every_term(self):
        options = self.report("overdue")["options"]
        self.assertEqual(options["offices"], ["Academic Coordinator", "Dean", "Research Coordinator"])
        self.assertEqual(options["terms"], ["T-Past", "T-Now"])


class DefenseReportTests(ReportsIm20Base):
    def test_lists_held_awaiting_and_upcoming_defenses_but_not_cancelled_ones(self):
        rows = {row["student_id"]: row for row in self.report("defenses")["rows"]}
        self.assertEqual(sorted(rows), self.expected_ids("s2", "s4", "s5"))
        self.assertEqual(rows[self.ids["s4"]]["when"], "Held")
        self.assertEqual(rows[self.ids["s2"]]["when"], "Awaiting verdict")
        self.assertEqual(rows[self.ids["s5"]]["when"], "Upcoming")

    def test_each_row_has_type_date_panel_and_verdict(self):
        rows = {row["student_id"]: row for row in self.report("defenses")["rows"]}
        held = rows[self.ids["s4"]]
        self.assertEqual(held["defense_type"], "Final Defense")
        self.assertEqual(held["date"], (TODAY - timedelta(days=30)).isoformat())
        self.assertEqual(held["verdict"], "Passed")
        self.assertIn("Dr. Chair", held["panel"])
        upcoming = rows[self.ids["s5"]]
        self.assertIn("Dr. Ada Lopez", upcoming["panel"])
        self.assertIn("Dr. Bo Reyes", upcoming["panel"])
        self.assertEqual(upcoming["verdict"], "Not yet recorded")
        self.assertEqual(rows[self.ids["s2"]]["verdict"], "Not yet recorded")

    def test_newest_date_first(self):
        dates = [row["date"] for row in self.report("defenses")["rows"]]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_filters_narrow_the_rows(self):
        self.assertEqual(self.student_ids(self.report("defenses", when="Upcoming")), self.expected_ids("s5"))
        self.assertEqual(self.student_ids(self.report("defenses", when="Held")), self.expected_ids("s4"))
        self.assertEqual(self.student_ids(self.report("defenses", type="Final Defense")), self.expected_ids("s4"))
        self.assertEqual(self.student_ids(self.report("defenses", term="T-Past")), self.expected_ids("s4"))
        self.assertEqual(self.student_ids(self.report("defenses", term="T-Now")), self.expected_ids("s2", "s5"))
        self.assertEqual(self.student_ids(self.report("defenses", program_id=self.rb_id)), self.expected_ids("s4"))


class GraduationReportTests(ReportsIm20Base):
    def test_lists_candidates_with_eligibility_what_is_missing_and_batch_status(self):
        rows = {row["student_id"]: row for row in self.report("graduation")["rows"]}
        self.assertEqual(sorted(rows), self.expected_ids("s4", "s6"))
        batched = rows[self.ids["s6"]]
        self.assertEqual(batched["batch_status"], "Dean Approved")
        self.assertEqual(batched["review_window"], "AY 2025-2026")  # the app writes a review window as "AY <year>-<year>" everywhere
        unbatched = rows[self.ids["s4"]]
        self.assertEqual(unbatched["batch_status"], "Not in a batch")
        for row in rows.values():
            self.assertIn(row["eligibility"], ("Eligible", "Not eligible", "Needs verification"))
            self.assertTrue(row["owner"])
            if row["eligibility"] != "Eligible":
                self.assertTrue(row["missing"], "a student who is not eligible must say what is missing")

    def test_filters_narrow_the_rows(self):
        self.assertEqual(self.student_ids(self.report("graduation", program_id=self.rb_id)), self.expected_ids("s4", "s6"))
        self.assertEqual(self.report("graduation", program_id=self.ra_id)["rows"], [])
        self.assertEqual(self.student_ids(self.report("graduation", batch_status="Dean Approved")), self.expected_ids("s6"))
        self.assertEqual(self.student_ids(self.report("graduation", batch_status="Not in a batch")), self.expected_ids("s4"))
        self.assertEqual(self.student_ids(self.report("graduation", stage="Completed")), self.expected_ids("s6"))


class ReportExportTests(ReportsIm20Base):
    FILTERS = {
        "at-risk": {"program_id": "RA"},
        "cohorts": {"program_id": "RB"},
        "overdue": {"kind": "Overdue task"},
        "defenses": {"when": "Upcoming"},
        "graduation": {"batch_status": "Dean Approved"},
    }

    def filters_for(self, name):
        params = dict(self.FILTERS[name])
        if params.get("program_id") == "RA":
            params["program_id"] = self.ra_id
        if params.get("program_id") == "RB":
            params["program_id"] = self.rb_id
        return params

    @staticmethod
    def sheet_rows(response):
        workbook = load_workbook(io.BytesIO(response.get_data()), data_only=True)
        sheet = workbook.active
        rows = [[cell for cell in row] for row in sheet.iter_rows(values_only=True)]
        return rows

    def test_xlsx_is_a_valid_workbook_with_the_same_rows_as_the_screen(self):
        for name in REPORTS:
            for params in ({}, self.filters_for(name)):
                payload = self.report(name, **params)
                response = self.export(name, "xlsx", **params)
                self.assertEqual(response.mimetype, XLSX, name)
                self.assertIn("attachment", response.headers["Content-Disposition"], name)
                self.assertIn(".xlsx", response.headers["Content-Disposition"], name)
                rows = self.sheet_rows(response)
                header = [column["label"] for column in payload["columns"]]
                header_at = next(index for index, row in enumerate(rows) if row[: len(header)] == header)
                body = [row for row in rows[header_at + 1:] if any(value not in (None, "") for value in row)]
                self.assertEqual(len(body), payload["count"], f"{name} {params}")
                for row, item in zip(body, payload["rows"]):
                    for column, value in zip(payload["columns"], row):
                        expected = item[column["key"]]
                        self.assertEqual(value if value is not None else "", expected if expected is not None else "", f"{name} {column['key']}")

    def test_a_filtered_export_holds_only_the_filtered_rows(self):
        everything = self.report("at-risk")["count"]
        params = {"program_id": self.rb_id}
        response = self.export("at-risk", "xlsx", **params)
        rows = [row for row in self.sheet_rows(response)]
        text = " ".join(str(value) for row in rows for value in row if value is not None)
        self.assertIn("Dela", text)
        self.assertNotIn("Alpha", text)
        self.assertLess(self.report("at-risk", **params)["count"], everything)

    def test_pdf_is_a_valid_document_listing_the_filtered_rows(self):
        import unicodedata

        import pymupdf as fitz

        def pdf_text(data):
            # The PDF font joins "ffi" and "fi" into one glyph; fold them back so the words can be compared.
            pages = [page.get_text() for page in fitz.open(stream=data, filetype="pdf")]
            return unicodedata.normalize("NFKC", chr(10).join(pages))

        for name in REPORTS:
            response = self.export(name, "pdf", **self.filters_for(name))
            self.assertEqual(response.mimetype, "application/pdf", name)
            self.assertIn(".pdf", response.headers["Content-Disposition"], name)
            data = response.get_data()
            self.assertTrue(data.startswith(b"%PDF-"), name)
            text = pdf_text(data)
            payload = self.report(name, **self.filters_for(name))
            self.assertIn(payload["title"], text, name)
            for column in payload["columns"][:2]:
                self.assertIn(column["label"], text, name)
        text = pdf_text(self.export("at-risk", "pdf", program_id=self.rb_id).get_data())
        self.assertIn("Dan Dela", text)
        self.assertNotIn("Ana Alpha", text)

    def test_an_unknown_format_is_refused(self):
        response = self.client().get("/api/reports/at-risk", query_string={"format": "docx"})
        self.assertEqual(response.status_code, 400)


class ReportAccessAndReadTests(ReportsIm20Base):
    def test_staff_and_academic_coordinator_can_open_every_report(self):
        for role in ("staff", "academic_coordinator"):
            for name in REPORTS:
                self.assertEqual(self.client(role).get(f"/api/reports/{name}").status_code, 200, (role, name))

    def test_other_roles_and_signed_out_visitors_are_refused(self):
        for name in REPORTS:
            self.assertEqual(app.test_client().get(f"/api/reports/{name}").status_code, 401, name)
            for role in ("dean", "research_coordinator", "student"):
                self.assertEqual(self.client(role).get(f"/api/reports/{name}").status_code, 403, (role, name))
                self.assertEqual(self.client(role).get(f"/api/reports/{name}", query_string={"format": "xlsx"}).status_code, 403)

    def test_opening_and_exporting_a_report_writes_nothing(self):
        client = self.client()

        def dump():
            connection = sqlite3.connect(f"file:{_DB_FILE.name}?mode=ro", uri=True)
            try:
                tables = [row[0] for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")]
                return {table: sorted(repr(row) for row in connection.execute(f'SELECT * FROM "{table}"')) for table in tables}
            finally:
                connection.close()

        before = dump()
        for name in REPORTS:
            for params in ({}, {"format": "xlsx"}, {"format": "pdf"}, {"program_id": self.ra_id}):
                self.assertEqual(client.get(f"/api/reports/{name}", query_string=params).status_code, 200, (name, params))
        after = dump()
        changed = [table for table in sorted(set(before) | set(after)) if before.get(table) != after.get(table)]
        self.assertEqual(changed, [])


if __name__ == "__main__":
    unittest.main()
