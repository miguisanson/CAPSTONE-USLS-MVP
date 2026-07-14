# Temporary Change Notes - 2026-07-14

Branch: `v3.5-migui`

> Temporary coworker update notes. Keep adding one simplified bullet for each change made during this session/branch work.
>
> Attribution note: Git records one commit today (`initial installation`, by `miguisanson`). The remaining changes are uncommitted and have no author metadata, so Git cannot prove which were made by Claude versus another editor. The "Claude/current branch work" section therefore summarizes all pre-existing uncommitted changes found when Codex reviewed the branch.

## Changes made in this Codex session

- **What:** Made the Course Adjustments page title match the left navigation. **When:** 2026-07-14. **How:** Changed the on-screen heading from "Course demand" to "Course Adjustments" in `frontend/src/pages/CourseAdjustments.jsx`.
- **What:** Added this temporary team-update notepad. **When:** 2026-07-14. **How:** Reviewed today's Git history and the current branch diff, then summarized the visible changes in a coworker-friendly format.
- **What:** Updated the project changelog with teammates' recent work and ownership. **When:** 2026-07-14. **How:** Added the July 12-14 commits with summaries, commit links, verified GitHub commit-owner links, and an attribution reference that leaves uncommitted work unassigned.

## Pre-existing uncommitted branch changes (Claude/current branch work reviewed)

- **What:** Cleaned up and corrected the end-to-end demo materials. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Updated Andrea Villanueva's demo login and canonical `Student_A` file paths in the demo script, removed duplicate sample PDFs/spreadsheets and a temporary Word lock file, and added a BPM gap/implementation plan.
- **What:** Removed the Registrar as an in-app user and workflow owner. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Removed Registrar role access, navigation, login/demo account, message recipient, work-queue ownership, backend routing, and related test setup across the backend and frontend.
- **What:** Simplified withdrawal completion. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Replaced Registrar fee/record steps with requirements verification followed by final Graduate School Staff confirmation; updated statuses, timelines, screens, guidance, and tests.
- **What:** Made graduation export the final in-app step. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Removed Registrar receipt recording and changed the final stage to an external endorsement export across backend logic, student/staff/dean screens, timelines, and tests.
- **What:** Added defense-panel reassignment during scheduling. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Exposed the eligible faculty directory from the backend and added a "Change panel" interface that validates unique faculty selections, updates official panel assignments, and recomputes scheduling availability.
- **What:** Redesigned the Faculty Portal around consistent navigation. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Added the shared left sidebar, separate Overview, Class Grades, Advisees & Research, Panel Assignments, and My Availability views, plus clickable overview statistics and grade alerts.
- **What:** Added a frontend development launch configuration. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Added an `npm --prefix frontend run dev` launch entry on port 5173 to `.claude/launch.json`.
- **What:** Updated BPM workflow regression coverage for the revised role boundaries. **When:** Present in the uncommitted branch diff reviewed on 2026-07-14. **How:** Removed Registrar test clients/actions and changed withdrawal and graduation assertions to verify Graduate School Staff completion and external export behavior.

## Commit recorded today

- **What:** Created the branch's recorded starting commit. **When:** 2026-07-14 at 10:59:47 +08:00. **How:** Commit `393710a` was recorded as "initial installation" by `miguisanson`.
