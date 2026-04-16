# Manual Migrations

One-off SQL scripts that were applied out-of-band of the normal
`prisma migrate` flow. Kept here for historical reference and for
re-applying when rebuilding a database from scratch.

These are **not** picked up automatically by `prisma migrate deploy`
because they live outside `prisma/migrations/`.

## Files

- **`rebaseline-reconcile.sql`** — Reconciliation script used during the
  2026-03-17 migration rebaseline (see `docs/archive/prisma-migrations-2026-03-17/`).
- **`bonus_credits.sql`** — Manual backfill for bonus credit buckets.
- **`v27.sql`** — Manual patch applied alongside schema version 27.

## Applying manually

```bash
psql "$DATABASE_URL" -f prisma/manual/<file>.sql
```

Run only on databases that have not already had the patch applied.
