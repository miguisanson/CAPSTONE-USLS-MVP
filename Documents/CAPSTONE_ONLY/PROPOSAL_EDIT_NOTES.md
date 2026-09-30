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
routes", "35 tables"), the Business Rules section, screenshots.

### Still contradictory - for the later helper
- The seven-day withdrawal window ("before classes begin or during the first seven calendar days",
  "penalty-free") is still stated in Ch.4 section 4.2.5.7, Ch.5 section 5.3.12 and section 5.10.17 (screen
  text). The new Ch.1 text says second week with the 10%/20% charge. Those three paragraphs describe the code;
  change them together with the withdrawal window in `app.py` (the handbook wins).
- The images Figure 1.10 (withdrawal BPMN), Figure 4 and Figure 6 / Appendix P are pictures; I could not edit
  them. Figure 1.10 may still show an "exit" end event; Figures 4 and 6 show the originally proposed stack
  (the text now says so).
- Table 9 / Appendix M cell contents (Node.js, Prisma, NotebookLM ...) are unchanged; only their captions say
  "as originally proposed". Chapter 2 literature sentences that list NotebookLM/OpenAI/LangChain as generic
  examples of RAG tools were left alone (they are not claims about this system).
- Noticed, not changed: two different captions are both numbered "Table 5."; the body's Table 2 differs from the
  old list of tables; figure numbering mixes "Figure 1." with "Figure 1.1".

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
The helper only needs `pymupdf` (in the project venv) and LibreOffice for the measuring pass.
