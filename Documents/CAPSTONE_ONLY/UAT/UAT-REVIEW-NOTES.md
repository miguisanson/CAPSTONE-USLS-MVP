# UAT instrument review notes

Draft reviewed: `[CAP-IT2] UAT Instrument Draft.docx` (Google Docs export).
Result: `[CAP-IT2] UAT Instrument - Revised.docx` (+ `.pdf`), 12 pages, US Letter.
Rebuild: `E:/Temp/claude/docs-venv/Scripts/python.exe scripts/docs/uat/build_uat_instrument.py`
(questions are in the `SECTIONS` list at the top of the script; sizes are the constants `BODY/TABLE/SMALL`).

Numbers in square brackets point to the reference list at the end.

## 1. What the draft looked like (measured with python-docx)

- Font: runs are `Proxima Nova` (a Google Docs font; Word substitutes it on a PC without it). Document default is Arial.
- Sizes: matrix text 9 pt (305 runs), section titles and labels 14 pt, intro 12 pt, main title 19 pt.
- Page: US Letter, side margins 0.55 in, top and bottom 0.5 in (too tight to print safely on most office printers).
- 7-column matrix: the rating scale text (1 to 5) exists only in the intro, not next to the rating rows.
- 61 questions in 10 sections, plus 6 process-validation questions.

Paper size: Letter. The draft, `CAP-2521-IT-CAP1DEF.docx`, `Final Proposal Document - CAP-IT1.docx`, `[CAP-IT1] Overall Document.docx` and the walkthrough are all Letter. Only the Operations Manual draft is A4. Letter keeps the form matching the team's own documents.

## 2. Formatting changes and why

| Change | Basis |
|---|---|
| One sans-serif family, Arial (installed on every Word and LibreOffice setup, so what the team prints is what was checked) | Plain-language form guides name Arial as a safe sans-serif choice [6][7]. The draft's own default was already Arial. |
| Narrative text 12 pt; matrix and table text 11 pt; helper lines (mainly-for, rating anchors, prompts) 10 pt; footer and the "N/A" label 9 pt | 12 pt for most forms, 10 pt the smallest acceptable when space is tight [6]; 12 pt body for a general audience [7]. The matrix uses 11 pt to keep the form at 12 pages. Setting `TABLE = 12` in the script gives strict 12 pt and adds about 1.5 pages. |
| Headings larger than body: title 20 pt, section bars 12 pt bold white on dark green, sub-heads 12 pt bold green. Same size for every section heading, more space above a heading than below | Headings at least 2 pt larger than body, same size for every section heading, more space above than below [6]; larger headings, numbered clear sections [8]. |
| Section bars are real Word Heading styles | Screen readers and the Word navigation pane can jump by section. |
| Header row shaded light green, repeats on every page; rows never split across pages; heading kept with its first rows | Keeps a printed multi-page matrix readable; sections with a clear heading and number [8]. |
| Tick boxes (a box for each answer) instead of "copy-paste the check mark" only; the on-screen instruction is kept in one line | Tick-box questions where possible, clearly linked to the answer [6][8]. |
| Section letters and item numbers (A1, A2, ..., P1, S1) | Each answer can be traced to one question when the team tallies results. Same idea as test-case identifiers in test documentation [5]. |
| Margins 0.8 in sides, 0.7 in top, 0.8 in bottom | Generous margins and white space [6]. |
| Footer: form name, "Evaluator initials", Page X of Y | Loose printed pages can be put back together. |
| Left-aligned text, no justified paragraphs | [7] |

## 3. Question changes (original item, problem, change, basis)

"Overall 1" means section 1 of the draft, question 1, and so on. New numbers are the revised form's IDs.

| Original | Problem | Change made | Basis |
|---|---|---|---|
| Identification: PROJECT CREATED (blank) | Empty field, no meaning for an evaluator | Replaced with VERSION TESTED: "Demonstration build with sample data only" | Test documentation records what was tested [5]. Also tells evaluators no real data is used. |
| (none) | No evaluator role or office, no date or session, no way to know if the person only watched | New Evaluator Information block: name, position or office, role tested (tick), how you took part (watched, used it, both), date and session. Printed name, position, signature and date repeated at the end. | UAT results only mean something if you know who tested what [5]; ISO 9241-11 defines usability for "specified users" and a "specified context of use" [2]. |
| Intro: "you will perform common tasks" | Some evaluators will only watch | "see or perform"; "Only judge what you saw or did"; "sample data" | Judge only what was experienced [2]. |
| Intro scale: "N/A" promised, but matrix has only Yes / No | Evaluators have no way to say "not shown / not my role" | Every row now has Yes, No and N/A; rating rows have N/A too | A "not applicable" option lets every respondent give a valid answer and reduces skipped items [10]. |
| Intro scale: ratings explained only in the intro; "How useful" rows used "Very Poor" words | Anchors not visible where the rating is made; wording mismatch (useful vs poor) | Each rating row prints its own anchors ("1 = Not useful, 3 = Acceptable, 5 = Very useful"). Generic scale kept in the How-to-answer box. | Label every scale point; 5 points suits a general audience [11][10]. |
| (none) | No guidance on which sections to answer | "Mainly for" line under each section; sections A, I, J for everyone | Shortens the form for each evaluator; avoids guessing answers (N/A instead). |
| Overall 1, 2 | Fine; kept (A1, A2). A2 lists six roles but is one idea ("are roles right") | Kept; A1 adds "from student handoff to graduation" | Question stays concrete [9]. |
| Overall 3 | "official university records" vague | A3: official = imported from AIMS; others = added in the portal | Matches the app's AIMS rule. |
| Overall 4 ("understandable and appropriate") | Double-barreled | A4 asks only "easy to understand". Whether statuses are correct is asked in P4. | Ask about one thing per question [9][10]. |
| Overall 5 | Fine | A5. New A6: who is the case waiting on | "Waiting for" is on every board in the demo. |
| Overall 6 | Fine | A7 (rating, anchors printed) | [11] |
| Records 1 | "importing and reconciling" unclear | B1: "importing ... and reviewing the result" | Plain wording [6]. |
| Records 2 ("clear and useful") | Double-barreled | B2 asks only "clearly" (usefulness is in B14) | [9] |
| Records 3 ("official imported data treated as read-only instead of being edited in the portal") | Out of date. Staff can now add and correct records in the Monitoring Sheet, with source, who, when and reason; AIMS values are never overwritten (AGENTS.md Rule 4). Also leading wording. | Replaced by B3 (manual add or correct appropriate?), B4 (is the provenance information enough?), B5 (AIMS values cannot be overwritten silently), B6 (no grades in the portal, completion comes from AIMS) | Question must describe what the system actually does; neutral, one idea each [9][10]. Security: integrity and accountability [1]. |
| Records 4, 5 | Fine | B7, B9. New B8: Dean approval route for the offering plan | Course Adjustments goes Coordinator, Dean, publish (demo Case 3). |
| Records 6 | Vague | B10 kept. New B11 (enrollment checks: offered, completed, add after first week, 12 units), B12 (documented exception), B13 (class-list import), B14 (usefulness compared with the Excel sheet used today) | Demo Case 4 and 5 had no questions. B14 gives a direct comparison with today's process [2]. |
| Standing 1 | Fine | C1. New C2: withdrawal window and 10% / 20% fee | Policy values the Graduate School must confirm (demo Case 6). |
| Standing 2 | Fine | C3 with the concrete rule (Dean-approved withdrawal vs Coordinator-recorded drop above 20% absences) | Demo Case 7 |
| Standing 3 | Fine | C4 | |
| Standing 4 (AWOL, return, readmission, residency in one) | Four processes in one question | C5 Readmission, C6 AWOL, Return from AWOL and residency | [9] |
| (none) | Registrar hand-off by downloaded file is a design decision | New C7: acceptable that staff download, e-mail and mark as sent | The portal has no Registrar login and sends no e-mail (IM31). |
| Standing 5 | Fine | C8 | |
| Research 1-3 | Fine | D1-D3 | |
| (none) | Reading the PDF to take the title is a main feature | New D4 | Demo Case 12 |
| Research 4 (documents, adviser signature, endorsement, ethics in one) | Four roles in one question | D5 (document verification) and D6 (signatures, endorsement, ethics clearance) | [9] |
| Research 5, 6, 7 | Fine | D7, D8 (now also "next stage unlocks only after the panel chair records a pass"), D9 (rating) | Demo Case 17 |
| Panel 1 | Faculty expertise in the demo is sample data, so the answer may be unfair | E1 plus a note under the section title | Context of use [2] |
| Panel 2 ("specialization, keywords, availability, match score") | Fine as one idea | E2. New E3: the 60 / 25 / 15 weighting | Scoring weights are a design choice the Graduate School should confirm. |
| Panel 3, 4, 5, 6 | Fine | E4, E5, E6, E8 (rating). New E7: composition rules and adviser exclusion match the Research Protocol | Demo Case 13 |
| Defense 1-3 | Fine | F1-F3 | |
| (none) | Hard stops, 14-day lead-time warning, calendars, Google Calendar have no questions | New F4, F5, F7, F8 | Demo Cases 14 and 15. F8 will often be N/A (not connected in the demo). |
| Defense 4 | Fine | F6 (reason is recorded) | |
| Defense 5 | Fine | F9. New F10: verdict only after the defense has started | Demo Case 16 |
| Defense 6 and 7 | Order reversed | F11 (verdicts) before F12 (failed defense). New F13: Final Defense score below 85 (thesis) or 90 (dissertation) cannot be a plain pass | Policy value to confirm with the Graduate School. |
| Defense 8 | Fine | F14 (rating) | |
| Practicum 1-3 | Fine | G1-G3. New G4: Coordinator verifies and sends report, Dean marks reviewed | Demo Case 18 (AD11) |
| Graduation 4-6 | Fine | G5, G6, G8. New G7: batch route Coordinator, Research Coordinator, staff, Dean, export | Demo Case 19 |
| Policy 1-3 | Fine | H1-H3 | |
| (none) | Business Rules register and Policy Documents library are best-feature items with no question | New H4, H5 | Demo Cases 23, 24 |
| Policy 4 | Fine | H6 (reports named: at risk, cohorts, overdue, defenses, graduation candidates). New H7: filters and Excel / PDF | Demo Case 20 |
| Policy 5 and 6 | Duplicate word for word, and double-barreled | H8 "easy to understand", H9 "relevant to decision-making" | [9][10] |
| (none) | "Not Yet Assessed" risk label is a decision the Graduate School owns | New H10 | Demo Case 20 |
| Policy 7 | Fine | H11 (rating) | |
| UI 1-5 | Fine | I1-I4, I7 (rating). New I5 (boards behave the same), I6 (reason and next step when an action is stopped) | Consistency across same-kind pages (IM24). I6 is "user error protection" in ISO 25010:2023 [1][13]. |
| Access 1 ("appear to") | Hedge word weakens the question | J1 | [9] |
| Access 2, 3, 5 | Fine | J2, J3, J6 | |
| Access 4 ("Did you encounter any incorrect status ... or error?") | Reversed: Yes = bad, every other row Yes = good. Easy to tick the wrong box. Also four ideas in one. | Split and reversed: J4 "Were statuses and information correct and complete?", J5 "Did the system work without unexpected results or errors?". Yes is always good in A to J. | Keep the direction of a scale consistent [10]; one idea per question [9]. |
| (none) | The portal sends no e-mail, so notifications only live in the bell, Messages and Panel Invitations | New J7 | IM31; walkthrough section 9 |
| Process validation 1-6 | Yes = problem, with no label; no N/A | Kept as P1-P6. Section now says "Yes means you found a problem" in bold and the answer column is titled "Problem found?". N/A added. New P7 (names and terms) and P8 ("Needs review" rules). | The reversed direction is deliberate here (a problem-finder), so it is isolated and labelled. Capturing each problem with a description follows incident-report practice [5]. |
| Acceptance | Fine | Kept three options. Added scope ("tested in this session, sample data"), "most important changes needed", and position / office. | A test completion report states what was covered and what was decided [5]. |
| (none) | No overall usability number | Optional one-page SUS | See section 5. |

Direction of scales: [11] suggests alternating positive and negative wording in long attitude batteries to catch people who tick the same answer all the way down. This form is a short yes/no check, not an attitude battery, and J4 showed the risk (people tick quickly). So: Yes is always good in A to J; the one reversed part (K) is on its own page with a label; SUS keeps its own mixed wording because it was validated that way [3].

## 4. How the form maps to ISO/IEC 25010:2023 and ISO 9241-11

ISO/IEC 25010:2023 has nine characteristics: functional suitability, performance efficiency, compatibility, interaction capability (called usability in 2011), reliability, security, maintainability, flexibility, safety [1][13]. A stakeholder UAT can only judge some of them.

| Form section | Quality characteristic judged |
|---|---|
| A to H (does it do the right things correctly) | Functional suitability: completeness, correctness, appropriateness |
| B4, B5, J1, J2 | Security: integrity, accountability (who did what and when) |
| I (and A7) | Interaction capability: operability, learnability, self-descriptiveness, user error protection (I6) |
| J3, J4, J5 | Reliability: faultlessness, fault tolerance |
| J6 | Performance efficiency |
| K | Functional suitability against the real process (validation) |
| SUS | ISO 9241-11 satisfaction (plus perceived effectiveness and efficiency) [2][3] |

Not asked because a UAT with office staff cannot judge them: compatibility, maintainability, flexibility (portability), safety.

ISO 9241-11:2018 defines usability as the extent to which specified users achieve specified goals with effectiveness, efficiency and satisfaction in a specified context of use [2]. That is why the form records role, how the evaluator took part, and sample-data context.

Philippine practice: a Philippine school-system study (Northern Mindanao, ISO/IEC 25010:2011, functional suitability, usability, reliability, five-point Likert, nine purposive respondents) is an example of the same approach [12]. A web search also found commercial capstone guides that recommend the same, but no CHED or USLS rule that requires ISO 25010. Check the school's thesis manual if the panel asks.

## 5. SUS page: why it is there, how to score it (for the team, not on the form)

Why: it is ten items, one page, validated, gives one number you can compare with the benchmark average of about 68 [3][4], and it covers ISO 9241-11 satisfaction, which the yes/no rows do not. It stays optional: SUS is meant for people who actually used the system [3], so evaluators who only watched may skip it. Remove it by setting `INCLUDE_SUS = False` in the script.

Scoring:
1. For items S1, S3, S5, S7, S9 (odd): score = answer minus 1.
2. For items S2, S4, S6, S8, S10 (even): score = 5 minus answer.
3. Add the ten scores and multiply by 2.5. Result is 0 to 100 per evaluator [3].
4. Average across evaluators. About 68 is the average over many studies; above 68 is above average. It is a percentile-style score, not a percentage [4].
5. Do not read single items on their own [3]. With only a few evaluators report the individual scores and the range, not just the mean; SUS stays stable with very small samples but the estimate is imprecise [4].
6. A blank or middle answer counts as 3 [3].

## 6. Things I could not confirm, and questions for the owner

1. **PROJECT CREATED.** I did not know what date you meant, so I replaced it with VERSION TESTED. Tell me if you want a date back.
2. **Data privacy sentence** (page 2, RA 10173). It is my wording. Confirm it with your adviser or the Graduate School, because it says who sees the answers. I could not open the NPC site (403); I used a secondary summary that Section 11 of the Act lists transparency, legitimate purpose and proportionality [14].
3. **"Mainly for" role lines** are my inference from the demo roles. Please correct them.
4. **Policy numbers in questions:** withdrawal window and 10% / 20% fees (C2), 20% absence rule (C3), 14-day lead time (F5), Final Defense scores 85 / 90 (F13). They come from the walkthrough and Business Rules register; I did not re-check them against the Handbook. Wrong numbers on a form handed to the Dean would look bad.
5. **Length.** 93 matrix questions + 8 validation + 10 SUS. Evaluators answer A, I, J and their own sections (about 40 to 55 questions). Time it with a dry run. To shorten, drop B13, F8, F10, H5, I5 first.
6. **Reports.** The walkthrough says the Reports page was redesigned after Case 20 was captured. H6 to H10 name the five reports, the filters, Excel / PDF and "Not Yet Assessed". Check they match the final build before printing. Also check the Research Gate overview list (AD12), which the form does not name.
7. **Demo-only features left out on purpose:** the Reset demo case button, the Demo accounts panel, and the demo password. They are not part of the product.
8. **Policy Assistant:** H1 to H3 are worded to hold whether the answers are offline (keyword) or from Gemini.
9. **Walkthrough contradiction:** Case 25 says "the portal has no screen to type a student in by hand", but Case 5 shows staff adding a student. B3 follows Case 5 and the README. The walkthrough text should be corrected.
10. **Rating midpoint.** "3 = Acceptable" is from the draft; it reads slightly positive rather than neutral. I kept it because the team chose it, and it is balanced (two lower, two higher). Change to "Fair" if you want a neutral midpoint.
11. **Fonts and glyphs.** The tick-box symbols use Segoe UI Symbol; Mac Word substitutes another symbol font automatically. Checked in LibreOffice only, not in Word.

## 7. References

1. ISO/IEC 25010:2023, Product quality model (nine characteristics). https://www.iso.org/standard/78176.html . The ISO page blocked automatic reading (403); characteristic names checked against the summaries below.
2. ISO 9241-11:2018, Ergonomics of human-system interaction, Usability: definitions and concepts (usability, effectiveness, efficiency, satisfaction, context of use). https://www.iso.org/standard/63500.html . Definitions read in the publisher's preview copy: https://cdn.standards.iteh.ai/samples/63500/33c267a5a7564f298f02bbd65721a181/ISO-9241-11-2018.pdf
3. Brooke, J. (1996). SUS: a quick and dirty usability scale (original ten items, scoring, "mark the centre point", "item scores not meaningful alone"). https://hell.meiert.org/core/pdf/sus.pdf
4. MeasuringU, Measuring Usability with the System Usability Scale (average about 68, percentile reading, small samples with confidence interval). https://www.measuringu.com/sus/
5. ISO/IEC/IEEE 29119-3:2021, Software testing, Test documentation (test case specification, test incident report, test completion report). Contents list only (the text is paid). https://standards.iteh.ai/catalog/standards/iso/b4f42a41-dd8f-446c-9674-238ba5dc90f1/iso-iec-ieee-29119-3-2021
6. Plain English Campaign, Forms (12 pt for most forms, 10 pt smallest, headings at least 2 pt larger, tick boxes, space above headings). https://plainenglish.co.uk/forms
7. New Zealand Ministry of Social Development, Checklist for plain language (12 pt body, Arial-type sans serif, left aligned). https://msd.govt.nz/about-msd-and-our-work/work-programmes/accessibility/quick-reference-guides/checklist-for-plain-language.html
8. Centre for Excellence in Universal Design (Ireland), Form design (tick-box questions, numbered sections with headings). https://universaldesign.ie/communications-digital/customer-communications-toolkit-a-universal-design-approach/customer-communications-toolkit-a-universal-design-approach-navigation/written-communication-2/form-design
9. Pew Research Center, Writing survey questions (double-barreled questions, loaded wording, question order). https://www.pewresearch.org/our-methods/u-s-surveys/writing-survey-questions/
10. CASRAI, Questionnaire design (double-barrelled, leading questions, N/A option, labelled scale points, general before specific). https://casrai.org/guides/questionnaire-design
11. TASO, Designing Likert scales (label all points, five points for a general audience, midpoint debate, alternating direction). https://taso.org.uk/libraryitem/designing-likert-scales/
12. Philippine example: Designing and Implementing e-School Systems ... Northern Mindanao, Philippines (ISO/IEC 25010:2011, Likert, 9 purposive respondents). https://arxiv.org/pdf/2109.00198
13. Sonar, ISO/IEC 25010 explained (nine characteristics, sub-characteristics) https://www.sonarsource.com/resources/library/iso-iec-25010-explained/ ; arc42, ISO 25010 update 2023 (usability renamed interaction capability, user error protection and self-descriptiveness) https://quality.arc42.org/articles/iso-25010-update-2023
14. Data Privacy Act of 2012 (RA 10173), Implementing Rules and Regulations. https://privacy.gov.ph/wp-content/uploads/2023/06/IRR_RA-10173-as-amended.pdf . Not opened (the NPC and Official Gazette pages returned 403); relied on a search summary.

Project sources used: `README.md`, `.planning/DECISIONS.md` (IM4, IM24, IM30, IM31, AD11, AD12), the demo walkthrough (cases 1 to 27 and section 9 "Honest Notes & Limitations").
