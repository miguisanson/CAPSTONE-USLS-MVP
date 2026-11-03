"""Small disposable dataset for the real teaching-schedule browser workflow."""
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["USLS_SKIP_STARTUP_TASKS"] = "1"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ["DEMO_PASSWORD"] = "test-password"

from tests.test_teaching_schedule import TeachingScheduleTests
from tests.test_academic_fixes import AcademicTerm, CurriculumOffering, db, app

fixture = TeachingScheduleTests()
fixture.setUp()
with app.app_context():
    for row in CurriculumOffering.query.filter_by(semester="2nd Semester").all():
        if row.course_id not in fixture.f.course_ids[:2]:
            db.session.delete(row)
        else:
            row.assigned_faculty_id = fixture.f.faculty_a_id
    for course_id in fixture.f.course_ids[:2]:
        fixture.f._enroll_row(fixture.f.student_id, course_id, fixture.term)
    # Only the previous semester is submitted: faculty must explicitly copy and
    # confirm the target term through the UI in the walkthrough.
    db.session.commit()
response = fixture.faculty.put(fixture.url(fixture.f.term1_id), json={
    "version": 0, "windows": fixture.windows(), "status": "Submitted"})
if response.status_code != 200:
    raise RuntimeError("Could not prepare the previous-semester availability fixture.")
try:
    app.run(host="127.0.0.1", port=int(os.getenv("E2E_TEACHING_PORT", "5056")), debug=False, use_reloader=False)
finally:
    fixture.tearDown()
