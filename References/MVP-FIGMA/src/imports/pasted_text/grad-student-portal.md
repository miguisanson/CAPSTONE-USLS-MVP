Create a **desktop-first responsive web app frontend** for an existing capstone MVP called:

**Graduate Student Lifecycle Monitoring and Analytics Platform**

This is for the **University of St. La Salle Graduate School**.

Important positioning:
- This is a **web-based internal portal**, not a native mobile app.
- It is **not** a marketing website, landing page, public admissions site, or student social platform.
- It is **not** a full Student Information System replacement.
- It is a **monitoring, workflow, analytics, and decision-support layer** for graduate student progress.
- The output must look like a **real internal university operations system** used daily by staff and academic stakeholders.
- The design should be **desktop-first**, but it must also support **responsive mobile web layouts** for smaller screens.
- Mobile support should still feel like a **web app / portal**, not like iOS or Android native app screens.

## Core output goal
Design a polished, professional, academic, institutional, modern frontend layout that improves the current MVP’s visual hierarchy, typography, spacing, consistency, and usability while preserving the actual modules and workflows of the live system.

The result should feel like:
- a credible graduate school operations dashboard
- a structured academic workflow portal
- a clean administrative system with analytics and traceability
- implementation-friendly for a real React + Tailwind build

## Very important layout direction
Generate this as a **desktop web portal first**:
- wide desktop layouts
- browser-style pages
- fixed top header
- collapsible left sidebar
- structured content area
- dashboard cards
- data tables
- filters
- tabs
- side panels / drawers
- detail sections
- report layouts

Do **not** design this as:
- a phone app
- a mobile-first single-column app
- a marketing homepage
- a startup SaaS landing page
- a chat-first product
- a consumer-style dashboard

For responsiveness:
- create a **desktop-first system**
- then adapt key screens into **responsive mobile web layouts**
- mobile should keep the same information architecture where possible
- use responsive collapsing, stacking, drawers, tabs, and progressive disclosure
- do not convert the UI into native-app-looking screens

## Product identity and purpose
Project name:
**Graduate Student Lifecycle Monitoring and Analytics Platform**

Purpose:
- track graduate students across the academic and research lifecycle
- show stage progression, milestones, task ownership, overdue work, alerts, document revisions, scheduling status, analytics, and audit history
- support operational decision-making for graduate school staff, coordinators, advisers, panel members, and students
- provide descriptive analytics and prescriptive decision support
- maintain accountability, compliance, and access control through role-based access and audit logs

## Real user roles
Support these user roles in the design:
- Admin
- Graduate School Staff
- Academic Coordinator
- Research Coordinator
- Adviser
- Panel Member
- Student

## Role-based behavior that must influence the UI
- **Admin** sees everything, including analytics, audit logs, thresholds, routing rules, milestone definitions, and user management
- **Graduate School Staff** and **Coordinators** see broad operational dashboards, queues, alerts, analytics, and audit logs
- **Advisers** see assigned students and can update stages and milestones for assigned cases and provide revision feedback
- **Panel Members** focus on assigned review tasks, documents, comments, and decision submission
- **Students** only see their own records and self-service actions
- **Analytics** and **Audit Log** are only visible to Admin, Graduate School Staff, Academic Coordinator, and Research Coordinator
- **Admin Config** is only visible to Admin
- the Students page becomes **self-only** when viewed by a Student
- task decisions are available for Admin, Staff, Coordinators, Adviser, and Panel
- stage and milestone updates are available for Admin, Staff, Coordinators, and Adviser
- scheduling outcome updates are restricted to Admin, Staff, and Coordinators
- document checklist creation is restricted to Admin, Staff, Coordinators, and Adviser
- document uploads are available to Admin, Staff, Coordinators, Adviser, and Student
- document comments are available to Admin, Staff, Coordinators, Adviser, and Panel

## Lifecycle stages that must be visible and easy to scan
- Admission
- Coursework
- Proposal Development
- Proposal Defense
- Data Collection
- Dissertation Writing
- Oral Defense
- LOA
- Completed

## Core workflow concepts that must show clearly in the frontend
- each student belongs to a program and moves through lifecycle stages
- each stage has milestone definitions and milestone statuses
- tasks are assigned to roles or users and can be pending, in progress, completed, or overdue
- task decisions are Approve, Revise, or Return
- routing rules determine the next owner after a decision
- alerts are triggered by monitoring rules such as prolonged stage time, unresolved handoff, delayed scheduling, and inactivity
- alerts can have interventions, notifications, and closure evidence
- documents support checklist records, multiple versions, revision notes, and comments
- scheduling supports requests, participant availability, and confirmed/rescheduled/cancelled events
- analytics show descriptive metrics and prescriptive recommendations
- audit log is append-only and records actions like login, create, update, denied access, decisions, config changes, and alerts

## Main pages that must exist in the frontend
1. Login Page
2. Dashboard
3. Students List
4. Student Profile
5. Task Queue
6. Documents
7. Scheduling
8. Monitoring Alerts
9. Analytics
10. Printable Analytics Report
11. Audit Log
12. Admin Configuration
13. Not Found Page

## Main product modules represented by the frontend
- Student monitoring
- Milestone tracking
- Workflow task queue
- Decision routing
- Document and revision management
- Defense scheduling
- Monitoring alerts and interventions
- Descriptive analytics
- Prescriptive decision support
- Audit trail
- Admin configuration

## Visual direction
The product should look:
- academic
- institutional
- professional
- structured
- modern
- credible
- calm
- operational
- implementation-ready

Avoid:
- playful visuals
- overly trendy startup styling
- overly generic SaaS templates
- excessive illustration
- noisy gradients
- neon accents
- overly dark interface
- casual social-app energy

## Brand colors
Use the school colors as the design foundation:

Primary school green:
- HEX: #006633

White:
- HEX: #FFFFFF

Support with:
- dark slate / charcoal text
- muted gray borders
- soft neutral section backgrounds
- restrained warning, success, and danger colors for statuses

Suggested usage:
- green for primary actions, active navigation, progress highlights, selected tabs, important badges, and section accents
- white for major surfaces, cards, containers, forms, and report areas
- neutral grays for borders, dividers, table lines, subtle backgrounds, disabled states, and secondary UI
- keep the overall design bright, clean, and professional

Optional supporting palette direction:
- dark green for hover/pressed states
- soft green tint for selected cards or filters
- slate text for labels and dense tabular content
- muted red for risk or overdue
- muted amber for warning states
- muted blue only if needed for informational states

## Typography direction
Typography must feel **more academic, formal, and refined** than a generic dashboard.

Use this font direction:
- **Primary font direction: Source Sans Pro**
- fallback direction: Segoe UI, system sans-serif
- avoid playful, rounded, bubbly, or trendy startup fonts
- do not use typography that feels mobile-app-like

Typography goals:
- readable in dense tables and admin forms
- clear hierarchy across page titles, section titles, card headings, labels, metadata, filters, and table rows
- slightly more formal and academic than a consumer dashboard
- strong spacing and alignment
- good legibility for long lists, timelines, reports, and checklists

## Existing frontend feel to improve
The current app is functional but minimal and visually flat.
Improve these areas:
- typography hierarchy
- spacing consistency
- sidebar/header polish
- stronger card and table system
- better filter and form layout
- better badge and status language
- more cohesive visual identity
- less repetitive white-card sameness
- stronger distinction between overview screens, detail pages, workflows, and reports

## Layout system
Use a desktop layout similar to a real admin portal:
- fixed top header
- collapsible left sidebar
- max content width around 1600px
- dashboard grid layouts
- card groups
- table-heavy operational screens
- detail pages with summary header + sections
- responsive breakpoints for tablet and mobile web
- sticky filter bars where helpful
- side drawers or slide-over panels where useful
- print-friendly layout for analytics report

## Navigation structure
Left sidebar navigation:
- Dashboard
- Students
- Task Queue
- Documents
- Scheduling
- Alerts
- Analytics
- Audit Log
- Admin Config

Header elements:
- page title
- breadcrumb or module context
- global search or quick search
- notifications
- role badge or workspace indicator
- user profile menu
- optional academic term selector if useful

## What the UI must make immediately scannable
Across the system, clearly surface:
- current stage
- milestone completion
- risk flag
- overdue status
- next owner
- next step
- task priority
- queue aging
- intervention status
- scheduling status
- document revision status
- auditability

## Use realistic academic mock data
Programs:
- MS Computer Science
- MA Education
- MBA
- PhD Engineering

Example milestone labels:
- Admission Documents Complete
- Course Plan Approved
- Proposal Draft Submitted
- Panel Pre-Review Complete
- Proposal Defense Completed
- Data Collection Ethics Clearance
- Draft Chapters Submitted
- Final Oral Defense Schedule

Example alert types:
- Prolonged Stage
- Unresolved Handoff
- Delayed Scheduling
- Inactivity

Example decision actions:
- Approve
- Revise
- Return

Use realistic seeded workflow examples in the UI:
- overdue proposal review task for a student in proposal development
- pending student revision task in data collection
- panel pre-review decision task in proposal defense
- oral defense scheduling task for staff
- overdue LOA-related review
- proposal manuscript documents with multiple versions and revision notes
- prolonged stage alert for data collection
- unresolved handoff alert for overdue proposal review
- inactivity alert
- scheduling cases with availability and reschedule history

Use example threshold labels and logic references where helpful:
- Task Escalation Days = 7
- Unresolved Handoff Days = 5
- Delayed Scheduling Days = 10
- Inactivity Days = 14
- Stage Proposal Development = 50
- Stage Data Collection = 75
- Stage Dissertation Writing = 45

Use routing examples where helpful:
- Proposal Development + Revise -> next owner Student
- Proposal Defense + Return -> next owner Adviser
- Dissertation Writing + Revise -> next owner Student

## Assistant / AI behavior
Include an **MCP Decision Support Assistant** as a secondary feature only.

It should appear as:
- a docked action button
- a contextual side drawer
- or a compact assistant panel

It must:
- remain advisory only
- summarize rules and context
- suggest next actions
- explain recommendations
- never auto-update the database
- never dominate the interface
- never feel autonomous
- never replace the main operational workflow

AI outputs should be framed as:
- policy-grounded
- rule-based decision support
- de-identified and aggregated when appropriate
- supportive of staff decisions, not a replacement for human judgment

## Security and compliance tone
The interface must feel:
- credible
- structured
- accountable
- professional
- operational
- protected

This is an institutional academic system with:
- enforced role-based access
- access-denied logging
- append-only audit log
- protected document downloads
- notification flows that direct users back into the portal

Reflect this tone in the design:
- no casual messaging-app patterns
- no over-friendly consumer tone
- no risky “AI autopilot” language
- no design that implies open public access

## Required components / design system
Create a cohesive frontend component system with:
- KPI cards
- dashboard summary cards
- metric tiles
- tables
- filter bars
- search inputs
- tabs
- dropdown filters
- status badges
- stage badges
- risk badges
- milestone checklist rows
- task cards
- decision action bars
- alert cards
- intervention timeline items
- document version rows
- revision note blocks
- comment threads
- schedule availability chips
- summary side panels
- drawers
- empty states
- restricted-access states
- pagination
- printable report layout
- desktop and mobile responsive variants

## Required page details

### 1. Login Page
Design a polished internal portal login page:
- academic and professional
- desktop-first
- clean sign-in panel
- school green used in buttons and brand accents
- simple, credible, modern
- not flashy
- optional subtle academic admin portal background or split layout
- no large hero marketing section

### 2. Dashboard
Create a true operational dashboard:
- KPI cards for students in scope, my open tasks, overdue tasks, and open alerts
- priority task snapshot
- students by lifecycle stage
- at-risk students summary
- upcoming defense schedules
- recommended actions
- queue visibility
- operational overview feel
- should feel like a graduate school command center, not generic analytics cards only

### 3. Students List
Create a filterable student lifecycle index:
- search bar
- filters for stage, program, risk, owner
- readable dense table or hybrid table/list
- columns like student name, program, current stage, risk flag, milestone status, next owner, last updated
- row actions or row detail access
- desktop-first table layout
- responsive mobile web adaptation can stack or simplify columns intelligently

### 4. Student Profile
This should be one of the strongest screens.
Design a detailed case-management page with:
- summary header
- current stage
- risk flag
- program and student details
- stage progress tracker
- milestone checklist
- stage update form
- assigned adviser and panel
- open tasks
- next owner / next step
- timeline/history
- supporting records
- recent documents
- alerts/interventions snapshot
- clear accountability and progression

### 5. Task Queue
Design for both:
- My Tasks
- Team Queue

Show:
- due date
- age
- priority score
- student
- stage
- owner
- recommended action
- urgency
- decision submission controls
- Approve / Revise / Return actions
- overdue indicators that stand out clearly but professionally

### 6. Documents
Design a controlled academic document workflow page:
- student context header
- checklist items
- upload area
- multiple versions
- download access
- revision history
- revision notes
- reviewer comments
- document status
- ownership and timestamps
- should feel protected, accountable, and review-oriented

### 7. Scheduling
Design a structured defense scheduling workflow with a clear 3-step feel:
1. request defense schedule
2. collect participant availability
3. confirm / reschedule / cancel outcome

Show:
- participants
- role labels
- availability chips
- preferred dates
- conflicts
- outcome states
- final scheduled event summary
- scheduling history
- should feel like academic coordination, not consumer event booking

### 8. Monitoring Alerts
Design an alerts page that feels serious and operational:
- Run Monitoring Cycle action
- filter by alert type and status
- alert cards or alert table
- assigned handler
- alert age
- intervention history
- notifications
- closure evidence
- make prolonged stage, unresolved handoff, delayed scheduling, and inactivity easy to distinguish

### 9. Analytics
Design descriptive analytics plus prescriptive decision support:
- counts by stage
- pending queue distribution
- aging / time in stage
- scheduling cycle time
- LOA visibility
- workload indicators
- recommendations section clearly labeled as advisory
- export CSV action
- entry point to printable analytics report
- charts should be clean and presentation-ready
- keep analytics institutional and decision-support oriented, not flashy BI theater

### 10. Printable Analytics Report
Design a clean print-focused report page:
- executive summary feel
- clear metrics and charts
- limited chrome
- paper/PDF-friendly
- formal academic admin reporting tone
- should still visually align with the portal

### 11. Audit Log
Design an append-only accountability page:
- filterable table
- actor
- action
- entity
- description
- role
- date/time
- pagination
- high readability
- compliance-aware tone
- suitable for dense operational records

### 12. Admin Configuration
Design a settings-heavy but polished admin area with tabs for:
- milestone definitions
- alert thresholds
- routing rules
- user management

The UI should feel:
- clearly administrative
- controlled
- structured
- safe
- not cluttered despite density

### 13. Not Found Page
Simple, clean, professional:
- consistent with the rest of the portal
- easy return to dashboard
- no playful or joke-heavy copy

## Mobile web support note
This project should also support mobile **as a responsive web app**, but not as a native app.
Design the system so that on smaller screens:
- sidebar becomes a collapsible drawer
- dense tables become stacked cards or horizontally scrollable tables where appropriate
- filters collapse into drawers or accordions
- page sections reflow vertically
- detail pages remain readable without losing hierarchy
- key task actions remain reachable
- analytics simplify gracefully
- the system still looks like a web portal, not a phone app

Prioritize:
- desktop web first
- tablet web second
- mobile web third

## Technical implementation friendliness
Make the frontend structure realistic for:
- React
- TypeScript
- Vite
- Tailwind CSS
- Chart.js

No need to imitate any external component library.
Use a clean in-house design system approach.

## Hard constraints
Do not:
- generate phone-app-looking screens as the main result
- make this a landing page
- make it public-facing
- add unrelated modules such as finance, tuition, admissions CRM, messaging app, or social feed
- make the AI assistant the main focus
- make it overly playful
- make it feel like startup SaaS
- make student views look like admin control surfaces
- imply that AI can automatically approve or change records

## Final quality bar
The final design should look like:
- a real graduate school internal operations portal
- academically credible
- visually more refined than the current MVP
- stronger in typography, spacing, hierarchy, and information design
- suitable for presentation, capstone demonstration, and eventual frontend implementation

Create:
- a cohesive design system
- polished desktop web layouts
- responsive mobile web adaptations
- realistic academic mock data
- a professional academic operations dashboard feel
- clean frontend structure that could realistically be implemented