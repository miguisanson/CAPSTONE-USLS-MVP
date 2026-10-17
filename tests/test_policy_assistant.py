"""The Policy Assistant is grounded, honest and personal (owner decision IM21, closes J13 / I-013).

* grounded: Gemini sees ONLY the retrieved excerpts of the policy documents (plus the signed-in user's own
  record for a personal question) and every answer lists the document, section and page it came from;
* honest: when retrieval is weak, or Gemini says the excerpts do not answer, the reply is the plain
  "the documents don't cover this" answer with no passages, and Gemini is not even called on weak retrieval;
* personal: "what is my next step" is answered from the SIGNED-IN user's own record (a student's stage and open
  tasks, a staff member's queue), never from anybody else's;
* fallback: with no key, or on a Gemini error, the keyword answer comes back labelled as an offline answer.

No test touches the network: ``app._gemini_generate`` is mocked and ``app.urlopen`` always fails.
"""
import os
import tempfile
import unittest
from datetime import date, timedelta
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
# Never write into the committed seed library or the real RAG index.
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ.setdefault("USLS_UPLOAD_DIR", tempfile.mkdtemp(prefix="uploads-"))
os.environ["RAG_PREWARM"] = "0"

import app as appmod  # noqa: E402
import policy_rag  # noqa: E402

app = appmod.app
db = appmod.db

COVERED_QUESTION = "What is the maximum residence period for a master's program?"
COVERED_ANSWER = (
    "A master's student may stay in the program for at most seven (7) years. "
    "(Graduate School Handbook 2022-2023, p. 49, Maximum Residence)"
)
UNCOVERED_QUESTIONS = ["What time does the campus gym open on weekends?", "Who won the basketball championship last season?"]
STUDENT_A_EMAIL = "adrian.lim@student.usls.edu.ph"      # Coursework
STUDENT_B_EMAIL = "elena.mendoza@student.usls.edu.ph"   # Proposal Development
TASK_A = "Confirm your second-semester subjects with the Academic Coordinator"
TASK_B = "Submit the signed Form 4 to the Research Coordinator"
TASK_STAFF = "Verify the leave documents for the assistant queue test"
TASK_COORDINATOR = "Clear the course audit for the assistant queue test"


def tearDownModule():
    try:
        with app.app_context():
            db.session.remove()
            db.engine.dispose()
        os.unlink(_DB_FILE.name)
    except (FileNotFoundError, PermissionError):
        pass


def fail_http(*_args, **_kwargs):
    raise HTTPError("https://generativelanguage.googleapis.com", 500, "server error", {}, None)


def no_network(*_args, **_kwargs):
    raise URLError("no network in tests")


class AssistantBase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        app.config.update(TESTING=True)
        with app.app_context():
            db.create_all()
            appmod.build_demo_database()
            db.session.commit()
            cls.accounts = {}
            for account in appmod.UserAccount.query.all():
                cls.accounts[account.email] = (account.id, account.role)
            cls.student_a = db.session.get(appmod.Student, db.session.get(appmod.UserAccount, cls.accounts[STUDENT_A_EMAIL][0]).student_id)
            cls.student_b = db.session.get(appmod.Student, db.session.get(appmod.UserAccount, cls.accounts[STUDENT_B_EMAIL][0]).student_id)
            cls.student_a_id, cls.student_b_id = cls.student_a.id, cls.student_b.id
            cls.stage_a = appmod.student_portal_stage(cls.student_a, None)
            cls.stage_b = appmod.student_portal_stage(cls.student_b, None)
            today = date.today()
            db.session.add_all([
                appmod.Task(student_id=cls.student_a_id, title=TASK_A, owner_role="Student", due_at=today + timedelta(days=4)),
                appmod.Task(student_id=cls.student_b_id, title=TASK_B, owner_role="Student", due_at=today + timedelta(days=6)),
                appmod.Task(student_id=cls.student_a_id, title=TASK_STAFF, owner_role="Graduate School Staff", due_at=today + timedelta(days=2)),
                appmod.Task(student_id=cls.student_b_id, title=TASK_COORDINATOR, owner_role="Academic Coordinator", due_at=today + timedelta(days=3)),
            ])
            db.session.commit()
            cls.all_names = [student.name for student in appmod.Student.query.all()]
            appmod._reset_rag_indexes()
            appmod._load_rag_document_index()  # read the Handbook and the Research Protocol once

    @classmethod
    def tearDownClass(cls):
        with app.app_context():
            db.session.remove()

    def setUp(self):
        env = patch.dict(os.environ, {
            "GOOGLE_API_KEY": "", "GOOGLE_AI_STUDIO_API_KEY": "", "RAG_BACKGROUND_EMBED": "0",
        })
        env.start()
        self.addCleanup(env.stop)
        appmod._RAG_RESPONSE_CACHE.clear()  # an answer cached by one test must not hide the call another test checks
        net = patch.object(appmod, "urlopen", side_effect=no_network)
        net.start()
        self.addCleanup(net.stop)

    def client(self, email):
        account_id, role = self.accounts[email]
        client = app.test_client()
        with client.session_transaction() as session:
            session["account_id"] = account_id
            session["role"] = role
        return client

    def ask(self, email, question, url="/api/assistant"):
        response = self.client(email).post(url, json={"question": question})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True)[:400])
        return response.get_json()

    @staticmethod
    def with_key():
        return patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key"})

    @staticmethod
    def keyword_only():
        """A key is set but the embedding service answers nothing: retrieval is keyword search alone."""
        return patch.object(appmod, "_load_rag_vector_index", side_effect=RuntimeError("no embeddings"))

    @staticmethod
    def vectors(chunk_vector, query_vector):
        """Every chunk gets ``chunk_vector``; the question gets ``query_vector``."""
        return (
            patch.object(appmod, "_load_rag_vector_index", side_effect=lambda chunks: {c["id"]: chunk_vector for c in chunks}),
            patch.object(appmod, "_embed_rag_query", side_effect=lambda _q: query_vector),
        )

    def assertNoStudentNames(self, text):
        for name in self.all_names:
            self.assertNotIn(name, text)


class GroundedAnswerTests(AssistantBase):
    def test_a_covered_question_is_answered_by_gemini_from_the_excerpts_with_sources(self):
        generate = MagicMock(return_value=COVERED_ANSWER)
        with self.with_key(), self.keyword_only(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask("dean@usls.edu.ph", COVERED_QUESTION)
        generate.assert_called_once()
        prompt = generate.call_args.args[0]
        self.assertIn(COVERED_ANSWER, payload["answer"])
        self.assertEqual(payload["mode"], "document-rag")
        self.assertTrue(payload["source"]["ai_used"])
        self.assertFalse(payload["offline"])
        self.assertFalse(payload["not_covered"])
        # each source names its document and where in it
        self.assertTrue(payload["sources"])
        self.assertEqual(payload["sources"], payload["citations"])
        for source in payload["sources"]:
            self.assertTrue(source["title"])
            self.assertTrue(source.get("page") or source.get("section"), source)
        self.assertIn("Handbook", payload["sources"][0]["title"])
        # the prompt carries the retrieved excerpts and the question, and nothing else
        self.assertIn("seven (7)", prompt)
        self.assertIn(f"Question: {COVERED_QUESTION}", prompt)
        self.assertIn("using ONLY the numbered excerpts", prompt)
        self.assertNotIn("Student context", prompt)
        self.assertNotIn("Known policy snippets", prompt)
        self.assertNoStudentNames(prompt)

    def test_a_student_policy_question_sends_no_record_to_gemini(self):
        generate = MagicMock(return_value=COVERED_ANSWER)
        with self.with_key(), self.keyword_only(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask(STUDENT_A_EMAIL, COVERED_QUESTION)
        prompt = generate.call_args.args[0]
        self.assertTrue(payload["sources"])
        self.assertIn("seven (7)", prompt)
        self.assertNoStudentNames(prompt)
        self.assertNotIn(self.stage_a, prompt)
        self.assertNotIn(TASK_A, prompt)

    def test_the_prompt_asks_for_citations_and_a_plain_refusal(self):
        generate = MagicMock(return_value=COVERED_ANSWER)
        with self.with_key(), self.keyword_only(), patch.object(appmod, "_gemini_generate", generate):
            self.ask("dean@usls.edu.ph", COVERED_QUESTION)
        prompt = generate.call_args.args[0]
        self.assertIn("page and section", prompt)
        self.assertIn(policy_rag.NOT_FOUND_ANSWER, prompt)
        self.assertRegex(prompt, r"\[1\. [^\]]*p\. \d+")
        self.assertLess(len(prompt.split()), 1500)


class HonestAnswerTests(AssistantBase):
    def assertNotCovered(self, payload):
        self.assertTrue(payload["not_covered"], payload)
        self.assertIn(payload["mode"], {"policy-not-found", "student-document-not-found"})
        self.assertIn("don't cover this", payload["answer"])
        self.assertIn("Ask the Graduate School office", payload["answer"])
        self.assertEqual(payload["citations"], [])
        self.assertEqual(payload["sources"], [])
        self.assertFalse(payload["source"]["ai_used"])

    def test_an_uncovered_question_says_so_and_never_calls_gemini(self):
        v_index, v_query = self.vectors([1.0, 0.0, 0.0], [0.0, 1.0, 0.0])  # the embedding sees no likeness
        for email in ("dean@usls.edu.ph", STUDENT_A_EMAIL):
            for question in UNCOVERED_QUESTIONS:
                with self.subTest(user=email.split("@")[0], question=question):
                    generate = MagicMock(return_value="This should never be shown.")
                    with self.with_key(), v_index, v_query, patch.object(appmod, "_gemini_generate", generate):
                        payload = self.ask(email, question)
                    generate.assert_not_called()
                    self.assertNotCovered(payload)

    def test_an_uncovered_question_without_a_key_gets_the_same_plain_answer(self):
        for question in UNCOVERED_QUESTIONS:
            with self.subTest(question=question):
                self.assertNotCovered(self.ask("dean@usls.edu.ph", question))

    def test_a_not_covered_answer_never_lists_the_curated_snippets_as_sources(self):
        # Found by the evaluation run: the library did not answer, yet two curated snippets were listed as sources.
        snippet = {"id": "curated-loa", "title": "Leave of Absence & Residency", "source": "curated", "text": "A leave may be approved."}
        with patch.object(appmod, "_relevant_policy_snippets", return_value=[snippet]), patch.object(
            appmod, "call_local_document_rag", side_effect=appmod.PolicyAnswerNotFound("no answer"),
        ):
            payload = self.ask("dean@usls.edu.ph", "Explain the LOA and residency rule.")
        self.assertNotCovered(payload)

    def test_colloquial_wording_with_a_close_embedding_still_reaches_gemini(self):
        # The keyword search finds nothing for these words, but the embedding says the passages are close.
        v_index, v_query = self.vectors([1.0, 0.0], [1.0, 0.0])
        generate = MagicMock(return_value="You may ask for a leave of absence. (Graduate School Handbook 2022-2023, p. 52)")
        with self.with_key(), v_index, v_query, patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask("dean@usls.edu.ph", "What time does the campus gym open on weekends?")
        generate.assert_called_once()
        self.assertIn("leave of absence", payload["answer"])
        self.assertTrue(payload["sources"])

    def test_when_gemini_says_the_excerpts_do_not_answer_the_reply_is_the_plain_refusal(self):
        generate = MagicMock(return_value=policy_rag.NOT_FOUND_ANSWER)
        with self.with_key(), self.keyword_only(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask("dean@usls.edu.ph", "How many units is the thesis defense fee waiver worth?")
        self.assertNotCovered(payload)


class PersonalAnswerTests(AssistantBase):
    QUESTION = "What is my next step?"

    def test_a_student_gets_an_answer_built_from_their_own_record(self):
        generate = MagicMock(return_value="Your next step is to confirm your second-semester subjects.")
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask(STUDENT_A_EMAIL, self.QUESTION)
        generate.assert_called_once()
        prompt = generate.call_args.args[0]
        self.assertEqual(payload["answer"], "Your next step is to confirm your second-semester subjects.")
        self.assertTrue(payload["personal"])
        self.assertTrue(payload["source"]["ai_used"])
        self.assertFalse(payload["offline"])
        self.assertEqual(payload["student"]["id"], self.student_a_id)
        self.assertIn(self.stage_a, prompt)
        self.assertIn(TASK_A, prompt)
        self.assertIn(f"Question: {self.QUESTION}", prompt)
        # never anybody else's record
        self.assertNotIn(TASK_B, prompt)
        self.assertNotIn(self.stage_b, prompt)
        self.assertNoStudentNames(prompt)

    def test_another_student_gets_their_own_record_and_not_the_first_students(self):
        generate = MagicMock(return_value="Submit your Form 4.")
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask(STUDENT_B_EMAIL, "What am I missing?", url="/api/student-portal/assistant")
        prompt = generate.call_args.args[0]
        self.assertEqual(payload["student"]["id"], self.student_b_id)
        self.assertIn(self.stage_b, prompt)
        self.assertIn(TASK_B, prompt)
        self.assertNotIn(TASK_A, prompt)
        self.assertNoStudentNames(prompt)

    def test_a_posted_student_id_cannot_pull_another_students_record(self):
        generate = MagicMock(return_value="ok")
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            response = self.client(STUDENT_A_EMAIL).post(
                "/api/assistant", json={"question": self.QUESTION, "student_id": self.student_b_id}
            )
        self.assertEqual(response.status_code, 200)
        prompt = generate.call_args.args[0]
        self.assertIn(TASK_A, prompt)
        self.assertNotIn(TASK_B, prompt)

    def test_without_a_key_the_offline_answer_still_comes_from_the_students_record(self):
        payload = self.ask(STUDENT_A_EMAIL, self.QUESTION)
        self.assertTrue(payload["personal"])
        self.assertTrue(payload["offline"])
        self.assertTrue(payload["source"]["offline"])
        self.assertFalse(payload["source"]["ai_used"])
        self.assertIn(self.stage_a, payload["answer"])
        self.assertIn(TASK_A, payload["answer"])
        self.assertNotIn(TASK_B, payload["answer"])
        self.assertNoStudentNames(payload["answer"].replace(self.student_a.name, ""))

    def test_a_gemini_error_falls_back_to_the_record_answer_labelled_offline(self):
        generate = MagicMock(side_effect=RuntimeError("Gemini returned HTTP 500."))
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask(STUDENT_A_EMAIL, self.QUESTION)
        generate.assert_called_once()
        self.assertTrue(payload["offline"])
        self.assertIn(TASK_A, payload["answer"])

    def test_staff_get_the_queue_waiting_on_them_not_a_students_record(self):
        generate = MagicMock(return_value="Verify the leave documents first.")
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask("staff@usls.edu.ph", "What is waiting on me?")
        prompt = generate.call_args.args[0]
        self.assertTrue(payload["personal"])
        self.assertEqual(payload["answer"], "Verify the leave documents first.")
        self.assertIn(TASK_STAFF, prompt)
        self.assertNotIn(TASK_COORDINATOR, prompt)  # that one is waiting on the Academic Coordinator
        self.assertNotIn(TASK_A, prompt)            # that one is waiting on the student

    def test_the_offline_queue_answer_lists_the_signed_in_roles_tasks(self):
        staff = self.ask("staff@usls.edu.ph", "What is my next step?")
        self.assertTrue(staff["offline"])
        self.assertIn(TASK_STAFF, staff["answer"])
        coordinator = self.ask("academic@usls.edu.ph", "What is waiting on me?")
        self.assertIn(TASK_COORDINATOR, coordinator["answer"])
        self.assertNotIn(TASK_STAFF, coordinator["answer"])

    def test_a_role_with_nothing_waiting_is_told_so_without_calling_gemini(self):
        generate = MagicMock(return_value="invented")
        with self.with_key(), patch.object(appmod, "_gemini_generate", generate):
            payload = self.ask("dean@usls.edu.ph", "What is waiting on me?")
        generate.assert_not_called()
        self.assertTrue(payload["personal"])
        self.assertRegex(payload["answer"], r"(?i)nothing is waiting|no .*waiting")
        self.assertEqual(payload["citations"], [])

    def test_a_personal_question_is_not_a_policy_search(self):
        payload = self.ask("dean@usls.edu.ph", "What should I do next?")
        self.assertEqual(payload["citations"], [])
        self.assertNotIn("Operations Manual", payload["answer"])


class OfflineFallbackTests(AssistantBase):
    def test_no_key_gives_the_keyword_answer_labelled_offline_with_sources(self):
        payload = self.ask("dean@usls.edu.ph", COVERED_QUESTION)
        self.assertEqual(payload["mode"], "document-rag-local")
        self.assertTrue(payload["offline"])
        self.assertTrue(payload["source"]["offline"])
        self.assertIn("ffline", payload["source"]["badge"])
        self.assertFalse(payload["source"]["ai_used"])
        self.assertFalse(payload["not_covered"])
        self.assertIn("seven (7)", payload["answer"])
        self.assertTrue(payload["sources"])
        self.assertRegex(payload["sources"][0]["source"], r"p\. \d+")

    def test_a_gemini_http_error_gives_the_same_labelled_fallback(self):
        # The real _gemini_generate runs, its HTTP call fails with a 500, and the keyword answer is used.
        with self.with_key(), self.keyword_only(), patch.object(appmod, "urlopen", side_effect=fail_http):
            payload = self.ask("dean@usls.edu.ph", COVERED_QUESTION)
        self.assertEqual(payload["mode"], "document-rag-local")
        self.assertTrue(payload["offline"])
        self.assertIn("seven (7)", payload["answer"])
        self.assertTrue(payload["sources"])

    def test_a_student_gets_the_same_labelled_fallback(self):
        with self.with_key(), self.keyword_only(), patch.object(appmod, "_gemini_generate", side_effect=RuntimeError("down")):
            payload = self.ask(STUDENT_A_EMAIL, COVERED_QUESTION, url="/api/student-portal/assistant")
        self.assertTrue(payload["offline"])
        self.assertIn("seven (7)", payload["answer"])
        self.assertTrue(payload["sources"])

    def test_the_old_unused_provider_stub_is_gone(self):
        self.assertFalse(hasattr(appmod, "call_google_ai_studio"))


class SuggestionTests(AssistantBase):
    def test_every_role_gets_three_or_four_questions_and_a_personal_one(self):
        emails = ["staff@usls.edu.ph", "dean@usls.edu.ph", "liwayway.bautista@usls.edu.ph", STUDENT_A_EMAIL]
        for email in emails:
            with self.subTest(user=email.split("@")[0]):
                items = self.client(email).get("/api/assistant/suggestions").get_json()["items"]
                self.assertIn(len(items), (3, 4), items)
                self.assertTrue(any(appmod.assistant_asks_personal(item) for item in items), items)
        items = self.client(STUDENT_A_EMAIL).get("/api/student-portal/assistant/suggestions").get_json()["items"]
        self.assertIn(len(items), (3, 4), items)


if __name__ == "__main__":
    unittest.main()
