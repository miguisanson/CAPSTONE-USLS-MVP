# Panel demo checklist: Withdrawal, Practicum, Graduation

How to show every step of the three workflows by hand, with the Demo Guide switched **off**. The seed leaves one record
waiting at the start of each step, so no step needs setting up first.

- Site: http://localhost:5001 (or the demo site URL)
- Password for every account below: `DemoPass123!`
- Staff, Dean and both coordinators are in the sign-in page's **Demo accounts** list; the demo students
  (Elena, Joshua, Paolo, Andrea, Carlo, Bianca) are in its **Demo students** list. Other students sign in by email.
- Batch names include the month the seed ran (below: November 2026).

## Before the presentation

| When | Run | What it does |
|---|---|---|
| Day before | `npm run seed` | Rebuilds all demo data (every module). |
| Just before the panel | `npm run reset:panel` | Puts **only** Withdrawal, Practicum and Graduation back to the seeded state, in every browser's private copy of the demo data. Other modules (Leave, Readmission, AWOL, Reports, ...) keep what was done. Reload open pages afterwards. |
| During the demo | Sign-in page → Demo students → **Reset** on one student | Clears that one demo student's case (for example Elena) so the student can submit again. |
| With the Demo Guide | Start a Withdrawal, Practicum or Graduation guide | Resets only that guide's student (Elena, Paolo or Carlo). Other guides' cases and work done by hand stay. |

Sample certificate PDFs for the Practicum hours: `Desktop/CAPSTONE Sample Documents/Practicum Hours Samples/`
(`..._200_hours_completed.pdf`, `..._150_...`, `..._240_...`, `..._no_hours_number.pdf`).

## Subject Withdrawal

| Step | Sign in as | Page | Record to click | What to show |
|---|---|---|---|---|
| Student submits | withdrawal.elena@usls.edu.ph | Requests → Subject Withdrawal | — | Pick a subject, type the reason, Submit, Send request. |
| Staff forward to Dean | staff@usls.edu.ph | Subject Withdrawal board | **Adrian Lim** (Submitted) | View → Record and forward to Dean. |
| Dean approves / returns / denies | dean@usls.edu.ph | Approvals → Subject Withdrawal | **Hazel Flores** (With the Dean) | View → Approve the withdrawal. Return and Deny need a reason. |
| Staff tag the subject | staff@usls.edu.ph | Subject Withdrawal board | **Noel Santos** (Subject tagging) | View → Tag the subject as Withdrawn. |
| Staff export the Registrar list | staff@usls.edu.ph | Subject Withdrawal → Registrar list | **Isabel Francisco** (Excel export) | Prepare Excel export → Download Excel list. Gmail opens a draft to registrar@usls.edu.ph; the window also has **Use my mail app instead**. |
| Export history | staff@usls.edu.ph | Registrar list → **Export history** | — | Seeded lists plus the one just downloaded (File, Students, Withdrawals, Downloaded by, When). |
| Student sees the result | the student of the request | Requests → Subject Withdrawal | — | Exported - Ready to Send, Dean decision Approved. |

## Practicum

| Step | Sign in as | Page | Record to click | What to show |
|---|---|---|---|---|
| Student sends the MOA | practicum.paolo@usls.edu.ph (or practicum.andrea@) | Practicum | — | Site, supervisor, MOA PDF, Submit MOA stage. |
| Staff forward the MOA | staff@usls.edu.ph | Practicum board | **Lara Uy** (Submitted) | View → Forward to Academic Coordinator. |
| Coordinator starts the practicum | academic@usls.edu.ph | Practicum board | **Miguel Torres** (Eligibility Review) | View → Mark practicum in progress. |
| Student uploads the certificate | irene.jacinto@student.usls.edu.ph | Practicum | (Irene's own case, In Progress) | Upload `Practicum_Certificate_200_hours_completed.pdf`: "Completed hours: 200 (read from the certificate)"; there is no box to type hours. Link: **View uploaded certificate**. Use the 150 file for Hours Incomplete. |
| Staff enter hours and forward | staff@usls.edu.ph | Practicum board | **Enrico Salazar** (Documents Review; card says "Hours: Staff to enter") | View → Forward documents to Academic Coordinator → type the hours from the certificate (empty is refused). |
| Coordinator asks for more certificates | academic@usls.edu.ph | Practicum board | **Jerome Lopez** (150 of 200 hours; staff forward first) | Request additional certificates (a reason is required). |
| Coordinator verifies completion | academic@usls.edu.ph | Practicum board | **Nicole Villanueva** (Documents Review, 200/200) | View → Verify completion. |
| Coordinator sends the report to the Dean | academic@usls.edu.ph | Practicum board | **Martin Gonzaga** (Completion Review) | View → Send status report to Dean. |
| Dean reviews | dean@usls.edu.ph | Approvals → Practicum Reports | **Isabel Mendoza** (With the Dean) | Type a review comment → Mark reviewed. |

## Graduation

For Psychology and MSGC students (programs with a practicum) the student's Graduation page is **locked until the Dean
approves the practicum completion** (marks the practicum report reviewed). To show the lock, sign in as
martin.gonzaga@student.usls.edu.ph (practicum Completed, report not yet with the Dean) and open Graduation Endorsement.
To show it opening: the Academic Coordinator sends Martin's report to the Dean, the Dean marks it reviewed, and
Martin's Graduation page opens. MAED and other programs without a practicum are never locked.

| Step | Sign in as | Page | Record to click | What to show |
|---|---|---|---|---|
| Student applies | graduation.carlo@usls.edu.ph (or graduation.bianca@) | Graduation Endorsement | — | Signed application PDF, Submit graduation application. |
| Staff create the batch | staff@usls.edu.ph | Graduation board | **Marco Lacuesta** (Application submitted) | Move to → Batch created. The batch name is given automatically (next free number this month); there are no Batch No./Month/Year boxes. |
| Staff forward to the Academic Coordinator | staff@usls.edu.ph | Graduation board | **Isabel Flores**, Batch 1 November 2026 (Batch created) | Move to → Coursework review. |
| Coordinator checks coursework | academic@usls.edu.ph | Graduation board | **Batch 2 November 2026** (Nina Ledesma) | Move to → Research and practicum check. |
| Research Coordinator validates | research@usls.edu.ph | Graduation board | **Batch 3 November 2026** (Paula Gatuslao) | Move to → Endorsement prep or revision. |
| Staff prepare and send to the Dean | staff@usls.edu.ph | Graduation board | **Batch 4 November 2026** (Javier Montelibano) | View details → Prepare endorsement list, then Move to → Dean review. |
| Dean approves | dean@usls.edu.ph | Approvals → Graduation | **Batch 2 October 2026** (Hector Ong, Dean review) | Approve endorsement list. |
| Dean exports | dean@usls.edu.ph | Approvals → Graduation | **Batch 5 November 2026** (Ramon Villareal, Teresa Javellana; Approved, ready to export) | **Export batch**: the CSV downloads and Gmail opens a draft to the Registrar. |
| Export history | dean@ or staff@usls.edu.ph | Graduation → **Exported batches (history)** | — | Seeded past batches plus the new export, with the Batches column. |
| Registrar acknowledged | staff@ or dean@usls.edu.ph | Graduation board | Any exported batch in **Approved, ready to export** (e.g. **Batch 1 January 2026**) | Drag it (or Move to…) to **Acknowledged by Registrar** and confirm. Done by hand only, after the Registrar confirms receipt; nothing moves there by itself. Coordinators cannot do it. |
| Staff correct a returned list | staff@usls.edu.ph | Graduation board | **Batch 2 March 2026** (Rafael Dizon, Returned for Revision) | Send endorsement list to Dean again. |

## Green marks between accounts

- **Needs your action** rows on the home page are green with **New** until opened (remembered per browser and account).
- A board card that moved because of **another** account (for example the Dean approved it) is green with
  **Moved here · new** until it is opened. A card moved by the signed-in person, and a card put back by a reset or
  reseed, is never marked.
