# Application Architecture

This repo is a full-stack graduate school monitoring platform. The current codebase is organized as a two-app project:

```text
CAPSTONE-USLS-MVP/
  client/       React + TypeScript frontend
  server/       Express + Prisma API
  docs/         product, architecture, and development notes
```

## Operating Model

Use root-level scripts for normal development:

```bash
npm run dev
npm run build
npm test
```

The root scripts delegate to `client` and `server` so contributors do not need to remember separate folder commands for common work.

## Backend Shape

Backend code is grouped by business module under `server/src/modules`.

Current modules:

- `auth`: login/session identity
- `users`: account and role administration
- `students`: lifecycle and student profile operations
- `milestones`: milestone definition and status operations
- `tasks`: role-based work queues and decisions
- `documents`: checklist, upload versions, revision notes, downloads
- `scheduling`: requests, availability, outcomes
- `alerts`: monitoring thresholds, alerts, interventions
- `analytics`: descriptive and prescriptive outputs
- `audit`: audit log query surface
- `admin`: configuration for thresholds and routing rules
- `assistant`: feature-flagged AI helper endpoint

As the app scales, each module should move toward this internal shape:

```text
server/src/modules/example/
  example.routes.ts       Express route definitions only
  example.schemas.ts      Zod request/response validation
  example.service.ts      business rules and transactions
  example.repository.ts   Prisma query composition, when queries become complex
  example.test.ts         module-level API or service tests
```

Do not put workflow rules directly in React components. Workflow rules belong in backend services so the same rules protect API usage, imports, and future integrations.

## Frontend Shape

Frontend code currently uses route pages under `client/src/pages` and shared UI under `client/src/components`.

As screens grow, move page-specific pieces into feature folders:

```text
client/src/features/students/
  components/
  hooks/
  pages/
  types.ts
```

Keep generic UI controls in `client/src/components/ui`. Keep backend calls in `client/src/api` until the API layer becomes too large, then split by feature.

## Database Shape

Prisma is the source of truth for the database:

- Schema: `server/prisma/schema.prisma`
- Migrations: `server/prisma/migrations`
- Demo data: `server/prisma/seed.ts`

The schema should represent thesis concepts directly:

- lifecycle stages and stage history
- milestone definitions and student milestone status
- tasks, decision logs, and routing rules
- documents, uploaded versions, and revision notes
- schedule requests, availability, and schedule events
- alerts, thresholds, notifications, and interventions
- append-only audit logs

For full-scale reliability, derived status should be computed from timestamped records wherever possible. Manually edited "current status" fields are acceptable for quick filtering, but they must be kept in sync by backend services.

## Scaling Rules

- Every mutating endpoint should validate input with Zod.
- Every important state change should happen in a Prisma transaction.
- Every lifecycle transition, task decision, upload, schedule outcome, configuration change, and access denial should write an audit log.
- Every endpoint that returns student-sensitive data must enforce scope server-side.
- Every dashboard metric should have a named definition and a test fixture.
- Configuration such as milestone definitions, routing rules, thresholds, and checklist templates should be data-driven where practical.

## AI and Policy Guidance

The thesis calls for policy-grounded guidance. Treat AI as advisory only:

- It must not approve, reject, advance, or close records automatically.
- It should receive de-identified or minimized case data.
- It should cite or reference approved source material where possible.
- It should be feature-flagged and logged.

The system should first be reliable without AI. RAG should sit on top of validated records and approved documents, not replace the workflow engine.
