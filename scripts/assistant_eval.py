"""Ask the Policy Assistant ten unscripted questions and print what it answered and why.

Run it from the repository root with a real Gemini key in the environment (or in the project's own .env, which the
app reads itself; this script never opens .env and never prints the key):

    .venv/Scripts/python.exe scripts/assistant_eval.py

It builds a throw-away seeded SQLite database in a temp folder (about a minute), then asks through the Flask test
client:  7 policy questions across the handbook topics (residency, leave of absence, comprehensive exam, defense,
thesis format, readmission, AWOL) as the Dean, 2 questions the policy documents do not cover, and 1 personal
question as a seeded student. For each it prints the question, whether Gemini wrote the answer, the first 400
characters of the answer and the sources (document, page, section), plus how strong the retrieval was so the
similarity threshold (RAG_MIN_SIMILARITY, default 0.60) can be tuned from real numbers.

With no key the same questions run on the offline keyword answer and the output says so.
Nothing here touches the real database, the real uploads or the real RAG index.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

WORK = Path(tempfile.mkdtemp(prefix="assistant-eval-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(WORK / 'eval.sqlite3').as_posix()}"
os.environ["USLS_UPLOAD_DIR"] = str(WORK / "uploads")
os.environ["POLICY_DOCUMENT_UPLOAD_DIR"] = str(WORK / "policy_documents")
os.environ["RAG_INDEX_DIR"] = str(WORK / "rag_index")
os.environ["RAG_PREWARM"] = "0"
os.environ["RAG_BACKGROUND_EMBED"] = "0"
os.environ.setdefault("PYTHONIOENCODING", "utf-8")

sys.path.insert(0, str(ROOT))

import app as appmod  # noqa: E402

QUESTIONS = [
    # (kind, role email, question)
    ("policy", "dean@usls.edu.ph", "How many years do I have at most to finish a master's degree, counting any time away?"),
    ("policy", "dean@usls.edu.ph", "My job is getting heavy this semester. Can a student take a leave of absence and for how long?"),
    ("policy", "dean@usls.edu.ph", "What does a student need before sitting for the comprehensive exam, and what if they fail it?"),
    ("policy", "dean@usls.edu.ph", "Who sits on a defense panel and how many members does it need?"),
    ("policy", "dean@usls.edu.ph", "How should a thesis be formatted, and what similarity index is allowed?"),
    ("policy", "dean@usls.edu.ph", "A student stopped enrolling two semesters ago. How do they get readmitted?"),
    ("policy", "dean@usls.edu.ph", "What happens if a student just stops enrolling and tells nobody?"),
    ("not covered", "dean@usls.edu.ph", "What time does the campus gym open on weekends?"),
    ("not covered", "dean@usls.edu.ph", "Can you recommend a good restaurant near the campus for a farewell dinner?"),
    ("personal", "student@usls.edu.ph", "What is my next step?"),
]


def sign_in(email: str):
    client = appmod.app.test_client()
    account = appmod.UserAccount.query.filter_by(email=email).first()
    if account is None:
        raise SystemExit(f"No seeded account {email}.")
    with client.session_transaction() as session:
        session["account_id"] = account.id
        session["role"] = account.role
    return client


def main() -> int:
    key_set = bool(os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_AI_STUDIO_API_KEY"))
    print(f"Gemini key: {'set' if key_set else 'NOT set - every answer below is the offline keyword answer'}")
    print(f"Model: {os.getenv('GEMINI_MODEL', 'gemini-flash-latest')}   work folder: {WORK}")
    appmod.app.config.update(TESTING=True)
    with appmod.app.app_context():
        appmod.db.create_all()
        if appmod.Student.query.count() == 0:  # importing app already seeds an empty database
            print("Building the seeded demo database (about a minute) ...", flush=True)
            appmod.build_demo_database()
            appmod.db.session.commit()
        appmod._reset_rag_indexes()
        chunks = appmod._load_rag_document_index()
        print(f"Policy library: {len(chunks)} passages.", flush=True)
        if key_set:
            try:
                vectors = appmod._ensure_rag_vectors(chunks)
                print(f"Embeddings ready for {len(vectors)} passages.", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"Embeddings unavailable ({exc}); retrieval falls back to keyword search.", flush=True)

        used = 0
        for number, (kind, email, question) in enumerate(QUESTIONS, start=1):
            client = sign_in(email)
            response = client.post("/api/assistant", json={"question": question})
            payload = response.get_json() or {}
            source = payload.get("source") or {}
            gemini = bool(source.get("ai_used"))
            used += gemini
            print("\n" + "=" * 100)
            print(f"{number}. [{kind}] as {email.split('@')[0]}: {question}")
            print(
                f"   HTTP {response.status_code}  mode={payload.get('mode')}  gemini_used={gemini}  "
                f"offline={payload.get('offline')}  not_covered={payload.get('not_covered')}  "
                f"personal={payload.get('personal')}"
            )
            retrieval = payload.get("retrieval")
            if retrieval:
                print(
                    f"   retrieval: strong={retrieval.get('strong')}  keyword_relevant={retrieval.get('keyword_relevant')}  "
                    f"best_coverage={retrieval.get('best_coverage')}  best_similarity={retrieval.get('best_similarity')}  "
                    f"min_similarity={retrieval.get('min_similarity')}"
                )
            answer = (payload.get("answer") or "").strip()
            print("   answer: " + answer[:400].replace("\n", "\n           ") + (" ..." if len(answer) > 400 else ""))
            sources = payload.get("sources") or []
            if sources:
                print("   sources:")
                for item in sources:
                    where = ", ".join(
                        part for part in (f"p. {item.get('page')}" if item.get("page") is not None else "", item.get("section") or "") if part
                    )
                    print(f"     - {item.get('title')}" + (f" ({where})" if where else ""))
            else:
                print("   sources: none")
        print("\n" + "=" * 100)
        print(f"Gemini wrote {used} of {len(QUESTIONS)} answers.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
