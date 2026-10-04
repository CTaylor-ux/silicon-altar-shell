/**
 * db.ts: the Postgres store. NODE ONLY; never import this from middleware.
 *
 * WHY THIS EXISTS. On a host with a disk the app keeps three things in files:
 * records/queries.jsonl (lib/record.ts), invites.json (lib/invites.ts) and
 * records/invite-requests.jsonl (app/api/request). A serverless host has no
 * disk that survives a request, so there the same three things live in
 * Postgres. docs/DEPLOY.md section 1 deferred Postgres in Thread 30; the
 * operator reversed that on 2026-10-04 to deploy on Vercel with Neon.
 *
 * THE RULE. If DATABASE_URL is set, the database is the store. If it is not,
 * the files are, exactly as before. Nothing reads both. Local development
 * leaves DATABASE_URL unset and behaves as it always has.
 *
 * SHAPE. One row per record, the record kept whole as JSON. This is a copy of
 * the file layout, not the C2 schema: `sa_records` is append-only like the
 * JSONL (a status change is a new row with the same id, and row order is the
 * history), so lib/contributions.ts reads it unchanged. Tables are created by
 * `node scripts/db-setup.mjs`.
 */

import { neon } from '@neondatabase/serverless';

const URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

export function hasDb(): boolean {
  return URL.length > 0;
}

type Sql = ReturnType<typeof neon>;
let client: Sql | null = null;

/** Tagged-template query over HTTP; one round trip per call, no pool to leak. */
export function sql(): Sql {
  if (!client) client = neon(URL);
  return client;
}

export type Row = Record<string, unknown>;
