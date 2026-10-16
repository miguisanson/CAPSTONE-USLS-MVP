# Reference Portals: what comparable systems do and what to copy

**Project:** USLS Graduate School Lifecycle Monitoring & Analytics Platform
**Researched:** 2026-10-17 (all pages below fetched or searched that day)
**Overall confidence:** MEDIUM. The university and vendor documentation pages are solid. Vendor marketing and third-party review sites are weaker. Every "Could not verify" note is listed in the last section.

**Important limit of this document:** I did not audit the app's current UI against these portals. "Applicable to us" below means "worth checking whether the app already does this", not "the app lacks it". The app already has leave cases, panel verdicts, adviser appointment and AIMS import (see `CLAUDE.md` and `CHECKLIST_PHASE_PLAN.md`), so several patterns may already exist.

---

## 1. Systems surveyed (12)

### 1. Vireo (Texas Digital Library) - ETD submission and review
- **What it is:** Open-source (GPL-2.0) electronic thesis and dissertation manager. Java/Spring backend, AngularJS front end, MySQL/PostgreSQL/H2. From 4.x it has "fully customizable workflows and controlled vocabularies" ([GitHub](https://github.com/TexasDigitalLibrary/Vireo)). TDL also hosts it for member universities ([TDL ETD page](https://www.tdl.org/etds/)).
- **Stages modelled:** student upload via a short web form, then committee sign-off, then graduate-office review and approval, then publication to a repository, with embargo options on any document ([TDL Vireo wiki](https://texasdigitallibrary.atlassian.net/wiki/spaces/VIR); [Texas State instance](https://etd2.ul.txstate.edu)).
- **UX patterns worth noting:** all stakeholders see the same status of a thesis at the same time ([UNT rollout note](https://library.unt.edu/news/2015/new-system-enhances-electronic-theses-dissertations-etds-submission-and/)). Staff build workflow filters. Admin settings include submission open/close dates, a custom action checklist, deposit locations, user access, email templates and the look of the student form ([TDL admin interface guide](https://texasdigitallibrary.atlassian.net/wiki/spaces/VUG/pages/2297364481)).
- **Applicable to us:** the "custom action checklist" is the right model for the final-document review (format check, plagiarism report, ethics clearance, bound copies) with one shared status visible to student, adviser and GS staff. Embargo handling matters for the final manuscript step if USLS publishes theses.
- **Do not copy:** the full repository-publication pipeline. Out of scope for the capstone.

### 2. ProQuest ETD Administrator - submission, review, release
- **What it is:** hosted, free-to-institutions admin tool for ETD submission, review and approval, configurable to each school's process ([ProQuest LibGuide](https://proquest.libguides.com/proquest_etd/education); hosted by ProQuest per [Harvard's implementation page](https://harvardwiki.atlassian.net/wiki/spaces/LibraryStaffDoc/pages/43391877/ProQuest+ETD+Workflow+Implementation)).
- **Stages seen at member schools:** student submits, graduate office reviews formatting and either requests changes or approves, release to ProQuest and the repository ([Wake Forest](https://zsr.wfu.edu/digital-scholarship/etd/submitting-an-etd/), [Denver](https://www.du.edu/graduate-education/submitting-dissertation-or-thesis), [Idaho](https://www.uidaho.edu/-/media/UIdaho-Responsive/Files/cogs/Thesis-and-Dissertation-Resources/doc-links/faculty-view-committee-review-etd-decision-page.pdf)).
- **Patterns:** supervisor sign-off is a hard prerequisite to submit ([Toronto SGS](https://www.sgs.utoronto.ca/academic-progress/program-completion/electronic-thesis-submission/)); embargo choice must match the signed agreement ([Wake Forest](https://zsr.wfu.edu/scholarship/etd/submitting-an-etd/)); a deadline for finishing corrections, after which the manuscript is withdrawn ([Molloy](https://molloy.libguides.com/etd/dissertation)).
- **Applicable to us:** "request changes" as a distinct outcome from "approve" and "reject", and a visible correction deadline.

### 3. Purdue Grad Tracker - milestone and annual-review tracker
- **What it does:** a graduate student tracking system that reduces paper and lets students track administrative deadlines. Events in the system: initial advisory meeting and goals, annual committee meeting, plan of study, approved research proposal upload, schedule preliminary exam (PhD), register for candidacy, annual student data, schedule final exam, thesis deposit, department exit survey ([Purdue Entomology handbook](https://ag.purdue.edu/department/entm/prospective-grads/handbook/grad-program-milestones.html)).
- **Notable pattern:** a table that says, per milestone, *when* it is due ("end of year 1"), *who completes it* (student, major professor, committee), and *which form or rubric* it uses. Rubrics (defense rubric, preliminary exam rubric, communication rubric) are filled in inside the system. The annual progress review needs committee sign-off.
- **Applicable to us:** the best single template for the student "my progress" screen and for the program-level milestone configuration (master's list differs from doctoral list). Per-program milestone templates map to our MSCS/MIT/MBA/DBA/EdD split.

### 4. Northwestern TGS Graduate Student Progress (GSP)
- **What it does:** one place for forms (application for degree, master's completion, PhD qualifying exam, prospectus, final exam, petition for absence, program withdrawal), adviser and committee records, plan of study, an annual progress log (awards, publications, research progress, meetings), milestones and a documents store ([Northwestern TGS](https://www.northwestern.edu/tgs/academic-policies-procedures/gsp.html)).
- **Applicable to us:** a "petition for absence" form beside the other milestone forms confirms that leave of absence belongs inside the same lifecycle view, which is what our app does. The annual progress log is a cheap addition (one form, one table).
- **Could not verify:** reminders, approval routing and role definitions. The page does not describe them.

### 5. McGill MyProgress - milestone reminders and committee meetings
- **What it does:** lists all degree milestones, sends automatic email notifications before upcoming milestones, and holds uploaded signed documents. Annual progress-tracking meetings with a committee are required, with a "GPS Progress Tracking Form" completed before and after each meeting. Students upload signed forms; supervisors sign; a graduate studies coordinator supports ([McGill Pathology](https://www.mcgill.ca/pathology/programs/guidelines-and-milestones)).
- **Applicable to us:** the only source in this set that explicitly confirms automated reminders before milestones. This is the highest value-for-effort reminder pattern. The before/after meeting form fits our adviser-meeting log.

### 6. Vanderbilt doctoral actions on Kuali Build (and ODU master's forms)
- **What it does:** web forms for appointing or changing a PhD committee, scheduling or changing a qualifying exam or defense, extending candidacy, submitting exam or defense results. Routing: program administrator, then Director of Graduate Studies, then Graduate School, then Registrar. At each stage the reviewer can Approve, Deny, or Send Back with comments to either the student or the program administrator. Reviewers use an Action List (work queue) and a Documents List with column show/hide, filters and export. A two-week notice is required before exams ([Vanderbilt DGS approval guide](https://registrar.vanderbilt.edu/registration/yes-help/Doctoral-Actions-Workflow-DGS-Approval-workflow.php); [workflow PDF](https://registrar.vanderbilt.edu/documents/User-Guide-Doctoral-Workflow-DGS-Approval.pdf)). ODU runs master's committee appointment, exam results and thesis acceptance as three numbered forms ([ODU](https://www.odu.edu/index%2Ephp/node/285121)).
- **Applicable to us:** closest match to our chair, dean, GS staff, registrar approval chain. Copy three things: (a) Approve / Deny / Send Back as the standard decision set, with the send-back target selectable; (b) an email with a direct "Begin Review" link to the item; (c) a per-role Action List.
- **Note:** this is Kuali Build (a form and workflow builder), not Kuali Student. My search did not find a Kuali Student graduate-milestone product page.

### 7. Ethics review systems: Cayuse Human Ethics and Kuali Research Protocols
- **What they do:** submission, pre-review, reviewer assignment, review actions, approval, then amendments, renewals and closures on approved protocols. Cayuse shows dashboard stages (draft, awaiting authorization, pre-review, under review) and status flags such as unsubmitted, awaiting certification, reopened ([Stockton Cayuse guide](https://stockton.edu/research-sponsored-programs/documents/irb/IRBCayuseUserGuide.pdf)). Kuali reviewers get action items per field, a "Mark Complete" step and a "Submit Review" step that notifies the IRB office; assigning a reviewer triggers an email ([Fresno State Kuali guide](https://academics.fresnostate.edu/humansubjects/documents/kuali-how-to-guide-mar-2023.pdf), [LSUHSC reviewer guide](https://www.lsuhsc.edu/administration/academic/ors/irb/docs/HRP-2890_Reviewer%20Instructions_v1.3_7.15.20.pdf)).
- **Applicable to us:** our research-ethics module can mirror: draft, submitted, pre-check by GS staff, assigned to reviewer, decision (approved / revisions / rejected), renewal or amendment. Keep it to a status machine with an event log.
- **Could not verify:** automated expiration or renewal reminders in either product. No source described them.

### 8. Ellucian Degree Works - degree audit, what-if, planner
- **What it does:** compares completed and in-progress courses to catalog requirements and shows what remains; "what-if" audits for a change of program; audits convertible into plans; model plans assignable to groups; on-track / off-track indicators so advisors know when to step in; a student dashboard ([Gramling State overview](https://gram.edu/offices/infotech/degreeworks), [Ellucian solution sheet](https://www.ellucian.com/assets/en/solution-sheet/ellucian-degree-works.pdf), [SIU overview](https://oit.siu.edu/_common/documents/sis/degree-works/degree-works-overview.pdf)).
- **Applicable to us:** the requirement-met / still-needed checklist, and the on/off-track flag for advisers, map directly to our course planning and enrollment monitoring fed by AIMS exports. A what-if audit is a nice-to-have and can be deferred.
- **Caveat:** the Ellucian solution sheet PDF could not be text-extracted by my tool; the feature list comes from university pages that describe the product.

### 9. Anthology Student (Campus Management) - degree progress audit rules
- **What it does:** enrolling a student in a program version applies that program's courses and requirement rules; the Degree Progress Audit page has a Requirement Rules tab listing each rule, the courses required and applied, and credits required versus earned. Release 24.2.0 added automatic handling of one course counting toward several requirement categories ([Anthology requirement rules](https://help.anthology.com/CNS/26.1/WebClient/content/ca/arlists/reqrules/c_reqrulebackground.htm), [release notes](https://help.anthology.com/Content/RA/AS/RAAS2420.htm)).
- **Applicable to us:** model requirements as data (rule, credits required, credits earned) per program version, not as hard-coded logic.
- **Could not verify:** how Anthology flags unsatisfactory graduate progress. Not found.

### 10. Slate (Technolutions) - admissions Reader and bins
- **What it does:** Reader groups records into bins by process stage (unreviewed, in progress, needs follow-up, ready for decision, completed), supports queues and assignment, structured review forms, a record snapshot with history, a "new materials since last review" report, annotations and decisions by form or bin move ([Technolutions Reader docs](https://knowledge.technolutions.net/docs/reader-overview.md), [Workflows](https://knowledge.technolutions.net/docs/workflows), [JHU guide](https://uis.jhu.edu/?p=34)).
- **Applicable to us:** our admission side is Excel import (per the BPM gap plan), so do not build a reader. Borrow the bin idea as filter tabs on every list screen ("Needs my action", "Waiting on student", "Ready for decision") and the "new since you last looked" marker.
- **Caveat:** pricing figures come from a third-party review and are an estimate only.

### 11. AIMS by Pinnacle Technologies (the Philippine system we import from)
- **What it is:** a web-based student information system used by many Philippine schools for admissions, enrollment, faculty loading, grading and graduation. Student portals expose grades, accounts, schedules and online registration ([Pinnacle](https://pinnacle.com.ph/home/?p=70), [Lyceum of Subic Bay portal guide](https://lsb.edu.ph/students/student-portal-guide), [UPOU](https://aseannale.upou.edu.ph/student)).
- **Applicable to us:** its portals show records, not thesis workflow, which is exactly the gap this project fills. Keep AIMS read-only and imported, as already decided in `AGENTS.md`.
- **Could not verify:** that USLS's AIMS is the Pinnacle product. Several unrelated products share the name. The UP Tacloban "AMIS" is a different system.

### 12. Philippine thesis-management tools and policy documents
- **DLSU Thesis Coordinator System (2017):** enlisting students in thesis courses, document and requirement submission, defense scheduling that reduces burden on advisers and panels, a searchable archive of titles, and an adviser-to-student forum. Roles: student, adviser, panel ([DLSU Animo Repository](https://animorepository.dlsu.edu.ph/faculty_research/773)). Related: a [DLSU-D thesis scheduling study](https://thesis.dlsud.edu.ph/3019/2/AmboyDuranaGito%20...%20-%20ThesisScheduling_Abstract.pdf) found manual scheduling took about a week per batch.
- **UPHSL (Biñan) defense evaluation system:** PHP/MySQL, panelists and advisers evaluate theses online ([UPHSL PDF](https://uphsl.edu.ph/research/r/cs/WEB-BASED%20THESIS%20CAPSTONE%20PROJECT%20DEFENSE%20EVALUATION%20SYSTEM%20OF%20THE%20CCS%20BI%C3%91AN.pdf)).
- **UP Diliman policy:** the thesis and dissertation checklist sets thesis panel size at 4 to 6 members and requires online-defense meeting details ([UP CSSP checklist](https://kssp.upd.edu.ph/images//Admissions/Graduate_Program/December_2023_Revised_GPO_Forms/Thesis_and_Dissertation_Checklist.pdf), [UP Education online-defense guidelines](https://educ.upd.edu.ph/wp-content/uploads/2020/05/Guidelines-on-Online-Defenses_Final_updated-May-18.pdf)).
- **Applicable to us:** a defense scheduler that finds common free time for adviser and panel, and a defense checklist with panel-size validation. Check our panel rules against USLS's own Graduate School Handbook, not UP's.
- **CHED:** I found no CHED-run graduate thesis or dissertation monitoring system. Search returned only CHED's FOI request logs. Do not cite CHED as having one.

---

## 2. Top 10 patterns to adopt (ranked by value for effort, for a near-finished capstone)

| # | Pattern | Seen in | Effort | Why now |
|---|---------|---------|--------|---------|
| 1 | **Stage stepper / milestone tracker** on the student dashboard: ordered milestones, current one highlighted, done/blocked/overdue states | Purdue, Northwestern, McGill, PatternFly stepper | Low | One component reused across all roles; reads instantly in a defense demo |
| 2 | **Per-role action queue** ("Needs my action") with deep links from email | Vanderbilt Action List, Slate bins | Low-Med | Turns many screens into one landing page per role |
| 3 | **Approve / Deny / Send Back with comment**, send-back target selectable, same widget everywhere | Vanderbilt, ProQuest member schools | Low | Makes every approval chain behave identically; easy to test |
| 4 | **One status-chip color map** applied to every table | Carbon, GOV.UK, Alberta (see section 3) | Low | Pure frontend consistency; no backend work |
| 5 | **Automatic reminders before milestone and deadline dates** (in-app first, email if SMTP exists) | McGill MyProgress | Low-Med | Directly answers the "deadline reminders" requirement |
| 6 | **Hard prerequisite gating** with a visible "cannot start yet: needs X" reason (e.g. no defense scheduling before adviser sign-off and ethics clearance) | Toronto sign-off rule, GOV.UK task list "cannot start yet" | Med | Prevents illegal states and gives a good demo story |
| 7 | **Record history / audit trail panel** on every case, plus "changed since you last viewed" marker | Slate record snapshot, Cayuse flags | Med | Likely partly present already (leave log, activity history); expose it consistently |
| 8 | **Standard data table**: sort, filter, paginate, column show/hide, export CSV | Vanderbilt documents list, shadcn data table | Low-Med | One shared component replaces ad-hoc tables |
| 9 | **Requirements-met vs remaining** audit view with on/off-track flag for advisers, fed by the AIMS import | Degree Works, Anthology | Med | Core to "course planning and enrollment monitoring" |
| 10 | **Annual progress review** form with adviser sign-off and a short rubric | Purdue, Northwestern, McGill | Med | Gives the analytics layer real structured data; defer if time is short |

**Defer or skip:** what-if audits, full repository publication and embargo pipeline, a Slate-style reader, e-signature vendor integration (a typed-name approval with timestamp and audit entry is enough; none of the sources above required a certified e-signature, and I did not research legal e-signature requirements in the Philippines).

---

## 3. UI consistency: design systems and dashboard patterns

None of the portals above publish their design system (Ellucian's, Slate's and Kuali's component libraries were not found in search). The most useful public references for the same patterns are below. All are framework-neutral guidance that can be implemented in Tailwind.

| Pattern | Recommendation | Reference |
|---------|----------------|-----------|
| **Status chips in tables** | Use one small non-clickable chip with short text, consistent type per status across the whole app, aligned in the same column. Do not make chips look like buttons. | [Alberta: show status in a table](https://design.alberta.ca/examples/show-status-in-a-table), [GOV.UK tag](https://design-system.service.gov.uk/components/tag/), [DWP status tag](https://design-system.dwp.gov.uk/design-for/status/examples/tag-status) |
| **Semantic colors** | Red critical, yellow warning, green success, blue info, grey neutral. Pair color with text or icon so it is not color-only. Show the highest-attention status when a row aggregates several. Skip an indicator when no action is needed. | [Carbon status indicator pattern](https://www.carbondesignsystem.com/patterns/status-indicator-pattern), [Red Hat tag guidelines](https://ux.redhat.com/elements/tag/guidelines) |
| **Tag vs badge vs chip** | Tag or chip for status and category, badge for counts (unread, pending), chip for filter/selection. | [Red Hat](https://ux.redhat.com/elements/tag/guidelines) |
| **Milestone checklist** | Group related steps into named tasks, show a status per task (Completed, In progress, Not yet started, Cannot start yet, There is a problem), and show it at the start of every returning session. | [GOV.UK complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) |
| **Stepper / timeline** | Vertical or compact stepper; variants default, success, info, pending, warning, danger; mark the current step; give the icon an accessible label. | [PatternFly progress stepper](https://www.patternfly.org/components/progress-stepper) |
| **Data table** | Sorting from the column header, text filter, pagination (10 default), row selection, column visibility menu, row actions. Build on TanStack Table. | [shadcn/ui data table](https://ui.shadcn.com/docs/components/data-table) |

Practical consequence for the React/Tailwind SPA: create `StatusChip`, `Stepper`, `DataTable` and `DecisionPanel` (approve / deny / send back) components once, define the status-to-color map in one file, and replace screen-local variants. The repo's `ui-ux-pro-max` skill should be loaded when doing this, per `CLAUDE.md`.

---

## 4. What I could not verify

- **Atlassian lozenge guidance:** both URLs tried returned a 404 or empty page. Not cited.
- **Ellucian Design System, Slate and Kuali component libraries:** not found.
- **Kuali Student** graduate-milestone product: not found; only Kuali Build and Kuali Research results.
- **Degree Works feature list:** assembled from university pages and vendor material; the official PDF could not be read.
- **Slate pricing, customer counts:** third-party figures that disagree between sources.
- **Vireo current release date and status:** the GitHub page shows version 4.3.3 in build instructions but no release dates; at least one member site (East Carolina) reported a 2024 upgrade outage.
- **CHED or any Philippine regulator's graduate monitoring portal:** none found.
- **Whether USLS's AIMS is Pinnacle's product.**
- **Reminder features** in Northwestern GSP and in Cayuse/Kuali ethics modules: not described in the pages I read.
