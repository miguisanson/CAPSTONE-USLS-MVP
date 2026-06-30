# USLS GS — Student Lifecycle Checklist (Simulation Reference)

The authoritative reference for the end-to-end student simulation. Every transaction and
feature must connect smoothly per situation, so any user (Student, GS Staff, Academic
Coordinator, Research Coordinator, Dean, Faculty) can run their part reliably.

**Roles in the system:** Student · GS Staff · Academic Coordinator · Research Coordinator ·
Dean · Faculty.
**Registrar is NOT a system role** — registrar steps are external hand-offs (a file is sent
out and a status is recorded by GS Staff).

**Status legend:** ✅ built · ⚠️ partial · ❌ to build · ❓ rule to confirm

---

## 1. Student enters the program
- **Who:** GS Staff (handoff). **How:** upload the AC Student Monitoring sheet, or add manually.
- System creates the monitored record, mirrors enrollment, and (for new students) provisions a portal login. ✅

## 2. Student is enrolled into a course
- **Who:** Academic Coordinator records the course as Enrolled/Current on the monitoring roster. ✅
  - **2a. Student can drop the course** — Student files a drop request from the portal → Academic Coordinator approves/denies → course marked Dropped. ✅

## 3. Student completes the course
- Course status → Completed.
  - **3a. Receives a grade** — Academic Coordinator records the grade. ✅
  - **3b. Receives an Incomplete** — not failing, no grade yet; status = Incomplete with a completion deadline. ✅
  - **3c. Receives a Failure** — status = Failed. ✅

## 4. Student completes an Incomplete grade
- Academic Coordinator records the final grade before the deadline → status resolves to a grade. ✅
  - **4a. Never completes within one year — RULE (per Handbook §3.5):** the system **auto-assigns
    3.0 (master's) / 2.0 (doctorate) — "passed, no credit" — and flags the subject for RETAKE**
    (not a failure), notifying the student + Academic Coordinator (activity log + retake task). ✅

## 5. Student files a Leave of Absence
- Student files LOA (portal) → GS Staff checks prior-LOA eligibility → routed to Dean → Dean
  approves → status set to On Leave; notice sent. Pauses the residency clock. ✅

## 6. Student returns from LOA (Readmission)
- Student files readmission → GS Staff checks return eligibility → Dean approves → status set to
  Active for the return term. ✅

## 7. Student can be AWOL
- A student with no enrollment / no filed LOA for the term is flagged AWOL.
- Today AWOL exists only as a status tag. **Needs:** a workflow to formally mark AWOL and act on it. ❌ to build

## 8. Student returns from AWOL  — RULES (decided)
- The residency clock is **5 years from program entry; approved LOA pauses it**.
  - **8a. Over the 5-year period:** readmission is **denied** — the student must **re-apply as new**.
  - **8b. Within the period:** the student is **auto-reactivated to Active** (no Dean approval needed).
- **Needs:** AWOL workflow + 5-year residency check on return, branching on the above. ❌ to build

## 9. Student is enrolled but on residency with no subjects
- A student who has finished coursework and is only continuing residency (research only, no
  enrolled subjects). **Needs:** an explicit "on residency / no subjects" state feeding the
  residency clock and the 5-year check. ❌ to build

## 10. Student applies for thesis
  - **10a. Not eligible without comprehensive exam + title proposal** — research gate is locked until
    the comprehensive exam is Passed; Form 1 (title) is required. ✅
  - **10b. Passes comprehensive exam + title proposal; if not, retake** — defense result can be
    recorded Passed/Failed; **explicit retake tracking (attempt count, re-schedule) needs building.** ⚠️→❌
  - **10c. Passes final defense; if not, retake** — same: result recorded; **retake tracking to build.** ⚠️→❌

## 11. Student files a Withdrawal
- Student files withdrawal → routed to Dean → requirements/fees checked → external registrar
  hand-off recorded → status reaches Withdrawn Confirmed. ✅

## 12. Student is eligible for practicum and completes the program's required hours
- Practicum workflow: MOA, required vs completed hours, coordinator review, Dean report. ✅
  - **12a. If practicum is not accepted** — re-place the student in another company/organization and
    track the new placement + hours. **Needs:** a re-placement workflow. ❌ to build
  - **12b. When things don't run smoothly / a student or staff has a question or concern** — every
    step should support return-for-revision, comments, and a clear "who owns the next action."
    Workflow messaging exists; **harden the edge cases (expect the worst).** ⚠️

## 13. Student is eligible for graduation
- Eligible only when **course units + thesis (completion evidence) + practicum** are all complete;
  endorsement compiled for Dean approval and external registrar hand-off. ✅

---

## Cross-cutting: per-student tasks
- Every situation generates owner-assigned tasks visible in the **Work Queue** (filterable by
  owner/status), so work can be tracked per student and as a group/list. ✅

## Open rules needing your decision
1. **12b** — how far to push edge-case handling ("expect the worst") per workflow.

## Build queue (approved)
Registrar removal → Incomplete auto-fail+notify (4a) → AWOL + 5-year rule (7,8) → Residency clock
(9) → Retake tracking (10b,10c) → Practicum re-placement (12a).
