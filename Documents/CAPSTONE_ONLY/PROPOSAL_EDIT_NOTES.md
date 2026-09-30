# Proposal document edit notes

File edited: `Final Proposal Document - CAP-IT1.docx` (same folder).
Made by script, not by hand: `scripts/docs/paginate_proposal.py` (see "Re-running" below).
Backup of the untouched original: `E:/Temp/claude/proposal-backup/original.docx` (outside the repo; the
original is also in git history).

Panel requirements handled:
- "Fix the pagination format (TOC - no page number, for the main sections use the format Chapter no-page no,
  e.g. 1-1)".
- "Fix table of contents (follow the pagination format, remove tables and figures since these are already in a
  separate section)".

## 1. What was changed

### Sections (12, all "next page"; size, margins and portrait orientation copied from the original)

| # | Section | Page number shown | Footer part |
|---|---------|-------------------|-------------|
| 1 | Title page + Abstract | title page none (it is page 0); abstract = `i` | footer2 (empty, first page) / footer1 (PAGE) |
| 2 | Table of Contents | **none** | footer3 (new, empty, no PAGE field) |
| 3 | List of Figures + List of Tables | lower-case roman, continues (`x`, `xi` ...) | footer1 |
| 4-9 | Chapters 1-6 | `chapter-page`: 1-1, 1-2 ... 2-1 ... 6-1 | footer1 |
| 10 | References | `R-1`, `R-2` ... | footer4 (new) |
| 11 | Glossary of Terms + List of Acronyms | `G-1` ... | footer5 (new) |
| 12 | Appendices | `A-1` ... | footer6 (new) |

The original had ONE section (`titlePg`, page numbering starting at 0, plain PAGE footer) and no landscape
pages; `grep landscape` finds none, so every new `w:sectPr` is portrait Letter with 1-inch margins
(`w:gutter="0"` added, which the schema requires and Word assumes anyway). The old hand-made page-break
runs at the end of each section were removed (a section break already starts a new page); the ABSTRACT and
LIST OF TABLES headings got `pageBreakBefore` so they still start on a new page inside their section.

### How the chapter-page numbers work (Word-native)
1. `numbering.xml` has a new list `ProposalChapterHeading` (abstractNumId 14 / numId 14; the existing ones
   were 1-13, no collision). Level 0 is linked to the Heading 1 style and prints `CHAPTER %1 –`.
2. The six chapter headings lost their typed prefix ("Chapter 1 – ", "CHAPTER 4 – " ...) and get it from the
   list, so the visible text is unchanged, and the casing is now one form: `CHAPTER n – Title`
   (chapters 1-3 used "Chapter", 4-6 used "CHAPTER").
3. Every other Heading 1 (Abstract, Table of Contents, the lists, References, Glossary, Acronyms, Appendices,
   and the three empty Heading 1 "page-break carrier" paragraphs) carries `numPr numId=0` so it is NOT
   numbered. Heading 2/3 text such as "1.1 Introduction" is literal and not in the list, so nothing is
   double-numbered.
4. Each chapter section has `<w:pgNumType w:fmt="decimal" w:start="1" w:chapStyle="1" w:chapSep="hyphen"/>`:
   the page number restarts at 1 and Word prints the Heading 1 number, a hyphen and the page in the footer
   (plain PAGE field) AND in the table of contents.
5. References / Glossary / Appendices have no numbered Heading 1, so they do not use `chapStyle`: their own
   footer has a literal `R-` / `G-` / `A-` run plus a PAGE field. Reason for the choice: one letter, same
   hyphen as the chapters, sorts naturally after "6-n", is the usual thesis convention. Limitation: a TOC
   field cannot add a literal prefix, so once Word recalculates the TOC, the entries for REFERENCES,
   GLOSSARY, ACRONYMS, APPENDICES and all Appendix A-Z headings and appendix figures show the bare page
   number (`1`, `5` ...) instead of `R-1`, `A-5`. The cached entries I wrote DO carry the prefix. If the
   bare numbers bother the panel, the simple fix is to number those headings with their own list (more
   work) or to accept it: the footers on those pages say `A-5`.

### Table of contents
- Field instruction now `TOC \o "1-3" \h \z \u` (headings 1-3 only; Heading 4/5 and all Table/Figure captions
  are gone: 479 old entries -> 286). The field is marked dirty (`w:dirty="true"`) and `w:updateFields` is set
  in `settings.xml`, so Word recalculates every field on open.
- The cached entries were regenerated (same look: TNR 11, bold level 1, indents 0/360/720, dot leader; I also
  added the `TOC 1-3` styles so a Word refresh keeps this look, and moved the right tab from 12000 twips,
  which is off the page, to 9350). Hyperlinks point to bookmarks; 239 headings/captions that had no
  bookmark (all of Chapters 4-6 and the appendices) got an invisible `_PropBm####` bookmark.
- LIST OF FIGURES and LIST OF TABLES were stale (chapter 1-3 only; Table 2 did not match the body) and had no
  page numbers. They are now regenerated from the captions in the body (Heading 5 paragraphs starting
  "Figure " / "Table "): 98 figures, 43 tables, one line each with a dot leader and a `PAGEREF` field, so
  Word fills in the right `chapter-page` label when fields are updated.

### Wording fixes (before -> after; text edited in place, formatting kept)
1. Ch.1 Figure 1.10 description (was: "This figure shows withdrawal as a controlled exit process ... the
   withdrawal is confirmed.") -> subject-level withdrawal: active student withdraws from one or more enrolled
   subjects; allowed until the end of the second week from the start of classes (Handbook 2022-2023: 10% of the
   term's total due in week 1, 20% in week 2, full fees afterwards); student writes to the Dean, GS Staff
   forward, Dean approves or denies; if approved GS Staff tag only the selected subject(s) Withdrawn and export
   the record for the Registrar; student stays Active, other subjects unchanged.
2. Both milestone tables (Chapter 1 and its appendix copy): gate "Withdrawal Confirmed and Recorded" ->
   "Subject Withdrawal Confirmed and Recorded"; "Withdrawal status recorded; monitoring stops with an
   auditable exit reason category (if allowed)" -> "Withdrawal recorded by tagging only the selected
   subject(s) as Withdrawn, with an auditable record; the student stays Active, the other subjects are
   unchanged, and the record is exported for the Registrar".
3. Glossary: "Withdrawal – The formal process of leaving the graduate program." -> "... The formal process by
   which an active student withdraws from one or more enrolled subjects, without leaving the graduate program.
   It is allowed until the end of the second week ... the student remains Active."
4. Ch.4 section 4.2.5.7: the sentences saying Section 1.3.11/glossary "supersede" and that the divergence "is
   to be reconciled before the final defense" -> "Section 1.3.11, its milestone-table rows, and the glossary
   entry for Withdrawal have since been corrected to this subject-level definition, so Chapter 1 and this
   section now agree." (otherwise it would have described a contradiction that no longer exists).
5. Ch.1 Figure 1.11 (graduation): "If approved, the endorsed list is sent to the Registrar and the receipt is
   acknowledged." -> "If approved, the portal exports the endorsed list, and the Dean sends the exported file
   to the Registrar through the official external channel. The prototype records the export only; it does
   not claim that an email was sent or that the Registrar acknowledged receipt."
6. Ch.4 section 4.2.5.8: "Section 1.3.12 describes the endorsed list as being sent to the Registrar with
   receipt acknowledged. ... The account in this section is the one carried forward." -> "Section 1.3.12
   describes the same flow. ... the portal exports the endorsed list after the Dean approves it, and the
   conveyance is a file that the Dean sends through the official external channel ...".
7. Technology ("originally proposed" wording; the old design is kept, the divergence is stated):
   - Ch.1 module text (NotebookLM), Figure 4 description, 1.6.2 architecture paragraphs (Node.js/Express.js,
     Prisma), RAG paragraph (NotebookLM): each now says "as originally proposed" / "in the original proposal".
   - Ch.3 3.2.5: intro ("The originally proposed technology stack ...", "As originally proposed, the platform
     follows ..."), RAG paragraph ("In the original proposal, the RAG pipeline uses LangChain.js ..."), caption
     "Table 9. IT tools to be used (as originally proposed)", 3.2.5.2 lead-in ("As originally proposed, the
     platform was to be implemented ..."), the JWT line, the NotebookLM sentences (two), the OpenAI price
     notes ("For the originally proposed OpenAI API ..."), and Appendix M's heading.
   - NEW paragraph in Ch.3 (after the RAG paragraph of 3.2.5), "Note on the technology actually used": what was
     proposed, what was built (Python 3 + Flask + SQLAlchemy; React + Vite + Tailwind CSS; server-side
     sessions; Google Gemini for generation and embeddings with a local keyword-retrieval fallback without an
     API key), and why. The reasons are my inference from `requirements.txt` and `app.py` (Python libraries for
     the Excel/PDF/scan processing, one process serving API and UI, one Gemini service for generation and
     embeddings, fallback when no key): **please confirm they match what the team would say.**
   - NEW paragraph in Ch.5 (5.12, after the policy-assistant paragraph), "Relation to the original proposal".
   - "Gemini" now appears in the document (was zero times).

Deliberately NOT touched (a later helper does these, then re-runs the script): route/table counts ("119
routes", "35 tables"; the code now also has the `business_rule` and `business_rule_revision` tables and more
routes), screenshots. The Business Rules section has since been added (section 5 below).

### Still contradictory - for the later helper
- RESOLVED in the business-rules revision (section 5): the seven-day withdrawal window ("before classes begin or
  during the first seven calendar days", "penalty-free") in Ch.4 section 4.2.5.7, Ch.5 section 5.3.12 and the
  screen text of 5.10.17, and the leave-of-absence rule text in 5.3.10 and the LOA screen paragraph in 5.10 (number
  of prior leaves, "term that has not already begun"). They now say what the code does (window to the end of the
  second week, fee tiers shown as information, up to two semesters per request and four in total).
- The images Figure 1.10 (withdrawal BPMN), Figure 4 and Figure 6 / Appendix P are pictures; I could not edit
  them. Figure 1.10 may still show an "exit" end event; Figures 4 and 6 show the originally proposed stack
  (the text now says so).
- Table 9 / Appendix M cell contents (Node.js, Prisma, NotebookLM ...) are unchanged; only their captions say
  "as originally proposed". Chapter 2 literature sentences that list NotebookLM/OpenAI/LangChain as generic
  examples of RAG tools were left alone (they are not claims about this system).
- Noticed, not changed: two different captions are both numbered "Table 5."; the body's Table 2 differs from the
  old list of tables; figure numbering mixes "Figure 1." with "Figure 1.1".
- Noticed in the business-rules revision, NOT changed (Chapter 5 and the appendices were written before the rule
  changes and may lag the code in places): 5.3.1 says the system provides "no manual student creation" (the
  portal can now add one student by hand, staff or Academic Coordinator); Ch.1 scope text, Table 1 and the module
  tables (Appendix K/I copies) still speak of "residency pause" tracking, although the clock is never paused now;
  5.3.6 and 5.3.7 describe panel matching and the lead time in general terms that predate the 14-day title rule.
  Section 5.14 and Appendix AA are correct as of the catalog and the manual; the older module paragraphs need one
  careful pass against the code.

## 2. What the owner must do once in Word
1. Open the file. Word asks "This document contains fields that may refer to other files. Update the fields in
   this document?" - click **Yes**. (This is `updateFields`; it is deliberate.)
2. Go to the Table of Contents. It should list only headings, with `1-1`-style numbers for the chapters and no
   number on the TOC pages themselves. If it still looks stale: click in it, press F9, choose "Update entire
   table". Do the same for the List of Figures and List of Tables (F9 on each).
3. Scroll through: check the footers - title page blank, abstract `i`, TOC pages blank, lists `x ...`,
   chapters `1-1 ... 6-n`, References `R-n`, Glossary `G-n`, Appendices `A-n`.
4. Press Ctrl+A then F9 once more (updates every page reference), then **save** (Ctrl+S). After saving,
   Word writes its own cached values and the prompt stops appearing.
5. Not required, but worth a look: Ch.1 Figure 1.10 picture and the BPMN text for withdrawal.

If a chapter footer shows something other than `1-1` (for example the word "CHAPTER" or a doubled dash), tell
the next helper: the fallback is a literal chapter number in six per-chapter footers (TOC then shows bare
numbers for chapters too).

## 3. What was verified, and what was not

Verified (real output, this machine):
- `validate.py` (XSD) on the result with `--original`: "All validations PASSED!" (the original document by
  itself has two schema errors - missing `w:gutter` and a decimal `tblpY` - both pre-existing).
- Every XML part re-parsed; 12 `w:sectPr`; unique bookmark ids/names; every hyperlink anchor has a bookmark;
  content types and relationships for the four new footer parts present; 107 of 113 original parts are
  byte-identical (only document, styles, numbering, settings, rels and content types changed).
- Idempotent: running the script on its own output gives byte-identical parts.
- LibreOffice 371-page render (original renders as 366). From the PDF: page 1 no number; page 2 `i`;
  TOC pages 3-10 no number (real blank footers); lists `x`-`xiv`; chapters restart at 1 (71, 12, 67, 14, 53 and
  10 pages); References `R-1`..`R-9`; Glossary/Acronyms `G-1`..`G-11`; Appendices `A-1`..`A-109`. The numbered
  chapter headings render as "CHAPTER 1 – Project Background". Every heading and caption (427) was located in
  the PDF and its chapter-relative page written into the cached TOC/lists; a second render gave identical labels.
- LibreOffice cannot print the chapter number inside a page number, so it shows `1`, `2` ... in chapter
  footers (and `46` in the PAGEREF list entries). That part (`1-1`) relies on Word's `chapStyle` and is **not
  verified**.

Not verifiable without Word:
- The exact `1-1` footer text, and what Word writes for a numbered-heading TOC entry (the gap between
  "CHAPTER 1 –" and the title may be a tab instead of a space).
- Word's own pagination differs from LibreOffice's, so the cached numbers are a good estimate but will change
  when Word recalculates; the front matter length (TOC = 8 pages here) may differ.
- Word's behaviour when opening with `updateFields` (prompt wording), and dirty-field handling on very old Word.

## 4. Re-running
```
PY=E:/Github_Projects/CAPSTONE-USLS-MVP/.venv/Scripts/python.exe
# quick (estimated labels, no LibreOffice):
$PY scripts/docs/paginate_proposal.py "IN.docx" "OUT.docx"
# full (LibreOffice measures the pages, two passes, reports "labels stable"):
$PY scripts/docs/build_proposal.py "IN.docx" "OUT.docx"
```
Input may be the original or the already-paginated file (same result). Run it again after adding content
(screenshots, business rules, new counts); new headings/captions are picked up automatically, a new non-chapter
Heading 1 is automatically kept un-numbered, and the LibreOffice pass refreshes the cached page labels. The
wording fixes are the `EDITS` / `INSERTS` tables at the top of `paginate_proposal.py`; each is skipped when
already applied and the script stops with an error if an expected sentence disappeared (for example after
someone rewrote it).
`measure_proposal_pages.py` (PDF -> labels.json) and `build_proposal.py` (driver) are in the same folder.
The business-rules sections and Appendix AA are inserted by `add_business_rules_section.py`, which must run
BEFORE `build_proposal.py` (section 5).
The helper only needs `pymupdf` (in the project venv) and LibreOffice for the measuring pass.

## 5. Business rules section and Operations Manual appendix (added later)

Panel requirement: "Document Existing Business Rules/Policies and Proposed Business Rules/Policies (if any)" and
"Policies in the operations manual should be included".

### What was added (script `scripts/docs/add_business_rules_section.py`)
| Where | What | Tables |
|-------|------|--------|
| Chapter 4, new **4.5 Existing Business Rules and Policies** (after 4.4.4) | Intro, 4.5.1 Sources and Labels, 4.5.2 Existing Rules by Process (19 processes from admission to the Registrar handoff, lifecycle order, one Heading 4 and one table each). 190 rules from `operations_manual_rules.json`: 168 Official (Handbook page / Protocol section), 22 Practice (consultations, clearly labelled). A short answer to the panel's "can a student drop on Day 1" question sits above the withdrawal table. | Table 20.1 (labels) and Tables 20.2-20.20 |
| Chapter 5, new **5.14 Proposed Business Rules and Policies** (after 5.13.4) | Intro (register, enforced vs documented only, status, editing with a reason and history, Handbook alignment), 5.14.1 summary, 5.14.2 rules by process (12 register groups, 59 rules from `business_rules_catalog.py`: 36 enforced, 23 documented only with the reason, 7 "Needs review" = awaiting Graduate School validation), 5.14.3 the 40 further Proposed rules of the manual (no official source), 5.14.4 the 7 register values awaiting validation. | Tables 25.1-25.15 |
| New **Appendix AA. Graduate School Operations Manual (Draft for Validation)** (after Appendix Z) | Short description (contents, version 0.2, 230 rules, draft awaiting validation by the Dean and Associate Dean) and the file names in `Documents/CAPSTONE_ONLY`. The 91-page manual is NOT pasted in. | none |

Decisions and reasons:
- **Split, not one combined section.** The document already separates "The Existing System" (Ch.4) from "The
  Proposed System" (Ch.5), and the panel used the same two words. Existing rules therefore sit at the end of Ch.4
  and proposed rules at the end of Ch.5, each cross-referring to the other and to Appendix AA. Both are appended
  at the END of their chapter (4.5 and 5.14) so no existing section number, cross-reference or table number
  changes.
- **Table numbers 20.1-20.20 and 25.1-25.15.** The captions in Ch.4-6 are typed, sequential (16-33). Inserting
  new whole numbers would have forced renumbering Tables 21-33 and every "Table n" reference in the text. The
  document already uses decimal sub-numbers (3.1-3.9, 15.1-15.2), so the new tables follow the last table of the
  chapter (Table 20 and Table 25) with .1, .2 ... Captions are Heading 5 above the table, like every other
  caption, so `paginate_proposal.py` puts them in the List of Tables with page labels by itself (35 new lines).
- Per-process headings are Heading 4, so the table of contents (Heading 1-3) only gains 4.5, 4.5.1, 4.5.2, 5.14 and
  its four subsections, and Appendix AA.
- Table format copies the document's own tables (style `Table28`, black single borders, grey `d9d9d9` header
  row that repeats on each page, Times New Roman; 9 pt because the rule tables are wide; rows do not split
  across pages). The status/treatment cell is lightly shaded (Official green, Practice yellow, Enforced green,
  Documented only grey, Needs review yellow) and always also carries the word.
- Wording fixes (in `EDITS` of `paginate_proposal.py`, same mechanism as section 1): 4.2.5.7, 5.3.12 and 5.10.17
  (withdrawal), 5.3.10 and the LOA screen paragraph (leave of absence). Each says what the code now does.
- The figures in the section (59 / 36 / 23 / 7; 168 / 22 / 40; 44 open questions) are computed from the
  catalog, the JSON and `opsmanual/questions.py`, never typed.

### Operations Manual brought in line with the platform (draft v0.2, same revision)
The "How the platform supports this process" paragraph and the "Difference between the platform and the rule"
paragraph of all 19 process chapters were rewritten from the current code (`rule_value(...)` uses in `app.py` and
the workflows behind them), and every statement is either what the platform does or is marked as left to people.
Where the platform now follows the Handbook the text says so (withdrawal window and fee tiers, leave of up to
two semesters per request and four in total, leave counted in maximum residence, no pause of the residency clock,
academic-year count, project paper panel of three, 14-day lead time for the title defense, 20% absence gate for
a drop, first-week window for adding and changing subjects, load of 12 units). Rules that describe the platform
(ENR-13, WD-14, DRP-09, DRP-10, LOA-13, AWL-05, RES-11, CEX-13, TTL-11, TTL-12, ADV-17, ADV-18, PRP-13, SCH-09)
were reworded; all are Proposed, so the counts (168 / 22 / 40) did not change. Open questions OQ-01 to OQ-12,
OQ-14, OQ-16, OQ-17, OQ-20, OQ-23, OQ-28, OQ-38, OQ-42 and OQ-43 carry a "Platform now" line; OQ-01, OQ-09,
OQ-10 and OQ-38 also carry the ruling that the Handbook is in force. The questions stay open for the Graduate
School's confirmation. The change log has a v0.2 row. The manual (.docx, .md, .pdf, 91 pages) and
`operations_manual_rules.json` were regenerated.

### Re-running (idempotent)
```
PY=E:/Temp/claude/opsman-venv/Scripts/python.exe     # needs lxml; the manual builder also needs python-docx + PyMuPDF
# 1. only if the manual or the catalog changed: regenerate the manual and the rules JSON
OPSMAN_LO_PROFILE=file:///E:/Temp/claude/lo-profile-docs2 $PY scripts/docs/build_operations_manual.py --pdf
# 2. insert / replace the three blocks (markers BizRulesExisting_*, BizRulesProposed_*, BizRulesAppendix_*)
$PY scripts/docs/add_business_rules_section.py "IN.docx" "MID.docx"
# 3. recalculate TOC, List of Tables and page labels (LibreOffice measures the pages)
$PY scripts/docs/build_proposal.py "MID.docx" "OUT.docx" --profile file:///E:/Temp/claude/lo-profile-docs2
```
Step 2 removes its own blocks first, so running it on its own output gives the same document; steps 2+3 on the
delivered file give byte-identical `document.xml`, `styles.xml`, `numbering.xml` and `settings.xml`.
`build_proposal.py` still defaults to the profile `lo-profile-docs`; pass `--profile` when another session may be
using it.

### Verified (this machine)
- `validate.py --original` on the result: "All validations PASSED!" (paragraphs 7480 -> 9296).
- All XML parts re-parsed; 539 unique bookmark ids and names, every bookmark end matches, all 471 TOC /
  list-of-tables hyperlinks have a bookmark; 12 sections kept; 35 new tables, each with a repeating header row.
- LibreOffice render: 415 pages (371 before), 471/471 headings and captions located, second pass identical
  ("labels stable"). Looked at: first page of 4.5, Table 20.1, the withdrawal table (20.5), a page of CEX rules,
  the TOC page with 4.5 and 5.14, the List of Tables pages with Tables 20.x and 25.x, the first pages of 5.14,
  Tables 25.1, 25.5, 25.13-25.15, and the Appendix AA page and its TOC line (`A-110`).
- Not verifiable without Word: the same limits as in section 3 (chapter-page numbers such as `4-15` come from
  Word's `chapStyle`; LibreOffice shows `15`).
