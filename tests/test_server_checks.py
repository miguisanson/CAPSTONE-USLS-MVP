"""Server checks behind the form dropdowns (I-353 and the manual-fields packet).

The browser limits what a user can pick; the server must refuse the same bad values when a request comes from
anywhere else. The route-level checks live next to the workflow they belong to (test_monitoring_crud,
test_research_core, test_teaching_schedule, test_academic_fixes, test_calendar_appointments); this file holds the
shared value checks that have no route of their own.
"""
import os
import tempfile
import unittest
from datetime import timedelta

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from app import app, checked_clearance_date, checked_whole_hours, ph_today  # noqa: E402


class SharedValueCheckTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        try:
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def test_hours_are_a_whole_number_of_at_most_twice_the_requirement(self):
        self.assertEqual(checked_whole_hours("120", 200, 0), 120)
        self.assertEqual(checked_whole_hours(400, 200, 0), 400)
        self.assertEqual(checked_whole_hours("", 200, 75), 75)  # blank keeps what is on record
        self.assertEqual(checked_whole_hours(None, 200, 75), 75)
        for bad in ("12.5", "abc", "-3", 12.5, "1e2", " 4 0 "):
            with self.assertRaises(ValueError, msg=repr(bad)) as ctx:
                checked_whole_hours(bad, 200, 0)
            self.assertIn("whole number", str(ctx.exception))
        with self.assertRaises(ValueError) as ctx:
            checked_whole_hours("401", 200, 0)
        self.assertIn("400", str(ctx.exception))

    def test_a_clearance_date_is_a_real_date_that_is_not_in_the_future(self):
        with app.app_context():
            today = ph_today()
            self.assertEqual(checked_clearance_date(today.isoformat()), today)
            self.assertEqual(checked_clearance_date("2026-01-31").isoformat(), "2026-01-31")
            for bad in ("2026-02-30", "31/01/2026", "tomorrow", "2026-1-5x"):
                with self.assertRaises(ValueError, msg=bad) as ctx:
                    checked_clearance_date(bad)
                self.assertIn("YYYY-MM-DD", str(ctx.exception))
            with self.assertRaises(ValueError) as ctx:
                checked_clearance_date((today + timedelta(days=1)).isoformat())
            self.assertIn("future", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
