"""Panel matching (defense revisions D1, D2, D4, D5, D6).

These tests run the REAL pipeline: the demo students' uploaded paper text is
read by research_matching_profile and scored by recommend_panel against the
faculty roster and the faculty expertise records. Nothing about the matching
profile or the scoring is mocked (only the PDF file writer and, for the
Gemini paths, the network calls).
"""
import os
import re
import tempfile
import unittest
from datetime import time
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as app_module  # noqa: E402
from app import (  # noqa: E402
    current_panel_gate,
    Faculty,
    FacultyAvailability,
    FacultyExpertise,
    PanelAssignment,
    Program,
    Student,
    UserAccount,
    app,
    db,
    ensure_authoritative_curricula,
    ensure_faculty_account_schema,
    ensure_monitoring_template_courses,
    ensure_panel_matching_demo_data,
    generate_password_hash,
    import_faculty_sheets,
    panel_composition_report,
    panel_matching_result,
    panel_roles_for_student,
    recommend_panel,
)

PROGRAMS = [
    ("MAED", "Master of Arts in Education", "Education", False),
    ("MBA", "Master of Business Administration", "Business", False),
    ("DBA", "Doctor of Business Administration", "Business", False),
    ("MSN", "Master of Science in Nursing", "Nursing", False),
    ("MAPSY", "Master of Arts in Psychology", "Arts and Sciences", True),
    ("MSCS", "Master of Science in Computer Science", "Engineering and Technology", False),
]

# What each demo paper is about, and who should come out on top.
PAPERS = {
    "GS-2026-PM-01": ({"Dr. Adriana Santos"}, {"nursing", "health", "medication", "patient", "telehealth", "hypertension"}),
    "GS-2026-PM-02": ({"Dr. Celeste Tan"}, {"burnout", "well-being", "motivation", "psychology", "psychological"}),
    "GS-2026-PM-03": ({"Dr. Daniel Uy"}, {"maintenance", "sensor", "fault", "energy", "machine learning", "automation"}),
    "GS-2026-PM-04": ({"Dr. Benjamin Reyes"}, {"wallet", "fintech", "financial technology", "savings", "payment", "accounting"}),
    "GS-2026-PM-05": ({"Dr. Marco Villanueva"}, {"supply chain", "inventory", "simulation", "logistics", "forecasting", "quality"}),
    "GS-2026-PM-06": ({"Dr. Angela Cruz"}, {"family business", "succession", "governance", "entrepreneur", "strategic"}),
    "GS-2026-PM-07": ({"Dr. Teresa Lim"}, {"marketing", "consumer", "brand", "purchase intention", "social media", "retail"}),
}


class PanelMatchingTests(unittest.TestCase):
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
        with app.app_context():
            db.drop_all()
            db.create_all()
            for code, name, college, practicum in PROGRAMS:
                db.session.add(Program(code=code, name=name, college=college, has_practicum=practicum))
            db.session.flush()
            ensure_authoritative_curricula()
            ensure_monitoring_template_courses()
            import_faculty_sheets()
            db.session.commit()
            with patch("app.write_demo_pdf"):
                ensure_panel_matching_demo_data()
            db.session.commit()
            self.staff_id = self._account("staff", "staff-pm@example.test")
            db.session.commit()

    def _account(self, role, email):
        account = UserAccount(
            email=email,
            full_name=f"Test {role}",
            password_hash=generate_password_hash("test-password"),
            role=role,
            active=True,
        )
        db.session.add(account)
        db.session.flush()
        return account.id

    def _client(self, account_id, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def _student(self, number):
        return Student.query.filter_by(student_number=number).one()

    def _faculty(self, name):
        return Faculty.query.filter_by(name=name).one()

    def _rank(self, number, **kwargs):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": ""}):
            return recommend_panel(self._student(number), **kwargs)

    # ------------------------------------------------------------------ D1/D2
    def test_real_pipeline_gives_different_panels_for_different_papers(self):
        with app.app_context():
            rankings = {}
            for number, (expected_top, field_terms) in PAPERS.items():
                rows = self._rank(number)
                self.assertGreaterEqual(len(rows), 8, number)
                rankings[number] = rows
                top_four = rows[:4]
                scores = [row["score"] for row in top_four]
                self.assertEqual(len(set(scores)), 4, f"{number}: top-four scores tie: {scores}")
                self.assertGreater(len({row["score"] for row in rows}), 6, f"{number}: scores are (nearly) constant")
                self.assertLess(rows[0]["score"], 100)
                # The expertise component must not saturate: at most one candidate gets full marks.
                full = [r for r in rows if r["breakdown"]["components"]["expertise"]["score"] >= r["breakdown"]["components"]["expertise"]["max"]]
                self.assertLessEqual(len(full), 1, number)
                # The leader is a real subject expert and the evidence says why.
                leader = rows[0]
                self.assertIn(leader["faculty"].name, expected_top, number)
                evidence_text = " ".join(item["text"] for item in leader["breakdown"]["evidence"]).lower()
                self.assertTrue(
                    any(term in evidence_text for term in field_terms),
                    f"{number}: leader evidence is not about the paper's field: {evidence_text}",
                )
                for row in top_four:
                    self.assertTrue(row["breakdown"]["matched_topics"], f"{number} {row['faculty'].name}: no matched topics")
                    self.assertTrue(row["breakdown"]["evidence"], f"{number} {row['faculty'].name}: no evidence")
            orders = {number: tuple(row["faculty"].id for row in rows) for number, rows in rankings.items()}
            self.assertEqual(len(set(orders.values())), len(orders), "two papers produced the identical ranking")
            top_sets = {frozenset(row["faculty"].id for row in rows[:4]) for rows in rankings.values()}
            self.assertGreaterEqual(len(top_sets), 5)
            leaders = {rows[0]["faculty"].id for rows in rankings.values()}
            self.assertGreaterEqual(len(leaders), 5)
            every_score = {row["score"] for rows in rankings.values() for row in rows}
            self.assertGreater(len(every_score), 20)
            self.assertNotEqual(every_score, {72}, "everyone still gets the same score")

    def test_each_candidate_has_an_explainable_breakdown(self):
        with app.app_context():
            rows = self._rank("GS-2026-PM-01")
            row = rows[0]
            breakdown = row["breakdown"]
            components = breakdown["components"]
            self.assertEqual(set(components), {"expertise", "availability", "workload"})
            self.assertGreater(components["expertise"]["max"], components["availability"]["max"])
            self.assertGreater(components["expertise"]["max"], components["workload"]["max"])
            self.assertEqual(sum(part["max"] for part in components.values()), 100)
            self.assertAlmostEqual(sum(part["score"] for part in components.values()), row["score"], places=1)
            self.assertEqual(breakdown["method"], "tfidf")
            self.assertEqual(breakdown["method_label"], "Similarity match (keyword TF-IDF)")
            self.assertTrue(breakdown["matched_topics"])
            self.assertTrue(breakdown["matched_passage"])
            paper = self._student("GS-2026-PM-01")
            source = " ".join(
                item.extracted_text for item in app_module.ResearchEvidenceFile.query.filter_by(student_id=paper.id)
            )
            self.assertIn(breakdown["matched_passage"].rstrip(".").split(" ... ")[0][:40], source)
            for item in breakdown["evidence"]:
                self.assertTrue({"kind", "text", "source"} <= set(item))
            self.assertRegex(breakdown["reason"], r"^[A-Z].*\.$")
            self.assertIn(row["faculty"].name, breakdown["reason"])
            self.assertEqual(row["method"], "tfidf")

    def test_expertise_records_change_the_ranking(self):
        with app.app_context():
            uy = self._faculty("Dr. Daniel Uy")
            before = self._rank("GS-2026-PM-01")
            before_rank = [r["faculty"].name for r in before].index(uy.name)
            db.session.add(FacultyExpertise(
                faculty_id=uy.id, kind="publication", year=2025, source="manual entry",
                text="Text-message reminders and medication adherence among patients with hypertension: telehealth follow-up study",
            ))
            db.session.commit()
            after = self._rank("GS-2026-PM-01")
            after_rank = [r["faculty"].name for r in after].index(uy.name)
            self.assertLess(after_rank, before_rank)
            uy_row = next(r for r in after if r["faculty"].id == uy.id)
            self.assertIn("publication", {item["kind"] for item in uy_row["breakdown"]["evidence"]})

    # --------------------------------------------------------------------- D4
    def test_students_own_adviser_is_never_recommended(self):
        with app.app_context():
            for number, adviser in (("GS-2026-PM-02", "Dr. Liwayway Bautista"), ("GS-2026-PM-03", "Dr. Marlon Geronimo")):
                student = self._student(number)
                self.assertEqual(student.adviser_name, adviser)
                result = panel_matching_result(student)
                self.assertNotIn(adviser, [row["faculty"].name for row in result["rows"]])
                excluded = {item["faculty_name"]: item for item in result["excluded"]}
                self.assertIn(adviser, excluded)
                self.assertIn("adviser", excluded[adviser]["reason"].lower())
                self.assertNotIn(adviser, [row["faculty"].name for row in self._rank(number)])

    def test_the_top_expert_is_dropped_when_she_is_the_advisor(self):
        with app.app_context():
            student = self._student("GS-2026-PM-01")
            best = self._rank("GS-2026-PM-01")[0]["faculty"]
            self.assertEqual(best.name, "Dr. Adriana Santos")
            app_module.AdviserAssignment.query.filter_by(student_id=student.id).delete()
            student.adviser_name = best.name
            db.session.commit()
            result = panel_matching_result(student)
            self.assertNotIn(best.id, [row["faculty"].id for row in result["rows"]])
            self.assertEqual([item["faculty_name"] for item in result["excluded"]], [best.name])
            self.assertNotIn(best.id, [seat["faculty_id"] for seat in result["suggested_panel"]])
            # A co-adviser named on the student record is excluded too.
            student.adviser_name = "Dr. Teodoro Ramos; Dr. Adriana Santos"
            db.session.commit()
            result = panel_matching_result(student)
            self.assertEqual(
                {item["faculty_name"]: item["reason"] for item in result["excluded"]}.keys(),
                {"Dr. Teodoro Ramos", "Dr. Adriana Santos"},
            )
            self.assertTrue(any("co-adviser" in item["reason"].lower() for item in result["excluded"]))

    def test_panel_composition_follows_the_research_protocol(self):
        with app.app_context():
            project_paper = self._student("GS-2026-PM-02")   # MAPSY = project paper
            thesis = self._student("GS-2026-PM-01")          # MSN = thesis
            dissertation = self._student("GS-2026-PM-06")    # DBA = dissertation
            self.assertEqual(panel_roles_for_student(project_paper), ["Panel Chair", "Content Specialist", "Method Specialist"])
            self.assertEqual(len(panel_roles_for_student(thesis)), 4)
            self.assertEqual(
                panel_roles_for_student(dissertation),
                ["Panel Chair", "Content Specialist 1", "Content Specialist 2", "Method Specialist", "External Panel"],
            )
            result = panel_matching_result(thesis)
            # The suggestion seats the panel for the student's current defense stage (title stage: no external panelist yet).
            self.assertEqual([item["role"] for item in result["suggested_panel"]], panel_roles_for_student(thesis, current_panel_gate(thesis)))
            checks = {c["rule"]: c for c in result["composition"]["checks"]}
            self.assertTrue(all(c["ok"] for c in checks.values()), checks)
            self.assertIn("size", checks)
            self.assertIn("adviser", checks)
            # Break the rules: adviser on the panel, one seat empty.
            adviser = self._faculty(thesis.adviser_name)
            others = [row["faculty"] for row in result["rows"][:2]]
            broken = panel_composition_report(
                thesis,
                # One seat short of the stage's panel (title stage: 3 seats).
                [("Panel Chair", adviser), ("Content Specialist", others[0])],
            )
            failed = {c["rule"] for c in broken["checks"] if not c["ok"]}
            self.assertTrue({"size", "adviser"} <= failed, failed)
            self.assertTrue(all(c["message"] for c in broken["checks"]))

    def test_finalizing_rejects_the_adviser_and_uses_suggested_roles_by_default(self):
        with app.app_context():
            # Faculty logins are needed to finalize a panel. Run twice: the first pass
            # creates them, the second links them (existing behaviour of the startup helper).
            ensure_faculty_account_schema()
            ensure_faculty_account_schema()
            student = self._student("GS-2026-PM-01")
            adviser = self._faculty(student.adviser_name)
            sid = student.id
            adviser_id = adviser.id
            others = [row["faculty"].id for row in self._rank("GS-2026-PM-01")[:3]]
            required = panel_roles_for_student(student, current_panel_gate(student))
        client = self._client(self.staff_id, "staff")
        response = client.post("/api/transactions/panel-matching", json={
            "student_id": sid, "faculty_ids": [adviser_id, *others],
        })
        self.assertEqual(response.status_code, 400, response.get_json())
        self.assertIn("adviser", response.get_json()["error"].lower())
        with app.app_context():
            self.assertEqual(PanelAssignment.query.filter_by(student_id=sid).count(), 0)
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": ""}):
            response = client.post("/api/transactions/panel-matching", json={"student_id": sid})
        self.assertEqual(response.status_code, 200, response.get_json())
        with app.app_context():
            assignments = PanelAssignment.query.filter_by(student_id=sid).all()
            self.assertEqual(sorted(a.panel_role for a in assignments), sorted(required))
            self.assertNotIn(adviser_id, {a.faculty_id for a in assignments})
            self.assertEqual(len({a.faculty_id for a in assignments}), len(required))

    # --------------------------------------------------------------------- D5
    def test_demo_seed_never_overwrites_specialization_and_is_idempotent(self):
        with app.app_context():
            bautista = self._faculty("Dr. Liwayway Bautista")
            bautista.specialization = "Edited in the portal: curriculum evaluation"
            blank = self._faculty("Dr. Teresa Lim")
            blank.specialization = ""
            db.session.commit()
            expertise_before = FacultyExpertise.query.count()
            students_before = Student.query.count()
            with patch("app.write_demo_pdf"):
                first = ensure_panel_matching_demo_data()
                db.session.commit()
                second = ensure_panel_matching_demo_data()
                db.session.commit()
            self.assertEqual(self._faculty("Dr. Liwayway Bautista").specialization, "Edited in the portal: curriculum evaluation")
            self.assertTrue(self._faculty("Dr. Teresa Lim").specialization.strip())
            self.assertEqual(first["faculty_profiles"], 1)
            self.assertEqual(second["faculty_profiles"], 0)
            self.assertEqual(FacultyExpertise.query.count(), expertise_before)
            self.assertEqual(Student.query.count(), students_before)
            self.assertEqual(second["expertise_records"], 0)
            self.assertEqual(second["demo_students"], 0)

    def test_demo_seed_leaves_existing_expertise_records_alone(self):
        with app.app_context():
            navarro = self._faculty("Dr. Paolo Navarro")
            FacultyExpertise.query.filter_by(faculty_id=navarro.id).delete()
            db.session.add(FacultyExpertise(
                faculty_id=navarro.id, kind="research_interest", text="Only my own manual record", source="manual entry",
            ))
            db.session.commit()
            with patch("app.write_demo_pdf"):
                ensure_panel_matching_demo_data()
                db.session.commit()
            records = FacultyExpertise.query.filter_by(faculty_id=navarro.id).all()
            self.assertEqual([r.text for r in records], ["Only my own manual record"])

    def test_every_roster_faculty_has_varied_demo_evidence_marked_as_demo(self):
        with app.app_context():
            faculty = Faculty.query.filter_by(active=True).all()
            self.assertEqual(len(faculty), 12)
            for member in faculty:
                records = FacultyExpertise.query.filter_by(faculty_id=member.id).all()
                self.assertGreaterEqual(len(records), 5, member.name)
                self.assertGreaterEqual(len({r.kind for r in records}), 4, member.name)
                self.assertTrue(all(r.source == "demo seed" for r in records), member.name)
                self.assertTrue(all(len(r.text) > 10 for r in records))
            self.assertGreaterEqual(FacultyAvailability.query.count(), 12)

    def test_demo_students_cover_different_programs_with_three_concept_papers(self):
        with app.app_context():
            programs = set()
            for number in PAPERS:
                student = self._student(number)
                programs.add(student.program.code)
                papers = (
                    app_module.ResearchEvidenceFile.query.join(app_module.DocumentCheck)
                    .filter(
                        app_module.ResearchEvidenceFile.student_id == student.id,
                        app_module.DocumentCheck.item_name == "Three concept papers",
                    )
                    .all()
                )
                self.assertEqual(len(papers), 3, number)
                self.assertEqual(len({p.extracted_text for p in papers}), 3, number)
            self.assertGreaterEqual(len(PAPERS), 6)
            self.assertGreaterEqual(len(programs), 5)
            # Later-stage students are waiting at the proposal gate with a manuscript.
            proposal_students = [n for n in PAPERS if self._student(n).current_stage == "Proposal Defense"]
            self.assertGreaterEqual(len(proposal_students), 2)
            for number in proposal_students:
                profile = app_module.research_matching_profile(self._student(number))
                self.assertEqual(profile["gate"], "Form 4 - Proposal Defense Readiness")
                self.assertTrue(profile["ready"], profile.get("blocked_reason"))

    def test_seeder_is_registered_with_the_other_startup_seeders(self):
        source = Path(app_module.__file__).read_text(encoding="utf-8")
        startup = source.split("app = create_app()", 1)[1].split('if __name__ == "__main__":', 1)[0]
        self.assertIn("ensure_panel_matching_demo_data()", startup)

    # --------------------------------------------------------------------- D6
    def test_method_is_labelled_honestly_and_gemini_falls_back_to_tfidf(self):
        def fake_embeddings(texts, purpose):
            vectors = []
            for text in texts:
                bucket = [0.0] * 64
                for token in re.findall(r"[a-z]{4,}", text.lower()):
                    bucket[hash(token) % 64] += 1.0
                norm = sum(v * v for v in bucket) ** 0.5 or 1.0
                vectors.append([v / norm for v in bucket])
            return vectors

        with app.app_context():
            student = self._student("GS-2026-PM-04")
            with patch.dict(os.environ, {"GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": ""}):
                plain = panel_matching_result(student)
            self.assertEqual(plain["method"], "tfidf")
            self.assertEqual(plain["method_label"], "Similarity match (keyword TF-IDF)")
            with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), \
                    patch("app._gemini_generate", side_effect=RuntimeError("offline")), \
                    patch("app._gemini_embed_texts", side_effect=fake_embeddings):
                semantic = panel_matching_result(student)
            self.assertEqual(semantic["method"], "gemini-embeddings")
            self.assertEqual(semantic["method_label"], "Semantic match (Gemini embeddings)")
            self.assertTrue(all(row["method"] == "gemini-embeddings" for row in semantic["rows"]))
            self.assertGreater(len({row["score"] for row in semantic["rows"]}), 6)
            app_module._PANEL_EMBEDDING_CACHE.clear()
            with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), \
                    patch("app._gemini_generate", side_effect=RuntimeError("offline")), \
                    patch("app._gemini_embed_texts", side_effect=RuntimeError("quota")):
                fallback = panel_matching_result(student)
            self.assertEqual(fallback["method"], "tfidf")
            self.assertIn("fell back", fallback["method_note"].lower())

    def test_screen_payload_does_not_call_the_similarity_score_rag(self):
        with app.app_context():
            student_id = self._student("GS-2026-PM-01").id
        client = self._client(self.staff_id, "staff")
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": ""}):
            response = client.get(f"/api/transactions/panel-matching/context?student_id={student_id}")
        self.assertEqual(response.status_code, 200, response.get_json())
        payload = response.get_json()
        self.assertEqual(payload["matching_method"], "tfidf")
        self.assertEqual(payload["matching_method_label"], "Similarity match (keyword TF-IDF)")
        self.assertNotIn("rag", payload["matching_profile"]["analysis_label"].lower())
        self.assertIn("suggested_panel", payload)
        self.assertIn("panel_composition", payload)
        self.assertIn("excluded_faculty", payload)
        recommendation = payload["panel_recommendations"][0]
        for key in ("breakdown", "flags", "method", "method_label", "score_breakdown"):
            self.assertIn(key, recommendation)
        self.assertNotIn("rag", recommendation["note"].lower())
        self.assertNotIn("rag", recommendation["breakdown"]["reason"].lower())

    # ------------------------------------------------------------- flags
    def test_workload_and_availability_flags(self):
        with app.app_context():
            student = self._student("GS-2026-PM-01")
            busy = self._faculty("Dr. Adriana Santos")
            idle_windows = self._faculty("Dr. Celeste Tan")
            FacultyAvailability.query.filter_by(faculty_id=idle_windows.id).delete()
            app_module.FacultyWorkingHour.query.filter_by(faculty_id=idle_windows.id).delete()
            for weekday in range(7):
                db.session.add(app_module.FacultyWorkingHour(
                    faculty_id=idle_windows.id, weekday=weekday, start_time=time(8, 0), end_time=time(17, 0), enabled=False,
                ))
            for index in range(5):
                other = Student(
                    student_number=f"BUSY-{index}", first_name="Busy", last_name=str(index), email="b@example.test",
                    program_id=student.program_id, entry_year=2024, current_stage="Proposal Defense",
                )
                db.session.add(other)
                db.session.flush()
                db.session.add(PanelAssignment(student_id=other.id, faculty_id=busy.id, gate="Form 1 - Title Defense",
                                               panel_role="Content Specialist", score=50))
            db.session.commit()
            rows = {r["faculty"].name: r for r in self._rank("GS-2026-PM-01")}
            self.assertIn("overload", {f["type"] for f in rows["Dr. Adriana Santos"]["flags"]})
            self.assertIn("unavailable", {f["type"] for f in rows["Dr. Celeste Tan"]["flags"]})
            self.assertEqual(rows["Dr. Adriana Santos"]["workload"], 5)
            clean = rows["Dr. Daniel Uy"]
            self.assertNotIn("overload", {f["type"] for f in clean["flags"]})

    # --------------------------------------------------------- expertise CRUD
    def test_faculty_expertise_crud_api(self):
        with app.app_context():
            faculty_id = self._faculty("Dr. Daniel Uy").id
            student_account = self._account("student", "student-pm@example.test")
            db.session.commit()
        staff = self._client(self.staff_id, "staff")
        response = staff.get(f"/api/faculty/{faculty_id}/expertise")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertGreaterEqual(len(body["items"]), 5)
        self.assertIn("research_interest", {k["value"] for k in body["kinds"]})
        self.assertEqual({i["source"] for i in body["items"]}, {"demo seed"})

        created = staff.post(f"/api/faculty/{faculty_id}/expertise", json={
            "kind": "publication", "text": "Wireless sensor networks for greenhouse energy monitoring", "year": 2024,
        })
        self.assertEqual(created.status_code, 201, created.get_json())
        item = created.get_json()["item"]
        self.assertEqual(item["kind"], "publication")
        self.assertEqual(item["year"], 2024)
        self.assertEqual(item["source"], "manual entry")

        updated = staff.put(f"/api/faculty-expertise/{item['id']}", json={
            "text": "Wireless sensor networks for greenhouse energy and irrigation monitoring", "year": 2025,
        })
        self.assertEqual(updated.status_code, 200, updated.get_json())
        self.assertEqual(updated.get_json()["item"]["year"], 2025)
        self.assertIn("irrigation", updated.get_json()["item"]["text"])

        # A demo record that is edited in the portal stops being labelled as demo data.
        demo = next(i for i in body["items"] if i["source"] == "demo seed")
        edited = staff.put(f"/api/faculty-expertise/{demo['id']}", json={"text": demo["text"] + " (updated)"})
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.get_json()["item"]["source"], "manual entry")

        for bad in (
            {"kind": "hobby", "text": "Chess and stamp collecting for fun"},
            {"kind": "publication", "text": "abc"},
            {"kind": "publication", "text": "A valid looking publication title", "year": 1200},
            {"kind": "publication", "text": "A valid looking publication title", "year": "soon"},
        ):
            self.assertEqual(staff.post(f"/api/faculty/{faculty_id}/expertise", json=bad).status_code, 400, bad)
        self.assertEqual(staff.post("/api/faculty/99999/expertise", json={"kind": "degree", "text": "PhD in Something"}).status_code, 404)
        self.assertEqual(staff.put("/api/faculty-expertise/99999", json={"text": "Some new text here"}).status_code, 404)

        student = self._client(student_account, "student")
        self.assertEqual(student.get(f"/api/faculty/{faculty_id}/expertise").status_code, 403)
        self.assertEqual(student.post(f"/api/faculty/{faculty_id}/expertise", json={"kind": "degree", "text": "PhD in Anything"}).status_code, 403)
        self.assertEqual(app.test_client().get(f"/api/faculty/{faculty_id}/expertise").status_code, 401)

        deleted = staff.delete(f"/api/faculty-expertise/{item['id']}")
        self.assertEqual(deleted.status_code, 200)
        with app.app_context():
            self.assertIsNone(db.session.get(FacultyExpertise, item["id"]))
        self.assertEqual(staff.delete(f"/api/faculty-expertise/{item['id']}").status_code, 404)

        profile = staff.get(f"/api/faculty/{faculty_id}").get_json()["faculty"]
        self.assertEqual(profile["expertise_count"], len(profile["expertise_records"]))


if __name__ == "__main__":
    unittest.main()
