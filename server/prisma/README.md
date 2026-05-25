# Database Workflow

Prisma is the database source of truth for this app.

## Files

- `schema.prisma`: application data model
- `migrations/`: ordered database migrations
- `seed.ts`: demo data for local development and prototype walkthroughs

## Local Commands

From the repo root:

```bash
npm run prisma:generate
npm run prisma:deploy
npm run seed
```

Or from `server/`:

```bash
npx prisma generate
npx prisma migrate deploy
npm run seed
```

## Changing the Schema

1. Edit `server/prisma/schema.prisma`.
2. Create a migration:

   ```bash
   cd server
   npx prisma migrate dev --name describe_change
   ```

3. Review the generated SQL in `server/prisma/migrations`.
4. Run tests:

   ```bash
   npm test
   ```

5. Commit the schema and migration together.

## Rules

- Do not manually change the MySQL schema and leave Prisma behind.
- Do not edit old migration files after they have been shared.
- Use a new migration for every schema change.
- Keep seed data realistic but non-sensitive.
- Add indexes when a dashboard, queue, or report depends on filtering/sorting large records.
- Use transactions for multi-table workflow changes.

## Thesis Alignment

The current schema is grouped around the thesis ERD:

- Student and program context
- Identity, roles, and assignments
- Lifecycle and milestones
- Workflow tasks and decisions
- Documents and revisions
- Scheduling and coordination
- Monitoring, alerts, and interventions
- Auditability

Future schema work should keep those groups recognizable. If a new table does not fit one of those groups, document why before adding it.
