"""Panel Matching on the demo seed (I-145; defense revision S3: "all 4 are 72/100").

The panel complained that every demo ranking looked the same. On the seed as built by ``build_demo_database``
every research-stage student must have a paper of their own (title + readable concept-paper text), so the
ranking differs from student to student, and a student with no paper at all gets no scores, not invented ones.
One seeded temporary database is built for the whole module; every test only reads it.
"""
import os
import tempfile
import unittest
from collections import Counter

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))

from app import (  # noqa: E402
    ResearchCase,
    Student,
    app,
    build_demo_database,
    db,
    panel_matching_result,
    research_matching_profile,
)

RESEARCH_STAGES = ("Proposal Development", "Proposal Defense", "Data Collection", "Writing", "Final Defense")
NO_PAPER = "No paper on file yet — upload the concept paper to rank the panel"


class PanelSeedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            build_demo_database()
            # The two practicum demo students hand in a project portfolio, not a thesis paper. A graduation candidate
            # whose research is verified complete (Hector Ong and Isabel Flores wait in Final Defense for the Dean's
            # endorsement, F-25) has no defense left, so there is nothing to match a panel to.
            finished = {
                student_id for (student_id,) in db.session.query(ResearchCase.student_id).filter_by(status="Verified Complete")
            }
            cls.students = [
                (student.id, student.student_number)
                for student in Student.query.filter(Student.current_stage.in_(RESEARCH_STAGES))
                .order_by(Student.id).all()
                if not student.student_number.startswith("GS-2026-PRAC-") and student.id not in finished
            ]
            cls.profiles = {}
            cls.results = {}
            cls.top3 = {}
            cls.vectors = {}
            for student_id, number in cls.students:
                student = db.session.get(Student, student_id)
                profile = research_matching_profile(student)
                cls.profiles[number] = profile
                result = cls.results[number] = panel_matching_result(student, profile)
                cls.top3[number] = tuple(row["faculty"].id for row in result["rows"][:3])
                cls.vectors[number] = tuple(row["score"] for row in result["rows"][:4])
            db.session.rollback()  # a read must not leave stage changes behind

    @classmethod
    def tearDownClass(cls):
        try:
            with app.app_context():
                db.session.remove()
                db.engine.dispose()
            os.unlink(_DB_FILE.name)
        except (FileNotFoundError, PermissionError):
            pass

    def test_there_are_research_stage_students_to_check(self):
        self.assertGreaterEqual(len(self.students), 30)

    def test_every_research_stage_student_has_their_own_title_and_paper_text(self):
        titles = {}
        for _id, number in self.students:
            profile = self.profiles[number]
            with self.subTest(student=number):
                self.assertTrue(profile["research_title"].strip(), "no research title")
                self.assertTrue(profile["query_text"].strip(), "no paper text on file")
                self.assertTrue(profile["ready"], profile["blocked_reason"])
            titles.setdefault(profile["research_title"], []).append(number)
        shared = {title: numbers for title, numbers in titles.items() if len(numbers) > 1}
        self.assertEqual(shared, {}, "two students share one research title")

    def test_research_stage_students_get_different_rankings(self):
        rankings = Counter(self.top3[number] for _id, number in self.students)
        score_vectors = Counter(self.vectors[number] for _id, number in self.students)
        self.assertGreaterEqual(len(rankings), 6, rankings)
        self.assertGreaterEqual(len(score_vectors), 6, score_vectors)
        # The old seed gave 30+ students one identical vector; no vector may be shared by more than a handful.
        self.assertLessEqual(max(score_vectors.values()), 5, score_vectors.most_common(3))

    def test_a_student_with_no_paper_gets_no_scores(self):
        with app.app_context():
            student = Student.query.filter_by(student_number="GS-2026-GRAD-01").first()
            profile = research_matching_profile(student)
            result = panel_matching_result(student, profile)
            db.session.rollback()
        self.assertFalse(profile["ready"])
        self.assertTrue(profile["blocked_reason"].startswith(NO_PAPER), profile["blocked_reason"])
        self.assertEqual(result["rows"], [])
        self.assertEqual(result["suggested_panel"], [])
        self.assertTrue(result["no_paper"])
        self.assertTrue(result["message"].startswith(NO_PAPER), result["message"])

    def test_a_research_student_with_a_paper_is_not_flagged_no_paper(self):
        number = self.students[0][1]
        self.assertFalse(self.results[number].get("no_paper"))
        self.assertTrue(self.top3[number])


if __name__ == "__main__":
    unittest.main()
