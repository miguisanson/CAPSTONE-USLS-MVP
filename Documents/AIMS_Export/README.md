# Proposed AIMS export/import contract

The file in this folder is a **proposal for review**, not an official current USLS AIMS export.

## Correct system boundary

1. AIMS remains an external USLS system and the official data owner.
2. Authorized AIMS/Registrar personnel generate an approved export workbook.
3. Graduate School staff upload that workbook to the lifecycle application.
4. The application validates and previews the file before an atomic import.
5. Imported identity, enrollment, subject, grade, and completion values are read-only.
6. The application produces discrepancy reports; corrections occur in AIMS.
7. A later replacement export/import reflects the official correction and preserves revision history.

This project must not build an AIMS clone, store AIMS credentials, scrape AIMS screens, or claim live synchronization.

## Workbook

- `PROPOSED_USLS_AIMS_Export_Template.xlsx`
- Schema version: `PROPOSED-1.0`
- Empty data sheets: `Export_Metadata`, `Students`, `Enrollment_Subjects`, `Grades`, and `Subject_Offerings`
- A `Data_Dictionary` sheet explains every proposed column.

The workbook contains no real student data. Required columns are highlighted yellow. Exact fields, source codes, authorized exporting office, and export cadence still require confirmation by the AIMS/Registrar owner.

## Regenerate

From the repository root:

```sh
.venv/bin/python scripts/generate_aims_export_template.py
```

Official references:

- <https://aims.usls.edu.ph/lasalle/>
- <https://www.usls.edu.ph/uploads/posts/AIMS-2022/AIMS.pdf>
