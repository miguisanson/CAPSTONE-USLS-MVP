# USLS GS Platform — End-to-End Demo Script

A walk-through for the live demo: follow **one student from entry to graduation**, plus
two students for the **standing-change** flows (Leave of Absence → Readmission, and
Withdrawal). Everything below is reproducible — re-seed and the same fixtures come back.

---

## 0. Before the demo (reset to a clean state)

```bash
npm run seed        # rebuilds the database with all simulation fixtures
npm run dev         # starts the app at http://localhost:5000
```

Re-seeding is safe to run any time — it restores the dedicated program, the three
matched faculty, and Students B & C, and it removes any previously uploaded test data.

### Accounts (all password: `DemoPass123!`)
| Role | Email | Use |
|------|-------|-----|
| Staff / Academic Coordinator | `staff@gs.local` | Runs every staff workflow |
| Dean (approver) | `dean@gs.local` | Approves LOA / Withdrawal / Course plans |
| Student A (created on upload) | `2099001@student.usls.edu.ph` | Andrea Villanueva — research journey |
| Student B | `student-b@gs.local` | Bianca Robles — LOA → Readmission |
| Student C | `student-c@gs.local` | Carlo Mendoza — Withdrawal |

> Student A's account is **created automatically** when you upload her monitoring sheet
> (the import message shows the exact login). It does not exist until the handoff.

### Sample files (`Documents/USLS_Documents/Simulation/`)
- `AC-Student-Monitoring - MAEDS (Student A - Andrea Villanueva).xlsx` — the handoff sheet
- `Form1 - Title Defense Application (Student A - prefill sample).pdf` — auto-fills the title
- `Student_A_Concept_Papers/` — three **real** research PDFs (learning analytics / online
  learning / machine learning) used for keyword-based panel matching

---

## 1. Student A — entry → graduation (the main story)

### Step 1 · Student Handoff (file upload)
1. Sign in as **staff@gs.local**.
2. Sidebar → **1 · Student Handoff** → **Upload AC Student Monitoring sheet**.
3. Choose `AC-Student-Monitoring - MAEDS (...).xlsx`.
4. The importer reads the sheet, creates **Andrea Mae Villanueva** (program **MAEDS**),
   marks her coursework complete, and **provisions her student-portal login**
   (`2099001@student.usls.edu.ph` / `DemoPass123!`) — shown in the result message.

### Step 2 · Monitoring Sheet
- Sidebar → **Monitoring Sheet** → choose program **MAEDS**.
- Andrea appears as a spreadsheet row: 8/8 subjects complete, units totalled by category,
  enrollment tag **Enrolled**, eligibility met. This is the "reads through into the
  monitoring sheet" moment.

### Step 3 · Curriculum Planning & Course Adjustments (program-level)
- Sidebar → **2 · Curriculum Planning** / **3 · Course Adjustments** → program **MAEDS**.
- Show the AC-editable curriculum and the demand/offering view. (RAG can *advise* here;
  the Academic Coordinator still decides.)

### Step 4 · Course Audit
- Sidebar → **4 · Course Audit** → pick Andrea. All subjects show **Completed**; the audit
  reports 0 missing and marks her **units-complete**, advancing her to **Proposal
  Development**.

### Step 5 · Research Gate (Form 1) — *student side*
1. Sign in as **Andrea** (`2099001@student.usls.edu.ph`).
2. Student Portal → research gate is auto-detected as **Form 1 – Title Defense**.
3. Click **"Upload Form 1 (PDF) to auto-fill"** → choose the
   `Form1 - Title Defense Application (...).pdf`. The **research title auto-fills**:
   *"Learning Analytics Dashboards and Student Engagement in Online Graduate Programs."*
4. Upload the **Form 1** PDF and the **three concept papers** (from
   `Student_A_Concept_Papers/`).
5. **Submit** the milestone for review.

### Step 6 · Form 1 endorsement — *staff side*
- Sign in as **staff@gs.local** → **Research Gate / Form 1 endorsements** → open Andrea →
  draw the coordinator signature → **Endorse**.

### Step 7 · Panel Matching (keyword / "RAG" matching)
- Sidebar → **6 · Panel Matching** → pick Andrea.
- The system reads the **text of the three concept papers**, extracts keywords
  (*learning analytics, online learning, student engagement, machine learning, data
  analytics*) and ranks faculty. The three prepared advisers top the list at **score 100**
  with those exact matched phrases shown as the reason:
  - **Dr. Liwayway Bautista** — learning analytics, online learning, student engagement
  - **Dr. Marlon Geronimo** — machine learning, learning analytics, data analytics
  - **Dr. Patricia Salvador** — online learning
- Select the panel (Chair / Content / Method / External) → **Finalize**.

### Step 8 · Defense Scheduling
- Sidebar → **7 · Defense Scheduling** → pick Andrea.
- Each panelist's availability and busy blocks are shown. The system proposes **common
  120-minute slots** across the whole panel (e.g. the next few **13:00–15:00** afternoons).
  Pick one, set the mode/venue, and confirm.

### Step 9 · Practicum & Graduation
- **8 · Practicum** applies because MAEDS is practicum-enabled — record the MOA / hours /
  coordinator review.
- **9 · Graduation** → pick Andrea → record the graduation endorsement / clearance to
  complete the journey.

---

## 2. Student B — Leave of Absence → Readmission

1. **Staff** → **Leave of Absence**. The queue shows only students who actually filed a
   request — **Bianca Robles** is there. Open her request, check eligibility, route to the
   **Dean**.
2. Sign in as **dean@gs.local** → approve the LOA → Bianca's status becomes **On Leave**.
3. (Return path) Sign in as **Bianca** (`student-b@gs.local`) → Student Portal → file a
   **Readmission** request. Then **staff** → **Readmission** queue shows Bianca → route to
   Dean → approve → she is **Active** again.

## 3. Student C — Withdrawal

1. **Staff** → **Withdrawal**. The roster shows **Carlo Mendoza's** submitted request
   (status *Dean Review*).
2. Route to **dean@gs.local** → decision → then requirements / fees / registrar steps →
   status reaches **Withdrawn Confirmed**.

---

## Notes
- The platform runs on **MySQL** (`usls_gs_demo`). PDF text used for matching is sanitized
  and length-capped so any real PDF uploads cleanly.
- Panel matching is grounded **only** in the uploaded concept papers + faculty profiles
  (local keyword retrieval); the Policy Assistant retrieves from the curated policy corpus.
  Final decisions always stay with the Academic Coordinator / Dean.
