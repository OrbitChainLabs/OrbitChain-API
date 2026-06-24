# Queue dead-letter maintenance — changes made

Summary

- Bounded failed-job retention: default job options updated so failed jobs are retained only up to a bounded count instead of forever.
- Daily maintenance cron: a scheduled service prunes old failed jobs, persists a write-only record in Postgres, optionally reports to Sentry, and removes old failed jobs from Redis.
- Observability: a Prometheus gauge `bull_dead_letter_count{queue="..."}` is updated with the current failed-job count per queue.
- Persistence: added a Prisma model `DeadLetter` (mapped to table `dead_letters`) to store pruned failure records for audit.

Files added/modified

- Modified: [src/queue/queue.module.ts](src/queue/queue.module.ts) — set `removeOnFail: 1000`, registered `ScheduleModule`, and added the maintenance service
- Added: [src/queue/queue-maintenance.service.ts](src/queue/queue-maintenance.service.ts) — maintenance cron, Sentry integration, Prometheus metric
- Modified: [prisma/schema.prisma](prisma/schema.prisma) — added `DeadLetter` model
- Modified: [package.json](package.json) — added `@nestjs/schedule` and `prom-client` dependencies

Behavior details

- Default job options (applied to the main queues: `email`, `contract-events`, `analytics`, `export`):
  - `attempts: 3`
  - `backoff: { type: 'exponential', delay: 5000 }`
  - `removeOnComplete: true`
  - `removeOnFail: 1000` (keep most recent 1000 failed jobs)

- Maintenance cron (`QueueMaintenanceService`)
  - Runs daily at midnight (server timezone) by default.
  - Scans failed jobs (bounded to recent 10k per queue), and for any failed job older than 30 days:
    - Persists a record to `dead_letters` with job payload, error message, and timestamps.
    - Optionally sends a Sentry message when `SENTRY_DSN` is set.
    - Removes the job from Redis.
  - Updates Prometheus gauge `bull_dead_letter_count` for each queue via `prom-client`.

Deployment & local steps

1. Install dependencies:

```bash
npm install
```

2. Generate Prisma client and run migrations (create migration to add `dead_letters`):

```bash
npx prisma generate
npx prisma migrate dev --name add_dead_letters
```

3. Set optional environment variables:

- `SENTRY_DSN` to enable Sentry reporting.
- `DATABASE_URL` for Postgres.

4. Build and run:

```bash
npm run build
npm start:dev
```

Notes & follow-ups

- I did not add an HTTP metrics endpoint — if you want `/metrics` exported for Prometheus scraping I can add a small controller that exposes `prom-client` metrics.
- The branch with these changes is: `feat/queue-dead-letter-maintenance`.
- Open PR URL: https://github.com/coderolisa/OrbitChain-API/pull/new/feat/queue-dead-letter-maintenance

If you'd like, I can also:

- Add an HTTP `/metrics` endpoint.
- Make the prune retention and retained-fail-count configurable via environment variables.
- Add unit tests around the maintenance service.
