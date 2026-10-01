"""Policy Assistant quality: does it find the right passage and answer from it, with no AI key?

``tests/assistant_eval.json`` holds real questions with the passage that answers each one. The whole set is run
through the real pipeline (document index -> search -> answer) with NO API key. Two things are measured:

* hit@1 / hit@3: is the right Handbook page / Research Protocol section among the first 1 / 3 passages found;
* key-phrase coverage: how many of the facts the correct answer must contain are in the answer text.

Run it alone to see the table:  python -m unittest tests.test_assistant_quality.AssistantQualityReport -v
Set ASSISTANT_EVAL_LEGACY=1 to measure the old retriever (handbook pages are then shifted to printed numbers).
"""
import json
import os
import re
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

import app as appmod  # noqa: E402
import policy_rag  # noqa: E402

app = appmod.app
db = appmod.db
EVAL_FILE = Path(__file__).with_name(os.environ.get("ASSISTANT_EVAL_FILE", "assistant_eval.json"))
_TEST_ROOT = tempfile.mkdtemp(prefix="assistant-quality-")
_INDEX_DIR = Path(_TEST_ROOT) / "rag-index"
LEGACY = os.environ.get("ASSISTANT_EVAL_LEGACY") == "1"
HANDBOOK_PDF_OFFSET = int(os.environ.get("ASSISTANT_EVAL_OFFSET", "4"))  # old index numbered pages by PDF position; printed number is 4 lower


def tearDownModule():
    try:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        os.unlink(_DB_FILE.name)
    except (FileNotFoundError, PermissionError):
        pass


def _norm(text: str) -> str:
    return " ".join((text or "").lower().replace("’", "'").replace("“", '"').replace("”", '"').split())


def _chunk_page(chunk: dict):
    if chunk.get("page"):
        return int(chunk["page"])
    match = re.search(r"\bp\. (\d+)", chunk.get("source") or "")
    if not match:
        return None
    page = int(match.group(1))
    if LEGACY and "Handbook" in (chunk.get("title") or ""):
        page -= HANDBOOK_PDF_OFFSET
    return page


def chunk_matches(chunk: dict, source: dict) -> bool:
    title = chunk.get("title") or ""
    if source["doc"].lower() not in title.lower():
        return False
    if source.get("pages"):
        return _chunk_page(chunk) in source["pages"]
    if source.get("section"):
        label = f"{chunk.get('section') or ''} {chunk.get('source') or ''}".lower()
        return source["section"].lower() in label
    return True


class EvalBase(unittest.TestCase):
    def setUp(self):
        app.config.update(TESTING=True)
        patches = [
            patch.object(appmod, "POLICY_DOCUMENT_UPLOAD_ROOT", Path(_TEST_ROOT) / "policy_documents"),
            patch.object(appmod, "RAG_INDEX_DIR", _INDEX_DIR),
            patch.dict(os.environ, {
                "GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": "", "RAG_DOCUMENT_DIRS": "", "RAG_BACKGROUND_EMBED": "0",
            }),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)
        appmod._reset_rag_indexes()
        self.addCleanup(appmod._reset_rag_indexes)
        with app.app_context():
            db.drop_all()
            db.create_all()
            if os.environ.get("ASSISTANT_EVAL_WITH_MANUAL") == "1":
                # the live library also holds the Operations Manual draft; measure with it present
                db.session.add(appmod.UserAccount(
                    email="owner@example.test", full_name="Owner", role="admin", active=True, password_hash="x",
                ))
                db.session.commit()
                appmod.ensure_operations_manual_policy_document()
                appmod._reset_rag_indexes()


class AssistantQualityReport(EvalBase):
    def retrieve(self, question: str, limit: int = 3) -> list[dict]:
        search = getattr(appmod, "search_policy_passages", None)
        if LEGACY or search is None:
            chunks = appmod._load_rag_document_index()
            return appmod._retrieve_rag_document_chunks_lexically(question, chunks, limit)
        return search(question, limit)

    def evaluate(self, path: Path = None) -> dict:
        questions = json.loads((path or EVAL_FILE).read_text(encoding="utf-8"))["questions"]
        rows = []
        with app.app_context():
            for item in questions:
                question = item["question"]
                try:
                    top = self.retrieve(question, 3)
                except appmod.PolicyPassageNotFound:
                    top = []
                result = appmod.generate_answer(question, policy_only=True, role="dean")
                answer = _norm(result["answer"])
                row = {"id": item["id"], "mode": result["mode"], "answer": result["answer"], "refusal": item.get("expect_refusal", False)}
                if item.get("expect_refusal"):
                    row["refused"] = not result.get("citations") or "could not find" in answer
                    rows.append(row)
                    continue
                hits = [any(chunk_matches(chunk, source) for source in item["sources"]) for chunk in top]
                row["hit1"] = bool(hits[:1] and hits[0])
                row["hit3"] = any(hits)
                row["top"] = [f"{c.get('source')}" for c in top]
                keys = item["keys"]
                found = [bool(re.search(key, answer, re.IGNORECASE)) for key in keys]
                row["keys"] = f"{sum(found)}/{len(keys)}"
                row["coverage"] = sum(found) / len(keys)
                row["answer_chars"] = len(result["answer"])
                rows.append(row)
        graded = [row for row in rows if not row["refusal"]]
        refusals = [row for row in rows if row["refusal"]]
        return {
            "rows": rows,
            "n": len(graded),
            "hit1": sum(row["hit1"] for row in graded) / len(graded),
            "hit3": sum(row["hit3"] for row in graded) / len(graded),
            "coverage": sum(row["coverage"] for row in graded) / len(graded),
            "refused": sum(row["refused"] for row in refusals), "refusal_n": len(refusals),
            "avg_chars": sum(row["answer_chars"] for row in graded) / len(graded),
        }

    def test_quality_report(self):
        report = self.evaluate()
        lines = [f"{'id':26} {'hit1':5} {'hit3':5} {'keys':5} chars  top-1 source"]
        for row in report["rows"]:
            if row["refusal"]:
                lines.append(f"{row['id']:26} refused={row['refused']}  mode={row['mode']}")
            else:
                lines.append(
                    f"{row['id']:26} {str(row['hit1'])[0]:5} {str(row['hit3'])[0]:5} {row['keys']:5} "
                    f"{row['answer_chars']:5}  {(row['top'] or ['-'])[0][:70]}"
                )
        lines.append(
            f"\nN={report['n']}  hit@1={report['hit1']:.0%}  hit@3={report['hit3']:.0%}  "
            f"key-phrase coverage={report['coverage']:.0%}  avg answer chars={report['avg_chars']:.0f}  "
            f"refusals correct={report['refused']}/{report['refusal_n']}"
        )
        print("\n" + "\n".join(lines).encode("ascii", "replace").decode())
        if LEGACY:
            return
        self.assertGreaterEqual(report["hit3"], 0.80, "the right passage must be in the top 3 for at least 80% of the questions")
        self.assertGreaterEqual(report["coverage"], 0.75)
        self.assertEqual(report["refused"], report["refusal_n"], "out-of-scope questions must be refused, not answered with a stray passage")

    def test_held_out_questions_do_as_well(self):
        # Written after the rules were tuned; guards against a result that only holds for the tuning questions.
        report = self.evaluate(Path(__file__).with_name("assistant_eval_holdout.json"))
        self.assertGreaterEqual(report["hit3"], 0.80)
        self.assertGreaterEqual(report["coverage"], 0.70)
        self.assertEqual(report["refused"], report["refusal_n"])


class TextCleaningTests(unittest.TestCase):
    def test_broken_quotes_bullets_and_ligatures_are_repaired(self):
        raw = "The student’s “INC” grade – see the oﬃce.\n• first item\n� second item\nit�s fine"
        clean = policy_rag.clean_text(raw)
        self.assertNotIn("�", clean)
        self.assertNotIn("’", clean)
        self.assertNotIn("•", clean)
        self.assertIn("student's", clean)
        self.assertIn('"INC"', clean)
        self.assertIn("office", clean)
        self.assertIn("- first item", clean)
        self.assertIn("- second item", clean)
        self.assertIn("it's fine", clean)

    def test_a_word_split_by_a_hyphen_at_the_line_end_is_rejoined(self):
        vocab = policy_rag.Counter({"weighted": 3, "cross-enrollment": 2})
        self.assertEqual(policy_rag._join_lines(["a weight-", "ed average"], vocab), "a weighted average")
        self.assertEqual(
            policy_rag._join_lines(["cross-", "enrollment is not allowed"], vocab), "cross-enrollment is not allowed"
        )


class HandbookStructureTests(EvalBase):
    def chunks(self):
        with app.app_context():
            return appmod._load_rag_document_index()

    def test_chunks_carry_the_printed_page_and_section_title(self):
        withdrawal = [c for c in self.chunks() if "Withdrawal of Subject" in (c.get("section") or "")]
        self.assertTrue(withdrawal)
        self.assertEqual(withdrawal[0]["page"], 49, "printed page, not the PDF position (53)")
        self.assertIn("Graduate School Handbook 2022-2023, p. 49", withdrawal[0]["source"])
        self.assertIn("3.1 REGISTRATION", withdrawal[0]["section"])

    def test_running_headers_and_table_of_contents_are_not_searchable_text(self):
        handbook = [c for c in self.chunks() if "Handbook" in c["title"]]
        self.assertFalse([c for c in handbook if "Graduate Programs Student Handbook 2022-2023" in c["text"]])
        self.assertFalse([c for c in handbook if c["text"].startswith("Contents")])

    def test_no_chunk_is_a_long_dump_and_none_has_broken_characters(self):
        for chunk in self.chunks():
            self.assertLessEqual(len(chunk["text"].split()), 320, chunk["source"])
            self.assertNotIn("�", chunk["text"])

    def test_a_sentence_that_runs_over_a_page_break_stays_whole(self):
        change = [c for c in self.chunks() if c.get("section", "").endswith("Change of Subject")]
        self.assertIn("first week of classes under the following conditions", " ".join(c["text"] for c in change))


class SearchAndAnswerTests(EvalBase):
    def ask(self, question):
        with app.app_context():
            return appmod.generate_answer(question, policy_only=True, role="dean")

    def test_domain_words_find_the_handbook_wording(self):
        with app.app_context():
            for question, page in (
                ("What is the penalty if I miss too many classes?", 52),
                ("How long can a LOA last?", 52),
                ("Can I be readmitted after failing a subject?", 54),
            ):
                with self.subTest(question=question):
                    pages = {chunk.get("page") for chunk in appmod.search_policy_passages(question, 3)}
                    self.assertTrue(pages & {page, page + 1}, (question, pages))

    def test_answer_is_short_direct_and_names_page_and_section(self):
        payload = self.ask("What happens if I fail a subject?")
        self.assertEqual(payload["mode"], "document-rag-local")
        self.assertIn("automatically dropped", payload["answer"])
        self.assertIn("no re-admission", payload["answer"])
        self.assertIn(
            "Source: Graduate School Handbook 2022-2023 (p. 54, 3.5 ACADEMIC PERFORMANCE - Retention Policy)",
            payload["answer"],
        )
        self.assertLess(len(payload["answer"]), 700)
        citation = payload["citations"][0]
        self.assertEqual(citation["page"], 54)
        self.assertIn("Retention Policy", citation["section"])
        self.assertIn("automatically dropped", citation["quote"])

    def test_answer_text_has_no_broken_or_curly_characters(self):
        for question in (
            "What is the maximum residence for a master's program?",
            "How long does a student have to complete an INC grade?",
        ):
            answer = self.ask(question)["answer"]
            self.assertTrue(answer.isascii(), answer)

    def test_a_question_the_documents_do_not_answer_gets_a_plain_refusal(self):
        for question in ("Who won the basketball championship last season?", "What is the capital of France?"):
            with self.subTest(question=question):
                payload = self.ask(question)
                self.assertIn("could not find this in the Handbook", payload["answer"])
                self.assertEqual(payload["citations"], [])

    def test_badge_says_keyword_search_and_notes_the_missing_key(self):
        source = self.ask("Until when can a student withdraw a subject?")["source"]
        self.assertEqual(source["label"], "Answered from the documents (keyword search)")
        self.assertFalse(source["ai_used"])
        self.assertIn("No AI key", source["note"])

    def test_a_draft_document_never_outranks_the_handbook_for_the_same_rule(self):
        rule = "The leave may be approved for a period of one (1) year but may be renewed for at most another year."
        draft = {"id": "d1", "title": "Operations Manual", "source": "Operations Manual, p. 1", "status": "draft",
                 "kind": "managed", "text": rule, "section": "Leave", "sec": "m#0", "page": 1}
        real = {"id": "d2", "title": "Handbook", "source": "Handbook, p. 52", "status": "active",
                "kind": "system", "text": rule, "section": "Leave", "sec": "h#0", "page": 52}
        top = policy_rag.search("How long can a leave last?", [draft, real], 2)
        self.assertEqual(top[0]["id"], "d2")


class GeminiHybridPathTests(EvalBase):
    """With a key: embeddings and BM25 are fused and the model must stay inside the passages. No network."""

    @staticmethod
    def fake_vector(text, size=48):
        bucket = [0.0] * size
        for word in re.findall(r"[a-z0-9]+", text.lower()):
            bucket[hash(word) % size] += 1.0
        norm = sum(v * v for v in bucket) ** 0.5 or 1.0
        return [v / norm for v in bucket]

    def run_with_key(self, question, generated):
        seen = {}

        def fake_generate(prompt):
            seen["prompt"] = prompt
            return generated

        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "_load_rag_vector_index",
            side_effect=lambda chunks: {c["id"]: self.fake_vector(c["text"]) for c in chunks},
        ), patch.object(appmod, "_embed_rag_query", side_effect=lambda q: self.fake_vector(q)), patch.object(
            appmod, "_gemini_generate", side_effect=fake_generate,
        ):
            with app.app_context():
                payload = appmod.generate_answer(question, policy_only=True, role="dean")
        return payload, seen.get("prompt", "")

    def test_prompt_is_grounded_cites_page_and_section_and_allows_refusal(self):
        payload, prompt = self.run_with_key(
            "How long can a leave of absence last?", "One year, renewable once. (Handbook, p. 52, Leave of Absence)"
        )
        self.assertEqual(payload["mode"], "document-rag")
        self.assertEqual(payload["source"]["label"], "AI answer grounded in the documents")
        self.assertTrue(payload["source"]["ai_used"])
        self.assertIn("using ONLY the numbered excerpts", prompt)
        self.assertIn("page and section", prompt)
        self.assertIn(policy_rag.NOT_FOUND_ANSWER, prompt)
        self.assertRegex(prompt, r"\[1\. [^\]]*p\. \d+")
        self.assertIn("Question: How long can a leave of absence last?", prompt)

    def test_keyword_search_still_contributes_when_the_embedding_misses(self):
        # The fake embedding knows nothing about meaning; BM25 must put the right page into the passages sent to the model.
        _payload, prompt = self.run_with_key("How long does a student have to complete an INC grade?", "One year.")
        self.assertIn("one (1) academic year", prompt)

    def test_a_model_refusal_shows_no_unrelated_sources(self):
        payload, _prompt = self.run_with_key("What is the capital of France?", policy_rag.NOT_FOUND_ANSWER)
        self.assertEqual(payload["answer"], policy_rag.NOT_FOUND_ANSWER)
        self.assertEqual(payload["citations"], [])

    def test_when_the_model_is_down_the_keyword_answer_is_used(self):
        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"}), patch.object(
            appmod, "_load_rag_vector_index", side_effect=RuntimeError("offline"),
        ), patch.object(appmod, "_gemini_generate", side_effect=RuntimeError("down")):
            with app.app_context():
                payload = appmod.generate_answer(
                    "Until when can a student withdraw a subject?", policy_only=True, role="dean"
                )
        self.assertEqual(payload["mode"], "document-rag-local")
        self.assertIn("second week", payload["answer"])


if __name__ == "__main__":
    unittest.main()
