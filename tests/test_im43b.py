"""IM43 part b: I-248 (the three concept-paper titles recorded at upload, offered to the panel as a pick list)
and I-252 (practicum hours are the student's claim; the Academic Coordinator enters the verified hours)."""

import unittest
from io import BytesIO

from tests.test_audit2 import Audit2Base
from tests.test_research_core import TITLE, ResearchCoreBase

from app import (
    DefenseVerdict, PracticumRecord, Program, ResearchCase, ResearchEvidenceFile, StudentRequestAttachment, TransactionLog,
    app, db, practicum_record_dict, UPLOAD_ROOT,
)

PAPERS = "Three concept papers"
TITLES = ["Peer feedback rubrics in graduate writing", "Mentoring and thesis completion", "Digital portfolios for research"]


class ConceptPaperTitleTests(ResearchCoreBase):
    """I-248."""

    def upload(self, number, paper_title=None):
        data = {"gate": TITLE, "item_name": PAPERS, "file": (BytesIO(b"%PDF-1.4\nconcept " + str(number).encode() + b"\n%%EOF\n"), f"concept-{number}.pdf")}
        if paper_title is not None:
            data["paper_title"] = paper_title
        return self.student().post("/api/student-portal/research-evidence/upload", data=data, content_type="multipart/form-data")

    def cleanup_files(self):
        with app.app_context():
            for evidence in ResearchEvidenceFile.query.filter(ResearchEvidenceFile.original_name.like("concept-%")).all():
                (UPLOAD_ROOT / evidence.stored_name).unlink(missing_ok=True)

    def test_upload_stores_the_title_and_returns_it_with_the_file(self):
        self.addCleanup(self.cleanup_files)
        response = self.upload(1, "  " + TITLES[0] + "  ")
        self.assertEqual(response.status_code, 200, response.get_json())
        files = next(f for f in response.get_json()["document"]["files"])
        self.assertEqual(files["paper_title"], TITLES[0])
        with app.app_context():
            stored = ResearchEvidenceFile.query.filter_by(original_name="concept-1.pdf").one()
            self.assertEqual(stored.paper_title, TITLES[0])
            log = TransactionLog.query.filter_by(student_id=self.student_id, transaction_slug="research-gate").order_by(TransactionLog.id.desc()).first()
            self.assertIn(TITLES[0], log.notes)

    def test_a_concept_paper_without_a_title_is_refused(self):
        self.addCleanup(self.cleanup_files)
        for blank in (None, "   "):
            response = self.upload(1, blank)
            self.assertEqual(response.status_code, 400, response.get_json())
            self.assertIn("title", response.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(ResearchEvidenceFile.query.filter_by(original_name="concept-1.pdf").count(), 0)

    def title_defense_ready(self):
        with app.app_context():
            self.endorse(self.student_id)
            self.fill_uploads(self.student_id, TITLE, status="Complete", skip=(PAPERS,))
            check = self.doc(self.student_id, TITLE, PAPERS)
            for number, title in enumerate(TITLES, start=1):
                for evidence in self.add_file(self.student_id, TITLE, PAPERS, status="Complete"):
                    evidence.paper_title = title
            check.status = "Complete"
            self.panel(self.student_id, TITLE)
            schedule = self.schedule(self.student_id, "Title Defense")
            db.session.commit()
            return schedule.id

    def test_the_faculty_verdict_form_and_the_staff_fallback_get_the_three_titles(self):
        schedule_id = self.title_defense_ready()
        panel = next(p for p in self.faculty_client("Chair Person").get("/api/faculty-portal/context").get_json()["panels"] if p["gate"] == TITLE)
        self.assertEqual(panel["concept_titles"], TITLES)
        context = self.research().get(f"/api/transactions/research-gate/context?student_id={self.student_id}")
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.get_json()["staff_defense_action"]["concept_titles"], TITLES)
        self.assertEqual(schedule_id, panel["defense"]["id"])

    def test_a_picked_title_becomes_the_title_of_the_study(self):
        schedule_id = self.title_defense_ready()
        response = self.faculty_client("Chair Person").post(
            f"/api/faculty-portal/defense-verdicts/{schedule_id}", json={"result": "Passed", "selected_title": TITLES[1]})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            self.assertEqual(DefenseVerdict.query.filter_by(student_id=self.student_id).one().selected_title, TITLES[1])
            self.assertEqual(ResearchCase.query.filter_by(student_id=self.student_id).first().title, TITLES[1])


class VerifiedPracticumHoursTests(Audit2Base):
    """I-252."""

    def setUp(self):
        super().setUp()
        with app.app_context():
            db.session.get(Program, self.program_id).name = "Master of Arts in Psychology"
            db.session.commit()

    def make_record(self, **fields):
        with app.app_context():
            record = PracticumRecord(student_id=self.student_id, required_hours=200, **fields)
            db.session.add(record)
            db.session.commit()
            return record.id

    def certificate(self):
        with app.app_context():
            row = StudentRequestAttachment(
                student_id=self.student_id, request_type="practicum", original_name="cert.pdf", stored_name="im43b-cert.pdf")
            db.session.add(row)
            db.session.commit()
            return row.id

    def student_claims(self, hours):
        return self.client("student").post("/api/student-portal/requests/practicum", json={
            "certificate_attachment_id": self.certificate(), "completed_hours": hours})

    def under_review(self, claimed=200):
        return self.make_record(status="Documents Under Review", completed_hours=claimed, document_status="Pending Review",
                                certificate_attachment_id=self.certificate(), moa_status="Verified")

    def verify(self, role="academic_coordinator", **fields):
        return self.client(role).post("/api/transactions/practicum", json={
            "student_id": self.student_id, "status": "Record Verified Hours", **fields})

    def test_the_students_number_is_labelled_a_claim_and_sets_no_hours_status(self):
        record_id = self.make_record(status="Practicum In Progress", completed_hours=0, moa_status="Verified")
        response = self.student_claims(120)
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual(record.status, "Documents Submitted")  # 120 of 200 claimed does not make it Hours Incomplete
            payload = practicum_record_dict(record)
            self.assertEqual(payload["reported_hours"], 120)
            self.assertIsNone(payload["verified_hours"])

    def test_the_coordinator_enters_verified_hours_with_who_and_when(self):
        record_id = self.under_review(claimed=200)
        response = self.verify(verified_hours="200")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual(record.verified_hours, 200)
            self.assertEqual(record.completed_hours, 200)  # the claim itself is not overwritten
            self.assertEqual(record.status, "Documents Under Review")
            self.assertIsNotNone(record.hours_verified_at)
            payload = practicum_record_dict(record)
            self.assertEqual(payload["verified_hours"], 200)
            self.assertTrue(payload["hours_verified_by"])
            log = TransactionLog.query.filter_by(student_id=self.student_id, transaction_slug="practicum").order_by(TransactionLog.id.desc()).first()
            self.assertIn("hours: 200/200", log.notes)
            self.assertIn("Test academic_coordinator", log.actor_role)
            self.assertIn("hours verified", log.result)

    def test_completion_follows_the_verified_hours_not_the_claim(self):
        self.under_review(claimed=200)
        refused = self.client("academic_coordinator").post("/api/transactions/practicum", json={"student_id": self.student_id, "status": "Completed"})
        self.assertEqual(refused.status_code, 400, refused.get_json())
        self.assertIn("verified", refused.get_json()["error"].lower())
        self.assertEqual(self.verify(verified_hours="200").status_code, 200)
        done = self.client("academic_coordinator").post("/api/transactions/practicum", json={"student_id": self.student_id, "status": "Completed"})
        self.assertEqual(done.status_code, 200, done.get_json())

    def test_fewer_verified_hours_than_claimed_needs_a_note_and_sets_hours_incomplete(self):
        record_id = self.under_review(claimed=200)
        no_note = self.verify(verified_hours="150")
        self.assertEqual(no_note.status_code, 400, no_note.get_json())
        response = self.verify(verified_hours="150", verified_note="Certificates add up to 150 hours.")
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            record = db.session.get(PracticumRecord, record_id)
            self.assertEqual((record.status, record.verified_hours, record.completed_hours), ("Hours Incomplete", 150, 200))
            self.assertEqual(record.hours_verified_note, "Certificates add up to 150 hours.")

    def test_only_the_academic_coordinator_verifies_and_only_during_documents_review(self):
        record_id = self.under_review()
        for role in ("staff", "student", "dean"):
            response = self.verify(role=role, verified_hours="200")
            self.assertIn(response.status_code, (400, 403), (role, response.get_json()))
        with app.app_context():
            self.assertIsNone(db.session.get(PracticumRecord, record_id).verified_hours)
        with app.app_context():
            db.session.get(PracticumRecord, record_id).status = "Practicum In Progress"
            db.session.commit()
        self.assertEqual(self.verify(verified_hours="200").status_code, 400)


if __name__ == "__main__":
    unittest.main()
