# USLS Graduate Student Lifecycle Monitoring & Analytics Platform

## Application Overview

The platform consolidates graduate-student records, enrollment and course monitoring, leave and readmission requests, research milestones, panel matching, defense scheduling, practicum, withdrawal, graduation review, role-based work queues, and auditable workflow history. The backend is a Flask JSON API with SQLite by default and optional MySQL support. The frontend is a React, Vite, and Tailwind CSS single-page application.

## Development Change List

- **March 2, 2026 (Monday) - Initial repository and platform foundation:** Created the first project versions, established the application and database files, imported the initial working data, and added Linux compatibility fixes.
- **March 3, 2026 (Tuesday) - Server application reset:** Removed the sample application, replaced it with the server-derived project, and established the new application baseline and repository ignore rules.
- **March 22, 2026 (Sunday) - MVP website update:** Expanded the early MVP, updated the website structure, and applied the first consolidated fixes to the working interface.
- **May 25, 2026 (Monday) - Runtime cleanup:** Merged the active MVP work, tidied the repository, and corrected the application startup and run configuration.
- **May 28, 2026 (Thursday) - Setup documentation:** Updated the project README with the current installation and usage instructions.
- **June 3, 2026 (Wednesday) - Reset and archive checkpoint:** Preserved the pre-reset state, rebuilt the working baseline, and archived the prior project package for recovery.
- **June 4, 2026 (Thursday) - Interface redesign:** Introduced the redesigned web interface and the visual foundation used by the current staff-facing application.
- **June 8, 2026 (Monday) - Search, filters, decision support, and handoff upload:** Removed visible priority numbers, improved list search and filtering, added the first decision-support sample, and added student-handoff file upload support.
- **June 10, 2026 (Wednesday) - Installation workflow:** Added the installation and local setup workflow used to prepare the application dependencies.
- **June 11, 2026 (Thursday) - Student lifecycle records:** Added student and course records, expanded lifecycle handling, and introduced staff-side Leave of Absence and readmission processing.
- **June 14, 2026 (Sunday) - Authentication and student access:** Added user accounts, role-aware authentication, and the initial student-facing experience.
- **June 15, 2026 (Monday) - UX and defense scheduling:** Applied interface improvements, revised defense scheduling, restored the standard package configuration, and merged the active role and workflow branches.
- **June 16, 2026 (Tuesday) - Consolidated application baseline:** Combined the latest approved changes into the next stable development checkpoint.
- **June 18, 2026 (Thursday) - Operational dashboards and advanced workflows:** Added dashboard support for practicum, withdrawal, and graduation; expanded faculty, panel matching, and Google Calendar scheduling work; and added monitoring-sheet filters and duplicate checks.
- **June 21, 2026 (Sunday) - Research and faculty workflow expansion:** Updated faculty records, research-gate handling, panel matching, and defense-scheduling integration.
- **June 22, 2026 (Monday) - Monitoring and academic planning merge:** Merged the active development branches, cleaned the repository, preserved local branch references, and added course-adjustment and curriculum-planning updates.
- **June 24, 2026 (Wednesday) - Integration fixes:** Applied follow-up fixes after the academic-planning and workflow merge.
- **June 25, 2026 (Thursday) - Course Audit:** Expanded Course Audit behavior and staff handling for student course completion records.
- **June 26, 2026 (Friday) - BPM, RAG, faculty portal, and research ownership:** Updated the Academic Coordinator research-gate role, merged the BPM workflow and messaging work, added the policy RAG assistant, added Faculty login and the Faculty Portal, and consolidated course-drop and grade workflow support.
- **June 27, 2026 (Saturday) - Academic-period planning and UX:** Added active academic-period selection for course adjustment and curriculum planning, then applied supporting interface refinements.
- **June 30, 2026 (Tuesday) - LOA and readmission roster views:** Added withdrawal-style Board and Table views, status columns, search and status filters, and click-through request review for Leave of Absence and readmission.
- **July 1, 2026 (Wednesday) - Document and policy RAG:** Added concept-paper and Leave of Absence policy checks, then refined RAG behavior and research-gate handling.
- **July 5, 2026 (Sunday) - Research, scheduling, and monitoring fixes:** Corrected research-gate and defense-scheduling behavior and updated the monitoring sheet.
- **July 6, 2026 (Monday) - Semester model and student request forms:** Changed the visible academic calendar from trimester/term wording to semesters and added student LOA/readmission forms with controlled semester selection.
- **July 6, 2026 (Monday) - Dean-owned LOA and readmission decisions:** Removed the staff-side Dean decision control, limited staff to reviewing and forwarding requests, moved approve/deny/return actions to the Dean, restored the LOA/readmission Board and Table switch, kept forwarded and decided requests visible as read-only staff history, removed the unneeded Semester Management page, and standardized visible semester wording across the application.
- **July 6, 2026 (Monday) - Incomplete alerts, AWOL return, and residency management:** Added student Inbox alerts when an INC is recorded or resolved; added a periodic deadline scheduler and the handbook one-year lapse result (3.0 master's / 2.0 doctorate, no credit, Retake Required); added the AWOL & Residency Board/Table workflow; added student written return-intent submission; routed return decisions to the Dean; applied master's 5/7-year and doctorate 7/9-year residence classifications with refresher or full re-enrollment escalation; and added handbook-grounded policy review for valid residency without subjects.
