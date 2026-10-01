"""Policy Assistant retrieval and answering that work without any AI key.

Pure functions only (no Flask, no database), so ``app.py`` stays small and the
behaviour can be measured on its own (``tests/test_assistant_quality.py``):

* reading a PDF with its real structure (printed page numbers, bold headings,
  clean text) instead of a flat dump of each page;
* cutting sections into readable chunks that keep their page and section title;
* BM25 search with a small synonym map, rank fusion with the older lexical
  score, and a reranking step on the best-matching sentences;
* building a short direct answer from the best sentences, or saying plainly
  that the documents do not answer the question.
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter

# --------------------------------------------------------------------------- text cleaning
_LIGATURES = {
    "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st",
}
_QUOTE_TABLE = {
    "‘": "'", "’": "'", "‚": "'", "‛": "'", "′": "'", "´": "'", "`": "'",
    "“": '"', "”": '"', "„": '"', "‟": '"', "″": '"',
    "–": "-", "—": "-", "−": "-", "‐": "-", "‑": "-",
    " ": " ", " ": " ", " ": " ", " ": " ", " ": " ", " ": " ",
    "​": "", "‌": "", "‍": "", "⁠": "", "﻿": "", "­": "",
    "…": "...",
}
_BULLETS = "•●◦▪■‣⁃·∙"


def clean_text(text: str) -> str:
    """Make extracted text safe to show: plain quotes, plain bullets, no ligatures, no stray symbols."""
    text = (text or "").replace("\x00", " ")
    text = text.encode("utf-8", "ignore").decode("utf-8", "ignore")
    for source, target in _LIGATURES.items():
        text = text.replace(source, target)
    # A broken apostrophe inside a word (U+FFFD) is an apostrophe; a broken bullet starts a line.
    text = re.sub(r"(?<=\w)�(?=\w)", "'", text)
    text = re.sub(r"(?m)^[ \t]*�[ \t]+", "- ", text)
    text = text.replace("�", "'")
    text = text.translate(str.maketrans(_QUOTE_TABLE))
    text = re.sub(rf"(?m)^[ \t]*[{re.escape(_BULLETS)}][ \t]*", "- ", text)
    text = re.sub(rf"[{re.escape(_BULLETS)}]", "-", text)
    # Drop private-use and control symbols but keep accented letters.
    text = "".join(
        ch for ch in text
        if ch in "\n\t" or unicodedata.category(ch) not in {"Co", "Cc", "Cs", "Cn"}
    )
    text = text.replace("†", "").replace("‡", "")
    return text


# --------------------------------------------------------------------------- PDF structure
_HEADER_NUMBER = re.compile(r"^\s*(\d{1,4})\s*$")
_NUMBERED_HEADING = re.compile(r"^\d+(?:\.\d+)*\.?\s")
_BULLET_LINE = re.compile(r"^\s*(?:[-*]|\d{1,2}[.)]|[a-z][.)])(?:\s+|$)", re.IGNORECASE)
_LONE_MARKER = re.compile(r"^(?:[-*]|\d{1,2}[.)]|[a-z][.)])$", re.IGNORECASE)
_PAGE_MARK = "⟦p{}⟧"
_PAGE_MARK_RE = re.compile("⟦p(\\d+)⟧")


def _span_is_bold(span: dict) -> bool:
    return bool(span.get("flags", 0) & 16) or "bold" in (span.get("font") or "").lower()


def _page_lines(page) -> list[dict]:
    """Lines of one page in reading order with position, size and boldness."""
    height = float(page.rect.height) or 1.0
    out = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            spans = [s for s in line.get("spans", []) if (s.get("text") or "").strip()]
            if not spans:
                continue
            text = "".join(s["text"] for s in line["spans"]).strip()
            x0, y0, x1, y1 = line["bbox"]
            out.append({
                "text": text,
                "bold": all(_span_is_bold(s) for s in spans),
                "size": max(s.get("size", 0) for s in spans),
                "x0": x0, "y0": y0, "y1": y1,
                "edge": y1 < 0.10 * height or y0 > 0.90 * height,
                "block": id(block),
            })
    return out


def _norm_edge(text: str) -> str:
    return re.sub(r"\d+", "#", text.strip().lower())


def _build_vocabulary(pages_lines: list[list[dict]]) -> Counter:
    vocab: Counter = Counter()
    for lines in pages_lines:
        for line in lines:
            for word in re.findall(r"[A-Za-z]+(?:-[A-Za-z]+)*", line["text"]):
                vocab[word.lower()] += 1
    return vocab


def _join_lines(lines: list[str], vocab: Counter) -> str:
    """Join wrapped lines of one paragraph, repairing words split with a hyphen at the line end."""
    result = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if not result:
            result = line
            continue
        match = re.search(r"([A-Za-z]+)-$", result)
        if match and line[:1].islower():
            head = match.group(1).lower()
            tail = re.match(r"[A-Za-z]+", line)
            tail_word = tail.group(0).lower() if tail else ""
            merged = head + tail_word
            hyphenated = f"{head}-{tail_word}"
            if vocab.get(hyphenated, 0) > 0 and vocab.get(merged, 0) == 0:
                result = result + line  # a real compound such as "cross-enrollment"
            else:
                result = result[:-1] + line  # "weight-" + "ed" -> "weighted"
        else:
            result = result + " " + line
    return re.sub(r"\s+", " ", result).strip()


_CONTENTS_ENTRY = re.compile(r"[A-Z][A-Z ,&/'-]{5,}\s+\d{1,3}(?=\s|$)")


def _looks_like_contents(section: dict) -> bool:
    text = " ".join(text for _page, text in section["paras"])
    return len(_CONTENTS_ENTRY.findall(text)) >= 4 or section["path"].lower().startswith("contents")


def structured_pdf_sections(file_bytes: bytes, expected_pages: int = 0) -> list[tuple[str, str]] | None:
    """Sections of a text PDF as (label, text).

    The label is ``p. <printed page>`` or ``p. <printed page>, section "<heading path>"``; text keeps
    paragraph breaks and ``p<N>`` markers where a section runs onto the next page. Returns None when
    the file cannot be read this way so the caller can use its plain page-by-page reader.
    """
    try:
        import pymupdf as fitz  # type: ignore
    except Exception:  # noqa: BLE001
        try:
            import fitz  # type: ignore
        except Exception:  # noqa: BLE001
            return None
    try:
        document = fitz.open(stream=file_bytes, filetype="pdf")
    except Exception:  # noqa: BLE001
        return None
    try:
        if expected_pages and document.page_count != expected_pages:
            return None
        pages_lines = [_page_lines(page) for page in document]
    except Exception:  # noqa: BLE001
        return None
    finally:
        document.close()
    count = len(pages_lines)
    if not count:
        return None

    # Running headers/footers: short edge lines that repeat on many pages.
    edge_counts: Counter = Counter()
    for lines in pages_lines:
        for line in lines:
            if line["edge"]:
                edge_counts[_norm_edge(line["text"])] += 1
    threshold = max(3, int(0.3 * count)) if count >= 5 else 10 ** 9
    repeated = {key for key, n in edge_counts.items() if n >= threshold and len(key) < 120}

    printed: list[int | None] = []
    cleaned_pages: list[list[dict]] = []
    for lines in pages_lines:
        page_number = None
        kept = []
        for line in lines:
            if line["edge"]:
                norm = _norm_edge(line["text"])
                number_only = _HEADER_NUMBER.match(line["text"])
                if norm in repeated or number_only:
                    if number_only:
                        page_number = int(number_only.group(1))
                    else:
                        found = re.findall(r"\d+", line["text"])
                        if found and len(found) == 1 and page_number is None:
                            page_number = int(found[0])
                    continue
            kept.append(line)
        printed.append(page_number)
        cleaned_pages.append(kept)

    # Printed numbers are trusted only when most pages carry one.
    known = [(index, number) for index, number in enumerate(printed) if number is not None]
    if len(known) >= max(2, count // 2):
        labels: list[int] = []
        for index in range(count):
            if printed[index] is not None:
                labels.append(printed[index])
                continue
            neighbour = min(known, key=lambda item: abs(item[0] - index))
            labels.append(neighbour[1] + (index - neighbour[0]))
    else:
        labels = [index + 1 for index in range(count)]

    vocab = _build_vocabulary(cleaned_pages)
    body_sizes = Counter(round(line["size"], 1) for lines in cleaned_pages for line in lines if not line["bold"])
    body_size = body_sizes.most_common(1)[0][0] if body_sizes else 10.0

    sections: list[dict] = []
    current = {"path": "", "page": labels[0], "paras": []}
    top_heading = ""
    pending_heading: list[str] = []
    paragraph: list[str] = []
    paragraph_page = labels[0]

    def flush_paragraph() -> None:
        nonlocal paragraph
        if paragraph:
            text = _join_lines(paragraph, vocab)
            if text:
                current["paras"].append((paragraph_page, clean_text(text)))
        paragraph = []

    def start_section(path: str, page: int) -> None:
        nonlocal current
        flush_paragraph()
        if current["paras"]:
            sections.append(current)
        current = {"path": path, "page": page, "paras": []}

    def is_top_heading(heading: str) -> bool:
        return bool(
            re.match(r"^\d+(?:\.\d+)+\.?\s", heading)
            or re.match(r"^\d+\s+[A-Z][A-Z]", heading)
            or (len(re.sub(r"[^A-Za-z]", "", heading)) >= 4 and heading.upper() == heading)
        )

    def close_heading() -> None:
        nonlocal top_heading, pending_heading
        if not pending_heading:
            return
        parts: list[str] = []
        for piece in pending_heading:
            piece = clean_text(piece).strip()
            if not piece:
                continue
            if parts and re.fullmatch(r"\d+(?:\.\d+)*\.?", parts[-1]):
                parts[-1] = f"{parts[-1]} {piece}"
            else:
                parts.append(piece)
        pending_heading = []
        if not parts:
            return
        subs: list[str] = []
        for part in parts:
            if is_top_heading(part):
                top_heading, subs = part, []
            else:
                subs.append(part)
        path = " > ".join([top_heading] + subs) if top_heading else " > ".join(subs)
        start_section(path[:160], paragraph_page)

    for index, lines in enumerate(cleaned_pages):
        page_label = labels[index]
        previous_block = None
        for line in lines:
            text = line["text"]
            bare_number = bool(re.fullmatch(r"\d+(?:\.\d+)*\.?", text))
            is_heading = line["bold"] and (
                bare_number
                or (
                    len(text.split()) <= 14
                    and not text.rstrip().endswith((".", ",", ";"))
                    and len(re.sub(r"[^A-Za-z]", "", text)) >= 2
                )
            )
            if is_heading:
                flush_paragraph()
                if pending_heading and _NUMBERED_HEADING.match(text + " ") and not re.fullmatch(
                    r"\d+(?:\.\d+)*\.?", pending_heading[-1]
                ):
                    close_heading()  # "1 PROFILE" followed by "1.1 MISSION" are two headings
                if not pending_heading:
                    paragraph_page = page_label
                pending_heading.append(text)
                previous_block = line["block"]
                continue
            close_heading()
            if not paragraph:
                paragraph_page = page_label
            starts_item = bool(_BULLET_LINE.match(text)) or text[:1] in _BULLETS
            if paragraph and (starts_item or line["block"] != previous_block and paragraph[-1].rstrip().endswith((".", ":", "?", "!"))):
                flush_paragraph()
                paragraph_page = page_label
            if (text in _BULLETS or _LONE_MARKER.match(text)) and not paragraph:
                paragraph = [text if text not in _BULLETS else "-"]
            elif len(paragraph) == 1 and (paragraph[0] == "-" or _LONE_MARKER.match(paragraph[0])):
                paragraph = [paragraph[0] + " " + text]
            else:
                paragraph.append(text)
            previous_block = line["block"]
        close_heading()
        flush_paragraph()
    close_heading()
    flush_paragraph()
    if current["paras"]:
        sections.append(current)
    if not sections:
        return None

    # A table of contents ("... PROGRAMS 11 2.1 ARTS ... 12") is page-number noise, not policy text.
    sections = [s for s in sections if not _looks_like_contents(s)]
    if not sections:
        return None

    # Tiny sections (a heading and one line) read better together with the next one.
    merged: list[dict] = []
    for section in sections:
        if (
            merged
            and sum(len(t.split()) for _p, t in merged[-1]["paras"]) < 25
            and merged[-1]["path"].split(" > ")[0] == section["path"].split(" > ")[0]
        ):
            previous = merged[-1]
            previous["paras"].append((section["paras"][0][0], section["path"].split(" > ")[-1]))
            previous["paras"].extend(section["paras"])
            continue
        merged.append(section)
    output: list[tuple[str, str]] = []
    for section in merged:
        body: list[str] = []
        last_page = None
        for page, text in section["paras"]:
            if last_page is not None and page != last_page:
                body.append(_PAGE_MARK.format(page))
            last_page = page
            body.append(text)
        heading = section["path"]
        label = f"p. {section['paras'][0][0]}"
        if heading:
            label += f", section “{heading}”"
            body.insert(0, heading.split(" > ")[-1])
        output.append((label, "\n".join(body)))
    return output


# --------------------------------------------------------------------------- chunking
CHUNK_VERSION = 1
_GENERIC_SECTIONS = {"total", "note", "notes", "thesis / project paper", "procedure", "step"}
_LABEL_PAGE = re.compile(r"^p\. (\d+)")
_LABEL_SECTION = re.compile("section “(.*)”\\s*$")


def _parse_label(label: str) -> tuple[int | None, str]:
    page = _LABEL_PAGE.match(label or "")
    section = _LABEL_SECTION.search(label or "")
    return (int(page.group(1)) if page else None), (section.group(1) if section else "")


def _label_text(page: int | None, section: str) -> str:
    parts = []
    if page is not None:
        parts.append(f"p. {page}")
    if section:
        parts.append(f"section “{section}”")
    return ", ".join(parts)


_ABBREV_END = re.compile(
    r"(?:\b\d{1,2}|\b[A-Za-z]|\bno|\bdr|\bmr|\bmrs|\bms|\bprof|\be\.g|\bi\.e|\bvs|\bsec|\bart|\bfig)\.$", re.IGNORECASE
)


def split_sentences(text: str) -> list[str]:
    """Sentences of a passage. Lines are structural (list items, headings) and always separate."""
    sentences: list[str] = []
    for line in re.split(r"\n+", text or ""):
        line = re.sub(r"\s+", " ", line).strip()
        if not line:
            continue
        pieces = re.split(r"(?<=[.!?])\s+(?=[\"(A-Z0-9])", line)
        merged: list[str] = []
        for piece in pieces:
            previous = merged[-1] if merged else ""
            if previous and _ABBREV_END.search(previous):
                merged[-1] = f"{previous} {piece}"
            else:
                merged.append(piece)
        for piece in merged:
            if len(piece.split()) > 70:  # run-on PDF text: fall back to clause boundaries
                sentences.extend(part.strip() for part in re.split(r"(?<=[;:])\s+", piece) if part.strip())
            else:
                sentences.append(piece)
    return sentences


def _pack_units(units: list[tuple[int | None, str]], max_words: int, min_words: int) -> list[tuple[int | None, str]]:
    """Group (page, paragraph) units into chunks of at most ~max_words, never cutting a sentence."""
    chunks: list[tuple[int | None, str]] = []
    current: list[str] = []
    current_page: int | None = None
    count = 0
    for page, text in units:
        words = len(text.split())
        if current and count + words > max_words and count >= min_words:
            chunks.append((current_page, "\n".join(current)))
            current, count = [], 0
        if not current:
            current_page = page
        current.append(text)
        count += words
    if current:
        chunks.append((current_page, "\n".join(current)))
    return chunks


def chunk_sections(title: str, sections: list[tuple[str, str]], max_words: int = 170, min_words: int = 45) -> list[dict]:
    """Readable chunks that stop at section boundaries and keep their printed page and section title."""
    chunks: list[dict] = []
    last_heading = ""
    part = 0
    for index, (label, text) in enumerate(sections):
        page, section = _parse_label(label)
        if section and section.strip().lower() in _GENERIC_SECTIONS and last_heading:
            section = f"{last_heading} (continued)"
        elif section:
            last_heading = section
        current_page = page
        units: list[tuple[int | None, str]] = []
        carry = False
        for line in re.split(r"\n", text or ""):
            line = line.strip()
            marker = _PAGE_MARK_RE.fullmatch(line)
            if marker:
                current_page = int(marker.group(1))
                carry = bool(units) and not units[-1][1].rstrip().endswith((".", ":", ";", "?", "!"))
                continue
            if not line:
                continue
            if carry and units:
                units[-1] = (units[-1][0], units[-1][1] + " " + line)
                carry = False
                continue
            carry = False
            if len(line.split()) > max_words:  # one huge paragraph: cut at sentence boundaries
                for sentence in split_sentences(line):
                    units.append((current_page, sentence))
            else:
                units.append((current_page, line))
        for chunk_page, body in _pack_units(units, max_words, min_words):
            if label:
                location = _label_text(chunk_page, section)
                source = f"{title}, {location}" if location else title
            else:
                part += 1
                source = f"{title}, part {part}"
            chunks.append({
                "id": "", "title": title, "source": source, "text": body,
                "page": chunk_page, "section": section, "sec": index,
            })
    return chunks


# --------------------------------------------------------------------------- terms
_STOP = set(
    "the a an of to and or for in on with is are be by at as your you i me my we our us he she his her it its this that "
    "these those what who whom whose which how when where why does do did done can could may might must shall should "
    "will would there their them they have has had been being also any some such than then into from about if not no "
    "student students case handbook manual please tell give explain describe list state answer need needs want wants "
    "many much very just more most other own same per each every up out over under again "
    "happen happens happened get gets got take takes took long last early soon".split()
)
_LEMMAS = {
    "failure": "fail", "failed": "fail", "failing": "fail", "fails": "fail", "failures": "fail",
    "advisor": "adviser", "advisors": "adviser", "advisers": "adviser",
    "residency": "residence", "examination": "exam", "examinations": "exam", "exams": "exam",
    "doctoral": "doctorate", "doctorates": "doctorate", "masters": "master",
    "withdrawal": "withdraw", "withdrawn": "withdraw", "withdrew": "withdraw", "withdrawing": "withdraw",
    "absent": "absence", "absences": "absence", "retakes": "retake", "retaking": "retake",
    "graduating": "graduation",
    "enrolment": "enrollment", "enrolled": "enroll", "enrolling": "enroll", "enrol": "enroll",
    "dropped": "drop", "dropping": "drop", "drops": "drop",
    "readmission": "readmit", "readmitted": "readmit",
    "panelist": "panel", "panelists": "panel", "panels": "panel",
    "ethical": "ethic", "ethics": "ethic", "licence": "license", "programme": "program",
    "theses": "thesis", "%": "percent",
}
_TOKEN = re.compile(r"[a-z0-9]+(?:\.[0-9]+)?|%")


def stem(word: str) -> str:
    word = _LEMMAS.get(word, word)
    if any(ch.isdigit() for ch in word) or word == "percent":
        return word
    if len(word) > 4 and word.endswith("ies"):
        word = word[:-3] + "y"
    elif len(word) > 5 and word.endswith("ing"):
        word = word[:-3]
    elif len(word) > 4 and word.endswith("ed"):
        word = word[:-2]
    elif len(word) > 4 and word.endswith("es") and not word.endswith(("ses", "xes", "ches", "shes")):
        word = word[:-2]
    elif len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
        word = word[:-1]
    if len(word) > 4 and word.endswith("e"):
        word = word[:-1]
    if len(word) > 3 and word[-1] == word[-2] and word[-1] not in "lsz":
        word = word[:-1]
    return word


def terms(text: str, keep_stop: bool = False) -> list[str]:
    out: list[str] = []
    lowered = (text or "").lower().replace("re-admission", "readmission")
    for raw in _TOKEN.findall(lowered):
        raw = _LEMMAS.get(raw, raw)
        if not keep_stop and raw in _STOP:
            continue
        if len(raw) <= 2 and not any(ch.isdigit() for ch in raw) and raw != "percent":
            continue
        out.append(stem(raw))
    return out


# Domain vocabulary: words the question uses -> words the documents use. Weighted lower than the question's own words.
_SYNONYMS: dict[str, list[str]] = {
    "panel": ["committee", "composition", "chair", "specialist", "external"],
    "member": ["panel", "chair"],
    "loa": ["leave", "absence"],
    "leave": ["loa", "absence"],
    "awol": ["absent", "without", "leave", "absence", "curtailed"],
    "fail": ["5.0", "retention", "drop", "readmit", "disqualification", "retake"],
    "drop": ["drp", "absence", "20", "percent", "automatically"],
    "absence": ["drp", "20", "percent", "drop", "excused"],
    "withdraw": ["refund", "fee", "percent", "second", "week"],
    "refund": ["withdraw", "fee", "percent", "week"],
    "charge": ["fee", "percent", "tuition", "pay"],
    "inc": ["incomplete", "removal", "academic", "year"],
    "incomplete": ["inc", "removal", "academic", "year"],
    "load": ["unit", "normal", "semester"],
    "unit": ["load"],
    "turnitin": ["similarity", "sir", "index", "15", "percent"],
    "similarity": ["turnitin", "sir", "index", "15", "percent"],
    "plagiarism": ["turnitin", "similarity"],
    "ethic": ["clearance", "rerc", "review", "form"],
    "clearance": ["ethic", "rerc", "review"],
    "exam": ["comprehensive", "score", "retake"],
    "graduation": ["requirement", "complete", "bound", "copy", "graduate"],
    "steps": ["procedure", "application", "guideline", "form"],
    "step": ["procedure", "application", "guideline", "form"],
    "dissertation": ["doctorate"],
    "doctorate": ["dissertation"],
    "thesis": ["dissertation", "project", "paper"],
    "capstone": ["project", "paper"],
    "tuition": ["fee", "pay"],
    "residence": ["maximum", "years", "academic"],
    "deadline": ["within", "before", "period", "weeks"],
    "eligible": ["eligibility", "qualify", "requirement"],
    "retake": ["repeat", "second", "third", "fail"],
    "repeat": ["retake", "fail", "again"],
    "adviser": ["appointment", "designation"],
    "readmit": ["return", "returning", "enroll", "intention"],
    "return": ["readmit", "returning", "intention", "enroll"],
    "cost": ["fee", "amount", "percent", "pay"],
    "fee": ["cost", "amount", "pay", "charged", "paid"],
    "miss": ["absence", "drp", "20", "percent", "drop", "automatically"],
    "skip": ["absence", "drp", "20", "percent", "drop"],
    "penalty": ["charged", "drop", "automatically", "surcharge", "fee"],
    "late": ["surcharge", "deadline", "week"],
    "title": ["concept", "paper", "defense"],
    "defense": ["panel", "form"],
}
_PHRASE_SYNONYMS: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"how (?:many|long).*\b(?:years?|semesters?)\b.*\b(?:finish|complete|graduate|take)\b|\b(?:finish|complete)\b.*\b(?:program|degree)\b.*\b(?:years?|long)\b"),
     ["maximum", "residence", "academic", "years"]),
    (re.compile(r"\b(?:another|other|different) (?:school|university|institution|college)\b"), ["cross", "enrollment", "institution", "permission"]),
    (re.compile(r"\bgood standing\b|\bremain(?:ing)? in\b.*\b(?:program|school)\b"), ["retention", "weighted", "average"]),
    (re.compile(r"\bpass(?:ing)? (?:score|mark)\b|\bto pass\b|\bscore\b.*\bpass\b"), ["minimum", "score", "7.00"]),
    (re.compile(r"\b(?:come|coming|go|going) back\b|\breturning\b"), ["return", "intention", "enroll", "registrar"]),
    (re.compile(r"\bstop(?:s|ped)? (?:attending|going)\b|\bnot (?:attending|enrolled)\b"), ["absence", "without", "leave", "awol"]),
    (re.compile(r"\bwho (?:can|may|needs?|has) to enroll\b|\bwho needs\b"), ["finished", "coursework", "residence", "enroll"]),
    (re.compile(r"\bhow early\b|\bhow soon\b|\bhow far\b"), ["least", "before", "weeks", "days"]),
    (re.compile(r"\bhow many panel\b|\bpanel (?:members|composition|size)\b"), ["chair", "members", "specialist", "external"]),
]
_QUANTITY = re.compile(
    r"\b(how many|how much|how long|how often|how early|how soon|maximum|minimum|at most|at least|limit|deadline|within|units?|"
    r"years?|days?|weeks?|months?|semesters?|percent|fee|fees|cost|score|grade|when|until)\b", re.IGNORECASE)
_NUMBER_WORDS = {
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "twelve", "twenty", "thirty",
    "fifty", "hundred", "half", "once", "twice", "first", "second", "third", "fourth",
}


class QueryTerms:
    """The question as weighted stems: its own words count fully, domain synonyms count half."""

    def __init__(self, question: str):
        self.question = question or ""
        lowered = self.question.lower()
        sequence = terms(self.question)
        seen: set[str] = set()
        self.base = [t for t in sequence if not (t in seen or seen.add(t))]
        self.expanded: dict[str, float] = {}
        for term in self.base:
            for extra in _SYNONYMS.get(term, []):
                extra = stem(extra)
                if extra not in self.base:
                    self.expanded[extra] = 0.5
        for pattern, extras in _PHRASE_SYNONYMS:
            if pattern.search(lowered):
                for extra in extras:
                    extra = stem(extra)
                    if extra not in self.base:
                        self.expanded[extra] = 0.5
        self.bigrams = set(zip(sequence, sequence[1:]))
        self.asks_quantity = bool(_QUANTITY.search(self.question))
        self.yes_no = bool(_YES_NO.match(self.question))
        self.asks_who = bool(re.search(r"\bwho\b", lowered))
        self.asks_money = bool(re.search(r"\b(?:how much|fees?|cost|price|amount|charge[sd]?|pay|paid|surcharge)\b", lowered))
        self.asks_consequence = bool(re.search(r"\bwhat (?:happens|will happen|if)\b|\bwhat is the (?:penalty|consequence)\b|\bconsequence", lowered))
        self.asks_duration = bool(re.search(r"\bhow (?:long|many (?:years?|months?|weeks?|days?|semesters?))\b|\bhow (?:early|soon)\b|\buntil when\b|\bdeadline\b", lowered))

    def weights(self) -> dict[str, float]:
        weights = dict(self.expanded)
        weights.update({term: 1.0 for term in self.base})
        return weights


# --------------------------------------------------------------------------- BM25 index
class PolicyIndex:
    """BM25 over chunk text plus section title, built once per document library."""

    K1 = 1.4
    B = 0.72

    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.tf: list[Counter] = []
        self.df: Counter = Counter()
        for chunk in chunks:
            doc = terms(chunk.get("text") or "") + terms(chunk.get("section") or "") * 2
            counts = Counter(doc)
            self.tf.append(counts)
            for term in counts:
                self.df[term] += 1
        self.lengths = [sum(counter.values()) for counter in self.tf]
        self.avg_length = (sum(self.lengths) / len(self.lengths)) if self.lengths else 1.0
        self.n = len(chunks)
        self.position_by_id = {chunk.get("id"): position for position, chunk in enumerate(chunks)}

    def idf(self, term: str) -> float:
        df = self.df.get(term, 0)
        return math.log(1 + (self.n - df + 0.5) / (df + 0.5))

    def bm25(self, query: QueryTerms, position: int) -> float:
        counts = self.tf[position]
        length = self.lengths[position] or 1
        score = 0.0
        for term, weight in query.weights().items():
            frequency = counts.get(term, 0)
            if not frequency:
                continue
            score += weight * self.idf(term) * (frequency * (self.K1 + 1)) / (
                frequency + self.K1 * (1 - self.B + self.B * length / self.avg_length)
            )
        return score


_INDEX_CACHE: dict[int, tuple[list, PolicyIndex]] = {}


def get_index(chunks: list[dict]) -> PolicyIndex:
    cached = _INDEX_CACHE.get(id(chunks))
    if cached is not None and cached[0] is chunks and cached[1].n == len(chunks):
        return cached[1]
    index = PolicyIndex(chunks)
    _INDEX_CACHE.clear()
    _INDEX_CACHE[id(chunks)] = (chunks, index)
    return index


# --------------------------------------------------------------------------- sentence scoring
_NUMBER_TOKEN = r"(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|thirty|fifty)"
_NUM_DURATION = re.compile(
    rf"\b{_NUMBER_TOKEN}\b(?:\s*\(\d+\))?[- ]*(?:academic\s+|calendar\s+|working\s+)?(?:year|month|week|day|semester|hour)s?\b",
    re.IGNORECASE,
)
_LIST_MARKER = re.compile(r"(?:^|\s)\d{1,2}[.)](?=\s)")
_PERMISSION = re.compile(r"\b(allowed|not allowed|may|may not|must|shall|only|cannot|required|not|no)\b", re.IGNORECASE)
_CONSEQUENCE = re.compile(
    r"\b(automatically|shall be|will be|will not|disqualif\w*|dropped|forfeit\w*|penalt\w*|not allowed|no re-admission|"
    r"charged|curtailed|withdrawn|required to)\b", re.IGNORECASE)
_ROLE = re.compile(
    r"\b(dean|associate dean|registrar|coordinator|adviser|advisor|chair|committee|office|professor|secretary|director|panel|"
    r"business office|cashier|librarian|statistician)\b", re.IGNORECASE)
_MONEY = re.compile(r"(?:\bP\s?\d|₱|\bphp\b|\bpesos?\b)", re.IGNORECASE)
_YES_NO = re.compile(r"^\s*(can|may|could|is|are|do|does|must|should|will|am)\b", re.IGNORECASE)


def _weight(index: "PolicyIndex", term: str) -> float:
    """Rare words decide which sentence answers the question, so their weight grows faster than plain idf."""
    return index.idf(term) ** 1.5


def score_sentence(
    sentence: str, query: QueryTerms, index: PolicyIndex, section_terms: set[str], section_sequence: list[str] | None = None
) -> float:
    sequence = terms(sentence)
    present = set(sequence)
    if not present:
        return 0.0
    score = 0.0
    for term, weight in query.weights().items():
        if term in present:
            score += weight * _weight(index, term)
        elif term in section_terms:
            score += 0.6 * weight * _weight(index, term)
    if score <= 0:
        return 0.0
    title_sequence = section_sequence or []
    title_pairs = set(zip(title_sequence, title_sequence[1:]))
    for pair in zip(sequence, sequence[1:]):
        if pair in query.bigrams:
            score += 3.0
    for pair in query.bigrams:
        # "The leave may be approved..." inside "Leave of Absence": the section title supplies the phrase.
        if pair in title_pairs and all(t in present or t in section_terms for t in pair) and pair not in set(zip(sequence, sequence[1:])):
            score += 1.8
    plain = _LIST_MARKER.sub(" ", sentence)
    if query.asks_quantity:
        if re.search(r"\d", plain) or set(re.findall(r"[a-z]+", plain.lower())) & _NUMBER_WORDS:
            score += 2.5
        if query.asks_duration and _NUM_DURATION.search(plain):
            score += 4.0
    if query.yes_no and _PERMISSION.search(plain):
        score += 2.5
    if query.asks_who and _ROLE.search(plain):
        score += 3.0
    if query.asks_money and (_MONEY.search(plain) or "%" in plain):
        score += 4.0
    if query.asks_consequence and _CONSEQUENCE.search(plain):
        score += 6.0
    words = len(sentence.split())
    value = score / (1 + 0.01 * max(0, words - 12))
    if words < 8 and not sentence.rstrip().endswith((".", "?", "!", ")")):
        value *= 0.25  # a heading or a label, not a rule
    if _LIST_MARKER.match(" " + sentence[:4]):
        value *= 0.9
    return value


def _coverage(window: str, query: QueryTerms, index: PolicyIndex, section: str = "") -> float:
    """Share of the question's own words found in a passage (rare words count a little more); synonyms add a little."""
    present = set(terms(window)) | set(terms(section))

    def weight(term: str) -> float:
        return 1.0 + min(index.idf(term), 3.0) / 3.0

    total = sum(weight(t) for t in query.base) or 1.0
    got = sum(weight(t) for t in query.base if t in present)
    got += 0.3 * sum(weight(t) for t in query.expanded if t in present)
    return min(1.0, got / total)


def _title_match(query: QueryTerms, index: PolicyIndex, section: str) -> float:
    """Share of the question's own words that appear in the section title (a strong signal)."""
    title = set(terms(section))
    total = sum(index.idf(t) for t in query.base) or 1.0
    return sum(index.idf(t) for t in query.base if t in title) / total


def _chunk_best_sentence(query: QueryTerms, index: PolicyIndex, position: int) -> tuple[float, int, list[str]]:
    chunk = index.chunks[position]
    sentences = split_sentences(chunk.get("text") or "")
    section_sequence = terms(chunk.get("section") or "")
    section_terms = set(section_sequence)
    best, best_i = 0.0, 0
    for i, sentence in enumerate(sentences):
        value = score_sentence(sentence, query, index, section_terms, section_sequence)
        if value > best:
            best, best_i = value, i
    return best, best_i, sentences


# --------------------------------------------------------------------------- search
def search(
    question: str,
    chunks: list[dict],
    limit: int = 3,
    extra_rank: list[str] | None = None,
    candidates: int = 14,
) -> list[dict]:
    """Best passages for a question: BM25 -> fusion with another ranking -> rerank on the best sentences.

    Every returned chunk is a copy with ``_score``, ``_coverage``, ``_relevant`` and ``_retrieval``.
    """
    if not chunks:
        return []
    query = QueryTerms(question)
    if not query.base:
        return []
    index = get_index(chunks)
    raw = [(index.bm25(query, position), position) for position in range(index.n)]
    raw = [item for item in raw if item[0] > 0]
    if not raw:
        return []
    raw.sort(key=lambda item: -item[0])
    top = raw[:candidates]
    max_bm25 = top[0][0] or 1.0
    other = {chunk_id: rank for rank, chunk_id in enumerate(extra_rank or [])}
    details = []
    for bm25_value, position in top:
        best, best_i, sentences = _chunk_best_sentence(query, index, position)
        details.append((bm25_value, position, best, best_i, sentences))
    max_sentence = max(item[2] for item in details) or 1.0
    scored = []
    for bm25_value, position, best, best_i, sentences in details:
        chunk = chunks[position]
        fused = 1.0 / (1 + other[chunk["id"]]) if chunk.get("id") in other else 0.0
        title_hit = _title_match(query, index, chunk.get("section") or "")
        score = 0.40 * (bm25_value / max_bm25) + 0.40 * (best / max_sentence) + 0.12 * fused + 0.10 * title_hit
        if (chunk.get("status") or "active") == "draft":
            score *= 0.85  # the handbook is in force; a draft only answers what the handbook does not
        elif chunk.get("kind") == "managed":
            score *= 1.05  # a staff upload is the newer, approved word
        window = " ".join(sentences[max(0, best_i - 1): best_i + 2])
        scored.append((score, position, _coverage(window, query, index, chunk.get("section") or "")))
    scored.sort(key=lambda item: -item[0])
    return [
        {
            **chunks[position], "_score": round(score, 4), "_coverage": round(coverage, 3),
            "_relevant": coverage >= MIN_COVERAGE, "_retrieval": "bm25-hybrid" if extra_rank else "bm25",
        }
        for score, position, coverage in scored[:limit]
    ]


MIN_COVERAGE = 0.5


# --------------------------------------------------------------------------- answering
NOT_FOUND_ANSWER = (
    "I could not find this in the Handbook, the Research Protocol or the uploaded policies. "
    "Try asking with the name of the rule, stage or form (for example leave of absence, comprehensive exam, "
    "title defense or Form 1), or ask the Graduate School office."
)


def _strip_heading_prefix(sentence: str, section: str) -> str:
    """A chunk starts with its own heading line; do not let the heading pose as part of the rule."""
    tail = (section or "").split(">")[-1].strip().rstrip(":")
    if tail and sentence.lower().startswith(tail.lower()) and len(sentence) > len(tail) + 25:
        return sentence[len(tail):].lstrip(" :.-")
    return sentence


def _tidy(sentence: str) -> str:
    sentence = re.sub(r"\s+", " ", sentence).strip()
    sentence = re.sub(r"^[-*]\s+", "", sentence)
    return re.sub(r"\s+([,.;:])", r"\1", sentence)


def _source_line(chunk: dict) -> str:
    title = chunk.get("title") or "Document"
    bits = []
    if chunk.get("page") is not None:
        bits.append(f"p. {chunk['page']}")
    section = (chunk.get("section") or "").replace(">", "-")
    if section:
        bits.append(section)
    return f"Source: {title}" + (f" ({', '.join(bits)})" if bits else "")


def _section_stream(all_chunks: list[dict], position: int, before: int = 1, after: int = 2) -> list[tuple[int, int, str]]:
    """Sentences (chunk position, number, text) of the chunks around ``position`` that share its section."""
    home = all_chunks[position]
    positions = [position]
    for delta in range(1, before + 1):
        other = position - delta
        if other >= 0 and _same_section(all_chunks[other], home):
            positions.insert(0, other)
        else:
            break
    for delta in range(1, after + 1):
        other = position + delta
        if other < len(all_chunks) and _same_section(all_chunks[other], home):
            positions.append(other)
        else:
            break
    stream: list[tuple[int, int, str]] = []
    for chunk_position in positions:
        chunk = all_chunks[chunk_position]
        for number, sentence in enumerate(split_sentences(chunk.get("text") or "")):
            sentence = _strip_heading_prefix(sentence, chunk.get("section") or "")
            if sentence:
                stream.append((chunk_position, number, sentence))
    return stream


def _same_section(a: dict, b: dict) -> bool:
    return a.get("title") == b.get("title") and a.get("sec") == b.get("sec")


_CONTINUES = re.compile(r"^(however|but|otherwise|except|unless|provided|in case|if not|failure)\b", re.IGNORECASE)
_LEADS_LIST = re.compile(r"(following|below|as follows|listed|states that|stated below)\W*$", re.IGNORECASE)


def compose_answer(
    question: str,
    passages: list[dict],
    all_chunks: list[dict],
    max_chars: int = 900,
) -> tuple[str, list[dict]] | None:
    """A short direct answer from the best 1-3 sentences, with the source named.

    Returns (answer_text, used_passages) or None when the documents do not answer the question. Each used passage
    carries ``quote`` (the exact sentences used) plus its ``page`` and ``section``.
    """
    query = QueryTerms(question)
    if not passages or not query.base:
        return None
    index = get_index(all_chunks)
    top_score = max((p.get("_score") or 0) for p in passages) or 1.0
    # [score, stream, stream index] for the best sentence of each relevant passage, plus every scored sentence.
    scored: list[tuple[float, list, int]] = []
    for passage in passages[:3]:
        if not passage.get("_relevant"):
            continue
        position = index.position_by_id.get(passage.get("id"))
        if position is None:
            continue
        stream = _section_stream(all_chunks, position)
        rank_weight = 0.5 + 0.5 * ((passage.get("_score") or 0) / top_score)
        for number, (chunk_position, _n, sentence) in enumerate(stream):
            chunk = all_chunks[chunk_position]
            section_sequence = terms(chunk.get("section") or "")
            value = score_sentence(sentence, query, index, set(section_sequence), section_sequence)
            if value > 0:
                value *= rank_weight * (1.0 if chunk_position == position else 0.85)
                if (chunk.get("status") or "active") == "draft":
                    value *= 0.85  # the handbook is in force; a draft only adds what the handbook does not say
                scored.append((value, stream, number))
    if not scored:
        return None
    scored.sort(key=lambda item: -item[0])
    best, stream, number = scored[0]
    home_chunk = all_chunks[stream[number][0]]

    chosen: dict[tuple[int, int], str] = {}

    chosen_sets: list[tuple[tuple[int, int], set[str]]] = []

    def add(entry: tuple[int, int, str]) -> None:
        key = (entry[0], entry[1])
        if key in chosen:
            return
        words = set(terms(entry[2]))
        for other_key, other in chosen_sets:
            different_section = not _same_section(all_chunks[other_key[0]], all_chunks[key[0]])
            if different_section and words and other and len(words & other) / len(words | other) >= 0.55:
                return  # the same rule said again (for example in a draft manual that quotes the handbook)
        chosen[key] = entry[2]
        chosen_sets.append((key, words))

    add(stream[number])
    lead = stream[number][2]
    list_answer = False
    if lead.rstrip().endswith(":") or _LEADS_LIST.search(lead):
        list_answer = True
        for extra in range(number + 1, min(len(stream), number + 11)):
            add(stream[extra])
    else:
        if number + 1 < len(stream) and _CONTINUES.match(stream[number + 1][2]):
            add(stream[number + 1])
        if number > 0 and re.match(r"^(and|or|but|which|however|provided|unless)\b", lead, re.IGNORECASE):
            add(stream[number - 1])
    # Other sentences that carry the answer (several parts of one rule, or a second source), strongest first.
    for value, item_stream, item_number in scored[1:]:
        if len(chosen) >= 4 or value < 0.6 * best:
            break
        entry = item_stream[item_number]
        same = _same_section(all_chunks[entry[0]], home_chunk)
        if not same and value < 0.85 * best:
            continue
        add(entry)
    # Then the rule sentences right next to the best one that also speak to the question.
    by_stream_index = {(id(item_stream), item_number): value for value, item_stream, item_number in scored}
    for neighbour in (number - 1, number + 1):
        if len(chosen) < 4 and 0 <= neighbour < len(stream) and by_stream_index.get((id(stream), neighbour), 0) >= 0.35 * best:
            add(stream[neighbour])

    budget = int(max_chars * (1.4 if list_answer else 1.0))
    home_position = stream[number][0]
    ordered = sorted(
        chosen.items(),
        key=lambda item: (not _same_section(all_chunks[item[0][0]], home_chunk), item[0][0], item[0][1]),
    )
    used: list[tuple[int, str]] = []
    total = 0
    for (position, _n), sentence in ordered:
        text = _tidy(sentence)
        if used and total + len(text) > budget:
            break
        used.append((position, text))
        total += len(text) + 1
    if not used:
        return None

    ranked = {p.get("id"): p for p in passages}
    groups: dict[tuple, dict] = {}
    for position, text in used:
        chunk = all_chunks[position]
        group = groups.setdefault((chunk.get("title"), chunk.get("sec")), {"chunk": chunk, "sentences": []})
        group["sentences"].append(text)
    paragraphs: list[str] = []
    used_passages: list[dict] = []
    for group in groups.values():
        chunk = group["chunk"]
        quote = " ".join(group["sentences"])
        paragraphs.append(quote + "\n" + _source_line(chunk))
        ranked_chunk = ranked.get(chunk.get("id")) or {}
        used_passages.append({
            **chunk, "quote": quote,
            "_score": ranked_chunk.get("_score"), "_retrieval": ranked_chunk.get("_retrieval", "bm25"),
        })
    return "\n\n".join(paragraphs), used_passages
