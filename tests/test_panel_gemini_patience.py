"""Panel matching waits for Gemini instead of falling back to keyword analysis (owner 2026-11-09, panel demo).

The free Gemini tier answers HTTP 429 when several requests land in one minute. Panel matching used to give up after
one 3-second retry and show "Keyword analysis (local; Gemini did not respond)". Now it waits and retries for up to
PANEL_GEMINI_MAX_WAIT_SECONDS, and a paper analysed once is never sent to Gemini again.
"""
import json
import os
from urllib.error import HTTPError
import tempfile
import unittest
from unittest.mock import MagicMock, patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ["USLS_SKIP_STARTUP_TASKS"] = "1"
os.environ["RAG_PREWARM"] = "0"

import app as appmod  # noqa: E402

PAPER = "Blended learning and educational technology in teaching mathematics to high school learners. " * 20
FACULTY = [{"id": 7, "name": "Dr. A", "specialization": "educational technology", "matched_terms": ["blended learning"]}]
GOOD = '{"summary": "A study of blended learning.", "keywords": ["blended learning", "educational technology"], "faculty_matches": []}'


def rate_limited():
    return appmod.GeminiHTTPError("Gemini returned HTTP 429.", 429)


class PanelGeminiPatienceTests(unittest.TestCase):
    def setUp(self):
        appmod._PANEL_ANALYSIS_CACHE.clear()
        self.addCleanup(appmod._PANEL_ANALYSIS_CACHE.clear)
        self.sleep = MagicMock()
        for item in (patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key", "PANEL_GEMINI_MAX_WAIT_SECONDS": "60"}), patch.object(appmod, "_gemini_sleep", self.sleep)):
            item.start()
            self.addCleanup(item.stop)

    def test_a_rate_limit_is_waited_out_instead_of_falling_back_to_keywords(self):
        generate = MagicMock(side_effect=[rate_limited(), GOOD])
        with patch.object(appmod, "_gemini_generate", generate):
            result = appmod.generate_panel_matching_keywords_with_rag(PAPER, FACULTY)
        self.assertEqual(result["mode"], "document-rag")
        self.assertIn("blended learning", result["keywords"])
        self.assertEqual(generate.call_count, 2)
        self.assertGreaterEqual(self.sleep.call_args.args[0], 10)  # long enough for the per-minute quota to recover

    def test_a_paper_analysed_once_is_not_sent_to_gemini_again(self):
        generate = MagicMock(return_value=GOOD)
        with patch.object(appmod, "_gemini_generate", generate):
            first = appmod.generate_panel_matching_keywords_with_rag(PAPER, FACULTY)
            second = appmod.generate_panel_matching_keywords_with_rag(PAPER, FACULTY)
        generate.assert_called_once()
        self.assertEqual(first["keywords"], second["keywords"])
        self.assertEqual(second["mode"], "document-rag")

    def test_keywords_are_used_only_after_the_whole_wait_budget(self):
        generate = MagicMock(side_effect=rate_limited())
        with patch.dict(os.environ, {"PANEL_GEMINI_MAX_WAIT_SECONDS": "60"}), patch.object(appmod, "_gemini_generate", generate):
            result = appmod.generate_panel_matching_keywords_with_rag(PAPER, FACULTY)
        self.assertEqual(result["mode"], "local-rag-fallback")
        self.assertGreater(generate.call_count, 2)
        self.assertLessEqual(sum(call.args[0] for call in self.sleep.call_args_list), 60)

    def test_the_semantic_match_also_waits_for_gemini(self):
        attempt = MagicMock(side_effect=[rate_limited(), {7: 0.8}])
        self.assertEqual(appmod._with_gemini_patience(attempt), {7: 0.8})
        self.assertEqual(attempt.call_count, 2)


if __name__ == "__main__":
    unittest.main()


class GeminiFallbackModelTests(unittest.TestCase):
    """The free tier allows 20 answers a day per model (GenerateRequestsPerDayPerProjectPerModel-FreeTier). When the
    main model is used up (429) or overloaded (503), GEMINI_FALLBACK_MODELS names the next model to ask."""

    @staticmethod
    def response(text):
        body = json.dumps({"candidates": [{"content": {"parts": [{"text": text}]}, "finishReason": "STOP"}]}).encode()
        item = MagicMock()
        item.__enter__.return_value.read.return_value = body
        return item

    def test_a_used_up_model_hands_the_question_to_the_fallback_model(self):
        quota = HTTPError("https://generativelanguage.googleapis.com", 429, "Too Many Requests", {}, None)
        urlopen = MagicMock(side_effect=[quota, quota, self.response("Seven years.")])
        env = {"GOOGLE_API_KEY": "k", "GEMINI_MODEL": "gemini-2.5-flash", "GEMINI_FALLBACK_MODELS": "gemini-flash-lite-latest"}
        with patch.dict(os.environ, env), patch.object(appmod, "urlopen", urlopen), patch.object(appmod, "_gemini_sleep"):
            self.assertEqual(appmod._gemini_generate("Question: test"), "Seven years.")
        self.assertIn("gemini-2.5-flash:", urlopen.call_args_list[0].args[0].full_url)
        self.assertIn("gemini-flash-lite-latest:", urlopen.call_args_list[-1].args[0].full_url)

    def test_without_a_fallback_the_429_still_raises(self):
        quota = HTTPError("https://generativelanguage.googleapis.com", 429, "Too Many Requests", {}, None)
        urlopen = MagicMock(side_effect=[quota, quota])
        env = {"GOOGLE_API_KEY": "k", "GEMINI_MODEL": "gemini-2.5-flash", "GEMINI_FALLBACK_MODELS": ""}
        with patch.dict(os.environ, env), patch.object(appmod, "urlopen", urlopen), patch.object(appmod, "_gemini_sleep"):
            with self.assertRaises(appmod.GeminiHTTPError):
                appmod._gemini_generate("Question: test")
