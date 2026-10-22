"""A read must not write (ISSUES I-038, I-039).

Opening a page, or loading what it shows, must not change the database. Owner decision IM4 says a
normal start writes nothing; the same holds for a page view. Two bugs broke it:

- I-038: GET /api/faculty-portal/context created the panel invitations a faculty member was
  missing, so two simultaneous first loads raced and one returned 500 (UNIQUE constraint on
  panel_invitation.student_id, faculty_id, gate).
- I-039: opening Leave of Absence or Readmission as staff fired POST /api/leave-cases/sync.
  The page view itself is covered by frontend/e2e/p90-reads.spec.js; here the server side is
  pinned: the board's GET answers without writing, and the explicit sync endpoint still works.
"""
import itertools
import os
import re
import sqlite3
import tempfile
import threading
import unittest

from sqlalchemy import event

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
# Never write into the committed seed library or the real RAG index.
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

from app import (  # noqa: E402
    PanelAssignment,
    PanelInvitation,
    UserAccount,
    app,
    build_demo_database,
    current_panel_gate,
    db,
)

PASSWORD = "DemoPass123!"

# Sign-in accounts, one per role (the demo accounts every seeded database has).
ROLE_EMAILS = {
    "staff": "staff@usls.edu.ph", "dean": "dean@usls.edu.ph", "academic_coordinator": "academic@usls.edu.ph",
    "research_coordinator": "research@usls.edu.ph", "admin": "admin@usls.edu.ph",
    "faculty": "liwayway.bautista@usls.edu.ph", "student": "student@usls.edu.ph",
}
# A GET that is allowed to write, each with its reason. Keep this list short.
GET_WRITES_ALLOWED = (
    # Downloading the Registrar sheet of a residency case records that the report was generated (an export
    # audit row, like the other Registrar exports). It is a download, not a page view.
    re.compile(r"^/api/residency/\d+/registrar-report$"),
)


def dump_database() -> dict:
    """Every row of every table exactly as stored (no normalising: a changed timestamp counts)."""
    connection = sqlite3.connect(f"file:{_DB_FILE.name}?mode=ro", uri=True)
    try:
        tables = [
            row[0]
            for row in connection.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        ]
        return {
            table: sorted(repr(row) for row in connection.execute(f'SELECT * FROM "{table}"'))
            for table in tables
        }
    finally:
        connection.close()


def changed_tables(before: dict, after: dict) -> list:
    lines = []
    for table in sorted(set(before) | set(after)):
        if before.get(table) != after.get(table):
            lines.append(f"{table}: {len(before.get(table, []))} -> {len(after.get(table, []))} rows")
    return lines


def sign_in(email: str):
    client = app.test_client()
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200, (email, response.status_code, response.get_data(as_text=True)[:300])
    return client


def seats_without_invitation() -> list:
    """(student_id, faculty_id, gate) for every seat on a student's current panel with no invitation."""
    missing = []
    for assignment in PanelAssignment.query.order_by(PanelAssignment.id).all():
        student = assignment.student
        if student is None or assignment.gate != current_panel_gate(student):
            continue
        if not PanelInvitation.query.filter_by(
            student_id=assignment.student_id, faculty_id=assignment.faculty_id, gate=assignment.gate
        ).first():
            missing.append((assignment.student_id, assignment.faculty_id, assignment.gate))
    return missing


class ReadsDoNotWriteTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.create_all()
            build_demo_database()
            db.session.commit()
            # The faculty member to sign in as: one who sits on a current panel. If the build left
            # one of their seats without an invitation, the old GET would have created it.
            gaps = seats_without_invitation()
            db.session.rollback()
            faculty_ids = [faculty_id for _student, faculty_id, _gate in gaps] or [
                assignment.faculty_id for assignment in PanelAssignment.query.order_by(PanelAssignment.id).all()
            ]
            cls.faculty_email = None
            for faculty_id in faculty_ids:
                account = UserAccount.query.filter_by(role="faculty", faculty_id=faculty_id, active=True).first()
                if account:
                    cls.faculty_email = account.email
                    break
            if cls.faculty_email is None:
                raise AssertionError("the demo build has no faculty account that sits on a panel")
            db.session.remove()
            db.engine.dispose()

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def test_build_gives_every_current_panel_seat_an_invitation(self):
        """Invitations are created when the seat is made (or when the demo is built), not on a page view."""
        with app.app_context():
            missing = seats_without_invitation()
            db.session.rollback()
        self.assertEqual(missing, [], "panel seats on a current gate with no invitation")

    def test_faculty_context_get_changes_nothing(self):
        client = sign_in(self.faculty_email)
        before = dump_database()  # after sign-in: signing in may write (it is a POST)
        for _ in range(2):
            response = client.get("/api/faculty-portal/context")
            self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        self.assertEqual(changed_tables(before, dump_database()), [])

    def test_faculty_invitation_list_get_changes_nothing(self):
        client = sign_in(self.faculty_email)
        before = dump_database()
        response = client.get("/api/faculty-portal/panel-invitations")
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        self.assertEqual(changed_tables(before, dump_database()), [])

    def test_two_simultaneous_first_loads_both_succeed(self):
        clients = [sign_in(self.faculty_email) for _ in range(2)]
        # Start from "this faculty member has no invitations yet" so a load that tried to create
        # them would race. (Runs last in the class: later tests do not need these rows.)
        with app.app_context():
            account = UserAccount.query.filter_by(email=self.faculty_email).first()
            PanelInvitation.query.filter_by(faculty_id=account.faculty_id).delete()
            db.session.commit()
            db.session.remove()
        barrier = threading.Barrier(2)
        statuses = [None, None]
        bodies = [None, None]

        def load(index):
            barrier.wait()
            try:
                response = clients[index].get("/api/faculty-portal/context")
            except Exception as exc:  # the test client re-raises a server error (the 500 of I-038)
                statuses[index] = "error"
                bodies[index] = f"{type(exc).__name__}: {str(exc)[:200]}"
                return
            statuses[index] = response.status_code
            bodies[index] = response.get_data(as_text=True)[:300]

        threads = [threading.Thread(target=load, args=(i,)) for i in range(2)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(120)
        self.assertEqual(statuses, [200, 200], bodies)

    def test_leave_board_get_changes_nothing_and_sync_stays_an_explicit_action(self):
        client = sign_in("staff@usls.edu.ph")
        before = dump_database()
        for slug in ("leave-of-absence", "readmission"):
            response = client.get(f"/api/leave-cases?slug={slug}")
            self.assertEqual(response.status_code, 200, (slug, response.get_data(as_text=True)[:300]))
        self.assertEqual(changed_tables(before, dump_database()), [])
        # The "Refresh leave dates" button keeps working.
        response = client.post("/api/leave-cases/sync", json={})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        self.assertTrue(response.get_json()["ok"])

    def test_no_get_route_of_any_role_writes(self):
        """The sweep behind I-071: every GET a role can reach, with ids and process names filled in, issues no
        INSERT, UPDATE or DELETE (not even one that is rolled back). Signing in is a POST and is not counted."""
        routes = set()
        for rule in app.url_map.iter_rules():
            if "GET" not in rule.methods or rule.endpoint == "static":
                continue
            if not rule.arguments:
                routes.add(rule.rule)
                continue
            options = []
            for name in rule.arguments:
                kind = rule._converters[name].__class__.__name__
                if kind == "IntegerConverter":
                    options.append([(name, 1), (name, 3)])
                elif name in ("slug", "case_type"):
                    options.append([(name, value) for value in (
                        "leave-of-absence", "readmission", "practicum", "withdrawal", "graduation", "awol",
                        "research-gate", "student-handoff")])
                else:
                    options = None
                    break
            if options is None:
                continue
            for combo in itertools.product(*options):
                routes.add(app.url_map.bind("localhost").build(rule.endpoint, dict(combo)))
        self.assertGreater(len(routes), 100)
        writes, current = [], {}

        def trace(conn, cursor, statement, parameters, context, executemany):
            if statement.lstrip()[:6].upper() in ("INSERT", "UPDATE", "DELETE"):
                writes.append((current["role"], current["url"], statement.strip().splitlines()[0][:80]))

        clients = {role: sign_in(email) for role, email in ROLE_EMAILS.items()}
        with app.app_context():
            event.listen(db.engine, "before_cursor_execute", trace)
        try:
            for role, client in clients.items():
                for url in sorted(routes):
                    if url.startswith("/api/auth/"):
                        continue
                    if any(pattern.match(url) for pattern in GET_WRITES_ALLOWED):
                        continue
                    current.update(role=role, url=url)
                    client.get(url)
        finally:
            with app.app_context():
                event.remove(db.engine, "before_cursor_execute", trace)
        self.assertEqual(sorted(set(writes)), [])

    def test_the_explicit_refresh_actions_work(self):
        """The sweeps a GET used to run (I-071) are now these two POSTs."""
        client = sign_in("staff@usls.edu.ph")
        response = client.post("/api/maintenance/refresh", json={})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:300])
        self.assertTrue(response.get_json()["ok"])
        self.assertEqual(client.post("/api/notifications/refresh", json={}).status_code, 200)


if __name__ == "__main__":
    unittest.main()
