# Documents — what is where

Reorganised 4 Nov 2026. Nothing was deleted; old material is in `Archive/`.

```
Documents/
  Capstone/            the group's own deliverables
    Proposal/            Final Proposal Document (live, Ch. 1-6), Overall Document, CAP1DEF defense form, edit notes
    Walkthrough/         CAP-2521-IT-WALKTHROUGH.docx (team demo, presenting order) + its screenshots
    UAT/                 [CAP-IT2] UAT Instrument - Revised (.docx/.pdf) + UAT-REVIEW-NOTES.md
    Meeting_2026-11-04/  ZOOM-CHEAT-SHEET, MEETING-CHEAT-SHEET, NARRATION-SCRIPT, README-FOR-MIGUI, videos/
  Graduate_School/     documents for and from the USLS Graduate School
    Forms/               60 documents (forms GS-F-01..54, GS-P-01..06) in one folder per manual chapter, USLS-GS-Forms-Pack.pdf, 00-INVENTORY.md
    Operations_Manual/   USLS GS Operations Manual - DRAFT for Validation (.docx/.pdf/.md) + operations_manual_rules.json
    Policy_Sources/      Graduate School Handbook 2022-23, Research Protocol, monitoring templates (the Policy Assistant's library)
  Sample_Data/         demo data the web app imports
    AIMS_Export/ Class_Lists/ Faculty_Sheet/ Monitoring_Sheets/ Student_Files/
    Concept_Paper_Guidelines/ Concept_Paper_Samples/
  Archive/             old - do not use as a spec
    CAPRIT2 OLD/         pre-defense material (old proposal, deck, old walkthrough, July consultations, BPMN diagrams)
    Stakeholder_Meeting_Prep/  July 2026 meeting script and Sir Oli checklist
```

- The web app reads `Graduate_School/Policy_Sources`, `Graduate_School/Operations_Manual`, `Sample_Data/Monitoring_Sheets`,
  `Sample_Data/Faculty_Sheet` and `Sample_Data/Concept_Paper_Guidelines`. Renaming them needs a change in `app.py`.
- The `.mp4` videos are on this PC only (not on GitHub).
- In `Archive/CAPRIT2 OLD/`, a file with the same name as a current file is the OLD version. Two exact duplicates
  live inside it: `Defense Form - CAPIT0 PROPOSAL.docx` = `Submissions/CAP-2521-IT-PROPFORM.docx`, and
  `Final Proposal Document - CAP-IT1.docx` = `Submissions/CAPSTONE DOCUMENT/CAP-2521-IT-CAP1DOC.docx`.
