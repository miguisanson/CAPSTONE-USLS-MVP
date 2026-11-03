#!/usr/bin/env python
"""Production-style server for User Acceptance Testing (`npm run uat`).

The app is reached at https://miguisanson.dev through a Cloudflare Tunnel (cloudflared), which
talks plain http to this process on 127.0.0.1. This entry point does what `python app.py` does not:

  * wraps the app in ProxyFix so request.url_root / request.scheme / request.remote_addr come
    from the tunnel's X-Forwarded-* headers (https links, the visitor's address for the
    sign-in lockout) - app.py itself is not changed;
  * serves with waitress (a real multi-threaded server) instead of the Flask development server;
  * starts the same document-index warm-up that `python app.py` starts.

Settings (environment or .env): FLASK_HOST (127.0.0.1), FLASK_PORT (5000), UAT_THREADS (8),
UAT_MAX_BODY_MB (64). Keep FLASK_HOST on 127.0.0.1: only the tunnel should reach the app.
"""
from __future__ import annotations

import os
import sys
import threading
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 5000
DEFAULT_THREADS = 8
DEFAULT_MAX_BODY_MB = 64


def _int_setting(environ, name: str, default: int, minimum: int) -> int:
    raw = str(environ.get(name, "")).strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise SystemExit(f"{name} must be a whole number (got {raw!r}).")
    if value < minimum:
        raise SystemExit(f"{name} must be at least {minimum} (got {value}).")
    return value


def read_settings(environ=None) -> dict:
    """Host, port, thread count and body limit from the environment, with safe defaults."""
    environ = os.environ if environ is None else environ
    return {
        "host": (str(environ.get("FLASK_HOST", "")).strip() or DEFAULT_HOST),
        "port": _int_setting(environ, "FLASK_PORT", DEFAULT_PORT, 1),
        "threads": _int_setting(environ, "UAT_THREADS", DEFAULT_THREADS, 1),
        "max_body_bytes": _int_setting(environ, "UAT_MAX_BODY_MB", DEFAULT_MAX_BODY_MB, 1) * 1024 * 1024,
    }


def apply_proxy_fix(flask_app):
    """Trust exactly one proxy hop (the tunnel) for X-Forwarded-For / -Proto; the host comes from the Host header."""
    from werkzeug.middleware.proxy_fix import ProxyFix

    flask_app.wsgi_app = ProxyFix(flask_app.wsgi_app, x_for=1, x_proto=1, x_host=0)  # Cloudflare sends no X-Forwarded-Host; trusting one lets a client set the host
    return flask_app


def start_index_warmup(module) -> None:
    """Same warm-up as the bottom of app.py: Gemini index if a key is set, keyword index otherwise."""
    if os.getenv("RAG_PREWARM", "1").strip().lower() in {"0", "false", "no"}:
        return
    if os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_AI_STUDIO_API_KEY"):
        target, name = module.prewarm_document_rag, "rag-prewarm"
    else:
        target, name = module.prewarm_keyword_index, "rag-keyword-prewarm"
    threading.Thread(target=target, name=name, daemon=True).start()


def main() -> None:
    import app as app_module  # importing builds the demo database only if the file is empty

    settings = read_settings()
    apply_proxy_fix(app_module.app)
    start_index_warmup(app_module)

    from waitress import serve

    print(
        f"USLS Graduate School platform (UAT) listening on http://{settings['host']}:{settings['port']} "
        f"with {settings['threads']} threads - reach it through the tunnel at https://miguisanson.dev"
    )
    serve(
        app_module.app,
        host=settings["host"],
        port=settings["port"],
        threads=settings["threads"],
        max_request_body_size=settings["max_body_bytes"],
        ident="usls",
    )


if __name__ == "__main__":
    main()
