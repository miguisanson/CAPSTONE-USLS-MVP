"""The UAT entry point (scripts/serve_uat.py) must make the app see the public https address.

Behind the Cloudflare Tunnel the app only ever talks plain http to 127.0.0.1; the tunnel adds
X-Forwarded-Proto / X-Forwarded-Host. Without ProxyFix, request.url_root would be
http://127.0.0.1:5000/ and every absolute link the app builds (calendar feed, OAuth redirect)
would be wrong. Uses its own temporary SQLite database, created before ``app`` is imported.
"""
import importlib.util
import os
import re
import subprocess
import sys
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
                    "Host": "miguisanson.dev",  # the tunnel passes the public host name as the Host header
                    "X-Forwarded-For": "203.0.113.7",
                },
            )
        finally:
            app_module.app.wsgi_app = original
        self.assertEqual(url_root, "https://miguisanson.dev/")
        self.assertEqual(scheme, "https")
        self.assertEqual(host, "miguisanson.dev")
        self.assertEqual(remote, "203.0.113.7", "login throttling needs the visitor's address, not the tunnel's")

    def test_a_client_sent_forwarded_host_is_ignored(self):
        # I-216 / F-22: Cloudflare sends no X-Forwarded-Host, so a client-supplied one is an attack
        # on every absolute link the app builds (calendar feed, OAuth redirect).
        serve_uat = load_serve_uat()
        original = app_module.app.wsgi_app
        try:
            wrapped = serve_uat.apply_proxy_fix(app_module.app)
            url_root, _scheme, host, _remote = self.seen_url_root(
                wrapped,
                {"X-Forwarded-Proto": "https", "Host": "miguisanson.dev", "X-Forwarded-Host": "evil.example"},
            )
        finally:
            app_module.app.wsgi_app = original
        self.assertEqual(url_root, "https://miguisanson.dev/")
        self.assertEqual(host, "miguisanson.dev")

    def test_without_the_wrapper_the_app_sees_plain_http(self):
        # Proves the check above can fail: the headers alone change nothing.
        url_root, scheme, _host, _remote = self.seen_url_root(
            app_module.app,
            {"X-Forwarded-Proto": "https", "Host": "miguisanson.dev"},
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


REPO_ROOT = Path(__file__).resolve().parents[1]
ENV_EXAMPLE = REPO_ROOT / ".env.example"


def env_example_names():
    """(active, commented) variable names in .env.example."""
    text = ENV_EXAMPLE.read_text(encoding="utf-8")
    active = set(re.findall(r"^([A-Z][A-Z0-9_]*)=", text, re.M))
    commented = set(re.findall(r"^# ([A-Z][A-Z0-9_]*)=", text, re.M))
    return active, commented


class EnvExampleTests(unittest.TestCase):
    def test_lists_every_variable_the_code_reads(self):
        source = (REPO_ROOT / "app.py").read_text(encoding="utf-8")
        read = set(re.findall(r"(?:getenv|environ\.get|environ)\(?\[?[\"']([A-Z][A-Z0-9_]+)[\"']", source))
        read.update({"UAT_THREADS", "UAT_MAX_BODY_MB"})  # read by scripts/serve_uat.py
        active, commented = env_example_names()
        self.assertEqual(sorted(read - active - commented), [], "variables the code reads but .env.example does not list")

    def test_copying_it_verbatim_does_not_break_the_app(self):
        # A numeric setting left empty would crash int(""), so only 'empty means unset' names may be active.
        active, _ = env_example_names()
        db = tempfile.NamedTemporaryFile(suffix=".sqlite3", delete=False)
        db.close()
        env = dict(os.environ)
        env.update({name: "" for name in active})
        env["DATABASE_URL"] = f"sqlite:///{db.name}"
        env["USLS_SKIP_STARTUP_TASKS"] = "1"
        env["SECRET_KEY"] = "test-key"
        code = "import app; assert app.LOGIN_THROTTLE.max_failures == 5; assert app.demo_mode_enabled()"
        result = subprocess.run([sys.executable, "-c", code], cwd=REPO_ROOT, env=env, capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr[-2000:])

    def test_gitignore_keeps_env_out_but_example_in(self):
        ignore = (REPO_ROOT / ".gitignore").read_text(encoding="utf-8").splitlines()
        self.assertIn(".env", ignore)
        self.assertIn("!.env.example", ignore)


if __name__ == "__main__":
    unittest.main()
