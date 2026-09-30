# Live check notes (headless Edge on the scratch database, port 5072)

How: `DATABASE_URL=sqlite:///E:/Temp/claude/usls-check/check.sqlite3 FLASK_PORT=5072 .venv/Scripts/python.exe app.py`,
then `E:/Temp/claude/usls-check/shots.py` (Playwright, `channel="msedge"`) logs in per role
and screenshots routes. Port 5061 is on Chromium's blocked-port list — do not use it.

## 2026-10-01, after merging health, monitor, portals, panel, docs, opsmanual

No page errors or console errors on 15 routes across student, dean, faculty, staff.
All four roles now show the same shell (sidebar groups, breadcrumb, user chip).

To fix later (polish packet):
- Faculty dashboard "Upcoming defenses" lists defenses with status Finished and
  dates in the past — should show only future ones (calendar packet).
- Student dashboard stat card "Research" prints a long status ("Pending Staff
  Action") in the large number font, wrapping to three lines — use a badge.
- Student LOA page text is technical ("No PDF upload or RAG document extraction
  is required", "Staff run a deterministic checklist") — plain wording (LOA
  rebuild packet).
- Student header chip shows the demo persona label ("Research Gate, Panel
  Matching, Defense Scheduling Demo") — should be program/role, not demo text.
