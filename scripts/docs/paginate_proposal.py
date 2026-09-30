#!/usr/bin/env python
"""Paginate and correct `Final Proposal Document - CAP-IT1.docx` (raw OOXML, no Word needed).

Usage
    python scripts/docs/paginate_proposal.py INPUT.docx OUTPUT.docx [--labels labels.json]

What it does (all steps are idempotent: running it on its own output changes nothing;
after somebody adds content you can simply run it again on the result):

 1. Sections (next page): front matter (title page + abstract) | table of contents |
    list of figures + list of tables | chapters 1-6 | references | glossary + acronyms |
    appendices. Every `w:sectPr` copies the page size and margins of the original.
 2. Page numbers: title page none (it is page 0), other front matter lower-case roman starting at i on the abstract, the table of
    contents pages carry no number (own empty footer), each chapter restarts at 1 and
    prints chapter-page ("1-1", "2-14") through Word's native mechanism
    (`w:pgNumType w:chapStyle="1" w:chapSep="hyphen"` plus numbered Heading 1), and the
    references / glossary / appendices print "R-n" / "G-n" / "A-n" from their own footer.
 3. Table of contents: headings 1-3 only (captions removed), field instruction
    `TOC \\o "1-3" \\h \\z \\u`, field marked dirty, `w:updateFields` set in settings.xml,
    cached entries regenerated with chapter-page labels. LIST OF FIGURES / LIST OF TABLES
    are regenerated from the captions in the body (Heading 5 "Figure ..." / "Table ...")
    with PAGEREF fields and cached labels.
 4. Wording fixes (subject-level withdrawal, graduation hand-off to the Registrar, and the
    "originally proposed" technology stack with a divergence note in Chapters 3 and 5).

Cached page labels are taken, in this order, from: the --labels JSON (anchor -> label, made
by measure_proposal_pages.py from a LibreOffice render), the labels already cached in the
document, the legacy absolute page numbers of the old table of contents, or an estimate.
Word recalculates every field when the file is opened (updateFields + dirty TOC).
"""
import argparse
import html
import json
import math
import re
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

# --------------------------------------------------------------------------- constants
NUMBERING_NAME = "ProposalChapterHeading"
TOC_INSTR = ' TOC \\o "1-3" \\h \\z \\u '
TAB_POS = 9350  # right margin of the 8.5 inch page with 1 inch margins (12240 - 2880 = 9360)
FOOTER_PARTS = {  # part name -> prefix printed before the page number ('' = no number)
    "footer3.xml": None,  # table of contents: no page number at all
    "footer4.xml": "R-",  # references
    "footer5.xml": "G-",  # glossary of terms + list of acronyms
    "footer6.xml": "A-",  # appendices
}
SECTION_ORDER = ["front", "toc", "lists", "ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ref", "glo", "app"]
PREFIX = {"ref": "R-", "glo": "G-", "app": "A-"}

PPR_ORDER = ["pStyle", "keepNext", "keepLines", "pageBreakBefore", "framePr", "widowControl", "numPr",
             "suppressLineNumbers", "pBdr", "shd", "tabs", "suppressAutoHyphens", "kinsoku", "wordWrap",
             "overflowPunct", "topLinePunct", "autoSpaceDE", "autoSpaceDN", "bidi", "adjustRightInd",
             "snapToGrid", "spacing", "ind", "contextualSpacing", "mirrorIndents", "suppressOverlap", "jc",
             "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr",
             "sectPr", "pPrChange"]

TNR = ('<w:rFonts w:ascii="Times New Roman" w:cs="Times New Roman" w:eastAsia="Times New Roman" '
       'w:hAnsi="Times New Roman"/>')

# --------------------------------------------------------------------------- wording fixes
# (old text, new text, expected number of paragraphs, exact paragraph match)
U = "’"  # typographic apostrophe used in the document
EDITS = [
    # ---- withdrawal is SUBJECT-level -------------------------------------------------
    ("This figure shows withdrawal as a controlled exit process. The student submits a withdrawal request, "
     "Graduate School Staff forward it to the Dean, and the Dean approves or denies the request. If denied, the "
     "student remains active. If approved, follow-through actions are performed, such as noting the effective "
     "term and informing relevant Graduate School parties, and the withdrawal is confirmed.",
     "This figure shows subject withdrawal, not leaving the graduate program. An active student withdraws from "
     "one or more of the subjects in which the student is enrolled. A withdrawal is allowed until the end of the "
     "second week from the start of classes; under the Graduate School Handbook 2022-2023, 10% of the term" + U +
     "s total due is charged if the student withdraws within the first week and 20% if within the second, and "
     "full fees apply afterwards. The student writes to the Dean, Graduate School Staff forward the request, and "
     "the Dean approves or denies it. If denied, the student" + U + "s enrollment is unchanged. If approved, "
     "Graduate School Staff tag only the selected subject or subjects as Withdrawn and export the record for the "
     "Registrar. The student remains Active in the program and all other subjects are unchanged.", 1, False),
    ("Withdrawal Confirmed and Recorded", "Subject Withdrawal Confirmed and Recorded", 2, True),
    ("Withdrawal status recorded; monitoring stops with an auditable exit reason category (if allowed)",
     "Withdrawal recorded by tagging only the selected subject(s) as Withdrawn, with an auditable record; the "
     "student stays Active, the other subjects are unchanged, and the record is exported for the Registrar",
     2, True),
    ("The formal process of leaving the graduate program.",
     "The formal process by which an active student withdraws from one or more enrolled subjects, without "
     "leaving the graduate program. It is allowed until the end of the second week from the start of classes, "
     "is approved or denied by the Dean, and, if approved, is recorded by tagging only the selected subject(s) "
     "as Withdrawn; the student remains Active.", 1, False),
    ("The as-built behaviour described in this section therefore supersedes the summary description given in "
     "Section 1.3.11 and in the glossary. This divergence between adviser framing and client specification "
     "remains open and is to be reconciled before the final defense.",
     "Section 1.3.11, its milestone-table rows, and the glossary entry for Withdrawal have since been corrected "
     "to this subject-level definition, so Chapter 1 and this section now agree.", 1, False),
    # ---- graduation hand-off to the Registrar ----------------------------------------
    ("If approved, the endorsed list is sent to the Registrar and the receipt is acknowledged.",
     "If approved, the portal exports the endorsed list, and the Dean sends the exported file to the Registrar "
     "through the official external channel. The prototype records the export only; it does not claim that an "
     "email was sent or that the Registrar acknowledged receipt.", 1, False),
    ("Section 1.3.12 describes the endorsed list as being sent to the Registrar with receipt acknowledged. In "
     "present practice, and in the implemented system, the conveyance is a file that a person sends through the "
     "official external channel; no automated transmission occurs and no acknowledgement is captured. The "
     "account in this section is the one carried forward.",
     "Section 1.3.12 describes the same flow. In present practice, and in the implemented system, the portal "
     "exports the endorsed list after the Dean approves it, and the conveyance is a file that the Dean sends "
     "through the official external channel; no automated transmission occurs and no acknowledgement is "
     "captured.", 1, False),
    # ---- technology: make every proposed-stack statement read as "originally proposed" ---
    ("and supported by the opportunity to use AI through NotebookLM, the module",
     "and supported by the opportunity to use AI through NotebookLM (the tool originally proposed; see Section "
     "3.2.5), the module", 1, False),
    ("NotebookLM may be used to support this module, since it can work with",
     "As originally proposed, NotebookLM would support this module, since it can work with", 1, False),
    ("Figure 4 shows the high-level architecture of the proposed platform for graduate student lifecycle "
     "monitoring and decision support.",
     "Figure 4 shows the high-level architecture of the proposed platform for graduate student lifecycle "
     "monitoring and decision support, as originally proposed (the technology actually used is described in "
     "Section 3.2.5 and in Chapter 5).", 1, False),
    ("built on Node.js and Express.js through a REST API",
     "built, as originally proposed, on Node.js and Express.js through a REST API", 1, False),
    ("with Prisma used for ORM and migrations", "with Prisma (as originally proposed) used for ORM and migrations",
     1, False),
    ("The backend is built on Node.js and Express.js.",
     "In the original proposal, the backend is built on Node.js and Express.js.", 1, False),
    ("NotebookLM may be used as a practical prototyping environment for organizing and querying approved "
     "reference materials, but it is not treated",
     "In the original proposal, NotebookLM was to be used as a practical prototyping environment for organizing "
     "and querying approved reference materials, but it is not treated", 1, False),
    ("The technology stack is selected to support the platform" + U + "s current core application modules",
     "The originally proposed technology stack is selected to support the platform" + U + "s current core "
     "application modules", 1, False),
    ("The platform follows a web architecture that uses React and TypeScript",
     "As originally proposed, the platform follows a web architecture that uses React and TypeScript", 1, False),
    ("The RAG pipeline uses LangChain.js", "In the original proposal, the RAG pipeline uses LangChain.js", 1, False),
    ("Table 9. IT tools to be used", "Table 9. IT tools to be used (as originally proposed)", 1, True),
    ("Appendix M. IT tools to be used", "Appendix M. IT tools to be used (as originally proposed)", 1, True),
    ("The platform will be implemented as a web application with a simple three-layer structure:",
     "As originally proposed, the platform was to be implemented as a web application with a simple three-layer "
     "structure:", 1, False),
    ("JWT authentication for UserAccount identities",
     "JWT authentication for UserAccount identities (as originally proposed; the implemented system uses "
     "server-side sessions)", 1, False),
    ("made available to the through NotebookLM via Retrieval-Augmented Generation (RAG)",
     "made available to the assistant, which in the original proposal runs through NotebookLM, via "
     "Retrieval-Augmented Generation (RAG)", 1, False),
    ("This is consistent with the study" + U + "s use of RAG through NotebookLM",
     "This is consistent with the study" + U + "s originally proposed use of RAG through NotebookLM", 1, False),
    ("Official OpenAI pricing for GPT-4.1 is",
     "For the originally proposed OpenAI API, official pricing for GPT-4.1 is", 1, False),
    ("Official OpenAI text pricing currently ranges",
     "For the originally proposed OpenAI API, official text pricing currently ranges", 1, False),
    ("is presented as Figure 6 in Section 3.2.5.5 and in Appendix P.",
     "is presented, as originally proposed, as Figure 6 in Section 3.2.5.5 and in Appendix P.", 1, False),
]

# (prefix of the paragraph to insert after, bold lead-in, body text)
INSERTS = [
    ("For policy and case guidance, the proposed system implements Retrieval-Augmented Generation (RAG).",
     "Note on the technology actually used. ",
     "The tools named in this section, namely Node.js and Express.js, Prisma, JWT, NotebookLM, LangChain.js, the "
     "OpenAI API and ChromaDB, are the stack originally proposed for this study, and they are kept here as the "
     "original design. What was built differs: the application server is written in Python 3 with Flask and "
     "SQLAlchemy, the interface is a React application built with Vite and styled with Tailwind CSS, sign-in "
     "uses server-side sessions, and the policy assistant uses Google Gemini for answer generation and "
     "embeddings, with a local keyword-retrieval fallback when no API key is configured. The stack changed "
     "because Python offered mature libraries for the Excel, PDF and scanned-document processing on which the "
     "workbook import and the policy assistant depend, because one server process can serve both the API and "
     "the compiled interface, and because Gemini provides generation and embeddings from a single service while "
     "the local fallback keeps the assistant usable without a key. The functions and the role of each module "
     "are unchanged. Figure 4, Figure 6 and Appendix P show the originally proposed design; the implemented "
     "architecture is documented in Chapter 5."),
    ("The retrieval-augmented policy assistant sits alongside the application tier.",
     "Relation to the original proposal. ",
     "Chapters 1 to 3 describe the architecture as originally proposed (Node.js and Express.js, Prisma, JWT, "
     "NotebookLM, LangChain.js, the OpenAI API and ChromaDB), and they are kept as the original design. The "
     "system described in this chapter is the one that was built: Python 3 with Flask and SQLAlchemy, React with "
     "Vite and Tailwind CSS, MySQL (SQLite for isolated tests), and Google Gemini for generation and "
     "embeddings, with a local keyword-retrieval fallback when no API key is configured. The reasons for the "
     "change are given in Section 3.2.5. The scope, the modules, and the rule that the assistant supports but "
     "does not replace human decisions are unchanged; only the implementing technology differs. Figure 6 and "
     "Appendix P therefore show the originally proposed design, not the implemented one."),
]


# --------------------------------------------------------------------------- small helpers
def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def unesc(s):
    return html.unescape(s)


def norm(s):
    return re.sub(r"\s+", " ", unesc(s)).strip().lower()


def roman(n):
    vals = [(1000, "m"), (900, "cm"), (500, "d"), (400, "cd"), (100, "c"), (90, "xc"), (50, "l"), (40, "xl"),
            (10, "x"), (9, "ix"), (5, "v"), (4, "iv"), (1, "i")]
    out = ""
    for v, s in vals:
        while n >= v:
            out += s
            n -= v
    return out


def unroman(s):
    vals = {"i": 1, "v": 5, "x": 10, "l": 50, "c": 100, "d": 500, "m": 1000}
    tot = 0
    for i, ch in enumerate(s):
        v = vals[ch]
        tot += -v if i + 1 < len(s) and vals[s[i + 1]] > v else v
    return tot


def para_text(x):
    return "".join(unesc(t) for t in re.findall(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>", x))


PPR_AT_START = re.compile(r"^(<w:p(?:\s[^>]*)?>)(?:<w:pPr>(.*?)</w:pPr>|<w:pPr/>)?", re.S)


def split_children(inner):
    out, depth, start, cur = [], 0, 0, None
    for m in re.finditer(r"<(/?)([A-Za-z0-9]+:[A-Za-z0-9]+)([^>]*?)(/?)>", inner):
        close, name, _attrs, selfc = m.groups()
        local = name.split(":", 1)[1]
        if not close and selfc:
            if depth == 0:
                out.append((local, m.group(0)))
        elif not close:
            if depth == 0:
                start, cur = m.start(), local
            depth += 1
        else:
            depth -= 1
            if depth == 0:
                out.append((cur, inner[start:m.end()]))
    return out


def get_ppr_children(pxml):
    m = PPR_AT_START.match(pxml)
    if not m or m.group(2) is None:
        return []
    return split_children(m.group(2))


def set_ppr_child(pxml, name, child_xml):
    """Insert/replace/remove one direct child of the paragraph's pPr, keeping schema order."""
    m = PPR_AT_START.match(pxml)
    assert m, "not a paragraph"
    children = split_children(m.group(2)) if m.group(2) is not None else []
    children = [c for c in children if c[0] != name]
    if child_xml is not None:
        idx = PPR_ORDER.index(name)
        pos = len(children)
        for i, (n, _x) in enumerate(children):
            if n in PPR_ORDER and PPR_ORDER.index(n) > idx:
                pos = i
                break
        children.insert(pos, (name, child_xml))
    new_ppr = "<w:pPr>" + "".join(c[1] for c in children) + "</w:pPr>" if children else ""
    return m.group(1) + new_ppr + pxml[m.end():]


def ppr_child(pxml, name):
    for n, x in get_ppr_children(pxml):
        if n == name:
            return x
    return None


def pstyle(pxml):
    x = ppr_child(pxml, "pStyle")
    if x:
        return re.search(r'w:val="([^"]*)"', x).group(1)
    return None


# --------------------------------------------------------------------------- text replacement
T_RE = re.compile(r"(<w:t(?:\s[^>]*)?>)([^<]*)(</w:t>)")


def replace_in_paragraph(pxml, old, new, at=None):
    """Replace `old` by `new` in the concatenated text of a paragraph, keeping the first run's formatting."""
    segs = [(m.start(), m.end(), m.group(1), unesc(m.group(2)), m.group(3)) for m in T_RE.finditer(pxml)]
    full = "".join(s[3] for s in segs)
    idx = full.find(old) if at is None else at
    if idx < 0 or full[idx:idx + len(old)] != old:
        return None
    end = idx + len(old)
    out, pos, done = [], 0, False
    cursor = 0
    pieces = []
    for (s, e, op, txt, cl) in segs:
        seg_start, seg_end = cursor, cursor + len(txt)
        cursor = seg_end
        if seg_end <= idx or seg_start >= end:
            pieces.append((s, e, None))
            continue
        a = max(idx, seg_start) - seg_start
        b = min(end, seg_end) - seg_start
        if not done:
            newtxt = txt[:a] + new + txt[b:]
            done = True
        else:
            newtxt = txt[:a] + txt[b:]
        pieces.append((s, e, '<w:t xml:space="preserve">' + esc(newtxt) + "</w:t>"))
    res, last = [], 0
    for s, e, rep in pieces:
        if rep is None:
            continue
        res.append(pxml[last:s])
        res.append(rep)
        last = e
    res.append(pxml[last:])
    return "".join(res)


P_ALL = re.compile(r"<w:p(?:\s[^>]*)?>.*?</w:p>", re.S)


def edit_item(xml, old, new, exact):
    """Apply one edit to every matching paragraph inside an item. Returns (xml, n_done, n_already)."""
    n_done = 0
    n_new_present = 0

    def repl(m):
        nonlocal n_done, n_new_present
        p = m.group(0)
        full = para_text(p)
        if exact:
            if full.strip() == old:
                r = replace_in_paragraph(p, old, new, at=full.index(old))
                n_done += 1
                return r
            if full.strip() == new:
                n_new_present += 1
            return p
        if new in full:  # check first: `new` may itself start with `old`
            n_new_present += 1
            return p
        if old in full:
            r = replace_in_paragraph(p, old, new)
            n_done += 1
            return r
        return p

    if old not in para_text_all_quick(xml) and new not in para_text_all_quick(xml):
        return xml, 0, 0
    return P_ALL.sub(repl, xml), n_done, n_new_present


def para_text_all_quick(xml):
    return "".join(unesc(t) for t in re.findall(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>", xml))


# --------------------------------------------------------------------------- package I/O
def read_pkg(path):
    zf = zipfile.ZipFile(path)
    infos = zf.infolist()
    data = {i.filename: zf.read(i.filename) for i in infos}
    zf.close()
    return infos, data


def write_pkg(path, infos, data):
    names = [i.filename for i in infos]
    order = ["[Content_Types].xml"] + [n for n in names if n != "[Content_Types].xml"]
    order += [n for n in data if n not in names]
    by = {i.filename: i for i in infos}
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as out:
        for n in order:
            if n not in data:
                continue
            zi = zipfile.ZipInfo(n, date_time=by[n].date_time if n in by else (2026, 9, 30, 8, 8, 44))
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = by[n].external_attr if n in by else 0
            out.writestr(zi, data[n])


# --------------------------------------------------------------------------- document model
TOKEN = re.compile(r"<(/?)w:(p|tbl|sdt)(?=[\s>/])[^>]*?(/?)>")


def split_body(doc):
    bs = doc.index("<w:body>") + len("<w:body>")
    se = doc.rindex("<w:sectPr")
    m = re.match(r"<w:sectPr[ >].*?</w:sectPr></w:body></w:document>\s*$", doc[se:], re.S)
    assert m, "final sectPr is not the last child of w:body"
    final_sect = re.match(r"<w:sectPr[ >].*?</w:sectPr>", doc[se:], re.S).group(0)
    items, stack, start, pos = [], [], None, bs
    for m in TOKEN.finditer(doc, bs, se):
        close, name, selfc = m.group(1), m.group(2), m.group(3)
        if selfc:
            if not stack:
                assert m.start() == pos
                items.append([name, doc[m.start():m.end()]])
                pos = m.end()
            continue
        if not close:
            if not stack:
                start = m.start()
                assert start == pos, "gap between top-level body items"
            stack.append(name)
        else:
            stack.pop()
            if not stack:
                items.append([name, doc[start:m.end()]])
                pos = m.end()
    assert pos == se, "body items do not cover the body"
    return doc[:bs], items, final_sect, doc[se + len(final_sect):]


def h_level(x):
    st = pstyle(x)
    if st and re.fullmatch(r"Heading[1-6]", st):
        return int(st[-1])
    return 0


CH_RE = re.compile(r"^\s*chapter\s+(\d+)\s*[–—-]\s*", re.I)


def numpr_id(x):
    n = ppr_child(x, "numPr")
    if n:
        m = re.search(r'<w:numId w:val="(\d+)"', n)
        if m:
            return int(m.group(1))
    return None


# --------------------------------------------------------------------------- numbering / styles / settings
def ensure_numbering(xml):
    m = re.search(r'<w:abstractNum w:abstractNumId="(\d+)"[^>]*>(?:(?!</w:abstractNum>).)*?<w:name w:val="%s"/>' %
                  NUMBERING_NAME, xml, re.S)
    if m:
        aid = m.group(1)
        nm = re.search(r'<w:num w:numId="(\d+)"[^>]*><w:abstractNumId w:val="%s"/>' % aid, xml)
        return xml, int(nm.group(1))
    aids = [int(x) for x in re.findall(r'<w:abstractNum w:abstractNumId="(\d+)"', xml)]
    nids = [int(x) for x in re.findall(r'<w:num w:numId="(\d+)"', xml)]
    aid, nid = max(aids + [0]) + 1, max(nids + [0]) + 1
    lvl0 = ('<w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:pStyle w:val="Heading1"/>'
            '<w:suff w:val="space"/><w:lvlText w:val="CHAPTER %1 –"/><w:lvlJc w:val="left"/>'
            '<w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr></w:lvl>')
    rest = "".join('<w:lvl w:ilvl="%d"><w:start w:val="1"/><w:numFmt w:val="none"/><w:suff w:val="nothing"/>'
                   '<w:lvlText w:val=""/><w:lvlJc w:val="left"/><w:pPr><w:ind w:left="0" w:firstLine="0"/></w:pPr>'
                   '</w:lvl>' % k for k in range(1, 9))
    absn = ('<w:abstractNum w:abstractNumId="%d"><w:nsid w:val="4C4A5052"/><w:multiLevelType w:val="multilevel"/>'
            '<w:tmpl w:val="5E1F2B03"/><w:name w:val="%s"/>%s%s</w:abstractNum>' % (aid, NUMBERING_NAME, lvl0, rest))
    first_num = xml.index("<w:num ")
    xml = xml[:first_num] + absn + xml[first_num:]
    xml = xml.replace("</w:numbering>", '<w:num w:numId="%d"><w:abstractNumId w:val="%d"/></w:num></w:numbering>'
                      % (nid, aid))
    return xml, nid


def ensure_styles(xml, numid):
    m = re.search(r'<w:style w:type="paragraph" w:styleId="Heading1">.*?</w:style>', xml, re.S)
    st = m.group(0)
    if "<w:numPr>" in st:
        st2 = re.sub(r"<w:numPr>.*?</w:numPr>", '<w:numPr><w:numId w:val="%d"/></w:numPr>' % numid, st, flags=re.S)
    else:
        assert '<w:keepLines w:val="1"/>' in st
        st2 = st.replace('<w:keepLines w:val="1"/>',
                         '<w:keepLines w:val="1"/><w:numPr><w:numId w:val="%d"/></w:numPr>' % numid, 1)
    xml = xml.replace(st, st2)

    def toc_style(sid, name, left, bold):
        ind = '<w:ind w:left="%d" w:firstLine="0"/>' % left if left else ""
        b = '<w:b w:val="1"/><w:bCs w:val="1"/>' if bold else ""
        return ('<w:style w:type="paragraph" w:styleId="%s"><w:name w:val="%s"/><w:basedOn w:val="Normal"/>'
                '<w:next w:val="Normal"/><w:uiPriority w:val="39"/><w:unhideWhenUsed/><w:pPr>'
                '<w:widowControl w:val="0"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="%d"/></w:tabs>'
                '<w:spacing w:before="60" w:line="240" w:lineRule="auto"/>%s</w:pPr><w:rPr>%s%s'
                '<w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:style>' % (sid, name, TAB_POS, ind, TNR, b))

    new = []
    if 'w:styleId="TOC1"' not in xml:
        new += [toc_style("TOC1", "toc 1", 0, True), toc_style("TOC2", "toc 2", 360, False),
                toc_style("TOC3", "toc 3", 720, False)]
    if 'w:styleId="TableofFigures"' not in xml:
        new.append('<w:style w:type="paragraph" w:styleId="TableofFigures"><w:name w:val="table of figures"/>'
                   '<w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:uiPriority w:val="99"/><w:unhideWhenUsed/>'
                   '<w:pPr><w:widowControl w:val="0"/><w:tabs><w:tab w:val="right" w:leader="dot" w:pos="%d"/></w:tabs>'
                   '<w:spacing w:before="60" w:line="240" w:lineRule="auto"/></w:pPr><w:rPr>%s<w:sz w:val="24"/>'
                   '<w:szCs w:val="24"/></w:rPr></w:style>' % (TAB_POS, TNR))
    if new:
        xml = xml.replace("</w:styles>", "".join(new) + "</w:styles>")
    return xml


def ensure_settings(xml):
    if "<w:updateFields" in xml:
        return re.sub(r"<w:updateFields[^>]*/>", '<w:updateFields w:val="true"/>', xml)
    assert "<w:compat>" in xml
    return xml.replace("<w:compat>", '<w:updateFields w:val="true"/><w:compat>', 1)


def footer_xml(base_footer, prefix):
    """Build a footer part from footer1's root element. prefix None = empty paragraph, no PAGE field."""
    root = re.match(r"(<\?xml[^>]*\?>\s*<w:ftr[^>]*>)", base_footer).group(1)
    rpr = "<w:rPr>%s<w:sz w:val=\"24\"/><w:szCs w:val=\"24\"/></w:rPr>" % TNR
    if prefix is None:
        body = '<w:p><w:pPr><w:rPr/></w:pPr></w:p>'
    else:
        body = ('<w:p><w:pPr><w:jc w:val="right"/>%s</w:pPr><w:r>%s<w:t xml:space="preserve">%s</w:t></w:r>'
                '<w:r>%s<w:fldChar w:fldCharType="begin"/></w:r><w:r>%s<w:instrText xml:space="preserve"> PAGE '
                '</w:instrText></w:r><w:r>%s<w:fldChar w:fldCharType="separate"/></w:r><w:r>%s<w:t>1</w:t></w:r>'
                '<w:r>%s<w:fldChar w:fldCharType="end"/></w:r></w:p>' % (rpr, rpr, prefix, rpr, rpr, rpr, rpr, rpr))
    return root + body + "</w:ftr>"


def ensure_footers(data):
    """Create footer3..6 + relationships + content-type overrides. Returns {part name: rId}."""
    rels = data["word/_rels/document.xml.rels"].decode("utf-8")
    ct = data["[Content_Types].xml"].decode("utf-8")
    base = data["word/footer1.xml"].decode("utf-8")
    ids = {}
    for name, prefix in FOOTER_PARTS.items():
        part = "word/" + name
        if part not in data:
            data[part] = footer_xml(base, prefix).encode("utf-8")
        m = re.search(r'<Relationship Id="(rId\d+)"[^>]*Target="%s"' % re.escape(name), rels)
        if m:
            ids[name] = m.group(1)
        else:
            nums = [int(x) for x in re.findall(r'Id="rId(\d+)"', rels)]
            rid = "rId%d" % (max(nums) + 1)
            rels = rels.replace("</Relationships>",
                                '<Relationship Id="%s" Type="http://schemas.openxmlformats.org/officeDocument/2006/'
                                'relationships/footer" Target="%s"/></Relationships>' % (rid, name))
            ids[name] = rid
        if "/word/%s" % name not in ct:
            ct = ct.replace("</Types>", '<Override ContentType="application/vnd.openxmlformats-officedocument.'
                            'wordprocessingml.footer+xml" PartName="/word/%s"/></Types>' % name)
    for name in ("footer1.xml", "footer2.xml"):
        m = re.search(r'<Relationship Id="(rId\d+)"[^>]*Target="%s"' % re.escape(name), rels)
        ids[name] = m.group(1)
    data["word/_rels/document.xml.rels"] = rels.encode("utf-8")
    data["[Content_Types].xml"] = ct.encode("utf-8")
    return ids


# --------------------------------------------------------------------------- sections
def build_sectpr(key, base, fids):
    hdef = base["hdr_default"]
    hfirst = base["hdr_first"]
    if key == "front":
        refs = ('<w:headerReference r:id="%s" w:type="default"/><w:headerReference r:id="%s" w:type="first"/>'
                '<w:footerReference r:id="%s" w:type="default"/><w:footerReference r:id="%s" w:type="first"/>'
                % (hdef, hfirst, fids["footer1.xml"], fids["footer2.xml"]))
        num, tail = '<w:pgNumType w:fmt="lowerRoman" w:start="0"/>', '<w:titlePg w:val="1"/>'
    else:
        if key == "toc":
            foot = fids["footer3.xml"]
        elif key == "ref":
            foot = fids["footer4.xml"]
        elif key == "glo":
            foot = fids["footer5.xml"]
        elif key == "app":
            foot = fids["footer6.xml"]
        else:
            foot = fids["footer1.xml"]
        refs = ('<w:headerReference r:id="%s" w:type="default"/><w:footerReference r:id="%s" w:type="default"/>'
                % (hdef, foot))
        tail = ""
        if key in ("toc", "lists"):
            num = '<w:pgNumType w:fmt="lowerRoman"/>'
        elif key.startswith("ch"):
            num = '<w:pgNumType w:fmt="decimal" w:start="1" w:chapStyle="1" w:chapSep="hyphen"/>'
        else:
            num = '<w:pgNumType w:fmt="decimal" w:start="1"/>'
    return ("<w:sectPr>%s<w:type w:val=\"nextPage\"/>%s%s%s%s</w:sectPr>" % (refs, base["pgsz"], base["pgmar"], num,
                                                                             tail))


def base_from_final(final_sect, doc):
    def rid(kind, typ):
        m = re.search(r'<w:%sReference r:id="(rId\d+)" w:type="%s"/>' % (kind, typ), doc)
        return m.group(1) if m else None

    pgsz = re.search(r"<w:pgSz[^>]*/>", final_sect).group(0)
    pgmar = re.search(r"<w:pgMar[^>]*/>", final_sect).group(0)
    if "w:gutter" not in pgmar:  # required by the schema; 0 is what Word assumes when it is missing
        pgmar = pgmar[:-2] + ' w:gutter="0"/>'
    hdef = rid("header", "default")
    hfirst = rid("header", "first")
    assert hdef and hfirst, "header references not found in the final sectPr"
    return {"pgsz": pgsz, "pgmar": pgmar, "hdr_default": hdef, "hdr_first": hfirst}


def find_sections(items):
    """Return {key: first item index} for the twelve sections, by their Heading 1 paragraphs."""
    starts = {"front": 0}
    chapters = []
    for i, (kind, x) in enumerate(items):
        if kind != "p" or h_level(x) != 1:
            continue
        t = para_text(x).strip()
        u = t.upper()
        if u == "TABLE OF CONTENTS":
            starts["toc"] = i
        elif u == "LIST OF FIGURES":
            starts["lists"] = i
        elif u == "REFERENCES":
            starts["ref"] = i
        elif u == "GLOSSARY OF TERMS":
            starts["glo"] = i
        elif u == "APPENDICES":
            starts["app"] = i
        elif CH_RE.match(t) or numpr_id(x) == CHAPTER_NUMID[0]:
            chapters.append(i)
    assert len(chapters) == 6, "expected 6 chapter headings, found %d" % len(chapters)
    for k, i in enumerate(chapters, 1):
        starts["ch%d" % k] = i
    missing = [k for k in SECTION_ORDER if k not in starts]
    assert not missing, "section anchors not found: %s" % missing
    idx = [starts[k] for k in SECTION_ORDER]
    assert idx == sorted(idx) and len(set(idx)) == 12, "section anchors out of order"
    return starts


CHAPTER_NUMID = [None]


def section_of(starts, i):
    key = "front"
    for k in SECTION_ORDER:
        if starts[k] <= i:
            key = k
    return key


# --------------------------------------------------------------------------- bookmarks
def max_bookmark_id(doc_parts):
    ids = [0]
    for s in doc_parts:
        ids += [int(x) for x in re.findall(r'<w:bookmarkStart [^>]*w:id="(\d+)"', s)]
    return max(ids)


def first_bookmark(pxml):
    m = re.search(r'<w:bookmarkStart [^>]*w:name="([^"]+)"', pxml)
    return m.group(1) if m else None


def add_bookmark(pxml, name, bid):
    m = PPR_AT_START.match(pxml)
    bm = '<w:bookmarkStart w:id="%d" w:name="%s"/><w:bookmarkEnd w:id="%d"/>' % (bid, name, bid)
    return pxml[:m.end()] + bm + pxml[m.end():]


# --------------------------------------------------------------------------- legacy TOC
def parse_toc_entries(sdt_xml):
    out = []
    for p in re.findall(r"<w:p(?:\s[^>]*)?>.*?</w:p>", sdt_xml, re.S):
        a = re.search(r'w:anchor="([^"]*)"', p)
        if not a:
            continue
        ind = re.search(r'<w:ind w:left="(\d+)"', p)
        tab = p.find("<w:tab/>")
        if tab < 0:
            continue
        before = "".join(unesc(t) for t in re.findall(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>", p[:tab]))
        after = "".join(unesc(t) for t in re.findall(r"<w:t(?:\s[^>]*)?>([^<]*)</w:t>", p[tab:]))
        pm = re.search(r"<w:pStyle w:val=\"TOC(\d)\"", p)
        level = int(pm.group(1)) if pm else (int(ind.group(1)) // 360 + 1 if ind else 1)
        out.append({"anchor": a.group(1), "text": before, "label": after.strip(), "level": level})
    return out


def parse_list_entries(items):
    """Cached entries of the regenerated lists: anchor -> label (PAGEREF result)."""
    out = {}
    for kind, x in items:
        if kind != "p":
            continue
        m = re.search(r'PAGEREF (\S+) \\h', x)
        if m:
            res = re.search(r'w:fldCharType="separate"/></w:r><w:r>(?:<w:rPr>.*?</w:rPr>)?<w:t[^>]*>([^<]*)</w:t>', x)
            if res:
                out[m.group(1)] = unesc(res.group(1))
    return out


# --------------------------------------------------------------------------- TOC / lists xml
RPR_H1 = (TNR + '<w:b w:val="1"/><w:bCs w:val="1"/><w:i w:val="0"/><w:iCs w:val="0"/><w:smallCaps w:val="0"/>'
          '<w:strike w:val="0"/><w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:u w:val="none"/>'
          '<w:shd w:fill="auto" w:val="clear"/><w:vertAlign w:val="baseline"/>')
RPR_N = (TNR + '<w:i w:val="0"/><w:iCs w:val="0"/><w:smallCaps w:val="0"/><w:strike w:val="0"/>'
         '<w:color w:val="000000"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:u w:val="none"/>'
         '<w:shd w:fill="auto" w:val="clear"/><w:vertAlign w:val="baseline"/>')


def toc_paragraph(level, text, anchor, label, first=False, last=False):
    rpr = RPR_H1 if level == 1 else RPR_N
    ind = "" if level == 1 else '<w:ind w:left="%d" w:firstLine="0"/>' % (360 * (level - 1))
    ppr = ('<w:pPr><w:pStyle w:val="TOC%d"/><w:widowControl w:val="0"/><w:tabs><w:tab w:val="right" '
           'w:leader="dot" w:pos="%d"/></w:tabs><w:spacing w:before="60" w:line="240" w:lineRule="auto"/>%s'
           '<w:rPr>%s</w:rPr></w:pPr>' % (level, TAB_POS, ind, rpr))
    lead = ""
    if first:
        lead = ('<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/><w:instrText xml:space="preserve">%s'
                '</w:instrText><w:fldChar w:fldCharType="separate"/></w:r>' % TOC_INSTR)
    trail = '<w:r><w:fldChar w:fldCharType="end"/></w:r>' if last else ""
    return ('<w:p>%s%s<w:hyperlink w:anchor="%s"><w:r><w:rPr>%s<w:rtl w:val="0"/></w:rPr><w:t xml:space="preserve">%s'
            '</w:t><w:tab/><w:t xml:space="preserve">%s</w:t></w:r></w:hyperlink>%s</w:p>'
            % (ppr, lead, anchor, rpr, esc(text), esc(label), trail))


def list_paragraph(text, anchor, label):
    rpr = TNR + '<w:sz w:val="24"/><w:szCs w:val="24"/>'
    ppr = ('<w:pPr><w:pStyle w:val="TableofFigures"/><w:widowControl w:val="0"/><w:tabs><w:tab w:val="right" '
           'w:leader="dot" w:pos="%d"/></w:tabs><w:spacing w:before="60" w:line="240" w:lineRule="auto"/>'
           '<w:rPr>%s</w:rPr></w:pPr>' % (TAB_POS, rpr))
    r = lambda inner: '<w:r><w:rPr>%s</w:rPr>%s</w:r>' % (rpr, inner)
    return ('<w:p>%s<w:hyperlink w:anchor="%s" w:history="1">%s%s%s%s%s%s%s</w:hyperlink></w:p>'
            % (ppr, anchor, r('<w:t xml:space="preserve">%s</w:t>' % esc(text)), r('<w:tab/>'),
               r('<w:fldChar w:fldCharType="begin"/>'),
               r('<w:instrText xml:space="preserve"> PAGEREF %s \\h </w:instrText>' % anchor),
               r('<w:fldChar w:fldCharType="separate"/>'), r('<w:t>%s</w:t>' % esc(label)),
               r('<w:fldChar w:fldCharType="end"/>')))


# --------------------------------------------------------------------------- main transformation
def transform(src, dst, labels_override=None, report=None):
    infos, data = read_pkg(src)
    labels_override = labels_override or {}
    rep = report if report is not None else {}

    # ---- numbering, styles, settings, footers -------------------------------------
    numbering, numid = ensure_numbering(data["word/numbering.xml"].decode("utf-8"))
    CHAPTER_NUMID[0] = numid
    data["word/numbering.xml"] = numbering.encode("utf-8")
    data["word/styles.xml"] = ensure_styles(data["word/styles.xml"].decode("utf-8"), numid).encode("utf-8")
    data["word/settings.xml"] = ensure_settings(data["word/settings.xml"].decode("utf-8")).encode("utf-8")
    fids = ensure_footers(data)

    doc = data["word/document.xml"].decode("utf-8")
    head, items, final_sect, tail = split_body(doc)
    base = base_from_final(final_sect, doc)
    rep["items_in"] = len(items)

    # ---- wording fixes ---------------------------------------------------------------
    rep["edits"] = []
    for old, new, expect, exact in EDITS:
        done = present = 0
        for it in items:
            if it[0] == "sdt":
                continue
            it[1], d, p = edit_item(it[1], old, new, exact)
            done += d
            present += p
        status = "applied" if done else ("already applied" if present >= expect else "NOT FOUND")
        if done and done != expect:
            status = "applied x%d (expected %d)" % (done, expect)
        rep["edits"].append({"old": old[:70], "status": status})
        if status == "NOT FOUND" or (done and done != expect):
            raise SystemExit("edit problem: %s -> %s" % (old[:70], status))
    rep["inserts"] = []
    for prefix, lead, body in INSERTS:
        texts = [para_text(x).strip() if k == "p" else "" for k, x in items]
        if any(t.startswith(lead.strip()) for t in texts):
            rep["inserts"].append({"after": prefix[:50], "status": "already present"})
            continue
        hits = [i for i, t in enumerate(texts) if t.startswith(prefix)]
        assert len(hits) == 1, "insert anchor not unique/found: " + prefix
        anchor = items[hits[0]][1]
        ppr = PPR_AT_START.match(anchor)
        ppr_xml = ppr.group(0)[len(ppr.group(1)):]
        ppr_xml = re.sub(r"<w:sectPr.*?</w:sectPr>", "", ppr_xml, flags=re.S)
        runs = re.findall(r"<w:r(?:\s[^>]*)?>.*?</w:r>", anchor, re.S)
        rpr = ""
        for r in runs:
            if "<w:t" in r:
                m = re.search(r"<w:rPr>.*?</w:rPr>", r, re.S)
                rpr = m.group(0) if m else ""
                break
        rpr = re.sub(r"<w:rtl [^>]*/>", "", rpr)
        rpr_plain = rpr if rpr else "<w:rPr></w:rPr>"
        bold_rpr = re.sub(r"(<w:rFonts [^>]*/>)", r'\1<w:b w:val="1"/><w:bCs w:val="1"/>', rpr_plain, count=1) \
            if "<w:rFonts" in rpr_plain else rpr_plain.replace("<w:rPr>", '<w:rPr><w:b w:val="1"/><w:bCs w:val="1"/>', 1)
        newp = ("<w:p>%s<w:r>%s<w:t xml:space=\"preserve\">%s</w:t></w:r><w:r>%s<w:t xml:space=\"preserve\">%s</w:t>"
                "</w:r></w:p>" % (ppr_xml, bold_rpr, esc(lead), rpr_plain, esc(body)))
        items.insert(hits[0] + 1, ["p", newp])
        rep["inserts"].append({"after": prefix[:50], "status": "inserted"})

    # ---- heading numbering: chapters numbered by the list, every other Heading 1 numId 0 ----
    chap = 0
    chapter_titles = {}
    for i, it in enumerate(items):
        kind, x = it
        if kind != "p" or h_level(x) != 1:
            continue
        t = para_text(x)
        m = CH_RE.match(t)
        is_chapter = bool(m) or numpr_id(x) == numid
        if is_chapter:
            chap += 1
            if m:
                assert int(m.group(1)) == chap, "chapter number mismatch at %r" % t
                x = replace_in_paragraph(x, m.group(0), "", at=0)
            x = set_ppr_child(x, "numPr", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="%d"/></w:numPr>' % numid)
        else:
            x = set_ppr_child(x, "numPr", '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="0"/></w:numPr>')
        it[1] = x
    assert chap == 6, "expected 6 chapters, found %d" % chap
    starts = find_sections(items)

    # ---- page-break guards on the headings that start a new section ---------------------
    for i, (kind, x) in enumerate(items):
        if kind == "p" and h_level(x) == 1 and para_text(x).strip().upper() in ("ABSTRACT", "LIST OF TABLES"):
            items[i][1] = set_ppr_child(x, "pageBreakBefore", "<w:pageBreakBefore/>")

    # ---- entries: headings 1-3 and Figure/Table captions ---------------------------------
    all_xml = [head] + [x for _k, x in items] + [final_sect]
    next_bm = max_bookmark_id(all_xml) + 1
    bm_counter = 0
    for s in all_xml:
        for n in re.findall(r'w:name="_PropBm(\d+)"', s):
            bm_counter = max(bm_counter, int(n))

    targets = []  # in document order
    ch_no = 0
    for i, (kind, x) in enumerate(items):
        if kind != "p":
            continue
        lv = h_level(x)
        if lv == 0:
            continue
        t = re.sub(r"\s+", " ", para_text(x)).strip()
        if not t:
            continue
        cap = None
        if lv == 5:
            if re.match(r"(Figure|Table)\s", t):
                cap = "lof" if t.startswith("Figure") else "lot"
            else:
                continue
        elif lv > 3:
            continue
        if lv == 1 and numpr_id(x) == numid:
            ch_no += 1
            t = "CHAPTER %d – %s" % (ch_no, t)
        anchor = first_bookmark(x)
        if not anchor:
            bm_counter += 1
            anchor = "_PropBm%04d" % bm_counter
            items[i][1] = add_bookmark(x, anchor, next_bm)
            next_bm += 1
        targets.append({"idx": i, "level": lv, "text": t, "anchor": anchor, "list": cap, "sec": section_of(starts, i)})

    # ---- cached labels ---------------------------------------------------------------------
    toc_i = next(i for i, (k, x) in enumerate(items) if k == "sdt")
    sdt = items[toc_i][1]
    legacy = parse_toc_entries(sdt)
    is_legacy = bool(legacy) and all(re.fullmatch(r"\d+", e["label"]) for e in legacy) and "TOC1" not in sdt
    cached = {}
    if not is_legacy:
        for e in legacy:
            cached[e["anchor"]] = e["label"]
        cached.update(parse_list_entries(items))
    page_of = {}
    if is_legacy:
        cursor = 0
        nl = [(e["level"], norm(e["text"]), int(e["label"])) for e in legacy]
        last_page = 1
        for t in targets:
            want = (t["level"], norm(t["text"]))
            found = None
            for q in range(cursor, len(nl)):
                if (nl[q][0], nl[q][1]) == want:
                    found = q
                    break
            if found is None:
                page_of[t["anchor"]] = last_page
            else:
                cursor = found + 1
                last_page = nl[found][2]
                page_of[t["anchor"]] = last_page
        rep["legacy_unmatched"] = sum(1 for t in targets if t["anchor"] not in page_of)
    base_page = {}
    for t in targets:
        if t["level"] == 1 and t["sec"] not in base_page and t["anchor"] in page_of:
            base_page[t["sec"]] = page_of[t["anchor"]]

    def estimate(t, prev_label):
        sec = t["sec"]
        if t["anchor"] in cached:
            return cached[t["anchor"]]
        if is_legacy and t["anchor"] in page_of and sec in base_page:
            n = page_of[t["anchor"]] - base_page[sec] + 1
            if sec.startswith("ch"):
                return "%s-%d" % (sec[2:], n)
            if sec in PREFIX:
                return "%s%d" % (PREFIX[sec], n)
        if prev_label and prev_label[1] == sec:
            return prev_label[0]
        if sec.startswith("ch"):
            return "%s-1" % sec[2:]
        if sec in PREFIX:
            return PREFIX[sec] + "1"
        return "i"

    body_labels = {}
    prev = None
    for t in targets:
        if t["anchor"] in labels_override:
            lab = labels_override[t["anchor"]]
        else:
            lab = estimate(t, prev)
        t["label"] = lab
        prev = (lab, t["sec"])

    # front matter roman labels (estimates; overridden by measured labels when supplied)
    toc_targets = [t for t in targets if t["list"] is None]
    lof = [t for t in targets if t["list"] == "lof"]
    lot = [t for t in targets if t["list"] == "lot"]

    def lines(text, per_line):
        return 1 + (len(text) - 1) // per_line

    toc_lines = sum(lines("x" * (len(t["text"]) + 3 * (t["level"] - 1) + 8), 86) for t in toc_targets)
    toc_pages = max(1, math.ceil(toc_lines / 36))
    lof_pages = max(1, math.ceil((1 + sum(lines(t["text"] + "x" * 8, 72) for t in lof)) / 33))
    est_front = {"ABSTRACT": "i", "TABLE OF CONTENTS": "ii", "LIST OF FIGURES": roman(2 + toc_pages),
                 "LIST OF TABLES": roman(2 + toc_pages + lof_pages)}
    for t in targets:
        if t["sec"] in ("front", "toc", "lists") and t["level"] == 1 and t["anchor"] not in labels_override:
            k = t["text"].strip().upper()
            if k in est_front:
                t["label"] = est_front[k]
    # keep non-H1 front matter headings (none today) on the abstract label
    rep["toc_entries"] = len(toc_targets)
    rep["lof_entries"] = len(lof)
    rep["lot_entries"] = len(lot)
    rep["est_front"] = est_front if not labels_override else "measured labels supplied"

    # ---- rebuild the TOC field (inside the existing w:sdt) -------------------------------------
    paras = []
    for k, t in enumerate(toc_targets):
        paras.append(toc_paragraph(t["level"], t["text"], t["anchor"], t["label"], first=(k == 0),
                                   last=(k == len(toc_targets) - 1)))
    m = re.search(r"(<w:sdtContent>).*(</w:sdtContent>)", sdt, re.S)
    items[toc_i][1] = sdt[:m.start()] + m.group(1) + "".join(paras) + m.group(2) + sdt[m.end():]

    # ---- rebuild LIST OF FIGURES / LIST OF TABLES bodies ----------------------------------------
    def region(head_text, stop_text):
        a = next(i for i, (k, x) in enumerate(items) if k == "p" and h_level(x) == 1 and
                 para_text(x).strip().upper() == head_text)
        b = next(i for i, (k, x) in enumerate(items) if i > a and k == "p" and h_level(x) == 1 and
                 (para_text(x).strip().upper() == stop_text or
                  (stop_text == "CHAPTER" and numpr_id(x) == numid)))
        return a, b

    spacer = ('<w:p><w:pPr><w:rPr>%s</w:rPr></w:pPr></w:p>' % TNR)
    a, b = region("LIST OF FIGURES", "LIST OF TABLES")
    items[a + 1:b] = [["p", spacer]] + [["p", list_paragraph(t["text"], t["anchor"], t["label"])] for t in lof]
    a, b = region("LIST OF TABLES", "CHAPTER")
    # everything between LIST OF TABLES and the last paragraph of the section (the section-end paragraph) is replaced;
    # the section-end paragraph is the item right before the chapter 1 heading
    items[a + 1:b - 1] = [["p", spacer]] + [["p", list_paragraph(t["text"], t["anchor"], t["label"])] for t in lot]

    # ---- sections ---------------------------------------------------------------------------------
    starts = find_sections(items)
    for kind_i, (kind, x) in enumerate(items):  # drop section properties left by an earlier run
        if kind == "p" and "<w:sectPr" in x:
            items[kind_i][1] = set_ppr_child(x, "sectPr", None)
    order = SECTION_ORDER
    # insert from the back so indexes stay valid
    for n in range(len(order) - 2, -1, -1):
        key, nxt = order[n], order[n + 1]
        end_i = starts[nxt] - 1
        if items[end_i][0] != "p":
            items.insert(starts[nxt], ["p", "<w:p><w:pPr></w:pPr></w:p>"])
            end_i = starts[nxt]
            starts = find_sections(items)
        x = items[end_i][1]
        x = re.sub(r'<w:r(?:\s[^>]*)?><w:br w:type="page"/></w:r>', "", x)
        x = set_ppr_child(x, "sectPr", build_sectpr(key, base, fids))
        items[end_i][1] = x
    new_final = build_sectpr("app", base, fids)

    # ---- assemble -----------------------------------------------------------------------------------
    new_doc = head + "".join(x for _k, x in items) + new_final + tail
    data["word/document.xml"] = new_doc.encode("utf-8")
    verify(data)
    write_pkg(dst, infos, data)
    rep["sections"] = new_doc.count("<w:sectPr")
    rep["targets"] = [{"anchor": t["anchor"], "level": t["level"], "text": t["text"], "list": t["list"],
                       "sec": t["sec"], "label": t["label"]} for t in targets]
    return rep


def verify(data):
    for name, blob in data.items():
        if name.endswith(".xml") or name.endswith(".rels"):
            try:
                ET.fromstring(blob)
            except ET.ParseError as e:
                raise SystemExit("XML part %s is not well formed: %s" % (name, e))
    doc = data["word/document.xml"].decode("utf-8")
    assert doc.count("<w:sectPr") == 12, "expected 12 sections, got %d" % doc.count("<w:sectPr")
    ids = re.findall(r'<w:bookmarkStart [^>]*w:id="(\d+)"', doc)
    assert len(ids) == len(set(ids)), "duplicate bookmark ids"
    names = re.findall(r'<w:bookmarkStart [^>]*w:name="([^"]+)"', doc)
    assert len(names) == len(set(names)), "duplicate bookmark names"
    for a in re.findall(r'w:anchor="([^"]*)"', doc):
        assert a in names, "hyperlink anchor without bookmark: %r" % a


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--labels", help="JSON {anchor: label} with measured page labels (see measure_proposal_pages.py)")
    ap.add_argument("--report", help="write a JSON report here")
    a = ap.parse_args(argv)
    labels = json.loads(Path(a.labels).read_text(encoding="utf-8")) if a.labels else None
    rep = transform(a.input, a.output, labels)
    summary = {k: v for k, v in rep.items() if k != "targets"}
    print(json.dumps(summary, indent=1, ensure_ascii=False))
    if a.report:
        Path(a.report).write_text(json.dumps(rep, indent=1, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main()
