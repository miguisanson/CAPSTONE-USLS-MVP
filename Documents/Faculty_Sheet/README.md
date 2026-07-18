# Faculty Roster (import file)

The faculty roster is a **real, imported source** — never randomly generated. Fill
`Faculty_Roster.xlsx` with the actual Graduate School faculty; the app imports every
`.xlsx` in this folder on startup to create faculty records (and, when needed, their
accounts).

## Columns (header row 1)
| Column | Meaning |
|---|---|
| NAME | Full name (e.g. `Dr. Liwayway Bautista`) |
| COLLEGE | Home college (e.g. `Education`, `Nursing`) |
| ROLE | e.g. `Adviser / Panel` |
| EMAIL | Real institutional email (used for their login) |
| SPECIALIZATION | Research areas — drives panel matching |

Add one faculty per row below the header. The template ships with headers only, so
the roster is empty until you add real rows.
