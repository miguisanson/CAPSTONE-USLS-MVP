"""The UAT entry point (scripts/serve_uat.py) must make the app see the public https address.

Behind the Cloudflare Tunnel the app only ever talks plain http to 127.0.0.1; the tunnel adds
X-Forwarded-Proto / X-Forwarded-Host. Without ProxyFix, request.url_root would be
http://127.0.0.1:5000/ and every absolute link the app builds (calendar feed, OAuth redirect)
would be wrong. Uses its own temporary SQLite database, created before ``app`` is imported.
"""
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path

_DB_FILE = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
_DB_FILE.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_DB_FILE.name}"

from flask import request, request_started  # noqa: E402
from werkzeug.test import Client  # noqa: E402

import app as app_module  # noqa: E402

SERVE_UAT = Path(__file__).resolve().parents[1] / "scripts" / "serve_uat.py"


def load_serve_uat():
    spec = importlib.util.spec_from_file_location("serve_uat", SERVE_UAT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class ServeUatTests(unittest.TestCase):
    def seen_url_root(self, wsgi_app, headers):
        """Send one request through ``wsgi_app`` and return request.url_root as the app saw it."""
        seen = []

        def record(sender, **extra):
            seen.append((request.url_root, request.scheme, request.host, request.remote_addr))

        request_started.connect(record, app_module.app)
        try:
            Client(wsgi_app).get("/api/health", headers=headers)
        finally:
            request_started.disconnect(record, app_module.app)
        self.assertEqual(len(seen), 1)
        return seen[0]

    def test_tunnel_headers_give_the_public_https_address(self):
        serve_uat = load_serve_uat()
        original = app_module.app.wsgi_app
        try:
            wrapped = serve_uat.apply_proxy_fix(app_module.app)
            url_root, scheme, host, remote = self.seen_url_root(
                wrapped,
                {
                    "X-Forwarded-Proto": "https",
                    "X-Forwarded-Host": "miguisanson.dev",
                    "X-Forwarded-For": "203.0.113.7",
                },
            )
        finally:
            app_module.app.wsgi_app = original
        self.assertEqual(url_root, "https://miguisanson.dev/")
        self.assertEqual(scheme, "https")
        self.assertEqual(host, "miguisanson.dev")
        self.assertEqual(remote, "203.0.113.7", "login throttling needs the visitor's address, not the tunnel's")

    def test_without_the_wrapper_the_app_sees_plain_http(self):
        # Proves the check above can fail: the headers alone change nothing.
        url_root, scheme, _host, _remote = self.seen_url_root(
            app_module.app,
            {"X-Forwarded-Proto": "https", "X-Forwarded-Host": "miguisanson.dev"},
        )
        self.assertNotEqual(url_root, "https://miguisanson.dev/")
        self.assertEqual(scheme, "http")

    def test_port_and_threads_come_from_the_environment(self):
        serve_uat = load_serve_uat()
        settings = serve_uat.read_settings({"FLASK_PORT": "5055", "UAT_THREADS": "12"})
        self.assertEqual(settings["host"], "127.0.0.1")
        self.assertEqual(settings["port"], 5055)
        self.assertEqual(settings["threads"], 12)
        defaults = serve_uat.read_settings({})
        self.assertEqual((defaults["host"], defaults["port"]), ("127.0.0.1", 5000))
        self.assertGreaterEqual(defaults["threads"], 4)

    def test_a_bad_port_is_refused(self):
        serve_uat = load_serve_uat()
        with self.assertRaises(SystemExit):
            serve_uat.read_settings({"FLASK_PORT": "not-a-number"})


if __name__ == "__main__":
    unittest.main()
