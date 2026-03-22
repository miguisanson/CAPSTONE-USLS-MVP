Update the full USLS Graduate School Monitoring and Analytics web app so that Quick Insights and Recommended Actions work together consistently across the entire platform.

Important:
This is for the University of St. La Salle Graduate School monitoring system.
Keep the academic workflow context and existing modules.
Do not turn this into a chatbot.
Do not create a conversation UI.
Do not create a floating AI chat bubble.
Do not create a separate AI assistant page.
Keep the current academic web app tone and USLS visual identity.

Main intent:
I want TWO clearly separate but complementary layers:

1. Quick Insights
- local to the selected card, chart, table, panel, or module section
- explains only that specific section
- helps users understand what they are currently looking at

2. Recommended Actions
- page-level prescriptive analytics summary
- summarizes the most important actions for the current page as a whole
- gives a higher-level view of what needs attention now

These two must work hand in hand.

Do NOT remove Recommended Actions.
Do NOT make Recommended Actions replace Quick Insights.
Do NOT make Quick Insights replace Recommended Actions.

QUICK INSIGHTS REQUIREMENTS

Quick Insights should be section-specific only.
That means:
- when I click Quick Insights for a chart, it explains that chart only
- when I click Quick Insights for a KPI card, it explains that KPI card only
- when I click Quick Insights for a scheduling block, it explains that scheduling block only
- when I click Quick Insights for a document section, it explains that document section only

Quick Insights is NOT the page-level recommendation engine.
It is contextual help and interpretation for the selected section only.

Standardize Quick Insights across the FULL web app:
- every meaningful card should have it
- every meaningful chart should have it
- every meaningful section should have it
- every meaningful table/panel/module block should have it
- do not leave some sections with it and others without it

Example:
- if Dashboard has Quick Insights on one chart, all equivalent charts/cards/sections should also have it
- Upcoming Defense Schedules must also have Quick Insights
- Students by Program must also have Quick Insights
- Priority Tasks must also have Quick Insights
- Open Alerts, Overdue Tasks, KPI cards, analytics charts, and other similar sections must also have Quick Insights

Quick Insights visual style:
- use one consistent icon-only trigger
- use the same reusable component everywhere
- same icon
- same size
- same placement logic
- same hover/focus/active states
- same visual treatment
- same accessibility behavior

Do not mix:
- some sections with icon only
- some sections with text button
- some sections with green info icon
- some sections with other labels

If the trigger serves the same purpose, make it the same component everywhere.

Use USLS style:
- primary green: #006633
- white for contrast where needed
- professional academic styling
- subtle and consistent
- not flashy
- not playful

RECOMMENDED ACTIONS REQUIREMENTS

Bring back and keep the older style of the prescriptive recommendations section because I liked how it was done before.

However:
- do NOT call it “Prescriptive Recommendations”
- do NOT call it different names on different pages
- use one title only across the FULL web app:

Recommended Actions

This title must be consistent everywhere.
If a page currently says:
- Prescriptive Recommendations
- AI Recommendations
- Suggested Actions
- Recommendation Summary
or any other variation,
rename it to:
Recommended Actions

Naming rule:
Use “Recommended Actions” across all pages and modules consistently.

Design rule for Recommended Actions:
Keep the current prescriptive-summary concept and layout style that was previously used.
I like how it currently works as a page-level summary.
Do not remove that concept.
Do not overly redesign it into something else.
Instead:
- preserve its purpose as the page-level prescriptive analytics summary
- polish it for consistency
- align it with the rest of the system
- keep it clearly distinct from Quick Insights

Recommended Actions should:
- summarize the top recommended actions for the whole current page
- reflect the most important priorities from that page’s data
- remain advisory only
- feel like a clear page-level prescriptive layer
- be easy to scan
- point toward what needs attention next

Examples:
Dashboard:
- summarize highest-priority academic workflow actions across the dashboard
- overdue review tasks
- delayed scheduling
- at-risk students
- inactivity follow-up
- prolonged stage cases

Analytics:
- summarize key actions suggested by the analytics on that page
- not just explain graphs, but give a higher-level page summary
- still title it Recommended Actions, not Prescriptive Recommendations

Students page:
- summarize which groups of students or flagged records need attention

Student Profile:
- summarize the most important next actions for that specific student case

Task Queue:
- summarize the highest-priority queue actions or escalations

Documents:
- summarize the biggest document-related blockers or next review actions

Scheduling:
- summarize the most important scheduling follow-ups

Quick Insights vs Recommended Actions distinction:
Make this separation very clear in the UI and logic:

Quick Insights:
- local
- contextual
- section-specific
- explains one selected card/module/section only

Recommended Actions:
- page-wide
- prescriptive summary
- synthesizes the current page into top actions
- sits as a visible page-level summary section

They must complement each other:
- Quick Insights explains a specific section
- Recommended Actions summarizes the whole page

FULL APP APPLICATION

Apply this consistently across the FULL web app, not only Dashboard and Analytics.

Core academic pages:
- Dashboard
- Students
- Student Profile
- Task Queue
- Documents
- Scheduling
- Monitoring Alerts
- Analytics
- Audit Log
- Admin Configuration

Platform pages as appropriate:
- Account & Preferences
- Security & Sessions
- System Operations
- Monitoring Settings
- Runbooks
- Incident History
- Notification Operations
- Backup & Retention
- Platform Administration
- Help / Glossary / Policy References

For every page:
- add Quick Insights to every meaningful section possible
- keep or add Recommended Actions wherever a page-level prescriptive summary makes sense
- make the naming consistent everywhere
- do not use different recommendation labels on different pages

CONTENT REQUIREMENTS

All Quick Insights and Recommended Actions content must stay aligned with the USLS graduate school monitoring domain, such as:
- graduate student lifecycle stages
- coursework
- proposal development
- proposal defense
- data collection
- dissertation writing
- oral defense
- milestone completion
- adviser follow-up
- panel review
- document revisions
- inactivity monitoring
- prolonged stage alerts
- delayed scheduling
- overdue tasks
- academic intervention
- graduate school operations
- audit and accountability

Avoid generic business intelligence wording when academic monitoring language is more appropriate.

DESIGN REQUIREMENTS

Maintain:
- USLS green-and-white institutional style
- professional academic tone
- desktop-first responsive web app feel
- consistent spacing
- readable hierarchy
- implementation-friendly layout

Do not:
- make it look like a generic startup SaaS
- make it flashy
- make it chatbot-like
- make Quick Insights and Recommended Actions feel redundant
- remove the current page-summary idea I liked

TECHNICAL REQUIREMENT

Refactor the implementation into:
1. one universal Quick Insights trigger/component for local section help
2. one reusable Recommended Actions page-level component pattern

Then apply both consistently through the full application.

Expected final result:
- every meaningful card/section has Quick Insights
- Quick Insights explains only that selected section
- Recommended Actions exists as the full-page prescriptive summary
- “Recommended Actions” is the only title used everywhere
- no page uses “Prescriptive Recommendations” anymore
- Quick Insights and Recommended Actions work together clearly and consistently across the full USLS Graduate School Monitoring and Analytics web app