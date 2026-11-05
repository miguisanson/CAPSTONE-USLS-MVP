"""The Gemini model the app calls by default must be one Google still serves to new keys.

On 2026-10-17 a new key got HTTP 404 "gemini-2.5-flash is no longer available to new users".
`gemini-flash-latest` is Google's alias for the current Flash model, so the default follows it.
"""

import json
import os
import tempfile
import unittest
from unittest.mock import patch

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"
os.environ.setdefault("POLICY_DOCUMENT_UPLOAD_DIR", tempfile.mkdtemp(prefix="policy-uploads-"))
os.environ.setdefault("RAG_INDEX_DIR", tempfile.mkdtemp(prefix="rag-index-"))

import app  # noqa: E402


class _FakeResponse:
    def __init__(self, payload):
        self._body = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class GeminiDefaultModelTests(unittest.TestCase):
    def test_default_generation_model_is_the_current_flash_alias(self):
        seen = {}

        def fake_urlopen(request, timeout=None):
            seen["url"] = request.full_url
            return _FakeResponse({"candidates": [{"content": {"parts": [{"text": "ready"}]}}]})

        env = {key: value for key, value in os.environ.items() if key != "GEMINI_MODEL"}
        env["GOOGLE_API_KEY"] = "test-key"
        with patch.dict(os.environ, env, clear=True), patch.object(app, "urlopen", fake_urlopen):
            self.assertEqual("ready", app._gemini_generate("say ready"))
        self.assertIn("/models/gemini-flash-latest:generateContent", seen["url"])

    def test_a_configured_model_still_wins(self):
        seen = {}

        def fake_urlopen(request, timeout=None):
            seen["url"] = request.full_url
            return _FakeResponse({"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})

        with patch.dict(os.environ, {"GOOGLE_API_KEY": "test-key", "GEMINI_MODEL": "gemini-3.5-flash"}), patch.object(app, "urlopen", fake_urlopen):
            app._gemini_generate("hi")
        self.assertIn("/models/gemini-3.5-flash:generateContent", seen["url"])


if __name__ == "__main__":
    unittest.main()
