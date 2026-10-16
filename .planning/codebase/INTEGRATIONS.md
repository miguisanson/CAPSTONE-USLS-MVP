# External Integrations

**Analysis Date:** 2026-10-17

All integrations are optional; the app starts and the gate runs with none configured. There is deliberately **no live AIMS integration** (AGENTS.md Rule 4, Traps): AIMS data enters only by file import.

## APIs & External Services

**Google AI Studio (Gemini) - policy assistant / RAG:**
- Generation: `_gemini_generate()` (`app.py:10055`) POSTs to `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` using stdlib `urllib` (no SDK). Model from `GEMINI_MODEL` (default `gemini-2.5-flash`), `RAG_MAX_OUTPUT_TOKENS` (500).
- Embeddings: `:batchEmbedContents` (`app.py:10127`), `GEMINI_EMBEDDING_MODEL`, `RAG_EMBEDDING_DIMENSIONS` (768), `RAG_EMBEDDING_BATCH_SIZE` (20), `RAG_EMBEDDING_TIMEOUT_SECONDS`.
- Auth: `GOOGLE_API_KEY` or `GOOGLE_AI_STUDIO_API_KEY` (env only).
- Without a key: key-free keyword retrieval and composed answers from `policy_rag.py` (`import policy_rag as _prag`, `app.py:8997`). `generate_answer()` is at `app.py:11717`; routes `/api/assistant*` at `app.py:17999-18033`.
- Startup pre-warm thread only when run as `python app.py` (`app.py:37503-37511`): `prewarm_document_rag` (`app.py:10506`) if a key exists, else `prewarm_keyword_index` (`app.py:10497`); disable with `RAG_PREWARM=0`.
- Tuning env vars: `RAG_TOP_K`, `RAG_CHUNK_SIZE`, `RAG_CHUNK_OVERLAP`, `RAG_INLINE_EMBED_LIMIT`, `RAG_INLINE_EMBED_TIMEOUT_SECONDS`, `RAG_BACKGROUND_EMBED`, `RAG_EMBED_COOLDOWN_SECONDS`, `RAG_REQUEST_TIMEOUT_SECONDS`, `RAG_RESPONSE_CACHE_SIZE`, `LOCAL_RAG_MAX_ANSWER_CHARS`, `ASSISTANT_MAX_QUESTION_LENGTH`.
- Documented in memory as "RAG = future Gemini"; the guided/local path is the one tests exercise (`tests/test_assistant_quality.py`, `tests/assistant_eval*.json`).

**Google Calendar (read-only free/busy):**
- OAuth2 per faculty member: authorization URL `https://accounts.google.com/o/oauth2/v2/auth` with scope `calendar.readonly` (`google_calendar_authorization_url`, `app.py:31187`), token exchange at `https://oauth2.googleapis.com/token` (`app.py:31207`), free/busy at `https://www.googleapis.com/calendar/v3/freeBusy` (`app.py:31290`), calendar list probe `app.py:14984`. OAuth state kept in the Flask session (`app.py:14949`).
- Config: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_REDIRECT_URI`, `GOOGLE_CALENDAR_ACCESS_TOKEN`, `GOOGLE_CALENDAR_IDS_JSON`, `GOOGLE_CALENDAR_TIMEZONE`, `DEMO_SAMPLE_CALENDAR`. `google_calendar_oauth_configured()` at `app.py:31173` gates the feature.
- Separately, the app publishes its own private `.ics` feed (`/api/calendar-feed*`, `app.py:19741-19758`; `CalendarToken` model `app.py:1631`), built in the calendar section `app.py:28197`.

**Email / SMS:** Not detected (no SMTP, SendGrid, etc.). Notifications are in-app only (`Notification` model `app.py:1611`, routes `/api/notifications` `app.py:19705`, `NotificationBell.jsx`).

**AIMS (Registrar system):** Not integrated. Contract is file export/import only: `Documents/AIMS_Export/`, `scripts/generate_aims_export_template.py`, monitoring sheet importer `app.py:24244-25472`, Registrar handoff list export/ack in the leave engine (`app.py:7680`).

## Document processing

- **PDF text:** PyMuPDF (`fitz`) in `policy_rag.py:142-157` (`structured_pdf_sections`, bold-aware sectioning) and `app.py:9171-9216`; pypdf as fallback reader.
- **OCR for scanned PDFs:** `pytesseract` + PyMuPDF rasteriser + Pillow (`app.py:9171-9216`, second copy for research evidence at `app.py:29887-29908`). Needs the external Tesseract binary; `TESSERACT_CMD` overrides the path; limits `PDF_OCR_MIN_WORDS`(30), `PDF_OCR_MAX_PAGES`(8), `PDF_OCR_DPI`(200). Missing packages/binary yield a user-readable error string (`app.py:9178`, `9196`).
- **Word (.docx):** read as zip+XML with stdlib (`zipfile`, `xml.etree`); policy uploads accept `.pdf` and `.docx` only (`POLICY_DOCUMENT_TYPES`, `app.py:105`).
- **Excel:** openpyxl for monitoring sheets, class lists, withdrawal export (`/api/withdrawal/approved.xlsx` `app.py:13519`), per-program monitoring export (`app.py:17507`).

## Data Storage

**Databases:** SQLite (default) or MySQL via `DATABASE_URL`; see `STACK.md`.

**File storage (local filesystem only; no S3/cloud):** root `_UPLOADS_BASE` = `$USLS_UPLOAD_DIR` or `<repo>/uploads` (temp dir under unittest/pytest, `app.py:57-76`):
- `uploads/research_evidence/` - `UPLOAD_ROOT` (`ResearchEvidenceFile`), gitignored.
- `uploads/student_requests/` - `REQUEST_UPLOAD_ROOT` (`StudentRequestAttachment`), gitignored.
- `uploads/monitoring_sheets/` - `MONITORING_UPLOAD_ROOT` (`MonitoringSheetUpload`); **17 files are tracked in git** (not ignored).
- `uploads/policy_documents/` - `POLICY_DOCUMENT_UPLOAD_ROOT` (override `POLICY_DOCUMENT_UPLOAD_DIR`); 2 tracked seed documents (GS Handbook PDF, Research Protocol docx); the runtime Operations Manual copy is ignored.
- `Documents/CAPSTONE_ONLY/USLS_Documents/` and `Documents/RAG_Source/Concept_Paper` - committed built-in RAG sources (`RAG_DOCUMENT_PATHS`, `CONCEPT_PAPER_RAG_SOURCE`, `app.py:85-89`; extra dirs via `RAG_DOCUMENT_DIRS`).
- `.rag_index/` - `RAG_INDEX_DIR` cache (`chunks.json`, `corpus.json`, `sections/`, vectors), gitignored, regenerable.

**Caching:** in-process only (`_RAG_RESPONSE_CACHE`, `_RAG_TERMS_CACHE`, `_RAG_VECTOR_STATE` globals, `app.py:92-100`; guarded by `threading.Lock`s). No Redis.

## Authentication & Identity

- Custom, session-cookie based (Flask `session`): `session["account_id"|"role"|"student_id"|"sid"]` set at login (`app.py:12034-12037`). `UserAccount` model `app.py:515`; hashes pbkdf2-sha256.
- Login throttling via `LOGIN_MAX_FAILURES`, `LOGIN_LOCKOUT_SECONDS`, `LOGIN_IP_MAX_FAILURES`, `LOGIN_FAILURE_WINDOW_SECONDS`.
- Cookie: HttpOnly, SameSite=Lax, `SESSION_COOKIE_SECURE` env (`app.py:379-381`). Forced first-login password change (`must_change_password`, enforced in `require_api_login`, `app.py:4948`).
- No SSO/OAuth for user login (Google OAuth above is calendar data only).

## Monitoring & Observability

- Error tracking: none. Logs: `app.logger.error` for 5xx API errors (`app.py:~446`) and `print()` for startup warnings. Business audit trail lives in the DB: `TransactionLog` (`app.py:1652`), `LeaveCaseEvent` (`app.py:857`), `MonitoringEdit` (`app.py:1053`), `WorkflowMessage` (`app.py:1279`); `/api/activity` (`app.py:14067`).
- Health: `GET /api/health` (`app.py:11916`) returns student count.

## CI/CD & Deployment

- CI: none (no `.github/`). Hosting: not defined in repo; `deploy/` and `PRIVATE_UBUNTU_HOSTING_NOTES.txt` are gitignored (private).

## Webhooks & Callbacks

- Incoming: Google OAuth redirect (`GOOGLE_CALENDAR_REDIRECT_URI`, handler in the faculty routes near `app.py:14949`). No other webhooks.
- Outgoing: none beyond the HTTPS calls above.

---

*Integration audit: 2026-10-17*
