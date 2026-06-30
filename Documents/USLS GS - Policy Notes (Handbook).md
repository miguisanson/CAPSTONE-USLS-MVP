# USLS GS — Policy Notes (from the 2022–2023 Graduate Programs Student Handbook)

Authoritative rules extracted from `USLS_Documents/GRADUATE-SCHOOL-HANDBOOK-22-23.pdf`.
Use alongside the [Lifecycle Checklist](USLS%20GS%20-%20Lifecycle%20Checklist.md) and the
[CHANGELOG](../CHANGELOG.md). **⚠ flags mark where the handbook differs from what we
already built or decided — these need reconciliation.**

## Maximum Residence Rule (MRR) — §6.7
**Master's**
- Candidacy must be attained within **3 academic years** from admission.
- All requirements must be completed within **5 academic years**.
- Beyond 5 years: a **2-year extension** is allowed, but the student must enroll in a **graded
  6-unit refresher course** in the area of specialization.
- Hard cap: **7 academic years including LOA**.
- Beyond 7 years: the student must **re-enroll ALL courses taken** and earn new credits.

**Doctorate**
- Candidacy within **5 academic years**; all requirements incl. Dissertation within **7 years**.
- Beyond 7 years: **2-year extension** + graded 6-unit refresher course.
- Hard cap: **9 academic years including LOA**.
- Beyond 9 years: **re-enroll all courses** and earn credits.

> ⚠ **Conflicts with our earlier AWOL/5-year decision.** We previously set "over 5 years →
> readmission denied / re-apply as new." The handbook is **graduated**: 5y → 2-yr extension
> (+6-unit refresher) → 7y hard cap (incl. LOA) → only **beyond 7 years** re-enroll everything.
> The residency clock counts **from admission and includes LOA** (LOA does *not* pause the
> 7-year cap). Build #22/#23 should follow the MRR, not the simplified rule.

## Incomplete (INC) grades — §3.5
- An **INC** is given only if class standing is **passing** but the student misses the final
  exam or can't finish requirements for illness/valid reasons.
- If class standing is **not passing** and the final is missed without valid reason → **5.0 (Failed)** immediately.
- INC must be removed within **one (1) academic year** (Incomplete Grade Removal Form).
- **If not removed within a year → automatic 3.0 (master's) / 2.0 (doctorate) and the student must RETAKE the subject.** (It does NOT become a 5.0/Failure.)
- A student who incurs **INC in ALL subjects → dropped from the rolls**.

> ⚠ **Conflicts with our auto-fail build (#21 / checklist 4a).** We currently convert a lapsed
> INC to **Failed**. The handbook says lapsed INC → **3.0 (master's) / 2.0 (doctorate) + must
> retake**, not Failed. Needs reconciliation (see decision below).

## Grading system — §3.5
- Master's: 1.0 (98–100) … 2.0 (85–88) passing; 3.0 "Passed but no credit"; **5.0 Failed**;
  **W** Withdrawn; **D** Dropped; **INC** Incomplete.
- Doctorate: 1.0 … 1.75 passing; 2.0 "Passed but no credit"; 5.0 Failed; W/D/INC same.

## Retention & failure — §3.5
- Good standing: master's weighted average **≥ 2.0**; doctorate **≥ 1.75** each academic year.
- **Failure (5.0) in any subject → no re-admission to the program** (dropped).

## Leave of Absence (LOA) & AWOL — §6.x
- No LOA may be granted within **2 weeks before the last day of classes**.
- LOA filed in the **second half** of the semester → enrolled courses marked **W (withdrawn)**, no refund.
- A student with remaining units who cannot enroll (e.g., medical) must file **LOA — not Residency**.
- **AWOL** = withdrawing without a formal LOA → registration privileges **curtailed/withdrawn**.
- **Return from LOA or AWOL:** the student must **declare intent to enroll in writing to the
  University Registrar through the Graduate School Dean** (Dean endorses to the Registrar).

## Residency — §6.x
- "Residency" status is for students with **no remaining units to enroll** (research-only / continuing).
  A student who still has units to take cannot go on Residency — they file LOA instead.
  (Matches checklist item 9.)

## Comprehensive Examination — §3.9 / §6.10
- Covers basic/core courses, fields of concentration, and electives/cognates.
- 2 days (master's) / 3 days (doctorate), max 8 hours/day.
- **Eligibility:** passed all academic requirements and evaluated by the Academic Coordinator.
  Non-thesis track must first complete integrating courses (feasibility/project/case/applied or
  action research / practicum).
- Honors require **no INC/D/W and passing comps with no re-take**.

## Candidacy
- Master's: candidacy within 3 years; Doctorate: within 5 years (see MRR).

---

## Decisions needed (handbook vs. current build)
1. **INC lapse rule** — follow the handbook (lapsed INC → 3.0/2.0 + retake) or keep the
   simpler auto-Fail we built?
2. **MRR / residency** — implement the graduated MRR (5→7→re-enroll for master's;
   7→9→re-enroll doctorate; LOA counts toward the cap) instead of "deny at 5."
3. **Failure rule** — should a 5.0 in any subject block re-admission (auto-drop), per handbook?
