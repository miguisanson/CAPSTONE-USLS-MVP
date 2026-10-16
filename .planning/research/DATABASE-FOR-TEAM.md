# Fixing "everyone's database is different"

**Project:** USLS Graduate School Lifecycle Monitoring & Analytics Platform
**Researched:** 2026-10-17 (free-tier numbers fetched from vendor pages that day unless noted)
**Overall confidence:** HIGH for the local findings (I ran them), MEDIUM for free-tier limits (vendors change them often; re-check before relying on any).

## 1. Recommendation (read this first)

1. **Make SQLite the single team and demo database.** `resolve_database_url()` in `app.py` already defaults to a SQLite file when `DATABASE_URL` is unset. Every developer deletes `DATABASE_URL` from their `.env` and uses that.
2. **Make one command produce one dataset.** Today there are two different "seed" paths that give different data (proven in section 2). Merge them into a single `npm run seed` that runs `seed_database()` and then the same steps the normal startup runs, and finish with a data fingerprint check.
3. **Add a fingerprint check** (row count and hash per table, timestamps and password hashes masked). Everybody runs it after seeding and compares against a committed `demo_fingerprint.json`. Mismatch means "reseed", not "debug".
4. **Do not use a shared hosted database for development.** It creates collisions between developers, adds sleep and outage risk, and the free tiers differ in engine from your code (Postgres vs MySQL/SQLite). If a hosted public demo is wanted later, host a read-mostly copy of the synthetic data only.
5. **Docker Compose with MySQL is optional**, only if the panel or deployment requires MySQL. Pin the image, seed on first start, and test it once before the defense.
6. **Defer Alembic/Flask-Migrate until after the defense.** Freeze the schema instead (no new `ALTER TABLE` after a cutoff date). Write it up as future work.
7. **Demo-day fallback:** a committed or release-attached SQLite snapshot of the seeded data (about 1 MB), so a demo never depends on the network or a seed run.

Total effort for items 1 to 3 and 7: about half a day.

## 2. What I verified in this repo (not assumed)

I ran the seed three ways into throwaway SQLite files and uploads folders under the session scratchpad. The repo's `.env` and `uploads/` were not read or touched.

| Test | Result |
|------|--------|
| `python app.py --seed` run twice, compared table by table | Same row counts and same content in every table, except: wall-clock timestamp columns (`created_at`, `updated_at`, `resolved_at`, etc.), salted password hashes in `user_account`, and `subject_enrollment` (cause not investigated). So the seed itself is effectively deterministic: it calls `random.seed(20260603)`. |
| `--seed` path vs the normal startup path (`run_startup_tasks()`) on an empty database | **Different data.** Examples: `adviser_assignment` 28 vs 31, `panel_assignment` 45 vs 71, `defense_verdict` 10 vs 13, `schedule_request` 10 vs 16, `policy_document` 0 vs 1, `panel_invitation` 0 vs 13. |
| `--seed` first, then `run_startup_tasks()` | Gets close to the startup-only result but still differs: `adviser_appointment` 28 vs 0, and a few content differences. **Order of operations changes the data.** |
| Student count | The seed produced **145 students**, not the 350 stated in README. `.planning/audit/cross-cutting.md` item M12 already records that the count argument is ignored. Anyone told "350" will think their database is wrong. |

**What this means:** the likely cause of mismatched data is not MySQL. It is that (a) `npm run seed` and "just start the app" are two different recipes, (b) startup only seeds when the student table is empty, so an old database keeps whatever older code put there, and (c) startup also runs additive fixes (`ensure_*`, 32 `ALTER TABLE` statements in `app.py`) that depend on when the developer last pulled. Switching to a hosted database would hide this for a while but not fix it. A date drift remains possible too: `date.today()` and `datetime.now()` appear in `app.py`, so dates derived from "today" will shift between seeding days. A snapshot freezes this; re-seeding does not. I did not test seeding on two different days.

Seeding takes roughly 45 seconds on this machine (inferred from timestamps in the output).

Not tested: the MySQL path. Everything above is SQLite.

## 3. Options compared

### (a) SQLite file + deterministic seed script (recommended base)

| Aspect | Detail |
|--------|--------|
| Cost / limits | None. The seeded database is about 1 MB. |
| Pros | Zero setup, works offline, identical engine for everyone, trivially resettable, ideal for a demo laptop. Already the code default. |
| Cons | Different engine from production MySQL, so MySQL-only behavior is not exercised. Single-writer, which is fine for a demo. The 32 additive `ALTER TABLE` statements work on SQLite for `ADD COLUMN`. |
| Risks | The SQLite file is gitignored (`usls_gs_demo.sqlite3`), so each dev builds their own; the fingerprint check is what proves they match. |
| Effort | 0.5 day: unify seed, add fingerprint, document. |
| Optional snapshot | Commit `demo_fingerprint.json` (small, diffable). Attach the binary `.sqlite3` to a GitHub Release or keep it outside git, rather than committing a binary that changes on every re-seed. Confirm the data is synthetic first (section 6). |

### (b) One shared hosted database (limits as retrieved 2026-10-17)

| Service | Engine | Free-tier facts | Fit |
|---------|--------|-----------------|-----|
| [Neon](https://neon.com/pricing) ([FAQ](https://neon.com/faqs/free-plan-limits-and-quotas)) | Postgres | 100 CU-hours per project per month, 1 GB storage per project (20 GB total), compute auto-suspends after 5 minutes and **cannot be disabled on Free**, 6-hour restore window, hitting a limit suspends compute until next month | Poor: Postgres, not MySQL; cold starts |
| [Supabase](https://supabase.com/pricing.md) | Postgres | 500 MB database, **projects paused after 1 week of inactivity**, 2 active projects, no automatic backups on Free | Poor: Postgres; pause risk before a demo |
| [Aiven](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) | MySQL (also Postgres) | 1 node, 1 CPU, 1 GB RAM, 1 GB disk, no VPC, `max_connections` 76 on MySQL free, one service per type per organization, **may be powered off when idle** (notified first, can be powered back on) | Possible for a MySQL copy; idle shutdown risk |
| [TiDB Cloud Starter](https://docs.pingcap.com/tidbcloud/serverless-limitations/) | MySQL-compatible | Up to 5 free instances per organization, each 5 GiB row storage and 50 million Request Units per month; 400 concurrent connections; when quota is hit, new connections are rejected; idle connection timeout of 340 s on AWS public endpoint; transactions max 30 minutes | Best free MySQL-compatible match; compatibility not tested with this app |
| [PlanetScale](https://planetscale.com/pricing) | Postgres and Vitess (MySQL-compatible) | **No free tier** on the pricing page; cheapest listed is a single-node Postgres at $5/month, Vitess from $39/month | Not free. Hobby plan removal in 2024 is consistently reported by third parties |
| [Railway](https://railway.com/pricing) | Postgres/MySQL as services | Free Trial: one-time $5 credit valid 30 days; Free plan: $1/month usage credit; Hobby $5/month with $5 credit; metered after that | Not a reliable free host; database-specific limits not documented on the page I read |

**Pros of a shared hosted DB:** one source of truth, nothing to install, can be reached from a deployed demo.
**Cons and risks (all of them apply):**
- **Sleeping or paused databases** (Neon 5-minute suspend, Supabase 1-week pause, Aiven idle power-off) cause slow or failed first requests, exactly during a demo.
- **Shared mutable state:** one developer's test (a leave request, a verdict) changes everyone else's data, so test results stop being repeatable. This is the same problem you have now, moved to the network.
- **Engine mismatch:** Neon and Supabase are Postgres. `app.py` contains raw `ALTER TABLE ... DATETIME` statements and a MySQL-specific branch (`is_mysql`, `SET FOREIGN_KEY_CHECKS`); `requirements.txt` has PyMySQL and no Postgres driver. Moving to Postgres is a port, not a config change. This is my reading of the code, not a tested port.
- **Network and credentials:** every dev needs the connection secret; the free tiers have connection and quota caps.
- **Privacy (hard rule):** real student, grade, enrollment or AIMS data must never be placed on a free cloud database. The Philippine Data Privacy Act (RA 10173) governs personal data, and the National Privacy Commission is the regulator ([NPC](https://www.privacy.gov.ph/data-privacy-act/)). I found no NPC advisory specific to student records, so ask the Graduate School data owner, not search results. Only the synthetic seed may ever be hosted.
- **Effort:** 1 to 3 days if it works (account, import, driver and SQL-dialect fixes), more for Postgres.

**Verdict:** use only as an optional public, read-mostly demo copy of synthetic data. Not as the development database.

### (c) Docker Compose with a pinned database and seed

| Aspect | Detail |
|--------|--------|
| Pros | Same MySQL version for everyone; matches production if production is MySQL; reset is `docker compose down -v` then up. |
| Cons | Docker Desktop on Windows needs WSL 2 (version 2.1.5 or later) and 8 GB RAM minimum, hardware virtualization enabled; free for education and for small businesses ([Docker docs](https://docs.docker.com/desktop/setup/install/windows-install/)). This machine has 16 GB RAM, so it is tight when running app, browser and Docker together. Teammates on weaker laptops may struggle. |
| Gotchas (documented in common MySQL-in-Docker guides) | Scripts in the init directory run only on the **first** start with an empty data volume; an existing volume will silently skip them. Use a health check and `depends_on: condition: service_healthy` so Flask does not start before MySQL. Pin the full image tag, not just `mysql:8.4`. ([example guide](https://oneuptime.com/blog/post/2026-03-31-mysql-docker-compose-setup/markdown)) |
| Seeding | Do not seed through SQL dumps in the init directory; run the Python seed against the container so the dataset logic stays in one place. |
| Effort | 1 day including documentation and a test on every teammate's machine. |
| Risk | Does not fix the root cause (two seed recipes). Adds a moving part right before a defense. |

**Verdict:** worth it only if MySQL parity is required. Otherwise skip.

### (d) Migrations with Alembic / Flask-Migrate

| Aspect | Detail |
|--------|--------|
| What it solves | Schema drift: everyone applies the same ordered schema changes instead of ad-hoc `ALTER TABLE` at startup. Commands: `flask db init`, `flask db migrate`, `flask db upgrade`, `flask db stamp` ([Flask-Migrate docs](https://flask-migrate.readthedocs.io/en/latest/)). |
| SQLite note | Since Flask-Migrate 4.0, batch mode is on by default, which works around SQLite's limited `ALTER` support by copying the table. Autogenerate misses renames and some constraints, so every generated script needs review ([Alembic batch docs](https://alembic.sqlalchemy.org/en/latest/batch.html), [Grinberg](https://blog.miguelgrinberg.com/post/fixing-alter-table-errors-with-flask-migrate-and-sqlite)). |
| Adoption on an existing database | Stamp a baseline revision on existing databases and apply later changes after that. I did not find official step-by-step text for this in the sources I read, so confirm in the Alembic cookbook before doing it. |
| Cost here | `app.py` is one ~23,000-line file with 32 `ALTER TABLE` statements and many `ensure_*` functions. Converting them into a clean baseline plus migrations is a multi-day refactor with regression risk, and it adds a dependency not in `requirements.txt` today. |
| Value now | Low for a short-lived demo database that is rebuilt from the seed. High for a product that will keep a long-lived production database. |

**Verdict:** do not start before the defense. Instead, freeze schema changes at a cutoff and make seeding rebuild from scratch (`reset_database()` already does drop-all and create-all). Document Alembic as the production-readiness step.

## 4. Decision table

| Need | Choose |
|------|--------|
| All devs and the demo see identical data, offline, today | (a) with the unified seed and fingerprint |
| Must prove it runs on MySQL | (c), optional, one pinned image |
| Public demo link for panelists | (b) TiDB Starter or Aiven free MySQL, synthetic data only, plus (a) snapshot as fallback |
| Long-lived production use after graduation | (d), plus a paid or institution-hosted database |

## 5. Concrete implementation plan (in priority order)

1. Change `python app.py --seed` so it runs the same steps as `run_startup_tasks()` after `seed_database()`; one code path. Add a test that seeds into a temp DB twice and asserts equal fingerprints (project rule: test first).
2. Write `scripts/data_fingerprint.py` (my scratchpad scripts did this in about 10 lines: per table row count plus MD5 over sorted rows, with timestamp values masked and `user_account.password_hash` excluded). Commit its output as `demo_fingerprint.json`.
3. Make the student count honest: either fix the count argument or correct README (audit item M12).
4. Each developer: remove `DATABASE_URL` from `.env` (or point it at the SQLite file), run `npm run seed`, run the fingerprint check.
5. Demo day: take a seeded `.sqlite3` snapshot, test on the presentation laptop, keep it on a USB stick and in a Release asset.
6. Optional: Docker Compose MySQL file, only if required.

## 6. Open questions to resolve with the owner

- Does the seed contain any real person's name or record? `seed_database` loads "imported source sheets", and the repo has scripts for faculty rosters and monitoring workbooks. I did not inspect the data. If any is real, treat the whole seed as restricted: no cloud DB, no public repo snapshot.
- Is production expected to be MySQL? That decides whether (c) is worth doing.
- Why does `subject_enrollment` differ between two identical seed runs? Not investigated.
- Do dates shift when the seed is run on different days? Likely, not tested.

## 7. Sources

| Source | Retrieved / date | Notes |
|--------|------------------|-------|
| [Neon pricing](https://neon.com/pricing) and [Free plan FAQ](https://neon.com/faqs/free-plan-limits-and-quotas) | 2026-10-17 | Both state 1 GB storage per project. An older blog and a third-party article cited 0.5 GB and 50 CU-hours; treat those as stale. |
| [Supabase pricing](https://supabase.com/pricing.md) | 2026-10-17 | One third-party page listed 500 MB egress; vendor says 5 GB. |
| [Aiven MySQL free tier](https://aiven.io/docs/products/mysql/concepts/mysql-free-tier) | 2026-10-17 | Aiven's search snippet for the Postgres free tier says `max_connections` 20; the MySQL doc says 76. Aiven's page does not say when idle services are deleted. |
| [TiDB Cloud Starter limits](https://docs.pingcap.com/tidbcloud/serverless-limitations/) | 2026-10-17 | The page does not say whether idle instances are paused or deleted. Verify before relying on it. |
| [PlanetScale pricing](https://planetscale.com/pricing) | 2026-10-17 | No free tier listed. Third-party reports of 2026 plan removals ([costbench](https://costbench.com/changelog/planetscale-plan-removed-2026-07/), others) are single-source; not relied on. |
| [Railway pricing](https://railway.com/pricing) | 2026-10-17 | Third-party sites disagree on details; only vendor numbers used. |
| [Docker Desktop for Windows requirements](https://docs.docker.com/desktop/setup/install/windows-install/) | 2026-10-17 | |
| [Flask-Migrate docs](https://flask-migrate.readthedocs.io/en/latest/), [Alembic batch](https://alembic.sqlalchemy.org/en/latest/batch.html), [Grinberg article](https://blog.miguelgrinberg.com/post/fixing-alter-table-errors-with-flask-migrate-and-sqlite) | 2026-10-17 | Article date not checked. |
| [NPC Data Privacy Act page](https://www.privacy.gov.ph/data-privacy-act/) | 2026-10-17 | Law reference only, not legal advice. |
| Local experiments | 2026-10-17 | Scratch outputs under the session scratchpad; repo files unchanged. |
