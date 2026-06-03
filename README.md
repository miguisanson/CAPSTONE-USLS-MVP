# USLS Graduate School Python Demo

Small Monday-demo version of the Graduate School lifecycle monitoring system.
The old prototype was removed; this version is Python + MySQL and focuses on six working workflows.

## What It Does

The app demonstrates how Graduate School records move through workflow-based monitoring:

1. Student Handoff
2. LOA / Readmission Decision
3. Course Audit
4. Research Gate Readiness
5. Panel Matching
6. Defense Scheduling

Each workflow writes to SQL-backed records such as students, enrollment standing, course evidence, document checks, panel assignments, schedule requests, tasks, and activity logs.

The workflows are not just log entries. Each one performs its action:

- Student Handoff creates the monitoring record and compares received onboarding evidence.
- LOA / Readmission checks request facts or submitted evidence before updating standing.
- Course Audit maps course records against curriculum requirements.
- Research Gate Readiness compares submitted Form 1/Form 4/final/completion evidence with the school protocol.
- Panel Matching assigns the required panel roles using specialization, availability, and workload.
- Defense Scheduling checks panel availability and protocol lead-time rules before confirming.

## Requirements

- Python 3.11+
- MySQL 8 running locally
- MySQL root password set to `1234` or update `.env`

Current database setting:

```env
DATABASE_URL=mysql+pymysql://root:1234@localhost:3306/usls_gs_demo
```

## Run The Demo

From the project folder:

```powershell
.\run_demo.ps1
```

Or, if you prefer the old command:

```powershell
npm run dev
```

Open:

```text
http://localhost:5000
```

## Refresh Demo Data

This resets the MySQL demo database and creates synthetic USLS Graduate School data:

```powershell
python app.py --seed
```

By default it creates 350 students plus related course records, document checks, tasks, panels, schedules, and activity logs. Change `DEMO_SEED_COUNT` in `.env` if you want 200-500 records.

## Project Structure

```text
CAPSTONE-USLS-MVP/
  app.py              Flask app, SQL models, workflow handlers, seed data
  templates/          HTML pages for the guide and workflows
  static/styles.css   Demo UI styling
  Documents/          Proposal, meeting notes, school forms, and workflow source docs
  run_demo.ps1        Installs Python packages, seeds MySQL, starts the app
  requirements.txt    Python dependencies
```

## Demo Script

Use the home page as the documentation guide. A simple walkthrough is:

1. Open Student Handoff and create one new student.
2. Open Course Audit for that student and mark one subject missing or completed.
3. Open Research Gate Readiness and record missing Form 1/Form 4 items.
4. Open Panel Matching and save the recommended panel.
5. Open Defense Scheduling and try a preferred date.
6. Return to the home page to show updated indicators, tasks, and activity events.
