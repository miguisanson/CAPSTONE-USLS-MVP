"""Answer-writing can run on Claude instead of Gemini (owner, 2026-11-19).

The free Gemini tier allows 20 answers a day per model, which is not enough for a 30-minute defense demonstration.
With ANTHROPIC_API_KEY set, the assistant's answers and the panel-matching analysis are written by Claude.
Gemini stays the designed service: AI_PROVIDER=gemini switches back, and the embeddings (similarity numbers) are
always Gemini's. The screens name no company: every label says "AI".
"""

import json
import os
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))
os.environ["GOOGLE_API_KEY"] = ""
os.environ["GOOGLE_AI_STUDIO_API_KEY"] = ""
os.environ["ANTHROPIC_API_KEY"] = ""  # each test sets the keys it needs; .env must not leak in

import app  # noqa: E402

AI_KEYS = ("AI_PROVIDER", "ANTHROPIC_API_KEY", "GOOGLE_API_KEY", "GOOGLE_AI_STUDIO_API_KEY", "CLAUDE_MODEL", "CLAUDE_EFFORT")
COMPANY_NAMES = ("Gemini", "Claude", "Anthropic", "Google")


def env(**settings):
    """os.environ without any AI setting, plus the given ones"""
    base = {key: value for key, value in os.environ.items() if key not in AI_KEYS}
    base.update(settings)
    return patch.dict(os.environ, base, clear=True)


def claude_reply(text, stop_reason="end_turn"):
    return SimpleNamespace(stop_reason=stop_reason, content=[
        SimpleNamespace(type="thinking", thinking=""), SimpleNamespace(type="text", text=text)])


class ProviderChoiceTests(unittest.TestCase):
    def test_claude_writes_answers_when_its_key_is_set(self):
        with env(ANTHROPIC_API_KEY="test-claude-key"):
            self.assertEqual("claude", app.ai_provider())
            self.assertTrue(app.ai_text_configured())

    def test_gemini_is_used_without_a_claude_key(self):
        with env(GOOGLE_API_KEY="test-key"):
            self.assertEqual("gemini", app.ai_provider())
            self.assertTrue(app.ai_text_configured())

    def test_the_setting_switches_back_to_gemini(self):
        with env(ANTHROPIC_API_KEY="test-claude-key", GOOGLE_API_KEY="test-key", AI_PROVIDER="gemini"):
            self.assertEqual("gemini", app.ai_provider())

    def test_asking_for_claude_without_its_key_stays_on_gemini(self):
        with env(AI_PROVIDER="claude", GOOGLE_API_KEY="test-key"):
            self.assertEqual("gemini", app.ai_provider())

    def test_no_key_at_all_means_no_ai(self):
        with env():
            self.assertEqual("gemini", app.ai_provider())
            self.assertFalse(app.ai_text_configured())


class GenerateRoutingTests(unittest.TestCase):
    def test_a_question_goes_to_claude_and_not_to_gemini(self):
        claude, gemini = MagicMock(return_value="from Claude"), MagicMock(side_effect=AssertionError("Gemini was called"))
        with env(ANTHROPIC_API_KEY="test-claude-key", GOOGLE_API_KEY="test-key"), \
                patch.object(app, "_claude_generate", claude), patch.object(app, "_gemini_generate", gemini):
            self.assertEqual("from Claude", app._ai_generate("the prompt", system="the rules"))
        claude.assert_called_once_with("the prompt", "the rules")

    def test_a_question_goes_to_gemini_when_claude_has_no_key(self):
        claude, gemini = MagicMock(side_effect=AssertionError("Claude was called")), MagicMock(return_value="from Gemini")
        with env(GOOGLE_API_KEY="test-key"), \
                patch.object(app, "_claude_generate", claude), patch.object(app, "_gemini_generate", gemini):
            self.assertEqual("from Gemini", app._ai_generate("the prompt", system="the rules"))
            self.assertEqual("from Gemini", app._ai_generate("another prompt"))
        self.assertEqual(gemini.call_args_list[0].kwargs, {"system": "the rules"})
        self.assertEqual(gemini.call_args_list[1].args, ("another prompt",))


class ClaudeRequestTests(unittest.TestCase):
    def ask(self, reply=None, error=None, **settings):
        client = MagicMock()
        if error is not None:
            client.messages.create.side_effect = error
        else:
            client.messages.create.return_value = reply
        with env(ANTHROPIC_API_KEY="test-claude-key", **settings), patch.object(app, "_claude_client", return_value=client):
            answer = app._claude_generate("When may a subject be added?", "Answer from the excerpts only.")
        return answer, client.messages.create.call_args.kwargs

    def test_the_request_carries_the_prompt_the_rules_and_the_default_model(self):
        answer, sent = self.ask(claude_reply("  Until the end of the adding period.  "))
        self.assertEqual("Until the end of the adding period.", answer)
        self.assertEqual("claude-opus-5-5", sent["model"])
        self.assertEqual("Answer from the excerpts only.", sent["system"])
        self.assertEqual([{"role": "user", "content": "When may a subject be added?"}], sent["messages"])
        self.assertEqual({"effort": "low"}, sent["output_config"])
        self.assertGreaterEqual(sent["max_tokens"], 4096)

    def test_the_model_and_effort_come_from_the_settings(self):
        _answer, sent = self.ask(claude_reply("Yes."), CLAUDE_MODEL="claude-haiku-5-5", CLAUDE_EFFORT="medium")
        self.assertEqual("claude-haiku-5-5", sent["model"])
        self.assertEqual({"effort": "medium"}, sent["output_config"])

    def test_no_system_text_sends_no_system_field(self):
        client = MagicMock()
        client.messages.create.return_value = claude_reply("policy")
        with env(ANTHROPIC_API_KEY="test-claude-key"), patch.object(app, "_claude_client", return_value=client):
            self.assertEqual("policy", app._claude_generate("Classify this question."))
        self.assertNotIn("system", client.messages.create.call_args.kwargs)

    def test_a_refusal_is_an_error_so_the_caller_falls_back(self):
        with self.assertRaises(RuntimeError):
            self.ask(claude_reply("", stop_reason="refusal"))

    def test_an_empty_answer_is_an_error(self):
        with self.assertRaises(RuntimeError):
            self.ask(claude_reply("   "))

    def test_an_answer_cut_off_by_the_token_limit_keeps_only_whole_sentences(self):
        answer, _sent = self.ask(claude_reply("The period ends on the last day. After that the Dean must", stop_reason="max_tokens"))
        self.assertEqual("The period ends on the last day.", answer)

    def test_a_failed_call_is_an_error_the_callers_already_handle(self):
        import anthropic
        with self.assertRaises(RuntimeError):
            self.ask(error=anthropic.AnthropicError("connection lost"))


class AnswersUseClaudeTests(unittest.TestCase):
    def test_a_record_answer_is_written_by_claude_with_only_a_claude_key(self):
        with env(ANTHROPIC_API_KEY="test-claude-key"), \
                patch.object(app, "_claude_generate", MagicMock(return_value="Your next step is the proposal defense.")):
            answer, mode = app.personal_answer("What is my next step?", "the student", "Stage: Proposal", "offline answer", True)
        self.assertEqual(("Your next step is the proposal defense.", "record-ai"), (answer, mode))

    def test_the_panel_analysis_is_written_by_claude_with_only_a_claude_key(self):
        reply = json.dumps({"summary": "A study of reading comprehension.", "keywords": ["reading comprehension", "literacy"],
                            "faculty_matches": []})
        claude = MagicMock(return_value=reply)
        paper = "This study examines reading comprehension and literacy instruction among graduate students. " * 20
        with env(ANTHROPIC_API_KEY="test-claude-key"), patch.object(app, "_claude_generate", claude):
            result = app.generate_panel_matching_keywords_with_rag(paper, [])
        claude.assert_called_once()
        self.assertEqual("document-rag", result["mode"])
        self.assertIn("reading comprehension", result["keywords"])

    def test_the_embeddings_stay_with_gemini(self):
        with env(ANTHROPIC_API_KEY="test-claude-key"):
            self.assertFalse(app.panel_gemini_configured())   # similarity numbers need the Google key
        with env(ANTHROPIC_API_KEY="test-claude-key", GOOGLE_API_KEY="test-key"):
            self.assertTrue(app.panel_gemini_configured())


class NoCompanyNameOnScreenTests(unittest.TestCase):
    MODES = ("database-rules", "policy-retrieval", "document-rag", "document-rag-cache", "document-rag-local",
             "general-knowledge", "policy-not-found", "record-ai", "record-offline", "role-guarded", "offline-fallback",
             "validation", "student-document-rag-local")

    def test_assistant_source_labels_say_ai(self):
        for with_key in (False, True):
            keys = {"ANTHROPIC_API_KEY": "test-claude-key"} if with_key else {}
            with env(**keys):
                for mode in self.MODES:
                    for role in ("staff", "admin", "student"):
                        for interpreted in (False, True):
                            source = app._assistant_source(mode, intent_ai_used=interpreted, role=role)
                            shown = " ".join(str(source.get(part) or "") for part in ("label", "detail", "note", "badge"))
                            for name in COMPANY_NAMES:
                                self.assertNotIn(name, shown, f"{mode}/{role}: {shown}")

    def test_the_labels_that_named_gemini_now_say_ai(self):
        with env(ANTHROPIC_API_KEY="test-claude-key"):
            self.assertIn("Written by AI", app._assistant_source("document-rag", role="staff")["detail"])
            self.assertEqual("Your record · written by AI", app._assistant_source("record-ai", role="staff")["label"])
            self.assertEqual("Live record · AI interpreted",
                             app._assistant_source("database-rules", intent_ai_used=True, role="staff")["label"])
            self.assertTrue(app._assistant_source("document-rag", role="staff")["ai_configured"])
        with env():
            self.assertIn("Add an AI key", app._assistant_source("document-rag-local", role="admin")["note"])

    def test_panel_matching_labels_say_ai(self):
        for label in app.PANEL_MATCH_METHOD_LABELS.values():
            for name in COMPANY_NAMES:
                self.assertNotIn(name, label)
        self.assertEqual("Semantic match (AI embeddings)", app.PANEL_MATCH_METHOD_LABELS["gemini-embeddings"])


if __name__ == "__main__":
    unittest.main()
