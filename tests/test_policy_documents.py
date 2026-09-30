"""Policy document library + Policy Assistant (defense items B1-B6, F1, F3).

The tests build their own temp SQLite DB, a temp upload folder and a temp RAG
index folder, so nothing here can write into the real ``uploads/`` folder.
No API key is set unless a test says so; Gemini calls are always mocked.
"""
import json
import os
import tempfile
import unittest
import zipfile
from datetime import date
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as appmod  # noqa: E402

app = appmod.app
db = appmod.db
REAL_UPLOAD_ROOT = Path(appmod.POLICY_DOCUMENT_UPLOAD_ROOT)
REAL_UPLOAD_LISTING = sorted(p.name for p in REAL_UPLOAD_ROOT.glob("*")) if REAL_UPLOAD_ROOT.exists() else []
REPO_ROOT = Path(__file__).resolve().parents[1]
DRAFT_WARNING = "Draft — pending Graduate School validation"
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
_TEST_ROOT = tempfile.mkdtemp(prefix="policy-tests-")
_SHARED_INDEX_DIR = Path(_TEST_ROOT) / "rag-index"


def tearDownModule():
    try:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        os.unlink(_DB_FILE.name)
    except (FileNotFoundError, PermissionError):
        pass
    after = sorted(p.name for p in REAL_UPLOAD_ROOT.glob("*")) if REAL_UPLOAD_ROOT.exists() else []
    assert after == REAL_UPLOAD_LISTING, f"tests wrote into the real upload folder: {set(after) ^ set(REAL_UPLOAD_LISTING)}"


# --------------------------------------------------------------------------- builders
_W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"


def _xml_escape(text):
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def make_docx(paragraphs, raw_document_xml=None, extra_files=None):
    """paragraphs: list of str or ("Heading1", str)."""
    if raw_document_xml is None:
        body = []
        for item in paragraphs:
            style, text = (item if isinstance(item, tuple) else (None, item))
            ppr = f'<w:pPr><w:pStyle w:val="{style}"/></w:pPr>' if style else ""
            body.append(f'<w:p>{ppr}<w:r><w:t xml:space="preserve">{_xml_escape(text)}</w:t></w:r></w:p>')
        raw_document_xml = (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            f'<w:document xmlns:w="{_W}"><w:body>{"".join(body)}</w:body></w:document>'
        )
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        if raw_document_xml is not False:
            archive.writestr("word/document.xml", raw_document_xml)
        for name, content in (extra_files or {}).items():
            archive.writestr(name, content)
    return out.getvalue()


def make_text_pdf(pages):
    import fitz

    document = fitz.open()
    for text in pages:
        page = document.new_page()
        page.insert_textbox(fitz.Rect(50, 50, 545, 790), text, fontsize=11)
    data = document.tobytes()
    document.close()
    return data


def make_scanned_pdf(page_count=2):
    import fitz

    document = fitz.open()
    for _ in range(page_count):
        page = document.new_page()
        page.draw_rect(fitz.Rect(60, 60, 300, 200), color=(0, 0, 0), fill=(0.8, 0.8, 0.8))
    data = document.tobytes()
    document.close()
    return data


TABLET_RULE = "A student may borrow at most seven library tablets at one time."
TABLET_DOC = [
    "Library Lending Memo",
    "Parking permits are issued at the security office every August.",
    TABLET_RULE,
    "The cafeteria closes at six in the evening on weekdays.",
]
TABLET_QUESTION = "How many library tablets may a student borrow?"


class PolicyTestBase(unittest.TestCase):
    use_builtin_library = True

    def setUp(self):
        app.config.update(TESTING=True)
        self.upload_root = Path(tempfile.mkdtemp(dir=_TEST_ROOT)) / "policy_documents"
        patches = [
            patch.object(appmod, "POLICY_DOCUMENT_UPLOAD_ROOT", self.upload_root),
            patch.object(appmod, "RAG_INDEX_DIR", _SHARED_INDEX_DIR),
            patch.object(appmod, "_RAG_EMBED_COOLDOWN_UNTIL", 0.0, create=True),
            patch.dict(os.environ, {
                "GOOGLE_API_KEY": "",
                "GOOGLE_AI_STUDIO_API_KEY": "",
                "RAG_DOCUMENT_DIRS": "",
                "RAG_BACKGROUND_EMBED": "0",
            }),
        ]
        if not self.use_builtin_library:
            patches.append(patch.object(appmod, "RAG_DOCUMENT_PATHS", []))
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        appmod._reset_rag_indexes()
        self.addCleanup(appmod._reset_rag_indexes)
        with app.app_context():
            db.drop_all()
            db.create_all()
            program = appmod.Program(code="PLT", name="Policy Test Program", college="Graduate School")
            db.session.add(program)
            db.session.flush()
            student = appmod.Student(
                student_number="GS-2026-POL", first_name="Policy", last_name="Student",
                email="policy-student@example.test", program_id=program.id, entry_year=2025,
                academic_year_entry="25-26", year_level="1", current_stage="Coursework", standing="Active",
            )
            db.session.add(student)
            db.session.flush()
            self.accounts = {}
            for role in ("staff", "admin", "dean", "academic_coordinator", "research_coordinator", "faculty"):
                self.accounts[role] = self._account(role, f"{role}@example.test")
            self.accounts["student"] = self._account("student", "student@example.test", student_id=student.id)
            db.session.commit()
            self.accounts = {role: account.id for role, account in self.accounts.items()}

    def _account(self, role, email, student_id=None):
        account = appmod.UserAccount(
            email=email, full_name=f"Test {role}", role=role, active=True, student_id=student_id,
            password_hash="not-a-real-hash",
        )
        db.session.add(account)
        db.session.flush()
        return account

    def client(self, role):
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = self.accounts[role]
            session["role"] = role
        return client

    def upload(self, client, data, filename, **fields):
        return client.post(
            "/api/policy-documents",
            data={"file": (BytesIO(data), filename), **fields},
            content_type="multipart/form-data",
        )

    def upload_ok(self, data, filename, client=None, **fields):
        response = self.upload(client or self.client("staff"), data, filename, **fields)
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()["item"]

    def replace(self, client, document_id, data, filename, **fields):
        return client.put(
            f"/api/policy-documents/{document_id}/file",
            data={"file": (BytesIO(data), filename), **fields},
            content_type="multipart/form-data",
        )

    def ask(self, question, role="staff", url="/api/assistant"):
        response = self.client(role).post(url, json={"question": question})
        self.assertEqual(response.status_code, 200, response.get_json())
        return response.get_json()

    def _stored_names(self, document_id):
        with app.app_context():
            return [db.session.get(appmod.PolicyDocument, document_id).stored_name]

    def cited_titles(self, payload):
        return [c.get("title") for c in payload.get("citations") or []]


# =========================================================================== B1
class BuiltInLibraryTests(PolicyTestBase):
    def test_builtin_library_points_at_the_real_folder(self):
        for root in appmod.RAG_DOCUMENT_PATHS:
            if Path(root) != appmod.POLICY_DOCUMENT_UPLOAD_ROOT:
                self.assertTrue(Path(root).exists(), f"{root} does not exist")
        names = {path.name for path in appmod._rag_document_files()}
        self.assertIn("GRADUATE-SCHOOL-HANDBOOK-22-23.pdf", names)
        self.assertTrue(any("Research-Protocol" in name for name in names), names)
        self.assertFalse(any(name.lower().endswith(".xlsx") for name in names), names)

    def test_committed_seed_copies_are_not_indexed_twice(self):
        with patch.object(appmod, "POLICY_DOCUMENT_UPLOAD_ROOT", REAL_UPLOAD_ROOT):
            appmod._reset_rag_indexes()
            files = appmod._rag_document_files()
            chunks = appmod._load_rag_document_index()
        self.assertTrue(any("CAPSTONE_ONLY" in str(path) for path in files), files)
        self.assertEqual(len([p for p in files if "HANDBOOK" in p.name.upper()]), 1, files)
        self.assertEqual(len([p for p in files if "RESEARCH-PROTOCOL" in p.name.upper()]), 1, files)
        self.assertEqual(len({chunk["title"] for chunk in chunks}), 2, {chunk["title"] for chunk in chunks})

    def test_uploading_a_copy_of_a_builtin_file_is_still_indexed_once(self):
        protocol = next(p for p in appmod._rag_document_files() if "RESEARCH-PROTOCOL" in p.name.upper())
        self.upload_ok(protocol.read_bytes(), "protocol-copy.docx", title="Protocol copy", category="Research Protocol")
        appmod._reset_rag_indexes()
        chunks = appmod._load_rag_document_index()
        self.assertEqual(len({chunk["title"] for chunk in chunks}), 2, {chunk["title"] for chunk in chunks})

    def test_missing_library_error_names_the_real_folder(self):
        with patch.object(appmod, "RAG_DOCUMENT_PATHS", []):
            appmod._reset_rag_indexes()
            with self.assertRaises(RuntimeError) as caught:
                appmod._load_rag_document_index()
        message = str(caught.exception)
        self.assertIn("CAPSTONE_ONLY", message)
        self.assertNotIn("data/", message)

    def test_handbook_questions_get_short_cited_answers(self):
        cases = [
            ("What is the maximum residence period for a master's program?", "seven (7)"),
            ("What happens to a student who gets a grade of 5.0?", "dropped"),
            ("Until when may a student add a subject?", "first week"),
            ("What are the passing grades that carry no graduate credit?", "3.0"),
        ]
        for question, expected in cases:
            with self.subTest(question=question):
                payload = self.ask(question)
                self.assertEqual(payload["mode"], "document-rag-local", payload)
                self.assertIn(expected, payload["answer"].lower() if expected.islower() else payload["answer"])
                self.assertLess(len(payload["answer"]), 1400, payload["answer"])
                citation = payload["citations"][0]
                self.assertIn("Handbook", citation["title"])
                self.assertRegex(citation["source"], r"p\. \d+")


# =========================================================================== B2
class UploadedDocumentAnswerTests(PolicyTestBase):
    def test_uploaded_rule_is_answered_from_the_upload_and_names_it(self):
        self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        for question in (TABLET_QUESTION, "What is the rule on how many library tablets a student can borrow?"):
            with self.subTest(question=question):
                payload = self.ask(question)
                self.assertEqual(payload["mode"], "document-rag-local", payload)
                self.assertIn("seven", payload["answer"])
                self.assertIn("Library Lending Memo", payload["answer"])
                self.assertEqual(payload["citations"][0]["title"], "Library Lending Memo")

    def test_answer_is_the_relevant_sentence_not_a_chunk_dump(self):
        self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        answer = self.ask(TABLET_QUESTION)["answer"]
        self.assertIn("seven library tablets", answer)
        self.assertNotIn("Parking", answer)
        self.assertNotIn("cafeteria", answer)

    def test_docx_sections_are_cited_by_heading(self):
        self.use_docx_with_headings()
        payload = self.ask(TABLET_QUESTION)
        self.assertIn("Tablet Lending", payload["citations"][0]["source"])

    def use_docx_with_headings(self):
        self.upload_ok(
            make_docx([
                ("Heading1", "Campus Services"),
                "Parking permits are issued at the security office every August.",
                ("Heading1", "Tablet Lending"),
                TABLET_RULE,
            ]),
            "services.docx", title="Campus Services Memo",
        )

    def test_student_asks_and_gets_the_uploaded_rule(self):
        self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        payload = self.ask(TABLET_QUESTION, role="student", url="/api/student-portal/assistant")
        self.assertEqual(payload["mode"], "student-document-rag-local", payload)
        self.assertIn("seven", payload["answer"])
        self.assertEqual(payload["citations"][0]["title"], "Library Lending Memo")


class UploadLifecycleTests(PolicyTestBase):
    use_builtin_library = False

    def test_replacing_the_file_swaps_the_rule_and_deleting_removes_it(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        self.assertIn("seven", self.ask(TABLET_QUESTION)["answer"])

        new_rule = TABLET_RULE.replace("seven", "twelve")
        replaced = self.replace(
            self.client("staff"), item["id"], make_docx(["Library Lending Memo", new_rule]), "library-memo-v2.docx",
        )
        self.assertEqual(replaced.status_code, 200, replaced.get_json())
        after_replace = self.ask(TABLET_QUESTION)
        self.assertIn("twelve", after_replace["answer"])
        self.assertNotIn("seven", after_replace["answer"])
        self.assertEqual(after_replace["citations"][0]["title"], "Library Lending Memo")

        deleted = self.client("staff").delete(f"/api/policy-documents/{item['id']}")
        self.assertEqual(deleted.status_code, 200)
        after_delete = self.ask(TABLET_QUESTION)
        self.assertNotIn("Library Lending Memo", self.cited_titles(after_delete))
        self.assertNotIn("twelve", after_delete["answer"])
        self.assertNotIn("seven", after_delete["answer"])


# =========================================================================== B3
class UploadsWinTests(PolicyTestBase):
    use_builtin_library = False

    LOA_QUESTIONS = [
        "Explain the LOA and residency rule.",
        "What is the leave of absence limit?",
    ]

    def test_uploaded_policy_beats_the_curated_snippet_for_any_wording(self):
        self.upload_ok(
            make_docx([
                "Leave of Absence Rule",
                "A student on leave of absence (LOA) may stay away for at most nine semesters in total.",
                "The residency clock is paused during an approved LOA.",
            ]),
            "loa.docx", title="Revised LOA Memo",
        )
        for question in self.LOA_QUESTIONS:
            with self.subTest(question=question):
                payload = self.ask(question)
                self.assertEqual(payload["mode"], "document-rag-local", payload)
                self.assertEqual(payload["citations"][0]["title"], "Revised LOA Memo")
                self.assertNotIn("4 semesters", payload["answer"])

    def test_snippets_are_only_a_fallback_when_no_passage_is_relevant(self):
        payload = self.ask("Explain the LOA and residency rule.")
        self.assertEqual(payload["mode"], "policy-retrieval", payload)
        self.assertIn("Leave of Absence", payload["answer"])
        self.assertTrue(payload["citations"])

    def test_with_a_key_the_document_library_is_asked_first(self):
        self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "call_document_rag",
            return_value=("Seven tablets.", [{"id": "d1", "title": "Library Lending Memo", "source": "Library Lending Memo, part 1", "text": TABLET_RULE}]),
        ) as rag:
            payload = self.ask("Explain the LOA and residency rule.")
        rag.assert_called_once()
        self.assertEqual(payload["mode"], "document-rag")


# =========================================================================== B4
class VersionHistoryTests(PolicyTestBase):
    use_builtin_library = False

    def test_replace_keeps_the_previous_version_on_disk_and_in_history(self):
        client = self.client("staff")
        item = self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        first_stored = self._stored_names(item["id"])[0]
        new_bytes = make_docx(["Library Lending Memo", TABLET_RULE.replace("seven", "twelve")])
        response = self.replace(client, item["id"], new_bytes, "library-memo-v2.docx", note="Raised the cap")
        self.assertEqual(response.status_code, 200, response.get_json())
        updated = response.get_json()["item"]

        self.assertEqual(updated["version"], 2)
        self.assertEqual([v["version"] for v in updated["versions"]], [2, 1])
        self.assertTrue(updated["versions"][0]["is_current"])
        self.assertEqual(updated["versions"][0]["note"], "Raised the cap")
        self.assertEqual(updated["versions"][1]["original_name"], "library-memo.docx")
        self.assertTrue((self.upload_root / first_stored).is_file(), "the old file must stay on disk")
        with app.app_context():
            rows = appmod.PolicyDocumentVersion.query.filter_by(document_id=item["id"]).order_by("version_number").all()
            self.assertEqual([r.version_number for r in rows], [1, 2])
            self.assertTrue(all(r.uploaded_by_user_id and r.created_at for r in rows))

        old_view = client.get(updated["versions"][1]["url"])
        self.assertEqual(old_view.status_code, 200)
        self.assertIn(b"PK", old_view.data[:4])
        old_view.close()
        self.assertEqual(self.client("dean").get(updated["versions"][1]["url"]).status_code, 403)

    def test_only_the_current_version_is_indexed(self):
        client = self.client("staff")
        item = self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        self.replace(client, item["id"], make_docx(["Library Lending Memo", TABLET_RULE.replace("seven", "twelve")]), "v2.docx")
        indexed = {path.name for path in appmod._rag_document_files()}
        self.assertEqual(len(indexed), 1, indexed)
        self.assertEqual(len(list(self.upload_root.glob("*"))), 2)
        self.assertNotIn("seven", self.ask(TABLET_QUESTION)["answer"])

    def test_legacy_document_without_version_rows_gets_history_on_replace(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "legacy.docx", title="Legacy Memo")
        with app.app_context():
            appmod.PolicyDocumentVersion.query.delete()
            db.session.commit()
        listing = self.client("staff").get("/api/policy-documents").get_json()["items"]
        legacy = next(row for row in listing if row["id"] == item["id"])
        self.assertEqual([v["version"] for v in legacy["versions"]], [1])
        response = self.replace(self.client("staff"), item["id"], make_docx(["Legacy Memo", "New text about borrowing."]), "legacy-2.docx")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([v["version"] for v in response.get_json()["item"]["versions"]], [2, 1])
        self.assertEqual(len(list(self.upload_root.glob("*"))), 2)

    def test_delete_removes_every_version_file(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "library-memo.docx", title="Library Lending Memo")
        self.replace(self.client("staff"), item["id"], make_docx(["Library Lending Memo", "Other rule."]), "v2.docx")
        self.assertEqual(self.client("staff").delete(f"/api/policy-documents/{item['id']}").status_code, 200)
        self.assertEqual(list(self.upload_root.glob("*")), [])
        with app.app_context():
            self.assertEqual(appmod.PolicyDocumentVersion.query.count(), 0)

    def test_new_metadata_fields_are_stored_validated_and_editable(self):
        client = self.client("staff")
        item = self.upload_ok(
            make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo",
            category="Memo", effective_date="2026-09-01", status="draft", validation_note="Awaiting Dean",
        )
        self.assertEqual(item["category"], "Memo")
        self.assertEqual(item["effective_date"], "2026-09-01")
        self.assertEqual(item["status"], "draft")
        self.assertEqual(item["validation_note"], "Awaiting Dean")

        defaults = self.upload_ok(make_docx(["Plain doc with words about nothing."]), "plain.docx", title="Plain")
        self.assertEqual((defaults["category"], defaults["status"], defaults["effective_date"]), ("Other", "active", None))

        patched = client.patch(f"/api/policy-documents/{item['id']}", json={"status": "active", "category": "Handbook", "effective_date": ""})
        self.assertEqual(patched.status_code, 200, patched.get_json())
        body = patched.get_json()["item"]
        self.assertEqual((body["status"], body["category"], body["effective_date"], body["title"]), ("active", "Handbook", None, "Library Lending Memo"))

        for bad in (
            {"category": "Nonsense"}, {"status": "published"}, {"effective_date": "31/12/2026"},
        ):
            with self.subTest(bad=bad):
                self.assertEqual(client.patch(f"/api/policy-documents/{item['id']}", json=bad).status_code, 400)
                self.assertEqual(
                    self.upload(client, make_docx(TABLET_DOC), "x.docx", title="X", **bad).status_code, 400,
                )

    def test_a_draft_is_searchable_but_every_answer_says_it_is_pending_validation(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo", status="draft")
        payload = self.ask(TABLET_QUESTION)
        self.assertIn("seven", payload["answer"])
        self.assertIn(DRAFT_WARNING, payload["answer"])
        self.assertEqual(payload["citations"][0]["status"], "draft")

        self.client("staff").patch(f"/api/policy-documents/{item['id']}", json={"status": "active"})
        active = self.ask(TABLET_QUESTION)
        self.assertNotIn(DRAFT_WARNING, active["answer"])
        self.assertEqual(active["citations"][0]["status"], "active")

    def test_a_draft_cited_through_the_ai_path_also_carries_the_warning(self):
        self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo", status="draft")
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "_gemini_embed_texts", side_effect=RuntimeError("offline"),
        ), patch.object(appmod, "_gemini_generate", return_value="A student may borrow seven tablets."):
            payload = self.ask(TABLET_QUESTION)
        self.assertEqual(payload["mode"], "document-rag", payload)
        self.assertIn(DRAFT_WARNING, payload["answer"])

    def test_an_archived_document_is_not_searched(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo", status="archived")
        self.assertNotIn("Library Lending Memo", self.cited_titles(self.ask(TABLET_QUESTION)))
        listing = self.client("staff").get("/api/policy-documents").get_json()["items"]
        self.assertTrue(any(row["id"] == item["id"] for row in listing))


# =========================================================================== B5
class ScannedPdfTests(PolicyTestBase):
    use_builtin_library = False

    def test_scanned_pdf_is_read_with_ocr(self):
        pages = [
            "Library cards expire after ninety days of inactivity.",
            "Parking stickers are renewed every year in August.",
        ]
        with patch.object(appmod, "_ocr_pdf_pages", create=True, return_value=pages) as ocr:
            item = self.upload_ok(make_scanned_pdf(2), "scan.pdf", title="Scanned Library Rules")
        ocr.assert_called_once()
        self.assertEqual(item["page_count"], 2)
        self.assertGreater(item["chunk_count"], 0)
        payload = self.ask("When do library cards expire?")
        self.assertIn("ninety days", payload["answer"])
        self.assertEqual(payload["citations"][0]["title"], "Scanned Library Rules")
        self.assertIn("p. 1", payload["citations"][0]["source"])

    def test_scanned_pdf_without_ocr_says_what_to_do(self):
        with patch.object(
            appmod, "_ocr_pdf_pages", create=True,
            side_effect=appmod.PolicyOcrUnavailable("OCR is not available on this computer."),
        ):
            response = self.upload(self.client("staff"), make_scanned_pdf(1), "scan.pdf", title="Scan")
        self.assertEqual(response.status_code, 400)
        self.assertIn("scanned", response.get_json()["error"].lower())
        self.assertIn("OCR", response.get_json()["error"])

    def test_missing_tesseract_program_gives_an_install_hint(self):
        try:
            import pytesseract
        except ImportError:
            self.skipTest("pytesseract is not installed")
        with patch.object(pytesseract, "get_tesseract_version", side_effect=pytesseract.TesseractNotFoundError()):
            response = self.upload(self.client("staff"), make_scanned_pdf(1), "scan.pdf", title="Scan")
        self.assertEqual(response.status_code, 400)
        message = response.get_json()["error"]
        self.assertIn("Tesseract", message)
        self.assertIn("text-based", message)

    def test_text_pdf_does_not_trigger_ocr(self):
        with patch.object(appmod, "_ocr_pdf_pages", create=True, side_effect=AssertionError("OCR must not run")):
            item = self.upload_ok(
                make_text_pdf(["Graduate students must submit the thesis binding form at the library desk. " * 3]),
                "text.pdf", title="Text PDF",
            )
        self.assertEqual(item["page_count"], 1)


# =========================================================================== robustness
class RobustnessTests(PolicyTestBase):
    use_builtin_library = False

    def assert_rejected(self, response, *fragments):
        self.assertEqual(response.status_code, 400, response.get_json())
        message = response.get_json()["error"]
        for fragment in fragments:
            self.assertIn(fragment, message)
        return message

    def test_damaged_and_hostile_docx_files_get_a_readable_error(self):
        client = self.client("staff")
        self.assert_rejected(self.upload(client, b"just some text", "fake.docx"), "DOCX")
        self.assert_rejected(self.upload(client, make_docx([], raw_document_xml="<w:document><w:body>"), "broken.docx"), "DOCX")
        self.assert_rejected(self.upload(client, make_docx([], raw_document_xml=False, extra_files={"other.txt": "x"}), "empty.docx"), "DOCX")
        bomb = (
            '<?xml version="1.0"?><!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]>'
            f'<w:document xmlns:w="{_W}"><w:body><w:p><w:r><w:t>&lol2;</w:t></w:r></w:p></w:body></w:document>'
        )
        self.assert_rejected(self.upload(client, make_docx([], raw_document_xml=bomb), "bomb.docx"))
        blank = make_docx([""])
        self.assert_rejected(self.upload(client, blank, "blank.docx"), "readable text")

    def test_odd_but_valid_docx_structure_is_indexed(self):
        odd = (
            '<?xml version="1.0" encoding="UTF-8"?>'
            f'<w:document xmlns:w="{_W}"><w:body>'
            '<w:p><w:r><w:t>Facilities</w:t></w:r></w:p>'
            '<w:p><w:r><w:t>Scanners</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>may be booked for two hours.</w:t></w:r></w:p>'
            '<w:p><w:pPr><w:pStyle/></w:pPr></w:p>'
            '<w:p><w:r><w:t></w:t></w:r></w:p>'
            '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Locker</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Deposit is 300 pesos per semester.</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'
            '<w:p><w:r><w:pict><w:txbxContent><w:p><w:r><w:t>Textbox note about lockers.</w:t></w:r></w:p></w:txbxContent></w:pict></w:r></w:p>'
            '</w:body></w:document>'
        )
        item = self.upload_ok(make_docx([], raw_document_xml=odd), "odd.docx", title="Facilities Notes")
        self.assertGreater(item["chunk_count"], 0)
        payload = self.ask("How much is the locker deposit per semester?")
        self.assertIn("300 pesos", payload["answer"])

    def test_size_type_and_missing_file_errors_are_readable(self):
        client = self.client("staff")
        self.assert_rejected(self.upload(client, b"plain", "notes.txt"), "PDF and DOCX")
        self.assert_rejected(client.post("/api/policy-documents", data={"title": "No file"}, content_type="multipart/form-data"), "Choose")
        self.assert_rejected(self.upload(client, b"not a pdf", "bad.pdf"), "PDF")
        with patch.dict(os.environ, {"POLICY_DOCUMENT_MAX_MB": "1"}):
            self.assert_rejected(self.upload(client, b"%PDF-1.7 " + b"0" * (1024 * 1024 + 10), "big.pdf"), "1 MB")
        self.assert_rejected(self.upload(client, make_docx(TABLET_DOC), "ok.docx", title="x" * 300), "220")

    def test_non_ascii_file_names_are_accepted(self):
        item = self.upload_ok(make_docx(TABLET_DOC), "políticas-biblioteca.docx")
        self.assertEqual(item["file_type"], "DOCX")
        self.assertTrue(item["title"])

    def test_embedding_outage_does_not_lose_or_stall_a_new_upload(self):
        self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo")
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "_gemini_embed_texts", side_effect=RuntimeError("embeddings down"),
        ) as embed, patch.object(appmod, "_gemini_generate", side_effect=RuntimeError("generation down")):
            first = self.ask(TABLET_QUESTION)
            second = self.ask(TABLET_QUESTION + " Please answer again.")
        for payload in (first, second):
            self.assertIn("seven", payload["answer"])
            self.assertEqual(payload["citations"][0]["title"], "Library Lending Memo")
        self.assertEqual(embed.call_count, 1, "a failed embedding must not be retried on every request")

    def test_new_upload_only_embeds_its_own_passages(self):
        seen_batches = []

        def fake_embed(texts, purpose, **_kwargs):
            seen_batches.append((purpose, list(texts)))
            vectors = []
            for text in texts:
                bucket = [0.0] * 64
                for word in text.lower().split():
                    bucket[hash(word) % 64] += 1.0
                norm = sum(v * v for v in bucket) ** 0.5 or 1.0
                vectors.append([v / norm for v in bucket])
            return vectors

        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "_gemini_embed_texts", side_effect=fake_embed,
        ), patch.object(appmod, "_gemini_generate", return_value="Seven tablets."), patch.object(
            appmod, "RAG_INDEX_DIR", Path(tempfile.mkdtemp(dir=_TEST_ROOT)),
        ):
            appmod._reset_rag_indexes()
            self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo")
            self.ask(TABLET_QUESTION)
            seen_batches.clear()
            self.upload_ok(make_docx(["Gym Rules", "The gym opens at seven in the morning."]), "gym.docx", title="Gym Rules Memo")
            payload = self.ask(TABLET_QUESTION)
        document_batches = [texts for purpose, texts in seen_batches if purpose == "document"]
        embedded = " ".join(" ".join(texts) for texts in document_batches)
        self.assertIn("Gym Rules Memo", embedded)
        self.assertNotIn("Library Lending Memo", embedded)
        self.assertEqual(payload["mode"], "document-rag")
        self.assertIn("Library Lending Memo", self.cited_titles(payload))


# =========================================================================== F3
class RoleAccessTests(PolicyTestBase):
    use_builtin_library = False

    def setUp(self):
        super().setUp()
        self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo")

    def test_every_signed_in_role_can_ask_a_policy_question(self):
        for role in ("staff", "admin", "dean", "academic_coordinator", "research_coordinator", "faculty"):
            with self.subTest(role=role):
                payload = self.ask(TABLET_QUESTION, role=role)
                self.assertIn("seven", payload["answer"])
                self.assertEqual(payload["citations"][0]["title"], "Library Lending Memo")
                suggestions = self.client(role).get("/api/assistant/suggestions")
                self.assertEqual(suggestions.status_code, 200)
                self.assertTrue(suggestions.get_json()["items"])

    def test_anonymous_users_cannot_ask(self):
        self.assertEqual(app.test_client().post("/api/assistant", json={"question": TABLET_QUESTION}).status_code, 401)

    def test_only_staff_and_admin_get_student_records_from_the_assistant(self):
        for role in ("dean", "academic_coordinator", "research_coordinator", "faculty"):
            with self.subTest(role=role):
                payload = self.ask("Which students need attention right now?", role=role)
                self.assertEqual(payload["mode"], "role-guarded", payload)
                self.assertIsNone(payload.get("structured"))
        staff = self.ask("Which students need attention right now?", role="staff")
        self.assertEqual(staff["mode"], "database-rules")

    def test_a_student_using_the_shared_endpoint_stays_in_the_student_sandbox(self):
        payload = self.ask("Which students need attention right now?", role="student")
        self.assertEqual(payload["mode"], "student-guarded", payload)
        self.assertNotIn("structured", payload)
        policy = self.ask(TABLET_QUESTION, role="student")
        self.assertIn("seven", policy["answer"])

    def test_managing_the_library_stays_staff_and_admin_only(self):
        for role in ("dean", "academic_coordinator", "research_coordinator", "faculty", "student"):
            with self.subTest(role=role):
                client = self.client(role)
                self.assertEqual(client.get("/api/policy-documents").status_code, 403)
                self.assertEqual(self.upload(client, make_docx(TABLET_DOC), "x.docx", title="X").status_code, 403)
                self.assertEqual(client.post("/api/policy-documents/test-question", json={"question": "x"}).status_code, 403)
        self.assertEqual(self.client("admin").get("/api/policy-documents").status_code, 200)


# =========================================================================== "Test a question"
class TestAQuestionTests(PolicyTestBase):
    use_builtin_library = False

    def test_staff_can_see_which_passages_would_be_used(self):
        self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo", status="draft")
        response = self.client("staff").post("/api/policy-documents/test-question", json={"question": TABLET_QUESTION})
        self.assertEqual(response.status_code, 200, response.get_json())
        body = response.get_json()
        self.assertEqual(body["question"], TABLET_QUESTION)
        first = body["items"][0]
        self.assertEqual(first["title"], "Library Lending Memo")
        self.assertIn("seven library tablets", first["excerpt"])
        self.assertEqual(first["status"], "draft")
        self.assertTrue(first["document_id"])
        self.assertIn(body["mode"], {"lexical", "vector"})
        self.assertIn("seven", body["answer_preview"])

    def test_empty_and_unmatched_questions_are_handled(self):
        client = self.client("staff")
        self.assertEqual(client.post("/api/policy-documents/test-question", json={"question": "  "}).status_code, 400)
        self.upload_ok(make_docx(TABLET_DOC), "memo.docx", title="Library Lending Memo")
        body = client.post("/api/policy-documents/test-question", json={"question": "purple monkey dishwasher"}).get_json()
        self.assertEqual(body["items"], [])
        self.assertIsNone(body["answer_preview"])


# =========================================================================== B6 + schema
class HousekeepingTests(PolicyTestBase):
    def test_frontend_package_has_no_self_dependency(self):
        package = json.loads((REPO_ROOT / "frontend" / "package.json").read_text(encoding="utf-8"))
        self.assertNotIn("capstone-usls-platform", package.get("dependencies", {}))

    def test_file_view_routes_are_in_the_access_control_spec(self):
        spec = {endpoint: roles for _label, endpoint, roles in appmod.ACCESS_CONTROL_SPEC}
        for endpoint in (
            "policy_document_file", "system_policy_document_file",
            "policy_document_version_file", "policy_document_test_question",
        ):
            self.assertEqual(spec.get(endpoint), {"staff"}, endpoint)
        self.assertEqual(spec.get("assistant"), set())
        with app.app_context():
            self.assertEqual(appmod.access_control_kpi()["value"], 100.0, appmod.access_control_kpi()["basis"])

    def test_seed_folder_is_tracked_and_real_uploads_are_not_ignored_by_accident(self):
        # The seed library stays committed; the test module itself never touches it
        # (tearDownModule compares the folder before and after the whole run).
        self.assertNotEqual(self.upload_root, REAL_UPLOAD_ROOT)
        self.assertTrue(REAL_UPLOAD_ROOT.exists())

    def test_startup_migration_adds_the_new_columns_to_an_old_table(self):
        with app.app_context():
            db.session.execute(appmod.text("DROP TABLE IF EXISTS policy_document_version"))
            db.session.execute(appmod.text("DROP TABLE policy_document"))
            db.session.execute(appmod.text(
                "CREATE TABLE policy_document (id INTEGER PRIMARY KEY, title VARCHAR(220) NOT NULL, "
                "description TEXT NOT NULL, original_name VARCHAR(255) NOT NULL, stored_name VARCHAR(255) NOT NULL UNIQUE, "
                "mime_type VARCHAR(100) NOT NULL, file_size INTEGER NOT NULL, page_count INTEGER NOT NULL, "
                "chunk_count INTEGER NOT NULL, uploaded_by_user_id INTEGER NOT NULL, created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL)"
            ))
            db.session.execute(appmod.text(
                "INSERT INTO policy_document VALUES (1, 'Old', '', 'old.pdf', 'abc-old.pdf', 'application/pdf', 1, 1, 1, 1, "
                "'2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            ))
            db.session.commit()
            appmod.ensure_policy_document_schema()
            columns = {c["name"] for c in appmod.inspect(db.engine).get_columns("policy_document")}
            self.assertTrue({"category", "effective_date", "status", "validation_note"} <= columns, columns)
            self.assertIn("policy_document_version", appmod.inspect(db.engine).get_table_names())
            document = db.session.get(appmod.PolicyDocument, 1)
            self.assertEqual((document.status, document.category), ("active", "Other"))
            appmod.ensure_policy_document_schema()  # idempotent


if __name__ == "__main__":
    unittest.main()
